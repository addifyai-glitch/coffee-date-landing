/* ==========================================================================
   GET /api/admin/waitlist — HTTP Basic Auth against ADMIN_USER/ADMIN_PASS.
   JSON list + counts by source/city by default; ?format=csv for a download.
   ========================================================================== */

import crypto from 'node:crypto';
import { getSupabase } from '../_lib/supabase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ ok: false, error: 'Method not allowed' });

  const adminUser = process.env.ADMIN_USER;
  const adminPass = process.env.ADMIN_PASS;
  if (!adminUser || !adminPass) {
    console.error('ADMIN_USER / ADMIN_PASS missing from environment');
    return res.status(500).json({ ok: false, error: 'Admin is not configured' });
  }

  if (!isAuthorized(req, adminUser, adminPass)) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Pookie Admin"');
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }

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

function isAuthorized(req, adminUser, adminPass) {
  const auth = req.headers.authorization || '';
  const [scheme, encoded] = auth.split(' ');
  if (scheme !== 'Basic' || !encoded) return false;

  let decoded;
  try {
    decoded = Buffer.from(encoded, 'base64').toString('utf8');
  } catch {
    return false;
  }
  const sepIndex = decoded.indexOf(':');
  if (sepIndex === -1) return false;
  const user = decoded.slice(0, sepIndex);
  const pass = decoded.slice(sepIndex + 1);

  return timingSafeEqualStr(user, adminUser) && timingSafeEqualStr(pass, adminPass);
}

function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function countBy(rows, key) {
  const counts = {};
  rows.forEach((row) => {
    const value = row[key] || 'unknown';
    counts[value] = (counts[value] || 0) + 1;
  });
  return counts;
}

function toCsv(rows) {
  if (!rows.length) return '';
  const columns = Object.keys(rows[0]);
  const lines = [columns.join(',')];
  rows.forEach((row) => {
    lines.push(columns.map((col) => {
      let val = row[col];
      if (val === null || val === undefined) val = '';
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(','));
  });
  return lines.join('\n');
}
