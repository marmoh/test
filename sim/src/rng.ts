/**
 * Générateur pseudo-aléatoire déterministe (mulberry32) — identique côté TS et Swift.
 * Toute la simulation n'utilise QUE ce générateur : même graine ⇒ même partie.
 */
export class Rng {
  private s: number;
  constructor(seed: number) {
    this.s = seed >>> 0;
  }
  /** Entier non signé 32 bits. */
  nextU32(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  }
  /** Flottant dans [0, 1). */
  next(): number {
    return this.nextU32() / 4294967296;
  }
  range(min: number, max: number): number {
    return min + (max - min) * this.next();
  }
  int(maxExclusive: number): number {
    return Math.floor(this.next() * maxExclusive);
  }
  chance(p: number): boolean {
    return this.next() < p;
  }
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(arr.length)];
  }
  /** Tirage pondéré : renvoie l'index. */
  weighted(weights: readonly number[]): number {
    let total = 0;
    for (const w of weights) total += w;
    let r = this.next() * total;
    for (let i = 0; i < weights.length; i++) {
      r -= weights[i];
      if (r < 0) return i;
    }
    return weights.length - 1;
  }
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
  /** Dérive une sous-graine indépendante (flux séparés : pouvoirs, IA, bot…). */
  fork(salt: number): Rng {
    return new Rng(hash32(this.nextU32() ^ Math.imul(salt, 0x9e3779b1)));
  }
}

export function hash32(x: number): number {
  x = x >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x7feb352d);
  x = Math.imul(x ^ (x >>> 15), 0x846ca68b);
  return (x ^ (x >>> 16)) >>> 0;
}

/** Combine plusieurs entiers en une graine. */
export function seedOf(...parts: number[]): number {
  let h = 0x811c9dc5;
  for (const p of parts) h = hash32(h ^ hash32(p >>> 0));
  return h >>> 0;
}
