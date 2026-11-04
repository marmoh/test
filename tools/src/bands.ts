/** §9 Bandes cibles de taux de réussite (1er essai) par type de niveau. */
import { levelInfo } from '../../sim/src/formulas.js';

export interface Band {
  name: string;
  moyen: [number, number];
  expert: number;
}

export const FLOOR = { moyen: 0.15, expert: 0.7 } as const;

export function bandFor(n: number): Band {
  const info = levelInfo(n);
  if (info.kind === 'boss') return { name: 'Boss', moyen: [0.25, 0.4], expert: 0.75 };
  // « Chapitres 1–2 (hors boss) » : y compris leurs niveaux à crâne (DECISIONS #25)
  if (info.chapter <= 2) return { name: 'Chapitres 1–2', moyen: [0.85, 0.97], expert: 0.98 };
  if (info.kind === 'hard') return { name: 'Difficile', moyen: [0.3, 0.45], expert: 0.8 };
  return { name: 'Normal', moyen: [0.55, 0.8], expert: 0.92 };
}

export function inBand(b: Band, moyen: number, expert: number): boolean {
  return moyen >= b.moyen[0] && moyen <= b.moyen[1] && expert >= b.expert && moyen >= FLOOR.moyen && expert >= FLOOR.expert;
}
