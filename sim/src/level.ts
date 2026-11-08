/** §7 Génération d'un niveau à partir d'une graine, et déroulé complet d'un niveau. */
import { Arena, type RoomTemplate } from './arena.js';
import { COLS, ROWS, ELITE, HEAL_BETWEEN_ROOMS, RARITY_WEIGHTS, SIM_DT, BUDGET, BOSS_LEVEL_PRE_ROOMS, AUTO_FIRE_DEFAULT, expectedTalentRank } from './constants.js';
import {
  ENEMIES,
  SPAWN_WEIGHT,
  BOSS_BY_KINGDOM,
  POWERS,
  SIGNATURE_FAMILIES,
  type PowerFamily,
  POWER_BY_ID,
  HEROES,
  unlockedEnemies,
  newEnemyAt,
  type EnemyType,
  type BossArchetype,
  type PowerId,
  type HeroId,
} from './content.js';
import { levelInfo, roomBudget, waveCap, stars, type LevelKind } from './formulas.js';
import { talentsAtRank, NO_TALENTS, type Talents } from './hero.js';
import { gearStats, expectedGear, type GearStats } from './gear.js';
import { Rng, seedOf } from './rng.js';
import { World, newHero, grantPower, type HeroInput, type HeroState, type SpawnSpec } from './world.js';

export interface LevelRoom {
  template: string;
  waves: SpawnSpec[][];
  boss: { archetype: BossArchetype; variant: number; hpMult: number } | null;
  seed: number;
  budget: number;
}

export interface LevelDef {
  n: number;
  chapter: number;
  position: number;
  kingdom: number;
  kind: LevelKind;
  D: number;
  mult: number;
  budgetScale: number;
  seed: number;
  powerSeed: number;
  rooms: LevelRoom[];
  stars: { two: number; three: number };
  validation?: LevelValidation;
}

export interface LevelValidation {
  games: number;
  novice?: number;
  moyen: number;
  expert: number;
  band: string;
  ok: boolean;
  avgSeconds: number;
}

export interface GenOptions {
  /** Surcharge de la difficulté (tournoi). */
  D?: number;
  mult?: number;
  kind?: LevelKind;
  roomCount?: number;
  /** Interdit les élites (ex. tests). */
  noElites?: boolean;
}

/** Gabarits adaptés à un combat de boss (peu d'obstacles). */
function bossFriendly(t: RoomTemplate): boolean {
  let n = 0;
  for (const row of t.grid) for (const ch of row) if ('#~%'.includes(ch)) n++;
  return n <= 9;
}

export function generateLevel(n: number, seed: number, templates: RoomTemplate[], budgetScale = 1, opts: GenOptions = {}): LevelDef {
  const info = levelInfo(n);
  const D = opts.D ?? info.D;
  const mult = opts.mult ?? info.mult;
  const kind = opts.kind ?? info.kind;
  const roomCount = opts.roomCount ?? info.rooms;
  const rng = new Rng(seedOf(n, seed, 0x1e7e1));
  const unlocked = unlockedEnemies(info.chapter);
  const tutorialType = info.position === 1 ? newEnemyAt(info.chapter) : null;
  const elitesAllowed = !opts.noElites && info.chapter >= ELITE.fromChapter;
  const maxElites = kind === 'hard' || kind === 'boss' ? ELITE.maxPerRoomHard : ELITE.maxPerRoom;

  const used = new Set<string>();
  const rooms: LevelRoom[] = [];
  for (let i = 1; i <= roomCount; i++) {
    const isBossRoom = kind === 'boss' && i === roomCount;
    const pool = templates.filter((t) => !used.has(t.id) && (!isBossRoom || bossFriendly(t)));
    const tpl = rng.pick(pool.length ? pool : templates);
    used.add(tpl.id);
    const arena = new Arena(tpl);
    const budget = isBossRoom ? 0 : roomBudget(D, mult, i, budgetScale * (kind === 'boss' ? BOSS_LEVEL_PRE_ROOMS : 1), roomCount);
    const types: EnemyType[] = tutorialType && i === 1 ? [tutorialType] : unlocked;

    // remplissage pondéré du budget
    const picks: { type: EnemyType; elite: boolean }[] = [];
    let left = budget;
    const minCost = Math.min(...types.map((t) => ENEMIES[t].cost));
    while (left >= minCost) {
      const afford = types.filter((t) => ENEMIES[t].cost <= left);
      const t = afford[rng.weighted(afford.map((a) => SPAWN_WEIGHT[a]))];
      picks.push({ type: t, elite: false });
      left -= ENEMIES[t].cost;
    }
    // élites : coûtent 1,2 × leur coût en plus (pris sur les derniers ennemis tirés)
    if (elitesAllowed && !(tutorialType && i === 1)) {
      let elites = 0;
      for (let k = 0; k < maxElites; k++) {
        if (!rng.chance(kind === 'hard' ? 0.7 : 0.4) || picks.length < 3) continue;
        const idx = rng.int(picks.length);
        if (picks[idx].elite) continue;
        picks[idx].elite = true;
        elites++;
        let extra = Math.round(ENEMIES[picks[idx].type].cost * 1.2);
        for (let j = picks.length - 1; j >= 0 && extra > 0; j--) {
          if (picks[j].elite) continue;
          extra -= ENEMIES[picks[j].type].cost;
          picks.splice(j, 1);
        }
      }
      void elites;
    }
    rng.shuffle(picks);

    // vagues : ≤ waveCap(D) points de budget simultanés
    const waveCount = Math.max(1, Math.ceil(budget / waveCap(D, mult)));
    const waves: SpawnSpec[][] = Array.from({ length: waveCount }, () => []);
    picks.forEach((p, k) => waves[k % waveCount].push({ type: p.type, c: 0, r: 0, elite: p.elite || undefined }));

    // positions : cases libres des lignes 0–9, à ≥ 5 cases du départ
    const free = arena.freeCells().filter((c) => c.r <= 9 && Math.hypot(c.c - 4, c.r - (ROWS - 1)) >= 5 && !(c.r === 0 && c.c === 4));
    for (const wave of waves) {
      const cells = rng.shuffle(free.slice());
      for (const s of wave) {
        const stationary = s.type === 'mushroom' || s.type === 'totem';
        // fixes : loin des murs et des obstacles, pour qu'on puisse en faire le tour (DECISIONS #42)
        let idx = cells.findIndex((c) => !stationary || (c.r >= 2 && c.r <= 7 && clearCells(arena, c.c, c.r) >= 2));
        if (idx < 0) idx = cells.findIndex((c) => !stationary || (c.r >= 2 && c.r <= 7 && clearCells(arena, c.c, c.r) >= 1));
        if (idx < 0) idx = cells.findIndex((c) => !stationary || (c.r >= 1 && c.r <= 7));
        if (idx < 0) idx = 0;
        const cell = cells.splice(idx, 1)[0] ?? { c: rng.int(COLS), r: 2 };
        s.c = cell.c;
        s.r = cell.r;
      }
    }
    for (const w of waves) for (const s of w) if (!s.elite) delete s.elite;

    rooms.push({
      template: tpl.id,
      waves: waves.filter((w) => w.length > 0),
      boss: isBossRoom ? { archetype: BOSS_BY_KINGDOM[(info.kingdom - 1) % 5], variant: (info.chapter - 1) % 3, hpMult: round3(budgetScale) } : null,
      seed: rng.nextU32(),
      budget,
    });
  }
  return {
    n,
    chapter: info.chapter,
    position: info.position,
    kingdom: info.kingdom,
    kind,
    D: round3(D),
    mult,
    budgetScale: round3(budgetScale),
    seed,
    powerSeed: rng.nextU32(),
    rooms,
    stars: { two: 0.5, three: 0.8 },
  };
}

/** Nombre de cases libres autour de (c, r) dans toutes les directions (anneaux de Tchebychev), murs compris. */
function clearCells(arena: Arena, c: number, r: number): number {
  for (let k = 1; k <= 3; k++) {
    for (let dr = -k; dr <= k; dr++) {
      for (let dc = -k; dc <= k; dc++) {
        if (Math.max(Math.abs(dc), Math.abs(dr)) !== k) continue;
        const cc = c + dc;
        const rr = r + dr;
        if (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS || arena.blocksWalk(cc, rr)) return k - 1;
      }
    }
  }
  return 3;
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}

// ───────────────────────────── pouvoirs ─────────────────────────────

/**
 * Offre de 3 pouvoirs distincts (tirage à graine), sans pouvoir déjà au maximum. La première carte est toujours de la
 * famille Fil tant qu'il en reste une à prendre : chaque choix oppose le fil (durée, découpe) au tir (DECISIONS #71).
 */
export function offerPowers(rng: Rng, owned: Partial<Record<PowerId, number>>, count = 3, signature: PowerFamily = 'thread'): PowerId[] {
  const offer: PowerId[] = [];
  // les familles signature des autres héros ne sont jamais proposées (DECISIONS #74) ; pour l'Éclaireuse, le
  // filtrage retire les pouvoirs ajoutés après elle : ses tirages restent identiques au bit près
  const own = (p: (typeof POWERS)[number]) => p.family === signature || !SIGNATURE_FAMILIES.includes(p.family);
  const eligible = (id: PowerId) => !offer.includes(id) && (owned[id] ?? 0) < POWER_BY_ID[id].maxStacks;
  for (let k = 0; k < count; k++) {
    const r = rng.weighted([RARITY_WEIGHTS.common, RARITY_WEIGHTS.rare, RARITY_WEIGHTS.epic]);
    const rarity = (['common', 'rare', 'epic'] as const)[r];
    const family = (p: (typeof POWERS)[number]) => own(p) && (k > 0 || p.family === signature);
    let pool = POWERS.filter((p) => p.rarity === rarity && family(p) && eligible(p.id));
    if (!pool.length && k === 0) pool = POWERS.filter((p) => family(p) && eligible(p.id));
    if (!pool.length) pool = POWERS.filter((p) => own(p) && eligible(p.id));
    if (!pool.length) break;
    offer.push(rng.pick(pool).id);
  }
  return offer;
}

// ───────────────────────────── déroulé ─────────────────────────────

export interface ChoiceContext {
  level: LevelDef;
  /** index (0-based) de la salle qui suit le choix */
  nextRoom: number;
  hero: HeroState;
}

export interface Controller {
  beginRoom?(world: World): void;
  input(world: World): HeroInput;
  choosePower(offer: PowerId[], ctx: ChoiceContext): PowerId;
}

export interface RunOptions {
  talents?: Talents;
  /** Équipement porté (DECISIONS #75). */
  gear?: GearStats;
  heroId?: HeroId;
  /** Graine de la tentative (aléas de combat : critiques, IA, orbes). */
  attemptSeed?: number;
  /** Bonus avant niveau (§11). */
  potion?: boolean;
  aegis?: boolean;
  scroll?: PowerId | null;
  /** Force le premier pouvoir choisi (test d'équilibrage). */
  forceFirstPower?: PowerId;
  timeLimit?: number;
  /** Tir auto permanent ; défaut AUTO_FIRE_DEFAULT (true). */
  autoFire?: boolean;
  onStep?: (w: World) => void;
}

export interface RunResult {
  won: boolean;
  hpFrac: number;
  hpLeft: number;
  seconds: number;
  kills: number;
  stars: 0 | 1 | 2 | 3;
  roomsCleared: number;
  powers: PowerId[];
  hitsTaken: number;
  timeout: boolean;
  /** Instrumentation : découpes réussies et dégâts effectifs par source. */
  cuts: number;
  gusts: number;
  dmgBy: { cut: number; shot: number; other: number; sig: number };
}

export function talentsForLevel(n: number): Talents {
  return talentsAtRank(expectedTalentRank(n));
}

/** Équipement attendu au niveau n (modèle des bots, comme les talents) : DECISIONS #75. */
export function gearForLevel(n: number): GearStats {
  return gearStats(expectedGear(n));
}

export function runLevel(level: LevelDef, templates: Map<string, RoomTemplate>, ctl: Controller, opt: RunOptions = {}): RunResult {
  const talents = opt.talents ?? NO_TALENTS;
  const heroDef = HEROES[opt.heroId ?? 'scout'];
  const hero = newHero(talents, {}, opt.autoFire ?? AUTO_FIRE_DEFAULT, { kind: heroDef.kind, gear: opt.gear });
  if (heroDef.startPower) grantPower(hero, heroDef.startPower);
  if (opt.scroll) grantPower(hero, opt.scroll);
  if (opt.potion) {
    hero.stats.maxHp = Math.round(hero.stats.maxHp * 1.25);
    hero.hp = hero.stats.maxHp;
  }
  if (opt.aegis) hero.shieldReady = true;
  const powerRng = new Rng(level.powerSeed);
  const attempt = opt.attemptSeed ?? 0;
  const limit = opt.timeLimit ?? 300;
  let t = 0;
  let kills = 0;
  const taken: PowerId[] = [];
  for (let i = 0; i < level.rooms.length; i++) {
    const room = level.rooms[i];
    if (i > 0) {
      hero.hp = Math.min(hero.stats.maxHp, hero.hp + hero.stats.maxHp * HEAL_BETWEEN_ROOMS);
      const offer = offerPowers(powerRng, hero.powers, 3, heroDef.family);
      let pick = i === 1 && opt.forceFirstPower ? opt.forceFirstPower : ctl.choosePower(offer, { level, nextRoom: i, hero });
      if (!pick) pick = offer[0];
      grantPower(hero, pick);
      taken.push(pick);
    }
    const tpl = templates.get(room.template);
    if (!tpl) throw new Error(`gabarit inconnu : ${room.template}`);
    const world = new World({ arena: new Arena(tpl), D: level.D, waves: room.waves, boss: room.boss, seed: seedOf(room.seed, attempt) }, hero);
    ctl.beginRoom?.(world);
    const isLast = i === level.rooms.length - 1;
    while (!world.dead && !(isLast ? world.cleared : world.exited)) {
      world.step(ctl.input(world));
      opt.onStep?.(world);
      t += SIM_DT;
      if (t > limit) {
        return result(false, hero, t, kills + world.kills, i, taken, true);
      }
    }
    kills += world.kills;
    if (world.dead) return result(false, hero, t, kills, i, taken, false);
  }
  return result(true, hero, t, kills, level.rooms.length, taken, false);
}

function result(won: boolean, hero: HeroState, seconds: number, kills: number, rooms: number, powers: PowerId[], timeout: boolean): RunResult {
  const hpLeft = Math.max(0, hero.hp);
  const hpFrac = hpLeft / hero.stats.maxHp;
  return { won, hpFrac, hpLeft, seconds, kills, stars: stars(won, hpFrac), roomsCleared: rooms, powers, hitsTaken: hero.hitsTaken, timeout, cuts: hero.cuts, gusts: hero.gusts, dmgBy: { ...hero.dmgBy } };
}
