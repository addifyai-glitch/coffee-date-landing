/* ==========================================================================
   GET /api/admin/waitlist — HTTP Basic Auth against ADMIN_USER/ADMIN_PASS.
   JSON list + counts by source/city by default; ?format=csv for a download.
   ========================================================================== */

import { getSupabase } from '../_lib/supabase.js';
import { rejectIfUnauthorized } from '../_lib/adminAuth.js';
import { toCsv } from '../_lib/csv.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (rejectIfUnauthorized(req, res)) return;

  try {
    const supabase = getSupabase();
    const { data: rows, error } = await supabase.from('waitlist').select('*').order('position', { ascending: true });
    if (error) throw error;

    if (req.query.format === 'csv') {
      const csv = toCsv(rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="waitlist-${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.status(200).send(csv);
    }

    return res.status(200).json({
      ok: true,
      count: rows.length,
      counts_by_source: countBy(rows, 'source'),
      counts_by_city: countBy(rows, 'city'),
      rows,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: 'Something went wrong.' });
  }
}

function countBy(rows, key) {
  const counts = {};
  rows.forEach((row) => {
    const value = row[key] || 'unknown';
    counts[value] = (counts[value] || 0) + 1;
  });
  return counts;
}
