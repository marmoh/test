/** Icônes SVG (viewBox 64×64) : pouvoirs, équipement et interface. Exportées telles quelles vers art/icons/. */

const S = (body: string, vb = 64) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vb} ${vb}">${body}</svg>`;
const ink = '#140d24';
const st = `stroke="${ink}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;

const arrow = (x1: number, y1: number, x2: number, y2: number, c = '#f4ecd8') => {
  const a = Math.atan2(y2 - y1, x2 - x1);
  const hx = (k: number) => (x2 - Math.cos(a + k) * 10).toFixed(1);
  const hy = (k: number) => (y2 - Math.sin(a + k) * 10).toFixed(1);
  return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${ink}" stroke-width="7" stroke-linecap="round"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="3.5" stroke-linecap="round"/><path d="M${x2} ${y2} L${hx(0.5)} ${hy(0.5)} L${hx(-0.5)} ${hy(-0.5)} Z" fill="${c}" ${st}/>`;
};

// teintes sources : après inkIcon, les claires (paper, air, glow, silver) deviennent papier, les foncées (ember) encre ; or et jade restent des accents
const paper = '#f4ecd8';
const air = '#9fe8c9';
const ember = '#ff7a3d';
const glow = '#ffd36b';
const silver = '#dfe8f0';
const gold = '#ffcf4a';
const jade = '#5fd8ff';
/** Trait d'encre libre (souffles, fils, plis). */
const ln = (d: string, w = 5, c = ink) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
/** Ruban : trait d'encre doublé d'un trait clair (bourrasques, fils). */
const ribbon = (d: string, c = air, w = 8) => ln(d, w) + ln(d, w - 4, c);
/** Flamme (même dessin que le pouvoir flame) posée en (x, y) (pied), hauteur h, cernée d'un liseré clair. */
const tongue = (x: number, y: number, h: number, c = ember, core = glow) => {
  const k = h / 56;
  const tr = (d: string) => d.replace(/(-?[\d.]+) (-?[\d.]+)/g, (_m, a: string, b: string) => `${(x + (+a - 32) * k).toFixed(1)} ${(y + (+b - 60) * k).toFixed(1)}`);
  const body = tr('M32 4 C38 18 52 24 50 40 C48 54 38 60 32 60 C22 60 12 52 14 38 C16 28 24 26 26 16 C30 22 30 26 32 30 C34 22 34 14 32 4 Z');
  // liseré clair : sépare les flammes qui se chevauchent
  return `<path d="${body}" fill="none" stroke="${paper}" stroke-width="8" stroke-linejoin="round"/><path d="${body}" fill="${c}" ${st}/>` +
    `<path d="${tr('M32 30 C38 38 42 44 38 52 C34 56 28 56 26 50 C24 44 30 40 32 30 Z')}" fill="${core}"/>`;
};
/** Cordon d'un talisman : boucle en V et nœud. */
const cord = (y = 14) => ln(`M23 2 L32 ${y} L41 2`, 2.5) + `<circle cx="32" cy="${y}" r="3.2" fill="${ink}"/>`;

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
  // famille Vent (Moine du vent)
  bigGust: S(ribbon('M4 22 C18 20 26 8 40 7 C50 6 55 12 52 17 C49 21 44 19 46 15') +
    ribbon('M4 34 H42 C52 34 56 41 51 45 C47 47 43 44 46 41') +
    ribbon('M4 46 C18 48 26 57 40 58 C47 58 51 55 51 51') +
    ln('M60 14 V50', 3) + `<path d="M56 18 L60 11 L64 18 Z M56 46 L60 53 L64 46 Z" fill="${ink}"/>`),
  keenGust: S(`<path d="M24 4 C50 4 66 30 46 60 C52 36 44 16 24 4 Z" fill="${ink}" ${st}/><path d="M32 8 C50 14 58 32 49 52" fill="none" stroke="${silver}" stroke-width="3" stroke-linecap="round"/>` +
    ln('M8 18 H26 M10 46 H30', 4) + ribbon('M2 32 H28 C35 32 37 24 31 22 C27 21 25 25 28 27', air, 8)),
  quickMomentum: S(`<circle cx="32" cy="32" r="24" fill="none" stroke="${ink}" stroke-width="2" stroke-dasharray="3 4"/>` +
    ln('M14 48 A24 24 0 1 1 52 46', 7) + `<path d="M44 46 L55 40 L58 53 Z" fill="${ink}" ${st}/>` +
    `<path d="M18 22 L30 32 L18 42 Z M32 22 L44 32 L32 42 Z" fill="${air}" ${st}/>`),
  eyeOfStorm: S([0, 120, 240].map((r) => `<g transform="rotate(${r} 32 32)">${ln('M32 14 C46 12 58 22 56 38', 6)}</g>`).join('') +
    `<path d="M48 44 L59 41 L58 30 Z" fill="${ink}" ${st} transform="rotate(0 32 32)"/>` +
    `<path d="M18 32 C24 23 40 23 46 32 C40 41 24 41 18 32 Z" fill="${paper}" ${st}/><circle cx="32" cy="32" r="6" fill="${ink}"/><circle cx="34" cy="30" r="2" fill="${paper}"/>`),
  whirlwind: S(ln('M6 10 C6 6 58 6 58 10 C58 14 6 14 6 10', 5) +
    ln('M12 20 H52 M18 29 H48 M22 38 H42 M26 46 H38 M29 54 H34', 5) +
    `<path d="M4 46 L11 42 L12 50 Z M56 30 L62 33 L56 38 Z" fill="${paper}" ${st}/>` +
    `<path d="M10 44 C14 40 16 38 20 38 M56 34 C52 36 50 38 46 38" fill="none" stroke="${ink}" stroke-width="2.5" stroke-dasharray="3 3" stroke-linecap="round"/>`),
  featherStep: S(`<path d="M12 50 C12 30 28 10 56 6 C54 30 38 48 12 50 Z" fill="${paper}" ${st}/>` +
    ln('M6 58 L44 18', 3.5) + ln('M22 40 L16 34 M28 34 L24 24 M34 28 L32 18 M28 40 L36 42 M34 34 L44 34 M40 27 L50 24', 2.5) +
    `<path d="M36 12 L41 14 M50 22 L52 17" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>` +
    ribbon('M26 58 H50 C57 58 59 50 54 47 C51 45 47 48 49 51', air, 7)),
  // famille Braise (Sorcier de braise)
  liveEmbers: S([[19, 50, 15], [45, 50, 15]].map(([x, y, r]) => `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="9.5" fill="${ink}" stroke="${paper}" stroke-width="8"/><ellipse cx="${x}" cy="${y}" rx="${r}" ry="9.5" fill="${ink}" ${st}/>`).join('') +
    ln('M10 50 L15 47 L20 52 L26 49 M38 49 L43 53 L48 48 L54 51', 2.5, glow) +
    tongue(32, 44, 36) + `<path d="M16 18 L19 22 L16 26 L13 22 Z M48 10 L51 14 L48 18 L45 14 Z M52 28 L54 31 L52 34 L50 31 Z" fill="${glow}" ${st}/>`),
  blaze: S(`<g transform="rotate(-10 32 52)"><rect x="5" y="48" width="54" height="9" rx="4.5" fill="${ink}" ${st}/><circle cx="10" cy="52.5" r="2.5" fill="${glow}"/></g>` +
    `<g transform="rotate(10 32 52)"><rect x="5" y="48" width="54" height="9" rx="4.5" fill="${ink}" stroke="${paper}" stroke-width="7"/><rect x="5" y="48" width="54" height="9" rx="4.5" fill="${ink}" ${st}/><circle cx="54" cy="52.5" r="2.5" fill="${glow}"/></g>` +
    tongue(15, 46, 24) + tongue(49, 46, 24) + tongue(32, 47, 44)),
  wideTrail: S(ln('M6 46 C16 34 26 56 36 46 C42 40 46 42 50 44', 18) +
    ln('M6 46 C16 34 26 56 36 46 C42 40 46 42 50 44', 4, glow).replace('/>', ' stroke-dasharray="0.1 7"/>') +
    tongue(14, 36, 24) + tongue(40, 38, 24) +
    ln('M59 30 V58', 3) + `<path d="M55 33 L59 26 L63 33 Z M55 55 L59 62 L63 55 Z" fill="${ink}"/>`),
  combustion: S(`<path d="M32 2 L37 18 L52 8 L45 24 L62 28 L47 36 L58 50 L41 46 L38 62 L30 48 L20 60 L20 44 L4 46 L16 34 L2 24 L19 22 L14 6 L28 17 Z" fill="${ember}" ${st}/>` +
    `<path d="M32 20 C24 20 20 25 20 31 C20 35 22 37 25 38 V44 H39 V38 C42 37 44 35 44 31 C44 25 40 20 32 20 Z" fill="${paper}" ${st}/><circle cx="27" cy="31" r="3.5" fill="${ink}"/><circle cx="37" cy="31" r="3.5" fill="${ink}"/><path d="M30 44 V40 M34 44 V40" stroke="${ink}" stroke-width="2"/>`),
  ashWard: S(tongue(17, 59, 28) + tongue(47, 59, 28) + tongue(32, 59, 48) +
    `<circle cx="52" cy="16" r="7" fill="${paper}" ${st}/>` + ln('M62 10 H64 M62 16 H64 M62 22 H64', 3).replace(/H64/g, 'H63') +
    `<path d="M8 12 L13 10 L13 15 Z M4 24 L9 23 L8 28 Z M12 32 L15 31 L15 35 Z" fill="${ink}" ${st}/>` +
    `<path d="M44 18 C38 20 36 22 33 26 M22 18 C19 16 17 14 15 13" fill="none" stroke="${ink}" stroke-width="2.5" stroke-dasharray="3 3" stroke-linecap="round"/>`),
  furnace: S(`<path d="M8 58 V34 C8 18 18 8 32 8 C46 8 56 18 56 34 V58 Z" fill="${ink}" ${st}/>` +
    ln('M10 28 H22 M42 28 H54 M16 18 H24 M40 18 H48 M28 12 V18 M36 12 V18 M10 40 H18 M46 40 H54', 1.8, paper) +
    `<path d="M18 58 V44 C18 32 46 32 46 44 V58 Z" fill="${glow}" ${st}/>` + tongue(32, 58, 22, ink, glow) +
    `<rect x="4" y="56" width="56" height="6" rx="2" fill="${ink}" ${st}/>`),
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

/** Aiguille verticale (chas en haut), tournée de 45° : pointe en bas à gauche. */
const diag = (body: string) => `<g transform="rotate(45 32 32)">${body}</g>`;
/** Cape vue de face : tombe du col, bas `hem` (de gauche à droite, de 7,57 à 57,57), remplissage `fill`. */
const cape = (fill: string, hem: string, extra = '') => `<path d="M22 10 C16 22 11 40 7 57 ${hem} C53 40 48 22 42 10 Z" fill="${fill}" ${st}/>${extra}`;
/** Masque : visage en écu arrondi. */
const face = 'M10 16 C10 6 54 6 54 16 C54 36 44 52 32 58 C20 52 10 36 10 16 Z';
const eyes = (c: string, y = 26) => `<path d="M15 ${y} C19 ${y - 5} 25 ${y - 5} 28 ${y + 1} C24 ${y + 4} 19 ${y + 3} 15 ${y} Z M49 ${y} C45 ${y - 5} 39 ${y - 5} 36 ${y + 1} C40 ${y + 4} 45 ${y + 3} 49 ${y} Z" fill="${c}"/>`;
const star4 = (x: number, y: number, r: number, c = paper) => `<path d="M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y} L${x + r * 0.3} ${y + r * 0.3} L${x} ${y + r} L${x - r * 0.3} ${y + r * 0.3} L${x - r} ${y} L${x - r * 0.3} ${y - r * 0.3} Z" fill="${c}"/>`;
const lace = (cx: number, cy: number, r: number, n: number, rr: number) => Array.from({ length: n }, (_, i) => {
  const a = (i / n) * Math.PI * 2;
  return `<circle cx="${(cx + Math.cos(a) * r).toFixed(1)}" cy="${(cy + Math.sin(a) * r).toFixed(1)}" r="${rr}" fill="${paper}" stroke="${ink}" stroke-width="1.6"/>`;
}).join('');

/** Équipement (aiguilles, capes, masques, talismans) et emplacements vides. Rareté croissante dans chaque famille. */
export const GEAR_ICONS: Record<string, string> = {
  // Aiguilles (armes)
  sewingNeedle: S(diag(`<path d="M32 63 L29 20 C29 8 30 3 32 3 C34 3 35 8 35 20 Z" fill="${ink}" ${st}/><ellipse cx="32" cy="11" rx="1.4" ry="4.5" fill="${paper}"/>`) +
    ln('M47 17 C56 8 64 18 57 26 C51 32 54 42 61 46', 2.5) + ln('M47 17 C44 10 47 5 52 6', 2.5)),
  boneNeedle: S(diag(`<path d="M32 63 C30 50 26.5 30 26.5 15 C26.5 7 29 3 32 3 C35 3 37.5 7 37.5 15 C37.5 30 34 50 32 63 Z" fill="#efe6d0" ${st}/><ellipse cx="32" cy="12" rx="2" ry="4.5" fill="${ink}"/>` +
    ln('M27.5 24 H36.5 M28 29 H36 M29 40 L31 42 M35 36 L33 38', 2)) +
    ln('M47 17 C57 9 63 20 57 27 C52 33 55 42 62 44', 4.5) + ln('M47 17 C57 9 63 20 57 27 C52 33 55 42 62 44', 1.5, paper).replace('/>', ' stroke-dasharray="2 3"/>')),
  crowPin: S(diag(`<path d="M32 63 L30.5 20 H33.5 Z" fill="${ink}" ${st}/><circle cx="32" cy="22" r="3.5" fill="${paper}" ${st}/>`) +
    `<path d="M36 22 C34 14 38 7 46 6 C52 5 56 9 56 13 L63 17 L55 19 C52 25 42 28 36 22 Z" fill="${ink}" ${st}/><path d="M40 8 L36 3 M44 6 L42 1" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>` +
    `<circle cx="49" cy="12" r="2.6" fill="${paper}"/><circle cx="49.5" cy="12" r="1" fill="${ink}"/><path d="M55 17 L62 17" stroke="${paper}" stroke-width="1.2"/>`),
  moonNeedle: S(diag(`<path d="M32 63 L28.5 24 H35.5 Z" fill="${silver}" ${st}/><path d="M32 28 V52" stroke="${ink}" stroke-width="1.6"/>` +
    `<path d="M38 4 C27 1 21 9 21 15 C21 22 27 27 38 25 C31 23 28 19 28 15 C28 10 31 6 38 4 Z" fill="${gold}" ${st}/>`) +
    ribbon('M42 25 C52 30 60 26 58 18 C56 12 48 14 50 20', silver, 5) + star4(14, 12, 6, gold) + star4(56, 50, 4.5, gold)),
  amberSting: S(diag(`<path d="M32 63 L28.5 26 H35.5 Z" fill="${ink}" ${st}/><path d="M30.5 46 L26 42 L30 40 Z M33.5 52 L38 48 L34 46 Z M30.8 56 L27.5 53 L30.4 51.5 Z" fill="${ink}" ${st}/>` +
    `<rect x="27" y="24" width="10" height="5" rx="2" fill="${gold}" ${st}/>` +
    `<path d="M32 0 C38 6 42 12 42 17 C42 22 37.5 25 32 25 C26.5 25 22 22 22 17 C22 12 26 6 32 0 Z" fill="${gold}" ${st}/>` +
    `<ellipse cx="32" cy="17" rx="2.5" ry="4" fill="${ink}"/><path d="M28 14 L36 20 M36 14 L28 20" stroke="${ink}" stroke-width="1.5" stroke-linecap="round"/><path d="M27 11 C28 8 30 6 31 5" stroke="${paper}" stroke-width="2.2" stroke-linecap="round" fill="none"/>`)),
  throneNeedle: S('<g transform="translate(-3 3)">' + diag(`<path d="M32 63 L27.5 26 H36.5 Z" fill="${gold}" ${st}/>` +
    ln('M28 32 L36 36 M28.6 40 L35.4 44 M29.2 48 L34.8 52', 1.8) +
    `<circle cx="32" cy="27" r="3.5" fill="${jade}" ${st}/>` +
    `<path d="M32 9 C37 9 38 13 38 17 C38 21 35 24 32 24 C29 24 26 21 26 17 C26 13 27 9 32 9 Z" fill="${gold}" ${st}/><ellipse cx="32" cy="16.5" rx="1.6" ry="4.5" fill="${ink}"/>` +
    `<path d="M24 9 L25 -1 L29 4 L32 -3 L35 4 L39 -1 L40 9 Z" fill="${gold}" ${st}/><circle cx="32" cy="5" r="2" fill="${jade}"/>`) + '</g>' +
    ribbon('M41 25 C54 20 58 28 54 34 C50 40 52 48 58 50', silver, 5) +
    `<circle cx="58" cy="50" r="3" fill="${gold}" ${st}/><path d="M55 53 L61 53 L62 62 L54 62 Z" fill="${gold}" ${st}/>` + ln('M57 55 V61 M59 55 V61', 1.2)),
  // Capes
  juteCloak: S(cape('#d8c8a0', 'L12 53 L16 59 L21 54 L26 60 L31 55 L36 60 L41 54 L46 59 L51 53 L57 57',
    ln('M27 16 L22 52 M36 16 L41 50', 2) + `<rect x="27" y="34" width="11" height="10" fill="${paper}" ${st} transform="rotate(-8 32 39)"/>` + ln('M28 33 L30 36 M37 32 L35 35 M29 44 L31 41 M38 43 L36 40', 1.6)) +
    ln('M21 11 C27 15 37 15 43 11', 4) + `<circle cx="32" cy="14" r="3" fill="${ink}"/>` + ln('M32 14 L29 25 M32 14 L36 24', 3)),
  feltCloak: S(`<path d="M18 16 C15 6 24 1 32 1 C40 1 49 6 46 16 Z" fill="${ink}" ${st}/>` +
    cape(ink, 'C20 63 44 63 57 57', ln('M27 18 C25 30 22 44 20 56 M32 18 V58 M37 18 C39 30 42 44 44 56', 1.8, paper)) +
    `<path d="M20 12 C26 20 38 20 44 12" fill="none" stroke="${paper}" stroke-width="2"/><circle cx="32" cy="18" r="3.5" fill="${paper}" ${st}/>`),
  crowCloak: S(cape(ink, 'L11 50 L14 61 L19 52 L23 62 L28 53 L32 63 L36 53 L41 62 L45 52 L50 61 L53 50 L57 57',
    ln('M14 44 L18 49 L22 44 L26 49 L30 44 L34 49 L38 44 L42 49 L46 44 L50 49 M18 33 L22 38 L26 33 L30 38 L34 33 L38 38 L42 33 L46 38', 1.8, paper)) +
    `<path d="M16 14 L22 6 L24 12 L28 3 L32 10 L36 3 L40 12 L42 6 L48 14 C42 20 22 20 16 14 Z" fill="${ink}" ${st}/>` +
    `<circle cx="32" cy="18" r="4" fill="${paper}" ${st}/><circle cx="32" cy="18" r="1.5" fill="${ink}"/>`),
  mistMantle: S(cape(paper, 'C12 61 18 54 24 58 C30 62 34 54 40 58 C46 62 52 54 57 57',
    ln('M16 36 C20 32 24 40 30 36 C36 32 40 40 48 36 M12 47 C17 43 21 51 27 47 C33 43 37 51 44 47 C47 45 49 46 51 46 M21 25 C24 22 27 28 32 25 C36 22 39 27 43 25', 2)) +
    `<path d="M18 13 C24 21 40 21 46 13 C40 9 24 9 18 13 Z" fill="${paper}" ${st}/>` + `<path d="M32 14 L36 19 L32 24 L28 19 Z" fill="${jade}" ${st}/>`),
  marshCloak: S(cape(jade, 'C20 61 44 61 57 57', `<path d="M10 58 C10 48 12 40 18 34 C16 44 16 50 17 58 Z M18 58 C18 46 22 38 28 34 C24 44 24 52 25 58 Z M46 58 C46 50 44 42 38 36 C44 40 50 48 52 58 Z" fill="${ink}" ${st}/>` +
    `<rect x="40" y="22" width="5" height="12" rx="2.5" fill="${ink}"/>` + ln('M42.5 34 V52', 2) + ln('M30 16 L26 34 M36 16 L38 30', 1.8)) +
    `<path d="M18 13 C24 20 40 20 46 13 C40 8 24 8 18 13 Z" fill="${ink}" ${st}/>` + `<circle cx="32" cy="17" r="3.5" fill="${paper}" ${st}/>`),
  starryMantle: S(`<path d="M20 10 C13 22 7 40 3 56 C18 52 46 52 61 56 C57 40 51 22 44 10 Z" fill="${ink}" ${st}/>` +
    Array.from({ length: 8 }, (_, i) => `<circle cx="${5.5 + i * 7.6}" cy="${55.5 + (i === 0 || i === 7 ? 0 : 1.6)}" r="3.6" fill="${paper}" stroke="${ink}" stroke-width="1.8"/><circle cx="${5.5 + i * 7.6}" cy="${55.5 + (i === 0 || i === 7 ? 0 : 1.6)}" r="1.1" fill="${ink}"/>`).join('') +
    star4(20, 30, 4.5) + star4(42, 40, 5.5) + star4(30, 46, 3) + star4(46, 24, 3) + star4(14, 46, 3) +
    `<path d="M34 22 C27 22 23 28 24 33 C25 38 30 41 36 40 C31 38 29 34 29 31 C29 27 31 24 34 22 Z" fill="${gold}" stroke="${ink}" stroke-width="1.8"/>` +
    `<path d="M16 12 C24 20 40 20 48 12 C40 7 24 7 16 12 Z" fill="${gold}" ${st}/>` + ln('M22 13 C28 16 36 16 42 13', 1.6) + `<circle cx="32" cy="16" r="4" fill="${jade}" ${st}/>`),
  // Masques
  paperMask: S(ln('M10 18 C4 18 2 22 3 28 M54 18 C60 18 62 22 61 28', 2.5) + `<path d="${face}" fill="${paper}" ${st}/>` + eyes(ink) +
    `<path d="M32 8 V56" stroke="${ink}" stroke-width="1.4" stroke-dasharray="3 3"/><path d="M27 44 C30 46 34 46 37 44" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>`),
  foxMask: S(`<path d="M7 3 L21 15 C28 13 36 13 43 15 L57 3 L55 26 C52 40 42 50 32 61 C22 50 12 40 9 26 Z" fill="${paper}" ${st}/>` +
    `<path d="M11 9 L19 16 L12 20 Z M53 9 L45 16 L52 20 Z" fill="${ink}"/>` +
    `<path d="M14 26 C19 23 24 24 28 30 C23 31 18 30 14 26 Z M50 26 C45 23 40 24 36 30 C41 31 46 30 50 26 Z" fill="${ink}"/>` +
    `<path d="M32 61 C28 56 24 50 20 46 C26 46 30 48 32 52 C34 48 38 46 44 46 C40 50 36 56 32 61 Z" fill="${ink}"/>` +
    ln('M24 16 C27 20 29 21 32 21 C35 21 37 20 40 16', 2)),
  owlMask: S(`<path d="M12 22 L6 3 L24 13 Z M52 22 L58 3 L40 13 Z" fill="${ink}" ${st}/><path d="M32 11 C47 11 57 20 57 33 C57 47 45 57 32 57 C19 57 7 47 7 33 C7 20 17 11 32 11 Z" fill="${ink}" ${st}/>` +
    `<circle cx="21" cy="31" r="10" fill="${paper}" ${st}/><circle cx="43" cy="31" r="10" fill="${paper}" ${st}/><circle cx="21" cy="31" r="4.5" fill="${ink}"/><circle cx="43" cy="31" r="4.5" fill="${ink}"/>` +
    `<path d="M28 39 H36 L32 49 Z" fill="${paper}" ${st}/>` + ln('M24 17 L28 20 L32 17 L36 20 L40 17 M18 47 L22 50 L26 47 M38 47 L42 50 L46 47', 1.8, paper)),
  wolfMask: S(`<path d="M8 1 L22 14 H42 L56 1 L57 26 C57 34 50 38 44 42 L40 58 H24 L20 42 C14 38 7 34 7 26 Z" fill="${ink}" ${st}/>` +
    `<path d="M13 9 L20 16 L14 21 Z M51 9 L44 16 L50 21 Z" fill="${paper}"/>` +
    `<path d="M14 26 L28 30 L17 33 Z M50 26 L36 30 L47 33 Z" fill="${paper}"/>` + ln('M15 22 L27 26 M49 22 L37 26', 2, paper) +
    `<path d="M27 47 C29 44 35 44 37 47 L32 51 Z" fill="${paper}"/>` + ln('M32 51 V55 M28 55 H36', 1.8, paper) + `<path d="M24 57 L26.5 63 L29 57 Z M35 57 L37.5 63 L40 57 Z" fill="${paper}" ${st}/>`),
  emberMask: S(tongue(17, 24, 22) + tongue(47, 24, 22) + tongue(32, 20, 22) +
    `<g transform="translate(5 8) scale(0.84)"><path d="${face}" fill="${paper}" stroke="${paper}" stroke-width="8"/><path d="${face}" fill="${ink}" ${st}/>` +
    `<path d="M13 25 C18 18 26 18 30 27 C25 31 18 31 13 25 Z M51 25 C46 18 38 18 34 27 C39 31 46 31 51 25 Z" fill="${gold}" ${st}/>` + eyes(paper, 26).replace(/M15/, 'M17').replace(/M49/, 'M47') +
    ln('M32 10 L30 18 L34 24 L31 32 M18 38 L23 41 L22 46 M46 38 L41 41 L42 46 M32 42 L30 50', 2.4, glow) + '</g>'),
  eclipseMask: S(`<path d="M32 0 L36 8 L44 2 L45 11 L54 8 L52 17 L62 18 L56 25 L64 32 L56 39 L62 46 L52 47 L54 56 L45 53 L44 62 L36 56 L32 64 L28 56 L20 62 L19 53 L10 56 L12 47 L2 46 L8 39 L0 32 L8 25 L2 18 L12 17 L10 8 L19 11 L20 2 L28 8 Z" fill="${gold}" ${st}/>` +
    `<circle cx="32" cy="32" r="22" fill="${ink}" ${st}/>` + lace(32, 32, 22, 22, 2) +
    `<path d="M45 14 C55 20 58 34 52 44 C56 30 52 20 45 14 Z" fill="${gold}"/>` +
    `<path d="M16 29 C20 23 26 23 29 31 C24 34 19 33 16 29 Z M48 29 C44 23 38 23 35 31 C40 34 45 33 48 29 Z" fill="${paper}" stroke="${gold}" stroke-width="2"/>` +
    `<path d="M22 36 C25 40 25 43 22 45 C19 43 19 40 22 36 Z" fill="${jade}" ${st}/>` + star4(32, 44, 4)),
  // Talismans
  spool: S(cord(12) + ln('M32 12 V18', 2.5) + `<rect x="17" y="16" width="30" height="7" rx="2.5" fill="${ink}" ${st}/><rect x="17" y="50" width="30" height="7" rx="2.5" fill="${ink}" ${st}/>` +
    `<rect x="21" y="23" width="22" height="27" fill="${paper}" ${st}/>` + ln('M21 28 L43 30 M21 34 L43 36 M21 40 L43 42 M21 46 L43 48', 1.8) +
    ln('M43 46 C52 48 56 54 52 60 C50 63 46 62 46 58', 2.5)),
  windBell: S(cord(12) + `<circle cx="32" cy="15.5" r="4" fill="none" stroke="${ink}" stroke-width="3"/>` +
    `<circle cx="32" cy="38" r="18" fill="${ink}" ${st}/>` + ln('M16 34 C24 39 40 39 48 34', 2, paper) +
    ln('M22 46 H42', 3, paper) + `<circle cx="20" cy="46" r="3" fill="${paper}"/><circle cx="44" cy="46" r="3" fill="${paper}"/><ellipse cx="25" cy="28" rx="4" ry="2.5" fill="${paper}" transform="rotate(-30 25 28)"/>` +
    ln('M52 20 C58 18 62 22 59 26 M54 54 C60 56 62 50 58 48 M4 30 H10 M2 38 H10', 2.5)),
  emberJar: S(cord(8) + `<rect x="23" y="11" width="18" height="7" rx="2" fill="${ink}" ${st}/>` +
    `<path d="M25 18 C14 22 11 34 13 45 C15 56 23 61 32 61 C41 61 49 56 51 45 C53 34 50 22 39 18 Z" fill="${gold}" ${st}/>` +
    tongue(32, 54, 28, ink, glow) + `<path d="M18 30 C16 36 16 42 18 48" fill="none" stroke="${paper}" stroke-width="3" stroke-linecap="round"/>` +
    ln('M24 20 C28 23 36 23 40 20', 2.5) + ln('M40 21 L44 27', 2.5)),
  paperCrane: S(ln('M33 2 V34', 2) + `<circle cx="33" cy="4" r="2.5" fill="${ink}"/>` +
    `<path d="M28 39 L10 5 L42 33 Z" fill="${ink}" ${st}/>` +
    `<path d="M20 45 L5 14 L30 42 Z" fill="${paper}" ${st}/><path d="M5 14 L1 22 L10 19 Z" fill="${ink}" ${st}/><path d="M38 44 L61 16 L48 47 Z" fill="${paper}" ${st}/>` +
    `<path d="M14 45 L32 36 L50 45 L32 54 Z" fill="${paper}" ${st}/>` +
    `<path d="M25 41 L52 4 L44 41 Z" fill="${paper}" ${st}/>` + ln('M32 36 V54 M30 41 L46 21', 1.6)),
  waxHeart: S(cord(10) + `<path d="M32 58 C10 44 6 30 10 20 C14 10 26 10 32 20 C38 10 50 10 54 20 C58 30 54 44 32 58 Z" fill="${ink}" ${st}/>` +
    `` +
    `<circle cx="32" cy="32" r="10" fill="${gold}" ${st}/><circle cx="32" cy="32" r="6.5" fill="none" stroke="${ink}" stroke-width="1.5"/>` +
    `<path d="M34 26 C29 27 27 31 28 34 C29 37 32 38 35 38 C32 36 31 33 31 31 C31 29 32 27 34 26 Z" fill="${ink}"/>` + `<ellipse cx="18" cy="20" rx="4" ry="2.5" fill="${paper}" transform="rotate(-35 18 20)"/>`),
  eclipseCharm: S(cord(8) + `<circle cx="32" cy="12" r="3.5" fill="${jade}" ${st}/>` +
    `<path d="M32 15 L35 21 L41 17 L41 24 L48 23 L45 29 L51 32 L45 35 L48 41 L41 40 L41 47 L35 43 L32 49 L29 43 L23 47 L23 40 L16 41 L19 35 L13 32 L19 29 L16 23 L23 24 L23 17 L29 21 Z" fill="${gold}" ${st}/>` +
    `<circle cx="32" cy="32" r="12" fill="${gold}" ${st}/>` + lace(32, 32, 12, 14, 1.8) + `<circle cx="34.5" cy="30.5" r="9" fill="${ink}"/>` + star4(34, 31, 3) +
    ln('M32 49 V53', 2.5) + `<path d="M29 53 H35 L37 63 H27 Z" fill="${ink}" ${st}/>` + ln('M30 56 V62 M32 56 V62 M34 56 V62', 1.2, paper)),
  // Emplacements vides et monnaie
  slotNeedle: S(diag(`<path d="M32 62 L28.5 20 C28.5 8 30 3 32 3 C34 3 35.5 8 35.5 20 Z" fill="none" ${st}/><ellipse cx="32" cy="11" rx="1.4" ry="4" fill="none" stroke="${ink}" stroke-width="2.5"/>`)),
  slotCloak: S(`<path d="M22 10 C16 22 11 40 7 57 C20 62 44 62 57 57 C53 40 48 22 42 10 Z" fill="none" ${st}/><path d="M20 12 C26 18 38 18 44 12" fill="none" ${st}/>`),
  slotMask: S(`<path d="${face}" fill="none" ${st}/><path d="M15 26 C19 21 25 21 28 27 C24 30 19 29 15 26 Z M49 26 C45 21 39 21 36 27 C40 30 45 29 49 26 Z" fill="none" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>`),
  slotCharm: S(ln('M23 2 L32 16 L41 2', 2.5) + `<circle cx="32" cy="36" r="16" fill="none" ${st}/>` + ln('M32 16 V20', 3) + ln('M32 52 V56 M28 62 L32 56 L36 62', 2.5)),
  shard: S(`<path d="M27 3 L37 8 L47 6 L44 18 L58 28 L52 38 L56 50 L40 59 L32 55 L20 61 L18 48 L6 42 L13 30 L8 18 L22 16 Z" fill="${gold}" ${st}/>` +
    `<path d="M27 3 L30 26 L44 18 Z M13 30 L30 26 L18 48 Z" fill="${paper}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/>` +
    ln('M30 26 L40 59 M30 26 L52 38', 2) + star4(48, 46, 3.5)),
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
/** Équipement dans le style encre : or à la feuille et jade gardés comme accents. */
export const INK_GEAR: Record<string, string> = Object.fromEntries(
  Object.entries(GEAR_ICONS).map(([k, v]) => [k, inkIcon(v, { '#ffcf4a': ACCENTS['#ffcf4a'], '#5fd8ff': ACCENTS['#5fd8ff'] })]),
);
