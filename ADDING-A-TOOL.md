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
below — it already wires in the shared header, footer, styles, and helpers.

Each page is responsible only for its own conversion logic. Reuse the shared
helpers on `window.RC`:

| Helper | Purpose |
|--------|---------|
| `RC.setupDropzone(zoneEl, onFiles, {inputEl})` | drag-&-drop + click + keyboard + file input |
| `RC.humanSize(bytes)` | "1.2 MB" |
| `RC.baseName(name)` / `RC.extOf(name)` | filename helpers |
| `RC.downloadBlob(blob, filename)` | trigger a download |
| `RC.zipAndDownload(files, zipName)` | `files = [{name, blob}]` → ZIP download |
| `RC.todayStr()` | `YYYY-MM-DD` (for ZIP names) |
| `RC.escapeHtml(str)` | safe HTML text |

For the actual conversion, load any CDN library you need (e.g. `heic2any` for
HEIC, `jsPDF` for PDF) with a `defer` script tag, then draw/encode via the
`<canvas>` API. The `/heic-to-jpg/index.html` page is the reference implementation
(batch list, per-file status, quality slider, progress bar, ZIP, reset).

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
<!-- TODO: add any conversion library, e.g.
<script defer src="https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js"></script> -->
<script defer src="/assets/js/tools.js"></script>
<script defer src="/assets/js/common.js"></script>
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
      <div class="dropzone" id="dropzone" role="button" tabindex="0" aria-label="Add files">
        <div class="ico" aria-hidden="true">📄</div>
        <h2>Drag &amp; drop your files</h2>
        <p>or choose files from your device</p>
        <button type="button" class="btn" id="pickBtn">Choose files</button>
        <input type="file" id="fileInput" accept="TODO" multiple hidden>
      </div>
      <!-- TODO: options panel, file list, progress, download buttons
           (copy the structure from /heic-to-jpg/index.html) -->
    </div>
  </section>
</main>

<footer id="site-footer"></footer>

<script>
(function () {
  function ready(fn){ if(document.readyState!=='loading') fn(); else document.addEventListener('DOMContentLoaded', fn); }
  ready(function () {
    var RC = window.RC;
    var dropzone = document.getElementById('dropzone');
    var fileInput = document.getElementById('fileInput');
    document.getElementById('pickBtn').addEventListener('click', function(e){ e.stopPropagation(); fileInput.click(); });

    function onFiles(files) {
      // TODO: validate, convert each file, render results, offer downloads.
    }
    RC.setupDropzone(dropzone, onFiles, { inputEl: fileInput });
  });
})();
</script>
</body>
</html>
```
