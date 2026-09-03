/* ==========================================================================
   Small HTTP helpers shared by every /api route.
   No CORS headers are set anywhere — that omission (not an allow-list) is
   what keeps responses same-origin-only: a cross-origin page can still fire
   the request, but without Access-Control-Allow-Origin its JS can never read
   the response.
   ========================================================================== */

export function requireJsonContentType(req) {
  const ct = req.headers['content-type'] || '';
  return ct.includes('application/json');
}

export async function getJsonBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    return req.body ? JSON.parse(req.body) : {};
  }
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch (err) { reject(err); }
    });
    req.on('error', reject);
  });
}
