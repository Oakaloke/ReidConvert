/* ReidConvert — tier limits (single source of truth).
 *
 * Implements DECISION D3. One place defines what Free vs Member can do, so every
 * converter and the account/pricing pages agree. Until Stripe is connected, the
 * MEMBERSHIP_ENFORCED flag (config.js) keeps everyone on Free limits so nothing is
 * locked on launch day — a logged-in user is only treated as Member when the flag
 * is true AND their profile row has subscription_status = 'active'.
 *
 *   RC.limits.FREE / RC.limits.MEMBER   -> the raw limit objects
 *   RC.limits.current()                 -> Promise<limits>  (resolves the active tier)
 *   RC.limits.enforced()                -> bool
 *   RC.limits.describe(limits)          -> {files, perFile, video, ...} human strings
 */
(function () {
  'use strict';
  var RC = window.RC || (window.RC = {});
  var CFG = window.RC_CONFIG || {};
  var MB = 1024 * 1024, GB = 1024 * MB;

  var FREE = {
    tier: 'free',
    maxFiles: 1,                 // one file at a time (free)
    maxBytes: 25 * MB,
    maxVideoSeconds: 120,        // 2 minutes
    zipBatches: false,
    history: false
  };
  var MEMBER = {
    tier: 'member',
    maxFiles: 50,
    maxBytes: 2 * GB,            // browser-memory permitting
    maxVideoSeconds: Infinity,
    zipBatches: true,
    history: true
  };

  var limits = { FREE: FREE, MEMBER: MEMBER };

  limits.enforced = function () { return !!CFG.MEMBERSHIP_ENFORCED; };

  // Resolve the active tier. Without enforcement, everyone gets MEMBER-level
  // generosity (nothing locked); the individual converters still apply their own
  // conservative per-tool guards. When enforced, Members need an active sub.
  limits.current = function () {
    if (!limits.enforced()) {
      // Pre-launch: keep the generous, unlimited-feeling behaviour the site ships with.
      return Promise.resolve(MEMBER);
    }
    if (RC.auth && RC.auth.isMember) {
      return RC.auth.isMember().then(function (m) { return m ? MEMBER : FREE; }).catch(function () { return FREE; });
    }
    return Promise.resolve(FREE);
  };

  limits.describe = function (l) {
    l = l || FREE;
    return {
      files: l.maxFiles === 1 ? '1 file at a time' : ('up to ' + l.maxFiles + ' files per batch'),
      perFile: l.maxBytes >= GB ? ('up to ' + Math.round(l.maxBytes / GB) + ' GB per file') : ('up to ' + Math.round(l.maxBytes / MB) + ' MB per file'),
      video: l.maxVideoSeconds === Infinity ? 'no video length limit' : ('up to ' + Math.round(l.maxVideoSeconds / 60) + ' min of video'),
      zip: l.zipBatches ? 'ZIP download of batches' : 'single downloads',
      history: l.history ? 'conversion history' : 'no history'
    };
  };

  RC.limits = limits;
})();
