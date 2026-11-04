/**
 * Simulation déterministe d'une salle (pas fixe SIM_DT). Aucune dépendance au
 * rendu : le prototype web et les bots consomment le même état.
 */
import { Arena, norm, clamp } from './arena.js';
import {
  SIM_DT,
  HERO,
  CONTROL,
  ELITE,
  SCALE,
  BOSS_BASE_HP,
  BOSS_BREATH,
  BOSS_SLAM_MARGIN,
  MAX_PROJECTILES,
  MAX_ENEMIES,
  HEAL_ORB,
  POWER_TUNING,
  THREAD,
  SHOT_DMG_MULT,
  AUTO_FIRE_DEFAULT,
  ARENA_W,
  ARENA_H,
} from './constants.js';
import { ENEMIES, BOSSES, type MinionType, type BossArchetype, type Pattern, type PowerId } from './content.js';
import { computeStats, type HeroStats, type Talents } from './hero.js';
import type { Vec } from './controls.js';
import { Rng } from './rng.js';

export interface HeroInput {
  /** Vitesse désirée normalisée (|m| ≤ 1). */
  mx: number;
  my: number;
  touching: boolean;
}

export interface HeroState {
  pos: Vec;
  vel: Vec;
  hp: number;
  talents: Talents;
  powers: Partial<Record<PowerId, number>>;
  stats: HeroStats;
  invuln: number;
  stillTime: number;
  fireCd: number;
  aimTime: number;
  facing: number;
  shieldReady: boolean;
  shieldCd: number;
  orbAngle: number;
  flashT: number;
  moving: boolean;
  /** Option d'accessibilité « tir auto permanent ». */
  autoFire: boolean;
  damageTaken: number;
  hitsTaken: number;
  /** Ciseaux de lune : fil de découpe (du plus ancien au plus récent point) */
  thread: ThreadPoint[];
  /** 1 → 0 juste après une découpe (animation) */
  cutT: number;
  cuts: number;
  /** Instrumentation : dégâts effectifs infligés (plafonnés aux PV restants) par source. */
  dmgBy: { cut: number; shot: number; other: number };
}

export interface ThreadPoint {
  x: number;
  y: number;
  t: number;
}

export function newHero(talents: Talents, powers: Partial<Record<PowerId, number>> = {}, autoFire = AUTO_FIRE_DEFAULT): HeroState {
  const stats = computeStats(talents, powers);
  return {
    pos: { x: 0, y: 0 },
    vel: { x: 0, y: 0 },
    hp: stats.maxHp,
    talents,
    powers: { ...powers },
    stats,
    invuln: 0,
    stillTime: 1,
    fireCd: 0,
    aimTime: 0,
    facing: -Math.PI / 2,
    shieldReady: stats.shield,
    shieldCd: 0,
    orbAngle: 0,
    flashT: 0,
    moving: false,
    autoFire,
    damageTaken: 0,
    hitsTaken: 0,
    thread: [],
    cutT: 0,
    cuts: 0,
    dmgBy: { cut: 0, shot: 0, other: 0 },
  };
}

/** Ajoute un pouvoir ; « PV max +20 % » soigne d'autant. */
export function grantPower(h: HeroState, id: PowerId): void {
  const before = h.stats.maxHp;
  h.powers[id] = (h.powers[id] ?? 0) + 1;
  h.stats = computeStats(h.talents, h.powers);
  if (id === 'maxHp') h.hp += h.stats.maxHp - before;
  if (id === 'shield') h.shieldReady = true;
  h.hp = Math.min(h.hp, h.stats.maxHp);
}

export type EnemyState = 'spawn' | 'move' | 'windup' | 'charge' | 'recover';

export interface Enemy {
  id: number;
  type: MinionType | 'boss';
  pos: Vec;
  radius: number;
  hp: number;
  maxHp: number;
  contact: number;
  shotDmg: number;
  speed: number;
  flying: boolean;
  elite: boolean;
  state: EnemyState;
  t: number;
  cd: number;
  eliteCd: number;
  eliteWind: number;
  aim: Vec;
  chargeLeft: number;
  slowT: number;
  burnT: number;
  burnDps: number;
  poisonStacks: number;
  poisonT: number;
  poisonDps: number;
  orbHitCd: number;
  strafe: number;
  volley: number;
  boss?: BossRuntime;
}

export interface BossRuntime {
  archetype: BossArchetype;
  variant: number;
  phase: number;
  patternIdx: number;
  pattern: Pattern | null;
  repeatsLeft: number;
  /** souffle (ouverture claire) restant */
  breath: number;
  spin: number;
}

export interface Projectile {
  pos: Vec;
  vel: Vec;
  radius: number;
  dmg: number;
  fromHero: boolean;
  born: number;
  pierce: boolean;
  wallBounce: number;
  ricochet: number;
  lastHit: number;
  dead: boolean;
  /** Origine (type d'ennemi, « elite », « boss ») — diagnostic et rendu. */
  src?: string;
  /** Ennemi tireur : les projectiles d'une même attaque partagent (ownerId, born). */
  ownerId?: number;
}

export type HazardKind = 'circle' | 'line';
export interface Hazard {
  kind: HazardKind;
  pos: Vec;
  /** fin de ligne (charge) */
  to?: Vec;
  radius: number;
  born: number;
  /** instant d'activation (≥ born + 0,5 s) */
  activeAt: number;
  /** instant de fin */
  endAt: number;
  dmg: number;
  tick: number;
  nextTick: number;
  ownerId: number;
  /** Origine (type d'ennemi ou « boss ») — diagnostic et rendu. */
  src?: string;
}

export interface HealOrb {
  pos: Vec;
  heal: number;
}

export type WorldEvent =
  | { e: 'shoot'; x: number; y: number }
  | { e: 'hit'; x: number; y: number; crit: boolean }
  | { e: 'kill'; x: number; y: number; type: string }
  | { e: 'heroHit'; dmg: number; src?: string; ref?: object }
  | { e: 'dodge' }
  | { e: 'shield' }
  | { e: 'wave'; index: number }
  | { e: 'cleared' }
  | { e: 'cut'; poly: Vec[]; hits: number; echo: boolean }
  | { e: 'snip'; x: number; y: number; by: string };

export interface SpawnSpec {
  type: MinionType;
  c: number;
  r: number;
  elite?: boolean;
}

export interface RoomSetup {
  arena: Arena;
  D: number;
  waves: SpawnSpec[][];
  boss?: { archetype: BossArchetype; variant: number; hpMult?: number } | null;
  seed: number;
}

export class World {
  readonly arena: Arena;
  readonly D: number;
  readonly hpScale: number;
  readonly dmgScale: number;
  readonly rng: Rng;
  hero: HeroState;
  enemies: Enemy[] = [];
  projectiles: Projectile[] = [];
  hazards: Hazard[] = [];
  orbs: HealOrb[] = [];
  events: WorldEvent[] = [];
  t = 0;
  kills = 0;
  waveIndex = 0;
  cleared = false;
  exited = false;
  dead = false;
  private nextId = 1;
  private waves: SpawnSpec[][];
  private bossSpec: RoomSetup['boss'];
  /** Cible courante (pour le rendu). */
  target: Enemy | null = null;
  /** Type de l'ennemi en cours de mise à jour (origine des tirs). */
  private shooter = '';
  private readonly tgtIdx: number[] = [];
  private readonly tgtD: number[] = [];
  private shooterId = 0;
  /** Source des dégâts en cours d'application (instrumentation). */
  private dmgSrc: 'cut' | 'shot' | 'other' = 'other';

  constructor(setup: RoomSetup, hero: HeroState) {
    this.arena = setup.arena;
    this.D = setup.D;
    this.hpScale = 1 + SCALE.hpPerD * setup.D;
    this.dmgScale = 1 + SCALE.dmgPerD * setup.D;
    this.rng = new Rng(setup.seed);
    this.hero = hero;
    hero.pos = { ...this.arena.spawn };
    hero.thread = [];
    hero.cutT = 0;
    hero.vel = { x: 0, y: 0 };
    hero.invuln = 0;
    hero.stillTime = 1;
    hero.fireCd = 0.3;
    hero.aimTime = 0;
    this.waves = setup.waves;
    this.bossSpec = setup.boss ?? null;
    this.spawnWave();
  }

  // ───────────────────────────── apparition ─────────────────────────────

  private spawnWave(): void {
    const wave = this.waves[this.waveIndex];
    if (wave) {
      for (const s of wave) this.spawnEnemy(s.type, { x: s.c * 44 + 22, y: s.r * 44 + 22 }, !!s.elite, 0.8);
      this.events.push({ e: 'wave', index: this.waveIndex });
    }
    // le boss arrive avec la dernière vague (ou seul)
    if (this.bossSpec && this.waveIndex === Math.max(0, this.waves.length - 1)) this.spawnBoss(this.bossSpec.archetype, this.bossSpec.variant, this.bossSpec.hpMult ?? 1);
    this.waveIndex++;
  }

  spawnEnemy(type: MinionType, pos: Vec, elite: boolean, spawnTime: number): Enemy | null {
    if (this.enemies.length >= MAX_ENEMIES) return null;
    const d = ENEMIES[type];
    const hp = d.hp * this.hpScale * (elite ? ELITE.hpMult : 1);
    const e: Enemy = {
      id: this.nextId++,
      type,
      pos: { ...pos },
      radius: d.radius * (elite ? 1.15 : 1),
      hp,
      maxHp: hp,
      contact: d.contact * this.dmgScale,
      shotDmg: d.shotDmg * this.dmgScale,
      speed: d.speed,
      flying: d.flying,
      elite,
      state: 'spawn',
      t: spawnTime,
      cd: d.period > 0 ? this.rng.range(0.6, d.period + 0.4) : 0,
      eliteCd: this.rng.range(2, 4),
      eliteWind: 0,
      aim: { x: 0, y: 1 },
      chargeLeft: 0,
      slowT: 0,
      burnT: 0,
      burnDps: 0,
      poisonStacks: 0,
      poisonT: 0,
      poisonDps: 0,
      orbHitCd: 0,
      strafe: this.rng.chance(0.5) ? 1 : -1,
      volley: 0,
    };
    this.enemies.push(e);
    return e;
  }

  private spawnBoss(archetype: BossArchetype, variant: number, hpMult: number): void {
    const def = BOSSES[archetype];
    const hp = BOSS_BASE_HP * this.hpScale * hpMult;
    const e = this.spawnEnemy('goblin', { x: ARENA_W / 2, y: 44 * 3.5 }, false, 1.2)!;
    Object.assign(e, {
      type: 'boss',
      radius: def.radius,
      hp,
      maxHp: hp,
      contact: def.contact * this.dmgScale,
      shotDmg: def.shotDmg * this.dmgScale,
      speed: def.speed,
      flying: def.flying,
      cd: 0,
    });
    e.boss = { archetype, variant, phase: 0, patternIdx: 0, pattern: null, repeatsLeft: 0, breath: BOSS_BREATH, spin: 0 };
  }

  // ───────────────────────────── boucle ─────────────────────────────

  step(input: HeroInput): void {
    const dt = SIM_DT;
    this.events.length = 0;
    this.t += dt;
    this.updateHero(input, dt);
    this.updateThread();
    for (const e of this.enemies) this.updateEnemy(e, dt);
    this.separateEnemies();
    this.threadContacts(dt);
    this.updateProjectiles(dt);
    this.projectileSnips(dt);
    this.updatePendingCuts();
    this.updateHazards();
    this.updateOrbs(dt);
    this.contactDamage();
    this.updateStatus(dt);
    this.reap();

    if (!this.cleared) {
      const alive = this.enemies.length;
      if (this.waveIndex < this.waves.length) {
        if (alive <= 2) this.spawnWave();
      } else if (alive === 0) {
        this.cleared = true;
        this.events.push({ e: 'cleared' });
        // projectiles ennemis effacés, orbes de soin ramassés à la fin de la salle
        this.projectiles = this.projectiles.filter((p) => p.fromHero);
        this.hazards.length = 0;
        for (const o of this.orbs) this.healHero(o.heal);
        this.orbs.length = 0;
      }
    } else {
      const h = this.hero.pos;
      if (Math.hypot(h.x - this.arena.portal.x, h.y - this.arena.portal.y) < 26) this.exited = true;
    }
    if (this.hero.hp <= 0) this.dead = true;
  }

  // ───────────────────────────── héros ─────────────────────────────

  private updateHero(input: HeroInput, dt: number): void {
    const h = this.hero;
    const s = h.stats;
    let mx = input.mx;
    let my = input.my;
    const m = Math.hypot(mx, my);
    if (m > 1) {
      mx /= m;
      my /= m;
    }
    if (!input.touching) {
      mx = 0;
      my = 0;
    }
    const vx = mx * s.speed;
    const vy = my * s.speed;
    const bx = h.pos.x;
    const by = h.pos.y;
    this.arena.moveCircle(h.pos, vx * dt, vy * dt, HERO.radius);
    h.vel.x = (h.pos.x - bx) / dt;
    h.vel.y = (h.pos.y - by) / dt;
    const speed = Math.hypot(h.vel.x, h.vel.y);
    const wasMoving = h.moving;
    h.moving = speed >= CONTROL.stillSpeed;
    if (h.moving) {
      h.stillTime = 0;
      // tir auto permanent : le héros garde sa visée en marchant (il ne se retourne que si la cible change)
      if (!h.autoFire) {
        h.aimTime = 0;
        h.facing = Math.atan2(h.vel.y, h.vel.x);
      }
    } else {
      h.stillTime += dt;
      if (wasMoving && s.flashStep) h.flashT = 0.3;
    }
    h.invuln = Math.max(0, h.invuln - dt);
    h.flashT = Math.max(0, h.flashT - dt);
    h.fireCd = Math.max(0, h.fireCd - dt);
    if (s.shield && !h.shieldReady) {
      h.shieldCd -= dt;
      if (h.shieldCd <= 0) h.shieldReady = true;
    }

    // orbe gardien
    if (s.orb) {
      h.orbAngle += 3.2 * dt;
      const ox = h.pos.x + Math.cos(h.orbAngle) * 56;
      const oy = h.pos.y + Math.sin(h.orbAngle) * 56;
      for (const e of this.enemies) {
        if (e.state === 'spawn' || e.orbHitCd > 0) continue;
        if (Math.hypot(e.pos.x - ox, e.pos.y - oy) < e.radius + 10) {
          this.damageEnemy(e, POWER_TUNING.orbDamage * (s.damage / HERO.damage), false, false);
          e.orbHitCd = 0.5;
        }
      }
    }

    // tir automatique
    const canFire = h.autoFire || !input.touching || h.stillTime >= CONTROL.stillTime;
    const prevTarget = this.target;
    this.target = this.pickTarget();
    if (!this.target || !canFire) {
      h.aimTime = 0;
      return;
    }
    if (this.target !== prevTarget) h.aimTime = 0; // se tourner vers la nouvelle cible (0,08 s)
    const tgt = this.target;
    const ang = Math.atan2(tgt.pos.y - h.pos.y, tgt.pos.x - h.pos.x);
    h.facing = ang;
    h.aimTime += dt;
    if (h.aimTime < CONTROL.turnTime || h.fireCd > 0) return;
    h.fireCd = 1 / s.fireRate;
    this.fireVolley(ang);
  }

  pickTarget(): Enemy | null {
    // le plus proche en ligne de tir, à défaut le plus proche ; on teste la vue par distance croissante
    // (même résultat qu'un balayage complet, beaucoup moins de lancers de rayon)
    const h = this.hero.pos;
    const idx = this.tgtIdx;
    const dist = this.tgtD;
    let n = 0;
    for (let i = 0; i < this.enemies.length; i++) {
      const e = this.enemies[i];
      if (e.state === 'spawn' || e.hp <= 0) continue;
      const d = (e.pos.x - h.x) ** 2 + (e.pos.y - h.y) ** 2;
      let j = n++;
      while (j > 0 && dist[j - 1] > d) {
        dist[j] = dist[j - 1];
        idx[j] = idx[j - 1];
        j--;
      }
      dist[j] = d;
      idx[j] = i;
    }
    if (n === 0) return null;
    for (let k = 0; k < n; k++) {
      const e = this.enemies[idx[k]];
      // ligne de tir : les haies arrêtent les flèches du héros, même vers un volant (cf. DECISIONS)
      if (this.arena.lineOfSight(h, e.pos)) return e;
    }
    return this.enemies[idx[0]];
  }

  private fireVolley(ang: number): void {
    const h = this.hero;
    const s = h.stats;
    const dirs: number[] = [ang];
    if (s.rearShot) dirs.push(ang + Math.PI);
    if (s.diagonals) dirs.push(ang + Math.PI / 4, ang - Math.PI / 4);
    if (s.sideShots) dirs.push(ang + Math.PI / 2, ang - Math.PI / 2);
    const n = 1 + s.multishot;
    for (const a of dirs) {
      const cx = Math.cos(a);
      const cy = Math.sin(a);
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * 10;
        this.addProjectile({
          pos: { x: h.pos.x - cy * off + cx * 10, y: h.pos.y + cx * off + cy * 10 },
          vel: { x: cx * HERO.projectileSpeed, y: cy * HERO.projectileSpeed },
          radius: HERO.projectileRadius,
          dmg: s.damage * SHOT_DMG_MULT * (s.pierce ? POWER_TUNING.pierceDmg : 1),
          fromHero: true,
          born: this.t,
          pierce: s.pierce,
          wallBounce: s.wallBounce,
          ricochet: s.ricochet,
          lastHit: -1,
          dead: false,
        });
      }
    }
    this.events.push({ e: 'shoot', x: h.pos.x, y: h.pos.y });
  }

  private addProjectile(p: Projectile): void {
    if (this.projectiles.length >= MAX_PROJECTILES) {
      // borne §13 : on recycle le plus ancien projectile du héros, sinon on ignore
      const i = this.projectiles.findIndex((q) => q.fromHero);
      if (i < 0 || !p.fromHero) return;
      this.projectiles.splice(i, 1);
    }
    this.projectiles.push(p);
  }

  enemyShot(from: Vec, ang: number, speed: number, dmg: number, radius = 8): void {
    this.addProjectile({
      pos: { x: from.x, y: from.y },
      vel: { x: Math.cos(ang) * speed, y: Math.sin(ang) * speed },
      radius,
      dmg,
      fromHero: false,
      born: this.t,
      pierce: false,
      wallBounce: 0,
      ricochet: 0,
      lastHit: -1,
      dead: false,
      src: this.shooter,
      ownerId: this.shooterId,
    });
  }

  damageHero(dmg: number, src?: string, ref?: object): void {
    const h = this.hero;
    if (h.invuln > 0 || h.flashT > 0 || this.cleared || h.hp <= 0) return;
    if (h.stats.dodge > 0 && this.rng.chance(h.stats.dodge)) {
      h.invuln = 0.2;
      this.events.push({ e: 'dodge' });
      return;
    }
    if (h.shieldReady) {
      h.shieldReady = false;
      h.shieldCd = POWER_TUNING.shieldCooldown;
      h.invuln = HERO.invulnAfterHit;
      this.events.push({ e: 'shield' });
      return;
    }
    h.hp -= dmg;
    h.damageTaken += dmg;
    h.hitsTaken++;
    h.invuln = HERO.invulnAfterHit;
    this.events.push({ e: 'heroHit', dmg, src, ref });
  }

  healHero(v: number): void {
    const h = this.hero;
    h.hp = Math.min(h.stats.maxHp, h.hp + v);
  }

  // ───────────────────────────── ennemis ─────────────────────────────

  private updateEnemy(e: Enemy, dt: number): void {
    if (e.orbHitCd > 0) e.orbHitCd -= dt;
    if (e.state === 'spawn') {
      e.t -= dt;
      if (e.t <= 0) e.state = 'move';
      return;
    }
    this.shooter = e.boss ? 'boss' : e.type;
    this.shooterId = e.id;
    if (e.boss) return this.updateBoss(e, dt);
    const slow = e.slowT > 0 ? 1 - POWER_TUNING.frostSlow : 1;
    const h = this.hero.pos;
    const dx = h.x - e.pos.x;
    const dy = h.y - e.pos.y;
    const dist = Math.hypot(dx, dy);

    // attaque bonus des élites : anneau lent télégraphié
    if (e.elite) {
      if (e.eliteWind > 0) {
        e.eliteWind -= dt;
        if (e.eliteWind <= 0) {
          const off = this.rng.next() * Math.PI;
          this.shooter = 'elite';
          for (let i = 0; i < 8; i++) this.enemyShot(e.pos, off + (i * Math.PI) / 4, 140, e.shotDmg > 0 ? e.shotDmg : e.contact * 0.7, 8);
          this.shooter = e.type;
          e.eliteCd = 4.5;
        }
      } else {
        e.eliteCd -= dt;
        if (e.eliteCd <= 0) e.eliteWind = 0.6;
      }
    }

    switch (e.type) {
      case 'goblin':
      case 'skeleton':
      case 'mage': {
        const [near, far] = e.type === 'goblin' ? [150, 250] : e.type === 'skeleton' ? [190, 300] : [170, 280];
        if (e.state === 'move') {
          this.keepRange(e, near, far, dist, e.speed * slow, dt);
          e.cd -= dt;
          if (e.cd <= 0) {
            e.state = 'windup';
            e.t = e.type === 'mage' ? 0.3 : 0.5;
            if (e.type === 'mage') {
              // flaque télégraphiée 0,8 s à la position actuelle du héros
              this.hazards.push({
                kind: 'circle',
                pos: { ...h },
                radius: 50,
                born: this.t,
                activeAt: this.t + 0.8,
                endAt: this.t + 0.8 + 3,
                dmg: e.shotDmg,
                tick: 0.5,
                nextTick: this.t + 0.8,
                ownerId: e.id,
                src: this.shooter,
              });
            }
          }
        } else if (e.state === 'windup') {
          e.t -= dt;
          if (e.t <= 0) {
            const a = Math.atan2(h.y - e.pos.y, h.x - e.pos.x);
            if (e.type === 'goblin') this.enemyShot(e.pos, a, 300, e.shotDmg, 7);
            else if (e.type === 'skeleton') for (const k of [-1, 0, 1]) this.enemyShot(e.pos, a + (k * 15 * Math.PI) / 180, 340, e.shotDmg, 6);
            e.state = 'move';
            e.cd = ENEMIES[e.type].period;
          }
        }
        break;
      }
      case 'mushroom':
      case 'totem': {
        if (e.state === 'move') {
          e.cd -= dt;
          if (e.cd <= 0) {
            e.state = 'windup';
            e.t = 0.5;
          }
        } else if (e.state === 'windup') {
          e.t -= dt;
          if (e.t <= 0) {
            if (e.type === 'mushroom') {
              const off = this.rng.next() * Math.PI;
              for (let i = 0; i < 8; i++) this.enemyShot(e.pos, off + (i * Math.PI) / 4, 150, e.shotDmg, 8);
            } else {
              e.volley++;
              const off = (e.volley * 20 * Math.PI) / 180;
              for (let i = 0; i < 6; i++) this.enemyShot(e.pos, off + (i * Math.PI) / 3, 170, e.shotDmg, 8);
            }
            e.state = 'move';
            e.cd = ENEMIES[e.type].period - 0.5;
          }
        }
        break;
      }
      case 'wolf':
      case 'snipper': {
        // le crabe-ciseaux vise le milieu du fil s'il est assez long, sinon l'héroïne
        const th = this.hero.thread;
        const aimAt = e.type === 'snipper' && th.length >= 10 ? th[th.length >> 1] : h;
        const adx = aimAt.x - e.pos.x;
        const ady = aimAt.y - e.pos.y;
        const chargeSpeed = e.type === 'snipper' ? 360 : 420;
        if (e.state === 'move') {
          this.chase(e, e.speed * slow, dt);
          e.cd -= dt;
          if (e.cd <= 0 && Math.hypot(adx, ady) < 320 && this.arena.lineOfWalk(e.pos, aimAt)) {
            e.state = 'windup';
            e.t = 0.6;
            const dir = norm(adx, ady);
            e.aim = dir;
            const len = this.rayLength(e.pos, dir, 340, e.radius);
            e.chargeLeft = len;
            this.hazards.push({
              kind: 'line',
              pos: { ...e.pos },
              to: { x: e.pos.x + dir.x * len, y: e.pos.y + dir.y * len },
              radius: e.radius,
              born: this.t,
              activeAt: this.t + 0.6,
              endAt: this.t + 0.6 + len / chargeSpeed,
              dmg: 0,
              tick: 0,
              nextTick: Infinity,
              ownerId: e.id,
              src: this.shooter,
            });
          }
        } else if (e.state === 'windup') {
          e.t -= dt;
          if (e.t <= 0) e.state = 'charge';
        } else if (e.state === 'charge') {
          const step = Math.min(e.chargeLeft, chargeSpeed * dt);
          this.arena.moveCircle(e.pos, e.aim.x * step, e.aim.y * step, e.radius);
          e.chargeLeft -= step;
          if (e.chargeLeft <= 0) {
            e.state = 'recover';
            e.t = 0.6;
          }
        } else if (e.state === 'recover') {
          e.t -= dt;
          if (e.t <= 0) {
            e.state = 'move';
            e.cd = ENEMIES[e.type].period;
          }
        }
        break;
      }
      case 'jelly':
      case 'jellySmall':
        this.chase(e, e.speed * slow, dt);
        break;
      case 'moth': {
        // la mite file vers le fil et le grignote ; sans fil, elle volette autour de l'héroïne
        if (e.state === 'windup') {
          e.t -= dt;
          if (e.t <= 0) e.state = 'move';
          break;
        }
        const th = this.hero.thread;
        let tx = h.x;
        let ty = h.y;
        let ti = -1;
        if (th.length >= 4) {
          let bd = Infinity;
          for (let i = 0; i < th.length; i++) {
            const d = (th[i].x - e.pos.x) ** 2 + (th[i].y - e.pos.y) ** 2;
            if (d < bd) {
              bd = d;
              ti = i;
            }
          }
          tx = th[ti].x;
          ty = th[ti].y;
        }
        const dir = norm(tx - e.pos.x, ty - e.pos.y);
        const w = Math.sin(this.t * 6 + e.id) * 0.7;
        const n2 = norm(dir.x - dir.y * w, dir.y + dir.x * w);
        const sp = e.speed * slow * (ti < 0 && dist < 80 ? 0.5 : 1);
        this.arena.moveCircle(e.pos, n2.x * sp * dt, n2.y * sp * dt, e.radius, true);
        if (ti >= 0 && Math.hypot(tx - e.pos.x, ty - e.pos.y) < e.radius + 4) {
          this.snipThread(ti, 'moth');
          e.state = 'windup';
          e.t = 0.6;
        }
        break;
      }
      case 'bat': {
        if (e.state === 'move') {
          // vol en zigzag vers le héros
          const dir = norm(dx, dy);
          const w = Math.sin(this.t * 4 + e.id) * 0.8 * e.strafe;
          const vx = dir.x - dir.y * w;
          const vy = dir.y + dir.x * w;
          const n2 = norm(vx, vy);
          const sp = dist > 90 ? e.speed : e.speed * 0.4;
          this.arena.moveCircle(e.pos, n2.x * sp * slow * dt, n2.y * sp * slow * dt, e.radius, true);
          e.cd -= dt;
          if (e.cd <= 0 && dist < 260) {
            e.state = 'windup';
            e.t = 0.5;
            e.aim = norm(dx, dy);
            const len = Math.min(dist + 60, 0.45 * 380);
            this.hazards.push({
              kind: 'line',
              pos: { ...e.pos },
              to: { x: e.pos.x + e.aim.x * len, y: e.pos.y + e.aim.y * len },
              radius: e.radius,
              born: this.t,
              activeAt: this.t + 0.5,
              endAt: this.t + 0.5 + len / 380,
              dmg: 0,
              tick: 0,
              nextTick: Infinity,
              ownerId: e.id,
              src: this.shooter,
            });
            e.chargeLeft = len;
          }
        } else if (e.state === 'windup') {
          e.t -= dt;
          if (e.t <= 0) e.state = 'charge';
        } else if (e.state === 'charge') {
          const step = Math.min(e.chargeLeft, 380 * dt);
          this.arena.moveCircle(e.pos, e.aim.x * step, e.aim.y * step, e.radius, true);
          e.chargeLeft -= step;
          if (e.chargeLeft <= 0) {
            e.state = 'recover';
            e.t = 0.4;
          }
        } else if (e.state === 'recover') {
          e.t -= dt;
          if (e.t <= 0) {
            e.state = 'move';
            e.cd = ENEMIES.bat.period;
          }
        }
        break;
      }
    }
  }

  /** Longueur libre d'un rayon de charge (s'arrête devant un obstacle de marche). */
  private rayLength(from: Vec, dir: Vec, max: number, rad: number): number {
    for (let d = 10; d <= max; d += 10) {
      const x = from.x + dir.x * d;
      const y = from.y + dir.y * d;
      if (!this.arena.isWalkableAt(x + dir.x * rad, y + dir.y * rad)) return Math.max(0, d - 10);
    }
    return max;
  }

  private chase(e: Enemy, speed: number, dt: number): void {
    const dir = e.flying ? norm(this.hero.pos.x - e.pos.x, this.hero.pos.y - e.pos.y) : this.arena.steer(e.pos, this.hero.pos);
    this.arena.moveCircle(e.pos, dir.x * speed * dt, dir.y * speed * dt, e.radius, e.flying);
  }

  private keepRange(e: Enemy, near: number, far: number, dist: number, speed: number, dt: number): void {
    const h = this.hero.pos;
    if (dist > far || !this.arena.lineOfSight(e.pos, h)) {
      this.chase(e, speed, dt);
    } else if (dist < near) {
      const away = norm(e.pos.x - h.x, e.pos.y - h.y);
      this.arena.moveCircle(e.pos, away.x * speed * dt, away.y * speed * dt, e.radius);
    } else {
      // déplacement latéral léger
      const side = norm(-(h.y - e.pos.y) * e.strafe, (h.x - e.pos.x) * e.strafe);
      const before = { ...e.pos };
      this.arena.moveCircle(e.pos, side.x * speed * 0.5 * dt, side.y * speed * 0.5 * dt, e.radius);
      if (Math.hypot(e.pos.x - before.x, e.pos.y - before.y) < speed * 0.1 * dt) e.strafe = -e.strafe;
    }
  }

  // ───────────────────────────── boss ─────────────────────────────

  private updateBoss(e: Enemy, dt: number): void {
    const b = e.boss!;
    const def = BOSSES[b.archetype];
    const h = this.hero.pos;
    const frac = e.hp / e.maxHp;
    const phase = frac > 2 / 3 ? 0 : frac > 1 / 3 ? 1 : 2;
    if (phase !== b.phase) {
      b.phase = phase;
      b.patternIdx = 0;
    }
    const slow = e.slowT > 0 ? 1 - POWER_TUNING.frostSlow : 1;
    const v = b.variant;
    if (b.breath > 0) {
      // ouverture : le boss reprend son souffle et se replace lentement
      b.breath -= dt;
      const dist = Math.hypot(h.x - e.pos.x, h.y - e.pos.y);
      if (dist > 200) this.chase(e, e.speed * slow, dt);
      if (b.breath <= 0) {
        const list = def.phases[b.phase];
        b.pattern = list[b.patternIdx % list.length];
        b.patternIdx++;
        b.repeatsLeft = b.pattern.repeats ?? 1;
        e.state = 'windup';
        e.t = b.pattern.kind === 'charge' ? 0.7 : 0.6;
        if (b.pattern.kind === 'charge') this.bossChargeTelegraph(e, b.pattern);
        if (b.pattern.kind === 'slam') this.bossSlamTelegraph(e, b.pattern);
        if (b.pattern.kind === 'puddles' || b.pattern.kind === 'rain') this.bossZones(e, b.pattern, v);
      }
      return;
    }
    const p = b.pattern!;
    if (e.state === 'windup') {
      e.t -= dt;
      if (e.t > 0) return;
      if (p.kind === 'charge') {
        e.state = 'charge';
        return;
      }
      e.state = 'move';
      e.t = 0;
    }
    if (e.state === 'charge') {
      const sp = (p.speed ?? 450) * (1 + 0.06 * v);
      const step = Math.min(e.chargeLeft, sp * dt);
      this.arena.moveCircle(e.pos, e.aim.x * step, e.aim.y * step, e.radius, e.flying);
      e.chargeLeft -= step;
      if (e.chargeLeft > 0) return;
      e.state = 'move';
      this.endPattern(e);
      return;
    }
    // exécution du motif
    e.t -= dt;
    if (e.t > 0) return;
    const sp = (p.speed ?? 200) * (1 + 0.06 * v);
    const a = Math.atan2(h.y - e.pos.y, h.x - e.pos.x);
    const cnt = p.count + v;
    switch (p.kind) {
      case 'aimed': {
        const spread = ((p.spread ?? 30) * Math.PI) / 180;
        for (let i = 0; i < cnt; i++) this.enemyShot(e.pos, a + (cnt === 1 ? 0 : -spread / 2 + (spread * i) / (cnt - 1)), sp, e.shotDmg, 8);
        break;
      }
      case 'ring': {
        const off = this.rng.next() * Math.PI * 2;
        const n = p.count + 2 * v;
        for (let i = 0; i < n; i++) this.enemyShot(e.pos, off + (i * 2 * Math.PI) / n, sp, e.shotDmg, 9);
        break;
      }
      case 'spiral': {
        b.spin += 0.35;
        for (let i = 0; i < cnt; i++) this.enemyShot(e.pos, b.spin + (i * 2 * Math.PI) / cnt, sp, e.shotDmg, 8);
        break;
      }
      case 'summon': {
        const t = p.minion ?? 'goblin';
        for (let i = 0; i < p.count; i++) {
          const ang = this.rng.next() * Math.PI * 2;
          const pos = { x: clamp(e.pos.x + Math.cos(ang) * 60, 30, ARENA_W - 30), y: clamp(e.pos.y + Math.sin(ang) * 60, 30, ARENA_H - 30) };
          if (this.arena.isWalkableAt(pos.x, pos.y)) this.spawnEnemy(t, pos, false, 0.6);
        }
        break;
      }
      case 'slam':
      case 'puddles':
      case 'rain':
      case 'charge':
        break;
    }
    b.repeatsLeft--;
    if (b.repeatsLeft > 0) {
      e.t = p.interval ?? 0.5;
      return;
    }
    this.endPattern(e);
  }

  private endPattern(e: Enemy): void {
    const b = e.boss!;
    const p = b.pattern!;
    if (p.kind === 'charge' && p.count > 1 && e.volley < p.count - 1) {
      e.volley++;
      e.state = 'windup';
      e.t = 0.7;
      this.bossChargeTelegraph(e, p);
      return;
    }
    e.volley = 0;
    b.pattern = null;
    b.breath = BOSS_BREATH;
    e.state = 'move';
  }

  private bossChargeTelegraph(e: Enemy, p: Pattern): void {
    const h = this.hero.pos;
    const dir = norm(h.x - e.pos.x, h.y - e.pos.y);
    const len = e.flying ? Math.min(420, Math.hypot(h.x - e.pos.x, h.y - e.pos.y) + 80) : this.rayLength(e.pos, dir, 420, e.radius);
    e.aim = dir;
    e.chargeLeft = len;
    const sp = (p.speed ?? 450) * (1 + 0.06 * (e.boss?.variant ?? 0));
    this.hazards.push({
      kind: 'line',
      pos: { ...e.pos },
      to: { x: e.pos.x + dir.x * len, y: e.pos.y + dir.y * len },
      radius: e.radius,
      born: this.t,
      activeAt: this.t + 0.7,
      endAt: this.t + 0.7 + len / sp,
      dmg: 0,
      tick: 0,
      nextTick: Infinity,
      ownerId: e.id,
      src: this.shooter,
    });
    e.state = 'windup';
    e.t = 0.7;
  }

  private bossSlamTelegraph(e: Enemy, p: Pattern): void {
    const r = (p.radius ?? 120) * (1 + 0.05 * (e.boss?.variant ?? 0));
    // télégraphe assez long pour sortir de la zone depuis le centre à vitesse de base (+ marge de réaction)
    const warn = Math.max(0.8, (r + HERO.radius * 0.5) / HERO.speed + BOSS_SLAM_MARGIN);
    this.hazards.push({
      kind: 'circle',
      pos: { ...e.pos },
      radius: r,
      born: this.t,
      activeAt: this.t + warn,
      endAt: this.t + warn + 0.15,
      dmg: e.shotDmg * 1.5,
      tick: 1,
      nextTick: this.t + warn,
      ownerId: e.id,
      src: this.shooter,
    });
    e.t = warn + 0.15;
  }

  private bossZones(e: Enemy, p: Pattern, v: number): void {
    const h = this.hero.pos;
    const n = p.count + v;
    const lasting = p.kind === 'puddles';
    for (let i = 0; i < n; i++) {
      let pos: Vec;
      if (i === 0) pos = { ...h };
      else pos = { x: clamp(h.x + this.rng.range(-170, 170), 30, ARENA_W - 30), y: clamp(h.y + this.rng.range(-200, 200), 30, ARENA_H - 30) };
      const warn = lasting ? 0.8 : 0.9 + 0.12 * i;
      this.hazards.push({
        kind: 'circle',
        pos,
        radius: p.radius ?? 50,
        born: this.t,
        activeAt: this.t + warn,
        endAt: this.t + warn + (lasting ? 3 : 0.15),
        dmg: lasting ? e.shotDmg * 0.6 : e.shotDmg,
        tick: lasting ? 0.5 : 1,
        nextTick: this.t + warn,
        ownerId: e.id,
        src: this.shooter,
      });
    }
    e.t = lasting ? 0.8 : 1.1;
  }

  // ───────────────────────────── projectiles ─────────────────────────────

  private updateProjectiles(dt: number): void {
    const h = this.hero;
    for (const p of this.projectiles) {
      if (p.dead) continue;
      // sous-pas pour éviter de traverser une case (900 pt/s)
      const sub = p.fromHero ? 3 : 1;
      for (let k = 0; k < sub && !p.dead; k++) {
        const nx = p.pos.x + (p.vel.x * dt) / sub;
        const ny = p.pos.y + (p.vel.y * dt) / sub;
        if (this.arena.isShotBlockedAt(nx, ny)) {
          if (p.fromHero && p.wallBounce > 0) {
            p.wallBounce--;
            const bx = this.arena.isShotBlockedAt(nx, p.pos.y);
            const by = this.arena.isShotBlockedAt(p.pos.x, ny);
            if (bx || !by) p.vel.x = -p.vel.x;
            if (by || !bx) p.vel.y = -p.vel.y;
            continue;
          }
          p.dead = true;
          break;
        }
        p.pos.x = nx;
        p.pos.y = ny;
        if (p.fromHero) {
          for (const e of this.enemies) {
            if (e.hp <= 0 || e.state === 'spawn' || e.id === p.lastHit) continue;
            const rr = e.radius + p.radius;
            const ddx = e.pos.x - p.pos.x;
            const ddy = e.pos.y - p.pos.y;
            if (ddx * ddx + ddy * ddy > rr * rr) continue;
            this.heroHit(p, e);
            break;
          }
        } else {
          const rr = HERO.radius + p.radius;
          if ((h.pos.x - p.pos.x) ** 2 + (h.pos.y - p.pos.y) ** 2 <= rr * rr && !this.cleared) {
            this.damageHero(p.dmg, 'proj:' + (p.src ?? '?'), p);
            p.dead = true;
          }
        }
      }
    }
    compact(this.projectiles, (p) => !p.dead);
  }

  private heroHit(p: Projectile, e: Enemy): void {
    this.dmgSrc = 'shot';
    this.heroHitInner(p, e);
    this.dmgSrc = 'other';
  }

  private heroHitInner(p: Projectile, e: Enemy): void {
    const s = this.hero.stats;
    const crit = s.critChance > 0 && this.rng.chance(s.critChance);
    let dmg = p.dmg * (crit ? 2 : 1);
    if (e.elite || e.boss) dmg *= s.eliteMult;
    this.damageEnemy(e, dmg, true, crit);
    p.lastHit = e.id;
    if (s.chain) {
      let n = 0;
      const sorted = this.enemies
        .filter((o) => o !== e && o.hp > 0 && o.state !== 'spawn' && Math.hypot(o.pos.x - e.pos.x, o.pos.y - e.pos.y) < 160)
        .sort((a, b) => Math.hypot(a.pos.x - e.pos.x, a.pos.y - e.pos.y) - Math.hypot(b.pos.x - e.pos.x, b.pos.y - e.pos.y));
      for (const o of sorted) {
        if (n++ >= POWER_TUNING.chainTargets) break;
        this.damageEnemy(o, dmg * POWER_TUNING.chainFrac, false, false);
      }
    }
    if (p.ricochet > 0) {
      let best: Enemy | null = null;
      let bd = 260;
      for (const o of this.enemies) {
        if (o === e || o.hp <= 0 || o.state === 'spawn') continue;
        const d = Math.hypot(o.pos.x - p.pos.x, o.pos.y - p.pos.y);
        if (d < bd) {
          bd = d;
          best = o;
        }
      }
      if (best) {
        p.ricochet--;
        p.dmg *= POWER_TUNING.ricochetDmg;
        const dir = norm(best.pos.x - p.pos.x, best.pos.y - p.pos.y);
        p.vel.x = dir.x * HERO.projectileSpeed;
        p.vel.y = dir.y * HERO.projectileSpeed;
        return;
      }
    }
    if (!p.pierce) p.dead = true;
  }

  damageEnemy(e: Enemy, dmg: number, onHit: boolean, crit: boolean): void {
    if (e.hp <= 0) return;
    const s = this.hero.stats;
    this.hero.dmgBy[this.dmgSrc] += Math.min(dmg, e.hp);
    e.hp -= dmg;
    if (s.lifesteal > 0) this.healHero(dmg * s.lifesteal);
    this.events.push({ e: 'hit', x: e.pos.x, y: e.pos.y, crit });
    if (!onHit) return;
    if (s.flame) {
      e.burnT = 2;
      e.burnDps = Math.max(e.burnDps, dmg * 0.2);
    }
    if (s.frost) e.slowT = POWER_TUNING.frostDuration;
    if (s.poison) {
      e.poisonStacks = Math.min(5, e.poisonStacks + 1);
      e.poisonT = 4;
      e.poisonDps = s.damage * 0.08 * e.poisonStacks;
    }
  }

  private updateStatus(dt: number): void {
    for (const e of this.enemies) {
      if (e.slowT > 0) e.slowT -= dt;
      if (e.burnT > 0) {
        e.burnT -= dt;
        if (e.hp > 0) this.hero.dmgBy.other += Math.min(e.hp, e.burnDps * dt);
        e.hp -= e.burnDps * dt;
        if (e.burnT <= 0) e.burnDps = 0;
      }
      if (e.poisonT > 0) {
        e.poisonT -= dt;
        if (e.hp > 0) this.hero.dmgBy.other += Math.min(e.hp, e.poisonDps * dt);
        e.hp -= e.poisonDps * dt;
        if (e.poisonT <= 0) {
          e.poisonStacks = 0;
          e.poisonDps = 0;
        }
      }
    }
  }

  private reap(): void {
    const s = this.hero.stats;
    const dead = this.enemies.filter((e) => e.hp <= 0);
    if (!dead.length) return;
    this.enemies = this.enemies.filter((e) => e.hp > 0);
    for (const e of dead) {
      this.kills++;
      this.events.push({ e: 'kill', x: e.pos.x, y: e.pos.y, type: e.type });
      this.hazards = this.hazards.filter((z) => !(z.ownerId === e.id && z.dmg === 0));
      if (e.type === 'jelly') {
        for (const k of [-1, 1]) {
          const pos = { x: e.pos.x + k * 14, y: e.pos.y };
          if (!this.arena.isWalkableAt(pos.x, pos.y)) pos.x = e.pos.x;
          this.spawnEnemy('jellySmall', pos, false, 0.25);
        }
      }
      if (s.blast) {
        for (const o of this.enemies) {
          if (o.hp > 0 && Math.hypot(o.pos.x - e.pos.x, o.pos.y - e.pos.y) < 64 + o.radius) this.damageEnemy(o, s.damage * 0.5, false, false);
        }
      }
      if (!e.boss && this.rng.chance(HEAL_ORB.dropChance)) this.orbs.push({ pos: { ...e.pos }, heal: this.hero.stats.maxHp * HEAL_ORB.healFrac });
    }
    // une explosion peut tuer en chaîne
    if (this.enemies.some((e) => e.hp <= 0)) this.reap();
  }

  private updateHazards(): void {
    const h = this.hero.pos;
    for (const z of this.hazards) {
      if (z.dmg <= 0 || this.t < z.activeAt || this.t > z.endAt) continue;
      if (this.t + 1e-9 < z.nextTick) continue;
      z.nextTick += z.tick;
      if (Math.hypot(h.x - z.pos.x, h.y - z.pos.y) < z.radius + HERO.radius * 0.5) this.damageHero(z.dmg, 'zone:' + (z.src ?? '?'), z);
    }
    const now = this.t;
    compact(this.hazards, (z) => now <= z.endAt);
  }

  private updateOrbs(dt: number): void {
    const h = this.hero;
    const magnet = h.stats.magnet;
    this.orbs = this.orbs.filter((o) => {
      const d = Math.hypot(h.pos.x - o.pos.x, h.pos.y - o.pos.y);
      if (magnet && d < HEAL_ORB.magnetRange) {
        const dir = norm(h.pos.x - o.pos.x, h.pos.y - o.pos.y);
        o.pos.x += dir.x * 320 * dt;
        o.pos.y += dir.y * 320 * dt;
      }
      if (d < HEAL_ORB.pickupRadius) {
        this.healHero(o.heal * (magnet ? HEAL_ORB.magnetHealMult : 1));
        return false;
      }
      return true;
    });
  }

  private contactDamage(): void {
    const h = this.hero.pos;
    for (const e of this.enemies) {
      if (e.state === 'spawn' || e.contact <= 0) continue;
      const rr = e.radius + HERO.radius - 2;
      if ((e.pos.x - h.x) ** 2 + (e.pos.y - h.y) ** 2 < rr * rr) this.damageHero(e.contact, 'contact:' + (e.boss ? 'boss' : e.type) + (e.state === 'charge' ? '-charge' : ''), e);
    }
  }

  private separateEnemies(): void {
    const es = this.enemies;
    for (let i = 0; i < es.length; i++) {
      const a = es[i];
      if (a.boss || a.state === 'charge') continue;
      for (let j = i + 1; j < es.length; j++) {
        const b = es[j];
        if (b.boss || b.state === 'charge' || a.flying !== b.flying) continue;
        const dx = b.pos.x - a.pos.x;
        const dy = b.pos.y - a.pos.y;
        const rr = a.radius + b.radius;
        const d2 = dx * dx + dy * dy;
        if (d2 >= rr * rr || d2 < 1e-6) continue;
        const d = Math.sqrt(d2);
        const push = (rr - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        if (a.speed > 0) this.arena.moveCircle(a.pos, -ux * push, -uy * push, a.radius, a.flying);
        if (b.speed > 0) this.arena.moveCircle(b.pos, ux * push, uy * push, b.radius, b.flying);
      }
    }
  }

  // ───────────────────────────── Ciseaux de lune ─────────────────────────────

  private pendingCuts: { poly: Vec[]; at: number; mult: number }[] = [];

  /** Déroule le fil derrière l'héroïne, fait sécher les vieux points et détecte les boucles fermées. */
  private updateThread(): void {
    const h = this.hero;
    h.cutT = Math.max(0, h.cutT - SIM_DT * 2.5);
    const th = h.thread;
    const life = THREAD.life * h.stats.threadLife;
    let drop = 0;
    while (drop < th.length && this.t - th[drop].t > life) drop++;
    if (drop) th.splice(0, drop);
    if (this.cleared) {
      th.length = 0;
      return;
    }
    const last = th[th.length - 1];
    const p = h.pos;
    if (last && Math.hypot(p.x - last.x, p.y - last.y) < THREAD.spacing) return;
    if (!h.moving) return;
    if (last && th.length >= 4) {
      // le nouveau segment (dernier point → héroïne) recoupe-t-il un segment plus ancien ?
      for (let i = th.length - 3; i >= 0; i--) {
        const x = segX(th[i], th[i + 1], last, p);
        if (!x) continue;
        const poly: Vec[] = [x];
        for (let k = i + 1; k < th.length; k++) poly.push({ x: th[k].x, y: th[k].y });
        poly.push({ x: p.x, y: p.y });
        if (Math.abs(polyArea(poly)) >= THREAD.minArea) {
          this.performCut(poly, 1, false);
          th.length = 0;
          th.push({ x: p.x, y: p.y, t: this.t });
          return;
        }
        break;
      }
    }
    th.push({ x: p.x, y: p.y, t: this.t });
    if (th.length > THREAD.maxPoints) th.splice(0, th.length - THREAD.maxPoints);
  }

  /** Découpe tout ce que la boucle entoure : ennemis (dégâts), projectiles ennemis (effacés). */
  performCut(poly: Vec[], mult: number, echo: boolean): void {
    this.dmgSrc = 'cut';
    this.performCutInner(poly, mult, echo);
    this.dmgSrc = 'other';
  }

  private performCutInner(poly: Vec[], mult: number, echo: boolean): void {
    const h = this.hero;
    const s = h.stats;
    const inside = this.enemies.filter((e) => e.hp > 0 && e.state !== 'spawn' && pointInPoly(e.pos, poly));
    const base = THREAD.cutBase * (s.damage / HERO.damage) * s.cutMult * mult * (1 + THREAD.comboPerExtra * Math.max(0, inside.length - 1));
    for (const e of inside) {
      const crit = s.critChance > 0 && this.rng.chance(s.critChance);
      let dmg = base * (crit ? 2 : 1);
      if (e.elite || e.boss) dmg *= s.eliteMult;
      this.damageEnemy(e, dmg, true, crit);
    }
    if (s.confetti) {
      for (const e of inside) {
        if (e.hp > 0) continue;
        for (const o of this.enemies) {
          if (o.hp > 0 && o !== e && Math.hypot(o.pos.x - e.pos.x, o.pos.y - e.pos.y) < THREAD.confettiRadius + o.radius) this.damageEnemy(o, base * THREAD.confettiFrac, false, false);
        }
      }
    }
    for (const p of this.projectiles) if (!p.fromHero && pointInPoly(p.pos, poly)) p.dead = true;
    this.projectiles = this.projectiles.filter((p) => !p.dead);
    if (!echo) {
      h.cutT = 1;
      h.cuts++;
      if (s.echoCut) this.pendingCuts.push({ poly, at: this.t + THREAD.echoDelay, mult: THREAD.echoMult });
    }
    this.events.push({ e: 'cut', poly, hits: inside.length, echo });
  }

  private updatePendingCuts(): void {
    if (!this.pendingCuts.length) return;
    const due = this.pendingCuts.filter((c) => c.at <= this.t);
    this.pendingCuts = this.pendingCuts.filter((c) => c.at > this.t);
    for (const c of due) this.performCut(c.poly, c.mult, true);
  }

  /** Coupe le fil au segment i : la partie la plus ancienne est perdue. */
  snipThread(i: number, by: string): void {
    const th = this.hero.thread;
    if (i < 0 || i >= th.length) return;
    this.events.push({ e: 'snip', x: th[i].x, y: th[i].y, by });
    th.splice(0, i + 1);
  }

  /** Les ennemis au sol (et les mites) qui marchent sur le fil le coupent — ou se blessent s'il est barbelé. */
  private threadContacts(dt: number): void {
    const th = this.hero.thread;
    if (th.length < 2) return;
    const s = this.hero.stats;
    for (const e of this.enemies) {
      if (e.state === 'spawn' || e.hp <= 0) continue;
      if (e.flying && e.type !== 'moth') continue;
      // on ignore les tout derniers segments, collés à l'héroïne
      for (let i = th.length - 4; i >= 0; i--) {
        if (segDist2(e.pos, th[i], th[i + 1]) > e.radius * e.radius) continue;
        if (s.barbedThread) this.damageEnemy(e, THREAD.barbedDps * (s.damage / HERO.damage) * dt, false, false);
        else this.snipThread(i, e.type);
        break;
      }
    }
  }

  /** Les projectiles ennemis qui traversent le fil le coupent (sauf fil d'acier). */
  private projectileSnips(dt: number): void {
    const th = this.hero.thread;
    if (th.length < 2 || this.hero.stats.steelThread) return;
    for (const p of this.projectiles) {
      if (p.fromHero) continue;
      const a = { x: p.pos.x - p.vel.x * dt, y: p.pos.y - p.vel.y * dt };
      for (let i = th.length - 3; i >= 0; i--) {
        if (segX(th[i], th[i + 1], a, p.pos)) {
          this.snipThread(i, 'shot');
          break;
        }
      }
      if (th.length < 2) return;
    }
  }

  /** Continuer (§11) : rend 50 % des PV et efface les projectiles. */
  revive(): void {
    this.hero.hp = Math.round(this.hero.stats.maxHp * 0.5);
    this.hero.invuln = 2;
    this.dead = false;
    this.projectiles = this.projectiles.filter((p) => p.fromHero);
    this.hazards.length = 0;
  }
}

/** Filtre en place (évite une allocation par pas de simulation). */
function compact<T>(arr: T[], keep: (x: T) => boolean): void {
  let j = 0;
  for (let i = 0; i < arr.length; i++) if (keep(arr[i])) arr[j++] = arr[i];
  arr.length = j;
}

// ───────────────────────────── géométrie du fil ─────────────────────────────

/** Point d'intersection des segments [a,b] et [c,d], ou null. */
export function segX(a: Vec, b: Vec, c: Vec, d: Vec): Vec | null {
  const r1x = b.x - a.x;
  const r1y = b.y - a.y;
  const r2x = d.x - c.x;
  const r2y = d.y - c.y;
  const den = r1x * r2y - r1y * r2x;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((c.x - a.x) * r2y - (c.y - a.y) * r2x) / den;
  const u = ((c.x - a.x) * r1y - (c.y - a.y) * r1x) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { x: a.x + r1x * t, y: a.y + r1y * t };
}

export function polyArea(poly: Vec[]): number {
  let s = 0;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) s += (poly[j].x - poly[i].x) * (poly[j].y + poly[i].y);
  return s / 2;
}

export function pointInPoly(p: Vec, poly: Vec[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

function segDist2(p: Vec, a: Vec, b: Vec): number {
  const vx = b.x - a.x;
  const vy = b.y - a.y;
  const l2 = vx * vx + vy * vy;
  let t = l2 > 0 ? ((p.x - a.x) * vx + (p.y - a.y) * vy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  const dx = a.x + vx * t - p.x;
  const dy = a.y + vy * t - p.y;
  return dx * dx + dy * dy;
}
