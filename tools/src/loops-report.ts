/**
 * Part des découpes (« boucles ») dans les dégâts infligés et réussite des boucles des bots, sur des niveaux
 * générés. usage: tsx tools/src/loops-report.ts [n1 n2 …] [--games 16] [--step 10]
 * Sans liste : un niveau sur `step` (1, 11, 21, …). Affiche aussi la durée moyenne et le coût d'une partie.
 */
import { generateLevel, runLevel, talentsForLevel, Bot, BOTS, seedOf, type BotName } from '../../sim/src/index.js';
import { loadRooms, roomMap, loadLevel } from './content-io.js';

const args = process.argv.slice(2);
const val = (k: string, d: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const games = Number(val('games', '16'));
const step = Number(val('step', '10'));
let ns = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--'))).map(Number);
if (!ns.length) ns = Array.from({ length: Math.ceil(300 / step) }, (_, i) => 1 + i * step);
const rooms = loadRooms();
const map = roomMap(rooms);
const tot: Record<string, { cut: number; dmg: number; secs: number; ms: number; n: number; started: number; cuts: number }> = {};
for (const n of ns) {
  const saved = loadLevel(n);
  if (!saved) continue;
  // régénéré depuis (graine, budget) : reflète les changements du générateur avant la revalidation
  const level = generateLevel(n, saved.seed, rooms, saved.budgetScale);
  const row: string[] = [`n=${String(n).padStart(3)} ${level.kind.padEnd(9)}`];
  for (const b of ['moyen', 'expert'] as BotName[]) {
    let cut = 0, dmg = 0, secs = 0, wins = 0, started = 0, cuts = 0;
    const t0 = performance.now();
    for (let g = 0; g < games; g++) {
      const bot = new Bot(BOTS[b], seedOf(g, 41));
      const r = runLevel(level, map, bot, { talents: talentsForLevel(n), attemptSeed: seedOf(g, 42) });
      cut += r.dmgBy.cut;
      dmg += r.dmgBy.cut + r.dmgBy.shot + r.dmgBy.other;
      secs += r.seconds;
      started += bot.loops.started;
      cuts += bot.loops.cut;
      if (r.won) wins++;
    }
    const ms = (performance.now() - t0) / games;
    const t = (tot[b] ??= { cut: 0, dmg: 0, secs: 0, ms: 0, n: 0, started: 0, cuts: 0 });
    t.cut += cut; t.dmg += dmg; t.secs += secs / games; t.ms += ms; t.n++; t.started += started; t.cuts += cuts;
    row.push(`${b} ${((100 * wins) / games).toFixed(0)}% ${(secs / games).toFixed(0)}s boucles ${((100 * cut) / Math.max(1, dmg)).toFixed(0)}% (${(cuts / games).toFixed(1)} découpes / ${(started / games).toFixed(1)} orbites) ${ms.toFixed(0)}ms`);
  }
  console.log(row.join(' | '));
}
for (const [b, t] of Object.entries(tot)) {
  console.log(`${b} : part des boucles ${((100 * t.cut) / t.dmg).toFixed(1)} %, ${(t.cuts / Math.max(1, t.started) * 100).toFixed(0)} découpes pour 100 orbites, durée moyenne ${(t.secs / t.n).toFixed(0)} s, ${(t.ms / t.n).toFixed(0)} ms/partie`);
}
