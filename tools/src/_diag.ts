import { generateLevel, runLevel, talentsForLevel, Bot, BOTS, seedOf } from '../../sim/src/index.js';
import { loadRooms, roomMap } from './content-io.js';
const rooms = loadRooms(); const map = roomMap(rooms);
const n = Number(process.argv[2] ?? 1); const games = Number(process.argv[3] ?? 6);
const rej: Record<string, number> = {};
let started=0, cut=0, sn=0, ab=0, mi=0, pl=0;
for (let g = 0; g < games; g++) {
  const bot = new Bot(BOTS.expert, seedOf(g, 7)); bot.diagnostics = true;
  runLevel(generateLevel(n, 1, rooms, Number(process.env.SCALE ?? 1)), map, bot, { talents: talentsForLevel(n), attemptSeed: g });
  for (const [k, v] of Object.entries(bot.rej)) rej[k] = (rej[k] ?? 0) + v;
  pl+=bot.loops.planned; started+=bot.loops.started; cut+=bot.loops.cut; sn+=bot.loops.snipped; ab+=bot.loops.aborted; mi+=bot.loops.missed;
}
console.log(Object.entries(rej).sort((a,b)=>b[1]-a[1]).map(([k,v])=>`${k}:${(v/games).toFixed(0)}`).join(' '));
console.log({pl,started,cut,sn,ab,mi});
