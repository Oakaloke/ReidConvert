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
  GOOGLE_SIGN_IN: true,

  // Freemium: free accounts get this many conversions per calendar month.
  // Change this ONE number to adjust the free allowance. Members are unlimited.
  FREE_MONTHLY_CONVERSIONS: 10,
  // Enforce the free conversion count? Keep false until Stripe is live so free
  // users are never blocked before they can upgrade. Flip true (with Stripe, or
  // to test the wall) to turn on the hard limit + upgrade prompt.
  // MEMBERSHIP_ENFORCED = true also enables enforcement.
  USAGE_ENFORCED: false,

  // Billing (Stripe). Base URL of your deployed serverless functions — e.g.
  // 'https://xxxx.supabase.co/functions/v1' (Supabase Edge) or your Netlify/
  // Vercel functions base. Leave '' and the Upgrade buttons stay "coming soon".
  // The $5/month price itself is created in Stripe (STRIPE_PRICE_ID on the host).
  FUNCTIONS_URL: '',
  MEMBER_PRICE_LABEL: '$5/month'
};
