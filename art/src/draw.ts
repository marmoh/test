/** Utilitaires de dessin vectoriel (Canvas 2D) partagés par tous les personnages. */

export type Ctx = CanvasRenderingContext2D;

import { INK, CUT } from './palette.js';
export { INK };

const cache = new Map<string, [number, number, number]>();
function rgb(hex: string): [number, number, number] {
  let v = cache.get(hex);
  if (!v) {
    const h = hex.replace('#', '');
    const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    cache.set(hex, v);
  }
  return v;
}

/** Mélange deux couleurs hex (k = 0 → a, 1 → b). */
export function mix(a: string, b: string, k: number): string {
  if (k <= 0) return a;
  if (k >= 1) return b;
  const A = rgb(a);
  const B = rgb(b);
  return `rgb(${(A[0] + (B[0] - A[0]) * k) | 0},${(A[1] + (B[1] - A[1]) * k) | 0},${(A[2] + (B[2] - A[2]) * k) | 0})`;
}

export function alpha(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function shade(hex: string, k: number): string {
  return k >= 0 ? mix(hex, '#ffffff', k) : mix(hex, '#000000', -k);
}

export function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string, stroke?: string, lw = 2): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

export function circle(ctx: Ctx, x: number, y: number, r: number, fill: string, stroke?: string, lw = 2): void {
  ellipse(ctx, x, y, r, r, fill, stroke, lw);
}

export function groundShadow(ctx: Ctx, rx: number, ry: number, y = 0, a = 0.32): void {
  ctx.beginPath();
  ctx.ellipse(0, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(27,20,24,${a * 0.55})`;
  ctx.fill();
}

/** Yeux de marionnette : des trous découpés par où passe la lumière, avec une petite pupille. */
export function eyes(ctx: Ctx, x: number, y: number, gap: number, r: number, look: number, _color = CUT, pupil = INK, blink = false): void {
  for (const s of [-1, 1]) {
    const ex = x + s * gap;
    if (blink) {
      ctx.beginPath();
      ctx.moveTo(ex - r, y);
      ctx.lineTo(ex + r, y);
      ctx.strokeStyle = CUT;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      continue;
    }
    circle(ctx, ex, y, r, CUT);
    circle(ctx, ex + look * r * 0.35, y + r * 0.1, r * 0.45, pupil);
  }
}

/**
 * Théâtre d'ombres : pas de halos. Conservé pour compatibilité, ne dessine rien.
 * Les effets lumineux voulus passent par `lightPatch`.
 */
export function glow(_ctx: Ctx, _x: number, _y: number, _r: number, _color: string, _a = 0.6): void {}

/** Tache de lumière franche (papier éclairé), sans dégradé. */
export function lightPatch(ctx: Ctx, x: number, y: number, r: number, color = CUT, a = 0.5): void {
  ctx.save();
  ctx.globalAlpha *= a;
  circle(ctx, x, y, r, color);
  ctx.restore();
}

export function blobPath(ctx: Ctx, r: number, t: number, lobes: number, amp: number, sx = 1, sy = 1): void {
  ctx.beginPath();
  const N = 28;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const rr = r * (1 + amp * Math.sin(lobes * a + t));
    const x = Math.cos(a) * rr * sx;
    const y = Math.sin(a) * rr * sy;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

export function star(ctx: Ctx, x: number, y: number, r: number, inner = 0.45, points = 5, rot = -Math.PI / 2): void {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rot + (i * Math.PI) / points;
    const rr = i % 2 === 0 ? r : r * inner;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath();
}

export function easeOutBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}
export function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}
export function easeInOut(x: number): number {
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}
