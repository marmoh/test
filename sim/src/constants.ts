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

// §5 Mise à l'échelle
export const SCALE = { hpPerD: 0.09, dmgPerD: 0.06 } as const;
export const ELITE = { hpMult: 2.2, fromChapter: 3, maxPerRoom: 1, maxPerRoomHard: 2 } as const;
export const TELEGRAPH_MIN = 0.5;
export const BOSS_BASE_HP = 6000;
export const BOSS_BREATH = 1.2;

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
