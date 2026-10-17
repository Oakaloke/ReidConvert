// ReidConvert — Playwright config.
// Runs the static site through a local static server and tests it in Chromium, WebKit
// (Safari engine) and Firefox, at desktop and iPhone viewport sizes.
//
// Usage:
//   npm install
//   npm run test:install      # one-time: download browsers
//   npm test                  # run against the local site
//   BASE_URL=https://reidconvert-preview... npm test   # run against a deployed URL
const { defineConfig, devices } = require('@playwright/test');

const BASE_URL = process.env.BASE_URL || 'http://localhost:8080';

module.exports = defineConfig({
  testDir: './tests',
  timeout: 120000,              // media conversions can be slow in-browser
  expect: { timeout: 15000 },
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure'
  },
  // Only auto-start a server for localhost runs (not when BASE_URL points at a deploy).
  webServer: process.env.BASE_URL ? undefined : {
    command: 'npx --yes http-server -p 8080 -c-1 .',
    url: 'http://localhost:8080',
    reuseExistingServer: true,
    timeout: 30000
  },
  projects: [
    { name: 'chromium-desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox-desktop',  use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit-desktop',   use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-safari',    use: { ...devices['iPhone 13'] } }
  ]
});
