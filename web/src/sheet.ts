/**
 * Planche de contrôle des marionnettes (?sheet) et du décor (?sheet&decor).
 *  - ?sheet            : chaque peintre dans chaque état, animé (y compris release, hurt, dying, cutting),
 *                        plus une colonne « jeu » à l'échelle réelle du téléphone.
 *  - ?sheet&k=3        : fond du royaume 3.
 *  - ?sheet&decor      : les cinq royaumes côte à côte (couche statique + liquides + décor animé).
 *  - &t=1.25           : fige l'horloge (captures reproductibles).
 *  - &only=scout,moth  : ne montre que ces peintres ; &zoom=2 agrandit la planche.
 */
import { PAINTERS, type AnimState, type Pose } from '../../art/src/characters.js';
import { paintArenaStatic, paintLiquids, paintPortal, paintDecorAnim, paintFrame, AW, AH, WALL } from '../../art/src/arena-art.js';
import { KINGDOMS, INK, CUT } from '../../art/src/palette.js';

const BOSSES = ['treant', 'queen', 'scorpion', 'wyvern', 'ashlord'];
const HEROES = ['hero', 'scout', 'windMonk', 'emberSorcerer'];

interface Col {
  label: string;
  pose: (t: number, name: string) => Partial<Pose> & { state: AnimState };
}

/** Cycle : 0→1 sur `dur` secondes, puis pause jusqu'à `period`. */
const cyc = (t: number, dur: number, period: number) => Math.min(1, (t % period) / dur);
/** Décroissance 1→0 sur `dur`, une fois par `period`. */
const pulse = (t: number, dur: number, period: number) => Math.max(0, 1 - (t % period) / dur);

const COLS_DEF: Col[] = [
  { label: 'idle', pose: () => ({ state: 'idle' }) },
  { label: 'move', pose: (t) => ({ state: 'move', facing: Math.floor(t / 3) % 2 ? Math.PI - 0.2 : 0.2 }) },
  { label: 'windup', pose: (t) => ({ state: 'windup', windup: cyc(t, 1.1, 1.5) }) },
  {
    label: 'attaque',
    pose: (t) => {
      // anticipation 0,9 s → détente 0,25 s → repos
      const u = t % 1.6;
      if (u < 0.9) return { state: 'windup', windup: u / 0.9 };
      return { state: 'idle', release: Math.max(0, 1 - (u - 0.9) / 0.25) };
    },
  },
  { label: 'charge', pose: () => ({ state: 'charge' }) },
  { label: 'recover', pose: () => ({ state: 'recover' }) },
  { label: 'spawn', pose: () => ({ state: 'spawn' }) },
  { label: 'breath', pose: () => ({ state: 'breath' }) },
  { label: 'hurt', pose: (t) => ({ state: 'idle', hurt: pulse(t, 0.3, 1.1), flash: pulse(t, 0.12, 1.1) }) },
  { label: 'dying', pose: (t) => ({ state: 'idle', dying: cyc(t, 0.5, 1.4) }) },
  { label: 'elite', pose: (t) => ({ state: Math.floor(t / 2) % 2 ? 'windup' : 'idle', windup: (t % 2) / 2, elite: true }) },
  {
    label: 'aim/cut',
    pose: (t, name) => {
      if (!HEROES.includes(name)) return { state: 'move', facing: Math.PI - 0.3 };
      const u = t % 3;
      if (u < 1.8) return { state: 'idle', aiming: true, release: pulse(u, 0.25, 0.6), facing: -0.5 + Math.sin(t) * 0.8 };
      return { state: 'idle', cutting: Math.max(0, 1 - (u - 1.8) / 0.5) };
    },
  },
];

export function mountSheet(root: HTMLElement): void {
  const params = new URLSearchParams(location.search);
  const k = Math.max(1, Math.min(5, Number(params.get('k') ?? 1))) - 1;
  const frozen = params.has('t') ? Number(params.get('t')) : null;
  root.style.maxWidth = 'none';
  root.style.overflow = 'auto';
  document.body.style.overflow = 'auto';
  if (params.has('decor')) return mountDecor(root, frozen, Number(params.get('z') ?? 1));
  if (params.has('bench')) return bench(root);

  const only = params.get('only')?.split(',');
  const names = Object.keys(PAINTERS).filter((n) => n !== 'hero' && (!only || only.includes(n)));
  const Z = Number(params.get('zoom') ?? 1);
  const COLW = 78 * Z, NAMEW = 92, GAMEW = 70;
  const rowH = (n: string) => (BOSSES.includes(n) ? 104 : 66) * Z;
  const W = NAMEW + COLS_DEF.length * COLW + GAMEW + 10;
  const H = 34 + names.reduce((s, n) => s + rowH(n), 0);
  const dpr = Math.min(2, devicePixelRatio || 1);
  const c = document.createElement('canvas');
  c.width = W * dpr;
  c.height = H * dpr;
  c.style.width = W + 'px';
  c.style.height = H + 'px';
  c.style.display = 'block';
  root.appendChild(c);
  const ctx = c.getContext('2d')!;
  const th = KINGDOMS[k];

  const frame = (ms: number) => {
    const t = frozen ?? ms / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = th.paper;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = th.light;
    ctx.fillRect(NAMEW, 0, COLS_DEF.length * COLW, H);
    ctx.font = '600 12px "Alegreya Sans", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = INK;
    COLS_DEF.forEach((col, j) => ctx.fillText(col.label, NAMEW + j * COLW + COLW / 2, 20));
    ctx.fillText('jeu (1×)', NAMEW + COLS_DEF.length * COLW + GAMEW / 2, 20);
    let y = 34;
    names.forEach((n, i) => {
      const boss = BOSSES.includes(n);
      const h = rowH(n);
      const s = (boss ? 0.78 : 1.45) * Z;
      ctx.strokeStyle = 'rgba(27,20,24,0.12)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
      ctx.textAlign = 'left';
      ctx.fillStyle = INK;
      ctx.fillText(n, 8, y + h / 2 + 4);
      COLS_DEF.forEach((col, j) => {
        const pz = col.pose(t + i * 0.13, n);
        const pose: Pose = { t: t + i * 0.37, facing: 0.2, windup: 0, flash: 0, elite: false, seed: i + 1, ...pz };
        ctx.save();
        ctx.beginPath();
        ctx.rect(NAMEW + j * COLW, y, COLW, h);
        ctx.clip();
        ctx.translate(NAMEW + j * COLW + COLW / 2, y + h * (boss ? 0.6 : 0.56));
        ctx.scale(s, s);
        PAINTERS[n](ctx, pose);
        ctx.restore();
      });
      // échelle de jeu : marche puis anticipation
      const gx = NAMEW + COLS_DEF.length * COLW + GAMEW / 2;
      const u = (t + i * 0.3) % 4;
      ctx.save();
      ctx.translate(gx, y + h * 0.58);
      ctx.scale(0.95, 0.95);
      PAINTERS[n](ctx, { t, facing: u < 2 ? 0.3 : Math.PI - 0.3, state: u < 2.6 ? 'move' : 'windup', windup: Math.min(1, (u - 2.6) / 1.2), flash: 0, elite: false, seed: i + 1, aiming: false });
      ctx.restore();
      y += h;
    });
    if (frozen === null) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

const SAMPLE_GRID = [
  '....P....',
  '.........',
  '.#.....%.',
  '.##...%%.',
  '.........',
  '...~~~...',
  '...~~~...',
  '.........',
  '%.......#',
  '%%.....##',
  '.........',
  '..~...~..',
  '..~...~..',
  '.........',
  '....S....',
];

function mountDecor(root: HTMLElement, frozen: number | null, z: number): void {
  const PAD = 30;
  const cellW = AW + WALL * 2;
  const cellH = AH + WALL * 2;
  const W = (cellW + PAD) * 5 + PAD;
  const H = cellH + PAD * 2 + 60;
  const dpr = Math.min(2, devicePixelRatio || 1) * z;
  const c = document.createElement('canvas');
  c.width = W * dpr;
  c.height = H * dpr;
  c.style.width = W * z + 'px';
  c.style.height = H * z + 'px';
  root.appendChild(c);
  const ctx = c.getContext('2d')!;
  // couche statique pré-rendue une fois par royaume (comme le jeu)
  const statics = KINGDOMS.map((th) => {
    const b = document.createElement('canvas');
    b.width = cellW * dpr;
    b.height = cellH * dpr;
    const bc = b.getContext('2d')!;
    bc.setTransform(dpr, 0, 0, dpr, WALL * dpr, WALL * dpr);
    paintArenaStatic(bc, SAMPLE_GRID, th);
    return b;
  });
  const cast = ['scout', 'goblin', 'moth', 'snipper', 'wolf', 'mushroom'];
  const frame = (ms: number) => {
    const t = frozen ?? ms / 1000;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paintFrame(ctx, W, H, PAD + 40, PAD, KINGDOMS[0]);
    KINGDOMS.forEach((th, i) => {
      const ox = PAD + i * (cellW + PAD) + WALL;
      const oy = PAD + 40 + WALL;
      ctx.save();
      ctx.translate(ox, oy);
      ctx.drawImage(statics[i], -WALL, -WALL, cellW, cellH);
      paintLiquids(ctx, SAMPLE_GRID, th, t);
      paintDecorAnim(ctx, SAMPLE_GRID, th, t);
      paintPortal(ctx, th, t, i === 4 ? 1 : 0);
      cast.forEach((n, j) => {
        const x = 70 + ((j * 97 + t * 22) % (AW - 140));
        const y = 190 + j * 70 + (j === 1 ? 210 : 0);
        ctx.save();
        ctx.translate(x, y);
        PAINTERS[n](ctx, { t: t + j, facing: 0.1, state: j === 4 ? 'windup' : 'move', windup: (t * 0.7) % 1, flash: 0, elite: false, seed: j + 1 });
        ctx.restore();
      });
      ctx.restore();
      ctx.fillStyle = CUT;
      ctx.font = '600 14px "Alegreya Sans", sans-serif';
      ctx.fillText(`${th.id}. ${th.name}`, ox, PAD + 26);
    });
    if (frozen === null) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

/** ?sheet&bench : coût de dessin de 30 ennemis + l'héroïne (ms par image, affiché et loggé). */
function bench(root: HTMLElement): void {
  const c = document.createElement('canvas');
  c.width = 430 * 2;
  c.height = 900 * 2;
  root.appendChild(c);
  const ctx = c.getContext('2d')!;
  const kinds = ['goblin', 'jelly', 'bat', 'mushroom', 'wolf', 'skeleton', 'totem', 'mage', 'moth', 'snipper'];
  const states: AnimState[] = ['idle', 'move', 'windup', 'move', 'charge'];
  const N = 240;
  const t0 = performance.now();
  for (let f = 0; f < N; f++) {
    const t = f / 60;
    ctx.setTransform(2, 0, 0, 2, 0, 0);
    ctx.fillStyle = KINGDOMS[0].paper;
    ctx.fillRect(0, 0, 430, 900);
    for (let i = 0; i < 30; i++) {
      ctx.save();
      ctx.translate(30 + (i % 6) * 70, 40 + Math.floor(i / 6) * 150);
      PAINTERS[kinds[i % kinds.length]](ctx, { t, facing: i, state: states[i % 5], windup: (t + i * 0.1) % 1, flash: 0, elite: i % 7 === 0, seed: i, hurt: i % 4 === 0 ? (t * 3) % 1 : 0 });
      ctx.restore();
    }
    ctx.save();
    ctx.translate(215, 800);
    PAINTERS.scout(ctx, { t, facing: 0.4, state: 'move', windup: 0, flash: 0, elite: false, seed: 0 });
    ctx.restore();
  }
  ctx.getImageData(0, 0, 1, 1);
  const ms = (performance.now() - t0) / N;
  console.log(`bench ${ms.toFixed(2)} ms/frame`);
  const p = document.createElement('p');
  p.textContent = `30 ennemis + héroïne : ${ms.toFixed(2)} ms par image`;
  p.style.color = '#fff';
  root.prepend(p);
}
