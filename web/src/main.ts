import './style.css';
import type { RoomTemplate } from '../../sim/src/arena.js';
import { generateLevel, type LevelDef } from '../../sim/src/level.js';
import { Bot, BOTS } from '../../sim/src/bot.js';
import { isoWeek, tournamentSeed, tournamentScore } from '../../sim/src/formulas.js';
import { NO_TALENTS } from '../../sim/src/hero.js';
import { heroesSheet, shopSheet, tournamentSheet, settingsSheet } from './menus.js';
import { APP_NAME, LEVEL_COUNT } from '../../sim/src/constants.js';
import { INK_UI, PAPER_UI, iconURL } from '../../art/src/icons.js';
import { Combat } from './combat.js';
import { buildMap, topBar } from './map.js';
import { mountSheet } from './sheet.js';
import { mountAtlas } from './atlas.js';
import { titleScreen, preLevel, choosePower, victory, defeat, pauseMenu, toast, el } from './ui.js';
import { save, recordAttempt, persist, tournamentState, canPlay, subscribed, lives, weeklyGemsReady, claimWeekly, dragonSkin } from './state.js';
import { sfx, wakeAudio } from './audio.js';
import { applyPrefs } from './prefs.js';
import { installDragonSkin, installPassSkins } from './skins.js';
import { passSheet, passBadge } from './pass.js';
import { portrait } from './portraits.js';
import { livesSheet, outOfLives, openDragon } from './dragon.js';
import { DRAGON } from './economy.js';

const params = new URLSearchParams(location.search);

// Apparences (pass de saison, Parure du Dragon) et réglages appliqués dès le lancement.
// La page d'atlas dessine les marionnettes nues.
if (!params.has('atlas')) {
  installPassSkins(() => save().skin);
  installDragonSkin(dragonSkin);
}
applyPrefs();
// la musique ne peut démarrer qu'après un premier geste (règle des navigateurs)
addEventListener('pointerdown', () => wakeAudio(), { capture: true });

document.title = APP_NAME;
const root = document.getElementById('app')!;

const roomFiles = import.meta.glob('../../content/rooms/*.json', { eager: true, import: 'default' }) as Record<string, RoomTemplate>;
const ROOMS: RoomTemplate[] = Object.values(roomFiles).sort((a, b) => a.id.localeCompare(b.id));
const TEMPLATES = new Map(ROOMS.map((r) => [r.id, r]));
/** Index produit par `pnpm levels:gen` (graine + facteur de budget validés par les bots). */
const indexFiles = import.meta.glob('../../content/levels/index.json', { eager: true, import: 'default' }) as Record<string, Record<string, { seed: number; budgetScale: number }>>;
const LEVEL_INDEX = Object.values(indexFiles)[0] ?? {};

function level(n: number): LevelDef {
  const e = LEVEL_INDEX[n];
  return generateLevel(n, e?.seed ?? 1, ROOMS, e?.budgetScale ?? 1);
}

function clear(): void {
  root.innerHTML = '';
}

/** Rafraîchit la carte affichée sans la reconstruire (barre du haut, tribut, avatar). */
let refreshMap: () => void = () => undefined;

/** Étiquette du tribut hebdomadaire de l'Ordre du Dragon (60 gemmes à réclamer). */
function tributeTag(): HTMLElement | null {
  if (!weeklyGemsReady()) return null;
  return el(`<button class="tribute" aria-label="Réclamer ${DRAGON.weeklyGems} gemmes"><i class="thread l"></i><i class="thread r"></i><span class="tag"><img src="${iconURL(INK_UI.gem)}" alt=""/><b>${DRAGON.weeklyGems}</b><small>Tribut de l’Ordre · réclamer</small></span></button>`);
}

function showMap(): void {
  clear();
  applyPrefs();
  const screen = el(`<div class="screen map-screen"></div>`);
  screen.appendChild(topBar());
  const tag = tributeTag();
  if (tag) screen.appendChild(tag);
  screen.appendChild(buildMap((n) => void openLevel(n)));
  const wk = isoWeek(new Date());
  const weekKey = `${wk.year}-W${wk.week}`;
  const tState = tournamentState(weekKey);
  const banner = el(`<button class="tournament"><img src="${iconURL(INK_UI.trophy)}"/><div><b>Tournoi de la semaine ${wk.week}</b><small>Mêmes conditions pour tous · ${tState.attempts} essai${tState.attempts > 1 ? 's' : ''}</small></div><span class="go">›</span></button>`);
  const openTournament = () => tournamentSheet(weekKey, wk.week, () => playTournament(weekKey));
  banner.addEventListener('click', openTournament);
  screen.appendChild(banner);
  const refresh = () => {
    if (!screen.isConnected) return;
    screen.querySelector('.topbar')?.replaceWith(topBar());
    screen.querySelector('.tribute')?.remove();
    const t = tributeTag();
    if (t) screen.appendChild(t);
    screen.querySelector('.avatar image')?.setAttribute('href', portrait('hero', 64, { scale: 1.5, dy: 8 }));
    badge();
    tickLives(false);
  };
  // pastille du pass : récompenses à réclamer
  const badge = () => {
    const b = screen.querySelector('[data-tab="pass"]');
    b?.querySelector('.dot')?.remove();
    const n = passBadge();
    if (b && n > 0) b.prepend(el(`<i class="dot">${n}</i>`));
  };
  refreshMap = refresh;
  screen.addEventListener('click', (e) => {
    const t = e.target as Element;
    if (t.closest('.topbar .lives')) (sfx('tap'), void livesSheet(refresh));
    else if (t.closest('.topbar .gems')) shopSheet(refresh);
    else if (t.closest('.tribute')) {
      const g = claimWeekly();
      if (g) (sfx('star'), toast(`+${g} gemmes · tribut de l’Ordre`));
      refresh();
    }
  });
  const nav = el(`<nav class="bottom-nav">
    <button data-tab="heroes"><img src="${iconURL(PAPER_UI.aegis)}"/><span>Héros</span></button>
    <button data-tab="shop"><img src="${iconURL(PAPER_UI.gem)}"/><span>Boutique</span></button>
    <button data-tab="map" class="on"><img src="${iconURL(PAPER_UI.star)}"/><span>Carte</span></button>
    <button data-tab="pass"><img src="${iconURL(PAPER_UI.chest)}"/><span>Pass</span></button>
    <button data-tab="tour"><img src="${iconURL(PAPER_UI.trophy)}"/><span>Tournoi</span></button>
    <button data-tab="settings"><img src="${iconURL(PAPER_UI.scroll)}"/><span>Réglages</span></button>
  </nav>`);
  nav.addEventListener('click', (e) => {
    const b = (e.target as Element).closest('button');
    if (!b) return;
    const tab = b.dataset.tab;
    if (tab === 'heroes') heroesSheet(refresh);
    else if (tab === 'shop') shopSheet(refresh);
    else if (tab === 'pass') passSheet(refresh);
    else if (tab === 'tour') openTournament();
    else if (tab === 'settings') settingsSheet(refresh);
  });
  screen.appendChild(nav);
  badge();
  root.appendChild(screen);
  function tickLives(loop = true): void {
    const timer = screen.querySelector<HTMLElement>('.timer');
    if (!screen.isConnected || !timer) return;
    const l = lives();
    const dragon = subscribed();
    screen.querySelector('.topbar .lives b')!.textContent = dragon ? '∞' : String(l.lives);
    if (dragon) timer.textContent = '';
    else if (l.lives >= 5) timer.textContent = 'max';
    else {
      const left = Math.max(0, 1800 - (Date.now() / 1000 - l.refillFrom));
      timer.textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    }
    if (loop) setTimeout(() => tickLives(), 1000);
  }
  tickLives();
}

async function openLevel(n: number): Promise<void> {
  if (!canPlay()) {
    // §11 : 1re fois sans vie → offre de l'Ordre, puis feuille des vies (pub récompensée, gemmes)
    await outOfLives(() => refreshMap());
    if (!canPlay()) return;
  }
  const lvl = level(n);
  const choice = await preLevel(lvl);
  if (!choice) return;
  play(lvl, choice);
}

function play(lvl: LevelDef, choice: { potion: boolean; scroll: boolean; aegis: boolean }): void {
  clear();
  const screen = el(`<div class="screen combat-screen"></div>`);
  root.appendChild(screen);
  const st = save().settings;
  const start = (scrollPick: import('../../sim/src/content.js').PowerId | null) => {
    const c: Combat = new Combat(
      screen,
      {
        level: lvl,
        templates: TEMPLATES,
        potion: choice.potion,
        aegis: choice.aegis,
        scroll: scrollPick,
        autoFire: st.autoFire,
        reduceMotion: st.reduceMotion,
        haptics: st.haptics,
        heroId: save().heroId,
        talents: params.has('demo') ? undefined : save().talents,
        demoBot: params.has('demo') ? new Bot(BOTS.expert, 7) : undefined,
      },
      {
        choosePower: (offer, hero) => choosePower(offer, hero),
        defeat: (used) => defeat(used),
        pause: () => pauseMenu(),
        finish: async (r) => {
          const res = recordAttempt(lvl.n, true, r.stars);
          const next = await victory(lvl, r, res);
          c.destroy();
          showMap();
          if (next === 'next' && lvl.n < LEVEL_COUNT) void openLevel(lvl.n + 1);
        },
        retry: () => {
          recordAttempt(lvl.n, false, 0);
          c.destroy();
          if (canPlay()) play(lvl, { potion: false, scroll: false, aegis: false });
          else {
            // dernière vie perdue : retour à la carte, où l'on propose des vies (jamais en combat)
            showMap();
            void openLevel(lvl.n);
          }
        },
        quit: () => {
          recordAttempt(lvl.n, false, 0);
          c.destroy();
          showMap();
        },
      },
    );
    // poignée de recette (tests Playwright) : le combat en cours
    (window as unknown as { __combat?: Combat }).__combat = c;
  };
  if (choice.scroll) {
    // Parchemin : choisir un pouvoir parmi trois avant d'entrer
    void import('../../sim/src/level.js').then(async ({ offerPowers }) => {
      const { Rng } = await import('../../sim/src/rng.js');
      const { newHero } = await import('../../sim/src/world.js');
      const { NO_TALENTS } = await import('../../sim/src/hero.js');
      const pick = await choosePower(offerPowers(new Rng(lvl.powerSeed ^ 0x5c), {}), newHero(NO_TALENTS), 'Parchemin : pouvoir de départ');
      start(pick);
    });
  } else start(null);
}

function playTournament(weekKey: string): void {
  const t = tournamentState(weekKey);
  if (t.attempts <= 0) return toast('Plus d’essai cette semaine');
  t.attempts--;
  persist();
  const seed = tournamentSeed(new Date());
  const lvl = generateLevel(120, seed, ROOMS, 1, { kind: 'hard', mult: 1.35, roomCount: 4 });
  clear();
  const screen = el(`<div class="screen combat-screen"></div>`);
  root.appendChild(screen);
  const end = (c: Combat, won: boolean, kills: number, hpLeft: number, seconds: number) => {
    const score = tournamentScore(kills, hpLeft, seconds);
    const best = score > t.best;
    if (best) t.best = score;
    persist();
    const o = el(`<div class="overlay result-overlay ${won ? 'win' : 'lose'}"><div class="scrim"></div><div class="result"><h2 class="rtitle">${won ? 'Tournoi terminé' : 'Essai terminé'}</h2><div class="score-big">${score}</div><p class="rsub">${best ? 'Nouveau meilleur score !' : `Meilleur score : ${t.best}`}</p><div class="rstats"><div><span>Ennemis</span><b>${kills}</b></div><div><span>PV restants</span><b>${Math.round(hpLeft)}</b></div><div><span>Temps</span><b>${Math.round(seconds)} s</b></div></div><div class="ractions"><button class="btn ghost map">Carte</button><button class="btn primary again" ${t.attempts > 0 ? '' : 'disabled'}>Rejouer (${t.attempts})</button></div></div></div>`);
    root.appendChild(o);
    requestAnimationFrame(() => o.classList.add('in'));
    o.querySelector('.map')!.addEventListener('click', () => (c.destroy(), showMap()));
    o.querySelector('.again')!.addEventListener('click', () => (c.destroy(), playTournament(weekKey)));
  };
  let kills = 0;
  const c: Combat = new Combat(
    screen,
    { level: lvl, templates: TEMPLATES, heroId: 'scout', talents: NO_TALENTS, autoFire: true, reduceMotion: save().settings.reduceMotion, haptics: save().settings.haptics },
    {
      choosePower: (offer, hero) => choosePower(offer, hero),
      defeat: async () => {
        end(c, false, c.stats().kills, 0, c.stats().seconds);
        return new Promise(() => undefined);
      },
      pause: () => pauseMenu(),
      finish: (r) => {
        kills = r.kills;
        end(c, true, kills, r.hpFrac * c.stats().maxHp, r.seconds);
      },
      retry: () => undefined,
      quit: () => (c.destroy(), showMap()),
    },
  );
}

// démo : ?level=12&play lance directement un niveau ; ?sheet affiche la planche ; ?ui=… montre un écran
async function demoUi(kind: string): Promise<void> {
  const { newHero } = await import('../../sim/src/world.js');
  const { NO_TALENTS } = await import('../../sim/src/hero.js');
  if (kind === 'powers') {
    play(level(5), { potion: false, scroll: false, aegis: false });
    setTimeout(() => void choosePower(['multishot', 'frost', 'crit'], newHero(NO_TALENTS)), 300);
  } else if (kind === 'victory') {
    play(level(5), { potion: false, scroll: false, aegis: false });
    setTimeout(() => void victory(level(5), { won: true, stars: 3, hpFrac: 0.9, seconds: 74, kills: 23, continues: 0 }, { firstThree: true, pass: { points: 40, tierBefore: 2, tierAfter: 3 }, chests: [{ index: 1, gold: 200, gems: 20, bonus: 'potion' }] }), 300);
  } else if (kind === 'defeat') {
    play(level(5), { potion: false, scroll: false, aegis: false });
    setTimeout(() => void defeat(0), 300);
  }
}
/**
 * ?screen=<nom> ouvre directement un écran (captures `pnpm web:shots`, recette) :
 * title, map, prelevel, combat, powers, victory, defeat, pause, heroes, shop, pass, tournament, settings, dragon, lives.
 */
function openScreen(name: string): void {
  const wk = isoWeek(new Date());
  const weekKey = `${wk.year}-W${wk.week}`;
  if (name === 'title') return void root.appendChild(titleScreen(() => showMap()));
  if (['powers', 'victory', 'defeat'].includes(name)) return void demoUi(name);
  if (name === 'combat') return play(level(Number(params.get('level') ?? 3)), { potion: false, scroll: false, aegis: false });
  if (name === 'pause') {
    play(level(3), { potion: false, scroll: false, aegis: false });
    setTimeout(() => document.querySelector<HTMLElement>('.pause-btn')?.click(), 600);
    return;
  }
  showMap();
  const open: Record<string, () => void> = {
    map: () => undefined,
    prelevel: () => void openLevel(Number(params.get('level') ?? Math.min(save().unlocked, LEVEL_COUNT))),
    heroes: () => heroesSheet(() => refreshMap()),
    shop: () => shopSheet(() => refreshMap()),
    pass: () => passSheet(() => refreshMap()),
    tournament: () => tournamentSheet(weekKey, wk.week, () => playTournament(weekKey)),
    settings: () => settingsSheet(() => refreshMap()),
    dragon: () => openDragon('shop', () => refreshMap()),
    lives: () => void livesSheet(() => refreshMap()),
  };
  (open[name] ?? open.map)();
}

if (params.has('atlas')) mountAtlas();
else if (params.has('screen')) openScreen(params.get('screen')!);
else if (params.has('ui')) void demoUi(params.get('ui')!);
else if (params.has('sheet')) mountSheet(root);
else if (params.has('level')) {
  const n = Number(params.get('level'));
  if (params.has('play')) play(level(n), { potion: false, scroll: false, aegis: false });
  else {
    showMap();
    void openLevel(n);
  }
} else if (params.has('map')) showMap();
else {
  root.appendChild(titleScreen(() => showMap()));
}
persist();
