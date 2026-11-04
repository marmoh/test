/**
 * Personnages dessinés en vectoriel et animés procéduralement (« rigs » :
 * respiration, course, anticipation, impact). Chaque fonction dessine centrée
 * sur l'origine, à l'échelle 1 pt = 1 unité ; le pipeline d'atlas les
 * rastérise en @2x/@3x, le web les dessine en direct.
 */
import { INK, mix, shade, ellipse, circle, groundShadow, eyes, glow, blobPath, star, type Ctx } from './draw.js';
import { UI } from './palette.js';

export type AnimState = 'idle' | 'move' | 'windup' | 'charge' | 'recover' | 'spawn' | 'breath';

export interface Pose {
  /** temps global (s) */
  t: number;
  /** direction regardée (rad) */
  facing: number;
  state: AnimState;
  /** progression de l'anticipation 0→1 */
  windup: number;
  /** flash d'impact 0→1 */
  flash: number;
  elite: boolean;
  /** décalage de phase propre à l'entité */
  seed: number;
  /** pour les variantes de boss (0..2) et les tailles */
  variant?: number;
  hpFrac?: number;
  /** héros : visée active (corde tendue) */
  aiming?: boolean;
  /** héros : invulnérable (clignote) */
  blink?: boolean;
}

type Painter = (ctx: Ctx, p: Pose) => void;

const W = '#ffffff';
const tint = (p: Pose) => (c: string) => mix(c, W, p.flash * 0.85);

function facingSign(p: Pose): number {
  return Math.cos(p.facing) < -0.1 ? -1 : 1;
}

function eliteAura(ctx: Ctx, p: Pose, r: number): void {
  if (!p.elite) return;
  const pulse = 0.5 + 0.5 * Math.sin(p.t * 5 + p.seed);
  glow(ctx, 0, 0, r * 1.9, UI.gold, 0.35 + 0.2 * pulse);
  ctx.save();
  ctx.strokeStyle = UI.gold;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 6]);
  ctx.lineDashOffset = -p.t * 20;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.65, r * 1.25, r * 0.5, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function eliteCrown(ctx: Ctx, p: Pose, y: number): void {
  if (!p.elite) return;
  ctx.save();
  ctx.translate(0, y + Math.sin(p.t * 3 + p.seed) * 1.5);
  ctx.beginPath();
  ctx.moveTo(-8, 4);
  ctx.lineTo(-8, -3);
  ctx.lineTo(-4, 1);
  ctx.lineTo(0, -5);
  ctx.lineTo(4, 1);
  ctx.lineTo(8, -3);
  ctx.lineTo(8, 4);
  ctx.closePath();
  ctx.fillStyle = UI.gold;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.restore();
}

/** Lueur d'anticipation (télégraphe « lueur » ≥ 0,5 s). */
function windupGlow(ctx: Ctx, p: Pose, x: number, y: number, r: number, color: string): void {
  if (p.state !== 'windup') return;
  const k = Math.min(1, p.windup);
  glow(ctx, x, y, r * (1 + k * 1.2), color, 0.35 + 0.5 * k);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.globalAlpha = 0.5 + 0.5 * k;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, r * (2.2 - k * 1.2), 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

// ───────────────────────────── Héroïne ─────────────────────────────

export const drawScout: Painter = (ctx, p) => {
  const C = tint(p);
  const moving = p.state === 'move';
  const run = moving ? p.t * 15 : 0;
  const bob = moving ? Math.abs(Math.sin(run)) * 2.6 : Math.sin(p.t * 2.4) * 0.7;
  const sway = moving ? Math.sin(run) * 3 : Math.sin(p.t * 1.8) * 0.8;
  const fx = facingSign(p);
  if (p.blink && Math.floor(p.t * 16) % 2 === 0) ctx.globalAlpha = 0.45;
  groundShadow(ctx, 13, 5, 12);

  // bottes
  if (moving) {
    const s = Math.sin(run);
    ellipse(ctx, -5, 11 + s * 1.5, 3.5, 2.6, C('#3a2a22'), INK, 1.5);
    ellipse(ctx, 5, 11 - s * 1.5, 3.5, 2.6, C('#3a2a22'), INK, 1.5);
  } else {
    ellipse(ctx, -4.5, 11.5, 3.5, 2.4, C('#3a2a22'), INK, 1.5);
    ellipse(ctx, 4.5, 11.5, 3.5, 2.4, C('#3a2a22'), INK, 1.5);
  }

  ctx.save();
  ctx.translate(0, -bob);
  // carquois (dos)
  ctx.save();
  ctx.scale(fx, 1);
  ctx.translate(-7, -6);
  ctx.rotate(-0.5);
  ctx.fillStyle = C('#6b4226');
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(-3, -9, 6, 14, 2);
  ctx.fill();
  ctx.stroke();
  for (let i = -1; i <= 1; i++) {
    ctx.fillStyle = C(i === 0 ? '#ffe9a8' : '#f4ecd8');
    ctx.beginPath();
    ctx.moveTo(i * 2, -9);
    ctx.lineTo(i * 2 - 1.5, -14);
    ctx.lineTo(i * 2 + 1.5, -14);
    ctx.fill();
  }
  ctx.restore();

  // cape
  ctx.beginPath();
  ctx.moveTo(-7, -7);
  ctx.quadraticCurveTo(-13 - sway * 0.4, 4, -10 + sway, 11);
  ctx.quadraticCurveTo(0, 13 + Math.abs(sway) * 0.3, 10 + sway, 11);
  ctx.quadraticCurveTo(13 - sway * 0.4, 4, 7, -7);
  ctx.closePath();
  ctx.fillStyle = C(UI.heroCloak);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // pli
  ctx.beginPath();
  ctx.moveTo(-2, -2);
  ctx.quadraticCurveTo(-3 + sway * 0.5, 5, -4 + sway, 11);
  ctx.strokeStyle = C(UI.heroCloakDark);
  ctx.lineWidth = 2;
  ctx.stroke();
  // pendentif lune
  ctx.save();
  ctx.translate(fx * 1.5, -3);
  circle(ctx, 0, 0, 2.6, C(UI.moon));
  circle(ctx, 1.1, -0.6, 2.1, C(UI.heroCloak));
  ctx.restore();

  // tête + capuche
  const hx = fx * 1.2;
  circle(ctx, hx, -12, 8.2, C('#f2c9a0'), INK, 2);
  ctx.beginPath();
  ctx.arc(hx, -12.5, 9.4, Math.PI * 0.95, Math.PI * 2.05);
  ctx.lineTo(hx + fx * 6, -9);
  ctx.quadraticCurveTo(hx - fx * 2, -16, hx - fx * 8, -8);
  ctx.closePath();
  ctx.fillStyle = C(UI.heroCloak);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // pointe de capuche flottante
  ctx.beginPath();
  ctx.moveTo(hx - fx * 7, -18);
  ctx.quadraticCurveTo(hx - fx * (14 + sway * 0.5), -19, hx - fx * (16 + sway), -13 + bob * 0.5);
  ctx.quadraticCurveTo(hx - fx * 11, -14, hx - fx * 8, -12);
  ctx.fillStyle = C(UI.heroCloakDark);
  ctx.fill();
  ctx.stroke();
  // visage
  const blinkEye = Math.sin(p.t * 1.3 + 1) > 0.985;
  eyes(ctx, hx + fx * 2.2, -11, 2.8, 1.6, fx, INK, INK, blinkEye);
  ctx.fillStyle = 'rgba(255,120,120,0.35)';
  ctx.beginPath();
  ctx.ellipse(hx + fx * 5.5, -8.5, 1.8, 1.1, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // arc orienté vers la cible
  ctx.save();
  ctx.translate(0, -4 - bob);
  ctx.rotate(p.facing);
  ctx.translate(12, 0);
  const draw = p.aiming ? 0.5 + 0.5 * Math.sin(p.t * 30) * 0.2 + 0.4 : 0;
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.quadraticCurveTo(7, 0, 0, 12);
  ctx.strokeStyle = C('#8a5a2b');
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.strokeStyle = C(UI.gold);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(0, -12, 1.6, 0, Math.PI * 2);
  ctx.arc(0, 12, 1.6, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(-draw * 7, 0);
  ctx.lineTo(0, 12);
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1;
  ctx.stroke();
  if (p.aiming) {
    ctx.beginPath();
    ctx.moveTo(-draw * 7, 0);
    ctx.lineTo(10, 0);
    ctx.strokeStyle = C('#f4ecd8');
    ctx.lineWidth = 1.6;
    ctx.stroke();
    glow(ctx, 10, 0, 6, UI.moonGlow, 0.7);
  }
  ctx.restore();
  ctx.globalAlpha = 1;
};

/** Corps commun des héros débloquables : robe, tête, bras orienté vers la cible. */
function heroBody(ctx: Ctx, p: Pose, robe: string, robeDark: string, trim: string, head: (hx: number, fx: number, C: (c: string) => string) => void, weapon: (C: (c: string) => string) => void): void {
  const C = tint(p);
  const moving = p.state === 'move';
  const run = moving ? p.t * 15 : 0;
  const bob = moving ? Math.abs(Math.sin(run)) * 2.6 : Math.sin(p.t * 2.4) * 0.7;
  const sway = moving ? Math.sin(run) * 3 : Math.sin(p.t * 1.8) * 0.8;
  const fx = facingSign(p);
  if (p.blink && Math.floor(p.t * 16) % 2 === 0) ctx.globalAlpha = 0.45;
  groundShadow(ctx, 13, 5, 12);
  const s = moving ? Math.sin(run) : 0;
  ellipse(ctx, -5, 11 + s * 1.5, 3.5, 2.6, C('#3a2a22'), INK, 1.5);
  ellipse(ctx, 5, 11 - s * 1.5, 3.5, 2.6, C('#3a2a22'), INK, 1.5);
  ctx.save();
  ctx.translate(0, -bob);
  ctx.beginPath();
  ctx.moveTo(-7, -7);
  ctx.quadraticCurveTo(-12 - sway * 0.4, 4, -10 + sway, 11);
  ctx.quadraticCurveTo(0, 13, 10 + sway, 11);
  ctx.quadraticCurveTo(12 - sway * 0.4, 4, 7, -7);
  ctx.closePath();
  ctx.fillStyle = C(robe);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-9, 2);
  ctx.quadraticCurveTo(0, 5, 9, 2);
  ctx.strokeStyle = C(trim);
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(1, -6);
  ctx.quadraticCurveTo(0 + sway * 0.5, 4, -1 + sway, 11);
  ctx.strokeStyle = C(robeDark);
  ctx.lineWidth = 2;
  ctx.stroke();
  head(fx * 1.2, fx, C);
  ctx.restore();
  ctx.save();
  ctx.translate(0, -4 - bob);
  ctx.rotate(p.facing);
  ctx.translate(12, 0);
  weapon(C);
  ctx.restore();
  ctx.globalAlpha = 1;
};

export const drawWindMonk: Painter = (ctx, p) => {
  heroBody(
    ctx,
    p,
    '#f0a43a',
    '#c47a1a',
    '#5fd8ff',
    (hx, fx, C) => {
      circle(ctx, hx, -12, 8.2, C('#e8b98a'), INK, 2);
      ellipse(ctx, hx - fx * 2, -16, 4, 2, 'rgba(255,255,255,.35)');
      eyes(ctx, hx + fx * 2.2, -11, 2.8, 1.5, fx, INK, INK, Math.sin(p.t * 1.3) > 0.98);
      // bandeau de vent qui flotte
      ctx.beginPath();
      ctx.moveTo(hx - 8, -14);
      ctx.lineTo(hx + 8, -14);
      ctx.strokeStyle = C('#5fd8ff');
      ctx.lineWidth = 3;
      ctx.stroke();
      const fl = Math.sin(p.t * 8) * 3;
      ctx.beginPath();
      ctx.moveTo(hx - fx * 8, -14);
      ctx.quadraticCurveTo(hx - fx * 16, -16 + fl, hx - fx * 22, -10 + fl);
      ctx.stroke();
    },
    (C) => {
      // paume ouverte et tourbillon d'air
      circle(ctx, 0, 0, 4, C('#e8b98a'), INK, 1.5);
      if (p.aiming) {
        ctx.strokeStyle = 'rgba(191,244,255,0.85)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 2; i++) {
          ctx.beginPath();
          ctx.arc(6 + i * 4, 0, 5 + i * 3, -1.2 + p.t * 8, 1.2 + p.t * 8);
          ctx.stroke();
        }
        glow(ctx, 8, 0, 10, '#bff4ff', 0.6);
      }
    },
  );
};

export const drawEmberSorcerer: Painter = (ctx, p) => {
  heroBody(
    ctx,
    p,
    '#5a3a8a',
    '#3a2266',
    '#ffb347',
    (hx, fx, C) => {
      circle(ctx, hx, -12, 8, C('#f2c9a0'), INK, 2);
      eyes(ctx, hx + fx * 2.2, -11, 2.8, 1.5, fx, INK, INK, Math.sin(p.t * 1.1) > 0.98);
      // chapeau pointu qui ondule
      const w = Math.sin(p.t * 3) * 2;
      ctx.beginPath();
      ctx.moveTo(hx - 12, -15);
      ctx.quadraticCurveTo(hx, -12, hx + 12, -15);
      ctx.lineTo(hx + 5, -18);
      ctx.quadraticCurveTo(hx - fx * 2 + w, -28, hx - fx * 10 + w, -34);
      ctx.quadraticCurveTo(hx - fx * 2, -24, hx - 5, -18);
      ctx.closePath();
      ctx.fillStyle = C('#3a2266');
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = INK;
      ctx.stroke();
      circle(ctx, hx - fx * 10 + w, -34, 2.4, C('#ffcf4a'), INK, 1.2);
    },
    (C) => {
      ctx.beginPath();
      ctx.moveTo(-6, 6);
      ctx.lineTo(6, -2);
      ctx.strokeStyle = C('#5a3a22');
      ctx.lineWidth = 3;
      ctx.stroke();
      const fl = 3.5 + Math.sin(p.t * 16) * 0.8 + (p.aiming ? 2 : 0);
      glow(ctx, 8, -3, fl * 3.5, '#ff8a3d', 0.7);
      circle(ctx, 8, -3, fl, '#ffd36b', INK, 1.5);
      circle(ctx, 7, -4, fl * 0.45, '#fff3c2');
    },
  );
};

// ───────────────────────────── Ennemis ─────────────────────────────

export const drawGoblin: Painter = (ctx, p) => {
  const C = tint(p);
  const fx = facingSign(p);
  const moving = p.state === 'move';
  const hop = moving ? Math.abs(Math.sin(p.t * 10 + p.seed)) * 3 : Math.sin(p.t * 3 + p.seed) * 0.8;
  eliteAura(ctx, p, 15);
  groundShadow(ctx, 12, 4.5, 12);
  ctx.save();
  ctx.translate(0, -hop);
  // fronde
  if (p.state === 'windup') {
    const a = p.t * 22;
    ctx.beginPath();
    ctx.arc(fx * 4, -20, 9, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(fx * 6, -8);
    ctx.lineTo(fx * 4 + Math.cos(a) * 9, -20 + Math.sin(a) * 9);
    ctx.strokeStyle = '#6b4226';
    ctx.stroke();
    windupGlow(ctx, p, fx * 4 + Math.cos(a) * 9, -20 + Math.sin(a) * 9, 4, '#ffb347');
    circle(ctx, fx * 4 + Math.cos(a) * 9, -20 + Math.sin(a) * 9, 3.5, '#8d7b6a', INK, 1.5);
  }
  // corps poire
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.bezierCurveTo(12, -12, 14, 10, 0, 11);
  ctx.bezierCurveTo(-14, 10, -12, -12, 0, -12);
  ctx.fillStyle = C('#6fae3f');
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // tunique
  ctx.beginPath();
  ctx.moveTo(-10, 2);
  ctx.quadraticCurveTo(0, 6, 10, 2);
  ctx.lineTo(9, 9);
  ctx.quadraticCurveTo(0, 13, -9, 9);
  ctx.closePath();
  ctx.fillStyle = C('#7a4a2a');
  ctx.fill();
  ctx.stroke();
  // oreilles
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 8, -7);
    ctx.lineTo(s * (19 + Math.sin(p.t * 6 + p.seed) * 1.5), -12);
    ctx.lineTo(s * 9, -2);
    ctx.closePath();
    ctx.fillStyle = C('#5f9a35');
    ctx.fill();
    ctx.stroke();
  }
  eyes(ctx, fx * 2, -4, 4, 2.8, fx, '#ffe26b', INK);
  // dent
  ctx.fillStyle = W;
  ctx.beginPath();
  ctx.moveTo(fx * 2, 1);
  ctx.lineTo(fx * 4, 1);
  ctx.lineTo(fx * 3, 4);
  ctx.fill();
  eliteCrown(ctx, p, -16);
  ctx.restore();
};

export const drawJelly: Painter = (ctx, p) => {
  const C = tint(p);
  const small = (p.variant ?? 0) === 1;
  const r = small ? 11 : 17;
  const squash = Math.sin(p.t * 6 + p.seed) * 0.1;
  eliteAura(ctx, p, r);
  groundShadow(ctx, r * 0.95, r * 0.35, r * 0.7);
  ctx.save();
  ctx.translate(0, -squash * r);
  blobPath(ctx, r, p.t * 4 + p.seed, 3, 0.06, 1 + squash, 1 - squash);
  const g = ctx.createRadialGradient(-r * 0.3, -r * 0.4, r * 0.1, 0, 0, r * 1.1);
  g.addColorStop(0, C('#d8b8ff'));
  g.addColorStop(1, C('#7a4cff'));
  ctx.fillStyle = g;
  ctx.globalAlpha = 0.9;
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // bulles internes
  for (let i = 0; i < 3; i++) {
    const a = p.t * 0.8 + i * 2.1 + p.seed;
    circle(ctx, Math.cos(a) * r * 0.45, Math.sin(a * 1.3) * r * 0.35 + r * 0.2, r * 0.1, 'rgba(255,255,255,0.35)');
  }
  ellipse(ctx, -r * 0.4, -r * 0.45, r * 0.28, r * 0.15, 'rgba(255,255,255,0.6)');
  eyes(ctx, 0, -r * 0.1, r * 0.3, r * 0.18, Math.cos(p.facing), W, INK, Math.sin(p.t * 0.9 + p.seed) > 0.97);
  // bouche
  ctx.beginPath();
  ctx.arc(0, r * 0.2, r * 0.12, 0, Math.PI);
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.5;
  ctx.stroke();
  eliteCrown(ctx, p, -r - 5);
  ctx.restore();
};

export const drawBat: Painter = (ctx, p) => {
  const C = tint(p);
  const flap = Math.sin(p.t * (p.state === 'charge' ? 30 : 18) + p.seed);
  eliteAura(ctx, p, 12);
  groundShadow(ctx, 9, 3.5, 20, 0.22); // vole : ombre décalée au sol
  ctx.save();
  ctx.translate(0, Math.sin(p.t * 5 + p.seed) * 2);
  windupGlow(ctx, p, 0, 0, 10, '#ff4d5e');
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 5, -2);
    ctx.quadraticCurveTo(s * 14, -14 - flap * 8, s * 24, -4 - flap * 10);
    ctx.quadraticCurveTo(s * 19, 0 - flap * 3, s * 21, 4 - flap * 4);
    ctx.quadraticCurveTo(s * 14, 2, s * 12, 6);
    ctx.quadraticCurveTo(s * 9, 3, s * 5, 5);
    ctx.closePath();
    ctx.fillStyle = C('#4a2f6b');
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
  circle(ctx, 0, 0, 8, C('#5d3b85'), INK, 2);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 3, -6);
    ctx.lineTo(s * 6, -13);
    ctx.lineTo(s * 7, -4);
    ctx.fillStyle = C('#5d3b85');
    ctx.fill();
    ctx.stroke();
  }
  const eg = p.state === 'windup' ? '#ff4d5e' : '#ffcf4a';
  glow(ctx, -3, -1, 5, eg, 0.5);
  glow(ctx, 3, -1, 5, eg, 0.5);
  circle(ctx, -3, -1, 1.8, eg);
  circle(ctx, 3, -1, 1.8, eg);
  ctx.fillStyle = W;
  ctx.beginPath();
  ctx.moveTo(-2, 3);
  ctx.lineTo(-1, 6);
  ctx.lineTo(0, 3);
  ctx.moveTo(2, 3);
  ctx.lineTo(1, 6);
  ctx.lineTo(0, 3);
  ctx.fill();
  eliteCrown(ctx, p, -15);
  ctx.restore();
};

export const drawMushroom: Painter = (ctx, p) => {
  const C = tint(p);
  const w = p.state === 'windup' ? p.windup : 0;
  const breathe = Math.sin(p.t * 2 + p.seed) * 0.04;
  eliteAura(ctx, p, 16);
  groundShadow(ctx, 14, 5, 12);
  // tige
  ctx.beginPath();
  ctx.moveTo(-7, 12);
  ctx.quadraticCurveTo(-9, 0, -6, -4);
  ctx.lineTo(6, -4);
  ctx.quadraticCurveTo(9, 0, 7, 12);
  ctx.closePath();
  ctx.fillStyle = C('#f1e4c8');
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  eyes(ctx, 0, 3, 3, 1.6, Math.cos(p.facing), INK, INK, w < 0.1 && Math.sin(p.t + p.seed) > 0.6);
  // chapeau qui gonfle
  const s = 1 + breathe + w * 0.28;
  ctx.save();
  ctx.translate(0, -5);
  ctx.scale(s, s);
  windupGlow(ctx, p, 0, -6, 12, '#9fff6b');
  ctx.beginPath();
  ctx.moveTo(-17, 2);
  ctx.bezierCurveTo(-17, -20, 17, -20, 17, 2);
  ctx.quadraticCurveTo(0, 6, -17, 2);
  ctx.closePath();
  ctx.fillStyle = C(mix('#d93a3a', '#ff7a5a', w));
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.stroke();
  for (const [x, y, r] of [
    [-8, -6, 3],
    [4, -10, 3.5],
    [10, -3, 2.2],
    [-2, -2, 2],
  ]) circle(ctx, x, y, r, C('#fff3e0'));
  ellipse(ctx, -9, -10, 4, 2, 'rgba(255,255,255,0.35)');
  ctx.restore();
  eliteCrown(ctx, p, -26);
};

export const drawWolf: Painter = (ctx, p) => {
  const C = tint(p);
  const fx = facingSign(p);
  const run = p.state === 'move' ? p.t * 12 : p.state === 'charge' ? p.t * 26 : 0;
  const crouch = p.state === 'windup' ? p.windup : 0;
  const stretch = p.state === 'charge' ? 1.25 : 1;
  eliteAura(ctx, p, 16);
  groundShadow(ctx, 18, 5, 10);
  ctx.save();
  ctx.scale(fx * stretch, 1 - crouch * 0.12);
  ctx.translate(0, crouch * 3);
  // pattes
  for (const [x, ph] of [
    [-9, 0],
    [-4, Math.PI],
    [6, Math.PI],
    [11, 0],
  ] as [number, number][]) {
    const k = Math.sin(run + ph) * 3;
    ctx.beginPath();
    ctx.moveTo(x, 2);
    ctx.lineTo(x + k, 10);
    ctx.strokeStyle = C('#1d1830');
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  // queue
  ctx.beginPath();
  ctx.moveTo(-13, -2);
  ctx.quadraticCurveTo(-22, -8 + Math.sin(p.t * 6) * 4, -24, -14 + Math.sin(p.t * 6) * 3);
  ctx.quadraticCurveTo(-18, -4, -12, 2);
  ctx.fillStyle = C('#2a2440');
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2;
  ctx.stroke();
  // corps
  ellipse(ctx, 0, -1, 15, 8, C('#2a2440'), INK, 2);
  ctx.beginPath();
  ctx.moveTo(-10, -6);
  ctx.quadraticCurveTo(0, -11, 10, -6);
  ctx.strokeStyle = C('#6a5aa8');
  ctx.lineWidth = 2;
  ctx.stroke();
  // tête
  ctx.beginPath();
  ctx.moveTo(9, -9);
  ctx.quadraticCurveTo(16, -12, 23, -5);
  ctx.lineTo(16, 1);
  ctx.quadraticCurveTo(10, 1, 9, -3);
  ctx.closePath();
  ctx.fillStyle = C('#2a2440');
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(11, -9);
  ctx.lineTo(12, -17);
  ctx.lineTo(16, -10);
  ctx.fillStyle = C('#2a2440');
  ctx.fill();
  ctx.stroke();
  const eye = mix('#ff6a3d', '#ffffff', crouch * 0.5);
  glow(ctx, 16, -6, 6 + crouch * 6, '#ff6a3d', 0.6);
  circle(ctx, 16, -6, 1.8, eye);
  ctx.restore();
  eliteCrown(ctx, p, -20);
};

export const drawSkeleton: Painter = (ctx, p) => {
  const C = tint(p);
  const fx = facingSign(p);
  const moving = p.state === 'move';
  const bob = moving ? Math.abs(Math.sin(p.t * 9 + p.seed)) * 2 : 0;
  const rattle = Math.sin(p.t * 25) * (p.state === 'windup' ? 0.8 : 0);
  eliteAura(ctx, p, 14);
  groundShadow(ctx, 11, 4, 12);
  ctx.save();
  ctx.translate(rattle, -bob);
  // côtes et jambes : contour sombre puis os (lisibles même sur la neige)
  ctx.lineCap = 'round';
  for (const [col, lw] of [
    [INK, 5],
    [C('#e9e4d4'), 2.5],
  ] as [string, number][]) {
    ctx.strokeStyle = col;
    ctx.lineWidth = lw;
    ctx.beginPath();
    ctx.moveTo(0, -4);
    ctx.lineTo(0, 9);
    ctx.moveTo(-3, 9);
    ctx.lineTo(-4 + (moving ? Math.sin(p.t * 9) * 2 : 0), 13);
    ctx.moveTo(3, 9);
    ctx.lineTo(4 - (moving ? Math.sin(p.t * 9) * 2 : 0), 13);
    ctx.stroke();
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.ellipse(0, -1 + i * 3.5, 6 - i, 1.6, 0, Math.PI * 0.05, Math.PI * 0.95);
      ctx.stroke();
    }
  }
  // crâne
  ctx.beginPath();
  ctx.arc(0, -11, 7.5, Math.PI, 0);
  ctx.lineTo(5, -6);
  ctx.lineTo(-5, -6);
  ctx.closePath();
  ctx.fillStyle = C('#f2eee0');
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  const eyeC = p.state === 'windup' ? '#5fd8ff' : '#9fe8ff';
  circle(ctx, fx * 1 - 3, -11, 2.2, INK);
  circle(ctx, fx * 1 + 3, -11, 2.2, INK);
  glow(ctx, fx * 1 - 3, -11, 4, eyeC, 0.7);
  glow(ctx, fx * 1 + 3, -11, 4, eyeC, 0.7);
  // arc
  ctx.save();
  ctx.rotate(p.facing);
  ctx.translate(11, 0);
  ctx.beginPath();
  ctx.moveTo(0, -11);
  ctx.quadraticCurveTo(6, 0, 0, 11);
  ctx.strokeStyle = C('#5a4a6a');
  ctx.lineWidth = 2.5;
  ctx.stroke();
  if (p.state === 'windup') {
    for (const a of [-0.26, 0, 0.26]) {
      ctx.save();
      ctx.rotate(a);
      ctx.beginPath();
      ctx.moveTo(-4, 0);
      ctx.lineTo(9, 0);
      ctx.strokeStyle = '#bfe8ff';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }
    windupGlow(ctx, p, 6, 0, 5, '#5fd8ff');
  }
  ctx.restore();
  eliteCrown(ctx, p, -22);
  ctx.restore();
};

export const drawTotem: Painter = (ctx, p) => {
  const C = tint(p);
  const w = p.state === 'windup' ? p.windup : 0;
  const pulse = 0.5 + 0.5 * Math.sin(p.t * 3 + p.seed);
  eliteAura(ctx, p, 18);
  groundShadow(ctx, 15, 5, 14);
  // anneau runique tournant
  ctx.save();
  ctx.rotate(p.t * (0.6 + w * 3));
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3;
    ctx.save();
    ctx.translate(Math.cos(a) * 22, Math.sin(a) * 22 * 0.55 + 4);
    ctx.globalAlpha = 0.35 + 0.65 * Math.max(w, pulse * 0.4);
    ctx.fillStyle = '#5fd8ff';
    ctx.fillRect(-1.5, -3, 3, 6);
    ctx.restore();
  }
  ctx.restore();
  const blocks: [number, number, string][] = [
    [8, 14, '#7a6a5a'],
    [-4, 12.5, '#8a7a68'],
    [-15, 10.5, '#9a8a76'],
  ];
  for (const [y, hw, col] of blocks) {
    ctx.beginPath();
    ctx.roundRect(-hw, y - 6, hw * 2, 12, 3);
    ctx.fillStyle = C(col);
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
  const rune = mix('#3a8fb8', '#bff4ff', Math.max(w, pulse * 0.3));
  glow(ctx, 0, -4, 10 + w * 10, '#5fd8ff', 0.3 + w * 0.5);
  ctx.strokeStyle = rune;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-5, -15);
  ctx.lineTo(0, -19);
  ctx.lineTo(5, -15);
  ctx.moveTo(-6, -4);
  ctx.lineTo(6, -4);
  ctx.moveTo(0, -8);
  ctx.lineTo(0, 0);
  ctx.moveTo(-7, 8);
  ctx.lineTo(-3, 5);
  ctx.lineTo(3, 11);
  ctx.lineTo(7, 8);
  ctx.stroke();
  eliteCrown(ctx, p, -27);
};

export const drawMage: Painter = (ctx, p) => {
  const C = tint(p);
  const fx = facingSign(p);
  const w = p.state === 'windup' ? p.windup : 0;
  const float = Math.sin(p.t * 2.5 + p.seed) * 1.5;
  eliteAura(ctx, p, 15);
  groundShadow(ctx, 11, 4, 12);
  ctx.save();
  ctx.translate(0, float);
  // robe
  ctx.beginPath();
  ctx.moveTo(-6, -8);
  ctx.quadraticCurveTo(-13, 6, -11, 11);
  ctx.quadraticCurveTo(0, 14, 11, 11);
  ctx.quadraticCurveTo(13, 6, 6, -8);
  ctx.closePath();
  ctx.fillStyle = C('#8a1f2e');
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-10, 9);
  ctx.quadraticCurveTo(0, 12, 10, 9);
  ctx.strokeStyle = C('#ffb347');
  ctx.lineWidth = 2;
  ctx.stroke();
  // capuche
  ctx.beginPath();
  ctx.moveTo(-8, -6);
  ctx.quadraticCurveTo(-9, -18, 0, -22);
  ctx.quadraticCurveTo(9, -18, 8, -6);
  ctx.quadraticCurveTo(0, -3, -8, -6);
  ctx.fillStyle = C('#6a1424');
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ellipse(ctx, fx * 1, -11, 5, 4.5, '#1a0a12');
  glow(ctx, fx * 1 - 2, -11, 4, '#ff8a3d', 0.8);
  glow(ctx, fx * 1 + 2, -11, 4, '#ff8a3d', 0.8);
  // bâton
  const sx = fx * 11;
  const raise = w * 8;
  ctx.beginPath();
  ctx.moveTo(sx, 10);
  ctx.lineTo(sx, -16 - raise);
  ctx.strokeStyle = C('#5a3a22');
  ctx.lineWidth = 3;
  ctx.stroke();
  const fl = 4 + Math.sin(p.t * 18) * 1 + w * 6;
  glow(ctx, sx, -20 - raise, fl * 3, '#ff8a3d', 0.6);
  ctx.beginPath();
  ctx.moveTo(sx - fl * 0.6, -18 - raise);
  ctx.quadraticCurveTo(sx, -20 - raise - fl * 2.2, sx + fl * 0.6, -18 - raise);
  ctx.quadraticCurveTo(sx, -15 - raise, sx - fl * 0.6, -18 - raise);
  ctx.fillStyle = '#ffd36b';
  ctx.fill();
  eliteCrown(ctx, p, -27);
  ctx.restore();
};

// ───────────────────────────── Boss ─────────────────────────────

function dizzy(ctx: Ctx, p: Pose, y: number): void {
  if (p.state !== 'breath') return;
  for (let i = 0; i < 3; i++) {
    const a = p.t * 4 + (i * Math.PI * 2) / 3;
    ctx.save();
    ctx.translate(Math.cos(a) * 16, y + Math.sin(a) * 5);
    star(ctx, 0, 0, 4, 0.45);
    ctx.fillStyle = UI.moon;
    ctx.fill();
    ctx.restore();
  }
}

export const drawTreant: Painter = (ctx, p) => {
  const C = tint(p);
  const v = p.variant ?? 0;
  const sway = Math.sin(p.t * 1.6) * 0.06;
  const w = p.state === 'windup' ? p.windup : 0;
  groundShadow(ctx, 36, 12, 26);
  ctx.save();
  ctx.rotate(sway);
  // racines
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 12, 18);
    ctx.quadraticCurveTo(s * 28, 22, s * 36, 30);
    ctx.lineWidth = 6;
    ctx.strokeStyle = C('#4a2f1e');
    ctx.lineCap = 'round';
    ctx.stroke();
  }
  // tronc
  ctx.beginPath();
  ctx.moveTo(-20, 26);
  ctx.quadraticCurveTo(-26, -6, -16, -24);
  ctx.lineTo(16, -24);
  ctx.quadraticCurveTo(26, -6, 20, 26);
  ctx.closePath();
  ctx.fillStyle = C('#6b4428');
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.strokeStyle = C('#4a2f1e');
  ctx.lineWidth = 2;
  for (const x of [-10, -2, 8]) {
    ctx.beginPath();
    ctx.moveTo(x, 22);
    ctx.quadraticCurveTo(x + 3, 4, x - 1, -18);
    ctx.stroke();
  }
  // bras-branches
  for (const s of [-1, 1]) {
    const a = Math.sin(p.t * 2 + s) * 0.2 - w * 0.6;
    ctx.save();
    ctx.translate(s * 18, -8);
    ctx.rotate(s * (0.6 + a));
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(s * 14, -6, s * 24, -18);
    ctx.lineWidth = 6;
    ctx.strokeStyle = C('#5a3a22');
    ctx.stroke();
    circle(ctx, s * 24, -20, 7, C(['#3f8a4a', '#2f6a8a', '#8a6a2f'][v]), INK, 2);
    ctx.restore();
  }
  // couronne de feuillage
  const leaf = ['#3f8a4a', '#2f6a8a', '#8a6a2f'][v];
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    circle(ctx, Math.cos(a) * 24, -26 + Math.sin(a) * 14, 11, C(shade(leaf, (i % 2) * 0.12)), INK, 2);
  }
  // visage
  const eye = mix('#ffcf4a', '#ff4d5e', w);
  glow(ctx, -7, -6, 9, eye, 0.6);
  glow(ctx, 7, -6, 9, eye, 0.6);
  ellipse(ctx, -7, -6, 3.5, 2.5, eye);
  ellipse(ctx, 7, -6, 3.5, 2.5, eye);
  ctx.beginPath();
  ctx.moveTo(-8, 6);
  ctx.quadraticCurveTo(0, 10 + w * 6, 8, 6);
  ctx.lineWidth = 3;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.restore();
  dizzy(ctx, p, -44);
};

export const drawQueen: Painter = (ctx, p) => {
  const C = tint(p);
  const v = p.variant ?? 0;
  const body = ['#5a8a4a', '#4a6a8a', '#7a5a8a'][v];
  const breathe = Math.sin(p.t * 2) * 1.5;
  const w = p.state === 'windup' ? p.windup : 0;
  groundShadow(ctx, 34, 11, 24);
  // nénuphars
  for (const s of [-1, 1]) {
    ellipse(ctx, s * 30, 20, 11, 5, C('#3f7a3a'), INK, 1.5);
  }
  ctx.save();
  ctx.translate(0, -breathe * 0.4);
  // corps crapaud
  ellipse(ctx, 0, 6, 30 + breathe, 22 - breathe * 0.4, C(body), INK, 2.5);
  ellipse(ctx, 0, 12, 18, 11, C(shade(body, 0.35)));
  // sac vocal qui gonfle à l'anticipation
  if (w > 0) circle(ctx, 0, 16, 6 + w * 10, alpha2('#ffb3d9', 0.85), INK, 2);
  // yeux globuleux
  for (const s of [-1, 1]) {
    circle(ctx, s * 13, -14, 9, C(body), INK, 2.5);
    circle(ctx, s * 13, -15, 6, '#fff7c2');
    ellipse(ctx, s * 13 + Math.cos(p.facing) * 1.5, -15, 1.8, 4.5, INK);
  }
  // couronne
  ctx.beginPath();
  ctx.moveTo(-10, -22);
  for (let i = 0; i <= 4; i++) ctx.lineTo(-10 + i * 5, i % 2 === 0 ? -33 : -26);
  ctx.lineTo(10, -22);
  ctx.closePath();
  ctx.fillStyle = UI.gold;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  circle(ctx, 0, -27, 2.5, '#ff5fa8');
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.quadraticCurveTo(0, 6, 14, 0);
  ctx.lineWidth = 2.5;
  ctx.stroke();
  ctx.restore();
  dizzy(ctx, p, -42);
};

function alpha2(hex: string, a: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export const drawScorpion: Painter = (ctx, p) => {
  const C = tint(p);
  const v = p.variant ?? 0;
  const body = ['#d98a2b', '#c45a2b', '#a83a5a'][v];
  const fx = facingSign(p);
  const w = p.state === 'windup' ? p.windup : 0;
  const walk = p.state === 'move' || p.state === 'charge' ? p.t * 14 : 0;
  groundShadow(ctx, 36, 10, 18);
  ctx.save();
  ctx.scale(fx, 1);
  // pattes
  for (let i = 0; i < 4; i++) {
    for (const s of [-1, 1]) {
      const k = Math.sin(walk + i + (s > 0 ? Math.PI : 0)) * 3;
      ctx.beginPath();
      ctx.moveTo(-8 + i * 6, s * 6 + 4);
      ctx.quadraticCurveTo(-10 + i * 6 + k, s * 16 + 4, -14 + i * 7 + k, s * 20 + 6);
      ctx.lineWidth = 3;
      ctx.strokeStyle = C(shade(body, -0.35));
      ctx.lineCap = 'round';
      ctx.stroke();
    }
  }
  // queue articulée par segments
  let x = -18;
  let y = 2;
  let a = Math.PI + 0.2;
  for (let i = 0; i < 5; i++) {
    a -= 0.62 + w * 0.1 + Math.sin(p.t * 3 + i) * 0.05;
    x += Math.cos(a) * 9;
    y -= Math.sin(a) * 9;
    circle(ctx, x, y, 7 - i * 0.6, C(shade(body, -i * 0.05)), INK, 2);
  }
  const sting = mix('#ffe26b', '#ff4d5e', w);
  glow(ctx, x + 4, y + 4, 10 + w * 10, sting, 0.7);
  ctx.beginPath();
  ctx.moveTo(x - 2, y - 3);
  ctx.quadraticCurveTo(x + 12, y - 2, x + 10, y + 10);
  ctx.lineTo(x + 3, y + 4);
  ctx.fillStyle = sting;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // corps
  ellipse(ctx, 0, 4, 22, 13, C(body), INK, 2.5);
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 7, -8);
    ctx.quadraticCurveTo(i * 7 + 2, 4, i * 7, 16);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = C(shade(body, -0.3));
    ctx.stroke();
  }
  // pinces
  for (const s of [-1, 1]) {
    const open = 0.3 + Math.sin(p.t * 4 + s) * 0.15 + w * 0.4;
    ctx.save();
    ctx.translate(22, s * 10 + 4);
    ctx.rotate(s * 0.4);
    ellipse(ctx, 8, 0, 9, 6, C(body), INK, 2);
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(24, -open * 10);
    ctx.lineTo(18, 0);
    ctx.lineTo(24, open * 10);
    ctx.closePath();
    ctx.fillStyle = C(shade(body, -0.2));
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  eyes(ctx, 14, -2, 3.5, 2.5, 1, '#1a0a12', '#ff4d5e');
  ctx.restore();
  dizzy(ctx, p, -26);
};

export const drawWyvern: Painter = (ctx, p) => {
  const C = tint(p);
  const v = p.variant ?? 0;
  const body = ['#7ab8e8', '#a8c8ff', '#c8b8ff'][v];
  const flap = Math.sin(p.t * (p.state === 'charge' ? 16 : 7));
  const fx = facingSign(p);
  groundShadow(ctx, 30, 9, 34, 0.22);
  ctx.save();
  ctx.translate(0, Math.sin(p.t * 2) * 3 - 6);
  ctx.scale(fx, 1);
  // ailes
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(-4, s * 4);
    ctx.lineTo(-10, s * (30 + flap * 10));
    ctx.lineTo(4, s * (40 + flap * 12));
    ctx.quadraticCurveTo(8, s * 24, 14, s * (32 + flap * 8));
    ctx.quadraticCurveTo(12, s * 14, 8, s * 4);
    ctx.closePath();
    ctx.fillStyle = C(shade(body, -0.25));
    ctx.globalAlpha = 0.95;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
  // queue
  ctx.beginPath();
  ctx.moveTo(-14, 0);
  ctx.quadraticCurveTo(-30, Math.sin(p.t * 3) * 8, -42, Math.sin(p.t * 3 + 1) * 10);
  ctx.lineWidth = 6;
  ctx.strokeStyle = C(body);
  ctx.lineCap = 'round';
  ctx.stroke();
  // corps et cou
  ellipse(ctx, 0, 0, 18, 11, C(body), INK, 2.5);
  ctx.beginPath();
  ctx.moveTo(12, -4);
  ctx.quadraticCurveTo(22, -12, 30, -10);
  ctx.lineTo(32, -2);
  ctx.quadraticCurveTo(22, 0, 14, 5);
  ctx.closePath();
  ctx.fillStyle = C(body);
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // cornes de glace
  for (const k of [0, 1]) {
    ctx.beginPath();
    ctx.moveTo(26 + k * 3, -10);
    ctx.lineTo(22 + k * 4, -20 - k * 2);
    ctx.lineTo(30 + k * 2, -9);
    ctx.fillStyle = '#eaf6ff';
    ctx.fill();
    ctx.stroke();
  }
  glow(ctx, 29, -6, 7, '#bfe8ff', 0.8);
  circle(ctx, 29, -6, 1.8, '#ffffff');
  // givre
  for (let i = 0; i < 4; i++) {
    const a = p.t * 2 + i * 1.6;
    circle(ctx, Math.cos(a) * 24, Math.sin(a) * 14, 1.5, 'rgba(255,255,255,0.8)');
  }
  ctx.restore();
  dizzy(ctx, p, -34);
};

export const drawAshlord: Painter = (ctx, p) => {
  const C = tint(p);
  const v = p.variant ?? 0;
  const ember = ['#ff7a3d', '#ff3d6a', '#c43dff'][v];
  const w = p.state === 'windup' ? p.windup : 0;
  const float = Math.sin(p.t * 1.8) * 2;
  groundShadow(ctx, 30, 10, 26);
  ctx.save();
  ctx.translate(0, float);
  // cape déchirée
  ctx.beginPath();
  ctx.moveTo(-14, -14);
  for (let i = 0; i <= 8; i++) {
    const x = -26 + i * 6.5;
    const y = 24 + (i % 2 === 0 ? 0 : -6) + Math.sin(p.t * 4 + i) * 2;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(14, -14);
  ctx.closePath();
  ctx.fillStyle = C('#221a1c');
  ctx.fill();
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
  // armure
  ctx.beginPath();
  ctx.roundRect(-14, -16, 28, 30, 8);
  ctx.fillStyle = C('#3e3234');
  ctx.fill();
  ctx.stroke();
  // fissures de braise
  glow(ctx, 0, 0, 20 + w * 14, ember, 0.35 + w * 0.4);
  ctx.strokeStyle = mix(ember, '#ffe9a8', 0.3 + w * 0.5);
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-8, -10);
  ctx.lineTo(-2, -2);
  ctx.lineTo(-6, 6);
  ctx.moveTo(6, -12);
  ctx.lineTo(2, 0);
  ctx.lineTo(8, 8);
  ctx.stroke();
  // tête et cornes
  circle(ctx, 0, -24, 10, C('#2a2022'), INK, 2.5);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(s * 7, -30);
    ctx.quadraticCurveTo(s * 18, -36, s * 16, -48);
    ctx.quadraticCurveTo(s * 12, -38, s * 3, -33);
    ctx.fillStyle = C('#d8c8b8');
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  glow(ctx, -4, -24, 6, ember, 0.9);
  glow(ctx, 4, -24, 6, ember, 0.9);
  circle(ctx, -4, -24, 1.8, '#ffe9a8');
  circle(ctx, 4, -24, 1.8, '#ffe9a8');
  // couronne de flammes
  for (let i = -2; i <= 2; i++) {
    const h = 6 + Math.sin(p.t * 12 + i * 2) * 2.5 + w * 4;
    ctx.beginPath();
    ctx.moveTo(i * 4 - 2.5, -33);
    ctx.quadraticCurveTo(i * 4, -33 - h * 2, i * 4 + 2.5, -33);
    ctx.fillStyle = i % 2 === 0 ? '#ffd36b' : ember;
    ctx.fill();
  }
  ctx.restore();
  dizzy(ctx, p, -56);
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
  treant: drawTreant,
  queen: drawQueen,
  scorpion: drawScorpion,
  wyvern: drawWyvern,
  ashlord: drawAshlord,
};
