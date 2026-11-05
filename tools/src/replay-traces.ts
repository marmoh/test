/**
 * pnpm traces — enregistre des traces de rejeu de la simulation TS (entrées par pas → empreintes d'état)
 * dans `content/traces/*.json`. Les tests XCTest (`ios/Tests/ParityTests.swift`) rejouent exactement les mêmes
 * entrées dans le port Swift (`ios/Core/`) et exigent des états identiques au bit près.
 *
 * Contenu :
 * - `math.json` : vecteurs sin / cos / atan2 / hypot / pow de V8 (le Swift utilise `DMath`, port de fdlibm) ;
 * - `levels.json` : niveaux générés (index.json et tournoi) — `generateLevel` doit être identique ;
 * - `run_*.json` : niveaux complets joués par un bot (entrées enregistrées), empreinte tous les 15 pas ;
 * - `room_*.json` : salles scriptées (beaucoup de pouvoirs, boucles du fil, boss à toutes leurs phases).
 *
 * L'empreinte (`stateHash`) est définie ici et dans `ios/Core/StateHash.swift` : même ordre, mêmes champs.
 * Après toute modification de `sim/src` : `pnpm traces`, puis relancer les tests Swift.
 */
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  Arena,
  Bot,
  BOTS,
  World,
  generateLevel,
  hash32,
  newHero,
  runLevel,
  seedOf,
  talentsAtRank,
  NO_TALENTS,
  type BotName,
  type HeroId,
  type HeroInput,
  type LevelDef,
  type PowerId,
  type SpawnSpec,
  type Talents,
  type WorldEvent,
} from '../../sim/src/index.js';
import { ROOT, loadRooms, roomMap } from './content-io.js';

const OUT = join(ROOT, 'content', 'traces');
const EVERY = 15;
const rooms = loadRooms();
const templates = roomMap(rooms);
const index = JSON.parse(readFileSync(join(ROOT, 'content', 'levels', 'index.json'), 'utf8')) as Record<string, { seed: number; budgetScale: number }>;

// ───────────────────────────── empreinte d'état ─────────────────────────────

const f64 = new DataView(new ArrayBuffer(8));
export function hex(x: number): string {
  f64.setFloat64(0, x);
  return f64.getBigUint64(0).toString(16).padStart(16, '0');
}

/** Toutes les clés de pouvoir, triées : ordre canonique de l'empreinte. */
const ALL_POWER_IDS: PowerId[] = [
  'attackSpeed', 'barbedThread', 'blast', 'chain', 'confetti', 'crit', 'damage', 'diagonals', 'dodge', 'echoCut',
  'eliteSlayer', 'flame', 'flashStep', 'frost', 'lifesteal', 'longThread', 'magnet', 'maxHp', 'multishot', 'orb',
  'pierce', 'poison', 'rearShot', 'ricochet', 'sharpScissors', 'shield', 'sideShots', 'speed', 'steelThread', 'wallBounce',
];

export class Hasher {
  h = 0x811c9dc5;
  u32(v: number): void {
    this.h = hash32(this.h ^ (v >>> 0));
  }
  num(x: number): void {
    f64.setFloat64(0, x);
    this.u32(f64.getUint32(4)); // mot de poids faible
    this.u32(f64.getUint32(0)); // mot de poids fort
  }
  int(i: number): void {
    this.u32(i | 0);
  }
  bool(b: boolean): void {
    this.u32(b ? 1 : 0);
  }
  str(s: string): void {
    this.u32(s.length);
    for (let i = 0; i < s.length; i++) this.u32(s.charCodeAt(i));
  }
}

function hashEvent(H: Hasher, ev: WorldEvent): void {
  H.str(ev.e);
  switch (ev.e) {
    case 'shoot':
      H.num(ev.x);
      H.num(ev.y);
      break;
    case 'hit':
      H.num(ev.x);
      H.num(ev.y);
      H.bool(ev.crit);
      break;
    case 'kill':
      H.num(ev.x);
      H.num(ev.y);
      H.str(ev.type);
      break;
    case 'heroHit':
      H.num(ev.dmg);
      H.str(ev.src ?? '');
      break;
    case 'wave':
      H.int(ev.index);
      break;
    case 'cut':
      H.int(ev.poly.length);
      for (const p of ev.poly) {
        H.num(p.x);
        H.num(p.y);
      }
      H.int(ev.hits);
      H.bool(ev.echo);
      break;
    case 'snip':
      H.num(ev.x);
      H.num(ev.y);
      H.str(ev.by);
      break;
    default:
      break;
  }
}

export function stateHash(w: World): number {
  const H = new Hasher();
  const priv = w as unknown as { rng: { s: number }; pendingCuts: unknown[] };
  H.num(w.t);
  H.int(w.waveIndex);
  H.int(w.kills);
  H.bool(w.cleared);
  H.bool(w.exited);
  H.bool(w.dead);
  H.u32(priv.rng.s);
  H.int(w.target ? w.target.id : 0);
  const h = w.hero;
  for (const v of [h.pos.x, h.pos.y, h.vel.x, h.vel.y, h.hp, h.invuln, h.stillTime, h.fireCd, h.aimTime, h.facing]) H.num(v);
  H.bool(h.shieldReady);
  for (const v of [h.shieldCd, h.orbAngle, h.flashT]) H.num(v);
  H.bool(h.moving);
  H.bool(h.autoFire);
  H.num(h.damageTaken);
  H.int(h.hitsTaken);
  H.num(h.cutT);
  H.int(h.cuts);
  for (const v of [h.dmgBy.cut, h.dmgBy.shot, h.dmgBy.other, h.stats.maxHp, h.stats.damage, h.stats.fireRate, h.stats.speed]) H.num(v);
  for (const id of ALL_POWER_IDS) H.int(h.powers[id] ?? 0);
  H.int(h.thread.length);
  for (const p of h.thread) {
    H.num(p.x);
    H.num(p.y);
    H.num(p.t);
  }
  H.int(w.enemies.length);
  for (const e of w.enemies) {
    H.int(e.id);
    H.str(e.type);
    for (const v of [e.pos.x, e.pos.y, e.radius, e.hp, e.maxHp, e.contact, e.shotDmg, e.speed]) H.num(v);
    H.bool(e.flying);
    H.bool(e.elite);
    H.str(e.state);
    for (const v of [e.t, e.cd, e.eliteCd, e.eliteWind, e.aim.x, e.aim.y, e.chargeLeft, e.slowT, e.burnT, e.burnDps]) H.num(v);
    H.int(e.poisonStacks);
    for (const v of [e.poisonT, e.poisonDps, e.orbHitCd, e.strafe]) H.num(v);
    H.int(e.volley);
    if (e.boss) {
      H.int(1 + e.boss.phase);
      H.int(e.boss.patternIdx);
      H.str(e.boss.pattern ? e.boss.pattern.kind : '');
      H.int(e.boss.repeatsLeft);
      H.num(e.boss.breath);
      H.num(e.boss.spin);
    } else H.int(0);
  }
  H.int(w.projectiles.length);
  for (const p of w.projectiles) {
    for (const v of [p.pos.x, p.pos.y, p.vel.x, p.vel.y, p.radius, p.dmg]) H.num(v);
    H.bool(p.fromHero);
    H.num(p.born);
    H.bool(p.pierce);
    H.int(p.wallBounce);
    H.int(p.ricochet);
    H.int(p.lastHit);
    H.bool(p.dead);
    H.str(p.src ?? '');
    H.int(p.ownerId ?? 0);
  }
  H.int(w.hazards.length);
  for (const z of w.hazards) {
    H.str(z.kind);
    H.num(z.pos.x);
    H.num(z.pos.y);
    if (z.to) {
      H.int(1);
      H.num(z.to.x);
      H.num(z.to.y);
    } else H.int(0);
    for (const v of [z.radius, z.born, z.activeAt, z.endAt, z.dmg, z.tick, z.nextTick]) H.num(v);
    H.int(z.ownerId);
    H.str(z.src ?? '');
  }
  H.int(w.orbs.length);
  for (const o of w.orbs) {
    H.num(o.pos.x);
    H.num(o.pos.y);
    H.num(o.heal);
  }
  H.int(w.events.length);
  for (const ev of w.events) hashEvent(H, ev);
  H.int(priv.pendingCuts.length);
  return H.h >>> 0;
}

// ───────────────────────────── enregistrement ─────────────────────────────

interface Snapshot {
  tick: number;
  hash: number;
  t: number;
  x: number;
  y: number;
  hp: number;
  enemies: number;
  projectiles: number;
  kills: number;
  thread: number;
}

function snap(w: World, tick: number): Snapshot {
  return {
    tick,
    hash: stateHash(w),
    t: w.t,
    x: w.hero.pos.x,
    y: w.hero.pos.y,
    hp: w.hero.hp,
    enemies: w.enemies.length,
    projectiles: w.projectiles.length,
    kills: w.kills,
    thread: w.hero.thread.length,
  };
}

/** Entrées compressées par plages : [répétitions, mx (hex), my (hex), doigt posé (0/1)]. */
type InputRun = [number, string, string, number];

class InputLog {
  runs: InputRun[] = [];
  push(i: HeroInput): void {
    const mx = hex(i.mx);
    const my = hex(i.my);
    const t = i.touching ? 1 : 0;
    const last = this.runs[this.runs.length - 1];
    if (last && last[1] === mx && last[2] === my && last[3] === t) last[0]++;
    else this.runs.push([1, mx, my, t]);
  }
}

function write(name: string, data: unknown): void {
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, name), JSON.stringify(data) + '\n');
  console.log(`✓ content/traces/${name}`);
}

function simVersion(): string {
  const dir = join(ROOT, 'sim', 'src');
  const h = createHash('sha256');
  for (const f of readdirSync(dir).sort()) if (f.endsWith('.ts') && f !== 'bot.ts') h.update(readFileSync(join(dir, f)));
  return h.digest('hex').slice(0, 16);
}

const VERSION = simVersion();

// ───────────────────────────── 1. mathématiques ─────────────────────────────

function mathVectors(): void {
  let s = 20261104;
  const r = () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 4294967296;
  };
  const rows: string[][] = [];
  for (let i = 0; i < 1200; i++) {
    const a = (r() - 0.5) * (i % 3 === 0 ? 14 : i % 3 === 1 ? 2400 : 7);
    const b = (r() - 0.5) * 900;
    const c = (r() - 0.5) * 900;
    const px = r() * 300;
    const py = i % 2 ? 0.93 : r() * 3;
    rows.push([a, Math.sin(a), Math.cos(a), b, c, Math.atan2(b, c), Math.hypot(b, c), px, py, Math.pow(px, py)].map(hex));
  }
  // cas limites : multiples de π/2, zéros, axes
  for (let k = -40; k <= 40; k++) {
    const a = (k * Math.PI) / 4;
    rows.push([a, Math.sin(a), Math.cos(a), k, 0, Math.atan2(k, 0), Math.hypot(k, 0), Math.abs(k), 2, Math.pow(Math.abs(k), 2)].map(hex));
    rows.push([a + 1e-9, Math.sin(a + 1e-9), Math.cos(a + 1e-9), 0, k, Math.atan2(0, k), Math.hypot(0, k), k + 41, 0.93, Math.pow(k + 41, 0.93)].map(hex));
  }
  const data = { format: 1, columns: ['a', 'sin', 'cos', 'y', 'x', 'atan2', 'hypot', 'px', 'py', 'pow'], rows };
  guardMath(data);
  write('math.json', data);
}

/**
 * Garde-fou (DECISIONS #68) : le port Swift (`DMath`) reproduit les fonctions de V8 telles qu'elles ont produit
 * `math.json`. Certaines constructions de Node 22 donnent 1 ulp d'écart sur sin / cos / pow (Node 22 de Homebrew
 * sur Mac Apple Silicon : 13 valeurs sur 13 620) ; des traces régénérées là ne seraient plus rejouables en Swift.
 * Si les vecteurs diffèrent de ceux du dépôt, on s'arrête avant d'écrire quoi que ce soit (`--force` pour passer outre).
 */
function guardMath(data: { rows: string[][] }): void {
  const file = join(OUT, 'math.json');
  if (process.argv.includes('--force') || !existsSync(file)) return;
  const old = JSON.parse(readFileSync(file, 'utf8')) as { rows: string[][] };
  const diffs = data.rows.flatMap((row, i) => row.flatMap((v, j) => (old.rows[i]?.[j] === v ? [] : [`ligne ${i}, ${(data as { columns?: string[] }).columns?.[j] ?? j}`])));
  if (diffs.length === 0 && old.rows.length === data.rows.length) return;
  console.error(
    `✗ Ce Node (${process.version}, V8 ${process.versions.v8}, ${process.platform}-${process.arch}) ne calcule pas les fonctions ` +
      `mathématiques comme celui qui a produit content/traces/math.json (${diffs.length} écarts : ${diffs.slice(0, 4).join(' ; ')}…).\n` +
      `  Les traces ne sont PAS régénérées : le port Swift ne pourrait plus les rejouer au bit près.\n` +
      `  Sur Mac Apple Silicon : Node 22 x86-64 sous Rosetta (docs/MAC_PHASE.md, « Traces de parité »), ou Linux ;\n` +
      `  --force seulement si DMath.swift a été adapté.`,
  );
  process.exit(1);
}

// ───────────────────────────── 2. génération des niveaux ─────────────────────────────

const LEVELS = [1, 2, 7, 14, 20, 25, 47, 60, 65, 85, 100, 120, 121, 147, 160, 200, 220, 254, 280, 300];

function levelFromIndex(n: number): LevelDef {
  const e = index[n];
  return generateLevel(n, e?.seed ?? 1, rooms, e?.budgetScale ?? 1);
}

function tournamentLevel(seed: number): LevelDef {
  return generateLevel(120, seed, rooms, 1, { kind: 'hard', mult: 1.35, roomCount: 4 });
}

function levels(): void {
  const out: unknown[] = [];
  for (const n of LEVELS) {
    const e = index[n];
    out.push({ source: 'index', n, seed: e?.seed ?? 1, budgetScale: e?.budgetScale ?? 1, def: levelFromIndex(n) });
  }
  for (const seed of [202645, 202701, 202852]) out.push({ source: 'tournament', n: 120, seed, budgetScale: 1, def: tournamentLevel(seed) });
  // quelques graines arbitraires (chemins rares du générateur : élites, cases épuisées)
  for (const [n, seed, scale] of [[33, 9, 1.3], [134, 77, 1.37], [287, 5, 0.68], [140, 3, 1.1]] as const) {
    out.push({ source: 'seed', n, seed, budgetScale: scale, def: generateLevel(n, seed, rooms, scale) });
  }
  write('levels.json', { format: 1, simVersion: VERSION, levels: out });
}

// ───────────────────────────── 3. niveaux joués par un bot ─────────────────────────────

interface RunSpec {
  name: string;
  level: { source: 'index' | 'tournament'; n: number; seed?: number };
  bot: BotName;
  botSeed: number;
  attemptSeed: number;
  heroId: HeroId;
  talents: Talents;
  potion?: boolean;
  aegis?: boolean;
  scroll?: PowerId | null;
  autoFire?: boolean;
  timeLimit?: number;
}

function recordRun(spec: RunSpec): void {
  const level = spec.level.source === 'tournament' ? tournamentLevel(spec.level.seed!) : levelFromIndex(spec.level.n);
  const bot = new Bot(BOTS[spec.bot], spec.botSeed);
  const log = new InputLog();
  const choices: { offer: PowerId[]; pick: PowerId }[] = [];
  const snaps: Snapshot[] = [];
  let tick = 0;
  const ctl = {
    beginRoom: () => bot.beginRoom(),
    input: (w: World) => {
      const i = bot.input(w);
      log.push(i);
      return i;
    },
    choosePower: (offer: PowerId[], ctx: Parameters<Bot['choosePower']>[1]) => {
      const pick = bot.choosePower(offer, ctx);
      choices.push({ offer: [...offer], pick });
      return pick;
    },
  };
  const r = runLevel(level, templates, ctl, {
    talents: spec.talents,
    heroId: spec.heroId,
    attemptSeed: spec.attemptSeed,
    potion: spec.potion,
    aegis: spec.aegis,
    scroll: spec.scroll ?? null,
    autoFire: spec.autoFire ?? true,
    timeLimit: spec.timeLimit ?? 300,
    onStep: (w) => {
      tick++;
      if (tick % EVERY === 0 || w.dead || w.cleared || w.exited) snaps.push(snap(w, tick));
    },
  });
  write(`run_${spec.name}.json`, {
    format: 1,
    kind: 'run',
    name: spec.name,
    simVersion: VERSION,
    level: { ...spec.level, seed: spec.level.source === 'tournament' ? spec.level.seed : (index[spec.level.n]?.seed ?? 1), budgetScale: spec.level.source === 'tournament' ? 1 : (index[spec.level.n]?.budgetScale ?? 1) },
    options: { talents: spec.talents, heroId: spec.heroId, attemptSeed: spec.attemptSeed, potion: !!spec.potion, aegis: !!spec.aegis, scroll: spec.scroll ?? null, autoFire: spec.autoFire ?? true, timeLimit: spec.timeLimit ?? 300 },
    ticks: tick,
    inputs: log.runs,
    choices,
    snapshots: snaps,
    result: {
      won: r.won,
      stars: r.stars,
      kills: r.kills,
      roomsCleared: r.roomsCleared,
      powers: r.powers,
      hitsTaken: r.hitsTaken,
      timeout: r.timeout,
      cuts: r.cuts,
      hpLeft: hex(r.hpLeft),
      hpFrac: hex(r.hpFrac),
      seconds: hex(r.seconds),
      dmgBy: { cut: hex(r.dmgBy.cut), shot: hex(r.dmgBy.shot), other: hex(r.dmgBy.other) },
      readable: { hpLeft: r.hpLeft, seconds: r.seconds, cutShare: r.dmgBy.cut / Math.max(1, r.dmgBy.cut + r.dmgBy.shot + r.dmgBy.other) },
    },
  });
}

// ───────────────────────────── 4. salles scriptées ─────────────────────────────

interface RoomSpec {
  name: string;
  template: string;
  D: number;
  waves: SpawnSpec[][];
  boss?: { archetype: 'treant' | 'queen' | 'scorpion' | 'wyvern' | 'ashlord'; variant: number; hpMult: number } | null;
  seed: number;
  powers: Partial<Record<PowerId, number>>;
  talents?: Talents;
  hp?: number;
  ticks: number;
}

/** Trajectoire scriptée : boucles autour d'un point qui se déplace, pauses, allers-retours. */
function scripted(tick: number): HeroInput {
  const phase = Math.floor(tick / 150) % 4;
  const k = tick % 150;
  if (phase === 3 && k > 100) return { mx: 0, my: 0, touching: false };
  if (phase === 2) return { mx: Math.sign(Math.sin(tick / 20)) * 0.9, my: Math.cos(tick / 33) * 0.5, touching: true };
  const w = phase === 0 ? 0.13 : -0.11;
  return { mx: Math.cos(tick * w), my: Math.sin(tick * w), touching: k % 47 !== 0 };
}

function recordRoom(spec: RoomSpec): void {
  const tpl = templates.get(spec.template)!;
  const hero = newHero(spec.talents ?? NO_TALENTS, spec.powers, true);
  if (spec.hp) {
    hero.stats.maxHp = spec.hp;
    hero.hp = spec.hp;
  }
  const w = new World({ arena: new Arena(tpl), D: spec.D, waves: spec.waves, boss: spec.boss ?? null, seed: spec.seed }, hero);
  const log = new InputLog();
  const snaps: Snapshot[] = [];
  let tick = 0;
  while (tick < spec.ticks && !w.dead && !w.exited) {
    const i = scripted(tick);
    log.push(i);
    w.step(i);
    tick++;
    if (tick % EVERY === 0 || w.dead) snaps.push(snap(w, tick));
  }
  write(`room_${spec.name}.json`, {
    format: 1,
    kind: 'room',
    name: spec.name,
    simVersion: VERSION,
    room: { template: spec.template, D: spec.D, waves: spec.waves, boss: spec.boss ?? null, seed: spec.seed },
    hero: { talents: spec.talents ?? NO_TALENTS, powers: spec.powers, hp: spec.hp ?? null },
    ticks: tick,
    inputs: log.runs,
    snapshots: snaps,
    final: { kills: w.kills, cleared: w.cleared, dead: w.dead, cuts: w.hero.cuts, hash: stateHash(w) },
  });
}

const mix = (types: SpawnSpec['type'][], eliteEvery = 0): SpawnSpec[] =>
  types.map((type, i) => ({ type, c: (i * 3 + 1) % 9, r: 1 + ((i * 5) % 8), ...(eliteEvery && i % eliteEvery === 0 ? { elite: true } : {}) }));

function main(): void {
  mathVectors();
  levels();
  const runs: RunSpec[] = [
    { name: 'l001_expert', level: { source: 'index', n: 1 }, bot: 'expert', botSeed: seedOf(1, 7), attemptSeed: 1, heroId: 'scout', talents: NO_TALENTS },
    { name: 'l007_moyen', level: { source: 'index', n: 7 }, bot: 'moyen', botSeed: seedOf(2, 7), attemptSeed: 2, heroId: 'scout', talents: NO_TALENTS },
    { name: 'l020_boss_expert', level: { source: 'index', n: 20 }, bot: 'expert', botSeed: seedOf(3, 7), attemptSeed: 3, heroId: 'scout', talents: NO_TALENTS, potion: true, aegis: true },
    { name: 'l047_ember', level: { source: 'index', n: 47 }, bot: 'expert', botSeed: seedOf(4, 7), attemptSeed: 4, heroId: 'emberSorcerer', talents: talentsAtRank(1) },
    { name: 'l085_monk', level: { source: 'index', n: 85 }, bot: 'moyen', botSeed: seedOf(5, 7), attemptSeed: 5, heroId: 'windMonk', talents: talentsAtRank(3), scroll: 'steelThread' },
    { name: 'l147_expert', level: { source: 'index', n: 147 }, bot: 'expert', botSeed: seedOf(6, 7), attemptSeed: 6, heroId: 'scout', talents: talentsAtRank(5) },
    { name: 'l200_boss', level: { source: 'index', n: 200 }, bot: 'expert', botSeed: seedOf(7, 7), attemptSeed: 7, heroId: 'scout', talents: talentsAtRank(8) },
    { name: 'tournament_202645', level: { source: 'tournament', n: 120, seed: 202645 }, bot: 'expert', botSeed: seedOf(8, 7), attemptSeed: 0, heroId: 'scout', talents: NO_TALENTS },
  ];
  for (const r of runs) recordRun(r);

  const rooms: RoomSpec[] = [
    {
      name: 'powers_mix',
      template: 'room_05',
      D: 6,
      waves: [mix(['jelly', 'bat', 'moth', 'goblin', 'snipper', 'skeleton', 'mushroom', 'totem', 'mage', 'wolf'], 3), mix(['jelly', 'moth', 'snipper', 'bat', 'jelly', 'wolf'], 4)],
      seed: 4242,
      powers: { orb: 1, chain: 1, ricochet: 1, multishot: 2, diagonals: 1, crit: 2, flame: 1, frost: 1, poison: 1, lifesteal: 1, echoCut: 1, confetti: 1, shield: 1, dodge: 1, sharpScissors: 2, longThread: 1, eliteSlayer: 1, pierce: 1 },
      hp: 200000,
      ticks: 2400,
    },
    {
      name: 'legacy_powers',
      template: 'room_11',
      D: 9,
      waves: [mix(['goblin', 'jelly', 'jelly', 'bat', 'moth', 'snipper', 'totem', 'mage'], 2)],
      seed: 77,
      powers: { rearShot: 1, sideShots: 1, wallBounce: 1, blast: 1, magnet: 1, flashStep: 1, barbedThread: 1, attackSpeed: 3, damage: 2, maxHp: 3, speed: 2 },
      talents: talentsAtRank(10),
      hp: 200000,
      ticks: 1800,
    },
  ];
  const bosses = ['treant', 'queen', 'scorpion', 'wyvern', 'ashlord'] as const;
  bosses.forEach((archetype, i) =>
    rooms.push({
      name: `boss_${archetype}`,
      template: ['room_01', 'room_03', 'room_06', 'room_09', 'room_14'][i],
      D: 4 + i * 3,
      waves: i % 2 ? [mix(['goblin', 'bat'])] : [],
      boss: { archetype, variant: i % 3 === 0 ? 2 : i % 3, hpMult: 1 },
      seed: 1000 + i,
      powers: { sharpScissors: 3, damage: 3, attackSpeed: 2, multishot: 1 },
      hp: 1e6,
      ticks: 3600,
    }),
  );
  for (const r of rooms) recordRoom(r);
}

// exécuté directement (pnpm traces) ; importable pour le débogage (stateHash)
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
