import { describe, expect, it } from 'vitest';
import { afterAttempt } from '../../sim/src/formulas.js';
import {
  DRAGON,
  REWARDED_AD,
  addLife,
  adStatus,
  cancelRenewal,
  claimWeeklyGems,
  goldBonus,
  isSubscribed,
  noAds,
  noSubscription,
  recordAd,
  resumeRenewal,
  subscribe,
  subscriptionAt,
  weeklyGemsClaimable,
} from '../src/economy.js';

const DAY = 86_400;
const T0 = Date.UTC(2026, 10, 4, 12) / 1000; // mercredi 4 novembre 2026, 12 h UTC

describe('Ordre du Dragon', () => {
  it('commence par un essai gratuit de 3 jours, une seule fois', () => {
    const s = subscribe(noSubscription(), 'monthly', T0);
    expect(s.inTrial).toBe(true);
    expect(s.expiresAt).toBe(T0 + 3 * DAY);
    expect(isSubscribed(s, T0 + 3 * DAY - 1)).toBe(true);
    // résilié pendant l'essai : actif jusqu'à la fin de l'essai, puis plus rien
    const c = cancelRenewal(s, T0 + DAY);
    expect(isSubscribed(c, T0 + 3 * DAY - 1)).toBe(true);
    expect(isSubscribed(c, T0 + 3 * DAY)).toBe(false);
    // nouvelle souscription : pas de second essai
    const again = subscribe(c, 'yearly', T0 + 10 * DAY);
    expect(again.inTrial).toBe(false);
    expect(again.expiresAt).toBe(Date.UTC(2027, 10, 14, 12) / 1000);
  });

  it('se renouvelle automatiquement et applique le changement de formule au renouvellement', () => {
    let s = subscribe(noSubscription(), 'monthly', T0);
    s = subscribe(s, 'yearly', T0 + DAY); // changement de formule pendant l'essai
    expect(s.plan).toBe('monthly');
    expect(s.nextPlan).toBe('yearly');
    const later = subscriptionAt(s, T0 + 5 * DAY);
    expect(later.plan).toBe('yearly');
    expect(later.inTrial).toBe(false);
    expect(later.expiresAt).toBe(Date.UTC(2027, 10, 7, 12) / 1000);
    expect(isSubscribed(s, T0 + 200 * DAY)).toBe(true);
  });

  it('peut être réactivé avant la fin de la période', () => {
    const s = cancelRenewal(subscribe(noSubscription(), 'monthly', T0), T0);
    expect(resumeRenewal(s, T0 + DAY).autoRenew).toBe(true);
    expect(resumeRenewal(s, T0 + 4 * DAY).autoRenew).toBe(false);
  });

  it('donne 60 gemmes par semaine ISO, à réclamer', () => {
    const s = subscribe(noSubscription(), 'monthly', T0);
    expect(weeklyGemsClaimable(noSubscription(), T0, '2026-W45')).toBe(false);
    const a = claimWeeklyGems(s, T0, '2026-W45');
    expect(a.gems).toBe(DRAGON.weeklyGems);
    expect(claimWeeklyGems(a.sub, T0, '2026-W45').gems).toBe(0);
    expect(claimWeeklyGems(a.sub, T0 + 7 * DAY, '2026-W46').gems).toBe(60);
  });

  it('ajoute 25 % d’or, en plus de Fortune', () => {
    expect(goldBonus(0, true)).toBeCloseTo(0.25);
    expect(goldBonus(4, true)).toBeCloseTo(0.45);
    expect(goldBonus(4, false)).toBeCloseTo(0.2);
  });

  it('vies illimitées : une défaite ne coûte rien', () => {
    expect(afterAttempt({ lives: 1, refillFrom: T0 }, T0, false, true).lives).toBe(1);
  });
});

describe('Publicité récompensée', () => {
  const day = '2026-11-04';
  it('rend une vie sans dépasser 5 ni relancer le compte à rebours', () => {
    expect(addLife({ lives: 0, refillFrom: T0 }, T0 + 60)).toEqual({ lives: 1, refillFrom: T0 });
    expect(addLife({ lives: 4, refillFrom: T0 }, T0 + 60)).toEqual({ lives: 5, refillFrom: T0 + 60 });
    expect(addLife({ lives: 5, refillFrom: T0 }, T0 + 60).lives).toBe(5);
  });

  it('jamais pour les abonnés ni avec les vies pleines', () => {
    expect(adStatus(noAds(), T0, day, { subscribed: true, lives: 0 }).reason).toBe('subscriber');
    expect(adStatus(noAds(), T0, day, { subscribed: false, lives: 5 }).reason).toBe('full');
    expect(adStatus(noAds(), T0, day, { subscribed: false, lives: 0 }).ok).toBe(true);
  });

  it('3 par jour, avec un délai entre deux', () => {
    let ads = noAds();
    let t = T0;
    for (let i = 0; i < REWARDED_AD.perDay; i++) {
      const st = adStatus(ads, t, day, { subscribed: false, lives: 0 });
      expect(st.ok).toBe(true);
      expect(st.left).toBe(REWARDED_AD.perDay - i);
      ads = recordAd(ads, t, day);
      const cd = adStatus(ads, t + 1, day, { subscribed: false, lives: 0 });
      if (i < REWARDED_AD.perDay - 1) {
        expect(cd.reason).toBe('cooldown');
        expect(cd.wait).toBe(REWARDED_AD.cooldown - 1);
      }
      t += REWARDED_AD.cooldown;
    }
    expect(adStatus(ads, t, day, { subscribed: false, lives: 0 }).reason).toBe('daily');
    // le lendemain, le compteur repart
    expect(adStatus(ads, t + DAY, '2026-11-05', { subscribed: false, lives: 0 }).ok).toBe(true);
  });
});
