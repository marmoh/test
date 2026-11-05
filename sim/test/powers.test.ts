import { describe, it, expect } from 'vitest';
import { offerPowers, POWERS, POWER_BY_ID, Rng, computeStats, NO_TALENTS, THREAD, type PowerId } from '../src/index.js';

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

  it('la première carte est de la famille Fil tant qu’il en reste une à prendre (DECISIONS #71)', () => {
    for (let s = 0; s < 500; s++) expect(POWER_BY_ID[offerPowers(new Rng(s), {})[0]].family).toBe('thread');
    const owned: Partial<Record<PowerId, number>> = {};
    for (const p of POWERS) if (p.family === 'thread') owned[p.id] = p.maxStacks;
    for (let s = 0; s < 200; s++) expect(offerPowers(new Rng(s), owned).length).toBe(3);
  });
});

describe('durée du fil (DECISIONS #71)', () => {
  it('fil court au départ, allongé par « Fil long » et « Encre lente »', () => {
    expect(THREAD.life).toBe(2.2);
    expect(computeStats(NO_TALENTS, {}).threadLife).toBe(1);
    expect(POWER_BY_ID.longThread.maxStacks).toBe(3);
    expect(computeStats(NO_TALENTS, { longThread: 3 }).threadLife).toBeCloseTo(2.2, 12);
    expect(computeStats({ ...NO_TALENTS, ink: 10 }, {}).threadLife).toBeCloseTo(1.6, 12);
    expect(THREAD.life * computeStats({ ...NO_TALENTS, ink: 10 }, { longThread: 3 }).threadLife).toBeCloseTo(7.744, 9);
  });
});
