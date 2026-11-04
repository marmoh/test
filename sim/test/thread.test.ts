import { describe, it, expect } from 'vitest';
import { Arena, World, newHero, NO_TALENTS, segX, pointInPoly, polyArea, type RoomTemplate } from '../src/index.js';
import { loadRooms } from './helpers.js';

const open = loadRooms().find((r) => r.id === 'room_01') as RoomTemplate;

/** Une salle vide avec un gobelin immobile au centre (pas d'autofire pour isoler la découpe). */
function setup(steel = false): World {
  const hero = newHero(NO_TALENTS, steel ? { steelThread: 1 } : {}, false);
  const w = new World({ arena: new Arena(open), D: 1, waves: [[{ type: 'totem', c: 4, r: 7 }]], seed: 1 }, hero);
  // laisser passer l'apparition
  for (let i = 0; i < 40; i++) w.step({ mx: 0, my: 0, touching: false });
  return w;
}

function walkTo(w: World, x: number, y: number): void {
  for (let k = 0; k < 200; k++) {
    const dx = x - w.hero.pos.x;
    const dy = y - w.hero.pos.y;
    const d = Math.hypot(dx, dy);
    if (d < 4) return;
    w.step({ mx: dx / d, my: dy / d, touching: true });
  }
}

describe('Ciseaux de lune', () => {
  it('géométrie : intersection, aire, point dans un polygone', () => {
    expect(segX({ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }, { x: 10, y: 0 })).toEqual({ x: 5, y: 5 });
    expect(segX({ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 })).toBeNull();
    const sq = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(Math.abs(polyArea(sq))).toBe(100);
    expect(pointInPoly({ x: 5, y: 5 }, sq)).toBe(true);
    expect(pointInPoly({ x: 15, y: 5 }, sq)).toBe(false);
  });

  it('le fil se déroule en marchant et sèche avec le temps', () => {
    const w = setup();
    walkTo(w, w.hero.pos.x, w.hero.pos.y - 120);
    expect(w.hero.thread.length).toBeGreaterThan(6);
    for (let i = 0; i < 120; i++) w.step({ mx: 0, my: 0, touching: false });
    expect(w.hero.thread.length).toBe(0);
  });

  it('une boucle fermée autour d un ennemi le découpe', () => {
    // fil d'acier : les projectiles du totem ne coupent pas le fil pendant le test
    const w = setup(true);
    const e = w.enemies[0];
    const hp0 = e.hp;
    const cx = e.pos.x;
    const cy = e.pos.y;
    const r = 60;
    walkTo(w, cx, cy + r);
    w.hero.thread.length = 0;
    let cut = false;
    for (let k = 0; k <= 26 && !cut; k++) {
      const a = Math.PI / 2 + (k / 24) * Math.PI * 2;
      walkTo(w, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      cut = w.hero.cuts > 0;
    }
    expect(cut).toBe(true);
    expect(e.hp).toBeLessThan(hp0);
  });

  it('un projectile ennemi qui traverse le fil le coupe', () => {
    const w = setup();
    walkTo(w, w.hero.pos.x + 150, w.hero.pos.y);
    const n = w.hero.thread.length;
    const mid = w.hero.thread[n >> 1];
    w.enemyShot({ x: mid.x, y: mid.y - 30 }, Math.PI / 2, 300, 10, 6);
    for (let i = 0; i < 6; i++) w.step({ mx: 0, my: 0, touching: false });
    expect(w.hero.thread.length).toBeLessThan(n);
  });
});
