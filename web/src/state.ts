/** Sauvegarde locale du prototype (mêmes champs que la persistance iOS). */
import { livesAt, afterAttempt, isoWeek, type LivesState } from '../../sim/src/formulas.js';
import {
  addLife,
  adStatus,
  claimWeeklyGems,
  isSubscribed,
  localDay,
  noAds,
  noSubscription,
  recordAd,
  subscriptionAt,
  weekKey,
  weeklyGemsClaimable,
  type AdLedger,
  type AdStatus,
  type Subscription,
} from './economy.js';

export interface Settings {
  /** effets sonores */
  sound: boolean;
  music: boolean;
  haptics: boolean;
  autoFire: boolean;
  reduceMotion: boolean;
  /** consentement aux publicités personnalisées (refusé par défaut) */
  personalizedAds: boolean;
}

export interface Save {
  version: 1;
  stars: Record<number, number>;
  unlocked: number;
  lives: LivesState;
  gems: number;
  gold: number;
  settings: Settings;
  bonuses: { potion: number; scroll: number; aegis: number };
  heroId: 'scout' | 'windMonk' | 'emberSorcerer';
  heroes: string[];
  talents: { vigor: number; strength: number; agility: number; fortune: number };
  tournament: { week: string; attempts: number; best: number };
  starterPack: boolean;
  /** Ordre du Dragon (abonnement simulé : formule, date de fin, essai). */
  subscription: Subscription;
  /** Publicités récompensées vues (limite quotidienne et délai). */
  ads: AdLedger;
  /** L'écran d'abonnement a déjà été montré à la première panne de vies (§11). */
  livesPaywallSeen: boolean;
}

const KEY = 'ombrelune.save.v1';
/** Compte « App Store » simulé : survit à « Effacer la progression », relu par « Restaurer les achats ». */
const STORE_KEY = 'ombrelune.store.v1';
export const now = (): number => Date.now() / 1000;

function freshSettings(): Settings {
  return { sound: true, music: true, haptics: true, autoFire: true, reduceMotion: false, personalizedAds: false };
}

function fresh(): Save {
  return {
    version: 1,
    stars: {},
    unlocked: 1,
    lives: { lives: 5, refillFrom: now() },
    gems: 120,
    gold: 300,
    settings: freshSettings(),
    bonuses: { potion: 1, scroll: 1, aegis: 1 },
    heroId: 'scout',
    heroes: ['scout'],
    talents: { vigor: 0, strength: 0, agility: 0, fortune: 0 },
    tournament: { week: '', attempts: 5, best: 0 },
    starterPack: false,
    subscription: noSubscription(),
    ads: noAds(),
    livesPaywallSeen: false,
  };
}

let cache: Save | null = null;

export function save(): Save {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<Save>) : {};
    const base = fresh();
    // fusion champ par champ : une ancienne sauvegarde reçoit les nouveaux réglages par défaut
    cache = {
      ...base,
      ...parsed,
      settings: { ...base.settings, ...parsed.settings },
      subscription: { ...base.subscription, ...parsed.subscription },
      ads: { ...base.ads, ...parsed.ads },
    };
    // migration : le tir automatique devient le réglage par défaut (DECISIONS #10)
    if (!(cache as Save & { autoFireDefault?: boolean }).autoFireDefault) {
      cache.settings.autoFire = true;
      (cache as Save & { autoFireDefault?: boolean }).autoFireDefault = true;
    }
  } catch {
    cache = fresh();
  }
  // démo : ?unlock=40 débloque les niveaux pour le prototype
  const m = /unlock=(\d+)/.exec(location.search);
  if (m) cache!.unlocked = Math.max(cache!.unlocked, Number(m[1]));
  return cache!;
}

export function persist(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(save()));
  } catch {
    /* stockage indisponible : la partie continue sans sauvegarde */
  }
}

/** « Effacer la progression » : tout sauf les achats, que « Restaurer les achats » rend. */
export function eraseProgress(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* rien */
  }
  cache = null;
}

// ───────────────────────────── vies ─────────────────────────────

export function lives(): LivesState {
  const s = save();
  s.lives = livesAt(s.lives, now());
  return s.lives;
}

/** Peut lancer un niveau : au moins une vie, ou abonné (vies illimitées). */
export function canPlay(): boolean {
  return subscribed() || lives().lives > 0;
}

export function recordAttempt(n: number, won: boolean, stars: number): { firstThree: boolean } {
  const s = save();
  s.lives = afterAttempt(s.lives, now(), won, subscribed());
  const prev = s.stars[n] ?? 0;
  const firstThree = won && stars === 3 && prev < 3;
  if (won) {
    s.stars[n] = Math.max(prev, stars);
    s.unlocked = Math.max(s.unlocked, n + 1);
  }
  persist();
  return { firstThree };
}

// ───────────────────────────── Ordre du Dragon ─────────────────────────────

export function subscription(): Subscription {
  const s = save();
  s.subscription = subscriptionAt(s.subscription, now());
  return s.subscription;
}

export function subscribed(): boolean {
  return isSubscribed(save().subscription, now());
}

export function currentWeek(): string {
  return weekKey(new Date(), isoWeek);
}

export function weeklyGemsReady(): boolean {
  return weeklyGemsClaimable(save().subscription, now(), currentWeek());
}

export function claimWeekly(): number {
  const s = save();
  const r = claimWeeklyGems(s.subscription, now(), currentWeek());
  s.subscription = r.sub;
  s.gems += r.gems;
  persist();
  return r.gems;
}

/** Apparence exclusive affichée : abonné et parure portée. */
export function dragonSkin(): boolean {
  return subscribed() && save().subscription.skin;
}

// ───────────────────────────── publicité récompensée ─────────────────────────────

export function adState(): AdStatus {
  const s = save();
  return adStatus(s.ads, now(), localDay(new Date()), { subscribed: subscribed(), lives: lives().lives });
}

/** Crédite la vie d'une publicité vue jusqu'au bout (re-vérifie les limites). */
export function rewardAd(): boolean {
  if (!adState().ok) return false;
  const s = save();
  s.ads = recordAd(s.ads, now(), localDay(new Date()));
  s.lives = addLife(s.lives, now());
  persist();
  return true;
}

// ───────────────────────────── compte App Store simulé ─────────────────────────────

interface StoreAccount {
  starterPack: boolean;
  subscription: Subscription | null;
}

function readAccount(): StoreAccount {
  try {
    return { starterPack: false, subscription: null, ...JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}') };
  } catch {
    return { starterPack: false, subscription: null };
  }
}

/** Mémorise un achat non consommable ou l'abonnement côté « App Store » (prototype). */
export function recordEntitlements(): void {
  const s = save();
  const acc = readAccount();
  acc.starterPack ||= s.starterPack;
  if (s.subscription.trialUsed) acc.subscription = s.subscription;
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(acc));
  } catch {
    /* rien */
  }
}

/** Restaurer les achats : offre de départ (Moine du vent) et abonnement. Les gemmes consommées ne reviennent pas. */
export function restorePurchases(): { restored: string[] } {
  const s = save();
  const acc = readAccount();
  const restored: string[] = [];
  if (acc.starterPack && !s.starterPack) {
    s.starterPack = true;
    if (!s.heroes.includes('windMonk')) s.heroes.push('windMonk');
    restored.push('Offre de départ (Moine du vent)');
  }
  if (acc.subscription && (!s.subscription.trialUsed || acc.subscription.expiresAt > s.subscription.expiresAt)) {
    // la semaine des gemmes déjà réclamées fait partie du compte : on garde la plus récente
    const gemsWeek = [acc.subscription.gemsWeek, s.subscription.gemsWeek].sort().pop() ?? '';
    s.subscription = { ...acc.subscription, gemsWeek, skin: s.subscription.skin };
    if (isSubscribed(s.subscription, now())) restored.push('Ordre du Dragon');
  }
  persist();
  return { restored };
}

// ───────────────────────────── divers ─────────────────────────────

export function totalStars(): number {
  return Object.values(save().stars).reduce((a, b) => a + b, 0);
}

/** Coût en or du rang suivant d'un talent (rang 0 → 1 : 50, puis croissance quadratique). */
export function talentCost(rank: number): number {
  return 25 * (rank + 1) * (rank + 2);
}

export function tournamentState(weekKey: string): Save['tournament'] {
  const s = save();
  if (s.tournament.week !== weekKey) s.tournament = { week: weekKey, attempts: 5, best: 0 };
  return s.tournament;
}
