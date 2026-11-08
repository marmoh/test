/** Écrans et surcouches DOM : titre, pré-niveau, choix du pouvoir, victoire, défaite, pause. */
import { levelInfo, goldReward } from '../../sim/src/formulas.js';
import { POWER_BY_ID, BOSSES, ENEMIES, BOSS_BY_KINGDOM, HEROES, newEnemyAt, type PowerId, type MinionType, type HeroId } from '../../sim/src/content.js';
import type { LevelDef } from '../../sim/src/level.js';
import type { HeroState } from '../../sim/src/world.js';
import { INK_POWERS, INK_UI, iconURL } from '../../art/src/icons.js';
import { KINGDOMS } from '../../art/src/palette.js';
import { portrait, liveSprite } from './portraits.js';
import { save, persist, subscribed } from './state.js';
import { sfx } from './audio.js';
import { goldBonus } from './economy.js';
import { openDragon } from './dragon.js';
import { applyPrefs } from './prefs.js';
import type { CombatResult } from './combat.js';
import type { AttemptResult } from './state.js';
import { heroUnlocked, equip, type Loot } from './meta.js';
import { lootBlock, lootPreview } from './gearui.js';
import { LORE } from './journal.js';

export function el(html: string): HTMLElement {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild as HTMLElement;
}

function overlay(cls: string, html: string): HTMLElement {
  const o = el(`<div class="overlay ${cls}"><div class="scrim"></div>${html}</div>`);
  document.getElementById('app')!.appendChild(o);
  requestAnimationFrame(() => o.classList.add('in'));
  return o;
}

function close(o: HTMLElement): Promise<void> {
  o.classList.remove('in');
  o.classList.add('out');
  return new Promise((r) =>
    setTimeout(() => {
      o.remove();
      r();
    }, 280),
  );
}

/** Feuille montante (menus) : titre, corps défilant, bouton de fermeture. */
export function sheet(cls: string, title: string, body: string, onClose?: () => void): { o: HTMLElement; close: () => Promise<void> } {
  const o = el(`<div class="overlay sheet-overlay"><div class="scrim"></div><div class="sheet tall ${cls}"><div class="sheet-head"><div class="lvl-num">${title}</div></div><div class="sheet-body">${body}</div><button class="close-x" aria-label="Fermer">×</button></div></div>`);
  document.getElementById('app')!.appendChild(o);
  requestAnimationFrame(() => o.classList.add('in'));
  let closed = false;
  const close = () =>
    new Promise<void>((r) => {
      if (closed) return r();
      closed = true;
      o.classList.remove('in');
      o.classList.add('out');
      setTimeout(() => (o.remove(), onClose?.(), r()), 280);
    });
  o.querySelector('.close-x')!.addEventListener('click', () => void close());
  o.querySelector('.scrim')!.addEventListener('click', () => void close());
  return { o, close };
}

// ───────────────────────────── écran titre ─────────────────────────────

export function titleScreen(onStart: () => void): HTMLElement {
  const th = KINGDOMS[0];
  const s = el(`<div class="title-screen">
    <div class="stage">
      <div class="screen-paper" style="--light:${th.light};--paper:${th.paper};--edge:${th.edge}">
        <div class="moon-cut"></div>
        <svg class="title-trees" viewBox="0 0 400 160" preserveAspectRatio="none"><path fill="${th.far}" d="M0 160 V110 L20 80 L34 104 L52 60 L72 104 L90 86 L112 112 L140 70 L166 112 L190 92 L214 116 L246 64 L276 112 L300 90 L326 114 L352 72 L380 108 L400 92 V160 Z"/><path fill="#1b1418" d="M0 160 V132 L30 104 L48 126 L70 96 L96 130 L128 120 L160 134 L200 124 L240 136 L272 118 L300 132 L330 108 L360 130 L400 116 V160 Z"/></svg>
        <div class="puppet"><div class="rod"></div></div>
      </div>
    </div>
    <div class="curtain left"></div><div class="curtain right"></div><div class="valance"></div>
    <div class="title-text">
      <h1 class="logo">Ombrelune</h1>
      <p class="tagline">Un héros, un doigt, trois cents niveaux.<br/>Bouge pour esquiver ; ta héroïne tire toute seule.</p>
      <button class="btn primary big start">Lever le rideau</button>
    </div>
  </div>`);
  s.querySelector('.puppet')!.prepend(liveSprite('hero', 170, 3.3, 'idle', { aiming: true, facing: -0.25 }));
  s.querySelector('.start')!.addEventListener('click', () => {
    sfx('tap');
    s.classList.add('opening');
    setTimeout(onStart, 650);
  });
  return s;
}

// ───────────────────────────── pré-niveau ─────────────────────────────

export type BonusId = 'potion' | 'scroll' | 'aegis';
/** Prix des bonus d'avant niveau (§11 : or ou gemmes). */
export const BONUS_PRICE: Record<BonusId, { cur: 'gold' | 'gems'; amount: number }> = {
  potion: { cur: 'gold', amount: 150 },
  scroll: { cur: 'gems', amount: 25 },
  aegis: { cur: 'gold', amount: 200 },
};

/** Achète un bonus (or ou gemmes) ; message si le solde ne suffit pas. */
export function buyBonus(k: BonusId): boolean {
  const s = save();
  const p = BONUS_PRICE[k];
  if (s[p.cur] < p.amount) {
    toast(p.cur === 'gold' ? 'Pas assez d’or' : 'Pas assez de gemmes');
    return false;
  }
  s[p.cur] -= p.amount;
  s.bonuses[k]++;
  persist();
  return true;
}


export interface PreLevelChoice {
  potion: boolean;
  scroll: boolean;
  aegis: boolean;
}

function heroChip(): string {
  const h = HEROES[save().heroId];
  return `<button class="pl-hero" aria-label="Changer de héros"><img src="${portrait(h.id, 44, { scale: 1.3, dy: 6 })}" alt=""/><span><small>Héros</small><b>${h.name}</b><em>${h.mechanic}</em></span><i class="pl-swap">⇄</i></button>`;
}

export function preLevel(level: LevelDef): Promise<PreLevelChoice | null> {
  const info = levelInfo(level.n);
  const s = save();
  const th = KINGDOMS[info.kingdom - 1];
  const st = s.stars[level.n] ?? 0;
  void th;
  const types = new Set<MinionType>();
  for (const r of level.rooms) for (const w of r.waves) for (const e of w) types.add(e.type);
  const boss = level.rooms.find((r) => r.boss)?.boss;
  // ennemi présenté par ce niveau (salle tutoriel du début de chapitre)
  const fresh = info.position === 1 ? newEnemyAt(info.chapter) : null;
  const badge = info.kind === 'boss' ? `<span class="badge boss">Boss</span>` : info.kind === 'hard' ? `<span class="badge hard"><img src="${iconURL(INK_UI.skull)}"/>Difficile</span>` : '';
  const tag = (id: BonusId) =>
    s.bonuses[id] > 0
      ? `<i class="count">${s.bonuses[id]}</i>`
      : `<i class="price"><img src="${iconURL(BONUS_PRICE[id].cur === 'gold' ? INK_UI.coin : INK_UI.gem)}" alt=""/>${BONUS_PRICE[id].amount}</i>`;
  const bonus = (id: BonusId, icon: string, name: string, desc: string) =>
    `<button class="bonus${s.bonuses[id] > 0 ? '' : ' buy'}" data-b="${id}"><img src="${iconURL(icon)}"/><b>${name}</b><small>${desc}</small>${tag(id)}</button>`;
  const o = overlay(
    'sheet-overlay',
    `<div class="sheet">
      <div class="sheet-head"><div class="lvl-num">Niveau ${level.n}</div>${badge}</div>
      <div class="sheet-stars">${[0, 1, 2].map((i) => `<img class="${i < st ? 'on' : ''}" src="${iconURL(i < st ? INK_UI.star : INK_UI.starEmpty)}"/>`).join('')}</div>
      <p class="objective">Traverse ${level.rooms.length} salles${boss ? ` et terrasse <b>${BOSSES[boss.archetype].name}</b>` : ''}.</p>
      <div class="foes">${boss ? `<div class="foe boss"><img src="${portrait(BOSS_BY_KINGDOM[info.kingdom - 1], 84, { scale: 0.75, dy: 12, variant: boss.variant })}"/></div>` : ''}${[...types].map((t) => `<div class="foe${t === fresh ? ' fresh' : ''}" title="${ENEMIES[t].name}"><img src="${portrait(t, 56, { scale: 1.2, dy: 6, variant: t === 'jellySmall' ? 1 : 0 })}"/></div>`).join('')}</div>
      ${fresh && LORE[fresh] ? `<div class="newfoe"><span class="nf-tag">Nouveau</span><b>${ENEMIES[fresh].name}</b><small>${LORE[fresh].what} ${LORE[fresh].tip}</small></div>` : ''}
      <div class="pl-row">${heroChip()}${lootPreview(level.n)}</div>
      <div class="bonuses">${bonus('potion', INK_UI.potion, 'Potion de vie', '+25 % PV max')}${bonus('scroll', INK_UI.scroll, 'Parchemin', '1 pouvoir')}${bonus('aegis', INK_UI.aegis, 'Égide', '1 bouclier')}</div>
      <button class="btn primary big play">Jouer</button>
      <p class="fine">Une vie n’est retirée qu’en cas de défaite.</p>
      <button class="close-x" aria-label="Fermer">×</button>
    </div>`,
  );
  const choice: PreLevelChoice = { potion: false, scroll: false, aegis: false };
  // héros : un toucher passe au héros débloqué suivant
  const bindHero = () =>
    o.querySelector('.pl-hero')?.addEventListener('click', () => {
      const ids = (Object.keys(HEROES) as HeroId[]).filter((id) => heroUnlocked(id));
      if (ids.length < 2) return toast('Débloque d’autres héros en avançant sur la carte');
      s.heroId = ids[(ids.indexOf(s.heroId) + 1) % ids.length];
      persist();
      sfx('tap');
      o.querySelector('.pl-hero')!.outerHTML = heroChip();
      bindHero();
    });
  bindHero();
  o.querySelectorAll<HTMLButtonElement>('.bonus').forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.b as BonusId;
      // pas de bonus en réserve : on l'achète (or ou gemmes), il est équipé aussitôt
      if (s.bonuses[id] <= 0 && !choice[id]) {
        if (!buyBonus(id)) return;
        b.classList.remove('buy');
        b.querySelector('.price')!.outerHTML = `<i class="count">${s.bonuses[id]}</i>`;
        toast(`${b.querySelector('b')!.textContent} acheté${id === 'potion' ? 'e' : ''}`);
      }
      choice[id] = !choice[id];
      b.classList.toggle('on', choice[id]);
      sfx('tap');
    }),
  );
  return new Promise((resolve) => {
    o.querySelector('.play')!.addEventListener('click', async () => {
      sfx('tap');
      for (const k of Object.keys(choice) as (keyof PreLevelChoice)[]) if (choice[k]) s.bonuses[k]--;
      persist();
      await close(o);
      resolve(choice);
    });
    const cancel = async () => {
      await close(o);
      resolve(null);
    };
    o.querySelector('.close-x')!.addEventListener('click', cancel);
    o.querySelector('.scrim')!.addEventListener('click', cancel);
  });
}

// ───────────────────────────── choix du pouvoir ─────────────────────────────

const RARITY_LABEL = { common: 'Commun', rare: 'Rare', epic: 'Épique' } as const;

export function choosePower(offer: PowerId[], hero: HeroState, title = 'Choisis un pouvoir'): Promise<PowerId> {
  const cards = offer
    .map((id, i) => {
      const p = POWER_BY_ID[id];
      const owned = hero.powers[id] ?? 0;
      return `<button class="pcard r-${p.rarity}" data-id="${id}" style="--i:${i}">
        <div class="pcard-inner">
          <div class="pcard-back"><div class="moonmark"></div></div>
          <div class="pcard-front">
            <div class="rarity">${RARITY_LABEL[p.rarity]}</div>
            <div class="picon"><img src="${iconURL(INK_POWERS[id])}" alt=""/></div>
            <div class="pname">${p.name}${owned ? ` <small>×${owned + 1}</small>` : ''}</div>
            <div class="pdesc">${p.desc}</div>
          </div>
        </div>
      </button>`;
    })
    .join('');
  const o = overlay('power-overlay', `<div class="power-wrap"><h2 class="ptitle">${title}</h2><div class="pcards">${cards}</div></div>`);
  offer.forEach((_, i) => setTimeout(() => sfx('flip'), 450 + i * 160));
  return new Promise((resolve) => {
    let done = false;
    o.querySelectorAll<HTMLButtonElement>('.pcard').forEach((c) =>
      c.addEventListener('click', async () => {
        if (done || !c.closest('.in')) return;
        done = true;
        sfx('star');
        c.classList.add('picked');
        o.classList.add('decided');
        await new Promise((r) => setTimeout(r, 650));
        await close(o);
        resolve(c.dataset.id as PowerId);
      }),
    );
  });
}

// ───────────────────────────── victoire / défaite ─────────────────────────────

const BONUS_NAME = { potion: 'Potion de vie', scroll: 'Parchemin', aegis: 'Égide' } as const;

export function victory(level: LevelDef, r: CombatResult, res: AttemptResult, loot: Loot | null = null): Promise<'next' | 'map'> {
  const s = save();
  const firstThree = res.firstThree;
  const pass = res.pass;
  const tierUp = pass.tierAfter > pass.tierBefore;
  const dragon = subscribed();
  const gold = goldReward(level.n, firstThree, goldBonus(s.talents.fortune, dragon));
  s.gold += gold;
  persist();
  const o = overlay(
    'result-overlay win',
    `<div class="result">
      <div class="rays"></div>
      <h2 class="rtitle">Victoire&nbsp;!</h2>
      <div class="rstars">${[0, 1, 2].map((i) => `<div class="slot"><img class="empty" src="${iconURL(INK_UI.starEmpty)}"/>${i < r.stars ? `<img class="full" style="--d:${0.6 + i * 0.45}s" src="${iconURL(INK_UI.star)}"/>` : ''}</div>`).join('')}</div>
      <div class="rhero"></div>
      <div class="rstats"><div><img src="${iconURL(INK_UI.coin)}"/><b class="count" data-to="${gold}">0</b></div><div><span>Ennemis</span><b>${r.kills}</b></div><div><span>Temps</span><b>${Math.round(r.seconds)} s</b></div></div>
      ${dragon ? `<p class="fine dragon-gold">dont +25 % de l’Ordre du Dragon</p>` : ''}
      ${pass.points ? `<div class="rpass${tierUp ? ' up' : ''}"><img src="${iconURL(INK_UI.chest)}" alt=""/><span>Pass de saison : <b>+${pass.points} lunes</b>${tierUp ? ` · palier ${pass.tierAfter} atteint !` : ''}</span></div>` : ''}
      ${loot ? lootBlock(loot) : ''}
      ${res.chests.map((c) => `<div class="rchest"><img src="${iconURL(INK_UI.chest)}" alt=""/><span><b>Coffre d’étoiles</b> (${c.index * 20} ★) : +${c.gold} or · +${c.gems} gemmes · ${BONUS_NAME[c.bonus]}</span></div>`).join('')}
      <div class="ractions"><button class="btn ghost map">Carte</button><button class="btn primary next">Niveau suivant</button></div>
    </div>`,
  );
  o.querySelector('.rhero')!.appendChild(liveSprite(s.heroId, 130, 2.6, 'idle', { aiming: false, facing: 0.2 }));
  if (loot?.item) setTimeout(() => sfx('loot'), 1500);
  o.querySelector<HTMLButtonElement>('.lequip')?.addEventListener('click', (e) => {
    const b = e.currentTarget as HTMLButtonElement;
    equip(Number(b.dataset.uid));
    sfx('star');
    b.outerHTML = '<small class="lworn">Équipé</small>';
  });
  for (let i = 0; i < r.stars; i++) setTimeout(() => sfx('star'), 600 + i * 450);
  const c = o.querySelector<HTMLElement>('.count')!;
  const to = gold;
  const t0 = performance.now() + 900;
  const tick = (now: number) => {
    const k = Math.min(1, Math.max(0, (now - t0) / 800));
    c.textContent = `+${Math.round(to * k)}`;
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return new Promise((resolve) => {
    o.querySelector('.next')!.addEventListener('click', async () => (await close(o), resolve('next')));
    o.querySelector('.map')!.addEventListener('click', async () => (await close(o), resolve('map')));
  });
}

export function defeat(continuesUsed: number): Promise<'continue' | 'retry' | 'map'> {
  const s = save();
  const cost = continuesUsed === 0 ? 60 : 120;
  const can = continuesUsed < 2;
  const o = overlay(
    'result-overlay lose',
    `<div class="result">
      <h2 class="rtitle">Défaite</h2>
      <p class="rsub">L’ombre t’a rattrapée…</p>
      <div class="ghost-hero"></div>
      ${can ? `<button class="btn gem big cont" ${s.gems >= cost ? '' : 'disabled'}><span>Continuer</span><em><img src="${iconURL(INK_UI.gem)}"/>${cost}</em></button><p class="fine">Rend 50 % des PV et efface les projectiles.${s.gems < cost ? ` <button class="link-btn gems-cta">Gemmes : boutique</button>` : ''}</p><p class="fine cont-left">${continuesUsed === 0 ? '2 continues possibles (60 puis 120 gemmes)' : 'Dernier continue possible'}</p>` : ''}
      <div class="ractions"><button class="btn ghost map">Carte</button><button class="btn primary retry">Réessayer</button></div>
      ${subscribed() ? '' : `<button class="link-btn dragon-cta"><img src="${iconURL(INK_UI.crown)}" alt=""/>Ordre du Dragon : vies illimitées</button>`}
    </div>`,
  );
  // §11 : paywall en bouton secondaire de l'écran de défaite (le combat est terminé)
  o.querySelector('.dragon-cta')?.addEventListener('click', () =>
    openDragon('defeat', () => {
      if (subscribed()) o.querySelector('.dragon-cta')?.remove();
    }),
  );
  o.querySelector('.ghost-hero')!.appendChild(liveSprite('hero', 110, 2.2, 'idle'));
  // pas assez de gemmes : la boutique s'ouvre par-dessus l'écran de défaite (le combat est terminé)
  o.querySelector('.gems-cta')?.addEventListener('click', () =>
    void import('./menus.js').then((m) =>
      m.shopSheet(() => {
        const b = o.querySelector<HTMLButtonElement>('.cont');
        if (b) b.disabled = s.gems < cost;
        if (s.gems >= cost) o.querySelector('.gems-cta')?.remove();
      }),
    ),
  );
  return new Promise((resolve) => {
    o.querySelector('.cont')?.addEventListener('click', async () => {
      s.gems -= cost;
      persist();
      await close(o);
      resolve('continue');
    });
    o.querySelector('.retry')!.addEventListener('click', async () => (await close(o), resolve('retry')));
    o.querySelector('.map')!.addEventListener('click', async () => (await close(o), resolve('map')));
  });
}

export function pauseMenu(): Promise<'resume' | 'quit'> {
  const s = save();
  const tog = (k: keyof typeof s.settings, label: string) => `<label class="toggle"><span>${label}</span><input type="checkbox" data-k="${k}" ${s.settings[k] ? 'checked' : ''}/><i></i></label>`;
  const o = overlay(
    'sheet-overlay',
    `<div class="sheet small"><div class="sheet-head"><div class="lvl-num">Pause</div></div>
      ${tog('sound', 'Effets sonores')}${tog('music', 'Musique')}${tog('haptics', 'Vibrations')}${tog('reduceMotion', 'Réduire les animations')}
      <button class="btn primary big resume">Reprendre</button>
      <button class="btn ghost quit">Quitter le niveau</button></div>`,
  );
  o.querySelectorAll<HTMLInputElement>('input[data-k]').forEach((i) =>
    i.addEventListener('change', () => {
      (s.settings as unknown as Record<string, boolean>)[i.dataset.k!] = i.checked;
      persist();
      applyPrefs();
    }),
  );
  return new Promise((resolve) => {
    o.querySelector('.resume')!.addEventListener('click', async () => (await close(o), resolve('resume')));
    o.querySelector('.quit')!.addEventListener('click', async () => (await close(o), resolve('quit')));
  });
}

export function toast(text: string): void {
  const t = el(`<div class="toast">${text}</div>`);
  document.getElementById('app')!.appendChild(t);
  setTimeout(() => t.classList.add('in'), 10);
  setTimeout(() => t.remove(), 2400);
}
