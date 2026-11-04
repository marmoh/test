/** Rastérise un personnage (painter) en image : avatars de la carte, aperçus d'ennemis, boss. */
import { PAINTERS, type AnimState } from '../../art/src/characters.js';

const cache = new Map<string, string>();

export function portrait(name: string, size: number, opts: { scale?: number; state?: AnimState; variant?: number; facing?: number; dy?: number; t?: number } = {}): string {
  const key = `${name}|${size}|${JSON.stringify(opts)}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const dpr = Math.min(3, devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(size * dpr);
  const ctx = c.getContext('2d')!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.translate(size / 2, size / 2 + (opts.dy ?? 4));
  const s = opts.scale ?? 1;
  ctx.scale(s, s);
  PAINTERS[name](ctx, { t: opts.t ?? 0.4, facing: opts.facing ?? 0.25, state: opts.state ?? 'idle', windup: 0, flash: 0, elite: false, seed: 1, variant: opts.variant });
  const url = c.toDataURL('image/png');
  cache.set(key, url);
  return url;
}

/** Petit canvas animé (personnage en boucle) — écran titre, victoire. */
export function liveSprite(name: string, size: number, scale: number, state: AnimState = 'idle', extra: { aiming?: boolean; facing?: number } = {}): HTMLCanvasElement {
  const dpr = Math.min(3, devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = c.height = Math.round(size * dpr);
  c.style.width = c.style.height = size + 'px';
  const ctx = c.getContext('2d')!;
  const loop = (ms: number) => {
    if (!c.isConnected && ms > 2000) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.translate(size / 2, size / 2 + size * 0.12);
    ctx.scale(scale, scale);
    PAINTERS[name](ctx, { t: ms / 1000, facing: extra.facing ?? 0.2, state, windup: 0, flash: 0, elite: false, seed: 3, aiming: extra.aiming });
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
  return c;
}
export function clearPortraits(): void {
  cache.clear();
}
