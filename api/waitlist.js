/* ==========================================================================
   POST /api/waitlist — create a pending signup, send the confirm email.
   ========================================================================== */

import { nanoid } from 'nanoid';
import { getSupabase } from './_lib/supabase.js';
import { signToken } from './_lib/token.js';
import { checkRateLimit, getClientIp, hashIp } from './_lib/ratelimit.js';
import { normalizeEmail, isHoneypotTripped, cleanString } from './_lib/validate.js';
import { getJsonBody, requireJsonContentType } from './_lib/http.js';
import { sendWaitlistConfirm } from './_lib/email.js';

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

  // Honeypot: pretend success, do nothing.
  if (isHoneypotTripped(body)) return res.status(200).json({ ok: true });

  const ip = getClientIp(req);
  const ipHash = hashIp(ip);

  try {
    const rl = await checkRateLimit('waitlist', ipHash);
    if (!rl.allowed) {
      return res.status(429).json({ ok: false, error: 'Too many requests, try again in a few minutes' });
    }

    const email = normalizeEmail(body.email);
    if (!email) return res.status(400).json({ ok: false, error: 'A valid email is required' });
    if (!body.consent) return res.status(400).json({ ok: false, error: 'Agree to the privacy policy to join the waitlist' });

    const name = cleanString(body.name, { maxLength: 120 });
    const city = cleanString(body.city, { maxLength: 120 });
    const source = cleanString(body.source, { maxLength: 40 }) || 'landing';
    const utmSource = cleanString(body.utm_source, { maxLength: 120 });
    const utmMedium = cleanString(body.utm_medium, { maxLength: 120 });
    const utmCampaign = cleanString(body.utm_campaign, { maxLength: 120 });
    const ref = cleanString(body.ref, { maxLength: 32 });
    const userAgent = cleanString(req.headers['user-agent'], { maxLength: 300 });

    const supabase = getSupabase();

    const { data: existing, error: existingErr } = await supabase
      .from('waitlist').select('*').eq('email', email).maybeSingle();
    if (existingErr) throw existingErr;

    if (existing) {
      if (!existing.confirmed_at) {
        const token = signToken('wl', existing.id);
        await sendWaitlistConfirm({ email, token });
      }
      return res.status(200).json({ ok: true, already_registered: true, position: existing.position });
    }

    let referredBy = null;
    if (ref) {
      const { data: referrer } = await supabase
        .from('waitlist').select('referral_code').eq('referral_code', ref).maybeSingle();
      if (referrer) referredBy = referrer.referral_code;
    }

    const { data: maxRow } = await supabase
      .from('waitlist').select('position').order('position', { ascending: false }).limit(1).maybeSingle();
    const nextPosition = (maxRow?.position || 0) + 1;

    const { data: inserted, error: insertErr } = await supabase.from('waitlist').insert({
      email,
      name,
      city,
      source: referredBy ? 'referral' : source,
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      referral_code: nanoid(8),
      referred_by: referredBy,
      position: nextPosition,
      ip_hash: ipHash,
      user_agent: userAgent,
    }).select().single();
    if (insertErr) throw insertErr;

    const token = signToken('wl', inserted.id);
    await sendWaitlistConfirm({ email, token });

    return res.status(200).json({ ok: true, position: nextPosition });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ ok: false, error: 'Something went wrong — try again.' });
  }
}
