/**
 * Décor d'arène « théâtre d'ombres » : un écran de papier éclairé par derrière,
 * des obstacles découpés dans l'encre, l'eau et la lave vues à travers un gel coloré,
 * une scène encadrée de rideaux.
 *
 * Chaque royaume a son vocabulaire de découpes (lointain projeté sur le papier, rochers,
 * haies), toujours en encre pleine percée de fentes de lumière. Le sol reste lisible :
 * silhouettes lointaines en encre diluée, rien de vermillon, rien qui ressemble à un projectile.
 *
 * Couches :
 *  - `paintArenaStatic` : une fois par salle (pré-rendue par le jeu) ;
 *  - `paintLiquids`     : chaque image (vagues découpées dans le gel) ;
 *  - `paintDecorAnim`   : chaque image, juste après les liquides (herbes qui ondulent,
 *                         découpes suspendues à des fils, lampes du cadre qui vacillent).
 */
import { INK, INK2, CUT, CURTAIN, CURTAIN_LIGHT, GOLD_LEAF, type KingdomTheme } from './palette.js';
import { mix, alpha, circle, type Ctx } from './draw.js';
import { almonds, holes, slits } from './rig.js';

export const CELL = 44;
export const COLS = 9;
export const ROWS = 15;
export const AW = CELL * COLS;
export const AH = CELL * ROWS;
/** épaisseur du cadre (montants de la scène) autour de l'écran */
export const WALL = 26;

const TAU = Math.PI * 2;
const LAMP = '#e9c46a';
/** hauteurs des lampes sur les montants du cadre */
const LAMP_Y = [AH * 0.2, AH * 0.5, AH * 0.8];

function hashCell(c: number, r: number, k = 0): number {
  let h = (c * 374761393 + r * 668265263 + k * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const isFree = (ch: string | undefined) => ch !== undefined && ch !== '#' && ch !== '~' && ch !== '%';

/** Contour irrégulier, comme découpé aux ciseaux. */
function cutPath(ctx: Ctx, pts: [number, number][], seed: number, jitter = 1.2): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => {
    const jx = (hashCell(i, seed, 1) - 0.5) * jitter * 2;
    const jy = (hashCell(i, seed, 2) - 0.5) * jitter * 2;
    if (i === 0) ctx.moveTo(x + jx, y + jy);
    else ctx.lineTo(x + jx, y + jy);
  });
  ctx.closePath();
}

/** Ombre portée franche (décalage sans flou) puis aplat d'encre pour un tracé donné. */
function inked(ctx: Ctx, path: () => void, fill: string = INK): void {
  ctx.save();
  ctx.translate(2.5, 3.5);
  path();
  ctx.fillStyle = 'rgba(27,20,24,0.22)';
  ctx.fill();
  ctx.restore();
  path();
  ctx.fillStyle = fill;
  ctx.fill();
}

// ───────────────────────────── Couche statique ─────────────────────────────

/** Couche statique (écran, cadre, obstacles), dessinée une fois par salle. */
export function paintArenaStatic(ctx: Ctx, grid: string[], th: KingdomTheme, opts: { far?: boolean } = {}): void {
  // cadre de scène en bois sombre
  ctx.fillStyle = INK;
  ctx.fillRect(-WALL, -WALL, AW + WALL * 2, AH + WALL * 2);
  ctx.strokeStyle = INK2;
  ctx.lineWidth = 2;
  ctx.strokeRect(-WALL + 5, -WALL + 5, AW + WALL * 2 - 10, AH + WALL * 2 - 10);
  // moulure intérieure ajourée (petits losanges découpés)
  ctx.fillStyle = alpha(CUT, 0.12);
  for (let i = 0; i < 40; i++) {
    const x = -WALL / 2 + (i * (AW + WALL)) / 39;
    diamond(ctx, x, -WALL / 2, 2.2);
    diamond(ctx, x, AH + WALL / 2, 2.2);
  }
  // clous du cadre
  for (let i = 0; i <= 12; i++) {
    const y = -WALL / 2 + (i * (AH + WALL)) / 12;
    if (LAMP_Y.some((ly) => Math.abs(ly - y) < 20)) continue;
    circle(ctx, -WALL / 2, y, 2, INK2);
    circle(ctx, AW + WALL / 2, y, 2, INK2);
  }
  // appliques des lampes (la flamme vacille dans paintDecorAnim)
  for (const y of LAMP_Y) {
    for (const x of [-WALL / 2, AW + WALL / 2]) {
      ctx.fillStyle = INK2;
      ctx.beginPath();
      ctx.moveTo(x - 6, y + 9);
      ctx.lineTo(x + 6, y + 9);
      ctx.lineTo(x + 3, y + 3);
      ctx.lineTo(x - 3, y + 3);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x, y - 1, 5.2, 0, TAU);
      ctx.strokeStyle = INK2;
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }

  // écran de papier : lumière au centre, bords brûlés
  paintScreenLight(ctx, th);

  // fibres du papier
  for (let i = 0; i < 260; i++) {
    const x = hashCell(i, 1, 3) * AW;
    const y = hashCell(i, 2, 4) * AH;
    const l = 3 + hashCell(i, 3, 5) * 9;
    const a = hashCell(i, 4, 6) * Math.PI;
    ctx.strokeStyle = alpha(hashCell(i, 5, 7) > 0.5 ? INK : CUT, 0.05 + hashCell(i, 6, 8) * 0.05);
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  // plis du papier (repères discrets de la grille)
  ctx.strokeStyle = alpha(INK, 0.06);
  ctx.lineWidth = 1;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * CELL, 0);
    ctx.lineTo(c * CELL, AH);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * CELL);
    ctx.lineTo(AW, r * CELL);
    ctx.stroke();
  }

  // paysage lointain projeté en haut de l'écran (encre très diluée)
  horizon(ctx, th);

  // silhouettes lointaines projetées sur l'écran (décor, encre diluée)
  for (let r = 0; r < ROWS && opts.far !== false; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!isFree(grid[r][c]) || grid[r][c] === 'P' || hashCell(c, r) < 0.55) continue;
      const x = c * CELL + 8 + hashCell(c, r, 1) * (CELL - 16);
      const y = r * CELL + 10 + hashCell(c, r, 2) * (CELL - 16);
      farDetail(ctx, x, y, th, hashCell(c, r, 3), hashCell(c, r, 4));
    }
  }

  // liquides (gel coloré), puis haies et rochers découpés
  for (let pass = 0; pass < 2; pass++) for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (grid[r][c] === '~') liquidCell(ctx, grid, c, r, th, pass);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === '%') hedge(ctx, c, r, th);
      if (grid[r][c] === '#') rock(ctx, c, r, th);
    }
  }
}

/** Lumière de l'écran : centre éclairé, papier, bords brûlés (AW × AH). */
export function paintScreenLight(ctx: Ctx, th: KingdomTheme): void {
  const g = ctx.createRadialGradient(AW / 2, AH * 0.45, 30, AW / 2, AH * 0.5, AH * 0.72);
  g.addColorStop(0, th.light);
  g.addColorStop(0.55, th.paper);
  g.addColorStop(1, th.edge);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, AW, AH);
}

function diamond(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x, y + s);
  ctx.lineTo(x - s, y);
  ctx.closePath();
  ctx.fill();
}

/** Frise de paysage lointain le long du haut de l'écran, propre à chaque royaume. */
function horizon(ctx: Ctx, th: KingdomTheme): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, AW, 60);
  ctx.clip();
  ctx.fillStyle = alpha(th.far, 0.22);
  ctx.strokeStyle = alpha(th.far, 0.22);
  ctx.lineCap = 'round';
  const base = 30;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, base);
  switch (th.moteKind) {
    case 'firefly':
      // lisière de forêt : cimes arrondies
      for (let x = 0; x <= AW; x += 18) {
        const h = 10 + hashCell(x, 11) * 14;
        ctx.quadraticCurveTo(x + 4, base - h - 6, x + 9, base - h);
        ctx.quadraticCurveTo(x + 14, base - h + 6, x + 18, base - 4);
      }
      break;
    case 'spore':
      // saules et roseaux
      for (let x = 0; x <= AW; x += 12) {
        const h = 6 + hashCell(x, 12) * 18;
        ctx.lineTo(x + 3, base - h);
        ctx.lineTo(x + 5, base - 2);
        ctx.lineTo(x + 8, base - h * 0.6);
        ctx.lineTo(x + 12, base);
      }
      break;
    case 'sand':
      // dunes et une pyramide en ruine
      for (let x = 0; x <= AW; x += 40) {
        const h = 6 + hashCell(x, 13) * 10;
        if (x === 280) {
          ctx.lineTo(x + 4, base);
          ctx.lineTo(x + 26, base - 26);
          ctx.lineTo(x + 30, base - 22);
          ctx.lineTo(x + 34, base - 24);
          ctx.lineTo(x + 40, base);
        } else ctx.quadraticCurveTo(x + 20, base - h * 2, x + 40, base);
      }
      break;
    case 'snow':
      // pics enneigés
      for (let x = 0; x <= AW; x += 44) {
        const h = 14 + hashCell(x, 14) * 16;
        ctx.lineTo(x + 18, base - h);
        ctx.lineTo(x + 24, base - h + 4);
        ctx.lineTo(x + 28, base - h + 1);
        ctx.lineTo(x + 44, base - 2);
      }
      break;
    case 'ember':
      // volcan et arbres calcinés
      for (let x = 0; x <= AW; x += 22) {
        if (x === 132) {
          ctx.lineTo(x + 30, base - 28);
          ctx.lineTo(x + 40, base - 26);
          ctx.lineTo(x + 50, base - 28);
          ctx.lineTo(x + 80, base);
          x += 66;
          continue;
        }
        const h = 8 + hashCell(x, 15) * 8;
        ctx.lineTo(x + 10, base);
        ctx.lineTo(x + 11, base - h);
        ctx.lineTo(x + 7, base - h - 5);
        ctx.lineTo(x + 11.5, base - h - 1);
        ctx.lineTo(x + 15, base - h - 6);
        ctx.lineTo(x + 12.5, base - h + 1);
        ctx.lineTo(x + 13, base);
      }
      break;
  }
  ctx.lineTo(AW, base);
  ctx.lineTo(AW, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Petites découpes lointaines (encre diluée) semées sur le sol de papier. */
function farDetail(ctx: Ctx, x: number, y: number, th: KingdomTheme, k: number, k2: number): void {
  ctx.save();
  ctx.translate(x, y);
  if (k2 > 0.5) ctx.scale(-1, 1);
  const col = alpha(th.far, 0.5);
  const hole = alpha(th.light, 0.9);
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const v = Math.floor(k * 4);
  switch (th.moteKind) {
    case 'firefly':
      if (v === 0) fern(ctx, col, 1);
      else if (v === 1) {
        // deux champignons
        mushroomCut(ctx, -3, 2, 1, col, hole);
        mushroomCut(ctx, 4, 3, 0.7, col, hole);
      } else if (v === 2) tuft(ctx, 1);
      else {
        // fleur découpée
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(0, 6);
        ctx.quadraticCurveTo(1, 1, 0, -3);
        ctx.stroke();
        for (let i = 0; i < 5; i++) circle(ctx, Math.cos((i * TAU) / 5) * 2.6, -4 + Math.sin((i * TAU) / 5) * 2.6, 1.7, col);
        circle(ctx, 0, -4, 1, hole);
      }
      break;
    case 'spore':
      if (v === 0 || v === 1) reeds(ctx, col, 1);
      else if (v === 2) lilyPad(ctx, col, hole, 1);
      else {
        // tiges à spores
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(0, 5);
        ctx.quadraticCurveTo(1, -3, -1, -8);
        ctx.moveTo(2, 5);
        ctx.quadraticCurveTo(4, 0, 4, -4);
        ctx.stroke();
        ctx.beginPath();
        ctx.ellipse(-1, -8, 1.4, 2.6, 0, 0, TAU);
        ctx.ellipse(4, -4.6, 1.1, 2, 0, 0, TAU);
        ctx.fill();
      }
      break;
    case 'sand':
      if (v === 0) cactus(ctx, col, hole, 0.8);
      else if (v === 1) {
        // crâne et côtes
        ctx.beginPath();
        ctx.ellipse(-4, 0, 3.4, 2.8, 0, 0, TAU);
        ctx.fill();
        holes(ctx, [-5, -0.3, 0.8, -3, -0.3, 0.8], hole);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          ctx.moveTo(1 + i * 2.6, -3);
          ctx.quadraticCurveTo(3 + i * 2.6, 0, 1 + i * 2.6, 4);
        }
        ctx.moveTo(0, 0.5);
        ctx.lineTo(9, 0.5);
        ctx.stroke();
      } else if (v === 2) {
        // tronçon de colonne
        ctx.fillRect(-3, -6, 6, 11);
        ctx.fillRect(-4.4, 4, 8.8, 2);
        ctx.beginPath();
        ctx.moveTo(-3, -6);
        ctx.lineTo(-1, -8);
        ctx.lineTo(1, -6.6);
        ctx.lineTo(3, -7.6);
        ctx.lineTo(3, -6);
        ctx.fill();
        slits(ctx, [-1.2, -4, -1.2, 3, 1.2, -4, 1.2, 3], 0.6, hole);
      } else {
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.arc(0, 5, 7, Math.PI * 1.15, Math.PI * 1.85);
        ctx.moveTo(-8, 7);
        ctx.arc(-4, 9, 4.5, Math.PI * 1.2, Math.PI * 1.8);
        ctx.stroke();
      }
      break;
    case 'snow':
      if (v === 0 || v === 1) iceShards(ctx, col, hole, 0.75);
      else if (v === 2) pine(ctx, col, hole, 0.6);
      else {
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = (i * Math.PI) / 3;
          ctx.moveTo(-Math.cos(a) * 4.4, -Math.sin(a) * 4.4);
          ctx.lineTo(Math.cos(a) * 4.4, Math.sin(a) * 4.4);
        }
        ctx.stroke();
        circle(ctx, 0, 0, 1.2, col);
      }
      break;
    case 'ember':
      if (v === 0) charredTree(ctx, col, 0.8);
      else if (v === 1) {
        // éclats d'obsidienne
        ctx.beginPath();
        ctx.moveTo(-5, 5);
        ctx.lineTo(-3, -5);
        ctx.lineTo(0, 5);
        ctx.moveTo(1, 5);
        ctx.lineTo(4, -2);
        ctx.lineTo(6, 5);
        ctx.fill();
        slits(ctx, [-3, -1, -2.4, 3], 0.6, hole);
      } else {
        // fissures
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-7, -2);
        ctx.lineTo(-2, 1);
        ctx.lineTo(1, -2);
        ctx.lineTo(7, 3);
        ctx.moveTo(-2, 1);
        ctx.lineTo(-1, 5);
        ctx.stroke();
      }
      break;
  }
  ctx.restore();
}

// petits motifs réutilisés (lointain, décor animé, haies)
function fern(ctx: Ctx, col: string, s: number): void {
  ctx.lineWidth = 1.2 * s;
  ctx.strokeStyle = col;
  ctx.beginPath();
  ctx.moveTo(0, 6 * s);
  ctx.quadraticCurveTo(-1 * s, -2 * s, -4 * s, -9 * s);
  ctx.stroke();
  const a: number[] = [];
  for (let i = 0; i < 5; i++) {
    const k = i / 5;
    const x = -k * 3.6 * s, y = (5 - k * 13) * s;
    a.push(x - 2.6 * s, y - 0.6 * s, 4.4 * s * (1 - k * 0.5), -0.5, 1.3 * s);
    a.push(x + 2.4 * s, y - 1.2 * s, 4.2 * s * (1 - k * 0.5), 0.6, 1.3 * s);
  }
  almonds(ctx, a, col);
}
function mushroomCut(ctx: Ctx, x: number, y: number, s: number, col: string, hole: string): void {
  ctx.fillStyle = col;
  ctx.fillRect(x - 1.2 * s, y - 3 * s, 2.4 * s, 5 * s);
  ctx.beginPath();
  ctx.ellipse(x, y - 3 * s, 4.4 * s, 3.6 * s, 0, Math.PI, TAU);
  ctx.fill();
  holes(ctx, [x - 1.6 * s, y - 4.6 * s, 0.7 * s, x + 1.8 * s, y - 4 * s, 0.6 * s], hole);
}
function tuft(ctx: Ctx, s: number): void {
  ctx.lineWidth = 1.4 * s;
  ctx.beginPath();
  ctx.moveTo(-3 * s, 3 * s);
  ctx.quadraticCurveTo(-4 * s, -2 * s, -6 * s, -5 * s);
  ctx.moveTo(0, 3 * s);
  ctx.lineTo(0, -7 * s);
  ctx.moveTo(3 * s, 3 * s);
  ctx.quadraticCurveTo(4 * s, -1 * s, 6 * s, -4 * s);
  ctx.moveTo(1.5 * s, 3 * s);
  ctx.quadraticCurveTo(2 * s, -2 * s, 3 * s, -6 * s);
  ctx.stroke();
}
function reeds(ctx: Ctx, col: string, s: number): void {
  ctx.lineWidth = 1.2 * s;
  ctx.strokeStyle = col;
  ctx.beginPath();
  ctx.moveTo(-2 * s, 6 * s);
  ctx.quadraticCurveTo(-2 * s, -2 * s, -3 * s, -9 * s);
  ctx.moveTo(1 * s, 6 * s);
  ctx.lineTo(1.5 * s, -11 * s);
  ctx.moveTo(3 * s, 6 * s);
  ctx.quadraticCurveTo(5 * s, 0, 8 * s, -3 * s);
  ctx.stroke();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.ellipse(-3 * s, -8 * s, 1.3 * s, 2.8 * s, -0.1, 0, TAU);
  ctx.ellipse(1.5 * s, -9.6 * s, 1.3 * s, 3 * s, 0, 0, TAU);
  ctx.fill();
}
function lilyPad(ctx: Ctx, col: string, hole: string, s: number): void {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.ellipse(0, 0, 7 * s, 4 * s, 0, 0.35, TAU - 0.05);
  ctx.closePath();
  ctx.fill();
  slits(ctx, [0, 0, -5 * s, -1.6 * s, 0, 0, -3 * s, 2.6 * s, 0, 0, 3 * s, 2.8 * s], 0.6 * s, hole);
}
function cactus(ctx: Ctx, col: string, hole: string, s: number): void {
  ctx.strokeStyle = col;
  ctx.lineCap = 'round';
  ctx.lineWidth = 4.4 * s;
  ctx.beginPath();
  ctx.moveTo(0, 7 * s);
  ctx.lineTo(0, -9 * s);
  ctx.moveTo(-5 * s, -5 * s);
  ctx.lineTo(-5 * s, -1 * s);
  ctx.quadraticCurveTo(-5 * s, 2 * s, 0, 2 * s);
  ctx.moveTo(5 * s, -2 * s);
  ctx.lineTo(5 * s, 1 * s);
  ctx.quadraticCurveTo(5 * s, 4 * s, 0, 4 * s);
  ctx.stroke();
  slits(ctx, [0, -7 * s, 0, 5 * s], 0.7 * s, hole);
}
function iceShards(ctx: Ctx, col: string, hole: string, s: number): void {
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.moveTo(-6 * s, 6 * s);
  ctx.lineTo(-4 * s, -6 * s);
  ctx.lineTo(-1 * s, 6 * s);
  ctx.moveTo(-2 * s, 6 * s);
  ctx.lineTo(1 * s, -11 * s);
  ctx.lineTo(4 * s, 6 * s);
  ctx.moveTo(3 * s, 6 * s);
  ctx.lineTo(7 * s, -3 * s);
  ctx.lineTo(8 * s, 6 * s);
  ctx.fill();
  slits(ctx, [1 * s, -7 * s, 1.6 * s, 3 * s, -4 * s, -3 * s, -3.6 * s, 3 * s], 0.7 * s, hole);
}
function pine(ctx: Ctx, col: string, hole: string, s: number): void {
  ctx.fillStyle = col;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const y = (-12 + i * 6) * s, w = (5 + i * 2.6) * s;
    ctx.moveTo(0, y - 4 * s);
    ctx.lineTo(w, y + 5 * s);
    ctx.lineTo(-w, y + 5 * s);
    ctx.closePath();
  }
  ctx.rect(-1.4 * s, 9 * s, 2.8 * s, 4 * s);
  ctx.fill();
  slits(ctx, [-4 * s, -5 * s, 2 * s, -6.4 * s, -6 * s, 1 * s, 4 * s, -0.6 * s, -8 * s, 7.4 * s, 6 * s, 6 * s], 0.7 * s, hole);
}
function charredTree(ctx: Ctx, col: string, s: number): void {
  ctx.strokeStyle = col;
  ctx.lineCap = 'round';
  ctx.lineWidth = 2.4 * s;
  ctx.beginPath();
  ctx.moveTo(0, 8 * s);
  ctx.lineTo(0, -6 * s);
  ctx.stroke();
  ctx.lineWidth = 1.2 * s;
  ctx.beginPath();
  ctx.moveTo(0, -1 * s);
  ctx.lineTo(-6 * s, -7 * s);
  ctx.lineTo(-8 * s, -6 * s);
  ctx.moveTo(-4 * s, -5 * s);
  ctx.lineTo(-4 * s, -10 * s);
  ctx.moveTo(0, -4 * s);
  ctx.lineTo(5 * s, -10 * s);
  ctx.moveTo(0, -6 * s);
  ctx.lineTo(1 * s, -12 * s);
  ctx.moveTo(0, 2 * s);
  ctx.lineTo(5 * s, -2 * s);
  ctx.stroke();
}

// ───────────────────────────── Rochers ─────────────────────────────

function rock(ctx: Ctx, c: number, r: number, th: KingdomTheme): void {
  const cx = c * CELL + CELL / 2;
  const cy = r * CELL + CELL / 2;
  const h = hashCell(c, r, 77);
  const lt = mix(th.light, CUT, 0.5);
  ctx.save();
  ctx.translate(cx, cy);
  if (h > 0.5) ctx.scale(-1, 1);
  switch (th.moteKind) {
    case 'firefly': {
      // rocher moussu, brin de fougère découpé au sommet
      const pts: [number, number][] = [];
      for (let i = 0; i < 11; i++) {
        const a = (i / 11) * TAU;
        const rr = 18.5 + hashCell(c, r, i) * 4.5;
        pts.push([Math.cos(a) * rr, Math.sin(a) * rr * 0.86 + 2]);
      }
      inked(ctx, () => cutPath(ctx, pts, c * 31 + r));
      ctx.save();
      ctx.translate(-6, -16);
      fern(ctx, INK, 0.9);
      ctx.restore();
      slits(ctx, [-9, -6, -2, 2, 4, -10, 9, -3, -12, 6, -6, 9], 1.3, alpha(CUT, 0.6));
      holes(ctx, [6, 6, 1.4, 10, 2, 0.9, 2, 11, 0.9], lt);
      break;
    }
    case 'spore': {
      // souche pourrissante : cernes découpés, racines, petit champignon
      inked(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-15, 14);
        ctx.lineTo(-20, 18);
        ctx.lineTo(-12, 17);
        ctx.lineTo(-8, 19);
        ctx.lineTo(0, 16);
        ctx.lineTo(8, 19);
        ctx.lineTo(13, 16);
        ctx.lineTo(20, 18);
        ctx.lineTo(15, 13);
        ctx.lineTo(16, -6);
        ctx.ellipse(0, -7, 16, 8, 0, 0, Math.PI, true);
        ctx.closePath();
      });
      ctx.strokeStyle = alpha(CUT, 0.55);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.ellipse(0, -7, 11, 5, 0, 0, TAU);
      ctx.moveTo(6, -7);
      ctx.ellipse(0, -7, 6, 2.6, 0, 0, TAU);
      ctx.stroke();
      circle(ctx, 0, -7, 1.2, alpha(CUT, 0.6));
      slits(ctx, [-9, 1, -10, 11, -2, 3, -2, 13, 7, 2, 8, 11], 1.1, alpha(CUT, 0.45));
      mushroomCut(ctx, 15, 4, 1.1, INK, lt);
      break;
    }
    case 'sand': {
      // bloc de grès sculpté, strates et glyphe
      inked(ctx, () =>
        cutPath(ctx, [[-18, 18], [-19, -6], [-15, -15], [-6, -19], [8, -18], [18, -12], [19, 4], [16, 18]], c * 17 + r, 1.4),
      );
      slits(ctx, [-16, -7, 16, -8, -17, 8, 17, 7, -15, 13, 2, 13], 1.1, alpha(CUT, 0.45));
      ctx.strokeStyle = lt;
      ctx.lineWidth = 1.4;
      // œil-soleil gravé entre les strates
      ctx.beginPath();
      ctx.moveTo(-7, 0.5);
      ctx.quadraticCurveTo(0, -5.5, 7, 0.5);
      ctx.quadraticCurveTo(0, 6.5, -7, 0.5);
      ctx.stroke();
      circle(ctx, 0, 0.5, 1.6, lt);
      slits(ctx, [-9, -12, -7, -10, 0, -14.5, 0, -12, 9, -12, 7, -10], 1.1, lt);
      break;
    }
    case 'snow': {
      // grappe de cristaux de glace, facettes en fentes
      inked(ctx, () => {
        ctx.beginPath();
        ctx.moveTo(-19, 17);
        ctx.lineTo(-15, -6);
        ctx.lineTo(-10, 4);
        ctx.lineTo(-5, -20);
        ctx.lineTo(1, 2);
        ctx.lineTo(7, -14);
        ctx.lineTo(11, 3);
        ctx.lineTo(17, -3);
        ctx.lineTo(19, 17);
        ctx.closePath();
      });
      slits(ctx, [-5, -15, -3, 8, 7, -10, 6, 8, -15, -1, -13, 10, 16, 1, 15, 10], 1.2, alpha(CUT, 0.65));
      holes(ctx, [-8, 12, 1, 2, 13, 1.2, 11, 12, 0.9], lt);
      break;
    }
    case 'ember': {
      // obsidienne éclatée, craquelures de lumière (jamais vermillon)
      inked(ctx, () =>
        cutPath(ctx, [[-19, 16], [-17, -2], [-10, -8], [-8, -19], [-1, -9], [6, -17], [10, -5], [18, -9], [19, 6], [14, 18]], c * 13 + r, 1),
      );
      ctx.strokeStyle = alpha(CUT, 0.5);
      ctx.lineWidth = 1.1;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-8, -15);
      ctx.lineTo(-6, -4);
      ctx.lineTo(-10, 6);
      ctx.moveTo(-6, -4);
      ctx.lineTo(2, 2);
      ctx.lineTo(1, 12);
      ctx.moveTo(6, -13);
      ctx.lineTo(8, -2);
      ctx.lineTo(14, 4);
      ctx.stroke();
      break;
    }
  }
  ctx.restore();
}

// ───────────────────────────── Haies ─────────────────────────────

function hedge(ctx: Ctx, c: number, r: number, th: KingdomTheme): void {
  const cx = c * CELL + CELL / 2;
  const cy = r * CELL + CELL / 2;
  const lt = mix(th.light, CUT, 0.4);
  ctx.save();
  ctx.translate(cx, cy);
  if (hashCell(c, r, 88) > 0.5) ctx.scale(-1, 1);
  switch (th.moteKind) {
    case 'firefly': {
      // buisson feuillu, feuilles découpées
      const blobs: [number, number, number][] = [[-11, 5, 11], [11, 5, 11], [0, 8, 12], [-8, -6, 11], [8, -6, 11], [0, -11, 10]];
      inked(ctx, () => {
        ctx.beginPath();
        for (const [x, y, rr] of blobs) {
          ctx.moveTo(x + rr, y);
          ctx.arc(x, y, rr, 0, TAU);
        }
      });
      const a: number[] = [];
      for (let i = 0; i < 8; i++) a.push(-13 + hashCell(c, r, i + 40) * 26, -13 + hashCell(c, r, i + 50) * 24, 6, hashCell(c, r, i + 60) * Math.PI, 1.5);
      almonds(ctx, a, lt);
      break;
    }
    case 'spore': {
      // touffe de roseaux sur une motte
      inked(ctx, () => {
        ctx.beginPath();
        ctx.ellipse(0, 9, 19, 10, 0, 0, TAU);
        for (let i = 0; i < 7; i++) {
          const x = -14 + i * 4.6;
          const top = -12 - hashCell(c, r, i) * 9;
          ctx.moveTo(x - 1.8, 6);
          ctx.lineTo(x + (i - 3) * 0.6, top);
          ctx.lineTo(x + 1.8, 6);
        }
        for (let i = 0; i < 3; i++) {
          const x = -9 + i * 9;
          ctx.moveTo(x + 2.2, -12 - i * 2);
          ctx.ellipse(x, -12 - i * 2, 2.2, 5, 0, 0, TAU);
        }
      });
      slits(ctx, [-12, 10, -4, 12, 3, 11, 12, 9], 1.2, alpha(CUT, 0.5));
      slits(ctx, [-9, -15, -9, -10, 0, -17, 0, -12, 9, -19, 9, -14], 0.8, lt);
      break;
    }
    case 'sand': {
      // massif de cactus : figuier de Barbarie et cactus tonneau
      inked(ctx, () => {
        ctx.beginPath();
        ctx.ellipse(-7, 6, 10, 12, -0.2, 0, TAU);
        ctx.moveTo(18, 10);
        ctx.ellipse(9, 10, 9, 9, 0, 0, TAU);
        ctx.moveTo(4, -6);
        ctx.ellipse(-3, -12, 7, 8, 0.4, 0, TAU);
        ctx.moveTo(19, -5);
        ctx.ellipse(13, -6, 6, 7, -0.5, 0, TAU);
      });
      const sp: number[] = [];
      for (let i = 0; i < 14; i++) sp.push(-16 + hashCell(c, r, i + 70) * 32, -17 + hashCell(c, r, i + 80) * 32, 0.8);
      holes(ctx, sp, lt);
      slits(ctx, [9, 3, 9, 17, 5, 4, 4, 16, 13, 4, 14, 16], 0.8, alpha(CUT, 0.45));
      break;
    }
    case 'snow': {
      // sapin chargé de neige
      inked(ctx, () => {
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const y = -18 + i * 10, w = 9 + i * 5;
          ctx.moveTo(0, y - 4);
          ctx.lineTo(w, y + 9);
          ctx.lineTo(-w, y + 9);
          ctx.closePath();
        }
        ctx.rect(-3, 10, 6, 11);
      });
      ctx.strokeStyle = lt;
      ctx.lineWidth = 1.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const y = -18 + i * 10, w = 9 + i * 5;
        ctx.moveTo(-w + 3, y + 7);
        ctx.quadraticCurveTo(-w * 0.4, y + 3, 0, y + 6);
        ctx.quadraticCurveTo(w * 0.4, y + 3, w - 3, y + 7);
      }
      ctx.stroke();
      break;
    }
    case 'ember': {
      // roncier calciné, épines découpées
      inked(ctx, () => {
        ctx.beginPath();
        ctx.ellipse(0, 7, 18, 12, 0, 0, TAU);
        for (let i = 0; i < 9; i++) {
          const a = Math.PI + 0.15 + (i / 8) * (Math.PI - 0.3);
          const L = 17 + hashCell(c, r, i) * 6;
          ctx.moveTo(Math.cos(a + 0.12) * 9, 4 + Math.sin(a + 0.12) * 6);
          ctx.lineTo(Math.cos(a) * L, 4 + Math.sin(a) * L);
          ctx.lineTo(Math.cos(a - 0.12) * 9, 4 + Math.sin(a - 0.12) * 6);
        }
      });
      slits(ctx, [-10, 6, -3, 12, 2, 4, 10, 10, -6, -2, 4, -4], 1.1, alpha(CUT, 0.45));
      break;
    }
  }
  ctx.restore();
}

// ───────────────────────────── Liquides ─────────────────────────────

/** pass 0 : bords d'encre de toutes les cases ; pass 1 : gel, bandes et berges (pas de couture entre cases). */
function liquidCell(ctx: Ctx, grid: string[], c: number, r: number, th: KingdomTheme, pass: number): void {
  const x = c * CELL;
  const y = r * CELL;
  const isL = (cc: number, rr: number) => rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && grid[rr][cc] === '~';
  const rad = 14;
  const tl = !isL(c - 1, r) && !isL(c, r - 1) ? rad : 0;
  const tr = !isL(c + 1, r) && !isL(c, r - 1) ? rad : 0;
  const br = !isL(c + 1, r) && !isL(c, r + 1) ? rad : 0;
  const bl = !isL(c - 1, r) && !isL(c, r + 1) ? rad : 0;
  // bord d'encre puis gel coloré
  if (pass === 0) {
    ctx.beginPath();
    ctx.roundRect(x - 1, y - 1, CELL + 2, CELL + 2, [tl, tr, br, bl]);
    ctx.fillStyle = INK;
    ctx.fill();
    return;
  }
  const ix = isL(c - 1, r) ? 0 : 4;
  const iy = isL(c, r - 1) ? 0 : 4;
  const iw = CELL - ix - (isL(c + 1, r) ? 0 : 4);
  const ih = CELL - iy - (isL(c, r + 1) ? 0 : 4);
  ctx.beginPath();
  ctx.roundRect(x + ix, y + iy, iw, ih, [tl * 0.7, tr * 0.7, br * 0.7, bl * 0.7]);
  ctx.fillStyle = th.gel;
  ctx.fill();
  // bandes de papier ondulées (gel plus profond), fixes
  ctx.save();
  ctx.clip();
  ctx.fillStyle = mix(th.gel, INK, th.liquidIsLava ? 0.18 : 0.12);
  for (let k = 0; k < 2; k++) {
    const yy = y + 14 + k * 18;
    ctx.beginPath();
    ctx.moveTo(x - 2, yy);
    for (let i = 0; i < 4; i++) ctx.quadraticCurveTo(x + i * 12 + 4, yy - 3.4, x + i * 12 + 10, yy);
    ctx.lineTo(x + CELL + 2, yy + 5);
    for (let i = 3; i >= 0; i--) ctx.quadraticCurveTo(x + i * 12 + 4, yy + 1.6, x + i * 12 - 2, yy + 5);
    ctx.closePath();
    ctx.fill();
  }
  if (th.liquidIsLava) {
    // croûtes refroidies
    for (let k = 0; k < 2; k++) {
      const px = x + 8 + hashCell(c, r, k + 20) * 26, py = y + 8 + hashCell(c, r, k + 30) * 26;
      ctx.beginPath();
      ctx.moveTo(px - 5, py);
      ctx.lineTo(px - 1, py - 4);
      ctx.lineTo(px + 5, py - 2);
      ctx.lineTo(px + 4, py + 3);
      ctx.lineTo(px - 2, py + 4);
      ctx.closePath();
      ctx.fillStyle = alpha(INK2, 0.55);
      ctx.fill();
    }
  }
  ctx.restore();
  // berges festonnées découpées (côtés au contact du sol)
  ctx.fillStyle = INK;
  const scallop = (sx: number, sy: number, dx: number, dy: number, nx: number, ny: number) => {
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const px = sx + dx * (i + 0.5) * 11, py = sy + dy * (i + 0.5) * 11;
      ctx.moveTo(px, py);
      ctx.arc(px, py, 3, 0, TAU);
    }
    ctx.fill();
    void nx;
    void ny;
  };
  if (!isL(c, r - 1)) scallop(x, y + 4, 1, 0, 0, 1);
  if (!isL(c, r + 1)) scallop(x, y + CELL - 4, 1, 0, 0, -1);
  if (!isL(c - 1, r)) scallop(x + 4, y, 0, 1, 1, 0);
  if (!isL(c + 1, r)) scallop(x + CELL - 4, y, 0, 1, -1, 0);
}

/** Vagues découpées (crêtes en croissant) qui glissent dans le gel. */
export function paintLiquids(ctx: Ctx, grid: string[], th: KingdomTheme, t: number): void {
  const lava = th.liquidIsLava;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== '~') continue;
      const x = c * CELL;
      const y = r * CELL;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 6, y + 6, CELL - 12, CELL - 12);
      ctx.clip();
      ctx.fillStyle = th.gelLight;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const yy = y + 12 + k * 11 + Math.sin(t * 1.4 + c + k) * 1.5;
        const xx = x + 2 + ((t * (lava ? 4 : 8) + k * 13 + c * 7 + r * 5) % 40) - 4;
        // crête de vague en croissant, découpée
        ctx.moveTo(xx, yy);
        ctx.quadraticCurveTo(xx + 5, yy - 4.6, xx + 11, yy - 1);
        ctx.quadraticCurveTo(xx + 8, yy - 0.6, xx + 9, yy + 1.2);
        ctx.quadraticCurveTo(xx + 5, yy - 2, xx, yy);
        ctx.moveTo(xx + 12, yy + 0.4);
        ctx.quadraticCurveTo(xx + 15, yy - 1.8, xx + 18, yy + 0.4);
        ctx.quadraticCurveTo(xx + 15, yy - 0.6, xx + 12, yy + 0.4);
      }
      ctx.fill();
      if (lava) {
        const ph = (t * 0.7 + hashCell(c, r)) % 1;
        circle(ctx, x + 10 + hashCell(c, r, 5) * 24, y + 12 + hashCell(c, r, 9) * 20, 1 + ph * 3.5, alpha(th.gelLight, 1 - ph));
        const ph2 = (t * 0.55 + hashCell(c, r, 3)) % 1;
        ctx.beginPath();
        ctx.arc(x + 12 + hashCell(c, r, 6) * 20, y + 10 + hashCell(c, r, 8) * 24, 1 + ph2 * 5, Math.PI, TAU);
        ctx.strokeStyle = alpha(th.gelLight, 1 - ph2);
        ctx.lineWidth = 1.2;
        ctx.stroke();
      }
      ctx.restore();
    }
  }
}

// ───────────────────────────── Couche animée du décor ─────────────────────────────

interface DecorSpots {
  /** touffes qui ondulent (x, y, phase, échelle) */
  tufts: number[];
  /** découpes suspendues (x, longueur du fil, phase) */
  hangs: number[];
}
const SPOTS = new WeakMap<string[], DecorSpots>();

function spotsFor(grid: string[]): DecorSpots {
  let s = SPOTS.get(grid);
  if (s) return s;
  const tufts: number[] = [];
  for (let r = 1; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!isFree(grid[r][c]) || grid[r][c] === 'P' || grid[r][c] === 'S') continue;
      // au pied des obstacles, comme une herbe qui pousse contre la pierre
      const near = !isFree(grid[r - 1]?.[c]) || !isFree(grid[r]?.[c - 1]) || !isFree(grid[r]?.[c + 1]);
      if (!(near ? hashCell(c, r, 91) < 0.55 : hashCell(c, r, 91) < 0.06)) continue;
      if (tufts.length >= 14 * 4) break;
      const x = c * CELL + 8 + hashCell(c, r, 92) * (CELL - 16);
      const y = r * CELL + (near ? 9 : 22) + hashCell(c, r, 93) * 8;
      tufts.push(x, y, hashCell(c, r, 94) * TAU, 0.8 + hashCell(c, r, 95) * 0.4);
    }
  }
  // fils suspendus aux deux coins hauts de l'écran, loin de la porte
  const hangs = [16, 26, 0.3, 40, 14, 2.1, AW - 18, 22, 1.2, AW - 44, 32, 4];
  s = { tufts, hangs };
  SPOTS.set(grid, s);
  return s;
}

/**
 * Mouvement discret du décor, à dessiner chaque image juste après `paintLiquids`
 * (même repère que l'arène) : herbes/roseaux qui ondulent au pied des obstacles,
 * découpes suspendues à des fils (feuilles, flocons, cendres), grandes découpes qui
 * dérivent lentement sur le papier, flammes des lampes du cadre et leur lumière qui vacille.
 */
export function paintDecorAnim(ctx: Ctx, grid: string[], th: KingdomTheme, t: number): void {
  const sp = spotsFor(grid);
  const kind = th.moteKind;
  const col = alpha(th.far, 0.62);
  const hole = alpha(th.light, 0.9);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  // 1. touffes qui ondulent
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  for (let i = 0; i < sp.tufts.length; i += 4) {
    const x = sp.tufts[i], y = sp.tufts[i + 1], ph = sp.tufts[i + 2], s = sp.tufts[i + 3];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 1.3 + ph) * 0.14 + Math.sin(t * 2.9 + ph * 2) * 0.05);
    swayTuft(ctx, kind, col, s, ph);
    ctx.restore();
  }

  // 2. découpes suspendues à des fils (accessoires de théâtre)
  for (let i = 0; i < sp.hangs.length; i += 3) {
    const x0 = sp.hangs[i], L = sp.hangs[i + 1], ph = sp.hangs[i + 2];
    const a = Math.sin(t * 1.1 + ph) * 0.22;
    const bob = Math.sin(t * 0.7 + ph) * 3;
    const ex = x0 + Math.sin(a) * (L + bob), ey = Math.cos(a) * (L + bob);
    ctx.beginPath();
    ctx.moveTo(x0, 0);
    ctx.lineTo(ex, ey);
    ctx.strokeStyle = alpha(INK, 0.28);
    ctx.lineWidth = 0.7;
    ctx.stroke();
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(a * 2 + Math.sin(t * 1.7 + ph) * 0.3);
    hangingProp(ctx, kind, col, hole, ph);
    ctx.restore();
  }

  // 3. grandes découpes qui dérivent lentement (feuilles, aigrettes, sable, flocons, cendres)
  const drift = kind === 'snow' || kind === 'firefly' ? 1 : kind === 'sand' ? 2 : -1;
  for (let i = 0; i < 4; i++) {
    const sx = hashCell(i, 3, 41), sy = hashCell(i, 4, 42);
    const speed = 7 + sx * 6;
    let x: number, y: number;
    if (drift === 2) {
      x = ((sx * AW + t * speed * 2.2) % (AW + 40)) - 20;
      y = sy * AH + Math.sin(t * 0.8 + i) * 12;
    } else {
      y = (((sy * AH + drift * t * speed) % (AH + 40)) + AH + 40) % (AH + 40) - 20;
      x = sx * AW + Math.sin(t * 0.6 + i * 2) * 18;
    }
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * (0.6 + sx) + i);
    driftProp(ctx, kind, alpha(th.far, 0.38), i);
    ctx.restore();
  }

  // 4. lampes du cadre : flamme qui vacille et lumière portée sur le bord de l'écran
  for (let j = 0; j < LAMP_Y.length; j++) {
    const y = LAMP_Y[j];
    for (const side of [0, 1]) {
      const x = side ? AW + WALL / 2 : -WALL / 2;
      const f = 0.75 + 0.15 * Math.sin(t * 9.3 + j * 2 + side) + 0.1 * Math.sin(t * 23.7 + j * 5 + side * 3);
      lampFlame(ctx, x, y, f, Math.sin(t * 7 + j) * 0.8);
      // flaque de lumière sur l'écran (aplat, sans dégradé)
      const lx = side ? AW : 0;
      ctx.fillStyle = alpha(CUT, 0.07 * f);
      ctx.beginPath();
      ctx.ellipse(lx, y, 26 * f, 46 * f, 0, side ? Math.PI / 2 : -Math.PI / 2, side ? Math.PI * 1.5 : Math.PI / 2);
      ctx.fill();
      ctx.fillStyle = alpha(CUT, 0.06 * f);
      ctx.beginPath();
      ctx.ellipse(lx, y, 14 * f, 26 * f, 0, side ? Math.PI / 2 : -Math.PI / 2, side ? Math.PI * 1.5 : Math.PI / 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Une touffe du pied des obstacles (herbe, fougère, roseaux, herbe sèche, herbes givrées, brindilles). */
export function swayTuft(ctx: Ctx, kind: KingdomTheme['moteKind'], col: string, s: number, ph: number): void {
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  switch (kind) {
    case 'firefly':
      if (ph > 3) tuft(ctx, s);
      else fern(ctx, col, s * 0.8);
      break;
    case 'spore':
      reeds(ctx, col, s);
      break;
    case 'sand':
      // herbe sèche
      ctx.lineWidth = 1.1 * s;
      ctx.beginPath();
      ctx.moveTo(0, 3);
      ctx.quadraticCurveTo(-3 * s, -3 * s, -7 * s, -5 * s);
      ctx.moveTo(0, 3);
      ctx.quadraticCurveTo(2 * s, -4 * s, 6 * s, -7 * s);
      ctx.moveTo(0, 3);
      ctx.lineTo(0.6 * s, -8 * s);
      ctx.stroke();
      break;
    case 'snow':
      // herbes givrées
      ctx.lineWidth = 1.1 * s;
      ctx.beginPath();
      ctx.moveTo(-2 * s, 3);
      ctx.lineTo(-4 * s, -6 * s);
      ctx.moveTo(1 * s, 3);
      ctx.lineTo(1.4 * s, -8 * s);
      ctx.moveTo(3 * s, 3);
      ctx.lineTo(6 * s, -4 * s);
      ctx.stroke();
      holes(ctx, [-4 * s, -6 * s, 1.1 * s, 1.4 * s, -8 * s, 1.1 * s, 6 * s, -4 * s, 1 * s], col);
      break;
    case 'ember':
      // brindilles calcinées
      ctx.lineWidth = 1.2 * s;
      ctx.beginPath();
      ctx.moveTo(0, 3);
      ctx.lineTo(-1 * s, -7 * s);
      ctx.lineTo(-4 * s, -9 * s);
      ctx.moveTo(-0.6 * s, -3 * s);
      ctx.lineTo(3 * s, -6 * s);
      ctx.stroke();
      break;
  }
}

export function hangingProp(ctx: Ctx, kind: KingdomTheme['moteKind'], col: string, hole: string, ph: number): void {
  ctx.fillStyle = col;
  ctx.strokeStyle = col;
  switch (kind) {
    case 'firefly':
      // feuille de chêne découpée
      almonds(ctx, [0, 6, 12, Math.PI / 2, 3.6], col);
      slits(ctx, [0, 1, 0, 11, 0, 5, -2, 3.6, 0, 8, 2, 6.6], 0.6, hole);
      break;
    case 'spore':
      // lanterne-luciole en papier
      ctx.beginPath();
      ctx.ellipse(0, 6, 4, 5.4, 0, 0, TAU);
      ctx.fill();
      ctx.fillRect(-2, 0, 4, 1.4);
      slits(ctx, [-1.6, 3, -1.6, 9, 1.6, 3, 1.6, 9], 0.6, hole);
      break;
    case 'sand':
      // amulette-soleil
      ctx.beginPath();
      ctx.arc(0, 6, 4, 0, TAU);
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (i * TAU) / 8;
        ctx.moveTo(Math.cos(a) * 5, 6 + Math.sin(a) * 5);
        ctx.lineTo(Math.cos(a) * 7.4, 6 + Math.sin(a) * 7.4);
      }
      ctx.stroke();
      holes(ctx, [0, 6, 1.6], hole);
      break;
    case 'snow':
      // flocon découpé
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3 + ph;
        ctx.moveTo(-Math.cos(a) * 6, 6 - Math.sin(a) * 6);
        ctx.lineTo(Math.cos(a) * 6, 6 + Math.sin(a) * 6);
      }
      ctx.stroke();
      holes(ctx, [0, 6, 1.6], col);
      holes(ctx, [0, 6, 0.7], hole);
      break;
    case 'ember':
      // braise de papier : flamme découpée en encre (pas de vermillon)
      ctx.beginPath();
      ctx.moveTo(-3.6, 9);
      ctx.quadraticCurveTo(-4, 3, 0, 0);
      ctx.quadraticCurveTo(4, 3, 3.6, 9);
      ctx.quadraticCurveTo(0, 11, -3.6, 9);
      ctx.fill();
      almonds(ctx, [0, 6.4, 4.4, Math.PI / 2, 1.2], hole);
      break;
  }
}

export function driftProp(ctx: Ctx, kind: KingdomTheme['moteKind'], col: string, i: number): void {
  switch (kind) {
    case 'firefly':
      almonds(ctx, [0, 0, 7, 0, 2.2], col);
      break;
    case 'spore':
      // aigrette
      ctx.strokeStyle = col;
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k * TAU) / 6;
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * 4, Math.sin(a) * 4);
      }
      ctx.stroke();
      break;
    case 'sand':
      ctx.strokeStyle = col;
      ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(-6, 0);
      ctx.quadraticCurveTo(0, -2, 6, 0);
      ctx.stroke();
      break;
    case 'snow':
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let k = 0; k < 3; k++) {
        const a = (k * Math.PI) / 3;
        ctx.moveTo(-Math.cos(a) * 3.4, -Math.sin(a) * 3.4);
        ctx.lineTo(Math.cos(a) * 3.4, Math.sin(a) * 3.4);
      }
      ctx.stroke();
      break;
    case 'ember':
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(-3, -2);
      ctx.lineTo(3, -1 - (i % 2));
      ctx.lineTo(1, 2.4);
      ctx.closePath();
      ctx.fill();
      break;
  }
}

// ───────────────────────────── Porte et cadre ─────────────────────────────

/** Porte de scène en haut de l'arène : close (encre) puis ouverte (lumière qui se déploie). */
export function paintPortal(ctx: Ctx, th: KingdomTheme, t: number, open01: number): void {
  const cx = AW / 2;
  const cy = -2;
  ctx.save();
  // fronton découpé
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(cx - 36, cy + 8);
  ctx.lineTo(cx - 36, cy - 14);
  ctx.arc(cx, cy - 14, 36, Math.PI, 0);
  ctx.lineTo(cx + 36, cy + 8);
  ctx.closePath();
  ctx.fill();
  // dentelle du fronton
  ctx.fillStyle = alpha(CUT, 0.35);
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i + 0.5) * (Math.PI / 9);
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * 29, cy - 14 + Math.sin(a) * 29, 1.5, 0, TAU);
    ctx.fill();
  }
  // ouverture
  ctx.beginPath();
  ctx.moveTo(cx - 22, cy + 10);
  ctx.lineTo(cx - 22, cy - 12);
  ctx.arc(cx, cy - 12, 22, Math.PI, 0);
  ctx.lineTo(cx + 22, cy + 10);
  ctx.closePath();
  ctx.fillStyle = open01 > 0 ? mix(INK2, CUT, Math.min(1, open01)) : INK2;
  ctx.fill();
  if (open01 > 0) {
    // rayons de lumière découpés qui tournent
    ctx.save();
    ctx.clip();
    ctx.translate(cx, cy - 6);
    ctx.rotate(t * 0.8);
    ctx.fillStyle = alpha(th.light, Math.min(1, 0.9 * open01));
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-4, -40);
      ctx.lineTo(4, -40);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    // lumière qui coule sur l'écran
    ctx.fillStyle = alpha(CUT, Math.min(1, 0.35 * open01));
    ctx.beginPath();
    ctx.moveTo(cx - 22, cy + 10);
    ctx.lineTo(cx + 22, cy + 10);
    ctx.lineTo(cx + 44, cy + 10 + 120 * open01);
    ctx.lineTo(cx - 44, cy + 10 + 120 * open01);
    ctx.closePath();
    ctx.fill();
  }
  // lune découpée au sommet
  circle(ctx, cx, cy - 40, 6, open01 > 0 ? CUT : INK2);
  circle(ctx, cx + 2.5, cy - 41.5, 5, INK);
  ctx.restore();
}

/** Coulisses : rideaux de théâtre et lambrequin festonné autour de l'écran. */
export function paintFrame(ctx: Ctx, w: number, h: number, top: number, bottom: number, _th: KingdomTheme): void {
  ctx.fillStyle = CURTAIN;
  ctx.fillRect(0, 0, w, h);
  // plis verticaux des rideaux
  for (let x = 0; x < w; x += 22) {
    const k = hashCell(Math.floor(x / 22), 7);
    ctx.fillStyle = alpha(CURTAIN_LIGHT, 0.35 + k * 0.4);
    ctx.fillRect(x + 4, 0, 7 + k * 4, h);
    ctx.fillStyle = alpha('#000000', 0.25);
    ctx.fillRect(x + 16, 0, 3, h);
  }
  // lambrequin festonné en haut, glands dorés
  if (top > 12) {
    const vy = Math.min(top - 6, 60);
    ctx.fillStyle = INK;
    ctx.fillRect(0, 0, w, vy - 14);
    ctx.beginPath();
    ctx.moveTo(0, vy - 15);
    for (let x = 0; x <= w + 30; x += 30) ctx.arc(x + 15, vy - 15, 15, Math.PI, 0, true);
    ctx.lineTo(w, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
    // galon doré
    ctx.strokeStyle = alpha(GOLD_LEAF, 0.8);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, vy - 20);
    ctx.lineTo(w, vy - 20);
    ctx.stroke();
    // découpes en lune sur le lambrequin, glands aux pointes
    for (let x = 0; x <= w + 30; x += 30) {
      circle(ctx, x + 15, vy - 26, 2.4, alpha(GOLD_LEAF, 0.55));
      circle(ctx, x + 16, vy - 26.6, 2, INK);
      ctx.strokeStyle = alpha(GOLD_LEAF, 0.7);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, vy - 15);
      ctx.lineTo(x, vy - 8);
      ctx.stroke();
      circle(ctx, x, vy - 6, 1.8, alpha(GOLD_LEAF, 0.85));
    }
  }
  // rampe de scène en bas (planches)
  if (bottom > 12) {
    const y0 = h - bottom;
    ctx.fillStyle = INK;
    ctx.fillRect(0, y0, w, bottom);
    ctx.strokeStyle = INK2;
    ctx.lineWidth = 1.5;
    for (let y = y0 + 14; y < h; y += 14) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    // lampes de rampe et leurs coupelles
    for (let x = 30; x < w; x += 60) {
      ctx.fillStyle = INK2;
      ctx.beginPath();
      ctx.arc(x, y0 + 7, 7, 0, Math.PI);
      ctx.fill();
      circle(ctx, x, y0 + 7, 4, LAMP);
    }
  }
}

/** Flamme d'une applique du cadre : `f` ≈ 0,5–1 (vacillement), `lean` décale la pointe. */
export function lampFlame(ctx: Ctx, x: number, y: number, f: number, lean = 0): void {
  ctx.fillStyle = LAMP;
  ctx.beginPath();
  ctx.moveTo(x - 2.6 * f, y + 2);
  ctx.quadraticCurveTo(x - 2.4 * f, y - 3 * f, x + lean, y - 6.5 * f);
  ctx.quadraticCurveTo(x + 2.4 * f, y - 3 * f, x + 2.6 * f, y + 2);
  ctx.closePath();
  ctx.fill();
  circle(ctx, x, y + 0.6, 1.1 * f, CUT);
}

// ───────────────────────────── Pièces isolées (atlas iOS) ─────────────────────────────
// Le pipeline d'atlas (`pnpm art:atlas`) découpe le décor en pièces : chaque fonction dessine une pièce
// centrée sur sa case (origine = coin haut-gauche de la case), avec les mêmes tracés que l'arène.

/** Une grille vide (sol libre) aux dimensions de l'arène, avec quelques cases imposées. */
function gridWith(cells: [number, number, string][]): string[] {
  const g = Array.from({ length: ROWS }, () => '.'.repeat(COLS).split(''));
  for (const [c, r, ch] of cells) g[r][c] = ch;
  return g.map((row) => row.join(''));
}

/** Rocher du royaume ; `variant` choisit la case d'origine (le tracé dépend de la case). */
export function paintRockPiece(ctx: Ctx, th: KingdomTheme, variant: number): void {
  const c = 1 + (variant % 7);
  const r = 2 + ((variant * 3) % 11);
  ctx.save();
  ctx.translate(-c * CELL, -r * CELL);
  rock(ctx, c, r, th);
  ctx.restore();
}

export function paintHedgePiece(ctx: Ctx, th: KingdomTheme, variant: number): void {
  const c = 1 + (variant % 7);
  const r = 2 + ((variant * 5) % 11);
  ctx.save();
  ctx.translate(-c * CELL, -r * CELL);
  hedge(ctx, c, r, th);
  ctx.restore();
}

/**
 * Case d'eau (ou de lave) selon ses voisines liquides : `mask` = N 1 | E 2 | S 4 | O 8.
 * Les 16 cases forment un jeu d'« autotiles » (coins arrondis et berges festonnées côté sol).
 */
export function paintLiquidPiece(ctx: Ctx, th: KingdomTheme, mask: number): void {
  const c = 4;
  const r = 7;
  const cells: [number, number, string][] = [[c, r, '~']];
  if (mask & 1) cells.push([c, r - 1, '~']);
  if (mask & 2) cells.push([c + 1, r, '~']);
  if (mask & 4) cells.push([c, r + 1, '~']);
  if (mask & 8) cells.push([c - 1, r, '~']);
  const g = gridWith(cells);
  ctx.save();
  ctx.translate(-c * CELL, -r * CELL);
  ctx.beginPath();
  ctx.rect(c * CELL - 2, r * CELL - 2, CELL + 4, CELL + 4);
  ctx.clip();
  liquidCell(ctx, g, c, r, th, 0);
  liquidCell(ctx, g, c, r, th, 1);
  ctx.restore();
}

/** Crêtes de vagues animées d'une case liquide (calque transparent, même boucle que `paintLiquids`). */
export function paintLiquidWaves(ctx: Ctx, th: KingdomTheme, t: number): void {
  paintLiquids(ctx, gridWith([[0, 0, '~']]), th, t);
}

/** Petite découpe lointaine semée sur le sol (4 variantes par royaume). */
export function paintFarPiece(ctx: Ctx, th: KingdomTheme, variant: number): void {
  farDetail(ctx, 0, 0, th, (variant % 4) / 4 + 0.01, 0);
}

/** Frise de paysage lointain du haut de l'écran (AW × 60). */
export function paintHorizon(ctx: Ctx, th: KingdomTheme): void {
  horizon(ctx, th);
}

/** Écran de papier nu (lumière, fibres, plis, frise lointaine), sans cadre, obstacles ni découpes semées : AW × AH. */
export function paintPaperScreen(ctx: Ctx, th: KingdomTheme): void {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, AW, AH);
  ctx.clip();
  paintArenaStatic(ctx, gridWith([]), th, { far: false });
  ctx.restore();
}

/** Règle de placement des découpes semées (`far_XX`) : la même que `paintArenaStatic`. */
export function farSpot(grid: string[], c: number, r: number): { x: number; y: number; variant: number; flip: boolean } | null {
  if (!isFree(grid[r][c]) || grid[r][c] === 'P' || hashCell(c, r) < 0.55) return null;
  return { x: c * CELL + 8 + hashCell(c, r, 1) * (CELL - 16), y: r * CELL + 10 + hashCell(c, r, 2) * (CELL - 16), variant: Math.floor(hashCell(c, r, 3) * 4), flip: hashCell(c, r, 4) > 0.5 };
}

/**
 * Tuile transparente de fibres et de plis du papier (`size` multiple de CELL), raccordable :
 * à poser en mosaïque sur la lumière de l'écran. Les plis tombent sur les bords des cases.
 */
export function paintFibreTile(ctx: Ctx, size: number): void {
  for (let i = 0; i < Math.round((260 * size * size) / (AW * AH)); i++) {
    const x = hashCell(i, 1, 3) * size;
    const y = hashCell(i, 2, 4) * size;
    const l = 3 + hashCell(i, 3, 5) * 9;
    const a = hashCell(i, 4, 6) * Math.PI;
    ctx.strokeStyle = alpha(hashCell(i, 5, 7) > 0.5 ? INK : CUT, 0.05 + hashCell(i, 6, 8) * 0.05);
    ctx.lineWidth = 0.8;
    // la fibre est répétée de l'autre côté du bord : la tuile se raccorde sans couture
    for (const dx of [-size, 0, size]) {
      for (const dy of [-size, 0, size]) {
        ctx.beginPath();
        ctx.moveTo(x + dx, y + dy);
        ctx.lineTo(x + dx + Math.cos(a) * l, y + dy + Math.sin(a) * l);
        ctx.stroke();
      }
    }
  }
  ctx.strokeStyle = alpha(INK, 0.06);
  ctx.lineWidth = 1;
  for (let v = 0; v < size; v += CELL) {
    // demi-trait sur chaque bord : deux tuiles voisines recomposent le pli entier
    ctx.beginPath();
    ctx.moveTo(v, 0);
    ctx.lineTo(v, size);
    ctx.moveTo(0, v);
    ctx.lineTo(size, v);
    ctx.stroke();
  }
}

/** Cadre de scène (montants, moulure, clous, appliques) seul : (AW + 2 WALL) × (AH + 2 WALL), centre transparent. */
export function paintStageFrame(ctx: Ctx, th: KingdomTheme): void {
  paintArenaStatic(ctx, gridWith([]), th, { far: false });
  ctx.clearRect(0, 0, AW, AH);
}

/** Porte de scène seule (calque transparent) ; repère : centre de la porte en (AW/2, 0). */
export { paintPortal as paintPortalPiece };
