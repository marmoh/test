/** Applique les réglages qui agissent hors du combat : son, musique, réduction des animations. */
import { save } from './state.js';
import { setMusic, setSound } from './audio.js';

export function applyPrefs(): void {
  const st = save().settings;
  setSound(st.sound);
  setMusic(st.music);
  const reduce = st.reduceMotion || matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  document.getElementById('app')?.classList.toggle('reduce-motion', !!reduce);
}

export function reducedMotion(): boolean {
  return document.getElementById('app')?.classList.contains('reduce-motion') ?? false;
}
