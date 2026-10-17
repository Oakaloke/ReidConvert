/* ReidConvert — client-side auth layer (Supabase).
 *
 * Thin, dependency-light wrapper around supabase-js v2, loaded lazily from a CDN only
 * when auth is enabled and configured. Everything is gated behind RC_CONFIG.AUTH_ENABLED
 * so the site behaves exactly as before until you switch it on. No secrets live here —
 * only the public anon key from config.js.
 *
 * Exposes window.RC.auth:
 *   enabled()                      -> bool (AUTH_ENABLED && keys present)
 *   client()                       -> Promise<SupabaseClient>
 *   session()                      -> Promise<session|null>
 *   user()                         -> Promise<user|null>
 *   profile()                      -> Promise<profileRow|null>
 *   isMember()                     -> Promise<bool>   (respects MEMBERSHIP_ENFORCED)
 *   signUp(email, password)        -> Promise
 *   signIn(email, password)        -> Promise
 *   signInMagic(email)             -> Promise
 *   signInGoogle()                 -> Promise
 *   signOut()                      -> Promise
 *   resetPassword(email)           -> Promise
 *   updatePassword(newPassword)    -> Promise
 *   onChange(cb)                   -> unsubscribe
 */
(function () {
  'use strict';
  var RC = window.RC || (window.RC = {});
  var CFG = window.RC_CONFIG || {};
  var SUPABASE_UMD = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.js';

  var auth = {};
  var _clientP = null;

  function configured() { return !!(CFG.SUPABASE_URL && CFG.SUPABASE_ANON_KEY); }
  auth.enabled = function () { return !!CFG.AUTH_ENABLED && configured(); };

  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (window.supabase && window.supabase.createClient) return resolve(window.supabase);
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = function () { window.supabase ? resolve(window.supabase) : reject(new Error('Auth engine failed to initialise.')); };
      s.onerror = function () { reject(new Error('Could not load the sign-in engine. Check your connection.')); };
      document.head.appendChild(s);
    });
  }

  auth.client = function () {
    if (!auth.enabled()) return Promise.reject(new Error('Accounts are not enabled yet.'));
    if (_clientP) return _clientP;
    _clientP = loadScript(SUPABASE_UMD).then(function (sb) {
      return sb.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    });
    return _clientP;
  };

  auth.session = function () {
    if (!auth.enabled()) return Promise.resolve(null);
    return auth.client().then(function (c) { return c.auth.getSession(); })
      .then(function (r) { return (r && r.data && r.data.session) || null; })
      .catch(function () { return null; });
  };
  auth.user = function () { return auth.session().then(function (s) { return s ? s.user : null; }); };

  auth.profile = function () {
    return auth.client().then(function (c) {
      return c.auth.getUser().then(function (u) {
        var user = u && u.data && u.data.user;
        if (!user) return null;
        return c.from('profiles').select('*').eq('id', user.id).single()
          .then(function (r) { return r.data || null; });
      });
    });
  };

  auth.isMember = function () {
    if (!CFG.MEMBERSHIP_ENFORCED) return auth.user().then(function (u) { return !!u; } ).catch(function(){return false;});
    return auth.profile().then(function (p) { return !!(p && p.subscription_status === 'active'); }).catch(function () { return false; });
  };

  auth.signUp = function (email, password) {
    return auth.client().then(function (c) {
      return c.auth.signUp({ email: email, password: password,
        options: { emailRedirectTo: window.location.origin + '/account/' } }).then(throwIfErr);
    });
  };
  auth.signIn = function (email, password) {
    return auth.client().then(function (c) { return c.auth.signInWithPassword({ email: email, password: password }).then(throwIfErr); });
  };
  auth.signInMagic = function (email) {
    return auth.client().then(function (c) {
      return c.auth.signInWithOtp({ email: email, options: { emailRedirectTo: window.location.origin + '/account/' } }).then(throwIfErr);
    });
  };
  auth.signInGoogle = function () {
    return auth.client().then(function (c) {
      return c.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + '/account/' } }).then(throwIfErr);
    });
  };
  auth.signOut = function () { return auth.client().then(function (c) { return c.auth.signOut(); }); };
  auth.resetPassword = function (email) {
    return auth.client().then(function (c) {
      return c.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/account/?reset=1' }).then(throwIfErr);
    });
  };
  auth.updatePassword = function (newPassword) {
    return auth.client().then(function (c) { return c.auth.updateUser({ password: newPassword }).then(throwIfErr); });
  };
  auth.onChange = function (cb) {
    var unsub = function () {};
    auth.client().then(function (c) {
      var r = c.auth.onAuthStateChange(function (_e, session) { cb(session); });
      unsub = function () { try { r.data.subscription.unsubscribe(); } catch (e) {} };
    }).catch(function () {});
    return function () { unsub(); };
  };

  function throwIfErr(r) { if (r && r.error) throw r.error; return r; }

  /* ---- header nav item (auto, when enabled) ---- */
  function mountNav() {
    if (!auth.enabled()) return;
    var list = document.querySelector('#nav-menu .nav-list');
    if (!list || list.querySelector('.nav-auth')) return;
    var li = document.createElement('li');
    li.className = 'nav-auth';
    li.innerHTML = '<a href="/login/">Log in</a>';
    list.appendChild(li);
    auth.user().then(function (u) {
      if (u) li.innerHTML = '<a href="/account/">Account</a>';
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    // common.js builds the header on DOMContentLoaded too; defer slightly so it exists.
    setTimeout(mountNav, 0);
  });

  auth.mountNav = mountNav;
  RC.auth = auth;
})();
