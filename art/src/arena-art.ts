/**
 * Décor d'arène « théâtre d'ombres » : un écran de papier éclairé par derrière,
 * des obstacles découpés dans l'encre, l'eau et la lave vues à travers un gel coloré,
 * une scène encadrée de rideaux.
 */
import { INK, INK2, CUT, CURTAIN, CURTAIN_LIGHT, DANGER, type KingdomTheme } from './palette.js';
import { mix, alpha, circle, type Ctx } from './draw.js';

export const CELL = 44;
export const COLS = 9;
export const ROWS = 15;
export const AW = CELL * COLS;
export const AH = CELL * ROWS;
/** épaisseur du cadre (montants de la scène) autour de l'écran */
export const WALL = 26;

function hashCell(c: number, r: number, k = 0): number {
  let h = (c * 374761393 + r * 668265263 + k * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

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

/** Couche statique (écran, cadre, obstacles), dessinée une fois par salle. */
export function paintArenaStatic(ctx: Ctx, grid: string[], th: KingdomTheme): void {
  // cadre de scène en bois sombre
  ctx.fillStyle = INK;
  ctx.fillRect(-WALL, -WALL, AW + WALL * 2, AH + WALL * 2);
  ctx.strokeStyle = INK2;
  ctx.lineWidth = 2;
  ctx.strokeRect(-WALL + 5, -WALL + 5, AW + WALL * 2 - 10, AH + WALL * 2 - 10);
  // clous du cadre
  for (let i = 0; i <= 12; i++) {
    const y = -WALL / 2 + (i * (AH + WALL)) / 12;
    circle(ctx, -WALL / 2, y, 2, INK2);
    circle(ctx, AW + WALL / 2, y, 2, INK2);
  }

  // écran de papier : lumière au centre, bords brûlés
  const g = ctx.createRadialGradient(AW / 2, AH * 0.45, 30, AW / 2, AH * 0.5, AH * 0.72);
  g.addColorStop(0, th.light);
  g.addColorStop(0.55, th.paper);
  g.addColorStop(1, th.edge);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, AW, AH);

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

  // silhouettes lointaines projetées sur l'écran (décor, encre diluée)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (!'.SP'.includes(grid[r][c]) || hashCell(c, r) < 0.62) continue;
      const x = c * CELL + 8 + hashCell(c, r, 1) * (CELL - 16);
      const y = r * CELL + 10 + hashCell(c, r, 2) * (CELL - 16);
      farDetail(ctx, x, y, th, hashCell(c, r, 3));
    }
  }

  // liquides (gel coloré), puis haies et rochers découpés
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (grid[r][c] === '~') liquidCell(ctx, grid, c, r, th);
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === '%') hedge(ctx, c, r, th);
      if (grid[r][c] === '#') rock(ctx, c, r);
    }
  }
}

function farDetail(ctx: Ctx, x: number, y: number, th: KingdomTheme, k: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = alpha(th.far, 0.55);
  ctx.strokeStyle = alpha(th.far, 0.55);
  ctx.lineCap = 'round';
  switch (th.moteKind) {
    case 'firefly':
      if (k < 0.5) {
        // brins d'herbe
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(-3, 3);
        ctx.quadraticCurveTo(-4, -2, -6, -5);
        ctx.moveTo(0, 3);
        ctx.lineTo(0, -6);
        ctx.moveTo(3, 3);
        ctx.quadraticCurveTo(4, -1, 6, -4);
        ctx.stroke();
      } else {
        // petite fleur découpée
        for (let i = 0; i < 5; i++) circle(ctx, Math.cos((i * 2 * Math.PI) / 5) * 2.6, Math.sin((i * 2 * Math.PI) / 5) * 2.6, 1.8, alpha(th.far, 0.55));
      }
      break;
    case 'spore':
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(0, 4);
      ctx.quadraticCurveTo(1, -3, -1, -8);
      ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(-1, -8, 1.4, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'sand':
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(0, 5, 7, Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
      break;
    case 'snow':
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = (i * Math.PI) / 3;
        ctx.moveTo(-Math.cos(a) * 4, -Math.sin(a) * 4);
        ctx.lineTo(Math.cos(a) * 4, Math.sin(a) * 4);
      }
      ctx.stroke();
      break;
    case 'ember':
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(-6, -2);
      ctx.lineTo(-1, 1);
      ctx.lineTo(2, -2);
      ctx.lineTo(6, 3);
      ctx.stroke();
      break;
  }
  ctx.restore();
}

function rock(ctx: Ctx, c: number, r: number): void {
  const cx = c * CELL + CELL / 2;
  const cy = r * CELL + CELL / 2;
  const N = 10;
  const pts: [number, number][] = [];
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const rr = 19 + hashCell(c, r, i) * 5;
    pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.92]);
  }
  cutPath(ctx, pts, c * 31 + r);
  ctx.fillStyle = INK;
  ctx.fill();
  // facettes découpées : fines entailles de lumière
  ctx.strokeStyle = alpha(CUT, 0.55);
  ctx.lineWidth = 1.4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 9, cy - 9);
  ctx.lineTo(cx - 2, cy - 1);
  ctx.moveTo(cx + 3, cy - 12);
  ctx.lineTo(cx + 8, cy - 5);
  ctx.stroke();
}

function hedge(ctx: Ctx, c: number, r: number, th: KingdomTheme): void {
  const cx = c * CELL + CELL / 2;
  const cy = r * CELL + CELL / 2;
  ctx.fillStyle = INK;
  const blobs: [number, number, number][] = [
    [-11, 5, 11],
    [11, 5, 11],
    [0, 8, 12],
    [-8, -6, 11],
    [8, -6, 11],
    [0, -11, 10],
  ];
  ctx.beginPath();
  for (const [x, y, rr] of blobs) {
    ctx.moveTo(cx + x + rr, cy + y);
    ctx.arc(cx + x, cy + y, rr, 0, Math.PI * 2);
  }
  ctx.fill();
  // feuilles découpées
  ctx.fillStyle = mix(th.light, CUT, 0.4);
  for (let i = 0; i < 5; i++) {
    const x = cx - 12 + hashCell(c, r, i + 40) * 24;
    const y = cy - 10 + hashCell(c, r, i + 50) * 18;
    const a = hashCell(c, r, i + 60) * Math.PI;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.ellipse(0, 0, 3.2, 1.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function liquidCell(ctx: Ctx, grid: string[], c: number, r: number, th: KingdomTheme): void {
  const x = c * CELL;
  const y = r * CELL;
  const isL = (cc: number, rr: number) => rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && grid[rr][cc] === '~';
  const rad = 14;
  const tl = !isL(c - 1, r) && !isL(c, r - 1) ? rad : 0;
  const tr = !isL(c + 1, r) && !isL(c, r - 1) ? rad : 0;
  const br = !isL(c + 1, r) && !isL(c, r + 1) ? rad : 0;
  const bl = !isL(c - 1, r) && !isL(c, r + 1) ? rad : 0;
  // bord d'encre puis gel coloré
  ctx.beginPath();
  ctx.roundRect(x - 1, y - 1, CELL + 2, CELL + 2, [tl, tr, br, bl]);
  ctx.fillStyle = INK;
  ctx.fill();
  const ix = isL(c - 1, r) ? 0 : 4;
  const iy = isL(c, r - 1) ? 0 : 4;
  ctx.beginPath();
  ctx.roundRect(x + ix, y + iy, CELL - ix - (isL(c + 1, r) ? 0 : 4), CELL - iy - (isL(c, r + 1) ? 0 : 4), [tl * 0.7, tr * 0.7, br * 0.7, bl * 0.7]);
  ctx.fillStyle = th.gel;
  ctx.fill();
}

/** Vaguelettes découpées qui défilent dans le gel. */
export function paintLiquids(ctx: Ctx, grid: string[], th: KingdomTheme, t: number): void {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== '~') continue;
      const x = c * CELL;
      const y = r * CELL;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 4, y + 4, CELL - 8, CELL - 8);
      ctx.clip();
      ctx.strokeStyle = th.gelLight;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      for (let k = 0; k < 3; k++) {
        const yy = y + 11 + k * 11 + Math.sin(t * 1.4 + c + k) * 1.5;
        const xx = x + 2 + ((t * (th.liquidIsLava ? 5 : 9) + k * 13 + c * 7) % 34);
        ctx.beginPath();
        ctx.moveTo(xx, yy);
        ctx.quadraticCurveTo(xx + 4, yy - 3, xx + 8, yy);
        ctx.quadraticCurveTo(xx + 12, yy + 3, xx + 16, yy);
        ctx.stroke();
      }
      if (th.liquidIsLava) {
        const ph = (t * 0.7 + hashCell(c, r)) % 1;
        circle(ctx, x + 10 + hashCell(c, r, 5) * 24, y + 12 + hashCell(c, r, 9) * 20, 1 + ph * 3.5, alpha(th.gelLight, 1 - ph));
      }
      ctx.restore();
    }
  }
}

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
  // ouverture
  ctx.beginPath();
  ctx.moveTo(cx - 22, cy + 10);
  ctx.lineTo(cx - 22, cy - 12);
  ctx.arc(cx, cy - 12, 22, Math.PI, 0);
  ctx.lineTo(cx + 22, cy + 10);
  ctx.closePath();
  ctx.fillStyle = open01 > 0 ? mix(INK2, CUT, open01) : INK2;
  ctx.fill();
  if (open01 > 0) {
    // rayons de lumière découpés qui tournent
    ctx.save();
    ctx.clip();
    ctx.translate(cx, cy - 6);
    ctx.rotate(t * 0.8);
    ctx.fillStyle = alpha(th.light, 0.9 * open01);
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
    ctx.fillStyle = alpha(CUT, 0.35 * open01);
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
  // lambrequin festonné en haut
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
    ctx.strokeStyle = alpha('#c9a13b', 0.8);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, vy - 20);
    ctx.lineTo(w, vy - 20);
    ctx.stroke();
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
    // lampes de rampe
    for (let x = 30; x < w; x += 60) {
      circle(ctx, x, y0 + 7, 4, '#e9c46a');
    }
  }
}
