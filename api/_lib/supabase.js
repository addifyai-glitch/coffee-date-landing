/* ==========================================================================
   Service-role Supabase client. Server-side only — never import this from
   anything that ships to the browser. Bypasses RLS entirely, which is why
   supabase/schema.sql has no policies: this is the only door in.
   ========================================================================== */

import { createClient } from '@supabase/supabase-js';

let client = null;

export function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from environment');
    const err = new Error('Server is not configured');
    err.status = 500;
    throw err;
  }

  if (!client) {
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}
