# ReidConvert

A free, private, **browser-based file converter** — live at **[reidconvert.com](https://reidconvert.com)**.

Every conversion runs entirely in the visitor's browser (HTML canvas +
[heic2any](https://github.com/alexcorvi/heic2any) for Apple's HEIC format), so
**files are never uploaded** — nothing leaves the device.

The site is built as a multi-tool platform, modelled loosely on the clean,
tool-per-page feel of sites like CloudConvert, with an original design built
around the ReidConvert logo's navy (`#01295D`) and gold (`#C29039`) palette.

## Live tools

| Tool | URL | Status |
|------|-----|--------|
| HEIC → JPG | `/heic-to-jpg/` | ✅ Live |
| PNG → JPG, JPG → PNG, WEBP → JPG, JPG → PDF | — | 🚧 Coming soon |

## Architecture

Static site (GitHub Pages) — HTML, CSS, vanilla JS, CDN libraries only. No build step.

```
/                     homepage (hero drop router + tool grid)
/heic-to-jpg/         first converter
/about.html /contact.html /privacy.html /terms.html
assets/
  css/main.css        shared styles (brand tokens, layout, components)
  js/tools.js         ← single tool registry; drives grid, nav & footer
  js/common.js        header/footer builder + shared helpers
                      (drag & drop, file size, downloads, ZIP, routing)
  img/                logo, favicons, apple-touch-icon, og image
CNAME  robots.txt  sitemap.xml
```

**Adding a converter takes a new folder + one registry entry.** See
[ADDING-A-TOOL.md](ADDING-A-TOOL.md) for the step-by-step and a template.

## Privacy

No uploads, no accounts, no watermarks, no file limits. Third-party libraries
(heic2any, JSZip) load from a CDN and process files locally.

## Local development

```bash
python3 -m http.server 8000   # then open http://localhost:8000
```
