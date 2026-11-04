// Captures du prototype web : node tools/web-shots.mjs <url> <out.png> [width height] [waitMs] [jsAction]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const { chromium } = pw;
const [url, out, w = '430', h = '932', wait = '1500', action = ''] = process.argv.slice(2);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()); });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(url);
await page.waitForTimeout(+wait);
if (action) { await page.evaluate(action); await page.waitForTimeout(1200); }
await page.screenshot({ path: out });
await browser.close();
