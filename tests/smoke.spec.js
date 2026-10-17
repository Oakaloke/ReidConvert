// ReidConvert — smoke + functional E2E (Playwright).
//
// Check 2 (end-to-end) + part of Check 1 (real output validation). For every converter and
// key page: it loads, renders the shared header/footer and workspace, and logs NO uncaught
// console errors. A functional PNG→JPG test uploads a generated fixture, captures the real
// download and asserts the bytes are a valid JPEG.
//
// Generate fixtures first:  npm run test:fixtures
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

// Keep in sync with assets/js/tools.js. (A future improvement: parse the registry at runtime.)
const CONVERTER_PAGES = [
  'heic-to-jpg', 'pdf-to-word', 'pdf-to-jpg',
  'png-to-jpg', 'jpg-to-png', 'webp-to-jpg', 'image-to-webp', 'compress-image',
  'jpg-to-pdf', 'merge-pdf', 'split-pdf', 'compress-pdf',
  'raw-to-jpg', 'mp4-to-mp3', 'flac-to-mp3', 'mp4-to-gif', 'mov-to-mp4', 'compress-video'
];
const STATIC_PAGES = ['', 'pricing', 'login', 'signup', 'forgot-password', 'account', 'about.html', 'privacy.html', 'terms.html'];

// Console noise we deliberately ignore (offline CDN during local test, favicons, etc.).
function isIgnorable(msg) {
  const t = msg.text();
  return /favicon|net::ERR_|Failed to load resource|ERR_INTERNET_DISCONNECTED/i.test(t);
}

function collectErrors(page) {
  const errors = [];
  page.on('console', m => { if (m.type() === 'error' && !isIgnorable(m)) errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  return errors;
}

test.describe('page smoke', () => {
  for (const slug of CONVERTER_PAGES) {
    test(`loads /${slug}/`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto(`/${slug}/`, { waitUntil: 'load' });
      await expect(page.locator('h1')).toBeVisible();
      await expect(page.locator('#site-header .brand')).toBeVisible();
      await expect(page.locator('#site-footer')).toContainText('ReidConvert');
      // a workspace (image/doc/media) or a bespoke drop zone is present
      await expect(page.locator('#workspace, .cv-drop')).toHaveCount(1, { timeout: 10000 }).catch(async () => {
        await expect(page.locator('#workspace, .cv-drop').first()).toBeVisible();
      });
      expect(errors, `console errors on /${slug}/:\n${errors.join('\n')}`).toEqual([]);
    });
  }

  for (const slug of STATIC_PAGES) {
    test(`loads /${slug}`, async ({ page }) => {
      const errors = collectErrors(page);
      await page.goto(`/${slug}`, { waitUntil: 'load' });
      await expect(page.locator('h1')).toBeVisible();
      expect(errors, `console errors on /${slug}:\n${errors.join('\n')}`).toEqual([]);
    });
  }
});

test('homepage renders the tool grid', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#toolGrid .tool-card').first()).toBeVisible();
  const count = await page.locator('#toolGrid .tool-card').count();
  expect(count).toBeGreaterThanOrEqual(12);
});

test('PNG→JPG converts and produces a valid JPEG', async ({ page }) => {
  const fixture = path.join(__dirname, 'fixtures', 'photo.png');
  test.skip(!fs.existsSync(fixture), 'run `npm run test:fixtures` to generate fixtures');

  const errors = collectErrors(page);
  await page.goto('/png-to-jpg/');
  await page.setInputFiles('#workspace input[type=file]', fixture);

  // convert-core auto-converts; a Download link appears on the row.
  const dl = page.locator('.cv-row a[download]').first();
  await expect(dl).toBeVisible({ timeout: 30000 });

  const [download] = await Promise.all([ page.waitForEvent('download'), dl.click() ]);
  const out = path.join(__dirname, 'fixtures', '_out.jpg');
  await download.saveAs(out);
  const buf = fs.readFileSync(out);
  // JPEG magic bytes FF D8 FF
  expect(buf[0]).toBe(0xFF); expect(buf[1]).toBe(0xD8); expect(buf[2]).toBe(0xFF);
  expect(buf.length).toBeGreaterThan(200);
  fs.unlinkSync(out);
  expect(errors).toEqual([]);
});

test('homepage drop routing sends a PNG to the PNG→JPG tool', async ({ page }) => {
  const fixture = path.join(__dirname, 'fixtures', 'photo.png');
  test.skip(!fs.existsSync(fixture), 'run `npm run test:fixtures` to generate fixtures');
  await page.goto('/');
  await page.setInputFiles('#heroInput', fixture);
  await page.waitForURL('**/png-to-jpg/**', { timeout: 10000 });
  expect(page.url()).toContain('/png-to-jpg/');
});
