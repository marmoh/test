/**
 * Apparence exclusive de l'Ordre du Dragon : la « Parure du Dragon ».
 * Deux cornes de papier noir bordées d'or à la feuille sur la capuche et un col d'écailles d'or.
 * Purement cosmétique (§11) : aucun effet sur la simulation.
 *
 * Les dessins des héros vivent dans `art/src/characters.ts` ; on ne les modifie pas : on enveloppe
 * leurs fonctions de dessin dans `PAINTERS` (combat, carte, portraits, écran titre en profitent).
 */
import { PAINTERS, drawScout, type Pose } from '../../art/src/characters.js';
import { INK, GOLD_LEAF, CUT, JADE } from '../../art/src/palette.js';
import type { SkinId } from './season.js';

type Ctx = CanvasRenderingContext2D;
const HEROES = ['hero', 'scout', 'windMonk', 'emberSorcerer'] as const;
let installed = false;

/** Même balancement vertical que les marionnettes de héros (`heroBody`, `drawScout`). */
function bobOf(p: Pose): number {
  return p.state === 'move' ? Math.abs(Math.sin(p.t * 15)) * 2.6 : Math.sin(p.t * 2.4) * 0.7;
}

export function drawDragonParure(ctx: Ctx, p: Pose): void {
  const fx = Math.cos(p.facing) < -0.1 ? -1 : 1;
  const hx = fx * 1.2;
  ctx.save();
  if (p.blink && Math.floor(p.t * 16) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.translate(0, -bobOf(p));
  ctx.lineJoin = 'round';
  // col d'écailles : cinq demi-lunes d'or cernées d'encre
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.arc(i * 3.2, -5.5 + Math.abs(i) * 0.6, 2.3, 0, Math.PI);
    ctx.closePath();
    ctx.fillStyle = GOLD_LEAF;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
  // cornes : découpées dans l'encre, recourbées vers l'arrière, liseré d'or
  const sway = Math.sin(p.t * 1.6) * 0.6;
  for (const side of [-1, 1]) {
    const bx = hx + side * 4.2;
    ctx.beginPath();
    ctx.moveTo(bx - 2.2, -18.5);
    ctx.quadraticCurveTo(bx + side * 1.5 - fx * 3, -27 + sway, bx + side * 3 - fx * 7, -28 + sway);
    ctx.quadraticCurveTo(bx + side * 0.5 - fx * 1.5, -24, bx + 2.2, -19);
    ctx.closePath();
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = GOLD_LEAF;
    ctx.stroke();
  }
  // crête : trois pointes d'or sur le sommet de la capuche
  ctx.beginPath();
  ctx.moveTo(hx - fx * 2, -21.2);
  for (let i = 0; i < 3; i++) {
    const x0 = hx - fx * (2 + i * 2.6);
    ctx.lineTo(x0 - fx * 1.3, -24.6 + i * 0.9);
    ctx.lineTo(x0 - fx * 2.6, -21 + i * 0.6);
  }
  ctx.closePath();
  ctx.fillStyle = GOLD_LEAF;
  ctx.fill();
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.restore();
}

/** Enveloppe les dessins des héros ; `active()` dit si la parure est portée (abonné). */
export function installDragonSkin(active: () => boolean): void {
  if (installed) return;
  installed = true;
  for (const id of HEROES) {
    const base = PAINTERS[id];
    if (!base) continue;
    PAINTERS[id] = (ctx, p) => {
      base(ctx, p);
      if (active()) drawDragonParure(ctx, p);
    };
  }
}

// ───────────────────────────── apparences du pass de saison ─────────────────────────────
// Accessoires de papier épinglés sur la marionnette, purement cosmétiques (§11). Même repère que la parure :
// sommet de la capuche vers y = −21, col vers y = −5, `fx` = sens du regard.


function lace(ctx: Ctx, pts: number[], r: number): void {
  ctx.fillStyle = CUT;
  for (let i = 0; i < pts.length; i += 2) {
    ctx.beginPath();
    ctx.arc(pts[i], pts[i + 1], r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** Couche arrière (avant la marionnette) : ailes, queue. */
function drawSkinBack(ctx: Ctx, p: Pose, id: SkinId): void {
  const fx = Math.cos(p.facing) < -0.1 ? -1 : 1;
  ctx.save();
  ctx.translate(0, -bobOf(p));
  ctx.lineJoin = 'round';
  if (id === 'paperWings') {
    const flap = Math.sin(p.t * (p.state === 'move' ? 9 : 2.2)) * 0.18;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(side * 4, -11);
      ctx.rotate(side * (0.25 + flap));
      ctx.scale(side, 1);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(10, -14, 22, -12);
      ctx.quadraticCurveTo(19, -6, 21, -3);
      ctx.quadraticCurveTo(15, -2, 17, 3);
      ctx.quadraticCurveTo(10, 3, 9, 8);
      ctx.quadraticCurveTo(4, 5, 0, 4);
      ctx.closePath();
      ctx.fillStyle = CUT;
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = INK;
      ctx.stroke();
      // nervures et dentelle découpée
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(1, 1);
      ctx.lineTo(18, -9);
      ctx.moveTo(1, 2);
      ctx.lineTo(15, 0);
      ctx.moveTo(1, 3);
      ctx.lineTo(8, 6);
      ctx.stroke();
      ctx.restore();
    }
  } else if (id === 'foxEars') {
    // queue touffue derrière la cape, pointe claire
    const sw = Math.sin(p.t * (p.state === 'move' ? 12 : 2)) * 0.2;
    ctx.save();
    ctx.translate(-fx * 7, 2);
    ctx.rotate(-fx * (0.9 + sw));
    ctx.beginPath();
    ctx.moveTo(-3, 0);
    ctx.quadraticCurveTo(-7, -12, 0, -20);
    ctx.quadraticCurveTo(7, -12, 3, 0);
    ctx.closePath();
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-2.4, -14);
    ctx.quadraticCurveTo(0, -21, 2.4, -14);
    ctx.quadraticCurveTo(0, -16, -2.4, -14);
    ctx.fillStyle = CUT;
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

/** Couche avant (après la marionnette) : oreilles, couronne. */
function drawSkinFront(ctx: Ctx, p: Pose, id: SkinId): void {
  const fx = Math.cos(p.facing) < -0.1 ? -1 : 1;
  const hx = fx * 1.2;
  ctx.save();
  if (p.blink && Math.floor(p.t * 16) % 2 === 0) ctx.globalAlpha = 0.45;
  ctx.translate(0, -bobOf(p));
  ctx.lineJoin = 'round';
  if (id === 'foxEars') {
    const tw = Math.sin(p.t * 1.3) * 0.5;
    for (const side of [-1, 1]) {
      const bx = hx + side * 4.6;
      ctx.beginPath();
      ctx.moveTo(bx - 3, -18.4);
      ctx.lineTo(bx + side * 1.6, -28.5 + (side > 0 ? tw : 0));
      ctx.lineTo(bx + 3, -18.8);
      ctx.closePath();
      ctx.fillStyle = INK;
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(bx - 1.3, -19.4);
      ctx.lineTo(bx + side * 1.2, -25.4 + (side > 0 ? tw : 0));
      ctx.lineTo(bx + 1.3, -19.6);
      ctx.closePath();
      ctx.fillStyle = CUT;
      ctx.fill();
    }
  } else if (id === 'moonCrown') {
    const y = -27 + Math.sin(p.t * 2) * 0.6;
    // croissant d'or à la feuille, cerné d'encre, posé au-dessus de la capuche
    ctx.beginPath();
    ctx.arc(hx, y, 6.2, Math.PI * 0.15, Math.PI * 0.85, true);
    ctx.arc(hx, y - 2.6, 5, Math.PI * 0.8, Math.PI * 0.2, false);
    ctx.closePath();
    ctx.fillStyle = GOLD_LEAF;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = INK;
    ctx.stroke();
    // trois pointes étoilées découpées
    for (const dx of [-5.5, 0, 5.5]) {
      ctx.beginPath();
      ctx.moveTo(hx + dx, y - (dx ? 4.6 : 7.4));
      ctx.lineTo(hx + dx + 1.3, y - 2.6);
      ctx.lineTo(hx + dx - 1.3, y - 2.6);
      ctx.closePath();
      ctx.fillStyle = GOLD_LEAF;
      ctx.fill();
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
    lace(ctx, [hx, y + 3.3], 0.9);
  } else if (id === 'paperWings') {
    // petite broche jade qui épingle les ailes au col
    ctx.beginPath();
    ctx.arc(0, -8, 1.8, 0, Math.PI * 2);
    ctx.fillStyle = JADE;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
  ctx.restore();
}

/** Dessine une apparence complète autour d'un dessin de héros (aperçus, boutique du pass). */
export function withSkin(ctx: Ctx, p: Pose, id: SkinId | null, base: (ctx: Ctx, p: Pose) => void): void {
  if (id) drawSkinBack(ctx, p, id);
  base(ctx, p);
  if (id) drawSkinFront(ctx, p, id);
}

let passInstalled = false;
/** Enveloppe les dessins des héros ; `active()` donne l'apparence portée (ou null). */
export function installPassSkins(active: () => SkinId | null): void {
  if (passInstalled) return;
  passInstalled = true;
  for (const id of HEROES) {
    const base = PAINTERS[id];
    if (!base) continue;
    PAINTERS[id] = (ctx, p) => withSkin(ctx, p, active(), base);
  }
}

/** Aperçu figé d'une apparence sur l'Éclaireuse (image), sans la parure ni l'apparence portée. */
export function skinPreview(id: SkinId | null, size: number, scale = 1.4): string {
  const dpr = Math.min(3, devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(size * dpr);
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.translate(size / 2, size / 2 + size * 0.16);
  ctx.scale(scale, scale);
  withSkin(ctx, { t: 0.4, facing: 0.25, state: 'idle', windup: 0, flash: 0, elite: false, seed: 1, aiming: true }, id, drawScout);
  return c.toDataURL('image/png');
}
