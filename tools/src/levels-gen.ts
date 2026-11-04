/**
 * pnpm levels:gen [--from 1 --to 300] [--games 200] [--workers 4] [--only 7,20]
 *
 * Pour chaque niveau : cherche une graine dont les bots (moyen, expert) atteignent la bande cible (§9).
 * Évaluation rapide (24 parties) puis confirmation (--games, 200 par défaut). Jusqu'à 200 graines ;
 * à chaque série infructueuse, le budget est ajusté de ±10 % selon le sens de l'écart.
 * Échec persistant → code de sortie 1 (tâche rouge). Écrit content/levels/level_NNNN.json et index.json.
 * --revalidate : rejoue d'abord la graine existante et ne cherche une nouvelle graine que si elle sort de la bande.
 */
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { generateLevel, runLevel, talentsForLevel, Bot, BOTS, seedOf, type LevelDef, type BotName } from '../../sim/src/index.js';
import { loadRooms, roomMap, saveLevel, LEVELS_DIR, loadLevel } from './content-io.js';
import { bandFor, inBand } from './bands.js';

const args = process.argv.slice(2);
const opt = (k: string, d: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const FROM = Number(opt('from', '1'));
const TO = Number(opt('to', '300'));
const GAMES = Number(opt('games', '200'));
const WORKERS = Number(opt('workers', '4'));
const QUICK = 24;
const MAX_SEEDS = 200;
const SEEDS_PER_SCALE = 6;
const ONLY = opt('only', '') ? opt('only', '').split(',').map(Number) : null;
const SKIP_VALID = args.includes('--resume');
const REVALIDATE = args.includes('--revalidate');

const rooms = loadRooms();
const map = roomMap(rooms);

function rate(level: LevelDef, bot: BotName, games: number, salt: number): { r: number; secs: number } {
  let wins = 0;
  let secs = 0;
  for (let g = 0; g < games; g++) {
    const res = runLevel(level, map, new Bot(BOTS[bot], seedOf(g, salt, 7)), { talents: talentsForLevel(level.n), attemptSeed: seedOf(g, salt) });
    if (res.won) wins++;
    secs += res.seconds;
  }
  return { r: wins / games, secs: secs / games };
}

function startScale(n: number): number {
  const prev = loadLevel(n - 1);
  const kind = bandFor(n).name;
  if (kind === 'Difficile') return 1.2;
  if (kind === 'Chapitres 1–2') return 0.95;
  return prev && bandFor(n - 1).name === kind ? prev.budgetScale : 1.0;
}

function solve(n: number): { level: LevelDef | null; tried: number; log: string } {
  const band = bandFor(n);
  // --revalidate : on garde la graine existante si elle reste dans la bande après un changement de règles
  const existing = REVALIDATE ? loadLevel(n) : null;
  if (existing) {
    const level = generateLevel(n, existing.seed, rooms, existing.budgetScale);
    const M = rate(level, 'moyen', GAMES, 3);
    const E = rate(level, 'expert', GAMES, 4);
    if (inBand(band, M.r, E.r)) {
      level.validation = { games: GAMES, moyen: round(M.r), expert: round(E.r), band: band.name, ok: true, avgSeconds: Math.round((M.secs + E.secs) / 2) };
      return { level, tried: 1, log: `conservé scale=${existing.budgetScale} seed=${existing.seed}` };
    }
  }
  let scale = startScale(n);
  let tried = 0;
  let best: { level: LevelDef; dist: number } | null = null;
  while (tried < MAX_SEEDS) {
    let sum = 0;
    let cnt = 0;
    for (let k = 0; k < SEEDS_PER_SCALE && tried < MAX_SEEDS; k++, tried++) {
      const seed = 1 + tried;
      scale = Math.round(scale * 1000) / 1000;
      const level = generateLevel(n, seed, rooms, scale);
      const m = rate(level, 'moyen', QUICK, 1).r;
      sum += m;
      cnt++;
      const mid = (band.moyen[0] + band.moyen[1]) / 2;
      // pré-filtre large (± 1,5 écart-type d'un échantillon de 24 parties)
      if (m < band.moyen[0] - 0.12 || m > band.moyen[1] + 0.12) continue;
      const e = rate(level, 'expert', QUICK, 2).r;
      if (e < band.expert - 0.1) continue;
      // confirmation complète
      const M = rate(level, 'moyen', GAMES, 3);
      const E = rate(level, 'expert', GAMES, 4);
      const dist = Math.abs(M.r - mid);
      if (!best || dist < best.dist) best = { level, dist };
      if (inBand(band, M.r, E.r)) {
        level.validation = { games: GAMES, moyen: round(M.r), expert: round(E.r), band: band.name, ok: true, avgSeconds: Math.round((M.secs + E.secs) / 2) };
        return { level, tried: tried + 1, log: `scale=${scale.toFixed(2)} seed=${seed}` };
      }
    }
    // ajuste le budget de ±10 % selon le sens moyen de l'écart
    const avg = sum / cnt;
    if (avg > band.moyen[1]) scale *= 1.1;
    else if (avg < band.moyen[0]) scale /= 1.1;
    else scale *= tried % 12 === 0 ? 1.04 : 0.96; // dans la bande en moyenne : petit pas pour varier
  }
  return { level: null, tried, log: `meilleur écart ${best?.dist.toFixed(2) ?? '?'}` };
}

function round(x: number): number {
  return Math.round(x * 1000) / 1000;
}

// ───────────────────────────── orchestration ─────────────────────────────

if (args.includes('--worker')) {
  const ns = opt('levels', '').split(',').filter(Boolean).map(Number);
  for (const n of ns) {
    const t0 = Date.now();
    const r = solve(n);
    if (r.level) saveLevel(r.level);
    process.send?.({ n, ok: !!r.level, tried: r.tried, log: r.log, ms: Date.now() - t0, v: r.level?.validation });
  }
  process.exit(0);
} else {
  let ns = ONLY ?? Array.from({ length: TO - FROM + 1 }, (_, i) => FROM + i);
  if (SKIP_VALID) ns = ns.filter((n) => !loadLevel(n)?.validation?.ok);
  const parts: number[][] = Array.from({ length: WORKERS }, () => []);
  ns.forEach((n, i) => parts[i % WORKERS].push(n));
  const failed: number[] = [];
  let done = 0;
  const self = fileURLToPath(import.meta.url);
  await Promise.all(
    parts
      .filter((p) => p.length)
      .map(
        (p) =>
          new Promise<void>((resolve) => {
            const child = fork(self, ['--worker', '--levels', p.join(','), '--games', String(GAMES), ...(REVALIDATE ? ['--revalidate'] : [])], { execArgv: ['--import', 'tsx'] });
            child.on('message', (m: { n: number; ok: boolean; tried: number; log: string; ms: number; v?: { moyen: number; expert: number } }) => {
              done++;
              if (!m.ok) failed.push(m.n);
              console.log(`${m.ok ? '✓' : '✗'} ${String(m.n).padStart(3)}  ${m.ok ? `moyen ${(m.v!.moyen * 100).toFixed(0)} % · expert ${(m.v!.expert * 100).toFixed(0)} %` : 'hors bande'}  (${m.tried} graines, ${m.log}, ${(m.ms / 1000).toFixed(0)} s)  [${done}/${ns.length}]`);
            });
            child.on('exit', () => resolve());
          }),
      ),
  );
  writeIndex();
  if (failed.length) {
    console.error(`✗ ${failed.length} niveau(x) hors bande : ${failed.sort((a, b) => a - b).join(', ')}`);
    process.exit(1);
  }
  console.log(`✓ ${ns.length} niveau(x) générés dans leurs bandes`);
}

/** Index léger lu par le prototype web : graine + facteur de budget par niveau. */
export function writeIndex(): void {
  const index: Record<number, { seed: number; budgetScale: number }> = {};
  for (let n = 1; n <= 300; n++) {
    const p = join(LEVELS_DIR, `level_${String(n).padStart(4, '0')}.json`);
    if (!existsSync(p)) continue;
    const l = JSON.parse(readFileSync(p, 'utf8')) as LevelDef;
    index[n] = { seed: l.seed, budgetScale: l.budgetScale };
  }
  writeFileSync(join(LEVELS_DIR, 'index.json'), JSON.stringify(index) + '\n');
}
