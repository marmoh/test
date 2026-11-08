/** §4 Héros : statistiques effectives (base × talents × pouvoirs). */
import { HERO, TALENTS, POWER_TUNING, LONG_THREAD_PER_STACK } from './constants.js';
import type { PowerId } from './content.js';
import { NO_GEAR, type GearStats } from './gear.js';

export interface Talents {
  vigor: number;
  strength: number;
  agility: number;
  fortune: number;
  /** « Encre lente » : le fil dure plus longtemps (DECISIONS #71) */
  ink: number;
}

export const NO_TALENTS: Talents = { vigor: 0, strength: 0, agility: 0, fortune: 0, ink: 0 };

export function talentsAtRank(rank: number): Talents {
  return { vigor: rank, strength: rank, agility: rank, fortune: rank, ink: rank };
}

export interface HeroStats {
  maxHp: number;
  damage: number;
  /** Multiplicateur des aiguilles seules (Multitir : −40 % par prise ; les découpes n'en pâtissent pas, DECISIONS #44). */
  needleMult: number;
  fireRate: number;
  speed: number;
  multishot: number;
  rearShot: boolean;
  diagonals: boolean;
  sideShots: boolean;
  ricochet: number;
  pierce: boolean;
  wallBounce: number;
  critChance: number;
  eliteMult: number;
  flame: boolean;
  frost: boolean;
  chain: boolean;
  poison: boolean;
  blast: boolean;
  orb: boolean;
  shield: boolean;
  lifesteal: number;
  dodge: number;
  flashStep: boolean;
  magnet: boolean;
  /** Ciseaux de lune */
  threadLife: number;
  steelThread: boolean;
  barbedThread: boolean;
  cutMult: number;
  echoCut: boolean;
  confetti: boolean;
  /** Moine du vent (DECISIONS #74) */
  gustRadiusMult: number;
  gustDmgMult: number;
  momentumRate: number;
  eyeOfStorm: boolean;
  whirlwind: boolean;
  featherStep: boolean;
  /** Sorcier de braise (DECISIONS #74) */
  emberLife: number;
  emberDmgMult: number;
  emberWidth: number;
  combustion: boolean;
  ashWard: boolean;
  furnace: boolean;
}

/**
 * Statistiques effectives. `gear` (équipement, DECISIONS #75) multiplie en dernier : sans équipement (NO_GEAR)
 * chaque facteur vaut exactement 1, le résultat est identique au bit près à l'ancien calcul (traces de parité).
 */
export function computeStats(talents: Talents, powers: Partial<Record<PowerId, number>>, gear: GearStats = NO_GEAR): HeroStats {
  const n = (id: PowerId) => powers[id] ?? 0;
  const hpMult = (1 + TALENTS.hpPerRank * talents.vigor) * (1 + 0.2 * n('maxHp')) * (1 + gear.hp);
  const dmgMult = (1 + TALENTS.damagePerRank * talents.strength) * (1 + 0.2 * n('damage')) * (1 + gear.dmg);
  const rateMult = (1 + TALENTS.fireRatePerRank * talents.agility) * (1 + 0.25 * n('attackSpeed')) * (1 + gear.rate);
  const sig = 1 + gear.sig;
  return {
    maxHp: Math.round(HERO.hp * hpMult),
    damage: HERO.damage * dmgMult,
    needleMult: Math.pow(POWER_TUNING.multishotDmg, n('multishot')),
    fireRate: HERO.fireRate * rateMult,
    speed: HERO.speed * (1 + POWER_TUNING.speedPerStack * n('speed')) * (1 + gear.speed),
    multishot: n('multishot'),
    rearShot: n('rearShot') > 0,
    diagonals: n('diagonals') > 0,
    sideShots: n('sideShots') > 0,
    ricochet: n('ricochet') > 0 ? POWER_TUNING.ricochetBounces : 0,
    pierce: n('pierce') > 0,
    wallBounce: n('wallBounce') > 0 ? 2 : 0,
    critChance: Math.min(0.6, 0.15 * n('crit') + gear.crit),
    eliteMult: n('eliteSlayer') > 0 ? 1.5 : 1,
    flame: n('flame') > 0,
    frost: n('frost') > 0,
    chain: n('chain') > 0,
    poison: n('poison') > 0,
    blast: n('blast') > 0,
    orb: n('orb') > 0,
    shield: n('shield') > 0,
    lifesteal: n('lifesteal') > 0 ? 0.02 : 0,
    dodge: Math.min(0.4, (n('dodge') > 0 ? 0.1 : 0) + gear.dodge),
    flashStep: n('flashStep') > 0,
    magnet: n('magnet') > 0,
    threadLife: (1 + TALENTS.inkPerRank * (talents.ink ?? 0)) * (1 + LONG_THREAD_PER_STACK * n('longThread')),
    steelThread: n('steelThread') > 0,
    barbedThread: n('barbedThread') > 0,
    cutMult: (1 + 0.3 * n('sharpScissors')) * sig,
    echoCut: n('echoCut') > 0,
    confetti: n('confetti') > 0,
    gustRadiusMult: 1 + 0.25 * n('bigGust'),
    gustDmgMult: (1 + 0.35 * n('keenGust')) * sig,
    momentumRate: 1 + 0.35 * n('quickMomentum'),
    eyeOfStorm: n('eyeOfStorm') > 0,
    whirlwind: n('whirlwind') > 0,
    featherStep: n('featherStep') > 0,
    emberLife: 1 + 0.35 * n('liveEmbers'),
    emberDmgMult: (1 + 0.35 * n('blaze')) * (n('furnace') > 0 ? 2 : 1) * sig,
    emberWidth: 1 + 0.4 * n('wideTrail'),
    combustion: n('combustion') > 0,
    ashWard: n('ashWard') > 0,
    furnace: n('furnace') > 0,
  };
}
