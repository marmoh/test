import { describe, it, expect } from 'vitest';
import { World, Arena, newHero, NO_TALENTS, MAX_ENEMIES, MAX_PROJECTILES, type SpawnSpec } from '../src/index.js';
import { loadRooms } from './helpers.js';

describe('§13 bornes de simulation', () => {
  it(`au plus ${MAX_ENEMIES} ennemis et ${MAX_PROJECTILES} projectiles sous charge`, () => {
    const room = loadRooms()[0];
    const wave: SpawnSpec[] = [];
    for (let i = 0; i < 60; i++) wave.push({ type: (['totem', 'mushroom', 'skeleton', 'jelly'] as const)[i % 4], c: i % 9, r: Math.floor(i / 9) % 9, elite: i % 5 === 0 });
    const hero = newHero(NO_TALENTS, { multishot: 2, diagonals: 1, sideShots: 1, rearShot: 1, attackSpeed: 3 }, true);
    hero.stats.maxHp = hero.hp = 1e9; // invincible : on veut une salle saturée longtemps
    const w = new World({ arena: new Arena(room), D: 12, waves: [wave, wave], seed: 1 }, hero);
    let maxE = 0;
    let maxP = 0;
    for (let i = 0; i < 30 * 40; i++) {
      w.step({ mx: Math.sin(i / 20), my: Math.cos(i / 31), touching: i % 90 < 60 });
      maxE = Math.max(maxE, w.enemies.length);
      maxP = Math.max(maxP, w.projectiles.length);
      expect(w.enemies.length).toBeLessThanOrEqual(MAX_ENEMIES);
      expect(w.projectiles.length).toBeLessThanOrEqual(MAX_PROJECTILES);
    }
    expect(maxE).toBe(MAX_ENEMIES);
    expect(maxP).toBeGreaterThan(MAX_PROJECTILES * 0.6); // salle réellement saturée
  });
});
