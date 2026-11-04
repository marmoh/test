import { Arena, World, newHero, Bot, BOTS, seedOf, talentsForLevel, type MinionType } from '../../sim/src/index.js';
import { loadRooms } from './content-io.js';
const rooms = loadRooms();
const type = (process.argv[2] ?? 'jelly') as MinionType;
const count = Number(process.argv[3] ?? 3);
const room = rooms.find((r) => r.id === 'room_01')!;
const hero = newHero(talentsForLevel(1));
const ws = [Array.from({ length: count }, (_, i) => ({ type, c: 1 + ((i * 3) % 7), r: 1 + ((i * 2) % 8) }))];
const w = new World({ arena: new Arena(room), D: 1, waves: ws, seed: seedOf(0, 3) }, hero);
const bot = new Bot(BOTS.expert, seedOf(0, 5));
bot.beginRoom();
let k = 0;
while (!w.cleared && !w.dead && w.t < Number(process.argv[4] ?? 8)) {
  const inp = bot.input(w);
  w.step(inp);
  k++;
  for (const ev of w.events) if (ev.e === 'cut' || ev.e === 'snip' || ev.e === 'heroHit') console.log(w.t.toFixed(2), JSON.stringify(ev.e === 'cut' ? { cut: ev.hits } : ev.e === 'heroHit' ? { hit: ev.src } : ev));
  if (k % 3) continue;
  const pl = (bot as any).plan;
  const h = w.hero.pos;
  const s = pl ? `c=(${pl.cx.toFixed(0)},${pl.cy.toFixed(0)}) r=${pl.r.toFixed(0)} d=${Math.hypot(h.x - pl.cx, h.y - pl.cy).toFixed(0)} circ=${pl.circling} sw=${pl.sw.toFixed(2)} m=${pl.members.length}` : 'no plan';
  const en = w.enemies.map((e) => `${e.type[0]}${e.state[0]}(${e.pos.x.toFixed(0)},${e.pos.y.toFixed(0)})`).join(' ');
  console.log(w.t.toFixed(2), (bot as any).dbg, `h=(${h.x.toFixed(0)},${h.y.toFixed(0)}) in=(${inp.mx.toFixed(2)},${inp.my.toFixed(2)},${inp.touching ? 1 : 0}) th=${w.hero.thread.length}`, s, '|', en);
}
