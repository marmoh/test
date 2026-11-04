import { generateLevel, runLevel, talentsForLevel, Bot, BOTS, seedOf } from '../../sim/src/index.js';
import { loadRooms, roomMap } from './content-io.js';
const rooms = loadRooms(); const map = roomMap(rooms);
const n = Number(process.argv[2] ?? 1); const g = Number(process.argv[3] ?? 0); const maxT = Number(process.argv[4] ?? 20);
const bot = new Bot(BOTS.expert, seedOf(g, 7));
let k = 0;
let prev: Record<string, number> = {};
runLevel(generateLevel(n, 1, rooms), map, bot, { talents: talentsForLevel(n), attemptSeed: g, timeLimit: maxT, onStep: (w) => {
  k++;
  const pl = (bot as any).plan;
  for (const ev of w.events) if (ev.e === 'cut' || ev.e === 'snip') console.log(w.t.toFixed(2), JSON.stringify(ev.e === 'cut' ? { cut: ev.hits } : ev));
  if (k % 6) return;
  const h = w.hero.pos;
  const diff = Object.entries(bot.rej).map(([a, b]) => [a, b - (prev[a] ?? 0)] as const).filter(([, b]) => b > 0).map(([a, b]) => `${a}:${b}`).join(' ');
  prev = { ...bot.rej };
  const s = pl ? `plan c=(${pl.cx.toFixed(0)},${pl.cy.toFixed(0)}) r=${pl.r.toFixed(0)} d=${Math.hypot(h.x - pl.cx, h.y - pl.cy).toFixed(0)} circ=${pl.circling} sw=${pl.sw.toFixed(2)} m=${pl.members.length} v=${pl.value.toFixed(0)}` : 'no plan';
  const en = w.enemies.map((e) => `${e.type[0]}${e.state[0]}(${e.pos.x.toFixed(0)},${e.pos.y.toFixed(0)})`).join(' ');
  console.log(w.t.toFixed(2), `h=(${h.x.toFixed(0)},${h.y.toFixed(0)}) th=${w.hero.thread.length} proj=${w.projectiles.filter(p=>!p.fromHero).length}`, s, '|', diff, '|', en);
}});
