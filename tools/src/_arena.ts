// Salle d'essai : vagues d'un type donné, bot expert ; mesure découpes / part des boucles / durée.
import { Arena, World, newHero, Bot, BOTS, seedOf, talentsForLevel, type MinionType } from '../../sim/src/index.js';
import { loadRooms } from './content-io.js';
const rooms = loadRooms();
const type = (process.argv[2] ?? 'jelly') as MinionType;
const count = Number(process.argv[3] ?? 4);
const waves = Number(process.argv[4] ?? 3);
const games = Number(process.argv[5] ?? 10);
const room = rooms.find((r) => r.id === (process.argv[6] ?? 'room_01'))!;
const src: Record<string, number> = {};
let cutEv = 0, cutHits = 0;
let missed = 0, aborted = 0;
let cuts = 0, t = 0, hits = 0, cut = 0, shot = 0, deaths = 0, started = 0, snipped = 0, planned = 0;
for (let g = 0; g < games; g++) {
  const hero = newHero(talentsForLevel(1));
  const ws = Array.from({ length: waves }, (_, k) => Array.from({ length: count }, (_, i) => ({ type, c: 1 + ((i * 3 + k) % 7), r: 1 + ((i * 2 + k) % 8) })));
  const w = new World({ arena: new Arena(room), D: 1, waves: ws, seed: seedOf(g, 3) }, hero);
  const bot = new Bot(BOTS.expert, seedOf(g, 5));
  bot.beginRoom();
  while (!w.cleared && !w.dead && w.t < 120) {
    w.step(bot.input(w));
    for (const ev of w.events) {
      if (ev.e === 'heroHit') src[ev.src ?? '?'] = (src[ev.src ?? '?'] ?? 0) + 1;
      if (ev.e === 'cut') { cutEv++; cutHits += ev.hits; }
    }
  }
  cuts += hero.cuts; t += w.t; hits += hero.hitsTaken; cut += hero.dmgBy.cut; shot += hero.dmgBy.shot; if (w.dead) deaths++;
  started += bot.loops.started; snipped += bot.loops.snipped; planned += bot.loops.planned; missed += bot.loops.missed; aborted += bot.loops.aborted;
}
console.log(`${type}×${count}×${waves}: ${(t / games).toFixed(1)} s, ${(cuts / games).toFixed(1)} découpes, ${(planned/games).toFixed(1)} plans, ${(started/games).toFixed(1)} orbites, ${(snipped/games).toFixed(1)} coupures, boucles ${((100 * cut) / (cut + shot)).toFixed(0)} %, ${(hits / games).toFixed(1)} coups, ${deaths} morts, ratées ${(missed/games).toFixed(1)} abandons ${(aborted/games).toFixed(1)}; touchés/découpe ${(cutHits / Math.max(1, cutEv)).toFixed(2)}; coups: ${Object.entries(src).map(([k, v]) => k + '=' + (v / games).toFixed(1)).join(' ')}`);
