/**
 * §11 Ordre du Dragon (abonnement simulé), feuille des vies et publicité récompensée simulée.
 *
 * Paywall seulement là où §11 le prévoit : première panne de vies, bouton secondaire de la défaite,
 * boutique (et « Gérer l'abonnement » dans les Réglages, à la demande). Jamais en combat.
 * Publicité : uniquement à la demande, depuis la feuille des vies (carte). Jamais en combat ni en tournoi,
 * jamais pour les abonnés ; 3 par jour avec un délai entre deux (DECISIONS #37).
 */
import { INK_UI, iconURL } from '../../art/src/icons.js';
import { INK, CUT, GOLD_LEAF } from '../../art/src/palette.js';
import { secondsToNextLife } from '../../sim/src/formulas.js';
import { LIVES } from '../../sim/src/constants.js';
import { DRAGON, REWARDED_AD, cancelRenewal, resumeRenewal, subscribe, type DragonPlan, type Subscription } from './economy.js';
import {
  adState,
  claimWeekly,
  lives,
  now,
  persist,
  recordEntitlements,
  restorePurchases,
  rewardAd,
  save,
  subscribed,
  subscription,
  weeklyGemsReady,
} from './state.js';
import { clearPortraits } from './portraits.js';
import { el, sheet, toast } from './ui.js';
import { sfx } from './audio.js';

// ───────────────────────────── emblème ─────────────────────────────

/** Dragon serpentin découpé dans l'encre devant une lune de papier, cerclé d'or à la feuille. */
export function dragonEmblem(size = 132): string {
  const N = 28;
  const top: string[] = [];
  const bot: string[] = [];
  const c = (t: number) => ({ x: -50 + 92 * t, y: 13 * Math.sin(t * Math.PI * 2.1 + 0.5) + 6 - 8 * t });
  let end = c(1);
  let dir = { x: 1, y: 0 };
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const p = c(t);
    const q = c(Math.min(1, t + 0.01));
    const r = c(Math.max(0, t - 0.01));
    const dx = q.x - r.x;
    const dy = q.y - r.y;
    const len = Math.hypot(dx, dy) || 1;
    const n = { x: dy / len, y: -dx / len };
    const w = 1.2 + 6.2 * Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 0.7 + (t > 0.9 ? 2.5 : 0);
    top.push(`${(p.x + n.x * w).toFixed(1)} ${(p.y + n.y * w).toFixed(1)}`);
    // crête dorsale : une pointe toutes les deux tranches
    if (i % 2 === 1 && t > 0.08 && t < 0.88) top.push(`${(p.x + n.x * (w + 5.5) + (dx / len) * 1.5).toFixed(1)} ${(p.y + n.y * (w + 5.5) + (dy / len) * 1.5).toFixed(1)}`);
    bot.unshift(`${(p.x - n.x * w).toFixed(1)} ${(p.y - n.y * w).toFixed(1)}`);
    if (i === N) {
      end = p;
      dir = { x: dx / len, y: dy / len };
    }
  }
  // tête : museau, mâchoire ouverte, corne recourbée
  const n = { x: dir.y, y: -dir.x };
  const P = (a: number, b: number) => `${(end.x + dir.x * a + n.x * b).toFixed(1)} ${(end.y + dir.y * a + n.y * b).toFixed(1)}`;
  const head = [P(0, 9), P(5, 8), P(13, 4), P(17, 1.5), P(9, 0), P(16, -3.5), P(12, -5), P(3, -8), P(-2, -9)];
  const horn = `M${P(-1, 8.5)} Q${P(-8, 16)} ${P(-15, 15)} Q${P(-7, 12)} ${P(4, 7.5)} Z`;
  const eye = (() => {
    const [x, y] = P(7, 3.2).split(' ');
    return `<circle cx="${x}" cy="${y}" r="1.6" fill="${CUT}"/>`;
  })();
  const body = `M${top.join(' L')} L${head.join(' L')} L${bot.join(' L')} Z`;
  return `<svg class="dragon-emblem" viewBox="-66 -66 132 132" width="${size}" height="${size}" aria-hidden="true">
    <circle r="62" fill="${INK}"/><circle r="57" fill="none" stroke="${GOLD_LEAF}" stroke-width="3"/>
    <circle r="51" fill="${CUT}"/><circle cx="20" cy="-14" r="40" fill="${INK}" opacity=".12"/>
    <circle cx="-18" cy="-22" r="13" fill="none" stroke="${INK}" stroke-opacity=".25" stroke-width="1.5"/>
    <g transform="translate(3 6)"><path d="${body}" fill="${INK}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>
    <path d="${horn}" fill="${INK}" stroke="${GOLD_LEAF}" stroke-width="1.2"/>${eye}</g>
    <g fill="${GOLD_LEAF}" stroke="${INK}" stroke-width="1"><path d="M0 -62 l4 7 h-8 Z"/><path d="M0 62 l4 -7 h-8 Z"/><path d="M-62 0 l7 4 v-8 Z"/><path d="M62 0 l-7 4 v-8 Z"/></g>
  </svg>`;
}

// ───────────────────────────── dates ─────────────────────────────

function dateFr(t: number): string {
  const d = new Date(t * 1000);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', ...(sameYear ? {} : { year: 'numeric' }) });
}

function clock(sec: number): string {
  const s = Math.max(0, Math.ceil(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h} h ${String(m).padStart(2, '0')}` : `${m}:${r}`;
}

// ───────────────────────────── Ordre du Dragon ─────────────────────────────

export type DragonContext = 'lives' | 'defeat' | 'shop' | 'settings';

const KICKER: Record<DragonContext, string> = {
  lives: 'Plus de vies ? Les membres de l’Ordre n’en manquent jamais.',
  defeat: 'Réessaie autant que tu veux, sans perdre de vie.',
  shop: '',
  settings: '',
};

const perk = (icon: string, title: string, desc: string, right = '') =>
  `<li><img src="${iconURL(icon)}" alt=""/><div><b>${title}</b><small>${desc}</small></div>${right}</li>`;

function planCards(selected: DragonPlan, current: DragonPlan | null): string {
  const card = (id: DragonPlan, note: string, save = '') => {
    const p = DRAGON.plans[id];
    return `<button class="plan${id === selected ? ' sel' : ''}" data-plan="${id}" role="radio" aria-checked="${id === selected}">
      ${save ? `<span class="pl-save">${save}</span>` : ''}<span class="pl-name">${p.label}${current === id ? ' <em>· actuelle</em>' : ''}</span>
      <span class="pl-price">${p.price}<small> / ${p.per}</small></span><span class="pl-note">${note}</span></button>`;
  };
  return `<div class="plans" role="radiogroup" aria-label="Formule">${card('yearly', 'soit 3,33 € par mois', `−${DRAGON.yearlySavingPct} %`)}${card('monthly', 'sans engagement')}</div>`;
}

function terms(plan: DragonPlan, trial: boolean): string {
  const p = DRAGON.plans[plan];
  return trial
    ? `${DRAGON.trialDays} jours gratuits, puis ${p.price} par ${p.per}. Renouvellement automatique ; résiliable à tout moment, au plus tard 24 h avant la fin de l’essai pour ne rien payer.`
    : `${p.price} par ${p.per}, renouvellement automatique, résiliable à tout moment jusqu’à 24 h avant la fin de la période.`;
}

function statusLine(s: Subscription): string {
  const p = s.plan ? DRAGON.plans[s.plan] : DRAGON.plans.monthly;
  let line: string;
  if (s.inTrial) line = `essai gratuit jusqu’au ${dateFr(s.expiresAt)}${s.autoRenew ? `, puis ${DRAGON.plans[s.nextPlan ?? s.plan!].price} par ${DRAGON.plans[s.nextPlan ?? s.plan!].per}` : ', sans renouvellement'}`;
  else if (s.autoRenew) line = `renouvellement le ${dateFr(s.expiresAt)} (${p.price})`;
  else line = `résilié · avantages jusqu’au ${dateFr(s.expiresAt)}`;
  if (s.nextPlan && s.autoRenew) line += ` · formule ${DRAGON.plans[s.nextPlan].adj} à cette date`;
  return line;
}

/** Écran de l'Ordre du Dragon : offre (paywall) si non abonné, gestion sinon. */
export function openDragon(context: DragonContext, onClose?: () => void): void {
  const st = save();
  let plan: DragonPlan = 'yearly';
  let welcome = false;
  const { o } = sheet('dragon-sheet', 'Ordre du Dragon', '', onClose);
  const body = o.querySelector<HTMLElement>('.sheet-body')!;

  const renderOffer = () => {
    const trial = !st.subscription.trialUsed;
    body.innerHTML = `<div class="dragon-hero">${dragonEmblem()}</div>
      ${KICKER[context] ? `<p class="kicker">${KICKER[context]}</p>` : ''}
      <ul class="perks">${perk(INK_UI.heart, 'Vies illimitées', 'Une défaite ne coûte plus de vie.')}${perk(INK_UI.gem, `${DRAGON.weeklyGems} gemmes chaque semaine`, 'À réclamer sur la carte, chaque lundi.')}${perk(INK_UI.crown, 'Parure du Dragon', 'Cornes et col d’or, réservés à l’Ordre.')}${perk(INK_UI.coin, '+25 % d’or', 'Sur chaque victoire.')}</ul>
      ${planCards(plan, null)}
      <button class="btn primary big subscribe">${trial ? `Essayer ${DRAGON.trialDays} jours gratuits` : `S’abonner · ${DRAGON.plans[plan].price} / ${DRAGON.plans[plan].per}`}</button>
      <p class="fine terms">${terms(plan, trial)}</p>
      <div class="dragon-links"><button class="link-btn restore">Restaurer les achats</button></div>
      <p class="sim-note">Prototype web : achat simulé, aucun paiement. Sur iPhone, l’achat passe par l’App Store.</p>`;
    body.querySelectorAll<HTMLButtonElement>('.plan').forEach((b) =>
      b.addEventListener('click', () => {
        plan = b.dataset.plan as DragonPlan;
        sfx('tap');
        renderOffer();
      }),
    );
    const buy = body.querySelector<HTMLButtonElement>('.subscribe')!;
    buy.addEventListener('click', () => {
      buy.disabled = true;
      buy.textContent = 'Confirmation…';
      setTimeout(() => {
        if (!o.isConnected) return;
        st.subscription = subscribe(st.subscription, plan, now());
        persist();
        recordEntitlements();
        clearPortraits();
        sfx('win');
        welcome = true;
        render();
      }, 700);
    });
    body.querySelector('.restore')!.addEventListener('click', () => {
      const { restored } = restorePurchases();
      clearPortraits();
      toast(restored.length ? `Restauré : ${restored.join(', ')}` : 'Aucun achat à restaurer');
      render();
    });
  };

  const renderMember = () => {
    let confirmCancel = false;
    const draw = () => {
      const s = subscription();
      const ready = weeklyGemsReady();
      body.innerHTML = `<div class="dragon-hero">${dragonEmblem(116)}<div class="stamp${welcome ? ' fresh' : ''}">Membre</div></div>
        ${welcome ? `<p class="kicker">Bienvenue dans l’Ordre du Dragon.</p>` : ''}
        <p class="dragon-status"><b>Formule ${DRAGON.plans[s.plan!].adj}</b> · ${statusLine(s)}</p>
        <ul class="perks live">
          ${perk(INK_UI.heart, 'Vies illimitées', 'Les défaites ne coûtent plus de vie.', '<span class="on">actif</span>')}
          ${perk(INK_UI.gem, `${DRAGON.weeklyGems} gemmes cette semaine`, ready ? 'Ton tribut t’attend.' : 'Déjà réclamées · les suivantes lundi.', ready ? `<button class="btn gem small claim">Réclamer</button>` : '<span class="on">reçues</span>')}
          ${perk(INK_UI.crown, 'Parure du Dragon', 'Cornes et col d’or sur ton héros.', `<label class="toggle mini" aria-label="Porter la parure"><input type="checkbox" class="skin" ${s.skin ? 'checked' : ''}/><i></i></label>`)}
          ${perk(INK_UI.coin, '+25 % d’or', 'Sur chaque victoire.', '<span class="on">actif</span>')}
        </ul>
        <h3 class="sec">Formule <small>le changement prend effet au renouvellement</small></h3>
        ${planCards(s.nextPlan ?? s.plan!, s.plan)}
        ${
          s.autoRenew
            ? confirmCancel
              ? `<div class="confirm"><p>Tu gardes tes avantages jusqu’au <b>${dateFr(s.expiresAt)}</b>, puis l’abonnement s’arrête.</p><div class="confirm-row"><button class="btn ghost keep">Garder</button><button class="btn danger do-cancel">Résilier</button></div></div>`
              : `<button class="btn ghost wide cancel">Résilier le renouvellement</button>`
            : `<button class="btn primary wide resume">Réactiver le renouvellement</button>`
        }
        <p class="fine left">Sur iPhone, l’abonnement se gère dans les réglages de l’App Store (Gérer l’abonnement).</p>
        <p class="sim-note">Prototype web : abonnement simulé.</p>`;
      body.querySelector('.claim')?.addEventListener('click', () => {
        const g = claimWeekly();
        if (g) (sfx('star'), toast(`+${g} gemmes`));
        draw();
      });
      body.querySelector<HTMLInputElement>('.skin')?.addEventListener('change', (e) => {
        st.subscription.skin = (e.target as HTMLInputElement).checked;
        persist();
        clearPortraits();
        sfx('tap');
      });
      body.querySelectorAll<HTMLButtonElement>('.plan').forEach((b) =>
        b.addEventListener('click', () => {
          const p = b.dataset.plan as DragonPlan;
          st.subscription = subscribe(st.subscription, p, now());
          persist();
          recordEntitlements();
          sfx('tap');
          toast(st.subscription.nextPlan ? `Formule ${DRAGON.plans[p].adj} au renouvellement` : `Formule ${DRAGON.plans[p].adj} conservée`);
          draw();
        }),
      );
      body.querySelector('.cancel')?.addEventListener('click', () => ((confirmCancel = true), draw()));
      body.querySelector('.keep')?.addEventListener('click', () => ((confirmCancel = false), draw()));
      body.querySelector('.do-cancel')?.addEventListener('click', () => {
        st.subscription = cancelRenewal(st.subscription, now());
        persist();
        recordEntitlements();
        confirmCancel = false;
        toast('Renouvellement résilié');
        draw();
      });
      body.querySelector('.resume')?.addEventListener('click', () => {
        st.subscription = resumeRenewal(st.subscription, now());
        persist();
        recordEntitlements();
        sfx('star');
        draw();
      });
    };
    draw();
  };

  const render = () => (subscribed() ? renderMember() : renderOffer());
  render();
}

// ───────────────────────────── vies et publicité ─────────────────────────────

const AD_REASON: Record<string, string> = {
  full: 'Tes vies sont au maximum.',
  daily: `Tu as vu les ${REWARDED_AD.perDay} publicités du jour. Reviens demain.`,
};

/** Feuille « Vies » (compteur de vies de la carte, ou plus de vies avant un niveau). */
export function livesSheet(onClose?: () => void): Promise<void> {
  return new Promise((resolve) => {
    const { o } = sheet('lives-sheet', 'Vies', '', () => {
      onClose?.();
      resolve();
    });
    const body = o.querySelector<HTMLElement>('.sheet-body')!;
    const head = o.querySelector<HTMLElement>('.lvl-num')!;
    let busy = false;
    const render = () => {
      const st = save();
      const l = lives();
      const dragon = subscribed();
      const ad = adState();
      head.textContent = dragon ? 'Vies illimitées' : l.lives === 0 ? 'Plus de vies' : 'Vies';
      const next = secondsToNextLife(l, now());
      const hearts = Array.from({ length: LIVES.max }, (_, i) => `<img class="${dragon || i < l.lives ? 'on' : ''}" src="${iconURL(INK_UI.heart)}" alt=""/>`).join('');
      const adLabel = ad.ok
        ? `${ad.left} restante${ad.left > 1 ? 's' : ''} aujourd’hui`
        : ad.reason === 'cooldown'
          ? `Prochaine dans ${clock(ad.wait)}`
          : AD_REASON[ad.reason ?? 'full'];
      body.innerHTML = dragon
        ? `<div class="hearts">${hearts}<span class="inf">∞</span></div>
           <p class="lives-line">L’Ordre du Dragon t’offre des vies illimitées. Aucune publicité.</p>`
        : `<div class="hearts">${hearts}</div>
           <p class="lives-line">${next === null ? 'Vies au maximum.' : `Prochaine vie dans <b class="tnum">${clock(next)}</b>`}</p>
           <button class="btn jade wide watch" ${ad.ok ? '' : 'disabled'}><span class="w-main">Regarder une courte pub</span><em>+1 <img src="${iconURL(INK_UI.heart)}" alt="vie"/></em><small>${adLabel}</small></button>
           <button class="btn ghost wide refill" ${l.lives >= LIVES.max ? 'disabled' : ''}><span class="w-main">Remplir les 5 vies</span><em><img src="${iconURL(INK_UI.gem)}" alt="gemmes"/>90</em></button>
           <p class="fine">Publicités uniquement si tu le demandes, jamais pendant un niveau ni en tournoi. ${REWARDED_AD.perDay} par jour au plus${st.settings.personalizedAds ? '' : ', non personnalisées'}.</p>`;
      body.querySelector('.watch')?.addEventListener('click', async () => {
        if (busy) return;
        busy = true;
        const ok = await playRewardedAd();
        busy = false;
        if (ok && rewardAd()) {
          sfx('star');
          toast('+1 vie');
        }
        if (o.isConnected) render();
      });
      body.querySelector('.refill')?.addEventListener('click', () => {
        if (st.gems < 90) return toast('Pas assez de gemmes');
        st.gems -= 90;
        st.lives = { lives: LIVES.max, refillFrom: now() };
        persist();
        sfx('star');
        toast('Vies remplies');
        render();
      });
    };
    render();
    const tick = () => {
      if (!o.isConnected) return;
      if (!busy) {
        const t = body.querySelector('.tnum');
        const l = lives();
        const next = secondsToNextLife(l, now());
        const ad = adState();
        // re-rendu complet seulement quand quelque chose change d'état (vie gagnée, pub de nouveau possible)
        const sig = `${l.lives}|${ad.ok}|${ad.reason}`;
        if (sig !== body.dataset.sig) {
          body.dataset.sig = sig;
          render();
        } else {
          if (t && next !== null) t.textContent = clock(next);
          const small = body.querySelector('.watch small');
          if (small && ad.reason === 'cooldown') small.textContent = `Prochaine dans ${clock(ad.wait)}`;
        }
      }
      setTimeout(tick, 1000);
    };
    tick();
  });
}

/**
 * Publicité récompensée simulée : 5 s, marquée « publicité simulée ».
 * Résout `true` si elle a été vue jusqu'au bout et que la récompense est demandée, `false` si fermée avant.
 * Dans l'app iOS, c'est `AdService.presentRewarded()` (factice aujourd'hui, AdMob ou AppLovin plus tard).
 */
export function playRewardedAd(): Promise<boolean> {
  const total = REWARDED_AD.simulatedSeconds;
  const R = 26;
  const C = 2 * Math.PI * R;
  const o = el(`<div class="overlay ad-overlay" role="dialog" aria-label="Publicité simulée">
    <div class="scrim"></div>
    <div class="ad-frame">
      <div class="ad-tag">Publicité simulée</div>
      <div class="ad-stage">
        <div class="ad-curtain l"></div><div class="ad-curtain r"></div>
        <div class="ad-card"><span class="ad-k">Entracte</span><p>Ici passera une courte vidéo d’un annonceur.</p><small>Aucune donnée n’est envoyée : rien n’est réellement diffusé dans le prototype.</small></div>
      </div>
      <div class="ad-foot">
        <svg class="ad-ring" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${R}" fill="${CUT}" stroke="${INK}" stroke-opacity=".2" stroke-width="5"/><circle class="arc" cx="32" cy="32" r="${R}" fill="none" stroke="${INK}" stroke-width="5" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="0" transform="rotate(-90 32 32)"/><text x="32" y="39" text-anchor="middle">${total}</text></svg>
        <div class="ad-msg">Ta vie arrive dans <b class="secs">${total}</b> s</div>
        <button class="btn ghost small ad-close">Fermer sans récompense</button>
      </div>
    </div>
  </div>`);
  document.getElementById('app')!.appendChild(o);
  requestAnimationFrame(() => o.classList.add('in'));
  const arc = o.querySelector<SVGCircleElement>('.arc')!;
  const num = o.querySelector('svg text')!;
  const secs = o.querySelector('.secs')!;
  const btn = o.querySelector<HTMLButtonElement>('.ad-close')!;
  const msg = o.querySelector<HTMLElement>('.ad-msg')!;
  const t0 = performance.now();
  let done = false;
  let raf = 0;
  return new Promise((resolve) => {
    const finish = (ok: boolean) => {
      cancelAnimationFrame(raf);
      o.classList.remove('in');
      o.classList.add('out');
      setTimeout(() => o.remove(), 280);
      resolve(ok);
    };
    const frame = (ms: number) => {
      const elapsed = Math.min(total, (ms - t0) / 1000);
      arc.setAttribute('stroke-dashoffset', (C * (elapsed / total)).toFixed(1));
      const left = Math.ceil(total - elapsed);
      num.textContent = String(left);
      secs.textContent = String(left);
      if (elapsed >= total && !done) {
        done = true;
        num.textContent = '✓';
        msg.textContent = 'Merci d’avoir regardé.';
        btn.className = 'btn primary small ad-claim';
        btn.innerHTML = `Récupérer ma vie <img src="${iconURL(INK_UI.heart)}" alt=""/>`;
        return;
      }
      if (!done) raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    btn.addEventListener('click', () => finish(done));
  });
}

/** Première fois sans vie : l'offre de l'Ordre (§11), puis la feuille des vies. Ensuite : la feuille seule. */
export async function outOfLives(onChange: () => void): Promise<void> {
  const st = save();
  if (!st.livesPaywallSeen && !subscribed()) {
    st.livesPaywallSeen = true;
    persist();
    await new Promise<void>((r) => openDragon('lives', r));
    onChange();
    if (subscribed()) return;
  }
  await livesSheet(onChange);
}
