/* ==========================================================================
   Site configuration
   Fill these in after setting up Supabase and EmailJS (see README.md).
   The page works fully without them — each integration is skipped quietly
   if its values are left blank, so you can ship the front end first.
   ========================================================================== */

const CONFIG = {
  // --- Supabase (Settings → API in your Supabase project) ---
  SUPABASE_URL: '', // e.g. https://xxxxxxxxxxxx.supabase.co
  SUPABASE_ANON_KEY: '',

  // --- EmailJS (emailjs.com → Account → General / Email Services / Email Templates) ---
  EMAILJS_PUBLIC_KEY: '',
  EMAILJS_SERVICE_ID: '',

  // Used by the "Let's Vibe" invitation flow (root index.html)
  EMAILJS_OWNER_TEMPLATE_ID: '',   // notifies you when someone confirms a date
  EMAILJS_VISITOR_TEMPLATE_ID: '', // sends the visitor a "see you soon" email

  // Used by the Pookie waitlist flow (pookie/index.html)
  EMAILJS_WAITLIST_OWNER_TEMPLATE_ID: '',   // notifies you of a new signup
  EMAILJS_WAITLIST_VISITOR_TEMPLATE_ID: '', // confirms the signup to the visitor

  OWNER_EMAIL: 'addify.ai@gmail.com',

  // --- WhatsApp redirect (digits only: country code + number, no + or spaces) ---
  WHATSAPP_NUMBER: '436601128362',

  // --- Cloudflare Turnstile (dash.cloudflare.com → Turnstile) ---
  // Leave blank to skip spam protection entirely; the waitlist form still works.
  TURNSTILE_SITE_KEY: '',
};
