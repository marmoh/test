/** §5 et §6 : définitions des ennemis, boss et pouvoirs. */

export type EnemyType =
  | 'goblin' | 'mushroom' | 'wolf' | 'skeleton' | 'jelly' | 'totem' | 'bat' | 'mage' | 'moth' | 'snipper'
  // chapitres 11 à 15 (DECISIONS #73)
  | 'lantern' | 'weaver' | 'beetle' | 'puppeteer' | 'specter';
/** `shade` : ombre invoquée par le montreur d'ombres (jamais tirée par le générateur). */
export type MinionType = EnemyType | 'jellySmall' | 'shade';

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
  /** Tireurs : distance gardée [recul en deçà, approche au-delà] (pt). */
  range?: [number, number];
}

export const ENEMIES: Record<MinionType, EnemyDef> = {
  goblin: { type: 'goblin', name: 'Gobelin frondeur', hp: 220, contact: 60, speed: 70, radius: 15, flying: false, shotDmg: 80, cost: 2, period: 3.0, range: [0, 250] },
  mushroom: { type: 'mushroom', name: 'Champignon-spore', hp: 300, contact: 50, speed: 0, radius: 16, flying: false, shotDmg: 60, cost: 3, period: 3 },
  wolf: { type: 'wolf', name: "Loup d'ombre", hp: 260, contact: 120, speed: 90, radius: 16, flying: false, shotDmg: 0, cost: 3, period: 3.2 },
  skeleton: { type: 'skeleton', name: 'Archer squelette', hp: 200, contact: 40, speed: 60, radius: 14, flying: false, shotDmg: 70, cost: 3, period: 3.2, range: [120, 300] },
  jelly: { type: 'jelly', name: 'Gelée', hp: 380, contact: 70, speed: 55, radius: 18, flying: false, shotDmg: 0, cost: 3, period: 0 },
  jellySmall: { type: 'jellySmall', name: 'Petite gelée', hp: 120, contact: 70, speed: 70, radius: 11, flying: false, shotDmg: 0, cost: 0, period: 0 },
  totem: { type: 'totem', name: 'Totem runique', hp: 500, contact: 0, speed: 0, radius: 18, flying: false, shotDmg: 60, cost: 4, period: 2 },
  bat: { type: 'bat', name: 'Chauve-souris', hp: 120, contact: 70, speed: 140, radius: 12, flying: true, shotDmg: 0, cost: 2, period: 2 },
  mage: { type: 'mage', name: 'Mage de braise', hp: 340, contact: 50, speed: 50, radius: 15, flying: false, shotDmg: 60, cost: 5, period: 3.4, range: [110, 280] },
  // Ciseaux de lune : ennemis qui s'en prennent au fil de découpe
  moth: { type: 'moth', name: 'Mite de papier', hp: 100, contact: 40, speed: 105, radius: 12, flying: true, shotDmg: 0, cost: 2, period: 0.6 },
  snipper: { type: 'snipper', name: 'Crabe-ciseaux', hp: 320, contact: 90, speed: 62, radius: 16, flying: false, shotDmg: 0, cost: 3, period: 3 },
  // chapitres 11 à 15 : une mécanique nouvelle chacun (DECISIONS #73)
  /** fonce, s'arrête près de l'héroïne et explose après un télégraphe de 0,8 s */
  lantern: { type: 'lantern', name: 'Lampion', hp: 150, contact: 0, speed: 112, radius: 13, flying: false, shotDmg: 120, cost: 2, period: 0 },
  /** crache une toile qui ralentit l'héroïne (sans dégâts) */
  weaver: { type: 'weaver', name: 'Araignée tisseuse', hp: 240, contact: 50, speed: 70, radius: 14, flying: false, shotDmg: 0, cost: 3, period: 3.6, range: [130, 270] },
  /** bouclier frontal : les aiguilles venant de face rebondissent ; coup de bouclier au sol télégraphié */
  beetle: { type: 'beetle', name: 'Scarabée-bouclier', hp: 420, contact: 55, speed: 45, radius: 18, flying: false, shotDmg: 0, cost: 4, period: 3.6 },
  /** garde ses distances et invoque deux ombres */
  puppeteer: { type: 'puppeteer', name: "Montreur d'ombres", hp: 300, contact: 40, speed: 55, radius: 15, flying: false, shotDmg: 0, cost: 4, period: 6.5, range: [150, 300] },
  shade: { type: 'shade', name: 'Ombre', hp: 70, contact: 50, speed: 122, radius: 10, flying: false, shotDmg: 0, cost: 0, period: 0 },
  /** se téléporte près de l'héroïne (marque télégraphiée) puis lâche un anneau */
  specter: { type: 'specter', name: 'Spectre de papier', hp: 260, contact: 50, speed: 32, radius: 14, flying: true, shotDmg: 65, cost: 4, period: 3.8 },
};

/**
 * Ordre d'apparition : un nouveau type à chaque chapitre (DECISIONS #29), introduit seul dans la
 * salle tutoriel du niveau p = 1. Gobelin (1 : boucler autour d'un tireur), chauve-souris (2 : volante et rapide),
 * gelée (3 : un poursuivant qui se divise), mite (4 : elle mange le fil, on l'abat aux aiguilles), crabe-ciseaux
 * (5 : sa charge tranche le fil) ; DECISIONS #32 et #39 (seuls la mite et le crabe coupent le fil).
 */
export const UNLOCK_ORDER: EnemyType[] = ['goblin', 'bat', 'jelly', 'moth', 'snipper', 'mushroom', 'wolf', 'skeleton', 'totem', 'mage', 'lantern', 'weaver', 'beetle', 'puppeteer', 'specter'];

export function unlockedEnemies(chapter: number): EnemyType[] {
  return UNLOCK_ORDER.slice(0, Math.min(UNLOCK_ORDER.length, chapter));
}

/** Type introduit au début de ce chapitre (salle tutoriel), ou null. */
export function newEnemyAt(chapter: number): EnemyType | null {
  return chapter - 1 < UNLOCK_ORDER.length ? UNLOCK_ORDER[chapter - 1] : null;
}

/** Poids de tirage dans le remplissage du budget. */
export const SPAWN_WEIGHT: Record<EnemyType, number> = {
  moth: 0.35,
  snipper: 0.6,
  goblin: 0.9,
  mushroom: 0.8,
  wolf: 0.7,
  skeleton: 0.7,
  // ennemis au contact : la cible naturelle des boucles (ils poursuivent l'héroïne à l'intérieur du cercle)
  jelly: 1.0,
  totem: 0.6,
  bat: 0.8,
  mage: 0.6,
  lantern: 0.7,
  weaver: 0.6,
  beetle: 0.5,
  puppeteer: 0.45,
  specter: 0.55,
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
export type PowerFamily = 'thread' | 'wind' | 'ember' | 'shot' | 'power' | 'element' | 'defense' | 'mobility';
/** Familles « signature » : propres à un héros (première carte de chaque tirage, DECISIONS #71 et #74). */
export const SIGNATURE_FAMILIES: PowerFamily[] = ['thread', 'wind', 'ember'];

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
  | 'magnet'
  // famille Fil (Ciseaux de lune)
  | 'longThread'
  | 'steelThread'
  | 'barbedThread'
  | 'sharpScissors'
  | 'echoCut'
  | 'confetti'
  // famille Vent (Moine du vent)
  | 'bigGust'
  | 'keenGust'
  | 'quickMomentum'
  | 'eyeOfStorm'
  | 'whirlwind'
  | 'featherStep'
  // famille Braise (Sorcier de braise)
  | 'liveEmbers'
  | 'blaze'
  | 'wideTrail'
  | 'combustion'
  | 'ashWard'
  | 'furnace';

export interface PowerDef {
  id: PowerId;
  name: string;
  family: PowerFamily;
  rarity: Rarity;
  /** Nombre de prises maximum dans un même niveau. */
  maxStacks: number;
  desc: string;
}

/**
 * 24 pouvoirs (DECISIONS #28) : la famille Fil remplace les tirs « à la Archero » (tir arrière, tirs latéraux,
 * rebond mural) ; Déflagration, Aimant à soins et Pas éclair sont retirés. 12 communs, 8 rares, 4 épiques.
 */
export const POWERS: PowerDef[] = [
  { id: 'longThread', name: 'Fil long', family: 'thread', rarity: 'common', maxStacks: 3, desc: 'Le fil dure 40 % plus longtemps' },
  { id: 'sharpScissors', name: 'Ciseaux affûtés', family: 'thread', rarity: 'common', maxStacks: 3, desc: '+30 % de dégâts de découpe' },
  { id: 'steelThread', name: "Fil d'acier", family: 'thread', rarity: 'rare', maxStacks: 1, desc: 'Ni les mites ni les crabes ne coupent le fil' },
  { id: 'barbedThread', name: 'Fil barbelé', family: 'thread', rarity: 'rare', maxStacks: 1, desc: 'Le fil blesse les ennemis qui le touchent' },
  { id: 'confetti', name: 'Confettis', family: 'thread', rarity: 'rare', maxStacks: 1, desc: 'Les découpés éclatent sur leurs voisins (40 %)' },
  { id: 'echoCut', name: 'Écho', family: 'thread', rarity: 'epic', maxStacks: 1, desc: 'Chaque découpe se répète 0,5 s après (50 %)' },
  { id: 'multishot', name: 'Multitir', family: 'shot', rarity: 'epic', maxStacks: 2, desc: '+1 aiguille, −40 % de dégâts par aiguille' },
  { id: 'ricochet', name: 'Ricochet', family: 'shot', rarity: 'epic', maxStacks: 1, desc: 'Rebondit sur un 2e ennemi (25 %)' },
  { id: 'pierce', name: 'Perforation', family: 'shot', rarity: 'rare', maxStacks: 1, desc: 'Traverse les ennemis (−15 % dégâts)' },
  { id: 'diagonals', name: 'Diagonales', family: 'shot', rarity: 'rare', maxStacks: 1, desc: 'Deux aiguilles en diagonale' },
  { id: 'attackSpeed', name: 'Cadence +25 %', family: 'power', rarity: 'common', maxStacks: 3, desc: 'Tire 25 % plus vite' },
  { id: 'damage', name: 'Dégâts +20 %', family: 'power', rarity: 'common', maxStacks: 3, desc: '+20 % de dégâts (aiguilles et découpes)' },
  { id: 'crit', name: 'Critique', family: 'power', rarity: 'rare', maxStacks: 2, desc: '15 % de chances de doubler les dégâts' },
  { id: 'eliteSlayer', name: "Tueur d'élites", family: 'power', rarity: 'common', maxStacks: 1, desc: '+50 % contre élites et boss' },
  { id: 'flame', name: 'Flamme', family: 'element', rarity: 'common', maxStacks: 1, desc: 'Brûle : 20 %/s pendant 2 s' },
  { id: 'frost', name: 'Givre', family: 'element', rarity: 'common', maxStacks: 1, desc: 'Ralentit de 40 % pendant 2 s' },
  { id: 'chain', name: 'Foudre en chaîne', family: 'element', rarity: 'epic', maxStacks: 1, desc: 'Arc sur 2 cibles (20 %)' },
  { id: 'poison', name: 'Poison', family: 'element', rarity: 'common', maxStacks: 1, desc: 'Poison cumulable (1,5 %/s par dose)' },
  { id: 'orb', name: 'Orbe gardien', family: 'defense', rarity: 'rare', maxStacks: 1, desc: 'Un orbe tourne et inflige 80 dégâts' },
  { id: 'shield', name: 'Bouclier', family: 'defense', rarity: 'common', maxStacks: 1, desc: 'Absorbe 1 coup toutes les 25 s' },
  { id: 'lifesteal', name: 'Vol de vie', family: 'defense', rarity: 'common', maxStacks: 1, desc: 'Soigne de 2 % des dégâts infligés' },
  { id: 'maxHp', name: 'PV max +20 %', family: 'defense', rarity: 'common', maxStacks: 3, desc: '+20 % PV max et soigne d’autant' },
  { id: 'speed', name: 'Vitesse +20 %', family: 'mobility', rarity: 'common', maxStacks: 2, desc: 'Déplacement 20 % plus rapide' },
  { id: 'dodge', name: 'Esquive', family: 'mobility', rarity: 'rare', maxStacks: 1, desc: '10 % de chances d’éviter un coup' },
  // Ajoutés à la fin : le tirage de l'Éclaireuse (famille Fil) reste identique au bit près (DECISIONS #74).
  { id: 'bigGust', name: 'Grand souffle', family: 'wind', rarity: 'common', maxStacks: 3, desc: 'Bourrasque 25 % plus large' },
  { id: 'keenGust', name: 'Rafale tranchante', family: 'wind', rarity: 'common', maxStacks: 3, desc: '+35 % de dégâts de bourrasque' },
  { id: 'quickMomentum', name: 'Élan rapide', family: 'wind', rarity: 'common', maxStacks: 2, desc: 'L’élan se charge 35 % plus vite' },
  { id: 'eyeOfStorm', name: 'Œil du cyclone', family: 'wind', rarity: 'rare', maxStacks: 1, desc: 'Renvoie les projectiles pris dans la bourrasque' },
  { id: 'whirlwind', name: 'Tourbillon', family: 'wind', rarity: 'rare', maxStacks: 1, desc: 'La bourrasque laisse un tourbillon qui aspire' },
  { id: 'featherStep', name: 'Pas de plume', family: 'wind', rarity: 'epic', maxStacks: 1, desc: 'Invulnérable 0,6 s après une bourrasque' },
  { id: 'liveEmbers', name: 'Braises vives', family: 'ember', rarity: 'common', maxStacks: 3, desc: 'La traînée dure 35 % plus longtemps' },
  { id: 'blaze', name: 'Brasier', family: 'ember', rarity: 'common', maxStacks: 3, desc: '+35 % de dégâts de brûlure' },
  { id: 'wideTrail', name: 'Traînée large', family: 'ember', rarity: 'common', maxStacks: 2, desc: 'Traînée 40 % plus large' },
  { id: 'combustion', name: 'Combustion', family: 'ember', rarity: 'rare', maxStacks: 1, desc: 'Un ennemi qui meurt en brûlant explose' },
  { id: 'ashWard', name: 'Cendres ardentes', family: 'ember', rarity: 'rare', maxStacks: 1, desc: 'Les projectiles ennemis brûlent dans la traînée' },
  { id: 'furnace', name: 'Fournaise', family: 'ember', rarity: 'epic', maxStacks: 1, desc: 'La traînée ralentit de 35 % et brûle 2 × plus' },
];

export const POWER_BY_ID: Record<PowerId, PowerDef> = Object.fromEntries(POWERS.map((p) => [p.id, p])) as Record<PowerId, PowerDef>;

// ──────────────────────────── Héros ────────────────────────────

export type HeroId = 'scout' | 'windMonk' | 'emberSorcerer';
/**
 * Mécanique signature (DECISIONS #74) : chaque héros joue autrement.
 * - thread : Ciseaux de lune — refermer une boucle de fil découpe ce qu'elle entoure.
 * - gust : Élan et bourrasque — courir charge l'élan, s'arrêter le libère en bourrasque (dégâts, recul, projectiles dissipés).
 * - ember : Traînée de braises — la route du héros brûle derrière lui ; on attire les poursuivants dans le feu.
 */
export type HeroKind = 'thread' | 'gust' | 'ember';
export interface HeroDef {
  id: HeroId;
  name: string;
  kind: HeroKind;
  /** Famille de pouvoirs signature (première carte de chaque tirage). */
  family: PowerFamily;
  /** Petit pouvoir de départ propre (équilibré par les bots). */
  startPower: PowerId | null;
  shotShape: 'arrow' | 'gust' | 'ember';
  /** Nom de la mécanique et phrase d'accroche (écrans). */
  mechanic: string;
  pitch: string;
}
export const HEROES: Record<HeroId, HeroDef> = {
  scout: { id: 'scout', name: "L'Éclaireuse", kind: 'thread', family: 'thread', startPower: null, shotShape: 'arrow', mechanic: 'Ciseaux de lune', pitch: 'Entoure tes ennemis de ton fil : la boucle refermée les découpe.' },
  windMonk: { id: 'windMonk', name: 'Moine du vent', kind: 'gust', family: 'wind', startPower: null, shotShape: 'gust', mechanic: 'Élan et bourrasque', pitch: 'Cours pour prendre de l’élan, arrête-toi : la bourrasque balaie tout autour de toi.' },
  emberSorcerer: { id: 'emberSorcerer', name: 'Sorcier de braise', kind: 'ember', family: 'ember', startPower: null, shotShape: 'ember', mechanic: 'Traînée de braises', pitch: 'Tes pas laissent des braises : attire tes poursuivants dans le feu.' },
};
