/**
 * Monstres (suite) : six marionnettes d'encre articulées des chapitres 11 à 15.
 * Même vocabulaire que `monsters.ts` (pièces épinglées qui jouent en retard, dentelle découpée,
 * ombre portée franche, anticipation en vermillon, couronne et aura d'or pour les élites).
 *
 *  - Lampion : lanterne de papier plissé qui sautille ; à l'anticipation ses côtes s'écartent
 *    et son cœur vire au vermillon (il va exploser).
 *  - Araignée tisseuse : huit pattes articulées, abdomen percé d'une toile ; elle le relève
 *    vers sa cible et tend un fil vermillon avant de cracher sa boule de toile.
 *  - Scarabée-bouclier : grand bouclier de papier bordé d'or, toujours tourné vers `facing`
 *    (avec son ombre au sol, pour lire de quel côté il protège), charge comme le loup.
 *  - Montreur d'ombres : silhouette maigre en cape, doigts articulés d'où pendent des fils ;
 *    il lève les mains et fait naître une ombre chinoise de chien cernée de vermillon.
 *  - Ombre : ombre chinoise de main en forme de chien, contour qui tremble.
 *  - Spectre de papier : drap flottant au bas déchiqueté ; il se déchire en bandes et s'efface
 *    pour se téléporter, puis se recompose.
 */
import { type Ctx } from './draw.js';
import {
  begin, root, pin, unpin, holes, slits, almonds, poly, limb, bone, dot, shadow, tellRing, threat,
  eliteAura, eliteCrown, smooth, lerp, hash, TAU,
  INK, CUT, DANGER, GOLD_LEAF, type Painter, type Rig,
} from './rig.js';

/**
 * Patte en deux pièces : cuisse épinglée en (ax, ay) jusqu'au genou (kx, ky), tibia effilé
 * épinglé au genou jusqu'au pied (fx, fy). Les positions sont choisies par le peintre (genou haut
 * des araignées, genou bas des scarabées) ; les pièces tournent autour de leurs épingles.
 */
function legKnee(
  ctx: Ctx, ax: number, ay: number, kx: number, ky: number, fx: number, fy: number,
  c: string, w1: number, w2: number, spurs = false,
): void {
  const a1 = Math.atan2(ky - ay, kx - ax), l1 = Math.hypot(kx - ax, ky - ay);
  const a2 = Math.atan2(fy - ky, fx - kx), l2 = Math.hypot(fx - kx, fy - ky);
  pin(ctx, ax, ay, a1);
  bone(ctx, 0, 0, l1, 0, w1, c);
  pin(ctx, l1, 0, a2 - a1);
  poly(ctx, [0, -w2 / 2, l2 - 0.2, -0.35, l2 + 0.5, 0.5, 0, w2 / 2], c);
  if (spurs) poly(ctx, [l2 * 0.3, -w2 * 0.45, l2 * 0.42, -w2 * 0.45 - 1.5, l2 * 0.5, -w2 * 0.4, l2 * 0.62, -w2 * 0.35 - 1.3, l2 * 0.7, -w2 * 0.3], c);
  unpin(ctx, 0.6);
  unpin(ctx, w1 >= 2.2 ? 0.9 : 0.7);
}

/**
 * Flamme (chemin seul, à remplir) : panse ronde de rayon w posée en (x, y), pointe en (x + lean, y - h),
 * avec une petite langue sur le flanc gauche.
 */
function flamePath(ctx: Ctx, x: number, y: number, h: number, w: number, lean: number): void {
  ctx.moveTo(x + lean, y - h);
  ctx.bezierCurveTo(x + lean * 0.4 + w * 0.2, y - h * 0.7, x + w * 1.25, y - h * 0.5, x + w, y - w);
  ctx.arc(x, y - w, w, 0, Math.PI);
  ctx.quadraticCurveTo(x - w * 1.15, y - h * 0.42, x - w * 0.95 - lean * 0.2, y - h * 0.72);
  ctx.quadraticCurveTo(x - w * 0.2, y - h * 0.5, x - w * 0.05, y - h * 0.55);
  ctx.quadraticCurveTo(x + lean * 0.3, y - h * 0.8, x + lean, y - h);
}

// ───────────────────────────── Lampion ─────────────────────────────

function lanternLeg(ctx: Ctx, c: string): void {
  poly(ctx, [-1.1, 0, 1.1, 0, 0.9, 3.3, 3, 3.9, 2.8, 4.7, -1.3, 4.7, -1.3, 3.1], c);
}

export const drawLantern: Painter = (ctx, p) => {
  const r = begin(p);
  const t = r.t, w = r.w;
  const ink = r.ink, ink2 = r.ink2;
  const run = r.move || r.charge;
  // sautille sur ses deux petites jambes, écrasé à chaque réception
  const hopP = t * (r.charge ? 16 : 11) + r.ph;
  const hs = Math.sin(hopP);
  const air = run ? Math.abs(hs) : 0;
  const hop = air * 4.2;
  const vy = run ? Math.cos(hopP) * Math.sign(hs) : 0;
  const land = run ? Math.pow(1 - air, 4) : 0;
  // anticipation : il gonfle et tremble de plus en plus
  const swell = Math.max(r.wE, r.rel * 1.15);
  const shake = w > 0 ? Math.sin(t * 73 + r.ph) * (0.2 + w * 1.1) : 0;
  eliteAura(ctx, p, 13);
  shadow(ctx, r, 10 - hop * 0.5 + swell * 2.5, 3.8, 12);
  ctx.save();
  root(ctx, r, 12, -22);
  ctx.translate(shake, -hop);
  ctx.translate(0, 12);
  ctx.rotate(run ? 0.1 + vy * 0.05 : Math.sin(t * 2 + r.ph) * 0.03 + shake * 0.02);
  ctx.translate(0, -12);

  const rx = 9 * (1 + swell * 0.16 + land * 0.1);
  const ry = 9.4 * (1 + swell * 0.24 - land * 0.1);
  const bot = 7.2;
  const cy = bot - ry, top = cy - ry;

  // houppe épinglée sous le lampion (derrière les jambes), en retard sur les sauts
  pin(ctx, 0, bot + 0.8, Math.sin(t * 4.5 + r.ph - 1) * 0.16 + vy * 0.4 + shake * 0.08);
  limb(ctx, 0, 0, 0, 1.4, 0.9, ink2);
  poly(ctx, [-1.4, 1.2, 1.4, 1.2, 1.9, 4.2, -1.9, 4.2], ink2);
  slits(ctx, [-0.7, 2.2, -0.9, 3.8, 0.7, 2.2, 0.9, 3.8], 0.5);
  unpin(ctx, 0.6);
  // jambes : jointes au sol, écartées en l'air, campées pendant l'anticipation
  const legA = air * 0.55 + swell * 0.32;
  pin(ctx, -2.7, bot + 0.2, legA);
  lanternLeg(ctx, ink2);
  unpin(ctx, 0.8);
  pin(ctx, 2.5, bot + 0.2, -legA * 0.8);
  lanternLeg(ctx, ink);
  unpin(ctx, 0.8);

  // capuchon du bas
  poly(ctx, [-4.4, bot - 1.2, 4.4, bot - 1.2, 3.4, bot + 1.4, -3.4, bot + 1.4], ink);
  // anse épinglée au sommet : elle ballotte en retard
  pin(ctx, 0, top - 1.2, Math.sin(t * 3.4 + r.ph - 0.6) * 0.2 - vy * 0.32 + shake * 0.1);
  limb(ctx, 0, 0, 0, -2.2, 1.1, ink);
  ctx.beginPath();
  ctx.arc(0, -4.4, 2.3, 0, TAU);
  ctx.lineWidth = 1.3;
  ctx.strokeStyle = ink;
  ctx.stroke();
  unpin(ctx, 0.7);
  // panse de papier plissé : sept lobes entre les lattes, la silhouette est festonnée
  const NB = 7;
  const P = (k: number, sc: number): [number, number] => {
    const th = -Math.PI / 2 + (k * Math.PI) / NB;
    return [rx * Math.cos(th) * sc, cy + ry * Math.sin(th)];
  };
  const notch = 0.93 - swell * 0.07;
  ctx.beginPath();
  for (const sd of [1, -1]) {
    for (let i = 0; i < NB; i++) {
      const k = sd > 0 ? i : NB - i;
      if (i === 0 && sd > 0) ctx.moveTo(...P(0, notch));
      const [xm, ym] = P(k + sd * 0.5, 1.1 + swell * 0.05), [x1, y1] = P(k + sd, notch);
      ctx.quadraticCurveTo(sd * xm, ym, sd * x1, y1);
    }
  }
  ctx.closePath();
  ctx.fillStyle = ink;
  ctx.fill();
  poly(ctx, [-4, top + 1.4, 4, top + 1.4, 3.1, top - 1.6, -3.1, top - 1.6], ink);
  holes(ctx, [-1.9, top - 0.2, 0.5, 0, top - 0.2, 0.5, 1.9, top - 0.2, 0.5, -1.6, bot + 0.2, 0.45, 0, bot + 0.2, 0.45, 1.6, bot + 0.2, 0.45]);
  // lattes : fentes en amande où passe la lumière ; elles s'écartent et virent au vermillon
  const ribs: number[] = [];
  const rw = 0.8 + swell * 1.1;
  for (let k = 1; k < NB; k++) {
    const [hx, y] = P(k, 0.93);
    if (k === 1 || k === NB - 1) ribs.push(0, y + ry * 0.05, hx * 1.6, 0, rw * 0.8);
    else for (const sd of [-1, 1]) ribs.push(sd * hx * 0.8, y + ry * 0.03, hx * 0.46, sd * 0.1 * (k < NB / 2 ? -1 : 1), rw);
  }
  almonds(ctx, ribs, w > 0.4 || r.rel > 0 ? DANGER : CUT);
  // yeux : deux flammes découpées, qui regardent un peu vers la cible
  const ly = Math.sin(r.aim) * 0.7;
  const fl = Math.sin(t * 13 + r.ph) * 0.35;
  const eb = cy - ry * 0.12 + ly;
  ctx.beginPath();
  flamePath(ctx, -0.8, eb, 4.4 + fl + w * 0.8, 1.35, 1 + fl);
  flamePath(ctx, 4.4, eb, 4.1 - fl + w * 0.8, 1.25, -0.4 - fl);
  ctx.fillStyle = threat(r);
  ctx.fill();
  // cœur : la flamme intérieure grossit et s'allume de plus en plus vermillon
  const hh = 3.6 + swell * 4 + Math.sin(t * 17 + r.ph) * 0.3;
  const hw = 1.25 + swell * 1.6;
  const hb = cy + ry * 0.56;
  ctx.beginPath();
  flamePath(ctx, 1.6, hb, hh, hw, Math.sin(t * 9 + r.ph) * 0.5);
  // au repos : braise éteinte (encre claire) ; elle s'allume à l'anticipation
  ctx.fillStyle = w > 0.05 || r.rel > 0 ? DANGER : ink2;
  ctx.fill();
  if (w > 0.05 || r.rel > 0) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = INK;
    ctx.stroke();
    ctx.beginPath();
    flamePath(ctx, 1.6, hb - hw * 0.35, hh * 0.45, hw * 0.45, 0);
    ctx.fillStyle = CUT;
    ctx.fill();
  }
  tellRing(ctx, r, 0.8, cy, 9, false);
  eliteCrown(ctx, p, 0, top - 9.4);
  ctx.restore();
};

// ───────────────────────────── Araignée tisseuse ─────────────────────────────

const WEB_N = 7;

/** Abdomen dans son repère (axe +x depuis le pédicelle), percé d'une toile en dentelle. */
function webAbdomen(ctx: Ctx, c: string, puff: number): void {
  const cx = 7.4, rx = 7.6 * puff, ry = 6.6 * puff;
  poly(ctx, [cx + rx - 1.4, -1.5, cx + rx + 1.8, -0.3, cx + rx + 1.6, 0.6, cx + rx - 1.4, 1.5], c);
  ctx.beginPath();
  ctx.ellipse(cx, 0, rx, ry, 0, 0, TAU);
  ctx.fillStyle = c;
  ctx.fill();
  const wx = cx + 0.6, wy = -0.4;
  ctx.beginPath();
  for (let i = 0; i < WEB_N; i++) {
    const a = (i * TAU) / WEB_N + 0.25;
    ctx.moveTo(wx + Math.cos(a) * 1.1, wy + Math.sin(a) * 1.1);
    ctx.lineTo(wx + Math.cos(a) * rx * 0.8, wy + Math.sin(a) * ry * 0.8);
  }
  for (const k of [0.36, 0.62]) {
    for (let i = 0; i <= WEB_N; i++) {
      const a = (i * TAU) / WEB_N + 0.25;
      const x = wx + Math.cos(a) * rx * k, y = wy + Math.sin(a) * ry * k;
      if (i === 0) ctx.moveTo(x, y);
      else {
        const am = a - Math.PI / WEB_N;
        ctx.quadraticCurveTo(wx + Math.cos(am) * rx * k * 0.74, wy + Math.sin(am) * ry * k * 0.74, x, y);
      }
    }
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.65;
  ctx.strokeStyle = CUT;
  ctx.stroke();
  dot(ctx, wx, wy, 1, CUT);
}

// pattes : attache x, genou (x, y), pied au repos x
const WEAVER_LEGS: readonly (readonly [number, number, number, number])[] = [
  [5.4, 10, -10, 18],
  [4.4, 6.2, -12, 12.4],
  [3, -1.2, -12, -7.4],
  [1.8, -7.4, -9.4, -15.4],
];

export const drawWeaver: Painter = (ctx, p) => {
  const r = begin(p);
  const t = r.t, w = r.w;
  const ink = r.ink, ink2 = r.ink2;
  const run = r.move || r.charge;
  const gal = t * (r.charge ? 22 : 13) + r.ph;
  const bob = run ? Math.abs(Math.sin(gal)) * 0.7 : Math.sin(t * 2.2 + r.ph) * 0.3;
  const rear = r.wE;
  const G = 12;
  const by = 4 - bob + rear * 0.6 + r.rel * 0.4; // centre du céphalothorax
  eliteAura(ctx, p, 14);
  shadow(ctx, r, 16, 4.4, G);
  ctx.save();
  root(ctx, r, G, -14);

  const leg = (i: number, far: boolean): void => {
    const [ax, kx0, ky0, fx0] = WEAVER_LEGS[i];
    const ph = gal + (i % 2) * Math.PI + (far ? Math.PI : 0);
    const step = run ? Math.sin(ph) * 2.4 : 0;
    const lift = run ? Math.max(0, Math.cos(ph)) * 2.4 : 0;
    let fx = fx0 + step - (far ? 1.8 : 0);
    let fy = G - lift;
    let kx = kx0 + step * 0.5 - (far ? 1.6 : 0), ky = by + ky0 - lift * 0.6 + (far ? 1.4 : 0);
    // anticipation : les pattes avant se dressent, celles de derrière s'arc-boutent
    if (i === 0) {
      fx += rear * 1.2;
      fy -= rear * (far ? 3 : 4.5);
      ky -= rear * 1.5;
    } else if (i === 3) {
      fx -= rear * 1.2;
    }
    legKnee(ctx, ax - (far ? 0.8 : 0), by + 0.2, kx, ky, fx, fy, far ? ink2 : ink, 1.7, 1.5);
  };
  for (let i = 3; i >= 0; i--) leg(i, true);
  // pattes arrière : sous l'abdomen, pour laisser voir la toile
  leg(3, false);
  leg(2, false);

  // abdomen épinglé au pédicelle : il ondule en retard, puis se relève vers la cible
  const restA = Math.PI + 0.36 + Math.sin(t * 2.4 + r.ph - 0.7) * 0.05 + (run ? Math.sin(gal - 0.8) * 0.06 : 0);
  const upA = -Math.PI / 2 + 0.4 + r.aim * 0.3 + TAU;
  const abA = lerp(restA, upA, r.wE) - r.rel * 0.25;
  const pX = -0.4, pY = by - 0.6;
  const puff = 1 + r.wE * 0.08 + Math.sin(t * 3 + r.ph) * 0.015;
  pin(ctx, pX, pY, abA);
  webAbdomen(ctx, ink, puff);
  unpin(ctx, 1.1);

  // céphalothorax et tête
  ctx.save();
  ctx.translate(pX, pY);
  ctx.rotate(-rear * 0.12);
  ctx.translate(-pX, -pY);
  ctx.beginPath();
  ctx.ellipse(3.6, by, 4.8, 3.6, -0.08, 0, TAU);
  ctx.fillStyle = ink;
  ctx.fill();
  slits(ctx, [1.2, by - 1.2, 3.4, by + 0.4, 3.4, by + 0.4, 5.6, by - 1.2], 0.6);
  // chélicères (crocs) épinglés, qui mâchonnent
  const jaw = 0.1 + Math.max(0, Math.sin(t * 7 + r.ph)) * 0.25 + rear * 0.4;
  pin(ctx, 8.6, by + 1.2, jaw);
  poly(ctx, [-1, 0, 1, 0, 0.6, 2.6, -0.6, 3.6], ink);
  unpin(ctx, 0.5);
  ctx.beginPath();
  ctx.ellipse(8, by - 0.6, 2.9, 2.6, 0, 0, TAU);
  ctx.fillStyle = ink;
  ctx.fill();
  const eye = threat(r);
  holes(ctx, [9, by - 1.6, 0.8, 7.6, by - 2, 0.62, 10, by - 0.5, 0.55, 6.5, by - 1.3, 0.45], eye);
  // pédipalpes : petites pattes tâtonnantes à l'avant, en deux pièces
  const palp = Math.sin(t * 5 + r.ph) * 0.25 + (run ? Math.sin(gal) * 0.2 : 0) - rear * 0.5;
  pin(ctx, 9.6, by + 0.4, -0.5 + palp);
  limb(ctx, 0, 0, 2.6, 0, 1.1, ink);
  pin(ctx, 2.6, 0, 1.2 - palp * 0.6);
  limb(ctx, 0, 0, 2.2, 0, 1, ink);
  unpin(ctx, 0);
  unpin(ctx, 0.5);
  ctx.restore();

  leg(1, false);
  leg(0, false);
  // couronne d'élite posée sur l'abdomen (au-dessus des genoux)
  eliteCrown(ctx, p, pX + Math.cos(abA) * 7.4 * puff, pY + Math.sin(abA) * 7.4 * puff - 9.4, -0.1);

  // fil vermillon : il se tend des filières vers la cible, la boule de toile grossit
  if (r.st === 'windup' || r.rel > 0) {
    const L = 7.4 * puff + 7.6 * puff + 1.6;
    const tx = pX + Math.cos(abA) * L, ty = pY + Math.sin(abA) * L;
    if (r.st === 'windup') {
      const len = 6 + 16 * r.wE;
      const ex = tx + Math.cos(r.aim) * len, ey = ty + Math.sin(r.aim) * len;
      const sag = (1 - r.wE) * 6;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.quadraticCurveTo((tx + ex) / 2, (ty + ey) / 2 + sag, ex, ey);
      ctx.lineCap = 'round';
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = INK;
      ctx.stroke();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = DANGER;
      ctx.stroke();
      tellRing(ctx, r, tx, ty, 3.2, false);
    }
    const br = r.st === 'windup' ? 1.2 + r.wE * 2.4 : 3.6 * r.rel;
    dot(ctx, tx, ty, br, DANGER);
    ctx.lineWidth = 1;
    ctx.strokeStyle = INK;
    ctx.stroke();
    if (br > 2) slits(ctx, [tx - br * 0.7, ty, tx + br * 0.7, ty, tx, ty - br * 0.7, tx, ty + br * 0.7], 0.5, CUT);
  }
  ctx.restore();
};

// ───────────────────────────── Scarabée-bouclier ─────────────────────────────

/** Chemin du bouclier (écu à pointe basse) de demi-largeur hw et demi-hauteur hh. */
function shieldPath(ctx: Ctx, x: number, y: number, hw: number, hh: number): void {
  ctx.beginPath();
  ctx.moveTo(x, y - hh);
  ctx.bezierCurveTo(x + hw * 0.8, y - hh, x + hw, y - hh * 0.72, x + hw, y - hh * 0.25);
  ctx.bezierCurveTo(x + hw, y + hh * 0.35, x + hw * 0.45, y + hh * 0.72, x, y + hh);
  ctx.bezierCurveTo(x - hw * 0.45, y + hh * 0.72, x - hw, y + hh * 0.35, x - hw, y - hh * 0.25);
  ctx.bezierCurveTo(x - hw, y - hh * 0.72, x - hw * 0.8, y - hh, x, y - hh);
  ctx.closePath();
}

/** Grand bouclier de papier bordé d'or, vu de face (sx = 1) ou de biais (sx < 1). */
function beetleShield(ctx: Ctx, r: Rig, x: number, y: number, sx: number, edge: number, tilt: number): void {
  const hw = 8.4 * sx, hh = 11.4;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(tilt);
  // tranche du papier (épaisseur) du côté du scarabée
  shieldPath(ctx, -edge, 0.3, hw, hh);
  ctx.fillStyle = r.ink;
  ctx.fill();
  shieldPath(ctx, 0, 0, hw, hh);
  ctx.fillStyle = r.ink2;
  ctx.fill();
  ctx.lineJoin = 'round';
  ctx.lineWidth = 2.2;
  ctx.strokeStyle = r.C(GOLD_LEAF);
  ctx.stroke();
  shieldPath(ctx, 0, 0, Math.max(0.5, hw - 2), hh - 2);
  ctx.lineWidth = 0.7;
  ctx.strokeStyle = r.ink;
  ctx.stroke();
  // dentelle : croissant de lune et couronne de perforations
  ctx.scale(sx, 1);
  ctx.beginPath();
  ctx.arc(0, -1, 4.2, 0, TAU);
  ctx.arc(1.8, -2.2, 3.6, 0, TAU, true);
  ctx.fillStyle = CUT;
  ctx.fill();
  holes(ctx, [0, -8, 0.8, -4.6, -5.6, 0.65, 4.6, -5.6, 0.65, -5.4, 1.2, 0.65, 5.4, 1.2, 0.65, -3, 6.2, 0.6, 3, 6.2, 0.6, 0, 8.2, 0.6]);
  ctx.restore();
}

export const drawBeetle: Painter = (ctx, p) => {
  const r = begin(p);
  const t = r.t, w = r.w;
  const ink = r.ink, ink2 = r.ink2;
  const run = r.move || r.charge;
  const gal = r.move ? t * 7 + r.ph : r.charge ? t * 20 + r.ph : 0;
  const crouch = r.wE;
  const G = 12;
  // bouclier : toujours tourné vers `facing` (repère local retourné : aim ∈ [-π/2, π/2])
  const ca = Math.cos(r.aim), sa = Math.sin(r.aim);
  eliteAura(ctx, p, 18);
  shadow(ctx, r, 18, 5.4, G);
  ctx.save();
  root(ctx, r, G, -24);
  // ombre du bouclier au sol : l'arc protégé (±70°), lisible vu de dessus
  if (r.die === 0) {
    ctx.beginPath();
    ctx.ellipse(0, G, 22, 8, 0, r.aim - 1.2, r.aim + 1.2);
    ctx.lineCap = 'round';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(27,20,24,0.3)';
    ctx.stroke();
  }
  const shX = 3 + 15 * ca;
  const shY = (sa < 0 ? 7.4 : 1.4) * sa + 0.8 + crouch * 1.4 + (r.charge ? 1.2 : 0);
  const shSx = 0.52 + 0.48 * Math.abs(sa) - (r.charge ? 0.1 : 0);
  const shTilt = sa * -0.06 + (r.charge ? 0.12 : 0) + (r.st === 'recover' ? 0.14 : 0) + (run ? Math.sin(gal) * 0.03 : 0);
  const shBehind = sa < -0.3;
  const shield = (): void => {
    // épinglé lui aussi : à la mort, il tombe avec les autres pièces
    pin(ctx, shX, shY - (run ? Math.abs(Math.sin(gal)) * 0.6 : 0), 0);
    beetleShield(ctx, r, 0, 0, shSx, 1.4 * ca + 0.4, shTilt);
    unpin(ctx, 0);
  };
  if (shBehind) shield();

  if (r.charge) ctx.scale(1.1, 0.95);
  const bodyY = crouch * 2.6 - (run ? Math.abs(Math.sin(gal)) * 1.1 : Math.sin(t * 1.6 + r.ph) * 0.3);
  const tremble = w > 0.5 ? Math.sin(t * 50) * 0.3 * w : 0;
  ctx.translate(tremble, 0);

  // pattes : lourdes, trois par côté (le bras avant tient le bouclier)
  const legs: readonly (readonly [number, number, number, number, number])[] = [
    // attache x, y ; genou dx, dy ; pied x
    [8.6, 3.2, 4.6, 2.4, 15],
    [1.6, 3.8, 3.8, 3, 4],
    [-6, 3.8, -4.8, 2, -13],
  ];
  const leg = (i: number, far: boolean): void => {
    const [ax, ay, kdx, kdy, fx0] = legs[i];
    const ph = gal + (i % 2) * Math.PI + (far ? Math.PI : 0);
    const step = run ? Math.sin(ph) * (r.charge ? 3 : 2) : 0;
    const lift = run ? Math.max(0, Math.cos(ph)) * (r.charge ? 2.6 : 1.8) : 0;
    const off = far ? -2.2 : 0;
    const by = ay + bodyY;
    let fx = fx0 + off + step;
    if (crouch > 0) fx += (i === 2 ? -1.6 : i === 0 ? 1.2 : 0) * crouch;
    legKnee(ctx, ax + off, by, ax + off + kdx + step * 0.4, by + kdy - lift * 0.5 - crouch * 0.8, fx, G - lift, far ? ink2 : ink, 2.4, 2.1, true);
  };
  for (let i = 0; i < 3; i++) leg(i, true);

  ctx.save();
  ctx.translate(0, bodyY);
  ctx.translate(-6, 4);
  ctx.rotate(-crouch * 0.07 + (r.charge ? 0.05 : 0));
  ctx.translate(6, -4);
  // ventre (seconde couche)
  ctx.beginPath();
  ctx.ellipse(-3, 3, 12, 3.4, 0, 0, TAU);
  ctx.fillStyle = ink2;
  ctx.fill();
  slits(ctx, [-9, 2.4, -9, 5, -5, 2.6, -5, 5.6, -1, 2.6, -1, 5.6], 0.7);
  // ailes membraneuses sous les élytres : elles vrombissent pendant la charge
  const elA = crouch * 0.16 + (r.charge ? 0.22 : 0) + (r.st === 'recover' ? 0.14 : 0) + Math.sin(t * 2 + r.ph) * 0.01;
  if (elA > 0.05) {
    const buzz = r.charge ? Math.sin(t * 60) * 0.18 : 0;
    pin(ctx, 3, -6, elA * 1.6 + buzz);
    poly(ctx, [0, 0, -6, -3, -15, -2.4, -17.4, 0.4, -11, 2, -4, 2.2], ink2);
    slits(ctx, [-3, -0.4, -14, -0.4, -6, -1.4, -11, 1.2], 0.6);
    unpin(ctx, 0);
  }
  // élytres : dôme épinglé à l'avant, qui se soulève à l'anticipation
  pin(ctx, 3.4, -5.6, elA);
  ctx.translate(-3.4, 5.6);
  ctx.beginPath();
  ctx.moveTo(2.1, 3);
  ctx.bezierCurveTo(2.6, -6.6, -1.8, -12.2, -7.4, -12.2);
  ctx.bezierCurveTo(-13.7, -12.2, -18.1, -5.2, -17.6, 0.6);
  ctx.quadraticCurveTo(-17.1, 4.2, -13.7, 4.4);
  ctx.lineTo(0.9, 4.2);
  ctx.closePath();
  ctx.fillStyle = ink;
  ctx.fill();
  // stries découpées et perforations
  ctx.beginPath();
  ctx.moveTo(-0.8, 1.6);
  ctx.bezierCurveTo(-0.6, -4.6, -3.6, -8.6, -7.6, -8.8);
  ctx.moveTo(-3.4, 2.2);
  ctx.bezierCurveTo(-3.6, -2.6, -5.6, -5, -8.6, -5.2);
  ctx.lineCap = 'round';
  ctx.lineWidth = 0.8;
  ctx.strokeStyle = CUT;
  ctx.stroke();
  // rosace de dentelle et frise d'amandes le long du bord
  const ros: number[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (i * TAU) / 6 + 0.3;
    ros.push(-10 + Math.cos(a) * 2.3, -4 + Math.sin(a) * 2.3, 2.2, a, 0.75);
  }
  ros.push(-4.6, 2.2, 3, -0.08, 0.75, -9, 1.9, 3.2, 0.06, 0.75, -13.2, 0.9, 2.8, 0.42, 0.7);
  almonds(ctx, ros);
  dot(ctx, -10, -4, 0.9, CUT);
  holes(ctx, [-13.6, -8, 0.6, -15.8, -4.2, 0.55, -10, -10.2, 0.6]);
  ctx.translate(3.4, -5.6);
  unpin(ctx, 1.4);

  // pronotum et corne frontale
  const hornC = w > 0.05 ? DANGER : ink;
  const hornS = w > 0.05 || r.charge ? INK : undefined;
  const headA = -crouch * 0.45 + (r.charge ? 0.18 : 0) + (r.st === 'recover' ? 0.25 : 0) + r.rel * 0.2 + (run ? Math.sin(gal + 0.6) * 0.04 : Math.sin(t * 1.4 + r.ph) * 0.03);
  pin(ctx, 7.4, -8, headA * 0.5);
  poly(ctx, [-2, 0.6, 0.6, -2.4, 3.8, -4.8, 7.4, -7.4, 8.2, -6.2, 5.8, -2.4, 3.6, 1.2], hornC, hornS, 1);
  unpin(ctx, 0.8);
  ctx.beginPath();
  ctx.moveTo(0, 5.4);
  ctx.bezierCurveTo(-0.6, -4.6, 3.4, -9.2, 7.6, -8.8);
  ctx.bezierCurveTo(12.4, -8.4, 13.8, -2, 12.8, 5);
  ctx.closePath();
  ctx.fillStyle = ink;
  ctx.fill();
  // la lumière file entre pronotum et élytres
  slits(ctx, [0.4, 3.6, 1.6, -4.4, 1.6, -4.4, 4.4, -7.6], 0.7);
  almonds(ctx, [7.4, -4.2, 3.4, -0.5, 0.9, 9.4, 0.4, 3, 0.2, 0.8]);
  holes(ctx, [4.6, -0.6, 0.65, 11.2, -4.6, 0.55]);
  // tête épinglée : grande corne de rhinocéros, vermillon à l'anticipation
  pin(ctx, 12.6, 1.6, headA);
  ctx.beginPath();
  ctx.moveTo(-2.4, 1.4);
  ctx.quadraticCurveTo(-0.2, -7, 2, -16);
  ctx.quadraticCurveTo(3.4, -17.4, 4.8, -15.8);
  ctx.quadraticCurveTo(4.4, -6.6, 4.2, 0.6);
  ctx.closePath();
  ctx.fillStyle = hornC;
  ctx.fill();
  if (hornS) {
    ctx.lineWidth = 1;
    ctx.strokeStyle = hornS;
    ctx.stroke();
  }
  slits(ctx, [1.2, -1.6, 2.4, -9], 0.6, w > 0.05 ? INK : CUT);
  ctx.beginPath();
  ctx.ellipse(1.6, 1.6, 3.4, 3, 0, 0, TAU);
  ctx.fillStyle = ink;
  ctx.fill();
  almonds(ctx, [2.2, 1, 2.6, -0.2, 0.9 + crouch * 0.4], threat(r));
  dot(ctx, 2.6, 1, 0.45, INK);
  // antenne coudée
  pin(ctx, 3.6, 2.6, 0.5 + Math.sin(t * 4 + r.ph) * 0.15 - crouch * 0.3);
  limb(ctx, 0, 0, 3, 0, 0.8, ink);
  poly(ctx, [2.6, -0.8, 4.8, -1.2, 5, 1, 2.6, 0.8], ink);
  unpin(ctx, 0);
  if (r.st === 'windup') tellRing(ctx, r, 3.4, -15.4, 3.4, false);
  unpin(ctx, 1.1);
  eliteCrown(ctx, p, -7, -16, -0.1);
  ctx.restore();

  for (let i = 1; i < 3; i++) leg(i, false);
  // patte avant : le bras qui tient le bouclier
  if (!shBehind) {
    const hx = shX - 2.6 * ca, hy = shY + 1.4;
    const ax = 8.4, ay = 3.8 + bodyY;
    const a = Math.atan2(hy - ay, hx - ax), l = Math.hypot(hx - ax, hy - ay);
    pin(ctx, ax, ay, a);
    bone(ctx, 0, 0, l, 0, 2.6, ink);
    unpin(ctx, 0.9);
    shield();
  }
  ctx.restore();
};

// ───────────────────────────── Ombre chinoise de chien ─────────────────────────────

// contour d'une main qui fait le chien : museau (index et majeur), crâne, gorge et poignet
// qui descend comme un cou ; l'oreille (le pouce) est une pièce à part
const DOG = [
  11, -3.6, 11.6, -1.6, 6, -0.9, 1.8, 0.2, -1.2, 2.4, -2, 6.6, -2.6, 12, -9.4, 12.4,
  -7.6, 4.4, -6.8, -1.6, -5, -5.2, -1.4, -6.8, 2.4, -6.2, 6.4, -4.8,
];
const DOG_N = DOG.length / 2;

/** Contour lissé de l'ombre de chien, qui ondule (amp) comme une ombre mal tenue. */
function dogPath(ctx: Ctx, t: number, amp: number): void {
  const X = (i: number) => DOG[(i % DOG_N) * 2] + Math.sin(t * 23 + i * 2.1) * amp;
  const Y = (i: number) => DOG[(i % DOG_N) * 2 + 1] + Math.cos(t * 19 + i * 1.7) * amp;
  ctx.beginPath();
  ctx.moveTo((X(DOG_N - 1) + X(0)) / 2, (Y(DOG_N - 1) + Y(0)) / 2);
  for (let i = 0; i < DOG_N; i++) ctx.quadraticCurveTo(X(i), Y(i), (X(i) + X(i + 1)) / 2, (Y(i) + Y(i + 1)) / 2);
  ctx.closePath();
}

/** Oreille dressée (le pouce), épinglée sur le crâne ; liseré éventuel (ombre invoquée). */
function dogEar(ctx: Ctx, c: string, a: number, edge?: string, lw = 1): void {
  pin(ctx, -2.8, -5.4, a);
  poly(ctx, [-2.2, 0.8, -2.6, -4, -1.8, -8.8, -0.5, -9.2, 0.6, -4.6, 1.8, 0.6], c, edge, lw);
  almonds(ctx, [-1.1, -7.2, 1.9, -1.4, 0.45]);
  unpin(ctx, 0);
}

/** Mâchoire (annulaire et auriculaire), épinglée au coin de la gueule. */
function dogJaw(ctx: Ctx, c: string, open: number): void {
  pin(ctx, 1.8, 0.2, open);
  poly(ctx, [-0.6, -0.8, 8.8, -0.9, 8.4, 0.9, 3, 2.4, -0.6, 1.8], c);
  unpin(ctx, 0);
}

// ───────────────────────────── Montreur d'ombres ─────────────────────────────

const PUP_DIAMONDS = [1, -7, 2.6, -4, 1, -1, 2.6, 2, 1, 5];

/**
 * Main articulée : paume, trois doigts en deux pièces et un pouce. Note la position (écran)
 * du bout de chaque doigt dans `tips`, pour y accrocher les fils.
 */
function pupHand(ctx: Ctx, c: string, t: number, ph: number, curl: number, spread: number, tips: number[] | null): void {
  poly(ctx, [0, -1.3, 2.8, -1.6, 3.6, 0, 2.8, 1.4, 0, 1.1], c);
  pin(ctx, 1.4, -1.3, -0.9 - spread * 0.4 + Math.sin(t * 3 + ph) * 0.1);
  limb(ctx, 0, 0, 2.4, 0, 0.9, c);
  unpin(ctx, 0);
  for (let i = 0; i < 3; i++) {
    const wig = Math.sin(t * 5 + ph + i * 1.3) * 0.3;
    pin(ctx, 3.2, -0.9 + i * 0.9, (i - 1) * (0.28 + spread * 0.25) + curl * (0.35 + wig));
    limb(ctx, 0, 0, 2.8, 0, 0.95, c);
    pin(ctx, 2.8, 0, curl * (0.5 + wig * 0.8));
    limb(ctx, 0, 0, 2.3 - Math.abs(i - 1) * 0.3, 0, 0.8, c);
    if (tips) {
      ctx.save();
      ctx.translate(2.3 - Math.abs(i - 1) * 0.3, 0);
      const m = ctx.getTransform();
      tips.push(m.e, m.f);
      ctx.restore();
    }
    unpin(ctx, 0.45);
    unpin(ctx, 0.5);
  }
}

/** Bras long : épaule (pièce 1), avant-bras (pièce 2), main (pièce 3). */
function pupArm(ctx: Ctx, c: string, sx: number, sy: number, a1: number, a2: number, a3: number, hand: () => void): void {
  pin(ctx, sx, sy, a1);
  bone(ctx, 0, 0, 6.4, 0, 2.2, c);
  pin(ctx, 6.4, 0, a2);
  bone(ctx, 0, 0, 6.2, 0, 1.8, c);
  pin(ctx, 6.2, 0, a3);
  hand();
  unpin(ctx, 0.6);
  unpin(ctx, 0.8);
  unpin(ctx, 0.9);
}

/** Fils : des bouts de doigts, ils pendent (ou se tendent vers l'ombre qu'il fait naître). */
function pupStrings(ctx: Ctx, r: Rig, tips: number[], len: number, to: readonly number[] | null): void {
  const inv = ctx.getTransform().inverse();
  ctx.beginPath();
  const ends: number[] = [];
  for (let i = 0; i < tips.length; i += 2) {
    const q = inv.transformPoint({ x: tips[i], y: tips[i + 1] });
    const k = i / 2;
    const sway = Math.sin(r.t * 2.2 + r.ph + k * 1.1) * 1.4 + (r.move ? -2.2 : 0);
    let ex = q.x + sway, ey = q.y + len + (k % 3) * 1.6;
    let cx = q.x + sway * 0.3, cy = (q.y + ey) / 2;
    if (to && r.wE > 0) {
      const tx = to[(k * 2) % to.length], ty = to[(k * 2 + 1) % to.length];
      ex = lerp(ex, tx, r.wE);
      ey = lerp(ey, ty, r.wE);
      cx = lerp(cx, (q.x + tx) / 2, r.wE);
      cy = lerp(cy, (q.y + ty) / 2 + 2, r.wE);
    }
    ctx.moveTo(q.x, q.y);
    ctx.quadraticCurveTo(cx, cy, ex, ey);
    ends.push(ex, ey, 0.75);
  }
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = r.ink;
  ctx.stroke();
  if (!to || r.wE < 0.5) holes(ctx, ends, r.ink);
}

export const drawPuppeteer: Painter = (ctx, p) => {
  const r = begin(p);
  const t = r.t, w = r.w;
  const ink = r.ink, ink2 = r.ink2;
  const run = r.move || r.charge;
  const gal = t * 7 + r.ph;
  const raise = r.wE;
  eliteAura(ctx, p, 15);
  shadow(ctx, r, 10, 4, 12);
  ctx.save();
  root(ctx, r, 12, -27);
  const bob = run ? Math.abs(Math.sin(gal)) * 0.9 : Math.sin(t * 1.8 + r.ph) * 0.4;
  ctx.translate(0, -bob);
  ctx.translate(0, 12);
  ctx.rotate((run ? 0.07 : 0) - raise * 0.07 + r.rel * 0.08);
  ctx.scale(0.9, 0.9);
  ctx.translate(0, -12);
  // ombre chinoise invoquée : position (repère de la racine)
  const sk = 0.3 + raise * 0.5;
  const figX = 15 + raise * 1.5, figY = -22 + raise * 2;
  const figPts = [figX + 11 * sk, figY - 2.6 * sk, figX - 3.8 * sk, figY - 13.6 * sk, figX - 6 * sk, figY + 12 * sk, figX + 3.4 * sk, figY - 3.8 * sk];
  const playing = r.st === 'windup' && r.die === 0;

  // bras arrière (encre claire)
  const curlB = playing ? lerp(0.6, 0.15, raise) : 0.6;
  const tipsB: number[] = [];
  pupArm(ctx, ink2, -1.4, -10.6,
    lerp(1.5 + Math.sin(t * 2 + r.ph) * 0.08 + (run ? Math.sin(gal) * 0.15 : 0), -0.75, raise),
    lerp(-1.25, -0.45, raise),
    lerp(0.55, -0.1, raise),
    () => pupHand(ctx, ink2, t, r.ph + 2, curlB, raise, r.die === 0 ? tipsB : null));
  if (tipsB.length) pupStrings(ctx, r, tipsB, 8, playing ? figPts : null);

  // cape arrière : pièce épinglée à l'épaule, qui flotte en retard
  const capeA = 0.14 + Math.sin(t * 2.6 + r.ph - 1) * 0.05 + (run ? 0.22 + Math.sin(gal - 0.9) * 0.06 : 0) + raise * 0.1;
  pin(ctx, -2.4, -11, capeA);
  ctx.beginPath();
  ctx.moveTo(1.6, -0.6);
  ctx.quadraticCurveTo(-3, 6, -7.4, 21.6);
  ctx.lineTo(-5.4, 20.2);
  ctx.lineTo(-4, 22.4);
  ctx.lineTo(-2.4, 20.6);
  ctx.lineTo(-0.6, 22.6);
  ctx.lineTo(0.8, 20.4);
  ctx.lineTo(2.6, 21.6);
  ctx.quadraticCurveTo(2.6, 8, 3.2, -0.4);
  ctx.closePath();
  ctx.fillStyle = ink2;
  ctx.fill();
  holes(ctx, [-3.6, 17.6, 0.6, -1, 17.8, 0.6, 1.4, 17.6, 0.55]);
  unpin(ctx, 0.9);

  // pieds : babouches pointues sous l'ourlet
  for (const [x, o, c] of [[-1.6, Math.PI, ink2], [1.8, 0, ink]] as const) {
    const s = run ? Math.sin(gal + o) : 0;
    pin(ctx, x + s * 1.4, 8.6 - Math.max(0, -Math.cos(gal + o)) * (run ? 1.2 : 0), s * 0.15);
    poly(ctx, [-1.2, 0, 1.1, 0, 1.4, 2.2, 3.8, 2.4, 5, 1.6, 4.4, 3.4, -1.4, 3.4], c);
    unpin(ctx, 0);
  }
  // robe longue et maigre
  ctx.beginPath();
  ctx.moveTo(-2.8, -12.2);
  ctx.quadraticCurveTo(-4.4, -2, -6.4, 9.6);
  ctx.lineTo(-4.2, 8.4);
  ctx.lineTo(-2.6, 10.4);
  ctx.lineTo(-0.6, 8.8);
  ctx.lineTo(1.4, 10.6);
  ctx.lineTo(3.2, 8.8);
  ctx.lineTo(5.4, 10.2);
  ctx.quadraticCurveTo(4.4, -2, 3.4, -12.2);
  ctx.quadraticCurveTo(0.3, -13.6, -2.8, -12.2);
  ctx.fillStyle = ink;
  ctx.fill();
  // dentelle : losanges d'arlequin en quinconce, plis de la robe
  ctx.beginPath();
  for (let i = 0; i < PUP_DIAMONDS.length; i += 2) {
    const x = PUP_DIAMONDS[i], y = PUP_DIAMONDS[i + 1];
    ctx.moveTo(x, y - 1.3);
    ctx.lineTo(x + 0.8, y);
    ctx.lineTo(x, y + 1.3);
    ctx.lineTo(x - 0.8, y);
    ctx.closePath();
  }
  ctx.fillStyle = CUT;
  ctx.fill();
  slits(ctx, [-2.2, -6, -3.8, 6.4, -0.6, 0, -0.4, 6.8], 0.6);
  holes(ctx, [-4.2, 7.2, 0.5, 3.6, 7.2, 0.5]);
  // col en pointes, épinglé
  pin(ctx, 0.2, -12, Math.sin(t * 2.4 + r.ph - 0.6) * 0.06 + (run ? -0.08 : 0));
  poly(ctx, [-4.2, 0.6, -6.6, -4.6, -3.2, -1.4, -2.4, -5.6, -0.6, -1.2, 3.4, 0.6], ink);
  unpin(ctx, 0.8);
  // tête : long nez crochu, menton pointu, haut-de-forme épinglé
  const headA = Math.sin(t * 1.7 + r.ph) * 0.05 - raise * 0.22 + r.rel * 0.1 + (run ? Math.sin(gal + 0.4) * 0.04 : 0);
  pin(ctx, 0.8, -13, headA);
  limb(ctx, 0, 0, 0.4, -2.6, 1.6, ink);
  ctx.beginPath();
  ctx.moveTo(-2.4, -1.6);
  ctx.quadraticCurveTo(-3.6, -7.4, 0.4, -8);
  ctx.lineTo(3.2, -7.4);
  ctx.quadraticCurveTo(3.8, -5.6, 4, -4.8);
  ctx.lineTo(7.4, -2.4);
  ctx.lineTo(7, -1.8);
  ctx.lineTo(4.4, -2.4);
  ctx.lineTo(4.2, -1.6);
  ctx.lineTo(4.8, 0.8);
  ctx.quadraticCurveTo(1, 1, -2.4, -1.6);
  ctx.fillStyle = ink;
  ctx.fill();
  almonds(ctx, [2.4, -4.6, 2.6, 0.15, 0.85 + raise * 0.25], threat(r));
  // monocle découpé (un fil de lumière)
  ctx.beginPath();
  ctx.arc(2.5, -4.6, 1.9, 0, TAU);
  ctx.lineWidth = 0.5;
  ctx.strokeStyle = CUT;
  ctx.stroke();
  slits(ctx, [0.8, -6.4, 3.4, -5.8], 0.6);
  slits(ctx, [2, -0.6, 3.8, -0.9], 0.55);
  const hatA = Math.sin(t * 2.2 + r.ph - 1) * 0.08 + (run ? -0.12 + Math.sin(gal - 1) * 0.05 : 0) + raise * 0.15;
  pin(ctx, 0.4, -7.4, hatA);
  poly(ctx, [-5, 0.4, 6.2, 0.2, 5.6, -1.2, -4.6, -1], ink);
  poly(ctx, [-3.2, -0.8, 3.4, -0.8, 4, -7.4, -2.4, -7.4], ink);
  slits(ctx, [-2.8, -2.2, 3.4, -2.2], 0.7);
  almonds(ctx, [0.6, -4.8, 2.6, -1.2, 0.75]);
  eliteCrown(ctx, p, 0.8, -11.2, 0);
  unpin(ctx, 0.7);
  unpin(ctx, 0.9);

  // bras avant : main qui joue des fils, puis se lève pour faire l'ombre
  const curlF = playing ? lerp(0.5, 0.05, raise) : 0.5;
  const tipsF: number[] = [];
  pupArm(ctx, ink, 1.6, -10.6,
    lerp(1.2 + Math.sin(t * 2 + r.ph + 1) * 0.08 + (run ? -Math.sin(gal) * 0.15 : 0), -1.05, raise) - r.rel * 0.3,
    lerp(-1.5, -0.25, raise),
    lerp(0.6, -0.2, raise),
    () => pupHand(ctx, ink, t, r.ph, curlF, raise, r.die === 0 ? tipsF : null));
  if (tipsF.length) pupStrings(ctx, r, tipsF, 9, playing ? figPts : null);

  // l'ombre de chien grandit au-dessus des mains, cernée de vermillon
  if (playing || r.rel > 0) {
    const k = playing ? sk : 0.8;
    ctx.save();
    ctx.globalAlpha *= playing ? smooth(w * 4) : r.rel;
    ctx.translate(figX + (playing ? 0 : (1 - r.rel) * 8), figY);
    ctx.scale(k, k);
    dogJaw(ctx, INK, 0.35 + Math.sin(t * 8) * 0.1);
    dogEar(ctx, INK, Math.sin(t * 6) * 0.12, DANGER, 1.6 / k);
    dogPath(ctx, t, 0.35);
    ctx.fillStyle = INK;
    ctx.fill();
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1.6 / k;
    ctx.strokeStyle = DANGER;
    ctx.stroke();
    almonds(ctx, [3.4, -3.8, 2.8, -0.15, 0.9], DANGER);
    ctx.restore();
    if (playing) tellRing(ctx, r, figX, figY - 2 * sk, 4.6, false);
  }
  ctx.restore();
};

// ───────────────────────────── Ombre ─────────────────────────────

export const drawShade: Painter = (ctx, p) => {
  const r = begin(p);
  const t = r.t, w = r.w;
  const ink = r.ink;
  const run = r.move || r.charge;
  eliteAura(ctx, p, 10);
  shadow(ctx, r, 8.5, 3, 10, 0.26);
  ctx.save();
  root(ctx, r, 10, -14);
  // rapide, un peu tremblante
  const jit = Math.sin(t * 41 + r.ph) * 0.35 + Math.sin(t * 29) * 0.2;
  const hover = Math.sin(t * (run ? 14 : 6) + r.ph) * (run ? 1.2 : 0.8);
  ctx.translate(jit - r.wE * 1.6 + r.rel * 2.4, -1.6 + hover + r.wE * 0.8);
  ctx.rotate((run ? -0.06 : 0) + Math.sin(t * 7 + r.ph) * 0.04 + r.wE * 0.12 - r.rel * 0.1);
  if (r.charge) ctx.scale(1.14, 0.9);
  ctx.scale(0.88, 0.88);
  // gouttes d'encre qui s'égouttent du poignet, traînée quand elle file
  for (let i = 0; i < 3; i++) {
    const k = (t * (run ? 2.4 : 1.2) + i / 3 + r.ph) % 1;
    dot(ctx, -6 - k * (run ? 8 : 1.5) + i * 1.6, 12.4 + k * 2.4, 1.2 * (1 - k), ink);
  }
  // mâchoire (annulaire et auriculaire) : elle claque
  let open = 0.08 + Math.pow(Math.max(0, Math.sin(t * (run ? 13 : 5) + r.ph)), 3) * (run ? 0.4 : 0.25);
  if (w > 0) open = lerp(open, 0.7 + Math.sin(t * 30) * 0.05, r.wE);
  if (r.charge) open = 0.55;
  if (r.rel > 0) open *= 1 - r.rel;
  dogJaw(ctx, ink, open);
  // l'oreille (pouce) tressaille, couchée en courant, dressée à l'anticipation
  dogEar(ctx, ink, Math.sin(t * 9 + r.ph) * 0.1 - (run ? 0.4 : 0) + r.wE * 0.15);
  dogPath(ctx, t, 0.3 + (run ? 0.12 : 0) + w * 0.2);
  ctx.fillStyle = ink;
  ctx.fill();
  // fentes entre les doigts, plis du poignet, œil
  slits(ctx, [5.6, -2.6, 10.2, -2.5, -5.6, 3.6, -4.2, 6.4], 0.55);
  almonds(ctx, [3.4, -3.8, 2.8, -0.15, 0.85 + r.wE * 0.35], threat(r));
  tellRing(ctx, r, 9, 0.6, 3.6, false);
  eliteCrown(ctx, p, 3.6, -9.6, 0.15);
  ctx.restore();
};

// ───────────────────────────── Spectre de papier ─────────────────────────────

const SPEC_HOLES = [-5.8, -0.4, 0.8, 5.6, 1.2, 0.65, -6.4, -7, 0.5];
const SPEC_STRIPS = [-8.6, 6.6, -5.2, 7.8, -1.7, 6.2, 1.8, 8.2, 5.3, 6.8, 8.7, 7.4];

function specStrip(ctx: Ctx, c: string, len: number, k: number): void {
  const tip = k % 2 ? 0.6 : -0.5;
  poly(ctx, [-1.95, 0, 1.95, 0, 1.7, len * 0.7, 1 + tip, len, 0.3, len * 0.72, -0.6 + tip, len * 0.92, -1.7, len * 0.6], c);
}

export const drawSpecter: Painter = (ctx, p) => {
  const r = begin(p);
  const t = r.t, w = r.w;
  const ink = r.ink, ink2 = r.ink2;
  const run = r.move || r.charge;
  // déchirure : s'efface en bandes à l'anticipation, se recompose à l'apparition
  const back = r.st === 'spawn' || r.st === 'recover';
  const sh = r.st === 'windup' ? smooth(w) : r.st === 'spawn' ? 0.07 + Math.sin(t * 5 + r.ph) * 0.04 : 0;
  const fade = r.st === 'windup' ? 1 - 0.88 * smooth(w) : r.st === 'spawn' ? 0.8 + Math.sin(t * 7 + r.ph) * 0.12 : 1;
  const angry = r.st === 'recover' || r.rel > 0;
  eliteAura(ctx, p, 14);
  // vole : ombre pâle et décalée, loin sous le drap
  ctx.save();
  ctx.translate(4, 0);
  shadow(ctx, r, 9 - sh * 3, 2.8, 17, 0.16 * fade);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha *= fade;
  // pas de fil à l'apparition ni d'affaissement : il se recompose dans l'air
  root(ctx, back ? { ...r, st: 'idle' } : r, 6, -18);
  const fl = Math.sin(t * 2.4 + r.ph);
  ctx.translate(0, -4 + fl * 1.8);
  ctx.translate(0, 6);
  ctx.rotate((run ? 0.12 : 0) + Math.sin(t * 1.3 + r.ph) * 0.04);
  ctx.translate(0, -6);
  const sway = Math.sin(t * 3 + r.ph) * 0.8 - (run ? 1.2 : 0);

  const figure = (): void => {
    // bandes du revers (encre claire), en retard sur celles de devant
    for (let i = 0; i < SPEC_STRIPS.length; i += 2) {
      const k = i / 2;
      pin(ctx, SPEC_STRIPS[i] * 0.9 + sway * 0.6 + 1, 5, Math.sin(t * 4 + r.ph + k * 0.9 - 1.2) * 0.22 + (run ? 0.3 : 0.08));
      specStrip(ctx, ink2, SPEC_STRIPS[i + 1] - 1, k + 1);
      unpin(ctx, 0);
    }
    // bras du drap : pans épinglés qui flottent
    const armB = Math.sin(t * 2.6 + r.ph - 0.5) * 0.14 + (run ? 0.2 : 0);
    pin(ctx, -7, -5.4, 0.35 + armB);
    poly(ctx, [0, -1.6, -1.6, 2, -3.6, 8, -2.4, 7.2, -1.8, 9.4, -0.6, 7.4, 1.6, 1.4], ink2);
    unpin(ctx, 0.8);
    // drap
    ctx.beginPath();
    ctx.moveTo(-10.4 + sway * 0.6, 6.4);
    ctx.quadraticCurveTo(-8.8 + sway * 0.3, -1, -8.6, -8.4);
    ctx.bezierCurveTo(-8.6, -14.6, -4.6, -17, 0, -17);
    ctx.bezierCurveTo(4.6, -17, 8.6, -14.6, 8.6, -8.4);
    ctx.quadraticCurveTo(8.8 + sway * 0.3, -1, 10.4 + sway * 0.6, 6.4);
    ctx.closePath();
    ctx.fillStyle = ink;
    ctx.fill();
    holes(ctx, SPEC_HOLES);
    slits(ctx, [-4.4, -1.4, -5.6 + sway * 0.3, 5, 2.6, 0.2, 3.4 + sway * 0.3, 5.4, 6.2, -6, 7.2, -1.8], 0.6);
    // bas déchiqueté : bandes épinglées qui ondulent
    for (let i = 0; i < SPEC_STRIPS.length; i += 2) {
      const k = i / 2;
      pin(ctx, SPEC_STRIPS[i] + sway * 0.6, 5.2, Math.sin(t * 4 + r.ph + k * 0.9) * 0.2 + (run ? 0.28 : 0) - sway * 0.04);
      specStrip(ctx, ink, SPEC_STRIPS[i + 1], k);
      unpin(ctx, 0);
    }
    // bras avant
    const armF = Math.sin(t * 2.6 + r.ph) * 0.14 + (run ? 0.15 : 0);
    pin(ctx, 6.8, -5.4, -0.3 - armF - (angry ? 0.7 : 0));
    poly(ctx, [0, -1.6, 2, 2, 4, 8, 2.6, 7.2, 2, 9.4, 0.8, 7.4, -1.6, 1.4], ink);
    unpin(ctx, 0.9);
    // visage découpé : yeux creux et bouche qui gémit
    const eye = angry ? DANGER : threat(r);
    ctx.beginPath();
    ctx.ellipse(-1.2, -9.6, 1.5, 2.4, -0.1, 0, TAU);
    ctx.moveTo(5.6, -9.4);
    ctx.ellipse(4.2, -9.4, 1.4, 2.3, 0.1, 0, TAU);
    ctx.fillStyle = eye;
    ctx.fill();
    const mo = 1 + (angry ? 0.5 : 0) + Math.sin(t * 3 + r.ph) * 0.12;
    ctx.beginPath();
    ctx.ellipse(1.8, -4.4, 1.2 * mo, 1.8 * mo, 0, 0, TAU);
    ctx.fillStyle = angry ? DANGER : CUT;
    ctx.fill();
    eliteCrown(ctx, p, 0, -19.4, -0.05);
  };

  if (sh <= 0.001) figure();
  else {
    // le papier se déchire en bandes horizontales qui s'envolent
    const NB = 5, y0 = -20, bh = 33 / NB;
    const edge = (y: number, i: number): number => y + (((i * 7) % 3) - 1) * 0.9;
    for (let b = 0; b < NB; b++) {
      const dir = (b % 2 ? 1 : -1) * (0.6 + hash(b, p.seed | 0) * 0.8);
      ctx.save();
      ctx.translate(dir * sh * 8, -sh * (2 + (NB - b) * 1.6));
      ctx.rotate(dir * sh * 0.22);
      ctx.beginPath();
      const ya = y0 + b * bh, yb = ya + bh;
      ctx.moveTo(-18, b === 0 ? ya - 8 : edge(ya, 0));
      for (let i = 1; i <= 15; i++) ctx.lineTo(-18 + i * 2.4, b === 0 ? ya - 8 : edge(ya, i));
      for (let i = 15; i >= 0; i--) ctx.lineTo(-18 + i * 2.4, b === NB - 1 ? yb + 10 : edge(yb, i));
      ctx.closePath();
      ctx.clip();
      ctx.globalAlpha *= 1 - sh * b * 0.08;
      figure();
      ctx.restore();
    }
  }
  if (r.st === 'recover') tellRing(ctx, { ...r, st: 'windup', w: 0.6 + Math.sin(t * 9) * 0.1 }, 1.8, -6, 6, false);
  ctx.restore();
};

export { INK };
