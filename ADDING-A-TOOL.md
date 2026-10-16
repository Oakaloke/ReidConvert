# Adding a new converter

ReidConvert is built so a new tool takes **one new folder + one registry entry**.
The homepage grid, the header "Tools" menu, and the footer links are all generated
from `assets/js/tools.js`, so you never have to touch navigation by hand.

---

## 1. Register the tool

Add one object to the array in **`assets/js/tools.js`**:

```js
{
  key: 'png-to-jpg',          // unique slug — MUST match the folder name
  name: 'PNG to JPG',         // display name
  from: 'PNG',                // source format (used for homepage drop routing)
  to: 'JPG',                  // target format
  url: '/png-to-jpg/',        // clean URL (leading + trailing slash)
  desc: 'Flatten PNG images into smaller, shareable JPG files.',
  category: 'Image',          // grouping label
  status: 'live',             // 'live' or 'soon'
  accept: ['png']             // extensions that route here from the homepage drop
}
```

- `status: 'soon'` shows the tool as a **Coming soon** card with no link — perfect
  for announcing a tool before it's built.
- `accept` lets the homepage hero drop zone send a dropped file to the right tool.

That's all the homepage, nav, and footer need.

## 2. Create the folder + page

Make `/<key>/index.html` (e.g. `png-to-jpg/index.html`). Start from the template
below.

**You do not build the UI.** The entire conversion workspace — drag & drop,
auto-convert, per-file rows (thumbnail, size, format arrow, status), individual +
ZIP downloads, selection + bulk bar, the Options modal (resolution / quality /
metadata / advanced), validation, accessibility and preferences — lives in
`assets/js/convert-core.js` and is shared by every tool. A new page just:

1. Loads `convert-core.js` (after `common.js`) plus any decode library it needs.
2. Provides an **engine object** and mounts it with `RC.createWorkspace(mountEl, engine, opts)`.

```js
RC.createWorkspace(document.getElementById('workspace'), {
  key:        'png-to-jpg',              // matches the folder + registry key
  inputLabel: 'PNG', outputLabel: 'JPG',
  outputExt:  'jpg', outputMime: 'image/jpeg',
  accept:     ['png'],                   // extensions
  acceptMime: ['image/png'],
  sniff:      bytes => bytes[0]===0x89 && bytes[1]===0x50, // magic-byte check (true/false/null)
  decode:     file => loadImage(file).then(img => [img])   // -> Promise<HTMLImageElement[]>
}, { maxFiles: 40 });
```

- `decode` returns one or more decoded `HTMLImageElement`s (multiple for multi-frame
  inputs). The core handles canvas encoding, resize, quality, naming and downloads.
- `sniff` validates real file contents so a renamed file is rejected gracefully.
- For formats the browser decodes natively (PNG/JPG/WEBP), `decode` is just
  `loadImage(file)`. For HEIC, `/heic-to-jpg/index.html` tries the native decoder
  first and falls back to `heic2any` — it is the reference engine.

Low-level helpers on `window.RC` (`humanSize`, `baseName`, `extOf`, `downloadBlob`,
`zipAndDownload`, `todayStr`, `escapeHtml`, `setupDropzone`) remain available if you
ever need to build something bespoke.

## Document converters (PDF → Word, etc.)

Image tools use `convert-core.js` (decode → canvas encode). **Document** tools use the
sibling **`assets/js/doc-convert-core.js`** and `RC.createDocWorkspace(mount, engine, opts)`.
It renders the exact same `.cv-*` workspace (drop zone, toolbar, auto-convert, rows,
selection, downloads, ZIP, options modal) but adds per-file + overall **progress bars**,
lazy on-demand loading of heavy libraries (pdf.js, tesseract.js, docx) and built-in **OCR
worker** management — so the engine just supplies the pipeline:

```js
RC.createDocWorkspace(mount, {
  key: 'pdf-to-word', inputLabel: 'PDF', outputLabel: 'Word',
  outputExt: 'docx', outputMime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  accept: ['pdf'], acceptMime: ['application/pdf'], ocr: true,
  sniff:   bytes => /* magic-byte check */ ,
  analyze: (file, ctx) => Promise.resolve({ pages, thumbUrl }),   // optional row metadata
  convert: (item, ctx) => Promise.resolve([{ name, blob }])        // required: returns output blob(s)
});
```

`ctx` gives the engine everything it needs: `settings`, `tier` (limits), `libs.ensurePdfjs()`
/`ensureDocx()`, `ocrRecognize(canvas, onProgress)` (lazy Tesseract), `dpiScale()`,
`onProgress(frac, label)` and `throwIfAborted()`. See `/pdf-to-word/index.html` for the
reference pipeline (per-page "real text vs OCR" detection, page breaks, friendly errors).

**Future paid tiers:** limits live in the `TIERS` map at the top of `doc-convert-core.js`
(`maxFiles`, `maxBytes`, `maxPagesPerFile`, `concurrency`, `ocrLanguages`, `dpiPresets`).
Add a `pro` object and point `RC.docTier` at it — no pipeline changes needed.

## 3. Add to the sitemap

Add a `<url>` entry for the new page in `sitemap.xml`.

## 4. Flip status to `live`

When the page works, set `status: 'live'` in the registry (if it wasn't already).
Commit and push — GitHub Pages redeploys automatically.

---

## Page template

Save as `/<key>/index.html` and fill in the TODOs:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>TODO Converter — Free &amp; Private | ReidConvert</title>
<meta name="description" content="TODO one-line, keyword-rich description.">
<link rel="canonical" href="https://reidconvert.com/TODO-key/">
<meta name="theme-color" content="#01295D">
<meta property="og:title" content="TODO Converter — Free &amp; Private">
<meta property="og:url" content="https://reidconvert.com/TODO-key/">
<meta property="og:image" content="https://reidconvert.com/assets/img/og.png">
<link rel="icon" href="/assets/img/favicon.ico" sizes="any">
<link rel="icon" type="image/png" sizes="32x32" href="/assets/img/favicon-32.png">
<link rel="apple-touch-icon" href="/assets/img/apple-touch-icon.png">
<link rel="stylesheet" href="/assets/css/main.css">
<!-- TODO: add any decode library you need (HEIC needs heic2any; native formats need none) -->
<script defer src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script>
<script defer src="/assets/js/tools.js"></script>
<script defer src="/assets/js/common.js"></script>
<script defer src="/assets/js/convert-core.js"></script>
</head>
<body>
<header id="site-header"></header>

<main id="main">
  <section class="tool-hero">
    <div class="container">
      <p class="breadcrumb"><a href="/">Home</a> &rsaquo; <a href="/#tools">Tools</a> &rsaquo; TODO</p>
      <h1>TODO Converter</h1>
      <p class="lead">TODO short intro. Free, private, in your browser.</p>
    </div>
  </section>

  <section class="app">
    <div class="container app-wrap">
      <div id="workspace"></div>
    </div>
  </section>

  <!-- TODO: optional SEO prose / FAQ section below (see /heic-to-jpg/index.html) -->
</main>

<footer id="site-footer"></footer>

<script>
(function () {
  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function () {
    var RC = window.RC;
    var mount = document.getElementById('workspace');
    if (!RC || !RC.createWorkspace || !mount) return;

    function loadImage(blob) {
      return new Promise(function (resolve, reject) {
        var url = URL.createObjectURL(blob);
        var img = new Image();
        img.onload = function () { URL.revokeObjectURL(url); resolve(img); };
        img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('Could not read the image.')); };
        img.src = url;
      });
    }

    RC.createWorkspace(mount, {
      key: 'TODO-key', inputLabel: 'TODO', outputLabel: 'JPG',
      outputExt: 'jpg', outputMime: 'image/jpeg',
      accept: ['TODO'], acceptMime: ['TODO/mime'],
      sniff: function (bytes) { return null; },        // TODO: real magic-byte check
      decode: function (file) { return loadImage(file).then(function (img) { return [img]; }); }
    }, { maxFiles: 40 });
  });
})();
</script>
</body>
</html>
```
