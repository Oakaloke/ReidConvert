/* ReidConvert — Stripe: create a Checkout Session (STUB, not activated).
 *
 * GitHub Pages cannot run server code, so this file does nothing until you deploy it to a
 * serverless host (Supabase Edge Functions, Netlify/Vercel Functions, Cloudflare Workers).
 * It reads keys from environment variables only and returns a clear "not configured"
 * response when they are missing. See docs/STRIPE_SETUP.md.
 *
 * Request (POST, JSON): { email, userId }
 * Response: { url } to redirect the browser to Stripe Checkout.
 *
 * This is written as a generic (req, res) handler; adapt the first/last lines to your host:
 *   - Vercel/Netlify:   module.exports = async (req, res) => { ... }
 *   - Supabase Edge:    Deno.serve(async (req) => { ... return new Response(...) })
 */
module.exports = async function handler(req, res) {
  const json = (status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };

  const { STRIPE_SECRET_KEY, STRIPE_PRICE_ID, STRIPE_SUCCESS_URL, STRIPE_CANCEL_URL } = process.env;
  if (!STRIPE_SECRET_KEY || !STRIPE_PRICE_ID) {
    return json(503, { error: 'stripe_not_configured', message: 'Stripe is not configured yet. Set STRIPE_SECRET_KEY and STRIPE_PRICE_ID. See docs/STRIPE_SETUP.md.' });
  }
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  try {
    const Stripe = require('stripe');
    const stripe = Stripe(STRIPE_SECRET_KEY);
    let body = req.body;
    if (!body || typeof body === 'string') { try { body = JSON.parse(body || '{}'); } catch (e) { body = {}; } }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: STRIPE_PRICE_ID, quantity: 1 }],
      customer_email: body.email || undefined,
      client_reference_id: body.userId || undefined,
      metadata: { userId: body.userId || '' },
      allow_promotion_codes: true,
      success_url: STRIPE_SUCCESS_URL || 'https://reidconvert.com/account/?checkout=success',
      cancel_url: STRIPE_CANCEL_URL || 'https://reidconvert.com/pricing/?checkout=cancel'
    });
    return json(200, { url: session.url });
  } catch (err) {
    return json(500, { error: 'stripe_error', message: err.message });
  }
};
