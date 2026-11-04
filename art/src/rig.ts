/**
 * Marionnettes articulées du théâtre d'ombres.
 *
 * Une vraie marionnette d'ombre est faite de pièces découpées, épinglées entre elles par
 * de petits rivets ; on la fait jouer en tournant chaque pièce autour de son épingle.
 * Ce module donne ce vocabulaire aux « peintres » de personnages :
 *  - `begin(p)` lit la pose et prépare les grandeurs d'animation communes ;
 *  - `root(...)` place la marionnette (miroir selon le regard, recul quand touchée, chute à la mort) ;
 *  - `pin(...)` / `unpin(...)` ouvrent et ferment une pièce articulée (rivet découpé à l'épingle).
 *    À la mort (`dying` 0→1), chaque pièce se détache : elle saute, tourne et tombe ;
 *  - `holes`, `slits`, `almonds` : perforations de dentelle (la lumière traverse l'encre).
 *
 * Tout est dessiné en aplats (pas de flou, pas de dégradé, pas de canevas intermédiaire)
 * pour tenir 30 marionnettes à 60 i/s sur un téléphone.
 */
import { INK, INK2, CUT, DANGER, GOLD_LEAF, UI } from './palette.js';
import { mix, star, type Ctx } from './draw.js';

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
  /**
   * Détente juste après le tir / l'attaque : 1 au moment où le coup part, décroît vers 0 en ~0,25 s.
   * La marionnette « claque » vers l'avant (bras lancé, mâchoire fermée, lames refermées…).
   */
  release?: number;
  /** Coup reçu : 1 à l'impact, décroît vers 0 en ~0,3 s. Recul et bascule à l'opposé de `facing`. */
  hurt?: number;
  /**
   * Mort : 0→1 sur ~0,5 s. Les épingles sautent, les pièces se séparent, tournoient et tombent,
   * la marionnette s'efface sur le dernier tiers (à 1 elle est invisible).
   */
  dying?: number;
  /** Héroïne : 1 juste après avoir refermé une boucle de fil (coup de ciseaux), décroît vers 0 en ~0,5 s. */
  cutting?: number;
}

export type Painter = (ctx: Ctx, p: Pose) => void;

export const TAU = Math.PI * 2;
export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smooth = (x: number): number => {
  const k = clamp01(x);
  return k * k * (3 - 2 * k);
};
export const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

export function hash(a: number, b: number, c = 0): number {
  let h = (a * 374761393 + b * 668265263 + c * 2246822519) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Grandeurs d'animation communes, lues une fois par dessin. */
export interface Rig {
  t: number;
  /** +1 regarde à droite, -1 à gauche (la marionnette est retournée, comme au théâtre) */
  fx: number;
  /** angle de visée dans l'espace local retourné (0 = devant) */
  aim: number;
  /** phase propre à l'entité */
  ph: number;
  st: AnimState;
  move: boolean;
  charge: boolean;
  /** anticipation 0→1 (0 hors anticipation) et sa version adoucie */
  w: number;
  wE: number;
  rel: number;
  hurt: number;
  die: number;
  flash: number;
  /** encres déjà mêlées au flash d'impact */
  ink: string;
  ink2: string;
  C: (c: string) => string;
}

// état du dessin en cours (les peintres sont synchrones)
let DIE = 0;
let DN = 0;
let DSEED = 0;

export function begin(p: Pose): Rig {
  const fl = p.flash > 0 ? p.flash * 0.9 : 0;
  const C = fl > 0 ? (c: string) => mix(c, CUT, fl) : (c: string) => c;
  const cf = Math.cos(p.facing);
  const fx = cf < -0.1 ? -1 : 1;
  const w = p.state === 'windup' ? clamp01(p.windup) : 0;
  DIE = clamp01(p.dying ?? 0);
  DN = 0;
  DSEED = p.seed | 0;
  return {
    t: p.t,
    fx,
    aim: Math.atan2(Math.sin(p.facing), cf * fx),
    ph: (p.seed * 1.618) % TAU,
    st: p.state,
    move: p.state === 'move',
    charge: p.state === 'charge',
    w,
    wE: 1 - (1 - w) * (1 - w) * (1 - w),
    rel: clamp01(p.release ?? 0),
    hurt: clamp01(p.hurt ?? 0),
    die: DIE,
    flash: fl,
    ink: C(INK),
    ink2: C(INK2),
    C,
  };
}

/** Recul amorti : saute à l'impact puis oscille en s'éteignant. */
export function hurtWobble(h: number): number {
  return h * Math.cos((1 - h) * 7.5);
}

/**
 * Racine de la marionnette. `ground` : y des pieds (pivot du recul), `top` : y du sommet
 * (accroche du fil à l'apparition). Retourne la marionnette selon le regard.
 * À appeler entre ctx.save() et ctx.restore().
 */
export function root(ctx: Ctx, r: Rig, ground: number, top: number, flip = true): void {
  if (r.die > 0) {
    ctx.globalAlpha *= 1 - smooth((r.die - 0.62) / 0.38);
    ctx.translate(0, r.die * 5);
  }
  if (r.st === 'spawn') {
    // descendue au bout d'un fil, elle se balance encore
    ctx.save();
    ctx.strokeStyle = 'rgba(27,20,24,0.45)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(0, top);
    ctx.lineTo(0, top - 60);
    ctx.stroke();
    ctx.restore();
    ctx.translate(0, top);
    ctx.rotate(Math.sin(r.t * 6 + r.ph) * 0.14);
    ctx.translate(0, -top);
  }
  if (flip && r.fx < 0) ctx.scale(-1, 1);
  const hk = hurtWobble(r.hurt);
  const slump = r.st === 'recover' || r.st === 'breath' ? 1 : 0;
  const dieTilt = r.die > 0 ? (hash(DSEED, 7) - 0.5) * 1.4 * r.die : 0;
  const tilt = -hk * 0.3 + slump * 0.07 + dieTilt;
  if (tilt !== 0 || hk !== 0) {
    ctx.translate(-hk * 4, ground);
    ctx.rotate(tilt);
    ctx.translate(0, -ground);
  }
  if (slump) ctx.translate(0, 1.2);
}

/** Ouvre une pièce articulée : épingle en (x, y), rotation a. Fermer avec `unpin`. */
export function pin(ctx: Ctx, x: number, y: number, a: number): void {
  ctx.save();
  ctx.translate(x, y);
  if (DIE > 0) {
    const i = ++DN;
    const d = DIE;
    const hx = hash(i, DSEED, 1) - 0.5;
    const hy = hash(i, DSEED, 2);
    const hr = hash(i, DSEED, 3) - 0.5;
    ctx.translate(hx * 30 * d, -(6 + hy * 10) * d + 30 * d * d);
    a += hr * 6 * d;
  }
  if (a !== 0) ctx.rotate(a);
}

/** Ferme la pièce et pose son rivet découpé (rayon r ; 0 = pas de rivet). */
export function unpin(ctx: Ctx, r = 1.1): void {
  if (r > 0 && DIE < 0.2) rivet(ctx, 0, 0, r);
  ctx.restore();
}

/** Rivet : point de lumière à l'épingle (avec une tête d'encre s'il est assez grand). */
export function rivet(ctx: Ctx, x: number, y: number, r = 1.1): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = CUT;
  ctx.fill();
  if (r >= 1.5) {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.42, 0, TAU);
    ctx.fillStyle = INK;
    ctx.fill();
  }
}

/** Perforations rondes : triplets x, y, r — un seul remplissage. */
export function holes(ctx: Ctx, a: readonly number[], color: string = CUT): void {
  ctx.beginPath();
  for (let i = 0; i < a.length; i += 3) {
    ctx.moveTo(a[i] + a[i + 2], a[i + 1]);
    ctx.arc(a[i], a[i + 1], a[i + 2], 0, TAU);
  }
  ctx.fillStyle = color;
  ctx.fill();
}

/** Fentes : quadruplets x1, y1, x2, y2 — un seul trait. */
export function slits(ctx: Ctx, a: readonly number[], w = 1.1, color: string = CUT): void {
  ctx.beginPath();
  for (let i = 0; i < a.length; i += 4) {
    ctx.moveTo(a[i], a[i + 1]);
    ctx.lineTo(a[i + 2], a[i + 3]);
  }
  ctx.lineCap = 'round';
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.stroke();
}

/** Amandes (feuilles, pétales) : quintuplets x, y, longueur, angle, largeur. */
export function almonds(ctx: Ctx, a: readonly number[], color: string = CUT): void {
  ctx.beginPath();
  for (let i = 0; i < a.length; i += 5) {
    const x = a[i], y = a[i + 1], l = a[i + 2] / 2, an = a[i + 3], wd = a[i + 4];
    const c = Math.cos(an), s = Math.sin(an);
    ctx.moveTo(x - c * l, y - s * l);
    ctx.quadraticCurveTo(x - s * wd, y + c * wd, x + c * l, y + s * l);
    ctx.quadraticCurveTo(x + s * wd, y - c * wd, x - c * l, y - s * l);
  }
  ctx.fillStyle = color;
  ctx.fill();
}

/** Œil découpé en amande avec pupille (profil). */
export function eyeCut(ctx: Ctx, x: number, y: number, l: number, h: number, color: string = CUT, pupil = true, look = 0.3): void {
  almonds(ctx, [x, y, l, 0, h], color);
  if (pupil) {
    ctx.beginPath();
    ctx.arc(x + look * l * 0.5, y, h * 0.45, 0, TAU);
    ctx.fillStyle = INK;
    ctx.fill();
  }
}

/** Disque plein (sans contour). */
export function dot(ctx: Ctx, x: number, y: number, r: number, color: string): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill();
}

/** Polygone plein : x, y, x, y… */
export function poly(ctx: Ctx, a: readonly number[], color: string, stroke?: string, lw = 1.2): void {
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  for (let i = 2; i < a.length; i += 2) ctx.lineTo(a[i], a[i + 1]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  if (stroke) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.stroke();
  }
}

/** Membre en os/bâton : trait épais arrondi d'encre. */
export function limb(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, w: number, color: string): void {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineCap = 'round';
  ctx.lineWidth = w;
  ctx.strokeStyle = color;
  ctx.stroke();
}

/** Membre articulé : bâton d'encre traversé d'une fine entaille de lumière (sculpture du cuir). */
export function bone(ctx: Ctx, x1: number, y1: number, x2: number, y2: number, w: number, color: string): void {
  limb(ctx, x1, y1, x2, y2, w, color);
  if (w >= 2.2) {
    const dx = x2 - x1, dy = y2 - y1;
    limb(ctx, x1 + dx * 0.28, y1 + dy * 0.28, x1 + dx * 0.72, y1 + dy * 0.72, Math.min(0.8, w * 0.28), CUT);
  }
}

/** Ombre portée au sol (rétrécit pendant la chute). */
export function shadow(ctx: Ctx, r: Rig, rx: number, ry: number, y: number, a = 0.32): void {
  const k = 1 - r.die * 0.6;
  ctx.beginPath();
  ctx.ellipse(0, y, rx * k, ry * k, 0, 0, TAU);
  ctx.fillStyle = `rgba(27,20,24,${a * 0.55 * (1 - r.die * 0.5)})`;
  ctx.fill();
}

// ───────────────────────── Télégraphes (vermillon) ─────────────────────────

/** Anneau vermillon qui se resserre sur la source de l'attaque, avec un noyau qui grossit. */
export function tellRing(ctx: Ctx, r: Rig, x: number, y: number, rad: number, core = true): void {
  if (r.st !== 'windup') return;
  const k = r.w;
  ctx.save();
  ctx.strokeStyle = DANGER;
  ctx.lineWidth = 2.2;
  ctx.setLineDash([4, 3]);
  ctx.lineDashOffset = -r.t * 18;
  ctx.beginPath();
  ctx.arc(x, y, rad * (2.6 - k * 1.5), 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
  if (core) {
    ctx.beginPath();
    ctx.arc(x, y, rad * (0.3 + k * 0.4), 0, TAU);
    ctx.fillStyle = DANGER;
    ctx.fill();
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
}

/** Couleur d'un œil / d'une rune : lumière découpée, vermillon pendant l'anticipation. */
export function threat(r: Rig, from = 0.05): string {
  return r.w > from ? DANGER : CUT;
}

// ───────────────────────── Élites et boss ─────────────────────────

export function eliteAura(ctx: Ctx, p: Pose, r: number): void {
  if (!p.elite || (p.dying ?? 0) > 0) return;
  ctx.save();
  ctx.strokeStyle = GOLD_LEAF;
  ctx.lineWidth = 2.2;
  ctx.setLineDash([5, 6]);
  ctx.lineDashOffset = -p.t * 20;
  ctx.beginPath();
  ctx.ellipse(0, r * 0.65, r * 1.25, r * 0.5, 0, 0, TAU);
  ctx.stroke();
  ctx.restore();
}

/** Couronne d'or à la feuille, découpée de trois trous, posée sur une épingle. */
export function eliteCrown(ctx: Ctx, p: Pose, x: number, y: number, a = 0): void {
  if (!p.elite) return;
  pin(ctx, x, y + Math.sin(p.t * 3 + p.seed) * 0.8, a + Math.sin(p.t * 2.2 + p.seed) * 0.08);
  poly(ctx, [-7, 3, -7, -3, -3.5, 0.5, 0, -5.5, 3.5, 0.5, 7, -3, 7, 3], UI.gold, INK, 1.3);
  holes(ctx, [-4, 1.4, 0.8, 0, 0.6, 1, 4, 1.4, 0.8], INK);
  unpin(ctx, 0);
}

/** Boss essoufflé : étoiles découpées qui tournent (ouverture). */
export function dizzy(ctx: Ctx, p: Pose, y: number, rad = 16): void {
  if (p.state !== 'breath') return;
  for (let i = 0; i < 3; i++) {
    const a = p.t * 4 + (i * TAU) / 3;
    star(ctx, Math.cos(a) * rad, y + Math.sin(a) * 5, 4, 0.45);
    ctx.fillStyle = CUT;
    ctx.fill();
    ctx.lineWidth = 1;
    ctx.strokeStyle = INK;
    ctx.stroke();
  }
}

/** Petits marqueurs utilisés par plusieurs peintres. */
export { INK, INK2, CUT, DANGER, GOLD_LEAF };
