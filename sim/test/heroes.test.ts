import { describe, it, expect } from 'vitest';
import {
  Arena,
  World,
  newHero,
  NO_TALENTS,
  NO_GEAR,
  computeStats,
  offerPowers,
  Rng,
  POWER_BY_ID,
  GEAR,
  GEAR_BY_ID,
  gearStats,
  levelLoot,
  lootRarity,
  upgradeCost,
  salvageValue,
  MAX_LEVEL,
  expectedGear,
  talentsAtRank,
  GUST,
  type RoomTemplate,
  type MinionType,
  type HeroKind,
  type PowerId,
} from '../src/index.js';
import { loadRooms } from './helpers.js';

const open = loadRooms().find((r) => r.id === 'room_01') as RoomTemplate;

function setup(kind: HeroKind, type: MinionType = 'jelly', c = 4, r = 7, powers: Partial<Record<PowerId, number>> = {}): World {
  const hero = newHero(NO_TALENTS, powers, false, { kind });
  const w = new World({ arena: new Arena(open), D: 1, waves: [[{ type, c, r }]], seed: 3 }, hero);
  for (let i = 0; i < 40; i++) w.step({ mx: 0, my: 0, touching: false });
  return w;
}

function run(w: World, mx: number, my: number, steps: number): void {
  for (let i = 0; i < steps; i++) w.step({ mx, my, touching: mx !== 0 || my !== 0 });
}

describe('Moine du vent : élan et bourrasque (DECISIONS #74)', () => {
  it('courir charge l’élan, s’arrêter libère une bourrasque qui blesse et repousse', () => {
    const w = setup('gust', 'totem');
    const e = w.enemies[0];
    w.hero.pos = { x: e.pos.x - 160, y: e.pos.y + 40 };
    run(w, 1, 0, 30); // 1 s de course : élan plein, on finit près du totem
    expect(w.hero.momentum).toBeGreaterThan(0.95);
    const hp0 = e.hp;
    let gust = null as null | { r: number; hits: number };
    for (let i = 0; i < 3 && !gust; i++) {
      w.step({ mx: 0, my: 0, touching: false });
      for (const ev of w.events) if (ev.e === 'gust') gust = ev;
    }
    expect(gust).not.toBeNull();
    expect(gust!.hits).toBe(1);
    expect(e.hp).toBeLessThan(hp0);
    expect(w.hero.momentum).toBe(0);
  });

  it('pas de bourrasque sans élan suffisant ; les projectiles ennemis sont dissipés', () => {
    const w = setup('gust', 'jelly', 0, 1);
    run(w, 1, 0, 5); // 0,17 s : élan < seuil
    w.step({ mx: 0, my: 0, touching: false });
    expect(w.events.some((ev) => ev.e === 'gust')).toBe(false);
    // une course (0,6 s, loin des murs), un projectile ennemi tout près, puis l'arrêt
    run(w, 0, -1, 18);
    w.enemyShot({ x: w.hero.pos.x + 30, y: w.hero.pos.y }, Math.PI, 10, 50);
    w.step({ mx: 0, my: 0, touching: false });
    expect(w.projectiles.filter((p) => !p.fromHero).length).toBe(0);
  });

  it('Œil du cyclone renvoie les projectiles au lieu de les dissiper', () => {
    const w = setup('gust', 'jelly', 0, 1, { eyeOfStorm: 1 });
    run(w, 0, -1, 18);
    w.enemyShot({ x: w.hero.pos.x + 30, y: w.hero.pos.y }, Math.PI, 10, 50);
    w.step({ mx: 0, my: 0, touching: false });
    expect(w.projectiles.some((p) => p.fromHero && p.src === 'gust')).toBe(true);
  });
});

describe('Sorcier de braise : traînée de braises (DECISIONS #74)', () => {
  it('un ennemi au sol qui marche sur la traînée brûle ; pas les volants', () => {
    const w = setup('ember', 'jelly');
    const e = w.enemies[0];
    // passer juste à côté de la gelée
    w.hero.pos = { x: e.pos.x - 120, y: e.pos.y + 6 };
    run(w, 1, 0, 25);
    expect(w.hero.embers.length).toBeGreaterThan(5);
    run(w, 0, 0, 6);
    expect(e.emberT).toBeGreaterThan(0);
    expect(w.hero.dmgBy.sig).toBeGreaterThan(0);
    const b = setup('ember', 'bat');
    const bat = b.enemies[0];
    b.hero.pos = { x: bat.pos.x - 120, y: bat.pos.y };
    run(b, 1, 0, 25);
    expect(bat.emberT).toBe(0);
  });

  it('l’Éclaireuse ne sème pas de braises et le Sorcier ne déroule pas de fil', () => {
    const t = setup('thread');
    run(t, 1, 0, 20);
    expect(t.hero.embers.length).toBe(0);
    expect(t.hero.thread.length).toBeGreaterThan(0);
    const s = setup('ember');
    run(s, 1, 0, 20);
    expect(s.hero.thread.length).toBe(0);
  });
});

describe('Pouvoirs signature', () => {
  it('chaque héros ne reçoit que sa famille signature (première carte comprise)', () => {
    for (const fam of ['thread', 'wind', 'ember'] as const) {
      const rng = new Rng(7);
      for (let i = 0; i < 200; i++) {
        const offer = offerPowers(rng, {}, 3, fam);
        expect(POWER_BY_ID[offer[0]].family).toBe(fam);
        for (const id of offer) {
          const f = POWER_BY_ID[id].family;
          expect(f === fam || !['thread', 'wind', 'ember'].includes(f)).toBe(true);
        }
      }
    }
  });
});

describe('Nouveaux ennemis (DECISIONS #73)', () => {
  it('le scarabée bloque les aiguilles de face', () => {
    const w = setup('thread', 'beetle');
    const e = w.enemies[0];
    e.aim = { x: -1, y: 0 }; // bouclier tourné vers la gauche
    w.hero.pos = { x: e.pos.x - 200, y: e.pos.y };
    w.hero.autoFire = true;
    let blocks = 0;
    for (let i = 0; i < 40; i++) {
      e.aim = { x: -1, y: 0 };
      w.step({ mx: 0, my: 0, touching: false });
      for (const ev of w.events) if (ev.e === 'block') blocks++;
    }
    expect(blocks).toBeGreaterThan(0);
    expect(e.hp).toBe(e.maxHp);
  });

  it('un lampion abattu pendant son gonflement n’explose pas', () => {
    const w = setup('thread', 'lantern');
    const e = w.enemies[0];
    w.hero.pos = { x: e.pos.x, y: e.pos.y + 60 };
    for (let i = 0; i < 30 && e.state !== 'windup'; i++) w.step({ mx: 0, my: 0, touching: false });
    expect(e.state).toBe('windup');
    expect(w.hazards.some((z) => z.ownerId === e.id && z.dmg > 0)).toBe(true);
    e.hp = 0;
    w.step({ mx: 0, my: 0, touching: false });
    expect(w.hazards.some((z) => z.ownerId === e.id)).toBe(false);
  });

  it('la toile ralentit l’héroïne', () => {
    const w = setup('thread', 'totem');
    w.hazards.push({ kind: 'circle', pos: { ...w.hero.pos }, radius: 60, born: w.t, activeAt: w.t, endAt: w.t + 5, dmg: 0, tick: 0, nextTick: Infinity, ownerId: 999, slow: 0.45 });
    const x0 = w.hero.pos.x;
    w.step({ mx: 1, my: 0, touching: true });
    expect(w.hero.pos.x - x0).toBeCloseTo(w.hero.stats.speed * 0.55 / 30, 3);
  });
});

describe('Équipement (DECISIONS #75)', () => {
  it('sans équipement, les statistiques sont identiques au bit près', () => {
    const t = talentsAtRank(4);
    const p: Partial<Record<PowerId, number>> = { damage: 2, maxHp: 1, crit: 1, dodge: 1, sharpScissors: 2 };
    const a = computeStats(t, p);
    const b = computeStats(t, p, NO_GEAR);
    expect(b).toEqual(a);
    expect(b.maxHp).toBe(Math.round(600 * 1.08 * 1.2));
  });

  it('un objet par emplacement, statistique principale qui monte avec le niveau', () => {
    const g = gearStats([{ uid: 1, id: 'crowPin', level: 1 }, { uid: 2, id: 'sewingNeedle', level: 10 }, { uid: 3, id: 'juteCloak', level: 1 }]);
    expect(g.dmg).toBeCloseTo(0.035, 6); // la deuxième aiguille est ignorée
    expect(g.crit).toBeCloseTo(0.03, 6);
    expect(g.hp).toBeCloseTo(0.02, 6);
    const hi = gearStats([{ uid: 1, id: 'crowPin', level: 20 }]);
    expect(hi.dmg).toBeGreaterThan(g.dmg);
  });

  it('butin annoncé et sans hasard : 6 objets par chapitre, légendaire aux boss de fin de royaume', () => {
    let n = 0;
    for (let k = 1; k <= 300; k++) {
      const a = levelLoot(k);
      const b = levelLoot(k);
      expect(a).toEqual(b);
      if (a) {
        n++;
        expect(GEAR_BY_ID[a.id].rarity).toBe(lootRarity(k));
      }
    }
    expect(n).toBe(90);
    expect(GEAR_BY_ID[levelLoot(3)!.id].slot).toBe('needle');
    expect(lootRarity(60)).toBe('legendary');
    expect(lootRarity(40)).toBe('epic');
  });

  it('coûts d’amélioration croissants, recyclage qui rend la moitié des éclats investis', () => {
    for (const def of GEAR) {
      let prev = 0;
      for (let l = 1; l < MAX_LEVEL[def.rarity]; l++) {
        const c = upgradeCost(def, l)!;
        expect(c.gold).toBeGreaterThanOrEqual(prev);
        prev = c.gold;
      }
      expect(upgradeCost(def, MAX_LEVEL[def.rarity])).toBeNull();
      expect(salvageValue(def, 5)).toBeGreaterThan(salvageValue(def, 1));
    }
  });

  it('équipement attendu (modèle des bots) qui progresse avec la saga', () => {
    const p = (n: number) => {
      const g = gearStats(expectedGear(n));
      return g.dmg + g.hp + g.rate + g.sig;
    };
    expect(expectedGear(1)).toEqual([]);
    expect(p(100)).toBeGreaterThan(p(20));
    expect(p(300)).toBeGreaterThanOrEqual(p(100));
  });
});

void GUST;
