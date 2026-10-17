# ReidConvert tests

End-to-end + output-validation tests (Playwright) plus a no-browser registry check.

```bash
npm install
npm run test:install     # one-time: download browser engines
npm run test:fixtures    # generate safe local sample files
npm test                 # all pages × Chromium / WebKit / Firefox / iPhone
npm run check            # registry+sitemap integrity (no browser needed)
```

Run against a deployed URL instead of localhost:
```bash
BASE_URL=https://your-preview-url npm test
```

Fixtures are synthesised locally by `make-fixtures.sh` (nothing copyrighted is downloaded). A real
HEIC and a camera RAW can't be synthesised reliably — drop your own small `sample.heic` /
`sample.dng` into `tests/fixtures/` and note the source + licence. See `../BUILD_REPORT.md` §5.
