# Pookie — Two Experiences, One Codebase

A static, no-build-step site with two connected experiences sharing one premium design system:

1. **Let's See If We Vibe** (`/`) — a confident, witty personal invitation page.
2. **Pookie** (`/pookie/`) — an early-access marketing site and validation MVP for a social discovery platform, complete with a waitlist, a product-validation survey, an interactive demo, and a password-protected admin dashboard.

No frameworks, no bundler — plain HTML/CSS/JS that runs by opening the files or dropping the folder on any static host.

## Project structure

```
Coffee Date landing page/
├── index.html              # Experience 1: "Let's See If We Vibe"
├── vibe.js                 # Experience 1 logic (dodge button, plan form, WhatsApp)
├── style.css                # Shared design system for the ENTIRE site
├── common.js                 # Shared foundation: theme, nav/footer, cursor, FX, Supabase/EmailJS helpers, analytics
├── config.js                 # <-- Fill in your Supabase / EmailJS / WhatsApp / Turnstile values here
├── supabase-schema.sql       # Run once in Supabase — creates every table + RLS policy
├── manifest.json / icon.svg
├── README.md
└── pookie/
    ├── index.html            # Experience 2: hero, philosophy, features, Vibe Mode, demo, waitlist flow
    ├── pookie.js             # Pookie page logic (demo stepper, waitlist multi-step form)
    ├── about.html
    ├── privacy.html
    ├── terms.html
    ├── contact.html
    ├── faq.html
    └── admin/
        ├── index.html        # Password-gated analytics dashboard
        └── admin.js
```

The site works and looks complete with **zero configuration** — `config.js` ships blank, so Supabase, EmailJS, and Turnstile calls are all skipped quietly. The WhatsApp redirect on the invitation page already points at `+43 660 1128362`.

## How the pieces fit together

- **`style.css`** is the single shared stylesheet for both experiences, including light/dark theme variables, the glass-card system, nav/footer, feature cards, the Vibe Mode grid, the phone-mockup demo, the multi-step form stepper, and the admin dashboard's charts/tables.
- **`common.js`** (loaded on every page) provides: dark/light theme toggle (persisted, respects system preference), the nav/footer markup (injected into `#site-nav` / `#site-footer` placeholders so it's written once, not copy-pasted across 8 HTML files), the glowing cursor, magnetic buttons, ambient particles, scroll-reveal, the canvas confetti/heart/sparkle system, thin Supabase REST helpers (insert/update using the public anon key), EmailJS helpers, an FAQ accordion helper, and the privacy-friendly page-view logger.
- **`vibe.js`** and **`pookie/pookie.js`** hold only what's unique to each page.
- **`pookie/admin/admin.js`** is the one place that uses the full `supabase-js` client library instead of the lightweight REST helpers, because reading data back requires an authenticated session (see below).

## Setting up Supabase

1. Create a free project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the contents of `supabase-schema.sql`, and run it. This creates four tables — `responses`, `waitlist_signups`, `demo_events`, `page_views` — each with row-level security so the public site can only **insert** data (plus a narrow update policy on `waitlist_signups` so the multi-step form can fill in later steps of the same row). Nothing can be read back by anonymous visitors.
3. Go to **Settings → API** and copy the **Project URL** and the **anon public key** into `config.js`:
   ```js
   SUPABASE_URL: 'https://xxxxxxxxxxxx.supabase.co',
   SUPABASE_ANON_KEY: 'eyJhbGciOi...',
   ```
4. **Create your one admin account** (required for the dashboard): go to **Authentication → Users → Add user**, and create yourself an email/password. Then go to **Authentication → Settings** and make sure **"Allow new user signups"** is turned **off** — the site never exposes a public sign-up form, and the dashboard's read access is granted to *any* authenticated user, so this setting is what keeps that safe. The admin login screen at `/pookie/admin/` uses this account.

## Setting up EmailJS (optional)

1. Create a free account at [emailjs.com](https://www.emailjs.com) and add an **Email Service**.
2. Create **four templates** (two per experience), using these variable names:
   - **Vibe owner / visitor templates** (`EMAILJS_OWNER_TEMPLATE_ID` / `EMAILJS_VISITOR_TEMPLATE_ID`): `{{name}}`, `{{email}}`, `{{phone}}`, `{{activity}}`, `{{date}}`, `{{time}}`, `{{city}}`, `{{message}}`.
   - **Waitlist owner / visitor templates** (`EMAILJS_WAITLIST_OWNER_TEMPLATE_ID` / `EMAILJS_WAITLIST_VISITOR_TEMPLATE_ID`): `{{name}}`, `{{email}}`, `{{country}}`, `{{would_use}}`, `{{name_opinion}}`.
   - For visitor-facing templates, set the template's "To email" field to `{{email}}`.
3. Copy your **Public Key** (Account → General) and all four template IDs into `config.js`. Any left blank simply won't send — the form still completes normally.

## WhatsApp confirmation

`config.js` has `WHATSAPP_NUMBER: '436601128362'` (digits only, country code first). On the Vibe page, confirming a plan opens `https://wa.me/436601128362?text=...` with a pre-filled message. This is specific to the personal invitation flow — the Pookie waitlist doesn't use WhatsApp.

## Spam protection (optional)

The waitlist form supports [Cloudflare Turnstile](https://dash.cloudflare.com) out of the box. Create a Turnstile site key for your domain, paste it into `config.js` as `TURNSTILE_SITE_KEY`, and the widget appears automatically on `/pookie/#waitlist` and blocks submission until solved. Leave it blank to skip spam protection entirely.

## Analytics

Page views are logged into the `page_views` table with a random ID stored in `localStorage` — no cookies, no third-party trackers. "Total page views" and "unique visitors" (by that random ID) show up on the admin dashboard. This is approximate (no cross-device dedup) but requires no extra account. If you'd rather not run your own analytics table, your hosting provider's free built-in analytics (Netlify Analytics, Vercel Analytics, Cloudflare Web Analytics) works too — `Shared.logPageView()` calls are harmless no-ops if Supabase isn't configured.

## The admin dashboard

Visit `/pookie/admin/` and sign in with the one account you created in Supabase Auth. It shows:

- Total page views, unique visitors, invitation confirmations, waitlist size
- Would-you-use-this breakdown, name-preference breakdown, most-selected activities, most-selected Vibes, countries, age distribution, most-requested features, willingness to pay
- Free-text concerns and suggestions
- Recent waitlist signups and invitation confirmations, plus a CSV export of the waitlist

This works because every table's row-level security grants **read** access to the `authenticated` role — which is safe only because there's no public sign-up form anywhere on the site (see step 4 of the Supabase setup above). Don't add one.

## Running locally

No build step required.

```bash
npx serve .
# or
python3 -m http.server 8000
```

Then visit `http://localhost:8000/` for the Vibe page or `http://localhost:8000/pookie/` for Pookie.

## Deployment

### GitHub Pages

1. Push this folder's contents to a GitHub repository's `main` branch.
2. **Settings → Pages** → Source: `Deploy from a branch`, branch `main`, folder `/ (root)`.
3. Live at `https://<username>.github.io/<repo>/`. Because the site uses relative links throughout (`pookie/`, `../`, etc.), it works whether it's served from the domain root or a GitHub Pages project subpath.

### Netlify

Drag the folder onto **app.netlify.com → Add new site → Deploy manually**, or:
```bash
npm install -g netlify-cli
netlify deploy --prod
```

### Vercel

Import the folder at [vercel.com/new](https://vercel.com/new) as a static project (no build command, output directory `.`), or:
```bash
npm install -g vercel
vercel --prod
```

### Cloudflare Pages

**Workers & Pages → Create → Pages → Upload assets**, leave the build command empty, output directory `/`.

All four options serve static files as-is, provision free HTTPS automatically, and need no environment variables — Supabase/EmailJS/Turnstile calls happen client-side using the public keys already in `config.js`.

## Security notes

- The Supabase **anon** key and EmailJS **public** key are meant to be exposed client-side — they can only do what their respective service's security rules allow (insert-only RLS policies; EmailJS's own rate limits).
- Never put a Supabase **service role** key in any client-side file.
- The admin dashboard's security comes entirely from row-level security plus keeping public sign-ups disabled in Supabase Auth — not from hiding the `/pookie/admin/` URL.
- If you'd rather not wire up a backend at all, leave `config.js` blank — both experiences still work end-to-end, minus persistence, email notifications, and the admin dashboard (which will show a config warning instead of a login form).
