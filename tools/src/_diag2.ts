import { runLevel, talentsForLevel, Bot, BOTS, seedOf } from '../../sim/src/index.js';
import { loadRooms, roomMap, loadLevel } from './content-io.js';
const map = roomMap(loadRooms());
for (const n of process.argv.slice(2).map(Number)) {
  const rej: Record<string, number> = {}; const G = 8; let cuts = 0;
  for (let g = 0; g < G; g++) {
    const bot = new Bot(BOTS.expert, seedOf(g, 7)); bot.diagnostics = true;
    runLevel(loadLevel(n)!, map, bot, { talents: talentsForLevel(n), attemptSeed: g });
    for (const [k, v] of Object.entries(bot.rej)) if (k.startsWith('end') || k.startsWith('snip')) rej[k] = (rej[k] ?? 0) + v;
    cuts += bot.loops.cut;
  }
  console.log(n, 'cuts', (cuts / G).toFixed(1), Object.entries(rej).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${(v / G).toFixed(1)}`).join(' '));
}
