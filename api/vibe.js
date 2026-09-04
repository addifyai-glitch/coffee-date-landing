/* ==========================================================================
   POST /api/vibe — the restored "Let's See If We Vibe" page (/vibe.html).
   Same abuse-prevention pattern as the rest of the site: honeypot, then
   rate limiting, then validation. Stores the response and best-effort
   emails the owner (+ the visitor, if they left an email) via Resend —
   the WhatsApp deep link on the page is the primary confirmation channel,
   so an email failure here never blocks the user-visible flow.
   ========================================================================== */

import { getSupabase } from './_lib/supabase.js';
import { checkRateLimit, getClientIp, hashIp } from './_lib/ratelimit.js';
import { normalizeEmail, isHoneypotTripped, cleanString } from './_lib/validate.js';
import { getJsonBody, requireJsonContentType } from './_lib/http.js';
import { sendVibeOwnerNotification, sendVibeVisitorConfirmation } from './_lib/email.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (!requireJsonContentType(req)) return res.status(400).json({ ok: false, error: 'Invalid content type' });

  let body;
  try {
    body = await getJsonBody(req);
  } catch {
    return res.status(400).json({ ok: false, error: 'Invalid JSON' });
  }
  if (!body || typeof body !== 'object') return res.status(400).json({ ok: false, error: 'Invalid JSON' });

  if (isHoneypotTripped(body)) return res.status(200).json({ ok: true });

  const ip = getClientIp(req);
  const ipHash = hashIp(ip);

  try {
    const rl = await checkRateLimit('vibe', ipHash);
    if (!rl.allowed) {
      return res.status(429).json({ ok: false, error: 'Too many requests, try again in a few minutes' });
    }

    if (!body.consent) {
      return res.status(400).json({ ok: false, error: 'Agree to the privacy policy to continue.' });
    }

    const activity = cleanString(body.activity, { maxLength: 60 });
    const date = cleanString(body.date, { maxLength: 20 });
    const time = cleanString(body.time, { maxLength: 20 });
    const city = cleanString(body.city, { maxLength: 120 });
    if (!activity || !date || !time || !city) {
      return res.status(400).json({ ok: false, error: 'Activity, date, time, and city are required.' });
    }
    const chosenAt = new Date(`${date}T${time}`);
    if (Number.isNaN(chosenAt.getTime()) || chosenAt.getTime() <= Date.now()) {
      return res.status(400).json({ ok: false, error: 'Choose a date and time in the future.' });
    }

    const name = cleanString(body.name, { maxLength: 120 });
    const phone = cleanString(body.phone, { maxLength: 40 });
    const message = cleanString(body.message, { maxLength: 1000 });
    const emailRaw = cleanString(body.email, { maxLength: 254 });
    const email = emailRaw ? normalizeEmail(emailRaw) : null;
    if (emailRaw && !email) {
      return res.status(400).json({ ok: false, error: 'That email address doesn\'t look right.' });
    }

    const supabase = getSupabase();
    const { error } = await supabase.from('vibe_responses').insert({
      name, email, phone, activity, preferred_date: date, preferred_time: time, city, message, ip_hash: ipHash,
    });
    if (error) throw error;

    const emailPayload = { name, email, activity, date, time, city, message };
    await Promise.allSettled([
      sendVibeOwnerNotification(emailPayload),
      sendVibeVisitorConfirmation(emailPayload),
    ]);

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ ok: false, error: 'Something went wrong — try again.' });
  }
}
