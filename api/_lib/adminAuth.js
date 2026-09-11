/* ==========================================================================
   HTTP Basic Auth for /api/admin/* — shared by waitlist.js and invites.js
   so there's one place that checks ADMIN_USER/ADMIN_PASS.
   ========================================================================== */

import crypto from 'node:crypto';

export function isAdminAuthorized(req) {
  const adminUser = process.env.ADMIN_USER;
  const adminPass = process.env.ADMIN_PASS;
  if (!adminUser || !adminPass) return { ok: false, configured: false };

  const auth = req.headers.authorization || '';
  const [scheme, encoded] = auth.split(' ');
  if (scheme !== 'Basic' || !encoded) return { ok: false, configured: true };

  let decoded;
  try {
    decoded = Buffer.from(encoded, 'base64').toString('utf8');
  } catch {
    return { ok: false, configured: true };
  }
  const sepIndex = decoded.indexOf(':');
  if (sepIndex === -1) return { ok: false, configured: true };
  const user = decoded.slice(0, sepIndex);
  const pass = decoded.slice(sepIndex + 1);

  const ok = timingSafeEqualStr(user, adminUser) && timingSafeEqualStr(pass, adminPass);
  return { ok, configured: true };
}

// Sends the 401/500 response for a failed check; returns true if it did
// (caller should stop), false if the request is authorized (caller proceeds).
export function rejectIfUnauthorized(req, res) {
  const { ok, configured } = isAdminAuthorized(req);
  if (!configured) {
    console.error('ADMIN_USER / ADMIN_PASS missing from environment');
    res.status(500).json({ ok: false, error: 'Admin is not configured' });
    return true;
  }
  if (!ok) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Pookie Admin"');
    res.status(401).json({ ok: false, error: 'Unauthorized' });
    return true;
  }
  return false;
}

function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}
