/* ==========================================================================
   Rate limiting — 5 requests per 10-minute window, per endpoint + hashed IP,
   backed by the `rate_limits` table (see supabase/schema.sql).
   ========================================================================== */

import crypto from 'node:crypto';
import { getSupabase } from './supabase.js';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 5;

export function getClientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (xff) return String(xff).split(',')[0].trim();
  return req.socket?.remoteAddress || '0.0.0.0';
}

export function hashIp(ip) {
  const salt = process.env.IP_SALT || '';
  return crypto.createHash('sha256').update(`${ip}${salt}`).digest('hex');
}

export async function checkRateLimit(endpoint, ipHash) {
  // Rate limiting is an abuse-prevention safety net, not core functionality
  // — a hiccup in this table (a transient Supabase blip, a timeout, a
  // corrupted row) must never take down invite/waitlist/vibe submissions
  // with it. Every failure below fails OPEN (allow the request, log it)
  // instead of throwing and 500ing the whole handler before real feature
  // logic even runs. This was almost certainly the cause of at least one
  // "Something went wrong" report where the actual submission itself was
  // never even attempted.
  try {
    const supabase = getSupabase();
    const key = `${endpoint}:${ipHash}`;
    const now = Date.now();

    const { data: existing, error: selectError } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('key', key)
      .maybeSingle();
    if (selectError) throw selectError;

    if (!existing || now - new Date(existing.window_start).getTime() > WINDOW_MS) {
      const { error } = await supabase
        .from('rate_limits')
        .upsert({ key, count: 1, window_start: new Date(now).toISOString() });
      if (error) throw error;
      return { allowed: true, count: 1 };
    }

    if (existing.count >= MAX_REQUESTS) {
      return { allowed: false, count: existing.count };
    }

    const nextCount = existing.count + 1;
    const { error } = await supabase.from('rate_limits').update({ count: nextCount }).eq('key', key);
    if (error) throw error;
    return { allowed: true, count: nextCount };
  } catch (err) {
    console.error(JSON.stringify({ rate_limit_check_failed: endpoint, error: err.message || String(err) }));
    return { allowed: true, count: 0, degraded: true };
  }
}
