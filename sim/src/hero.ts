/** §4 Héros : statistiques effectives (base × talents × pouvoirs). */
import { HERO, TALENTS, POWER_TUNING } from './constants.js';
import type { PowerId } from './content.js';

export interface Talents {
  vigor: number;
  strength: number;
  agility: number;
  fortune: number;
}

export const NO_TALENTS: Talents = { vigor: 0, strength: 0, agility: 0, fortune: 0 };

export function talentsAtRank(rank: number): Talents {
  return { vigor: rank, strength: rank, agility: rank, fortune: rank };
}

export interface HeroStats {
  maxHp: number;
  damage: number;
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
}

export function computeStats(talents: Talents, powers: Partial<Record<PowerId, number>>): HeroStats {
  const n = (id: PowerId) => powers[id] ?? 0;
  const hpMult = (1 + TALENTS.hpPerRank * talents.vigor) * (1 + 0.2 * n('maxHp'));
  const dmgMult = (1 + TALENTS.damagePerRank * talents.strength) * (1 + 0.2 * n('damage')) * Math.pow(POWER_TUNING.multishotDmg, n('multishot'));
  const rateMult = (1 + TALENTS.fireRatePerRank * talents.agility) * (1 + 0.25 * n('attackSpeed'));
  return {
    maxHp: Math.round(HERO.hp * hpMult),
    damage: HERO.damage * dmgMult,
    fireRate: HERO.fireRate * rateMult,
    speed: HERO.speed * (1 + POWER_TUNING.speedPerStack * n('speed')),
    multishot: n('multishot'),
    rearShot: n('rearShot') > 0,
    diagonals: n('diagonals') > 0,
    sideShots: n('sideShots') > 0,
    ricochet: n('ricochet') > 0 ? POWER_TUNING.ricochetBounces : 0,
    pierce: n('pierce') > 0,
    wallBounce: n('wallBounce') > 0 ? 2 : 0,
    critChance: Math.min(0.6, 0.15 * n('crit')),
    eliteMult: n('eliteSlayer') > 0 ? 1.5 : 1,
    flame: n('flame') > 0,
    frost: n('frost') > 0,
    chain: n('chain') > 0,
    poison: n('poison') > 0,
    blast: n('blast') > 0,
    orb: n('orb') > 0,
    shield: n('shield') > 0,
    lifesteal: n('lifesteal') > 0 ? 0.02 : 0,
    dodge: n('dodge') > 0 ? 0.1 : 0,
    flashStep: n('flashStep') > 0,
    magnet: n('magnet') > 0,
  };
}
