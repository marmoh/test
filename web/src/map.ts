/** Carte saga (§12.1) : chemin sinueux à travers les 5 royaumes, 300 nœuds. */
import { levelInfo } from '../../sim/src/formulas.js';
import { LEVEL_COUNT } from '../../sim/src/constants.js';
import { BOSS_BY_KINGDOM } from '../../sim/src/content.js';
import { KINGDOMS, UI } from '../../art/src/palette.js';
import { UI_ICONS, iconURL } from '../../art/src/icons.js';
import { portrait } from './portraits.js';
import { save, totalStars } from './state.js';

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

function decoration(k: number, x: number, y: number, s: number, i: number): string {
  const th = KINGDOMS[k];
  const dark = th.hedge;
  const light = th.hedgeLight;
  switch (th.moteKind) {
    case 'firefly':
      return rnd(i) < 0.65
        ? `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="6" rx="18" ry="5" fill="rgba(0,0,0,.25)"/><path d="M0 -46 L16 -14 H8 L20 4 H-20 L-8 -14 H-16 Z" fill="${dark}" stroke="#140d24" stroke-width="2.5" stroke-linejoin="round"/><path d="M0 -46 L8 -30 L-4 -26 Z" fill="${light}" opacity=".6"/><rect x="-3" y="4" width="6" height="6" fill="#4a2f1e"/></g>`
        : `<g transform="translate(${x} ${y}) scale(${s * 0.8})"><rect x="-3" y="-8" width="6" height="12" rx="2" fill="#f1e4c8" stroke="#140d24" stroke-width="2"/><path d="M-12 -6 C-12 -20 12 -20 12 -6 Z" fill="#d93a3a" stroke="#140d24" stroke-width="2"/><circle cx="-4" cy="-12" r="2" fill="#fff"/><circle cx="4" cy="-10" r="1.6" fill="#fff"/></g>`;
    case 'spore':
      return rnd(i) < 0.5
        ? `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="0" rx="22" ry="8" fill="${th.liquid}" stroke="#140d24" stroke-width="2"/><ellipse cx="-6" cy="-1" rx="7" ry="3" fill="${light}"/><path d="M10 0 V-26 M14 0 V-20 M6 0 V-18" stroke="${dark}" stroke-width="3" stroke-linecap="round"/><ellipse cx="10" cy="-27" rx="2.5" ry="5" fill="#6b4a2a"/></g>`
        : `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 4 C-2 -14 2 -24 -6 -38 M-1 -20 C6 -26 10 -24 14 -30 M-3 -28 C-10 -30 -12 -34 -16 -36" stroke="#3a3326" stroke-width="4" fill="none" stroke-linecap="round"/></g>`;
    case 'sand':
      return rnd(i) < 0.55
        ? `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="2" rx="34" ry="10" fill="${th.groundDetail}" opacity=".8"/><path d="M-4 0 V-34 C-4 -40 4 -40 4 -34 V0 Z M-4 -18 H-12 V-26 M4 -12 H12 V-22" fill="${th.hedge}" stroke="#140d24" stroke-width="2.5" stroke-linejoin="round"/></g>`
        : `<g transform="translate(${x} ${y}) scale(${s})"><rect x="-8" y="-34" width="16" height="36" fill="${th.rockLight}" stroke="#140d24" stroke-width="2.5"/><rect x="-12" y="-40" width="24" height="7" fill="${th.rock}" stroke="#140d24" stroke-width="2.5"/><path d="M-8 -14 L8 -20" stroke="${th.rockDark}" stroke-width="2"/></g>`;
    case 'snow':
      return rnd(i) < 0.6
        ? `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-30 6 L-4 -40 L24 6 Z" fill="${th.rock}" stroke="#140d24" stroke-width="2.5" stroke-linejoin="round"/><path d="M-4 -40 L-14 -22 L-6 -26 L0 -20 L8 -26 Z" fill="#f4fbff"/></g>`
        : `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 -40 L14 -12 H6 L16 4 H-16 L-6 -12 H-14 Z" fill="${dark}" stroke="#140d24" stroke-width="2.5" stroke-linejoin="round"/><path d="M0 -40 L8 -24 H-8 Z M-6 -12 H6 L10 -6 H-10 Z" fill="#f4fbff"/></g>`;
    case 'ember':
      return rnd(i) < 0.5
        ? `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-34 6 L-10 -30 H10 L34 6 Z" fill="${th.rock}" stroke="#140d24" stroke-width="2.5" stroke-linejoin="round"/><path d="M-10 -30 C-4 -24 4 -24 10 -30 L6 -18 L-6 -18 Z" fill="#ff7a3d"/><circle cx="0" cy="-36" r="10" fill="#ff7a3d" opacity=".35" class="pulse"/></g>`
        : `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-10 4 L-4 -30 L2 -6 L8 -22 L12 4 Z" fill="#221a1c" stroke="#140d24" stroke-width="2.5" stroke-linejoin="round"/><path d="M-4 -30 L-2 -14" stroke="#ff7a3d" stroke-width="1.5"/></g>`;
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
      motes += `<circle class="mote m${n % 4}" cx="${(rnd(n * 17) * MW).toFixed(0)}" cy="${(y + rnd(n * 19) * STEP).toFixed(0)}" r="${(1.2 + rnd(n) * 1.8).toFixed(1)}" fill="${th.mote}"/>`;
    }
    if (info.position === 1) {
      const first = (info.chapter - 1) % 3 === 0;
      const th = KINGDOMS[k];
      const by = y + 58;
      banners += first
        ? `<g class="kbanner" transform="translate(${MW / 2} ${by + 26})"><path d="M-150 -22 H150 L136 0 L150 22 H-150 L-136 0 Z" fill="${th.wall}" stroke="${th.accent}" stroke-width="2"/><text y="-2" text-anchor="middle" class="kname">${th.name}</text><text y="15" text-anchor="middle" class="ksub">Royaume ${info.kingdom} · Chapitres ${info.chapter}–${info.chapter + 2}</text></g>`
        : `<g transform="translate(${MW / 2} ${by})"><rect x="-58" y="-11" width="116" height="22" rx="11" fill="rgba(10,6,20,.55)"/><text y="5" text-anchor="middle" class="csub">Chapitre ${info.chapter}</text></g>`;
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
    g += `<ellipse cx="0" cy="${r * 0.55}" rx="${r * 1.05}" ry="${r * 0.45}" fill="rgba(5,3,15,.45)"/>`;
    if (n === current) g += `<circle class="halo" r="${r + 8}" fill="none" stroke="${UI.moon}" stroke-width="3"/>`;
    if (isBoss) {
      const arch = BOSS_BY_KINGDOM[info.kingdom - 1];
      g += `<circle r="${r + 3}" fill="${locked ? '#2a2440' : '#ff4d5e'}" stroke="#140d24" stroke-width="3"/>`;
      g += `<circle r="${r - 2}" fill="${locked ? '#1a1530' : th.wall}"/>`;
      g += `<image href="${portrait(arch, 72, { scale: 0.62, dy: 10, variant: (info.chapter - 1) % 3 })}" x="${-r}" y="${-r}" width="${r * 2}" height="${r * 2}" clip-path="circle(${r - 3}px)" ${locked ? 'opacity=".35"' : ''}/>`;
      g += `<image href="${iconURL(UI_ICONS.crown)}" x="-13" y="${-r - 18}" width="26" height="26"/>`;
    } else {
      const fill = locked ? '#3a3550' : info.kind === 'hard' ? '#7a2a3a' : th.accent;
      g += `<circle r="${r}" fill="${fill}" stroke="#140d24" stroke-width="3"/>`;
      g += `<circle r="${r - 5}" fill="${locked ? '#2a2540' : 'rgba(255,255,255,.18)'}"/>`;
      g += `<ellipse cx="-6" cy="-9" rx="7" ry="4" fill="rgba(255,255,255,.35)"/>`;
      g += `<text y="6" text-anchor="middle" class="nnum${locked ? ' dim' : ''}">${n}</text>`;
      if (info.kind === 'hard') g += `<image href="${iconURL(UI_ICONS.skull)}" x="${r - 14}" y="${-r - 6}" width="22" height="22"/>`;
    }
    if (!locked && n < current) {
      for (let i = 0; i < 3; i++) {
        const sx = (i - 1) * 15;
        const sy = r + 8 - (i === 1 ? 4 : 0);
        g += `<image href="${iconURL(i < st ? UI_ICONS.star : UI_ICONS.starEmpty)}" x="${sx - 8}" y="${sy - 8}" width="16" height="16"/>`;
      }
    }
    g += `</g>`;
    nodes += g;
  }

  const hx = nodeX(current);
  const hy = nodeY(current) - (levelInfo(current).kind === 'boss' ? 70 : 58);
  const avatar = `<g class="avatar" transform="translate(${hx.toFixed(1)} ${hy.toFixed(1)})"><g class="bob"><circle r="22" fill="${UI.moon}" stroke="#140d24" stroke-width="3"/><image href="${portrait('hero', 64, { scale: 1.35, dy: 10 })}" x="-22" y="-22" width="44" height="44" clip-path="circle(20px)"/><path d="M-7 21 L0 32 L7 21 Z" fill="${UI.moon}" stroke="#140d24" stroke-width="3" stroke-linejoin="round"/></g></g>`;

  const svg = `<svg class="map-svg" viewBox="0 0 ${MW} ${MAP_H}" preserveAspectRatio="xMidYMin meet" xmlns="http://www.w3.org/2000/svg">
    <defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${stops.join('')}</linearGradient></defs>
    <rect width="${MW}" height="${MAP_H}" fill="url(#sky)"/>
    <g class="moon" transform="translate(${MW / 2} 130)"><circle r="90" fill="${UI.moonGlow}" opacity=".12"/><circle r="58" fill="${UI.moonGlow}" opacity=".18"/><circle r="40" fill="${UI.moon}"/><circle cx="14" cy="-8" r="36" fill="${KINGDOMS[4].sky[0]}"/></g>
    <text x="${MW / 2}" y="250" text-anchor="middle" class="kname">Le Trône de la Lune</text>
    ${deco}
    <path d="${pathD(all)}" fill="none" stroke="#140d24" stroke-width="24" stroke-linecap="round" opacity=".55"/>
    <path d="${pathD(all)}" fill="none" stroke="#e9dcc0" stroke-width="12" stroke-linecap="round" stroke-dasharray="2 16" opacity=".55"/>
    ${done.length > 1 ? `<path class="trail" d="${pathD([...done, current])}" fill="none" stroke="${UI.gold}" stroke-width="6" stroke-linecap="round" stroke-dasharray="1 13"/>` : ''}
    <g class="camp" transform="translate(${nodeX(1) - 120} ${nodeY(1) + 150})"><ellipse rx="46" ry="12" cy="14" fill="rgba(5,3,15,.35)"/><path d="M-34 12 L-10 -30 L14 12 Z" fill="#c9844a" stroke="#140d24" stroke-width="3" stroke-linejoin="round"/><path d="M-10 -30 L-10 12 L-2 12 Z" fill="#8a5a2b"/><g transform="translate(30 8)"><path d="M-12 6 L12 -2 M-12 -2 L12 6" stroke="#6b4226" stroke-width="5" stroke-linecap="round"/><circle r="22" fill="#ffb347" opacity=".25" class="pulse"/><path class="flame" d="M-7 2 C-8 -8 -2 -10 0 -20 C3 -12 9 -8 7 2 Z" fill="#ffb347" stroke="#140d24" stroke-width="2"/><path class="flame f2" d="M-3 2 C-4 -4 0 -6 1 -12 C3 -7 5 -4 4 2 Z" fill="#fff3c2"/></g></g>
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
    <div class="chip lives"><img src="${iconURL(UI_ICONS.heart)}" alt=""/><b>${s.lives.lives}</b><small class="timer"></small></div>
    <div class="chip"><img src="${iconURL(UI_ICONS.star)}" alt=""/><b>${totalStars()}</b></div>
    <div class="chip"><img src="${iconURL(UI_ICONS.coin)}" alt=""/><b>${s.gold}</b></div>
    <div class="chip gems"><img src="${iconURL(UI_ICONS.gem)}" alt=""/><b>${s.gems}</b><span class="plus">+</span></div>`;
  return el;
}
