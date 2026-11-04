/**
 * §2 Contrôles à ancre flottante. Module pur, partagé par le prototype web et
 * reproduit à l'identique en Swift (ios/Game/TouchControl.swift).
 */
import { CONTROL } from './constants.js';

export interface Vec {
  x: number;
  y: number;
}

export class FloatingAnchor {
  anchor: Vec | null = null;
  finger: Vec | null = null;
  private touchId: number | null = null;

  /** Un deuxième doigt est ignoré (pas de geste caché). */
  down(id: number, p: Vec): void {
    if (this.touchId !== null) return;
    this.touchId = id;
    this.anchor = { ...p };
    this.finger = { ...p };
  }

  move(id: number, p: Vec): void {
    if (id !== this.touchId || !this.anchor) return;
    this.finger = { ...p };
    const dx = p.x - this.anchor.x;
    const dy = p.y - this.anchor.y;
    const d = Math.hypot(dx, dy);
    if (d > CONTROL.maxAnchorDist) {
      // l'ancre glisse pour rester à 70 pt du doigt
      const k = (d - CONTROL.maxAnchorDist) / d;
      this.anchor.x += dx * k;
      this.anchor.y += dy * k;
    }
  }

  up(id: number): void {
    if (id !== this.touchId) return;
    this.touchId = null;
    this.anchor = null;
    this.finger = null;
  }

  get touching(): boolean {
    return this.touchId !== null;
  }

  /** Vitesse désirée normalisée : direction × facteur [0,1]. */
  intent(): Vec {
    return intentFromVector(this.anchor && this.finger ? { x: this.finger.x - this.anchor.x, y: this.finger.y - this.anchor.y } : null);
  }
}

export function intentFromVector(v: Vec | null): Vec {
  if (!v) return { x: 0, y: 0 };
  const d = Math.hypot(v.x, v.y);
  if (d <= CONTROL.deadZone) return { x: 0, y: 0 };
  const f = Math.min(1, (d - CONTROL.deadZone) / CONTROL.fullSpeedSpan);
  return { x: (v.x / d) * f, y: (v.y / d) * f };
}
