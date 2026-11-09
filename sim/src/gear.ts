/**
 * Équipement (DECISIONS #75) : 4 emplacements, 24 objets, 4 raretés. Pur et déterministe (portable en Swift).
 *
 * - Statistique principale par emplacement (aiguille : dégâts, cape : PV, masque : cadence, talisman : puissance de la
 *   mécanique signature), qui monte avec le niveau de l'objet ; une statistique secondaire fixe par objet.
 * - Butin sans hasard (§11 : pas de récompense aléatoire) : la première victoire de certains niveaux donne un objet
 *   précis, annoncé sur la carte et avant le niveau ; chaque première victoire donne des éclats (amélioration).
 * - Amélioration : or + éclats ; recyclage : rend des éclats.
 */

export type GearSlot = 'needle' | 'cloak' | 'mask' | 'charm';
export type GearRarity = 'common' | 'rare' | 'epic' | 'legendary';
export type GearStat = 'dmg' | 'hp' | 'rate' | 'speed' | 'crit' | 'dodge' | 'sig';

/** Bonus cumulés de l'équipement porté (fractions : 0,1 = +10 %). */
export interface GearStats {
  dmg: number;
  hp: number;
  rate: number;
  speed: number;
  crit: number;
  dodge: number;
  /** puissance de la mécanique signature (découpe, bourrasque, braises) */
  sig: number;
}

export const NO_GEAR: GearStats = Object.freeze({ dmg: 0, hp: 0, rate: 0, speed: 0, crit: 0, dodge: 0, sig: 0 });

export interface GearDef {
  id: string;
  name: string;
  slot: GearSlot;
  rarity: GearRarity;
  /** statistique secondaire fixe */
  sub: { stat: GearStat; value: number } | null;
  /** une ligne d'ambiance */
  lore: string;
}

export const SLOT_NAMES: Record<GearSlot, string> = { needle: 'Aiguille', cloak: 'Cape', mask: 'Masque', charm: 'Talisman' };
export const SLOTS: GearSlot[] = ['needle', 'cloak', 'mask', 'charm'];
export const RARITY_NAMES: Record<GearRarity, string> = { common: 'Commun', rare: 'Rare', epic: 'Épique', legendary: 'Légendaire' };
export const RARITIES: GearRarity[] = ['common', 'rare', 'epic', 'legendary'];
export const STAT_NAMES: Record<GearStat, string> = {
  dmg: 'Dégâts',
  hp: 'PV',
  rate: 'Cadence',
  speed: 'Vitesse',
  crit: 'Critique',
  dodge: 'Esquive',
  sig: 'Signature',
};

/** Statistique principale de chaque emplacement. */
export const SLOT_MAIN: Record<GearSlot, GearStat> = { needle: 'dmg', cloak: 'hp', mask: 'rate', charm: 'sig' };

/** Niveau maximal par rareté. */
export const MAX_LEVEL: Record<GearRarity, number> = { common: 10, rare: 20, epic: 30, legendary: 40 };

/** Statistique principale au niveau 1 et gain par niveau (fractions), pour un multiplicateur d'emplacement de 1. */
const MAIN_BASE: Record<GearRarity, number> = { common: 0.015, rare: 0.025, epic: 0.035, legendary: 0.045 };
const MAIN_PER_LEVEL = 0.001;
/** Le masque (cadence) vaut moins, le talisman (signature) plus. */
const SLOT_MULT: Record<GearSlot, number> = { needle: 1, cloak: 1, mask: 0.6, charm: 1.2 };

export const GEAR: GearDef[] = [
  // Aiguilles (dégâts)
  { id: 'sewingNeedle', name: 'Aiguille de couturière', slot: 'needle', rarity: 'common', sub: null, lore: 'Elle a cousu plus de rideaux que de batailles.' },
  { id: 'boneNeedle', name: "Aiguille d'os", slot: 'needle', rarity: 'common', sub: { stat: 'hp', value: 0.02 }, lore: 'Taillée dans un os de marionnette brisée.' },
  { id: 'crowPin', name: 'Épingle de corbeau', slot: 'needle', rarity: 'rare', sub: { stat: 'crit', value: 0.03 }, lore: 'Le corbeau ne rate jamais un œil.' },
  { id: 'moonNeedle', name: 'Aiguille lunaire', slot: 'needle', rarity: 'rare', sub: { stat: 'sig', value: 0.05 }, lore: 'Trempée dans le premier quartier.' },
  { id: 'amberSting', name: "Dard d'ambre", slot: 'needle', rarity: 'epic', sub: { stat: 'rate', value: 0.04 }, lore: "Arraché au Scorpion d'ambre, encore tiède." },
  { id: 'throneNeedle', name: 'Aiguille du Trône de lune', slot: 'needle', rarity: 'legendary', sub: { stat: 'crit', value: 0.03 }, lore: "Celle qui a découpé la lune dans l'écran." },
  // Capes (PV)
  { id: 'juteCloak', name: 'Cape de jute', slot: 'cloak', rarity: 'common', sub: null, lore: 'Rêche, chaude, increvable.' },
  { id: 'feltCloak', name: 'Cape de feutre', slot: 'cloak', rarity: 'common', sub: { stat: 'dmg', value: 0.02 }, lore: 'Le feutre étouffe les pas.' },
  { id: 'crowCloak', name: 'Cape de corbeau', slot: 'cloak', rarity: 'rare', sub: { stat: 'speed', value: 0.03 }, lore: 'Mille plumes de papier noir.' },
  { id: 'mistMantle', name: 'Manteau de brume', slot: 'cloak', rarity: 'rare', sub: { stat: 'dodge', value: 0.03 }, lore: 'On le voit, puis on ne le voit plus.' },
  { id: 'marshCloak', name: 'Cape des marais', slot: 'cloak', rarity: 'epic', sub: { stat: 'sig', value: 0.04 }, lore: 'Tissée par la Reine des marais pour son champion.' },
  { id: 'starryMantle', name: 'Manteau de nuit étoilée', slot: 'cloak', rarity: 'legendary', sub: { stat: 'dmg', value: 0.03 }, lore: 'Chaque étoile est un trou de lumière.' },
  // Masques (cadence)
  { id: 'paperMask', name: 'Masque de papier', slot: 'mask', rarity: 'common', sub: null, lore: 'Deux trous, un sourire, beaucoup de courage.' },
  { id: 'foxMask', name: 'Masque de renard', slot: 'mask', rarity: 'common', sub: { stat: 'speed', value: 0.02 }, lore: 'Le renard file entre les ombres.' },
  { id: 'owlMask', name: 'Masque de chouette', slot: 'mask', rarity: 'rare', sub: { stat: 'crit', value: 0.03 }, lore: 'Il voit dans le noir des coulisses.' },
  { id: 'wolfMask', name: 'Masque de loup', slot: 'mask', rarity: 'rare', sub: { stat: 'dmg', value: 0.03 }, lore: "Pris au Loup d'ombre, crocs compris." },
  { id: 'emberMask', name: 'Masque de braise', slot: 'mask', rarity: 'epic', sub: { stat: 'sig', value: 0.04 }, lore: 'Ses yeux fument encore.' },
  { id: 'eclipseMask', name: 'Masque de la lune noire', slot: 'mask', rarity: 'legendary', sub: { stat: 'crit', value: 0.03 }, lore: 'Quand il le porte, la scène retient son souffle.' },
  // Talismans (signature)
  { id: 'spool', name: 'Bobine de fil', slot: 'charm', rarity: 'common', sub: null, lore: 'Le premier outil de tout marionnettiste.' },
  { id: 'windBell', name: 'Grelot de vent', slot: 'charm', rarity: 'common', sub: { stat: 'speed', value: 0.02 }, lore: 'Il tinte avant la bourrasque.' },
  { id: 'emberJar', name: 'Braise captive', slot: 'charm', rarity: 'rare', sub: { stat: 'dmg', value: 0.03 }, lore: 'Une braise qui ne veut pas mourir.' },
  { id: 'paperCrane', name: 'Grue de papier', slot: 'charm', rarity: 'rare', sub: { stat: 'dodge', value: 0.025 }, lore: 'Pliée mille fois, elle porte chance.' },
  { id: 'waxHeart', name: 'Cœur de cire', slot: 'charm', rarity: 'epic', sub: { stat: 'hp', value: 0.04 }, lore: 'Il bat au rythme de la rampe.' },
  { id: 'eclipseCharm', name: 'Éclipse', slot: 'charm', rarity: 'legendary', sub: { stat: 'rate', value: 0.03 }, lore: "Un disque d'encre devant la lune." },
];

export const GEAR_BY_ID: Record<string, GearDef> = Object.fromEntries(GEAR.map((g) => [g.id, g]));

/** Objet possédé : identifiant unique (uid), définition, niveau. */
export interface GearItem {
  uid: number;
  id: string;
  level: number;
}

/** Valeur de la statistique principale d'un objet à un niveau donné. */
export function mainValue(def: GearDef, level: number): number {
  const l = Math.max(1, Math.min(MAX_LEVEL[def.rarity], level));
  return (MAIN_BASE[def.rarity] + MAIN_PER_LEVEL * (l - 1)) * SLOT_MULT[def.slot];
}

/** Somme des bonus de l'équipement porté (au plus un objet par emplacement ; les inconnus sont ignorés). */
export function gearStats(items: GearItem[]): GearStats {
  const s: GearStats = { ...NO_GEAR };
  const seen = new Set<GearSlot>();
  for (const it of items) {
    const def = GEAR_BY_ID[it.id];
    if (!def || seen.has(def.slot)) continue;
    seen.add(def.slot);
    s[SLOT_MAIN[def.slot]] += mainValue(def, it.level);
    if (def.sub) s[def.sub.stat] += def.sub.value;
  }
  return s;
}

const RARITY_COST: Record<GearRarity, number> = { common: 1, rare: 1.6, epic: 2.4, legendary: 3.4 };

/** Coût du niveau suivant (null au maximum). */
export function upgradeCost(def: GearDef, level: number): { gold: number; shards: number } | null {
  if (level >= MAX_LEVEL[def.rarity]) return null;
  const k = RARITY_COST[def.rarity];
  return { gold: Math.round((60 + 30 * level) * k / 10) * 10, shards: Math.round((2 + 1.5 * level) * k) };
}

/** Éclats rendus par le recyclage : la moitié de ce qui a été investi, plus une base par rareté. */
export function salvageValue(def: GearDef, level: number): number {
  const base = { common: 6, rare: 16, epic: 40, legendary: 90 }[def.rarity];
  let spent = 0;
  for (let l = 1; l < level; l++) spent += upgradeCost(def, l)!.shards;
  return base + Math.floor(spent / 2);
}

// ───────────────────────────── butin ─────────────────────────────

/** Rareté de l'objet donné par la première victoire du niveau n, ou null (niveau sans objet). */
export function lootRarity(n: number): GearRarity | null {
  const c = Math.ceil(n / 20);
  const p = n - 20 * (c - 1);
  if (p === 20) return c % 3 === 0 ? 'legendary' : 'epic'; // boss ; fin de royaume : légendaire
  if (p === 7 || p === 14) return c >= 4 ? 'epic' : 'rare'; // niveaux difficiles
  if (p === 3 || p === 10 || p === 17) return c >= 7 ? 'rare' : 'common';
  return null;
}

function hash32(a: number): number {
  let x = (a ^ 0x9e3779b9) >>> 0;
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b) >>> 0;
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35) >>> 0;
  return (x ^ (x >>> 16)) >>> 0;
}

/**
 * Objet de la première victoire du niveau n (annoncé d'avance) : l'emplacement tourne d'un objet à l'autre pour
 * équiper tous les emplacements tôt ; le niveau 3 donne toujours une aiguille.
 */
export function levelLoot(n: number): { id: string; level: number } | null {
  const rarity = lootRarity(n);
  if (!rarity) return null;
  let index = 0;
  for (let k = 1; k < n; k++) if (lootRarity(k)) index++;
  // 6 objets par chapitre : décalage d'un emplacement par chapitre, pour que les boss (épiques, légendaires)
  // tombent tour à tour sur les quatre emplacements (DECISIONS #79)
  const slot = SLOTS[(index + Math.ceil(n / 20) - 1) % 4];
  const pool = GEAR.filter((g) => g.slot === slot && g.rarity === rarity);
  const def = pool[hash32(n) % pool.length];
  // un objet trouvé loin dans la saga arrive déjà un peu amélioré
  const level = Math.max(1, Math.min(MAX_LEVEL[rarity], 1 + Math.floor(Math.max(0, n - 40) / 30)));
  return { id: def.id, level };
}

/** Éclats d'une première victoire (en plus d'un éventuel objet) ; ×2 pour trois étoiles. */
export function firstWinShards(n: number, threeStars: boolean): number {
  return Math.round((4 + n / 12) * (threeStars ? 2 : 1));
}

/** Éclats d'une victoire rejouée (niveau déjà gagné) : la rejouabilité rapporte. */
export function replayShards(n: number): number {
  return 1 + Math.floor(n / 40);
}

/**
 * Puissance d'équipement attendue au niveau n (modèle des bots, comme `expectedTalentRank`) : dans chaque emplacement,
 * l'objet le plus fort des niveaux déjà gagnés (statistique principale + secondaire), amélioré à mi-chemin de son
 * maximum. Un joueur garde son meilleur objet : la puissance attendue ne baisse jamais.
 */
export function expectedGear(n: number): GearItem[] {
  const best = new Map<GearSlot, { def: GearDef; level: number; value: number }>();
  for (let k = 1; k < n; k++) {
    const l = levelLoot(k);
    if (!l) continue;
    const def = GEAR_BY_ID[l.id];
    const level = Math.max(l.level, Math.round(MAX_LEVEL[def.rarity] / 2));
    const value = mainValue(def, level) + (def.sub ? def.sub.value : 0);
    const cur = best.get(def.slot);
    if (!cur || value > cur.value) best.set(def.slot, { def, level, value });
  }
  const out: GearItem[] = [];
  let uid = 1;
  for (const [, v] of best) out.push({ uid: uid++, id: v.def.id, level: v.level });
  return out;
}
