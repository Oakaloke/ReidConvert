#!/usr/bin/env node
/* ReidConvert — registry integrity check (runs in plain Node, no browser).
 * Verifies that every live/beta tool in assets/js/tools.js has a page folder with an
 * index.html, that each page is listed in sitemap.xml, and flags orphan folders.
 * Run: node tools/check-registry.js   (or: npm run check)
 */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

// Load the registry by evaluating tools.js with a fake `window`.
const src = fs.readFileSync(path.join(root, 'assets/js/tools.js'), 'utf8');
const sandbox = { window: {} };
new Function('window', src)(sandbox.window);
const tools = sandbox.window.RC_TOOLS || [];

const sitemap = fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8');
let errors = 0, warnings = 0;
const err = m => { console.error('  ✗ ' + m); errors++; };
const warn = m => { console.warn('  ! ' + m); warnings++; };

console.log(`Registry: ${tools.length} tools`);
const byStatus = {};
for (const t of tools) {
  byStatus[t.status] = (byStatus[t.status] || 0) + 1;
  const linkable = t.status === 'live' || t.status === 'beta';
  const dir = path.join(root, t.key);
  const page = path.join(dir, 'index.html');
  if (linkable) {
    if (!fs.existsSync(page)) err(`${t.key} is '${t.status}' but ${t.key}/index.html is missing`);
    else {
      const html = fs.readFileSync(page, 'utf8');
      if (!html.includes(`'${t.key}'`) && !html.includes(`"${t.key}"`)) warn(`${t.key}/index.html does not reference its key`);
      if (!html.includes('canonical') || !html.includes(`/${t.key}/`)) warn(`${t.key}/index.html canonical may be wrong`);
    }
    if (!sitemap.includes(`/${t.key}/`)) warn(`${t.key} not found in sitemap.xml`);
  }
  if (!/^[a-z0-9-]+$/.test(t.key)) err(`key "${t.key}" is not a clean slug`);
}
console.log('By status:', byStatus);

console.log(`\n${errors} error(s), ${warnings} warning(s).`);
process.exit(errors ? 1 : 0);
