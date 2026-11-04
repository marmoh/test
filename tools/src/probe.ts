/** Sonde rapide : taux de réussite des bots sur quelques niveaux. usage: tsx tools/src/probe.ts 1 7 20 60 ... [--games 40] */
import { generateLevel, runLevel, talentsForLevel, Bot, BOTS, seedOf, levelInfo, type BotName } from '../../sim/src/index.js';
import { loadRooms, roomMap } from './content-io.js';

const args = process.argv.slice(2);
const gi = args.indexOf('--games');
const games = gi >= 0 ? Number(args[gi + 1]) : 40;
const si = args.indexOf('--scale');
const scale = si >= 0 ? Number(args[si + 1]) : 1;
const ns = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--'))).map(Number);
const rooms = loadRooms();
const map = roomMap(rooms);
for (const n of ns) {
  const lvl = generateLevel(n, 1, rooms, scale);
  const row: string[] = [`n=${n} ${levelInfo(n).kind} D=${lvl.D} budgets=${lvl.rooms.map((r) => r.budget).join('/')}`];
  for (const b of ['novice', 'moyen', 'expert'] as BotName[]) {
    let wins = 0, secs = 0, hits = 0, to = 0;
    const t0 = performance.now();
    for (let g = 0; g < games; g++) {
      const r = runLevel(lvl, map, new Bot(BOTS[b], seedOf(g, 7)), { talents: talentsForLevel(n), attemptSeed: g, autoFire: true });
      if (r.won) wins++;
      if (r.timeout) to++;
      secs += r.seconds; hits += r.hitsTaken;
    }
    const ms = (performance.now() - t0) / games;
    row.push(`${b}=${((100 * wins) / games).toFixed(0)}% (${(secs / games).toFixed(0)}s, ${(hits / games).toFixed(1)} coups${to ? `, ${to} timeouts` : ''}, ${ms.toFixed(0)}ms)`);
  }
  console.log(row.join(' | '));
}
