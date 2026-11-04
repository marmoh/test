/** Rendu des images d'atlas (utilisé par tools/art-atlas.mjs via ?atlas). */
import { PAINTERS, type AnimState } from '../../art/src/characters.js';
import { POWER_ICONS, UI_ICONS, iconURL } from '../../art/src/icons.js';

export interface FrameSpec {
  name: string;
  state: AnimState;
  frames: number;
  /** durée de la boucle (s) */
  loop: number;
  size: number;
  variant?: number;
  aiming?: boolean;
  elite?: boolean;
}

function renderFrame(f: FrameSpec, i: number, scale: number): string {
  const c = document.createElement('canvas');
  c.width = c.height = f.size * scale;
  const ctx = c.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, (f.size * scale) / 2, (f.size * scale) / 2 + 4 * scale);
  const windup = f.state === 'windup' ? i / Math.max(1, f.frames - 1) : 0;
  PAINTERS[f.name](ctx, { t: (i / f.frames) * f.loop, facing: 0, state: f.state, windup, flash: 0, elite: !!f.elite, seed: 0, variant: f.variant, aiming: f.aiming });
  return c.toDataURL('image/png');
}

async function renderSvg(svg: string, px: number): Promise<string> {
  const img = new Image();
  img.src = iconURL(svg);
  await img.decode();
  const c = document.createElement('canvas');
  c.width = c.height = px;
  c.getContext('2d')!.drawImage(img, 0, 0, px, px);
  return c.toDataURL('image/png');
}

declare global {
  interface Window {
    atlasFrames: (f: FrameSpec, scale: number) => string[];
    atlasIcons: (scale: number) => Promise<Record<string, string>>;
  }
}

export function mountAtlas(): void {
  window.atlasFrames = (f, scale) => Array.from({ length: f.frames }, (_, i) => renderFrame(f, i, scale));
  window.atlasIcons = async (scale) => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(POWER_ICONS)) out[`power_${k}`] = await renderSvg(v, 64 * scale);
    for (const [k, v] of Object.entries(UI_ICONS)) out[`ui_${k}`] = await renderSvg(v, 64 * scale);
    return out;
  };
  document.body.dataset.atlasReady = '1';
}
