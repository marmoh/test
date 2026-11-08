/**
 * pnpm levels:validate [--check] [--rerun --games 200]
 *
 * --check : vérifie que les 300 niveaux existent, sont reproductibles à partir de (graine, budget)
 *           et que leurs mesures enregistrées sont dans les bandes ; régénère le rapport. Rapide.
 * --rerun : rejoue les bots sur chaque niveau (lent) et met à jour les mesures.
 * Écrit content/reports/difficulty.html (courbe des 300 niveaux, dents de scie visibles).
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { generateLevel, runLevel, talentsForLevel, gearForLevel, Bot, BOTS, seedOf, levelInfo, LEVEL_COUNT, type LevelDef } from '../../sim/src/index.js';
import { loadRooms, roomMap, loadLevel, saveLevel, writeReport, REPORTS_DIR } from './content-io.js';
import { bandFor, inBand } from './bands.js';

const args = process.argv.slice(2);
const RERUN = args.includes('--rerun');
const gi = args.indexOf('--games');
const GAMES = gi >= 0 ? Number(args[gi + 1]) : 200;

const rooms = loadRooms();
const map = roomMap(rooms);
const errors: string[] = [];
const levels: (LevelDef | null)[] = [];

for (let n = 1; n <= LEVEL_COUNT; n++) {
  const l = loadLevel(n);
  levels.push(l);
  if (!l) {
    errors.push(`niveau ${n} manquant`);
    continue;
  }
  // reproductibilité : le web et iOS régénèrent le niveau depuis (n, graine, budget)
  const again = generateLevel(n, l.seed, rooms, l.budgetScale);
  if (JSON.stringify(again.rooms) !== JSON.stringify(l.rooms)) errors.push(`niveau ${n} : contenu non reproductible depuis sa graine`);
  if (RERUN) {
    const rate = (b: 'moyen' | 'expert', salt: number) => {
      let w = 0;
      for (let g = 0; g < GAMES; g++) if (runLevel(l, map, new Bot(BOTS[b], seedOf(g, salt, 9)), { talents: talentsForLevel(n), gear: gearForLevel(n), attemptSeed: seedOf(g, salt, 5) }).won) w++;
      return w / GAMES;
    };
    const m = rate('moyen', 11);
    const e = rate('expert', 12);
    l.validation = { ...(l.validation ?? { avgSeconds: 0 }), games: GAMES, moyen: Math.round(m * 1000) / 1000, expert: Math.round(e * 1000) / 1000, band: bandFor(n).name, ok: inBand(bandFor(n), m, e) };
    saveLevel(l);
    console.log(`${l.validation.ok ? '✓' : '✗'} ${n} moyen ${(m * 100).toFixed(0)} % expert ${(e * 100).toFixed(0)} %`);
  }
  const v = l.validation;
  if (!v) errors.push(`niveau ${n} : pas de mesure des bots`);
  else if (!inBand(bandFor(n), v.moyen, v.expert)) errors.push(`niveau ${n} hors bande ${bandFor(n).name} : moyen ${(v.moyen * 100).toFixed(0)} %, expert ${(v.expert * 100).toFixed(0)} %`);
}

// équilibrage des pouvoirs (rapport produit par pnpm bots:balance)
const powersPath = join(REPORTS_DIR, 'powers.json');
let powers: { id: string; name: string; rate: number }[] = [];
let powersMedian = 0;
if (existsSync(powersPath)) {
  const p = JSON.parse(readFileSync(powersPath, 'utf8')) as { median: number; powers: { id: string; name: string; rate: number }[] };
  powers = p.powers;
  powersMedian = p.median;
  for (const x of powers) if (x.rate - p.median > 0.12) errors.push(`pouvoir ${x.name} : +${((x.rate - p.median) * 100).toFixed(0)} pts au-dessus de la médiane (max 12)`);
} else errors.push('rapport des pouvoirs absent (pnpm bots:balance)');

writeReport('difficulty.html', report(levels, powers, powersMedian));

if (errors.length) {
  for (const e of errors.slice(0, 40)) console.error(`✗ ${e}`);
  if (errors.length > 40) console.error(`… et ${errors.length - 40} autre(s)`);
  process.exit(1);
}
console.log(`✓ ${LEVEL_COUNT} niveaux validés dans leurs bandes ; rapport content/reports/difficulty.html`);

// ───────────────────────────── rapport HTML ─────────────────────────────

function report(ls: (LevelDef | null)[], pw: { id: string; name: string; rate: number }[], median: number): string {
  const W = 1200;
  const H = 300;
  const PAD = 40;
  const x = (n: number) => PAD + ((n - 1) / (LEVEL_COUNT - 1)) * (W - PAD * 2);
  const y = (r: number) => PAD / 2 + (1 - r) * (H - PAD);
  const maxD = Math.max(...ls.map((l, i) => (l ? l.D * l.mult : levelInfo(i + 1).D)));
  const yD = (d: number) => PAD / 2 + (1 - d / maxD) * (H - PAD);
  const path = (pts: [number, number][]) => pts.map(([a, b], i) => `${i ? 'L' : 'M'}${a.toFixed(1)} ${b.toFixed(1)}`).join(' ');
  const dPts: [number, number][] = [];
  const mPts: [number, number][] = [];
  const ePts: [number, number][] = [];
  let bands = '';
  let marks = '';
  ls.forEach((l, i) => {
    const n = i + 1;
    if (!l) return;
    dPts.push([x(n), yD(l.D * l.mult * l.budgetScale)]);
    if (l.validation) {
      mPts.push([x(n), y(l.validation.moyen)]);
      ePts.push([x(n), y(l.validation.expert)]);
    }
    const b = bandFor(n);
    const w = (W - PAD * 2) / (LEVEL_COUNT - 1);
    bands += `<rect x="${(x(n) - w / 2).toFixed(1)}" y="${y(b.moyen[1]).toFixed(1)}" width="${w.toFixed(2)}" height="${(y(b.moyen[0]) - y(b.moyen[1])).toFixed(1)}" fill="var(--band)"/>`;
    if (l.kind === 'boss') marks += `<circle cx="${x(n).toFixed(1)}" cy="${(H - 8).toFixed(1)}" r="3.5" fill="var(--danger)"/>`;
    if (l.kind === 'hard') marks += `<rect x="${(x(n) - 2.5).toFixed(1)}" y="${(H - 11).toFixed(1)}" width="5" height="5" fill="var(--ink)"/>`;
  });
  const okCount = ls.filter((l, i) => l?.validation && inBand(bandFor(i + 1), l.validation.moyen, l.validation.expert)).length;
  const rows = ls
    .map((l, i) => {
      if (!l) return `<tr><td>${i + 1}</td><td colspan="6">manquant</td></tr>`;
      const v = l.validation;
      const ok = v && inBand(bandFor(i + 1), v.moyen, v.expert);
      return `<tr class="${ok ? '' : 'bad'}"><td>${l.n}</td><td>${l.kind}</td><td>${(l.D * l.mult).toFixed(2)}</td><td>${l.budgetScale.toFixed(2)}</td><td>${v ? (v.moyen * 100).toFixed(0) : '–'} %</td><td>${v ? (v.expert * 100).toFixed(0) : '–'} %</td><td>${v?.avgSeconds ?? '–'} s</td></tr>`;
    })
    .join('');
  const pwRows = pw
    .slice()
    .sort((a, b) => b.rate - a.rate)
    .map((p) => `<tr class="${p.rate - median > 0.12 ? 'bad' : ''}"><td>${p.name}</td><td>${(p.rate * 100).toFixed(1)} %</td><td>${((p.rate - median) * 100 >= 0 ? '+' : '') + ((p.rate - median) * 100).toFixed(1)} pts</td></tr>`)
    .join('');
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Courbe de difficulté</title>
<style>:root{--ink:#1b1418;--paper:#efe3c6;--danger:#d8431f;--jade:#2b8a74;--band:rgba(43,138,116,.14)}body{margin:0;padding:24px max(16px,env(safe-area-inset-left));background:var(--paper);color:var(--ink);font:15px/1.45 Georgia,serif}h1{font-weight:400;margin:0 0 4px}p{margin:4px 0 16px;max-width:70ch}.chart{overflow-x:auto}svg{display:block;min-width:900px}table{border-collapse:collapse;font-variant-numeric:tabular-nums;font-size:13px}td,th{padding:2px 10px;border-bottom:1px solid #cbb68a;text-align:right}th{text-align:right}tr.bad td{color:var(--danger);font-weight:700}.legend span{display:inline-block;margin-right:16px}.sw{display:inline-block;width:18px;height:3px;vertical-align:middle;margin-right:6px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(320px,1fr));gap:24px}</style></head><body>
<h1>Ombrelune · courbe de difficulté</h1>
<p>${okCount} niveaux sur ${LEVEL_COUNT} dans leur bande (§9). Taux de réussite au premier essai des bots, talents attendus au niveau n, tir automatique. Les bandes du bot moyen sont en vert pâle ; ronds vermillon = boss, carrés = niveaux difficiles.</p>
<div class="legend"><span><i class="sw" style="background:var(--ink)"></i>bot moyen</span><span><i class="sw" style="background:var(--jade)"></i>bot expert</span><span><i class="sw" style="background:var(--danger)"></i>difficulté effective D × mult × budget</span></div>
<div class="chart"><svg viewBox="0 0 ${W} ${H}" width="100%">${bands}
<path d="${path(dPts)}" fill="none" stroke="var(--danger)" stroke-width="1.2" opacity=".7"/>
<path d="${path(ePts)}" fill="none" stroke="var(--jade)" stroke-width="1.4"/>
<path d="${path(mPts)}" fill="none" stroke="var(--ink)" stroke-width="1.6"/>
${[0, 0.25, 0.5, 0.75, 1].map((r) => `<text x="4" y="${y(r) + 4}" font-size="11" fill="var(--ink)">${r * 100} %</text>`).join('')}
${[1, 60, 120, 180, 240, 300].map((n) => `<text x="${x(n)}" y="${H - 14}" font-size="11" text-anchor="middle" fill="var(--ink)">${n}</text>`).join('')}
${marks}</svg></div>
<div class="grid"><div><h2>Niveaux</h2><table><tr><th>n</th><th>type</th><th>D×mult</th><th>budget</th><th>moyen</th><th>expert</th><th>durée</th></tr>${rows}</table></div>
<div><h2>Pouvoirs</h2><p>Taux de réussite du bot moyen quand il prend ce pouvoir en premier. Médiane ${(median * 100).toFixed(1)} % ; aucun pouvoir ne doit dépasser +12 pts.</p><table><tr><th>pouvoir</th><th>réussite</th><th>écart</th></tr>${pwRows}</table></div></div>
</body></html>`;
}
