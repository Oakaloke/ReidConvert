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
 */
window.RC_CONFIG = {
  SUPABASE_URL: '',            // e.g. https://xxxxxxxx.supabase.co
  SUPABASE_ANON_KEY: '',       // public anon key (safe to expose)
  AUTH_ENABLED: false,
  MEMBERSHIP_ENFORCED: false,
  GOOGLE_SIGN_IN: true         // show "Continue with Google" (requires Google provider enabled in Supabase)
};
