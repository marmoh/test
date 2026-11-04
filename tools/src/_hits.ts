import { generateLevel, runLevel, talentsForLevel, Bot, BOTS, seedOf } from '../../sim/src/index.js';
import { loadRooms, roomMap } from './content-io.js';
const rooms = loadRooms(); const map = roomMap(rooms);
const n = Number(process.argv[2] ?? 1); const games = Number(process.argv[3] ?? 8);
const by: Record<string, number> = {};
const time: Record<string, number> = {};
for (let g = 0; g < games; g++) {
  const bot = new Bot(BOTS.expert, seedOf(g, 7)) as any;
  runLevel(generateLevel(n, 1, rooms, Number(process.env.SCALE ?? 1)), map, bot, { talents: talentsForLevel(n), attemptSeed: g, onStep: (w) => {
    const pl = bot.plan;
    const mode = !pl ? 'none' : pl.circling ? 'orbit' : pl.stage ? 'stage' : 'approach';
    time[mode] = (time[mode] ?? 0) + 1 / 30;
    for (const ev of w.events) if (ev.e === 'heroHit') { const k = mode + ':' + ev.src; by[k] = (by[k] ?? 0) + 1; }
  }});
}
console.log(Object.entries(time).map(([k, v]) => `${k}=${(v / games).toFixed(1)}s`).join(' '));
console.log(Object.entries(by).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}=${(v / games).toFixed(2)}`).join(' '));
