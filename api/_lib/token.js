/* ==========================================================================
   Signed, stateless tokens for email links: base64url(payload) + "." +
   base64url(hmac), payload = "type:id:exp" (exp = unix seconds), hmac =
   HMAC-SHA256(payload, TOKEN_SECRET). Verified with a constant-time compare.

   Types:
   - wl  (waitlist confirm)          — 7 days,  idempotent
   - inv (invite respond, recipient) — 14 days, single response
   - snd (sender accepts a proposed time) — 14 days, single use
   ========================================================================== */

import crypto from 'node:crypto';

const DAY = 24 * 60 * 60;
const EXPIRY_SECONDS = { wl: 7 * DAY, inv: 14 * DAY, snd: 14 * DAY };

const b64url = (input) => Buffer.from(input).toString('base64url');
const fromB64url = (str) => Buffer.from(str, 'base64url');

function getSecret() {
  const secret = process.env.TOKEN_SECRET;
  if (!secret || secret.length < 16) {
    console.error('TOKEN_SECRET missing or too short');
    const err = new Error('Server is not configured');
    err.status = 500;
    throw err;
  }
  return secret;
}

export function signToken(type, id, { expSeconds } = {}) {
  const secret = getSecret();
  const exp = Math.floor(Date.now() / 1000) + (expSeconds ?? EXPIRY_SECONDS[type] ?? 3600);
  const payloadB64 = b64url(`${type}:${id}:${exp}`);
  const hmac = crypto.createHmac('sha256', secret).update(payloadB64).digest();
  return `${payloadB64}.${b64url(hmac)}`;
}

/**
 * @returns {{ ok: true, type: string, id: string, exp: number } | { ok: false, reason: string }}
 */
export function verifyToken(token, expectedType) {
  try {
    const secret = getSecret();
    if (!token || typeof token !== 'string') return { ok: false, reason: 'malformed' };

    const parts = token.split('.');
    if (parts.length !== 2) return { ok: false, reason: 'malformed' };
    const [payloadB64, hmacB64] = parts;

    const expectedHmac = crypto.createHmac('sha256', secret).update(payloadB64).digest();
    let givenHmac;
    try { givenHmac = fromB64url(hmacB64); } catch { return { ok: false, reason: 'malformed' }; }

    if (expectedHmac.length !== givenHmac.length || !crypto.timingSafeEqual(expectedHmac, givenHmac)) {
      return { ok: false, reason: 'bad_signature' };
    }

    const payload = fromB64url(payloadB64).toString('utf8');
    const segments = payload.split(':');
    if (segments.length !== 3) return { ok: false, reason: 'malformed' };
    const [type, id, expStr] = segments;
    const exp = Number(expStr);
    if (!type || !id || !Number.isFinite(exp)) return { ok: false, reason: 'malformed' };
    if (expectedType && type !== expectedType) return { ok: false, reason: 'wrong_type' };
    if (Math.floor(Date.now() / 1000) > exp) return { ok: false, reason: 'expired' };

    return { ok: true, type, id, exp };
  } catch (err) {
    console.error('Token verify error', err);
    return { ok: false, reason: 'error' };
  }
}
