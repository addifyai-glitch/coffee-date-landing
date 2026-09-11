/* ==========================================================================
   GET /api/admin/invites — HTTP Basic Auth against ADMIN_USER/ADMIN_PASS.
   JSON stats (status breakdown, per-day for the last 30 days, per-origin,
   accept rate) by default; ?format=csv for a raw-rows download.
   ========================================================================== */

import { getSupabase } from '../_lib/supabase.js';
import { rejectIfUnauthorized } from '../_lib/adminAuth.js';
import { toCsv } from '../_lib/csv.js';

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });
  if (rejectIfUnauthorized(req, res)) return;

  try {
    const supabase = getSupabase();
    const { data: rows, error } = await supabase.from('invites').select('*').order('created_at', { ascending: false });
    if (error) throw error;

    if (req.query.format === 'csv') {
      const csv = toCsv(rows);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="invites-${new Date().toISOString().slice(0, 10)}.csv"`);
      return res.status(200).send(csv);
    }

    const total = rows.length;
    const byStatus = countBy(rows, 'status');
    const byOrigin = countBy(rows, 'origin');
    const byOriginAndStatus = {};
    rows.forEach((r) => {
      const origin = r.origin || 'home';
      byOriginAndStatus[origin] = byOriginAndStatus[origin] || {};
      byOriginAndStatus[origin][r.status] = (byOriginAndStatus[origin][r.status] || 0) + 1;
    });

    const accepted = byStatus.accepted || 0;
    const declined = byStatus.declined || 0;
    const responded = accepted + declined; // pending/proposed haven't been answered yet either way
    const acceptRateOfTotal = total ? accepted / total : 0;
    const acceptRateOfResponded = responded ? accepted / responded : 0;

    const perDay = last30DaysSeries(rows);

    return res.status(200).json({
      ok: true,
      total,
      by_status: byStatus,
      by_origin: byOrigin,
      by_origin_and_status: byOriginAndStatus,
      accept_rate_of_total: round(acceptRateOfTotal),
      accept_rate_of_responded: round(acceptRateOfResponded),
      per_day_last_30: perDay,
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

function round(n) {
  return Math.round(n * 1000) / 1000;
}

// One entry per day for the last 30 days (oldest first), each with a total
// and a per-origin split, so the dashboard doesn't have to re-derive dates.
function last30DaysSeries(rows) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today.getTime() - i * DAY_MS);
    days.push({ date: d.toISOString().slice(0, 10), total: 0, home: 0, vibe: 0 });
  }
  const byDate = Object.fromEntries(days.map((d) => [d.date, d]));

  rows.forEach((row) => {
    const dateKey = String(row.created_at).slice(0, 10);
    const bucket = byDate[dateKey];
    if (!bucket) return; // older than 30 days
    bucket.total += 1;
    const origin = row.origin === 'vibe' ? 'vibe' : 'home';
    bucket[origin] += 1;
  });

  return days;
}
