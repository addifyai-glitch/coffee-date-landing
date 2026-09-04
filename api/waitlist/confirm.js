/* ==========================================================================
   GET /api/waitlist/confirm?token= — verify a wl token, set confirmed_at
   (idempotent), bump the referrer's referral_count on first confirmation,
   send the welcome email, redirect to /welcome.html.
   ========================================================================== */

import { getSupabase } from '../_lib/supabase.js';
import { verifyToken } from '../_lib/token.js';
import { sendWaitlistWelcome } from '../_lib/email.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).send('Method not allowed');

  const token = req.query.token;

  try {
    const result = verifyToken(token, 'wl');
    if (!result.ok) {
      return res.status(result.reason === 'expired' ? 410 : 401).send(errorPage(result.reason));
    }

    const supabase = getSupabase();
    const { data: row, error } = await supabase.from('waitlist').select('*').eq('id', result.id).maybeSingle();
    if (error) throw error;
    if (!row) return res.status(404).send(errorPage('not_found'));

    if (!row.confirmed_at) {
      const { error: updateErr } = await supabase
        .from('waitlist').update({ confirmed_at: new Date().toISOString() }).eq('id', row.id);
      if (updateErr) throw updateErr;

      if (row.referred_by) {
        const { data: referrer } = await supabase
          .from('waitlist').select('*').eq('referral_code', row.referred_by).maybeSingle();
        if (referrer) {
          await supabase.from('waitlist')
            .update({ referral_count: referrer.referral_count + 1 }).eq('id', referrer.id);
        }
      }

      await sendWaitlistWelcome({ email: row.email, position: row.position, referralCode: row.referral_code });
    }

    // Re-read so a revisit after the confirm link reflects referrals accrued since.
    const { data: fresh } = await supabase.from('waitlist').select('*').eq('id', row.id).maybeSingle();
    const current = fresh || row;

    const siteUrl = process.env.SITE_URL || '';
    const location = `${siteUrl}/welcome.html?pos=${current.position}&ref=${current.referral_code}&rc=${current.referral_count}`;
    res.writeHead(302, { Location: location });
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).send(errorPage('server_error'));
  }
}

function errorPage(reason) {
  const messages = {
    expired: 'This confirmation link has expired.',
    bad_signature: 'This link looks invalid.',
    malformed: 'This link looks invalid.',
    wrong_type: 'This link looks invalid.',
    not_found: "We couldn't find that signup.",
    server_error: 'Something went wrong — try again shortly.',
  };
  const message = messages[reason] || 'Something went wrong.';
  return `<!doctype html><html><body style="font-family:Georgia,serif;padding:64px 24px;text-align:center;background:#F4EBDD;color:#2B1D16;"><h1>${message}</h1><p><a href="/" style="color:#C8552D;">Back to Pookie</a></p></body></html>`;
}
