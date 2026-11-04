/** §12.6 Écrans secondaires : Héros et talents, Boutique, Tournoi, Réglages (feuilles depuis la carte). */
import { HEROES, type HeroId } from '../../sim/src/content.js';
import { TALENTS } from '../../sim/src/constants.js';
import { tournamentScore } from '../../sim/src/formulas.js';
import { INK_UI, iconURL } from '../../art/src/icons.js';
import { liveSprite } from './portraits.js';
import { APP_NAME } from '../../sim/src/constants.js';
import { save, persist, talentCost, tournamentState, subscribed, subscription, recordEntitlements, restorePurchases, eraseProgress } from './state.js';
import { sheet, toast } from './ui.js';
import { sfx } from './audio.js';
import { applyPrefs } from './prefs.js';
import { clearPortraits } from './portraits.js';
import { DRAGON, REWARDED_AD } from './economy.js';
import { openDragon } from './dragon.js';

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
    ${
      subscribed()
        ? `<label class="toggle parure"><span>Parure du Dragon<small>Apparence exclusive de l’Ordre du Dragon</small></span><input type="checkbox" class="skin" ${s.subscription.skin ? 'checked' : ''}/><i></i></label>`
        : `<p class="fine left parure-locked"><img src="${iconURL(INK_UI.crown)}" alt=""/> Parure du Dragon : apparence réservée aux membres de l’Ordre du Dragon.</p>`
    }
    <h3 class="sec">Talents permanents <small>désactivés en tournoi</small></h3>
    <div class="talents">${talentRow('vigor', 'Vigueur', '+2 % PV', INK_UI.heart)}${talentRow('strength', 'Force', '+2 % dégâts', INK_UI.star)}${talentRow('agility', 'Agilité', '+1,5 % cadence', INK_UI.coin)}${talentRow('fortune', 'Fortune', '+5 % or', INK_UI.chest)}</div>
    <p class="fine">Or disponible : <b>${s.gold}</b></p>`,
  );
  o.querySelectorAll<HTMLElement>('[data-sprite]').forEach((d) => d.appendChild(liveSprite(d.dataset.sprite!, 92, 2.1, 'idle', { aiming: true, facing: 0.15 })));
  o.querySelector<HTMLInputElement>('.skin')?.addEventListener('change', (e) => {
    s.subscription.skin = (e.target as HTMLInputElement).checked;
    persist();
    clearPortraits();
    sfx('tap');
    onChange();
  });
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
    <div class="offer dragon"><img src="${iconURL(INK_UI.crown)}"/><div><b>Ordre du Dragon</b><small>Vies illimitées · ${DRAGON.weeklyGems} gemmes/semaine · +25 % or · apparence exclusive</small><small class="trial">${subscribed() ? 'Tu es membre de l’Ordre.' : s.subscription.trialUsed ? '4,99 €/mois ou 39,99 €/an' : 'Essai gratuit de 3 jours, puis 4,99 €/mois ou 39,99 €/an'}</small></div><button class="btn primary small dragon-open">${subscribed() ? 'Gérer' : 'Découvrir'}</button></div>
    <h3 class="sec">Gemmes</h3>
    <div class="gem-grid">${PRODUCTS.map((p, i) => `<button class="gem-pack" data-buy="${p.id}"><div class="gp-gems" style="--n:${i + 1}">${`<img src="${iconURL(INK_UI.gem)}"/>`.repeat(i + 1)}</div><b>${p.note}</b><span class="price">${p.price}</span></button>`).join('')}</div>
    <h3 class="sec">Avec tes gemmes</h3>
    <div class="spend"><button class="btn ghost" data-spend="lives"><img src="${iconURL(INK_UI.heart)}"/> 5 vies <em><img src="${iconURL(INK_UI.gem)}"/>90</em></button>
    <button class="btn ghost" data-spend="potion"><img src="${iconURL(INK_UI.potion)}"/> Potion <em><img src="${iconURL(INK_UI.coin)}"/>150</em></button>
    <button class="btn ghost" data-spend="aegis"><img src="${iconURL(INK_UI.aegis)}"/> Égide <em><img src="${iconURL(INK_UI.coin)}"/>200</em></button></div>
    <p class="fine">Prototype web : les achats réels passent par StoreKit 2 dans l’app iOS. Ici, ils sont simulés. Aucun objet aléatoire. Publicité seulement si tu la demandes, contre une vie.</p>`,
  );
  // §11 : la boutique est l'un des trois endroits où l'offre d'abonnement est présentée
  o.querySelector('.dragon-open')!.addEventListener('click', () => openDragon('shop', onChange));
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
      }
      persist();
      recordEntitlements();
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

// ───────────────────────────── Réglages (§12.6) ─────────────────────────────

function dragonSummary(): string {
  if (!subscribed()) return 'Non membre';
  const sub = subscription();
  const d = new Date(sub.expiresAt * 1000).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  const plan = DRAGON.plans[sub.plan!].adj;
  return sub.inTrial ? `Essai gratuit jusqu’au ${d}` : sub.autoRenew ? `Formule ${plan} · renouvellement le ${d}` : `Résilié · actif jusqu’au ${d}`;
}

export function settingsSheet(onChange: () => void = () => undefined): void {
  const s = save();
  const tog = (k: keyof typeof s.settings, label: string, hint = '') =>
    `<label class="toggle"><span>${label}${hint ? `<small>${hint}</small>` : ''}</span><input type="checkbox" data-k="${k}" ${s.settings[k] ? 'checked' : ''}/><i></i></label>`;
  const { o } = sheet(
    'settings',
    'Réglages',
    `<h3 class="sec">Son</h3>
    ${tog('sound', 'Effets sonores')}${tog('music', 'Musique', 'Boîte à musique synthétisée en direct')}${tog('haptics', 'Vibrations')}
    <h3 class="sec">Jeu</h3>
    ${tog('autoFire', 'Tir automatique', 'Ta héroïne tire aussi en se déplaçant (désactivable, sauf en tournoi)')}${tog('reduceMotion', 'Réduire les animations', 'Coupe secousses, arrêts sur image et animations décoratives')}
    <h3 class="sec">Achats</h3>
    <button class="row-btn manage"><span>Gérer l’abonnement<small class="dragon-sum">Ordre du Dragon · ${dragonSummary()}</small></span><b>›</b></button>
    <button class="row-btn restore"><span>Restaurer les achats<small>Offre de départ et Ordre du Dragon</small></span><b>›</b></button>
    <h3 class="sec">Confidentialité</h3>
    ${tog('personalizedAds', 'Publicités personnalisées', 'Désactivé par défaut. Sur iPhone, active la demande de suivi d’Apple (ATT).')}
    <p class="fine left">Ta progression reste sur ton appareil (et dans ton iCloud sur iPhone). Aucun compte, aucun traçage. La seule publicité est celle que tu choisis de regarder pour gagner une vie : ${REWARDED_AD.perDay} par jour au plus, jamais pendant un niveau ni en tournoi, jamais pour les membres de l’Ordre. Sans ton accord, elle n’est pas personnalisée.</p>
    <h3 class="sec">Crédits</h3>
    <div class="credits">
      <p><b class="f-display">IM Fell English SC</b> — Igino Marini. Copyright © 2010, Igino Marini.</p>
      <p><b>Alegreya Sans</b> — Juan Pablo del Peral (Huerta Tipográfica). Copyright © 2013, The Alegreya Sans Project Authors.</p>
      <p class="fine left">Polices distribuées sous licence SIL Open Font License 1.1 (openfontlicense.org). Sons et musique synthétisés en direct, sans fichier sous licence.</p>
    </div>
    <h3 class="sec">Progression</h3>
    <div class="erase">
      <button class="btn ghost wide reset">Effacer la progression</button>
    </div>
    <p class="fine version">${APP_NAME} · prototype web 0.1</p>`,
    onChange,
  );
  o.querySelectorAll<HTMLInputElement>('input[data-k]').forEach((i) =>
    i.addEventListener('change', () => {
      (s.settings as unknown as Record<string, boolean>)[i.dataset.k!] = i.checked;
      persist();
      applyPrefs();
      if (i.dataset.k === 'sound' && i.checked) sfx('tap');
    }),
  );
  o.querySelector('.manage')!.addEventListener('click', () =>
    openDragon('settings', () => {
      const sum = o.querySelector('.dragon-sum');
      if (sum) sum.textContent = `Ordre du Dragon · ${dragonSummary()}`;
      onChange();
    }),
  );
  o.querySelector('.restore')!.addEventListener('click', () => {
    const { restored } = restorePurchases();
    clearPortraits();
    toast(restored.length ? `Restauré : ${restored.join(', ')}` : 'Aucun achat à restaurer');
    const sum = o.querySelector('.dragon-sum');
    if (sum) sum.textContent = `Ordre du Dragon · ${dragonSummary()}`;
    onChange();
  });
  // confirmation intégrée (pas de boîte de dialogue du navigateur)
  const zone = o.querySelector<HTMLElement>('.erase')!;
  const idle = zone.innerHTML;
  const arm = () => {
    zone.innerHTML = `<div class="confirm danger-zone"><p><b>Tout effacer ?</b> Étoiles, niveaux, or, gemmes, talents et bonus seront perdus. Tes achats (offre de départ, Ordre du Dragon) restent récupérables avec « Restaurer les achats ».</p><div class="confirm-row"><button class="btn ghost keep">Annuler</button><button class="btn danger do-erase">Effacer</button></div></div>`;
    zone.scrollIntoView({ block: 'end', behavior: 'smooth' });
    zone.querySelector('.keep')!.addEventListener('click', () => {
      zone.innerHTML = idle;
      zone.querySelector('.reset')!.addEventListener('click', arm);
    });
    zone.querySelector('.do-erase')!.addEventListener('click', () => {
      eraseProgress();
      location.reload();
    });
  };
  zone.querySelector('.reset')!.addEventListener('click', arm);
}
