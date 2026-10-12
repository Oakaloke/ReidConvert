/* ReidConvert — shared site logic.
 * Builds the header + footer from the tool registry (tools.js) and exposes a
 * small helper namespace (window.RC) used by the converter pages:
 * drag & drop wiring, file-size formatting, download + ZIP helpers, routing.
 */
(function () {
  'use strict';

  var TOOLS = window.RC_TOOLS || [];
  var RC = {};

  /* ---------- small utilities ---------- */

  RC.tools = TOOLS;

  RC.humanSize = function (n) {
    if (n < 1024) return n + ' B';
    if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
    return (n / 1048576).toFixed(2) + ' MB';
  };

  RC.escapeHtml = function (s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };

  RC.todayStr = function () {
    var d = new Date();
    var m = ('0' + (d.getMonth() + 1)).slice(-2);
    var day = ('0' + d.getDate()).slice(-2);
    return d.getFullYear() + '-' + m + '-' + day;
  };

  RC.extOf = function (name) {
    var i = (name || '').lastIndexOf('.');
    return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
  };

  RC.baseName = function (name) {
    var i = (name || '').lastIndexOf('.');
    return i > 0 ? name.slice(0, i) : (name || 'file');
  };

  RC.liveTools = function () { return TOOLS.filter(function (t) { return t.status === 'live'; }); };

  /* Find a tool that converts FROM the given file extension. */
  RC.toolForExt = function (ext) {
    ext = (ext || '').toLowerCase();
    for (var i = 0; i < TOOLS.length; i++) {
      var a = TOOLS[i].accept || [];
      if (a.indexOf(ext) !== -1) return TOOLS[i];
    }
    return null;
  };

  /* ---------- download helpers ---------- */

  RC.downloadBlob = function (blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  };

  /* files = [{name, blob}] ; zipName optional (defaults to dated name). */
  RC.zipAndDownload = function (files, zipName) {
    if (typeof JSZip === 'undefined') {
      alert('ZIP support failed to load. Please download files individually.');
      return Promise.reject(new Error('JSZip missing'));
    }
    var zip = new JSZip();
    files.forEach(function (f) { zip.file(f.name, f.blob); });
    return zip.generateAsync({ type: 'blob' }).then(function (content) {
      RC.downloadBlob(content, zipName || ('reidconvert-' + RC.todayStr() + '.zip'));
    });
  };

  /* ---------- drag & drop wiring ----------
   * setupDropzone(zoneEl, onFiles, {inputEl, clickToPick})
   * onFiles receives a plain Array of File objects.
   */
  RC.setupDropzone = function (zone, onFiles, opts) {
    opts = opts || {};
    var input = opts.inputEl || null;

    function emit(list) {
      var files = Array.prototype.slice.call(list || []);
      if (files.length) onFiles(files);
    }

    ['dragenter', 'dragover'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) {
        e.preventDefault(); e.stopPropagation();
        zone.classList.add('is-drag');
      });
    });
    ['dragleave', 'dragend'].forEach(function (ev) {
      zone.addEventListener(ev, function (e) {
        e.preventDefault();
        if (e.target === zone) zone.classList.remove('is-drag');
      });
    });
    zone.addEventListener('drop', function (e) {
      e.preventDefault(); e.stopPropagation();
      zone.classList.remove('is-drag');
      if (e.dataTransfer && e.dataTransfer.files) emit(e.dataTransfer.files);
    });

    if (opts.clickToPick !== false && input) {
      zone.addEventListener('click', function (e) {
        if (e.target.closest && e.target.closest('a,button') && e.target !== zone) return;
        input.click();
      });
      zone.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); }
      });
    }
    if (input) {
      input.addEventListener('change', function () {
        emit(input.files);
        input.value = '';
      });
    }
  };

  /* Prevent the browser from navigating when a file is dropped outside a zone. */
  window.addEventListener('dragover', function (e) { e.preventDefault(); });
  window.addEventListener('drop', function (e) { e.preventDefault(); });

  /* ---------- header / footer ---------- */

  function logoMarkup() {
    return '<a class="brand" href="/" aria-label="ReidConvert home">' +
      '<img class="brand-mark" src="/assets/img/logo-mark.png" alt="" width="64" height="64" decoding="async">' +
      '<span class="brand-name">ReidConvert</span>' +
      '</a>';
  }

  function toolsMenu() {
    var items = TOOLS.map(function (t) {
      var badge = t.status === 'soon' ? ' <span class="badge">Soon</span>' : '';
      var href = t.status === 'live' ? t.url : '#';
      var cls = t.status === 'live' ? '' : ' class="is-soon" aria-disabled="true"';
      return '<li><a href="' + href + '"' + cls + '>' + RC.escapeHtml(t.name) + badge + '</a></li>';
    }).join('');
    return items;
  }

  function buildHeader() {
    var mount = document.getElementById('site-header');
    if (!mount) return;
    mount.innerHTML =
      '<a class="skip-link" href="#main">Skip to content</a>' +
      '<div class="container nav">' +
        logoMarkup() +
        '<button class="nav-toggle" aria-expanded="false" aria-controls="nav-menu" aria-label="Open menu">' +
          '<span></span><span></span><span></span>' +
        '</button>' +
        '<nav id="nav-menu" class="nav-menu" aria-label="Primary">' +
          '<ul class="nav-list">' +
            '<li class="has-sub">' +
              '<a href="/#tools" aria-haspopup="true">Tools <svg class="chev" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></a>' +
              '<ul class="submenu">' + toolsMenu() + '</ul>' +
            '</li>' +
            '<li><a href="/about.html">About</a></li>' +
            '<li><a href="/contact.html">Contact</a></li>' +
          '</ul>' +
        '</nav>' +
      '</div>';

    var toggle = mount.querySelector('.nav-toggle');
    var menu = mount.querySelector('.nav-menu');
    toggle.addEventListener('click', function () {
      var open = menu.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    // mobile: tap "Tools" opens submenu inline
    var sub = mount.querySelector('.has-sub > a');
    sub.addEventListener('click', function (e) {
      if (window.matchMedia('(max-width: 768px)').matches) {
        e.preventDefault();
        mount.querySelector('.has-sub').classList.toggle('open');
      }
    });
  }

  function buildFooter() {
    var mount = document.getElementById('site-footer');
    if (!mount) return;
    var toolLinks = TOOLS.map(function (t) {
      var href = t.status === 'live' ? t.url : '#';
      var soon = t.status === 'soon' ? ' <span class="badge">Soon</span>' : '';
      return '<li><a href="' + href + '">' + RC.escapeHtml(t.name) + soon + '</a></li>';
    }).join('');

    mount.innerHTML =
      '<div class="container footer-grid">' +
        '<div class="footer-brand">' +
          '<a class="brand footer-brand-lockup" href="/" aria-label="ReidConvert home">' +
            '<span class="mark-chip"><img src="/assets/img/logo-mark.png" alt="" width="56" height="56" loading="lazy"></span>' +
            '<span class="brand-name">ReidConvert</span>' +
          '</a>' +
          '<p>Free, private file conversion that runs entirely in your browser. Your files are never uploaded.</p>' +
        '</div>' +
        '<div><h3>Converters</h3><ul>' + toolLinks + '</ul></div>' +
        '<div><h3>Company</h3><ul>' +
          '<li><a href="/about.html">About</a></li>' +
          '<li><a href="/contact.html">Contact</a></li>' +
          '<li><a href="/privacy.html">Privacy</a></li>' +
          '<li><a href="/terms.html">Terms</a></li>' +
        '</ul></div>' +
      '</div>' +
      '<div class="container footer-bottom"><p>&copy; 2026 ReidConvert. All rights reserved.</p>' +
      '<p class="muted">Converted locally &mdash; nothing leaves your device.</p></div>';
  }

  document.addEventListener('DOMContentLoaded', function () {
    buildHeader();
    buildFooter();
  });

  window.RC = RC;
})();
