/* ==========================================================================
   POST /api/invite  — create an invite, email recipient + sender copy.
   GET  /api/invite?token= — public-safe invite details for respond.html
   (works for both the recipient's `inv` token and the sender's `snd` token).
   ========================================================================== */

import { getSupabase } from './_lib/supabase.js';
import { signToken, verifyToken } from './_lib/token.js';
import { checkRateLimit, getClientIp, hashIp } from './_lib/ratelimit.js';
import { normalizeEmail, isHoneypotTripped, cleanString } from './_lib/validate.js';
import { getJsonBody, requireJsonContentType } from './_lib/http.js';
import { sendInviteRecipient, sendInviteSenderCopy } from './_lib/email.js';

export default async function handler(req, res) {
  if (req.method === 'GET') return handleGet(req, res);
  if (req.method === 'POST') return handlePost(req, res);
  return res.status(405).json({ ok: false, error: 'Method not allowed' });
}

async function handleGet(req, res) {
  const token = req.query.token;
  const inv = verifyToken(token, 'inv');
  const result = inv.ok ? inv : verifyToken(token, 'snd');

  if (!result.ok) {
    const status = result.reason === 'expired' ? 410 : 401;
    const message = result.reason === 'expired' ? 'This invite link has expired.' : 'This invite link looks invalid.';
    return res.status(status).json({ ok: false, error: message });
  }

  try {
    const supabase = getSupabase();
    const { data: invite, error } = await supabase.from('invites').select('*').eq('id', result.id).maybeSingle();
    if (error) throw error;
    if (!invite) return res.status(404).json({ ok: false, error: 'Invite not found' });

    const role = result.type === 'snd' ? 'sender' : 'recipient';

    if (role === 'recipient' && invite.responded_at) {
      return res.status(410).json({ ok: false, error: 'This invite has already been answered.' });
    }
    if (role === 'sender' && invite.status !== 'proposed') {
      return res.status(410).json({ ok: false, error: 'This invite has already been answered.' });
    }

    return res.status(200).json({
      ok: true,
      role,
      invite: {
        sender_name: invite.sender_name,
        recipient_name: invite.recipient_name,
        place: invite.place,
        starts_at: role === 'sender' ? invite.proposed_starts_at : invite.starts_at,
        timezone: invite.timezone,
        message: invite.message,
        status: invite.status,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Something went wrong.' });
  }
}

async function handlePost(req, res) {
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
    const rl = await checkRateLimit('invite', ipHash);
    if (!rl.allowed) {
      return res.status(429).json({ ok: false, error: 'Too many requests, try again in a few minutes' });
    }

    const senderName = cleanString(body.sender_name, { maxLength: 120 });
    const senderEmail = normalizeEmail(body.sender_email);
    const recipientName = cleanString(body.recipient_name, { maxLength: 120 });
    const recipientEmail = normalizeEmail(body.recipient_email);
    const place = cleanString(body.place, { maxLength: 200 });
    const startsAt = body.starts_at ? new Date(body.starts_at) : null;
    const timezone = cleanString(body.timezone, { maxLength: 60 }) || 'Europe/Vienna';
    const message = cleanString(body.message, { maxLength: 1000 });

    if (!senderName || !senderEmail || !recipientEmail || !place || !startsAt || Number.isNaN(startsAt.getTime())) {
      return res.status(400).json({ ok: false, error: 'Please fill in your name, email, their email, a place, and a date/time.' });
    }

    const supabase = getSupabase();
    const { data: invite, error } = await supabase.from('invites').insert({
      sender_name: senderName,
      sender_email: senderEmail,
      recipient_name: recipientName,
      recipient_email: recipientEmail,
      place,
      starts_at: startsAt.toISOString(),
      timezone,
      message,
      ip_hash: ipHash,
    }).select().single();
    if (error) throw error;

    const token = signToken('inv', invite.id);
    await Promise.allSettled([
      sendInviteRecipient({ invite, token }),
      sendInviteSenderCopy({ invite }),
    ]);

    return res.status(200).json({ ok: true, id: invite.id });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ ok: false, error: 'Something went wrong. Please try again.' });
  }
}
