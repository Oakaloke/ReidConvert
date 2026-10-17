# ReidConvert build plan (top-20 converters + accounts)

## Recon findings (Phase 0)
- **Stack:** static site, no build step — HTML + vanilla JS + CDN libraries. Hosted on
  **GitHub Pages** (`CNAME` → reidconvert.com; remote `git@github.com:Oakaloke/ReidConvert`).
- **Framework already present:** the "shared converter framework" the brief asks for largely
  existed before this build:
  - `assets/js/tools.js` — central registry; drives homepage grid, nav and footer.
  - `assets/js/common.js` — header/footer, drag-drop, size/zip/download/routing helpers.
  - `assets/js/convert-core.js` — `RC.createWorkspace` image workspace (canvas encode, quality,
    resize, background flatten, per-file rows, ZIP, options modal).
  - `assets/js/doc-convert-core.js` — `RC.createDocWorkspace` document workspace (progress bars,
    lazy pdf.js/tesseract/docx, OCR, tier limits in a `TIERS` map).
  - Reference tools: `/heic-to-jpg/` (image) and `/pdf-to-word/` (document).
- **Design system:** already tokenised as CSS variables in `main.css` (see design-tokens.md).

Because the framework existed, the work was mostly **engines + pages + registry entries**, not
infrastructure — matching the project's "one folder + one registry entry" model (ADDING-A-TOOL.md).

## Decisions taken (consistent with the DECISIONS block)
1. **Privacy (D1):** every converter runs fully in-browser; nothing is uploaded. Heavy/complex
   ones ship labelled **Beta** rather than adding a server.
2. **Static hosting (D4):** GitHub Pages cannot run server code, so Stripe functions are shipped
   as deployable **stubs** in `serverless/` + docs, not wired into Pages.
3. **New `beta` tool status** added to the registry + grid/nav/footer so unverified-in-this-
   environment tools are shown honestly (Beta badge, working link) instead of as plain "live".
4. **Homepage drop-routing:** the core resolves one tool per extension (first match). Where
   several tools accept a type (PNG, JPG, PDF, MP4) the secondary tools omit `accept` so the
   primary route is preserved; a future "chooser" is the clean fix. Noted in BUILD_REPORT.md.
5. **Media (ffmpeg.wasm):** single-thread 0.11.x build (no COOP/COEP headers needed → works on
   Pages). Loaded lazily from CDN on first use.

## Waves
1. **Image** (convert-core): PNG→JPG, JPG→PNG, WEBP→JPG, Image→WEBP, Compress Image.
2. **PDF** (doc-core + pdf-lib/pdf.js): PDF→JPG, JPG→PDF, Merge, Split, Compress.
3. **Media** (new media-core + ffmpeg.wasm, Beta): MP4→MP3, FLAC→MP3, MP4→GIF, MOV→MP4,
   Compress Video.
4. **Complex** (Beta / deferred): RAW→JPG (embedded-preview, built); DOCX/PPTX/EPUB→PDF
   (represented as Coming soon — see BUILD_REPORT.md for rationale + approach).
5. **Accounts** (Supabase, Stripe-ready): config/flags, auth.js, limits.js, pages, serverless
   Stripe stubs, docs.
6. **Tests + report.**
