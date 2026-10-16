/* ReidConvert — reusable DOCUMENT conversion workspace.
 *
 * RC.createDocWorkspace(mountEl, engine, opts) builds a complete, accessible,
 * multi-file conversion UI inside mountEl, visually and behaviourally identical to
 * the image workspace (convert-core.js) — same .cv-* components, same toolbar,
 * selection, downloads and ZIP — but geared for document → document conversion
 * (e.g. PDF → Word). It manages the queue, validation, settings, per-file + overall
 * progress, statuses, downloads and ZIP, and delegates the actual conversion to the
 * engine's `convert(item, ctx)` which returns the output blob(s).
 *
 * Heavy libraries (pdf.js, tesseract.js, docx) are loaded lazily on demand and are
 * exposed to the engine through the conversion context, so the page stays light
 * until the user actually converts. All work happens in the browser — nothing is
 * ever uploaded.
 *
 * engine = {
 *   key, inputLabel, outputLabel, outputExt, outputMime,
 *   accept:      ['pdf'],                       // extensions
 *   acceptMime:  ['application/pdf'],
 *   ocr:         true,                          // show OCR-related options
 *   sniff(bytes) -> true|false|null,            // magic-byte check (null = unknown/allow)
 *   analyze(file, ctx) -> Promise<{pages, thumbUrl}>   // optional: metadata + thumbnail for the row
 *   convert(item, ctx) -> Promise<[{name, blob}]>      // required: do the conversion
 * }
 *
 * ctx (passed to analyze/convert):
 *   { settings, tier, libs:{ensurePdfjs, ensureDocx},
 *     ocrRecognize(source, onPageProgress) -> Promise<string>,
 *     dpiScale(), onProgress(frac, label), throwIfAborted(), signal }
 */
(function () {
  'use strict';
  var RC = window.RC || (window.RC = {});

  /* ----- pinned CDN builds (UMD / classic globals, matching the site's script model) ----- */
  var CDN = {
    pdfjs:        'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js',
    pdfjsWorker:  'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js',
    tesseract:    'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
    docx:         'https://cdn.jsdelivr.net/npm/docx@8.5.0/build/index.umd.js'
  };

  /* ----- tier configuration -----------------------------------------------------------
   * Everything that a future paid subscription would raise or unlock lives here. The
   * free tier is generous and unlimited-feeling; a 'pro' object can be added later and
   * selected without touching the pipeline. Limits are read through `tier` everywhere.
   */
  var TIERS = {
    free: {
      id: 'free',
      maxFiles: 20,
      maxBytes: 100 * 1024 * 1024,     // 100 MB per file
      maxPagesPerFile: 200,            // graceful guard against runaway documents
      concurrency: 1,                  // one document at a time (memory safety)
      ocrLanguages: ['eng', 'spa', 'fra', 'deu', 'por', 'ita', 'nld'],
      dpiPresets: { balanced: 2.0, high: 3.0 },
      allowHighDpi: true
    }
    // pro: { id:'pro', maxFiles: 200, maxBytes: 500*1024*1024, maxPagesPerFile: 2000,
    //        concurrency: 2, ocrLanguages: [...many...], dpiPresets:{balanced:2,high:3,ultra:4},
    //        allowHighDpi: true }   ← layered on later, no pipeline rewrite needed
  };
  RC.docTier = RC.docTier || 'free';   // swap to 'pro' when subscriptions land

  var OCR_LANG_NAMES = {
    eng: 'English', spa: 'Spanish', fra: 'French', deu: 'German',
    por: 'Portuguese', ita: 'Italian', nld: 'Dutch'
  };

  /* ---------- tiny SVG icon set (shared visual language with convert-core) ---------- */
  var ICON = {
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 21h14" stroke-linecap="round"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2m-8 0l1 13h8l1-13" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    retry: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 12a8 8 0 10-2.3 5.6M20 12V7m0 5h-5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 13a7.9 7.9 0 000-2l2-1.5-2-3.5-2.4 1a8 8 0 00-1.7-1l-.4-2.5H9.1l-.4 2.5a8 8 0 00-1.7 1l-2.4-1-2 3.5L4.6 11a7.9 7.9 0 000 2l-2 1.5 2 3.5 2.4-1a8 8 0 001.7 1l.4 2.5h5.8l.4-2.5a8 8 0 001.7-1l2.4 1 2-3.5-2-1.5z" stroke-linejoin="round"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h13m0 0l-5-5m5 5l-5 5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg>'
  };

  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }

  /* ---------- preferences (non-sensitive, localStorage) ---------- */
  function loadPrefs(key) { try { return JSON.parse(localStorage.getItem('rc:' + key)) || {}; } catch (e) { return {}; } }
  function savePrefs(key, obj) { try { localStorage.setItem('rc:' + key, JSON.stringify(obj)); } catch (e) {} }

  /* ---------- lazy script loader (shared, de-duplicated) ---------- */
  var scriptPromises = {};
  function loadScript(src) {
    if (scriptPromises[src]) return scriptPromises[src];
    scriptPromises[src] = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = function () { resolve(); };
      s.onerror = function () { delete scriptPromises[src]; reject(new Error('A required component failed to load. Check your connection and try again.')); };
      document.head.appendChild(s);
    });
    return scriptPromises[src];
  }
  function ensurePdfjs() {
    return loadScript(CDN.pdfjs).then(function () {
      var lib = window.pdfjsLib;
      if (!lib) throw new Error('The PDF engine failed to initialise.');
      if (!lib.GlobalWorkerOptions.workerSrc) lib.GlobalWorkerOptions.workerSrc = CDN.pdfjsWorker;
      return lib;
    });
  }
  function ensureDocx() {
    return loadScript(CDN.docx).then(function () {
      if (!window.docx) throw new Error('The Word document engine failed to initialise.');
      return window.docx;
    });
  }
  function ensureTesseract() {
    return loadScript(CDN.tesseract).then(function () {
      if (!window.Tesseract) throw new Error('The OCR engine failed to initialise.');
      return window.Tesseract;
    });
  }

  RC.createDocWorkspace = function (mount, engine, opts) {
    opts = opts || {};
    var tier = TIERS[RC.docTier] || TIERS.free;
    var MAX_FILES = opts.maxFiles || tier.maxFiles;
    var MAX_BYTES = opts.maxBytes || tier.maxBytes;

    var prefs = loadPrefs(engine.key);
    var settings = {
      ocrLang: tier.ocrLanguages.indexOf(prefs.ocrLang) !== -1 ? prefs.ocrLang : 'eng',
      dpiPreset: prefs.dpiPreset === 'high' ? 'high' : 'balanced',
      preferText: prefs.preferText !== false,     // default ON
      filenameMode: 'original',
      customBase: ''
    };
    var autoConvert = prefs.autoConvert !== false;   // default ON, remembered

    var items = [];        // {id,file,status,outputs:[{name,blob,url}],error,thumbUrl,selected,pages,progress}
    var selection = {};
    var nextId = 1;
    var activeConversions = 0;

    /* ---------- OCR worker management (lazy, reused across pages + files) ---------- */
    var ocrWorkers = {};        // lang -> Promise<worker>
    var activeOcrProgress = null;
    function getOcrWorker(lang) {
      if (ocrWorkers[lang]) return ocrWorkers[lang];
      ocrWorkers[lang] = ensureTesseract().then(function (T) {
        return T.createWorker(lang, 1, {
          logger: function (m) {
            if (m && m.status === 'recognizing text' && typeof activeOcrProgress === 'function') {
              activeOcrProgress(m.progress || 0);
            }
          }
        });
      });
      return ocrWorkers[lang];
    }
    function terminateWorkers() {
      Object.keys(ocrWorkers).forEach(function (lang) {
        var p = ocrWorkers[lang]; delete ocrWorkers[lang];
        p.then(function (w) { try { w.terminate(); } catch (e) {} }, function () {});
      });
    }

    /* ---------- build shell (identical markup to the image workspace) ---------- */
    mount.classList.add('cv');
    mount.innerHTML =
      '<div class="cv-drop" id="cvDrop" role="button" tabindex="0" aria-label="Add ' + engine.inputLabel + ' files: drag and drop, or press Enter to choose files">' +
        '<div class="cv-drop-ico" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 16V4m0 0L7 9m5-5l5 5" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke-linecap="round"/></svg>' +
        '</div>' +
        '<h2 class="cv-drop-title">Drop ' + engine.inputLabel + ' files here</h2>' +
        '<p class="cv-drop-sub">or choose files from your device</p>' +
        '<button type="button" class="btn btn-lg" id="cvPick">Choose files</button>' +
        '<p class="cv-drop-formats">Supported: ' + engine.accept.map(function (e) { return '.' + e; }).join(', ') +
          ' &middot; converts to editable ' + engine.outputLabel + '</p>' +
        '<input type="file" id="cvInput" accept="' + engine.accept.map(function (e) { return '.' + e; }).concat(engine.acceptMime || []).join(',') + '" multiple hidden>' +
      '</div>' +
      '<div class="cv-privacy"><span aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l7 3v5c0 4.5-3 8.2-7 9-4-.8-7-4.5-7-9V6l7-3z" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</span> 100% private — your files are converted on this device and never uploaded.</div>' +

      '<div class="cv-work" id="cvWork" hidden>' +
        '<div class="cv-toolbar">' +
          '<div class="cv-toolbar-l">' +
            '<span class="cv-count" id="cvCount">0 files</span>' +
            '<label class="cv-switch" title="Convert files automatically when added">' +
              '<input type="checkbox" id="cvAuto"><span class="cv-switch-track" aria-hidden="true"><span class="cv-switch-dot"></span></span>' +
              '<span class="cv-switch-label">Auto-convert</span>' +
            '</label>' +
          '</div>' +
          '<div class="cv-toolbar-r">' +
            '<button type="button" class="btn btn-ghost btn-sm" id="cvAddMore">Add files</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" id="cvOptions">' + ICON.gear + ' Options</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" id="cvClear">Clear all</button>' +
            '<button type="button" class="btn btn-gold btn-sm" id="cvDownloadAll" disabled>' + ICON.download + ' Download all</button>' +
          '</div>' +
        '</div>' +
        '<div class="cv-overall" id="cvOverall" hidden><div class="cv-overall-bar"><i id="cvOverallFill"></i></div><p id="cvOverallMsg"></p></div>' +
        '<div class="cv-bulk" id="cvBulk" hidden role="region" aria-label="Bulk actions">' +
          '<span class="cv-bulk-count" id="cvBulkCount">0 selected</span>' +
          '<div class="cv-bulk-actions">' +
            '<button type="button" class="btn btn-ghost btn-sm" id="cvBulkDownload">Download selected</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" id="cvBulkRemove">Remove selected</button>' +
            '<button type="button" class="btn btn-ghost btn-sm" id="cvBulkClear">Clear selection</button>' +
          '</div>' +
        '</div>' +
        '<ul class="cv-list" id="cvList" aria-label="Files to convert"></ul>' +
      '</div>' +

      '<div class="cv-notice" id="cvNotice" role="status" aria-live="polite" hidden></div>' +
      '<div class="cv-live vh" aria-live="polite" id="cvLive"></div>' +
      '<div class="cv-overlay" id="cvOverlay" hidden aria-hidden="true"><div class="cv-overlay-inner">' + ICON.download + '<p>Drop to add files</p></div></div>';

    var q = function (sel) { return mount.querySelector(sel); };
    var dropEl = q('#cvDrop'), inputEl = q('#cvInput'), workEl = q('#cvWork'),
        listEl = q('#cvList'), countEl = q('#cvCount'), noticeEl = q('#cvNotice'),
        liveEl = q('#cvLive'), overlayEl = q('#cvOverlay'),
        autoEl = q('#cvAuto'), dlAllEl = q('#cvDownloadAll'),
        bulkEl = q('#cvBulk'), bulkCountEl = q('#cvBulkCount'),
        overallEl = q('#cvOverall'), overallFill = q('#cvOverallFill'), overallMsg = q('#cvOverallMsg');
    autoEl.checked = autoConvert;

    function announce(msg) { liveEl.textContent = ''; liveEl.textContent = msg; }
    function showNotice(msg, kind) { noticeEl.textContent = msg; noticeEl.className = 'cv-notice ' + (kind || 'warn'); noticeEl.hidden = false; }
    function clearNotice() { noticeEl.hidden = true; noticeEl.textContent = ''; }

    /* ---------- validation ---------- */
    function hasAcceptedExt(file) {
      var ext = RC.extOf(file.name);
      if (engine.accept.indexOf(ext) !== -1) return true;
      return (engine.acceptMime || []).indexOf(file.type) !== -1;
    }
    function sniff(file) {
      return file.slice(0, 32).arrayBuffer().then(function (buf) {
        return engine.sniff ? engine.sniff(new Uint8Array(buf)) : null;
      }).catch(function () { return null; });
    }

    /* ---------- conversion context passed to the engine ---------- */
    function dpiScale() { return tier.dpiPresets[settings.dpiPreset] || tier.dpiPresets.balanced; }
    function makeCtx(item) {
      return {
        settings: settings,
        tier: tier,
        libs: { ensurePdfjs: ensurePdfjs, ensureDocx: ensureDocx, ensureTesseract: ensureTesseract },
        dpiScale: dpiScale,
        ocrRecognize: function (source, onPageProgress) {
          return getOcrWorker(settings.ocrLang).then(function (worker) {
            activeOcrProgress = onPageProgress || null;
            return worker.recognize(source).then(function (res) {
              activeOcrProgress = null;
              return (res && res.data && res.data.text) || '';
            }, function (e) { activeOcrProgress = null; throw e; });
          });
        },
        onProgress: function (frac, label) { setProgress(item, frac, label); },
        throwIfAborted: function () { if (item._aborted) { var e = new Error('Cancelled'); e.cancelled = true; throw e; } },
        get signal() { return item._aborted; }
      };
    }

    /* ---------- queue ---------- */
    function addFiles(fileList) {
      clearNotice();
      var incoming = Array.prototype.slice.call(fileList);
      var byExt = incoming.filter(hasAcceptedExt);
      var rejectedType = incoming.length - byExt.length;
      var tooBig = [];
      var room = MAX_FILES - items.length;
      var trimmed = false;
      if (byExt.length > room) { byExt = byExt.slice(0, Math.max(0, room)); trimmed = true; }

      var notes = [];
      byExt.forEach(function (file) {
        if (file.size > MAX_BYTES) { tooBig.push(file.name); return; }
        var item = { id: nextId++, file: file, status: 'validating', outputs: [], error: null, thumbUrl: null, el: null, pages: null, progress: null, _aborted: false };
        items.push(item);
        renderItem(item);
        sniff(file).then(function (ok) {
          if (ok === false) { setStatus(item, 'failed'); item.error = 'This file isn’t a genuine ' + engine.inputLabel + ' document (its contents don’t match the format).'; renderRow(item); refresh(); return; }
          // optional metadata + thumbnail (page count etc.) — best-effort, never blocks readiness
          if (engine.analyze) {
            engine.analyze(file, makeCtx(item)).then(function (meta) {
              if (meta) { if (meta.pages) item.pages = meta.pages; if (meta.thumbUrl) item.thumbUrl = meta.thumbUrl; renderRow(item); }
            }, function () {});
          }
          setStatus(item, 'ready');
          renderRow(item);
          refresh();
          if (autoEl.checked) enqueueConvert(item);
        });
      });

      if (rejectedType > 0) notes.push(rejectedType + ' file' + (rejectedType > 1 ? 's were' : ' was') + ' skipped — only ' + engine.accept.map(function (e) { return '.' + e; }).join('/') + ' are supported here.');
      if (tooBig.length) notes.push(tooBig.length + ' file' + (tooBig.length > 1 ? 's were' : ' was') + ' too large (over ' + RC.humanSize(MAX_BYTES) + ').');
      if (trimmed) notes.push('Only the first ' + MAX_FILES + ' files are kept per batch.');
      if (notes.length) showNotice(notes.join(' '), 'warn');

      if (items.length) workEl.hidden = false;
      refresh();
    }

    function removeItem(item) {
      item._aborted = true;
      revokeItem(item);
      items = items.filter(function (x) { return x !== item; });
      delete selection[item.id];
      if (item.el) item.el.remove();
      if (!items.length) { workEl.hidden = true; clearNotice(); terminateWorkers(); }
      refresh();
    }
    function revokeItem(item) {
      if (item.thumbUrl && item.thumbUrl.indexOf('blob:') === 0) URL.revokeObjectURL(item.thumbUrl);
      item.outputs.forEach(function (o) { URL.revokeObjectURL(o.url); });
      item.outputs = [];
    }
    function clearAll() {
      items.forEach(function (i) { i._aborted = true; revokeItem(i); });
      items = []; selection = {};
      listEl.innerHTML = ''; workEl.hidden = true; clearNotice();
      terminateWorkers();
      refresh();
    }

    /* ---------- rendering ---------- */
    function statusLabel(s) {
      return { validating: 'Checking…', ready: 'Ready', converting: 'Converting', finished: 'Finished', failed: 'Failed', cancelled: 'Cancelled' }[s] || s;
    }
    function renderItem(item) {
      var li = el('<li class="cv-row" data-id="' + item.id + '"></li>');
      li.innerHTML =
        '<label class="cv-check"><input type="checkbox" aria-label="Select file"><span aria-hidden="true"></span></label>' +
        '<div class="cv-thumb" aria-hidden="true">' + engine.inputLabel + '</div>' +
        '<div class="cv-info">' +
          '<div class="cv-name"></div>' +
          '<div class="cv-sub"><span class="cv-size"></span></div>' +
        '</div>' +
        '<div class="cv-convert">' +
          '<span class="cv-fmt cv-fmt-in">' + engine.inputLabel + '</span>' +
          '<span class="cv-arrow" aria-label="to">' + ICON.arrow + '</span>' +
          '<span class="cv-fmt cv-fmt-out">' + engine.outputLabel + '</span>' +
        '</div>' +
        '<div class="cv-state"><span class="cv-status"></span></div>' +
        '<div class="cv-row-actions"></div>';
      li.querySelector('.cv-name').textContent = item.file.name;
      li.querySelector('.cv-size').textContent = RC.humanSize(item.file.size);
      listEl.appendChild(li);
      item.el = li;
      li.querySelector('.cv-check input').addEventListener('change', function (e) {
        if (e.target.checked) selection[item.id] = true; else delete selection[item.id];
        li.classList.toggle('is-selected', !!selection[item.id]);
        refreshBulk();
      });
      renderRow(item);
    }

    function renderRow(item) {
      if (!item.el) return;
      var badge = item.el.querySelector('.cv-status');
      badge.className = 'cv-status is-' + item.status;
      badge.textContent = statusLabel(item.status) + (item.status === 'finished' && item.outputs.length > 1 ? ' · ' + item.outputs.length : '');

      // thumbnail
      var thumb = item.el.querySelector('.cv-thumb');
      if (item.thumbUrl) { thumb.textContent = ''; thumb.style.backgroundImage = 'url("' + item.thumbUrl + '")'; thumb.classList.add('has-img'); }

      // sub line: size + page count (+ output size after finish)
      var sizeEl = item.el.querySelector('.cv-size');
      var pageStr = item.pages ? '  ·  ' + item.pages + ' page' + (item.pages === 1 ? '' : 's') : '';
      if (item.status === 'finished' && item.outputs.length) {
        var total = item.outputs.reduce(function (s, o) { return s + o.blob.size; }, 0);
        sizeEl.textContent = RC.humanSize(item.file.size) + pageStr + '  →  ' + RC.humanSize(total);
      } else {
        sizeEl.textContent = RC.humanSize(item.file.size) + pageStr;
      }

      // error text
      var sub = item.el.querySelector('.cv-sub');
      var existingErr = sub.querySelector('.cv-err');
      if (item.status === 'failed' && item.error) {
        if (!existingErr) { existingErr = el('<span class="cv-err"></span>'); sub.appendChild(existingErr); }
        existingErr.textContent = item.error;
      } else if (existingErr) { existingErr.remove(); }

      // per-file progress bar (during conversion)
      var prog = sub.querySelector('.cv-prog');
      if (item.status === 'converting') {
        if (!prog) { prog = el('<span class="cv-prog"><span class="cv-prog-bar"><i></i></span><span class="cv-prog-label"></span></span>'); sub.appendChild(prog); }
        var pct = Math.round(((item.progress && item.progress.frac) || 0) * 100);
        prog.querySelector('i').style.width = pct + '%';
        prog.querySelector('.cv-prog-label').textContent = (item.progress && item.progress.label) || 'Starting…';
      } else if (prog) { prog.remove(); }

      // actions
      var act = item.el.querySelector('.cv-row-actions');
      act.innerHTML = '';
      if (item.status === 'converting' || item.status === 'validating') {
        act.appendChild(el('<span class="spin" role="img" aria-label="Working"></span>'));
      } else if (item.status === 'ready' && !autoEl.checked) {
        var cBtn = el('<button type="button" class="btn btn-sm cv-act-convert">Convert</button>');
        cBtn.addEventListener('click', function () { enqueueConvert(item); });
        act.appendChild(cBtn);
      } else if (item.status === 'finished') {
        if (item.outputs.length === 1) {
          var dl = el('<a class="btn btn-gold btn-sm cv-act-dl" href="' + item.outputs[0].url + '" download="' + RC.escapeHtml(item.outputs[0].name) + '">' + ICON.download + ' Download</a>');
          act.appendChild(dl);
        } else {
          var dz = el('<button type="button" class="btn btn-gold btn-sm cv-act-dl">' + ICON.download + ' Download ' + item.outputs.length + '</button>');
          dz.addEventListener('click', function () { downloadItem(item); });
          act.appendChild(dz);
        }
      } else if (item.status === 'failed') {
        var rtry = el('<button type="button" class="icon-btn cv-act-retry" aria-label="Retry conversion" title="Retry">' + ICON.retry + '</button>');
        rtry.addEventListener('click', function () { item.error = null; item._aborted = false; setStatus(item, 'ready'); renderRow(item); enqueueConvert(item); });
        act.appendChild(rtry);
      }
      var rm = el('<button type="button" class="icon-btn cv-act-remove" aria-label="Remove ' + RC.escapeHtml(item.file.name) + '" title="Remove">' + ICON.trash + '</button>');
      rm.addEventListener('click', function () { removeItem(item); });
      act.appendChild(rm);
    }

    function setStatus(item, status) { item.status = status; if (item.el) renderRow(item); }
    function setProgress(item, frac, label) {
      item.progress = { frac: Math.max(0, Math.min(1, frac || 0)), label: label || '' };
      // update just the bar for smoothness
      if (item.el) {
        var prog = item.el.querySelector('.cv-prog');
        if (prog) { prog.querySelector('i').style.width = Math.round(item.progress.frac * 100) + '%'; prog.querySelector('.cv-prog-label').textContent = item.progress.label; }
        else renderRow(item);
      }
      updateOverall();
    }

    /* ---------- naming ---------- */
    function outName(item, idx, total) {
      var base = settings.filenameMode === 'custom' && settings.customBase
        ? settings.customBase + (total > 1 ? '-' + (idx + 1) : (items.length > 1 ? '-' + item.id : ''))
        : RC.baseName(item.file.name) + (total > 1 ? '-' + (idx + 1) : '');
      return uniqueName(base + '.' + engine.outputExt);
    }
    function uniqueName(desired) {
      var taken = {};
      items.forEach(function (i) { i.outputs.forEach(function (o) { taken[o.name.toLowerCase()] = true; }); });
      if (!taken[desired.toLowerCase()]) return desired;
      var dot = desired.lastIndexOf('.'), stem = dot > 0 ? desired.slice(0, dot) : desired, ext = dot > 0 ? desired.slice(dot) : '';
      var n = 2; while (taken[(stem + '-' + n + ext).toLowerCase()]) n++;
      return stem + '-' + n + ext;
    }

    /* ---------- conversion queue (sequential for memory safety) ---------- */
    var queue = [];
    function enqueueConvert(item) {
      if (item.status === 'converting' || item.status === 'finished') return;
      if (queue.indexOf(item) !== -1) return;
      queue.push(item);
      setStatus(item, 'converting');
      setProgress(item, 0, 'Queued…');
      pump();
    }
    function pump() {
      if (activeConversions >= tier.concurrency) return;
      var item = queue.shift();
      if (!item) { refresh(); return; }
      if (item.status !== 'converting') { pump(); return; }
      activeConversions++;
      convertItem(item).then(function () { activeConversions--; refresh(); pump(); });
    }
    function convertItem(item) {
      revokeOutputs(item);
      setProgress(item, 0.02, 'Reading document…');
      return Promise.resolve().then(function () { return engine.convert(item, makeCtx(item)); }).then(function (outputs) {
        if (item._aborted) { var e = new Error('Cancelled'); e.cancelled = true; throw e; }
        (outputs || []).forEach(function (o, idx) {
          var name = o.name || outName(item, idx, (outputs || []).length);
          var url = URL.createObjectURL(o.blob);
          item.outputs.push({ name: name, blob: o.blob, url: url });
        });
        setProgress(item, 1, 'Done');
        setStatus(item, 'finished');
        announce(item.file.name + ' converted.');
      }).catch(function (e) {
        if (e && e.cancelled) { setStatus(item, 'cancelled'); return; }
        item.error = (e && e.message) ? e.message : 'Could not convert this file.';
        setStatus(item, 'failed');
        announce(item.file.name + ' failed.');
      });
    }
    function revokeOutputs(item) { item.outputs.forEach(function (o) { URL.revokeObjectURL(o.url); }); item.outputs = []; }

    /* ---------- downloads ---------- */
    function collect(list) {
      var files = [];
      list.forEach(function (i) { i.outputs.forEach(function (o) { files.push({ name: o.name, blob: o.blob }); }); });
      return files;
    }
    function downloadItem(item) {
      var files = collect([item]);
      if (files.length === 1) RC.downloadBlob(files[0].blob, files[0].name);
      else if (files.length > 1) RC.zipAndDownload(files, (RC.baseName(item.file.name) || 'documents') + '.zip');
    }
    function downloadMany(list, zipBase) {
      var files = collect(list);
      if (!files.length) return;
      if (files.length === 1) { RC.downloadBlob(files[0].blob, files[0].name); return; }
      RC.zipAndDownload(files, (zipBase || 'reidconvert-' + RC.todayStr()) + '.zip');
    }

    /* ---------- selection / bulk ---------- */
    function selectedItems() { return items.filter(function (i) { return selection[i.id]; }); }
    function refreshBulk() {
      var sel = selectedItems();
      bulkEl.hidden = sel.length === 0;
      bulkCountEl.textContent = sel.length + ' selected';
      q('#cvBulkDownload').disabled = !sel.some(function (i) { return i.status === 'finished'; });
    }

    /* ---------- overall progress ---------- */
    function updateOverall() {
      var active = items.filter(function (i) { return i.status === 'converting' || i.status === 'finished' || queue.indexOf(i) !== -1; });
      var working = items.some(function (i) { return i.status === 'converting'; }) || queue.length > 0;
      if (!working) { overallEl.hidden = true; return; }
      var total = items.filter(function (i) { return i.status === 'converting' || i.status === 'finished' || i.status === 'failed' || i.status === 'cancelled' || queue.indexOf(i) !== -1; }).length || 1;
      var done = 0;
      items.forEach(function (i) {
        if (i.status === 'finished' || i.status === 'failed' || i.status === 'cancelled') done += 1;
        else if (i.status === 'converting') done += (i.progress && i.progress.frac) || 0;
      });
      var pct = Math.round((done / total) * 100);
      overallEl.hidden = false;
      overallFill.style.width = pct + '%';
      var remaining = items.filter(function (i) { return i.status === 'converting' || queue.indexOf(i) !== -1; }).length;
      overallMsg.textContent = 'Converting ' + remaining + ' of ' + total + ' document' + (total === 1 ? '' : 's') + ' · ' + pct + '%';
    }

    /* ---------- global refresh ---------- */
    function refresh() {
      var finished = items.filter(function (i) { return i.status === 'finished'; });
      countEl.textContent = items.length + ' file' + (items.length === 1 ? '' : 's') + (finished.length ? ' · ' + finished.length + ' done' : '');
      dlAllEl.disabled = finished.length === 0;
      dlAllEl.innerHTML = ICON.download + ' Download ' + (finished.length > 1 ? 'all (ZIP)' : finished.length === 1 ? 'file' : 'all');
      Object.keys(selection).forEach(function (id) { if (!items.some(function (i) { return String(i.id) === id; })) delete selection[id]; });
      refreshBulk();
      updateOverall();
    }

    /* ---------- options modal (document-specific) ---------- */
    var modal = null, lastFocus = null;
    function openOptions() {
      lastFocus = document.activeElement;
      modal = el(optionsHtml());
      document.body.appendChild(modal);
      wireOptions(modal);
      document.body.classList.add('cv-modal-open');
      var focusable = modal.querySelectorAll('button, input, select, [tabindex]:not([tabindex="-1"])');
      if (focusable.length) focusable[0].focus();
      modal.addEventListener('keydown', trapKey);
    }
    function closeOptions() {
      if (!modal) return;
      modal.remove(); modal = null;
      document.body.classList.remove('cv-modal-open');
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }
    function trapKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); closeOptions(); return; }
      if (e.key !== 'Tab') return;
      var f = Array.prototype.slice.call(modal.querySelectorAll('button, input, select, [tabindex]:not([tabindex="-1"])')).filter(function (n) { return !n.disabled && n.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    function optionsHtml() {
      var langOpts = tier.ocrLanguages.map(function (code) {
        return '<option value="' + code + '">' + RC.escapeHtml(OCR_LANG_NAMES[code] || code) + '</option>';
      }).join('');
      return '' +
      '<div class="cv-modal" role="dialog" aria-modal="true" aria-labelledby="cvOptTitle">' +
        '<div class="cv-modal-backdrop" data-close="1"></div>' +
        '<div class="cv-modal-card">' +
          '<div class="cv-modal-head"><h2 id="cvOptTitle">Conversion options</h2>' +
            '<button type="button" class="icon-btn" id="cvOptX" aria-label="Close options">' + ICON.x + '</button></div>' +
          '<div class="cv-modal-body">' +

            '<section class="cv-opt"><h3>Text extraction</h3>' +
              '<label class="cv-inline"><input type="checkbox" id="cvPreferText"> Prefer text extraction when available</label>' +
              '<p class="cv-opt-hint">When a PDF already contains real, selectable text we use it directly for the cleanest, most accurate Word document. Pages that are scans or images are read with OCR automatically. Turn this off to force OCR on every page.</p>' +
            '</section>' +

            (engine.ocr ?
            '<section class="cv-opt"><h3>OCR (scanned pages)</h3>' +
              '<label class="cv-field-col">Recognition language' +
                '<select id="cvLang" class="cv-select">' + langOpts + '</select></label>' +
              '<div class="cv-seg" role="radiogroup" aria-label="OCR quality" style="margin-top:14px">' +
                '<button type="button" role="radio" data-dpi="balanced">Balanced</button>' +
                '<button type="button" role="radio" data-dpi="high">High quality</button>' +
              '</div>' +
              '<p class="cv-opt-hint" id="cvDpiHint">Balanced renders scanned pages at a sensible resolution — fast and accurate for most documents. High quality renders at a higher resolution for sharper OCR on small or faint text, but takes longer.</p>' +
            '</section>' : '') +

            '<section class="cv-opt"><h3>Privacy</h3>' +
              '<label class="cv-inline cv-locked"><input type="checkbox" checked disabled> Everything runs on your device</label>' +
              '<p class="cv-opt-hint">Your PDFs are never uploaded. Only the open-source OCR language model is downloaded (once) from a public CDN so recognition can run locally in your browser.</p>' +
            '</section>' +

            '<section class="cv-opt"><h3>Output filename</h3>' +
              '<div class="cv-seg" role="radiogroup" aria-label="Output filename">' +
                '<button type="button" role="radio" data-fn="original" class="is-on">Keep original name</button>' +
                '<button type="button" role="radio" data-fn="custom">Custom name</button>' +
              '</div>' +
              '<div class="cv-fn-custom" hidden><label>Base name <input type="text" id="cvFn" placeholder="my-document"></label><span class="cv-opt-hint">New files become “name.' + engine.outputExt + '”.</span></div>' +
            '</section>' +

            '<section class="cv-opt cv-upsell"><h3>Coming soon</h3>' +
              '<p class="cv-opt-hint">ReidConvert is free and unlimited today. Advanced layout preservation, larger batches, faster processing and more OCR languages may arrive later as an optional subscription — everything you use now stays free.</p>' +
            '</section>' +

          '</div>' +
          '<div class="cv-modal-foot">' +
            '<label class="cv-inline cv-applyall"><input type="checkbox" id="cvApplyAll" checked> Apply to all ready files</label>' +
            '<div class="cv-modal-btns">' +
              '<button type="button" class="btn btn-ghost" id="cvOptCancel">Cancel</button>' +
              '<button type="button" class="btn" id="cvOptSave">Save settings</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
    }
    function wireOptions(m) {
      var draft = JSON.parse(JSON.stringify(settings));

      var preferEl = m.querySelector('#cvPreferText');
      if (preferEl) { preferEl.checked = draft.preferText; preferEl.addEventListener('change', function () { draft.preferText = preferEl.checked; }); }

      var langEl = m.querySelector('#cvLang');
      if (langEl) { langEl.value = draft.ocrLang; langEl.addEventListener('change', function () { draft.ocrLang = langEl.value; }); }

      var dpiSeg = m.querySelectorAll('[data-dpi]');
      function setDpi(v) { draft.dpiPreset = v; dpiSeg.forEach(function (b) { b.classList.toggle('is-on', b.dataset.dpi === v); b.setAttribute('aria-checked', b.dataset.dpi === v); }); }
      dpiSeg.forEach(function (b) { b.addEventListener('click', function () { setDpi(b.dataset.dpi); }); });
      if (dpiSeg.length) setDpi(draft.dpiPreset);

      var fnSeg = m.querySelectorAll('[data-fn]'), fnCustom = m.querySelector('.cv-fn-custom'), fnEl = m.querySelector('#cvFn');
      function setFn(v) { draft.filenameMode = v; fnSeg.forEach(function (b) { b.classList.toggle('is-on', b.dataset.fn === v); b.setAttribute('aria-checked', b.dataset.fn === v); }); fnCustom.hidden = v !== 'custom'; }
      fnSeg.forEach(function (b) { b.addEventListener('click', function () { setFn(b.dataset.fn); }); });
      setFn(draft.filenameMode); if (fnEl) fnEl.value = draft.customBase || '';

      [m.querySelector('#cvOptX'), m.querySelector('#cvOptCancel'), m.querySelector('.cv-modal-backdrop')].forEach(function (n) { if (n) n.addEventListener('click', closeOptions); });
      m.querySelector('#cvOptSave').addEventListener('click', function () {
        if (fnEl) draft.customBase = fnEl.value.trim().replace(/[^\w\-]+/g, '-').replace(/^-+|-+$/g, '');
        var langChanged = draft.ocrLang !== settings.ocrLang;
        settings = draft;
        savePrefs(engine.key, { ocrLang: settings.ocrLang, dpiPreset: settings.dpiPreset, preferText: settings.preferText, autoConvert: autoEl.checked });
        if (langChanged) terminateWorkers();   // drop cached OCR worker for the old language
        var applyAll = m.querySelector('#cvApplyAll').checked;
        closeOptions();
        if (applyAll) {
          items.filter(function (i) { return i.status === 'ready'; }).forEach(function (i) { if (autoEl.checked) enqueueConvert(i); });
          announce('Settings saved and applied to ready files.');
        } else { announce('Settings saved for new conversions.'); }
      });
    }

    /* ---------- wire top-level controls ---------- */
    RC.setupDropzone(dropEl, addFiles, { inputEl: inputEl });
    q('#cvPick').addEventListener('click', function (e) { e.stopPropagation(); inputEl.click(); });
    q('#cvAddMore').addEventListener('click', function () { inputEl.click(); });
    q('#cvClear').addEventListener('click', clearAll);
    q('#cvOptions').addEventListener('click', openOptions);
    dlAllEl.addEventListener('click', function () { downloadMany(items.filter(function (i) { return i.status === 'finished'; })); });
    autoEl.addEventListener('change', function () {
      savePrefs(engine.key, { ocrLang: settings.ocrLang, dpiPreset: settings.dpiPreset, preferText: settings.preferText, autoConvert: autoEl.checked });
      items.forEach(function (i) { renderRow(i); });
      if (autoEl.checked) items.filter(function (i) { return i.status === 'ready'; }).forEach(enqueueConvert);
    });
    q('#cvBulkDownload').addEventListener('click', function () { downloadMany(selectedItems().filter(function (i) { return i.status === 'finished'; }), 'reidconvert-selected'); });
    q('#cvBulkRemove').addEventListener('click', function () { selectedItems().slice().forEach(removeItem); });
    q('#cvBulkClear').addEventListener('click', function () {
      selection = {};
      listEl.querySelectorAll('.cv-check input').forEach(function (c) { c.checked = false; });
      listEl.querySelectorAll('.cv-row').forEach(function (r) { r.classList.remove('is-selected'); });
      refreshBulk();
    });

    // full-workspace drag overlay
    var dragDepth = 0;
    mount.addEventListener('dragenter', function (e) { if (!e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') === -1) return; dragDepth++; overlayEl.hidden = false; });
    mount.addEventListener('dragleave', function () { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) overlayEl.hidden = true; });
    mount.addEventListener('drop', function (e) { dragDepth = 0; overlayEl.hidden = true; if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) { e.preventDefault(); addFiles(e.dataTransfer.files); } });
    mount.addEventListener('dragover', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') !== -1) e.preventDefault(); });

    refresh();
    return { addFiles: addFiles, get items() { return items; }, get settings() { return settings; } };
  };
})();
