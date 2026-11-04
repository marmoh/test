import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RoomTemplate } from '../src/arena.js';

export const ROOMS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content', 'rooms');

export function loadRooms(): RoomTemplate[] {
  return readdirSync(ROOMS_DIR)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(readFileSync(join(ROOMS_DIR, f), 'utf8')) as RoomTemplate);
}

export function roomMap(rooms = loadRooms()): Map<string, RoomTemplate> {
  return new Map(rooms.map((r) => [r.id, r]));
}
