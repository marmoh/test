import { describe, it, expect } from 'vitest';
import { validateRoom, Arena, MAX_OBSTACLES, type RoomTemplate } from '../src/index.js';
import { loadRooms } from './helpers.js';

describe('§3 gabarits de salle', () => {
  const rooms = loadRooms();
  it('24 gabarits, identifiants uniques', () => {
    expect(rooms.length).toBe(24);
    expect(new Set(rooms.map((r) => r.id)).size).toBe(24);
  });
  for (const r of rooms) {
    it(`${r.id} est valide (connexe, portail atteignable, ≤ ${MAX_OBSTACLES} obstacles)`, () => {
      expect(validateRoom(r)).toEqual([]);
      const a = new Arena(r);
      expect(a.flowTo(a.portal)[(14 * 9) + 4]).toBeGreaterThan(0);
    });
  }
  it('le validateur refuse une salle coupée en deux', () => {
    const bad: RoomTemplate = { ...rooms[0], id: 'bad', grid: rooms[0].grid.map((row, i) => (i === 6 ? '#########' : row)) };
    expect(validateRoom(bad).length).toBeGreaterThan(0);
  });
});
