/* ReidConvert — Stripe webhook (STUB, not activated).
 *
 * Receives Stripe events and writes the subscription state back to the Supabase `profiles`
 * row using the SERVICE ROLE key (server-only; bypasses Row Level Security). Does nothing
 * until deployed to a serverless host with env vars set. See docs/STRIPE_SETUP.md.
 *
 * Handles:
 *   checkout.session.completed          -> mark subscription active, store customer id
 *   customer.subscription.updated       -> sync status + current_period_end
 *   customer.subscription.deleted       -> mark free
 *
 * IMPORTANT: this endpoint needs the RAW request body to verify the Stripe signature.
 * Configure your host to pass the raw body (e.g. Vercel: export const config = { api: { bodyParser: false } }).
 */
module.exports = async function handler(req, res) {
  const json = (status, body) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(body)); };

  const { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!STRIPE_SECRET_KEY || !STRIPE_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return json(503, { error: 'not_configured', message: 'Stripe/Supabase env vars missing. See docs/STRIPE_SETUP.md.' });
  }

  try {
    const Stripe = require('stripe');
    const stripe = Stripe(STRIPE_SECRET_KEY);
    const sig = req.headers['stripe-signature'];
    const raw = req.rawBody || req.body; // ensure your host supplies the RAW body
    const event = stripe.webhooks.constructEvent(raw, sig, STRIPE_WEBHOOK_SECRET);

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    async function setStatus(fields, matchBy) {
      await supabase.from('profiles').update(fields).match(matchBy);
    }

    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        const userId = (s.metadata && s.metadata.userId) || s.client_reference_id;
        if (userId) await setStatus({ subscription_status: 'active', stripe_customer_id: s.customer }, { id: userId });
        break;
      }
      case 'customer.subscription.updated': {
        const sub = event.data.object;
        const status = sub.status === 'active' || sub.status === 'trialing' ? 'active' : sub.status;
        await setStatus({ subscription_status: status, current_period_end: new Date(sub.current_period_end * 1000).toISOString() }, { stripe_customer_id: sub.customer });
        break;
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await setStatus({ subscription_status: 'free', current_period_end: null }, { stripe_customer_id: sub.customer });
        break;
      }
      default:
        break; // ignore other events
    }
    return json(200, { received: true });
  } catch (err) {
    return json(400, { error: 'webhook_error', message: err.message });
  }
};
