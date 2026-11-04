/**
 * Direction artistique « Théâtre d'ombres ».
 * Chaque salle est un écran de papier éclairé par derrière ; les personnages sont
 * des marionnettes d'encre. Une seule couleur vive : le vermillon du danger.
 * L'héroïne est la seule marionnette teintée (gel jade) pour qu'on la retrouve d'un coup d'œil.
 * Source unique pour le web, le pipeline d'atlas et le Swift (Theme.swift).
 */

/** Encre des marionnettes (noir chaud) et sa couche intérieure plus claire. */
export const INK = '#1b1418';
export const INK2 = '#40333a';
/** Lumière qui traverse les découpes. */
export const CUT = '#fff4d6';
/** Danger : télégraphes, projectiles ennemis, dégâts reçus. */
export const DANGER = '#d8431f';
export const JADE = '#2b8a74';
export const JADE_LIGHT = '#8fd3bc';
export const GOLD_LEAF = '#c9a13b';
/** Rideaux du théâtre autour de l'écran. */
export const CURTAIN = '#2b1317';
export const CURTAIN_LIGHT = '#4d2229';

export interface KingdomTheme {
  id: number;
  name: string;
  /** centre de l'écran éclairé */
  light: string;
  /** papier */
  paper: string;
  /** bords brûlés de l'écran */
  edge: string;
  /** silhouettes lointaines (encre diluée) */
  far: string;
  /** gel coloré vu à travers l'eau ou la lave */
  gel: string;
  gelLight: string;
  liquidIsLava: boolean;
  /** particules d'ambiance */
  moteKind: 'firefly' | 'spore' | 'sand' | 'snow' | 'ember';
  /** carte : dégradé de la bande du royaume (haut, bas) */
  sky: [string, string];
}

export const KINGDOMS: KingdomTheme[] = [
  { id: 1, name: 'Forêt d’Ombrelune', light: '#f4e8c1', paper: '#ddc993', edge: '#6b6630', far: '#9a915a', gel: '#6fa39a', gelLight: '#d3ebe1', liquidIsLava: false, moteKind: 'firefly', sky: ['#cdb878', '#f4e8c1'] },
  { id: 2, name: 'Marais des Lucioles', light: '#e7eec9', paper: '#bdc88d', edge: '#45512b', far: '#86935d', gel: '#5f8a63', gelLight: '#d9eabc', liquidIsLava: false, moteKind: 'spore', sky: ['#a9b77a', '#e7eec9'] },
  { id: 3, name: 'Désert d’Ambre', light: '#fbe4ab', paper: '#efb96b', edge: '#87401f', far: '#c98a4e', gel: '#3f9e94', gelLight: '#c2efe4', liquidIsLava: false, moteKind: 'sand', sky: ['#e3a35a', '#fbe4ab'] },
  { id: 4, name: 'Pics de Givre', light: '#f0f5f2', paper: '#c0d5d9', edge: '#3d586b', far: '#8ea7b3', gel: '#6f9fc4', gelLight: '#e6f4fb', liquidIsLava: false, moteKind: 'snow', sky: ['#9fbac4', '#f0f5f2'] },
  { id: 5, name: 'Terres de Cendres', light: '#f3cbab', paper: '#cb8b74', edge: '#3e1a22', far: '#965a52', gel: '#e8892a', gelLight: '#ffd585', liquidIsLava: true, moteKind: 'ember', sky: ['#a8604f', '#f3cbab'] },
];

/** Jetons d'interface (mêmes noms côté CSS et Swift). */
export const UI = {
  ink: INK,
  ink2: INK2,
  cut: CUT,
  paper: '#efe3c6',
  paperDark: '#d9c9a3',
  danger: DANGER,
  heal: JADE,
  gold: GOLD_LEAF,
  moon: CUT,
  common: '#7d6f5f',
  rare: JADE,
  epic: GOLD_LEAF,
  heroCloak: JADE,
  heroCloakDark: '#1d6655',
};

export const FONTS = {
  display: '"IM Fell English SC", "IM Fell English", Georgia, serif',
  ui: '"Alegreya Sans", "Alegreya", Georgia, sans-serif',
};
