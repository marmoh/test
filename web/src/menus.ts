/** §12.6 Écrans secondaires : Héros et talents, Boutique, Tournoi, Réglages (feuilles depuis la carte). */
import { HEROES, type HeroId } from '../../sim/src/content.js';
import { TALENTS } from '../../sim/src/constants.js';
import { tournamentScore } from '../../sim/src/formulas.js';
import { INK_UI, iconURL } from '../../art/src/icons.js';
import { liveSprite } from './portraits.js';
import { save, persist, talentCost, tournamentState } from './state.js';
import { el, toast } from './ui.js';
import { sfx, setSound } from './audio.js';

function sheet(cls: string, title: string, body: string): { o: HTMLElement; close: () => Promise<void> } {
  const o = el(`<div class="overlay sheet-overlay"><div class="scrim"></div><div class="sheet tall ${cls}"><div class="sheet-head"><div class="lvl-num">${title}</div></div><div class="sheet-body">${body}</div><button class="close-x" aria-label="Fermer">×</button></div></div>`);
  document.getElementById('app')!.appendChild(o);
  requestAnimationFrame(() => o.classList.add('in'));
  const close = () =>
    new Promise<void>((r) => {
      o.classList.remove('in');
      o.classList.add('out');
      setTimeout(() => (o.remove(), r()), 280);
    });
  o.querySelector('.close-x')!.addEventListener('click', () => void close());
  o.querySelector('.scrim')!.addEventListener('click', () => void close());
  return { o, close };
}

// ───────────────────────────── Héros et talents ─────────────────────────────

const HERO_UNLOCK: Record<HeroId, string> = { scout: 'Disponible', windMonk: 'Offre de départ', emberSorcerer: 'Terminer le Marais (niv. 120)' };
const HERO_BLURB: Record<HeroId, string> = {
  scout: 'Flèches de lune. Aucune faiblesse, aucune fioriture.',
  windMonk: 'Rafales d’air. Commence avec Vitesse +15 %.',
  emberSorcerer: 'Braises. Commence avec Flamme.',
};

export function heroesSheet(onChange: () => void): void {
  const s = save();
  const talentRow = (k: keyof typeof s.talents, name: string, per: string, icon: string) => {
    const r = s.talents[k];
    const max = r >= TALENTS.maxRank;
    return `<div class="talent" data-k="${k}"><img src="${iconURL(icon)}"/><div class="tinfo"><b>${name}</b><small>${per} par rang</small><div class="pips">${Array.from({ length: 10 }, (_, i) => `<i class="${i < r ? 'on' : ''}"></i>`).join('')}</div></div><button class="btn small buy" ${max || s.gold < talentCost(r) ? 'disabled' : ''}>${max ? 'Max' : `<img src="${iconURL(INK_UI.coin)}"/>${talentCost(r)}`}</button></div>`;
  };
  const { o } = sheet(
    'heroes',
    'Héros',
    `<div class="hero-cards">${(Object.keys(HEROES) as HeroId[])
      .map((id) => {
        const owned = s.heroes.includes(id);
        return `<button class="hero-card${s.heroId === id ? ' sel' : ''}${owned ? '' : ' locked'}" data-id="${id}"><div class="hc-sprite" data-sprite="${id}"></div><b>${HEROES[id].name}</b><small>${owned ? HERO_BLURB[id] : HERO_UNLOCK[id]}</small></button>`;
      })
      .join('')}</div>
    <h3 class="sec">Talents permanents <small>désactivés en tournoi</small></h3>
    <div class="talents">${talentRow('vigor', 'Vigueur', '+2 % PV', INK_UI.heart)}${talentRow('strength', 'Force', '+2 % dégâts', INK_UI.star)}${talentRow('agility', 'Agilité', '+1,5 % cadence', INK_UI.coin)}${talentRow('fortune', 'Fortune', '+5 % or', INK_UI.chest)}</div>
    <p class="fine">Or disponible : <b>${s.gold}</b></p>`,
  );
  o.querySelectorAll<HTMLElement>('[data-sprite]').forEach((d) => d.appendChild(liveSprite(d.dataset.sprite!, 92, 2.1, 'idle', { aiming: true, facing: 0.15 })));
  o.querySelectorAll<HTMLButtonElement>('.hero-card').forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.id as HeroId;
      if (!s.heroes.includes(id)) return toast(HERO_UNLOCK[id]);
      s.heroId = id;
      persist();
      o.querySelectorAll('.hero-card').forEach((c) => c.classList.toggle('sel', c === b));
      sfx('tap');
      onChange();
    }),
  );
  o.querySelectorAll<HTMLElement>('.talent').forEach((row) =>
    row.querySelector('.buy')!.addEventListener('click', () => {
      const k = row.dataset.k as keyof typeof s.talents;
      const cost = talentCost(s.talents[k]);
      if (s.gold < cost || s.talents[k] >= TALENTS.maxRank) return;
      s.gold -= cost;
      s.talents[k]++;
      persist();
      sfx('star');
      row.querySelectorAll('.pips i')[s.talents[k] - 1]?.classList.add('on', 'pop');
      const btn = row.querySelector<HTMLButtonElement>('.buy')!;
      const r = s.talents[k];
      btn.innerHTML = r >= TALENTS.maxRank ? 'Max' : `<img src="${iconURL(INK_UI.coin)}"/>${talentCost(r)}`;
      o.querySelectorAll<HTMLElement>('.talent').forEach((tr) => {
        const kk = tr.dataset.k as keyof typeof s.talents;
        tr.querySelector<HTMLButtonElement>('.buy')!.disabled = s.talents[kk] >= TALENTS.maxRank || s.gold < talentCost(s.talents[kk]);
      });
      o.querySelector('.fine b')!.textContent = String(s.gold);
      onChange();
    }),
  );
}

// ───────────────────────────── Boutique ─────────────────────────────

interface Product {
  id: string;
  name: string;
  price: string;
  gems?: number;
  note: string;
  kind: 'gems' | 'starter' | 'pass' | 'sub';
}
/** Mêmes identifiants que ios/Ombrelune.storekit. */
const PRODUCTS: Product[] = [
  { id: 'ombrelune.gems.handful', name: 'Poignée de gemmes', price: '0,99 €', gems: 100, note: '100 gemmes', kind: 'gems' },
  { id: 'ombrelune.gems.pouch', name: 'Bourse de gemmes', price: '4,99 €', gems: 550, note: '550 gemmes', kind: 'gems' },
  { id: 'ombrelune.gems.chest', name: 'Coffre de gemmes', price: '9,99 €', gems: 1200, note: '1 200 gemmes', kind: 'gems' },
];

export function shopSheet(onChange: () => void): void {
  const s = save();
  const { o } = sheet(
    'shop',
    'Boutique',
    `<div class="offer starter${s.starterPack ? ' owned' : ''}"><div class="ribbon">Une seule fois</div><div class="of-sprite" data-sprite="windMonk"></div><div><b>Offre de départ</b><small>300 gemmes · Moine du vent · 5 bonus</small></div><button class="btn primary small" data-buy="starter" ${s.starterPack ? 'disabled' : ''}>${s.starterPack ? 'Acquise' : '2,99 €'}</button></div>
    <div class="offer dragon"><img src="${iconURL(INK_UI.crown)}"/><div><b>Ordre du Dragon</b><small>Vies illimitées · 60 gemmes/semaine · +25 % or · apparence exclusive</small><small class="trial">Essai gratuit de 3 jours, puis 4,99 €/mois ou 39,99 €/an</small></div><button class="btn primary small" data-buy="sub">S’abonner</button></div>
    <h3 class="sec">Gemmes</h3>
    <div class="gem-grid">${PRODUCTS.map((p, i) => `<button class="gem-pack" data-buy="${p.id}"><div class="gp-gems" style="--n:${i + 1}">${`<img src="${iconURL(INK_UI.gem)}"/>`.repeat(i + 1)}</div><b>${p.note}</b><span class="price">${p.price}</span></button>`).join('')}</div>
    <h3 class="sec">Avec tes gemmes</h3>
    <div class="spend"><button class="btn ghost" data-spend="lives"><img src="${iconURL(INK_UI.heart)}"/> 5 vies <em><img src="${iconURL(INK_UI.gem)}"/>90</em></button>
    <button class="btn ghost" data-spend="potion"><img src="${iconURL(INK_UI.potion)}"/> Potion <em><img src="${iconURL(INK_UI.coin)}"/>150</em></button>
    <button class="btn ghost" data-spend="aegis"><img src="${iconURL(INK_UI.aegis)}"/> Égide <em><img src="${iconURL(INK_UI.coin)}"/>200</em></button></div>
    <p class="fine">Prototype web : les achats réels passent par StoreKit 2 dans l’app iOS. Ici, ils sont simulés. Aucun objet aléatoire, aucune publicité.</p>`,
  );
  o.querySelectorAll<HTMLElement>('[data-sprite]').forEach((d) => d.appendChild(liveSprite(d.dataset.sprite!, 64, 1.5, 'idle', { aiming: true })));
  o.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((b) =>
    b.addEventListener('click', () => {
      const id = b.dataset.buy!;
      const p = PRODUCTS.find((x) => x.id === id);
      if (p?.gems) s.gems += p.gems;
      else if (id === 'starter') {
        s.starterPack = true;
        s.gems += 300;
        if (!s.heroes.includes('windMonk')) s.heroes.push('windMonk');
        s.bonuses.potion += 2;
        s.bonuses.scroll += 2;
        s.bonuses.aegis += 1;
        b.disabled = true;
        b.textContent = 'Acquise';
      } else if (id === 'sub') return toast('Abonnement : disponible dans l’app iOS');
      persist();
      sfx('star');
      toast('Achat simulé ✓');
      onChange();
    }),
  );
  o.querySelectorAll<HTMLButtonElement>('[data-spend]').forEach((b) =>
    b.addEventListener('click', () => {
      const k = b.dataset.spend!;
      if (k === 'lives') {
        if (s.gems < 90) return toast('Pas assez de gemmes');
        s.gems -= 90;
        s.lives = { lives: 5, refillFrom: Date.now() / 1000 };
      } else {
        const cost = k === 'potion' ? 150 : 200;
        if (s.gold < cost) return toast('Pas assez d’or');
        s.gold -= cost;
        s.bonuses[k as 'potion' | 'aegis']++;
      }
      persist();
      sfx('tap');
      toast('C’est fait ✓');
      onChange();
    }),
  );
}

// ───────────────────────────── Tournoi ─────────────────────────────

export function tournamentSheet(weekKey: string, weekNo: number, onPlay: () => void): void {
  const t = tournamentState(weekKey);
  const ex = tournamentScore(42, 380, 150);
  const { o, close } = sheet(
    'tournament-sheet',
    `Tournoi · semaine ${weekNo}`,
    `<div class="tour-hero"><img src="${iconURL(INK_UI.trophy)}"/><div><b>4 salles · difficulté niveau 120</b><small>Même niveau, mêmes pouvoirs proposés et même héros pour tout le monde.</small></div></div>
    <div class="tour-stats"><div><span>Essais restants</span><b>${t.attempts}/5</b></div><div><span>Ton meilleur score</span><b>${t.best || '—'}</b></div></div>
    <h3 class="sec">Règles</h3>
    <ul class="rules"><li>Talents, bonus et « continuer » désactivés.</li><li>5 essais par semaine pour tout le monde, non achetables.</li><li>Score = ennemis × 100 + PV restants × 5 + (240 − secondes) × 40. Exemple : 42 ennemis, 380 PV, 150 s → <b>${ex}</b>.</li><li>Ton meilleur essai compte. Récompenses cosmétiques : top 1 %, 10 %, 50 % et participation.</li></ul>
    <p class="fine">Le classement hebdomadaire est tenu par Game Center dans l’app iOS.</p>
    <button class="btn primary big tplay" ${t.attempts > 0 ? '' : 'disabled'}>Jouer (${t.attempts} essai${t.attempts > 1 ? 's' : ''})</button>`,
  );
  o.querySelector('.tplay')!.addEventListener('click', async () => {
    await close();
    onPlay();
  });
}

// ───────────────────────────── Réglages ─────────────────────────────

export function settingsSheet(): void {
  const s = save();
  const tog = (k: keyof typeof s.settings, label: string, hint = '') => `<label class="toggle"><span>${label}${hint ? `<small>${hint}</small>` : ''}</span><input type="checkbox" data-k="${k}" ${s.settings[k] ? 'checked' : ''}/><i></i></label>`;
  const { o } = sheet(
    'settings',
    'Réglages',
    `${tog('sound', 'Son')}${tog('haptics', 'Vibrations')}${tog('autoFire', 'Tir automatique', 'Le héros tire aussi en se déplaçant')}${tog('reduceMotion', 'Réduire les animations')}
    <button class="btn ghost wide restore">Restaurer les achats</button>
    <h3 class="sec">Confidentialité</h3><p class="fine left">Ta progression reste sur ton appareil (et dans ton iCloud sur iOS). Aucune publicité, aucun traçage.</p>
    <h3 class="sec">Crédits</h3><p class="fine left">Polices <b>IM Fell English SC</b> (Igino Marini) et <b>Alegreya Sans</b> (Juan Pablo del Peral), licence SIL Open Font License 1.1. Sons synthétisés en direct.</p>
    <button class="btn ghost wide reset">Effacer la progression</button>`,
  );
  o.querySelectorAll<HTMLInputElement>('input[data-k]').forEach((i) =>
    i.addEventListener('change', () => {
      (s.settings as Record<string, boolean>)[i.dataset.k!] = i.checked;
      if (i.dataset.k === 'sound') setSound(i.checked);
      persist();
    }),
  );
  o.querySelector('.restore')!.addEventListener('click', () => toast('Restauration : disponible dans l’app iOS'));
  const reset = o.querySelector<HTMLButtonElement>('.reset')!;
  reset.addEventListener('click', () => {
    if (reset.dataset.armed) {
      try {
        localStorage.removeItem('ombrelune.save.v1');
      } catch {
        /* rien */
      }
      location.reload();
    } else {
      reset.dataset.armed = '1';
      reset.textContent = 'Toucher encore pour confirmer';
      reset.classList.add('danger');
    }
  });
}
