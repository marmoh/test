// Balayage d'échelle de budget : taux moyen/expert, durée, part des boucles. usage: tsx _sweep.ts n1 n2 ... --scales 0.5,0.7,1 --seeds 3 --games 8
import { generateLevel, runLevel, talentsForLevel, Bot, BOTS, seedOf, levelInfo, type BotName } from '../../sim/src/index.js';
import { loadRooms, roomMap } from './content-io.js';
import { bandFor } from './bands.js';
const args = process.argv.slice(2);
const val = (k: string, d: string) => { const i = args.indexOf(`--${k}`); return i >= 0 ? args[i + 1] : d; };
const scales = val('scales', '0.5,0.7,0.85,1').split(',').map(Number);
const seeds = Number(val('seeds', '3'));
const games = Number(val('games', '8'));
const ns = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--'))).map(Number);
const rooms = loadRooms(); const map = roomMap(rooms);
for (const n of ns) {
  const b = bandFor(n);
  const row: string[] = [];
  for (const sc of scales) {
    const res: Record<string, { w: number; t: number; cut: number; tot: number; ms: number }> = {};
    for (const bot of ['moyen', 'expert'] as BotName[]) {
      let w = 0, t = 0, cut = 0, tot = 0;
      const t0 = performance.now();
      for (let sd = 1; sd <= seeds; sd++) {
        const lvl = generateLevel(n, sd, rooms, sc);
        for (let g = 0; g < games; g++) {
          const r = runLevel(lvl, map, new Bot(BOTS[bot], seedOf(g, 7, sd)), { talents: talentsForLevel(n), attemptSeed: seedOf(g, sd) });
          if (r.won) w++;
          t += r.seconds; cut += r.dmgBy.cut; tot += r.dmgBy.cut + r.dmgBy.shot + r.dmgBy.other;
        }
      }
      res[bot] = { w: w / (seeds * games), t: t / (seeds * games), cut, tot, ms: (performance.now() - t0) / (seeds * games) };
    }
    row.push(`×${sc}: m${(res.moyen.w * 100).toFixed(0)}/e${(res.expert.w * 100).toFixed(0)} ${res.moyen.t.toFixed(0)}/${res.expert.t.toFixed(0)}s b${((res.moyen.cut / res.moyen.tot) * 100).toFixed(0)}/${((res.expert.cut / res.expert.tot) * 100).toFixed(0)}% ${res.expert.ms.toFixed(0)}ms`);
  }
  console.log(`n=${n} ${levelInfo(n).kind} [${b.name} m${b.moyen.map((x) => x * 100).join('–')} e≥${b.expert * 100}] ` + row.join(' | '));
}
