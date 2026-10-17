# ReidConvert — Build Report

**Branch:** `feature/top-20-converters` · **Date:** 16 October 2026 · **Built by:** Claude (autonomous run)

## TL;DR
- **16 new converters built** on top of the 2 that were already live → **18 working converters**;
  the 3 hardest (Word/PowerPoint/EPUB → PDF) are listed as **Coming soon** with a documented
  approach rather than shipped broken.
- A complete **accounts system** (Supabase) and **Stripe-ready** scaffolding are in place, shipped
  **dark** behind two flags so nothing changes for visitors until you switch it on.
- Everything stays true to **D1 (privacy):** every converter runs 100% in the browser; no server
  receives user files. No DNS/domain/billing was touched.
- **Important honesty note:** this build environment has **no browser**, so I could not run the
  Playwright/Lighthouse "triple check" or exercise the ffmpeg.wasm engines for real. I did not mark
  anything "passed" that I did not actually run. The audio/video + RAW tools therefore ship as
  **Beta (unverified in-browser)**, and I did **not** deploy to production — the work is on the
  branch for you to test and merge. See **"What I could and couldn't verify"** and **"Your next
  steps."**

---

## 1. All tools

Legend — Status: **Live** (built + static checks pass) · **Beta** (built; needs real-browser
verification) · **Soon** (not built; approach documented). Checks: **S** = static (syntax / inline-JS
parse / registry+sitemap integrity) — *run and passing in this environment*; **B** = browser
(Playwright 3-engine) and **L** = Lighthouse — *scaffolded, NOT run here (run locally — see §5)*.

| # | Tool | URL | Engine | Status | S | B / L |
|---|------|-----|--------|--------|---|-------|
| 1 | HEIC → JPG | `/heic-to-jpg/` | convert-core + heic2any (existing) | Live | ✓ | run locally |
| 2 | PDF → Word | `/pdf-to-word/` | doc-core + pdf.js + tesseract + docx (existing) | Live | ✓ | run locally |
| 3 | PDF → JPG | `/pdf-to-jpg/` | doc-core + pdf.js | Live | ✓ | run locally |
| 4 | PNG → JPG | `/png-to-jpg/` | convert-core (canvas) | Live | ✓ | run locally |
| 5 | JPG → PNG | `/jpg-to-png/` | convert-core (canvas) | Live | ✓ | run locally |
| 6 | WEBP → JPG | `/webp-to-jpg/` | convert-core (canvas) | Live | ✓ | run locally |
| 7 | Image → WEBP | `/image-to-webp/` | convert-core (canvas) | Live | ✓ | run locally |
| 8 | Compress Image | `/compress-image/` | convert-core (canvas, JPEG re-encode) | Live | ✓ | run locally |
| 9 | JPG → PDF | `/jpg-to-pdf/` | pdf-lib (bespoke, N→1) | Live | ✓ | run locally |
| 10 | Merge PDF | `/merge-pdf/` | pdf-lib (bespoke) | Live | ✓ | run locally |
| 11 | Split PDF | `/split-pdf/` | pdf-lib (bespoke) | Live | ✓ | run locally |
| 12 | Compress PDF | `/compress-pdf/` | doc-core + pdf.js + pdf-lib (rasterise) | Live | ✓ | run locally |
| 13 | RAW → JPG | `/raw-to-jpg/` | convert-core + embedded-preview extractor | **Beta** | ✓ | run locally |
| 14 | MP4 → MP3 | `/mp4-to-mp3/` | media-core + ffmpeg.wasm | **Beta** | ✓ | run locally |
| 15 | FLAC → MP3 | `/flac-to-mp3/` | media-core + ffmpeg.wasm | **Beta** | ✓ | run locally |
| 16 | MP4 → GIF | `/mp4-to-gif/` | media-core + ffmpeg.wasm (palettegen) | **Beta** | ✓ | run locally |
| 17 | MOV → MP4 | `/mov-to-mp4/` | media-core + ffmpeg.wasm (H.264/AAC) | **Beta** | ✓ | run locally |
| 18 | Compress Video | `/compress-video/` | media-core + ffmpeg.wasm (CRF) | **Beta** | ✓ | run locally |
| 19 | Word → PDF | `/docx-to-pdf/` | *(see §4)* | Soon | — | — |
| 20 | PowerPoint → PDF | `/pptx-to-pdf/` | *(see §4)* | Soon | — | — |
| 21 | EPUB → PDF | `/epub-to-pdf/` | *(see §4)* | Soon | — | — |

The four homepage "Soon" image items are now real: **PNG→JPG, JPG→PNG, WEBP→JPG** (live) and
**JPG→PDF** (live). Their "Soon" labels are gone.

---

## 2. What I could and couldn't verify (read this)

**Verified in this environment (and passing):**
- JavaScript syntax (`node --check`) on every shared module and every bespoke page's inline script.
- **Registry integrity** (`node tools/check-registry.js`): all 18 live/beta tools have a page folder
  + `index.html` + a sitemap entry; 0 errors.
- `sitemap.xml` is well-formed XML; the registry is valid JS.
- Logic review of every engine against the documented library APIs.

**NOT run here (no browser available) — you must run locally before trusting Live/Beta:**
- Playwright across Chromium / WebKit (Safari) / Firefox, desktop + iPhone.
- Lighthouse (Performance / Accessibility / SEO).
- Actual ffmpeg.wasm conversions (the Beta tools). ffmpeg.wasm has real-world quirks (memory on
  large files, the two-pass-in-one GIF palette filter, iOS Safari limits) that only a real browser
  reveals — hence **Beta**.

I deliberately did **not** mark the media/RAW tools "Live", and did **not** deploy to production,
because I could not confirm them. This is the integrity line: Live here means "built + static checks
pass", not "I watched it work in a browser."

---

## 3. Decisions I made on my own (and why)

1. **Reused the existing framework.** Phase 0 recon showed the "shared converter framework" already
   existed (`convert-core.js`, `doc-convert-core.js`, registry, routing). So I built engines + pages,
   not infrastructure — matching the project's one-folder-one-registry-entry model.
2. **New `beta` tool status.** Added to the registry and to grid/nav/footer (Beta badge, working
   link). Lets unverified-but-built tools ship honestly instead of masquerading as Live or hiding.
3. **Static-host reality (D4).** GitHub Pages can't run server code, so the Stripe functions ship as
   deployable **stubs** in `serverless/` + docs. Supabase Auth itself is client-side and works on
   Pages with the public anon key.
4. **Homepage drop-routing kept simple.** The core maps one tool per file extension (first match in
   the registry). Where several tools accept the same type (PNG, JPG, PDF, MP4), the *secondary*
   tools omit `accept` so the primary route is preserved (e.g. a dropped PDF still opens PDF→Word).
   A small "which converter?" chooser is the clean future fix. Unambiguous types (MOV→MOV→MP4,
   FLAC→FLAC→MP3, RAW extensions) do route by drop.
5. **ffmpeg.wasm single-thread 0.11.x.** Chosen specifically because it does **not** need
   `COOP/COEP` cross-origin-isolation headers (which GitHub Pages can't set and which would risk
   breaking Google sign-in / fonts). Loaded lazily from CDN on first use (~25 MB, downloaded once).
6. **Compress PDF = rasterise + re-embed JPEG.** True pdf-lib image re-compression isn't feasible in
   the browser, so each page is re-rendered via pdf.js and embedded as a quality-tuned JPEG. This
   genuinely shrinks scanned/image-heavy PDFs; the trade-off (text stops being selectable) is stated
   plainly on the page and only helps where it should.
7. **Compress Image outputs JPEG.** Biggest, most reliable savings for photos; the page points users
   needing transparency to Image→WEBP.
8. **RAW → JPG = embedded-preview extraction.** Rather than ship a heavy, unverifiable LibRaw WASM
   build, it extracts the full-size JPEG preview that cameras embed (works for CR2/NEF/ARW/DNG/etc.).
   Honest Beta: it doesn't re-develop sensor data, and the page says so.
9. **config.js is committed (not git-ignored).** It holds only the **public** Supabase anon key
   (safe by design, gated by Row Level Security). Real secrets (service-role, Stripe) live only in
   `serverless/.env`, which *is* git-ignored. This satisfies "never commit secret keys" while
   avoiding 404s on a static host.
10. **Did not touch the two existing live tools' code.** HEIC→JPG and PDF→Word are unchanged; their
    URLs are untouched (no redirects needed).

---

## 4. Beta tools & the 3 "Soon" converters

**Beta (built, verify in-browser):** RAW→JPG, MP4→MP3, FLAC→MP3, MP4→GIF, MOV→MP4, Compress Video.
Known caveats: large media files can be slow or hit browser memory limits (friendly errors are
shown); GIF length should be short; RAW needs an embedded preview (most do).

**Soon (not built — honest rationale):** Word→PDF, PowerPoint→PDF, EPUB→PDF. Done to an acceptable
quality purely in-browser with no build step, each is a large project with poor layout fidelity, and
I could not verify them here — so shipping them would mean shipping unverified, low-fidelity tools.
They're represented as "Coming soon" cards. Recommended approach when you want them:
- **Word→PDF:** `mammoth` (DOCX→HTML) → render to PDF. Expect Beta-level fidelity; complex layouts,
  columns and exact fonts won't match Word perfectly.
- **PowerPoint→PDF:** parse PPTX with JSZip + XML, render slides to canvas, assemble with pdf-lib.
  Hardest of the three.
- **EPUB→PDF:** `epub.js` / JSZip to render chapters to HTML → PDF; refuse DRM-protected files with
  a clear message.

---

## 5. How to run the full test suite yourself (one command each)

```bash
cd ~/Sites/ReidConvert
npm install
npm run test:install     # one-time: download the 3 browser engines
npm run test:fixtures    # generate safe local sample files (needs ffmpeg/ImageMagick/python)
npm test                 # Playwright: all pages in Chromium, WebKit, Firefox + iPhone
```
- Static/registry check anytime (no browser): `npm run check`
- Test a deployed URL instead of localhost: `BASE_URL=https://your-preview-url npm test`
- Lighthouse (install separately): `npx lighthouse https://localhost:8080/ --view` (targets:
  Performance ≥ 85, Accessibility ≥ 95, SEO ≥ 95).

The suite loads every converter + key page, asserts the shared header/footer/workspace render with
**no uncaught console errors**, verifies the homepage grid + PNG drop-routing, and does a real
**PNG→JPG** conversion validated by JPEG magic bytes. Extend `tests/smoke.spec.js` with a per-tool
functional fixture as you confirm each engine.

---

## 6. Your next steps

### A. Review & deploy (I did NOT deploy)
Everything is committed to `feature/top-20-converters`. Nothing is on production. To go live:
```bash
git checkout main
git merge feature/top-20-converters
git push                # GitHub Pages auto-deploys reidconvert.com
```
Recommended first: push the branch and open it as a preview, run `npm test`, and spot-check the Beta
media tools in Safari + Chrome before merging. Roll back by reverting the merge commit if needed.

### B. Turn on accounts (optional, when ready)
1. Follow `docs/SUPABASE_SETUP.md` (create project, paste URL + anon key into `assets/js/config.js`,
   run the SQL for `profiles` + RLS + `conversion_history`, enable Google provider).
2. Set `AUTH_ENABLED: true` in `assets/js/config.js`.
3. **Wiring the login link site-wide:** the auth pages already load `config.js` + `auth.js`; the
   homepage does too. To show the header "Log in / Account" item on *every* page, add these two lines
   to the shared `<head>` script block of each converter page (or tell me and I'll retrofit all of
   them in one pass):
   ```html
   <script defer src="/assets/js/config.js"></script>
   <script defer src="/assets/js/auth.js"></script>
   ```

### C. Turn on Membership billing (optional, later)
1. Follow `docs/STRIPE_SETUP.md`: create the monthly price, deploy the three `serverless/` functions
   to a serverless host (Supabase Edge / Netlify / Vercel / Cloudflare), set the env vars from
   `.env.example`, register the webhook.
2. Flip `MEMBERSHIP_ENFORCED: true` in `assets/js/config.js`. That single flag switches on Free vs
   Member enforcement (`assets/js/limits.js`); until then everyone is Free-but-generous and nothing
   locks.

### D. Env vars to set on the serverless host (never commit)
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`STRIPE_PRICE_ID`, `STRIPE_SUCCESS_URL`, `STRIPE_CANCEL_URL` (see `.env.example`).

---

## 7. New files (high level)
- **Converters:** 16 new `/<tool>/index.html` pages.
- **Shared engine:** `assets/js/media-core.js` (audio/video workspace + ffmpeg.wasm loader).
- **Accounts:** `assets/js/config.js`, `config.example.js`, `auth.js`, `limits.js`; pages
  `/login /signup /forgot-password /account /pricing`.
- **Serverless (stubs):** `serverless/create-checkout-session.js`, `create-portal-session.js`,
  `stripe-webhook.js`, `package.json`.
- **Docs:** `docs/build-plan.md`, `docs/design-tokens.md`, `docs/SUPABASE_SETUP.md`,
  `docs/STRIPE_SETUP.md`, this report.
- **Tests:** `package.json`, `playwright.config.js`, `tests/smoke.spec.js`, `tests/make-fixtures.sh`,
  `tools/check-registry.js`.
- **Edited:** `assets/js/tools.js` (registry), `assets/js/common.js` (beta badge), `index.html`
  (beta cards + routing + badge wording), `sitemap.xml`, `privacy.html`, `.gitignore`, `.env.example`.
