// pnpm art:atlas — rastérise personnages, icônes, décors des 5 royaumes, scène et VFX en atlas SpriteKit @2x/@3x
// (ios/Resources/Atlases/*.atlas) et réécrit ios/Resources/Atlases/README.md (liste des atlas, noms, tailles).
// Nécessite le serveur de dev (pnpm web:dev) ou ATLAS_URL.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, rmSync, readdirSync, statSync, existsSync } from 'node:fs';
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
/** Dossiers d'atlas des 5 royaumes (même ordre que KINGDOMS dans art/src/palette.ts). */
const KINGDOM_ATLAS = ['Decor_Forest', 'Decor_Swamp', 'Decor_Desert', 'Decor_Frost', 'Decor_Ash'];
const KINGDOM_NAME = ['Forêt d’Ombrelune', 'Marais des Lucioles', 'Désert d’Ambre', 'Pics de Givre', 'Terres de Cendres'];

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
const pngSize = (dataUrl) => {
  const b = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1, dataUrl.indexOf(',') + 64), 'base64');
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};
/** Écrit un dictionnaire { nom: dataURL } aux deux échelles ; garde la taille en points de chaque image. */
const writeSet = async (dir, fetch) => {
  const sizes = {};
  for (const scale of [2, 3]) {
    const set = await fetch(scale);
    for (const [k, d] of Object.entries(set)) {
      write(dir, `${k}@${scale}x.png`, d);
      if (scale === 2) {
        const [w, h] = pngSize(d);
        sizes[k] = [w / 2, h / 2];
      }
    }
  }
  return sizes;
};

// on ne supprime que les dossiers .atlas (le README est régénéré plus bas)
if (existsSync(OUT)) for (const f of readdirSync(OUT)) if (f.endsWith('.atlas')) rmSync(join(OUT, f), { recursive: true, force: true });

const charRows = {};
for (const [group, names] of Object.entries(chars)) {
  const atlas = `${group[0].toUpperCase()}${group.slice(1)}`;
  const dir = join(OUT, `${atlas}.atlas`);
  charRows[atlas] = [];
  for (const name of names) {
    for (const spec of specsFor(name, group)) {
      for (const scale of [2, 3]) {
        const frames = await page.evaluate(([f, s]) => window.atlasFrames(f, s), [spec, scale]);
        frames.forEach((d, i) => write(dir, `${name}_${spec.tag}_${String(i).padStart(2, '0')}@${scale}x.png`, d));
      }
      charRows[atlas].push(`| \`${name}_${spec.tag}_00…${String(spec.frames - 1).padStart(2, '0')}\` | ${spec.frames} | ${spec.size} × ${spec.size} | ${spec.loop} s |`);
    }
  }
}
const iconSizes = await writeSet(join(OUT, 'Icons.atlas'), (s) => page.evaluate((x) => window.atlasIcons(x), s));
const decorSizes = [];
for (let k = 0; k < 5; k++) decorSizes.push(await writeSet(join(OUT, `${KINGDOM_ATLAS[k]}.atlas`), (s) => page.evaluate(([kk, x]) => window.atlasDecor(kk, x), [k, s])));
const stageSizes = await writeSet(join(OUT, 'Stage.atlas'), (s) => page.evaluate((x) => window.atlasStage(x), s));
const vfxSizes = await writeSet(join(OUT, 'VFX.atlas'), (s) => page.evaluate((x) => window.atlasVfx(x), s));
const vfxInfo = await page.evaluate(() => window.atlasVfxInfo());
await browser.close();

// ───────────────────────────── README ─────────────────────────────
const dirBytes = (d) => readdirSync(d).reduce((a, f) => a + statSync(join(d, f)).size, 0);
const atlases = readdirSync(OUT).filter((f) => f.endsWith('.atlas')).sort();
const mb = (b) => (b / 1048576).toFixed(2);
let total = 0;
const sizeRows = atlases.map((a) => {
  const b = dirBytes(join(OUT, a));
  total += b;
  return `| \`${a}\` | ${readdirSync(join(OUT, a)).length / 2} | ${mb(b)} Mo |`;
});
/** Regroupe les noms « base_00 … base_NN » en une ligne. */
const groupRows = (sizes, note = () => '') => {
  const groups = new Map();
  for (const [k, sz] of Object.entries(sizes)) {
    const m = /^(.*)_(\d\d)$/.exec(k);
    const base = m ? m[1] : k;
    const g = groups.get(base) ?? { n: 0, sz, last: m ? m[2] : null };
    g.n++;
    if (m) g.last = m[2];
    groups.set(base, g);
  }
  return [...groups].map(([base, g]) => `| \`${g.last ? `${base}_00…${g.last}` : base}\` | ${g.n} | ${g.sz[0]} × ${g.sz[1]} | ${note(base)} |`);
};
const decorNote = (b) => ({
  floor_light: 'lumière de l’écran (dégradé), à étirer × 4 sur 396 × 660',
  horizon: 'frise lointaine, posée en haut de l’écran (y = 0)',
  far: 'découpes semées sur le sol (règle `farSpot` de arena-art.ts), miroir si `flip`',
  rock: 'rocher `#` ; la case (44 pt) est centrée, marge 6 pt pour l’ombre portée',
  hedge: 'haie `%` ; même cadrage que les rochers',
  water: 'eau `~` en autotile : suffixe = masque des voisins liquides N 1 · E 2 · S 4 · O 8 ; marge 2 pt',
  lava: 'lave `~` (Cendres) en autotile, même masque que l’eau',
  water_waves: 'crêtes de vagues (calque) sur chaque case d’eau, boucle 5 s (0,5 s / image)',
  lava_waves: 'crêtes et bulles (calque) sur chaque case de lave, boucle 10 s (1 s / image)',
  tuft_a: 'touffe qui ondule au pied des obstacles, boucle 4,8 s ; pied à (14, 22) pt, anchorPoint (0.5, 0.21)',
  tuft_b: 'seconde touffe (fougère en Forêt), même boucle',
  hang: 'découpe suspendue à son fil, balancement 5,7 s ; pivot à (16, 2) pt, anchorPoint (0.5, 0.96)',
  drift: 'grandes découpes qui dérivent (le jeu les déplace et les fait tourner)',
}[b] ?? '');
const stageNote = (b) => ({
  stage_frame: 'cadre de scène (montants, clous, appliques) ; centre transparent = écran 396 × 660 à (26, 26)',
  floor_fibres: 'fibres et plis du papier, tuile transparente raccordable (3 × 3 cases), sur `floor_light`',
  curtain_tile: 'rideau (plis), tuile horizontale et verticale',
  valance_tile: 'lambrequin festonné avec glands dorés, tuile horizontale (haut de l’écran)',
  footlights_tile: 'rampe de scène (planches et lampes), tuile horizontale (bas de l’écran)',
  lamp_flame: 'flamme des appliques du cadre, boucle 0,45 s ; mèche à (6, 11) pt, anchorPoint (0.5, 0.31)',
}[b] ?? '');
const vfxRows = Object.entries(vfxInfo).map(([k, v]) => `| \`${k}_00…${String(v.frames - 1).padStart(2, '0')}\` | ${v.frames} | ${v.w} × ${v.h} | ${v.duration} s${v.loop ? ', boucle' : ''} | ${v.note} |`);

const readme = `# Atlas SpriteKit — Ombrelune

Généré par \`pnpm art:atlas\` (\`tools/art-atlas.mjs\`, page \`?atlas\` du prototype web) à partir des mêmes dessins
vectoriels que le web (\`art/src/*\`). **Ne pas modifier à la main** : relancer la commande (serveur de dev lancé).
Aperçu visuel : \`http://localhost:5173/?atlas=preview&k=0\` (k = 0…4, royaume).

- Chaque image existe en \`@2x\` et \`@3x\` ; les tailles ci-dessous sont en **points** (1 pt = 1 unité de la simulation,
  case d'arène = 44 pt). Chargement : \`SKTextureAtlas(named: "Decor_Forest")\`, texture \`textureNamed("rock_00")\`.
- Nom d'image : \`<pièce>_<NN>\` (NN = numéro d'image ou de variante sur 2 chiffres) ; sans suffixe = image unique.
- Personnages : origine du dessin au centre de l'image, **décalée de 4 pt vers le bas** (le pied est sous le centre) :
  \`anchorPoint = (0.5, 0.5 − 4 / taille)\` (repère SpriteKit, y vers le haut).
- Décor : coordonnées « (x, y) pt » comptées depuis le coin haut-gauche de l'image ; rochers, haies et cases liquides
  sont centrés sur leur case (\`anchorPoint = (0.5, 0.5)\`).
- VFX : effet centré sur l'image (\`anchorPoint = (0.5, 0.5)\`, sauf la porte) ; images régulièrement espacées sur la durée indiquée.
- Total : **${mb(total)} Mo** pour ${atlases.length} atlas (${count} fichiers PNG).

## Atlas
| Atlas | Images (par échelle) | Poids |
|---|---|---|
${sizeRows.join('\n')}

## Personnages (\`Hero.atlas\`, \`Enemies.atlas\`, \`Bosses.atlas\`)
Animations : \`idle\`, \`move\`, \`aim\` (héros), \`cut\` (héros, coup de ciseaux), \`windup\` (anticipation 0→1),
\`charge\`, \`death\` (les épingles sautent), \`breath\` (boss essoufflé = ouverture).
| Images | Nombre | Taille (pt) | Durée |
|---|---|---|---|
${Object.entries(charRows).map(([a, rows]) => `| **${a}** | | | |\n${rows.join('\n')}`).join('\n')}

## Icônes (\`Icons.atlas\`)
\`power_<id>\` (24 pouvoirs) et \`ui_<id>\` (interface), ${Object.values(iconSizes)[0]?.join(' × ')} pt, encre sur transparent.

## Décors des 5 royaumes (\`Decor_<Royaume>.atlas\`)
${KINGDOM_ATLAS.map((a, i) => `\`${a}\` = ${KINGDOM_NAME[i]}`).join(' · ')}.
Les cinq atlas ont les mêmes noms d'images (la lave remplace l'eau dans \`Decor_Ash\`).
Composition d'une salle (dans l'ordre) : \`floor_light\` étirée → \`floor_fibres\` (Stage) en mosaïque → \`horizon\` →
\`far_NN\` semées → cases \`water_MM\` / \`lava_MM\` → \`hedge_NN\` / \`rock_NN\` (variante = case, au choix du jeu) →
chaque image : \`*_waves\`, \`tuft_*\`, \`hang\`, \`drift\` → \`stage_frame\` et flammes \`lamp_flame\` (Stage) → porte (\`portal_*\`, VFX).
| Images | Nombre | Taille (pt) | Usage |
|---|---|---|---|
${groupRows(decorSizes[0], decorNote).join('\n')}
${groupRows(Object.fromEntries(Object.entries(decorSizes[4]).filter(([k]) => k.startsWith('lava'))), decorNote).join('\n')}

## Scène (\`Stage.atlas\`, commune aux royaumes)
| Images | Nombre | Taille (pt) | Usage |
|---|---|---|---|
${groupRows(stageSizes, stageNote).join('\n')}

## Effets (\`VFX.atlas\`)
Le vermillon n'y sert qu'au danger (télégraphes, zones) et au critique.
| Images | Nombre | Taille (pt) | Durée | Effet |
|---|---|---|---|---|
${vfxRows.join('\n')}
`;
writeFileSync(join(OUT, 'README.md'), readme);
console.log(`✓ ${count} images écrites dans ${OUT} (${atlases.length} atlas, ${mb(total)} Mo) · README.md`);
void vfxSizes;
