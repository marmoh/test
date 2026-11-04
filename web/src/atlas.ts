/** Rendu des images d'atlas (utilisé par tools/art-atlas.mjs via ?atlas). */
import { PAINTERS, type AnimState } from '../../art/src/characters.js';
import { INK_POWERS as POWER_ICONS, INK_UI as UI_ICONS, iconURL } from '../../art/src/icons.js';
import { KINGDOMS, INK, type KingdomTheme } from '../../art/src/palette.js';
import { alpha } from '../../art/src/draw.js';
import {
  AW, AH, WALL, CELL,
  paintScreenLight, paintHorizon, paintFarPiece, paintRockPiece, paintHedgePiece, paintLiquidPiece, paintLiquidWaves,
  swayTuft, hangingProp, driftProp, lampFlame, paintFibreTile, paintStageFrame, paintFrame,
} from '../../art/src/arena-art.js';
import { VFX, paintVfxFrame } from '../../art/src/vfx.js';

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
  dyingFrames?: boolean;
  cuttingFrames?: boolean;
}

function renderFrame(f: FrameSpec, i: number, scale: number): string {
  const c = document.createElement('canvas');
  c.width = c.height = f.size * scale;
  const ctx = c.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, (f.size * scale) / 2, (f.size * scale) / 2 + 4 * scale);
  const windup = f.state === 'windup' ? i / Math.max(1, f.frames - 1) : 0;
  const k = i / Math.max(1, f.frames - 1);
  PAINTERS[f.name](ctx, { t: (i / f.frames) * f.loop, facing: 0, state: f.state, windup, flash: 0, elite: !!f.elite, seed: 0, variant: f.variant, aiming: f.aiming, dying: f.dyingFrames ? k : undefined, cutting: f.cuttingFrames ? 1 - k : undefined });
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

/** Rend une image de `w` × `h` points à l'échelle `scale` ; `draw` dessine dans le repère en points. */
function shot(w: number, h: number, scale: number, draw: (ctx: CanvasRenderingContext2D) => void): string {
  const c = document.createElement('canvas');
  c.width = Math.round(w * scale);
  c.height = Math.round(h * scale);
  const ctx = c.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  draw(ctx);
  return c.toDataURL('image/png');
}

const pad2 = (i: number) => String(i).padStart(2, '0');

/** Décor d'un royaume (k = 0…4) : voir `ios/Resources/Atlases/README.md`. */
function decorFrames(k: number, scale: number): Record<string, string> {
  const th: KingdomTheme = KINGDOMS[k];
  const out: Record<string, string> = {};
  const liquid = th.liquidIsLava ? 'lava' : 'water';
  // lumière de l'écran : petite image (¼) à étirer sur 396 × 660 pt (dégradé sans détail)
  out.floor_light = shot(AW / 4, AH / 4, scale, (c) => (c.scale(0.25, 0.25), paintScreenLight(c, th)));
  out.horizon = shot(AW, 60, scale, (c) => paintHorizon(c, th));
  for (let v = 0; v < 4; v++) out[`far_${pad2(v)}`] = shot(32, 32, scale, (c) => (c.translate(16, 18), paintFarPiece(c, th, v)));
  for (let v = 0; v < 4; v++) out[`rock_${pad2(v)}`] = shot(56, 56, scale, (c) => (c.translate(6, 6), paintRockPiece(c, th, v)));
  for (let v = 0; v < 4; v++) out[`hedge_${pad2(v)}`] = shot(56, 56, scale, (c) => (c.translate(6, 6), paintHedgePiece(c, th, v)));
  for (let m = 0; m < 16; m++) out[`${liquid}_${pad2(m)}`] = shot(48, 48, scale, (c) => (c.translate(2, 2), paintLiquidPiece(c, th, m)));
  // vagues : 10 images sur la boucle (5 s pour l'eau, 10 s pour la lave)
  const loop = th.liquidIsLava ? 10 : 5;
  for (let i = 0; i < 10; i++) out[`${liquid}_waves_${pad2(i)}`] = shot(CELL, CELL, scale, (c) => paintLiquidWaves(c, th, (i / 10) * loop));
  const col = alpha(th.far, 0.62);
  const hole = alpha(th.light, 0.9);
  // touffes qui ondulent : 8 images sur 2π / 1,3 s ≈ 4,8 s ; ancre au pied (0,5 ; 0,8)
  for (const [tag, ph] of [['a', 1], ['b', 4]] as const) {
    for (let i = 0; i < 8; i++) {
      const t = (i / 8) * ((Math.PI * 2) / 1.3);
      out[`tuft_${tag}_${pad2(i)}`] = shot(28, 28, scale, (c) => {
        c.translate(14, 22);
        c.rotate(Math.sin(t * 1.3 + ph) * 0.14);
        swayTuft(c, th.moteKind, col, 1.1, ph);
      });
    }
  }
  // découpe suspendue à son fil : 8 images de balancement, pivot en haut au centre
  for (let i = 0; i < 8; i++) {
    const t = (i / 8) * ((Math.PI * 2) / 1.1);
    out[`hang_${pad2(i)}`] = shot(32, 56, scale, (c) => {
      const a = Math.sin(t * 1.1) * 0.22;
      const L = 30;
      c.translate(16, 2);
      c.beginPath();
      c.moveTo(0, 0);
      c.lineTo(Math.sin(a) * L, Math.cos(a) * L);
      c.strokeStyle = alpha(INK, 0.28);
      c.lineWidth = 0.7;
      c.stroke();
      c.translate(Math.sin(a) * L, Math.cos(a) * L);
      c.rotate(a * 2);
      hangingProp(c, th.moteKind, col, hole, 0.3);
    });
  }
  for (let i = 0; i < 4; i++) out[`drift_${pad2(i)}`] = shot(20, 20, scale, (c) => (c.translate(10, 10), driftProp(c, th.moteKind, alpha(th.far, 0.38), i)));
  return out;
}

/** Scène commune aux royaumes : cadre, rideaux, lambrequin, rampe, lampes, fibres du papier. */
function stageFrames(scale: number): Record<string, string> {
  const th = KINGDOMS[0];
  const out: Record<string, string> = {};
  out.stage_frame = shot(AW + WALL * 2, AH + WALL * 2, scale, (c) => (c.translate(WALL, WALL), paintStageFrame(c, th)));
  out.floor_fibres = shot(132, 132, scale, (c) => paintFibreTile(c, 132));
  out.curtain_tile = shot(88, 176, scale, (c) => paintFrame(c, 88, 176, 0, 0, th));
  out.valance_tile = shot(120, 64, scale, (c) => {
    c.beginPath();
    c.rect(0, 0, 120, 64);
    c.clip();
    paintFrame(c, 120, 64, 70, 0, th);
    // ne garder que le lambrequin (le rideau est une autre tuile)
    c.globalCompositeOperation = 'destination-in';
    c.beginPath();
    c.rect(0, 0, 120, 64);
    c.fill();
  });
  out.footlights_tile = shot(120, 60, scale, (c) => paintFrame(c, 120, 60, 0, 60, th));
  for (let i = 0; i < 8; i++) {
    const t = i / 8 / 0.45;
    const f = 0.75 + 0.15 * Math.sin(t * 9.3) + 0.1 * Math.sin(t * 23.7);
    out[`lamp_flame_${pad2(i)}`] = shot(12, 16, scale, (c) => lampFlame(c, 6, 11, f, Math.sin(t * 7) * 0.8));
  }
  return out;
}

function vfxFrames(scale: number): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, d] of Object.entries(VFX)) {
    for (let i = 0; i < d.frames; i++) out[`${name}_${pad2(i)}`] = shot(d.w, d.h, scale, (c) => (c.translate(d.w / 2, d.h / 2), paintVfxFrame(c, name, i)));
  }
  return out;
}

declare global {
  interface Window {
    atlasFrames: (f: FrameSpec, scale: number) => string[];
    atlasIcons: (scale: number) => Promise<Record<string, string>>;
    atlasDecor: (k: number, scale: number) => Record<string, string>;
    atlasStage: (scale: number) => Record<string, string>;
    atlasVfx: (scale: number) => Record<string, string>;
    atlasVfxInfo: () => Record<string, { w: number; h: number; frames: number; duration: number; loop: boolean; note: string }>;
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
  window.atlasDecor = decorFrames;
  window.atlasStage = stageFrames;
  window.atlasVfx = vfxFrames;
  window.atlasVfxInfo = () => Object.fromEntries(Object.entries(VFX).map(([k, d]) => [k, { w: d.w, h: d.h, frames: d.frames, duration: d.duration, loop: !!d.loop, note: d.note }]));
  previewAtlas();
  document.body.dataset.atlasReady = '1';
}

/** Aperçu visuel de la page `?atlas` (planche des décors et des VFX, à l'échelle 1). */
function previewAtlas(): void {
  const params = new URLSearchParams(location.search);
  if (params.get('atlas') !== 'preview') return;
  const root = document.getElementById('app')!;
  root.style.cssText = 'position:static;overflow:visible;max-width:none;height:auto;background:#2b1317;padding:12px;color:#efe3c6;font:12px sans-serif';
  for (const e of [document.documentElement, document.body]) e.style.cssText = 'overflow:visible;height:auto';
  const k = Number(params.get('k') ?? 0);
  const groups: [string, Record<string, string>][] = [[`Décor ${KINGDOMS[k].name}`, decorFrames(k, 2)], ['Scène', stageFrames(1)], ['VFX', vfxFrames(2)]];
  for (const [title, frames] of groups) {
    const h = document.createElement('h3');
    h.textContent = title;
    root.appendChild(h);
    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;align-items:flex-end';
    for (const [name, url] of Object.entries(frames)) {
      if (/_(0[1-9]|1\d)$/.test(name) && !/^(water|lava)_\d\d$|^(rock|hedge|far|drift)_/.test(name)) continue;
      const f = document.createElement('figure');
      f.style.cssText = 'margin:0;background:#efe3c6;padding:2px;text-align:center;color:#1b1418';
      const img = new Image();
      img.src = url;
      img.style.maxWidth = '200px';
      img.onload = () => (img.style.width = Math.min(200, img.naturalWidth / (title === 'Scène' ? 1 : 2)) + 'px');
      f.appendChild(img);
      const cap = document.createElement('figcaption');
      cap.textContent = name;
      f.appendChild(cap);
      wrap.appendChild(f);
    }
    root.appendChild(wrap);
  }
}
