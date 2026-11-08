/** Écran de combat : la simulation TS rendue en Canvas 2D, avec interpolation et motion design. */
import { Arena, type RoomTemplate } from '../../sim/src/arena.js';
import { FloatingAnchor } from '../../sim/src/controls.js';
import { SIM_DT, HERO, HEAL_BETWEEN_ROOMS, EMBER, GUST } from '../../sim/src/constants.js';
import { HEROES, type PowerId } from '../../sim/src/content.js';
import { offerPowers, talentsForLevel, type LevelDef } from '../../sim/src/level.js';
import { stars as starsOf } from '../../sim/src/formulas.js';
import { Rng, seedOf } from '../../sim/src/rng.js';
import { World, newHero, grantPower, type Enemy, type HeroState, type Hazard, type Projectile } from '../../sim/src/world.js';
import { PAINTERS, type AnimState } from '../../art/src/characters.js';
import { hatch, flameCut, heartShape } from '../../art/src/vfx.js';
import { paintArenaStatic, paintLiquids, paintDecorAnim, paintPortal, paintFrame, AW, AH, WALL } from '../../art/src/arena-art.js';
import { KINGDOMS, UI, INK2, CUT, DANGER, JADE, GOLD_LEAF, type KingdomTheme } from '../../art/src/palette.js';
import { alpha, circle, ellipse, glow, mix, INK, easeOutBack, type Ctx } from '../../art/src/draw.js';
import { Fx, Ambience } from './fx.js';
import { sfx } from './audio.js';

export interface CombatResult {
  won: boolean;
  stars: 0 | 1 | 2 | 3;
  hpFrac: number;
  seconds: number;
  kills: number;
  continues: number;
  /** bestiaire et quêtes (DECISIONS #76) */
  killsByType?: Record<string, number>;
  signatureHits?: number;
}

export interface CombatHooks {
  choosePower(offer: PowerId[], hero: HeroState, roomIndex: number): Promise<PowerId>;
  defeat(continuesUsed: number): Promise<'continue' | 'retry' | 'map'>;
  pause(): Promise<'resume' | 'quit'>;
  finish(r: CombatResult): void;
  retry(): void;
  quit(): void;
}

export interface CombatOptions {
  level: LevelDef;
  templates: Map<string, RoomTemplate>;
  potion?: boolean;
  aegis?: boolean;
  scroll?: PowerId | null;
  autoFire?: boolean;
  reduceMotion?: boolean;
  haptics?: boolean;
  heroId?: 'scout' | 'windMonk' | 'emberSorcerer';
  talents?: import('../../sim/src/hero.js').Talents;
  /** Équipement porté (DECISIONS #75). */
  gear?: import('../../sim/src/gear.js').GearStats;
  /** Tournoi : mêmes conditions pour tous (aide de départ masquée). */
  tutorialHints?: boolean;
  /** démo : un bot joue à la place du joueur */
  demoBot?: { input(w: World): { mx: number; my: number; touching: boolean }; beginRoom?(w: World): void };
}

const HUD_TOP = 54;

export class Combat {
  private canvas: HTMLCanvasElement;
  private ctx: Ctx;
  private hud: HTMLElement;
  private bg: HTMLCanvasElement = document.createElement('canvas');
  private frameBg: HTMLCanvasElement = document.createElement('canvas');
  private theme: KingdomTheme;
  private hero: HeroState;
  private world!: World;
  private roomIdx = 0;
  private powerRng: Rng;
  private anchor = new FloatingAnchor();
  private fx = new Fx();
  private amb: Ambience;
  private prev = new WeakMap<object, { x: number; y: number }>();
  private windups = new Map<number, number>();
  private flashes = new Map<number, number>();
  private lastHp = new Map<number, number>();
  private dot = new Map<number, number>();
  private acc = 0;
  private last = 0;
  private time = 0;
  private scale = 1;
  private ox = 0;
  private oy = 0;
  private dpr = 1;
  private running = true;
  private busy = false;
  private raf = 0;
  private seconds = 0;
  private kills = 0;
  private continues = 0;
  private portalOpen = 0;
  private transition = 0; // 0 = rien ; >0 fondu en cours
  private banner: { text: string; sub: string; t: number } | null = null;
  private bossShown = 0;
  private destroyed = false;

  constructor(
    private host: HTMLElement,
    private opt: CombatOptions,
    private hooks: CombatHooks,
  ) {
    this.theme = KINGDOMS[(opt.level.kingdom - 1) % KINGDOMS.length];
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'combat-canvas';
    this.ctx = this.canvas.getContext('2d')!;
    this.hud = document.createElement('div');
    this.hud.className = 'combat-hud';
    this.hud.innerHTML = `<div class="room-pill"><span class="lvl">Niveau ${opt.level.n}</span><span class="room"></span></div><button class="pause-btn" aria-label="Pause"><span></span><span></span></button>`;
    host.append(this.canvas, this.hud);
    this.hud.querySelector('.pause-btn')!.addEventListener('click', () => this.openPause());
    this.fx.reduceMotion = !!opt.reduceMotion;
    this.amb = new Ambience(AW, AH, this.theme.moteKind, INK2);

    const talents = opt.talents ?? talentsForLevel(opt.level.n);
    const hd = HEROES[opt.heroId ?? 'scout'];
    this.hero = newHero(talents, {}, opt.autoFire, { kind: hd.kind, gear: opt.gear });
    if (hd.startPower) grantPower(this.hero, hd.startPower);
    if (opt.scroll) grantPower(this.hero, opt.scroll);
    if (opt.potion) {
      this.hero.stats.maxHp = Math.round(this.hero.stats.maxHp * 1.25);
      this.hero.hp = this.hero.stats.maxHp;
    }
    if (opt.aegis) this.hero.shieldReady = true;
    this.powerRng = new Rng(opt.level.powerSeed);

    this.bindInput();
    this.onResize = this.onResize.bind(this);
    addEventListener('resize', this.onResize);
    this.onResize();
    this.startRoom(0);
    this.last = performance.now();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }

  /** Chiffres de la tentative en cours (score de tournoi). */
  stats(): { kills: number; seconds: number; maxHp: number; killsByType: Record<string, number>; signatureHits: number } {
    return { kills: this.kills + (this.world?.kills ?? 0), seconds: this.seconds, maxHp: this.hero.stats.maxHp, killsByType: { ...this.killsByType }, signatureHits: this.signatureHits };
  }

  /** Bestiaire et quêtes : ennemis vaincus par type, coups de la mécanique signature. */
  private killsByType: Record<string, number> = {};
  private signatureHits = 0;
  private burning = new Set<number>();

  destroy(): void {
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    removeEventListener('resize', this.onResize);
    this.canvas.remove();
    this.hud.remove();
  }

  // ───────────────────────────── salles ─────────────────────────────

  private startRoom(i: number): void {
    this.roomIdx = i;
    const room = this.opt.level.rooms[i];
    const tpl = this.opt.templates.get(room.template)!;
    this.world = new World({ arena: new Arena(tpl), D: this.opt.level.D, waves: room.waves, boss: room.boss, seed: seedOf(room.seed, Date.now() & 0xffff) }, this.hero);
    this.opt.demoBot?.beginRoom?.(this.world);
    this.windups.clear();
    this.corpses = [];
    this.releases.clear();
    this.flashes.clear();
    this.lastHp.clear();
    this.portalOpen = 0;
    this.renderBackground();
    const n = this.opt.level.rooms.length;
    this.hud.querySelector('.room')!.textContent = `Salle ${i + 1}/${n}`;
    const isBoss = !!room.boss;
    this.banner = { text: isBoss ? 'Boss' : `Salle ${i + 1}`, sub: isBoss ? bossName(room.boss!.archetype) : this.theme.name, t: 0 };
    this.transition = -1; // fondu entrant
    if (isBoss) sfx('boss');
  }

  private async nextRoom(): Promise<void> {
    this.busy = true;
    const i = this.roomIdx + 1;
    const offer = offerPowers(this.powerRng, this.hero.powers, 3, HEROES[this.opt.heroId ?? 'scout'].family);
    const pick = await this.hooks.choosePower(offer, this.hero, i);
    if (this.destroyed) return;
    grantPower(this.hero, pick);
    const heal = this.hero.stats.maxHp * HEAL_BETWEEN_ROOMS;
    this.hero.hp = Math.min(this.hero.stats.maxHp, this.hero.hp + heal);
    this.startRoom(i);
    this.fx.text(this.hero.pos.x, this.hero.pos.y - 40, `+${Math.round(heal)}`, UI.heal, 16);
    this.fx.burst(this.hero.pos.x, this.hero.pos.y, UI.heal, 16, 120, 'dot', 3, 0.8, -80);
    this.busy = false;
    this.last = performance.now();
  }

  private finishWin(): void {
    this.busy = true;
    const hpFrac = Math.max(0, this.hero.hp) / this.hero.stats.maxHp;
    this.fx.slowmo = 1.2;
    sfx('win');
    setTimeout(() => {
      if (this.destroyed) return;
      this.hooks.finish({ won: true, stars: starsOf(true, hpFrac), hpFrac, seconds: this.seconds, kills: this.kills + this.world.kills, continues: this.continues, killsByType: { ...this.killsByType }, signatureHits: this.signatureHits });
    }, 1300);
  }

  private async onDeath(): Promise<void> {
    this.busy = true;
    sfx('lose');
    await wait(900);
    if (this.destroyed) return;
    const choice = await this.hooks.defeat(this.continues);
    if (this.destroyed) return;
    if (choice === 'continue') {
      this.continues++;
      this.world.revive();
      this.fx.ring(this.hero.pos.x, this.hero.pos.y, JADE, 140, 0.6);
      this.fx.scraps(this.hero.pos.x, this.hero.pos.y, 14, 1);
      this.busy = false;
      this.last = performance.now();
    } else if (choice === 'retry') this.hooks.retry();
    else this.hooks.quit();
  }

  private async openPause(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    const r = await this.hooks.pause();
    if (this.destroyed) return;
    if (r === 'quit') return this.hooks.quit();
    this.busy = false;
    this.last = performance.now();
  }

  // ───────────────────────────── entrée ─────────────────────────────

  private bindInput(): void {
    const toLocal = (e: PointerEvent) => ({ x: e.clientX, y: e.clientY });
    this.canvas.addEventListener('pointerdown', (e) => {
      this.canvas.setPointerCapture(e.pointerId);
      this.anchor.down(e.pointerId, toLocal(e));
    });
    this.canvas.addEventListener('pointermove', (e) => this.anchor.move(e.pointerId, toLocal(e)));
    const up = (e: PointerEvent) => this.anchor.up(e.pointerId);
    this.canvas.addEventListener('pointerup', up);
    this.canvas.addEventListener('pointercancel', up);
    // clavier (bureau) : flèches / ZQSD
    const keys = new Set<string>();
    addEventListener('keydown', (e) => keys.add(e.key.toLowerCase()));
    addEventListener('keyup', (e) => keys.delete(e.key.toLowerCase()));
    this.keys = keys;
  }
  private keys = new Set<string>();

  private input() {
    if (this.opt.demoBot) return this.opt.demoBot.input(this.world);
    const k = this.keys;
    const kx = (k.has('arrowright') || k.has('d') ? 1 : 0) - (k.has('arrowleft') || k.has('q') || k.has('a') ? 1 : 0);
    const ky = (k.has('arrowdown') || k.has('s') ? 1 : 0) - (k.has('arrowup') || k.has('z') || k.has('w') ? 1 : 0);
    if (kx || ky) {
      const d = Math.hypot(kx, ky);
      return { mx: kx / d, my: ky / d, touching: true };
    }
    const v = this.anchor.intent();
    // l'écran est mis à l'échelle : le vecteur est en pixels écran, la SPEC le définit en pt (≈ px CSS)
    return { mx: v.x, my: v.y, touching: this.anchor.touching };
  }

  // ───────────────────────────── boucle ─────────────────────────────

  private frame(now: number): void {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame((t) => this.frame(t));
    let dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.time += dt;
    if (this.fx.slowmo > 0) dt *= 0.35;
    this.fx.update(dt);
    if (this.banner) this.banner.t += dt;
    if (this.transition !== 0) this.transition = Math.min(0, this.transition + dt * 2.2);

    if (!this.busy && this.running) {
      if (this.fx.freeze > 0) this.fx.freeze -= dt;
      else {
        this.acc += dt;
        let steps = 0;
        while (this.acc >= SIM_DT && steps < 4) {
          this.stepSim();
          this.acc -= SIM_DT;
          steps++;
          if (this.busy) break;
        }
      }
    }
    this.render(Math.min(1, this.acc / SIM_DT), dt);
  }

  private stepSim(): void {
    const w = this.world;
    const snap = (o: { pos: { x: number; y: number } }) => this.prev.set(o, { x: o.pos.x, y: o.pos.y });
    snap(w.hero);
    for (const e of w.enemies) snap(e);
    for (const p of w.projectiles) snap(p);
    const beforeProj = w.projectiles.slice();
    const hpBefore = new Map(w.enemies.map((e) => [e.id, e.hp]));
    const before = w.enemies.slice();
    w.step(this.input());
    // les marionnettes vaincues restent ~0,5 s pour se démonter à l'écran
    const alive = new Set(w.enemies);
    for (const e of before) if (!alive.has(e)) this.corpses.push({ e, t0: this.time });
    this.seconds += SIM_DT;
    this.react(beforeProj, hpBefore);
    if (w.dead) {
      this.fx.hitStop(0.25);
      this.fx.shake(1);
      this.fx.scraps(w.hero.pos.x, w.hero.pos.y, 24, 1.3);
      void this.onDeath();
      return;
    }
    const last = this.roomIdx === this.opt.level.rooms.length - 1;
    if (w.cleared && last) return this.finishWin();
    if (w.exited) {
      this.kills += w.kills;
      void this.nextRoom();
    }
  }

  /** Traduit les évènements de la simulation en effets visuels / sonores / haptiques. */
  private react(beforeProj: Projectile[], hpBefore: Map<number, number>): void {
    const w = this.world;
    const fx = this.fx;
    const hits: { x: number; y: number; crit: boolean }[] = [];
    for (const ev of w.events) {
      switch (ev.e) {
        case 'hit':
          hits.push(ev);
          break;
        case 'shoot':
          sfx('shoot');
          break;
        case 'kill': {
          const big = ev.type === 'boss';
          const key = big ? (this.opt.level.rooms[this.roomIdx].boss?.archetype ?? 'boss') : ev.type;
          this.killsByType[key] = (this.killsByType[key] ?? 0) + 1;
          // la marionnette se déchire : chutes de papier
          fx.scraps(ev.x, ev.y, big ? 34 : 10, big ? 1.6 : 1);
          fx.ring(ev.x, ev.y, INK, big ? 140 : 30, big ? 0.7 : 0.3);
          fx.shake(big ? 0.9 : 0.12);
          if (big) {
            fx.hitStop(0.35);
            fx.slowmo = 1.5;
          }
          sfx(big ? 'bossDown' : 'kill');
          break;
        }
        case 'heroHit':
          fx.heroFlash = 1;
          fx.shake(0.45);
          fx.hitStop(0.05);
          fx.text(w.hero.pos.x, w.hero.pos.y - 30, `-${Math.round(ev.dmg)}`, UI.danger, 17);
          fx.burst(w.hero.pos.x, w.hero.pos.y, UI.danger, 10, 160, 'spark', 2.5, 0.35);
          if (this.opt.haptics !== false) navigator.vibrate?.(28);
          sfx('hurt');
          break;
        case 'dodge':
          fx.text(w.hero.pos.x, w.hero.pos.y - 30, 'Esquive', INK, 14);
          break;
        case 'shield':
          fx.ring(w.hero.pos.x, w.hero.pos.y, JADE, 40, 0.4);
          fx.text(w.hero.pos.x, w.hero.pos.y - 30, 'Bloqué', JADE, 14);
          break;
        case 'wave':
          if (ev.index > 0) this.banner = { text: `Vague ${ev.index + 1}`, sub: '', t: 0.25 };
          break;
        case 'cut': {
          this.signatureHits += ev.hits;
          this.cuts.push({ poly: ev.poly, t0: this.time, hits: ev.hits, echo: ev.echo });
          const c = centroid(ev.poly);
          if (ev.hits > 0) {
            fx.text(c.x, c.y - 8, ev.echo ? 'Écho' : ev.hits > 1 ? `Découpe ×${ev.hits}` : 'Découpe', ev.hits > 1 ? DANGER : INK, ev.hits > 1 ? 22 : 18);
            fx.shake(Math.min(0.6, 0.15 + 0.12 * ev.hits));
            fx.hitStop(Math.min(0.12, 0.03 * ev.hits));
          }
          fx.scraps(c.x, c.y, 6 + ev.hits * 4, 1);
          if (this.opt.haptics !== false) navigator.vibrate?.(ev.hits > 1 ? [12, 30, 18] : 12);
          sfx(ev.echo ? 'snip' : 'cut');
          break;
        }
        case 'snip':
          fx.burst(ev.x, ev.y, INK, 5, 90, 'spark', 1.8, 0.3);
          if (this.time - this.lastSnipText > 1.2) {
            fx.text(ev.x, ev.y - 12, ev.by === 'moth' ? 'Fil grignoté' : 'Fil coupé', INK2, 12);
            this.lastSnipText = this.time;
          }
          sfx('snip');
          break;
        case 'gust': {
          this.signatureHits += ev.hits;
          this.gustsFx.push({ x: ev.x, y: ev.y, r: ev.r, m: ev.m, t0: this.time });
          fx.ring(ev.x, ev.y, INK, ev.r, 0.35);
          fx.burst(ev.x, ev.y, CUT, 10 + Math.round(ev.m * 10), 260 * (0.6 + ev.m), 'dot', 2.4, 0.4);
          if (ev.hits > 0) {
            fx.shake(0.12 + 0.1 * Math.min(4, ev.hits));
            fx.hitStop(0.02 + 0.015 * Math.min(4, ev.hits));
            if (ev.hits > 1) fx.text(ev.x, ev.y - 34, `Bourrasque ×${ev.hits}`, ev.hits > 2 ? DANGER : INK, 18);
          }
          if (this.opt.haptics !== false) navigator.vibrate?.(ev.hits > 1 ? [10, 20, 14] : 10);
          sfx('gust');
          break;
        }
        case 'block':
          fx.burst(ev.x, ev.y, GOLD_LEAF, 5, 140, 'spark', 2, 0.25);
          if (this.time - this.lastBlockText > 1.5) {
            fx.text(ev.x, ev.y - 10, 'Bouclier', INK2, 12);
            this.lastBlockText = this.time;
          }
          sfx('block');
          break;
        case 'blink':
          fx.scraps(ev.fromX, ev.fromY, 8, 0.8);
          fx.puff(ev.x, ev.y, INK2, 6, 10);
          sfx('blink');
          break;
        case 'boom':
          fx.ring(ev.x, ev.y, ev.by === 'lantern' ? DANGER : GOLD_LEAF, ev.r, 0.4);
          fx.burst(ev.x, ev.y, ev.by === 'lantern' ? DANGER : GOLD_LEAF, 14, 220, 'spark', 2.6, 0.4);
          fx.scraps(ev.x, ev.y, 8, 1);
          fx.shake(ev.by === 'lantern' ? 0.35 : 0.2);
          sfx('boom');
          break;
        case 'cleared':
          fx.text(AW / 2, AH * 0.42, 'Salle nettoyée', INK, 22);
          fx.scraps(AW / 2, 14, 14, 1);
          sfx('clear');
          break;
      }
    }
    // Sorcier : chaque ennemi qui prend feu dans la traînée compte pour les quêtes
    if (w.hero.kind === 'ember') {
      for (const e of w.enemies) {
        const on = e.emberT > 0.7;
        if (on && !this.burning.has(e.id)) {
          this.burning.add(e.id);
          this.signatureHits++;
        }
      }
    }
    // nombres de dégâts et flash d'impact
    for (const e of w.enemies) {
      const before = hpBefore.get(e.id);
      if (before === undefined) continue;
      const d = before - e.hp;
      if (d <= 0) continue;
      const hit = hits.find((h) => Math.abs(h.x - e.pos.x) < 1 && Math.abs(h.y - e.pos.y) < 1);
      if (hit) {
        this.flashes.set(e.id, 1);
        fx.text(e.pos.x + (fx.rand() - 0.5) * 12, e.pos.y - e.radius - 8, `${Math.round(d)}`, hit.crit ? DANGER : INK, hit.crit ? 20 : 14);
        fx.burst(e.pos.x, e.pos.y, hit.crit ? DANGER : INK, hit.crit ? 8 : 4, 150, 'spark', 2, 0.25);
        if (hit.crit) fx.shake(0.12);
        sfx('hit');
      } else {
        const acc = (this.dot.get(e.id) ?? 0) + d;
        if (acc > 25) {
          fx.text(e.pos.x, e.pos.y - e.radius - 4, `${Math.round(acc)}`, INK2, 11);
          this.dot.set(e.id, 0);
        } else this.dot.set(e.id, acc);
      }
    }
    // flèches qui heurtent un mur : petite poussière
    const alive = new Set(w.projectiles);
    for (const p of beforeProj) {
      if (alive.has(p) || !p.fromHero) continue;
      if (!w.enemies.some((e) => Math.hypot(e.pos.x - p.pos.x, e.pos.y - p.pos.y) < e.radius + 14)) fx.burst(p.pos.x, p.pos.y, INK2, 3, 80, 'dot', 1.6, 0.25);
    }
  }

  // ───────────────────────────── rendu ─────────────────────────────

  private onResize(): void {
    const vw = this.host.clientWidth || innerWidth;
    const vh = this.host.clientHeight || innerHeight;
    this.dpr = Math.min(3, devicePixelRatio || 1);
    this.canvas.width = Math.round(vw * this.dpr);
    this.canvas.height = Math.round(vh * this.dpr);
    this.canvas.style.width = vw + 'px';
    this.canvas.style.height = vh + 'px';
    const fullW = AW + WALL * 2;
    const fullH = AH + WALL * 2;
    this.scale = Math.min(vw / fullW, (vh - HUD_TOP - 12) / fullH);
    this.ox = (vw - AW * this.scale) / 2;
    this.oy = HUD_TOP + (vh - HUD_TOP - AH * this.scale) / 2;
    if (this.world) this.renderBackground();
  }

  private renderBackground(): void {
    const s = this.scale * this.dpr;
    this.bg.width = Math.ceil((AW + WALL * 2) * s);
    this.bg.height = Math.ceil((AH + WALL * 2) * s);
    const c = this.bg.getContext('2d')!;
    c.setTransform(s, 0, 0, s, WALL * s, WALL * s);
    paintArenaStatic(c, this.world.arena.template.grid, this.theme);
    const cw = this.canvas.width / this.dpr;
    const ch = this.canvas.height / this.dpr;
    this.frameBg.width = this.canvas.width;
    this.frameBg.height = this.canvas.height;
    const f = this.frameBg.getContext('2d')!;
    f.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    paintFrame(f, cw, ch, this.oy - WALL * this.scale, ch - (this.oy + (AH + WALL) * this.scale), this.theme);
  }

  private lerp(o: { pos: { x: number; y: number } }, a: number): { x: number; y: number } {
    const p = this.prev.get(o);
    if (!p) return o.pos;
    return { x: p.x + (o.pos.x - p.x) * a, y: p.y + (o.pos.y - p.y) * a };
  }

  private render(a: number, dt: number): void {
    const ctx = this.ctx;
    const w = this.world;
    const th = this.theme;
    const t = this.time;
    const cw = this.canvas.width / this.dpr;
    const ch = this.canvas.height / this.dpr;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    // ciel et silhouettes du royaume
    ctx.drawImage(this.frameBg, 0, 0, cw, ch);

    const [sx, sy] = this.fx.shakeOffset(t);
    ctx.translate(this.ox + sx, this.oy + sy);
    ctx.scale(this.scale, this.scale);
    ctx.drawImage(this.bg, -WALL, -WALL, AW + WALL * 2, AH + WALL * 2);
    paintLiquids(ctx, w.arena.template.grid, th, t);
    if (!this.opt.reduceMotion) paintDecorAnim(ctx, w.arena.template.grid, th, t);
    if (w.cleared) this.portalOpen = Math.min(1, this.portalOpen + dt * 2);
    paintPortal(ctx, th, t, easeOutBack(this.portalOpen));
    if (w.cleared && !w.exited) this.drawPortalGuide(ctx, t);

    for (const z of w.hazards) this.drawHazard(ctx, z, t);
    for (const o of w.orbs) {
      const bob = Math.sin(t * 4 + o.pos.x) * 3;
      heartShape(ctx, o.pos.x, o.pos.y + bob, 7, UI.heal);
    }

    const hp = this.lerp(w.hero, a);
    this.drawCuts(ctx, t);
    const kind = w.hero.kind;
    if (kind === 'thread') this.drawThread(ctx, hp, t);
    else if (kind === 'ember') this.drawEmbers(ctx, hp, t);
    for (const wh of w.whirls) this.drawWhirl(ctx, wh, t);
    this.drawGusts(ctx, t);
    if (kind === 'gust') this.drawMomentum(ctx, hp, t);
    // halo sous le héros quand le doigt est posé (§2)
    if (this.anchor.touching) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = JADE;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(hp.x, hp.y + 12, 22, 9, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // entités triées par profondeur
    const ents: { y: number; draw: () => void }[] = [];
    ents.push({ y: hp.y, draw: () => this.drawHero(ctx, hp, t) });
    for (const e of w.enemies) {
      const p = this.lerp(e, a);
      ents.push({ y: p.y, draw: () => this.drawEnemy(ctx, e, p, t, dt) });
    }
    this.corpses = this.corpses.filter((c) => this.time - c.t0 < 0.55);
    for (const c of this.corpses) {
      const e = c.e;
      const painter = (e.boss ? PAINTERS[e.boss.archetype] : PAINTERS[e.type]) ?? PAINTERS.goblin;
      ents.push({
        y: e.pos.y,
        draw: () => {
          ctx.save();
          ctx.translate(e.pos.x, e.pos.y);
          const facing = Math.atan2(this.world.hero.pos.y - e.pos.y, this.world.hero.pos.x - e.pos.x);
          painter(ctx, { t, facing, state: 'idle', windup: 0, flash: 0, elite: e.elite, seed: e.id, variant: e.type === 'jellySmall' ? 1 : e.boss?.variant, dying: Math.min(1, (this.time - c.t0) / 0.5) });
          ctx.restore();
        },
      });
    }
    ents.sort((u, v) => u.y - v.y);
    for (const e of ents) e.draw();

    for (const p of w.projectiles) this.drawProjectile(ctx, p, this.lerp(p, a), t);
    this.fx.draw(ctx);
    this.amb.draw(ctx, t, dt);

    // barre de vie au-dessus de la tête (§12)
    this.drawHeroBar(ctx, hp);

    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const boss = w.enemies.find((e) => e.boss);
    if (boss) this.drawBossBar(ctx, boss, cw);
    if (this.fx.heroFlash > 0) {
      const v = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.3, cw / 2, ch / 2, Math.max(cw, ch) * 0.7);
      v.addColorStop(0, 'rgba(27,20,24,0)');
      v.addColorStop(1, `rgba(27,20,24,${0.6 * this.fx.heroFlash})`);
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, cw, ch);
    }
    if (w.dead) {
      ctx.fillStyle = 'rgba(27,20,24,0.5)';
      ctx.fillRect(0, 0, cw, ch);
    }
    this.drawBanner(ctx, cw, ch);
    if (this.transition < 0) {
      // iris d'ouverture
      const k = 1 + this.transition;
      const r = Math.hypot(cw, ch) * easeOutCubic(k);
      ctx.save();
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.rect(0, 0, cw, ch);
      ctx.arc(this.ox + hp.x * this.scale, this.oy + hp.y * this.scale, Math.max(1, r), 0, Math.PI * 2, true);
      ctx.fill('evenodd');
      ctx.restore();
    }
  }

  private drawPortalGuide(ctx: Ctx, t: number): void {
    // traînée lumineuse qui invite à monter vers le portail
    for (let i = 0; i < 4; i++) {
      const k = (t * 0.8 + i / 4) % 1;
      const y = 120 - k * 100;
      ctx.globalAlpha = Math.sin(k * Math.PI) * 0.8;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.moveTo(AW / 2 - 9, y + 6);
      ctx.lineTo(AW / 2, y - 3);
      ctx.lineTo(AW / 2 + 9, y + 6);
      ctx.lineTo(AW / 2, y + 1);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  private cuts: { poly: { x: number; y: number }[]; t0: number; hits: number; echo: boolean }[] = [];
  private corpses: { e: Enemy; t0: number }[] = [];
  private releases = new Map<number, number>();
  private lastSnipText = -9;
  private lastBlockText = -9;
  private gustsFx: { x: number; y: number; r: number; m: number; t0: number }[] = [];

  /** Élan du Moine : arc d'encre qui se remplit autour de ses pieds ; plein, il passe au jade. */
  private drawMomentum(ctx: Ctx, hp: { x: number; y: number }, t: number): void {
    const h = this.world.hero;
    const m = h.momentum;
    const ready = m >= GUST.minMomentum && h.gustCd <= 0;
    ctx.save();
    ctx.translate(hp.x, hp.y + 10);
    ctx.scale(1, 0.42);
    const R = 26;
    ctx.lineCap = 'round';
    ctx.strokeStyle = alpha(INK, 0.18);
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, Math.PI * 2);
    ctx.stroke();
    if (m > 0.01) {
      ctx.strokeStyle = m >= 0.999 ? JADE : ready ? alpha(JADE, 0.85) : INK2;
      ctx.lineWidth = m >= 0.999 ? 6 : 4.5;
      ctx.beginPath();
      ctx.arc(0, 0, R, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * m);
      ctx.stroke();
    }
    if (m >= 0.999) {
      // plein élan : petites rafales découpées qui tournent
      ctx.strokeStyle = CUT;
      ctx.lineWidth = 2;
      for (let i = 0; i < 3; i++) {
        const a = t * 7 + (i * Math.PI * 2) / 3;
        ctx.beginPath();
        ctx.arc(0, 0, R + 6, a, a + 0.7);
        ctx.stroke();
      }
    }
    ctx.restore();
    // aide : tant que le moine n'a pas lâché trois bourrasques
    if (this.opt.tutorialHints !== false && h.gusts < 3 && !this.world.cleared && this.world.enemies.length) {
      ctx.font = 'italic 700 13px "Alegreya Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = INK;
      ctx.fillText(m < 0.6 ? 'Cours pour prendre de l’élan…' : '…puis arrête-toi près d’eux !', hp.x, hp.y + 48);
    }
  }

  /** Bourrasque : spirales de vent d'encre qui s'ouvrent depuis le moine. */
  private drawGusts(ctx: Ctx, t: number): void {
    this.gustsFx = this.gustsFx.filter((g) => t - g.t0 < 0.45);
    for (const g of this.gustsFx) {
      const k = (t - g.t0) / 0.45;
      const r = g.r * easeOutCubic(Math.min(1, k * 1.3));
      ctx.save();
      ctx.translate(g.x, g.y);
      ctx.globalAlpha = 1 - k;
      ctx.lineCap = 'round';
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a = (i * Math.PI * 2) / n + k * 1.4;
        ctx.strokeStyle = i % 2 ? INK : alpha(INK, 0.6);
        ctx.lineWidth = 3 - k * 2;
        ctx.beginPath();
        ctx.arc(0, 0, r * (0.75 + 0.25 * ((i * 3) % 4) / 3), a, a + 0.6 + 0.4 * g.m);
        ctx.stroke();
      }
      ctx.strokeStyle = alpha(CUT, 0.9);
      ctx.lineWidth = 6 * (1 - k);
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
  }

  private drawWhirl(ctx: Ctx, wh: { pos: { x: number; y: number }; endAt: number; r: number }, t: number): void {
    const left = wh.endAt - this.world.t;
    ctx.save();
    ctx.translate(wh.pos.x, wh.pos.y);
    ctx.globalAlpha = Math.min(1, left * 2);
    ctx.lineCap = 'round';
    for (let i = 0; i < 4; i++) {
      ctx.strokeStyle = i % 2 ? INK2 : alpha(INK, 0.7);
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let s = 0; s <= 24; s++) {
        const k = s / 24;
        const a = -t * 6 + i * (Math.PI / 2) + k * 4.5;
        const rr = wh.r * (1 - k) * 0.95;
        if (s) ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.8);
        else ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.8);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /** Traînée de braises du Sorcier : flammes découpées, or à la feuille, qui s'éteignent en cendres d'encre. */
  private drawEmbers(ctx: Ctx, hp: { x: number; y: number }, t: number): void {
    const w = this.world;
    const em = w.hero.embers;
    const life = EMBER.life * w.hero.stats.emberLife;
    const wid = EMBER.radius * w.hero.stats.emberWidth;
    ctx.save();
    // lit de cendre chaude sous la traînée
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 1; i < em.length; i++) {
      const a = Math.max(0, 1 - (w.t - em[i].t) / life);
      ctx.strokeStyle = alpha(INK, 0.16 * a);
      ctx.lineWidth = wid * 1.6;
      ctx.beginPath();
      ctx.moveTo(em[i - 1].x, em[i - 1].y);
      ctx.lineTo(em[i].x, em[i].y);
      ctx.stroke();
    }
    for (let i = 0; i < em.length; i++) {
      const p = em[i];
      const age = w.t - p.t;
      const a = Math.max(0, 1 - age / life);
      if (a <= 0) continue;
      const h = (4 + 6 * a) * (0.85 + 0.15 * Math.sin(t * 13 + i * 1.7)) * (wid / EMBER.radius);
      const ox = Math.sin(i * 2.3) * wid * 0.35;
      ctx.globalAlpha = Math.min(1, a * 1.4);
      flameCut(ctx, p.x + ox, p.y + 3, h);
      if (a > 0.5) {
        ctx.fillStyle = GOLD_LEAF;
        ctx.beginPath();
        ctx.arc(p.x + ox, p.y + 2, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    if (this.opt.tutorialHints !== false && this.opt.level.n <= 125 && w.hero.dmgBy.sig < 300 && !w.cleared && w.enemies.length) {
      ctx.font = 'italic 700 13px "Alegreya Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = INK;
      ctx.fillText('Fais-les marcher dans tes braises', hp.x, hp.y + 48);
    }
  }

  /** Le fil de découpe : une entaille dans le papier, plus pâle à mesure que l'encre sèche. */
  private drawThread(ctx: Ctx, hp: { x: number; y: number }, t: number): void {
    const w = this.world;
    const th = w.hero.thread;
    const life = 2.6 * w.hero.stats.threadLife;
    // aide au départ : tant que la joueuse n'a jamais découpé, on lui montre où tracer
    if (this.opt.level.n <= 3 && w.hero.cuts === 0 && !w.cleared && w.enemies.length) {
      const e = w.enemies.reduce((a, b) => (Math.hypot(a.pos.x - hp.x, a.pos.y - hp.y) < Math.hypot(b.pos.x - hp.x, b.pos.y - hp.y) ? a : b));
      ctx.save();
      ctx.translate(e.pos.x, e.pos.y);
      ctx.rotate(t * 0.8);
      ctx.strokeStyle = alpha(JADE, 0.8);
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 8]);
      ctx.beginPath();
      ctx.arc(0, 0, 56, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = JADE;
      ctx.beginPath();
      ctx.moveTo(56, -7);
      ctx.lineTo(63, 3);
      ctx.lineTo(49, 3);
      ctx.fill();
      ctx.restore();
      ctx.font = 'italic 700 13px "Alegreya Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = INK;
      ctx.fillText('Encercle-le pour le découper', e.pos.x, e.pos.y + 76);
    }
    if (th.length < 1) return;
    const pts = [...th.map((p) => ({ x: p.x, y: p.y, a: Math.max(0, 1 - (w.t - p.t) / life) })), { x: hp.x, y: hp.y, a: 1 }];
    ctx.save();
    ctx.lineCap = 'round';
    // lumière qui passe par l'entaille, puis le trait d'encre en pointillés de ciseaux
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const k = (p0.a + p1.a) / 2;
      ctx.strokeStyle = alpha(CUT, 0.75 * k);
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    ctx.setLineDash([6, 4]);
    ctx.lineDashOffset = -t * 30;
    for (let i = 1; i < pts.length; i++) {
      const p0 = pts[i - 1];
      const p1 = pts[i];
      const k = (p0.a + p1.a) / 2;
      ctx.strokeStyle = alpha(INK, 0.25 + 0.75 * k);
      ctx.lineWidth = 1.8 + 1.2 * k;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    ctx.setLineDash([]);
    // boucle presque fermée : on éclaire la zone qui va être découpée
    if (th.length > 8) {
      for (let i = 0; i < th.length - 6; i++) {
        if (Math.hypot(th[i].x - hp.x, th[i].y - hp.y) > 26) continue;
        const poly = [...th.slice(i).map((p) => ({ x: p.x, y: p.y })), hp];
        let area = 0;
        for (let k = 0, j = poly.length - 1; k < poly.length; j = k++) area += (poly[j].x - poly[k].x) * (poly[j].y + poly[k].y);
        if (Math.abs(area / 2) < 1400) break;
        ctx.fillStyle = alpha(CUT, 0.35 + 0.15 * Math.sin(t * 20));
        ctx.beginPath();
        poly.forEach((p, k) => (k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
        ctx.closePath();
        ctx.fill();
        circle(ctx, th[i].x, th[i].y, 5, JADE, INK, 1.5);
        break;
      }
    }
    ctx.restore();
  }

  /** Découpes : éclair de lumière, trou dans l'écran, puis le morceau de papier tombe en tournoyant. */
  private drawCuts(ctx: Ctx, t: number): void {
    const th = this.theme;
    this.cuts = this.cuts.filter((c) => t - c.t0 < 1.1);
    for (const c of this.cuts) {
      const k = t - c.t0;
      const cen = centroid(c.poly);
      const path = (dx: number, dy: number, rot: number, sc: number) => {
        ctx.beginPath();
        c.poly.forEach((p, i) => {
          const x = (p.x - cen.x) * sc;
          const y = (p.y - cen.y) * sc;
          const rx = x * Math.cos(rot) - y * Math.sin(rot) + cen.x + dx;
          const ry = x * Math.sin(rot) + y * Math.cos(rot) + cen.y + dy;
          if (i) ctx.lineTo(rx, ry);
          else ctx.moveTo(rx, ry);
        });
        ctx.closePath();
      };
      ctx.save();
      // le trou : on voit les coulisses, puis le papier se referme
      const hole = Math.max(0, 1 - k / 0.9);
      if (hole > 0 && !c.echo) {
        path(0, 0, 0, 1);
        ctx.fillStyle = alpha(INK, 0.55 * hole);
        ctx.fill();
      }
      if (k < 0.12) {
        path(0, 0, 0, 1);
        ctx.fillStyle = alpha(CUT, 0.9 * (1 - k / 0.12));
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2.5;
        ctx.stroke();
      } else if (!c.echo) {
        const f = k - 0.12;
        const a = Math.max(0, 1 - f / 0.95);
        path(f * 30, 260 * f * f + 20 * f, f * 1.6 * (cen.x > AW / 2 ? 1 : -1), 1 - f * 0.35);
        ctx.globalAlpha = a;
        ctx.fillStyle = th.paper;
        ctx.fill();
        ctx.strokeStyle = INK;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  private drawHero(ctx: Ctx, p: { x: number; y: number }, t: number): void {
    const h = this.world.hero;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (h.stats.orb) {
      const ox = Math.cos(h.orbAngle) * 56;
      const oy = Math.sin(h.orbAngle) * 56;
      circle(ctx, ox, oy, 7, JADE, INK, 2);
      circle(ctx, ox - 2, oy - 2, 2.2, CUT);
    }
    if (h.shieldReady) {
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 4);
      ctx.setLineDash([5, 4]);
      circle(ctx, 0, -2, 22, 'rgba(43,138,116,0.12)', JADE, 2);
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    if (h.flashT > 0) circle(ctx, 0, 0, 24, alpha(CUT, 0.6));
    const aiming = !h.moving && !!this.world.target;
    const state: AnimState = h.moving ? 'move' : 'idle';
    const pose = { t, facing: h.facing, state, windup: 0, flash: 0, elite: false, seed: 0, aiming: !!this.world.target, blink: h.invuln > 0, cutting: h.cutT, hurt: this.fx.heroFlash };
    void aiming;
    (PAINTERS[this.opt.heroId ?? 'scout'] ?? PAINTERS.scout)(ctx, pose as Parameters<(typeof PAINTERS)['scout']>[1]);
    ctx.restore();
  }

  private drawEnemy(ctx: Ctx, e: Enemy, p: { x: number; y: number }, t: number, dt: number): void {
    let state: AnimState = e.state;
    let windup = 0;
    if (e.state === 'windup' || (e.elite && e.eliteWind > 0)) {
      const left = e.state === 'windup' ? e.t : e.eliteWind;
      if (!this.windups.has(e.id)) this.windups.set(e.id, Math.max(0.3, left + SIM_DT));
      windup = 1 - left / this.windups.get(e.id)!;
      state = 'windup';
    } else if (this.windups.has(e.id)) {
      this.windups.delete(e.id);
      this.releases.set(e.id, this.time);
    }
    const rel = this.releases.get(e.id);
    const release = rel === undefined ? 0 : Math.max(0, 1 - (this.time - rel) / 0.25);
    if (e.boss && e.boss.breath > 0) state = 'breath';
    const flash = this.flashes.get(e.id) ?? 0;
    if (flash > 0) this.flashes.set(e.id, Math.max(0, flash - dt * 6));
    const hd = Math.atan2(this.world.hero.pos.y - e.pos.y, this.world.hero.pos.x - e.pos.x);
    const facing = e.state === 'charge' ? Math.atan2(e.aim.y, e.aim.x) : hd;
    const painter = (e.boss ? PAINTERS[e.boss.archetype] : PAINTERS[e.type]) ?? PAINTERS.goblin;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (e.state === 'spawn') {
      // cercle d'invocation puis apparition élastique
      const k = 1 - Math.max(0, e.t) / (e.boss ? 1.2 : 0.8);
      ctx.save();
      ctx.rotate(t * 2);
      ctx.strokeStyle = alpha(INK, 0.8 * (1 - k * 0.5));
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.arc(0, 4, e.radius * 1.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      const s = Math.max(0.01, easeOutBack(Math.min(1, k * 1.25)));
      ctx.scale(s, s);
      ctx.globalAlpha = Math.min(1, k * 2);
    }
    if (e.state === 'charge') {
      // traînée de vitesse
      ctx.globalAlpha = 0.25;
      painter(ctx, { t, facing, state: 'charge', windup: 0, flash: 0, elite: false, seed: e.id, variant: e.boss?.variant });
      ctx.translate(-e.aim.x * 12, -e.aim.y * 12);
      ctx.globalAlpha = 1;
      ctx.translate(e.aim.x * 12, e.aim.y * 12);
    }
    if (e.slowT > 0) {
      ctx.strokeStyle = alpha('#6f9fc4', 0.9);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, e.radius * 1.3, 0, Math.PI * 2);
      ctx.stroke();
    }
    painter(ctx, { t, facing, state, windup, flash, elite: e.elite, seed: e.id, variant: e.type === 'jellySmall' ? 1 : e.boss?.variant, hpFrac: e.hp / e.maxHp, release, hurt: flash });
    if (e.burnT > 0 || e.emberT > 0) for (let i = 0; i < 3; i++) flameCut(ctx, -8 + i * 8, -e.radius - 2 + Math.sin(t * 9 + i) * 1.5, 4 + Math.sin(t * 14 + i * 2) * 1.2);
    if (e.poisonStacks > 0) for (let i = 0; i < e.poisonStacks; i++) circle(ctx, -8 + i * 4, -e.radius - 6 + Math.sin(t * 5 + i) * 2, 2, '#5f8a63', INK, 1);
    ctx.restore();
    // mini-barre de vie des ennemis blessés
    if (!e.boss && e.hp < e.maxHp && e.state !== 'spawn') {
      const wbar = e.radius * 1.8;
      const y = p.y - e.radius - 10;
      ctx.fillStyle = INK;
      ctx.fillRect(p.x - wbar / 2 - 1, y - 1, wbar + 2, 5);
      ctx.fillStyle = e.elite ? GOLD_LEAF : CUT;
      ctx.fillRect(p.x - wbar / 2, y, wbar * Math.max(0, e.hp / e.maxHp), 3);
    }
  }

  private drawHazard(ctx: Ctx, z: Hazard, t: number): void {
    const w = this.world;
    const now = w.t;
    const owner = w.enemies.find((e) => e.id === z.ownerId);
    const kind = owner?.boss?.archetype ?? owner?.type ?? 'mage';
    if (z.kind === 'line' && z.to) {
      if (now > z.activeAt) return;
      const k = Math.min(1, (now - z.born) / Math.max(0.01, z.activeAt - z.born));
      const dx = z.to.x - z.pos.x;
      const dy = z.to.y - z.pos.y;
      const len = Math.hypot(dx, dy);
      ctx.save();
      ctx.translate(z.pos.x, z.pos.y);
      ctx.rotate(Math.atan2(dy, dx));
      ctx.beginPath();
      ctx.roundRect(0, -z.radius, len, z.radius * 2, z.radius);
      ctx.save();
      ctx.clip();
      hatch(ctx, -z.radius, -z.radius, len + z.radius * 2, z.radius * 2, t, 0.55);
      ctx.fillStyle = alpha(DANGER, 0.85);
      ctx.fillRect(0, -z.radius, len * k, z.radius * 2);
      ctx.restore();
      // le contour arrondi (la hachure a remplacé le tracé courant)
      ctx.beginPath();
      ctx.roundRect(0, -z.radius, len, z.radius * 2, z.radius);
      ctx.strokeStyle = DANGER;
      ctx.lineWidth = 2;
      ctx.stroke();
      // flèches découpées qui avancent
      ctx.fillStyle = CUT;
      for (let x = ((t * 120) % 24) - 24; x < len - 10; x += 24) {
        if (x < 6) continue;
        ctx.beginPath();
        ctx.moveTo(x, -5);
        ctx.lineTo(x + 7, 0);
        ctx.lineTo(x, 5);
        ctx.lineTo(x + 3, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      return;
    }
    if (z.slow) return this.drawWeb(ctx, z, t);
    if (z.src === 'specter') {
      // marque d'arrivée du spectre : découpe en pointillés qui se resserre
      const k = Math.min(1, (now - z.born) / Math.max(0.01, z.activeAt - z.born));
      ctx.save();
      ctx.translate(z.pos.x, z.pos.y);
      ctx.rotate(t * 3);
      ctx.strokeStyle = DANGER;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 5]);
      ctx.beginPath();
      ctx.arc(0, 0, z.radius * (1.6 - 0.6 * k), 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 0.25 + 0.5 * k;
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.ellipse(0, 0, z.radius * 0.7, z.radius * 0.45, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      return;
    }
    const warn = now < z.activeAt;
    if (warn) {
      const k = Math.min(1, (now - z.born) / Math.max(0.01, z.activeAt - z.born));
      ctx.save();
      ctx.translate(z.pos.x, z.pos.y);
      ctx.beginPath();
      ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
      ctx.save();
      ctx.clip();
      hatch(ctx, -z.radius, -z.radius, z.radius * 2, z.radius * 2, t, 0.5);
      ctx.restore();
      // le disque plein se referme vers le centre jusqu'à l'impact
      ctx.fillStyle = alpha(DANGER, 0.8);
      ctx.beginPath();
      ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
      ctx.arc(0, 0, z.radius * (1 - k), 0, Math.PI * 2, true);
      ctx.fill();
      ctx.strokeStyle = DANGER;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }
    const lasting = z.endAt - z.activeAt > 0.5;
    if (!lasting) {
      const k = (now - z.activeAt) / Math.max(0.01, z.endAt - z.activeAt);
      if (k < 0.2 && !this.flashes.has(-z.nextTick)) {
        this.fx.ring(z.pos.x, z.pos.y, INK, z.radius * 1.1, 0.4);
        this.fx.scraps(z.pos.x, z.pos.y, 8, 0.8);
        this.fx.shake(z.radius > 90 ? 0.4 : 0.15);
        this.flashes.set(-z.nextTick, 0);
      }
      return;
    }
    // zone persistante : flammes, poison ou givre découpés, sur fond vermillon hachuré
    const fade = Math.min(1, (z.endAt - now) * 2);
    ctx.save();
    ctx.globalAlpha = fade;
    ctx.translate(z.pos.x, z.pos.y);
    ctx.beginPath();
    ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = alpha(DANGER, 0.35);
    ctx.fillRect(-z.radius, -z.radius, z.radius * 2, z.radius * 2);
    hatch(ctx, -z.radius, -z.radius, z.radius * 2, z.radius * 2, t, 0.6);
    ctx.restore();
    ctx.beginPath();
    ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
    ctx.strokeStyle = DANGER;
    ctx.lineWidth = 2;
    ctx.stroke();
    for (let i = 0; i < 6; i++) {
      const aa = i * 1.05 + z.born;
      const rr = (z.radius * 0.65 * ((i * 37) % 10)) / 10;
      const h = 7 + Math.sin(t * 10 + i) * 2.5;
      const x = Math.cos(aa) * rr;
      const y = Math.sin(aa) * rr;
      if (kind === 'wyvern') {
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.moveTo(x, y - h);
        ctx.lineTo(x + 3, y);
        ctx.lineTo(x - 3, y);
        ctx.fill();
      } else if (kind === 'queen') circle(ctx, x, y - (t * 12 + i * 5) % 10, 2.4, INK);
      else flameCut(ctx, x, y, h * 0.6);
    }
    ctx.restore();
  }

  /** Toile de l'araignée : boule qui tombe (télégraphe), puis toile d'encre qui ralentit. */
  private drawWeb(ctx: Ctx, z: Hazard, t: number): void {
    const now = this.world.t;
    ctx.save();
    ctx.translate(z.pos.x, z.pos.y);
    if (now < z.activeAt) {
      const k = Math.min(1, (now - z.born) / Math.max(0.01, z.activeAt - z.born));
      ctx.strokeStyle = alpha(INK, 0.7);
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 4]);
      ctx.beginPath();
      ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      circle(ctx, 0, -40 * (1 - k), 6 + 4 * k, CUT, INK, 1.5);
      ctx.restore();
      return;
    }
    ctx.globalAlpha = Math.min(1, (z.endAt - now) * 1.5, (now - z.activeAt) * 6);
    ctx.fillStyle = alpha(INK, 0.08);
    ctx.beginPath();
    ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = alpha(INK, 0.75);
    ctx.lineWidth = 1.1;
    const spokes = 10;
    for (let i = 0; i < spokes; i++) {
      const a = (i * Math.PI * 2) / spokes + z.born;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * z.radius, Math.sin(a) * z.radius);
      ctx.stroke();
    }
    for (let ring = 1; ring <= 4; ring++) {
      const r = (z.radius * ring) / 4.3;
      ctx.beginPath();
      for (let i = 0; i <= spokes; i++) {
        const a = (i * Math.PI * 2) / spokes + z.born;
        const sag = i % 2 ? 0.92 : 1;
        const x = Math.cos(a) * r * sag;
        const y = Math.sin(a) * r * sag;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    void t;
    ctx.restore();
  }

  private drawProjectile(ctx: Ctx, p: Projectile, q: { x: number; y: number }, _t: number): void {
    const ang = Math.atan2(p.vel.y, p.vel.x);
    ctx.save();
    ctx.translate(q.x, q.y);
    ctx.rotate(ang);
    if (p.fromHero) {
      const hero = this.opt.heroId ?? 'scout';
      if (hero === 'windMonk') {
        ctx.strokeStyle = CUT;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        for (let i = 0; i < 2; i++) {
          ctx.beginPath();
          ctx.arc(-i * 9, 0, 7 - i * 2, -1.1, 1.1);
          ctx.stroke();
        }
      } else if (hero === 'emberSorcerer') {
        circle(ctx, 0, 0, 5, CUT, INK, 2);
        ctx.fillStyle = alpha(INK, 0.5);
        ctx.fillRect(-16, -1, 10, 2);
      } else {
        // aiguille d'argent : fine, avec son chas, et un reflet de lumière
        ctx.strokeStyle = alpha(INK, 0.3);
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-24, 0);
        ctx.lineTo(-9, 0);
        ctx.stroke();
        ctx.fillStyle = INK;
        ctx.beginPath();
        ctx.moveTo(10, 0);
        ctx.lineTo(-9, -2.2);
        ctx.lineTo(-11, 0);
        ctx.lineTo(-9, 2.2);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = CUT;
        ctx.beginPath();
        ctx.ellipse(-6.5, 0, 1.8, 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      return;
    }
    // projectiles ennemis : toujours vermillon cerné d'encre (lisibles sur tous les papiers)
    const sp = Math.hypot(p.vel.x, p.vel.y);
    const arrowLike = Math.abs(sp - 340) < 2;
    if (arrowLike) {
      ctx.strokeStyle = INK;
      ctx.lineWidth = 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(6, 0);
      ctx.stroke();
      ctx.strokeStyle = DANGER;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    } else {
      ctx.fillStyle = alpha(DANGER, 0.3);
      ctx.beginPath();
      ctx.ellipse(-p.radius * 1.3, 0, p.radius * 1.8, p.radius * 0.7, 0, 0, Math.PI * 2);
      ctx.fill();
      circle(ctx, 0, 0, p.radius + 1.5, INK);
      circle(ctx, 0, 0, p.radius - 0.5, DANGER);
      // forme découpée au centre selon la source
      if (Math.abs(sp - 150) < 2) circle(ctx, 0, 0, p.radius * 0.35, CUT); // spore
      else if (Math.abs(sp - 170) < 2) {
        ctx.fillStyle = CUT;
        ctx.fillRect(-1.2, -p.radius * 0.5, 2.4, p.radius); // rune
      } else if (Math.abs(sp - 140) < 2) circle(ctx, 0, 0, p.radius * 0.45, GOLD_LEAF); // élite
      else circle(ctx, -p.radius * 0.25, -p.radius * 0.25, p.radius * 0.3, CUT);
    }
    ctx.restore();
  }

  private drawHeroBar(ctx: Ctx, p: { x: number; y: number }): void {
    const h = this.world.hero;
    const k = Math.max(0, h.hp / h.stats.maxHp);
    const wbar = 40;
    const x = p.x - wbar / 2;
    const y = p.y - 40;
    ctx.fillStyle = INK;
    ctx.fillRect(x - 2, y - 2, wbar + 4, 8);
    ctx.fillStyle = k > 0.3 ? JADE : DANGER;
    ctx.fillRect(x, y, Math.max(2, wbar * k), 4);
    // graduations tous les 100 PV
    ctx.fillStyle = INK;
    for (let v = 100; v < h.stats.maxHp; v += 100) ctx.fillRect(x + (wbar * v) / h.stats.maxHp, y, 1, 4);
    ctx.font = '700 10px "Alegreya Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    ctx.fillText(`${Math.ceil(Math.max(0, h.hp))}`, p.x, y - 4);
  }

  private drawBossBar(ctx: Ctx, b: Enemy, cw: number): void {
    this.bossShown = Math.min(1, this.bossShown + 0.04);
    const k = Math.max(0, b.hp / b.maxHp);
    const wbar = Math.min(320, cw - 120);
    const x = (cw - wbar) / 2;
    const y = HUD_TOP - 6 - (1 - this.bossShown) * 30;
    ctx.globalAlpha = this.bossShown;
    ctx.fillStyle = INK;
    ctx.fillRect(x - 3, y - 3, wbar + 6, 12);
    ctx.fillStyle = UI.paperDark;
    ctx.fillRect(x, y, wbar, 6);
    ctx.fillStyle = DANGER;
    ctx.fillRect(x, y, wbar * k, 6);
    ctx.fillStyle = INK;
    for (const f of [1 / 3, 2 / 3]) ctx.fillRect(x + wbar * f - 1, y - 2, 2, 10);
    ctx.globalAlpha = 1;
  }

  private drawBanner(ctx: Ctx, cw: number, ch: number): void {
    const b = this.banner;
    if (!b) return;
    const dur = 1.8;
    if (b.t > dur) {
      this.banner = null;
      return;
    }
    // une étiquette de papier qui descend au bout de deux fils, puis remonte
    const inK = Math.min(1, b.t / 0.4);
    const outK = Math.max(0, (b.t - (dur - 0.35)) / 0.35);
    const drop = easeOutBack(inK) * (1 - easeOutCubic(outK));
    const y = -60 + drop * (ch * 0.34 + 60);
    const wv = Math.min(cw - 60, 280);
    const hv = b.sub ? 74 : 54;
    ctx.save();
    ctx.translate(cw / 2, y);
    ctx.rotate(Math.sin(b.t * 5) * 0.02 * (1 - inK * 0.5));
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-wv / 2 + 20, -ch);
    ctx.lineTo(-wv / 2 + 20, 0);
    ctx.moveTo(wv / 2 - 20, -ch);
    ctx.lineTo(wv / 2 - 20, 0);
    ctx.stroke();
    ctx.fillStyle = INK;
    ctx.fillRect(-wv / 2 + 4, 4, wv, hv);
    ctx.fillStyle = UI.paper;
    ctx.fillRect(-wv / 2, 0, wv, hv);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 2;
    ctx.strokeRect(-wv / 2 + 5, 5, wv - 10, hv - 10);
    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    ctx.font = `400 30px "IM Fell English SC", Georgia, serif`;
    ctx.fillText(b.text, 0, 37);
    if (b.sub) {
      ctx.font = 'italic 500 14px "Alegreya Sans", sans-serif';
      ctx.fillStyle = INK2;
      ctx.fillText(b.sub, 0, 58);
    }
    ctx.restore();
  }
}




function bossName(a: string): string {
  return ({ treant: 'Treant colossal', queen: 'Reine des marais', scorpion: "Scorpion d'ambre", wyvern: 'Wyverne de givre', ashlord: 'Seigneur des cendres' } as Record<string, string>)[a] ?? a;
}

function easeOutCubic(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

void ellipse;
void HERO;

function centroid(poly: { x: number; y: number }[]): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const p of poly) {
    x += p.x;
    y += p.y;
  }
  return { x: x / poly.length, y: y / poly.length };
}
