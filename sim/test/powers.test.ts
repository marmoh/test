import { describe, it, expect } from 'vitest';
import { offerPowers, POWERS, POWER_BY_ID, Rng, type PowerId } from '../src/index.js';

describe('§6 offre de pouvoirs', () => {
  it('24 pouvoirs', () => expect(POWERS.length).toBe(24));

  it('3 pouvoirs distincts, déterministes', () => {
    for (let s = 0; s < 500; s++) {
      const o = offerPowers(new Rng(s), {});
      expect(o.length).toBe(3);
      expect(new Set(o).size).toBe(3);
      expect(offerPowers(new Rng(s), {})).toEqual(o);
    }
  });

  it('respecte maxStacks', () => {
    const owned: Partial<Record<PowerId, number>> = {};
    for (const p of POWERS) if (p.maxStacks > 1) owned[p.id] = p.maxStacks;
    owned.ricochet = 1;
    for (let s = 0; s < 500; s++) {
      for (const id of offerPowers(new Rng(s), owned)) expect(owned[id] ?? 0).toBeLessThan(POWER_BY_ID[id].maxStacks);
    }
  });

  it('moins de 3 pouvoirs disponibles : offre réduite, jamais de doublon', () => {
    const owned: Partial<Record<PowerId, number>> = {};
    for (const p of POWERS) owned[p.id] = p.maxStacks;
    owned.damage = 2;
    owned.speed = 1;
    const o = offerPowers(new Rng(3), owned);
    expect(o.sort()).toEqual(['damage', 'speed']);
  });
});
