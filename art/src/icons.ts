/** Icônes SVG (viewBox 64×64) : 24 pouvoirs + interface. Exportées telles quelles vers art/icons/. */

const S = (body: string, vb = 64) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb} ${vb}">${body}</svg>`;
const ink = '#140d24';
const st = `stroke="${ink}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;

const arrow = (x1: number, y1: number, x2: number, y2: number, c = '#f4ecd8') => {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const hx = (k: number) => (x2 - Math.cos(a + k) * 10).toFixed(1);
  const hy = (k: number) => (y2 - Math.sin(a + k) * 10).toFixed(1);
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ink}" stroke-width="7" stroke-linecap="round"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/><path d="M${x2} ${y2} L${hx(0.5)} ${hy(0.5)} L${hx(-0.5)} ${hy(-0.5)} Z" fill="${c}" ${st}/>`;
};

export const POWER_ICONS: Record<string, string> = {
  // famille Fil (Ciseaux de lune)
  longThread: S(`<rect x="20" y="8" width="24" height="10" rx="3" fill="#a86a44" ${st}/><rect x="20" y="46" width="24" height="10" rx="3" fill="#a86a44" ${st}/><rect x="24" y="18" width="16" height="28" fill="#f4ecd8" ${st}/><path d="M24 24 H40 M24 30 H40 M24 36 H40 M24 42 H40" stroke="${ink}" stroke-width="2"/><path d="M40 40 C52 44 58 52 56 60" fill="none" stroke="${ink}" stroke-width="3" stroke-dasharray="5 3" stroke-linecap="round"/>`),
  sharpScissors: S(`<circle cx="16" cy="48" r="9" fill="none" ${st}/><circle cx="16" cy="48" r="9" fill="none" stroke="${ink}" stroke-width="5"/><circle cx="46" cy="50" r="9" fill="none" stroke="${ink}" stroke-width="5"/><path d="M22 41 L54 6 L30 44 Z" fill="#dfe8f0" ${st}/><path d="M40 43 L12 8 L34 46 Z" fill="#dfe8f0" ${st}/><circle cx="32" cy="36" r="3" fill="${ink}"/>`),
  steelThread: S(`<path d="M6 40 C18 20 30 52 42 30 C48 20 54 22 58 26" fill="none" stroke="${ink}" stroke-width="7" stroke-linecap="round"/><path d="M6 40 C18 20 30 52 42 30 C48 20 54 22 58 26" fill="none" stroke="#dfe8f0" stroke-width="3" stroke-linecap="round"/><path d="M30 6 L40 12 V24 C40 30 35 34 30 36 C25 34 20 30 20 24 V12 Z" fill="#5f8aff" ${st}/>`),
  barbedThread: S(`<path d="M4 34 C16 22 28 46 40 30 C48 20 54 24 60 28" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round"/><path d="M14 26 L10 18 M14 26 L22 20 M30 40 L26 48 M30 40 L38 46 M46 24 L44 14 M46 24 L54 18" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`),
  confetti: S(`<path d="M10 14 L22 10 L20 22 Z" fill="#f4ecd8" ${st}/><path d="M40 8 L52 14 L42 22 Z" fill="${ink}" ${st}/><path d="M26 30 L38 28 L36 40 L24 42 Z" fill="#f4ecd8" ${st}/><path d="M8 44 L18 40 L20 52 Z" fill="${ink}" ${st}/><path d="M46 38 L56 44 L48 56 L40 48 Z" fill="#f4ecd8" ${st}/>`),
  echoCut: S(`<path d="M32 10 C46 10 54 20 54 32 C54 44 44 54 32 54 C20 54 10 44 10 32" fill="none" stroke="${ink}" stroke-width="4" stroke-dasharray="6 4" stroke-linecap="round"/><path d="M32 20 C40 20 44 26 44 32 C44 40 38 44 32 44 C26 44 20 40 20 32" fill="none" stroke="${ink}" stroke-width="4" stroke-linecap="round"/><path d="M10 32 L4 24 M10 32 L18 26" stroke="${ink}" stroke-width="4" stroke-linecap="round"/>`),
  multishot: S(arrow(10, 44, 50, 14) + arrow(14, 54, 54, 24) + arrow(6, 34, 46, 4, '#ffe9a8')),
  rearShot: S(arrow(32, 32, 56, 32) + arrow(32, 32, 8, 32, '#ffe9a8') + `<circle cx="32" cy="32" r="6" fill="#3fc4b0" ${st}/>`),
  diagonals: S(arrow(32, 40, 54, 12) + arrow(32, 40, 10, 12) + arrow(32, 40, 32, 6, '#ffe9a8')),
  sideShots: S(arrow(32, 32, 32, 6, '#ffe9a8') + arrow(32, 32, 58, 32) + arrow(32, 32, 6, 32)),
  ricochet: S(`<path d="M8 52 L28 20 L44 44 L58 10" fill="none" stroke="${ink}" stroke-width="7" stroke-linejoin="round"/><path d="M8 52 L28 20 L44 44 L58 10" fill="none" stroke="#9fe8c9" stroke-width="3.5" stroke-dasharray="6 4"/><circle cx="28" cy="20" r="6" fill="#ff5f7a" ${st}/><circle cx="44" cy="44" r="6" fill="#ff5f7a" ${st}/>`),
  pierce: S(`<circle cx="30" cy="32" r="13" fill="#ff5f7a" ${st}/>` + arrow(4, 32, 60, 32, '#ffe9a8')),
  wallBounce: S(`<rect x="48" y="6" width="10" height="52" rx="3" fill="#6b7480" ${st}/><path d="M8 50 L46 32 L8 14" fill="none" stroke="${ink}" stroke-width="7" stroke-linejoin="round"/><path d="M8 50 L46 32 L8 14" fill="none" stroke="#f4ecd8" stroke-width="3.5"/>`),
  attackSpeed: S(`<path d="M30 6 L14 36 H30 L24 58 L50 26 H34 L42 6 Z" fill="#ffcf4a" ${st}/>`),
  damage: S(`<path d="M32 4 L38 22 L58 22 L42 34 L48 54 L32 42 L16 54 L22 34 L6 22 L26 22 Z" fill="#ff7a3d" ${st}/><text x="32" y="38" font-size="16" font-weight="700" text-anchor="middle" fill="#fff" font-family="Fredoka,sans-serif">+</text>`),
  crit: S(`<circle cx="32" cy="32" r="22" fill="#2a1a3d" ${st}/><circle cx="32" cy="32" r="13" fill="none" stroke="#ff4d5e" stroke-width="4"/><circle cx="32" cy="32" r="4" fill="#ffe9a8"/><path d="M32 4 V16 M32 48 V60 M4 32 H16 M48 32 H60" stroke="#ffe9a8" stroke-width="4" stroke-linecap="round"/>`),
  eliteSlayer: S(`<path d="M12 22 L20 34 L32 16 L44 34 L52 22 L48 48 H16 Z" fill="#ffcf4a" ${st}/><path d="M10 56 L54 8" stroke="${ink}" stroke-width="8" stroke-linecap="round"/><path d="M10 56 L54 8" stroke="#dfe8f0" stroke-width="4" stroke-linecap="round"/>`),
  flame: S(`<path d="M32 4 C38 18 52 24 50 40 C48 54 38 60 32 60 C22 60 12 52 14 38 C16 28 24 26 26 16 C30 22 30 26 32 30 C34 22 34 14 32 4 Z" fill="#ff7a3d" ${st}/><path d="M32 30 C38 38 42 44 38 52 C34 56 28 56 26 50 C24 44 30 40 32 30 Z" fill="#ffd36b"/>`),
  frost: S(`<g stroke="${ink}" stroke-width="8" stroke-linecap="round"><path d="M32 6 V58 M9 19 L55 45 M9 45 L55 19"/></g><g stroke="#bfe8ff" stroke-width="4" stroke-linecap="round"><path d="M32 6 V58 M9 19 L55 45 M9 45 L55 19 M26 10 L32 16 L38 10 M26 54 L32 48 L38 54"/></g>`),
  chain: S(`<path d="M36 4 L16 34 H30 L22 60 L48 26 H34 L44 4 Z" fill="#9fdcff" ${st}/><circle cx="12" cy="14" r="5" fill="#ff5f7a" ${st}/><circle cx="54" cy="50" r="5" fill="#ff5f7a" ${st}/>`),
  poison: S(`<path d="M24 6 H40 V20 L52 46 C55 54 50 60 42 60 H22 C14 60 9 54 12 46 L24 20 Z" fill="#7ad15a" ${st}/><path d="M16 44 H48" stroke="${ink}" stroke-width="3"/><circle cx="28" cy="50" r="3" fill="#e8ffd8"/><circle cx="38" cy="46" r="2" fill="#e8ffd8"/>`),
  blast: S(`<path d="M32 2 L37 20 L54 10 L44 26 L62 32 L44 38 L54 54 L37 44 L32 62 L27 44 L10 54 L20 38 L2 32 L20 26 L10 10 L27 20 Z" fill="#ffb347" ${st}/><circle cx="32" cy="32" r="9" fill="#fff3c2"/>`),
  orb: S(`<circle cx="32" cy="32" r="20" fill="none" stroke="#5fd8ff" stroke-width="3" stroke-dasharray="5 5"/><circle cx="32" cy="32" r="8" fill="#3fc4b0" ${st}/><circle cx="50" cy="20" r="9" fill="#5fd8ff" ${st}/><circle cx="47" cy="17" r="3" fill="#fff"/>`),
  shield: S(`<path d="M32 4 L54 12 V30 C54 44 44 54 32 60 C20 54 10 44 10 30 V12 Z" fill="#5f8aff" ${st}/><path d="M32 12 L46 17 V30 C46 40 40 47 32 51 Z" fill="#9fb8ff"/>`),
  lifesteal: S(`<path d="M32 56 C10 42 6 30 10 20 C14 10 26 10 32 20 C38 10 50 10 54 20 C58 30 54 42 32 56 Z" fill="#ff5f7a" ${st}/><path d="M32 18 V40 M26 34 L32 40 L38 34" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`),
  maxHp: S(`<path d="M32 56 C10 42 6 30 10 20 C14 10 26 10 32 20 C38 10 50 10 54 20 C58 30 54 42 32 56 Z" fill="#ff5f7a" ${st}/><path d="M32 22 V42 M22 32 H42" stroke="#fff" stroke-width="5" stroke-linecap="round"/>`),
  speed: S(`<path d="M18 46 C18 30 28 20 44 18 L40 10 L58 22 L44 34 L44 26 C34 28 28 34 28 46 Z" fill="#9fe8c9" ${st}/><path d="M6 30 H16 M4 40 H14 M8 50 H18" stroke="#9fe8c9" stroke-width="4" stroke-linecap="round"/>`),
  dodge: S(`<circle cx="22" cy="32" r="12" fill="#3fc4b0" opacity="0.35"/><circle cx="40" cy="32" r="12" fill="#3fc4b0" ${st}/><path d="M4 18 L56 18" stroke="#ff5f7a" stroke-width="4" stroke-dasharray="6 4" stroke-linecap="round"/>`),
  flashStep: S(`<path d="M10 52 L26 52" stroke="#ffe9a8" stroke-width="5" stroke-linecap="round"/><circle cx="40" cy="32" r="16" fill="#ffe9a8" opacity="0.4"/><path d="M38 12 L28 34 H38 L32 54 L50 28 H40 L46 12 Z" fill="#ffffff" ${st}/>`),
  magnet: S(`<path d="M14 10 H26 V34 C26 38 29 40 32 40 C35 40 38 38 38 34 V10 H50 V34 C50 46 42 54 32 54 C22 54 14 46 14 34 Z" fill="#ff5f7a" ${st}/><rect x="14" y="10" width="12" height="8" fill="#dfe8f0" ${st}/><rect x="38" y="10" width="12" height="8" fill="#dfe8f0" ${st}/>`),
};

export const UI_ICONS = {
  heart: S(`<path d="M32 58 C8 42 4 28 8 18 C12 8 26 6 32 18 C38 6 52 8 56 18 C60 28 56 42 32 58 Z" fill="#ff5f7a" ${st}/><ellipse cx="20" cy="22" rx="6" ry="4" fill="#fff" opacity="0.5"/>`),
  gem: S(`<path d="M16 8 H48 L60 24 L32 58 L4 24 Z" fill="#5fd8ff" ${st}/><path d="M4 24 H60 M16 8 L24 24 L32 58 L40 24 L48 8" fill="none" stroke="${ink}" stroke-width="2.5"/><path d="M18 12 L24 22 H10 Z" fill="#fff" opacity="0.6"/>`),
  coin: S(`<circle cx="32" cy="32" r="26" fill="#ffcf4a" ${st}/><circle cx="32" cy="32" r="18" fill="none" stroke="#c48a1a" stroke-width="3"/><path d="M28 22 C34 18 40 24 32 30 C24 36 30 44 36 40" fill="none" stroke="#c48a1a" stroke-width="4" stroke-linecap="round"/>`),
  star: S(`<path d="M32 4 L40 22 L60 24 L45 37 L49 58 L32 47 L15 58 L19 37 L4 24 L24 22 Z" fill="#ffcf4a" ${st}/><path d="M24 22 L32 4 L34 24 Z" fill="#fff3c2" opacity="0.8"/>`),
  starEmpty: S(`<path d="M32 4 L40 22 L60 24 L45 37 L49 58 L32 47 L15 58 L19 37 L4 24 L24 22 Z" fill="#2a2148" ${st}/>`),
  skull: S(`<path d="M32 6 C18 6 10 16 10 28 C10 36 14 40 18 42 V52 H46 V42 C50 40 54 36 54 28 C54 16 46 6 32 6 Z" fill="#f2eee0" ${st}/><circle cx="23" cy="29" r="6" fill="${ink}"/><circle cx="41" cy="29" r="6" fill="${ink}"/><path d="M28 52 V46 M36 52 V46" stroke="${ink}" stroke-width="3"/>`),
  crown: S(`<path d="M8 20 L20 34 L32 12 L44 34 L56 20 L52 50 H12 Z" fill="#ffcf4a" ${st}/><circle cx="32" cy="38" r="4" fill="#ff5fa8" ${st}/>`),
  pause: S(`<rect x="16" y="12" width="10" height="40" rx="3" fill="#f4ecd8" ${st}/><rect x="38" y="12" width="10" height="40" rx="3" fill="#f4ecd8" ${st}/>`),
  potion: S(`<path d="M26 6 H38 V18 C48 22 54 30 54 40 C54 52 44 60 32 60 C20 60 10 52 10 40 C10 30 16 22 26 18 Z" fill="#ff5f7a" ${st}/><rect x="24" y="4" width="16" height="6" rx="2" fill="#a86a44" ${st}/><ellipse cx="22" cy="38" rx="4" ry="7" fill="#fff" opacity="0.45"/>`),
  scroll: S(`<rect x="12" y="10" width="40" height="44" rx="4" fill="#f1e4c8" ${st}/><rect x="6" y="6" width="52" height="10" rx="5" fill="#c9a26a" ${st}/><rect x="6" y="48" width="52" height="10" rx="5" fill="#c9a26a" ${st}/><path d="M20 26 H44 M20 34 H40 M20 42 H36" stroke="#8a6a44" stroke-width="3" stroke-linecap="round"/>`),
  aegis: S(`<path d="M32 4 L54 12 V30 C54 44 44 54 32 60 C20 54 10 44 10 30 V12 Z" fill="#ffcf4a" ${st}/><path d="M32 14 V48 M18 26 H46" stroke="#c48a1a" stroke-width="5" stroke-linecap="round"/>`),
  trophy: S(`<path d="M18 8 H46 V24 C46 34 40 40 32 40 C24 40 18 34 18 24 Z" fill="#ffcf4a" ${st}/><path d="M18 14 H8 C8 24 12 28 18 28 M46 14 H56 C56 24 52 28 46 28" fill="none" ${st}/><rect x="26" y="40" width="12" height="8" fill="#c48a1a" ${st}/><rect x="18" y="48" width="28" height="8" rx="2" fill="#a86a44" ${st}/>`),
  lock: S(`<rect x="14" y="28" width="36" height="28" rx="5" fill="#6b7480" ${st}/><path d="M22 28 V20 C22 12 42 12 42 20 V28" fill="none" stroke="${ink}" stroke-width="5"/><circle cx="32" cy="42" r="4" fill="${ink}"/>`),
  chest: S(`<rect x="8" y="24" width="48" height="32" rx="4" fill="#a86a44" ${st}/><path d="M8 28 C8 14 56 14 56 28" fill="#c9844a" ${st}/><rect x="28" y="30" width="8" height="10" rx="2" fill="#ffcf4a" ${st}/><path d="M8 34 H56" stroke="${ink}" stroke-width="3"/>`),
};

export function iconURL(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** Rend une icône en silhouette d'encre (théâtre d'ombres) : couleurs foncées → encre, claires → papier ; `accents` garde certaines teintes. */
export function inkIcon(svg: string, accents: Record<string, string> = {}, ink = '#1b1418', light = '#efe3c6'): string {
  const lum = (hex: string) => {
    let h = hex.slice(1);
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const n = parseInt(h, 16);
    return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  };
  return svg.replace(/(fill|stroke)="(#[0-9a-fA-F]{3,6})"/g, (_m, attr: string, col: string) => {
    const c = col.toLowerCase();
    if (accents[c]) return `${attr}="${accents[c]}"`;
    return `${attr}="${lum(c) > 0.72 ? light : ink}"`;
  });
}

const ACCENTS = { '#ff5f7a': '#d8431f', '#5fd8ff': '#2b8a74', '#ffcf4a': '#c9a13b' };
/** Icônes d'interface dans le style encre : cœur vermillon, gemme jade, or à la feuille. */
export const INK_UI: Record<keyof typeof UI_ICONS, string> = Object.fromEntries(
  Object.entries(UI_ICONS).map(([k, v]) => [k, inkIcon(v, k === 'starEmpty' ? { '#2a2148': '#efe3c6' } : ['heart', 'gem', 'coin', 'star', 'potion'].includes(k) ? ACCENTS : {})]),
) as Record<keyof typeof UI_ICONS, string>;
/** Variante claire pour les fonds d'encre (barre de navigation). */
export const PAPER_UI: Record<keyof typeof UI_ICONS, string> = Object.fromEntries(
  Object.entries(UI_ICONS).map(([k, v]) => [k, inkIcon(v, {}, '#efe3c6', '#1b1418')]),
) as Record<keyof typeof UI_ICONS, string>;
export const INK_POWERS: Record<string, string> = Object.fromEntries(Object.entries(POWER_ICONS).map(([k, v]) => [k, inkIcon(v)]));
