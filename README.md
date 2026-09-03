# Pookie

Meet for coffee. Actually meet.

A static HTML/CSS/JS frontend plus Vercel Serverless Functions in `/api`. Two coexisting experiences:

**The Pookie product** (`/`) — a café-themed landing page with two flows:
1. **Coffee invite** — send someone a real invite (place, date, time). They get one email to accept, suggest another time, or decline — no account needed. Confirmed invites get a `.ics` calendar attachment, sent to both parties.
2. **Waitlist** — email + double opt-in confirmation, with a referral system (each confirmed referral moves you up 5 spots).

**"Let's See If We Vibe"** (`/vibe.html`) — the original personal-invitation easter egg (pink/purple, dodge-button, the works), preserved from before the SPEC.md rebuild and kept running alongside the new product. It uses its own stylesheet (`vibe.css`) so the two designs never bleed into each other, but posts through the same server-side backend as everything else (`/api/vibe`) instead of the original's client-side Supabase/EmailJS calls.

No framework, no build step for the frontend. The backend is Node 20 functions under `/api/**`, deployed by Vercel's zero-config detection. The browser never talks to the database or the email provider directly — every write goes through `/api/*`, authenticated with a service-role key that only server code ever sees.

## Project structure

```
├── index.html                 Homepage: hero, invite form, how-it-works, waitlist
├── welcome.html                Post-confirmation page (rank, referral link, share)
├── respond.html                 Invite recipient/sender response page
├── about.html / contact.html / faq.html
├── datenschutz.html / impressum.html   Placeholder legal pages — see below
├── vibe.html / vibe.css / vibe.js   "Let's See If We Vibe" — the restored original page
├── style.css                    Shared design system (café palette, Fraunces + Manrope)
├── common.js                    Shared foundation: theme, nav/footer, cursor, FX, /api fetch helper
├── app.js                       Homepage-specific interactions (forms, invite-preview card)
├── robots.txt / sitemap.xml / manifest.json / icon.svg / og-image.png
├── package.json                 @supabase/supabase-js, resend, ics, nanoid
├── vercel.json                  Security headers
├── supabase/
│   └── schema.sql               Run once, manually, in the Supabase SQL editor
└── api/
    ├── _lib/
    │   ├── supabase.js          Service-role client (throws if env vars missing)
    │   ├── token.js              Signed HMAC tokens for email links (wl / inv / snd)
    │   ├── ratelimit.js          5 requests / 10 min per endpoint + hashed IP
    │   ├── validate.js           Email normalization, honeypot check
    │   ├── ics.js                 .ics generation for confirmed invites
    │   └── email.js               Resend wrapper + all email templates
    ├── waitlist.js               POST — create signup, send confirm email
    ├── waitlist/confirm.js       GET  — verify token, confirm, redirect to welcome.html
    ├── invite.js                  POST create / GET fetch-by-token
    ├── invite/respond.js          POST accept / decline / propose
    ├── vibe.js                    POST — store + email a "Let's Vibe" response
    └── admin/waitlist.js          GET — Basic Auth, JSON or ?format=csv
```

## Env vars (Vercel → Project → Settings → Environment Variables)

Set these for **Production** and **Preview**.

| Variable | Value |
|---|---|
| `SUPABASE_URL` | From the new Supabase project → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Same page — **service_role** key, never the anon key |
| `RESEND_API_KEY` | From resend.com → API Keys |
| `FROM_EMAIL` | `Pookie <hello@mail.addify.ae>` |
| `REPLY_TO` | `irfan@addify.ae` |
| `SITE_URL` | `https://pookie.addify.ae` |
| `TOKEN_SECRET` | 32+ random bytes, base64 — e.g. `openssl rand -base64 32` |
| `IP_SALT` | Any random string — e.g. `openssl rand -hex 16` |
| `ADMIN_USER` | Your choice — used for Basic Auth on `/api/admin/waitlist` |
| `ADMIN_PASS` | Your choice — a strong password |
| `TEST_EMAIL_2` | A second inbox you control, used only for the proof-by-query steps |
| `PLAUSIBLE_DOMAIN` | `pookie.addify.ae` (documentation only — the frontend hardcodes this domain and self-gates on `location.hostname`, since there's no build step to inject env vars into static HTML) |

None of these are ever referenced in client-side code — only inside `/api/**`.

## Setting up Supabase

1. Create a **new, isolated** Supabase project (not shared with any other project) — EU/Frankfurt region.
2. Project → SQL Editor → New query → paste the full contents of `supabase/schema.sql` → run it. This creates `waitlist`, `invites`, `rate_limits`, and `vibe_responses` (for `/vibe.html`), all with row-level security enabled and **no policies** — anon and authenticated both get zero access. The only way in is the service-role key, used exclusively inside `/api/**`.
3. Settings → API → copy the **Project URL** and the **service_role** key (not anon) into `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`.

## Setting up Resend

1. Create a Resend account, add the sending domain used in `FROM_EMAIL` (e.g. `mail.addify.ae`).
2. Resend will give you DNS records to add at your domain registrar (exact values are generated per-domain in the Resend dashboard — typically an **MX** record, a **TXT** record for SPF, and a **CNAME**/**TXT** pair for DKIM). Add all of them, then click "Verify" in Resend — this can take a few minutes to propagate.
3. Copy the API key into `RESEND_API_KEY`.
4. Either add the Vercel↔Resend integration from the Vercel dashboard (Integrations → Resend) which can set `RESEND_API_KEY` for you, or paste the key in manually — both work.

## Deploy

```bash
npm install
npx vercel link      # new project, scope addifyai-glitch — confirm it's not addify1/ict-portfolio
# … add the env vars above + the Resend integration + the pookie.addify.ae domain
#    in the Vercel dashboard …
npx vercel env pull  # to test the API locally with `vercel dev`, optional
npx vercel --prod
```

Then point `pookie.addify.ae` at Vercel (Vercel dashboard → Domains → add `pookie.addify.ae`, then add the DNS record it gives you at your registrar) and confirm it resolves with valid SSL — Vercel provisions the certificate automatically once DNS is correct.

## Exporting the waitlist

```
curl -u "$ADMIN_USER:$ADMIN_PASS" "https://pookie.addify.ae/api/admin/waitlist?format=csv" -o waitlist.csv
```

Drop `?format=csv` for a JSON response instead — `{ count, counts_by_source, counts_by_city, rows }`.

## Legal pages

`datenschutz.html` and `impressum.html` are **placeholder text only**, clearly marked as such in the page itself. They are not a substitute for real legal review under the GDPR/DSGVO, the Austrian DSG, or the ECG — replace the content (including the placeholder address in `impressum.html`) before treating this as a live product.

## Rate limiting & abuse prevention

- 5 requests per 10-minute window, per endpoint + hashed visitor IP (`rate_limits` table).
- A hidden honeypot field (`website`) on both forms — a filled-in value returns a fake success and does nothing.
- Signed, expiring tokens for every email link (7 days for waitlist confirmation, 14 days for invite responses) — tampered or expired tokens are rejected server-side.

## Running locally

The frontend is static and can be served with any file server:

```bash
npx serve .
```

To exercise `/api/*` locally, use the Vercel CLI (requires `vercel link` + env vars pulled first):

```bash
npx vercel dev
```
