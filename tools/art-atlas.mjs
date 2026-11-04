// pnpm art:atlas — rastérise personnages et icônes en atlas SpriteKit @2x/@3x (ios/Resources/Atlases/*.atlas).
// Nécessite le serveur de dev (pnpm web:dev) ou ATLAS_URL.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require('/opt/node-tools/node_modules/playwright'); }
const URL = process.env.ATLAS_URL ?? 'http://localhost:5173/?atlas';
const OUT = 'ios/Resources/Atlases';

const chars = {
  hero: ['scout', 'windMonk', 'emberSorcerer'],
  enemies: ['goblin', 'jelly', 'jellySmall', 'bat', 'mushroom', 'wolf', 'skeleton', 'totem', 'mage', 'moth', 'snipper'],
  bosses: ['treant', 'queen', 'scorpion', 'wyvern', 'ashlord'],
};
const specsFor = (name, group) => {
  const size = group === 'bosses' ? 128 : 76;
  const base = [
    { state: 'idle', frames: 8, loop: 2.6 },
    { state: 'move', frames: 8, loop: 0.42 },
  ];
  if (group === 'hero') base.push({ state: 'idle', frames: 4, loop: 0.2, aiming: true, tag: 'aim' });
  if (group !== 'hero' && name !== 'jelly' && name !== 'jellySmall') base.push({ state: 'windup', frames: 6, loop: 0.5 });
  if (['wolf', 'bat', 'scorpion', 'wyvern', 'snipper'].includes(name)) base.push({ state: 'charge', frames: 4, loop: 0.25 });
  if (group !== 'hero') base.push({ state: 'idle', frames: 6, loop: 0.5, dyingFrames: true, tag: 'death' });
  if (group === 'hero') base.push({ state: 'idle', frames: 6, loop: 0.5, cuttingFrames: true, tag: 'cut' });
  if (group === 'bosses') base.push({ state: 'breath', frames: 8, loop: 1.6 });
  return base.map((b) => ({ ...b, name, size, frames: b.frames, tag: b.tag ?? b.state }));
};

const browser = await pw.chromium.launch();
const page = await browser.newPage();
await page.goto(URL);
await page.waitForSelector('body[data-atlas-ready]');
let count = 0;
const write = (dir, file, dataUrl) => {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, file), Buffer.from(dataUrl.split(',')[1], 'base64'));
  count++;
};
rmSync(OUT, { recursive: true, force: true });
for (const [group, names] of Object.entries(chars)) {
  const dir = join(OUT, `${group[0].toUpperCase()}${group.slice(1)}.atlas`);
  for (const name of names) {
    for (const spec of specsFor(name, group)) {
      for (const scale of [2, 3]) {
        const frames = await page.evaluate(([f, s]) => window.atlasFrames(f, s), [spec, scale]);
        frames.forEach((d, i) => write(dir, `${name}_${spec.tag}_${String(i).padStart(2, '0')}@${scale}x.png`, d));
      }
    }
  }
}
for (const scale of [2, 3]) {
  const icons = await page.evaluate((s) => window.atlasIcons(s), scale);
  for (const [k, d] of Object.entries(icons)) write(join(OUT, 'Icons.atlas'), `${k}@${scale}x.png`, d);
}
await browser.close();
console.log(`✓ ${count} images écrites dans ${OUT}`);
