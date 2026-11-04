/** Lecture / écriture des contenus JSON (Node uniquement). */
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RoomTemplate } from '../../sim/src/arena.js';
import type { LevelDef } from '../../sim/src/level.js';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const ROOMS_DIR = join(ROOT, 'content', 'rooms');
export const LEVELS_DIR = join(ROOT, 'content', 'levels');
export const REPORTS_DIR = join(ROOT, 'content', 'reports');

export function loadRooms(): RoomTemplate[] {
  return readdirSync(ROOMS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(ROOMS_DIR, f), 'utf8')) as RoomTemplate);
}

export function roomMap(rooms = loadRooms()): Map<string, RoomTemplate> {
  return new Map(rooms.map((r) => [r.id, r]));
}

export function levelPath(n: number): string {
  return join(LEVELS_DIR, `level_${String(n).padStart(4, '0')}.json`);
}

export function loadLevel(n: number): LevelDef | null {
  const p = levelPath(n);
  return existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as LevelDef) : null;
}

export function saveLevel(l: LevelDef): void {
  mkdirSync(LEVELS_DIR, { recursive: true });
  writeFileSync(levelPath(l.n), JSON.stringify(l, null, 1) + '\n');
}

export function writeReport(name: string, content: string): void {
  mkdirSync(REPORTS_DIR, { recursive: true });
  writeFileSync(join(REPORTS_DIR, name), content);
}
