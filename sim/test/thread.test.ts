import { describe, it, expect } from 'vitest';
import { Arena, World, newHero, NO_TALENTS, segX, pointInPoly, polyArea, Bot, BOTS, type RoomTemplate, type MinionType, type PowerId, THREAD, SIM_DT } from '../src/index.js';
import { loadRooms } from './helpers.js';

const open = loadRooms().find((r) => r.id === 'room_01') as RoomTemplate;

/** Une salle vide avec un ennemi (totem immobile au centre par défaut) ; pas de tir auto pour isoler le fil. */
function setup(powers: Partial<Record<PowerId, number>> = {}, type: MinionType = 'totem', c = 4, r = 7): World {
  const hero = newHero(NO_TALENTS, powers, false);
  const w = new World({ arena: new Arena(open), D: 1, waves: [[{ type, c, r }]], seed: 1 }, hero);
  // laisser passer l'apparition
  for (let i = 0; i < 40; i++) w.step({ mx: 0, my: 0, touching: false });
  return w;
}

/** Trace un fil horizontal sous l'ennemi puis reste immobile ; renvoie les coupures observées (par qui). */
function drawAndWait(w: World, steps: number): string[] {
  w.hero.pos = { x: 60, y: 420 };
  w.hero.thread.length = 0;
  walkTo(w, 340, 420);
  const snips: string[] = [];
  for (let i = 0; i < steps && w.hero.thread.length > 1; i++) {
    w.step({ mx: 0, my: 0, touching: false });
    for (const ev of w.events) if (ev.e === 'snip') snips.push(ev.by);
  }
  return snips;
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
    for (let i = 0; i < (THREAD.life + 0.5) / SIM_DT; i++) w.step({ mx: 0, my: 0, touching: false });
    expect(w.hero.thread.length).toBe(0);
  });

  it('une boucle fermée autour d un ennemi le découpe', () => {
    // les projectiles du totem traversent le fil sans le couper (DECISIONS #39)
    const w = setup();
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

  it('un projectile ennemi qui traverse le fil ne le coupe pas', () => {
    const w = setup();
    walkTo(w, w.hero.pos.x + 150, w.hero.pos.y);
    const n = w.hero.thread.length;
    const mid = w.hero.thread[n >> 1];
    w.enemyShot({ x: mid.x, y: mid.y - 30 }, Math.PI / 2, 300, 10, 6);
    let snipped = false;
    for (let i = 0; i < 6; i++) {
      w.step({ mx: 0, my: 0, touching: false });
      snipped ||= w.events.some((ev) => ev.e === 'snip');
    }
    expect(snipped).toBe(false);
    expect(w.hero.thread.length).toBe(n);
  });

  it('un ennemi au sol qui marche sur le fil ne le coupe pas', () => {
    const w = setup({}, 'jelly', 4, 7);
    const jelly = w.enemies[0];
    w.hero.pos = { x: 40, y: 420 };
    w.hero.thread.length = 0;
    // un U ouvert sous la gelée : elle franchit le haut du U pour rejoindre l'héroïne
    let touched = false;
    let snipped = false;
    for (const [x, y] of [[360, 420], [360, 600], [40, 600]]) {
      for (let k = 0; k < 200; k++) {
        const dx = x - w.hero.pos.x;
        const dy = y - w.hero.pos.y;
        const d = Math.hypot(dx, dy);
        if (d < 4) break;
        w.step({ mx: dx / d, my: dy / d, touching: true });
        touched ||= w.hero.thread.slice(0, -4).some((p) => Math.hypot(p.x - jelly.pos.x, p.y - jelly.pos.y) < jelly.radius);
        snipped ||= w.events.some((ev) => ev.e === 'snip');
      }
    }
    expect(touched).toBe(true);
    expect(snipped).toBe(false);
  });

  it('la mite de papier grignote le fil', () => {
    const snips = drawAndWait(setup({}, 'moth', 4, 6), 150);
    expect(snips).toContain('moth');
  });

  it('la charge du crabe-ciseaux tranche le fil', () => {
    const snips = drawAndWait(setup({}, 'snipper', 4, 5), 170);
    expect(snips).toContain('snipper');
  });

  it("fil d'acier : ni la mite ni le crabe ne coupent le fil", () => {
    expect(drawAndWait(setup({ steelThread: 1 }, 'moth', 4, 6), 150)).toEqual([]);
    expect(drawAndWait(setup({ steelThread: 1 }, 'snipper', 4, 5), 170)).toEqual([]);
  });

  it('fil barbelé : un ennemi qui touche le fil se blesse', () => {
    const w = setup({ barbedThread: 1 }, 'jelly', 4, 6);
    const jelly = w.enemies[0];
    const hp0 = jelly.hp;
    drawAndWait(w, 90);
    expect(jelly.hp).toBeLessThan(hp0);
    expect(w.hero.dmgBy.other).toBeGreaterThan(0);
  });
});

describe('Ciseaux de lune — bots', () => {
  it('le bot trace des boucles autour des poursuivants et les découpe', () => {
    const hero = newHero(NO_TALENTS);
    const waves = [0, 1, 2].map((k) => [
      { type: 'jelly' as const, c: 2 + k, r: 3 },
      { type: 'jelly' as const, c: 6 - k, r: 6 },
    ]);
    const w = new World({ arena: new Arena(open), D: 1, waves, seed: 3 }, hero);
    const bot = new Bot(BOTS.expert, 5);
    bot.beginRoom();
    while (!w.cleared && !w.dead && w.t < 120) w.step(bot.input(w));
    expect(w.cleared).toBe(true);
    expect(bot.loops.started).toBeGreaterThan(0);
    expect(hero.cuts).toBeGreaterThan(2);
    // les découpes portent l'essentiel des dégâts contre des gelées
    expect(hero.dmgBy.cut).toBeGreaterThan(hero.dmgBy.shot);
  });

  it('instrumentation : dégâts par source plafonnés aux PV', () => {
    const w = setup();
    const e = w.enemies[0];
    const hp0 = e.hp;
    const cut0 = w.hero.dmgBy.cut;
    w.performCut(
      [
        { x: e.pos.x - 50, y: e.pos.y - 50 },
        { x: e.pos.x + 50, y: e.pos.y - 50 },
        { x: e.pos.x + 50, y: e.pos.y + 50 },
        { x: e.pos.x - 50, y: e.pos.y + 50 },
      ],
      100,
      false,
    );
    expect(w.hero.dmgBy.cut - cut0).toBeCloseTo(hp0, 5);
  });
});
