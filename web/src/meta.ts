/**
 * Méta-progression du prototype : équipement (DECISIONS #75), quêtes du jour (#76), bestiaire, déblocage des héros
 * (#74). Les règles pures (statistiques, butin, coûts) sont dans `sim/src/gear.ts`, portables en Swift.
 */
import {
  GEAR_BY_ID,
  MAX_LEVEL,
  SLOTS,
  gearStats,
  levelLoot,
  firstWinShards,
  replayShards,
  upgradeCost,
  salvageValue,
  mainValue,
  type GearItem,
  type GearSlot,
  type GearStats,
} from '../../sim/src/gear.js';
import { HEROES, type HeroId } from '../../sim/src/content.js';
import { localDay } from './economy.js';
import { save, persist } from './state.js';

// ───────────────────────────── équipement ─────────────────────────────

export function equippedItems(): GearItem[] {
  const g = save().gear;
  const out: GearItem[] = [];
  for (const slot of SLOTS) {
    const uid = g.equipped[slot];
    const it = uid !== undefined ? g.items.find((x) => x.uid === uid) : undefined;
    if (it) out.push(it);
  }
  return out;
}

export function currentGearStats(): GearStats {
  return gearStats(equippedItems());
}

export function itemByUid(uid: number): GearItem | undefined {
  return save().gear.items.find((x) => x.uid === uid);
}

export function equippedIn(slot: GearSlot): GearItem | undefined {
  const uid = save().gear.equipped[slot];
  return uid !== undefined ? itemByUid(uid) : undefined;
}

export function isEquipped(uid: number): boolean {
  return Object.values(save().gear.equipped).includes(uid);
}

export function addItem(id: string, level = 1): GearItem {
  const g = save().gear;
  const it: GearItem = { uid: g.nextUid++, id, level };
  g.items.push(it);
  // emplacement vide : l'objet est porté tout de suite
  const slot = GEAR_BY_ID[id].slot;
  if (g.equipped[slot] === undefined) g.equipped[slot] = it.uid;
  persist();
  return it;
}

export function equip(uid: number): void {
  const it = itemByUid(uid);
  if (!it) return;
  save().gear.equipped[GEAR_BY_ID[it.id].slot] = uid;
  persist();
}

export function unequip(slot: GearSlot): void {
  delete save().gear.equipped[slot];
  persist();
}

/** Vrai si l'objet est meilleur (statistique principale) que celui porté dans son emplacement. */
export function isUpgradeOver(it: GearItem): boolean {
  const def = GEAR_BY_ID[it.id];
  const cur = equippedIn(def.slot);
  if (!cur) return true;
  return mainValue(def, it.level) > mainValue(GEAR_BY_ID[cur.id], cur.level) + 1e-9;
}

export function upgrade(uid: number): 'ok' | 'max' | 'gold' | 'shards' {
  const s = save();
  const it = itemByUid(uid);
  if (!it) return 'max';
  const cost = upgradeCost(GEAR_BY_ID[it.id], it.level);
  if (!cost) return 'max';
  if (s.gold < cost.gold) return 'gold';
  if (s.gear.shards < cost.shards) return 'shards';
  s.gold -= cost.gold;
  s.gear.shards -= cost.shards;
  it.level++;
  persist();
  return 'ok';
}

export function salvage(uid: number): number {
  const g = save().gear;
  const it = itemByUid(uid);
  if (!it) return 0;
  const v = salvageValue(GEAR_BY_ID[it.id], it.level);
  g.items = g.items.filter((x) => x.uid !== uid);
  for (const slot of SLOTS) if (g.equipped[slot] === uid) delete g.equipped[slot];
  g.shards += v;
  persist();
  return v;
}

export { MAX_LEVEL };

/** Butin d'une victoire : objet et éclats (première victoire) ou éclats (niveau rejoué). */
export interface Loot {
  item: GearItem | null;
  shards: number;
  first: boolean;
}

export function grantLoot(n: number, firstWin: boolean, threeStars: boolean): Loot {
  const s = save();
  if (!firstWin) {
    const sh = replayShards(n);
    s.gear.shards += sh;
    persist();
    return { item: null, shards: sh, first: false };
  }
  const sh = firstWinShards(n, threeStars);
  s.gear.shards += sh;
  const l = levelLoot(n);
  const item = l ? addItem(l.id, l.level) : null;
  persist();
  return { item, shards: sh, first: true };
}

// ───────────────────────────── héros ─────────────────────────────

/** Niveau à terminer pour débloquer un héros en jouant (l'offre de départ donne aussi le Moine). */
export const HERO_UNLOCK_LEVEL: Record<HeroId, number> = { scout: 0, windMonk: 40, emberSorcerer: 100 };

export function heroUnlocked(id: HeroId): boolean {
  const s = save();
  if (s.heroes.includes(id)) return true;
  if (HERO_UNLOCK_LEVEL[id] > 0 && s.unlocked > HERO_UNLOCK_LEVEL[id]) {
    s.heroes.push(id);
    persist();
    return true;
  }
  return false;
}

export function heroUnlockText(id: HeroId): string {
  if (id === 'scout') return 'Disponible';
  const n = HERO_UNLOCK_LEVEL[id];
  return id === 'windMonk' ? `Terminer le niveau ${n} · ou offre de départ` : `Terminer le niveau ${n}`;
}

// ───────────────────────────── quêtes du jour ─────────────────────────────

export type QuestKind = 'win' | 'kills' | 'threeStars' | 'replay' | 'boss' | 'hero' | 'signature' | 'noHit';
export interface QuestDef {
  id: string;
  kind: QuestKind;
  goal: number;
  hero?: HeroId;
  text: string;
  reward: { gold?: number; gems?: number; shards?: number };
}

const QUEST_POOL: QuestDef[] = [
  { id: 'win3', kind: 'win', goal: 3, text: 'Gagne 3 niveaux', reward: { gold: 150 } },
  { id: 'kills60', kind: 'kills', goal: 60, text: 'Vaincs 60 ennemis', reward: { shards: 12 } },
  { id: 'stars', kind: 'threeStars', goal: 2, text: 'Termine 2 niveaux avec 3 étoiles', reward: { gems: 15 } },
  { id: 'replay', kind: 'replay', goal: 1, text: 'Rejoue un niveau déjà gagné', reward: { shards: 10 } },
  { id: 'boss', kind: 'boss', goal: 1, text: 'Terrasse un boss', reward: { gems: 20 } },
  { id: 'sig', kind: 'signature', goal: 25, text: 'Frappe 25 fois avec ta mécanique (découpes, bourrasques, ennemis brûlés)', reward: { gold: 120, shards: 6 } },
  { id: 'scoutWin', kind: 'hero', hero: 'scout', goal: 2, text: 'Gagne 2 niveaux avec l’Éclaireuse', reward: { gold: 100, shards: 6 } },
  { id: 'monkWin', kind: 'hero', hero: 'windMonk', goal: 2, text: 'Gagne 2 niveaux avec le Moine du vent', reward: { gold: 100, shards: 8 } },
  { id: 'emberWin', kind: 'hero', hero: 'emberSorcerer', goal: 2, text: 'Gagne 2 niveaux avec le Sorcier de braise', reward: { gold: 100, shards: 8 } },
  { id: 'clean', kind: 'noHit', goal: 1, text: 'Gagne un niveau en gardant plus de 90 % de tes PV', reward: { gems: 15 } },
];

export const QUEST_BONUS = { gems: 20, shards: 15 } as const;

function hashStr(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

/** Trois quêtes par jour, tirées de la date (sans hasard visible : les mêmes pour tous ce jour-là). */
export function todayQuests(): QuestDef[] {
  const s = save();
  const day = localDay(new Date());
  if (s.quests.day !== day) s.quests = { day, progress: {}, claimed: [], bonusClaimed: false };
  const pool = QUEST_POOL.filter((q) => {
    if (q.kind === 'boss') return s.unlocked > 20;
    if (q.kind === 'hero') return heroUnlocked(q.hero!);
    return true;
  });
  const out: QuestDef[] = [];
  let h = hashStr(day);
  while (out.length < 3 && pool.length) {
    const i = h % pool.length;
    const q = pool.splice(i, 1)[0];
    // au plus une quête de héros par jour
    if (!(q.kind === 'hero' && out.some((o) => o.kind === 'hero'))) out.push(q);
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0;
  }
  return out;
}

export function questProgress(q: QuestDef): number {
  return Math.min(q.goal, save().quests.progress[q.id] ?? 0);
}

export function questsToClaim(): number {
  const s = save();
  const qs = todayQuests();
  let n = qs.filter((q) => questProgress(q) >= q.goal && !s.quests.claimed.includes(q.id)).length;
  if (qs.every((q) => s.quests.claimed.includes(q.id)) && !s.quests.bonusClaimed) n++;
  return n;
}

export function claimQuest(id: string): QuestDef['reward'] | null {
  const s = save();
  const q = todayQuests().find((x) => x.id === id);
  if (!q || questProgress(q) < q.goal || s.quests.claimed.includes(id)) return null;
  s.quests.claimed.push(id);
  s.gold += q.reward.gold ?? 0;
  s.gems += q.reward.gems ?? 0;
  s.gear.shards += q.reward.shards ?? 0;
  persist();
  return q.reward;
}

export function claimQuestBonus(): boolean {
  const s = save();
  const qs = todayQuests();
  if (s.quests.bonusClaimed || !qs.every((q) => s.quests.claimed.includes(q.id))) return false;
  s.quests.bonusClaimed = true;
  s.gems += QUEST_BONUS.gems;
  s.gear.shards += QUEST_BONUS.shards;
  persist();
  return true;
}

/** Bilan d'un combat (victoire ou défaite) : bestiaire et quêtes. */
export interface FightReport {
  won: boolean;
  level: number;
  hero: HeroId;
  killsByType: Record<string, number>;
  /** découpes, bourrasques qui touchent, ennemis brûlés */
  signatureHits: number;
  stars: number;
  hpFrac: number;
  replay: boolean;
  boss: boolean;
}

export function recordFight(r: FightReport): void {
  const s = save();
  let kills = 0;
  for (const [k, v] of Object.entries(r.killsByType)) {
    s.bestiary[k] = (s.bestiary[k] ?? 0) + v;
    kills += v;
  }
  const qs = todayQuests();
  const add = (q: QuestDef, v: number) => {
    if (v > 0) s.quests.progress[q.id] = Math.min(q.goal, (s.quests.progress[q.id] ?? 0) + v);
  };
  for (const q of qs) {
    switch (q.kind) {
      case 'kills':
        add(q, kills);
        break;
      case 'signature':
        add(q, r.signatureHits);
        break;
      case 'win':
        add(q, r.won ? 1 : 0);
        break;
      case 'threeStars':
        add(q, r.won && r.stars === 3 ? 1 : 0);
        break;
      case 'replay':
        add(q, r.won && r.replay ? 1 : 0);
        break;
      case 'boss':
        add(q, r.won && r.boss ? 1 : 0);
        break;
      case 'hero':
        add(q, r.won && r.hero === q.hero ? 1 : 0);
        break;
      case 'noHit':
        add(q, r.won && r.hpFrac > 0.9 ? 1 : 0);
        break;
    }
  }
  persist();
}

export { HEROES };
