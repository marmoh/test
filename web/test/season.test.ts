import { describe, expect, it } from 'vitest';
import {
  PASS,
  FREE_TRACK,
  PREMIUM_TRACK,
  SKINS,
  seasonAt,
  passFor,
  freshPass,
  pointsForWin,
  tierOf,
  tierProgress,
  addPoints,
  canClaim,
  claim,
  claimAll,
  claimableCount,
  buyPremium,
  passProductId,
  starChest,
  pendingChests,
} from '../src/season.js';

const day = 86_400;

describe('pass de saison', () => {
  it('30 paliers sur chaque piste, apparences seulement en premium et toutes présentes', () => {
    expect(FREE_TRACK).toHaveLength(PASS.tiers);
    expect(PREMIUM_TRACK).toHaveLength(PASS.tiers);
    expect(FREE_TRACK.some((r) => r.kind === 'skin')).toBe(false);
    const skins = PREMIUM_TRACK.filter((r) => r.kind === 'skin').map((r) => r.skin);
    expect(new Set(skins)).toEqual(new Set(Object.keys(SKINS)));
    for (const r of [...FREE_TRACK, ...PREMIUM_TRACK]) expect(r.amount).toBeGreaterThan(0);
  });

  it('saisons de 6 semaines à partir du 2 novembre 2026', () => {
    const s1 = seasonAt(Date.UTC(2026, 10, 4, 12) / 1000);
    expect(s1.season).toBe(1);
    expect(passProductId(s1.season)).toBe('ombrelune.pass.season1');
    expect((s1.end - s1.start) / day).toBe(42);
    expect(seasonAt(s1.end).season).toBe(2);
    expect(seasonAt(s1.end - 1).season).toBe(1);
    expect(seasonAt(PASS.epoch - 10 * day).season).toBe(1);
  });

  it('lunes : +10 par victoire, +10 par étoile nouvelle, 40 par palier, plafond 30', () => {
    expect(pointsForWin(0, 3)).toBe(40);
    expect(pointsForWin(2, 3)).toBe(20);
    expect(pointsForWin(3, 1)).toBe(10);
    expect(tierOf(39)).toBe(0);
    expect(tierOf(40)).toBe(1);
    expect(tierOf(99_999)).toBe(30);
    expect(tierProgress(60)).toBeCloseTo(0.5);
    expect(tierProgress(1200)).toBe(1);
  });

  it('réclamer : palier atteint, une seule fois, premium seulement si acheté', () => {
    let s = addPoints(freshPass(1), 85); // palier 2
    expect(canClaim(s, 'free', 1)).toBe(true);
    expect(canClaim(s, 'free', 3)).toBe(false);
    expect(canClaim(s, 'premium', 1)).toBe(false);
    const r = claim(s, 'free', 2)!;
    expect(r.reward).toEqual(FREE_TRACK[1]);
    s = r.state;
    expect(claim(s, 'free', 2)).toBeNull();
    s = buyPremium(s);
    expect(claimableCount(s)).toBe(3);
    const all = claimAll(s);
    expect(all.rewards).toEqual([FREE_TRACK[0], PREMIUM_TRACK[0], PREMIUM_TRACK[1]]);
    expect(claimableCount(all.state)).toBe(0);
  });

  it('migration : sauvegarde sans pass, abîmée ou d’une autre saison → pass neuf', () => {
    expect(passFor(undefined, 1)).toEqual(freshPass(1));
    expect(passFor({ season: 1, points: 120, premium: true, claimedFree: [1, 1, 2, 99] as number[] }, 1)).toEqual({ season: 1, points: 120, premium: true, claimedFree: [1, 2], claimedPremium: [] });
    expect(passFor({ season: 1, points: 500, premium: true }, 2)).toEqual(freshPass(2));
  });
});

describe('coffres d’étoiles (§8)', () => {
  it('un coffre tous les 20 ★, or + gemmes + 1 bonus qui tourne', () => {
    expect(pendingChests(0, 19)).toEqual([]);
    expect(pendingChests(0, 41)).toEqual([1, 2]);
    expect(pendingChests(2, 41)).toEqual([]);
    expect(starChest(1)).toEqual({ gold: 200, gems: 20, bonus: 'potion' });
    expect(starChest(2).bonus).toBe('scroll');
    expect(starChest(6).bonus).toBe('aegis');
  });
});
