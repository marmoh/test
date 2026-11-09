/** Quêtes du jour (DECISIONS #76) et bestiaire : de quoi revenir chaque jour et tout collectionner. */
import { ENEMIES, BOSSES, UNLOCK_ORDER, BOSS_BY_KINGDOM, type MinionType } from '../../sim/src/content.js';
import { INK_GEAR, INK_UI, iconURL } from '../../art/src/icons.js';
import { KINGDOMS } from '../../art/src/palette.js';
import { save } from './state.js';
import { todayQuests, questProgress, claimQuest, claimQuestBonus, QUEST_BONUS } from './meta.js';
import { portrait } from './portraits.js';
import { sheet, toast } from './ui.js';
import { sfx } from './audio.js';

function rewardText(r: { gold?: number; gems?: number; shards?: number }): string {
  const parts: string[] = [];
  if (r.gold) parts.push(`<img src="${iconURL(INK_UI.coin)}" alt="or"/>${r.gold}`);
  if (r.gems) parts.push(`<img src="${iconURL(INK_UI.gem)}" alt="gemmes"/>${r.gems}`);
  if (r.shards) parts.push(`<img src="${iconURL(INK_GEAR.shard)}" alt="éclats"/>${r.shards}`);
  return parts.join(' ');
}

function untilMidnight(): string {
  const d = new Date();
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  const s = Math.max(0, Math.round((m.getTime() - d.getTime()) / 1000));
  return `${Math.floor(s / 3600)} h ${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}`;
}

export function questsSheet(onChange: () => void): void {
  const { o } = sheet('quests-sheet', 'Quêtes du jour', '', onChange);
  const body = o.querySelector<HTMLElement>('.sheet-body')!;
  const render = () => {
    const s = save();
    const qs = todayQuests();
    const allDone = qs.every((q) => s.quests.claimed.includes(q.id));
    body.innerHTML = `<p class="fine q-renew">Nouvelles quêtes dans ${untilMidnight()}</p>
      <div class="quests">${qs
        .map((q) => {
          const p = questProgress(q);
          const done = p >= q.goal;
          const claimed = s.quests.claimed.includes(q.id);
          return `<div class="quest${done ? ' done' : ''}${claimed ? ' claimed' : ''}"><div class="q-main"><b>${q.text}</b><div class="q-bar"><i style="width:${(100 * p) / q.goal}%"></i></div><small>${p} / ${q.goal}</small></div><div class="q-side"><span class="q-rew">${rewardText(q.reward)}</span>${claimed ? '<span class="q-ok">Reçu</span>' : `<button class="btn ${done ? 'primary' : 'ghost'} small q-claim" data-id="${q.id}" ${done ? '' : 'disabled'}>Réclamer</button>`}</div></div>`;
        })
        .join('')}</div>
      <div class="q-bonus${allDone ? ' ready' : ''}${s.quests.bonusClaimed ? ' claimed' : ''}"><img src="${iconURL(INK_UI.chest)}" alt=""/><div><b>Les trois quêtes du jour</b><small>Bonus : ${rewardText(QUEST_BONUS)}</small></div>${s.quests.bonusClaimed ? '<span class="q-ok">Reçu</span>' : `<button class="btn primary small q-bonus-btn" ${allDone ? '' : 'disabled'}>Ouvrir</button>`}</div>
      <p class="fine left">Les quêtes changent chaque jour à minuit. Elles comptent tes combats, gagnés ou non.</p>`;
    body.querySelectorAll<HTMLButtonElement>('.q-claim').forEach((b) =>
      b.addEventListener('click', () => {
        const r = claimQuest(b.dataset.id!);
        if (r) {
          sfx('loot');
          toast('Récompense reçue ✓');
          render();
          onChange();
        }
      }),
    );
    body.querySelector('.q-bonus-btn')?.addEventListener('click', () => {
      if (claimQuestBonus()) {
        sfx('loot');
        toast(`+${QUEST_BONUS.gems} gemmes · +${QUEST_BONUS.shards} éclats`);
        render();
        onChange();
      }
    });
  };
  render();
}

/** Comportement et astuce de chaque ennemi (bestiaire, présentation d'un nouvel ennemi). */
export const LORE: Record<string, { what: string; tip: string }> = {
  goblin: { what: 'Lance une pierre visée toutes les 3 s.', tip: 'Il ne recule pas : entoure-le.' },
  bat: { what: 'Vole en zigzag, puis pique en ligne droite.', tip: 'La ligne du piqué s’annonce : pas de côté.' },
  jelly: { what: 'Te poursuit et se divise en deux à sa mort.', tip: 'Garde de la place pour les petites gelées.' },
  moth: { what: 'File vers le fil de l’Éclaireuse et le grignote.', tip: 'Les aiguilles lui font trois fois plus mal.' },
  snipper: { what: 'Sa charge tranche le fil de découpe.', tip: 'Ferme ta boucle avant sa charge, ou esquive-la.' },
  mushroom: { what: 'Immobile, lâche un anneau de huit spores.', tip: 'Les spores passent entre leurs intervalles.' },
  wolf: { what: 'Charge en ligne droite après 0,6 s.', tip: 'Sors de la bande hachurée, il passe tout droit.' },
  skeleton: { what: 'Tire trois flèches en éventail.', tip: 'De loin, l’éventail s’ouvre : reste à distance.' },
  totem: { what: 'Étoile de six projectiles qui tourne.', tip: 'Tourne avec l’étoile pour rester entre deux branches.' },
  mage: { what: 'Pose une flaque de feu là où tu te tiens.', tip: 'Ne t’arrête pas sur un cercle qui se referme.' },
  lantern: { what: 'Fonce sur toi, s’arrête et explose.', tip: 'Abats-le pendant qu’il gonfle : il s’éteint sans exploser.' },
  weaver: { what: 'Crache une toile qui te ralentit.', tip: 'Tuer l’araignée fait disparaître ses toiles.' },
  beetle: { what: 'Son bouclier arrête les aiguilles de face.', tip: 'Contourne-le, ou frappe avec ta mécanique : le bouclier n’y peut rien.' },
  puppeteer: { what: 'Garde ses distances et invoque des ombres.', tip: 'Vise-le en premier : sans lui, plus d’ombres.' },
  shade: { what: 'Ombre rapide et fragile, invoquée par le montreur.', tip: 'Une bourrasque ou une boucle en emporte plusieurs.' },
  specter: { what: 'S’efface, réapparaît près de toi et tire en anneau.', tip: 'Sa marque s’annonce au sol : éloigne-toi d’elle.' },
  jellySmall: { what: 'Morceau de gelée, rapide.', tip: 'Il ne se divise plus.' },
  treant: { what: 'Boss de la Forêt : onde de choc, anneaux, pluie de graines.', tip: 'Il reprend son souffle après chaque attaque.' },
  queen: { what: 'Boss du Marais : flaques, anneaux, petites gelées.', tip: 'Garde un chemin sec pour bouger.' },
  scorpion: { what: 'Boss du Désert : charges et éventails.', tip: 'Après une charge, il est à découvert.' },
  wyvern: { what: 'Boss du Givre : vole, pluie de glace, charges.', tip: 'Elle survole les obstacles : ne t’y cache pas.' },
  ashlord: { what: 'Boss des Cendres : flaques, mages, onde de choc.', tip: 'Abats ses mages avant qu’ils ne remplissent la salle.' },
};

export function bestiarySheet(): void {
  const s = save();
  const types: MinionType[] = [...UNLOCK_ORDER, 'shade'];
  const seen = (k: string) => (s.bestiary[k] ?? 0) > 0;
  const total = types.length + BOSS_BY_KINGDOM.length;
  const met = types.filter(seen).length + BOSS_BY_KINGDOM.filter(seen).length;
  const card = (k: string, name: string, img: string, sub: string) => {
    const known = seen(k);
    return `<div class="beast${known ? '' : ' unknown'}"><div class="b-img"><img src="${img}" alt=""/></div><div class="b-txt"><b>${known ? name : '???'}</b><small>${known ? LORE[k]?.what ?? '' : sub}</small>${known ? `<em>${LORE[k]?.tip ?? ''}</em>` : ''}</div><span class="b-count">${known ? `×${s.bestiary[k]}` : ''}</span></div>`;
  };
  const chapterOf = (t: MinionType) => (t === 'shade' ? UNLOCK_ORDER.indexOf('puppeteer') + 1 : UNLOCK_ORDER.indexOf(t as never) + 1);
  sheet(
    'bestiary-sheet',
    'Bestiaire',
    `<p class="fine b-prog">${met} / ${total} créatures rencontrées</p>
    <h3 class="sec">Ennemis</h3>
    <div class="beasts">${types.map((t) => card(t, ENEMIES[t].name, portrait(t, 64, { scale: 1.25, dy: 6 }), `Chapitre ${chapterOf(t)}`)).join('')}</div>
    <h3 class="sec">Boss</h3>
    <div class="beasts">${BOSS_BY_KINGDOM.map((b, i) => card(b, BOSSES[b].name, portrait(b, 64, { scale: 0.55, dy: 8 }), `Fin du royaume ${KINGDOMS[i].name}`)).join('')}</div>`,
  );
}
