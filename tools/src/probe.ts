/**
 * Sonde rapide : taux de réussite des bots sur quelques niveaux.
 * usage: tsx tools/src/probe.ts 1 7 20 60 ... [--games 40] [--scale 1] [--seeds 1] [--bots moyen,expert]
 * Affiche aussi la part des découpes dans les dégâts infligés (« boucles ») et le taux de réussite des boucles
 * planifiées par le bot (découpes / boucles commencées).
 */
import { generateLevel, runLevel, talentsForLevel, Bot, BOTS, seedOf, levelInfo, type BotName } from '../../sim/src/index.js';
import { loadRooms, roomMap } from './content-io.js';

const args = process.argv.slice(2);
const val = (k: string, d: string) => {
  const i = args.indexOf(`--${k}`);
  return i >= 0 ? args[i + 1] : d;
};
const games = Number(val('games', '40'));
const scale = Number(val('scale', '1'));
const seeds = Number(val('seeds', '1'));
const bots = val('bots', 'novice,moyen,expert').split(',') as BotName[];
const ns = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--'))).map(Number);
const rooms = loadRooms();
const map = roomMap(rooms);
for (const n of ns) {
  const row: string[] = [`n=${n} ${levelInfo(n).kind} D=${levelInfo(n).D.toFixed(2)}`];
  for (const b of bots) {
    let wins = 0, secs = 0, hits = 0, to = 0, cut = 0, shot = 0, other = 0, started = 0, cuts = 0, snipped = 0, planned = 0;
    const t0 = performance.now();
    let total = 0;
    for (let sd = 1; sd <= seeds; sd++) {
      const lvl = generateLevel(n, sd, rooms, scale);
      for (let g = 0; g < games; g++) {
        const bot = new Bot(BOTS[b], seedOf(g, 7));
        const r = runLevel(lvl, map, bot, { talents: talentsForLevel(n), attemptSeed: g });
        total++;
        if (r.won) wins++;
        if (r.timeout) to++;
        secs += r.seconds;
        hits += r.hitsTaken;
        cut += r.dmgBy.cut;
        shot += r.dmgBy.shot;
        other += r.dmgBy.other;
        started += bot.loops.started;
        planned += bot.loops.planned;
        cuts += r.cuts;
        snipped += bot.loops.snipped;
      }
    }
    const ms = (performance.now() - t0) / total;
    const share = cut / Math.max(1, cut + shot + other);
    row.push(
      `${b}=${((100 * wins) / total).toFixed(0)}% (${(secs / total).toFixed(0)}s, ${(hits / total).toFixed(1)} coups${to ? `, ${to} to` : ''}, boucles ${(share * 100).toFixed(0)}%, ${(cuts / total).toFixed(1)} découpes/${(started / total).toFixed(1)} commencées/${(planned / total).toFixed(1)} plans, ${(snipped / total).toFixed(1)} coupées, ${ms.toFixed(0)}ms)`,
    );
  }
  console.log(row.join(' | '));
}
