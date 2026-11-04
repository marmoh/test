/**
 * §11 Monétisation — logique pure (sans DOM), testée par vitest et reprise telle quelle en Swift
 * (`ios/Services/DragonOrder.swift`, `ios/Services/AdService.swift`).
 *
 * - Ordre du Dragon : abonnement mensuel ou annuel, essai gratuit de 3 jours (une seule fois),
 *   renouvellement automatique simulé, résiliation effective à la fin de la période payée.
 * - Publicité récompensée : uniquement à la demande, +1 vie, 3 par jour, délai entre deux,
 *   jamais pour les abonnés ni quand les vies sont pleines (DECISIONS #30).
 */
import { livesAt, type LivesState } from '../../sim/src/formulas.js';
import { LIVES } from '../../sim/src/constants.js';

const DAY = 86_400;

// ───────────────────────────── Ordre du Dragon ─────────────────────────────

export type DragonPlan = 'monthly' | 'yearly';

/** Mêmes identifiants que `ios/Ombrelune.storekit`. */
export const DRAGON = {
  plans: {
    monthly: { productId: 'ombrelune.dragon.monthly', price: '4,99 €', label: 'Mensuel', adj: 'mensuelle', per: 'mois' },
    yearly: { productId: 'ombrelune.dragon.yearly', price: '39,99 €', label: 'Annuel', adj: 'annuelle', per: 'an' },
  },
  trialDays: 3,
  weeklyGems: 60,
  goldBonus: 0.25,
  /** Économie de l'annuel par rapport à 12 mois (4,99 × 12 = 59,88 €). */
  yearlySavingPct: Math.round((1 - 39.99 / (4.99 * 12)) * 100),
} as const;

export interface Subscription {
  plan: DragonPlan | null;
  /** Fin de la période en cours (s). L'abonnement est actif tant que `now < expiresAt`. */
  expiresAt: number;
  /** Période en cours = essai gratuit. */
  inTrial: boolean;
  /** L'essai gratuit a déjà été consommé (une seule fois par compte). */
  trialUsed: boolean;
  autoRenew: boolean;
  /** Formule choisie pour le prochain renouvellement (changement de formule). */
  nextPlan: DragonPlan | null;
  /** Semaine ISO (« 2026-W45 ») des 60 gemmes déjà réclamées. */
  gemsWeek: string;
  /** Apparence exclusive portée (cosmétique, sans effet en combat). */
  skin: boolean;
}

export function noSubscription(): Subscription {
  return { plan: null, expiresAt: 0, inTrial: false, trialUsed: false, autoRenew: false, nextPlan: null, gemsWeek: '', skin: true };
}

/** Ajoute une période calendaire (mois ou an) à un instant (s). */
export function addPeriod(t: number, plan: DragonPlan): number {
  const d = new Date(t * 1000);
  if (plan === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1);
  else d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.getTime() / 1000;
}

/** État à l'instant `now` : fait avancer les renouvellements automatiques (comme le ferait l'App Store). */
export function subscriptionAt(sub: Subscription, now: number): Subscription {
  if (!sub.plan || now < sub.expiresAt || !sub.autoRenew) return sub;
  let { expiresAt } = sub;
  const plan = sub.nextPlan ?? sub.plan;
  for (let i = 0; i < 1000 && expiresAt <= now; i++) expiresAt = addPeriod(expiresAt, plan);
  return { ...sub, plan, nextPlan: null, expiresAt, inTrial: false };
}

export function isSubscribed(sub: Subscription, now: number): boolean {
  const s = subscriptionAt(sub, now);
  return s.plan !== null && now < s.expiresAt;
}

/** Souscription (ou changement de formule si déjà abonné : effectif au prochain renouvellement). */
export function subscribe(sub: Subscription, plan: DragonPlan, now: number): Subscription {
  const s = subscriptionAt(sub, now);
  if (isSubscribed(s, now)) {
    return { ...s, autoRenew: true, nextPlan: plan === s.plan ? null : plan };
  }
  const trial = !s.trialUsed;
  return {
    ...s,
    plan,
    nextPlan: null,
    inTrial: trial,
    trialUsed: true,
    autoRenew: true,
    expiresAt: trial ? now + DRAGON.trialDays * DAY : addPeriod(now, plan),
  };
}

/** Résilier : l'abonnement reste actif jusqu'à la fin de la période (ou de l'essai) en cours. */
export function cancelRenewal(sub: Subscription, now: number): Subscription {
  return { ...subscriptionAt(sub, now), autoRenew: false, nextPlan: null };
}

export function resumeRenewal(sub: Subscription, now: number): Subscription {
  const s = subscriptionAt(sub, now);
  return isSubscribed(s, now) ? { ...s, autoRenew: true } : s;
}

export function weekKey(date: Date, iso: (d: Date) => { year: number; week: number }): string {
  const w = iso(date);
  return `${w.year}-W${String(w.week).padStart(2, '0')}`;
}

/** Les 60 gemmes de la semaine sont réclamables (abonné, pas encore réclamées cette semaine ISO). */
export function weeklyGemsClaimable(sub: Subscription, now: number, week: string): boolean {
  return isSubscribed(sub, now) && sub.gemsWeek !== week;
}

export function claimWeeklyGems(sub: Subscription, now: number, week: string): { sub: Subscription; gems: number } {
  if (!weeklyGemsClaimable(sub, now, week)) return { sub, gems: 0 };
  return { sub: { ...subscriptionAt(sub, now), gemsWeek: week }, gems: DRAGON.weeklyGems };
}

/** Bonus d'or : Fortune (+5 % par rang) et Ordre du Dragon (+25 %), additionnés (`goldReward`). */
export function goldBonus(fortuneRank: number, subscribed: boolean): number {
  return fortuneRank * 0.05 + (subscribed ? DRAGON.goldBonus : 0);
}

// ───────────────────────────── Publicité récompensée ─────────────────────────────

export const REWARDED_AD = {
  /** Publicités récompensées au plus par jour (jour local). */
  perDay: 3,
  /** Délai minimal entre deux publicités (s). */
  cooldown: 15 * 60,
  /** Durée de la publicité simulée du prototype web (s). */
  simulatedSeconds: 5,
} as const;

export interface AdLedger {
  /** Jour local « AAAA-MM-JJ » du compteur. */
  day: string;
  count: number;
  /** Instant (s) de la dernière publicité vue jusqu'au bout. */
  lastAt: number;
}

export function noAds(): AdLedger {
  return { day: '', count: 0, lastAt: 0 };
}

export function localDay(date: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export type AdBlock = 'subscriber' | 'full' | 'daily' | 'cooldown';

export interface AdStatus {
  ok: boolean;
  reason?: AdBlock;
  /** Publicités encore possibles aujourd'hui. */
  left: number;
  /** Secondes avant la prochaine (délai), 0 si disponible. */
  wait: number;
}

export function adStatus(ads: AdLedger, now: number, day: string, ctx: { subscribed: boolean; lives: number }): AdStatus {
  const count = ads.day === day ? ads.count : 0;
  const left = Math.max(0, REWARDED_AD.perDay - count);
  const wait = ads.lastAt > 0 ? Math.max(0, Math.ceil(ads.lastAt + REWARDED_AD.cooldown - now)) : 0;
  if (ctx.subscribed) return { ok: false, reason: 'subscriber', left, wait: 0 };
  if (ctx.lives >= LIVES.max) return { ok: false, reason: 'full', left, wait: 0 };
  if (left <= 0) return { ok: false, reason: 'daily', left, wait: 0 };
  if (wait > 0) return { ok: false, reason: 'cooldown', left, wait };
  return { ok: true, left, wait: 0 };
}

export function recordAd(ads: AdLedger, now: number, day: string): AdLedger {
  return { day, count: (ads.day === day ? ads.count : 0) + 1, lastAt: now };
}

/** +1 vie (plafonnée à 5). Le compte à rebours de la recharge suivante n'est pas remis à zéro. */
export function addLife(state: LivesState, now: number): LivesState {
  const s = livesAt(state, now);
  if (s.lives >= LIVES.max) return s;
  const lives = s.lives + 1;
  return lives >= LIVES.max ? { lives, refillFrom: now } : { lives, refillFrom: s.refillFrom };
}
