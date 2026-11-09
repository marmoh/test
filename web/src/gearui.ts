/** Équipement (DECISIONS #75) : poupée à 4 emplacements, inventaire, fiche d'objet, révélation du butin. */
import {
  GEAR_BY_ID,
  SLOTS,
  SLOT_NAMES,
  SLOT_MAIN,
  RARITY_NAMES,
  STAT_NAMES,
  MAX_LEVEL,
  mainValue,
  upgradeCost,
  salvageValue,
  levelLoot,
  type GearItem,
  type GearDef,
  type GearSlot,
  type GearStat,
  type GearStats,
} from '../../sim/src/gear.js';
import { INK_GEAR, INK_UI, iconURL } from '../../art/src/icons.js';
import { save } from './state.js';
import { currentGearStats, equip, equippedIn, isEquipped, isUpgradeOver, itemByUid, salvage, unequip, upgrade, type Loot } from './meta.js';
import { liveSprite } from './portraits.js';
import { el, toast } from './ui.js';
import { sfx } from './audio.js';

const SLOT_ICON: Record<GearSlot, string> = { needle: 'slotNeedle', cloak: 'slotCloak', mask: 'slotMask', charm: 'slotCharm' };
const RARITY_ORDER = { common: 0, rare: 1, epic: 2, legendary: 3 } as const;

export function pct(v: number, digits = 0): string {
  const x = v * 100;
  return `+${x.toFixed(digits).replace('.', ',')} %`;
}

function statLine(stat: GearStat, v: number): string {
  return `${STAT_NAMES[stat]} ${pct(v, v * 100 < 10 && v * 100 % 1 ? 1 : 0)}`;
}

export function gearIcon(id: string): string {
  return iconURL(INK_GEAR[id] ?? INK_GEAR.shard);
}

/** Vignette d'objet (cadre selon la rareté, niveau). */
export function itemTile(it: GearItem, extra = ''): string {
  const def = GEAR_BY_ID[it.id];
  return `<button class="gtile r-${def.rarity}${isEquipped(it.uid) ? ' worn' : ''}${extra}" data-uid="${it.uid}" aria-label="${def.name}, ${RARITY_NAMES[def.rarity]}, niveau ${it.level}"><img src="${gearIcon(it.id)}" alt=""/><i class="glvl">${it.level}</i>${isUpgradeOver(it) && !isEquipped(it.uid) ? '<i class="gup" title="Meilleur que l’objet porté">▲</i>' : ''}</button>`;
}

export function statsSummary(g: GearStats): string {
  const keys: GearStat[] = ['dmg', 'hp', 'rate', 'sig', 'crit', 'speed', 'dodge'];
  const parts = keys.filter((k) => g[k] > 0.0001).map((k) => `<span><b>${pct(g[k], g[k] < 0.1 && (g[k] * 100) % 1 ? 1 : 0)}</b> ${STAT_NAMES[k].toLowerCase()}</span>`);
  return parts.length ? parts.join('') : '<span class="none">Aucun objet porté</span>';
}

/** Fiche d'un objet de catalogue (butin annoncé, révélation). */
export function itemCard(def: GearDef, level: number, cls = ''): string {
  return `<div class="gcard r-${def.rarity} ${cls}">
    <div class="gc-rar">${RARITY_NAMES[def.rarity]} · ${SLOT_NAMES[def.slot]}</div>
    <div class="gc-icon"><img src="${gearIcon(def.id)}" alt=""/></div>
    <b class="gc-name">${def.name}</b>
    <div class="gc-stats"><span>${statLine(SLOT_MAIN[def.slot], mainValue(def, level))}</span>${def.sub ? `<span>${statLine(def.sub.stat, def.sub.value)}</span>` : ''}</div>
    <small class="gc-lore">${def.lore}</small>
  </div>`;
}

/** Panneau « Équipement » (dans la feuille des héros). */
export function gearPanel(host: HTMLElement, onChange: () => void): void {
  const render = () => {
    const s = save();
    const g = currentGearStats();
    const items = [...s.gear.items].sort((a, b) => {
      const da = GEAR_BY_ID[a.id];
      const db = GEAR_BY_ID[b.id];
      return RARITY_ORDER[db.rarity] - RARITY_ORDER[da.rarity] || SLOTS.indexOf(da.slot) - SLOTS.indexOf(db.slot) || b.level - a.level;
    });
    host.innerHTML = `<div class="doll">
        ${SLOTS.map((slot) => {
          const it = equippedIn(slot);
          return `<div class="dslot ds-${slot}">${it ? itemTile(it) : `<div class="gtile empty"><img src="${iconURL(INK_GEAR[SLOT_ICON[slot]])}" alt=""/></div>`}<small>${SLOT_NAMES[slot]}</small></div>`;
        }).join('')}
        <div class="doll-hero"></div>
      </div>
      <div class="gsum">${statsSummary(g)}</div>
      <h3 class="sec">Inventaire <small>${items.length} objet${items.length > 1 ? 's' : ''}</small><span class="shards"><img src="${iconURL(INK_GEAR.shard)}" alt=""/><b>${s.gear.shards}</b> éclats</span></h3>
      ${items.length ? `<div class="ggrid">${items.map((it) => itemTile(it)).join('')}</div>` : `<p class="fine left">Gagne des niveaux marqués d’un objet sur la carte pour remplir ton inventaire. Le premier arrive au niveau 3.</p>`}
      <p class="fine left">Les objets se trouvent à la première victoire de certains niveaux (annoncés d’avance) ; chaque victoire rapporte des éclats pour les améliorer.</p>`;
    host.querySelector('.doll-hero')!.appendChild(liveSprite(s.heroId, 104, 2.3, 'idle', { aiming: true, facing: 0.2 }));
    host.querySelectorAll<HTMLButtonElement>('.gtile[data-uid]').forEach((b) => b.addEventListener('click', () => openItem(Number(b.dataset.uid))));
  };
  const openItem = (uid: number) => {
    const it = itemByUid(uid);
    if (!it) return;
    const def = GEAR_BY_ID[it.id];
    const s = save();
    const worn = isEquipped(uid);
    const cur = equippedIn(def.slot);
    const curVal = cur ? mainValue(GEAR_BY_ID[cur.id], cur.level) : 0;
    const val = mainValue(def, it.level);
    const cost = upgradeCost(def, it.level);
    const next = it.level < MAX_LEVEL[def.rarity] ? mainValue(def, it.level + 1) : null;
    const main = SLOT_MAIN[def.slot];
    const d = el(`<div class="gdetail"><div class="gd-scrim"></div><div class="gd-card r-${def.rarity}">
      <button class="close-x" aria-label="Fermer">×</button>
      <div class="gc-rar">${RARITY_NAMES[def.rarity]} · ${SLOT_NAMES[def.slot]}</div>
      <div class="gc-icon big"><img src="${gearIcon(def.id)}" alt=""/></div>
      <b class="gc-name">${def.name}</b>
      <div class="gd-level">Niveau <b>${it.level}</b> / ${MAX_LEVEL[def.rarity]}</div>
      <div class="gc-stats"><span>${statLine(main, val)}${next ? ` <em>→ ${pct(next, 1)}</em>` : ''}</span>${def.sub ? `<span>${statLine(def.sub.stat, def.sub.value)}</span>` : ''}</div>
      ${!worn && cur ? `<p class="gd-cmp ${val >= curVal ? 'up' : 'down'}">${val >= curVal ? '▲' : '▼'} ${STAT_NAMES[main]} ${val >= curVal ? '+' : '−'}${Math.abs((val - curVal) * 100).toFixed(1).replace('.', ',')} pts par rapport à l’objet porté</p>` : ''}
      <small class="gc-lore">${def.lore}</small>
      <div class="gd-actions">
        ${worn ? `<button class="btn ghost small unequip">Retirer</button>` : `<button class="btn primary small equip">Équiper</button>`}
        ${cost ? `<button class="btn gem small upgrade" ${s.gold >= cost.gold && s.gear.shards >= cost.shards ? '' : 'disabled'}><span>Améliorer</span><em><img src="${iconURL(INK_UI.coin)}" alt="or"/>${cost.gold} <img src="${iconURL(INK_GEAR.shard)}" alt="éclats"/>${cost.shards}</em></button>` : `<span class="gd-max">Niveau maximal</span>`}
      </div>
      <div class="gd-salvage"><button class="link-btn salv">Recycler (+${salvageValue(def, it.level)} éclats)</button></div>
    </div></div>`);
    host.closest('.sheet')!.appendChild(d);
    requestAnimationFrame(() => d.classList.add('in'));
    const closeD = () => {
      d.classList.remove('in');
      setTimeout(() => d.remove(), 200);
    };
    d.querySelector('.close-x')!.addEventListener('click', closeD);
    d.querySelector('.gd-scrim')!.addEventListener('click', closeD);
    d.querySelector('.equip')?.addEventListener('click', () => {
      equip(uid);
      sfx('star');
      closeD();
      render();
      onChange();
    });
    d.querySelector('.unequip')?.addEventListener('click', () => {
      unequip(def.slot);
      sfx('tap');
      closeD();
      render();
      onChange();
    });
    d.querySelector('.upgrade')?.addEventListener('click', () => {
      const r = upgrade(uid);
      if (r === 'ok') {
        sfx('loot');
        toast(`${def.name} : niveau ${itemByUid(uid)!.level}`);
        closeD();
        render();
        openItem(uid);
        onChange();
      } else toast(r === 'gold' ? 'Pas assez d’or' : r === 'shards' ? 'Pas assez d’éclats' : 'Niveau maximal');
    });
    const salv = d.querySelector<HTMLButtonElement>('.salv')!;
    salv.addEventListener('click', () => {
      if (!salv.dataset.armed) {
        salv.dataset.armed = '1';
        salv.textContent = `Toucher encore pour recycler ${def.name}`;
        return;
      }
      const v = salvage(uid);
      sfx('tap');
      toast(`+${v} éclats`);
      closeD();
      render();
      onChange();
    });
  };
  render();
}

/** Bloc de l'écran de victoire : objet obtenu (carte qui se retourne) et éclats. */
export function lootBlock(loot: Loot): string {
  const shard = `<span class="lshards"><img src="${iconURL(INK_GEAR.shard)}" alt=""/>+${loot.shards} éclats</span>`;
  if (!loot.item) return `<div class="rloot small">${shard}${loot.first ? '' : '<small>Niveau rejoué</small>'}</div>`;
  const def = GEAR_BY_ID[loot.item.id];
  return `<div class="rloot"><div class="lflip"><div class="lback"><div class="moonmark"></div></div><div class="lfront">${itemCard(def, loot.item.level, 'compact')}</div></div><div class="lside"><b>Nouvel objet !</b>${shard}${isEquipped(loot.item.uid) ? '<small class="lworn">Équipé</small>' : isUpgradeOver(loot.item) ? `<button class="btn primary small lequip" data-uid="${loot.item.uid}">Équiper</button>` : ''}</div></div>`;
}

/** Ligne du pré-niveau : butin de la première victoire (annoncé d'avance), ou éclats d'un niveau rejoué. */
export function lootPreview(n: number): string {
  const won = (save().stars[n] ?? 0) > 0;
  const l = levelLoot(n);
  if (won) return `<div class="pl-loot done"><img src="${iconURL(INK_GEAR.shard)}" alt=""/><span>Niveau déjà gagné : rejoue-le pour des éclats</span></div>`;
  if (!l) return `<div class="pl-loot"><img src="${iconURL(INK_GEAR.shard)}" alt=""/><span>Première victoire : des éclats d’amélioration</span></div>`;
  const def = GEAR_BY_ID[l.id];
  return `<div class="pl-loot item r-${def.rarity}"><img src="${gearIcon(def.id)}" alt=""/><span><small>Butin de la première victoire</small><b>${def.name}</b> <em>${RARITY_NAMES[def.rarity]}</em></span></div>`;
}
