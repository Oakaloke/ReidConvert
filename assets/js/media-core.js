/* ReidConvert — reusable MEDIA (audio/video) conversion workspace.
 *
 * RC.createMediaWorkspace(mountEl, engine, opts) builds a drop → convert → download
 * UI visually consistent with the image and document workspaces (same .cv-* classes),
 * but powered by ffmpeg.wasm (single-thread build, no COOP/COEP headers required, so it
 * runs on static hosting such as GitHub Pages). The heavy ~25 MB engine is loaded lazily
 * on the first conversion and reused for the rest of the session. Everything runs in the
 * browser — nothing is uploaded.
 *
 * NOTE: these converters are shipped as BETA. ffmpeg.wasm is CPU-heavy in the browser and
 * large files can be slow or hit memory limits; friendly errors are shown when that happens.
 *
 * engine = {
 *   key, inputLabel, outputLabel, outputExt, outputMime,
 *   accept: ['mp4'], acceptMime: ['video/mp4'],
 *   sniff(bytes) -> true|false|null,
 *   options: [ {id, label, type:'select'|'range', choices?, min?, max?, step?, unit?, default} ],
 *   buildArgs(settings, inName, outName) -> [ffmpeg args...],
 *   outName(baseName, settings) -> string            // optional custom output name
 * }
 */
(function () {
  'use strict';
  var RC = window.RC || (window.RC = {});

  // Pinned ffmpeg.wasm single-thread build (UMD global `FFmpeg`) + matching core.
  var FFMPEG_UMD = 'https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.11.6/dist/ffmpeg.min.js';
  var FFMPEG_CORE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.11.0/dist/ffmpeg-core.js';

  var _scriptP = null;
  function loadFFmpegScript() {
    if (_scriptP) return _scriptP;
    _scriptP = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = FFMPEG_UMD; s.async = true;
      s.onload = function () { window.FFmpeg ? resolve(window.FFmpeg) : reject(new Error('The media engine failed to initialise.')); };
      s.onerror = function () { _scriptP = null; reject(new Error('The media engine failed to load. Check your connection and try again.')); };
      document.head.appendChild(s);
    });
    return _scriptP;
  }

  var _ffmpeg = null, _loadP = null, _activeProgress = null;
  function ensureFFmpeg(onBoot) {
    if (_ffmpeg && _ffmpeg.isLoaded && _ffmpeg.isLoaded()) return Promise.resolve(_ffmpeg);
    if (_loadP) return _loadP;
    _loadP = loadFFmpegScript().then(function (FF) {
      if (onBoot) onBoot();
      _ffmpeg = FF.createFFmpeg({
        log: false,
        corePath: FFMPEG_CORE,
        progress: function (p) { if (typeof _activeProgress === 'function' && p && typeof p.ratio === 'number') _activeProgress(Math.max(0, Math.min(1, p.ratio))); }
      });
      RC._ffmpegFetchFile = FF.fetchFile;
      return _ffmpeg.load().then(function () { return _ffmpeg; });
    }).catch(function (e) { _loadP = null; throw e; });
    return _loadP;
  }

  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }

  RC.createMediaWorkspace = function (mount, engine, opts) {
    opts = opts || {};
    var MAX_FILES = opts.maxFiles || 10;
    var MAX_BYTES = opts.maxBytes || (25 * 1024 * 1024); // free-tier default; see limits.js
    var settings = {};
    (engine.options || []).forEach(function (o) { settings[o.id] = o.default; });

    var items = []; // {id,file,status,blob,url,error,progress,el}
    var nextId = 1;
    var engineReady = false;

    mount.classList.add('cv');
    mount.innerHTML =
      '<div class="cv-drop" id="cvDrop" role="button" tabindex="0" aria-label="Add ' + engine.inputLabel + ' files: drag and drop, or press Enter to choose files">' +
        '<div class="cv-drop-ico" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 16V4m0 0L7 9m5-5l5 5" stroke-linecap="round" stroke-linejoin="round"/><path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" stroke-linecap="round"/></svg></div>' +
        '<h2 class="cv-drop-title">Drop ' + engine.inputLabel + ' files here</h2>' +
        '<p class="cv-drop-sub">or choose files from your device</p>' +
        '<button type="button" class="btn btn-lg" id="cvPick">Choose files</button>' +
        '<p class="cv-drop-formats">Supported: ' + engine.accept.map(function (e) { return '.' + e; }).join(', ') + ' &middot; converts to ' + engine.outputLabel + '</p>' +
        '<input type="file" id="cvInput" accept="' + engine.accept.map(function (e) { return '.' + e; }).concat(engine.acceptMime || []).join(',') + '" multiple hidden>' +
      '</div>' +
      '<div class="cv-privacy"><span aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 3l7 3v5c0 4.5-3 8.2-7 9-4-.8-7-4.5-7-9V6l7-3z" stroke-linejoin="round"/><path d="M9 12l2 2 4-4" stroke-linecap="round" stroke-linejoin="round"/></svg></span> 100% private — files are converted on this device and never uploaded.</div>' +
      '<p class="cv-notice" id="cvBeta" style="margin-top:10px"><strong>Beta.</strong> This converter runs a ~25&nbsp;MB engine that downloads once on first use. Large files can be slow in the browser.</p>' +
      optionsBarHtml() +
      '<ul class="cv-list" id="cvList" aria-live="polite"></ul>' +
      '<div id="cvActions" hidden style="display:flex;gap:12px;flex-wrap:wrap;margin-top:16px">' +
        '<button type="button" class="btn btn-gold btn-lg" id="cvConvert">Convert</button>' +
        '<button type="button" class="btn btn-ghost" id="cvDownloadAll" hidden>Download all (ZIP)</button>' +
        '<button type="button" class="btn btn-ghost" id="cvClear">Clear all</button>' +
        '<span id="cvStatus" class="cv-count" role="status"></span>' +
      '</div>';

    function optionsBarHtml() {
      if (!engine.options || !engine.options.length) return '';
      var fields = engine.options.map(function (o) {
        if (o.type === 'select') {
          return '<label class="cv-field-row">' + RC.escapeHtml(o.label) +
            ' <select data-opt="' + o.id + '">' + o.choices.map(function (c) {
              return '<option value="' + c.v + '"' + (c.v === o.default ? ' selected' : '') + '>' + RC.escapeHtml(c.label) + '</option>';
            }).join('') + '</select></label>';
        }
        if (o.type === 'range') {
          return '<label class="cv-field-row">' + RC.escapeHtml(o.label) +
            ' <input type="range" data-opt="' + o.id + '" min="' + o.min + '" max="' + o.max + '" step="' + (o.step||1) + '" value="' + o.default + '">' +
            ' <span data-optval="' + o.id + '">' + o.default + (o.unit||'') + '</span></label>';
        }
        return '';
      }).join('');
      return '<div class="cv-opt" id="cvOptions" style="display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin:16px 0 4px">' + fields + '</div>';
    }

    var drop = mount.querySelector('#cvDrop'),
        input = mount.querySelector('#cvInput'),
        listEl = mount.querySelector('#cvList'),
        actions = mount.querySelector('#cvActions'),
        convertBtn = mount.querySelector('#cvConvert'),
        downloadAllBtn = mount.querySelector('#cvDownloadAll'),
        clearBtn = mount.querySelector('#cvClear'),
        statusEl = mount.querySelector('#cvStatus');
    mount.querySelector('#cvPick').addEventListener('click', function (e) { e.stopPropagation(); input.click(); });

    mount.querySelectorAll('[data-opt]').forEach(function (ctrl) {
      ctrl.addEventListener('input', function () {
        settings[ctrl.dataset.opt] = ctrl.value;
        var out = mount.querySelector('[data-optval="' + ctrl.dataset.opt + '"]');
        if (out) { var o = (engine.options||[]).filter(function(x){return x.id===ctrl.dataset.opt;})[0]; out.textContent = ctrl.value + ((o&&o.unit)||''); }
      });
    });

    function matchesExt(name) { var e = RC.extOf(name); return engine.accept.indexOf(e) !== -1; }

    function addFiles(files) {
      files.forEach(function (file) {
        if (items.length >= MAX_FILES) return;
        if (!matchesExt(file.name)) { return; }
        if (file.size > MAX_BYTES) { alert('“' + file.name + '” is larger than the ' + RC.humanSize(MAX_BYTES) + ' free limit and was skipped.'); return; }
        items.push({ id: nextId++, file: file, status: 'ready', blob: null, url: null, error: null, progress: 0, el: null });
      });
      render();
    }

    function render() {
      listEl.innerHTML = '';
      items.forEach(function (it) {
        var li = document.createElement('li'); li.className = 'cv-row'; it.el = li;
        li.innerHTML =
          '<div class="cv-info" style="flex:1;min-width:0">' +
            '<div class="cv-name" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + RC.escapeHtml(it.file.name) + '</div>' +
            '<div class="cv-prog" style="margin-top:6px"><div class="cv-prog-bar" style="width:' + Math.round(it.progress*100) + '%"></div></div>' +
            '<div class="cv-state" style="font-size:.85em;opacity:.8">' + stateLabel(it) + '</div>' +
          '</div>' +
          '<div class="cv-row-actions" style="display:flex;gap:6px;align-items:center">' +
            (it.status==='done' ? '<a class="btn btn-gold btn-sm" href="' + it.url + '" download="' + RC.escapeHtml(outName(it)) + '">Download</a>' : '') +
            '<button type="button" class="btn btn-sm btn-ghost" data-act="rm" aria-label="Remove">&times;</button>' +
          '</div>';
        li.querySelector('[data-act="rm"]').addEventListener('click', function () {
          if (it.url) URL.revokeObjectURL(it.url);
          items = items.filter(function (x) { return x !== it; }); render();
        });
        listEl.appendChild(li);
      });
      actions.hidden = items.length === 0;
      var doneCount = items.filter(function (i) { return i.status === 'done'; }).length;
      downloadAllBtn.hidden = doneCount < 2;
      statusEl.textContent = items.length ? (items.length + ' file' + (items.length>1?'s':'')) : '';
    }

    function stateLabel(it) {
      if (it.status === 'ready') return 'Ready';
      if (it.status === 'converting') return 'Converting… ' + Math.round(it.progress*100) + '%';
      if (it.status === 'done') return 'Done · ' + RC.humanSize(it.blob.size);
      if (it.status === 'error') return (it.error || 'Failed');
      return '';
    }
    function updateRow(it) {
      if (!it.el) return;
      var bar = it.el.querySelector('.cv-prog-bar'); if (bar) bar.style.width = Math.round(it.progress*100) + '%';
      var st = it.el.querySelector('.cv-state'); if (st) st.textContent = stateLabel(it);
    }

    function outName(it) {
      var base = RC.baseName(it.file.name);
      return engine.outName ? engine.outName(base, settings) : (base + '.' + engine.outputExt);
    }

    RC.setupDropzone(drop, addFiles, { inputEl: input });
    clearBtn.addEventListener('click', function () { items.forEach(function (i) { if (i.url) URL.revokeObjectURL(i.url); }); items = []; render(); });

    downloadAllBtn.addEventListener('click', function () {
      var files = items.filter(function (i) { return i.status === 'done'; }).map(function (i) { return { name: outName(i), blob: i.blob }; });
      if (files.length) RC.zipAndDownload(files, 'reidconvert-' + RC.todayStr() + '.zip');
    });

    function convertOne(it) {
      it.status = 'converting'; it.progress = 0; updateRow(it);
      _activeProgress = function (r) { it.progress = r; updateRow(it); };
      var inName = 'in_' + it.id + '.' + RC.extOf(it.file.name);
      var outFile = 'out_' + it.id + '.' + engine.outputExt;
      return ensureFFmpeg(function () { statusEl.textContent = 'Loading engine (first time only)…'; })
        .then(function (ff) {
          statusEl.textContent = 'Converting…';
          return RC._ffmpegFetchFile(it.file).then(function (data) {
            ff.FS('writeFile', inName, data);
            var args = engine.buildArgs(settings, inName, outFile);
            return ff.run.apply(ff, args).then(function () {
              var out = ff.FS('readFile', outFile);
              var blob = new Blob([out.buffer], { type: engine.outputMime });
              try { ff.FS('unlink', inName); ff.FS('unlink', outFile); } catch (e) {}
              it.blob = blob; it.url = URL.createObjectURL(blob); it.status = 'done'; it.progress = 1;
              if (window.RC && RC.usage) RC.usage.record({ tool: engine.key, name: it.file.name, outputFormat: engine.outputLabel, size: it.file.size });
              updateRow(it); render();
            });
          });
        })
        .catch(function (e) {
          it.status = 'error';
          it.error = (e && /memory|abort|OOM/i.test(e.message||'')) ? 'This file was too large for the browser to process. Try a shorter or smaller file.' : ((e && e.message) || 'Conversion failed.');
          updateRow(it);
        })
        .then(function () { _activeProgress = null; });
    }

    convertBtn.addEventListener('click', function () {
      var pending = items.filter(function (i) { return i.status === 'ready' || i.status === 'error'; });
      if (!pending.length) return;
      if (window.RC && RC.usage && !RC.usage.gate(mount)) return;                   // freemium gate (no-op unless enforced + over limit)
      convertBtn.disabled = true;
      var seq = Promise.resolve();
      pending.forEach(function (it) { seq = seq.then(function () { return convertOne(it); }); });
      seq.then(function () { convertBtn.disabled = false; statusEl.textContent = 'Finished.'; render(); });
    });
  };
})();
