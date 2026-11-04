import { describe, it, expect } from 'vitest';
import { generateLevel, runLevel, talentsForLevel, Bot, BOTS, seedOf, Rng } from '../src/index.js';
import { loadRooms, roomMap } from './helpers.js';

const rooms = loadRooms();
const map = roomMap(rooms);

describe('déterminisme', () => {
  it('Rng : même graine ⇒ même suite', () => {
    const a = new Rng(42);
    const b = new Rng(42);
    for (let i = 0; i < 100; i++) expect(a.nextU32()).toBe(b.nextU32());
    expect(new Rng(1).nextU32()).not.toBe(new Rng(2).nextU32());
  });

  it('generateLevel : même graine ⇒ même niveau', () => {
    for (const n of [1, 47, 200]) {
      expect(generateLevel(n, 7, rooms, 1.1)).toEqual(generateLevel(n, 7, rooms, 1.1));
    }
    expect(generateLevel(47, 7, rooms)).not.toEqual(generateLevel(47, 8, rooms));
  });

  it('runLevel : mêmes graines ⇒ RunResult identique', () => {
    for (const n of [5, 65, 100]) {
      const lvl = generateLevel(n, 3, rooms);
      for (const b of ['moyen', 'expert'] as const) {
        const run = () => runLevel(lvl, map, new Bot(BOTS[b], seedOf(11, 7)), { talents: talentsForLevel(n), attemptSeed: 11, autoFire: true });
        const r1 = run();
        const r2 = run();
        expect(r2).toEqual(r1);
        expect(r1.seconds).toBeGreaterThan(5);
      }
    }
  });

  it('runLevel : la graine de tentative change la partie', () => {
    const lvl = generateLevel(65, 3, rooms);
    const r = (g: number) => runLevel(lvl, map, new Bot(BOTS.moyen, seedOf(g, 7)), { talents: talentsForLevel(65), attemptSeed: g });
    const res = [0, 1, 2, 3].map((g) => JSON.stringify(r(g)));
    expect(new Set(res).size).toBeGreaterThan(1);
  });
});
