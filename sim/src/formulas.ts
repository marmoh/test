/** §7, §8, §10 : formules pures de progression. */
import { LEVELS_PER_CHAPTER, CHAPTERS_PER_KINGDOM, STAR_THRESHOLDS, LIVES, BUDGET } from './constants.js';

export type LevelKind = 'tutorial' | 'breather' | 'normal' | 'hard' | 'boss';

export interface LevelInfo {
  n: number;
  chapter: number;
  position: number;
  kingdom: number;
  D: number;
  mult: number;
  kind: LevelKind;
  rooms: number;
}

export function chapterOf(n: number): number {
  return Math.ceil(n / LEVELS_PER_CHAPTER);
}
export function positionOf(n: number): number {
  return n - LEVELS_PER_CHAPTER * (chapterOf(n) - 1);
}
export function kingdomOf(n: number): number {
  return Math.ceil(chapterOf(n) / CHAPTERS_PER_KINGDOM);
}

/** D(n) = 1 + 0,055 × (n − 1)^0,93 */
export function baseDifficulty(n: number): number {
  return 1 + 0.055 * Math.pow(n - 1, 0.93);
}

/** Dents de scie. */
export function sawMult(p: number): number {
  if (p >= 1 && p <= 3) return 0.85;
  if (p === 7 || p === 14) return 1.35;
  if (p === 20) return 1.55;
  return 1.0;
}

export function roomCount(n: number): number {
  if (n <= 20) return 2;
  if (n <= 120) return 3;
  return 4;
}

export function levelKind(n: number): LevelKind {
  const p = positionOf(n);
  if (p === 20) return 'boss';
  if (p === 7 || p === 14) return 'hard';
  if (p === 1) return 'tutorial';
  if (p <= 3) return 'breather';
  return 'normal';
}

export function levelInfo(n: number): LevelInfo {
  const p = positionOf(n);
  return {
    n,
    chapter: chapterOf(n),
    position: p,
    kingdom: kingdomOf(n),
    D: baseDifficulty(n),
    mult: sawMult(p),
    kind: levelKind(n),
    rooms: roomCount(n),
  };
}

/** P(D) : progression attendue du joueur, qui divise le budget (cf. BUDGET, DECISIONS). */
export function expectedPower(D: number): number {
  return 1 + BUDGET.powerPerD * (D - 1);
}

/**
 * Budget d'une salle : SPEC `6 + 3,2 × D × mult × (0,8 + 0,2 × indexSalle)` (indexSalle commence à 1),
 * multiplié par le facteur du nombre de salles et divisé par P(D), puis × échelle du générateur.
 */
export function roomBudget(D: number, mult: number, roomIndex1: number, budgetScale = 1, rooms = 3): number {
  const k = BUDGET.byRooms[rooms] ?? BUDGET.byRooms[3];
  return Math.round(((k * (BUDGET.base + BUDGET.perD * D * mult * (0.8 + 0.2 * roomIndex1))) / expectedPower(D)) * budgetScale);
}

export function stars(won: boolean, hpFrac: number): 0 | 1 | 2 | 3 {
  if (!won) return 0;
  if (hpFrac >= STAR_THRESHOLDS.three) return 3;
  if (hpFrac >= STAR_THRESHOLDS.two) return 2;
  return 1;
}

/** Or : 20 + 2n ; ×1,5 la première fois à 3 étoiles ; bonus Fortune / abonnement multiplicatifs. */
export function goldReward(n: number, firstThreeStars: boolean, goldBonus = 0): number {
  let g = 20 + 2 * n;
  if (firstThreeStars) g *= 1.5;
  return Math.round(g * (1 + goldBonus));
}

/** Coffres d'étoiles : un tous les 20 ★. */
export function starChestsEarned(totalStars: number): number {
  return Math.floor(totalStars / 20);
}

/** §10 Score de tournoi. */
export function tournamentScore(kills: number, hpLeft: number, seconds: number): number {
  return kills * 100 + Math.round(hpLeft) * 5 + Math.max(0, Math.floor(240 - seconds)) * 40;
}

/** Semaine ISO (année, semaine) d'une date UTC — graine du tournoi. */
export function isoWeek(date: Date): { year: number; week: number } {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { year: d.getUTCFullYear(), week };
}

export function tournamentSeed(date: Date): number {
  const { year, week } = isoWeek(date);
  return year * 100 + week;
}

/** §8 Vies : état stocké = (vies, horodatage de référence). Pur, testable. */
export interface LivesState {
  lives: number;
  /** Instant (s) à partir duquel court la prochaine recharge ; ignoré si plein. */
  refillFrom: number;
}

export function livesAt(state: LivesState, now: number): LivesState {
  if (state.lives >= LIVES.max) return { lives: state.lives, refillFrom: now };
  const gained = Math.floor((now - state.refillFrom) / LIVES.regenSeconds);
  if (gained <= 0) return state;
  const lives = Math.min(LIVES.max, state.lives + gained);
  if (lives >= LIVES.max) return { lives, refillFrom: now };
  return { lives, refillFrom: state.refillFrom + gained * LIVES.regenSeconds };
}

export function secondsToNextLife(state: LivesState, now: number): number | null {
  const s = livesAt(state, now);
  if (s.lives >= LIVES.max) return null;
  return LIVES.regenSeconds - (now - s.refillFrom);
}

/** Une défaite coûte une vie ; une victoire ne coûte rien. Abonnés : vies illimitées. */
export function afterAttempt(state: LivesState, now: number, won: boolean, unlimited = false): LivesState {
  const s = livesAt(state, now);
  if (won || unlimited) return s;
  const wasFull = s.lives >= LIVES.max;
  return { lives: Math.max(0, s.lives - 1), refillFrom: wasFull ? now : s.refillFrom };
}
