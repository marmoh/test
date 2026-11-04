import { describe, it, expect } from 'vitest';
import { FloatingAnchor, intentFromVector, CONTROL } from '../src/index.js';

const len = (v: { x: number; y: number }) => Math.hypot(v.x, v.y);

describe('§2 contrôles à ancre flottante', () => {
  it('constantes SPEC', () => {
    expect(CONTROL).toMatchObject({ deadZone: 8, fullSpeedSpan: 40, maxAnchorDist: 70 });
  });

  it('zone morte de 8 pt, rampe de 40 pt', () => {
    expect(intentFromVector(null)).toEqual({ x: 0, y: 0 });
    expect(intentFromVector({ x: 8, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(len(intentFromVector({ x: 0, y: 5 }))).toBe(0);
    expect(len(intentFromVector({ x: 28, y: 0 }))).toBeCloseTo(0.5, 10);
    expect(len(intentFromVector({ x: 0, y: -48 }))).toBeCloseTo(1, 10);
    expect(len(intentFromVector({ x: 60, y: 60 }))).toBeCloseTo(1, 10);
    const d = intentFromVector({ x: 0, y: -20 });
    expect(d.x).toBeCloseTo(0, 10);
    expect(d.y).toBeCloseTo(-0.3, 10);
  });

  it("l'ancre glisse pour rester à 70 pt du doigt", () => {
    const a = new FloatingAnchor();
    a.down(1, { x: 100, y: 100 });
    expect(a.intent()).toEqual({ x: 0, y: 0 });
    a.move(1, { x: 150, y: 100 });
    expect(a.anchor).toEqual({ x: 100, y: 100 });
    a.move(1, { x: 300, y: 100 });
    expect(a.anchor!.x).toBeCloseTo(230, 10);
    expect(a.anchor!.y).toBeCloseTo(100, 10);
    // retour en arrière : la direction s'inverse sans revenir à l'ancre d'origine
    a.move(1, { x: 200, y: 100 });
    expect(a.intent().x).toBeLessThan(0);
    expect(len(a.intent())).toBeCloseTo(Math.min(1, (30 - 8) / 40), 10);
    a.up(1);
    expect(a.touching).toBe(false);
    expect(a.intent()).toEqual({ x: 0, y: 0 });
  });

  it('un deuxième doigt est ignoré', () => {
    const a = new FloatingAnchor();
    a.down(1, { x: 0, y: 0 });
    a.down(2, { x: 50, y: 50 });
    a.move(2, { x: 200, y: 200 });
    expect(a.anchor).toEqual({ x: 0, y: 0 });
    a.up(2);
    expect(a.touching).toBe(true);
  });
});
