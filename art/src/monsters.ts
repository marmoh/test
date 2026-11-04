/**
 * Monstres : marionnettes d'encre articulées, percées de dentelle.
 * Chaque monstre a sa silhouette propre et ses cycles (repos, marche, anticipation, détente,
 * coup reçu, mort) ; l'anticipation est toujours lisible en vermillon, avec un geste propre
 * à l'ennemi (fronde qui tournoie, trois flèches encochées, runes qui s'allument…).
 */
import { blobPath, type Ctx } from './draw.js';
import {
  begin, root, pin, unpin, holes, slits, almonds, poly, limb, bone, dot, shadow, tellRing, threat,
  eliteAura, eliteCrown, smooth, lerp, TAU,
  INK, INK2, CUT, DANGER, type Painter,
} from './rig.js';

// ───────────────────────────── Gobelin frondeur ─────────────────────────────

const GOB_HEM = [-5, 4.2, 0.75, -2.4, 5.2, 0.75, 0.4, 5.5, 0.75, 3.2, 5.1, 0.75, 5.6, 4, 0.7];

function gobLeg(ctx: Ctx, c: string): void {
  poly(ctx, [-1.8, 0, 1.8, 0, 1.6, 4.4, 4.8, 5.4, 4.6, 7, -2.2, 7, -2.2, 4], c);
}
function gobEar(ctx: Ctx, c: string, slit: boolean): void {
  poly(ctx, [0, -2.4, -9, -6.4, -13, -5.2, -8.4, -2.4, 0, 2.4], c);
  if (slit) slits(ctx, [-2, -0.6, -8.6, -3.8], 0.9);
}

export const drawGoblin: Painter = (ctx, p) => {
  const r = begin(p);
  const t = r.t, ph = r.ph;
  const hopP = t * 9 + ph;
  const hs = Math.sin(hopP);
  const hop = r.move ? Math.abs(hs) * 3.5 : 0;
  const vy = r.move ? Math.cos(hopP) * Math.sign(hs) : 0;
  eliteAura(ctx, p, 15);
  shadow(ctx, r, 12 - hop * 0.6, 4.5, 12);
  ctx.save();
  root(ctx, r, 12, -24);
  ctx.translate(0, -hop + r.wE * 1.6);
  ctx.translate(0, 8);
  ctx.rotate(-r.wE * 0.16 + r.rel * 0.24 + (r.move ? 0.08 : 0));
  ctx.translate(0, -8);
  const ink = r.ink;

  pin(ctx, -3, 5, -0.25 - (r.move ? hs * 0.45 : 0) - r.wE * 0.25);
  gobLeg(ctx, r.ink2);
  unpin(ctx);
  pin(ctx, 3, 5, 0.1 + (r.move ? hs * 0.45 : 0) - r.wE * 0.1);
  gobLeg(ctx, ink);
  unpin(ctx);

  // corps en poire, tunique dentelée
  ctx.beginPath();
  ctx.moveTo(0, -8.5);
  ctx.bezierCurveTo(9.5, -8.5, 11.5, 8, 0, 8.6);
  ctx.bezierCurveTo(-11.5, 8, -9.5, -8.5, 0, -8.5);
  ctx.fillStyle = ink;
  ctx.fill();
  slits(ctx, [-7.4, 1.2, -1.4, 1.8, 1.4, 1.8, 7.4, 1.2], 1);
  holes(ctx, GOB_HEM);
  dot(ctx, 0, 1.8, 1.4, CUT);
  dot(ctx, 0, 1.8, 0.6, ink);

  // tête : oreilles épinglées qui ballottent avec retard sur le saut
  const headA = Math.sin(t * 2 + ph) * 0.05 - r.wE * 0.12 + r.rel * 0.16;
  pin(ctx, 1.5, -7, headA);
  const earA = -0.15 + Math.sin(t * 6 + ph - 0.8) * 0.1 - vy * 0.35 - r.wE * 0.25 + r.rel * 0.3;
  pin(ctx, -2.6, -7.4, earA - 0.35);
  gobEar(ctx, r.ink2, false);
  unpin(ctx, 0.9);
  dot(ctx, 1, -5.4, 6.4, ink);
  poly(ctx, [6.4, -7.6, 12.6, -4.2, 11.6, -3.2, 6.8, -3.4], ink);
  pin(ctx, -2.4, -6.6, earA);
  gobEar(ctx, ink, true);
  unpin(ctx);
  // œil rond, sourcil froncé, sourire dentelé
  dot(ctx, 4.2, -7.4, 2, threat(r) === DANGER ? DANGER : CUT);
  dot(ctx, 4.8, -7.3, 0.9, ink);
  slits(ctx, [2.2, -10.4, 6, -9.2], 0.9);
  poly(ctx, [3, -2.6, 8.4, -3.4, 7.8, -1.8, 7, -2.6, 6.2, -1.6, 5.3, -2.5, 4.4, -1.5, 3.6, -2.3], CUT);
  eliteCrown(ctx, p, 1, -13.6, -0.1);
  unpin(ctx);

  // bras à la fronde
  const restA = r.move ? 1.05 + hs * 0.35 : 1.15 + Math.sin(t * 2 + ph) * 0.12;
  let armA = lerp(restA, -2.25, r.wE);
  if (r.rel > 0) armA = lerp(armA, 0.15, smooth(r.rel * 1.5));
  pin(ctx, 1, -2.4, armA);
  bone(ctx, 0, 0, 6.6, 0, 2.7, ink);
  dot(ctx, 7, 0, 1.9, ink);
  unpin(ctx);
  const hx = 1 + Math.cos(armA) * 7, hy = -2.4 + Math.sin(armA) * 7;
  if (r.st === 'windup') {
    // la pierre tournoie au-dessus de la tête, de plus en plus vite
    const R = 6.5 + r.w * 1.5;
    const cx = hx, cy = hy - 2;
    const th = t * (11 + r.w * 16);
    const sx = cx + Math.cos(th) * R, sy = cy + Math.sin(th) * R * 0.5;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy, R, R * 0.5, 0, th - 2, th);
    ctx.strokeStyle = DANGER;
    ctx.lineWidth = 1.6;
    ctx.setLineDash([2.5, 2]);
    ctx.stroke();
    ctx.restore();
    limb(ctx, hx, hy, sx, sy, 1, ink);
    tellRing(ctx, r, cx, cy, 4.5, false);
    dot(ctx, sx, sy, 2.5, DANGER);
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = INK;
    ctx.stroke();
  } else if (r.rel > 0) {
    limb(ctx, hx, hy, hx + 9, hy - 3 * r.rel, 1, ink);
  } else {
    const sw = Math.sin(t * 3 + ph) * 1.6 + (r.move ? hs * 2 : 0);
    limb(ctx, hx, hy, hx + sw, hy + 5, 1, ink);
    dot(ctx, hx + sw, hy + 5.6, 1.7, ink);
  }
  ctx.restore();
};

// ───────────────────────────── Gelée ─────────────────────────────

export const drawJelly: Painter = (ctx, p) => {
  const r = begin(p);
  const small = (p.variant ?? 0) === 1;
  const R = small ? 11 : 17;
  const t = r.t;
  // saut : élan écrasé, étirement en l'air, écrasement à la réception
  let lift = 0, sq = Math.sin(t * 4 + r.ph) * 0.05;
  if (r.move) {
    const u = (t * (small ? 2 : 1.5) + r.ph) % 1;
    if (u < 0.55) {
      const k = u / 0.55;
      lift = Math.sin(k * Math.PI) * R * 0.45;
      sq = -0.12 * Math.sin(k * Math.PI);
    } else sq = 0.2 * Math.sin(((u - 0.55) / 0.45) * Math.PI);
  }
  sq += r.wE * 0.16 - r.rel * 0.2;
  const sw = 1 + r.wE * 0.12;
  eliteAura(ctx, p, R);
  shadow(ctx, r, R * 0.95 * (1 - lift / (R * 1.5)), R * 0.35, R * 0.7);
  ctx.save();
  root(ctx, r, R * 0.7, -R - 4);
  ctx.translate(0, -lift + sq * R * 0.6);
  const sx = (1 + sq) * sw, sy = (1 - sq) * sw;
  // tétine du sommet, épinglée : traîne quand la gelée saute
  const vy = r.move ? Math.cos(((t * 1.5 + r.ph) % 1) * Math.PI * 2) : 0;
  pin(ctx, 0, -R * 0.9 * sy, Math.sin(t * 3 + r.ph) * 0.18 + vy * 0.25);
  poly(ctx, [-R * 0.18, 1, 0, -R * 0.45, R * 0.18, 1], r.ink);
  dot(ctx, 0, -R * 0.45, R * 0.1, r.ink);
  unpin(ctx, small ? 0.8 : 1);
  blobPath(ctx, R, t * 4 + r.ph, 3, 0.05, sx, sy);
  ctx.fillStyle = r.ink;
  ctx.fill();
  // fenêtre de gel : bulles découpées qui circulent, reflet en croissant
  ctx.beginPath();
  const n = small ? 5 : 8;
  for (let i = 0; i < n; i++) {
    const a = t * 0.7 + (i / n) * TAU + r.ph;
    const rr = R * (0.58 + 0.08 * Math.sin(a * 2));
    const br = R * (0.07 + 0.03 * ((i * 7) % 3));
    const x = Math.cos(a) * rr * sx, y = Math.sin(a) * rr * 0.75 * sy + R * 0.1;
    ctx.moveTo(x + br, y);
    ctx.arc(x, y, br, 0, TAU);
  }
  ctx.fillStyle = CUT;
  ctx.fill();
  almonds(ctx, [-R * 0.42 * sx, -R * 0.5 * sy, R * 0.5, -0.6, R * 0.1]);
  // yeux et bouche
  const ey = -R * 0.12 * sy;
  const look = Math.cos(p.facing) * R * 0.05;
  const blink = Math.sin(t * 0.9 + r.ph) > 0.97;
  for (const s of [-1, 1]) {
    const ex = s * R * 0.3 + look;
    if (blink) slits(ctx, [ex - R * 0.16, ey, ex + R * 0.16, ey], 1.2);
    else {
      dot(ctx, ex, ey, R * 0.19, r.w > 0.05 ? DANGER : CUT);
      dot(ctx, ex + look * 0.8, ey + R * 0.03, R * 0.08, INK);
    }
  }
  ctx.beginPath();
  ctx.arc(look, R * 0.18 * sy, R * (0.1 + r.wE * 0.08 + r.rel * 0.1), 0.1, Math.PI - 0.1);
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = CUT;
  ctx.stroke();
  // jupe de gouttes épinglées au bas
  if (!small) {
    for (const s of [-1, 1]) {
      pin(ctx, s * R * 0.62 * sx, R * 0.66 * sy, s * (0.25 + Math.sin(t * 4 + r.ph + s) * 0.12) - vy * 0.2 * s);
      poly(ctx, [-2.4, -1, 2.4, -1, 0, 5.6], r.ink);
      unpin(ctx, 0.8);
    }
  }
  tellRing(ctx, r, 0, 0, R * 0.5);
  eliteCrown(ctx, p, 0, -R * sy - 5);
  ctx.restore();
};

// ───────────────────────────── Chauve-souris ─────────────────────────────

const BAT_INNER = [3, 1.4, 0.8, 6.2, 2.8, 0.6];
function batInner(ctx: Ctx, c: string): void {
  ctx.beginPath();
  ctx.moveTo(0, -1.6);
  ctx.lineTo(9.6, -2.2);
  ctx.lineTo(9.6, 2.4);
  ctx.quadraticCurveTo(6.4, 3, 5, 5.4);
  ctx.quadraticCurveTo(3, 3.6, 0, 4.6);
  ctx.closePath();
  ctx.fillStyle = c;
  ctx.fill();
  holes(ctx, BAT_INNER);
}
function batHand(ctx: Ctx, c: string): void {
  // trois doigts osseux et la membrane festonnée entre eux
  ctx.beginPath();
  ctx.moveTo(-0.6, -2.2);
  ctx.lineTo(13.5, -6.5);
  ctx.quadraticCurveTo(11.2, -2.8, 12.4, 0.6);
  ctx.quadraticCurveTo(9.2, 0.2, 8.8, 4.2);
  ctx.quadraticCurveTo(6.2, 2.4, 4.2, 5.6);
  ctx.quadraticCurveTo(2.2, 3, -0.6, 2.4);
  ctx.closePath();
  ctx.fillStyle = c;
  ctx.fill();
  slits(ctx, [1.6, -1.6, 11, -5.2, 1.6, -0.6, 10.2, -0.4, 1.4, 0.4, 7.4, 3], 0.7);
}

export const drawBat: Painter = (ctx, p) => {
  const r = begin(p);
  const t = r.t;
  const flapP = t * (r.charge ? 26 : r.move ? 17 : 11) + r.ph;
  const f = Math.sin(flapP), f2 = Math.sin(flapP - 0.9);
  eliteAura(ctx, p, 12);
  shadow(ctx, r, 9, 3.5, 20, 0.22);
  ctx.save();
  root(ctx, r, 0, -14, false);
  ctx.translate(0, Math.sin(t * 5 + r.ph) * 2 - r.wE * 3);
  // plongée : le corps se penche vers la cible
  const dive = r.wE * 0.35 * Math.cos(p.facing) + (r.charge ? 0.25 * Math.cos(p.facing) : 0);
  ctx.rotate(dive);
  let a1 = -0.35 * f - 0.1, a2 = -0.55 * f2 + 0.15;
  if (r.st === 'windup') {
    a1 = lerp(a1, -1.05 + Math.sin(t * 30) * 0.05, r.wE);
    a2 = lerp(a2, 1.25, r.wE);
  } else if (r.charge) {
    a1 = -0.15 + f * 0.12;
    a2 = 1.1 + f2 * 0.15;
  }
  if (r.rel > 0) {
    a1 = lerp(a1, 0.35, r.rel);
    a2 = lerp(a2, -0.3, r.rel);
  }
  const ink = r.ink;
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.scale(s, 1);
    pin(ctx, 4, -1, a1);
    batInner(ctx, ink);
    pin(ctx, 9.4, 0, a2);
    batHand(ctx, ink);
    unpin(ctx, 0.9);
    unpin(ctx, 0.9);
    // oreille
    pin(ctx, 2.6, -5.2, 0.15 + Math.sin(t * 7 + r.ph + s) * 0.1 - r.wE * 0.3);
    poly(ctx, [-1.6, 0, 1.4, -7, 2.6, 0.6], ink);
    slits(ctx, [0.4, -1, 1.3, -4.4], 0.7);
    unpin(ctx, 0);
    ctx.restore();
  }
  // corps
  ctx.beginPath();
  ctx.ellipse(0, 0, 6.4, 7.4, 0, 0, TAU);
  ctx.fillStyle = ink;
  ctx.fill();
  slits(ctx, [-2.4, 3.4, 2.4, 3.4, -1.6, 5, 1.6, 5], 0.7);
  // pattes griffues
  poly(ctx, [-3, 6, -1.6, 10, -0.6, 6.6], ink);
  poly(ctx, [3, 6, 1.6, 10, 0.6, 6.6], ink);
  // yeux : vermillon et plus grands à l'anticipation
  const lk = Math.cos(p.facing) * 0.6;
  const eg = threat(r);
  const er = 1.8 + r.wE * 0.9;
  dot(ctx, -2.8 + lk, -1.4, er, eg);
  dot(ctx, 2.8 + lk, -1.4, er, eg);
  dot(ctx, -2.8 + lk * 1.6, -1.2, 0.7, INK);
  dot(ctx, 2.8 + lk * 1.6, -1.2, 0.7, INK);
  // crocs (gueule ouverte en plongée)
  const open = r.wE * 1.4 + (r.charge ? 1.2 : 0);
  if (open > 0.2) dot(ctx, 0, 2.6, 1.2 + open * 0.5, INK2);
  poly(ctx, [-2.2, 2.2, -1.2, 5 + open, -0.3, 2.2], CUT);
  poly(ctx, [2.2, 2.2, 1.2, 5 + open, 0.3, 2.2], CUT);
  tellRing(ctx, r, 0, 0, 6, false);
  eliteCrown(ctx, p, 0, -12);
  ctx.restore();
};

// ───────────────────────────── Champignon-spore ─────────────────────────────

const SHROOM_SPOTS = [-8, -6.2, 3, 4, -10.4, 3.4, 10.2, -3.6, 2.2, -1.8, -2.4, 1.9, -12.6, -1.6, 1.3, 11.6, -9, 1.2, -3.8, -12, 1.4];
const SHROOM_GILLS = [-12, 1.2, -9, 3.4, -7, 1.6, -5.4, 4, -2, 1.8, -1.4, 4.4, 3, 1.8, 2.2, 4.4, 8, 1.6, 6, 4, 12.6, 1.2, 9.6, 3.4];

export const drawMushroom: Painter = (ctx, p) => {
  const r = begin(p);
  const t = r.t;
  const w = r.w;
  const breathe = Math.sin(t * 2 + r.ph) * 0.04;
  eliteAura(ctx, p, 16);
  shadow(ctx, r, 14, 5, 12);
  ctx.save();
  root(ctx, r, 12, -28);
  const ink = r.ink;
  const sway = Math.sin(t * 1.6 + r.ph) * 0.05 + (r.move ? Math.sin(t * 8) * 0.06 : 0);
  // pieds-racines
  for (const s of [-1, 1]) {
    pin(ctx, s * 4.6, 10, s * (0.25 + Math.sin(t * 3 + r.ph + s) * 0.08));
    poly(ctx, [-2, -1, 2, -1, s * 4.6, 2.4, -2.4 * s + s * 0.4, 2.4], ink);
    unpin(ctx, 0.8);
  }
  // tige (épinglée au sol), visage
  pin(ctx, 0, 10, sway - r.rel * 0.12);
  ctx.beginPath();
  ctx.moveTo(-6.2, 0);
  ctx.quadraticCurveTo(-7.6, -7, -5, -14.5);
  ctx.lineTo(5, -14.5);
  ctx.quadraticCurveTo(7.6, -7, 6.2, 0);
  ctx.closePath();
  ctx.fillStyle = ink;
  ctx.fill();
  const lk = 0.6;
  const sleepy = w < 0.05 && Math.sin(t * 0.8 + r.ph) > 0.5;
  if (sleepy) slits(ctx, [-3.8 + lk, -8, -1.4 + lk, -8, 1.4 + lk, -8, 3.8 + lk, -8], 1);
  else {
    dot(ctx, -2.6 + lk, -8, 1.6, threat(r));
    dot(ctx, 2.6 + lk, -8, 1.6, threat(r));
    dot(ctx, -2.4 + lk * 1.4, -7.8, 0.6, INK);
    dot(ctx, 2.8 + lk * 1.4, -7.8, 0.6, INK);
  }
  ctx.beginPath();
  ctx.ellipse(lk, -4, 1 + w * 1.2 + r.rel * 1.4, 0.6 + w * 1.4 + r.rel * 1.6, 0, 0, TAU);
  ctx.fillStyle = CUT;
  ctx.fill();
  holes(ctx, [-3.6, -1.8, 0.6, 0, -1.2, 0.6, 3.6, -1.8, 0.6]);
  // petits bras : ils soutiennent le chapeau qui gonfle
  for (const s of [-1, 1]) {
    pin(ctx, s * 5.6, -9, s * (1.1 - w * 1.9 + Math.sin(t * 2.4 + s) * 0.1));
    bone(ctx, 0, 0, 0, 5.4, 2.2, ink);
    dot(ctx, 0, 5.6, 1.4, ink);
    unpin(ctx, 0.8);
  }
  // chapeau : gonfle à l'anticipation, ses taches deviennent des spores vermillon
  const sc = 1 + breathe + w * 0.24;
  const squash = r.rel;
  pin(ctx, 0, -14.5, Math.sin(t * 1.7 + r.ph - 0.8) * 0.07 + Math.sin(t * 26) * w * 0.04);
  ctx.scale(sc * (1 + squash * 0.18), sc * (1 - squash * 0.3));
  ctx.beginPath();
  ctx.ellipse(0, 1.2, 15, 3.6, 0, 0, Math.PI);
  ctx.fillStyle = r.ink2;
  ctx.fill();
  slits(ctx, SHROOM_GILLS, 0.8);
  ctx.beginPath();
  ctx.moveTo(-17, 1.6);
  ctx.bezierCurveTo(-17, -19, 17, -19, 17, 1.6);
  ctx.quadraticCurveTo(14.5, -0.6, 12, 1.4);
  ctx.quadraticCurveTo(8.5, -0.4, 5.5, 1.6);
  ctx.quadraticCurveTo(2.5, -0.2, -0.5, 1.6);
  ctx.quadraticCurveTo(-3.5, -0.2, -6.5, 1.6);
  ctx.quadraticCurveTo(-9.5, -0.4, -12.5, 1.4);
  ctx.quadraticCurveTo(-14.8, -0.6, -17, 1.6);
  ctx.closePath();
  ctx.fillStyle = ink;
  ctx.fill();
  const n = SHROOM_SPOTS.length / 3;
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    if (w > 0.05 && w > i / (n + 1)) continue;
    const x = SHROOM_SPOTS[i * 3], y = SHROOM_SPOTS[i * 3 + 1], rr = SHROOM_SPOTS[i * 3 + 2];
    ctx.moveTo(x + rr, y);
    ctx.arc(x, y, rr, 0, TAU);
  }
  ctx.fillStyle = CUT;
  ctx.fill();
  if (w > 0.05) {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      if (w <= i / (n + 1)) continue;
      const x = SHROOM_SPOTS[i * 3], y = SHROOM_SPOTS[i * 3 + 1], rr = SHROOM_SPOTS[i * 3 + 2];
      ctx.moveTo(x + rr, y);
      ctx.arc(x, y, rr, 0, TAU);
    }
    ctx.fillStyle = DANGER;
    ctx.fill();
  }
  unpin(ctx, 1.2);
  unpin(ctx, 1);
  // spores qui s'échappent du chapeau pendant l'anticipation, bouffée à la détente
  if (w > 0.15) {
    for (let i = 0; i < 4; i++) {
      const u = (t * 1.6 + i * 0.25) % 1;
      const x = (i - 1.5) * 7 + Math.sin(t * 3 + i) * 2;
      const y = -26 * sc - u * 9;
      dot(ctx, x, y, 1.6 + w, DANGER);
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = INK;
      ctx.stroke();
    }
    tellRing(ctx, r, 0, -22 * sc + 4, 9, false);
  }
  if (r.rel > 0) {
    const R = 14 + (1 - r.rel) * 10;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = Math.PI + (i / 7) * Math.PI;
      ctx.moveTo(Math.cos(a) * R + 1.6, -18 + Math.sin(a) * R * 0.6);
      ctx.arc(Math.cos(a) * R, -18 + Math.sin(a) * R * 0.6, 1.6 * r.rel + 0.4, 0, TAU);
    }
    ctx.fillStyle = INK2;
    ctx.fill();
  }
  eliteCrown(ctx, p, 0, -30 * sc + 2);
  ctx.restore();
};

// ───────────────────────────── Loup d'ombre ─────────────────────────────

function wolfLeg(ctx: Ctx, c: string, a1: number, a2: number, front: boolean): void {
  // cuisse épinglée au corps, jarret épinglé au genou
  ctx.rotate(a1);
  poly(ctx, front ? [-2.2, -1, 2.2, -1, 1.4, 5.6, -1.2, 5.6] : [-3.2, -2, 2.6, -1.4, 1.2, 5.6, -1.6, 5.6], c);
  pin(ctx, 0, 5.2, a2);
  poly(ctx, [-1.2, 0, 1.2, 0, 1, 4.6, 2.8, 5.4, 2.6, 6.4, -1.4, 6.2], c);
  unpin(ctx, 0.8);
}

const WOLF_RIBS = [-3, -4.4, -4.6, 1.4, 0, -5, -1.4, 1.6, 3, -5, 1.8, 1.4];
const WOLF_TAIL = [-5, 0, 4.6, 0.1, 0.9, -10, -0.4, 3.4, -0.2, 0.7];

export const drawWolf: Painter = (ctx, p) => {
  const r = begin(p);
  const t = r.t;
  const gal = r.move ? t * 12 + r.ph : r.charge ? t * 24 + r.ph : 0;
  const run = r.move || r.charge;
  const crouch = r.wE;
  const lunge = r.rel;
  eliteAura(ctx, p, 16);
  shadow(ctx, r, 18, 5, 10);
  ctx.save();
  root(ctx, r, 10, -22);
  if (r.charge) ctx.scale(1.12, 0.94);
  const bodyY = crouch * 3.2 - (run ? Math.abs(Math.sin(gal)) * 1.6 : Math.sin(t * 2 + r.ph) * 0.4);
  const tilt = crouch * 0.1 - lunge * 0.12 + (r.charge ? 0.04 : 0);
  ctx.translate(lunge * 3, bodyY);
  ctx.rotate(tilt);
  const ink = r.ink, ink2 = r.ink2;
  const legs: [number, number, number, boolean][] = [
    [7.5, 0, 0, true],
    [-9, 0, Math.PI, false],
  ];
  // pattes du fond (encre claire)
  for (const [x, y, o, front] of legs) {
    const ph = gal + o + 0.6;
    let a1 = run ? Math.sin(ph) * 0.65 : front ? 0.05 : -0.05;
    let a2 = run ? (front ? Math.max(0, -Math.cos(ph)) * 1.1 : -Math.max(0, Math.cos(ph)) * 0.9) : 0;
    if (crouch > 0) {
      a1 = lerp(a1, front ? -0.5 : 0.75, crouch);
      a2 = lerp(a2, front ? 0.6 : -1, crouch);
    }
    if (lunge > 0) {
      a1 = lerp(a1, front ? -1 : 0.9, lunge);
      a2 = lerp(a2, 0.2, lunge);
    }
    pin(ctx, x - 1.6, y, a1);
    wolfLeg(ctx, ink2, 0, a2, front);
    unpin(ctx, 0.9);
  }
  // queue en deux pièces, en retard sur le corps
  const tailA = r.charge ? 0.05 : crouch > 0 ? lerp(0.4, 0.75, crouch) : 0.35 + Math.sin(t * 6 + r.ph) * 0.14 + (run ? Math.sin(gal) * 0.12 : 0);
  pin(ctx, -13, -5, tailA);
  poly(ctx, [0, -2.4, -9, -2.6, -9.6, 1.4, 0, 2.6], ink);
  pin(ctx, -9, -0.6, Math.sin(t * 6 + r.ph - 0.9) * 0.3 + (r.charge ? 0 : 0.2));
  poly(ctx, [0, -2.6, -6, -2.6, -11, 0.2, -5, 2.4, 0, 2], ink);
  almonds(ctx, WOLF_TAIL);
  unpin(ctx, 0.9);
  unpin(ctx, 1);
  // corps
  ctx.beginPath();
  ctx.moveTo(12.5, -5);
  ctx.quadraticCurveTo(9, -10.4, 2, -8.4);
  ctx.quadraticCurveTo(-8, -8.8, -13.6, -6.4);
  ctx.quadraticCurveTo(-15.6, -2, -12, 1.6);
  ctx.quadraticCurveTo(-3, 0.6, 3, 2.4);
  ctx.quadraticCurveTo(10, 3.6, 12.5, -5);
  ctx.fillStyle = ink;
  ctx.fill();
  slits(ctx, WOLF_RIBS, 1);
  holes(ctx, [-9, -4, 0.8, -11, -1.6, 0.6, 7, -3.6, 0.7]);
  // poils hérissés : se dressent à l'anticipation et pendant la charge
  const hk = 0.35 + crouch * 1.1 + (r.charge ? 0.5 : 0);
  ctx.beginPath();
  ctx.moveTo(-6, -8.4);
  for (let i = 0; i < 6; i++) {
    const x = -6 + i * 2.6;
    ctx.lineTo(x + 0.4, -8.6 - hk * (3 + (i % 2) * 1.6) - (i === 2 || i === 3 ? hk : 0));
    ctx.lineTo(x + 2.6, -8.6 + (i === 5 ? 1 : 0));
  }
  ctx.closePath();
  ctx.fillStyle = ink;
  ctx.fill();
  // pattes du devant (encre)
  for (const [x, y, o, front] of legs) {
    const ph = gal + o;
    let a1 = run ? Math.sin(ph) * 0.65 : front ? -0.05 : 0.05;
    let a2 = run ? (front ? Math.max(0, -Math.cos(ph)) * 1.1 : -Math.max(0, Math.cos(ph)) * 0.9) : 0;
    if (crouch > 0) {
      a1 = lerp(a1, front ? -0.6 : 0.85, crouch);
      a2 = lerp(a2, front ? 0.7 : -1.1, crouch);
    }
    if (lunge > 0) {
      a1 = lerp(a1, front ? -1.1 : 1, lunge);
      a2 = lerp(a2, 0.15, lunge);
    }
    pin(ctx, x, y, a1);
    wolfLeg(ctx, ink, 0, a2, front);
    unpin(ctx, 1);
  }
  // tête : museau, oreille épinglée, mâchoire qui s'ouvre
  const headA = crouch * 0.28 - lunge * 0.2 + (run ? Math.sin(gal + 0.8) * 0.05 : Math.sin(t * 1.5 + r.ph) * 0.04);
  pin(ctx, 9.5, -6, headA);
  const earA = r.charge ? -0.9 : crouch > 0 ? -0.6 * crouch : Math.sin(t * 4 + r.ph) * 0.1 + (r.move ? -0.3 : 0);
  pin(ctx, 1, -4.4, earA);
  poly(ctx, [-2.4, 0.6, 0.4, -7.4, 2.6, 0.4], ink);
  slits(ctx, [0.2, -1, 0.5, -4.6], 0.8);
  unpin(ctx, 0.8);
  const jawA = crouch * 0.28 + lunge * 0.55 + (r.charge ? 0.3 : 0) + (r.st === 'recover' ? 0.18 + Math.sin(t * 9) * 0.06 : 0);
  pin(ctx, 3, 1, jawA);
  poly(ctx, [-1, -0.8, 9.5, 0, 9, 1.8, -0.5, 2.2], ink);
  if (jawA > 0.1) slits(ctx, [3, -0.2, 3.6, -1.4, 5.6, -0.1, 6.2, -1.3], 0.8);
  if (r.st === 'recover') poly(ctx, [2, 1, 6, 1.4, 4.6, 4.4], ink2);
  unpin(ctx, 0.8);
  ctx.beginPath();
  ctx.moveTo(-1.4, -3.4);
  ctx.quadraticCurveTo(4, -6.4, 13, -2.2);
  ctx.lineTo(14, -0.4);
  ctx.lineTo(13, 0.6);
  ctx.quadraticCurveTo(6, 0.6, 3, 2.2);
  ctx.quadraticCurveTo(-2, 2.6, -1.4, -3.4);
  ctx.fillStyle = ink;
  ctx.fill();
  if (jawA > 0.1) poly(ctx, [6, 0.6, 7.2, 2.4, 8.2, 0.6, 9.6, 2.2, 10.4, 0.5], CUT);
  almonds(ctx, [6.2, -2.6, 3.4, -0.25, 1.1 + crouch * 0.4], threat(r));
  dot(ctx, 6.8, -2.7, 0.55, INK);
  slits(ctx, [1.8, -1, 3.6, 0.4], 0.7);
  tellRing(ctx, r, 6.4, -2.6, 5, false);
  eliteCrown(ctx, p, 2, -9, -0.15);
  unpin(ctx);
  ctx.restore();
};

// ───────────────────────────── Archer squelette ─────────────────────────────

function skLeg(ctx: Ctx, c: string, a2: number): void {
  bone(ctx, 0, 0, 0, 4.6, 2.2, c);
  pin(ctx, 0, 4.8, a2);
  bone(ctx, 0, 0, 0, 3.8, 2, c);
  poly(ctx, [-1.2, 3.6, 3.4, 3.8, 3.2, 5, -1.2, 5], c);
  unpin(ctx, 0.75);
}

const SK_RIBS = [-3.2, -7.6, 3.2, -7.6, -3.4, -5.4, 3.4, -5.4, -3, -3.2, 3, -3.2];

export const drawSkeleton: Painter = (ctx, p) => {
  const r = begin(p);
  const t = r.t;
  const walk = r.move ? t * 9 + r.ph : 0;
  const ws = Math.sin(walk);
  const rattle = r.st === 'windup' ? Math.sin(t * 40) * 0.5 * r.w : 0;
  eliteAura(ctx, p, 14);
  shadow(ctx, r, 11, 4, 12);
  ctx.save();
  root(ctx, r, 12, -24);
  const bob = r.move ? Math.abs(Math.cos(walk)) * 1.6 : 0;
  ctx.translate(rattle, -bob);
  const ink = r.ink, ink2 = r.ink2;
  // jambes raides
  pin(ctx, -0.8, 2.4, r.move ? -ws * 0.5 : 0.12 + r.wE * 0.2);
  skLeg(ctx, ink2, r.move ? Math.max(0, ws) * 0.5 : 0.05);
  unpin(ctx, 0.8);
  pin(ctx, 0.8, 2.4, r.move ? ws * 0.5 : -0.16 - r.wE * 0.25);
  skLeg(ctx, ink, r.move ? Math.max(0, -ws) * 0.5 : 0.1);
  unpin(ctx, 0.8);
  // bassin, colonne et cage thoracique ajourée
  const lean = -r.wE * 0.12 + r.rel * 0.08 + (r.move ? 0.06 : 0);
  pin(ctx, 0, 2.6, lean);
  poly(ctx, [-3.6, -1, 3.6, -1, 2.6, 1.8, -2.6, 1.8], ink);
  // haillon de cape épinglé aux épaules (flotte derrière)
  pin(ctx, -2, -9.4, 0.25 + (r.move ? 0.35 : 0) + Math.sin(t * 5 + r.ph - 1) * 0.1);
  ctx.beginPath();
  ctx.moveTo(1, 0);
  ctx.lineTo(-3.4, 10);
  ctx.lineTo(-1.4, 8.6);
  ctx.lineTo(-0.6, 11.4);
  ctx.lineTo(1, 9);
  ctx.lineTo(2.6, 10.8);
  ctx.lineTo(3, 0);
  ctx.closePath();
  ctx.fillStyle = ink2;
  ctx.fill();
  holes(ctx, [0.4, 4, 0.6, -0.8, 7, 0.6]);
  unpin(ctx, 0);
  limb(ctx, 0, 0, 0, -8, 2, ink);
  ctx.beginPath();
  ctx.ellipse(0.2, -5.6, 4.6, 4.4, 0, 0, TAU);
  ctx.fillStyle = ink;
  ctx.fill();
  slits(ctx, SK_RIBS, 0.9);
  limb(ctx, 0.2, -9.6, 0.2, -2.2, 1.3, ink);
  // crâne et mâchoire qui claque
  pin(ctx, 0.4, -10, Math.sin(t * 2 + r.ph) * 0.05 - r.wE * 0.08);
  dot(ctx, 1, -4.6, 4.8, ink);
  poly(ctx, [-2.6, -3, 5.6, -2.6, 5.2, -0.6, -2, -0.8], ink);
  const eye = threat(r);
  dot(ctx, 2.8, -5, 1.7, eye);
  dot(ctx, -0.6, -5, 1.4, eye);
  poly(ctx, [4.4, -3.6, 5.6, -1.6, 4.2, -1.6], CUT);
  const chatter = r.st === 'windup' ? Math.abs(Math.sin(t * 24)) * 0.3 * r.w : 0;
  pin(ctx, -1.6, -0.8, chatter + r.rel * 0.25);
  poly(ctx, [-0.6, -0.4, 6, 0, 5.2, 2.6, -0.4, 2], ink);
  slits(ctx, [1.4, 0.3, 1.4, 1.6, 3, 0.4, 3, 1.7, 4.6, 0.5, 4.6, 1.7], 0.6);
  unpin(ctx, 0.75);
  eliteCrown(ctx, p, 0.6, -10.4, -0.08);
  unpin(ctx, 0.9);
  // arc et bras : trois flèches encochées une à une
  const aiming = r.st === 'windup' || r.rel > 0;
  let armA = aiming ? Math.max(-1.2, Math.min(1.2, r.aim)) : r.move ? 0.95 + ws * 0.15 : 0.85;
  armA -= r.rel * 0.2;
  const draw = r.st === 'windup' ? 6 * r.wE : r.rel > 0 ? -2.4 * r.rel : 0;
  const ca = Math.cos(armA), sa = Math.sin(armA);
  if (aiming) {
    // bras arrière qui tend la corde
    const reach = 7.4 - 2.4 - draw;
    const nx = 1 + ca * reach, ny = -7.8 + sa * reach;
    ctx.beginPath();
    ctx.moveTo(-1.4, -8);
    ctx.lineTo(-1.4 - ca * 3 + sa * 2, -8 - sa * 3 - ca * 2 + 2);
    ctx.lineTo(nx, ny);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = ink2;
    ctx.stroke();
  }
  pin(ctx, 1, -7.8, armA);
  bone(ctx, 0, 0, 7, 0, 2.2, ink);
  pin(ctx, 7.4, 0, 0);
  const vib = r.rel > 0 ? Math.sin(r.rel * 36) * r.rel * 1.4 : 0;
  ctx.beginPath();
  ctx.moveTo(-2.4, -11.5);
  ctx.quadraticCurveTo(5 + vib, 0, -2.4, 11.5);
  ctx.lineWidth = 2.4;
  ctx.strokeStyle = ink;
  ctx.stroke();
  dot(ctx, -2.4, -11.6, 1.3, ink);
  dot(ctx, -2.4, 11.6, 1.3, ink);
  const nx = -2.4 - draw;
  ctx.beginPath();
  ctx.moveTo(-2.4, -11.5);
  ctx.lineTo(nx, 0);
  ctx.lineTo(-2.4, 11.5);
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = ink;
  ctx.stroke();
  if (r.st === 'windup') {
    const shown = r.w > 0.65 ? 3 : r.w > 0.4 ? 2 : r.w > 0.12 ? 1 : 0;
    const fan = [0, -0.26, 0.26];
    for (let i = 0; i < shown; i++) {
      ctx.save();
      ctx.translate(nx, 0);
      ctx.rotate(fan[i] * r.wE);
      limb(ctx, 0, 0, 12.5, 0, 1.3, ink);
      poly(ctx, [11.6, -2, 16, 0, 11.6, 2], DANGER, INK, 0.8);
      poly(ctx, [0, 0, -2.2, -1.8, 1.4, 0, -2.2, 1.8], ink);
      ctx.restore();
    }
    tellRing(ctx, r, nx + 14, 0, 4, false);
  }
  unpin(ctx, 0);
  unpin(ctx, 0.9);
  unpin(ctx, 1);
  ctx.restore();
};

// ───────────────────────────── Totem runique ─────────────────────────────

const TOTEM_RUNES: number[][] = [
  [-6, -1, -2, 2, -2, 2, 2, -1, 2, -1, 6, 2],
  [-5, 0, 5, 0, 0, -3, 0, 3],
  [-3.6, 2, 0, -2.4, 0, -2.4, 3.6, 2],
];

export const drawTotem: Painter = (ctx, p) => {
  const r = begin(p);
  const t = r.t, w = r.w;
  const ink = r.ink, ink2 = r.ink2;
  eliteAura(ctx, p, 18);
  shadow(ctx, r, 15, 5, 14);
  ctx.save();
  root(ctx, r, 14, -32);
  // anneau de runes en orbite : elles s'allument une à une pendant l'anticipation
  ctx.save();
  const spin = t * (0.6 + w * 3);
  for (let i = 0; i < 6; i++) {
    const a = spin + (i * Math.PI) / 3;
    const x = Math.cos(a) * 19, y = Math.sin(a) * 19 * 0.42 + 9;
    const lit = w > 0.05 && w >= i / 6;
    // pierres runiques posées au sol, qui tournent autour du totem
    poly(ctx, [x, y - 3.2, x + 2.2, y, x, y + 2.4, x - 2.2, y], lit ? DANGER : ink2);
    slits(ctx, [x, y - 1.4, x, y + 0.8], 0.7, lit ? INK : CUT);
  }
  ctx.restore();
  // trois blocs épinglés les uns sur les autres ; l'empilement oscille avec retard
  const jolt = r.rel;
  const shake = w > 0 ? Math.sin(t * 34) * 0.03 * w : 0;
  pin(ctx, 0, 13, Math.sin(t * 2.2 + r.ph) * 0.02 + shake);
  ctx.translate(0, -jolt * 1.5);
  // bloc du bas : grande bouche dentelée
  ctx.beginPath();
  ctx.roundRect(-14, -12, 28, 12, 2.5);
  ctx.fillStyle = ink;
  ctx.fill();
  poly(ctx, [-8, -6.6, 8, -6.6, 6.4, -3.2, 4, -5, 2, -3, 0, -5, -2, -3, -4, -5, -6.4, -3.2], CUT);
  holes(ctx, [-11.4, -9.6, 0.7, -11.4, -2.4, 0.7, 11.4, -9.6, 0.7, 11.4, -2.4, 0.7]);
  slits(ctx, TOTEM_RUNES[0].map((v, i) => (i % 2 ? v - 9.4 : v * 0.7)), 1.1, w > 0.05 && w > 0.12 ? DANGER : CUT);
  pin(ctx, 0, -12, Math.sin(t * 2.2 + r.ph - 0.7) * 0.035 - shake);
  ctx.translate(0, -jolt * 2);
  // ailes latérales du bloc du milieu
  for (const s of [-1, 1]) {
    pin(ctx, s * 11.6, -7, s * (-0.2 + Math.sin(t * 2.6 + r.ph) * 0.12 - w * 0.5 - jolt * 0.4));
    poly(ctx, [0, -2.6, s * 9, -6, s * 7.4, -2, s * 9.4, 0.4, s * 6, 1.4, 0, 2.6], ink);
    slits(ctx, [s * 2, -0.6, s * 6.4, -2.6], 0.8);
    unpin(ctx, 0.9);
  }
  ctx.beginPath();
  ctx.roundRect(-12.5, -12, 25, 12, 2.5);
  ctx.fillStyle = ink;
  ctx.fill();
  // masque : yeux en fente qui suivent la cible
  const lk = Math.cos(p.facing) * 1.2;
  const eyeC = w > 0.38 ? DANGER : CUT;
  almonds(ctx, [-5 + lk, -6.4, 5, 0.12, 1.5, 5 + lk, -6.4, 5, -0.12, 1.5], eyeC);
  slits(ctx, TOTEM_RUNES[1].map((v, i) => (i % 2 ? v * 0.5 - 2.2 : v * 0.5)), 1, eyeC);
  holes(ctx, [-10, -10, 0.6, 10, -10, 0.6, -10, -2, 0.6, 10, -2, 0.6]);
  pin(ctx, 0, -12, Math.sin(t * 2.2 + r.ph - 1.4) * 0.05 + shake);
  ctx.translate(0, -jolt * 2.5);
  // bloc du haut : tête à crête de plumes
  for (let i = -1; i <= 1; i++) {
    pin(ctx, i * 4.4, -10.6, i * 0.35 + Math.sin(t * 3 + i + r.ph) * 0.08 + w * i * 0.2);
    poly(ctx, [-1.8, 0, 0, -7 - (i === 0 ? 2 : 0), 1.8, 0], ink);
    slits(ctx, [0, -1.4, 0, -4.4], 0.7);
    unpin(ctx, 0.8);
  }
  ctx.beginPath();
  ctx.roundRect(-10.5, -11, 21, 11, 3);
  ctx.fillStyle = ink;
  ctx.fill();
  const topC = w > 0.66 ? DANGER : CUT;
  dot(ctx, -4.2 + lk, -6, 1.7, topC);
  dot(ctx, 4.2 + lk, -6, 1.7, topC);
  slits(ctx, TOTEM_RUNES[2].map((v, i) => (i % 2 ? v * 0.6 - 3 : v * 0.8)), 1, topC);
  eliteCrown(ctx, p, 0, -18);
  unpin(ctx, 1.2);
  unpin(ctx, 1.2);
  unpin(ctx, 1.2);
  tellRing(ctx, r, 0, -8, 8, false);
  ctx.restore();
};

// ───────────────────────────── Mage de braise ─────────────────────────────

export const drawMage: Painter = (ctx, p) => {
  const r = begin(p);
  const t = r.t, w = r.w;
  const ink = r.ink, ink2 = r.ink2;
  const float = Math.sin(t * 2.5 + r.ph) * 1.5;
  eliteAura(ctx, p, 15);
  shadow(ctx, r, 11, 4, 12);
  ctx.save();
  root(ctx, r, 12, -26);
  ctx.translate(0, float);
  const lean = -r.wE * 0.1 + r.rel * 0.14 + (r.move ? 0.08 : 0);
  ctx.translate(0, 8);
  ctx.rotate(lean);
  ctx.translate(0, -8);
  // bras arrière levé : main ouverte qui incante
  pin(ctx, -2.6, -6, lerp(1.9, -2.2, r.wE) + Math.sin(t * 2 + r.ph) * 0.08);
  bone(ctx, 0, 0, 6, 0, 2.2, ink2);
  poly(ctx, [6, -1.2, 9, -2.6, 8, 0, 9.4, 1.6, 6, 1.2], ink2);
  unpin(ctx, 0.8);
  // ourlet de la robe : pièce épinglée qui flotte en retard
  const hemA = Math.sin(t * 3 + r.ph - 1) * 0.07 + (r.move ? 0.12 : 0);
  pin(ctx, 0, 6, hemA);
  ctx.beginPath();
  ctx.moveTo(-9.6, -1);
  ctx.lineTo(9.6, -1);
  ctx.lineTo(11.4, 5);
  for (let i = 0; i < 6; i++) {
    const x = 11.4 - (i + 1) * 3.8;
    ctx.quadraticCurveTo(x + 1.9, 2.4, x, 5);
  }
  ctx.closePath();
  ctx.fillStyle = ink;
  ctx.fill();
  holes(ctx, [-7.6, 2, 0.8, -3.8, 2, 0.8, 0, 2, 0.8, 3.8, 2, 0.8, 7.6, 2, 0.8]);
  unpin(ctx, 1);
  // robe
  ctx.beginPath();
  ctx.moveTo(-4.6, -8.6);
  ctx.quadraticCurveTo(-9, 0, -10, 6.4);
  ctx.lineTo(10, 6.4);
  ctx.quadraticCurveTo(9, 0, 4.6, -8.6);
  ctx.closePath();
  ctx.fillStyle = ink;
  ctx.fill();
  // losanges ajourés sur le devant
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const y = -3 + i * 3.4;
    ctx.moveTo(2, y - 1.4);
    ctx.lineTo(3.1, y);
    ctx.lineTo(2, y + 1.4);
    ctx.lineTo(0.9, y);
    ctx.closePath();
  }
  ctx.fillStyle = CUT;
  ctx.fill();
  // capuche à pointe épinglée
  pin(ctx, 0, -8.4, Math.sin(t * 1.8 + r.ph) * 0.05 - r.wE * 0.12 + r.rel * 0.1);
  pin(ctx, -3.2, -9.6, 0.5 + Math.sin(t * 3 + r.ph - 1.2) * 0.15 + (r.move ? 0.4 : 0));
  poly(ctx, [0.6, -1.6, -8, 1.4, -9, 3.4, 0.8, 1.6], ink);
  unpin(ctx, 0.8);
  ctx.beginPath();
  ctx.moveTo(-6.4, 1);
  ctx.quadraticCurveTo(-7.6, -9.6, 0.6, -12);
  ctx.quadraticCurveTo(7.4, -8.6, 6.4, 1);
  ctx.quadraticCurveTo(0, 2.6, -6.4, 1);
  ctx.fillStyle = ink;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(1.8, -3.8, 3.6, 3.8, 0, 0, TAU);
  ctx.fillStyle = ink2;
  ctx.fill();
  const eye = threat(r);
  dot(ctx, 0.6, -4.2, 1.1 + r.wE * 0.3, eye);
  dot(ctx, 3.6, -4.2, 1.1 + r.wE * 0.3, eye);
  eliteCrown(ctx, p, 0, -13);
  unpin(ctx, 0.9);
  // bras au bâton : le bâton se lève, la flamme découpée gonfle et vire au vermillon
  const armA = lerp(1.1, -0.35, r.wE) + r.rel * 0.7 + Math.sin(t * 2.5 + r.ph) * 0.05;
  pin(ctx, 3, -6, armA);
  bone(ctx, 0, 0, 6.2, 0, 2.3, ink);
  pin(ctx, 6.6, 0, -armA);
  limb(ctx, 0, 11, 0, -14, 2.4, ink);
  // griffe porte-flamme
  poly(ctx, [-3.4, -14, -2.6, -18.4, -1.2, -15, 0, -19, 1.2, -15, 2.6, -18.4, 3.4, -14, 0, -12.6], ink);
  const fl = 3.6 + Math.sin(t * 18) * 0.7 + w * 6 - r.rel * 1.6;
  const fy = -17;
  if (w > 0.05) tellRing(ctx, r, 0, fy - fl * 0.6, 4 + w * 2, false);
  ctx.beginPath();
  ctx.moveTo(-fl * 0.62, fy);
  ctx.quadraticCurveTo(-fl * 0.5, fy - fl * 1.2, Math.sin(t * 9) * fl * 0.3, fy - fl * 2.2);
  ctx.quadraticCurveTo(fl * 0.5, fy - fl * 1.2, fl * 0.62, fy);
  ctx.quadraticCurveTo(0, fy + fl * 0.5, -fl * 0.62, fy);
  ctx.fillStyle = w > 0.05 ? DANGER : CUT;
  ctx.fill();
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = ink;
  ctx.stroke();
  dot(ctx, 0, fy - fl * 0.5, fl * 0.25, w > 0.05 ? CUT : INK2);
  unpin(ctx, 0);
  dot(ctx, 6.6, 0, 1.8, ink);
  unpin(ctx, 0.9);
  ctx.restore();
};

// ───────────────────────────── Mite de papier (nouveau) ─────────────────────────────

const MOTH_FORE_HOLES = [9.6, -5.4, 2.4, 14.2, -6.6, 0.8, 12.6, -2, 0.8, 9, 0.4, 0.8];
const MOTH_FORE_VEINS = [1.4, -0.6, 7, -4.4, 1.6, 0.6, 7.6, -0.6, 1.4, 1.4, 5.2, 2.6];
const MOTH_HIND_HOLES = [6.6, 5, 1.6, 9.4, 3.4, 0.7, 4.4, 8, 0.7];

function mothFore(ctx: Ctx, c: string): void {
  ctx.beginPath();
  ctx.moveTo(0, -1.4);
  ctx.quadraticCurveTo(6, -9, 14, -10);
  ctx.quadraticCurveTo(17.6, -7.6, 16.4, -3.6);
  ctx.quadraticCurveTo(15.4, -1, 13.6, 0.4);
  ctx.quadraticCurveTo(12.6, 2.6, 10, 2.8);
  ctx.quadraticCurveTo(5, 3.4, 0, 1.6);
  ctx.closePath();
  ctx.fillStyle = c;
  ctx.fill();
  holes(ctx, MOTH_FORE_HOLES);
  dot(ctx, 9.6, -5.4, 1.1, c);
  slits(ctx, MOTH_FORE_VEINS, 0.6);
}
function mothHind(ctx: Ctx, c: string): void {
  ctx.beginPath();
  ctx.moveTo(0, -0.6);
  ctx.quadraticCurveTo(8, -1, 11.4, 3.4);
  ctx.quadraticCurveTo(11.4, 8, 7.6, 10);
  ctx.quadraticCurveTo(5.4, 8.4, 3.4, 10.4);
  ctx.quadraticCurveTo(0.6, 6, 0, 1.2);
  ctx.closePath();
  ctx.fillStyle = c;
  ctx.fill();
  holes(ctx, MOTH_HIND_HOLES);
}
function antenna(ctx: Ctx, c: string): void {
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(1.6, -5, 5, -8.6);
  ctx.lineWidth = 1;
  ctx.strokeStyle = c;
  ctx.lineCap = 'round';
  ctx.stroke();
  // peigne plumeux
  ctx.beginPath();
  for (let i = 1; i <= 4; i++) {
    const k = i / 5;
    const x = 1.6 * 2 * k * (1 - k) + 5 * k * k, y = -5 * 2 * k * (1 - k) - 8.6 * k * k;
    ctx.moveTo(x, y);
    ctx.lineTo(x + 2, y + 0.6);
    ctx.moveTo(x, y);
    ctx.lineTo(x - 1.2, y - 1.6);
  }
  ctx.lineWidth = 0.7;
  ctx.stroke();
}

export const drawMoth: Painter = (ctx, p) => {
  const r = begin(p);
  const t = r.t, w = r.w;
  const ink = r.ink, ink2 = r.ink2;
  eliteAura(ctx, p, 12);
  shadow(ctx, r, 9, 3.4, 19, 0.2);
  ctx.save();
  root(ctx, r, 0, -16, false);
  // vol erratique de papillon de nuit
  const flit = r.move || r.charge ? 1 : 0.5;
  ctx.translate(Math.sin(t * 3.1 + r.ph) * 1.6 * flit, Math.sin(t * 4.7 + r.ph) * 2 - 3);
  // la mite s'oriente vers ce qu'elle regarde (vue de dessus)
  ctx.rotate(Math.cos(p.facing) * 0.3 + (r.charge ? Math.cos(p.facing) * 0.25 : 0));
  const fp = t * (r.charge ? 30 : 21) + r.ph;
  const flap = Math.sin(fp) + 0.3 * Math.sin(t * 37 + r.ph);
  const flap2 = Math.sin(fp - 0.7);
  const munch = w > 0 ? 0.55 + 0.45 * Math.sin(t * 15) : r.rel;
  const wingOpen = w > 0 ? lerp(1, 0.75, r.wE) : 1;
  // abdomen segmenté en trois pièces, qui ondule en retard
  pin(ctx, 0, 2, Math.sin(t * 5 + r.ph) * 0.12);
  ctx.beginPath();
  ctx.ellipse(0, 3, 2.8, 3.4, 0, 0, TAU);
  ctx.fillStyle = ink;
  ctx.fill();
  pin(ctx, 0, 5.8, Math.sin(t * 5 + r.ph - 0.8) * 0.18);
  ctx.beginPath();
  ctx.ellipse(0, 2.8, 2.2, 3.2, 0, 0, TAU);
  ctx.fill();
  slits(ctx, [-1.4, 1.2, 1.4, 1.2, -1.2, 3.2, 1.2, 3.2], 0.6);
  pin(ctx, 0, 5.4, Math.sin(t * 5 + r.ph - 1.6) * 0.22);
  poly(ctx, [-1.6, 0, 1.6, 0, 0, 4.4], ink);
  unpin(ctx, 0.6);
  unpin(ctx, 0.7);
  unpin(ctx, 0.8);
  // ailes : postérieures puis antérieures, battement en raccourci + rotation sur l'épingle
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.scale(s, 1);
    pin(ctx, 2, 1, 0.1 + flap2 * 0.18);
    ctx.scale(wingOpen * (0.55 + 0.45 * Math.abs(Math.cos(fp * 0.5 - 0.35))), 1);
    mothHind(ctx, ink2);
    unpin(ctx, 0.8);
    pin(ctx, 2.4, -1.6, -0.08 + flap * 0.16 - r.wE * 0.3);
    ctx.scale(wingOpen * (0.5 + 0.5 * Math.abs(Math.cos(fp * 0.5))), 1);
    mothFore(ctx, ink);
    unpin(ctx, 1);
    ctx.restore();
  }
  // thorax velu
  ctx.beginPath();
  ctx.ellipse(0, -0.6, 3.6, 4.4, 0, 0, TAU);
  ctx.fillStyle = ink;
  ctx.fill();
  holes(ctx, [0, -1.6, 0.8, 0, 1, 0.6]);
  // tête, antennes plumeuses, mandibles qui mâchent (le fil !)
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.scale(s, 1);
    pin(ctx, 1, -6.4, -0.1 + Math.sin(t * 4 + r.ph + s) * 0.12 - flap * 0.05 + w * 0.3);
    antenna(ctx, ink);
    unpin(ctx, 0.6);
    pin(ctx, 1, -7.4, munch * 0.5);
    poly(ctx, [-0.6, 0, 1, -0.4, 1.8, -3.2, 0.4, -2.4], w > 0.05 ? DANGER : ink, w > 0.05 ? INK : undefined, 0.6);
    unpin(ctx, 0);
    ctx.restore();
  }
  dot(ctx, 0, -5.6, 2.8, ink);
  const eye = threat(r);
  dot(ctx, -1.5, -6.2, 1, eye);
  dot(ctx, 1.5, -6.2, 1, eye);
  if (w > 0.05) tellRing(ctx, r, 0, -8, 4, false);
  ctx.restore();
  if (p.elite) {
    ctx.save();
    ctx.translate(0, -14);
    eliteCrown(ctx, p, 0, 0);
    ctx.restore();
  }
};

// ───────────────────────────── Crabe-ciseaux (nouveau) ─────────────────────────────

const CRAB_RIM = [-10.4, -3.4, 0.8, -7.4, -6.6, 0.8, 7.4, -6.6, 0.8, 10.4, -3.4, 0.8, -6, 1.6, 0.7, 6, 1.6, 0.7];

/** Lame de ciseaux : tranchant d'acier découpé, anneau de doigt derrière le pivot. */
function blade(ctx: Ctx, c: string, edge: string): void {
  ctx.beginPath();
  ctx.moveTo(-1, -1.6);
  ctx.lineTo(13, -0.2);
  ctx.lineTo(13.6, 0.4);
  ctx.lineTo(-1, 1.2);
  ctx.closePath();
  ctx.fillStyle = c;
  ctx.fill();
  limb(ctx, 1.2, 0.5, 12, 0.3, 0.7, edge);
  ctx.beginPath();
  ctx.arc(-4, -1.2, 2.6, 0, TAU);
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = c;
  ctx.stroke();
}

export const drawSnipper: Painter = (ctx, p) => {
  const r = begin(p);
  const t = r.t, w = r.w;
  const ink = r.ink, ink2 = r.ink2;
  const scut = r.move ? t * 14 + r.ph : r.charge ? t * 30 + r.ph : 0;
  const run = r.move || r.charge;
  eliteAura(ctx, p, 16);
  shadow(ctx, r, 16, 5, 12);
  ctx.save();
  // vu de face : ne se retourne pas, il court de côté
  root(ctx, r, 12, -20, false);
  const side = r.charge ? Math.sin(scut * 0.5) * 2.4 : r.move ? Math.sin(scut * 0.5) * 1.2 : 0;
  ctx.translate(side, -(run ? Math.abs(Math.sin(scut)) * 1.2 : Math.sin(t * 2 + r.ph) * 0.4) + r.wE * 1.6);
  // pattes : trois par côté, deux pièces chacune, trottinement alterné
  for (const s of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const ph = scut + i * 2.1 + (s > 0 ? Math.PI : 0);
      const a1 = s * (0.5 + i * 0.32 + (run ? Math.sin(ph) * 0.3 : Math.sin(t * 2 + i) * 0.03) + r.wE * 0.15);
      pin(ctx, s * 9, 0 + i * 1.6, a1 - (s * Math.PI) / 2);
      limb(ctx, 0, 0, 0, 6.4, 2.2, i === 1 ? ink : ink2);
      pin(ctx, 0, 6.2, s * (-0.9 + (run ? Math.max(0, Math.cos(ph)) * 0.5 : 0)));
      poly(ctx, [-1, 0, 1, 0, 0.2, 6.4], i === 1 ? ink : ink2);
      unpin(ctx, 0.7);
      unpin(ctx, 0.8);
    }
  }
  // pinces-ciseaux : bras épinglé, deux lames sur un pivot rivé
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.scale(s, 1);
    let armA = -0.75 + Math.sin(t * 2.2 + r.ph + s) * 0.06 - r.wE * 0.45;
    if (r.charge) armA = -1.15;
    armA += r.rel * 0.3;
    pin(ctx, 10, -4, armA);
    bone(ctx, 0, 0, 7, 0, 3.4, ink);
    let open = 0.12 + Math.max(0, Math.sin(t * 2.6 + r.ph + s * 1.3)) * 0.35;
    if (r.st === 'windup') open = lerp(open, 1.05, r.wE);
    if (r.charge) open = 0.06;
    if (r.rel > 0) open = -0.08 * r.rel;
    const edge = r.st === 'windup' && w > 0.05 ? DANGER : CUT;
    pin(ctx, 7.4, 0, -0.5);
    pin(ctx, 0, 0, -open * 0.5);
    blade(ctx, ink, edge);
    unpin(ctx, 0);
    pin(ctx, 0, 0, open * 0.5);
    ctx.scale(1, -1);
    blade(ctx, ink, edge);
    unpin(ctx, 0);
    unpin(ctx, 1.4);
    unpin(ctx, 1);
    if (r.st === 'windup') {
      // l'anneau suit la pince ouverte
      const ca = Math.cos(armA), sa = Math.sin(armA);
      const px = 10 + ca * 7.4, py = -4 + sa * 7.4;
      tellRing(ctx, r, px + Math.cos(armA - 0.5) * 8, py + Math.sin(armA - 0.5) * 8, 3.4, false);
    }
    ctx.restore();
  }
  // tiges des yeux, épinglées, en retard
  for (const s of [-1, 1]) {
    pin(ctx, s * 3.6, -7, s * 0.15 + Math.sin(t * 3.4 + r.ph + s) * 0.12 - side * 0.04);
    limb(ctx, 0, 0, 0, -5.4, 1.5, ink);
    dot(ctx, 0, -6.4, 2.2, ink);
    dot(ctx, 0, -6.6, 1.3, threat(r));
    dot(ctx, Math.cos(p.facing) * 0.6, -6.6 + Math.sin(p.facing) * 0.4, 0.55, INK);
    unpin(ctx, 0.7);
  }
  // carapace dentelée
  ctx.beginPath();
  ctx.moveTo(-13, -2);
  ctx.quadraticCurveTo(-13.4, -7.4, -8.6, -8.4);
  ctx.lineTo(-6.6, -7);
  ctx.lineTo(-4.4, -9.4);
  ctx.quadraticCurveTo(0, -10.6, 4.4, -9.4);
  ctx.lineTo(6.6, -7);
  ctx.lineTo(8.6, -8.4);
  ctx.quadraticCurveTo(13.4, -7.4, 13, -2);
  ctx.quadraticCurveTo(11, 4.6, 0, 5.2);
  ctx.quadraticCurveTo(-11, 4.6, -13, -2);
  ctx.fillStyle = ink;
  ctx.fill();
  holes(ctx, CRAB_RIM);
  slits(ctx, [-4.4, -5, -2, -1.4, 4.4, -5, 2, -1.4], 1);
  dot(ctx, 0, -5.4, 1.5, CUT);
  dot(ctx, 0, -5.4, 0.6, INK);
  // bouche qui bulle
  slits(ctx, [-2, 2, 2, 2], 0.9);
  eliteCrown(ctx, p, 0, -12);
  ctx.restore();
};

export { INK };
