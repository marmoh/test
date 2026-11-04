/** Planche de personnages (contrôle visuel des « rigs »). */
import { PAINTERS, type AnimState } from '../../art/src/characters.js';
import { KINGDOMS } from '../../art/src/palette.js';

export function mountSheet(root: HTMLElement): void {
  const c = document.createElement('canvas');
  const W = 900, H = 760, dpr = Math.min(2, devicePixelRatio || 1);
  c.width = W * dpr; c.height = H * dpr; c.style.width = W + 'px'; c.style.height = H + 'px';
  root.appendChild(c);
  const ctx = c.getContext('2d')!;
  const names = Object.keys(PAINTERS);
  const states: AnimState[] = ['idle', 'move', 'windup', 'charge'];
  const frame = (ms: number) => {
    const t = ms / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, KINGDOMS[0].light); g.addColorStop(1, KINGDOMS[0].paper);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    names.forEach((n, i) => {
      const boss = ['treant', 'queen', 'scorpion', 'wyvern', 'ashlord'].includes(n);
      states.forEach((s, j) => {
        const x = 60 + (i % 5) * 170 + j * 0;
        const y = 70 + Math.floor(i / 5) * 230 + j * 0;
        if (j > 0 && !boss) {
          // variantes d'état en petit à droite
          ctx.save(); ctx.translate(x + 40 + j * 30, y + 70); ctx.scale(0.6, 0.6);
          PAINTERS[n](ctx, { t: t + j, facing: 0.3, state: s, windup: (t * 1.5) % 1, flash: 0, elite: j === 3, seed: i });
          ctx.restore();
        }
      });
      const x = 60 + (i % 5) * 170, y = 70 + Math.floor(i / 5) * 230;
      ctx.save(); ctx.translate(x, y); ctx.scale(boss ? 1.3 : 1.8, boss ? 1.3 : 1.8);
      PAINTERS[n](ctx, { t, facing: Math.sin(t * 0.5) > 0 ? 0.2 : Math.PI - 0.2, state: boss && Math.floor(t / 2) % 3 === 2 ? 'breath' : 'move', windup: 0, flash: 0, elite: false, seed: i, aiming: n === 'hero' });
      ctx.restore();
      ctx.fillStyle = '#f4ecd8'; ctx.font = '600 13px Fredoka, sans-serif'; ctx.fillText(n, x - 30, y + (boss ? 75 : 55));
    });
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
