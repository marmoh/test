/** Sauvegarde locale du prototype (mêmes champs que la persistance iOS). */
import { livesAt, afterAttempt, isoWeek, type LivesState } from '../../sim/src/formulas.js';
import { LIVES } from '../../sim/src/constants.js';

const LIVES_MAX = LIVES.max;
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
import { passFor, seasonAt, addPoints, pointsForWin, tierOf, pendingChests, starChest, claim as claimTier, claimAll, buyPremium, type PassState, type Reward, type SkinId, type Track } from './season.js';

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
  /** 2 : pass de saison, apparences, coffres d'étoiles (migration depuis 1 dans `save()`). */
  version: 2;
  stars: Record<number, number>;
  unlocked: number;
  lives: LivesState;
  gems: number;
  gold: number;
  settings: Settings;
  bonuses: { potion: number; scroll: number; aegis: number };
  heroId: 'scout' | 'windMonk' | 'emberSorcerer';
  heroes: string[];
  talents: { vigor: number; strength: number; agility: number; fortune: number; ink: number };
  tournament: { week: string; attempts: number; best: number };
  starterPack: boolean;
  /** Ordre du Dragon (abonnement simulé : formule, date de fin, essai). */
  subscription: Subscription;
  /** Publicités récompensées vues (limite quotidienne et délai). */
  ads: AdLedger;
  /** L'écran d'abonnement a déjà été montré à la première panne de vies (§11). */
  livesPaywallSeen: boolean;
  /** Pass de saison de la saison en cours (remis à zéro à chaque saison). */
  pass: PassState;
  /** Apparences possédées (pass de saison) et apparence portée (cosmétique). */
  skins: SkinId[];
  skin: SkinId | null;
  /** Coffres d'étoiles déjà ouverts (un tous les 20 ★, §8). */
  chests: number;
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
    version: 2,
    stars: {},
    unlocked: 1,
    lives: { lives: 5, refillFrom: now() },
    gems: 120,
    gold: 300,
    settings: freshSettings(),
    bonuses: { potion: 1, scroll: 1, aegis: 1 },
    heroId: 'scout',
    heroes: ['scout'],
    talents: { vigor: 0, strength: 0, agility: 0, fortune: 0, ink: 0 },
    tournament: { week: '', attempts: 5, best: 0 },
    starterPack: false,
    subscription: noSubscription(),
    ads: noAds(),
    livesPaywallSeen: false,
    pass: passFor(null, seasonAt(now()).season),
    skins: [],
    skin: null,
    chests: 0,
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
      // « Encre lente » (DECISIONS #71) : rang 0 pour les sauvegardes d'avant
      talents: { ...base.talents, ...parsed.talents },
    };
    // migration 1 → 2 : pass de saison (saison en cours), apparences, coffres d'étoiles.
    // Les coffres déjà mérités par une ancienne sauvegarde s'ouvriront à la prochaine victoire.
    cache.pass = passFor(parsed.pass, seasonAt(now()).season);
    cache.skins = Array.isArray(parsed.skins) ? parsed.skins.filter((x) => x === 'foxEars' || x === 'paperWings' || x === 'moonCrown') : [];
    if (!cache.skin || !cache.skins.includes(cache.skin)) cache.skin = null;
    cache.chests = Number.isInteger(parsed.chests) ? parsed.chests! : 0;
    cache.version = 2;
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
  // démo : ?passpts=170 avance le pass de saison (captures)
  const pp = /passpts=(\d+)/.exec(location.search);
  if (pp) cache!.pass.points = Math.max(cache!.pass.points, Number(pp[1]));
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

export interface AttemptResult {
  firstThree: boolean;
  /** lunes du pass gagnées et paliers avant / après */
  pass: { points: number; tierBefore: number; tierAfter: number };
  /** coffres d'étoiles ouverts par cette victoire (déjà crédités) */
  chests: { index: number; gold: number; gems: number; bonus: 'potion' | 'scroll' | 'aegis' }[];
}

export function recordAttempt(n: number, won: boolean, stars: number): AttemptResult {
  const s = save();
  s.lives = afterAttempt(s.lives, now(), won, subscribed());
  const prev = s.stars[n] ?? 0;
  const firstThree = won && stars === 3 && prev < 3;
  const pass = passState();
  const tierBefore = tierOf(pass.points);
  let points = 0;
  const chests: AttemptResult['chests'] = [];
  if (won) {
    s.stars[n] = Math.max(prev, stars);
    s.unlocked = Math.max(s.unlocked, n + 1);
    points = pointsForWin(prev, stars);
    s.pass = addPoints(pass, points);
    for (const index of pendingChests(s.chests, totalStars())) {
      const c = starChest(index);
      s.gold += c.gold;
      s.gems += c.gems;
      s.bonuses[c.bonus]++;
      s.chests = index;
      chests.push({ index, ...c });
    }
  }
  persist();
  return { firstThree, pass: { points, tierBefore, tierAfter: tierOf(s.pass.points) }, chests };
}

// ───────────────────────────── pass de saison ─────────────────────────────

/** Pass de la saison en cours (une nouvelle saison remet le pass à zéro). */
export function passState(): PassState {
  const s = save();
  const season = seasonAt(now()).season;
  if (s.pass.season !== season) s.pass = passFor(null, season);
  return s.pass;
}

/** Crédite une récompense du pass (or, gemmes, bonus, vies, apparence). */
export function grantReward(r: Reward): void {
  const s = save();
  switch (r.kind) {
    case 'gold':
      s.gold += r.amount;
      break;
    case 'gems':
      s.gems += r.amount;
      break;
    case 'potion':
    case 'scroll':
    case 'aegis':
      s.bonuses[r.kind] += r.amount;
      break;
    case 'lives':
      s.lives = { lives: Math.max(livesAt(s.lives, now()).lives, LIVES_MAX), refillFrom: now() };
      break;
    case 'skin':
      if (r.skin && !s.skins.includes(r.skin)) s.skins.push(r.skin);
      if (r.skin && !s.skin) s.skin = r.skin;
      break;
  }
}

export function claimPassTier(track: Track, tier: number): Reward | null {
  const s = save();
  const r = claimTier(passState(), track, tier);
  if (!r) return null;
  s.pass = r.state;
  grantReward(r.reward);
  persist();
  return r.reward;
}

export function claimAllPass(): Reward[] {
  const s = save();
  const r = claimAll(passState());
  s.pass = r.state;
  r.rewards.forEach(grantReward);
  persist();
  return r.rewards;
}

/** Achat simulé de la piste premium (StoreKit 2 dans l'app iOS). */
export function buyPassPremium(): void {
  const s = save();
  s.pass = buyPremium(passState());
  persist();
  recordEntitlements();
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
  /** saisons dont la piste premium du pass a été achetée */
  passes?: number[];
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
  if (s.pass.premium && !(acc.passes ?? []).includes(s.pass.season)) acc.passes = [...(acc.passes ?? []), s.pass.season];
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
  const pass = passState();
  if (!pass.premium && (acc.passes ?? []).includes(pass.season)) {
    s.pass = buyPremium(pass);
    restored.push(`Pass de saison ${pass.season}`);
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
