/* ReidConvert — freemium conversion-count quota (RC.usage).
 *
 * Tracks how many conversions a user has done this calendar month and, when
 * enforcement is on, blocks free users past the limit with an upgrade prompt.
 *
 * Design goals:
 *  - ONE number controls the free allowance: RC_CONFIG.FREE_MONTHLY_CONVERSIONS.
 *  - Members are unlimited (RC.auth.isMember(), which respects MEMBERSHIP_ENFORCED).
 *  - Real counting is server-side: it counts rows in Supabase `conversion_history`
 *    for the current month (RLS means a user can only see/insert their own). A
 *    localStorage mirror keeps the number instant and works before login.
 *  - NOTHING blocks until enforcement is on, so the site behaves exactly as today
 *    until you flip USAGE_ENFORCED (or MEMBERSHIP_ENFORCED) to true.
 *
 * Exposes window.RC.usage:
 *   LIMIT                 -> free monthly limit (number)
 *   enforced()            -> bool  (USAGE_ENFORCED || MEMBERSHIP_ENFORCED)
 *   refresh()             -> Promise<snapshot>   (re-reads the real count)
 *   state()               -> Promise<snapshot>   (alias of refresh)
 *   snapshot              -> {count, limit, unlimited, enforced, remaining, ready}
 *   wouldBlock()          -> bool   (sync, from the cached snapshot)
 *   gate(contextEl)       -> bool   (sync; shows the upgrade prompt + returns false when blocked)
 *   record(info)          -> Promise (count one conversion; info: {tool,name,outputFormat,size,n})
 *   promptUpgrade(ctx)    -> void   (show the upgrade modal)
 */
(function () {
  'use strict';
  var RC = window.RC || (window.RC = {});
  var CFG = window.RC_CONFIG || {};

  var usage = {};
  usage.LIMIT = (typeof CFG.FREE_MONTHLY_CONVERSIONS === 'number') ? CFG.FREE_MONTHLY_CONVERSIONS : 10;

  function authOn() { return !!(RC.auth && RC.auth.enabled && RC.auth.enabled()); }
  usage.enforced = function () { return !!(CFG.USAGE_ENFORCED || CFG.MEMBERSHIP_ENFORCED); };

  /* ---- period + localStorage mirror ---- */
  function periodKey() {
    var d = new Date();
    return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1);
  }
  function monthStartISO() {
    var d = new Date();
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1)).toISOString();
  }
  function lsKey() { return 'rc-usage-' + periodKey(); }
  function lsGet() { try { return parseInt(localStorage.getItem(lsKey()) || '0', 10) || 0; } catch (e) { return 0; } }
  function lsAdd(n) { try { localStorage.setItem(lsKey(), String(lsGet() + (n || 1))); } catch (e) {} }

  /* ---- cached snapshot (gate() reads this synchronously) ---- */
  var snap = { count: 0, limit: usage.LIMIT, unlimited: false, enforced: usage.enforced(), remaining: usage.LIMIT, ready: false };
  usage.snapshot = snap;
  function recompute() {
    snap.limit = usage.LIMIT;
    snap.enforced = usage.enforced();
    snap.remaining = snap.unlimited ? Infinity : Math.max(0, snap.limit - snap.count);
  }

  function countServer(uid) {
    return RC.auth.client().then(function (c) {
      return c.from('conversion_history')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', uid)
        .gte('created_at', monthStartISO());
    }).then(function (r) { return (r && typeof r.count === 'number') ? r.count : lsGet(); })
      .catch(function () { return lsGet(); });
  }

  usage.refresh = function () {
    if (!authOn()) {
      // No accounts yet: mirror localStorage only; never treated as a member, never blocks (enforced is false).
      snap.count = lsGet(); snap.unlimited = false; snap.ready = true; recompute();
      return Promise.resolve(snap);
    }
    return RC.auth.user().then(function (u) {
      if (!u) { snap.count = lsGet(); snap.unlimited = false; recompute(); return snap; }
      return RC.auth.isMember().then(function (m) {
        if (m) { snap.unlimited = true; snap.count = 0; recompute(); return snap; }
        return countServer(u.id).then(function (n) { snap.unlimited = false; snap.count = n; recompute(); return snap; });
      });
    }).then(function () { snap.ready = true; return snap; })
      .catch(function () { snap.count = lsGet(); recompute(); snap.ready = true; return snap; });
  };
  usage.state = usage.refresh;

  usage.wouldBlock = function () { return snap.enforced && !snap.unlimited && snap.count >= snap.limit; };

  /* Synchronous gate used by the converters. Returns true to allow. When enforcement
     is off (default), always true → zero behaviour change. */
  usage.gate = function (contextEl) {
    recompute();
    if (!snap.enforced) return true;
    if (usage.wouldBlock()) { usage.promptUpgrade(contextEl); return false; }
    return true;
  };

  usage.record = function (info) {
    info = info || {};
    var n = info.n || 1;
    lsAdd(n);
    snap.count += n; recompute();
    if (!authOn()) return Promise.resolve();
    return RC.auth.user().then(function (u) {
      if (!u) return;
      return RC.auth.client().then(function (c) {
        var rows = [];
        for (var i = 0; i < n; i++) {
          rows.push({
            user_id: u.id,
            converter_id: info.tool || null,
            original_name: info.name || null,
            output_format: info.outputFormat || null,
            file_size: (typeof info.size === 'number') ? info.size : null
          });
        }
        return c.from('conversion_history').insert(rows);
      });
    }).then(function () { return usage.refresh(); }).catch(function () {});
  };

  /* ---------- upgrade modal ---------- */
  var modalEl = null;
  usage.promptUpgrade = function () {
    if (modalEl) return;
    var used = snap.count, lim = snap.limit;
    modalEl = document.createElement('div');
    modalEl.className = 'rc-upgrade';
    modalEl.setAttribute('role', 'dialog');
    modalEl.setAttribute('aria-modal', 'true');
    modalEl.setAttribute('aria-label', 'Upgrade to Member');
    modalEl.innerHTML =
      '<div class="rc-upgrade-backdrop"></div>' +
      '<div class="rc-upgrade-card">' +
        '<div class="rc-upgrade-ico" aria-hidden="true">✨</div>' +
        '<h2>You’ve used your ' + lim + ' free conversions</h2>' +
        '<p>You’ve done <strong>' + used + '</strong> conversions this month. Upgrade to <strong>Member</strong> for unlimited conversions, bigger files and batch ZIP downloads — all still 100% private in your browser.</p>' +
        '<div class="rc-upgrade-actions">' +
          '<a class="btn btn-gold btn-lg" href="/pricing/">See Member plans</a>' +
          '<button type="button" class="btn btn-ghost" data-rc-close>Maybe later</button>' +
        '</div>' +
        '<p class="rc-upgrade-fine">Your free conversions reset at the start of next month.</p>' +
      '</div>';
    document.body.appendChild(modalEl);
    document.body.classList.add('cv-modal-open');
    function close() {
      if (!modalEl) return;
      modalEl.remove(); modalEl = null;
      document.body.classList.remove('cv-modal-open');
    }
    modalEl.querySelector('[data-rc-close]').addEventListener('click', close);
    modalEl.querySelector('.rc-upgrade-backdrop').addEventListener('click', close);
    document.addEventListener('keydown', function esc(e) {
      if (e.key === 'Escape') { close(); document.removeEventListener('keydown', esc); }
    });
  };

  // Warm the snapshot once things are ready (safe no-op if auth is off).
  document.addEventListener('DOMContentLoaded', function () { setTimeout(function () { usage.refresh(); }, 0); });

  RC.usage = usage;
})();
