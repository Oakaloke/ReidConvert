/* ReidConvert — Stripe: create a Billing Portal Session (STUB, not activated).
 *
 * Lets a Member manage or cancel their subscription. Does nothing until deployed to a
 * serverless host with env vars set. See docs/STRIPE_SETUP.md.
 *
 * Request (POST, JSON): { customerId }   (the stripe_customer_id from the profiles row)
 * Response: { url } to redirect to the Stripe customer portal.
 */
module.exports = async function handler(req, res) {
  const json = (status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };

  const { STRIPE_SECRET_KEY } = process.env;
  if (!STRIPE_SECRET_KEY) {
    return json(503, { error: 'stripe_not_configured', message: 'Stripe is not configured yet. Set STRIPE_SECRET_KEY. See docs/STRIPE_SETUP.md.' });
  }
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  try {
    const Stripe = require('stripe');
    const stripe = Stripe(STRIPE_SECRET_KEY);
    let body = req.body;
    if (!body || typeof body === 'string') { try { body = JSON.parse(body || '{}'); } catch (e) { body = {}; } }
    if (!body.customerId) return json(400, { error: 'missing_customer', message: 'customerId is required.' });

    const session = await stripe.billingPortal.sessions.create({
      customer: body.customerId,
      return_url: 'https://reidconvert.com/account/'
    });
    return json(200, { url: session.url });
  } catch (err) {
    return json(500, { error: 'stripe_error', message: err.message });
  }
};
