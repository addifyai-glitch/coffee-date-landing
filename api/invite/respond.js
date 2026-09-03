/* ==========================================================================
   POST /api/invite/respond — body { token, action, proposed_starts_at? }.
   `inv` tokens (recipient): accept | decline | propose.
   `snd` tokens (sender): accepts the recipient's proposed time.
   ========================================================================== */

import { getSupabase } from '../_lib/supabase.js';
import { signToken, verifyToken } from '../_lib/token.js';
import { checkRateLimit, getClientIp, hashIp } from '../_lib/ratelimit.js';
import { getJsonBody, requireJsonContentType } from '../_lib/http.js';
import { buildInviteIcs } from '../_lib/ics.js';
import { sendInviteConfirmed, sendInviteDeclined, sendInviteProposed } from '../_lib/email.js';

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

  const ip = getClientIp(req);
  const ipHash = hashIp(ip);

  try {
    const rl = await checkRateLimit('invite_respond', ipHash);
    if (!rl.allowed) {
      return res.status(429).json({ ok: false, error: 'Too many requests, try again in a few minutes' });
    }

    const { token, action } = body;
    const inv = verifyToken(token, 'inv');
    const result = inv.ok ? inv : verifyToken(token, 'snd');

    if (!result.ok) {
      const status = result.reason === 'expired' ? 410 : 401;
      const message = result.reason === 'expired' ? 'This link has expired.' : 'This link looks invalid.';
      return res.status(status).json({ ok: false, error: message });
    }

    const supabase = getSupabase();
    const { data: invite, error } = await supabase.from('invites').select('*').eq('id', result.id).maybeSingle();
    if (error) throw error;
    if (!invite) return res.status(404).json({ ok: false, error: 'Invite not found' });

    if (result.type === 'snd') {
      if (invite.status !== 'proposed') {
        return res.status(410).json({ ok: false, error: 'This invite has already been answered.' });
      }
      await confirmInvite(supabase, invite, invite.proposed_starts_at);
      return res.status(200).json({ ok: true, status: 'accepted' });
    }

    if (invite.responded_at) {
      return res.status(410).json({ ok: false, error: 'This invite has already been answered.' });
    }

    if (action === 'accept') {
      await confirmInvite(supabase, invite, invite.starts_at);
      return res.status(200).json({ ok: true, status: 'accepted' });
    }

    if (action === 'decline') {
      const { error: updateErr } = await supabase.from('invites')
        .update({ status: 'declined', responded_at: new Date().toISOString() }).eq('id', invite.id);
      if (updateErr) throw updateErr;
      await sendInviteDeclined({ invite });
      return res.status(200).json({ ok: true, status: 'declined' });
    }

    if (action === 'propose') {
      const proposedStartsAt = body.proposed_starts_at ? new Date(body.proposed_starts_at) : null;
      if (!proposedStartsAt || Number.isNaN(proposedStartsAt.getTime())) {
        return res.status(400).json({ ok: false, error: 'Please choose a valid date and time.' });
      }
      const { error: updateErr } = await supabase.from('invites').update({
        status: 'proposed',
        proposed_starts_at: proposedStartsAt.toISOString(),
        responded_at: new Date().toISOString(),
      }).eq('id', invite.id);
      if (updateErr) throw updateErr;

      const sndToken = signToken('snd', invite.id);
      await sendInviteProposed({
        invite: { ...invite, proposed_starts_at: proposedStartsAt.toISOString() },
        sndToken,
      });
      return res.status(200).json({ ok: true, status: 'proposed' });
    }

    return res.status(400).json({ ok: false, error: 'Unknown action' });
  } catch (err) {
    console.error(err);
    return res.status(err.status || 500).json({ ok: false, error: 'Something went wrong. Please try again.' });
  }
}

async function confirmInvite(supabase, invite, finalStartsAt) {
  const { data: updated, error } = await supabase.from('invites').update({
    status: 'accepted',
    starts_at: finalStartsAt,
    responded_at: new Date().toISOString(),
  }).eq('id', invite.id).select().single();
  if (error) throw error;

  const icsContent = buildInviteIcs(updated);
  await sendInviteConfirmed({ invite: updated, icsContent });
  return updated;
}
