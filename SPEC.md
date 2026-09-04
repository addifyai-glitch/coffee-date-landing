# Coffee-Date Landing — Implementation Spec (v1, 2026-09-03)

Read this whole file before writing code. Produce an implementation plan first, then execute it in ONE branch, verify end-to-end, and report using the format in §12.

## 0. Non-negotiables

- Git author for every commit: `Addify <hello@addify.ae>`. Never a personal name.
- HARD BOUNDARY: fully isolated from Addify. Do not open, read, modify, or reference `~/Documents/Addify-gulffit`, the `Addify1` repo, Addify's Supabase project, its Vercel/Coolify config, or any addify.ae env files. `vercel link` only inside this repo; confirm the linked project is NOT `addify1` or `ict-portfolio`.
- Secrets (Supabase service role key, Resend key, TOKEN_SECRET, admin password) exist only as Vercel env vars, read inside `/api` functions. Never in client JS, never committed.
- Do not change stack. Stay static HTML/CSS/JS + Vercel serverless functions. No framework migration.

## 1. Stack

- Frontend: existing static HTML/CSS/JS in repo root (keep structure, redesign per §9).
- Backend: Vercel Serverless Functions, Node 20, in `/api/**` (zero-config). Add `package.json` with: `@supabase/supabase-js`, `resend`, `ics`, `nanoid`. Add `vercel.json` only if needed for rewrites/headers.
- Database: NEW isolated Supabase project (owner creates it; EU/Frankfurt). Schema in `supabase/schema.sql`, run manually in the SQL editor. Client-side `supabaseInsert`/`supabaseUpdate` helpers in `common.js` are deleted; the browser only calls `/api/*`.
- Email: Resend, server-side only. EmailJS removed entirely (code, keys, README mentions).

## 2. Database schema (`supabase/schema.sql`)

```sql
create extension if not exists pgcrypto;

create table waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,            -- stored lowercased + trimmed
  name text,
  city text,
  source text,                           -- 'landing' | 'invite' | 'referral'
  utm_source text, utm_medium text, utm_campaign text,
  referral_code text not null unique,    -- nanoid(8), url-safe
  referred_by text,                      -- referral_code of referrer
  referral_count int not null default 0, -- confirmed referrals only
  position int not null,                 -- assigned at insert: max(position)+1
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  ip_hash text,
  user_agent text
);

create table invites (
  id uuid primary key default gen_random_uuid(),
  sender_name text not null,
  sender_email text not null,
  recipient_name text,
  recipient_email text not null,
  place text not null,
  starts_at timestamptz not null,
  timezone text not null default 'Europe/Vienna',
  message text,
  status text not null default 'pending', -- pending | accepted | declined | proposed | expired
  proposed_starts_at timestamptz,         -- set when recipient proposes a new time
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  ip_hash text
);

create table rate_limits (
  key text primary key,                   -- '<endpoint>:<ip_hash>'
  count int not null default 0,
  window_start timestamptz not null default now()
);

alter table waitlist enable row level security;
alter table invites enable row level security;
alter table rate_limits enable row level security;
-- No policies on purpose: anon/authenticated get nothing. Service role bypasses RLS.
```

## 3. API endpoints

All JSON. All check `Content-Type`, validate input, return `{ ok, ... }` or `{ ok:false, error }` with proper status codes. Never leak stack traces.

| Method | Path | Purpose |
|---|---|---|
| POST | `/api/waitlist` | create pending signup, send confirmation email |
| GET | `/api/waitlist/confirm?token=` | verify token → set `confirmed_at`, bump referrer, redirect to `/welcome.html?pos=N&ref=CODE` |
| POST | `/api/invite` | create invite, email recipient (invite link) + sender (copy) |
| GET | `/api/invite?token=` | public-safe invite details for the respond page (no emails exposed) |
| POST | `/api/invite/respond` | body `{ token, action: 'accept'|'decline'|'propose', proposed_starts_at? }` |
| GET | `/api/admin/waitlist` | basic auth; JSON list + counts by source/city; `?format=csv` returns CSV |

Shared helpers in `api/_lib/`: `supabase.js` (service client), `token.js`, `ratelimit.js`, `email.js`, `validate.js`, `ics.js`. Files under `api/_lib` are not routes.

## 4. Security

- **Rate limit**: per endpoint, per `ip_hash`, **5 requests per 10-minute window**. Implemented with the `rate_limits` table (upsert; reset when `window_start` older than 10 min). Exceeded → HTTP 429 `{ error: "Too many requests, try again in a few minutes" }`.
- **ip_hash** = sha256(client IP + `IP_SALT` env). Client IP from `x-forwarded-for` first value.
- **Honeypot**: hidden field `website` on both forms; if non-empty → return 200 `{ ok:true }` but do nothing.
- **Email validation**: trim, lowercase, RFC-ish regex, max 254 chars. Reject disposable-looking obvious junk only by format; no third-party lookup.
- **Dedupe**: re-submitting an existing waitlist email → 200 with the existing position and `already_registered: true`; if unconfirmed, resend the confirmation email (subject to rate limit).
- **CORS**: same-origin only; no `Access-Control-Allow-Origin: *`.
- **Headers** (via `vercel.json`): `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.

## 5. Signed tokens (`api/_lib/token.js`)

- Format: `base64url(payload) + "." + base64url(hmac)` where payload = `type:id:exp` (`exp` = unix seconds) and hmac = HMAC-SHA256(payload, `TOKEN_SECRET`).
- Verify with `crypto.timingSafeEqual`; reject on bad format, bad signature, or `exp < now`.
- Types and expiry:
  - `wl` (waitlist confirm): **7 days**. Idempotent — re-clicking after confirm just redirects to welcome.
  - `inv` (invite respond link, recipient): **14 days**, or until `responded_at` is set. After response → 410 page "This invite has already been answered."
  - `snd` (sender accept-proposed-time link): **14 days**, single use.
- `TOKEN_SECRET`: 32+ random bytes, env only. If missing at runtime → function returns 500 and logs, never falls back to a default.

## 6. Email (Resend, `api/_lib/email.js`)

- From: `Pookie <hello@mail.addify.ae>` via env `FROM_EMAIL`. Reply-to: `hello@addify.ae` via env `REPLY_TO`.
- Plain HTML templates with the §9 palette, one CTA button each, text fallback. No tracking pixels.
- Every send logs `{ template, to (masked), resend_id }` to console so the Vercel logs show it.

Templates:
1. `waitlist_confirm` → to signup. Subject: "Confirm your spot on the Pookie list". CTA = confirm link.
2. `waitlist_welcome` → after confirm. Subject: "You're #{position} — here's your referral link". Contains referral URL `https://pookie.addify.ae/?ref={code}` and "each friend who joins moves you up 5 spots".
3. `invite_recipient` → to recipient. Subject: "{sender_name} invited you for a coffee ☕". Shows place, date/time in invite timezone, message, buttons: Accept / Suggest another time / Decline (all → respond page with token).
4. `invite_sender_copy` → to sender on create. Subject: "Your coffee invite to {recipient_name} is sent".
5. `invite_confirmed` → to BOTH on accept. Subject: "Coffee confirmed: {place}, {date} {time}". **Attach .ics** (§7). Both parties' names in body.
6. `invite_declined` → to sender. Subject: "{recipient_name} can't make it".
7. `invite_proposed` → to sender. Subject: "{recipient_name} suggested a new time". CTA: accept the proposed time (uses `snd` token → sets `starts_at = proposed_starts_at`, status accepted, then sends template 5 to both) or reply by email.

## 7. .ics (`api/_lib/ics.js`, `ics` package)

- `uid`: `invite-{id}@pookie.addify.ae`, `method: REQUEST`, `productId: Pookie`.
- `start` = `starts_at` in the invite's `timezone`; **duration 60 minutes**.
- `title`: "Coffee with {other party's first name}", `location`: place, `description`: message + "Arranged via Pookie".
- `organizer`: sender name/email; `attendees`: both, `rsvp: true`.
- Attached as `coffee-date.ics`, `text/calendar`, base64. Same file to both parties.

## 8. Flows

**Waitlist**: form (name, email, city, consent checkbox required, honeypot, hidden utm_* + ref from URL) → POST → insert with `position = max(position)+1`, `referred_by = ref` if valid → send template 1 → UI: "Check your inbox to confirm." → user clicks → confirm endpoint sets `confirmed_at`; if `referred_by` set and this is a first confirmation, increment referrer's `referral_count` → send template 2 → redirect to `welcome.html` showing effective rank = `position - 5 * referral_count` (min 1), referral link, copy button, share buttons (WhatsApp, X, copy).

**Invite**: form (your name, your email, their name, their email, place text, date+time via native inputs, timezone auto-detected via `Intl` with select fallback, message) → POST → insert → templates 3 + 4 → UI success. Recipient opens `respond.html?token=` → page fetches GET `/api/invite?token=` → shows details → Accept → template 5 to both + status accepted / Decline → template 6 / Propose → date+time picker → status proposed + template 7. Sender clicking accept in template 7 → accepted + template 5.

**GDPR**: consent checkbox text: "I agree to the privacy policy and to receive emails about Pookie." Links to `/datenschutz.html` and `/impressum.html` (create both with clearly marked placeholder text; footer links on every page).

## 9. Design overhaul (static, no framework)

Goal: premium, immersive, editorial. Avoid: Inter/Roboto, purple/blue gradients, glassmorphism, emoji bullets, generic 3-col feature grids, stock "people at laptops".

- Direction: "a café at golden hour". Palette: espresso `#2B1D16`, cream `#F4EBDD`, terracotta `#C8552D`, sage `#8A9A7B` for success. Subtle SVG grain overlay at ~4% opacity.
- Type: **Fraunces** (display) + **Manrope** (body) from Google Fonts with `font-display: swap` and system fallbacks. Hero 64–96px desktop / 40–48px mobile, tight tracking.
- Sections, max five: Hero (with interactive invite card) → invite demo/form → How it works (3 steps, horizontal on desktop) → Waitlist → Footer.
- Motion via **Motion One** (CDN, ~4KB) or CSS only: scroll-reveal (fade + 16px y), hero invite card tilts on pointer and flips to "Accepted" state on hover/tap, magnetic primary CTA, count-up on the waitlist number. `prefers-reduced-motion` disables all of it. No heavy `backdrop-filter`.
- Mobile-first, touch targets ≥ 44px, real copy (no lorem ipsum), one clear CTA per screen.
- Self-review: Playwright screenshots at 390px and 1440px of every section; check against the avoid-list; fix; re-shoot. Final screenshots go in the report.

## 10. Quality gates

- Lighthouse mobile (`npx lighthouse <url> --preset=mobile` or PageSpeed) ≥ 90 on Performance, Accessibility, SEO.
- OG image (branded, 1200×630, generated), title/description per page, favicon, `robots.txt`, `sitemap.xml`.
- Analytics: Plausible script tag gated on env/domain, custom events `waitlist_submit`, `waitlist_confirm`, `invite_create`, `invite_accept`.
- Zero console errors on all pages. All forms work with JS errors handled (show a human message, never a silent failure).
- README: env var table, Supabase setup (run schema.sql), Resend domain DNS records, deploy steps, how to export the waitlist.

## 11. Proof-by-query (definition)

Each "prove it" step means: perform the real action against the real Supabase project, then run the query with the service key (e.g. via a throwaway `node -e` script or the Supabase SQL editor) and paste the actual output in the report. Then delete the test rows and paste the count showing they are gone.

Required proofs:
1. Waitlist: 3 signups (incl. 1 with `?ref=` of another) → confirm all → `select email, position, referral_count, confirmed_at from waitlist order by position` → shows 3 confirmed rows and referrer's `referral_count = 1`. Then resubmit one email → response shows `already_registered: true`. Then 6 rapid requests from one IP → 6th returns 429.
2. Invite: full flow between `hello@addify.ae` and `$TEST_EMAIL_2` (env) — create → accept → both receive template 5 with `.ics`. Paste all Resend message IDs and `select status, responded_at from invites where id = ...`. Repeat once with "propose" → sender accepts → confirmed.
3. Token: tampered token → 401; expired token (craft with past `exp`) → 410/401 page.
4. Repeat proof 1 (one signup) and proof 2 (one invite) on the **live** `pookie.addify.ae` URL after deploy.

## 12. Ship (CLI only, no GitHub↔Vercel integration)

1. Commit, push to `github.com/addifyai-glitch/coffee-date-landing` `main`.
2. From this folder: `vercel link` → new project `coffee-date-landing`, scope `addifyai-glitch`. Confirm not addify1/ict-portfolio. **Stop** and tell the owner to add env vars (§13) + domain `pookie.addify.ae` in the Vercel dashboard.
3. On "continue": `vercel env pull`, `vercel --prod`, confirm `https://pookie.addify.ae` resolves with SSL, run proof 4.
4. Report format: (a) what changed, (b) screenshots, (c) Lighthouse scores, (d) all proofs with pasted output, (e) **only** the items that still need the owner personally.

## 13. Env vars (Vercel, Production + Preview)

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
RESEND_API_KEY
FROM_EMAIL=Pookie <hello@mail.addify.ae>
REPLY_TO=hello@addify.ae
SITE_URL=https://pookie.addify.ae
TOKEN_SECRET            # 32+ random bytes, base64
IP_SALT                 # random string
ADMIN_USER
ADMIN_PASS
TEST_EMAIL_2            # second inbox for proofs
PLAUSIBLE_DOMAIN=pookie.addify.ae
```
