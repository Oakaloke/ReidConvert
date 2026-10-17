/* ReidConvert — PUBLIC client configuration.
 *
 * Only PUBLIC values belong here (this file is served to every visitor). The
 * Supabase anon key is designed to be public and only works alongside Row Level
 * Security. SECRET keys (Supabase service role, Stripe) must NEVER go in this file
 * — they live only in serverless/.env. See docs/STRIPE_SETUP.md and docs/SUPABASE_SETUP.md.
 *
 * Fill SUPABASE_URL + SUPABASE_ANON_KEY and flip AUTH_ENABLED to true to turn on
 * accounts. Leave MEMBERSHIP_ENFORCED false until Stripe is live so nothing locks.
 */
window.RC_CONFIG = {
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
  AUTH_ENABLED: false,
  MEMBERSHIP_ENFORCED: false,
  GOOGLE_SIGN_IN: true
};
