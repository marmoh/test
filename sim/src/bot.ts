/**
 * §9 Bots : temps de réaction, précision d'esquive des télégraphes et politique
 * de choix des pouvoirs. Un bot ne « voit » une menace qu'après son temps de
 * réaction ; à la première vue, il tire au sort s'il l'esquivera (précision).
 */
import { HERO, CELL, ARENA_W, ARENA_H, COLS, ROWS } from './constants.js';
import { type PowerId } from './content.js';
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
  'damage', 'attackSpeed', 'multishot', 'crit', 'ricochet', 'chain', 'pierce', 'diagonals', 'flame', 'poison',
  'eliteSlayer', 'sideShots', 'rearShot', 'blast', 'orb', 'frost', 'wallBounce', 'maxHp', 'lifesteal', 'shield',
  'speed', 'dodge', 'flashStep', 'magnet',
];

/** Valeur estimée (bot expert) ; ajustée au contexte dans `bestChoice`. */
const VALUE: Record<PowerId, number> = {
  multishot: 9, ricochet: 8.5, attackSpeed: 8, damage: 7.5, chain: 7.5, crit: 6.5, diagonals: 6.5, pierce: 6,
  maxHp: 6, shield: 6, orb: 5.5, flame: 5.5, poison: 5.5, eliteSlayer: 4, sideShots: 5, frost: 5, blast: 4.5,
  dodge: 5, rearShot: 4, lifesteal: 4, wallBounce: 3.5, flashStep: 3.5, speed: 3, magnet: 2,
};

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

/**
 * Bot « joueur compétent » : perçoit les menaces après son temps de réaction et
 * n'esquive que celles que sa précision lui accorde (tirage unique par menace).
 * En dehors de ce filtre, il joue proprement : prédiction exacte des trajectoires
 * (approche minimale analytique), pas de côté puis arrêt pour tirer, distance de
 * sécurité avec les ennemis au contact, évitement des coins, recherche de ligne de
 * vue et détection de blocage.
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
  private zs: Hazard[] = [];
  private chasers: Enemy[] = [];
  private readonly probe: Pt = { x: 0, y: 0 };
  /** position / vitesse pour lesquelles `paths` est à jour (le héros est souvent immobile) */
  private pathKey = { x: NaN, y: NaN, s: NaN, arena: null as unknown };

  constructor(readonly profile: BotProfile, seed: number) {
    this.rng = new Rng(seed);
  }

  beginRoom(): void {
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
  private danger(pts: Float64Array, stop: number, now: number): number {
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
    for (let k = 0; k < ch.length; k += 6) {
      const ex = ch[k], ey = ch[k + 1], sp = ch[k + 2], rr = ch[k + 3], delay = ch[k + 4], contact = ch[k + 5];
      let first = true;
      for (let i = 1; i < NP; i++) {
        const t = PLAN_T[i];
        if (t > CONTACT_HORIZON) break;
        if (t < delay) continue;
        const j = (i < stop ? i : stop) * 2;
        const dx = pts[j] - ex;
        const dy = pts[j + 1] - ey;
        const lim = rr + sp * (t - delay);
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
    const zs = this.zs;
    zs.length = 0;
    for (const z of w.hazards) {
      if (z.endAt < now || z.activeAt > now + HORIZON + 0.1) continue;
      if (!this.aware(z, now)) continue;
      zs.push(z);
    }
    const ch = this.ch;
    ch.length = 0;
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
      ch.push(e.pos.x, e.pos.y, sp, rr, e.state === 'spawn' ? e.t : 0, e.contact);
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
        const ranged = e.type === 'goblin' || e.type === 'skeleton' || e.type === 'mage';
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
    if (stayD === 0 && stayC < 0.5 && !wantLos) return { mx: 0, my: 0, touching: false };
    // sans tir auto, on ne tire qu'à l'arrêt : forte prime à l'immobilité ; avec, une simple préférence (anti-agitation)
    let bestScore = stayD * 10 + stayC - (h.autoFire ? STAY_BONUS_AUTOFIRE : STAY_BONUS_MANUAL);
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
    if (!best) return { mx: 0, my: 0, touching: false };
    return { mx: best.x, my: best.y, touching: true };
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

