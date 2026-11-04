import { describe, it, expect } from 'vitest';
import {
  levelInfo,
  baseDifficulty,
  sawMult,
  roomBudget,
  expectedPower,
  waveCap,
  stars,
  goldReward,
  tournamentScore,
  livesAt,
  afterAttempt,
  secondsToNextLife,
  starChestsEarned,
  isoWeek,
  BUDGET,
  LIVES,
} from '../src/index.js';

describe('§7 niveaux', () => {
  it('chapitre, position, royaume, type, salles', () => {
    expect(levelInfo(1)).toMatchObject({ chapter: 1, position: 1, kingdom: 1, kind: 'tutorial', rooms: 2, mult: 0.85, D: 1 });
    expect(levelInfo(3)).toMatchObject({ kind: 'breather', mult: 0.85 });
    expect(levelInfo(7)).toMatchObject({ kind: 'hard', mult: 1.35 });
    expect(levelInfo(14)).toMatchObject({ kind: 'hard', mult: 1.35 });
    expect(levelInfo(20)).toMatchObject({ chapter: 1, position: 20, kind: 'boss', mult: 1.55, rooms: 2 });
    expect(levelInfo(21)).toMatchObject({ chapter: 2, position: 1, kingdom: 1, rooms: 3 });
    expect(levelInfo(61)).toMatchObject({ chapter: 4, kingdom: 2 });
    expect(levelInfo(120)).toMatchObject({ rooms: 3, kind: 'boss', kingdom: 2 });
    expect(levelInfo(121)).toMatchObject({ rooms: 4, chapter: 7, kingdom: 3 });
    expect(levelInfo(300)).toMatchObject({ chapter: 15, position: 20, kingdom: 5, kind: 'boss', rooms: 4 });
    expect(levelInfo(8).kind).toBe('normal');
  });

  it('D(n) = 1 + 0,055 (n − 1)^0,93', () => {
    expect(baseDifficulty(1)).toBe(1);
    expect(baseDifficulty(101)).toBeCloseTo(1 + 0.055 * Math.pow(100, 0.93), 10);
    expect(baseDifficulty(300)).toBeCloseTo(12.034, 2);
    for (let n = 2; n <= 300; n++) expect(baseDifficulty(n)).toBeGreaterThan(baseDifficulty(n - 1));
  });

  it('dents de scie', () => {
    expect([1, 2, 3].map(sawMult)).toEqual([0.85, 0.85, 0.85]);
    expect([4, 6, 8, 13, 15, 19].map(sawMult)).toEqual([1, 1, 1, 1, 1, 1]);
    expect(sawMult(7)).toBe(1.35);
    expect(sawMult(14)).toBe(1.35);
    expect(sawMult(20)).toBe(1.55);
  });

  it('budget : forme SPEC × facteur de salles / P(D) × échelle', () => {
    for (const [D, mult, i, sc, rooms] of [
      [1, 1, 1, 1, 2],
      [3.6, 1.35, 2, 1, 3],
      [12, 1.55, 3, 0.9, 4],
    ] as const) {
      const spec = 6 + 3.2 * D * mult * (0.8 + 0.2 * i);
      expect(roomBudget(D, mult, i, sc, rooms)).toBe(Math.round((BUDGET.byRooms[rooms] * spec * sc) / expectedPower(D)));
    }
    expect(expectedPower(1)).toBe(1);
    // monotone en mult, en indice de salle et en échelle
    expect(roomBudget(5, 1.35, 1, 1, 3)).toBeGreaterThan(roomBudget(5, 1, 1, 1, 3));
    expect(roomBudget(5, 1, 3, 1, 3)).toBeGreaterThan(roomBudget(5, 1, 1, 1, 3));
    expect(roomBudget(5, 1, 1, 1.2, 3)).toBeGreaterThan(roomBudget(5, 1, 1, 1, 3));
    expect(waveCap(1)).toBe(BUDGET.waveCap);
    expect(waveCap(5, 1.35)).toBeGreaterThan(waveCap(5));
  });
});

describe('§8 étoiles, or, vies', () => {
  it('étoiles', () => {
    expect(stars(false, 1)).toBe(0);
    expect(stars(true, 0.01)).toBe(1);
    expect(stars(true, 0.49)).toBe(1);
    expect(stars(true, 0.5)).toBe(2);
    expect(stars(true, 0.79)).toBe(2);
    expect(stars(true, 0.8)).toBe(3);
    expect(stars(true, 1)).toBe(3);
  });

  it('or : 20 + 2n, ×1,5 la première fois à 3 étoiles', () => {
    expect(goldReward(1, false)).toBe(22);
    expect(goldReward(100, false)).toBe(220);
    expect(goldReward(100, true)).toBe(330);
    expect(goldReward(100, false, 0.25)).toBe(275);
    expect(starChestsEarned(39)).toBe(1);
    expect(starChestsEarned(40)).toBe(2);
  });

  it('vies : +1 toutes les 30 min, max 5, défaite = −1', () => {
    const R = LIVES.regenSeconds;
    expect(R).toBe(1800);
    const s0 = { lives: 2, refillFrom: 1000 };
    expect(livesAt(s0, 1000 + R - 1).lives).toBe(2);
    expect(livesAt(s0, 1000 + R)).toEqual({ lives: 3, refillFrom: 1000 + R });
    expect(livesAt(s0, 1000 + 2.5 * R)).toEqual({ lives: 4, refillFrom: 1000 + 2 * R });
    expect(livesAt(s0, 1000 + 10 * R).lives).toBe(5);
    expect(secondsToNextLife(s0, 1000 + 600)).toBe(R - 600);
    expect(secondsToNextLife({ lives: 5, refillFrom: 0 }, 50)).toBeNull();
    // défaite à plein : la recharge démarre maintenant
    expect(afterAttempt({ lives: 5, refillFrom: 0 }, 9000, false)).toEqual({ lives: 4, refillFrom: 9000 });
    // victoire : ne coûte rien ; abonné : vies illimitées
    expect(afterAttempt({ lives: 3, refillFrom: 0 }, 10, true).lives).toBe(3);
    expect(afterAttempt({ lives: 3, refillFrom: 0 }, 10, false, true).lives).toBe(3);
    expect(afterAttempt({ lives: 0, refillFrom: 0 }, 10, false).lives).toBe(0);
  });
});

describe('§10 tournoi', () => {
  it('score = kills×100 + PV×5 + max(0, 240 − s)×40', () => {
    expect(tournamentScore(10, 300, 100)).toBe(1000 + 1500 + 140 * 40);
    expect(tournamentScore(0, 0, 300)).toBe(0);
    expect(tournamentScore(3, 12.4, 239.5)).toBe(300 + 60 + 0 * 40);
  });
  it('semaine ISO', () => {
    expect(isoWeek(new Date(Date.UTC(2026, 0, 1)))).toEqual({ year: 2026, week: 1 });
    expect(isoWeek(new Date(Date.UTC(2021, 0, 3)))).toEqual({ year: 2020, week: 53 });
  });
});
