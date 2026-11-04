/** §3 Arène : grille, collisions, ligne de vue, champ de déplacement. */
import { CELL, COLS, ROWS, ARENA_W, ARENA_H, MAX_OBSTACLES } from './constants.js';
import type { Vec } from './controls.js';

export const enum Tile {
  Free = 0,
  Rock = 1,
  Water = 2,
  Hedge = 3,
}

export interface RoomTemplate {
  id: string;
  name: string;
  symmetric: boolean;
  grid: string[];
}

export class Arena {
  readonly tiles: Uint8Array;
  readonly portal: Vec;
  readonly spawn: Vec;
  /** Distance (en cases) vers la case cible, recalculée à la demande. */
  private flow = new Int16Array(COLS * ROWS);
  private flowTarget = -1;

  constructor(readonly template: RoomTemplate) {
    this.tiles = new Uint8Array(COLS * ROWS);
    let portal: Vec | null = null;
    let spawn: Vec | null = null;
    for (let r = 0; r < ROWS; r++) {
      const row = template.grid[r];
      for (let c = 0; c < COLS; c++) {
        const ch = row[c];
        let t = Tile.Free;
        if (ch === '#') t = Tile.Rock;
        else if (ch === '~') t = Tile.Water;
        else if (ch === '%') t = Tile.Hedge;
        else if (ch === 'P') portal = cellCenter(c, r);
        else if (ch === 'S') spawn = cellCenter(c, r);
        this.tiles[r * COLS + c] = t;
      }
    }
    this.portal = portal ?? cellCenter(4, 0);
    this.spawn = spawn ?? cellCenter(4, ROWS - 1);
  }

  tile(c: number, r: number): Tile {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return Tile.Rock;
    return this.tiles[r * COLS + c] as Tile;
  }

  /** Bloque le déplacement au sol : rocher, eau/lave, haie. */
  blocksWalk(c: number, r: number): boolean {
    return this.tile(c, r) !== Tile.Free;
  }
  /** Bloque les projectiles : rocher, haie (+ murs extérieurs). */
  blocksShot(c: number, r: number): boolean {
    const t = this.tile(c, r);
    return t === Tile.Rock || t === Tile.Hedge;
  }
  /** Bloque la vue : rocher et haie (sauf pour les volants, cf. losFlying). */
  blocksSight(c: number, r: number): boolean {
    return this.blocksShot(c, r);
  }

  isShotBlockedAt(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= ARENA_W || y >= ARENA_H) return true;
    return this.blocksShot(Math.floor(x / CELL), Math.floor(y / CELL));
  }

  isWalkableAt(x: number, y: number): boolean {
    if (x < 0 || y < 0 || x >= ARENA_W || y >= ARENA_H) return false;
    return !this.blocksWalk(Math.floor(x / CELL), Math.floor(y / CELL));
  }

  /** Ligne de vue (échantillonnage en pas de 8 pt). */
  lineOfSight(a: Vec, b: Vec, flyingTarget = false): boolean {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    const steps = Math.ceil(d / 8);
    for (let i = 1; i < steps; i++) {
      const x = a.x + (dx * i) / steps;
      const y = a.y + (dy * i) / steps;
      const c = Math.floor(x / CELL);
      const r = Math.floor(y / CELL);
      const t = this.tile(c, r);
      if (t === Tile.Rock) return false;
      if (t === Tile.Hedge && !flyingTarget) return false;
    }
    return true;
  }

  /**
   * Déplace un cercle de rayon `rad` de (dx,dy) en résolvant les collisions
   * axe par axe contre les cases bloquantes et les bords.
   */
  moveCircle(p: Vec, dx: number, dy: number, rad: number, flying = false): void {
    // bornage de chaque axe avant la résolution : sinon un grand pas hors de l'arène
    // fausse la résolution de l'autre axe contre les cases du bord
    p.x = clamp(p.x + dx, rad, ARENA_W - rad);
    if (!flying) this.resolve(p, rad, true);
    p.y = clamp(p.y + dy, rad, ARENA_H - rad);
    if (!flying) this.resolve(p, rad, false);
    p.x = clamp(p.x, rad, ARENA_W - rad);
    p.y = clamp(p.y, rad, ARENA_H - rad);
  }

  private resolve(p: Vec, rad: number, xAxis: boolean): void {
    const c0 = Math.floor((p.x - rad) / CELL);
    const c1 = Math.floor((p.x + rad) / CELL);
    const r0 = Math.floor((p.y - rad) / CELL);
    const r1 = Math.floor((p.y + rad) / CELL);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (c < 0 || r < 0 || c >= COLS || r >= ROWS) continue;
        if (!this.blocksWalk(c, r)) continue;
        const bx0 = c * CELL;
        const by0 = r * CELL;
        const nx = clamp(p.x, bx0, bx0 + CELL);
        const ny = clamp(p.y, by0, by0 + CELL);
        const ox = p.x - nx;
        const oy = p.y - ny;
        const d2 = ox * ox + oy * oy;
        if (d2 >= rad * rad) continue;
        const d = Math.sqrt(d2);
        if (d > 1e-6) {
          const push = rad - d;
          if (xAxis) p.x += (ox / d) * push;
          else p.y += (oy / d) * push;
          // le résidu sur l'autre axe est traité au passage suivant
        } else {
          // centre dans la case : expulsion par le côté le plus proche sur l'axe courant
          if (xAxis) p.x = p.x - bx0 < CELL / 2 ? bx0 - rad : bx0 + CELL + rad;
          else p.y = p.y - by0 < CELL / 2 ? by0 - rad : by0 + CELL + rad;
        }
      }
    }
  }

  /** Distance BFS (4-voisins) vers la case contenant `target` ; -1 = inaccessible. */
  flowTo(target: Vec): Int16Array {
    const tc = clamp(Math.floor(target.x / CELL), 0, COLS - 1);
    const tr = clamp(Math.floor(target.y / CELL), 0, ROWS - 1);
    const ti = tr * COLS + tc;
    if (ti === this.flowTarget) return this.flow;
    this.flowTarget = ti;
    const f = this.flow;
    f.fill(-1);
    const q = new Int16Array(COLS * ROWS);
    let h = 0;
    let t = 0;
    f[ti] = 0;
    q[t++] = ti;
    while (h < t) {
      const i = q[h++];
      const c = i % COLS;
      const r = (i / COLS) | 0;
      const nb = [
        [c + 1, r],
        [c - 1, r],
        [c, r + 1],
        [c, r - 1],
      ];
      for (const [nc, nr] of nb) {
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
        const ni = nr * COLS + nc;
        if (f[ni] !== -1 || this.blocksWalk(nc, nr)) continue;
        f[ni] = f[i] + 1;
        q[t++] = ni;
      }
    }
    return f;
  }

  /** Direction de marche (vecteur unitaire) vers `target` en suivant le champ BFS. */
  steer(from: Vec, target: Vec): Vec {
    if (this.lineOfWalk(from, target)) return norm(target.x - from.x, target.y - from.y);
    const f = this.flowTo(target);
    const c = Math.floor(from.x / CELL);
    const r = Math.floor(from.y / CELL);
    let best = -1;
    let bx = 0;
    let by = 0;
    const cur = this.tile(c, r) === Tile.Free ? f[r * COLS + c] : 9999;
    for (const [dc, dr] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [1, 1],
      [1, -1],
      [-1, 1],
      [-1, -1],
    ]) {
      const nc = c + dc;
      const nr = r + dr;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
      const v = f[nr * COLS + nc];
      if (v < 0) continue;
      // pas de coupe de coin diagonal
      if (dc !== 0 && dr !== 0 && (this.blocksWalk(c + dc, r) || this.blocksWalk(c, r + dr))) continue;
      if (best === -1 || v < best) {
        best = v;
        bx = dc;
        by = dr;
      }
    }
    if (best === -1 || best >= cur) return norm(target.x - from.x, target.y - from.y);
    const goal = cellCenter(c + bx, r + by);
    return norm(goal.x - from.x, goal.y - from.y);
  }

  /** Chemin droit praticable (sans obstacle de marche) entre deux points. */
  lineOfWalk(a: Vec, b: Vec): boolean {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const d = Math.hypot(dx, dy);
    const steps = Math.ceil(d / 11);
    for (let i = 1; i <= steps; i++) {
      const x = a.x + (dx * i) / steps;
      const y = a.y + (dy * i) / steps;
      if (!this.isWalkableAt(x, y)) return false;
    }
    return true;
  }

  /** Cases libres (centres), pour placer les ennemis. */
  freeCells(): { c: number; r: number }[] {
    const out: { c: number; r: number }[] = [];
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (this.tile(c, r) === Tile.Free) out.push({ c, r });
    return out;
  }
}

export function cellCenter(c: number, r: number): Vec {
  return { x: c * CELL + CELL / 2, y: r * CELL + CELL / 2 };
}

export function clamp(v: number, a: number, b: number): number {
  return v < a ? a : v > b ? b : v;
}

export function norm(x: number, y: number): Vec {
  const d = Math.hypot(x, y);
  return d < 1e-9 ? { x: 0, y: 0 } : { x: x / d, y: y / d };
}

/** Validation d'un gabarit de salle (§3). Renvoie la liste des erreurs. */
export function validateRoom(t: RoomTemplate): string[] {
  const errs: string[] = [];
  if (!t.id || !t.name) errs.push('id/name manquant');
  if (!Array.isArray(t.grid) || t.grid.length !== ROWS) {
    errs.push(`grille : ${ROWS} lignes attendues`);
    return errs;
  }
  let obstacles = 0;
  let portals = 0;
  let spawns = 0;
  for (let r = 0; r < ROWS; r++) {
    const row = t.grid[r];
    if (row.length !== COLS) errs.push(`ligne ${r} : ${COLS} colonnes attendues`);
    for (const ch of row) {
      if (!'.#~%PS'.includes(ch)) errs.push(`caractère inconnu « ${ch} » ligne ${r}`);
      if ('#~%'.includes(ch)) obstacles++;
      if (ch === 'P') portals++;
      if (ch === 'S') spawns++;
    }
  }
  if (obstacles > MAX_OBSTACLES) errs.push(`${obstacles} obstacles (> ${MAX_OBSTACLES})`);
  if (portals !== 1 || t.grid[0][4] !== 'P') errs.push('portail unique attendu en (ligne 0, col 4)');
  if (spawns !== 1 || t.grid[ROWS - 1][4] !== 'S') errs.push('départ unique attendu en (ligne 14, col 4)');
  const sym = t.grid.every((row) => row === [...row].reverse().join(''));
  if (sym !== t.symmetric) errs.push(`drapeau symmetric=${t.symmetric} incohérent`);
  for (let r = ROWS - 3; r < ROWS; r++) if (/[#~%]/.test(t.grid[r])) errs.push(`obstacle dans la zone de départ (ligne ${r})`);
  // connexité
  const walk = (c: number, r: number) => '.PS'.includes(t.grid[r][c]);
  const seen = new Set<number>();
  const stack = [(ROWS - 1) * COLS + 4];
  seen.add(stack[0]);
  while (stack.length) {
    const i = stack.pop()!;
    const c = i % COLS;
    const r = (i / COLS) | 0;
    for (const [nc, nr] of [
      [c + 1, r],
      [c - 1, r],
      [c, r + 1],
      [c, r - 1],
    ]) {
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS || !walk(nc, nr)) continue;
      const ni = nr * COLS + nc;
      if (!seen.has(ni)) {
        seen.add(ni);
        stack.push(ni);
      }
    }
  }
  let walkable = 0;
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) if (walk(c, r)) walkable++;
  if (seen.size !== walkable) errs.push(`${walkable - seen.size} case(s) libre(s) isolée(s)`);
  if (!seen.has(4)) errs.push('portail inaccessible');
  return errs;
}
