/**
 * Équilibrage des héros (DECISIONS #74) et de l'équipement (#75) : taux de réussite des bots avec chaque héros
 * sur les niveaux publiés (graine et échelle de content/levels/index.json).
 * usage: tsx tools/src/heroes-probe.ts 5 25 47 65 100 147 [--games 30] [--heroes scout,windMonk,emberSorcerer]
 *        [--bots moyen,expert] [--gear] (équipement attendu au niveau n)
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateLevel, runLevel, talentsForLevel, Bot, BOTS, seedOf, levelInfo, gearStats, expectedGear, type BotName, type HeroId } from '../../sim/src/index.js';
import { ROOT, loadRooms, roomMap } from './content-io.js';

const args = process.argv.slice(2);
const val = (k: string, d: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const games = Number(val('games', '30'));
const heroes = val('heroes', 'scout,windMonk,emberSorcerer').split(',') as HeroId[];
const bots = val('bots', 'moyen,expert').split(',') as BotName[];
const withGear = args.includes('--gear');
const ns = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--'))).map(Number);
const index = JSON.parse(readFileSync(join(ROOT, 'content', 'levels', 'index.json'), 'utf8')) as Record<string, { seed: number; budgetScale: number }>;
const rooms = loadRooms();
const map = roomMap(rooms);
const tot: Record<string, { w: number; n: number }> = {};
for (const n of ns) {
  const e = index[n] ?? { seed: 1, budgetScale: 1 };
  const lvl = generateLevel(n, e.seed, rooms, e.budgetScale);
  const info = levelInfo(n);
  const row: string[] = [`n=${String(n).padStart(3)} ${info.kind.padEnd(8)}`];
  for (const h of heroes) {
    for (const b of bots) {
      let wins = 0, secs = 0, sig = 0, cut = 0, all = 0;
      for (let g = 0; g < games; g++) {
        const bot = new Bot(BOTS[b], seedOf(g, 7));
        const r = runLevel(lvl, map, bot, { talents: talentsForLevel(n), attemptSeed: g, heroId: h, gear: withGear ? gearStats(expectedGear(n)) : undefined });
        if (r.won) wins++;
        secs += r.seconds;
        sig += r.dmgBy.sig;
        cut += r.dmgBy.cut;
        all += r.dmgBy.cut + r.dmgBy.shot + r.dmgBy.other + r.dmgBy.sig;
      }
      const k = `${h}/${b}`;
      tot[k] ??= { w: 0, n: 0 };
      tot[k].w += wins;
      tot[k].n += games;
      const share = Math.round((100 * (h === 'scout' ? cut : sig)) / Math.max(1, all));
      row.push(`${h.slice(0, 5)}/${b[0]} ${String(Math.round((100 * wins) / games)).padStart(3)}% ${Math.round(secs / games)}s sig${share}%`);
    }
  }
  console.log(row.join(' | '));
}
console.log('moyennes : ' + Object.entries(tot).map(([k, v]) => `${k} ${Math.round((100 * v.w) / v.n)}%`).join(' · '));
