/** Écran de combat : la simulation TS rendue en Canvas 2D, avec interpolation et motion design. */
import { Arena, type RoomTemplate } from '../../sim/src/arena.js';
import { FloatingAnchor } from '../../sim/src/controls.js';
import { SIM_DT, HERO, HEAL_BETWEEN_ROOMS } from '../../sim/src/constants.js';
import { HEROES, type PowerId } from '../../sim/src/content.js';
import { offerPowers, talentsForLevel, type LevelDef } from '../../sim/src/level.js';
import { stars as starsOf } from '../../sim/src/formulas.js';
import { Rng, seedOf } from '../../sim/src/rng.js';
import { World, newHero, grantPower, type Enemy, type HeroState, type Hazard, type Projectile } from '../../sim/src/world.js';
import { PAINTERS, type AnimState } from '../../art/src/characters.js';
import { paintArenaStatic, paintLiquids, paintPortal, paintFrame, AW, AH, WALL } from '../../art/src/arena-art.js';
import { KINGDOMS, UI, type KingdomTheme } from '../../art/src/palette.js';
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
    this.amb = new Ambience(AW, AH, this.theme.moteKind, this.theme.mote);

    const talents = opt.talents ?? talentsForLevel(opt.level.n);
    this.hero = newHero(talents, {}, opt.autoFire);
    const hd = HEROES[opt.heroId ?? 'scout'];
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
  stats(): { kills: number; seconds: number; maxHp: number } {
    return { kills: this.kills + (this.world?.kills ?? 0), seconds: this.seconds, maxHp: this.hero.stats.maxHp };
  }

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
    const offer = offerPowers(this.powerRng, this.hero.powers);
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
      this.hooks.finish({ won: true, stars: starsOf(true, hpFrac), hpFrac, seconds: this.seconds, kills: this.kills + this.world.kills, continues: this.continues });
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
      this.fx.ring(this.hero.pos.x, this.hero.pos.y, UI.moon, 140, 0.6);
      this.fx.stars(this.hero.pos.x, this.hero.pos.y, UI.moon, 14);
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
    w.step(this.input());
    this.seconds += SIM_DT;
    this.react(beforeProj, hpBefore);
    if (w.dead) {
      this.fx.hitStop(0.25);
      this.fx.shake(1);
      this.fx.burst(w.hero.pos.x, w.hero.pos.y, UI.heroCloak, 24, 200, 'dot', 4, 0.9);
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
          fx.puff(ev.x, ev.y, '#ffffff', big ? 18 : 7, big ? 16 : 9);
          fx.wisps(ev.x, ev.y, this.theme.accent, big ? 14 : 4);
          fx.burst(ev.x, ev.y, UI.gold, big ? 30 : 6, big ? 260 : 140, 'spark', 2.5, 0.5);
          fx.ring(ev.x, ev.y, '#ffffff', big ? 140 : 34, big ? 0.7 : 0.3);
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
          fx.text(w.hero.pos.x, w.hero.pos.y - 30, 'Esquive', UI.moon, 14);
          break;
        case 'shield':
          fx.ring(w.hero.pos.x, w.hero.pos.y, '#9fb8ff', 40, 0.4);
          fx.text(w.hero.pos.x, w.hero.pos.y - 30, 'Bloqué', '#9fb8ff', 14);
          break;
        case 'wave':
          if (ev.index > 0) this.banner = { text: `Vague ${ev.index + 1}`, sub: '', t: 0.25 };
          break;
        case 'cleared':
          fx.text(AW / 2, AH * 0.42, 'Salle nettoyée !', UI.moon, 22);
          fx.stars(AW / 2, 10, this.theme.accent, 16);
          sfx('clear');
          break;
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
        fx.text(e.pos.x + (fx.rand() - 0.5) * 12, e.pos.y - e.radius - 8, `${Math.round(d)}`, hit.crit ? UI.gold : '#ffffff', hit.crit ? 19 : 13);
        fx.burst(e.pos.x, e.pos.y, hit.crit ? UI.gold : '#fff6d8', hit.crit ? 9 : 4, 150, 'spark', 2, 0.25);
        if (hit.crit) fx.shake(0.12);
        sfx('hit');
      } else {
        const acc = (this.dot.get(e.id) ?? 0) + d;
        if (acc > 25) {
          fx.text(e.pos.x, e.pos.y - e.radius - 4, `${Math.round(acc)}`, '#ffb347', 11);
          this.dot.set(e.id, 0);
        } else this.dot.set(e.id, acc);
      }
    }
    // flèches qui heurtent un mur : petite poussière
    const alive = new Set(w.projectiles);
    for (const p of beforeProj) {
      if (alive.has(p) || !p.fromHero) continue;
      if (!w.enemies.some((e) => Math.hypot(e.pos.x - p.pos.x, e.pos.y - p.pos.y) < e.radius + 14)) fx.burst(p.pos.x, p.pos.y, '#e8dcc0', 3, 80, 'dot', 2, 0.25);
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
    if (w.cleared) this.portalOpen = Math.min(1, this.portalOpen + dt * 2);
    paintPortal(ctx, th, t, easeOutBack(this.portalOpen));
    if (w.cleared && !w.exited) this.drawPortalGuide(ctx, t);

    for (const z of w.hazards) this.drawHazard(ctx, z, t);
    for (const o of w.orbs) {
      const bob = Math.sin(t * 4 + o.pos.x) * 3;
      glow(ctx, o.pos.x, o.pos.y + bob, 16, UI.heal, 0.6);
      heartShape(ctx, o.pos.x, o.pos.y + bob, 7, UI.heal);
    }

    // halo sous le héros quand le doigt est posé (§2)
    const hp = this.lerp(w.hero, a);
    if (this.anchor.touching) {
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = th.accent;
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
      v.addColorStop(0, 'rgba(255,40,60,0)');
      v.addColorStop(1, `rgba(255,40,60,${0.45 * this.fx.heroFlash})`);
      ctx.fillStyle = v;
      ctx.fillRect(0, 0, cw, ch);
    }
    if (w.dead) {
      ctx.fillStyle = 'rgba(10,6,20,0.45)';
      ctx.fillRect(0, 0, cw, ch);
    }
    this.drawBanner(ctx, cw, ch);
    if (this.transition < 0) {
      // iris d'ouverture
      const k = 1 + this.transition;
      const r = Math.hypot(cw, ch) * easeOutCubic(k);
      ctx.save();
      ctx.fillStyle = '#07040f';
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
      ctx.fillStyle = this.theme.accent;
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

  private drawHero(ctx: Ctx, p: { x: number; y: number }, t: number): void {
    const h = this.world.hero;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (h.stats.orb) {
      const ox = Math.cos(h.orbAngle) * 56;
      const oy = Math.sin(h.orbAngle) * 56;
      glow(ctx, ox, oy, 18, '#5fd8ff', 0.7);
      circle(ctx, ox, oy, 7, '#bff4ff', INK, 2);
    }
    if (h.shieldReady) {
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 4);
      circle(ctx, 0, -2, 22, 'rgba(120,160,255,0.18)', '#9fb8ff', 2);
      ctx.globalAlpha = 1;
    }
    if (h.flashT > 0) glow(ctx, 0, 0, 30, '#ffffff', 0.6);
    const aiming = !h.moving && !!this.world.target;
    const state: AnimState = h.moving ? 'move' : 'idle';
    PAINTERS[this.opt.heroId ?? 'scout'](ctx, { t, facing: h.facing, state, windup: 0, flash: 0, elite: false, seed: 0, aiming, blink: h.invuln > 0 });
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
    } else this.windups.delete(e.id);
    if (e.boss && e.boss.breath > 0) state = 'breath';
    const flash = this.flashes.get(e.id) ?? 0;
    if (flash > 0) this.flashes.set(e.id, Math.max(0, flash - dt * 6));
    const hd = Math.atan2(this.world.hero.pos.y - e.pos.y, this.world.hero.pos.x - e.pos.x);
    const facing = e.state === 'charge' ? Math.atan2(e.aim.y, e.aim.x) : hd;
    const painter = e.boss ? PAINTERS[e.boss.archetype] : PAINTERS[e.type];
    ctx.save();
    ctx.translate(p.x, p.y);
    if (e.state === 'spawn') {
      // cercle d'invocation puis apparition élastique
      const k = 1 - Math.max(0, e.t) / (e.boss ? 1.2 : 0.8);
      ctx.save();
      ctx.rotate(t * 2);
      ctx.strokeStyle = alpha(this.theme.accent, 0.9 * (1 - k * 0.5));
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.arc(0, 4, e.radius * 1.4, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      glow(ctx, 0, 0, e.radius * 2, this.theme.accent, 0.5 * (1 - k));
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
    if (e.slowT > 0) glow(ctx, 0, 0, e.radius * 1.6, '#bfe8ff', 0.35);
    painter(ctx, { t, facing, state, windup, flash, elite: e.elite, seed: e.id, variant: e.type === 'jellySmall' ? 1 : e.boss?.variant, hpFrac: e.hp / e.maxHp });
    if (e.burnT > 0) for (let i = 0; i < 2; i++) glow(ctx, Math.sin(t * 9 + i * 3) * 8, -e.radius + Math.cos(t * 7 + i) * 4, 7, '#ff8a3d', 0.7);
    if (e.poisonStacks > 0) for (let i = 0; i < e.poisonStacks; i++) circle(ctx, -8 + i * 4, -e.radius - 6 + Math.sin(t * 5 + i) * 2, 1.8, '#9fff6b');
    ctx.restore();
    // mini-barre de vie des ennemis blessés
    if (!e.boss && e.hp < e.maxHp && e.state !== 'spawn') {
      const wbar = e.radius * 1.8;
      const y = p.y - e.radius - 10;
      ctx.fillStyle = 'rgba(10,6,20,0.7)';
      ctx.fillRect(p.x - wbar / 2 - 1, y - 1, wbar + 2, 5);
      ctx.fillStyle = e.elite ? UI.gold : '#ff6b6b';
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
      ctx.fillStyle = alpha(UI.danger, 0.18 + 0.12 * k);
      ctx.beginPath();
      ctx.roundRect(0, -z.radius, len, z.radius * 2, z.radius);
      ctx.fill();
      ctx.fillStyle = alpha(UI.danger, 0.4);
      ctx.beginPath();
      ctx.roundRect(0, -z.radius, len * k, z.radius * 2, z.radius);
      ctx.fill();
      // chevrons qui défilent
      ctx.strokeStyle = alpha('#ffffff', 0.7);
      ctx.lineWidth = 2.5;
      for (let x = ((t * 140) % 22) - 22; x < len - 8; x += 22) {
        if (x < 4) continue;
        ctx.beginPath();
        ctx.moveTo(x, -6);
        ctx.lineTo(x + 7, 0);
        ctx.lineTo(x, 6);
        ctx.stroke();
      }
      ctx.restore();
      return;
    }
    const warn = now < z.activeAt;
    if (warn) {
      const k = Math.min(1, (now - z.born) / Math.max(0.01, z.activeAt - z.born));
      ctx.save();
      ctx.translate(z.pos.x, z.pos.y);
      ctx.fillStyle = alpha(UI.danger, 0.16);
      ctx.beginPath();
      ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = alpha(UI.danger, 0.35);
      ctx.beginPath();
      ctx.arc(0, 0, z.radius * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(t * 1.5);
      ctx.strokeStyle = alpha(UI.danger, 0.95);
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(0, 0, z.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
      return;
    }
    const lasting = z.endAt - z.activeAt > 0.5;
    if (!lasting) {
      // impact bref : onde de choc
      const k = (now - z.activeAt) / Math.max(0.01, z.endAt - z.activeAt);
      if (k < 0.2 && !this.flashes.has(-z.nextTick)) {
        this.fx.ring(z.pos.x, z.pos.y, '#ffffff', z.radius * 1.1, 0.4);
        this.fx.puff(z.pos.x, z.pos.y, kind === 'wyvern' ? '#eaf6ff' : '#d8c8b8', 6, 10);
        this.fx.shake(z.radius > 90 ? 0.4 : 0.15);
        this.flashes.set(-z.nextTick, 0);
      }
      return;
    }
    // flaque persistante : feu, poison ou givre
    const col = kind === 'queen' ? '#7ad15a' : kind === 'wyvern' ? '#bfe8ff' : '#ff7a3d';
    const fade = Math.min(1, (z.endAt - now) * 2);
    ctx.save();
    ctx.globalAlpha = fade;
    glow(ctx, z.pos.x, z.pos.y, z.radius * 1.2, col, 0.55);
    ctx.fillStyle = alpha(col, 0.3);
    ctx.beginPath();
    ctx.arc(z.pos.x, z.pos.y, z.radius, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 7; i++) {
      const aa = i * 0.9 + z.born;
      const rr = (z.radius * 0.75 * ((i * 37) % 10)) / 10;
      const fx = z.pos.x + Math.cos(aa) * rr;
      const fy = z.pos.y + Math.sin(aa) * rr;
      const h = 6 + Math.sin(t * 10 + i) * 3;
      ctx.fillStyle = i % 2 ? col : mix(col, '#ffffff', 0.5);
      ctx.beginPath();
      ctx.moveTo(fx - 4, fy);
      ctx.quadraticCurveTo(fx, fy - h * 2, fx + 4, fy);
      ctx.fill();
    }
    ctx.restore();
  }

  private drawProjectile(ctx: Ctx, p: Projectile, q: { x: number; y: number }, t: number): void {
    const ang = Math.atan2(p.vel.y, p.vel.x);
    if (p.fromHero && this.opt.heroId && this.opt.heroId !== 'scout') {
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(ang);
      if (this.opt.heroId === 'windMonk') {
        ctx.strokeStyle = 'rgba(191,244,255,0.9)';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        for (let i = 0; i < 2; i++) {
          ctx.beginPath();
          ctx.arc(-i * 9, 0, 7 - i * 2, -1.1, 1.1);
          ctx.stroke();
        }
        glow(ctx, 0, 0, 12, '#bff4ff', 0.45);
      } else {
        ctx.fillStyle = alpha('#ff8a3d', 0.4);
        ctx.beginPath();
        ctx.ellipse(-10, 0, 12, 4, 0, 0, Math.PI * 2);
        ctx.fill();
        glow(ctx, 0, 0, 12, '#ff8a3d', 0.7);
        circle(ctx, 0, 0, 4.5, '#ffd36b', INK, 1.5);
      }
      ctx.restore();
      return;
    }
    if (p.fromHero) {
      ctx.save();
      ctx.translate(q.x, q.y);
      ctx.rotate(ang);
      const tr = ctx.createLinearGradient(-34, 0, 0, 0);
      tr.addColorStop(0, alpha(UI.moonGlow, 0));
      tr.addColorStop(1, alpha(UI.moonGlow, 0.8));
      ctx.strokeStyle = tr;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-34, 0);
      ctx.lineTo(0, 0);
      ctx.stroke();
      ctx.strokeStyle = '#f4ecd8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(4, 0);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(8, 0);
      ctx.lineTo(2, -3.5);
      ctx.lineTo(2, 3.5);
      ctx.fill();
      ctx.restore();
      return;
    }
    const sp = Math.hypot(p.vel.x, p.vel.y);
    // couleur selon la source (déduite de la vitesse)
    let col = this.theme.accent === '#ff7a3d' ? '#ff5fa8' : '#ff5fa8';
    let core = '#ffffff';
    let arrowLike = false;
    if (Math.abs(sp - 300) < 2) col = '#c8a070';
    else if (Math.abs(sp - 340) < 2) {
      col = '#9fe8ff';
      arrowLike = true;
    } else if (Math.abs(sp - 150) < 2) col = '#9fff6b';
    else if (Math.abs(sp - 170) < 2) col = '#5fd8ff';
    else if (Math.abs(sp - 140) < 2) {
      col = UI.gold;
      core = '#fff3c2';
    }
    ctx.save();
    ctx.translate(q.x, q.y);
    if (arrowLike) {
      ctx.rotate(ang);
      glow(ctx, 0, 0, 12, col, 0.5);
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-12, 0);
      ctx.lineTo(6, 0);
      ctx.stroke();
    } else {
      // traînée + halo + noyau, contour sombre pour la lisibilité
      ctx.rotate(ang);
      ctx.fillStyle = alpha(col, 0.35);
      ctx.beginPath();
      ctx.ellipse(-p.radius * 1.2, 0, p.radius * 2, p.radius * 0.8, 0, 0, Math.PI * 2);
      ctx.fill();
      glow(ctx, 0, 0, p.radius * 2.6, col, 0.55);
      circle(ctx, 0, 0, p.radius + 1, INK);
      circle(ctx, 0, 0, p.radius, col);
      circle(ctx, -p.radius * 0.25, -p.radius * 0.25, p.radius * 0.45, core);
      void t;
    }
    ctx.restore();
  }

  private drawHeroBar(ctx: Ctx, p: { x: number; y: number }): void {
    const h = this.world.hero;
    const k = Math.max(0, h.hp / h.stats.maxHp);
    const wbar = 40;
    const x = p.x - wbar / 2;
    const y = p.y - 40;
    ctx.fillStyle = 'rgba(10,6,20,0.75)';
    ctx.beginPath();
    ctx.roundRect(x - 2, y - 2, wbar + 4, 8, 4);
    ctx.fill();
    const col = k > 0.5 ? UI.heal : k > 0.25 ? '#ffcf4a' : UI.danger;
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(2, wbar * k), 4, 2);
    ctx.fill();
    ctx.font = '700 9px Fredoka, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 3;
    ctx.strokeStyle = INK;
    ctx.strokeText(`${Math.ceil(Math.max(0, h.hp))}`, p.x, y - 3);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${Math.ceil(Math.max(0, h.hp))}`, p.x, y - 3);
  }

  private drawBossBar(ctx: Ctx, b: Enemy, cw: number): void {
    this.bossShown = Math.min(1, this.bossShown + 0.04);
    const k = Math.max(0, b.hp / b.maxHp);
    const wbar = Math.min(320, cw - 120);
    const x = (cw - wbar) / 2;
    const y = HUD_TOP - 6 - (1 - this.bossShown) * 30;
    ctx.globalAlpha = this.bossShown;
    ctx.fillStyle = 'rgba(10,6,20,0.8)';
    ctx.beginPath();
    ctx.roundRect(x - 3, y - 3, wbar + 6, 12, 6);
    ctx.fill();
    const g = ctx.createLinearGradient(x, 0, x + wbar, 0);
    g.addColorStop(0, '#ff4d5e');
    g.addColorStop(1, '#ff9a5e');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(x, y, wbar * k, 6, 3);
    ctx.fill();
    // repères de phase (66 %, 33 %)
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
    const inK = Math.min(1, b.t / 0.35);
    const outK = Math.max(0, (b.t - (dur - 0.4)) / 0.4);
    const y = ch * 0.36;
    ctx.save();
    ctx.globalAlpha = 1 - outK;
    ctx.translate(cw / 2 + (1 - easeOutBack(inK)) * -cw * 0.5 + outK * cw * 0.3, y);
    const g = ctx.createLinearGradient(-cw / 2, 0, cw / 2, 0);
    g.addColorStop(0, 'rgba(10,6,20,0)');
    g.addColorStop(0.5, 'rgba(10,6,20,0.7)');
    g.addColorStop(1, 'rgba(10,6,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(-cw / 2, -34, cw, b.sub ? 70 : 52);
    ctx.textAlign = 'center';
    ctx.font = `900 30px "Cinzel Decorative", Georgia, serif`;
    ctx.fillStyle = UI.moon;
    ctx.shadowColor = this.theme.accent;
    ctx.shadowBlur = 16;
    ctx.fillText(b.text, 0, 4);
    ctx.shadowBlur = 0;
    if (b.sub) {
      ctx.font = '500 14px Fredoka, sans-serif';
      ctx.fillStyle = UI.inkSoft;
      ctx.fillText(b.sub, 0, 26);
    }
    ctx.restore();
  }
}

function heartShape(ctx: Ctx, x: number, y: number, s: number, col: string): void {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 1.6, y - s * 0.1, x - s * 0.8, y - s * 1.3, x, y - s * 0.4);
  ctx.bezierCurveTo(x + s * 0.8, y - s * 1.3, x + s * 1.6, y - s * 0.1, x, y + s * 0.9);
  ctx.fillStyle = col;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = INK;
  ctx.stroke();
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
