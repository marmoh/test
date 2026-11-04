/**
 * Toutes les valeurs d'équilibrage. Valeurs de départ = SPEC ; tout écart est
 * consigné dans docs/DECISIONS.md.
 */
export const APP_NAME = 'Ombrelune';

export const SIM_DT = 1 / 30; // pas fixe de simulation (s)

// §3 Arène
export const CELL = 44;
export const COLS = 9;
export const ROWS = 15;
export const ARENA_W = COLS * CELL; // 396
export const ARENA_H = ROWS * CELL; // 660
export const MAX_OBSTACLES = 14;

// §13 bornes
export const MAX_PROJECTILES = 150;
export const MAX_ENEMIES = 30;

// §2 Contrôles
/** Tir automatique permanent (le héros tire aussi en marchant) : activé par défaut pour tous (décision produit, cf. DECISIONS). */
export const AUTO_FIRE_DEFAULT = true;

export const CONTROL = {
  deadZone: 8,
  fullSpeedSpan: 40,
  maxAnchorDist: 70,
  stillSpeed: 12,
  stillTime: 0.1,
  turnTime: 0.08,
} as const;

// §4 Héros
export const HERO = {
  hp: 600,
  damage: 100,
  fireRate: 1.6,
  speed: 220,
  projectileSpeed: 900,
  projectileRadius: 6,
  radius: 14,
  invulnAfterHit: 0.5,
} as const;

export const TALENTS = {
  maxRank: 10,
  hpPerRank: 0.02,
  damagePerRank: 0.02,
  fireRatePerRank: 0.015,
  goldPerRank: 0.05,
} as const;

/** Rang de talent attendu au niveau n (modèle des bots). */
export function expectedTalentRank(n: number): number {
  return Math.min(TALENTS.maxRank, Math.floor(n / 25));
}

export const HEAL_BETWEEN_ROOMS = 0.15;

// §5 Mise à l'échelle (cf. DECISIONS : la SPEC donnait 0,09 / 0,06)
export const SCALE = { hpPerD: 0.03, dmgPerD: 0.06 } as const;

/**
 * §7 Budget d'une salle (forme SPEC conservée, cf. `roomBudget`) :
 *   B = round(parSalles[n] × (base + perD × D × mult × (0,8 + 0,2 × indexSalle)) / P(D) × échelle)
 * avec P(D) = 1 + powerPerD × (D − 1) : progression attendue du joueur (maîtrise + talents). Sans elle,
 * B ∝ D et PV ∝ D donnent des salles en D² que des bots de niveau fixe ne peuvent pas tenir dans les
 * bandes plates du §9 ni en 60–150 s. Les dents de scie (mult) gardent leur amplitude SPEC.
 * parSalles : multiplicateur global selon le nombre de salles du niveau (2, 3 ou 4) pour garder la durée.
 * waveCap + waveCapPerD × (D − 1) : points de budget présents simultanément au plus (une vague) ; la densité
 * (et non la durée) porte la montée en difficulté avec le tir auto permanent.
 */
export const BUDGET = {
  base: 6,
  perD: 3.2,
  powerPerD: 0.25,
  byRooms: { 2: 2.4, 3: 1.75, 4: 2.2 } as Record<number, number>,
  waveCap: 18,
  waveCapPerD: 1.5,
} as const;
export const ELITE = { hpMult: 2.2, fromChapter: 3, maxPerRoom: 1, maxPerRoomHard: 2 } as const;
export const TELEGRAPH_MIN = 0.5;
export const BOSS_BASE_HP = 6000;
/**
 * Niveaux de boss : facteur sur le budget des salles qui précèdent le boss (mult = 1,55 de la SPEC conservé).
 * La difficulté d'un niveau de boss doit venir du boss, pas d'un couloir de salles à ×1,55.
 */
export const BOSS_LEVEL_PRE_ROOMS = 0.6;
export const BOSS_BREATH = 1.2;
/** Onde de choc du boss : télégraphe = max(0,8 s, (rayon + 7) / vitesse héros + marge) — sinon indépassable au contact. */
export const BOSS_SLAM_MARGIN = 0.35;

// §7
export const LEVEL_COUNT = 300;
export const LEVELS_PER_CHAPTER = 20;
export const CHAPTERS_PER_KINGDOM = 3;

// §8
export const LIVES = { max: 5, regenSeconds: 30 * 60 } as const;
export const STAR_THRESHOLDS = { two: 0.5, three: 0.8 } as const;

// §6 tirage
export const RARITY_WEIGHTS = { common: 0.6, rare: 0.3, epic: 0.1 } as const;

// Orbes de soin (lâchés par les ennemis)
export const HEAL_ORB = { dropChance: 0.08, healFrac: 0.04, magnetRange: 260, magnetHealMult: 1.5, pickupRadius: 26 } as const;
