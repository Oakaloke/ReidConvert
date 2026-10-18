/* ReidConvert — PUBLIC client configuration (EXAMPLE).
 *
 * HOW TO USE: copy this file to `assets/js/config.js` and fill in your Supabase
 * project URL + anon key. `config.js` is git-ignored so your values are not
 * committed. (The Supabase ANON key is designed to be public and safe to ship in
 * client code — it only works alongside Row Level Security. The SERVICE ROLE key is
 * secret and lives only in the serverless functions' .env — never here.)
 *
 * Feature flags let you ship everything dark and switch it on when ready:
 *   AUTH_ENABLED        false → no login UI anywhere; the site behaves exactly as
 *                       it does today. Flip to true once Supabase is configured.
 *   MEMBERSHIP_ENFORCED false → every logged-in user is treated as Free, so nothing
 *                       is locked on launch day. Flip to true after Stripe is live.
 *   USAGE_ENFORCED      false → the free monthly conversion count is tracked but never
 *                       blocks. Flip true to turn on the 10/mo limit + upgrade prompt.
 */
window.RC_CONFIG = {
  SUPABASE_URL: '',            // e.g. https://xxxxxxxx.supabase.co
  SUPABASE_ANON_KEY: '',       // public anon key (safe to expose)
  AUTH_ENABLED: false,
  MEMBERSHIP_ENFORCED: false,
  GOOGLE_SIGN_IN: true,        // show "Continue with Google" (requires Google provider enabled in Supabase)
  FREE_MONTHLY_CONVERSIONS: 10,// free accounts: conversions per calendar month (members unlimited)
  USAGE_ENFORCED: false,       // enforce the free count (block + upgrade prompt) — keep false until Stripe is live
  FUNCTIONS_URL: '',           // base URL of deployed serverless fns, e.g. https://xxxx.supabase.co/functions/v1 (empty → Upgrade buttons stay "coming soon")
  MEMBER_PRICE_LABEL: '$5/month'
};
