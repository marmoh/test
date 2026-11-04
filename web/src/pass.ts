/**
 * §12.6 Pass de saison : 30 paliers, piste gratuite et piste premium (4,99 €, achat simulé dans le prototype).
 * On avance en gagnant des niveaux (lunes : +10 par victoire, +10 par étoile nouvelle). Logique pure : `season.ts`.
 */
import { INK_UI, iconURL } from '../../art/src/icons.js';
import { PASS, SKINS, seasonAt, tierOf, tierProgress, rewardAt, isClaimed, canClaim, claimableCount, sumRewards, type Reward, type Track } from './season.js';
import { buyPassPremium, claimAllPass, claimPassTier, now, passState, persist, save } from './state.js';
import { skinPreview } from './skins.js';
import { clearPortraits } from './portraits.js';
import { sheet, toast } from './ui.js';
import { sfx } from './audio.js';

const ICON: Record<Reward['kind'], string> = {
  gold: INK_UI.coin,
  gems: INK_UI.gem,
  potion: INK_UI.potion,
  scroll: INK_UI.scroll,
  aegis: INK_UI.aegis,
  lives: INK_UI.heart,
  skin: INK_UI.crown,
};
const LABEL: Record<Reward['kind'], (n: number) => string> = {
  gold: (n) => `${n} or`,
  gems: (n) => `${n} gemmes`,
  potion: (n) => (n > 1 ? `${n} potions` : 'Potion de vie'),
  scroll: (n) => (n > 1 ? `${n} parchemins` : 'Parchemin'),
  aegis: (n) => (n > 1 ? `${n} égides` : 'Égide'),
  lives: () => '5 vies',
  skin: () => 'Apparence',
};

export function rewardLabel(r: Reward): string {
  return r.kind === 'skin' && r.skin ? SKINS[r.skin].name : LABEL[r.kind](r.amount);
}

/** Résumé d'une liste de récompenses : « +300 or · +40 gemmes · Ailes de papier ». */
export function rewardsSummary(rs: Reward[]): string {
  const sum = sumRewards(rs.filter((r) => r.kind !== 'skin'));
  const parts = (Object.keys(sum) as Reward['kind'][]).map((k) => `+${LABEL[k](sum[k]!)}`);
  for (const r of rs) if (r.kind === 'skin' && r.skin) parts.push(SKINS[r.skin].name);
  return parts.join(' · ');
}

function rewardIcon(r: Reward): string {
  return r.kind === 'skin' && r.skin ? `<img class="skin-prev" src="${skinPreview(r.skin, 64)}" alt=""/>` : `<img src="${iconURL(ICON[r.kind])}" alt=""/>`;
}

function daysLeft(): number {
  return Math.max(0, Math.ceil((seasonAt(now()).end - now()) / 86_400));
}

/** Petit état du pass pour la carte (bouton de la barre du bas) : nombre de récompenses à réclamer. */
export function passBadge(): number {
  return claimableCount(passState());
}

export function passSheet(onChange: () => void = () => undefined): void {
  const { o } = sheet('pass-sheet', 'Pass de saison', '', onChange);
  const body = o.querySelector<HTMLElement>('.sheet-body')!;
  let buying = false;

  const cell = (track: Track, tier: number, reached: boolean): string => {
    const p = passState();
    const r = rewardAt(track, tier);
    const claimed = isClaimed(p, track, tier);
    const ready = canClaim(p, track, tier);
    const locked = track === 'premium' && !p.premium;
    const cls = ['pass-cell', track, claimed ? 'claimed' : '', ready ? 'ready' : '', reached ? '' : 'future', locked ? 'locked' : '', r.kind === 'skin' ? 'is-skin' : ''].filter(Boolean).join(' ');
    return `<button class="${cls}" data-track="${track}" data-tier="${tier}" ${ready ? '' : 'aria-disabled="true"'} aria-label="${rewardLabel(r)}${claimed ? ', reçu' : ready ? ', réclamer' : ''}">
      ${rewardIcon(r)}<span>${rewardLabel(r)}</span>
      ${claimed ? '<i class="stamp-ok">✓</i>' : locked ? `<img class="lock" src="${iconURL(INK_UI.lock)}" alt=""/>` : ''}
    </button>`;
  };

  const render = () => {
    const p = passState();
    const tier = tierOf(p.points);
    const prog = tierProgress(p.points);
    const ready = claimableCount(p);
    const rows = Array.from({ length: PASS.tiers }, (_, i) => {
      const t = i + 1;
      const reached = t <= tier;
      return `<div class="pass-row${reached ? ' reached' : ''}${t === tier + 1 ? ' next' : ''}" data-row="${t}">
        ${cell('free', t, reached)}
        <div class="pass-tier"><b>${t}</b></div>
        ${cell('premium', t, reached)}
      </div>`;
    }).join('');
    body.innerHTML = `
      <div class="pass-head">
        <div class="ph-season"><small>Saison ${p.season} · ${daysLeft()} jours restants</small><b>${PASS.name}</b></div>
        <div class="ph-tier"><span>Palier</span><b>${tier}<small>/${PASS.tiers}</small></b></div>
      </div>
      <div class="pass-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${PASS.pointsPerTier}" aria-valuenow="${Math.round(prog * PASS.pointsPerTier)}"><i style="width:${(prog * 100).toFixed(1)}%"></i><span>${tier >= PASS.tiers ? 'Pass terminé' : `${p.points % PASS.pointsPerTier}/${PASS.pointsPerTier} lunes vers le palier ${tier + 1}`}</span></div>
      <p class="fine">Lunes : +${PASS.pointsPerWin} par victoire, +${PASS.pointsPerNewStar} par étoile nouvelle.${tier > 4 ? ` <button class="link-btn goto">Voir le palier ${Math.min(PASS.tiers, tier + 1)}</button>` : ''}</p>
      ${
        p.premium
          ? `<div class="pass-premium owned"><img src="${iconURL(INK_UI.crown)}" alt=""/><div><b>Piste premium débloquée</b><small>Merci ! Toutes les récompenses premium atteintes sont à toi.</small></div></div>`
          : `<div class="pass-premium"><img src="${iconURL(INK_UI.crown)}" alt=""/><div><b>Piste premium</b><small>3 apparences, ${sumRewards(PREMIUM()).gems} gemmes, or et bonus · récompenses déjà atteintes comprises</small></div><button class="btn primary small buy-pass">${buying ? 'Confirmation…' : PASS.price}</button></div>`
      }
      ${ready ? `<button class="btn gem wide claim-all">Tout réclamer (${ready})</button>` : ''}
      <div class="pass-cols"><span>Gratuit</span><span></span><span>Premium</span></div>
      <div class="pass-track">${rows}</div>
      <p class="sim-note">Prototype web : achat simulé, aucun paiement. Sur iPhone, l’achat passe par l’App Store (non consommable, une fois par saison). Aucune récompense aléatoire ; rien du pass ne compte en tournoi.</p>`;
    body.querySelector('.buy-pass')?.addEventListener('click', (e) => {
      if (buying) return;
      buying = true;
      (e.currentTarget as HTMLButtonElement).disabled = true;
      (e.currentTarget as HTMLButtonElement).textContent = 'Confirmation…';
      setTimeout(() => {
        buying = false;
        if (!o.isConnected) return;
        buyPassPremium();
        sfx('win');
        toast('Achat simulé ✓ · piste premium débloquée');
        render();
        onChange();
      }, 700);
    });
    body.querySelector('.goto')?.addEventListener('click', () => {
      const row = body.querySelector<HTMLElement>(`[data-row="${Math.min(PASS.tiers, tier + 1)}"]`);
      if (!row) return;
      const y = row.getBoundingClientRect().top - body.getBoundingClientRect().top + body.scrollTop;
      body.scrollTo({ top: Math.max(0, y - body.clientHeight / 2), behavior: 'smooth' });
    });
    body.querySelector('.claim-all')?.addEventListener('click', () => {
      const rs = claimAllPass();
      if (!rs.length) return;
      sfx('star');
      clearPortraits();
      toast(rewardsSummary(rs));
      render();
      onChange();
    });
    body.querySelectorAll<HTMLButtonElement>('.pass-cell.ready').forEach((b) =>
      b.addEventListener('click', () => {
        const r = claimPassTier(b.dataset.track as Track, Number(b.dataset.tier));
        if (!r) return;
        sfx('star');
        if (r.kind === 'skin') clearPortraits();
        toast(r.kind === 'skin' ? `${rewardLabel(r)} · apparence portée (Héros)` : `+${rewardLabel(r)}`);
        persist();
        const keep = body.scrollTop;
        render();
        body.scrollTop = keep;
        onChange();
      }),
    );
    body.querySelectorAll<HTMLButtonElement>('.pass-cell:not(.ready)').forEach((b) =>
      b.addEventListener('click', () => {
        const t = Number(b.dataset.tier);
        if (b.classList.contains('claimed')) return;
        if (b.classList.contains('locked')) return toast('Piste premium : à débloquer en haut');
        toast(`Palier ${t} : encore ${t * PASS.pointsPerTier - passState().points} lunes`);
      }),
    );
  };
  render();
  void save;
}

function PREMIUM(): Reward[] {
  return Array.from({ length: PASS.tiers }, (_, i) => rewardAt('premium', i + 1));
}
