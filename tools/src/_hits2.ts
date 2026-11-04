import { generateLevel, runLevel, talentsForLevel, Bot, BOTS, seedOf } from '../../sim/src/index.js';
import { loadRooms, roomMap } from './content-io.js';
const rooms = loadRooms(); const map = roomMap(rooms);
const n = Number(process.argv[2] ?? 1); const games = Number(process.argv[3] ?? 4);
for (let g = 0; g < games; g++) {
  const bot = new Bot(BOTS.expert, seedOf(g, 7)) as any;
  runLevel(generateLevel(n, 1, rooms), map, bot, { talents: talentsForLevel(n), attemptSeed: g, onStep: (w) => {
    for (const ev of w.events) if (ev.e === 'heroHit' && ev.ref && 'vel' in (ev.ref as object)) {
      const p = ev.ref as any;
      const age = w.t - p.born;
      const pl = bot.plan;
      const owner = w.enemies.find((e) => e.id === p.ownerId);
      console.log(`t=${w.t.toFixed(2)} age=${age.toFixed(2)} mode=${!pl ? 'none' : pl.circling ? 'orbit' : 'approach'} member=${pl && owner ? pl.members.includes(owner) : '-'} ownerDist=${owner ? Math.hypot(owner.pos.x - w.hero.pos.x, owner.pos.y - w.hero.pos.y).toFixed(0) : '?'} r=${pl ? pl.r.toFixed(0) : '-'} held=${JSON.stringify(bot.held)}`);
    }
  }});
}
