/** Carte saga (§12.1) : chemin sinueux à travers les 5 royaumes, 300 nœuds. */
import { levelInfo } from '../../sim/src/formulas.js';
import { LEVEL_COUNT } from '../../sim/src/constants.js';
import { BOSS_BY_KINGDOM } from '../../sim/src/content.js';
import { KINGDOMS, INK, INK2, CUT, DANGER, GOLD_LEAF, JADE } from '../../art/src/palette.js';
import { INK_UI, iconURL } from '../../art/src/icons.js';
import { portrait } from './portraits.js';
import { save, totalStars, subscribed } from './state.js';

const MW = 400;
const STEP = 96;
const PAD_BOTTOM = 300;
const PAD_TOP = 300;
export const MAP_H = PAD_TOP + (LEVEL_COUNT - 1) * STEP + PAD_BOTTOM;

export function nodeY(n: number): number {
  return MAP_H - PAD_BOTTOM - (n - 1) * STEP;
}
export function nodeX(n: number): number {
  return MW / 2 + Math.sin(n * 0.55) * 112 + Math.sin(n * 0.17 + 1) * 18;
}

function rnd(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

/** Silhouettes de décor, découpées dans l'encre (plus pâles au loin). */
function decoration(k: number, x: number, y: number, s: number, i: number): string {
  const th = KINGDOMS[k];
  const far = rnd(i * 7) < 0.4;
  const fill = far ? th.far : INK;
  const cut = th.light;
  const g = (body: string) => `<g transform="translate(${x.toFixed(0)} ${y.toFixed(0)}) scale(${(far ? s * 0.75 : s).toFixed(2)})" fill="${fill}">${body}</g>`;
  switch (th.moteKind) {
    case 'firefly':
      return rnd(i) < 0.7
        ? g(`<path d="M0 -50 L9 -34 H5 L15 -18 H8 L19 0 H-19 L-8 -18 H-15 L-5 -34 H-9 Z"/><rect x="-3" y="0" width="6" height="9"/>`)
        : g(`<path d="M-3 8 V-6 H3 V8 Z M-13 -6 C-13 -20 13 -20 13 -6 Z"/><circle cx="-4" cy="-12" r="2" fill="${cut}"/><circle cx="5" cy="-10" r="1.6" fill="${cut}"/>`);
    case 'spore':
      return rnd(i) < 0.5
        ? g(`<path d="M2 6 C0 -10 4 -24 -2 -40 M6 6 C6 -8 10 -16 8 -30 M-4 6 C-6 -6 -10 -14 -12 -22" stroke="${fill}" stroke-width="3" fill="none" stroke-linecap="round"/><ellipse cx="-2" cy="-42" rx="3" ry="7"/><ellipse cx="8" cy="-32" rx="2.5" ry="6"/>`)
        : g(`<path d="M0 6 C-2 -10 2 -22 -6 -38 M-1 -18 C6 -24 10 -22 16 -30 M-3 -27 C-10 -30 -12 -34 -18 -36" stroke="${fill}" stroke-width="4" fill="none" stroke-linecap="round"/>`);
    case 'sand':
      return rnd(i) < 0.55
        ? g(`<path d="M-4 6 V-34 C-4 -41 4 -41 4 -34 V6 Z M-4 -14 H-12 V-26 C-12 -29 -8 -29 -8 -26 V-18 H-4 Z M4 -8 H12 V-22 C12 -25 8 -25 8 -22 V-12 H4 Z"/>`)
        : g(`<rect x="-8" y="-34" width="16" height="40"/><rect x="-12" y="-41" width="24" height="7"/><path d="M-8 -16 L8 -22 V-18 L-8 -12 Z" fill="${cut}"/>`);
    case 'snow':
      return rnd(i) < 0.55
        ? g(`<path d="M-32 6 L-4 -42 L24 6 Z"/><path d="M-4 -42 L-12 -28 L-6 -30 L-1 -24 L5 -30 Z" fill="${cut}"/>`)
        : g(`<path d="M0 -44 L11 -26 H5 L15 -10 H7 L18 6 H-18 L-7 -10 H-15 L-5 -26 H-11 Z"/>`);
    case 'ember':
      return rnd(i) < 0.5
        ? g(`<path d="M-36 6 L-11 -30 H11 L36 6 Z"/><path d="M-11 -30 Q0 -20 11 -30 L7 -22 H-7 Z" fill="${cut}"/>`)
        : g(`<path d="M-10 6 L-4 -32 L2 -8 L8 -24 L12 6 Z"/>`);
  }
}

function pathD(ns: number[]): string {
  const pts = ns.map((n) => [nodeX(n), nodeY(n)]);
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(1)} ${c1y.toFixed(1)} ${c2x.toFixed(1)} ${c2y.toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return d;
}

export function buildMap(onSelect: (n: number) => void): HTMLElement {
  const s = save();
  const current = Math.min(LEVEL_COUNT, s.unlocked);
  const wrap = document.createElement('div');
  wrap.className = 'map-scroll';

  // dégradé de ciel continu à travers les royaumes
  const stops: string[] = [];
  for (let k = 0; k < 5; k++) {
    const yTop = nodeY(60 * (k + 1)) - STEP / 2;
    const yBot = nodeY(60 * k + 1) + STEP / 2;
    const th = KINGDOMS[k];
    stops.push(`<stop offset="${(Math.max(0, yTop) / MAP_H).toFixed(4)}" stop-color="${th.sky[0]}"/>`);
    stops.push(`<stop offset="${(Math.min(MAP_H, yBot) / MAP_H).toFixed(4)}" stop-color="${th.sky[1]}"/>`);
  }
  stops.reverse();

  const all = Array.from({ length: LEVEL_COUNT }, (_, i) => i + 1);
  let deco = '';
  let motes = '';
  let banners = '';
  for (const n of all) {
    const info = levelInfo(n);
    const k = info.kingdom - 1;
    const x = nodeX(n);
    const y = nodeY(n);
    for (let j = 0; j < 2; j++) {
      const side = (rnd(n * 3 + j) < 0.5 ? -1 : 1) * (x > MW / 2 ? (j === 0 ? -1 : 1) : j === 0 ? 1 : -1);
      const dx = side * (80 + rnd(n * 7 + j) * 70);
      const xx = Math.min(MW - 24, Math.max(24, x + dx));
      if (Math.abs(xx - x) < 60) continue;
      deco += decoration(k, xx, y + (rnd(n * 11 + j) - 0.5) * 60, 0.7 + rnd(n * 5 + j) * 0.6, n * 2 + j);
    }
    if (rnd(n * 13) < 0.5) {
      const th = KINGDOMS[k];
      motes += `<circle class="mote m${n % 4}" cx="${(rnd(n * 17) * MW).toFixed(0)}" cy="${(y + rnd(n * 19) * STEP).toFixed(0)}" r="${(1 + rnd(n) * 1.4).toFixed(1)}" fill="${th.far}"/>`;
    }
    if (info.position === 1) {
      const first = (info.chapter - 1) % 3 === 0;
      const th = KINGDOMS[k];
      const by = y + 58;
      banners += first
        ? `<g class="kbanner" transform="translate(${MW / 2} ${by + 26})"><path d="M-158 -18 L-146 -26 H146 L158 -18 L146 -10 L158 0 L146 10 L158 18 L146 26 H-146 L-158 18 L-146 10 L-158 0 L-146 -10 Z" fill="${INK}" transform="translate(4 4)"/><path d="M-158 -18 L-146 -26 H146 L158 -18 L146 -10 L158 0 L146 10 L158 18 L146 26 H-146 L-158 18 L-146 10 L-158 0 L-146 -10 Z" fill="${th.light}" stroke="${INK}" stroke-width="2.5"/><text y="2" text-anchor="middle" class="kname">${th.name}</text><text y="18" text-anchor="middle" class="ksub">Royaume ${['I', 'II', 'III', 'IV', 'V'][info.kingdom - 1]} · chapitres ${info.chapter} à ${info.chapter + 2}</text></g>`
        : `<g transform="translate(${MW / 2} ${by})"><rect x="-54" y="-11" width="108" height="22" fill="${INK}"/><text y="5" text-anchor="middle" class="csub">Chapitre ${info.chapter}</text></g>`;
    }
  }

  const done = all.filter((n) => n < current);
  let nodes = '';
  for (const n of all) {
    const info = levelInfo(n);
    const x = nodeX(n);
    const y = nodeY(n);
    const th = KINGDOMS[info.kingdom - 1];
    const locked = n > current;
    const st = s.stars[n] ?? 0;
    const isBoss = info.kind === 'boss';
    const r = isBoss ? 30 : 21;
    let g = `<g class="node${locked ? ' locked' : ''}${n === current ? ' current' : ''}${isBoss ? ' boss' : ''}" data-n="${n}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})">`;
    if (n === current) g += `<circle class="halo" r="${r + 7}" fill="none" stroke="${DANGER}" stroke-width="2.5" stroke-dasharray="4 4"/>`;
    if (isBoss) {
      const arch = BOSS_BY_KINGDOM[info.kingdom - 1];
      g += `<circle r="${r + 3}" cx="3" cy="3" fill="${INK}"/>`;
      g += `<circle r="${r + 3}" fill="${locked ? INK : DANGER}" stroke="${INK}" stroke-width="3"/>`;
      g += `<circle r="${r - 3}" fill="${locked ? INK2 : th.light}"/>`;
      g += `<image href="${portrait(arch, 72, { scale: 0.62, dy: 10, variant: (info.chapter - 1) % 3 })}" x="${-r}" y="${-r}" width="${r * 2}" height="${r * 2}" clip-path="circle(${r - 4}px)" ${locked ? 'opacity=".3"' : ''}/>`;
      g += `<image href="${iconURL(INK_UI.crown)}" x="-12" y="${-r - 17}" width="24" height="24"/>`;
    } else {
      const cur = n === current;
      g += `<circle r="${r}" cx="3" cy="3" fill="${INK}"/>`;
      g += `<circle r="${r}" fill="${locked ? INK : cur ? DANGER : th.light}" stroke="${INK}" stroke-width="3"/>`;
      if (!locked) g += `<circle r="${r - 5}" fill="none" stroke="${cur ? CUT : INK}" stroke-width="1" opacity=".6"/>`;
      g += `<text y="7" text-anchor="middle" class="nnum${locked ? ' dim' : cur ? ' cur' : ''}">${n}</text>`;
      if (info.kind === 'hard') g += `<image href="${iconURL(INK_UI.skull)}" x="${r - 12}" y="${-r - 8}" width="22" height="22"/>`;
    }
    if (!locked && n < current) {
      for (let i = 0; i < 3; i++) {
        const sx = (i - 1) * 14;
        const sy = r + 9 - (i === 1 ? 3 : 0);
        g += `<image href="${iconURL(i < st ? INK_UI.star : INK_UI.starEmpty)}" x="${sx - 8}" y="${sy - 8}" width="16" height="16"/>`;
      }
    }
    g += `</g>`;
    nodes += g;
  }

  const hx = nodeX(current);
  const hy = nodeY(current) - (levelInfo(current).kind === 'boss' ? 70 : 58);
  // la marionnette de l'héroïne, tenue par sa baguette
  const avatar = `<g class="avatar" transform="translate(${hx.toFixed(1)} ${hy.toFixed(1)})"><g class="bob"><line x1="0" y1="8" x2="0" y2="40" stroke="${INK}" stroke-width="2"/><image href="${portrait('hero', 64, { scale: 1.5, dy: 8 })}" x="-30" y="-36" width="60" height="60"/></g></g>`;

  const svg = `<svg class="map-svg" viewBox="0 0 ${MW} ${MAP_H}" preserveAspectRatio="xMidYMin meet" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${stops.join('')}</linearGradient>
    <pattern id="fibre" width="60" height="60" patternUnits="userSpaceOnUse"><path d="M4 10 l9 2 M30 4 l6 7 M44 30 l10 -3 M12 44 l7 5 M36 52 l8 1" stroke="${INK}" stroke-opacity=".07" stroke-width="1"/></pattern></defs>
    <rect width="${MW}" height="${MAP_H}" fill="url(#sky)"/>
    <rect width="${MW}" height="${MAP_H}" fill="url(#fibre)"/>
    <g transform="translate(${MW / 2} 130)"><circle r="42" fill="${INK}"/><circle r="38" fill="${CUT}"/><circle cx="15" cy="-9" r="34" fill="${INK}"/></g>
    <text x="${MW / 2}" y="222" text-anchor="middle" class="kname">Le Trône de la Lune</text>
    ${deco}
    <path d="${pathD(all)}" fill="none" stroke="${INK}" stroke-opacity=".12" stroke-width="22" stroke-linecap="round"/>
    <path d="${pathD(all)}" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="9 7"/>
    ${done.length > 1 ? `<path class="trail" d="${pathD([...done, current])}" fill="none" stroke="${DANGER}" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="9 7"/>` : ''}
    <g transform="translate(${nodeX(1) - 120} ${nodeY(1) + 150})" fill="${INK}"><path d="M-34 12 L-10 -30 L14 12 Z"/><path d="M-10 -22 L-4 12 H-16 Z" fill="${KINGDOMS[0].light}"/><g transform="translate(30 8)"><path d="M-12 6 L12 -2 M-12 -2 L12 6" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path class="flame" d="M-7 2 C-8 -8 -2 -10 0 -20 C3 -12 9 -8 7 2 Z"/><path class="flame f2" d="M-3 2 C-4 -4 0 -6 1 -12 C3 -7 5 -4 4 2 Z" fill="${KINGDOMS[0].light}"/></g></g>
    ${banners}
    ${motes}
    ${nodes}
    ${avatar}
  </svg>`;
  wrap.innerHTML = svg;
  wrap.addEventListener('click', (e) => {
    const g = (e.target as Element).closest('.node') as SVGGElement | null;
    if (!g || g.classList.contains('locked')) return;
    onSelect(Number(g.dataset.n));
  });
  requestAnimationFrame(() => {
    const svgEl = wrap.querySelector('svg')!;
    const k = svgEl.getBoundingClientRect().width / MW;
    wrap.scrollTop = nodeY(current) * k - wrap.clientHeight * 0.62;
  });
  return wrap;
}

export function topBar(): HTMLElement {
  const s = save();
  const el = document.createElement('div');
  el.className = 'topbar';
  el.innerHTML = `
    <button class="chip lives${subscribed() ? ' dragon' : ''}" aria-label="Vies"><img src="${iconURL(INK_UI.heart)}" alt=""/><b>${subscribed() ? '∞' : s.lives.lives}</b><small class="timer"></small></button>
    <div class="chip"><img src="${iconURL(INK_UI.star)}" alt=""/><b>${totalStars()}</b></div>
    <div class="chip"><img src="${iconURL(INK_UI.coin)}" alt=""/><b>${s.gold}</b></div>
    <button class="chip gems" aria-label="Gemmes, boutique"><img src="${iconURL(INK_UI.gem)}" alt=""/><b>${s.gems}</b><span class="plus">+</span></button>`;
  return el;
}
