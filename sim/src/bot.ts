/**
 * §9 Bots : temps de réaction, précision d'esquive des télégraphes et politique
 * de choix des pouvoirs. Un bot ne « voit » une menace qu'après son temps de
 * réaction ; à la première vue, il tire au sort s'il l'esquivera (précision).
 */
import { HERO, CELL, ARENA_W, ARENA_H, COLS, ROWS, THREAD, GUST } from './constants.js';
import { BOSSES, ENEMIES, type MinionType, type PowerId } from './content.js';
import type { ChoiceContext, Controller } from './level.js';
import { Rng } from './rng.js';
import type { HeroInput, World, Hazard, Projectile, Enemy } from './world.js';

export type BotName = 'novice' | 'moyen' | 'expert';

export interface BotProfile {
  name: BotName;
  reaction: number;
  dodge: number;
  choice: 'random' | 'damage' | 'best';
}

export const BOTS: Record<BotName, BotProfile> = {
  novice: { name: 'novice', reaction: 0.32, dodge: 0.55, choice: 'random' },
  moyen: { name: 'moyen', reaction: 0.22, dodge: 0.75, choice: 'damage' },
  expert: { name: 'expert', reaction: 0.12, dodge: 0.95, choice: 'best' },
};

/** « Dégâts d'abord » : ordre de préférence du bot moyen. */
const DAMAGE_FIRST: PowerId[] = [
  // familles signature du Moine et du Sorcier glissées à leur rang : l'ordre relatif des pouvoirs de l'Éclaireuse
  // (les seuls qu'on lui propose) ne change pas
  'damage', 'keenGust', 'blaze', 'sharpScissors', 'echoCut', 'bigGust', 'wideTrail', 'attackSpeed', 'multishot', 'crit',
  'confetti', 'combustion', 'whirlwind', 'ricochet', 'chain', 'pierce', 'diagonals', 'flame', 'poison', 'furnace',
  'eliteSlayer', 'eyeOfStorm', 'barbedThread', 'longThread', 'liveEmbers', 'quickMomentum', 'steelThread', 'orb', 'frost',
  'maxHp', 'lifesteal', 'shield', 'featherStep', 'ashWard', 'speed', 'dodge', 'sideShots', 'rearShot', 'blast',
  'wallBounce', 'flashStep', 'magnet',
];

/**
 * Valeur estimée (bot expert) ; ajustée au contexte dans `bestChoice`. Les aiguilles ne sont plus que l'appoint
 * (DECISIONS #40) : les pouvoirs de tir valent moins que ceux qui renforcent les découpes.
 */
const VALUE: Record<PowerId, number> = {
  multishot: 5, ricochet: 5, attackSpeed: 5, damage: 8.5, chain: 5, crit: 7, diagonals: 4, pierce: 4,
  maxHp: 6.5, shield: 6.5, orb: 5.5, flame: 5.5, poison: 5.5, eliteSlayer: 4.5, sideShots: 3, frost: 5, blast: 4.5,
  dodge: 5, rearShot: 3, lifesteal: 4, wallBounce: 3, flashStep: 3.5, speed: 5, magnet: 2,
  sharpScissors: 8.5, echoCut: 9, longThread: 6.5, steelThread: 5.5, barbedThread: 4.5, confetti: 7,
  bigGust: 7, keenGust: 8.5, quickMomentum: 6, eyeOfStorm: 7, whirlwind: 7.5, featherStep: 6.5,
  liveEmbers: 6.5, blaze: 8.5, wideTrail: 7, combustion: 7.5, ashWard: 6, furnace: 8,
};

/** Directions des échantillons d'une boucle (cos, sin entrelacés). */
const RING_U = Float64Array.from({ length: 48 }, (_, i) => (i % 2 ? Math.sin : Math.cos)((Math.floor(i / 2) * 2 * Math.PI) / 24));
const DIRS = Array.from({ length: 16 }, (_, i) => ({ x: Math.cos((i * Math.PI) / 8), y: Math.sin((i * Math.PI) / 8) }));
/** Instants (s) des points de la trajectoire prévue ; le bot regarde ~0,9 s devant lui. */
const PLAN_T = [0, 0.1, 0.2, 0.35, 0.5, 0.7, 0.9];
const HORIZON = PLAN_T[PLAN_T.length - 1];
/** Les contacts se prévoient moins loin : on a le temps de s'écarter d'un poursuivant plus tard. */
const CONTACT_HORIZON = 0.5;
/** Prime à l'immobilité : tir manuel (on ne tire qu'à l'arrêt) / tir auto permanent (simple anti-agitation). */
const STAY_BONUS_MANUAL = 1.2;
const STAY_BONUS_AUTOFIRE = 0.2;
/** Indice de PLAN_T où s'arrête un « pas de côté » (on bouge 0,2 s puis on se fige pour tirer). */
const STEP_END = 2;

type Pt = { x: number; y: number };
const NP = PLAN_T.length;

// ───────────────────────── Ciseaux de lune : boucles ─────────────────────────
const TAU = Math.PI * 2;
/**
 * Orbite : rayon r + A sin(ω σ) (σ = angle balayé). Avec ω demi-entier, deux tours successifs sont symétriques
 * et se croisent tous les π/ω rad : la boucle se ferme au plus ~0,9 rad après un tour complet, quel que soit
 * l'endroit où le fil a été coupé (on continue simplement de tourner).
 */
const LOOP_WOBBLE = 6;
const LOOP_FREQ = 3.5;
const LOOP_EXTRA = Math.PI / LOOP_FREQ;
/** Rayon minimal d'une boucle (aire ≫ THREAD.minArea) et approche maximale (pt). */
const LOOP_MIN_R = 36;
const LOOP_MAX_APPROACH = 700;
/** Préférence pour la boucle face aux autres trajectoires (en unités de score : danger × 10 + confort). */
const LOOP_BONUS = 2.5;
/** Valeur minimale d'une boucle (dégâts utiles par seconde de boucle). */
const LOOP_MIN_VALUE = 1;
/** Planification toutes les N décisions (N × 1/15 s) sans orbite ; re-planification (avec hystérésis) en orbite. */
const LOOP_PLAN_EVERY = 6;
/** Ennemis les plus proches examinés comme centres d'orbite. */
const LOOP_SEEDS = 6;
const LOOP_REPLAN_EVERY = 24;
/** Une autre orbite ne remplace l'orbite en cours que si elle vaut nettement plus. */
const LOOP_KEEP = 1.5;
/** Chances plancher de l'orbite en cours (une coupure ne fait que retarder la découpe). */
const LOOP_KEEP_ODDS = 0.2;
const LOOP_ODDS_FLOOR = 0.03;
/** Distance au cercle à partir de laquelle on passe de l'approche à l'orbite (la poursuite rattrape l'écart). */
const LOOP_CATCH = 24;
/** Suivi du centre en orbite (pt par décision, 1/15 s). */
const LOOP_TRACK = 4;
/** Rayon minimal autour d'un tireur visé (gobelin, squelette). */
const LOOP_SHOOTER_R = 46;
/**
 * Rayon minimal par type : tireurs visés (le tir à bout portant doit passer derrière l'héroïne qui tourne) et
 * anneaux (champignon 8 spores, totem 6 runes : assez d'écart entre deux projectiles pour s'y glisser).
 */
const LOOP_TYPE_R: Partial<Record<string, number>> = { goblin: LOOP_SHOOTER_R, skeleton: 76, mushroom: 66, totem: 58, weaver: LOOP_SHOOTER_R, puppeteer: 56, specter: 60 };
/** Points de la boucle (sur LOOP_K) qui peuvent tomber dans un obstacle ou hors de l'arène. */
const LOOP_RING_SLACK = 3;
/**
 * Boucle « en étoile » (DECISIONS #43) : un rayon par angle (LOOP_K échantillons). Là où le cercle de base
 * traverse un obstacle, la boucle s'en écarte vers l'extérieur (LOOP_BULGE pt de plus) et l'englobe.
 */
const LOOP_K = 24;
const LOOP_BULGE = [0, 12, 24, 36, 50, 66];
const SIM_STEP = 0.05;
const SIM_STEPS = Math.round(PLAN_T[PLAN_T.length - 1] / SIM_STEP);
/** Tireurs qui gardent leurs distances (reculent quand on approche). */
const RANGED = new Set(['goblin', 'skeleton', 'mage', 'weaver', 'puppeteer']);
const CHASERS = new Set(['jelly', 'jellySmall', 'wolf', 'snipper', 'bat', 'moth', 'beetle', 'shade', 'lantern']);
/**
 * Jamais au centre d'une boucle : la mite (elle file vers le fil et le mange : on l'abat aux aiguilles, sauf
 * avec le Fil d'acier) et le squelette (éventail de 3 flèches à bout portant : on le laisse aux aiguilles).
 */
const LOOP_SKIP = new Set(['moth']);
function loopSkip(e: Enemy, steel: boolean): boolean {
  return LOOP_SKIP.has(e.type) && !(steel && e.type === 'moth');
}

interface LoopState {
  circling: boolean;
  /** angle balayé depuis le début du cercle (rad, dans le sens de rotation) */
  sw: number;
  lastAng: number;
}

/** Orbite planifiée : un cercle (centre, rayon moyen, sens) autour d'un groupe d'ennemis. */
interface LoopPlan extends LoopState {
  cx: number;
  cy: number;
  r: number;
  dir: 1 | -1;
  members: Enemy[];
  /** angle du point d'entrée */
  a0: number;
  cuts0: number;
  /** dernière découpe (ou début de l'orbite) */
  since: number;
  /** durée d'un tour + croisement (s) */
  lap: number;
  value: number;
  counted: boolean;
  /** décalage du centre par rapport au barycentre des cibles (loin des murs), suivi en continu */
  ox: number;
  oy: number;
  /** rayon par angle (LOOP_K échantillons, angle k × 2π / LOOP_K), ≥ r */
  rk: Float64Array;
  /** centre et rayon de base du dernier calcul de `rk` */
  fx: number;
  fy: number;
  fr: number;
}

/** Instrumentation des boucles d'un bot (une partie). */
export interface LoopStats {
  planned: number;
  started: number;
  cut: number;
  snipped: number;
  aborted: number;
  missed: number;
}

interface RingFit {
  hit: number;
  bx: number;
  by: number;
  len: number;
}

/** Le point de la boucle à l'angle k, au rayon R (± ondulation), est-il praticable ? */
function ringFree(w: World, cx: number, cy: number, R: number, k: number): boolean {
  const m = HERO.radius + 2;
  const ux = RING_U[2 * k];
  const uy = RING_U[2 * k + 1];
  for (let s = -1; s <= 1; s += 2) {
    const q = R + s * LOOP_WOBBLE;
    const x = cx + ux * q;
    const y = cy + uy * q;
    if (x < m || y < m || x > ARENA_W - m || y > ARENA_H - m || clearAt(w, x, y) < m) return false;
  }
  return true;
}

/** Rayon de la boucle à l'angle `a` (interpolation des échantillons). */
function radiusAt(pl: LoopPlan, a: number): number {
  let u = (a / TAU) * LOOP_K;
  u = ((u % LOOP_K) + LOOP_K) % LOOP_K;
  const i = Math.floor(u);
  const f = u - i;
  return pl.rk[i % LOOP_K] * (1 - f) + pl.rk[(i + 1) % LOOP_K] * f;
}

function loopRadius(pl: LoopPlan, a: number, s: number): number {
  return radiusAt(pl, a) + LOOP_WOBBLE * Math.sin(LOOP_FREQ * s);
}

/** Orbite « la même » : même sens, cibles communes, centre proche. */
function sameOrbit(pl: LoopPlan, cx: number, cy: number, dir: 1 | -1, members: Enemy[]): boolean {
  return pl.dir === dir && Math.hypot(pl.cx - cx, pl.cy - cy) < 45 && members.some((m) => pl.members.includes(m));
}

/**
 * Angle du point d'entrée sur le cercle : point de tangence (depuis l'extérieur) d'où l'on repart dans le sens
 * `dir` ; depuis l'intérieur, un point un peu en avant dans ce sens.
 */
function entryAngle(cx: number, cy: number, r: number, dir: 1 | -1, x: number, y: number): number {
  const dx = x - cx;
  const dy = y - cy;
  const d = Math.hypot(dx, dy);
  const ah = d > 1 ? Math.atan2(dy, dx) : -Math.PI / 2;
  if (d <= r + 8) return ah + dir * 0.5;
  // tangente : l'angle au centre entre le héros et le point de tangence vaut acos(r / d)
  return ah + dir * Math.acos(r / d);
}

/** Direction de suivi (poursuite d'un point du cercle un peu en avant) ; fait avancer l'état `st`. */
function loopStep(pl: LoopPlan, st: LoopState, x: number, y: number, out: Pt): void {
  const dx = x - pl.cx;
  const dy = y - pl.cy;
  const d = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx);
  if (!st.circling) {
    const ra = radiusAt(pl, ang);
    if (d > ra + LOOP_CATCH || d < ra - LOOP_CATCH) {
      // approche vers le point d'entrée tangent (recalculé : le centre suit les cibles)
      const a0 = entryAngle(pl.cx, pl.cy, pl.r, pl.dir, x, y);
      const r0 = radiusAt(pl, a0);
      const ex = pl.cx + Math.cos(a0) * r0 - x;
      const ey = pl.cy + Math.sin(a0) * r0 - y;
      const n = Math.hypot(ex, ey) || 1;
      out.x = ex / n;
      out.y = ey / n;
      return;
    }
    st.circling = true;
    st.sw = 0;
    st.lastAng = ang;
  }
  let da = ang - st.lastAng;
  if (da > Math.PI) da -= TAU;
  else if (da < -Math.PI) da += TAU;
  st.sw += pl.dir * da;
  st.lastAng = ang;
  const delta = Math.min(0.6, Math.max(0.2, 26 / pl.r));
  const ta = ang + pl.dir * delta;
  const rr = loopRadius(pl, ta, st.sw + delta);
  const tx = pl.cx + Math.cos(ta) * rr - x;
  const ty = pl.cy + Math.sin(ta) * rr - y;
  const n = Math.hypot(tx, ty) || 1;
  out.x = tx / n;
  out.y = ty / n;
}

/**
 * Bot « joueur compétent » : perçoit les menaces après son temps de réaction et
 * n'esquive que celles que sa précision lui accorde (tirage unique par menace).
 * En dehors de ce filtre, il joue proprement : prédiction exacte des trajectoires
 * (approche minimale analytique), pas de côté puis arrêt pour tirer, distance de
 * sécurité avec les ennemis au contact, évitement des coins, recherche de ligne de
 * vue et détection de blocage. Ciseaux de lune (DECISIONS #30) : il trace des boucles
 * comme un joueur compétent — orbites autour d'un ennemi ou d'un groupe, choisies par
 * dégâts utiles × chances de fermeture (mites, charges du crabe, flaques, motifs du
 * boss : DECISIONS #39) ; le modèle de danger garde la priorité. La compétence
 * de boucle est commune aux trois bots (comme le déplacement).
 */
export class Bot implements Controller {
  private rng: Rng;
  private seen = new WeakMap<object, boolean>();
  /** décision d'esquive par attaque : clé (tireur, instant) */
  private attacks = new Map<string, boolean>();
  private held: HeroInput = { mx: 0, my: 0, touching: false };
  private tick = 0;
  private noLosTime = 0;
  private stuckT = 0;
  /** tirs consécutifs sans toucher (flèches qui butent sur un obstacle malgré une « ligne de vue ») */
  private missedShots = 0;
  private lastPos: Pt = { x: 0, y: 0 };
  /** trajectoires prévues : [0] immobile, [1..16] marche dans DIRS[k−1] ; x,y entrelacés aux instants PLAN_T */
  private readonly paths = Array.from({ length: DIRS.length + 1 }, () => new Float64Array(NP * 2));
  // menaces perçues (tableaux réutilisés)
  private th: number[] = [];
  private ch: number[] = [];
  /** tirs armés : (x, y, tFire, vitesse, rayon de contact, dégâts, nombre, écart angulaire) */
  private pend: number[] = [];
  private chE: Enemy[] = [];
  /** vitesses observées des ennemis (position à la décision précédente) */
  private vel = new Map<number, { x: number; y: number; vx: number; vy: number; t: number }>();
  private zs: Hazard[] = [];
  private chasers: Enemy[] = [];
  private readonly probe: Pt = { x: 0, y: 0 };
  /** position / vitesse pour lesquelles `paths` est à jour (le héros est souvent immobile) */
  private pathKey = { x: NaN, y: NaN, s: NaN, arena: null as unknown };
  /** Ciseaux de lune */
  private plan: LoopPlan | null = null;
  private planCd = 0;
  private readonly loopPath = new Float64Array(NP * 2);
  private readonly simSt: LoopState = { circling: false, sw: 0, lastAng: 0 };
  private readonly ldir: Pt = { x: 0, y: 0 };
  private readonly rkTmp = new Float64Array(LOOP_K);
  private readonly rkTmp2 = new Float64Array(LOOP_K);
  private readonly rkCand = new Float64Array(LOOP_K);
  private readonly fit: RingFit = { hit: 0, bx: 0, by: 0, len: 0 };
  /** Diagnostic (outils) : compte les raisons de rejet des cercles candidats quand `diagnostics` est vrai. */
  diagnostics = false;
  readonly rej: Record<string, number> = {};
  private rjv(k: string): void {
    if (this.diagnostics) this.rej[k] = (this.rej[k] ?? 0) + 1;
  }
  /** le dernier calcul de chances a vu un motif du boss tomber pendant la boucle (orbite proche du boss) */
  private bossRisk = false;
  readonly loops: LoopStats = { planned: 0, started: 0, cut: 0, snipped: 0, aborted: 0, missed: 0 };

  constructor(readonly profile: BotProfile, seed: number) {
    this.rng = new Rng(seed);
  }

  beginRoom(): void {
    this.vel.clear();
    this.plan = null;
    this.planCd = 0;
    this.seen = new WeakMap();
    this.attacks.clear();
    this.held = { mx: 0, my: 0, touching: false };
    this.noLosTime = 0;
    this.stuckT = 0;
    this.missedShots = 0;
  }

  /** La menace est-elle perçue (réaction écoulée) et sera-t-elle esquivée ? */
  private aware(obj: Projectile | Hazard, now: number): boolean {
    if (now - obj.born < this.profile.reaction) return false;
    let v = this.seen.get(obj);
    if (v === undefined) {
      // un tirage par attaque télégraphiée (éventail, anneau, pluie…), pas par projectile
      const key = obj.ownerId !== undefined ? ('activeAt' in obj ? 'z' : 'p') + obj.ownerId + ':' + obj.born : null;
      const g = key !== null ? this.attacks.get(key) : undefined;
      v = g ?? this.rng.chance(this.profile.dodge);
      if (key !== null && g === undefined) this.attacks.set(key, v);
      this.seen.set(obj, v);
    }
    return v;
  }

  input(w: World): HeroInput {
    // sans tir auto, un déplacement redonne sa chance à la nouvelle position
    if (w.hero.moving && !w.hero.autoFire) this.missedShots = 0;
    for (const ev of w.events) {
      if (ev.e === 'shoot') this.missedShots++;
      else if (ev.e === 'hit') this.missedShots = 0;
      // brûlé par une zone qu'il n'avait pas vue : il la voit maintenant (on sort d'une flaque)
      else if (ev.e === 'heroHit' && ev.ref && (ev.src ?? '').startsWith('zone')) this.seen.set(ev.ref, true);
    }
    this.tick++;
    if (this.tick % 2 === 0) return this.held;
    this.held = this.decide(w);
    return this.held;
  }

  /** Trajectoire du héros s'il marche dans `dir` (glisse le long des obstacles comme la simulation). */
  private fillPath(w: World, out: Float64Array, dir: Pt | null, speed: number, clear = 0): void {
    const h = w.hero.pos;
    const p = { x: h.x, y: h.y };
    out[0] = p.x;
    out[1] = p.y;
    // tant que la distance parcourue reste sous `clear`, aucun obstacle ne peut être touché
    const freeT = dir ? clear / speed : 0;
    for (let i = 1; i < NP; i++) {
      if (dir && PLAN_T[i] <= freeT) {
        p.x = h.x + dir.x * speed * PLAN_T[i];
        p.y = h.y + dir.y * speed * PLAN_T[i];
      } else if (dir) {
        let t = PLAN_T[i - 1];
        while (t < PLAN_T[i] - 1e-9) {
          const dt = Math.min(0.1, PLAN_T[i] - t);
          const dx = dir.x * speed * dt;
          const dy = dir.y * speed * dt;
          // segment dégagé : déplacement rectiligne (identique à moveCircle sans collision)
          if (sweptFree(w, p.x, p.y, p.x + dx, p.y + dy)) {
            p.x += dx;
            p.y += dy;
          } else w.arena.moveCircle(p, dx, dy, HERO.radius);
          t += dt;
        }
      }
      out[2 * i] = p.x;
      out[2 * i + 1] = p.y;
    }
  }

  /** Danger d'une trajectoire (immobile à partir de l'indice `stop`). */
  private danger(pts: Float64Array, stop: number, now: number, loop = false, members: Enemy[] | null = null): number {
    const skip = loop;
    let d = 0;
    const th = this.th;
    for (let k = 0; k < th.length; k += 7) {
      const px = th[k], py = th[k + 1], tvx = th[k + 2], tvy = th[k + 3], rr = th[k + 4], life = th[k + 5], dmg = th[k + 6];
      const soft = rr + 10;
      for (let i = 1; i < NP; i++) {
        const t0 = PLAN_T[i - 1];
        if (t0 > life) break;
        const t1 = PLAN_T[i] < life ? PLAN_T[i] : life;
        const ia = (i - 1 < stop ? i - 1 : stop) * 2;
        const ib = (i < stop ? i : stop) * 2;
        const ax = pts[ia], ay = pts[ia + 1];
        const span = PLAN_T[i] - t0;
        const hvx = (pts[ib] - ax) / span;
        const hvy = (pts[ib + 1] - ay) / span;
        const rx = px + tvx * t0 - ax;
        const ry = py + tvy * t0 - ay;
        const vx = tvx - hvx;
        const vy = tvy - hvy;
        const v2 = vx * vx + vy * vy;
        let tau = v2 > 1e-9 ? -(rx * vx + ry * vy) / v2 : 0;
        const tl = t1 - t0;
        tau = tau < 0 ? 0 : tau > tl ? tl : tau;
        const mx = rx + vx * tau;
        const my = ry + vy * tau;
        const m2 = mx * mx + my * my;
        if (m2 < soft * soft) {
          const wgt = dmg / (t0 + tau + 0.15);
          if (m2 < rr * rr) {
            d += wgt;
            break;
          }
          d += wgt * 0.15 * (1 - (Math.sqrt(m2) - rr) / 10);
        }
      }
    }
    // tirs armés (télégraphe visible) : le projectile partira dans tFire vers la position de l'héroïne à cet instant
    const pend = this.pend;
    for (let k = 0; k < pend.length; k += 8) {
      const ex = pend[k], ey = pend[k + 1], tf = pend[k + 2], sp = pend[k + 3], rr = pend[k + 4], dmg = pend[k + 5], n = pend[k + 6], spread = pend[k + 7];
      if (tf >= HORIZON) continue;
      // position visée : la trajectoire à l'instant du tir (interpolée)
      let i1 = 1;
      while (i1 < NP - 1 && PLAN_T[i1] < tf) i1++;
      const ja = (i1 - 1 < stop ? i1 - 1 : stop) * 2;
      const jb = (i1 < stop ? i1 : stop) * 2;
      const f = (tf - PLAN_T[i1 - 1]) / (PLAN_T[i1] - PLAN_T[i1 - 1]);
      const ax = pts[ja] + (pts[jb] - pts[ja]) * f;
      const ay = pts[ja + 1] + (pts[jb + 1] - pts[ja + 1]) * f;
      const base = Math.atan2(ay - ey, ax - ex);
      for (let q = 0; q < n; q++) {
        const ang = base + (q - (n - 1) / 2) * spread;
        const tvx = Math.cos(ang) * sp;
        const tvy = Math.sin(ang) * sp;
        // projectile virtuel parti de (ex, ey) à tf : p(t) = e + v (t − tf)
        const px = ex - tvx * tf;
        const py = ey - tvy * tf;
        for (let i = i1; i < NP; i++) {
          const t0 = Math.max(tf, PLAN_T[i - 1]);
          const ia = (i - 1 < stop ? i - 1 : stop) * 2;
          const ib = (i < stop ? i : stop) * 2;
          const span = PLAN_T[i] - PLAN_T[i - 1];
          const hvx = (pts[ib] - pts[ia]) / span;
          const hvy = (pts[ib + 1] - pts[ia + 1]) / span;
          const hx0 = pts[ia] + hvx * (t0 - PLAN_T[i - 1]);
          const hy0 = pts[ia + 1] + hvy * (t0 - PLAN_T[i - 1]);
          const rx = px + tvx * t0 - hx0;
          const ry = py + tvy * t0 - hy0;
          const vx = tvx - hvx;
          const vy = tvy - hvy;
          const v2 = vx * vx + vy * vy;
          let tau = v2 > 1e-9 ? -(rx * vx + ry * vy) / v2 : 0;
          const tl = PLAN_T[i] - t0;
          tau = tau < 0 ? 0 : tau > tl ? tl : tau;
          const mx = rx + vx * tau;
          const my = ry + vy * tau;
          if (mx * mx + my * my < rr * rr) {
            d += dmg / (t0 + tau + 0.15);
            break;
          }
        }
      }
    }
    // (l'instant 0 est commun à toutes les trajectoires : il ne départage rien)
    for (const z of this.zs) {
      for (let i = 1; i < NP; i++) {
        const t = now + PLAN_T[i];
        if (t < z.activeAt - 0.12 || t > z.endAt + 0.05) continue;
        const j = (i < stop ? i : stop) * 2;
        const x = pts[j], y = pts[j + 1];
        let hit = false;
        if (z.kind === 'circle') {
          const rr = z.radius + HERO.radius * 0.5 + 8;
          hit = (z.pos.x - x) ** 2 + (z.pos.y - y) ** 2 < rr * rr;
        } else if (z.to) {
          const rr = z.radius + HERO.radius + 8;
          hit = segDist2(x, y, z.pos.x, z.pos.y, z.to.x, z.to.y) < rr * rr;
        }
        if (hit) {
          d += Math.max(z.dmg, 80) / (PLAN_T[i] + 0.15);
          break;
        }
      }
    }
    const ch = this.ch;
    const chE = this.chE;
    for (let k = 0; k < ch.length; k += 7) {
      const ex = ch[k], ey = ch[k + 1], sp = ch[k + 2], rr = ch[k + 3], delay = ch[k + 4], contact = ch[k + 5];
      // en orbite, les cibles entourées restent dedans (le centre les suit, la marge du rayon exclut le contact)
      if (members && !CHASERS.has(chE[k / 7].type) && members.includes(chE[k / 7])) continue;
      let first = true;
      // boucle : le poursuivant marche vers la position actuelle de l'héroïne (elle tourne, il ne peut pas couper
      // n'importe où) ; sinon, modèle prudent « tout point à portée »
      let ux = 0;
      let uy = 0;
      if (skip) {
        const dn = Math.hypot(pts[0] - ex, pts[1] - ey) || 1;
        ux = ((pts[0] - ex) / dn) * sp * ch[k + 6];
        uy = ((pts[1] - ey) / dn) * sp * ch[k + 6];
      }
      for (let i = 1; i < NP; i++) {
        const t = PLAN_T[i];
        if (t > CONTACT_HORIZON) break;
        if (t < delay) continue;
        const j = (i < stop ? i : stop) * 2;
        const te = t - delay;
        const dx = pts[j] - ex - ux * te;
        const dy = pts[j + 1] - ey - uy * te;
        const lim = skip ? rr - 4 : rr + sp * te;
        if (dx * dx + dy * dy < lim * lim) {
          // premier contact prévu : plein poids ; rester au contact ensuite : poids réduit
          d += (first ? contact : contact * 0.3) / (t + 0.15);
          first = false;
        }
      }
    }
    return d;
  }

  private decide(w: World): HeroInput {
    const h = w.hero;
    const hp = h.pos;
    const speed = h.stats.speed;
    const now = w.t;

    // salle terminée : aller au portail
    if (w.cleared) {
      const dir = w.arena.steer(hp, w.arena.portal);
      return { mx: dir.x, my: dir.y, touching: true };
    }

    // blocage : le héros voulait bouger mais n'a pas avancé
    const mdx = hp.x - this.lastPos.x;
    const mdy = hp.y - this.lastPos.y;
    this.stuckT = this.held.touching && mdx * mdx + mdy * mdy < (speed * 0.02) ** 2 ? this.stuckT + 2 / 30 : 0;
    this.lastPos.x = hp.x;
    this.lastPos.y = hp.y;

    // menaces perçues (élaguées : hors de portée de toute trajectoire possible)
    const reach = speed * HORIZON;
    const th = this.th;
    th.length = 0;
    for (const p of w.projectiles) {
      if (p.fromHero || !this.aware(p, now)) continue;
      const rr = HERO.radius + p.radius + 3;
      const lim = reach + rr + 10;
      // élagage grossier sur tout l'horizon, puis durée de vie réelle (obstacles) pour les survivants
      if (segDist2(hp.x, hp.y, p.pos.x, p.pos.y, p.pos.x + p.vel.x * HORIZON, p.pos.y + p.vel.y * HORIZON) > lim * lim) continue;
      const life = shotLife(w, p);
      th.push(p.pos.x, p.pos.y, p.vel.x, p.vel.y, rr, life, p.dmg);
    }
    // tirs armés (gobelin, squelette) : l'armement est un télégraphe, perçu après le temps de réaction et esquivé
    // selon la précision (un tirage par attaque, comme les autres télégraphes)
    const pend = this.pend;
    pend.length = 0;
    for (const e of w.enemies) {
      if (e.state !== 'windup' || (e.type !== 'goblin' && e.type !== 'skeleton')) continue;
      const since = 0.5 - e.t;
      if (since < this.profile.reaction) continue;
      const key = 'w' + e.id + ':' + Math.round((now - since) * 30);
      let ok = this.attacks.get(key);
      if (ok === undefined) this.attacks.set(key, (ok = this.rng.chance(this.profile.dodge)));
      if (!ok) continue;
      const sk = e.type === 'skeleton';
      pend.push(e.pos.x, e.pos.y, e.t, sk ? 340 : 300, HERO.radius + (sk ? 6 : 7) + 3, e.shotDmg, sk ? 3 : 1, (15 * Math.PI) / 180);
    }
    const zs = this.zs;
    zs.length = 0;
    for (const z of w.hazards) {
      if (z.endAt < now || z.activeAt > now + HORIZON + 0.1) continue;
      if (!this.aware(z, now)) continue;
      zs.push(z);
    }
    const ch = this.ch;
    ch.length = 0;
    this.chE.length = 0;
    const chasers = this.chasers;
    chasers.length = 0;
    for (const e of w.enemies) {
      if (e.contact <= 0) continue;
      chasers.push(e);
      let sp = e.state === 'charge' ? 0 : e.speed * (e.slowT > 0 ? 0.7 : 1);
      // la chauve-souris ralentit près du héros (×0,4) : sa menace réelle est le piqué (télégraphié)
      if (e.type === 'bat' && e.state !== 'spawn') sp *= 0.4;
      const rr = e.radius + HERO.radius + 6;
      const lim = reach + rr + sp * CONTACT_HORIZON;
      if ((e.pos.x - hp.x) ** 2 + (e.pos.y - hp.y) ** 2 > lim * lim) continue;
      // sens du déplacement prévu en boucle : les tireurs reculent quand l'héroïne s'approche, les autres foncent
      const flee = RANGED.has(e.type) ? -1 : 1;
      ch.push(e.pos.x, e.pos.y, sp, rr, e.state === 'spawn' ? e.t : 0, e.contact, flee);
      this.chE.push(e);
    }

    // vitesses observées (pour prévoir où vont les cibles d'une boucle)
    for (const e of w.enemies) {
      const o = this.vel.get(e.id);
      if (!o) this.vel.set(e.id, { x: e.pos.x, y: e.pos.y, vx: 0, vy: 0, t: now });
      else if (now > o.t) {
        const dt = now - o.t;
        o.vx = (e.pos.x - o.x) / dt;
        o.vy = (e.pos.y - o.y) / dt;
        o.x = e.pos.x;
        o.y = e.pos.y;
        o.t = now;
      }
    }

    // Ciseaux de lune : suivre la boucle en cours (ou en planifier une) tant que le danger le permet
    let loopScore = Infinity;
    // les boucles ne servent qu'aux Ciseaux de lune (DECISIONS #74)
    const lp = h.kind === 'thread' ? this.loopTick(w) : null;
    if (lp) {
      loopStep(lp, lp, hp.x, hp.y, this.ldir);
      // approche sans ligne droite jusqu'au cercle : on contourne l'obstacle
      if (!lp.circling) {
        const a0 = entryAngle(lp.cx, lp.cy, lp.r, lp.dir, hp.x, hp.y);
        const r0 = radiusAt(lp, a0);
        const ent = { x: lp.cx + Math.cos(a0) * r0, y: lp.cy + Math.sin(a0) * r0 };
        if (!w.arena.lineOfWalk(hp, ent) && walkable(w, ent.x, ent.y)) {
          const d = w.arena.steer(hp, ent);
          this.ldir.x = d.x;
          this.ldir.y = d.y;
        }
      }
      if (lp.circling && !lp.counted) {
        lp.counted = true;
        this.loops.started++;
      }
      this.fillLoopPath(lp, hp.x, hp.y, speed);
      // en boucle, les poursuivants marchent vers l'héroïne qui tourne (modèle orienté, pas « tout point à portée »)
      const ld = this.danger(this.loopPath, NP - 1, now, true, lp.circling ? lp.members : null);
      if (ld === 0) return { mx: this.ldir.x, my: this.ldir.y, touching: this.ldir.x !== 0 || this.ldir.y !== 0 };
      loopScore = ld * 10 - LOOP_BONUS;
      // menace sur l'orbite (un poursuivant non entouré s'en approche, un tir…) : on re-planifie vite
      if (lp.circling && this.planCd < LOOP_REPLAN_EVERY - 6) this.planCd = LOOP_REPLAN_EVERY - 1;
    }

    // ligne de vue vers une cible
    const tgt = w.target;
    const losOk = tgt ? w.arena.lineOfSight(hp, tgt.pos) : true;
    this.noLosTime = tgt && !losOk ? this.noLosTime + 2 / 30 : 0;
    const noProgress = losOk && this.missedShots >= 4;
    const wantLos = this.noLosTime > 0.4 || noProgress;
    const goalDir = wantLos && tgt ? w.arena.steer(hp, tgt.pos) : null;

    /** Confort de la position finale : loin des ennemis au contact, des coins, et avec une ligne de vue. */
    const placeCost = (x: number, y: number, dir: Pt | null): number => {
      let c = edgePenalty(x, y);
      for (const e of w.enemies) {
        // tireurs : garder du recul pour avoir le temps de voir venir (anneaux des fixes, éventails des archers)
        const far = e.type === 'mushroom' || e.type === 'totem' ? 125 : e.type === 'skeleton' ? 170 : e.type === 'goblin' ? 140 : 0;
        if (far <= 0) continue;
        const dx = x - e.pos.x;
        const dy = y - e.pos.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < far * far) c += ((far - Math.sqrt(d2)) / far) * 1.2;
      }
      for (const e of chasers) {
        if (e.speed <= 0 && e.state !== 'charge') continue;
        // distance de confort ≈ ce que l'ennemi parcourt en ~1 s (les tireurs gardent d'eux-mêmes leurs distances)
        const ranged = RANGED.has(e.type);
        const keep = e.radius + HERO.radius + (ranged ? 30 : 25 + e.speed);
        const dx = x - e.pos.x;
        const dy = y - e.pos.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < keep * keep) c += ((keep - Math.sqrt(d2)) / keep) * 3;
      }
      if (wantLos && tgt) {
        this.probe.x = x;
        this.probe.y = y;
        if (noProgress || !w.arena.lineOfSight(this.probe, tgt.pos)) c += 1.5;
      }
      if (goalDir && dir) c -= (dir.x * goalDir.x + dir.y * goalDir.y) * 1.2;
      // Moine : élan chargé, se rapprocher d'un ennemi (sans aller au contact) pour la bourrasque
      if (h.kind === 'gust' && h.momentum >= 0.45 && dir) {
        let bd = Infinity;
        for (const e of w.enemies) {
          if (e.state === 'spawn') continue;
          const d = Math.hypot(e.pos.x - x, e.pos.y - y) - e.radius;
          if (d < bd) bd = d;
        }
        if (bd < 240) c -= 0.8 * Math.min(1, Math.max(0, (240 - bd) / 150));
      }
      // Sorcier : frôler les ennemis au sol (à ~40 pt) pour poser des braises sous leurs pieds
      if (h.kind === 'ember' && dir) {
        let bd = Infinity;
        for (const e of w.enemies) {
          if (e.state === 'spawn' || e.flying) continue;
          const d = Math.abs(Math.hypot(e.pos.x - x, e.pos.y - y) - e.radius - 40);
          if (d < bd) bd = d;
        }
        if (bd < 160) c -= 0.6 * (1 - bd / 160);
      }
      return c;
    };

    const pk = this.pathKey;
    const fresh = !(pk.x === hp.x && pk.y === hp.y && pk.s === speed && pk.arena === w.arena);
    if (fresh) {
      pk.x = hp.x;
      pk.y = hp.y;
      pk.s = speed;
      pk.arena = w.arena;
      const clear = clearance(w, hp.x, hp.y, reach + CELL) - HERO.radius - 0.5;
      this.fillPath(w, this.paths[0], null, speed);
      for (let k = 0; k < DIRS.length; k++) this.fillPath(w, this.paths[k + 1], DIRS[k], speed, clear);
    }
    const stay = this.paths[0];
    const stayD = this.danger(stay, 0, now);
    const stayC = placeCost(hp.x, hp.y, null);
    // Moine du vent : élan chargé et ennemis à portée de bourrasque → s'arrêter (si l'arrêt est sûr)
    if (h.kind === 'gust' && h.moving && h.momentum >= 0.55 && h.gustCd <= 0 && stayD < 0.05) {
      const r = (GUST.radius + GUST.radiusPerMomentum * h.momentum) * h.stats.gustRadiusMult - 8;
      let inR = 0;
      for (const e of w.enemies) if (e.state !== 'spawn' && Math.hypot(e.pos.x - hp.x, e.pos.y - hp.y) < r + e.radius) inR++;
      if (inR >= 1) return { mx: 0, my: 0, touching: false };
    }
    // Sorcier de braise : il ne sème des braises qu'en marchant, il préfère tourner autour des poursuivants
    const emberRun = h.kind === 'ember' && w.enemies.some((e) => e.contact > 0 && e.speed > 0 && !e.flying);
    if (stayD === 0 && stayC < 0.5 && !wantLos && !lp && !emberRun) return { mx: 0, my: 0, touching: false };
    // sans tir auto, on ne tire qu'à l'arrêt : forte prime à l'immobilité ; avec, une simple préférence (anti-agitation)
    let bestScore = stayD * 10 + stayC - (h.autoFire ? STAY_BONUS_AUTOFIRE : STAY_BONUS_MANUAL) + (emberRun ? 0.6 : 0);
    if (this.stuckT > 0.3) bestScore += 2;

    let best: Pt | null = null;
    // hystérésis : la direction tenue garde un petit avantage (évite l'oscillation entre deux plans voisins)
    const prev = this.held.touching ? this.held : null;
    const last = 2 * (NP - 1);
    for (let k = 0; k < DIRS.length; k++) {
      const dir = DIRS[k];
      const pts = this.paths[k + 1];
      const tx = pts[last] - hp.x;
      const ty = pts[last + 1] - hp.y;
      let blocked = tx * tx + ty * ty < (speed * 0.1) ** 2 ? 1.5 : 0;
      if (prev && prev.mx === dir.x && prev.my === dir.y) blocked -= 0.4;
      // pas de côté : 0,2 s de marche puis arrêt (préféré : on recommence vite à tirer).
      // Le danger est ≥ 0 : inutile de l'évaluer si le confort seul ne peut pas battre le meilleur score.
      const cStep = placeCost(pts[2 * STEP_END], pts[2 * STEP_END + 1], dir) - (h.autoFire ? 0 : 0.3) + blocked;
      if (cStep < bestScore - 1e-9) {
        const sc = this.danger(pts, STEP_END, now) * 10 + cStep;
        if (sc < bestScore - 1e-9) {
          bestScore = sc;
          best = dir;
        }
      }
      const cFull = placeCost(pts[last], pts[last + 1], dir) + blocked;
      if (cFull < bestScore - 1e-9) {
        const sc = this.danger(pts, NP - 1, now) * 10 + cFull;
        if (sc < bestScore - 1e-9) {
          bestScore = sc;
          best = dir;
        }
      }
    }
    if (lp && loopScore <= bestScore) return { mx: this.ldir.x, my: this.ldir.y, touching: this.ldir.x !== 0 || this.ldir.y !== 0 };
    if (!best) return { mx: 0, my: 0, touching: false };
    return { mx: best.x, my: best.y, touching: true };
  }

  // ───────────────────────── Ciseaux de lune ─────────────────────────

  /** Tient à jour l'orbite en cours (découpes, cibles mortes, blocage) et (re)planifie au besoin. */
  private loopTick(w: World): LoopPlan | null {
    const h = w.hero;
    const now = w.t;
    let pl = this.plan;
    let replan = false;
    if (pl) {
      for (const ev of w.events)
        if (ev.e === 'snip') {
          this.loops.snipped++;
          if (pl.circling) this.rjv('snipCircling:' + ev.by);
        }
      let end: keyof LoopStats | null = null;
      if (h.cuts > pl.cuts0) {
        this.loops.cut += h.cuts - pl.cuts0;
        pl.cuts0 = h.cuts;
        pl.since = now;
        replan = true;
      }
      if (pl.members.every((m) => m.hp <= 0)) end = 'aborted';
      else if (now - pl.since > 2 * pl.lap + 1) end = 'missed';
      else if (this.stuckT > 0.3) end = 'aborted';
      if (end) {
        this.loops[end]++;
        this.rjv('end:' + end + (pl.circling ? 'Circling' : 'Approach'));
        this.plan = pl = null;
        this.planCd = 0;
      } else if (++this.planCd >= LOOP_REPLAN_EVERY) replan = true;
    }
    if ((!pl && --this.planCd <= 0) || replan) {
      this.planCd = pl ? 0 : LOOP_PLAN_EVERY;
      const np = this.planLoop(w, pl);
      if (np && np !== pl) {
        this.loops.planned++;
        // même orbite (à peu de chose près) : on garde l'état de rotation
        if (pl && sameOrbit(pl, np.cx, np.cy, np.dir, np.members)) {
          // même orbite (mêmes cibles) : on garde le cercle en cours, on met juste à jour les cibles
          pl.members = np.members;
          pl.value = np.value;
        } else {
          if (pl) this.rjv(pl.circling ? "end:replacedCircling" : "end:replacedApproach");
          this.plan = pl = np;
        }
      }
      // aucune orbite jouable : on garde l'orbite en cours (ses cibles vivent encore)
    }
    if (pl) {
      this.trackCenter(w, pl);
      // près du boss : on quitte l'orbite dès qu'un motif dangereux s'annonce
      if ((this.tick & 3) === 1 && w.enemies.some((e) => e.boss)) {
        this.loopOdds(w, pl.cx, pl.cy, pl.r, pl.members, now, now + pl.lap);
        if (this.bossRisk) {
          this.rjv('end:boss');
          this.loops.aborted++;
          this.plan = null;
          this.planCd = LOOP_PLAN_EVERY;
          return null;
        }
      }
    }
    return pl;
  }

  /** Le centre suit les cibles (elles bougent) : entièrement pendant l'approche, en douceur (≤ 30 pt/s) en orbite. */
  private trackCenter(w: World, pl: LoopPlan): void {
    let mx = 0;
    let my = 0;
    let n = 0;
    for (const m of pl.members) {
      if (m.hp <= 0) continue;
      mx += m.pos.x;
      my += m.pos.y;
      n++;
    }
    if (!n) return;
    const tx = mx / n + pl.ox - pl.cx;
    const ty = my / n + pl.oy - pl.cy;
    const d = Math.hypot(tx, ty);
    if (d < 1e-6) return;
    const k = pl.circling ? Math.min(1, LOOP_TRACK / d) : 1;
    pl.cx += tx * k;
    pl.cy += ty * k;
    // en orbite, une cible qui dérive vers le fil élargit le cercle (jusqu'au rayon maximal)
    if (pl.circling) {
      let need = 0;
      for (const m of pl.members) {
        if (m.hp <= 0) continue;
        need = Math.max(need, Math.hypot(m.pos.x - pl.cx, m.pos.y - pl.cy) + m.radius + (m.contact > 0 ? HERO.radius - 2 : 4) + LOOP_WOBBLE);
      }
      const rmax = ((THREAD.life * w.hero.stats.threadLife - 0.3) * w.hero.stats.speed) / (TAU + LOOP_EXTRA) - LOOP_WOBBLE;
      if (need > pl.r) pl.r = Math.min(rmax, pl.r + Math.min(3, need - pl.r));
    }
    if (Math.abs(pl.cx - pl.fx) + Math.abs(pl.cy - pl.fy) > 3 || pl.r !== pl.fr) {
      this.fitRing(w, pl.cx, pl.cy, pl.r, pl.rk);
      pl.fx = pl.cx;
      pl.fy = pl.cy;
      pl.fr = pl.r;
    }
    if (!pl.circling) pl.a0 = entryAngle(pl.cx, pl.cy, pl.r, pl.dir, w.hero.pos.x, w.hero.pos.y);
  }

  /** Trajectoire prévue en suivant la boucle (aux instants PLAN_T), pour le modèle de danger. */
  private fillLoopPath(pl: LoopPlan, x: number, y: number, speed: number): void {
    const st = this.simSt;
    st.circling = pl.circling;
    st.sw = pl.sw;
    st.lastAng = pl.lastAng;
    const out = this.loopPath;
    const d = { x: 0, y: 0 };
    out[0] = x;
    out[1] = y;
    // le centre suit les cibles : vitesse moyenne observée (bornée à 30 pt/s en orbite, comme trackCenter)
    let cvx = 0;
    let cvy = 0;
    let n = 0;
    for (const m of pl.members) {
      const o = this.vel.get(m.id);
      if (!o || m.hp <= 0) continue;
      cvx += o.vx;
      cvy += o.vy;
      n++;
    }
    if (n) {
      cvx /= n;
      cvy /= n;
      const cs = Math.hypot(cvx, cvy);
      const cap = pl.circling ? LOOP_TRACK * 15 : 200;
      if (cs > cap) {
        cvx *= cap / cs;
        cvy *= cap / cs;
      }
    }
    const cx0 = pl.cx;
    const cy0 = pl.cy;
    let i = 1;
    for (let k = 1; k <= SIM_STEPS; k++) {
      pl.cx = cx0 + cvx * SIM_STEP * (k - 1);
      pl.cy = cy0 + cvy * SIM_STEP * (k - 1);
      loopStep(pl, st, x, y, d);
      x += d.x * speed * SIM_STEP;
      y += d.y * speed * SIM_STEP;
      if (Math.abs(k * SIM_STEP - PLAN_T[i]) < 1e-6) {
        out[2 * i] = x;
        out[2 * i + 1] = y;
        i++;
      }
    }
    pl.cx = cx0;
    pl.cy = cy0;
  }

  /**
   * Boucle en étoile autour de (cx, cy), de rayon de base r : pour chaque angle, le plus petit rayon (r + bulge)
   * dont le point est praticable (fil ± ondulation compris), élargi aux angles voisins pour contourner l'obstacle
   * en douceur. Renvoie le nombre de points restés bloqués, leur direction moyenne (on décale alors le centre à
   * l'opposé) et le périmètre de la boucle.
   */
  private fitRing(w: World, cx: number, cy: number, r: number, out: Float64Array): RingFit {
    const tmp = this.rkTmp;
    for (let k = 0; k < LOOP_K; k++) {
      tmp[k] = -r;
      for (let j = 0; j < LOOP_BULGE.length; j++) {
        if (ringFree(w, cx, cy, r + LOOP_BULGE[j], k)) {
          tmp[k] = r + LOOP_BULGE[j];
          break;
        }
      }
    }
    const f = this.fit;
    f.hit = 0;
    f.bx = 0;
    f.by = 0;
    for (let k = 0; k < LOOP_K; k++) {
      const t0 = tmp[k];
      let R = t0 < 0 ? -t0 : t0;
      const t1 = tmp[(k + 1) % LOOP_K];
      const t2 = tmp[(k + LOOP_K - 1) % LOOP_K];
      if (t1 > R) R = t1;
      if (t2 > R) R = t2;
      if (R > r && !ringFree(w, cx, cy, R, k)) R = t0 > 0 ? t0 : r;
      out[k] = R;
      if (t0 < 0) {
        f.hit++;
        f.bx += RING_U[2 * k];
        f.by += RING_U[2 * k + 1];
      }
    }
    let len = 0;
    for (let k = 0; k < LOOP_K; k++) {
      const j = (k + 1) % LOOP_K;
      len += Math.hypot(RING_U[2 * j] * out[j] - RING_U[2 * k] * out[k], RING_U[2 * j + 1] * out[j] - RING_U[2 * k + 1] * out[k]);
    }
    f.len = len;
    return f;
  }

  /**
   * Cherche la meilleure boucle jouable maintenant : pour chaque ennemi (seul, puis avec ses voisins), le plus
   * petit cercle qui l'entoure avec une marge (décalé loin des murs et des rochers), fermé avant que le fil ne
   * sèche ; les chances de fermeture (`loopOdds`) pénalisent les cercles qu'une mite ou une charge de crabe
   * couperait. Valeur : dégâts utiles (plafonnés aux PV) par seconde, approche comprise.
   */
  private planLoop(w: World, cur: LoopPlan | null): LoopPlan | null {
    const h = w.hero;
    const hp = h.pos;
    const v = h.stats.speed;
    const now = w.t;
    const life = THREAD.life * h.stats.threadLife;
    // un tour + le croisement doivent tenir dans la durée de vie du fil (rayon moyen + ondulation)
    const rmax = Math.min(150, ((life - 0.3) * v) / (TAU + LOOP_EXTRA)) - LOOP_WOBBLE;
    if (rmax < LOOP_MIN_R) return null;
    const steel = h.stats.steelThread;
    const all = w.enemies.filter((e) => e.hp > 0 && e.state !== 'spawn' && !loopSkip(e, steel));
    if (!all.length) return null;
    // les plus proches seulement (coût) : une orbite lointaine perd de toute façon sa valeur à l'approche
    const dist2 = (e: Enemy) => (e.pos.x - hp.x) ** 2 + (e.pos.y - hp.y) ** 2;
    const seeds = all.length > LOOP_SEEDS ? all.sort((a, b) => dist2(a) - dist2(b)).slice(0, LOOP_SEEDS) : all;
    const s = h.stats;
    const cutUnit = THREAD.cutBase * (s.damage / HERO.damage) * s.cutMult * (1 + s.critChance);
    let best: LoopPlan | null = null;
    let bestV = LOOP_MIN_VALUE;
    // orbite en cours : on la réévalue d'abord ; une autre ne la remplace que si elle vaut LOOP_KEEP fois plus
    let keep = 1;
    const tried: number[] = [];
    const need = (m: Enemy, cx: number, cy: number): number => {
      // le fil ne doit pas toucher l'ennemi, ni l'héroïne (sur le cercle) entrer à son contact ; marge de déplacement
      // fil : rayon + 4 ; contact de l'héroïne : rayon + 12 ; plus le déplacement de la cible pendant un tour
      const margin = m.boss ? HERO.radius + 14 : (m.contact > 0 ? HERO.radius - 2 : 4) + m.speed * (CHASERS.has(m.type) ? 0.3 : 0.12);
      const d = Math.hypot(m.pos.x - cx, m.pos.y - cy);
      // tireurs visés : assez loin pour que le tir à bout portant passe derrière l'héroïne (elle tourne)
      return Math.max(d + m.radius + margin + 3, d + (LOOP_TYPE_R[m.type] ?? 0));
    };
    const consider = (group: Enemy[]): void => {
      let cx = 0;
      let cy = 0;
      for (const g of group) {
        cx += g.pos.x;
        cy += g.pos.y;
      }
      cx /= group.length;
      cy /= group.length;
      // élagage (coût) : valeur optimiste du groupe sur un cercle parfait, avant d'ajuster la boucle aux obstacles
      {
        let r0 = LOOP_MIN_R;
        for (const g of group) r0 = Math.max(r0, need(g, cx, cy) + LOOP_WOBBLE);
        const u0 = cutUnit * (1 + THREAD.comboPerExtra * group.length);
        let g0 = 0;
        for (const m of group) g0 += Math.min(m.hp, u0 * s.eliteMult) * 1.6;
        const t0 = (TAU * r0) / v + Math.max(0, Math.hypot(hp.x - cx, hp.y - cy) - r0 - 60) / v + 0.3;
        if (g0 / t0 <= bestV) return this.rjv('lowValue0');
      }
      let r = 0;
      let len = 0;
      const rk = this.rkCand;
      for (let it = 0; ; it++) {
        r = LOOP_MIN_R;
        for (const g of group) r = Math.max(r, need(g, cx, cy) + LOOP_WOBBLE);
        if (r > rmax) return this.rjv('rmax');
        const fit = this.fitRing(w, cx, cy, r, rk);
        len = fit.len;
        if (fit.hit <= LOOP_RING_SLACK) break;
        if (it >= 4) return this.rjv('ringBlocked');
        const bn = Math.hypot(fit.bx, fit.by);
        if (bn < 1e-6) return this.rjv('ringBlocked');
        cx -= (fit.bx / bn) * 12;
        cy -= (fit.by / bn) * 12;
      }
      // un tour (périmètre réel, contournements compris) + le croisement tiennent dans la durée de vie du fil
      if ((len + TAU * LOOP_WOBBLE) * (1 + LOOP_EXTRA / TAU) > (life - 0.3) * v) return this.rjv('perimeter');
      // même cercle déjà évalué ?
      for (let k = 0; k < tried.length; k += 3) if (Math.abs(tried[k] - cx) < 4 && Math.abs(tried[k + 1] - cy) < 4 && Math.abs(tried[k + 2] - r) < 4) return;
      tried.push(cx, cy, r);
      const members: Enemy[] = [];
      for (const e of w.enemies) {
        const d = Math.hypot(e.pos.x - cx, e.pos.y - cy);
        if (d >= r + LOOP_WOBBLE) continue;
        if (e.state === 'spawn' || loopSkip(e, steel)) return this.rjv('spawnOrMothInside');
        if (d + e.radius + 2 > r - LOOP_WOBBLE) return this.rjv('memberTouch'); // il toucherait le fil
        members.push(e);
      }
      if (!members.length) return this.rjv('noMember');
      // tireurs qui reculent devant l'héroïne : là où ils seront à l'arrivée, le cercle tient-il encore ?
      const dh = Math.hypot(hp.x - cx, hp.y - cy);
      if (dh > r + LOOP_CATCH) {
        let fx = 0;
        let fy = 0;
        let nf = 0;
        for (const m of members) {
          if (!RANGED.has(m.type)) continue;
          const ux = (m.pos.x - hp.x) / (Math.hypot(m.pos.x - hp.x, m.pos.y - hp.y) || 1);
          const uy = (m.pos.y - hp.y) / (Math.hypot(m.pos.x - hp.x, m.pos.y - hp.y) || 1);
          const run = m.speed * (Math.min(dh - r, 60) / v);
          fx += clampN(m.pos.x + ux * run, m.radius, ARENA_W - m.radius) - m.pos.x;
          fy += clampN(m.pos.y + uy * run, m.radius, ARENA_H - m.radius) - m.pos.y;
          nf++;
        }
        if (nf && this.fitRing(w, cx + fx / nf, cy + fy / nf, r, this.rkTmp2).hit > LOOP_RING_SLACK) return this.rjv('fleeWall');
      }
      // valeur : dégâts utiles par seconde (borne haute avant l'approche, pour élaguer)
      const unit = cutUnit * (1 + THREAD.comboPerExtra * (members.length - 1));
      let gain = 0;
      for (const m of members) {
        const dmg = unit * (m.elite || m.boss ? s.eliteMult : 1);
        const shooter = m.shotDmg > 0 && !m.boss;
        gain += Math.min(m.hp, dmg) * (shooter ? 1.3 : 1) + (dmg >= m.hp ? 0.3 * m.hp : 0);
      }
      const loopT = (len * (1 + LOOP_EXTRA / (2 * TAU))) / v + 0.1;
      const d0 = Math.hypot(hp.x - cx, hp.y - cy);
      const L = Math.abs(d0 - r);
      if (gain / (loopT + L / v + 0.37) <= bestV) return this.rjv('lowValue');
      if (L > LOOP_MAX_APPROACH) return this.rjv('approachFar');
      const shooters = members.some((m) => m.type === 'goblin');
      // point d'entrée : tangent au cercle dans le sens de rotation (on s'enroule sans foncer sur les cibles)
      const pcs = new Map<number, number>();
      for (const dir of [1, -1] as const) {
        const a0 = entryAngle(cx, cy, r, dir, hp.x, hp.y);
        const ex = cx + Math.cos(a0) * r;
        const ey = cy + Math.sin(a0) * r;
        const la = Math.hypot(ex - hp.x, ey - hp.y);
        let La = la <= 8 ? 0 : la;
        // pas de ligne droite jusqu'au point d'entrée : on contourne (champ de déplacement), approche plus longue
        if (La > 0 && !w.arena.lineOfWalk(hp, { x: ex, y: ey })) {
          if (!walkable(w, ex, ey)) {
            this.rjv('noWalkLine');
            continue;
          }
          La *= 1.5;
        }
        const tStart = now + La / v + 0.07;
        const tEnd = tStart + loopT;
        const val = gain / (tEnd - now + 0.3);
        if (val <= bestV) {
          this.rjv('lowValue');
          continue;
        }
        const tk = Math.round(La / 20);
        let pc = pcs.get(tk);
        if (pc === undefined) {
          pcs.set(tk, (pc = this.loopOdds(w, cx, cy, r, members, tStart, tEnd)));
          // près du boss, on ne tourne que pendant ses fenêtres (anneaux et spirales n'ont pas d'interstice)
          if (this.bossRisk) pcs.set(tk, (pc = 0));
        }
        if (pc === 0) continue;
        // l'orbite en cours garde son sens (pas de demi-tour)
        const same = cur !== null && sameOrbit(cur, cx, cy, dir, members);
        // une coupure ne fait que retarder la découpe (on continue de tourner) : les chances classent les orbites
        // sans en interdire aucune ; l'orbite en cours a un plancher plus haut (elle est déjà engagée)
        // tireurs visés dans la boucle : pas de plancher (on ne s'y risque que pendant une vraie fenêtre de tir)
        const floor = shooters ? 0 : same ? LOOP_KEEP_ODDS : LOOP_ODDS_FLOOR;
        const pv = val * (same ? keep : 1) * Math.max(pc, floor);
        if (pv <= bestV) {
          this.rjv('odds');
          continue;
        }
        const pv2 = pv;
        bestV = pv2;
        let mx = 0;
        let my = 0;
        for (const m of members) {
          mx += m.pos.x;
          my += m.pos.y;
        }
        const ox = cx - mx / members.length;
        const oy = cy - my / members.length;
        best = { cx, cy, r, dir, members, a0, cuts0: h.cuts, since: now, lap: loopT, value: pv2, counted: false, circling: false, sw: 0, lastAng: a0, ox, oy, rk: Float64Array.from(rk), fx: cx, fy: cy, fr: r };
      }
    };
    if (cur) {
      // une orbite bien entamée vaut plus : la quitter perd le fil déjà tracé
      keep = LOOP_KEEP * (cur.circling ? 1 + 2 * Math.min(1, Math.max(0, cur.sw) / TAU) : 1);
      const alive = cur.members.filter((m) => m.hp > 0 && m.state !== 'spawn');
      if (alive.length) consider(alive);
    }
    for (const seed of seeds) {
      consider([seed]);
      // groupe : on ajoute les voisins les plus proches tant que le cercle reste fermable
      const others = seeds
        .filter((o) => o !== seed && Math.hypot(o.pos.x - seed.pos.x, o.pos.y - seed.pos.y) < 2 * rmax)
        .sort((a, b) => Math.hypot(a.pos.x - seed.pos.x, a.pos.y - seed.pos.y) - Math.hypot(b.pos.x - seed.pos.x, b.pos.y - seed.pos.y));
      const group = [seed];
      for (const o of others.slice(0, 3)) {
        group.push(o);
        let cx = 0;
        let cy = 0;
        for (const g of group) {
          cx += g.pos.x;
          cy += g.pos.y;
        }
        cx /= group.length;
        cy /= group.length;
        let r = LOOP_MIN_R;
        for (const g of group) r = Math.max(r, need(g, cx, cy) + LOOP_WOBBLE);
        if (r > rmax) {
          group.pop();
          continue;
        }
        consider(group.slice());
      }
    }
    return best;
  }

  /**
   * Chances que la boucle se ferme (DECISIONS #39 : seuls la mite et la charge du crabe coupent le fil) : mites
   * qui atteindraient le fil, charges de crabe qui le traverseraient (rythme connu d'un joueur compétent), et
   * menaces qui feraient quitter l'orbite à l'héroïne (flaque du mage sous ses pas, zones au sol sur le cercle,
   * charge ou onde de choc du boss). Les tirs ne coupent plus le fil : le modèle de danger s'en charge.
   */
  private loopOdds(w: World, cx: number, cy: number, r: number, members: Enemy[], tStart: number, tEnd: number): number {
    const now = w.t;
    const T1 = Math.max(0, tStart - now);
    const T2 = tEnd - now;
    const steel = w.hero.stats.steelThread;
    let odds = 1;
    this.bossRisk = false;
    const risk = (k: string, keep: number): void => {
      odds *= keep;
      this.rjv(k);
    };
    for (const e of w.enemies) {
      const d = Math.hypot(e.pos.x - cx, e.pos.y - cy);
      const member = members.includes(e);
      const spawnDelay = e.state === 'spawn' ? e.t : 0;
      if (e.boss) {
        const bo = this.bossLoopOdds(e, d, r, member, T1, T2);
        if (bo < 1 && (member || d < r + 140)) this.bossRisk = true;
        odds *= bo;
        continue;
      }
      // mage : flaque sous l'héroïne, qu'elle retraverserait au tour suivant
      if (e.type === 'mage') {
        const tf = e.state === 'windup' ? e.t : spawnDelay + Math.max(0, e.cd) + 0.3;
        if (tf < T2 - 0.6) risk('mage', 0.5);
      }
      if (steel) continue;
      // charge du crabe-ciseaux : elle vise le milieu du fil et le tranche
      if (e.type === 'snipper') {
        if (e.state === 'windup' || e.state === 'charge') {
          if (d < r + 360) risk('chargeNow', 0.1);
        } else if (d < r + 330) {
          const next = e.state === 'recover' ? e.t + ENEMIES[e.type].period + 0.6 : spawnDelay + Math.max(0, e.cd) + 0.6;
          if (next < T2) risk('chargeSoon', 0.2);
        }
      }
      // mites : elles filent vers le fil
      if (e.type === 'moth' && !member && d - r < 105 * Math.max(0, T2 - spawnDelay) + 30) risk('moth', 0.1);
      if (odds < 0.01) return odds;
    }
    // zones au sol (flaques, ondes, pluie) sur le cercle, et charges télégraphiées qui le traversent
    for (const z of w.hazards) {
      if (z.endAt < now + T1 || z.activeAt > now + T2) continue;
      if (z.kind === 'circle') {
        const d = Math.hypot(z.pos.x - cx, z.pos.y - cy);
        if (Math.abs(d - r) < z.radius + HERO.radius || d + r < z.radius) risk('zone', 0.2);
      } else if (z.to && segDist2(cx, cy, z.pos.x, z.pos.y, z.to.x, z.to.y) < (r + z.radius + 4) ** 2) risk('chargeLine', 0.2);
    }
    return odds;
  }

  /** Boss : sa prochaine charge ou onde de choc (motifs connus, joués en boucle) ferait-elle quitter l'orbite ? */
  private bossLoopOdds(e: Enemy, d: number, r: number, member: boolean, T1: number, T2: number): number {
    const b = e.boss!;
    const list = BOSSES[b.archetype].phases[b.phase];
    const kind = b.breath > 0 ? list[b.patternIdx % list.length].kind : b.pattern?.kind;
    if (!kind) return 1;
    const tp = b.breath > 0 ? b.breath + (kind === 'charge' ? 0.7 : 0.6) : e.state === 'windup' ? e.t : 0;
    const near = member || d < r + 200;
    let ok = true;
    switch (kind) {
      case 'charge':
        ok = !(near && tp < T2);
        break;
      case 'slam':
        ok = !(near && tp + 0.4 < T2);
        break;
      case 'puddles':
        ok = !(tp + 0.5 < T2);
        break;
      default:
        break;
    }
    void T1;
    if (ok) return 1;
    this.rjv('boss:' + kind);
    return 0.1;
  }

  choosePower(offer: PowerId[], ctx: ChoiceContext): PowerId {
    switch (this.profile.choice) {
      case 'random':
        return this.rng.pick(offer);
      case 'damage':
        return offer.slice().sort((a, b) => DAMAGE_FIRST.indexOf(a) - DAMAGE_FIRST.indexOf(b))[0];
      case 'best':
        return bestChoice(offer, ctx);
    }
  }
}

export function bestChoice(offer: PowerId[], ctx: ChoiceContext): PowerId {
  const h = ctx.hero;
  const bossNext = ctx.level.rooms[ctx.nextRoom]?.boss != null;
  const hpFrac = h.hp / h.stats.maxHp;
  let best = offer[0];
  let bv = -Infinity;
  for (const id of offer) {
    let v = VALUE[id];
    const owned = h.powers[id] ?? 0;
    v *= Math.pow(0.8, owned);
    if (bossNext && id === 'eliteSlayer') v += 4;
    if (hpFrac < 0.5 && (id === 'maxHp' || id === 'shield')) v += 2.5;
    if (v > bv) {
      bv = v;
      best = id;
    }
  }
  return best;
}

/** Grille des distances aux obstacles de marche et aux bords (pas de 4 pt), par gabarit de salle. */
const CLEAR_STEP = 4;
const CLEAR_W = Math.ceil(ARENA_W / CLEAR_STEP) + 1;
const CLEAR_H = Math.ceil(ARENA_H / CLEAR_STEP) + 1;
const clearGrids = new WeakMap<object, Float32Array>();

function clearGrid(w: World): Float32Array {
  const key = w.arena.template;
  let g = clearGrids.get(key);
  if (g) return g;
  g = new Float32Array(CLEAR_W * CLEAR_H);
  const blocked: number[] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (w.arena.blocksWalk(c, r)) blocked.push(c, r);
  for (let j = 0; j < CLEAR_H; j++) {
    for (let i = 0; i < CLEAR_W; i++) {
      const x = i * CLEAR_STEP;
      const y = j * CLEAR_STEP;
      let best = Math.min(x, y, ARENA_W - x, ARENA_H - y);
      for (let k = 0; k < blocked.length; k += 2) {
        const dx = Math.max(blocked[k] * CELL - x, 0, x - (blocked[k] + 1) * CELL);
        const dy = Math.max(blocked[k + 1] * CELL - y, 0, y - (blocked[k + 1] + 1) * CELL);
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < best) best = d;
      }
      g[j * CLEAR_W + i] = best;
    }
  }
  clearGrids.set(key, g);
  return g;
}

function walkable(w: World, x: number, y: number): boolean {
  return !w.arena.blocksWalk(Math.floor(x / CELL), Math.floor(y / CELL));
}

/** Dégagement (pt) au point (x, y), prudent (case la plus proche moins sa demi-diagonale). */
function clearAt(w: World, x: number, y: number): number {
  const i = Math.round(x / CLEAR_STEP);
  const j = Math.round(y / CLEAR_STEP);
  if (i < 0 || j < 0 || i >= CLEAR_W || j >= CLEAR_H) return 0;
  return clearGrid(w)[j * CLEAR_W + i] - CLEAR_STEP * 0.71;
}

/** Distance du point (x,y) au plus proche obstacle de marche ou bord (bornée à `max`). */
function clearance(w: World, x: number, y: number, max: number): number {
  let best = Math.min(max, x, y, ARENA_W - x, ARENA_H - y);
  const c0 = Math.max(0, Math.floor((x - best) / CELL));
  const c1 = Math.min(COLS - 1, Math.floor((x + best) / CELL));
  const r0 = Math.max(0, Math.floor((y - best) / CELL));
  const r1 = Math.min(ROWS - 1, Math.floor((y + best) / CELL));
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      if (!w.arena.blocksWalk(c, r)) continue;
      const dx = Math.max(c * CELL - x, 0, x - (c + 1) * CELL);
      const dy = Math.max(r * CELL - y, 0, y - (r + 1) * CELL);
      const d = Math.sqrt(dx * dx + dy * dy);
      if (d < best) best = d;
    }
  }
  return best;
}

/** Le cercle du héros balayant [a,b] ne touche aucun obstacle ni bord ? */
function sweptFree(w: World, ax: number, ay: number, bx: number, by: number): boolean {
  const r = HERO.radius;
  const x0 = Math.min(ax, bx) - r;
  const x1 = Math.max(ax, bx) + r;
  const y0 = Math.min(ay, by) - r;
  const y1 = Math.max(ay, by) + r;
  if (x0 < 0 || y0 < 0 || x1 > ARENA_W || y1 > ARENA_H) return false;
  const c1 = Math.floor(x1 / CELL);
  const r1 = Math.floor(y1 / CELL);
  for (let rr = Math.floor(y0 / CELL); rr <= r1; rr++) for (let c = Math.floor(x0 / CELL); c <= c1; c++) if (w.arena.blocksWalk(c, rr)) return false;
  return true;
}

/** Durée de vie restante (s) d'un projectile ennemi avant qu'un obstacle ou un mur ne l'arrête (bornée à l'horizon). */
function shotLife(w: World, p: Projectile): number {
  const sp = Math.hypot(p.vel.x, p.vel.y);
  if (sp < 1) return HORIZON;
  const step = 10 / sp;
  for (let t = step; t <= HORIZON; t += step) {
    if (w.arena.isShotBlockedAt(p.pos.x + p.vel.x * t, p.pos.y + p.vel.y * t)) return t;
  }
  return HORIZON;
}

function clampN(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

function segDist2(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const vx = bx - ax;
  const vy = by - ay;
  const l2 = vx * vx + vy * vy;
  let t = l2 > 0 ? ((px - ax) * vx + (py - ay) * vy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = ax + vx * t - px;
  const dy = ay + vy * t - py;
  return dx * dx + dy * dy;
}

function edgePenalty(x: number, y: number): number {
  const m = CELL * 1.5;
  let p = 0;
  if (x < m) p += (m - x) / m;
  if (x > ARENA_W - m) p += (x - (ARENA_W - m)) / m;
  if (y < m) p += (m - y) / m;
  if (y > ARENA_H - m) p += (y - (ARENA_H - m)) / m;
  return p * 2;
}

