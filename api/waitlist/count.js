/* ==========================================================================
   GET /api/waitlist/count — public, unauthenticated. Returns only a total
   row count, never any row content, so it's safe to expose on the homepage
   as "X people have joined" without leaking emails/names/etc. Response is
   CDN-cached briefly since it's hit on every homepage load and doesn't need
   to be second-by-second accurate.
   ========================================================================== */

import { getSupabase } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  try {
    const supabase = getSupabase();
    const { count, error } = await supabase.from('waitlist').select('id', { count: 'exact', head: true });
    if (error) throw error;

    res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
    return res.status(200).json({ ok: true, count: count || 0 });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Something went wrong.' });
  }
}
