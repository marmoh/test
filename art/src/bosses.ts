/**
 * Boss : grandes marionnettes à nombreuses pièces (rayon ~32–34 pt).
 * Chaque boss a un geste d'anticipation qui lui est propre (bras-branches levés, sac vocal
 * vermillon, queue qui s'enroule, cou qui recule gueule ouverte, orbe de braise brandie),
 * une détente franche, et s'affaisse quand il est essoufflé (`breath`).
 */
import { type Ctx } from './draw.js';
import { UI } from './palette.js';
import {
  begin, root, pin, unpin, holes, slits, almonds, poly, limb, bone, dot, shadow, tellRing, threat, dizzy,
  lerp, TAU, INK, INK2, CUT, DANGER, type Painter, type Rig,
} from './rig.js';

// ───────────────────────────── Sylvain (forêt) ─────────────────────────────

const TREANT_BARK = [-11, 20, -9, 6, -9, 2, -11, -14, -2, 22, 0, 10, 1, 4, -1, -12, 8, 20, 10, 8, 10, 3, 8, -16];
const TREANT_LEAVES: number[][] = [
  // rondes
  [-20, -36, 6, 0.6, 2, -8, -44, 6, -0.4, 2, 6, -42, 5, 0.8, 1.8, 18, -34, 6, -0.6, 2, -26, -24, 5, 1.2, 1.8, 26, -24, 5, -1.1, 1.8, 0, -32, 5, 0.1, 1.8, -12, -28, 4, 1.4, 1.4, 12, -28, 4, -1.3, 1.4],
  // aiguilles
  [-20, -36, 7, 1.2, 0.8, -8, -44, 7, 1.4, 0.8, 6, -42, 7, 1.7, 0.8, 18, -34, 7, 1.9, 0.8, -26, -24, 6, 1, 0.8, 26, -24, 6, 2.1, 0.8, 0, -32, 6, 1.57, 0.8, -12, -28, 5, 1.2, 0.8, 12, -28, 5, 1.9, 0.8],
  // feuilles d'automne en cœur
  [-20, -36, 5, 0.6, 2.6, -8, -44, 5, -0.4, 2.6, 6, -42, 4, 0.8, 2.2, 18, -34, 5, -0.6, 2.6, -26, -24, 4, 1.2, 2.2, 26, -24, 4, -1.1, 2.2, 0, -32, 4, 0.1, 2.2],
];

function treantArm(ctx: Ctx, r: Rig, c: string, a1: number, a2: number, v: number): void {
  ctx.rotate(a1);
  bone(ctx, 0, 0, 15, 0, 6.4, c);
  pin(ctx, 15, 0, a2);
  bone(ctx, 0, 0, 12, 0, 5, c);
  // doigts-brindilles
  ctx.beginPath();
  ctx.moveTo(11, 0);
  ctx.lineTo(18, -4);
  ctx.moveTo(11, 0);
  ctx.lineTo(19, 1.6);
  ctx.moveTo(10, 1);
  ctx.lineTo(14, 6);
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.strokeStyle = c;
  ctx.stroke();
  // bouquet de feuilles découpées
  ctx.beginPath();
  ctx.arc(8, -6, 6, 0, TAU);
  ctx.moveTo(15, -7);
  ctx.arc(12, -9, 4.6, 0, TAU);
  ctx.fillStyle = c;
  ctx.fill();
  almonds(ctx, v === 1 ? [8, -6, 6, 1.2, 0.7, 12, -9, 5, 1.8, 0.7] : [7, -6, 4.4, 0.6, 1.4, 12, -9.4, 3.6, -0.5, 1.2]);
  unpin(ctx, 1.4);
  void r;
}

export const drawTreant: Painter = (ctx, p) => {
  const r = begin(p);
  const t = r.t, v = p.variant ?? 0;
  const ink = r.ink, ink2 = r.ink2;
  const tired = p.state === 'breath';
  shadow(ctx, r, 36, 12, 26);
  ctx.save();
  root(ctx, r, 26, -58);
  const walk = r.move || r.charge ? t * 5 : 0;
  ctx.translate(0, r.wE * 2 - r.rel * 1.5 + (r.move ? Math.abs(Math.sin(walk)) * -1.5 : 0));
  // racines-pieds
  const roots: [number, number, number][] = [[-15, 20, -1], [0, 22, 0], [15, 20, 1]];
  roots.forEach(([x, y, s], i) => {
    const lift = r.move ? Math.max(0, Math.sin(walk + i * 2.1)) * 0.25 : 0;
    pin(ctx, x, y, s * 0.15 - lift * (s || 1));
    ctx.beginPath();
    ctx.moveTo(-4.4, -2);
    ctx.quadraticCurveTo(s * 6, 4, s * 14 + (s === 0 ? 3 : 0), 9);
    ctx.quadraticCurveTo(s * 4, 4, 4.4, -2);
    ctx.closePath();
    ctx.fillStyle = ink;
    ctx.fill();
    unpin(ctx, 1.4);
  });
  const sway = Math.sin(t * 1.6) * 0.04;
  ctx.rotate(sway);
  // bras-branches : levés à l'anticipation, abattus à la détente, ballants quand essoufflé
  const armBase = tired ? 1.0 : 0.4;
  const armA = (s: number) => lerp(armBase + Math.sin(t * 2 + s) * 0.12, -1.25, r.wE) + r.rel * 1.1;
  const foreA = (s: number) => lerp(-0.6 + Math.sin(t * 2.4 + s - 0.8) * 0.15, -0.9, r.wE) + r.rel * 0.5 + (tired ? 0.5 : 0);
  ctx.save();
  ctx.scale(-1, 1);
  pin(ctx, 16, -8, armA(-1));
  treantArm(ctx, r, ink2, 0, foreA(-1), v);
  unpin(ctx, 1.6);
  ctx.restore();
  // tronc à l'écorce ajourée
  ctx.beginPath();
  ctx.moveTo(-20, 26);
  ctx.quadraticCurveTo(-26, -6, -16, -24);
  ctx.lineTo(16, -24);
  ctx.quadraticCurveTo(26, -6, 20, 26);
  ctx.quadraticCurveTo(0, 22, -20, 26);
  ctx.fillStyle = ink;
  ctx.fill();
  slits(ctx, TREANT_BARK, 1.3);
  holes(ctx, [-14, 10, 1.4, 13, -12, 1.2, 15, 14, 1]);
  // houppier épinglé, qui oscille avec retard
  pin(ctx, 0, -20, Math.sin(t * 1.6 - 0.8) * 0.05 + (tired ? 0.08 : 0) - r.rel * 0.06);
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = Math.PI + (i / 6) * Math.PI;
    const x = Math.cos(a) * 24, y = -6 + Math.sin(a) * 14;
    ctx.moveTo(x + 11, y);
    ctx.arc(x, y, 11, 0, TAU);
  }
  ctx.moveTo(14, -16);
  ctx.arc(0, -16, 14, 0, TAU);
  ctx.fillStyle = ink;
  ctx.fill();
  ctx.save();
  ctx.translate(0, 20);
  almonds(ctx, TREANT_LEAVES[v] ?? TREANT_LEAVES[0]);
  ctx.restore();
  if (v === 2) {
    // mousse pendante
    for (let i = 0; i < 4; i++) {
      pin(ctx, -21 + i * 14, 0, Math.sin(t * 2 + i) * 0.15);
      poly(ctx, [-1.4, 0, 1.4, 0, 0.6, 9, -0.4, 6], ink);
      unpin(ctx, 0.9);
    }
  }
  unpin(ctx, 1.8);
  // visage
  const eye = threat(r);
  almonds(ctx, [-7, -6, 7, 0.2, 2.6 + r.wE, 7, -6, 7, -0.2, 2.6 + r.wE], eye);
  dot(ctx, -6.4, -6, 1, INK);
  dot(ctx, 7.6, -6, 1, INK);
  poly(ctx, [-11, -12, -3, -9.6, -3.4, -8.4, -11, -10.2], ink2);
  poly(ctx, [11, -12, 3, -9.6, 3.4, -8.4, 11, -10.2], ink2);
  const mo = 1.6 + r.wE * 4 + r.rel * 3 + (tired ? 2 : 0);
  poly(ctx, [-8, 5, -4, 5 + mo * 0.4, 0, 5 + mo * 0.2, 4, 5 + mo * 0.5, 8, 5, 5, 6 + mo, 1, 5.6 + mo * 1.2, -3, 6 + mo, -6, 5.6 + mo * 0.6], CUT);
  // bras avant
  pin(ctx, 16, -8, armA(1));
  treantArm(ctx, r, ink, 0, foreA(1), v);
  unpin(ctx, 1.6);
  tellRing(ctx, r, 0, -6, 10, false);
  ctx.restore();
  dizzy(ctx, p, -48, 20);
};

// ───────────────────────────── Reine crapaud (marais) ─────────────────────────────

const QUEEN_WARTS = [-12, 8, 1.4, -6, 12, 1.2, 0, 9, 1.5, 6, 13, 1.2, 12, 8, 1.4, -9, 16, 1, 9, 16, 1, 0, 17, 1.1, -16, 2, 1, 16, 2, 1];
const QUEEN_CROWNS: number[][] = [
  [-10, 0, -10, -10, -5, -5, 0, -12, 5, -5, 10, -10, 10, 0],
  [-11, 0, -11, -8, -7, -4, -4, -11, 0, -5, 4, -11, 7, -4, 11, -8, 11, 0],
  [-8, 0, -9, -14, -4, -7, 0, -16, 4, -7, 9, -14, 8, 0],
];

export const drawQueen: Painter = (ctx, p) => {
  const r = begin(p);
  const t = r.t, v = p.variant ?? 0;
  const ink = r.ink, ink2 = r.ink2;
  const tired = p.state === 'breath';
  const breathe = Math.sin(t * (tired ? 4 : 2)) * (tired ? 2.2 : 1.5);
  shadow(ctx, r, 34, 11, 24);
  // nénuphars découpés de part et d'autre
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * 30, 21 + Math.sin(t * 1.4 + s) * 0.8);
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 4.6, 0, s > 0 ? 0.5 : Math.PI + 0.5, s > 0 ? TAU : Math.PI + TAU);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fillStyle = ink2;
    ctx.fill();
    slits(ctx, [0, 0, -7, -2, 0, 0, 7, 2, 0, 0, -3, 3], 0.7);
    ctx.restore();
  }
  ctx.save();
  root(ctx, r, 24, -50);
  const hop = r.move ? Math.abs(Math.sin(t * 4)) * 4 : 0;
  ctx.translate(0, -breathe * 0.4 - hop + r.wE * 2 - r.rel * 3);
  // cuisses repliées
  for (const s of [-1, 1]) {
    pin(ctx, s * 20, 14, s * (0.2 + (r.move ? Math.sin(t * 4) * 0.2 : 0)));
    ctx.beginPath();
    ctx.ellipse(s * 4, 2, 10, 7, s * 0.4, 0, TAU);
    ctx.fillStyle = ink;
    ctx.fill();
    poly(ctx, [s * 6, 7, s * 16, 10, s * 12, 11, s * 8, 10.4, s * 4, 11], ink);
    slits(ctx, [s * 0, 0, s * 7, 3], 0.9);
    unpin(ctx, 1.4);
  }
  // corps
  ctx.beginPath();
  ctx.ellipse(0, 6, 30 + breathe, 21 - breathe * 0.4, 0, 0, TAU);
  ctx.fillStyle = ink;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 12, 18, 10.5, 0, 0, TAU);
  ctx.fillStyle = ink2;
  ctx.fill();
  holes(ctx, QUEEN_WARTS);
  // sac vocal vermillon qui gonfle (anticipation)
  if (r.w > 0) {
    const sr = 5 + r.wE * 11;
    dot(ctx, 0, 14, sr, DANGER);
    ctx.lineWidth = 2;
    ctx.strokeStyle = INK;
    ctx.stroke();
    slits(ctx, [-sr * 0.5, 14 - sr * 0.4, -sr * 0.2, 14 - sr * 0.6], 1.2, CUT);
  }
  // bras palmés
  for (const s of [-1, 1]) {
    pin(ctx, s * 15, 12, s * (0.35 - r.rel * 0.3 + (r.move ? Math.sin(t * 4 + s) * 0.15 : 0)));
    bone(ctx, 0, 0, 0, 11, 4.4, ink);
    poly(ctx, [-3, 10, -5.6, 15, -2, 13, 0, 16, 2, 13, 5.6, 15, 3, 10], ink);
    unpin(ctx, 1.4);
  }
  // bouche : mâchoire épinglée qui s'ouvre à la détente
  const mo = r.rel * 0.25 + (tired ? 0.12 : 0);
  ctx.beginPath();
  ctx.moveTo(-15, -1);
  ctx.quadraticCurveTo(0, 5, 15, -1);
  ctx.lineWidth = 2;
  ctx.strokeStyle = CUT;
  ctx.stroke();
  if (mo > 0.02) {
    ctx.beginPath();
    ctx.moveTo(-14, -1);
    ctx.quadraticCurveTo(0, 5 + mo * 40, 14, -1);
    ctx.quadraticCurveTo(0, 5, -14, -1);
    ctx.fillStyle = INK2;
    ctx.fill();
  }
  // yeux globuleux épinglés (rebondissent en retard)
  for (const s of [-1, 1]) {
    pin(ctx, s * 13, -10, Math.sin(t * 2 + s - 0.6) * 0.06 - (r.move ? Math.cos(t * 4) * 0.08 : 0));
    dot(ctx, 0, -4, 9, ink);
    const blink = Math.sin(t * 0.7 + s * 0.2) > 0.97 || tired;
    if (blink) slits(ctx, [-5, -4, 5, -4], 1.4);
    else {
      dot(ctx, 0, -5, 6, threat(r));
      ctx.beginPath();
      ctx.ellipse(Math.cos(p.facing) * 1.6, -5, 1.6 + r.wE, 4.4, 0, 0, TAU);
      ctx.fillStyle = INK;
      ctx.fill();
    }
    unpin(ctx, 1.4);
  }
  // couronne d'or à la feuille, percée
  pin(ctx, 0, -20, Math.sin(t * 2 - 1) * 0.08 + (tired ? 0.3 : 0) - r.rel * 0.15);
  poly(ctx, QUEEN_CROWNS[v] ?? QUEEN_CROWNS[0], r.C(UI.gold), INK, 1.8);
  holes(ctx, [-5, -2.4, 1.1, 0, -3, 1.6, 5, -2.4, 1.1], INK);
  dot(ctx, 0, -3, 0.7, CUT);
  unpin(ctx, 1.6);
  tellRing(ctx, r, 0, 14, 9, false);
  ctx.restore();
  dizzy(ctx, p, -42, 20);
};

// ───────────────────────────── Scorpion (désert) ─────────────────────────────

function scLeg(ctx: Ctx, c: string, a1: number, a2: number): void {
  ctx.rotate(a1);
  limb(ctx, 0, 0, 0, 8, 3, c);
  pin(ctx, 0, 8, a2);
  poly(ctx, [-1.4, 0, 1.4, 0, 0.6, 9, -0.4, 9], c);
  unpin(ctx, 0.9);
}

function scClaw(ctx: Ctx, c: string, open: number): void {
  bone(ctx, 0, 0, 10, 0, 4.6, c);
  pin(ctx, 10, 0, -0.5);
  bone(ctx, 0, 0, 8, 0, 4.2, c);
  pin(ctx, 8, 0, 0);
  // pince : main bombée + doigt fixe + doigt mobile épinglé
  ctx.beginPath();
  ctx.ellipse(3, 0, 6, 4.6, 0, 0, TAU);
  ctx.fillStyle = c;
  ctx.fill();
  poly(ctx, [7, 1, 17, 2.4, 8, 4], c);
  holes(ctx, [2, -1, 1, 4.6, 1, 0.7]);
  pin(ctx, 7, -1, -open);
  poly(ctx, [0, -1.6, 10, -1.2, 11, 0.4, 0, 1.6], c);
  slits(ctx, [2, 0, 8, 0], 0.7);
  unpin(ctx, 1.1);
  unpin(ctx, 1.2);
  unpin(ctx, 1.4);
}

export const drawScorpion: Painter = (ctx, p) => {
  const r = begin(p);
  const t = r.t, v = p.variant ?? 0;
  const ink = r.ink, ink2 = r.ink2;
  const tired = p.state === 'breath';
  const walk = r.move ? t * 14 : r.charge ? t * 26 : 0;
  shadow(ctx, r, 36, 10, 18);
  ctx.save();
  root(ctx, r, 18, -40);
  if (r.charge) ctx.translate(Math.sin(t * 40) * 0.6, 0);
  ctx.translate(0, (tired ? 3 : 0) + r.wE * 1.5);
  // pattes du fond
  for (let i = 0; i < 4; i++) {
    const k = walk ? Math.sin(walk + i * 1.4 + Math.PI) * 0.35 : 0;
    pin(ctx, -9 + i * 6.4, 2, 0.5 - i * 0.28 + k);
    scLeg(ctx, ink2, 0, -0.5 + (walk ? Math.max(0, Math.cos(walk + i)) * 0.3 : 0));
    unpin(ctx, 1);
  }
  // pince du fond
  const clawOpen = (s: number) => (r.charge ? 0.05 : 0.2 + Math.max(0, Math.sin(t * 3 + s)) * 0.25 + r.wE * 0.6 - r.rel * 0.2);
  pin(ctx, 15, -1, -0.15 + Math.sin(t * 2 + 1) * 0.05 - r.wE * 0.3);
  scClaw(ctx, ink2, clawOpen(1));
  unpin(ctx, 1.4);
  // queue en cinq anneaux épinglés : s'enroule à l'anticipation, frappe à la détente
  const curl0 = 0.75 - r.wE * 0.35 + r.rel * 0.3 + (tired ? -0.4 : 0);
  const sting = r.w > 0.05 ? DANGER : CUT;
  ctx.save();
  let depth = 0;
  pin(ctx, -18, -2, curl0);
  depth++;
  for (let i = 0; i < 5; i++) {
    const L = 9 - i * 0.6;
    ctx.beginPath();
    ctx.ellipse(-L / 2, 0, L / 2 + 1.6, 5.4 - i * 0.5, 0, 0, TAU);
    ctx.fillStyle = ink;
    ctx.fill();
    slits(ctx, [-L / 2, -2.6 + i * 0.3, -L / 2, 2.6 - i * 0.3], 0.8);
    if (v > 0) poly(ctx, [-L / 2 - 1.6, -4.4 + i * 0.4, -L / 2, -7.6 + i * 0.4, -L / 2 + 1.6, -4.4 + i * 0.4], ink);
    const a = 0.58 + r.wE * 0.16 + r.rel * 0.12 + Math.sin(t * 3 - i * 0.6) * 0.05 + (tired ? -0.12 : 0);
    pin(ctx, -L, 0, a);
    depth++;
  }
  // dard
  poly(ctx, [0, -3.4, -8, -4, -13, 2, -8, 1.6, -3, 3.4], sting, INK, 1.4);
  if (v === 2) poly(ctx, [-6, -3.6, -9, -9, -4, -4], sting, INK, 1.2);
  tellRing(ctx, r, -10, 0, 5);
  for (let i = 0; i < depth; i++) unpin(ctx, 1.3);
  ctx.restore();
  // corps
  ctx.beginPath();
  ctx.moveTo(22, 2);
  ctx.quadraticCurveTo(20, -9, 8, -9.6);
  ctx.quadraticCurveTo(-8, -10.6, -20, -5);
  ctx.quadraticCurveTo(-23, 3, -16, 9);
  ctx.quadraticCurveTo(0, 13, 16, 9);
  ctx.quadraticCurveTo(22, 7, 22, 2);
  ctx.fillStyle = ink;
  ctx.fill();
  slits(ctx, [-12, -8, -13, 8, -5, -9.4, -5.6, 10, 2, -9.6, 2, 10.6, 9, -9, 9.6, 9.6], 1.1);
  holes(ctx, [-16, 0, 1.2, -8.6, 2, 1.1, -1.6, 2, 1.1, 5.4, 2, 1.1]);
  // yeux
  dot(ctx, 17, -4, 2.2, threat(r));
  dot(ctx, 13.6, -6.6, 1.6, threat(r));
  dot(ctx, 17.6, -4, 0.8, INK);
  // pattes du devant
  for (let i = 0; i < 4; i++) {
    const k = walk ? Math.sin(walk + i * 1.4) * 0.35 : 0;
    pin(ctx, -10 + i * 6.4, 7, 0.45 - i * 0.28 + k);
    scLeg(ctx, ink, 0, -0.5 + (walk ? Math.max(0, Math.cos(walk + i + 1)) * 0.3 : 0));
    unpin(ctx, 1.1);
  }
  // pince avant
  pin(ctx, 17, 4, 0.2 + Math.sin(t * 2) * 0.05 - r.wE * 0.35 + (r.charge ? -0.2 : 0));
  scClaw(ctx, ink, clawOpen(-1));
  unpin(ctx, 1.6);
  ctx.restore();
  dizzy(ctx, p, -26, 20);
};

// ───────────────────────────── Vouivre (givre) ─────────────────────────────

function wyWing(ctx: Ctx, c: string, a1: number, a2: number): void {
  ctx.rotate(a1);
  ctx.scale(1.3, 1.3);
  // bras de l'aile + première membrane
  ctx.beginPath();
  ctx.moveTo(-2, 1.6);
  ctx.lineTo(0, -2);
  ctx.lineTo(16, -3);
  ctx.lineTo(15, 2.6);
  ctx.quadraticCurveTo(8, 6, 3, 12);
  ctx.quadraticCurveTo(0, 6, -2, 1.6);
  ctx.closePath();
  ctx.fillStyle = c;
  ctx.fill();
  holes(ctx, [6, 3, 1.2, 9.6, 1, 0.8]);
  pin(ctx, 15.6, -0.4, a2);
  // doigts et membrane festonnée
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.lineTo(22, -10);
  ctx.quadraticCurveTo(18, -3, 20, 3);
  ctx.quadraticCurveTo(14, 2, 12, 9);
  ctx.quadraticCurveTo(7, 5, 3, 12);
  ctx.quadraticCurveTo(0, 4, -1, 2);
  ctx.closePath();
  ctx.fillStyle = c;
  ctx.fill();
  slits(ctx, [1.6, -1.4, 19, -8.6, 1.6, 0, 17.6, 1.6, 1.4, 1.4, 11, 7.2], 0.8);
  holes(ctx, [12, -2.6, 1, 8, 3.6, 0.9]);
  unpin(ctx, 1.3);
}

export const drawWyvern: Painter = (ctx, p) => {
  const r = begin(p);
  const t = r.t, v = p.variant ?? 0;
  const ink = r.ink, ink2 = r.ink2;
  const tired = p.state === 'breath';
  const fp = t * (r.charge ? 14 : tired ? 4 : 7);
  const flap = Math.sin(fp), flap2 = Math.sin(fp - 0.9);
  shadow(ctx, r, 30, 9, 34, 0.22);
  ctx.save();
  root(ctx, r, 34, -40);
  ctx.translate(0, Math.sin(t * 2) * 3 - 6 + (tired ? 6 : 0));
  ctx.scale(1.15, 1.15);
  // aile du fond
  let a1 = -1.9 + flap * 0.55, a2 = 0.35 + flap2 * 0.4;
  if (r.st === 'windup') {
    a1 = lerp(a1, -2.4, r.wE);
    a2 = lerp(a2, 0.1, r.wE);
  }
  if (r.charge) {
    a1 = -2.75 + flap * 0.15;
    a2 = 0.6;
  }
  if (tired) {
    a1 = -1.1 + flap * 0.15;
    a2 = 0.9;
  }
  pin(ctx, 4, -7, a1 + 0.25);
  wyWing(ctx, ink2, 0, a2);
  unpin(ctx, 1.2);
  // queue en trois pièces, ondulation en retard
  pin(ctx, -14, 1, 0.1 + Math.sin(t * 3) * 0.15);
  poly(ctx, [0, -4, -12, -2.4, -12, 2.4, 0, 4], ink);
  pin(ctx, -11.6, 0, Math.sin(t * 3 - 0.8) * 0.25);
  poly(ctx, [0, -2.6, -11, -1.4, -11, 1.4, 0, 2.6], ink);
  pin(ctx, -10.6, 0, Math.sin(t * 3 - 1.6) * 0.35);
  poly(ctx, [0, -1.6, -6, -1, -10, -5, -14, 0, -10, 5, -6, 1, 0, 1.6], ink);
  dot(ctx, -10, 0, 1.4, CUT);
  unpin(ctx, 1);
  unpin(ctx, 1.1);
  unpin(ctx, 1.3);
  // pattes repliées
  poly(ctx, [-4, 6, -2, 14, 1, 14.6, 0, 6], ink2);
  // corps, crête de glace
  ctx.beginPath();
  ctx.ellipse(0, 0, 18, 10.5, 0, 0, TAU);
  ctx.fillStyle = ink;
  ctx.fill();
  slits(ctx, [-10, 4, -6, 7.4, -4, 4.6, 0, 8, 2, 4.6, 6, 7.6], 1);
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const x = -12 + i * 5.4;
    ctx.moveTo(x - 2, -8.6 + Math.abs(i - 2) * 0.5);
    ctx.lineTo(x, -14 + Math.abs(i - 2) * 1.2 - (v === 1 ? 2 : 0));
    ctx.lineTo(x + 2, -8.6 + Math.abs(i - 2) * 0.5);
  }
  ctx.fillStyle = CUT;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = ink;
  ctx.stroke();
  // cou en deux pièces : il recule à l'anticipation, se détend à la détente
  const neck0 = lerp(-0.45, 0.25 - 0.9, r.wE) * 1 + r.rel * 0.55 + (tired ? 0.5 : 0) + Math.sin(t * 2 + 0.6) * 0.05;
  pin(ctx, 12, -4, neck0);
  poly(ctx, [0, -4.6, 11, -3.4, 11, 3.4, 0, 5], ink);
  pin(ctx, 10.4, 0, lerp(0.15, 0.7, r.wE) - r.rel * 0.35 + Math.sin(t * 2 + 1.2) * 0.06 + (tired ? 0.3 : 0));
  poly(ctx, [0, -3.6, 9, -2.6, 9, 3, 0, 3.6], ink);
  // tête, mâchoire épinglée, cornes de glace
  pin(ctx, 8.6, 0, -lerp(0, 0.5, r.wE) + r.rel * 0.2);
  const jaw = r.wE * 0.6 + r.rel * 0.75 + (tired ? 0.25 : 0);
  if (jaw > 0.1) {
    // gueule : vermillon pendant l'anticipation, givre à la détente
    poly(ctx, [1, -0.6, 12, -1 + jaw * 2, 12, 1 + jaw * 7], r.w > 0.05 ? DANGER : INK2);
  }
  pin(ctx, 1.6, 1.4, jaw);
  poly(ctx, [-1, -1, 11, 0, 10.4, 2, -0.6, 2.6], ink);
  slits(ctx, [3, -0.4, 3.4, -1.4, 6, -0.3, 6.4, -1.3], 0.7);
  unpin(ctx, 0.9);
  poly(ctx, [-2, -4.6, 6, -5.4, 14, -2, 14.6, 0, 9, 1.4, -1.4, 2.6], ink);
  for (let k = 0; k < 2; k++) poly(ctx, [1 + k * 3.4, -4.4, -4 + k * 2, -13 - k * 2.6, 4 + k * 3, -5], CUT, ink, 1.1);
  almonds(ctx, [7.2, -2.2, 3.8, -0.15, 1.2], threat(r));
  dot(ctx, 7.8, -2.2, 0.6, INK);
  tellRing(ctx, r, 13, 1, 6, false);
  if (r.rel > 0) {
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const d = 14 + (1 - r.rel) * 14 + i * 2;
      const y = (i - 2) * 2.4 * (1.4 - r.rel);
      ctx.moveTo(d + 1.4, y);
      ctx.arc(d, y, 1.4 * r.rel + 0.3, 0, TAU);
    }
    ctx.fillStyle = CUT;
    ctx.fill();
  }
  unpin(ctx, 1.2);
  unpin(ctx, 1.2);
  unpin(ctx, 1.4);
  // aile de devant
  pin(ctx, 2, -6, a1);
  wyWing(ctx, ink, 0, a2);
  unpin(ctx, 1.6);
  ctx.restore();
  dizzy(ctx, p, -34, 20);
};

// ───────────────────────────── Seigneur des cendres ─────────────────────────────

const ASH_CRACKS = [-8, -10, -2, -3, -2, -3, -6, 5, 6, -12, 2, 0, 2, 0, 8, 8, -2, -3, 2, 0];
const ASH_HORNS: number[][] = [
  [0, 0, 11, -6, 9, -18, 5, -8, -2, -3],
  [0, 0, 14, -2, 18, -10, 9, -4, -2, -3],
  [0, 0, 6, -10, 3, -20, 1, -9, -2, -3],
];

export const drawAshlord: Painter = (ctx, p) => {
  const r = begin(p);
  const t = r.t, v = p.variant ?? 0;
  const ink = r.ink;
  const tired = p.state === 'breath';
  const float = Math.sin(t * 1.8) * 2;
  shadow(ctx, r, 30, 10, 26);
  ctx.save();
  root(ctx, r, 26, -62);
  ctx.translate(0, float + (tired ? 5 : 0) + r.wE * 1.5);
  // cape en deux pans épinglés aux épaules, ourlet déchiré qui flotte
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.scale(s, 1);
    pin(ctx, 9, -14, 0.12 + Math.sin(t * 2.6 + s) * 0.05 + (r.move ? 0.15 : 0) + r.wE * 0.12);
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(4, 0);
    ctx.quadraticCurveTo(14, 18, 16, 38);
    for (let i = 0; i < 5; i++) {
      const x = 16 - (i + 1) * 5;
      ctx.lineTo(x + 2.5, 32 + Math.sin(t * 4 + i + s) * 2.4 + (i % 2) * 3);
      ctx.lineTo(x, 38 + Math.sin(t * 4 + i * 1.7 + s) * 2);
    }
    ctx.lineTo(-9, 36);
    ctx.closePath();
    ctx.fillStyle = ink;
    ctx.fill();
    holes(ctx, [6, 14, 1.4, 9, 24, 1.2, 2, 28, 1.1, 11, 31, 0.9]);
    unpin(ctx, 1.6);
    ctx.restore();
  }
  // jambières
  for (const s of [-1, 1]) {
    pin(ctx, s * 6, 12, r.move ? Math.sin(t * 5 + s) * 0.15 : s * 0.06);
    poly(ctx, [-3.4, 0, 3.4, 0, 3, 11, s * 6, 14, -3.4, 14], ink);
    slits(ctx, [-1.4, 3, 1.4, 3, -1.4, 6, 1.4, 6], 0.9);
    unpin(ctx, 1.3);
  }
  // armure : fissures de braise (vermillon à l'anticipation)
  ctx.beginPath();
  ctx.roundRect(-14, -16, 28, 30, 8);
  ctx.fillStyle = ink;
  ctx.fill();
  slits(ctx, ASH_CRACKS, 1.8, r.w > 0.05 ? DANGER : CUT);
  holes(ctx, [-10, -12, 1, 10, -12, 1, -10, 9, 1, 10, 9, 1, 0, 11, 1.2]);
  // bras : levés pour brandir une orbe de braise, abattus à la détente
  const raise = r.wE;
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.scale(s, 1);
    const a1 = lerp(1.25 + Math.sin(t * 2 + s) * 0.08 + (tired ? 0.25 : 0), -1.95, raise) - r.rel * 1.1;
    const a2 = lerp(-0.25, -0.7, raise) + r.rel * 0.3;
    pin(ctx, 14, -12, a1);
    bone(ctx, 0, 0, 11, 0, 5.4, ink);
    pin(ctx, 11, 0, a2);
    bone(ctx, 0, 0, 10, 0, 4.6, ink);
    poly(ctx, [9, -3, 14, -3.4, 15, 0, 14, 3.4, 9, 3], ink);
    unpin(ctx, 1.3);
    // épaulière à pointes
    poly(ctx, [-4, -5, 2, -9, 4, -4, 8, -6, 7, 0, 3, 4, -4, 4], ink);
    dot(ctx, 1.6, -1.4, 1.2, CUT);
    unpin(ctx, 1.6);
    ctx.restore();
  }
  // orbe de braise entre les mains levées
  if (r.st === 'windup') {
    const oy = lerp(-14, -50, r.wE);
    const orb = 3 + r.wE * 7 + Math.sin(t * 20) * 0.6;
    dot(ctx, 0, oy, orb, DANGER);
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = INK;
    ctx.stroke();
    holes(ctx, [-orb * 0.3, oy - orb * 0.3, orb * 0.25]);
    tellRing(ctx, r, 0, oy, orb * 0.9, false);
  }
  // tête casquée, cornes, couronne de flammes découpées
  pin(ctx, 0, -18, Math.sin(t * 1.4) * 0.04 + (tired ? 0.25 : 0) - r.rel * 0.08);
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.scale(s, 1);
    pin(ctx, 6, -10, -0.1 + Math.sin(t * 2) * 0.03);
    poly(ctx, ASH_HORNS[v] ?? ASH_HORNS[0], ink, CUT, 0.8);
    unpin(ctx, 1);
    ctx.restore();
  }
  ctx.beginPath();
  ctx.moveTo(-9, -2);
  ctx.quadraticCurveTo(-10.6, -14, 0, -15.6);
  ctx.quadraticCurveTo(10.6, -14, 9, -2);
  ctx.lineTo(4, 2);
  ctx.lineTo(-4, 2);
  ctx.closePath();
  ctx.fillStyle = ink;
  ctx.fill();
  const eye = threat(r);
  almonds(ctx, [-3.8, -7.4, 5, 0.25, 1.4, 3.8, -7.4, 5, -0.25, 1.4], eye);
  slits(ctx, [0, -4, 0, 0, -2.2, -1.4, -2.2, 0.6, 2.2, -1.4, 2.2, 0.6], 0.9);
  ctx.beginPath();
  for (let i = -2; i <= 2; i++) {
    const h = 5 + Math.sin(t * 12 + i * 2) * 2 + r.wE * 5 + (i === 0 ? 2 : 0);
    ctx.moveTo(i * 3.8 - 2.2, -15);
    ctx.quadraticCurveTo(i * 3.8 - 1.4, -15 - h, i * 3.8 + Math.sin(t * 9 + i) * 0.8, -15 - h * 1.7);
    ctx.quadraticCurveTo(i * 3.8 + 1.4, -15 - h, i * 3.8 + 2.2, -15);
    ctx.closePath();
  }
  ctx.fillStyle = r.w > 0.05 ? DANGER : CUT;
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = ink;
  ctx.stroke();
  unpin(ctx, 1.4);
  ctx.restore();
  dizzy(ctx, p, -58, 20);
};

export { INK2 };
