/* ReidConvert — reusable conversion workspace.
 *
 * RC.createWorkspace(mountEl, engine, opts) builds a complete, accessible,
 * multi-file conversion UI inside mountEl. It is engine-agnostic: it manages the
 * file queue, validation, settings, previews, statuses, selection, downloads and
 * ZIP generation, and delegates the actual decode to `engine`.
 *
 * engine = {
 *   key, inputLabel, outputLabel, outputExt, outputMime,
 *   accept:      ['heic','heif'],            // extensions
 *   acceptMime:  ['image/heic','image/heif'],
 *   sniff(bytes) -> true|false|null,          // magic-byte check (null = unknown/allow)
 *   decode(file) -> Promise<HTMLImageElement[]> // one or more decoded frames
 * }
 *
 * The queue, validation, engine, settings, previews, downloads, ZIP and shared
 * UI are intentionally separated so future converters reuse everything here and
 * only supply a small engine object.
 */
(function () {
  'use strict';
  var RC = window.RC || (window.RC = {});

  /* ---------- tiny SVG icon set ---------- */
  var ICON = {
    download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M12 3v12m0 0l-4-4m4 4l4-4" stroke-linecap="round" stroke-linejoin="round"/><path d="M5 21h14" stroke-linecap="round"/></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 7h16M9 7V5h6v2m-8 0l1 13h8l1-13" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    retry: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 12a8 8 0 10-2.3 5.6M20 12V7m0 5h-5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 13a7.9 7.9 0 000-2l2-1.5-2-3.5-2.4 1a8 8 0 00-1.7-1l-.4-2.5H9.1l-.4 2.5a8 8 0 00-1.7 1l-2.4-1-2 3.5L4.6 11a7.9 7.9 0 000 2l-2 1.5 2 3.5 2.4-1a8 8 0 001.7 1l.4 2.5h5.8l.4-2.5a8 8 0 001.7-1l2.4 1 2-3.5-2-1.5z" stroke-linejoin="round"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 12h13m0 0l-5-5m5 5l-5 5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke-linecap="round"/></svg>',
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" aria-hidden="true"><path d="M5 12l4 4 10-11" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };

  var QUALITY_MAP = { auto: 0.9, smaller: 0.6, balanced: 0.78, high: 0.92 };

  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }

  /* ---------- preferences (non-sensitive, localStorage) ---------- */
  function loadPrefs(key) {
    try { return JSON.parse(localStorage.getItem('rc:' + key)) || {}; } catch (e) { return {}; }
  }
  function savePrefs(key, obj) {
    try { localStorage.setItem('rc:' + key, JSON.stringify(obj)); } catch (e) {}
  }

  RC.createWorkspace = function (mount, engine, opts) {
    opts = opts || {};
    var MAX_FILES = opts.maxFiles || 40;
    var MAX_BYTES = opts.maxBytes || 100 * 1024 * 1024;   // 100 MB per file
    var MAX_PIXELS = opts.maxPixels || 60 * 1000000;        // downscale above ~60 MP

    var prefs = loadPrefs(engine.key);
    var settings = {
      qualityPreset: prefs.qualityPreset || 'auto',
      quality: typeof prefs.quality === 'number' ? prefs.quality : 0.82,
      resizeMode: 'original',
      width: null, height: null, keepAspect: true,
      stripMetadata: true,              // canvas re-encode always strips EXIF — honest default
      background: '#ffffff',
      filenameMode: 'original',         // 'original' | 'custom'
      customBase: ''
    };
    var autoConvert = prefs.autoConvert !== false;   // default ON, remembered

    var items = [];        // {id,file,status,frames,outputs:[{name,blob,url}],error,thumbUrl,selected,over:{...}}
    var selection = {};    // id -> true
    var nextId = 1;
    var activeConversions = 0;

    /* ---------- build shell ---------- */
    mount.classList.add('cv');
    mount.innerHTML =
      '<div class="cv-drop" id="cvDrop" role="button" tabindex="0" aria-label="Add ' + engine.inputLabel + ' files: drag and drop, or press Enter to choose files">' +
        '<div class="cv-drop-ico" aria-hidden="true">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 16V4m0 0L7 9m5-5l5 5" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke-linecap="round"/></svg>' +
        '</div>' +
        '<h2 class="cv-drop-title">Drop ' + engine.inputLabel + ' photos here</h2>' +
        '<p class="cv-drop-sub">or choose files from your device</p>' +
        '<button type="button" class="btn btn-lg" id="cvPick">Choose files</button>' +
        '<p class="cv-drop-formats">Supported: ' + engine.accept.map(function (e) { return '.' + e; }).join(', ') +
          ' &middot; converts to ' + engine.outputLabel + '</p>' +
        '<input type="file" id="cvInput" accept="' + engine.accept.map(function (e) { return '.' + e; }).concat(engine.acceptMime || []).join(',') + '" multiple hidden>' +
      '</div>' +
      '<div class="cv-privacy"><span aria-hidden="true">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l7 3v5c0 4.5-3 8.2-7 9-4-.8-7-4.5-7-9V6l7-3z" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg>' +
        '</span> 100% private — your photos are converted on this device and never uploaded.</div>' +

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
        '<div class="cv-progress" id="cvProgress" hidden role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="Overall conversion progress">' +
          '<div class="cv-progress-track"><div class="cv-progress-fill" id="cvProgressFill"></div></div>' +
          '<span class="cv-progress-meta"><span class="cv-progress-check" id="cvProgressCheck" aria-hidden="true">' + ICON.check + '</span><span class="cv-progress-label" id="cvProgressLabel"></span></span>' +
        '</div>' +
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
        progressEl = q('#cvProgress'), progressFillEl = q('#cvProgressFill'),
        progressLabelEl = q('#cvProgressLabel');
    autoEl.checked = autoConvert;

    function announce(msg) { liveEl.textContent = ''; liveEl.textContent = msg; }
    function showNotice(msg, kind) {
      noticeEl.textContent = msg; noticeEl.className = 'cv-notice ' + (kind || 'warn'); noticeEl.hidden = false;
    }
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
        var item = { id: nextId++, file: file, status: 'validating', outputs: [], error: null, thumbUrl: null, el: null, over: null };
        items.push(item);
        renderItem(item);
        // magic-byte validation before declaring Ready
        sniff(file).then(function (ok) {
          if (ok === false) { setStatus(item, 'failed'); item.error = 'This file isn’t a genuine ' + engine.inputLabel + ' image (its contents don’t match the format).'; renderRow(item); refresh(); return; }
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

      if (items.length) { workEl.hidden = false; }
      refresh();
    }

    function removeItem(item) {
      revokeItem(item);
      items = items.filter(function (x) { return x !== item; });
      delete selection[item.id];
      if (item.el) item.el.remove();
      if (!items.length) { workEl.hidden = true; clearNotice(); }
      refresh();
    }
    function revokeItem(item) {
      if (item.thumbUrl) URL.revokeObjectURL(item.thumbUrl);
      item.outputs.forEach(function (o) { URL.revokeObjectURL(o.url); });
      item.outputs = [];
    }
    function clearAll() {
      items.forEach(revokeItem);
      items = []; selection = {};
      listEl.innerHTML = ''; workEl.hidden = true; clearNotice(); refresh();
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

      // size line (show out size after finish)
      if (item.status === 'finished' && item.outputs.length) {
        var total = item.outputs.reduce(function (s, o) { return s + o.blob.size; }, 0);
        item.el.querySelector('.cv-size').textContent = RC.humanSize(item.file.size) + '  →  ' + RC.humanSize(total);
      }

      // error text
      var sub = item.el.querySelector('.cv-sub');
      var existingErr = sub.querySelector('.cv-err');
      if (item.status === 'failed' && item.error) {
        if (!existingErr) { existingErr = el('<span class="cv-err"></span>'); sub.appendChild(existingErr); }
        existingErr.textContent = item.error;
      } else if (existingErr) { existingErr.remove(); }

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
        rtry.addEventListener('click', function () { item.error = null; setStatus(item, 'ready'); renderRow(item); enqueueConvert(item); });
        act.appendChild(rtry);
      }
      var rm = el('<button type="button" class="icon-btn cv-act-remove" aria-label="Remove ' + RC.escapeHtml(item.file.name) + '" title="Remove">' + ICON.trash + '</button>');
      rm.addEventListener('click', function () { removeItem(item); });
      act.appendChild(rm);
    }

    function setStatus(item, status) { item.status = status; if (item.el) renderRow(item); }

    /* ---------- conversion ---------- */
    function presetQuality() {
      return settings.qualityPreset === 'custom' ? settings.quality : QUALITY_MAP[settings.qualityPreset];
    }
    function targetDims(w, h) {
      // resolution settings
      if (settings.resizeMode === 'dimensions' && (settings.width || settings.height)) {
        var tw = settings.width, th = settings.height;
        if (settings.keepAspect) {
          if (tw && !th) th = Math.round(tw * h / w);
          else if (th && !tw) tw = Math.round(th * w / h);
          else if (tw && th) { var r = Math.min(tw / w, th / h); tw = Math.round(w * r); th = Math.round(h * r); }
        }
        w = tw || w; h = th || h;
      }
      // hard pixel cap (graceful memory guard)
      if (w * h > MAX_PIXELS) { var s = Math.sqrt(MAX_PIXELS / (w * h)); w = Math.round(w * s); h = Math.round(h * s); }
      return { w: Math.max(1, w), h: Math.max(1, h) };
    }
    function encode(img) {
      var dim = targetDims(img.naturalWidth || img.width, img.naturalHeight || img.height);
      var canvas = document.createElement('canvas');
      canvas.width = dim.w; canvas.height = dim.h;
      var ctx = canvas.getContext('2d');
      if (engine.outputMime === 'image/jpeg') { ctx.fillStyle = settings.background || '#ffffff'; ctx.fillRect(0, 0, dim.w, dim.h); }
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, dim.w, dim.h);
      var q = engine.outputMime === 'image/png' ? undefined : presetQuality();
      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (blob) {
          canvas.width = canvas.height = 0; // release
          if (blob) resolve(blob); else reject(new Error('Your browser could not encode a ' + engine.outputLabel + '.'));
        }, engine.outputMime, q);
      });
    }
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

    var queue = [];
    function enqueueConvert(item) {
      if (item.status === 'converting' || item.status === 'finished') return;      // no duplicate / rapid-click starts
      if (queue.indexOf(item) !== -1) return;
      if (window.RC && RC.usage && !RC.usage.gate(mount)) return;                   // freemium gate (no-op unless enforced + over limit)
      queue.push(item);
      setStatus(item, 'converting');
      pump();
    }
    function pump() {
      if (activeConversions >= 1) return;    // sequential: 1 at a time for memory safety
      var item = queue.shift();
      if (!item) { refresh(); return; }
      if (item.status !== 'converting') { pump(); return; }
      activeConversions++;
      convertItem(item).then(function () {
        activeConversions--; refresh(); pump();
      });
    }
    function convertItem(item) {
      revokeOutputs(item);
      return Promise.resolve().then(function () { return engine.decode(item.file); }).then(function (frames) {
        var chain = Promise.resolve();
        frames.forEach(function (img, idx) {
          chain = chain.then(function () {
            return encode(img).then(function (blob) {
              var name = outName(item, idx, frames.length);
              var url = URL.createObjectURL(blob);
              item.outputs.push({ name: name, blob: blob, url: url });
              if (idx === 0 && !item.thumbUrl) { item.thumbUrl = URL.createObjectURL(blob); }
            });
          });
        });
        return chain;
      }).then(function () {
        setStatus(item, 'finished');
        if (window.RC && RC.usage) RC.usage.record({ tool: engine.key, name: item.file.name, outputFormat: engine.outputLabel, size: item.file.size });
        announce(item.file.name + ' converted.');
      }).catch(function (e) {
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
      else if (files.length > 1) RC.zipAndDownload(files, (RC.baseName(item.file.name) || 'images') + '.zip');
    }
    function downloadMany(list, zipBase) {
      var files = collect(list);
      if (!files.length) return;
      if (files.length === 1) { RC.downloadBlob(files[0].blob, files[0].name); return; }   // never ZIP a single file
      RC.zipAndDownload(files, (zipBase || 'reidconvert-' + RC.todayStr()) + '.zip');
    }

    /* ---------- selection / bulk ---------- */
    function selectedItems() { return items.filter(function (i) { return selection[i.id]; }); }
    function refreshBulk() {
      var sel = selectedItems();
      bulkEl.hidden = sel.length === 0;
      bulkCountEl.textContent = sel.length + ' selected';
      var anyDone = sel.some(function (i) { return i.status === 'finished'; });
      q('#cvBulkDownload').disabled = !anyDone;
    }

    /* ---------- batch progress bar (light-blue fill, gold check when all done) ---------- */
    function updateProgress(done) {
      var total = items.length;
      if (!total) { progressEl.hidden = true; progressEl.classList.remove('is-complete', 'is-done'); return; }
      progressEl.hidden = false;
      var failed = 0, active = 0;
      items.forEach(function (i) {
        if (i.status === 'failed') failed++;
        else if (i.status === 'converting' || i.status === 'validating') active++;
      });
      // finished = full credit, in-flight = half credit, so the bar advances as work happens
      var value = Math.min(total, done + failed + active * 0.5);
      var pct = Math.round(value / total * 100);
      progressFillEl.style.width = pct + '%';
      progressEl.setAttribute('aria-valuenow', String(pct));
      var allResolved = (done + failed === total);
      var allGood = allResolved && done === total;             // every file converted successfully
      progressEl.classList.toggle('is-complete', allGood);     // shows the gold check
      progressEl.classList.toggle('is-done', allResolved);
      if (allGood) progressLabelEl.textContent = 'All ' + total + ' converted';
      else if (allResolved) progressLabelEl.textContent = done + ' converted · ' + failed + ' failed';
      else progressLabelEl.textContent = done + ' of ' + total + ' converted';
    }

    /* ---------- global refresh ---------- */
    function refresh() {
      var finished = items.filter(function (i) { return i.status === 'finished'; });
      countEl.textContent = items.length + ' file' + (items.length === 1 ? '' : 's') +
        (finished.length ? ' · ' + finished.length + ' done' : '');
      dlAllEl.disabled = finished.length === 0;
      dlAllEl.innerHTML = ICON.download + ' Download ' + (finished.length > 1 ? 'all (ZIP)' : finished.length === 1 ? 'file' : 'all');
      updateProgress(finished.length);
      // clean selection of removed ids
      Object.keys(selection).forEach(function (id) { if (!items.some(function (i) { return String(i.id) === id; })) delete selection[id]; });
      refreshBulk();
    }

    /* ---------- options modal ---------- */
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
      var showsQuality = engine.outputMime !== 'image/png';
      return '' +
      '<div class="cv-modal" role="dialog" aria-modal="true" aria-labelledby="cvOptTitle">' +
        '<div class="cv-modal-backdrop" data-close="1"></div>' +
        '<div class="cv-modal-card">' +
          '<div class="cv-modal-head"><h2 id="cvOptTitle">Conversion options</h2>' +
            '<button type="button" class="icon-btn" id="cvOptX" aria-label="Close options">' + ICON.x + '</button></div>' +
          '<div class="cv-modal-body">' +

            '<section class="cv-opt"><h3>Resolution</h3>' +
              '<div class="cv-seg" role="radiogroup" aria-label="Resolution">' +
                '<button type="button" role="radio" data-res="original" class="is-on">Original</button>' +
                '<button type="button" role="radio" data-res="dimensions">Custom size</button>' +
              '</div>' +
              '<div class="cv-dims" hidden>' +
                '<label>Width <input type="number" id="cvW" min="1" max="20000" inputmode="numeric" placeholder="auto"></label>' +
                '<span class="cv-dims-x">×</span>' +
                '<label>Height <input type="number" id="cvH" min="1" max="20000" inputmode="numeric" placeholder="auto"></label>' +
                '<label class="cv-inline"><input type="checkbox" id="cvAspect" checked> Lock aspect ratio</label>' +
              '</div>' +
            '</section>' +

            (showsQuality ?
            '<section class="cv-opt"><h3>Quality</h3>' +
              '<div class="cv-seg cv-seg-wrap" role="radiogroup" aria-label="Quality preset">' +
                '<button type="button" role="radio" data-q="auto">Automatic</button>' +
                '<button type="button" role="radio" data-q="smaller">Smaller file</button>' +
                '<button type="button" role="radio" data-q="balanced">Balanced</button>' +
                '<button type="button" role="radio" data-q="high">High quality</button>' +
                '<button type="button" role="radio" data-q="custom">Custom</button>' +
              '</div>' +
              '<p class="cv-opt-hint" id="cvQHint">Recommended — sharp results at a sensible file size.</p>' +
              '<div class="cv-custom-q" hidden><input type="range" id="cvQ" min="40" max="100" step="1"><span class="range-val" id="cvQVal">82%</span></div>' +
            '</section>' : '') +

            '<section class="cv-opt"><h3>Metadata &amp; privacy</h3>' +
              '<label class="cv-inline cv-locked"><input type="checkbox" checked disabled> Remove metadata (EXIF, GPS location)</label>' +
              '<p class="cv-opt-hint">Converting through the browser canvas always removes embedded metadata, so your location and camera details are stripped automatically. Image orientation is corrected and baked in.</p>' +
            '</section>' +

            '<section class="cv-opt"><h3>Advanced</h3>' +
              '<div class="cv-seg" role="radiogroup" aria-label="Output filename">' +
                '<button type="button" role="radio" data-fn="original" class="is-on">Keep original name</button>' +
                '<button type="button" role="radio" data-fn="custom">Custom name</button>' +
              '</div>' +
              '<div class="cv-fn-custom" hidden><label>Base name <input type="text" id="cvFn" placeholder="my-photo"></label><span class="cv-opt-hint">New files become “name.' + engine.outputExt + '”.</span></div>' +
              (engine.outputMime === 'image/jpeg' ?
              '<label class="cv-field-row">Background for transparent areas <input type="color" id="cvBg" value="#ffffff"></label>' : '') +
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
      // hydrate from current settings
      var draft = JSON.parse(JSON.stringify(settings));
      var resSeg = m.querySelectorAll('[data-res]'), dims = m.querySelector('.cv-dims');
      var wEl = m.querySelector('#cvW'), hEl = m.querySelector('#cvH'), aspectEl = m.querySelector('#cvAspect');
      function setRes(v) { draft.resizeMode = v; resSeg.forEach(function (b) { b.classList.toggle('is-on', b.dataset.res === v); b.setAttribute('aria-checked', b.dataset.res === v); }); dims.hidden = v !== 'dimensions'; }
      resSeg.forEach(function (b) { b.addEventListener('click', function () { setRes(b.dataset.res); }); });
      setRes(draft.resizeMode);
      if (wEl) { wEl.value = draft.width || ''; hEl.value = draft.height || ''; aspectEl.checked = draft.keepAspect; }

      var qSeg = m.querySelectorAll('[data-q]'), customQ = m.querySelector('.cv-custom-q'),
          qRange = m.querySelector('#cvQ'), qVal = m.querySelector('#cvQVal'), qHint = m.querySelector('#cvQHint');
      var HINTS = { auto: 'Recommended — sharp results at a sensible file size.', smaller: 'Smallest files. Good for email and quick sharing.', balanced: 'A middle ground between size and sharpness.', high: 'Maximum detail. Larger files.', custom: 'Choose the exact JPEG quality yourself.' };
      function setQ(v) { if (!qSeg.length) return; draft.qualityPreset = v; qSeg.forEach(function (b) { b.classList.toggle('is-on', b.dataset.q === v); b.setAttribute('aria-checked', b.dataset.q === v); }); if (customQ) customQ.hidden = v !== 'custom'; if (qHint) qHint.textContent = HINTS[v]; }
      qSeg.forEach(function (b) { b.addEventListener('click', function () { setQ(b.dataset.q); }); });
      if (qSeg.length) { setQ(draft.qualityPreset); qRange.value = Math.round(draft.quality * 100); qVal.textContent = qRange.value + '%'; qRange.addEventListener('input', function () { qVal.textContent = qRange.value + '%'; draft.quality = parseInt(qRange.value, 10) / 100; }); }

      var fnSeg = m.querySelectorAll('[data-fn]'), fnCustom = m.querySelector('.cv-fn-custom'), fnEl = m.querySelector('#cvFn'), bgEl = m.querySelector('#cvBg');
      function setFn(v) { draft.filenameMode = v; fnSeg.forEach(function (b) { b.classList.toggle('is-on', b.dataset.fn === v); b.setAttribute('aria-checked', b.dataset.fn === v); }); fnCustom.hidden = v !== 'custom'; }
      fnSeg.forEach(function (b) { b.addEventListener('click', function () { setFn(b.dataset.fn); }); });
      setFn(draft.filenameMode); if (fnEl) fnEl.value = draft.customBase || '';
      if (bgEl) bgEl.value = draft.background;

      // aspect auto-calc
      function syncAspect(changed) {
        if (!aspectEl || !aspectEl.checked) return;
        var ratioItem = items[0];
        // we don't know source dims until decode; only mirror if both typed — keep non-destructive
      }
      [m.querySelector('#cvOptX'), m.querySelector('#cvOptCancel'), m.querySelector('.cv-modal-backdrop')].forEach(function (n) { if (n) n.addEventListener('click', closeOptions); });
      m.querySelector('#cvOptSave').addEventListener('click', function () {
        if (wEl) { draft.width = parseInt(wEl.value, 10) || null; draft.height = parseInt(hEl.value, 10) || null; draft.keepAspect = aspectEl.checked; }
        if (fnEl) draft.customBase = fnEl.value.trim().replace(/[^\w\-]+/g, '-').replace(/^-+|-+$/g, '');
        if (bgEl) draft.background = bgEl.value;
        settings = draft;
        savePrefs(engine.key, { qualityPreset: settings.qualityPreset, quality: settings.quality, autoConvert: autoEl.checked });
        var applyAll = m.querySelector('#cvApplyAll').checked;
        closeOptions();
        if (applyAll) {
          // re-apply to READY files only; completed files are not silently changed
          items.filter(function (i) { return i.status === 'ready'; }).forEach(function (i) { if (autoEl.checked) enqueueConvert(i); });
          announce('Settings saved and applied to ready files.');
        } else { announce('Settings saved for new conversions.'); }
      });
    }

    /* ---------- wire top-level controls ---------- */
    RC.setupDropzone(dropEl, addFiles, { inputEl: inputEl });
    // Pick up a file handed off from the landing page (dropped once there).
    if (RC.takeStashedFiles) RC.takeStashedFiles(engine.key).then(function (f) { if (f && f.length) addFiles(f); });
    q('#cvPick').addEventListener('click', function (e) { e.stopPropagation(); inputEl.click(); });
    q('#cvAddMore').addEventListener('click', function () { inputEl.click(); });
    q('#cvClear').addEventListener('click', clearAll);
    q('#cvOptions').addEventListener('click', openOptions);
    dlAllEl.addEventListener('click', function () { downloadMany(items.filter(function (i) { return i.status === 'finished'; })); });
    autoEl.addEventListener('change', function () {
      savePrefs(engine.key, { qualityPreset: settings.qualityPreset, quality: settings.quality, autoConvert: autoEl.checked });
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

    // full-workspace drag overlay (nice feedback), without hijacking the inner dropzone
    var dragDepth = 0;
    mount.addEventListener('dragenter', function (e) { if (!e.dataTransfer || Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') === -1) return; dragDepth++; overlayEl.hidden = false; });
    mount.addEventListener('dragleave', function () { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) overlayEl.hidden = true; });
    mount.addEventListener('drop', function (e) { dragDepth = 0; overlayEl.hidden = true; if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) { e.preventDefault(); addFiles(e.dataTransfer.files); } });
    mount.addEventListener('dragover', function (e) { if (e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types || [], 'Files') !== -1) e.preventDefault(); });

    refresh();
    return { addFiles: addFiles, get items() { return items; }, get settings() { return settings; } };
  };
})();
