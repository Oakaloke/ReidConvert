# ReidConvert

A free, private, in-browser image converter — live at **[reidconvert.com](https://reidconvert.com)**.

Convert **HEIC / HEIF, PNG, JPG and WEBP** images to **JPG, PNG or WEBP**. Everything
runs locally in your browser using the HTML canvas (and [heic2any](https://github.com/alexcorvi/heic2any)
for Apple's HEIC format), so **your files never leave your device** — nothing is ever uploaded.

## Features

- Drag &amp; drop or a file picker
- Batch conversion with thumbnails and a progress indicator
- Quality slider for JPG and WEBP output (PNG is lossless)
- Handles HEIC files that contain multiple images
- Individual downloads plus **Download all as ZIP** ([JSZip](https://stuk.github.io/jszip/))
- Mobile-friendly, WCAG AA contrast, no build step — just a single `index.html`

## Tech

Plain HTML/CSS/JS. Dependencies load from CDN (heic2any, JSZip). Hosted on GitHub Pages.
