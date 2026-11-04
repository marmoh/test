/**
 * Direction artistique « Ombrelune » : conte nocturne, clair de lune froid
 * contre lueurs chaudes (lanternes, braises). Chaque royaume a sa palette.
 * Source unique pour le web, le pipeline d'atlas et le Swift (Theme.swift).
 */

export interface KingdomTheme {
  id: number;
  name: string;
  /** ciel / fond de carte, du haut vers le bas */
  sky: [string, string];
  ground: string;
  groundAlt: string;
  groundDetail: string;
  rock: string;
  rockLight: string;
  rockDark: string;
  liquid: string;
  liquidLight: string;
  liquidIsLava: boolean;
  hedge: string;
  hedgeLight: string;
  wall: string;
  wallLight: string;
  accent: string;
  /** particules d'ambiance */
  mote: string;
  moteKind: 'firefly' | 'spore' | 'sand' | 'snow' | 'ember';
}

export const KINGDOMS: KingdomTheme[] = [
  {
    id: 1,
    name: 'Forêt d’Ombrelune',
    sky: ['#0f1f3a', '#1d4a4a'],
    ground: '#2f5a3e',
    groundAlt: '#356745',
    groundDetail: '#4f8a55',
    rock: '#6b7480',
    rockLight: '#a9b4bf',
    rockDark: '#3d434d',
    liquid: '#2b6f8f',
    liquidLight: '#7fd3e6',
    liquidIsLava: false,
    hedge: '#1f4a2c',
    hedgeLight: '#4f9b57',
    wall: '#243329',
    wallLight: '#3e5a44',
    accent: '#9fe8c9',
    mote: '#d9ff8a',
    moteKind: 'firefly',
  },
  {
    id: 2,
    name: 'Marais des Lucioles',
    sky: ['#1a1433', '#3b3a2a'],
    ground: '#4a4a30',
    groundAlt: '#53532f',
    groundDetail: '#7a7a3d',
    rock: '#5f5a66',
    rockLight: '#9c95a6',
    rockDark: '#36323d',
    liquid: '#3d5a3a',
    liquidLight: '#9fcf7a',
    liquidIsLava: false,
    hedge: '#2e3d22',
    hedgeLight: '#6d8c3a',
    wall: '#2c2a22',
    wallLight: '#4a4636',
    accent: '#ffe26b',
    mote: '#ffe26b',
    moteKind: 'spore',
  },
  {
    id: 3,
    name: 'Désert d’Ambre',
    sky: ['#2a1640', '#c06a3a'],
    ground: '#c99a5b',
    groundAlt: '#d3a566',
    groundDetail: '#e7c088',
    rock: '#9a5e3c',
    rockLight: '#d99a6a',
    rockDark: '#5e3522',
    liquid: '#2f8f8a',
    liquidLight: '#8ff0e0',
    liquidIsLava: false,
    hedge: '#6f7a3a',
    hedgeLight: '#a8b55a',
    wall: '#7a4a2e',
    wallLight: '#a86a44',
    accent: '#ffb347',
    mote: '#ffe0a8',
    moteKind: 'sand',
  },
  {
    id: 4,
    name: 'Pics de Givre',
    sky: ['#131a3d', '#5a7ab0'],
    ground: '#c9dcea',
    groundAlt: '#d6e6f2',
    groundDetail: '#ffffff',
    rock: '#6a7aa0',
    rockLight: '#b5c6e8',
    rockDark: '#3a4466',
    liquid: '#3a76b8',
    liquidLight: '#bfe8ff',
    liquidIsLava: false,
    hedge: '#3d6b6a',
    hedgeLight: '#8cc4bd',
    wall: '#4a5a80',
    wallLight: '#7a8cb8',
    accent: '#bfe8ff',
    mote: '#ffffff',
    moteKind: 'snow',
  },
  {
    id: 5,
    name: 'Terres de Cendres',
    sky: ['#120a14', '#4a1a1e'],
    ground: '#3a3134',
    groundAlt: '#433a3c',
    groundDetail: '#5c4e50',
    rock: '#4a3c3e',
    rockLight: '#7a6466',
    rockDark: '#221a1c',
    liquid: '#c43a12',
    liquidLight: '#ffb347',
    liquidIsLava: true,
    hedge: '#3a2a2a',
    hedgeLight: '#7a4a3a',
    wall: '#221a1c',
    wallLight: '#3e3234',
    accent: '#ff7a3d',
    mote: '#ff8a3d',
    moteKind: 'ember',
  },
];

export const UI = {
  night: '#0b1026',
  nightSoft: '#151c3d',
  ink: '#f4ecd8',
  inkSoft: '#c9c1ad',
  moon: '#f6e7b8',
  moonGlow: '#ffe9a8',
  danger: '#ff4d5e',
  dangerSoft: 'rgba(255,77,94,0.28)',
  heal: '#6bff9a',
  gold: '#ffcf4a',
  gem: '#5fd8ff',
  heart: '#ff5f7a',
  common: '#8fb8c9',
  rare: '#9a7bff',
  epic: '#ffbf3d',
  hero: '#3fc4b0',
  heroCloak: '#1f8a83',
  heroCloakDark: '#145e5a',
};

export const FONTS = {
  display: '"Cinzel Decorative", "Cinzel", Georgia, serif',
  ui: '"Fredoka", "Baloo 2", system-ui, sans-serif',
};
