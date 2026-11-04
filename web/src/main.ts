import './style.css';
import type { RoomTemplate } from '../../sim/src/arena.js';
import { generateLevel, type LevelDef } from '../../sim/src/level.js';
import { Bot, BOTS } from '../../sim/src/bot.js';
import { isoWeek, tournamentSeed, tournamentScore } from '../../sim/src/formulas.js';
import { NO_TALENTS } from '../../sim/src/hero.js';
import { heroesSheet, shopSheet, tournamentSheet, settingsSheet } from './menus.js';
import { APP_NAME, LEVEL_COUNT } from '../../sim/src/constants.js';
import { UI_ICONS, iconURL } from '../../art/src/icons.js';
import { Combat } from './combat.js';
import { buildMap, topBar } from './map.js';
import { mountSheet } from './sheet.js';
import { mountAtlas } from './atlas.js';
import { titleScreen, preLevel, choosePower, victory, defeat, pauseMenu, toast, el } from './ui.js';
import { save, lives, recordAttempt, persist, tournamentState } from './state.js';
import { setSound } from './audio.js';

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

const params = new URLSearchParams(location.search);

function clear(): void {
  root.innerHTML = '';
}

function showMap(): void {
  clear();
  setSound(save().settings.sound);
  const screen = el(`<div class="screen map-screen"></div>`);
  screen.appendChild(topBar());
  screen.appendChild(buildMap((n) => void openLevel(n)));
  const wk = isoWeek(new Date());
  const weekKey = `${wk.year}-W${wk.week}`;
  const tState = tournamentState(weekKey);
  const banner = el(`<button class="tournament"><img src="${iconURL(UI_ICONS.trophy)}"/><div><b>Tournoi de la semaine ${wk.week}</b><small>Mêmes conditions pour tous · ${tState.attempts} essai${tState.attempts > 1 ? 's' : ''}</small></div><span class="go">›</span></button>`);
  const openTournament = () => tournamentSheet(weekKey, wk.week, () => playTournament(weekKey));
  banner.addEventListener('click', openTournament);
  screen.appendChild(banner);
  const refresh = () => {
    const old = screen.querySelector('.topbar');
    old?.replaceWith(topBar());
  };
  const nav = el(`<nav class="bottom-nav">
    <button data-tab="heroes"><img src="${iconURL(UI_ICONS.aegis)}"/><span>Héros</span></button>
    <button data-tab="shop"><img src="${iconURL(UI_ICONS.gem)}"/><span>Boutique</span></button>
    <button data-tab="map" class="on"><img src="${iconURL(UI_ICONS.star)}"/><span>Carte</span></button>
    <button data-tab="tour"><img src="${iconURL(UI_ICONS.trophy)}"/><span>Tournoi</span></button>
    <button data-tab="settings"><img src="${iconURL(UI_ICONS.scroll)}"/><span>Réglages</span></button>
  </nav>`);
  nav.addEventListener('click', (e) => {
    const b = (e.target as Element).closest('button');
    if (!b) return;
    const tab = b.dataset.tab;
    if (tab === 'heroes') heroesSheet(refresh);
    else if (tab === 'shop') shopSheet(refresh);
    else if (tab === 'tour') openTournament();
    else if (tab === 'settings') settingsSheet();
  });
  screen.appendChild(nav);
  root.appendChild(screen);
  const timer = screen.querySelector<HTMLElement>('.timer');
  const tickLives = () => {
    const l = lives();
    if (!timer || !timer.isConnected) return;
    screen.querySelector('.lives b')!.textContent = String(l.lives);
    if (l.lives >= 5) timer.textContent = 'max';
    else {
      const left = Math.max(0, 1800 - (Date.now() / 1000 - l.refillFrom));
      timer.textContent = `${Math.floor(left / 60)}:${String(Math.floor(left % 60)).padStart(2, '0')}`;
    }
    setTimeout(tickLives, 1000);
  };
  tickLives();
}

async function openLevel(n: number): Promise<void> {
  if (lives().lives <= 0) {
    toast('Plus de vies — reviens dans un instant ✨');
    return;
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
          const { firstThree } = recordAttempt(lvl.n, true, r.stars);
          const next = await victory(lvl, r, firstThree);
          c.destroy();
          showMap();
          if (next === 'next' && lvl.n < LEVEL_COUNT) void openLevel(lvl.n + 1);
        },
        retry: () => {
          recordAttempt(lvl.n, false, 0);
          c.destroy();
          play(lvl, { potion: false, scroll: false, aegis: false });
        },
        quit: () => {
          recordAttempt(lvl.n, false, 0);
          c.destroy();
          showMap();
        },
      },
    );
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
    { level: lvl, templates: TEMPLATES, heroId: 'scout', talents: NO_TALENTS, autoFire: false, reduceMotion: save().settings.reduceMotion, haptics: save().settings.haptics },
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
    setTimeout(() => void victory(level(5), { won: true, stars: 3, hpFrac: 0.9, seconds: 74, kills: 23, continues: 0 }, true), 300);
  } else if (kind === 'defeat') {
    play(level(5), { potion: false, scroll: false, aegis: false });
    setTimeout(() => void defeat(0), 300);
  }
}
if (params.has('atlas')) mountAtlas();
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
