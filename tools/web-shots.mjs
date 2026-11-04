// Captures du prototype web (serveur de dev lancé : pnpm web:dev, ou SHOTS_URL).
//  - pnpm web:shots                → tous les écrans du §12 en 390 × 844 dans docs/screens/ (+ index.md)
//  - pnpm web:shots -- <écran>…    → seulement ces écrans (noms ci-dessous, sans numéro)
//  - node tools/web-shots.mjs <url> <out.png> [width height] [waitMs] [jsAction]   (capture unique, usage historique)
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const { chromium } = pw;
const args = process.argv.slice(2).filter((a) => a !== '--');

if (args[0] && /^(https?|file):/.test(args[0])) {
  const [url, out, w = '430', h = '932', wait = '1500', action = ''] = args;
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1 });
  page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()); });
  page.on('pageerror', (e) => console.log('pageerror:', e.message));
  await page.goto(url);
  await page.waitForTimeout(+wait);
  if (action) { await page.evaluate(action); await page.waitForTimeout(1200); }
  await page.screenshot({ path: out });
  await browser.close();
  process.exit(0);
}

const BASE = process.env.SHOTS_URL ?? 'http://localhost:5173/';
const OUT = 'docs/screens';
const W = 390;
const H = 844;

// Sauvegarde de démonstration : 11 niveaux gagnés, de quoi montrer la carte, les talents, la boutique.
const now = Date.now() / 1000;
const season = Math.max(0, Math.floor((now - Date.UTC(2026, 10, 2) / 1000) / (42 * 86400))) + 1;
const stars = { 1: 3, 2: 3, 3: 2, 4: 3, 5: 3, 6: 1, 7: 2, 8: 3, 9: 3, 10: 2, 11: 3 };
const demoSave = (extra = {}) => ({
  version: 2,
  stars,
  unlocked: 12,
  lives: { lives: 4, refillFrom: now - 600 },
  gems: 340,
  gold: 1450,
  bonuses: { potion: 2, scroll: 0, aegis: 1 },
  heroId: 'scout',
  heroes: ['scout', 'windMonk'],
  talents: { vigor: 3, strength: 2, agility: 1, fortune: 0 },
  starterPack: true,
  chests: 1,
  pass: { season, points: 290, premium: false, claimedFree: [1, 2, 3, 4], claimedPremium: [] },
  skins: [],
  skin: null,
  ...extra,
});

/** [nom, requête, attente (ms), action JS facultative, sauvegarde] — dans l'ordre du §12. */
const SCREENS = [
  ['title', '', 1800, null, null],
  ['map', '?map', 2200, null, demoSave()],
  ['prelevel', '?screen=prelevel&level=12', 2000, null, demoSave()],
  ['combat', '?level=3&play&demo', 6500, null, demoSave()],
  ['powers', '?screen=powers', 2600, null, demoSave()],
  ['victory', '?screen=victory', 3600, null, demoSave()],
  ['defeat', '?screen=defeat', 2600, null, demoSave()],
  ['defeat-no-gems', '?screen=defeat', 2600, null, demoSave({ gems: 20 })],
  ['pause', '?screen=pause', 2400, null, demoSave()],
  ['heroes', '?screen=heroes', 1800, null, demoSave()],
  ['heroes-skins', '?screen=heroes', 1800, "document.querySelector('.sheet-body').scrollTop = 330", demoSave({ skins: ['foxEars', 'paperWings'], skin: 'paperWings' })],
  ['shop', '?screen=shop', 1800, null, demoSave({ starterPack: false })],
  ['shop-spend', '?screen=shop', 1800, "document.querySelector('.sheet-body').scrollTop = 9999", demoSave()],
  ['pass', '?screen=pass', 1800, null, demoSave()],
  ['pass-premium', '?screen=pass', 1800, null, demoSave({ pass: { season, points: 830, premium: true, claimedFree: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], claimedPremium: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] }, skins: ['foxEars'], skin: 'foxEars' })],
  ['tournament', '?screen=tournament', 1800, null, demoSave({ tournament: { week: '', attempts: 5, best: 0 } })],
  ['tournament-board', '?screen=tournament', 1800, "document.querySelector('.sheet-body').scrollTop = 9999", demoSave()],
  ['settings', '?screen=settings', 1800, null, demoSave()],
  ['dragon', '?screen=dragon', 1800, null, demoSave()],
  ['lives', '?screen=lives', 1800, null, demoSave({ lives: { lives: 0, refillFrom: now - 600 }, livesPaywallSeen: true })],
];

const only = new Set(args);
const browser = await chromium.launch();
mkdirSync(OUT, { recursive: true });
let errors = 0;
const shot = async ([name, q, wait, action, data], i) => {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: true });
  if (data) await ctx.addInitScript((d) => localStorage.setItem('ombrelune.save.v1', d), JSON.stringify(data));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => (errors++, console.log(`  ${name} pageerror:`, e.message)));
  page.on('console', (m) => { if (m.type() === 'error' && !/navigator\.vibrate/.test(m.text())) (errors++, console.log(`  ${name} console:`, m.text())); });
  await page.goto(BASE + q);
  await page.waitForTimeout(wait);
  if (action) { await page.evaluate(action); await page.waitForTimeout(500); }
  const file = `${OUT}/${String(i + 1).padStart(2, '0')}-${name}.png`;
  await page.screenshot({ path: file });
  await ctx.close();
  console.log('✓', file);
};
for (let i = 0; i < SCREENS.length; i++) if (!only.size || only.has(SCREENS[i][0])) await shot(SCREENS[i], i);
await browser.close();
if (!only.size) {
  writeFileSync(
    `${OUT}/index.md`,
    `# Captures du prototype web (${W} × ${H})\n\nRégénérées par \`pnpm web:shots\` (serveur de dev lancé). Chaque écran s'ouvre aussi à la main avec \`?screen=<nom>\` (voir \`web/src/main.ts\`).\n\n` +
      SCREENS.map(([name, q], i) => `- \`${String(i + 1).padStart(2, '0')}-${name}.png\` — \`${q || '/'}\``).join('\n') +
      '\n',
  );
}
if (errors) {
  console.log(`✗ ${errors} erreur(s) dans la console`);
  process.exit(1);
}
