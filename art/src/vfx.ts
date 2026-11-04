/**
 * Effets visuels du combat (VFX) en pièces animées, pour le web et les atlas iOS (`VFX.atlas`).
 *
 * Même vocabulaire que le reste du théâtre d'ombres : encre, lumière découpée, papier ;
 * le vermillon n'apparaît que dans les télégraphes (danger). Chaque effet est décrit par
 * une taille (pt), un nombre d'images et une fonction `draw(ctx, k)` où `k` va de 0 à 1
 * sur la durée de l'effet. L'origine est le centre de l'image.
 *
 * Le combat web garde ses particules procédurales (`web/src/fx.ts`) ; il partage avec ce
 * module les tracés de base (`hatch`, `flameCut`, `heartShape`) pour que les atlas et le web
 * dessinent la même chose.
 */
import { INK, INK2, CUT, DANGER, JADE, JADE_LIGHT, GOLD_LEAF, UI } from './palette.js';
import { alpha, circle, star, type Ctx } from './draw.js';

const TAU = Math.PI * 2;

function rnd(i: number, k = 0): number {
  let h = (i * 374761393 + k * 668265263) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

// ───────────────────────────── tracés partagés ─────────────────────────────

/** Hachures diagonales vermillon (marque du danger, façon gravure). */
export function hatch(ctx: Ctx, x: number, y: number, w: number, h: number, t: number, a: number): void {
  ctx.strokeStyle = alpha(DANGER, a);
  ctx.lineWidth = 2;
  ctx.beginPath();
  const off = (t * 14) % 8;
  for (let k = -h; k < w + h; k += 8) {
    ctx.moveTo(x + k + off, y);
    ctx.lineTo(x + k + off - h, y + h);
  }
  ctx.stroke();
}

/** Petite flamme découpée dans l'encre. */
export function flameCut(ctx: Ctx, x: number, y: number, h: number): void {
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(x - h * 0.6, y);
  ctx.quadraticCurveTo(x - h * 0.4, y - h * 1.2, x, y - h * 2);
  ctx.quadraticCurveTo(x + h * 0.4, y - h * 1.2, x + h * 0.6, y);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = CUT;
  ctx.beginPath();
  ctx.ellipse(x, y - h * 0.5, h * 0.2, h * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Cœur de soin (orbe de soin) cerné d'encre. */
export function heartShape(ctx: Ctx, x: number, y: number, s: number, col: string): void {
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

/** Morceau de papier découpé (chutes) : quadrilatère irrégulier, `flip` simule la rotation en profondeur. */
export function scrapShape(ctx: Ctx, size: number, rot: number, flip: number, color: string): void {
  ctx.save();
  ctx.rotate(rot);
  ctx.scale(1, flip);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-size, -size * 0.6);
  ctx.lineTo(size * 0.8, -size * 0.4);
  ctx.lineTo(size * 0.5, size * 0.7);
  ctx.lineTo(-size * 0.7, size * 0.5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** Contour irrégulier de boucle découpée (forme générique des découpes du fil). */
function loopPath(ctx: Ctx, r: number, seed: number): void {
  ctx.beginPath();
  const N = 22;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * TAU;
    const rr = r * (0.82 + 0.18 * Math.sin(a * 2 + seed) + (rnd(i % N, seed) - 0.5) * 0.08);
    const x = Math.cos(a) * rr * 1.08;
    const y = Math.sin(a) * rr * 0.9;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

// ───────────────────────────── catalogue ─────────────────────────────

export interface VfxDef {
  /** taille de l'image en points (largeur, hauteur) */
  w: number;
  h: number;
  frames: number;
  /** durée de l'effet ou de la boucle (s), indicative pour le jeu */
  duration: number;
  loop?: boolean;
  /** `k` ∈ [0, 1] : avancement ; `i` : numéro d'image */
  draw: (ctx: Ctx, k: number, i: number) => void;
  note: string;
}

const scrapColor = (j: number) => (j === 0 ? INK : j === 1 ? INK2 : CUT);

export const VFX: Record<string, VfxDef> = {
  impact: {
    w: 48, h: 48, frames: 6, duration: 0.18,
    note: 'Flash d’impact d’une aiguille : losange de lumière qui se referme, éclats d’encre.',
    draw: (ctx, k) => {
      const a = 1 - k;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.rotate(Math.PI / 4);
      const s = 6 + 10 * easeOut(Math.min(1, k * 2.2)) * (1 - k * 0.6);
      ctx.fillStyle = CUT;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.rect(-s / 2, -s / 2, s, s);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      ctx.save();
      ctx.globalAlpha = Math.min(1, a * 1.4);
      ctx.strokeStyle = INK;
      ctx.lineCap = 'round';
      for (let j = 0; j < 6; j++) {
        const ang = (j / 6) * TAU + 0.3;
        const r0 = 6 + 12 * easeOut(k);
        const r1 = r0 + 6 * (1 - k) + 2;
        ctx.lineWidth = 2.4 * (1 - k) + 0.6;
        ctx.beginPath();
        ctx.moveTo(Math.cos(ang) * r0, Math.sin(ang) * r0);
        ctx.lineTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
        ctx.stroke();
      }
      ctx.restore();
    },
  },
  impact_crit: {
    w: 64, h: 64, frames: 6, duration: 0.24,
    note: 'Impact critique : étoile de lumière cernée de vermillon (seul vermillon côté héros : chiffres critiques).',
    draw: (ctx, k) => {
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.rotate(k * 0.6);
      star(ctx, 0, 0, 10 + 16 * easeOut(k), 0.42, 6);
      ctx.fillStyle = CUT;
      ctx.fill();
      ctx.strokeStyle = DANGER;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    },
  },
  ring: {
    w: 96, h: 96, frames: 6, duration: 0.35,
    note: 'Onde d’encre (mort d’une marionnette, impact de zone) : anneau qui s’élargit et s’amincit.',
    draw: (ctx, k) => {
      const q = 1 - k;
      ctx.globalAlpha = q;
      ctx.strokeStyle = INK;
      ctx.lineWidth = 3 * q + 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, 40 * (1.15 - q * 0.85) + 2, 0, TAU);
      ctx.stroke();
      ctx.globalAlpha = 1;
    },
  },
  scrap_ink: {
    w: 16, h: 16, frames: 8, duration: 0.5, loop: true,
    note: 'Chute de papier d’encre qui tournoie (rotation + retournement), à lancer en particules.',
    draw: (ctx, k) => scrapShape(ctx, 5.5, k * TAU, Math.cos(k * TAU * 1.7) || 0.05, scrapColor(0)),
  },
  scrap_ink2: {
    w: 16, h: 16, frames: 8, duration: 0.5, loop: true,
    note: 'Chute de papier (encre claire).',
    draw: (ctx, k) => scrapShape(ctx, 5.5, k * TAU + 1, Math.cos(k * TAU * 1.7 + 1) || 0.05, scrapColor(1)),
  },
  scrap_light: {
    w: 16, h: 16, frames: 8, duration: 0.5, loop: true,
    note: 'Chute de papier clair (lumière), cernée d’un trait d’encre.',
    draw: (ctx, k) => {
      ctx.save();
      ctx.rotate(k * TAU + 2);
      ctx.scale(1, Math.cos(k * TAU * 1.7 + 2) || 0.05);
      ctx.beginPath();
      ctx.moveTo(-5.5, -3.3);
      ctx.lineTo(4.4, -2.2);
      ctx.lineTo(2.75, 3.85);
      ctx.lineTo(-3.85, 2.75);
      ctx.closePath();
      ctx.fillStyle = CUT;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    },
  },
  scraps_burst: {
    w: 96, h: 96, frames: 8, duration: 0.9,
    note: 'Gerbe de chutes de papier (mort d’un ennemi) déjà composée, pour les appareils lents.',
    draw: (ctx, k) => {
      for (let j = 0; j < 12; j++) {
        const a = rnd(j, 1) * TAU;
        const sp = 18 + rnd(j, 2) * 26;
        const x = Math.cos(a) * sp * easeOut(k);
        const y = Math.sin(a) * sp * easeOut(k) - 14 * k + 40 * k * k;
        ctx.save();
        ctx.globalAlpha = Math.min(1, (1 - k) * 1.8);
        ctx.translate(x, y);
        scrapShape(ctx, 3 + rnd(j, 3) * 3, rnd(j, 4) * 6 + k * 8, Math.cos(k * 9 + j), scrapColor(j % 3));
        ctx.restore();
      }
    },
  },
  cut_flash: {
    w: 128, h: 112, frames: 6, duration: 0.12,
    note: 'Éclair de la découpe : la boucle se remplit de lumière, contour d’encre (à étirer à la taille de la boucle).',
    draw: (ctx, k) => {
      loopPath(ctx, 52, 3);
      ctx.fillStyle = alpha(CUT, 0.95 * (1 - k * 0.85));
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2.5;
      ctx.stroke();
    },
  },
  cut_hole: {
    w: 128, h: 112, frames: 6, duration: 0.9,
    note: 'Trou dans l’écran après la découpe (on voit les coulisses), qui se referme.',
    draw: (ctx, k) => {
      loopPath(ctx, 52, 3);
      ctx.fillStyle = alpha(INK, 0.55 * (1 - k));
      ctx.fill();
      ctx.setLineDash([5, 3]);
      ctx.strokeStyle = alpha(INK, 0.8 * (1 - k));
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.setLineDash([]);
    },
  },
  cut_piece: {
    w: 128, h: 112, frames: 8, duration: 0.95,
    note: 'Morceau de papier découpé qui tombe en tournoyant (teinter avec le papier du royaume).',
    draw: (ctx, k) => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.translate(k * 10, 30 * k * k + 6 * k);
      ctx.rotate(k * 1.2);
      const sc = 0.62 * (1 - k * 0.35);
      ctx.scale(sc, sc);
      loopPath(ctx, 52, 3);
      ctx.fillStyle = UI.paper;
      ctx.fill();
      ctx.strokeStyle = INK;
      ctx.lineWidth = 2 / sc;
      ctx.setLineDash([6, 4]);
      ctx.stroke();
      ctx.restore();
    },
  },
  telegraph_circle: {
    w: 96, h: 96, frames: 8, duration: 0.8,
    note: 'Télégraphe de zone : disque hachuré vermillon dont le plein se referme vers le centre jusqu’à l’impact (k = 1). Rayon 44 pt, à mettre à l’échelle.',
    draw: (ctx, k, i) => {
      const R = 44;
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, TAU);
      ctx.save();
      ctx.clip();
      hatch(ctx, -R, -R, R * 2, R * 2, i * 0.07, 0.5);
      ctx.restore();
      ctx.fillStyle = alpha(DANGER, 0.8);
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, TAU);
      ctx.arc(0, 0, R * (1 - k), 0, TAU, true);
      ctx.fill();
      ctx.strokeStyle = DANGER;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, TAU);
      ctx.stroke();
      ctx.restore();
    },
  },
  telegraph_line: {
    w: 176, h: 36, frames: 8, duration: 0.6,
    note: 'Télégraphe de charge : bande hachurée de 160 × 28 pt qui se remplit de gauche à droite, flèches découpées qui avancent. Étirer en longueur (9-slice horizontal).',
    draw: (ctx, k, i) => {
      const len = 160;
      const r = 14;
      ctx.save();
      ctx.translate(-len / 2, 0);
      ctx.beginPath();
      ctx.roundRect(0, -r, len, r * 2, r);
      ctx.save();
      ctx.clip();
      hatch(ctx, -r, -r, len + r * 2, r * 2, i * 0.07, 0.55);
      ctx.fillStyle = alpha(DANGER, 0.85);
      ctx.fillRect(0, -r, len * k, r * 2);
      ctx.restore();
      ctx.beginPath();
      ctx.roundRect(0, -r, len, r * 2, r);
      ctx.strokeStyle = DANGER;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.fillStyle = CUT;
      for (let x = ((i * 0.075 * 120) % 24) - 24; x < len - 10; x += 24) {
        if (x < 6) continue;
        ctx.beginPath();
        ctx.moveTo(x, -5);
        ctx.lineTo(x + 7, 0);
        ctx.lineTo(x, 5);
        ctx.lineTo(x + 3, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    },
  },
  hazard_fire: {
    w: 96, h: 96, frames: 8, duration: 0.6, loop: true,
    note: 'Zone persistante (flaque du mage, souffle des boss) : fond vermillon hachuré, flammes d’encre qui dansent.',
    draw: (ctx, k, i) => {
      const R = 44;
      const t = k * 0.6 * 1.0;
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, TAU);
      ctx.save();
      ctx.clip();
      ctx.fillStyle = alpha(DANGER, 0.35);
      ctx.fillRect(-R, -R, R * 2, R * 2);
      hatch(ctx, -R, -R, R * 2, R * 2, i * 0.075, 0.6);
      ctx.restore();
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, TAU);
      ctx.strokeStyle = DANGER;
      ctx.lineWidth = 2;
      ctx.stroke();
      for (let j = 0; j < 6; j++) {
        const aa = j * 1.05;
        const rr = (R * 0.65 * ((j * 37) % 10)) / 10;
        const h = 7 + Math.sin(t * TAU / 0.6 + j) * 2.5;
        flameCut(ctx, Math.cos(aa) * rr, Math.sin(aa) * rr, h * 0.6);
      }
      ctx.restore();
    },
  },
  heal_orb: {
    w: 32, h: 32, frames: 8, duration: 1.57, loop: true,
    note: 'Orbe de soin : cœur jade qui flotte (boucle).',
    draw: (ctx, k) => heartShape(ctx, 0, Math.sin(k * TAU) * 3, 7, UI.heal),
  },
  heal_burst: {
    w: 64, h: 64, frames: 6, duration: 0.8,
    note: 'Soin reçu (entre deux salles, orbe ramassé) : points jade qui montent et s’éteignent.',
    draw: (ctx, k) => {
      for (let j = 0; j < 10; j++) {
        const a = rnd(j, 5) * TAU;
        const sp = 10 + rnd(j, 6) * 16;
        const x = Math.cos(a) * sp * easeOut(k);
        const y = Math.sin(a) * sp * easeOut(k) - 22 * k;
        ctx.globalAlpha = Math.min(1, (1 - k) * 1.6);
        circle(ctx, x, y, 2.6 * (0.4 + (1 - k) * 0.6), j % 3 ? JADE : JADE_LIGHT);
      }
      ctx.globalAlpha = 1;
    },
  },
  shield_ring: {
    w: 56, h: 56, frames: 8, duration: 1.57, loop: true,
    note: 'Bouclier prêt (Égide, pouvoir Bouclier) : cercle jade en pointillés qui respire.',
    draw: (ctx, k) => {
      ctx.globalAlpha = 0.35 + 0.15 * Math.sin(k * TAU);
      ctx.setLineDash([5, 4]);
      ctx.lineDashOffset = -k * 18;
      circle(ctx, 0, 0, 22, 'rgba(43,138,116,0.12)', JADE, 2);
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    },
  },
  portal_open: {
    w: 96, h: 80, frames: 8, duration: 0.5,
    note: 'Porte de scène qui s’ouvre (k = 0 fermée → 1 ouverte). Seuil de la porte à 66 pt du haut : anchorPoint (0.5, 0.18), posé à y = 8 pt sous le bord haut de l’écran (centre en x).',
    draw: (ctx, k) => portal(ctx, k * 2.1, easeBack(k)),
  },
  portal_loop: {
    w: 96, h: 80, frames: 8, duration: 0.98, loop: true,
    note: 'Porte ouverte : rayons de lumière qui tournent (boucle, 1/8 de tour) ; même cadrage que portal_open.',
    draw: (ctx, k) => portal(ctx, (k * TAU) / 8 / 0.8, 1),
  },
  confetti: {
    w: 128, h: 128, frames: 8, duration: 0.7,
    note: 'Confettis (pouvoir) : le découpé éclate en confettis de papier sur ses voisins (rayon 72 pt).',
    draw: (ctx, k) => {
      const cols = [CUT, GOLD_LEAF, INK, JADE_LIGHT, INK2];
      for (let j = 0; j < 22; j++) {
        const a = rnd(j, 7) * TAU;
        const sp = 24 + rnd(j, 8) * 36;
        const x = Math.cos(a) * sp * easeOut(k);
        const y = Math.sin(a) * sp * easeOut(k) + 18 * k * k;
        ctx.save();
        ctx.globalAlpha = Math.min(1, (1 - k) * 2);
        ctx.translate(x, y);
        ctx.rotate(rnd(j, 9) * 6 + k * 10);
        ctx.scale(1, Math.cos(k * 12 + j));
        ctx.fillStyle = cols[j % cols.length];
        if (j % 3 === 0) {
          ctx.beginPath();
          ctx.arc(0, 0, 2.6, 0, TAU);
          ctx.fill();
        } else ctx.fillRect(-3.5, -1.8, 7, 3.6);
        if (cols[j % cols.length] === CUT) {
          ctx.strokeStyle = INK;
          ctx.lineWidth = 0.8;
          ctx.strokeRect(-3.5, -1.8, 7, 3.6);
        }
        ctx.restore();
      }
      // anneau de rayon du pouvoir
      ctx.globalAlpha = (1 - k) * 0.6;
      ctx.setLineDash([3, 5]);
      ctx.strokeStyle = INK;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, 20 + 40 * easeOut(k), 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    },
  },
  snip_spark: {
    w: 40, h: 40, frames: 6, duration: 0.3,
    note: 'Fil coupé ou grignoté : petit « clic » de ciseaux (croix découpée) et éclats d’encre.',
    draw: (ctx, k) => {
      const q = 1 - k;
      ctx.save();
      ctx.globalAlpha = q;
      ctx.strokeStyle = INK;
      ctx.lineCap = 'round';
      for (let j = 0; j < 5; j++) {
        const a = rnd(j, 11) * TAU;
        const r0 = 4 + 10 * easeOut(k);
        ctx.lineWidth = 1.8 * q + 0.4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * r0, Math.sin(a) * r0);
        ctx.lineTo(Math.cos(a) * (r0 + 4), Math.sin(a) * (r0 + 4));
        ctx.stroke();
      }
      // lames : une croix qui se referme
      const open = 0.5 * q;
      ctx.lineWidth = 2.2;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(-Math.cos(open * s) * 6, -Math.sin(open * s) * 6 * s);
        ctx.lineTo(Math.cos(open * s) * 6, Math.sin(open * s) * 6 * s);
        ctx.stroke();
      }
      circle(ctx, 0, 0, 1.4, CUT, INK, 1);
      ctx.restore();
    },
  },
  thread_knot: {
    w: 24, h: 24, frames: 6, duration: 0.6, loop: true,
    note: 'Point de fermeture de la boucle (nœud jade qui palpite quand la boucle est presque fermée).',
    draw: (ctx, k) => circle(ctx, 0, 0, 5 + Math.sin(k * TAU) * 0.8, JADE, INK, 1.5),
  },
};

function easeBack(x: number): number {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/** Porte de scène (même tracé que `paintPortal` du décor), centrée pour l'atlas, lumière neutre. */
function portal(ctx: Ctx, t: number, open01: number): void {
  ctx.save();
  ctx.translate(0, 18);
  const cy = -2;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(-36, cy + 8);
  ctx.lineTo(-36, cy - 14);
  ctx.arc(0, cy - 14, 36, Math.PI, 0);
  ctx.lineTo(36, cy + 8);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = alpha(CUT, 0.35);
  for (let i = 0; i < 9; i++) {
    const a = Math.PI + (i + 0.5) * (Math.PI / 9);
    circle(ctx, Math.cos(a) * 29, cy - 14 + Math.sin(a) * 29, 1.5, alpha(CUT, 0.35));
  }
  ctx.beginPath();
  ctx.moveTo(-22, cy + 10);
  ctx.lineTo(-22, cy - 12);
  ctx.arc(0, cy - 12, 22, Math.PI, 0);
  ctx.lineTo(22, cy + 10);
  ctx.closePath();
  const o = Math.max(0, Math.min(1, open01));
  ctx.fillStyle = o > 0 ? mixHex(INK2, CUT, o) : INK2;
  ctx.fill();
  if (o > 0) {
    ctx.save();
    ctx.clip();
    ctx.translate(0, cy - 6);
    ctx.rotate(t * 0.8);
    ctx.fillStyle = alpha('#f4e8c1', Math.min(1, 0.9 * o));
    for (let i = 0; i < 8; i++) {
      ctx.rotate(Math.PI / 4);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-4, -40);
      ctx.lineTo(4, -40);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
  circle(ctx, 0, cy - 40, 6, o > 0 ? CUT : INK2);
  circle(ctx, 2.5, cy - 41.5, 5, INK);
  ctx.restore();
}

function mixHex(a: string, b: string, k: number): string {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const A = p(a);
  const B = p(b);
  return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * k)).join(',')})`;
}

/** Dessine l'image `i` (sur `frames`) d'un effet, centrée sur l'origine. */
export function paintVfxFrame(ctx: Ctx, name: string, i: number): void {
  const d = VFX[name];
  const k = d.loop ? i / d.frames : i / Math.max(1, d.frames - 1);
  ctx.save();
  d.draw(ctx, k, i);
  ctx.restore();
}
