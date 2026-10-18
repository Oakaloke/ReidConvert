/* ReidConvert — client billing (Stripe Checkout + Portal).
 *
 * Thin bridge from the Upgrade / Manage-billing buttons to the serverless functions
 * in serverless/ (create-checkout-session, create-portal-session). No secrets here —
 * it just POSTs the signed-in user's id/email and redirects to the URL Stripe returns.
 *
 * Everything is inert until RC_CONFIG.FUNCTIONS_URL is set AND auth is enabled, so the
 * buttons stay in their "coming soon" state on the live site until you turn it on.
 *
 * Exposes window.RC.billing:
 *   configured()   -> bool  (FUNCTIONS_URL set && auth enabled)
 *   priceLabel()   -> string (e.g. "$5/month")
 *   checkout()     -> Promise  (start Stripe Checkout; redirects to signup if logged out)
 *   portal()       -> Promise  (open the Stripe customer portal to manage/cancel)
 */
(function () {
  'use strict';
  var RC = window.RC || (window.RC = {});
  var CFG = window.RC_CONFIG || {};

  var billing = {};

  function base() { return String(CFG.FUNCTIONS_URL || '').replace(/\/+$/, ''); }
  function authReady() { return !!(RC.auth && RC.auth.enabled && RC.auth.enabled()); }

  billing.configured = function () { return !!(base() && authReady()); };
  billing.priceLabel = function () { return CFG.MEMBER_PRICE_LABEL || '$5/month'; };

  function postJSON(path, payload) {
    return fetch(base() + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (data) {
        if (!r.ok) throw new Error((data && data.message) || ('Request failed (' + r.status + ')'));
        return data;
      });
    });
  }

  // Start a subscription. Logged-out visitors are sent to sign up first.
  billing.checkout = function () {
    if (!billing.configured()) {
      alert('Member subscriptions are coming soon.');
      return Promise.resolve();
    }
    return RC.auth.user().then(function (u) {
      if (!u) { window.location.href = '/signup/?next=/pricing/'; return; }
      return postJSON('/create-checkout-session', { email: u.email, userId: u.id }).then(function (d) {
        if (d && d.url) window.location.href = d.url;
        else throw new Error('Could not start checkout.');
      });
    }).catch(function (e) { alert(e.message || 'Could not start checkout. Please try again.'); });
  };

  // Open the Stripe customer portal to manage or cancel.
  billing.portal = function () {
    if (!billing.configured()) { alert('Billing management is coming soon.'); return Promise.resolve(); }
    return RC.auth.profile().then(function (p) {
      var customer = p && p.stripe_customer_id;
      if (!customer) { alert('No active subscription found on this account.'); return; }
      return postJSON('/create-portal-session', { customerId: customer }).then(function (d) {
        if (d && d.url) window.location.href = d.url;
        else throw new Error('Could not open the billing portal.');
      });
    }).catch(function (e) { alert(e.message || 'Could not open the billing portal.'); });
  };

  RC.billing = billing;
})();
