/** Motion design du combat : particules, textes flottants, secousses, arrêt sur image. */
import { alpha, circle, glow, star, type Ctx } from '../../art/src/draw.js';
import { INK, INK2, CUT } from '../../art/src/palette.js';

interface Particle {
  kind: 'dot' | 'spark' | 'puff' | 'ring' | 'star' | 'wisp' | 'scrap';
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  grav: number;
  drag: number;
  rot: number;
}

interface FloatText {
  x: number;
  y: number;
  text: string;
  color: string;
  size: number;
  life: number;
  max: number;
  vx: number;
}

export class Fx {
  parts: Particle[] = [];
  texts: FloatText[] = [];
  trauma = 0;
  freeze = 0;
  heroFlash = 0;
  /** ralenti global (victoire, boss vaincu) */
  slowmo = 0;
  reduceMotion = false;
  private seed = 1;

  rand(): number {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  shake(amount: number): void {
    if (this.reduceMotion) return;
    this.trauma = Math.min(1, this.trauma + amount);
  }

  hitStop(s: number): void {
    if (this.reduceMotion) return;
    this.freeze = Math.max(this.freeze, s);
  }

  burst(x: number, y: number, color: string, n: number, speed = 160, kind: Particle['kind'] = 'dot', size = 3, life = 0.5, grav = 0): void {
    for (let i = 0; i < n; i++) {
      const a = this.rand() * Math.PI * 2;
      const s = speed * (0.35 + this.rand() * 0.65);
      this.parts.push({ kind, x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.6 + this.rand() * 0.4), max: life, size: size * (0.6 + this.rand() * 0.6), color, grav, drag: 3, rot: a });
    }
  }

  ring(x: number, y: number, color: string, size: number, life = 0.35): void {
    this.parts.push({ kind: 'ring', x, y, vx: 0, vy: 0, life, max: life, size, color, grav: 0, drag: 0, rot: 0 });
  }

  puff(x: number, y: number, color: string, n = 6, size = 9): void {
    for (let i = 0; i < n; i++) {
      const a = this.rand() * Math.PI * 2;
      this.parts.push({ kind: 'puff', x: x + Math.cos(a) * 6, y: y + Math.sin(a) * 6, vx: Math.cos(a) * 40, vy: Math.sin(a) * 40 - 20, life: 0.5, max: 0.5, size: size * (0.7 + this.rand() * 0.6), color, grav: -30, drag: 2, rot: 0 });
    }
  }

  wisps(x: number, y: number, color: string, n = 4): void {
    for (let i = 0; i < n; i++) {
      this.parts.push({ kind: 'wisp', x: x + (this.rand() - 0.5) * 16, y, vx: (this.rand() - 0.5) * 20, vy: -50 - this.rand() * 40, life: 0.9, max: 0.9, size: 3 + this.rand() * 2, color, grav: 0, drag: 0.5, rot: this.rand() * 6 });
    }
  }

  stars(x: number, y: number, color: string, n = 8): void {
    this.burst(x, y, color, n, 220, 'star', 5, 0.8, 260);
  }

  /** Chutes de papier découpé (mort d'une marionnette, impact). */
  scraps(x: number, y: number, n: number, power = 1): void {
    for (let i = 0; i < n; i++) {
      const a = this.rand() * Math.PI * 2;
      const sp = (60 + this.rand() * 160) * power;
      const r = this.rand();
      this.parts.push({ kind: 'scrap', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60 * power, life: 0.9 + this.rand() * 0.4, max: 1.3, size: 2.5 + this.rand() * 3.5 * power, color: r < 0.6 ? INK : r < 0.85 ? INK2 : CUT, grav: 260, drag: 2.2, rot: this.rand() * 6 });
    }
  }

  text(x: number, y: number, text: string, color: string, size = 14): void {
    this.texts.push({ x, y, text, color, size, life: 0.8, max: 0.8, vx: (this.rand() - 0.5) * 30 });
  }

  update(dt: number): void {
    this.trauma = Math.max(0, this.trauma - dt * 1.8);
    this.heroFlash = Math.max(0, this.heroFlash - dt * 2.5);
    this.slowmo = Math.max(0, this.slowmo - dt);
    for (const p of this.parts) {
      p.life -= dt;
      p.vx *= Math.exp(-p.drag * dt);
      p.vy *= Math.exp(-p.drag * dt);
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += dt * 6;
    }
    this.parts = this.parts.filter((p) => p.life > 0);
    for (const t of this.texts) {
      t.life -= dt;
      t.y -= 38 * dt;
      t.x += t.vx * dt;
    }
    this.texts = this.texts.filter((t) => t.life > 0);
    if (this.parts.length > 600) this.parts.splice(0, this.parts.length - 600);
  }

  shakeOffset(t: number): [number, number] {
    const k = this.trauma * this.trauma * 7;
    return [Math.sin(t * 91.7) * k, Math.cos(t * 73.3) * k];
  }

  draw(ctx: Ctx): void {
    for (const p of this.parts) {
      const k = p.life / p.max;
      ctx.globalAlpha = Math.min(1, k * 1.6);
      switch (p.kind) {
        case 'dot':
          circle(ctx, p.x, p.y, p.size * (0.4 + k * 0.6), p.color);
          break;
        case 'spark': {
          const sp = Math.hypot(p.vx, p.vy) * 0.04 + 2;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.size * k;
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - (p.vx / (Math.hypot(p.vx, p.vy) + 1e-6)) * sp, p.y - (p.vy / (Math.hypot(p.vx, p.vy) + 1e-6)) * sp);
          ctx.stroke();
          break;
        }
        case 'puff':
          ctx.globalAlpha = k * 0.6;
          circle(ctx, p.x, p.y, p.size * (1.6 - k * 0.6), p.color);
          break;
        case 'ring':
          ctx.globalAlpha = k;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 3 * k + 0.5;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * (1.15 - k * 0.85) + 2, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case 'star':
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          star(ctx, 0, 0, p.size, 0.45);
          ctx.fillStyle = p.color;
          ctx.fill();
          ctx.restore();
          break;
        case 'scrap':
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.scale(1, Math.cos(p.rot * 1.7));
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(-p.size, -p.size * 0.6);
          ctx.lineTo(p.size * 0.8, -p.size * 0.4);
          ctx.lineTo(p.size * 0.5, p.size * 0.7);
          ctx.lineTo(-p.size * 0.7, p.size * 0.5);
          ctx.closePath();
          ctx.fill();
          ctx.restore();
          break;
        case 'wisp':
          glow(ctx, p.x + Math.sin(p.rot + p.life * 6) * 4, p.y, p.size * 3, p.color, 0.7 * k);
          break;
      }
    }
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    for (const t of this.texts) {
      const k = t.life / t.max;
      const pop = k > 0.8 ? 1 + (k - 0.8) * 3 : 1;
      ctx.globalAlpha = Math.min(1, k * 2);
      ctx.font = `800 ${Math.round(t.size * pop)}px "Alegreya Sans", sans-serif`;
      ctx.lineWidth = 4;
      ctx.strokeStyle = alpha('#f4e8c8', 0.95);
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }
}

/** Particules d'ambiance du royaume (lucioles, spores, sable, neige, braises). */
export class Ambience {
  motes: { x: number; y: number; ph: number; s: number }[] = [];
  constructor(
    readonly w: number,
    readonly h: number,
    readonly kind: string,
    readonly color: string,
    n = 26,
  ) {
    for (let i = 0; i < n; i++) this.motes.push({ x: Math.random() * w, y: Math.random() * h, ph: Math.random() * 10, s: 0.6 + Math.random() * 0.8 });
  }
  draw(ctx: Ctx, t: number, dt: number): void {
    for (const m of this.motes) {
      switch (this.kind) {
        case 'firefly':
          m.x += Math.sin(t * 0.7 + m.ph) * 12 * dt;
          m.y += Math.cos(t * 0.5 + m.ph) * 10 * dt;
          break;
        case 'spore':
          m.y -= 8 * m.s * dt;
          m.x += Math.sin(t + m.ph) * 6 * dt;
          break;
        case 'sand':
          m.x += 40 * m.s * dt;
          m.y += Math.sin(t * 2 + m.ph) * 4 * dt;
          break;
        case 'snow':
          m.y += 22 * m.s * dt;
          m.x += Math.sin(t + m.ph) * 10 * dt;
          break;
        case 'ember':
          m.y -= 26 * m.s * dt;
          m.x += Math.sin(t * 1.5 + m.ph) * 8 * dt;
          break;
      }
      if (m.x < -10) m.x = this.w + 10;
      if (m.x > this.w + 10) m.x = -10;
      if (m.y < -10) m.y = this.h + 10;
      if (m.y > this.h + 10) m.y = -10;
      const tw = this.kind === 'firefly' ? 0.5 + 0.5 * Math.sin(t * 3 + m.ph * 5) : 0.8;
      if (this.kind === 'firefly' || this.kind === 'ember' || this.kind === 'spore') glow(ctx, m.x, m.y, 7 * m.s, this.color, 0.45 * tw);
      circle(ctx, m.x, m.y, 1.3 * m.s, alpha(this.color, 0.9 * tw));
    }
  }
}
