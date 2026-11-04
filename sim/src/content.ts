/** §5 et §6 : définitions des ennemis, boss et pouvoirs. */

export type EnemyType = 'goblin' | 'mushroom' | 'wolf' | 'skeleton' | 'jelly' | 'totem' | 'bat' | 'mage';
export type MinionType = EnemyType | 'jellySmall';

export interface EnemyDef {
  type: MinionType;
  name: string;
  hp: number;
  contact: number;
  speed: number;
  radius: number;
  flying: boolean;
  /** Dégâts du projectile / de la zone (non chiffrés dans la SPEC : cf. DECISIONS). */
  shotDmg: number;
  cost: number;
  /** Période d'attaque (s). */
  period: number;
}

export const ENEMIES: Record<MinionType, EnemyDef> = {
  goblin: { type: 'goblin', name: 'Gobelin frondeur', hp: 220, contact: 60, speed: 70, radius: 15, flying: false, shotDmg: 80, cost: 2, period: 1.8 },
  mushroom: { type: 'mushroom', name: 'Champignon-spore', hp: 300, contact: 50, speed: 0, radius: 16, flying: false, shotDmg: 60, cost: 3, period: 3 },
  wolf: { type: 'wolf', name: "Loup d'ombre", hp: 260, contact: 120, speed: 90, radius: 16, flying: false, shotDmg: 0, cost: 3, period: 3.2 },
  skeleton: { type: 'skeleton', name: 'Archer squelette', hp: 200, contact: 40, speed: 60, radius: 14, flying: false, shotDmg: 70, cost: 3, period: 2.4 },
  jelly: { type: 'jelly', name: 'Gelée', hp: 380, contact: 70, speed: 55, radius: 18, flying: false, shotDmg: 0, cost: 3, period: 0 },
  jellySmall: { type: 'jellySmall', name: 'Petite gelée', hp: 120, contact: 70, speed: 70, radius: 11, flying: false, shotDmg: 0, cost: 0, period: 0 },
  totem: { type: 'totem', name: 'Totem runique', hp: 500, contact: 0, speed: 0, radius: 18, flying: false, shotDmg: 60, cost: 4, period: 2 },
  bat: { type: 'bat', name: 'Chauve-souris', hp: 120, contact: 70, speed: 140, radius: 12, flying: true, shotDmg: 0, cost: 2, period: 2 },
  mage: { type: 'mage', name: 'Mage de braise', hp: 340, contact: 50, speed: 50, radius: 15, flying: false, shotDmg: 60, cost: 5, period: 3.4 },
};

/**
 * Ordre d'apparition : 1 nouveau type tous les 2 chapitres (ch. 1, 3, 5 … 15).
 * Le chapitre 1 démarre avec le gobelin seul.
 */
export const UNLOCK_ORDER: EnemyType[] = ['goblin', 'jelly', 'bat', 'mushroom', 'wolf', 'skeleton', 'totem', 'mage'];

export function unlockedEnemies(chapter: number): EnemyType[] {
  const count = Math.min(UNLOCK_ORDER.length, Math.floor((chapter - 1) / 2) + 1);
  return UNLOCK_ORDER.slice(0, count);
}

/** Type introduit au début de ce chapitre (salle tutoriel), ou null. */
export function newEnemyAt(chapter: number): EnemyType | null {
  if (chapter % 2 === 0) return null;
  const idx = (chapter - 1) / 2;
  return idx < UNLOCK_ORDER.length ? UNLOCK_ORDER[idx] : null;
}

/** Poids de tirage dans le remplissage du budget. */
export const SPAWN_WEIGHT: Record<EnemyType, number> = {
  goblin: 1.2,
  mushroom: 0.8,
  wolf: 0.9,
  skeleton: 1,
  jelly: 0.9,
  totem: 0.6,
  bat: 0.9,
  mage: 0.6,
};

// ───────────────────────────── Boss ─────────────────────────────

export type BossArchetype = 'treant' | 'queen' | 'scorpion' | 'wyvern' | 'ashlord';
export const BOSS_BY_KINGDOM: BossArchetype[] = ['treant', 'queen', 'scorpion', 'wyvern', 'ashlord'];

export type PatternKind = 'aimed' | 'ring' | 'spiral' | 'charge' | 'puddles' | 'slam' | 'rain' | 'summon';

export interface Pattern {
  kind: PatternKind;
  /** nombre de projectiles / zones / sbires */
  count: number;
  speed?: number;
  spread?: number; // degrés (éventail)
  repeats?: number; // salves
  interval?: number; // s entre salves
  radius?: number; // zones
  minion?: MinionType;
}

export interface BossDef {
  archetype: BossArchetype;
  name: string;
  radius: number;
  speed: number;
  flying: boolean;
  contact: number;
  shotDmg: number;
  /** 3 phases (100 %, 66 %, 33 %) : motifs joués en boucle, souffle de 1,2 s entre chaque. */
  phases: Pattern[][];
}

export const BOSSES: Record<BossArchetype, BossDef> = {
  treant: {
    archetype: 'treant',
    name: 'Treant colossal',
    radius: 34,
    speed: 35,
    flying: false,
    contact: 100,
    shotDmg: 90,
    phases: [
      [{ kind: 'aimed', count: 3, speed: 260, spread: 30, repeats: 2, interval: 0.5 }, { kind: 'slam', count: 1, radius: 110 }],
      [{ kind: 'ring', count: 12, speed: 170, repeats: 2, interval: 0.6 }, { kind: 'summon', count: 2, minion: 'goblin' }],
      [{ kind: 'rain', count: 5, radius: 50 }, { kind: 'spiral', count: 3, speed: 180, repeats: 8, interval: 0.25 }, { kind: 'slam', count: 1, radius: 130 }],
    ],
  },
  queen: {
    archetype: 'queen',
    name: 'Reine des marais',
    radius: 32,
    speed: 45,
    flying: false,
    contact: 100,
    shotDmg: 90,
    phases: [
      [{ kind: 'puddles', count: 3, radius: 48 }, { kind: 'aimed', count: 5, speed: 230, spread: 50 }],
      [{ kind: 'summon', count: 2, minion: 'jellySmall' }, { kind: 'ring', count: 14, speed: 160 }, { kind: 'puddles', count: 4, radius: 48 }],
      [{ kind: 'spiral', count: 4, speed: 170, repeats: 10, interval: 0.22 }, { kind: 'puddles', count: 5, radius: 52 }],
    ],
  },
  scorpion: {
    archetype: 'scorpion',
    name: "Scorpion d'ambre",
    radius: 32,
    speed: 60,
    flying: false,
    contact: 120,
    shotDmg: 95,
    phases: [
      [{ kind: 'charge', count: 1, speed: 460 }, { kind: 'aimed', count: 5, speed: 280, spread: 60 }],
      [{ kind: 'charge', count: 2, speed: 480 }, { kind: 'rain', count: 6, radius: 46 }],
      [{ kind: 'aimed', count: 7, speed: 290, spread: 90, repeats: 2, interval: 0.6 }, { kind: 'charge', count: 2, speed: 500 }, { kind: 'ring', count: 16, speed: 190 }],
    ],
  },
  wyvern: {
    archetype: 'wyvern',
    name: 'Wyverne de givre',
    radius: 32,
    speed: 80,
    flying: true,
    contact: 110,
    shotDmg: 95,
    phases: [
      [{ kind: 'rain', count: 6, radius: 50 }, { kind: 'aimed', count: 3, speed: 320, spread: 24, repeats: 3, interval: 0.4 }],
      [{ kind: 'charge', count: 1, speed: 520 }, { kind: 'ring', count: 16, speed: 180, repeats: 2, interval: 0.5 }],
      [{ kind: 'spiral', count: 5, speed: 190, repeats: 10, interval: 0.2 }, { kind: 'rain', count: 8, radius: 50 }, { kind: 'charge', count: 2, speed: 540 }],
    ],
  },
  ashlord: {
    archetype: 'ashlord',
    name: 'Seigneur des cendres',
    radius: 34,
    speed: 40,
    flying: false,
    contact: 120,
    shotDmg: 100,
    phases: [
      [{ kind: 'puddles', count: 4, radius: 52 }, { kind: 'ring', count: 14, speed: 180 }],
      [{ kind: 'summon', count: 2, minion: 'mage' }, { kind: 'slam', count: 1, radius: 130 }, { kind: 'aimed', count: 5, speed: 300, spread: 50, repeats: 2, interval: 0.5 }],
      [{ kind: 'spiral', count: 6, speed: 200, repeats: 12, interval: 0.2 }, { kind: 'puddles', count: 6, radius: 52 }, { kind: 'slam', count: 1, radius: 150 }],
    ],
  },
};

// ──────────────────────────── Pouvoirs ────────────────────────────

export type Rarity = 'common' | 'rare' | 'epic';
export type PowerFamily = 'shot' | 'power' | 'element' | 'defense' | 'mobility';

export type PowerId =
  | 'multishot'
  | 'rearShot'
  | 'diagonals'
  | 'sideShots'
  | 'ricochet'
  | 'pierce'
  | 'wallBounce'
  | 'attackSpeed'
  | 'damage'
  | 'crit'
  | 'eliteSlayer'
  | 'flame'
  | 'frost'
  | 'chain'
  | 'poison'
  | 'blast'
  | 'orb'
  | 'shield'
  | 'lifesteal'
  | 'maxHp'
  | 'speed'
  | 'dodge'
  | 'flashStep'
  | 'magnet';

export interface PowerDef {
  id: PowerId;
  name: string;
  family: PowerFamily;
  rarity: Rarity;
  /** Nombre de prises maximum dans un même niveau. */
  maxStacks: number;
  desc: string;
}

export const POWERS: PowerDef[] = [
  { id: 'multishot', name: 'Multitir', family: 'shot', rarity: 'epic', maxStacks: 2, desc: '+1 flèche, −10 % de dégâts' },
  { id: 'rearShot', name: 'Tir arrière', family: 'shot', rarity: 'common', maxStacks: 1, desc: 'Une flèche part aussi vers l’arrière' },
  { id: 'diagonals', name: 'Diagonales', family: 'shot', rarity: 'rare', maxStacks: 1, desc: 'Deux flèches en diagonale' },
  { id: 'sideShots', name: 'Tirs latéraux', family: 'shot', rarity: 'common', maxStacks: 1, desc: 'Deux flèches sur les côtés' },
  { id: 'ricochet', name: 'Ricochet', family: 'shot', rarity: 'epic', maxStacks: 1, desc: 'La flèche rebondit sur 2 ennemis' },
  { id: 'pierce', name: 'Perforation', family: 'shot', rarity: 'rare', maxStacks: 1, desc: 'La flèche traverse les ennemis' },
  { id: 'wallBounce', name: 'Rebond mural', family: 'shot', rarity: 'common', maxStacks: 1, desc: 'La flèche rebondit sur les murs' },
  { id: 'attackSpeed', name: 'Cadence +25 %', family: 'power', rarity: 'common', maxStacks: 3, desc: 'Tire 25 % plus vite' },
  { id: 'damage', name: 'Dégâts +20 %', family: 'power', rarity: 'common', maxStacks: 3, desc: '+20 % de dégâts' },
  { id: 'crit', name: 'Critique', family: 'power', rarity: 'rare', maxStacks: 2, desc: '15 % de chances de doubler les dégâts' },
  { id: 'eliteSlayer', name: "Tueur d'élites", family: 'power', rarity: 'rare', maxStacks: 1, desc: '+50 % contre élites et boss' },
  { id: 'flame', name: 'Flamme', family: 'element', rarity: 'common', maxStacks: 1, desc: 'Brûle : 20 %/s pendant 2 s' },
  { id: 'frost', name: 'Givre', family: 'element', rarity: 'common', maxStacks: 1, desc: 'Ralentit de 30 % pendant 1,5 s' },
  { id: 'chain', name: 'Foudre en chaîne', family: 'element', rarity: 'epic', maxStacks: 1, desc: 'Arc sur 3 cibles (40 %)' },
  { id: 'poison', name: 'Poison', family: 'element', rarity: 'common', maxStacks: 1, desc: 'Poison cumulable (8 %/s par dose)' },
  { id: 'blast', name: 'Déflagration', family: 'element', rarity: 'rare', maxStacks: 1, desc: 'Les ennemis tués explosent (50 %)' },
  { id: 'orb', name: 'Orbe gardien', family: 'defense', rarity: 'epic', maxStacks: 1, desc: 'Un orbe tourne et inflige 80 dégâts' },
  { id: 'shield', name: 'Bouclier', family: 'defense', rarity: 'common', maxStacks: 1, desc: 'Absorbe 1 coup toutes les 8 s' },
  { id: 'lifesteal', name: 'Vol de vie', family: 'defense', rarity: 'rare', maxStacks: 1, desc: 'Soigne de 2 % des dégâts infligés' },
  { id: 'maxHp', name: 'PV max +20 %', family: 'defense', rarity: 'common', maxStacks: 3, desc: '+20 % PV max et soigne d’autant' },
  { id: 'speed', name: 'Vitesse +15 %', family: 'mobility', rarity: 'common', maxStacks: 2, desc: 'Déplacement 15 % plus rapide' },
  { id: 'dodge', name: 'Esquive', family: 'mobility', rarity: 'rare', maxStacks: 1, desc: '10 % de chances d’éviter un coup' },
  { id: 'flashStep', name: 'Pas éclair', family: 'mobility', rarity: 'rare', maxStacks: 1, desc: 'Invulnérable 0,3 s après un arrêt' },
  { id: 'magnet', name: 'Aimant à soins', family: 'mobility', rarity: 'common', maxStacks: 1, desc: 'Attire les orbes de soin (+50 %)' },
];

export const POWER_BY_ID: Record<PowerId, PowerDef> = Object.fromEntries(POWERS.map((p) => [p.id, p])) as Record<PowerId, PowerDef>;

// ──────────────────────────── Héros ────────────────────────────

export type HeroId = 'scout' | 'windMonk' | 'emberSorcerer';
export interface HeroDef {
  id: HeroId;
  name: string;
  /** Petit pouvoir de départ propre (équilibré par les bots). */
  startPower: PowerId | null;
  shotShape: 'arrow' | 'gust' | 'ember';
}
export const HEROES: Record<HeroId, HeroDef> = {
  scout: { id: 'scout', name: "L'Éclaireuse", startPower: null, shotShape: 'arrow' },
  windMonk: { id: 'windMonk', name: 'Moine du vent', startPower: 'speed', shotShape: 'gust' },
  emberSorcerer: { id: 'emberSorcerer', name: 'Sorcier de braise', startPower: 'flame', shotShape: 'ember' },
};
