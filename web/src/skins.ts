/**
 * Apparence exclusive de l'Ordre du Dragon : la « Parure du Dragon ».
 * Deux cornes de papier noir bordées d'or à la feuille sur la capuche et un col d'écailles d'or.
 * Purement cosmétique (§11) : aucun effet sur la simulation.
 *
 * Les dessins des héros vivent dans `art/src/characters.ts` ; on ne les modifie pas : on enveloppe
 * leurs fonctions de dessin dans `PAINTERS` (combat, carte, portraits, écran titre en profitent).
 */
import { PAINTERS, type Pose } from '../../art/src/characters.js';
import { INK, GOLD_LEAF } from '../../art/src/palette.js';

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
