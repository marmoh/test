/**
 * §11 / §12.6 Pass de saison et §8 coffres d'étoiles — logique pure (sans DOM), testée par vitest
 * (`web/test/season.test.ts`) et à reprendre telle quelle en Swift.
 *
 * - Saisons de 6 semaines, la saison 1 commence le lundi 2 novembre 2026 (00:00 UTC) ;
 *   produit non consommable par saison : `ombrelune.pass.season<N>` (4,99 €).
 * - 30 paliers, piste gratuite et piste premium. On gagne des « lunes » en jouant :
 *   +10 par victoire, +10 par étoile nouvellement obtenue (meilleur score du niveau).
 *   40 lunes par palier (1 200 pour les 30 paliers ≈ 40 niveaux à 3 étoiles).
 * - Récompenses : or, gemmes, bonus d'avant niveau, 5 vies, apparences (cosmétiques).
 *   Tout est affiché d'avance : aucune récompense aléatoire.
 * - Rien du pass ne s'applique en tournoi (les bonus et les talents y sont désactivés).
 */

const DAY = 86_400;

export type SkinId = 'foxEars' | 'paperWings' | 'moonCrown';

export const SKINS: Record<SkinId, { name: string; desc: string }> = {
  foxEars: { name: 'Oreilles de renard', desc: 'Oreilles et queue de renard découpées dans l’encre.' },
  paperWings: { name: 'Ailes de papier', desc: 'Deux ailes de papier ajourées qui battent doucement.' },
  moonCrown: { name: 'Couronne de lune', desc: 'Un croissant d’or à la feuille au-dessus de la capuche.' },
};

export type RewardKind = 'gold' | 'gems' | 'potion' | 'scroll' | 'aegis' | 'lives' | 'skin';

export interface Reward {
  kind: RewardKind;
  amount: number;
  skin?: SkinId;
}

export const PASS = {
  tiers: 30,
  pointsPerTier: 40,
  pointsPerWin: 10,
  pointsPerNewStar: 10,
  seasonDays: 42,
  /** lundi 2 novembre 2026, 00:00 UTC : début de la saison 1 */
  epoch: Date.UTC(2026, 10, 2) / 1000,
  price: '4,99 €',
  productPrefix: 'ombrelune.pass.season',
  name: 'La Lune de papier',
} as const;

const R = (kind: RewardKind, amount = 1, skin?: SkinId): Reward => (skin ? { kind, amount, skin } : { kind, amount });

/** Piste gratuite : index 0 = palier 1. */
export const FREE_TRACK: Reward[] = [
  R('gold', 100), R('potion'), R('gold', 150), R('gems', 10), R('scroll'),
  R('gold', 200), R('aegis'), R('gems', 15), R('gold', 250), R('gems', 20),
  R('potion'), R('gold', 300), R('scroll'), R('gems', 15), R('gold', 350),
  R('aegis'), R('gold', 400), R('gems', 20), R('potion'), R('gems', 25),
  R('gold', 450), R('scroll'), R('gold', 500), R('gems', 20), R('aegis'),
  R('gold', 550), R('potion'), R('gems', 25), R('gold', 600), R('gems', 50),
];

/** Piste premium (pass acheté) : index 0 = palier 1. */
export const PREMIUM_TRACK: Reward[] = [
  R('gems', 30), R('gold', 300), R('potion', 2), R('gems', 30), R('scroll', 2),
  R('gold', 400), R('aegis', 2), R('gems', 40), R('gold', 500), R('skin', 1, 'foxEars'),
  R('gems', 40), R('potion', 2), R('gold', 600), R('scroll', 2), R('lives', 5),
  R('gems', 50), R('aegis', 2), R('gold', 700), R('gems', 50), R('skin', 1, 'paperWings'),
  R('potion', 3), R('gold', 800), R('gems', 60), R('scroll', 3), R('lives', 5),
  R('aegis', 3), R('gems', 60), R('gold', 1000), R('gems', 80), R('skin', 1, 'moonCrown'),
];

export type Track = 'free' | 'premium';

export interface PassState {
  season: number;
  points: number;
  premium: boolean;
  /** paliers réclamés (1…30) sur chaque piste */
  claimedFree: number[];
  claimedPremium: number[];
}

export interface SeasonInfo {
  season: number;
  start: number;
  end: number;
}

/** Saison en cours à l'instant `now` (s). Avant l'époque : saison 1. */
export function seasonAt(now: number): SeasonInfo {
  const len = PASS.seasonDays * DAY;
  const i = Math.max(0, Math.floor((now - PASS.epoch) / len));
  const start = PASS.epoch + i * len;
  return { season: i + 1, start, end: start + len };
}

export function passProductId(season: number): string {
  return `${PASS.productPrefix}${season}`;
}

export function freshPass(season: number): PassState {
  return { season, points: 0, premium: false, claimedFree: [], claimedPremium: [] };
}

/**
 * Migration / changement de saison : une sauvegarde sans pass, abîmée ou d'une autre saison
 * repart à zéro pour la saison `season` (le premium ne passe pas d'une saison à l'autre).
 */
export function passFor(state: Partial<PassState> | undefined | null, season: number): PassState {
  if (!state || state.season !== season) return freshPass(season);
  const ints = (a: unknown) => (Array.isArray(a) ? a.filter((x): x is number => Number.isInteger(x) && x >= 1 && x <= PASS.tiers) : []);
  return {
    season,
    points: Math.max(0, Number(state.points) || 0),
    premium: !!state.premium,
    claimedFree: [...new Set(ints(state.claimedFree))],
    claimedPremium: [...new Set(ints(state.claimedPremium))],
  };
}

/** Lunes gagnées par une victoire : `prevStars` = meilleur score avant, `stars` = résultat. */
export function pointsForWin(prevStars: number, stars: number): number {
  return PASS.pointsPerWin + PASS.pointsPerNewStar * Math.max(0, stars - prevStars);
}

/** Paliers atteints (0…30). */
export function tierOf(points: number): number {
  return Math.min(PASS.tiers, Math.floor(points / PASS.pointsPerTier));
}

/** Avancement dans le palier en cours (0…1), 1 si tout est atteint. */
export function tierProgress(points: number): number {
  if (tierOf(points) >= PASS.tiers) return 1;
  return (points % PASS.pointsPerTier) / PASS.pointsPerTier;
}

export function addPoints(state: PassState, pts: number): PassState {
  return { ...state, points: state.points + Math.max(0, pts) };
}

export function rewardAt(track: Track, tier: number): Reward {
  return (track === 'free' ? FREE_TRACK : PREMIUM_TRACK)[tier - 1];
}

export function isClaimed(state: PassState, track: Track, tier: number): boolean {
  return (track === 'free' ? state.claimedFree : state.claimedPremium).includes(tier);
}

export function canClaim(state: PassState, track: Track, tier: number): boolean {
  if (tier < 1 || tier > PASS.tiers || tier > tierOf(state.points)) return false;
  if (track === 'premium' && !state.premium) return false;
  return !isClaimed(state, track, tier);
}

export function claim(state: PassState, track: Track, tier: number): { state: PassState; reward: Reward } | null {
  if (!canClaim(state, track, tier)) return null;
  const next =
    track === 'free'
      ? { ...state, claimedFree: [...state.claimedFree, tier] }
      : { ...state, claimedPremium: [...state.claimedPremium, tier] };
  return { state: next, reward: rewardAt(track, tier) };
}

/** Tout ce qui peut être réclamé (pistes gratuite puis premium, paliers croissants). */
export function claimAll(state: PassState): { state: PassState; rewards: Reward[] } {
  let s = state;
  const rewards: Reward[] = [];
  for (const track of ['free', 'premium'] as Track[]) {
    for (let t = 1; t <= PASS.tiers; t++) {
      const r = claim(s, track, t);
      if (r) {
        s = r.state;
        rewards.push(r.reward);
      }
    }
  }
  return { state: s, rewards };
}

export function claimableCount(state: PassState): number {
  let n = 0;
  for (const track of ['free', 'premium'] as Track[]) for (let t = 1; t <= PASS.tiers; t++) if (canClaim(state, track, t)) n++;
  return n;
}

/** Achat (simulé ou StoreKit) de la piste premium de la saison en cours. */
export function buyPremium(state: PassState): PassState {
  return { ...state, premium: true };
}

/** Somme des récompenses d'une liste, pour un résumé (« +300 or, +40 gemmes, 1 apparence »). */
export function sumRewards(rs: Reward[]): Partial<Record<RewardKind, number>> {
  const out: Partial<Record<RewardKind, number>> = {};
  for (const r of rs) out[r.kind] = (out[r.kind] ?? 0) + r.amount;
  return out;
}

// ───────────────────────────── coffres d'étoiles (§8) ─────────────────────────────

export const STAR_CHEST = { every: 20, gold: 200, gems: 20 } as const;
const CHEST_BONUS = ['potion', 'scroll', 'aegis'] as const;

/** Contenu du coffre n° `index` (1, 2, 3…) : or + gemmes + 1 bonus, sans hasard (le bonus tourne). */
export function starChest(index: number): { gold: number; gems: number; bonus: (typeof CHEST_BONUS)[number] } {
  return { gold: STAR_CHEST.gold, gems: STAR_CHEST.gems, bonus: CHEST_BONUS[(index - 1) % 3] };
}

/** Coffres à ouvrir : `opened` déjà ouverts, `stars` total d'étoiles. Renvoie les numéros des nouveaux coffres. */
export function pendingChests(opened: number, stars: number): number[] {
  const earned = Math.floor(stars / STAR_CHEST.every);
  return Array.from({ length: Math.max(0, earned - opened) }, (_, i) => opened + i + 1);
}
