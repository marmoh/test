/** Sauvegarde locale du prototype (mêmes champs que la persistance iOS). */
import { livesAt, afterAttempt, type LivesState } from '../../sim/src/formulas.js';

export interface Save {
  version: 1;
  stars: Record<number, number>;
  unlocked: number;
  lives: LivesState;
  gems: number;
  gold: number;
  settings: { sound: boolean; haptics: boolean; autoFire: boolean; reduceMotion: boolean };
  bonuses: { potion: number; scroll: number; aegis: number };
  heroId: 'scout' | 'windMonk' | 'emberSorcerer';
  heroes: string[];
  talents: { vigor: number; strength: number; agility: number; fortune: number };
  tournament: { week: string; attempts: number; best: number };
  starterPack: boolean;
}

const KEY = 'ombrelune.save.v1';
const now = () => Date.now() / 1000;

function fresh(): Save {
  return {
    version: 1,
    stars: {},
    unlocked: 1,
    lives: { lives: 5, refillFrom: now() },
    gems: 120,
    gold: 300,
    settings: { sound: true, haptics: true, autoFire: false, reduceMotion: false },
    bonuses: { potion: 1, scroll: 1, aegis: 1 },
    heroId: 'scout',
    heroes: ['scout'],
    talents: { vigor: 0, strength: 0, agility: 0, fortune: 0 },
    tournament: { week: '', attempts: 5, best: 0 },
    starterPack: false,
  };
}

let cache: Save | null = null;

export function save(): Save {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...fresh(), ...JSON.parse(raw) } : fresh();
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

export function lives(): LivesState {
  const s = save();
  s.lives = livesAt(s.lives, now());
  return s.lives;
}

export function recordAttempt(n: number, won: boolean, stars: number): { firstThree: boolean } {
  const s = save();
  s.lives = afterAttempt(s.lives, now(), won);
  const prev = s.stars[n] ?? 0;
  const firstThree = won && stars === 3 && prev < 3;
  if (won) {
    s.stars[n] = Math.max(prev, stars);
    s.unlocked = Math.max(s.unlocked, n + 1);
  }
  persist();
  return { firstThree };
}

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
