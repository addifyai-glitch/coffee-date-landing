/* ==========================================================================
   GET /api/invite/ics?token= — downloads the .ics for an accepted invite.
   Works with either the recipient's `inv` token or the sender's `snd`
   token, same verification pattern as GET /api/invite. This is the
   recipient's only path to a calendar file when they have no email on
   record (invite shared via WhatsApp/link) — respond.html's "done" state
   links here after an accept, for both parties, email or not.
   ========================================================================== */

import { getSupabase } from '../_lib/supabase.js';
import { verifyToken } from '../_lib/token.js';
import { buildInviteIcs } from '../_lib/ics.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const token = req.query.token;
  try {
    const inv = verifyToken(token, 'inv');
    const result = inv.ok || inv.reason !== 'wrong_type' ? inv : verifyToken(token, 'snd');

    if (!result.ok) {
      const status = result.reason === 'expired' ? 410 : 401;
      const message = result.reason === 'expired' ? 'This link has expired.' : 'This link looks invalid.';
      return res.status(status).json({ ok: false, error: message });
    }

    const supabase = getSupabase();
    const { data: invite, error } = await supabase.from('invites').select('*').eq('id', result.id).maybeSingle();
    if (error) throw error;
    if (!invite) return res.status(404).json({ ok: false, error: 'Invite not found' });
    if (invite.status !== 'accepted') {
      return res.status(409).json({ ok: false, error: 'This invite hasn\'t been confirmed yet.' });
    }

    const icsContent = buildInviteIcs(invite);
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="coffee-date.ics"');
    return res.status(200).send(icsContent);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Something went wrong.' });
  }
}
