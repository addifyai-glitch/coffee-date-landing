/* ==========================================================================
   Input validation — email normalization, honeypot check, string cleanup.
   No third-party lookups; format checks only.
   ========================================================================== */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(raw) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed || trimmed.length > 254 || !EMAIL_RE.test(trimmed)) return null;
  return trimmed;
}

export function isHoneypotTripped(body) {
  return Boolean(body && typeof body.website === 'string' && body.website.trim().length > 0);
}

export function cleanString(raw, { maxLength = 500 } = {}) {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}
