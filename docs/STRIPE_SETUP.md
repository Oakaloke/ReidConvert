# Stripe setup (Member subscriptions)

Everything below is **scaffolding only** — it is wired but intentionally inert until you do
these steps. GitHub Pages cannot run server code, so the three functions in `serverless/`
must be deployed to a serverless host. Do [SUPABASE_SETUP.md](SUPABASE_SETUP.md) first.

## 1. Create the product + price
1. Stripe Dashboard → Products → add a product "ReidConvert Member".
2. Add a **recurring monthly** price. Copy its **Price ID** (`price_...`).

## 2. Pick a host for the three functions
GitHub Pages serves the static site; the functions need a server. Easiest options:
- **Supabase Edge Functions** (keeps everything in Supabase) — recommended.
- **Netlify** or **Vercel** Functions (point the free static site's API routes there).
- **Cloudflare Workers**.

Deploy the three files in `serverless/` (`create-checkout-session`, `create-portal-session`,
`stripe-webhook`). They are written as generic `(req, res)` handlers — adapt the first/last
lines to your host (notes are in each file). Install deps from `serverless/package.json`
(`stripe`, `@supabase/supabase-js`).

## 3. Set environment variables on the host (NEVER commit these)
From `.env.example`:
```
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...   # SECRET — server only
STRIPE_SECRET_KEY=sk_live_...   # or sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID=price_...
STRIPE_SUCCESS_URL=https://reidconvert.com/account/?checkout=success
STRIPE_CANCEL_URL=https://reidconvert.com/pricing/?checkout=cancel
```

## 4. Register the webhook
- Stripe Dashboard → Developers → Webhooks → add endpoint pointing at your deployed
  `stripe-webhook` URL.
- Subscribe to: `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`.
- Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
- Make sure the host passes the **raw** request body to the webhook (needed for signature
  verification — see the note at the top of `serverless/stripe-webhook.js`).

## 5. Point the front end at your functions
In `assets/js/config.js` add your function base URL (e.g. `FUNCTIONS_URL`) and wire the
Account page "Upgrade" / "Manage billing" buttons to POST to `create-checkout-session` /
`create-portal-session`. (Buttons are currently disabled placeholders.)

## 6. Flip the switch
Once a test checkout flips a profile's `subscription_status` to `active` via the webhook:
- Set `MEMBERSHIP_ENFORCED: true` in `assets/js/config.js`.

That is the only change needed to start enforcing Free vs Member limits (`assets/js/limits.js`
reads this flag). Until then every logged-in user is treated as Free-but-generous and nothing
is locked.

## What to test before going live
- A test-mode checkout completes and the webhook sets `subscription_status = 'active'`.
- `customer.subscription.deleted` sets it back to `free`.
- A logged-in non-member sees Free limits; an active member sees Member limits.
- RLS: a normal user **cannot** change their own `subscription_status` (try it from the
  browser console — it must be rejected).
