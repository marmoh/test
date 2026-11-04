/** Décor d'arène : sol, murs, rochers, eau/lave, haies, portail (5 royaumes). */
import { INK, mix, shade, alpha, circle, ellipse, glow, type Ctx } from './draw.js';
import type { KingdomTheme } from './palette.js';

export const CELL = 44;
export const COLS = 9;
export const ROWS = 15;
export const AW = CELL * COLS;
export const AH = CELL * ROWS;
/** épaisseur des murs dessinés autour de l'arène */
export const WALL = 26;

function hashCell(c: number, r: number, k = 0): number {
  let h = (c * 374761393 + r * 668265263 + k * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Couche statique (sol + murs + obstacles), dessinée une fois par salle. */
export function paintArenaStatic(ctx: Ctx, grid: string[], th: KingdomTheme): void {
  // murs extérieurs
  ctx.fillStyle = th.wall;
  ctx.fillRect(-WALL, -WALL, AW + WALL * 2, AH + WALL * 2);
  for (let i = -1; i <= COLS; i++) {
    for (const y of [-WALL, AH]) brick(ctx, i * CELL, y, CELL, WALL, th, i);
  }
  for (let j = -1; j <= ROWS; j++) {
    for (const x of [-WALL, AW]) brick(ctx, x, j * CELL, WALL, CELL, th, j + 7);
  }
  // sol en damier doux
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      ctx.fillStyle = (r + c) % 2 === 0 ? th.ground : th.groundAlt;
      ctx.fillRect(c * CELL, r * CELL, CELL, CELL);
    }
  }
  // détails de sol
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== '.' && grid[r][c] !== 'S' && grid[r][c] !== 'P') continue;
      const n = hashCell(c, r) < 0.35 ? 0 : 1 + Math.floor(hashCell(c, r, 99) * 2);
      for (let k = 0; k < n; k++) {
        const x = c * CELL + 6 + hashCell(c, r, k + 1) * (CELL - 12);
        const y = r * CELL + 6 + hashCell(c, r, k + 11) * (CELL - 12);
        groundDetail(ctx, x, y, th, hashCell(c, r, k + 21));
      }
    }
  }
  // flaques de clair de lune (relief doux du sol)
  for (let i = 0; i < 5; i++) {
    const x = hashCell(i, 3, 7) * AW;
    const y = hashCell(i, 5, 9) * AH;
    const g = ctx.createRadialGradient(x, y, 0, x, y, 90 + hashCell(i, 1, 1) * 60);
    g.addColorStop(0, alpha(th.groundDetail, 0.16));
    g.addColorStop(1, alpha(th.groundDetail, 0));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, AW, AH);
  }
  // ombre portée des murs
  const sh = ctx.createLinearGradient(0, 0, 0, 22);
  sh.addColorStop(0, 'rgba(5,3,15,0.45)');
  sh.addColorStop(1, 'rgba(5,3,15,0)');
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, AW, 22);
  const sl = ctx.createLinearGradient(0, 0, 14, 0);
  sl.addColorStop(0, 'rgba(5,3,15,0.35)');
  sl.addColorStop(1, 'rgba(5,3,15,0)');
  ctx.fillStyle = sl;
  ctx.fillRect(0, 0, 14, AH);
  const sr = ctx.createLinearGradient(AW, 0, AW - 14, 0);
  sr.addColorStop(0, 'rgba(5,3,15,0.35)');
  sr.addColorStop(1, 'rgba(5,3,15,0)');
  ctx.fillStyle = sr;
  ctx.fillRect(AW - 14, 0, 14, AH);

  // liquides (fond statique ; le miroitement est animé)
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (grid[r][c] === '~') liquidCell(ctx, grid, c, r, th);
  // haies puis rochers (ordre de profondeur)
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] === '%') hedge(ctx, c, r, th);
      if (grid[r][c] === '#') rock(ctx, c, r, th);
    }
  }
  // vignette
  const v = ctx.createRadialGradient(AW / 2, AH / 2, AH * 0.3, AW / 2, AH / 2, AH * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(5,3,15,0.35)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, AW, AH);
}

function brick(ctx: Ctx, x: number, y: number, w: number, h: number, th: KingdomTheme, i: number): void {
  const k = hashCell(i, Math.round(x + y));
  ctx.fillStyle = mix(th.wall, th.wallLight, 0.25 + k * 0.4);
  ctx.beginPath();
  ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 5);
  ctx.fill();
  ctx.strokeStyle = alpha('#000000', 0.35);
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = alpha('#ffffff', 0.08);
  ctx.fillRect(x + 4, y + 3, w - 8, 3);
}

function groundDetail(ctx: Ctx, x: number, y: number, th: KingdomTheme, k: number): void {
  ctx.save();
  ctx.globalAlpha = 0.7;
  ctx.translate(x, y);
  switch (th.moteKind) {
    case 'firefly': // forêt : touffes d'herbe, petites fleurs
      if (k < 0.7) {
        ctx.strokeStyle = th.groundDetail;
        ctx.lineWidth = 1.6;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-3, 2);
        ctx.lineTo(-4, -3);
        ctx.moveTo(0, 2);
        ctx.lineTo(0, -4);
        ctx.moveTo(3, 2);
        ctx.lineTo(4, -2);
        ctx.stroke();
      } else {
        for (let i = 0; i < 4; i++) circle(ctx, Math.cos(i * 1.57) * 2, Math.sin(i * 1.57) * 2, 1.6, k > 0.85 ? '#f6e7b8' : '#c8a8ff');
        circle(ctx, 0, 0, 1.2, '#ffcf4a');
      }
      break;
    case 'spore': // marais : flaques sombres, roseaux
      if (k < 0.5) ellipse(ctx, 0, 0, 5, 2.5, alpha('#1a1a10', 0.25));
      else {
        ctx.strokeStyle = th.groundDetail;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, 3);
        ctx.quadraticCurveTo(1, -2, -1, -6);
        ctx.stroke();
        ellipse(ctx, -1, -6, 1.3, 2.4, '#6b4a2a');
      }
      break;
    case 'sand': // désert : ondulations, cailloux
      if (k < 0.6) {
        ctx.strokeStyle = alpha('#ffffff', 0.18);
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.arc(0, 4, 6, Math.PI * 1.15, Math.PI * 1.85);
        ctx.stroke();
      } else ellipse(ctx, 0, 0, 2.2, 1.6, shade(th.rock, 0.1));
      break;
    case 'snow': // givre : éclats
      ctx.strokeStyle = alpha('#ffffff', 0.7);
      ctx.lineWidth = 1;
      if (k < 0.5) {
        ctx.beginPath();
        for (let i = 0; i < 3; i++) {
          const a = (i * Math.PI) / 3;
          ctx.moveTo(-Math.cos(a) * 3, -Math.sin(a) * 3);
          ctx.lineTo(Math.cos(a) * 3, Math.sin(a) * 3);
        }
        ctx.stroke();
      } else ellipse(ctx, 0, 0, 4, 2, alpha('#9fb8d8', 0.35));
      break;
    case 'ember': // cendres : fissures rougeoyantes
      if (k < 0.55) {
        ctx.strokeStyle = alpha('#ff6a3d', 0.35);
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(-5, -2);
        ctx.lineTo(-1, 1);
        ctx.lineTo(2, -1);
        ctx.lineTo(5, 3);
        ctx.stroke();
      } else ellipse(ctx, 0, 0, 2.4, 1.6, alpha('#120a0c', 0.45));
      break;
  }
  ctx.restore();
}

function rock(ctx: Ctx, c: number, r: number, th: KingdomTheme): void {
  const cx = c * CELL + CELL / 2;
  const cy = r * CELL + CELL / 2;
  ellipse(ctx, cx + 3, cy + 15, 21, 8, 'rgba(5,3,15,0.35)');
  ctx.beginPath();
  const N = 9;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2;
    const rr = 20 + hashCell(c, r, i) * 4;
    const x = cx + Math.cos(a) * rr;
    const y = cy + Math.sin(a) * rr * 0.92 - 2;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  const g = ctx.createLinearGradient(cx - 18, cy - 20, cx + 14, cy + 20);
  g.addColorStop(0, th.rockLight);
  g.addColorStop(0.45, th.rock);
  g.addColorStop(1, th.rockDark);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = INK;
  ctx.stroke();
  // facettes
  ctx.strokeStyle = alpha('#000000', 0.25);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy - 14);
  ctx.lineTo(cx + 2, cy - 2);
  ctx.lineTo(cx + 14, cy + 2);
  ctx.moveTo(cx + 2, cy - 2);
  ctx.lineTo(cx - 2, cy + 14);
  ctx.stroke();
  ellipse(ctx, cx - 8, cy - 10, 5, 2.5, alpha('#ffffff', 0.35));
  if (th.moteKind === 'firefly' || th.moteKind === 'spore') {
    ellipse(ctx, cx - 4, cy - 15, 9, 3.5, alpha(th.hedgeLight, 0.85));
  }
  if (th.moteKind === 'snow') ellipse(ctx, cx - 2, cy - 15, 11, 4, '#f4fbff');
}

function hedge(ctx: Ctx, c: number, r: number, th: KingdomTheme): void {
  const cx = c * CELL + CELL / 2;
  const cy = r * CELL + CELL / 2;
  ellipse(ctx, cx + 2, cy + 14, 22, 7, 'rgba(5,3,15,0.3)');
  const pts: [number, number, number][] = [
    [-10, 4, 11],
    [10, 4, 11],
    [0, 7, 12],
    [-7, -6, 11],
    [7, -6, 11],
    [0, -10, 10],
  ];
  for (const [x, y, rr] of pts) circle(ctx, cx + x, cy + y, rr, th.hedge, INK, 2.2);
  for (const [x, y, rr] of pts) circle(ctx, cx + x - 2, cy + y - 3, rr * 0.55, alpha(th.hedgeLight, 0.55));
  // baies / fleurs
  for (let i = 0; i < 3; i++) {
    const k = hashCell(c, r, i + 40);
    circle(ctx, cx - 12 + k * 24, cy - 8 + hashCell(c, r, i + 50) * 16, 2, th.moteKind === 'snow' ? '#ffffff' : th.moteKind === 'ember' ? '#ff6a3d' : '#ff5f7a');
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
  // berge
  ctx.beginPath();
  ctx.roundRect(x - 1, y - 1, CELL + 2, CELL + 2, [tl, tr, br, bl]);
  ctx.fillStyle = th.liquidIsLava ? '#2a1414' : shade(th.ground, -0.35);
  ctx.fill();
  ctx.beginPath();
  ctx.roundRect(x + (isL(c - 1, r) ? 0 : 3), y + (isL(c, r - 1) ? 0 : 4), CELL - (isL(c - 1, r) ? 0 : 3) - (isL(c + 1, r) ? 0 : 3), CELL - (isL(c, r - 1) ? 0 : 4) - (isL(c, r + 1) ? 0 : 3), [tl, tr, br, bl]);
  const g = ctx.createLinearGradient(x, y, x, y + CELL);
  g.addColorStop(0, shade(th.liquid, -0.25));
  g.addColorStop(1, th.liquid);
  ctx.fillStyle = g;
  ctx.fill();
}

/** Miroitement animé des liquides. */
export function paintLiquids(ctx: Ctx, grid: string[], th: KingdomTheme, t: number): void {
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (grid[r][c] !== '~') continue;
      const x = c * CELL;
      const y = r * CELL;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 3, y + 4, CELL - 6, CELL - 7);
      ctx.clip();
      if (th.liquidIsLava) {
        const pulse = 0.5 + 0.5 * Math.sin(t * 2 + c + r);
        glow(ctx, x + CELL / 2, y + CELL / 2, 30, th.liquidLight, 0.25 + 0.2 * pulse);
        for (let k = 0; k < 2; k++) {
          const ph = (t * 0.6 + hashCell(c, r, k) * 3) % 1;
          circle(ctx, x + 8 + hashCell(c, r, k + 5) * 28, y + 10 + hashCell(c, r, k + 9) * 24, 1 + ph * 4, alpha('#ffd36b', 1 - ph));
        }
      } else {
        ctx.strokeStyle = alpha(th.liquidLight, 0.55);
        ctx.lineWidth = 1.5;
        ctx.lineCap = 'round';
        for (let k = 0; k < 3; k++) {
          const yy = y + 10 + k * 12 + Math.sin(t * 1.5 + c + k) * 2;
          const xx = x + 6 + ((t * 8 + k * 13 + c * 7) % 30);
          ctx.beginPath();
          ctx.moveTo(xx, yy);
          ctx.quadraticCurveTo(xx + 4, yy - 2, xx + 8, yy);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }
}

/** Portail en haut de l'arène (fermé → ouvert avec tourbillon). */
export function paintPortal(ctx: Ctx, th: KingdomTheme, t: number, open01: number): void {
  const cx = AW / 2;
  const cy = -4;
  ctx.save();
  // arche
  ctx.beginPath();
  ctx.moveTo(cx - 30, cy + 10);
  ctx.lineTo(cx - 30, cy - 12);
  ctx.arc(cx, cy - 12, 30, Math.PI, 0);
  ctx.lineTo(cx + 30, cy + 10);
  ctx.closePath();
  ctx.fillStyle = shade(th.wallLight, 0.15);
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // intérieur
  ctx.beginPath();
  ctx.moveTo(cx - 21, cy + 10);
  ctx.lineTo(cx - 21, cy - 12);
  ctx.arc(cx, cy - 12, 21, Math.PI, 0);
  ctx.lineTo(cx + 21, cy + 10);
  ctx.closePath();
  ctx.fillStyle = '#07040f';
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (open01 > 0) {
    glow(ctx, cx, cy - 6, 40, th.accent, 0.7 * open01);
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.strokeStyle = alpha(i % 2 ? '#ffffff' : th.accent, 0.8 * open01);
      ctx.lineWidth = 2;
      const a0 = t * 3 + i * 1.25;
      for (let k = 0; k < 20; k++) {
        const a = a0 + k * 0.25;
        const rr = 2 + k * 1.1;
        const x = cx + Math.cos(a) * rr;
        const y = cy - 6 + Math.sin(a) * rr;
        if (k === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
  // runes de l'arche
  for (let i = 0; i < 5; i++) {
    const a = Math.PI + (i + 0.5) * (Math.PI / 5);
    const x = cx + Math.cos(a) * 25.5;
    const y = cy - 12 + Math.sin(a) * 25.5;
    circle(ctx, x, y, 2.2, open01 > 0 ? mix(th.accent, '#ffffff', 0.3) : alpha('#000000', 0.4));
    if (open01 > 0) glow(ctx, x, y, 7, th.accent, 0.6 * open01);
  }
  ctx.restore();
}

/** Décor hors arène (haut et bas de l'écran) : silhouettes du royaume. */
export function paintFrame(ctx: Ctx, w: number, h: number, top: number, bottom: number, th: KingdomTheme): void {
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, th.sky[0]);
  g.addColorStop(1, th.sky[1]);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  // étoiles
  for (let i = 0; i < 40; i++) {
    const x = hashCell(i, 1, 2) * w;
    const y = hashCell(i, 2, 3) * Math.max(40, top);
    circle(ctx, x, y, 0.6 + hashCell(i, 3, 4) * 1.1, alpha('#ffffff', 0.3 + hashCell(i, 4, 5) * 0.6));
  }
  const band = (y0: number, dir: 1 | -1, col: string, amp: number, k: number) => {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(0, dir > 0 ? h : 0);
    for (let x = 0; x <= w + 20; x += 18) {
      const n = hashCell(Math.floor(x / 18), k, 11);
      let yy: number;
      switch (th.moteKind) {
        case 'snow':
        case 'ember':
          yy = y0 - dir * (amp * (0.3 + n) * (Math.floor(x / 18) % 3 === 0 ? 1.6 : 0.6));
          break;
        case 'sand':
          yy = y0 - dir * amp * (0.5 + 0.5 * Math.sin(x * 0.02 + k));
          break;
        default:
          yy = y0 - dir * amp * (0.4 + n * 0.8);
      }
      ctx.lineTo(x, yy);
    }
    ctx.lineTo(w + 20, dir > 0 ? h : 0);
    ctx.closePath();
    ctx.fill();
  };
  // haut : cime / crêtes lointaines ; bas : premier plan
  if (top > 10) {
    band(top * 0.95, 1, alpha(th.wallLight, 0.45), Math.min(40, top * 0.5), 1);
    band(top + 6, 1, th.wall, Math.min(26, top * 0.35), 2);
  }
  if (bottom > 10) {
    const y0 = h - bottom;
    band(y0 + bottom * 0.35, -1, shade(th.hedge, -0.1), 22, 3);
    for (let i = 0; i < 9; i++) {
      const x = hashCell(i, 7, 7) * w;
      const yy = y0 + bottom * (0.45 + hashCell(i, 8, 8) * 0.4);
      circle(ctx, x, yy, 16 + hashCell(i, 9, 9) * 18, shade(th.hedge, -0.2 + hashCell(i, 2, 2) * 0.15));
    }
  }
}
