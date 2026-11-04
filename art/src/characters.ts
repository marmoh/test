/**
 * Personnages dessinés en vectoriel et animés procéduralement : des marionnettes d'ombre
 * articulées (pièces épinglées, rivets et dentelle découpés). Chaque fonction dessine centrée
 * sur l'origine, à l'échelle 1 pt = 1 unité ; le pipeline d'atlas les rastérise en @2x/@3x,
 * le web les dessine en direct.
 *
 * Vocabulaire commun (pose, épingles, perforations, télégraphes) : `rig.ts`.
 * Héros : `heroes.ts`. Monstres : `monsters.ts`. Boss : `bosses.ts`.
 */
import type { Painter } from './rig.js';
import { drawScout, drawWindMonk, drawEmberSorcerer } from './heroes.js';
import { drawGoblin, drawJelly, drawBat, drawMushroom, drawWolf, drawSkeleton, drawTotem, drawMage, drawMoth, drawSnipper } from './monsters.js';
import { drawTreant, drawQueen, drawScorpion, drawWyvern, drawAshlord } from './bosses.js';

export type { AnimState, Pose, Painter } from './rig.js';
export {
  drawScout, drawWindMonk, drawEmberSorcerer,
  drawGoblin, drawJelly, drawBat, drawMushroom, drawWolf, drawSkeleton, drawTotem, drawMage, drawMoth, drawSnipper,
  drawTreant, drawQueen, drawScorpion, drawWyvern, drawAshlord,
};

export const PAINTERS: Record<string, Painter> = {
  hero: drawScout,
  scout: drawScout,
  windMonk: drawWindMonk,
  emberSorcerer: drawEmberSorcerer,
  goblin: drawGoblin,
  jelly: drawJelly,
  jellySmall: (ctx, p) => drawJelly(ctx, { ...p, variant: 1 }),
  bat: drawBat,
  mushroom: drawMushroom,
  wolf: drawWolf,
  skeleton: drawSkeleton,
  totem: drawTotem,
  mage: drawMage,
  moth: drawMoth,
  snipper: drawSnipper,
  treant: drawTreant,
  queen: drawQueen,
  scorpion: drawScorpion,
  wyvern: drawWyvern,
  ashlord: drawAshlord,
};
