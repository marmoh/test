/**
 * Héros jouables : marionnettes de profil articulées (hanches, épaules, cou, coiffe, arme).
 * L'héroïne de base (Ciseaux de lune) porte un arc-aiguille d'argent et une bobine de fil
 * dans le dos ; c'est la seule marionnette teintée (cape de gel jade).
 */
import { UI, JADE } from './palette.js';
import { type Ctx } from './draw.js';
import {
  begin, root, pin, unpin, holes, slits, almonds, poly, limb, dot, shadow, clamp01, smooth, lerp, TAU,
  INK, INK2, CUT, type Painter, type Pose, type Rig,
} from './rig.js';

/** Grandeurs de la pose du héros, partagées par toutes les pièces. */
interface HeroK {
  run: number;
  /** sinus du pas (−1..1) */
  s: number;
  bob: number;
  /** coup de ciseaux 1→0 */
  cut: number;
  /** pose « ciseaux levés » (1 tant que le coup est récent) */
  cutPose: number;
  /** tension de la corde (pt) */
  draw: number;
  armA: number;
  aiming: boolean;
  blinkEye: boolean;
}

interface HeroLook {
  /** derrière tout : bout de fil, rubans… (espace du corps) */
  trail?: (ctx: Ctx, r: Rig, k: HeroK) => void;
  /** cape / dos de robe, épinglée à l'épaule */
  cloak: (ctx: Ctx, r: Rig, k: HeroK) => void;
  /** objet porté dans le dos (bobine) */
  back?: (ctx: Ctx, r: Rig, k: HeroK) => void;
  torso: (ctx: Ctx, r: Rig, k: HeroK) => void;
  /** tête, dans l'espace de l'épingle du cou */
  head: (ctx: Ctx, r: Rig, k: HeroK) => void;
  /** arme, dans l'espace de la main */
  weapon: (ctx: Ctx, r: Rig, k: HeroK) => void;
  /** couleur des jambes */
  leg?: string;
}

const SHOULDER_X = 0.8;
const SHOULDER_Y = -5.6;
const HAND = 8;
const BOW_S = 0.85;

function legPiece(ctx: Ctx, color: string): void {
  poly(ctx, [-1.5, 0, 1.5, 0, 1.3, 6.4, 4.4, 8.1, 4.1, 9.3, -1.7, 9.3, -1.8, 6], color);
}

function heroRig(ctx: Ctx, p: Pose, look: HeroLook): void {
  const r = begin(p);
  const t = r.t;
  const cut = clamp01(p.cutting ?? 0);
  const cutPose = smooth(cut * 2.6);
  const aiming = !!p.aiming && !r.move && cutPose < 0.5;
  const run = r.move ? t * 13 : 0;
  const s = Math.sin(run);
  const bob = r.move ? Math.abs(Math.cos(run)) * 2.2 : Math.sin(t * 2.4) * 0.6;
  const jump = cut > 0 ? Math.sin(cut * Math.PI) * 5 : 0;
  // tension de la corde : tremble un peu à pleine visée, claque vers l'avant à la détente
  const draw = r.rel > 0 ? -r.rel * 2.5 : aiming ? 5 + Math.sin(t * 31) * 0.25 : 0.4;
  let armA = r.move ? 0.7 + s * 0.22 : aiming || r.rel > 0 ? Math.max(-1.35, Math.min(1.35, r.aim)) : 0.42 + Math.sin(t * 2.4) * 0.04;
  armA -= r.rel * 0.18;
  armA = lerp(armA, -1.75, cutPose);
  const k: HeroK = { run, s, bob, cut, cutPose, draw, armA, aiming, blinkEye: Math.sin(t * 1.3 + 1) > 0.985 };

  ctx.save();
  if (p.blink && Math.floor(t * 16) % 2 === 0) ctx.globalAlpha *= 0.45;
  shadow(ctx, r, 12 - jump * 0.6, 4.5, 12);
  root(ctx, r, 12, -26);
  ctx.translate(-r.rel * 1.2, -bob - jump);
  const lean = (r.move ? 0.13 : 0) - r.rel * 0.06 - cutPose * 0.12;
  const legA = r.move ? 0.62 : cutPose > 0 ? 0.4 * cutPose : 0.08;
  const ink = r.ink;
  const legC = look.leg ? r.C(look.leg) : ink;

  // 1. fil, bras arrière, jambe arrière, cape (derrière le corps)
  if (look.trail) look.trail(ctx, r, k);
  pin(ctx, -0.8, 3.5, r.move ? -s * legA : -legA - 0.02);
  legPiece(ctx, r.ink2);
  unpin(ctx);
  pin(ctx, 0, 3.5, lean);
  ctx.translate(0, -3.5);
  if (aiming || r.rel > 0) {
    // bras arrière (coude replié) qui tire la corde jusqu'à l'encoche
    const reach = HAND + (-3 - draw) * BOW_S;
    const ca = Math.cos(armA), sa = Math.sin(armA);
    const nx = SHOULDER_X + ca * reach, ny = SHOULDER_Y + sa * reach;
    const ex = -0.9 - ca * 3.2 + sa * 2.2, ey = -6 - sa * 3.2 - ca * 2.2 + 2;
    ctx.beginPath();
    ctx.moveTo(-0.9, -6);
    ctx.lineTo(ex, ey);
    ctx.lineTo(nx, ny);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = r.ink2;
    ctx.stroke();
    dot(ctx, nx, ny, 1.5, r.ink2);
  }
  pin(ctx, -1.6, -7.2, 0);
  look.cloak(ctx, r, k);
  unpin(ctx);
  if (look.back) look.back(ctx, r, k);
  ctx.translate(0, 3.5);
  unpin(ctx, 0);

  // 2. jambe avant
  pin(ctx, 0.8, 3.5, r.move ? s * legA : legA * 0.6);
  legPiece(ctx, legC);
  unpin(ctx);

  // 3. buste, tête, bras avant
  pin(ctx, 0, 3.5, lean);
  ctx.translate(0, -3.5);
  look.torso(ctx, r, k);
  const headA = (r.move ? 0.06 : 0) + Math.sin(t * 2.4 + 0.5) * 0.03 - cutPose * 0.3 + r.rel * 0.05;
  pin(ctx, 0.6, -7.4, headA);
  look.head(ctx, r, k);
  unpin(ctx);
  pin(ctx, SHOULDER_X, SHOULDER_Y, armA);
  limb(ctx, 0, 0, HAND - 0.4, 0, 2.5, ink);
  // hors visée, l'arme pend presque droite le long du corps
  const holdK = Math.max(aiming || r.rel > 0 ? 1 : 0, cutPose);
  pin(ctx, HAND, 0, lerp(-armA * 0.85 + (r.move ? 0.25 : 0.1), 0, holdK));
  look.weapon(ctx, r, k);
  unpin(ctx, 0);
  dot(ctx, HAND, 0, 1.7, ink);
  unpin(ctx);
  ctx.translate(0, 3.5);
  unpin(ctx);
  ctx.restore();
}

// ───────────────────────────── Ciseaux de lune ─────────────────────────────

/** Arc-aiguille : une longue aiguille d'argent courbée, le fil passe par le chas. */
function needleBow(ctx: Ctx, r: Rig, k: HeroK): void {
  ctx.save();
  ctx.scale(BOW_S, BOW_S);
  needleBowInner(ctx, r, k);
  ctx.restore();
}
function needleBowInner(ctx: Ctx, r: Rig, k: HeroK): void {
  const vib = r.rel > 0 ? Math.sin(r.rel * 40) * r.rel * 1.6 : 0;
  const bend = (k.aiming ? 3.4 : 2.6) + vib;
  const nx = -3 - k.draw;
  // corde = fil
  ctx.beginPath();
  ctx.moveTo(-3, -11.8);
  ctx.lineTo(nx, 0);
  ctx.lineTo(-3, 12.2);
  ctx.lineWidth = 1.7;
  ctx.strokeStyle = r.ink;
  ctx.stroke();
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = CUT;
  ctx.stroke();
  // aiguille : encre puis reflet d'argent découpé
  ctx.beginPath();
  ctx.moveTo(-3, -13);
  ctx.quadraticCurveTo(-3 + bend * 2, 0, -3, 13.5);
  ctx.lineCap = 'round';
  ctx.lineWidth = 3.4;
  ctx.strokeStyle = r.ink;
  ctx.stroke();
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = CUT;
  ctx.stroke();
  // pointe et chas
  poly(ctx, [-4.4, 13, -1.6, 13, -3.3, 18.5], r.ink);
  ctx.beginPath();
  ctx.ellipse(-3, -14, 1.9, 2.8, 0, 0, TAU);
  ctx.fillStyle = r.ink;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(-3, -14.2, 0.7, 1.6, 0, 0, TAU);
  ctx.fillStyle = CUT;
  ctx.fill();
  // aiguillon encoché
  if (k.aiming) {
    limb(ctx, nx, 0, nx + 13, 0, 2, r.ink);
    limb(ctx, nx + 1, 0, nx + 11.5, 0, 0.7, CUT);
    poly(ctx, [nx + 12, -1.6, nx + 16, 0, nx + 12, 1.6], r.ink);
  }
}

/** Ciseaux de lune : deux lames en croissant qui claquent au-dessus de la main. */
function moonScissors(ctx: Ctx, r: Rig, k: HeroK): void {
  if (k.cut <= 0) return;
  const open = 0.75 * smooth((k.cut - 0.72) / 0.28);
  ctx.save();
  ctx.translate(11, 0);
  ctx.globalAlpha *= smooth(k.cut * 4);
  for (const sy of [-1, 1]) {
    ctx.save();
    ctx.scale(1, sy);
    ctx.rotate(-open);
    ctx.beginPath();
    ctx.moveTo(0, -1.3);
    ctx.quadraticCurveTo(8, -4.2, 15, 0.4);
    ctx.quadraticCurveTo(8, -0.6, 0, 1.3);
    ctx.closePath();
    ctx.fillStyle = CUT;
    ctx.fill();
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = r.ink;
    ctx.stroke();
    // anneau de doigt
    ctx.beginPath();
    ctx.arc(-3.6, 2, 2.2, 0, TAU);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
  }
  dot(ctx, 0, 0, 1.6, r.ink);
  dot(ctx, 0, 0, 0.7, CUT);
  // éclats découpés autour du coup de ciseaux
  const u = 1 - k.cut;
  const R0 = 10 + u * 14;
  ctx.beginPath();
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU + 0.3;
    ctx.moveTo(14 + Math.cos(a) * R0, Math.sin(a) * R0);
    ctx.lineTo(14 + Math.cos(a) * (R0 + 4), Math.sin(a) * (R0 + 4));
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = r.ink;
  ctx.stroke();
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = CUT;
  ctx.stroke();
  ctx.restore();
}

const SCOUT_HEM = [-3.4, 11.4, 0.9, -0.6, 12.6, 0.9, 2.1, 12.8, 0.8];
const SCOUT_TUNIC = [-2.4, 2.6, 0.55, 0, 3.1, 0.55, 2.4, 2.6, 0.55];

const scoutLook: HeroLook = {
  trail(ctx, r, k) {
    // bout du fil qui sort de la bobine (le jeu dessine la suite dans le monde)
    const x0 = -8.4, y0 = -1.2;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    if (r.move) {
      const dx = -Math.cos(r.aim), dy = -Math.sin(r.aim);
      const L = 18;
      const wv = Math.sin(r.t * 11) * 2.4;
      ctx.quadraticCurveTo(x0 + dx * L * 0.5 - dy * wv, y0 + dy * L * 0.5 + dx * wv, x0 + dx * L, y0 + dy * L);
    } else {
      const sw = Math.sin(r.t * 2 + 0.4) * 1.2;
      ctx.bezierCurveTo(x0 - 3, y0 + 2, x0 - 1 + sw, y0 + 6, x0 - 3 + sw, y0 + 9);
    }
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.1;
    ctx.strokeStyle = r.ink;
    ctx.stroke();
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = CUT;
    ctx.stroke();
    if (k.cut > 0) moonFlare(ctx, k);
  },
  cloak(ctx, r, k) {
    const fl = r.move ? 3 + Math.sin(r.t * 13 - 1.1) * 1.4 : Math.sin(r.t * 1.8 - 0.7) * 0.6;
    const a = 0.12 + (r.move ? 0.42 : 0) + k.cutPose * 0.55 + Math.sin(r.t * (r.move ? 13 : 1.8) - 1.2) * (r.move ? 0.07 : 0.03);
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(2.2, -1.2);
    ctx.quadraticCurveTo(-3.5, 4, -5.5 - fl, 15);
    // ourlet festonné
    ctx.quadraticCurveTo(-4.5 - fl * 0.6, 13.4, -3 - fl * 0.4, 15.4);
    ctx.quadraticCurveTo(-1.8, 13.8, -0.2, 15.8);
    ctx.quadraticCurveTo(1, 14.2, 2.6, 15.6);
    ctx.quadraticCurveTo(4, 7, 2.2, -1.2);
    ctx.closePath();
    ctx.fillStyle = r.C(JADE);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = r.ink;
    ctx.stroke();
    // pli et dentelle de l'ourlet
    ctx.beginPath();
    ctx.moveTo(0.4, 1);
    ctx.quadraticCurveTo(-1.2, 7, -2.2 - fl * 0.3, 13.5);
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = r.C(UI.heroCloakDark);
    ctx.stroke();
    holes(ctx, SCOUT_HEM);
  },
  back(ctx, r) {
    // bobine de fil dans le dos : elle tourne quand on avance
    pin(ctx, -5.6, -1.6, 0.32);
    ctx.fillStyle = CUT;
    ctx.fillRect(-2.6, -3, 5.2, 6);
    const off = r.move ? (r.t * 14) % 2.4 : 0;
    ctx.beginPath();
    for (let i = -2; i < 3; i++) {
      const y = -3 + i * 2.4 + off;
      ctx.moveTo(-2.6, Math.max(-3, Math.min(3, y)));
      ctx.lineTo(2.6, Math.max(-3, Math.min(3, y + 1.4)));
    }
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = INK2;
    ctx.stroke();
    ctx.fillStyle = r.ink;
    ctx.beginPath();
    ctx.roundRect(-3.8, -4.6, 7.6, 1.9, 0.8);
    ctx.roundRect(-3.8, 2.7, 7.6, 1.9, 0.8);
    ctx.fill();
    unpin(ctx, 0.9);
  },
  torso(ctx, r) {
    const ink = r.ink;
    ctx.beginPath();
    ctx.moveTo(-3, -7.6);
    ctx.quadraticCurveTo(-4.2, -1, -5, 5.2);
    ctx.lineTo(-2.5, 4.3);
    ctx.lineTo(0, 5.6);
    ctx.lineTo(2.5, 4.3);
    ctx.lineTo(5, 5.2);
    ctx.quadraticCurveTo(4, -1, 3.2, -7.6);
    ctx.closePath();
    ctx.fillStyle = ink;
    ctx.fill();
    // jupe de gel jade (elle doit se lire d'un coup d'œil), ourlet en dents
    ctx.beginPath();
    ctx.moveTo(-4.3, 0.2);
    ctx.lineTo(4.1, 0.2);
    ctx.lineTo(5, 5.2);
    ctx.lineTo(2.5, 4.3);
    ctx.lineTo(0, 5.6);
    ctx.lineTo(-2.5, 4.3);
    ctx.lineTo(-5, 5.2);
    ctx.closePath();
    ctx.fillStyle = r.C(JADE);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = ink;
    ctx.stroke();
    // lune découpée sur la poitrine, dentelle de la jupe
    dot(ctx, 0.8, -3.4, 2, CUT);
    dot(ctx, 1.7, -3.9, 1.65, ink);
    holes(ctx, SCOUT_TUNIC);
    // sangle de la bobine
    ctx.beginPath();
    ctx.moveTo(-3, -6.5);
    ctx.lineTo(2.6, 1.5);
    ctx.lineWidth = 0.7;
    ctx.strokeStyle = r.ink2;
    ctx.stroke();
  },
  head(ctx, r, k) {
    const ink = r.ink;
    // capuche : pointe épinglée qui traîne derrière (mouvement secondaire)
    const tipA = 0.35 + (r.move ? 0.55 : 0) + k.cutPose * 0.7 + Math.sin(r.t * (r.move ? 13 : 2) - 1.6) * (r.move ? 0.16 : 0.06);
    pin(ctx, -4.4, -9.4, tipA);
    ctx.beginPath();
    ctx.moveTo(0.8, -1.8);
    ctx.quadraticCurveTo(-5, -2.6, -10, 1.8);
    ctx.quadraticCurveTo(-4, 0.4, 0.8, 2);
    ctx.closePath();
    ctx.fillStyle = r.C(UI.heroCloakDark);
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = ink;
    ctx.stroke();
    dot(ctx, -9.6, 1.8, 1.3, ink);
    unpin(ctx, 0.8);
    // visage de profil
    dot(ctx, 1, -5.3, 4.9, ink);
    poly(ctx, [5.2, -6.4, 7.1, -4.4, 5, -3.6], ink);
    poly(ctx, [3.4, -1.6, 5.2, -2.2, 3.8, -0.6], ink);
    // capuche jade
    ctx.beginPath();
    ctx.arc(0.3, -5.6, 6.6, Math.PI * 0.55, Math.PI * 1.88);
    ctx.lineTo(4.6, -8.2);
    ctx.quadraticCurveTo(-0.6, -8.6, -1.6, -1.6);
    ctx.closePath();
    ctx.fillStyle = r.C(JADE);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = ink;
    ctx.stroke();
    holes(ctx, [-2.6, -10.2, 0.6, -4.6, -7.6, 0.6, -4.8, -4.4, 0.6]);
    // œil découpé
    if (k.blinkEye) slits(ctx, [2.2, -5.3, 4.6, -5.3], 0.9);
    else {
      almonds(ctx, [3.4, -5.4, 3, -0.1, 1.2]);
      dot(ctx, 3.9 - (k.cutPose > 0.5 ? 0.6 : 0), -5.4 - k.cutPose * 0.4, 0.6, ink);
    }
  },
  weapon(ctx, r, k) {
    if (k.cutPose < 0.98) {
      ctx.save();
      if (k.cutPose > 0) ctx.globalAlpha *= 1 - k.cutPose;
      needleBow(ctx, r, k);
      ctx.restore();
    }
    moonScissors(ctx, r, k);
  },
};

/** Lune découpée qui monte derrière l'héroïne au moment du coup de ciseaux. */
function moonFlare(ctx: Ctx, k: HeroK): void {
  const u = 1 - k.cut;
  ctx.save();
  ctx.globalAlpha *= smooth(k.cut * 3);
  const y = -22 - u * 8;
  const R = 6.5 + u * 2;
  // croissant découpé (deux arcs), cerné d'encre
  ctx.beginPath();
  ctx.arc(-1, y, R, -2.2, 2.2, true);
  ctx.arc(1.8, y - 1.2, R * 0.86, 2.0, -2.0);
  ctx.closePath();
  ctx.fillStyle = CUT;
  ctx.fill();
  ctx.lineWidth = 1.1;
  ctx.strokeStyle = INK;
  ctx.stroke();
  ctx.restore();
}

export const drawScout: Painter = (ctx, p) => heroRig(ctx, p, scoutLook);

// ───────────────────────────── Moine du vent ─────────────────────────────

const MONK_ORANGE = '#f0a43a';
const MONK_DARK = '#c47a1a';
const MONK_SKY = '#5fd8ff';
const MONK_BEADS = [-2.6, -5.6, 0.75, -1.2, -4.1, 0.75, 0.3, -2.6, 0.75, 1.8, -1.1, 0.75];

function robeBack(ctx: Ctx, r: Rig, k: HeroK, color: string, len: number): void {
  const fl = r.move ? 2.4 + Math.sin(r.t * 13 - 1.1) * 1.2 : Math.sin(r.t * 1.8 - 0.7) * 0.5;
  ctx.rotate(0.08 + (r.move ? 0.3 : 0) + k.cutPose * 0.4);
  ctx.beginPath();
  ctx.moveTo(2.4, -1);
  ctx.quadraticCurveTo(-3, 5, -5 - fl, len);
  ctx.lineTo(-1.4 - fl * 0.5, len - 2);
  ctx.lineTo(1.4, len + 0.4);
  ctx.quadraticCurveTo(3.4, 7, 2.4, -1);
  ctx.closePath();
  ctx.fillStyle = r.C(color);
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = r.ink;
  ctx.stroke();
}

function robeFront(ctx: Ctx, r: Rig, color: string, trim: string): void {
  ctx.beginPath();
  ctx.moveTo(-3.2, -7.8);
  ctx.quadraticCurveTo(-4.6, 0, -6, 8.4);
  ctx.quadraticCurveTo(0, 9.8, 6, 8.4);
  ctx.quadraticCurveTo(4.4, 0, 3.4, -7.8);
  ctx.closePath();
  ctx.fillStyle = r.C(color);
  ctx.fill();
  ctx.lineWidth = 1.2;
  ctx.strokeStyle = r.ink;
  ctx.stroke();
  // ceinture
  ctx.beginPath();
  ctx.moveTo(-4.4, 0.4);
  ctx.quadraticCurveTo(0, 2, 4.4, 0.4);
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = r.C(trim);
  ctx.stroke();
}

const windMonkLook: HeroLook = {
  trail(ctx, r, k) {
    // rubans du bandeau : deux pièces épinglées qui ondulent avec retard
    const base = Math.PI - (r.move ? 0.25 : 1.0) - k.cutPose * 0.6;
    for (const [dy, ph] of [[-1, 0], [1, 1.3]] as const) {
      pin(ctx, -4, -15.5 + dy, base + Math.sin(r.t * (r.move ? 11 : 3) + ph) * (r.move ? 0.12 : 0.06) + dy * 0.12);
      ctx.beginPath();
      ctx.moveTo(0, -1);
      ctx.quadraticCurveTo(5, Math.sin(r.t * 9 + ph) * 2, 10, 0);
      ctx.lineTo(9, 1.8);
      ctx.quadraticCurveTo(4, 1 + Math.sin(r.t * 9 + ph + 0.6) * 2, 0, 1);
      ctx.closePath();
      ctx.fillStyle = r.C(MONK_SKY);
      ctx.fill();
      ctx.lineWidth = 0.9;
      ctx.strokeStyle = r.ink;
      ctx.stroke();
      pin(ctx, 9.5, 0.8, Math.sin(r.t * 8 + ph - 1) * 0.4);
      poly(ctx, [0, -1, 6, 0.2, 0, 1.4], r.C(MONK_SKY), r.ink, 0.8);
      unpin(ctx, 0.7);
      unpin(ctx, 0);
    }
  },
  cloak(ctx, r, k) {
    robeBack(ctx, r, k, MONK_DARK, 15.5);
  },
  torso(ctx, r) {
    robeFront(ctx, r, MONK_ORANGE, MONK_SKY);
    holes(ctx, [-3.4, 6.2, 0.75, 0, 7, 0.75, 3.4, 6.2, 0.75]);
    holes(ctx, MONK_BEADS, r.ink);
    holes(ctx, MONK_BEADS.map((v, i) => (i % 3 === 2 ? 0.3 : v)), CUT);
  },
  head(ctx, r, k) {
    const ink = r.ink;
    dot(ctx, 0.8, -5.6, 5.2, ink);
    poly(ctx, [5.4, -6.6, 7.2, -4.8, 5.2, -3.8], ink);
    // oreille et crâne rasé (reflet découpé)
    almonds(ctx, [-1.6, -9.2, 3.4, -0.5, 0.8]);
    dot(ctx, -0.6, -5, 1.4, r.ink2);
    // bandeau
    ctx.beginPath();
    ctx.moveTo(-4.4, -8);
    ctx.lineTo(5.6, -8.6);
    ctx.lineWidth = 2;
    ctx.strokeStyle = r.C(MONK_SKY);
    ctx.stroke();
    if (k.blinkEye) slits(ctx, [2.4, -5.4, 4.6, -5.4], 0.9);
    else almonds(ctx, [3.5, -5.4, 2.8, 0, 1]);
  },
  weapon(ctx, r, k) {
    // moulinet de papier : il tourne plus vite en visée, s'emballe à la détente
    limb(ctx, 0, 0, 7, 0, 1.6, r.ink);
    const spin = r.t * (k.aiming ? 14 : 3) + r.rel * 6;
    ctx.save();
    ctx.translate(8, 0);
    ctx.rotate(spin);
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2);
      poly(ctx, [0, 0, 7, -0.6, 2.6, -4.6], i % 2 ? CUT : r.C(MONK_SKY), r.ink, 1);
    }
    ctx.restore();
    dot(ctx, 8, 0, 1.2, r.ink);
    if (k.aiming || r.rel > 0) {
      ctx.beginPath();
      for (let i = 0; i < 2; i++) ctx.arc(14 + i * 5, 0, 5 + i * 3, -1.1 + r.t * 8, 1.1 + r.t * 8);
      ctx.lineWidth = 1.4;
      ctx.strokeStyle = CUT;
      ctx.stroke();
    }
    moonScissors(ctx, r, k);
  },
};

export const drawWindMonk: Painter = (ctx, p) => heroRig(ctx, p, windMonkLook);

// ───────────────────────────── Sorcière de braise ─────────────────────────────

const SORC_ROBE = '#5a3a8a';
const SORC_DARK = '#3a2266';
const SORC_AMBER = '#ffb347';

const emberLook: HeroLook = {
  cloak(ctx, r, k) {
    robeBack(ctx, r, k, SORC_DARK, 16);
  },
  torso(ctx, r) {
    robeFront(ctx, r, SORC_ROBE, SORC_AMBER);
    // étoiles découpées sur la robe
    holes(ctx, [-2.6, 4.4, 0.8, 1.6, 6, 0.7, -0.8, -3.6, 0.6, 2.4, 3, 0.5]);
  },
  head(ctx, r, k) {
    const ink = r.ink;
    dot(ctx, 1, -5.4, 4.8, ink);
    poly(ctx, [5.2, -6.2, 7, -4.6, 5, -3.6], ink);
    // barbiche pointue
    poly(ctx, [1.6, -1.6, 5, -1.4, 3, 2.4], ink);
    if (k.blinkEye) slits(ctx, [2.4, -5.6, 4.4, -5.6], 0.9);
    else almonds(ctx, [3.4, -5.6, 2.8, 0, 1]);
    // chapeau pointu en deux pièces : la pointe ballotte avec retard
    ctx.beginPath();
    ctx.moveTo(-7.6, -7.6);
    ctx.quadraticCurveTo(0, -6, 8, -8.6);
    ctx.lineTo(3.6, -10.6);
    ctx.lineTo(-2.4, -17);
    ctx.lineTo(-3.4, -10.2);
    ctx.closePath();
    ctx.fillStyle = r.C(SORC_DARK);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = ink;
    ctx.stroke();
    holes(ctx, [-0.4, -11.2, 0.9, 1.6, -9.2, 0.6]);
    const tipA = -0.5 - (r.move ? 0.6 : 0) - Math.sin(r.t * (r.move ? 12 : 2.6) - 1) * 0.2;
    pin(ctx, -1.2, -16, tipA);
    poly(ctx, [-1.6, 0.6, 1.6, 0.2, -1, -9], r.C(SORC_DARK), ink, 1.1);
    dot(ctx, -1, -9.2, 1.4, CUT);
    unpin(ctx, 0.8);
  },
  weapon(ctx, r, k) {
    // bâton et lanterne de papier : la flamme grandit en visée
    limb(ctx, 0, 6, 0, -12, 2.2, r.ink);
    ctx.save();
    ctx.translate(0, -14);
    ctx.rotate(-0.35 + Math.sin(r.t * 3) * 0.1 - r.rel * 0.4);
    const fl = 2.2 + Math.sin(r.t * 17) * 0.4 + (k.aiming ? 1.2 : 0) + r.rel * 1.5;
    ctx.beginPath();
    ctx.ellipse(0, -4.6, 4, 5, 0, 0, TAU);
    ctx.fillStyle = r.C(SORC_AMBER);
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = r.ink;
    ctx.stroke();
    slits(ctx, [-2, -8.2, -2, -1, 2, -8.2, 2, -1], 0.8, r.ink);
    ctx.beginPath();
    ctx.moveTo(-fl * 0.5, -3);
    ctx.quadraticCurveTo(0, -4.6 - fl * 1.6, fl * 0.5, -3);
    ctx.quadraticCurveTo(0, -1.6, -fl * 0.5, -3);
    ctx.fillStyle = CUT;
    ctx.fill();
    ctx.fillStyle = r.ink;
    ctx.fillRect(-2.4, -10.6, 4.8, 1.4);
    ctx.fillRect(-2.4, 0, 4.8, 1.4);
    ctx.restore();
    moonScissors(ctx, r, k);
  },
};

export const drawEmberSorcerer: Painter = (ctx, p) => heroRig(ctx, p, emberLook);
