import { describe, it, expect } from 'vitest';
import { generateLevel, runLevel, talentsForLevel, Bot, BOTS, seedOf, type BotName } from '../src/index.js';
import { loadRooms, roomMap } from './helpers.js';

const rooms = loadRooms();
const map = roomMap(rooms);
const GAMES = 20;

function rate(n: number, bot: BotName, seed = 1): { win: number; secs: number } {
  const lvl = generateLevel(n, seed, rooms);
  let w = 0;
  let s = 0;
  for (let g = 0; g < GAMES; g++) {
    const r = runLevel(lvl, map, new Bot(BOTS[bot], seedOf(g, 7)), { talents: talentsForLevel(n), attemptSeed: g, autoFire: true });
    if (r.won) w++;
    s += r.seconds;
  }
  return { win: w / GAMES, secs: s / GAMES };
}

/** Bornes larges : le générateur cale chaque niveau (graine + échelle) ; ici on vérifie l'ordre de grandeur. */
describe('§9 bots — fumée', () => {
  it.each([
    [5, 0.5, 1, 0.9],
    [65, 0.2, 1, 0.85],
    [100, 0, 0.8, 0.75],
    [254, 0, 0.95, 0.6],
  ])('niveau %i : moyen ∈ [%f, %f], expert ≥ %f', (n, mLo, mHi, eLo) => {
    const m = rate(n, 'moyen');
    const e = rate(n, 'expert');
    expect(m.win).toBeGreaterThanOrEqual(mLo);
    expect(m.win).toBeLessThanOrEqual(mHi);
    expect(e.win).toBeGreaterThanOrEqual(eLo);
    expect(e.win).toBeGreaterThanOrEqual(m.win);
    expect(e.secs).toBeGreaterThan(30);
    expect(e.secs).toBeLessThan(200);
  });
});
