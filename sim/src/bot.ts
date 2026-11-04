/**
 * §9 Bots : temps de réaction, précision d'esquive des télégraphes et politique
 * de choix des pouvoirs. Un bot ne « voit » une menace qu'après son temps de
 * réaction ; à la première vue, il tire au sort s'il l'esquivera (précision).
 */
import { HERO, CELL, ARENA_W, ARENA_H } from './constants.js';
import { type PowerId } from './content.js';
import type { ChoiceContext, Controller } from './level.js';
import { Rng } from './rng.js';
import type { HeroInput, World, Hazard, Projectile } from './world.js';

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
const HORIZON = [0.08, 0.16, 0.26, 0.38, 0.52, 0.68];

export class Bot implements Controller {
  private rng: Rng;
  private seen = new WeakMap<object, boolean>();
  private held: HeroInput = { mx: 0, my: 0, touching: false };
  private tick = 0;
  private noLosTime = 0;

  constructor(readonly profile: BotProfile, seed: number) {
    this.rng = new Rng(seed);
  }

  beginRoom(): void {
    this.seen = new WeakMap();
    this.held = { mx: 0, my: 0, touching: false };
    this.noLosTime = 0;
  }

  /** La menace est-elle perçue (réaction écoulée) et sera-t-elle esquivée ? */
  private aware(obj: Projectile | Hazard, now: number): boolean {
    if (now - obj.born < this.profile.reaction) return false;
    let v = this.seen.get(obj);
    if (v === undefined) {
      v = this.rng.chance(this.profile.dodge);
      this.seen.set(obj, v);
    }
    return v;
  }

  input(w: World): HeroInput {
    this.tick++;
    if (this.tick % 2 === 0) return this.held;
    this.held = this.decide(w);
    return this.held;
  }

  private decide(w: World): HeroInput {
    const h = w.hero;
    const hp = h.pos;
    const speed = h.stats.speed;
    const now = w.t;

    const projs = w.projectiles.filter((p) => !p.fromHero && this.aware(p, now));
    const zones = w.hazards.filter((z) => this.aware(z, now));

    const danger = (dir: { x: number; y: number } | null): number => {
      let px = hp.x;
      let py = hp.y;
      let prevT = 0;
      let d = 0;
      for (const t of HORIZON) {
        if (dir) {
          const nx = px + dir.x * speed * (t - prevT);
          const ny = py + dir.y * speed * (t - prevT);
          if (w.arena.isWalkableAt(nx + dir.x * HERO.radius, ny + dir.y * HERO.radius) && w.arena.isWalkableAt(nx, ny)) {
            px = nx;
            py = ny;
          }
        }
        prevT = t;
        const wgt = 1 / (t + 0.15);
        for (const p of projs) {
          const qx = p.pos.x + p.vel.x * t;
          const qy = p.pos.y + p.vel.y * t;
          const rr = HERO.radius + p.radius + 5;
          if ((qx - px) ** 2 + (qy - py) ** 2 < rr * rr) d += p.dmg * wgt;
        }
        const at = now + t;
        for (const z of zones) {
          if (at < z.activeAt - 0.05 || at > z.endAt + 0.05) continue;
          if (z.kind === 'circle') {
            const rr = z.radius + HERO.radius + 4;
            if ((z.pos.x - px) ** 2 + (z.pos.y - py) ** 2 < rr * rr) d += Math.max(z.dmg, 60) * wgt;
          } else if (z.to) {
            const rr = z.radius + HERO.radius + 6;
            if (segDist2(px, py, z.pos.x, z.pos.y, z.to.x, z.to.y) < rr * rr) d += 100 * wgt;
          }
        }
        for (const e of w.enemies) {
          if (e.contact <= 0 || e.state === 'spawn') continue;
          const rr = e.radius + HERO.radius + 8;
          if ((e.pos.x - px) ** 2 + (e.pos.y - py) ** 2 < rr * rr) d += e.contact * 0.6 * wgt;
        }
      }
      return d;
    };

    // salle terminée : aller au portail
    if (w.cleared) {
      const dir = w.arena.steer(hp, w.arena.portal);
      return { mx: dir.x, my: dir.y, touching: true };
    }

    // objectif de placement hors danger
    let goal: { x: number; y: number } | null = null;
    const tgt = w.target;
    const losOk = tgt ? w.arena.lineOfSight(hp, tgt.pos, tgt.flying) : false;
    this.noLosTime = tgt && !losOk ? this.noLosTime + 2 / 30 : 0;
    let nearest = Infinity;
    let nearestE = null as null | (typeof w.enemies)[number];
    for (const e of w.enemies) {
      if (e.state === 'spawn' || e.contact <= 0) continue;
      const d = Math.hypot(e.pos.x - hp.x, e.pos.y - hp.y) - e.radius;
      if (d < nearest) {
        nearest = d;
        nearestE = e;
      }
    }
    if (nearestE && nearest < 70) {
      // trop près d'un ennemi de contact : s'écarter
      goal = { x: hp.x + (hp.x - nearestE.pos.x), y: hp.y + (hp.y - nearestE.pos.y) };
    } else if (tgt && this.noLosTime > 0.8) {
      goal = tgt.pos;
    }

    const stay = danger(null);
    if (stay === 0 && !goal) return { mx: 0, my: 0, touching: false };

    let best: { x: number; y: number } | null = null;
    let bestScore = stay === 0 ? Infinity : stay * 10 + 0.5;
    const gdir = goal ? (goal === tgt?.pos ? w.arena.steer(hp, goal) : norm2(goal.x - hp.x, goal.y - hp.y)) : null;
    for (const dir of DIRS) {
      const dd = danger(dir);
      if (stay === 0 && dd > 0) continue;
      let score = dd * 10;
      // éviter les coins et les bords
      const ex = hp.x + dir.x * 60;
      const ey = hp.y + dir.y * 60;
      score += edgePenalty(ex, ey);
      if (gdir) score -= (dir.x * gdir.x + dir.y * gdir.y) * 2;
      if (score < bestScore) {
        bestScore = score;
        best = dir;
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
  const m = CELL * 1.2;
  let p = 0;
  if (x < m) p += (m - x) / m;
  if (x > ARENA_W - m) p += (x - (ARENA_W - m)) / m;
  if (y < m) p += (m - y) / m;
  if (y > ARENA_H - m) p += (y - (ARENA_H - m)) / m;
  return p * 1.5;
}

function norm2(x: number, y: number): { x: number; y: number } {
  const d = Math.hypot(x, y);
  return d < 1e-9 ? { x: 0, y: 0 } : { x: x / d, y: y / d };
}
