import { describe, it, expect } from 'vitest';
import { generateLevel, runLevel, talentsForLevel, Bot, BOTS, seedOf, type BotName } from '../src/index.js';
import { loadRooms, roomMap, levelIndex } from './helpers.js';

const rooms = loadRooms();
const map = roomMap(rooms);
const GAMES = 20;

function rate(n: number, bot: BotName): { win: number; secs: number } {
  // le niveau tel que calé par le générateur (graine + échelle de budget)
  const { seed, budgetScale } = levelIndex(n);
  const lvl = generateLevel(n, seed, rooms, budgetScale);
  let w = 0;
  let s = 0;
  for (let g = 0; g < GAMES; g++) {
    const r = runLevel(lvl, map, new Bot(BOTS[bot], seedOf(g, 7)), { talents: talentsForLevel(n), attemptSeed: g, autoFire: true });
    if (r.won) w++;
    s += r.seconds;
  }
  return { win: w / GAMES, secs: s / GAMES };
}

/**
 * Bornes larges autour des bandes du §9 (20 parties seulement, et graines de bot différentes de celles du
 * générateur) : on vérifie l'ordre de grandeur sur les niveaux tels qu'ils sont publiés.
 */
describe('§9 bots — fumée', () => {
  it.each([
    [5, 0.6, 1, 0.85],
    [65, 0.3, 1, 0.75],
    [100, 0.1, 0.95, 0.6],
    [254, 0.1, 0.95, 0.6],
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
