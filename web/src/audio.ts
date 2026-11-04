/** Sons synthétisés (WebAudio) — aucun fichier audio sous licence (§13). */
let ac: AudioContext | null = null;
let enabled = true;
let lastShot = 0;

export function setSound(on: boolean): void {
  enabled = on;
}

function audio(): AudioContext | null {
  try {
    ac ??= new AudioContext();
    if (ac.state === 'suspended') void ac.resume();
    return ac;
  } catch {
    return null;
  }
}

function ctx(): AudioContext | null {
  return enabled ? audio() : null;
}

function tone(freq: number, dur: number, type: OscillatorType, vol: number, slide = 0, delay = 0): void {
  const a = ctx();
  if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * slide), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(dur: number, vol: number, freq = 1200): void {
  const a = ctx();
  if (!a) return;
  const buf = a.createBuffer(1, Math.ceil(a.sampleRate * dur), a.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
  const s = a.createBufferSource();
  s.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = freq;
  const g = a.createGain();
  g.gain.value = vol;
  s.connect(f).connect(g).connect(a.destination);
  s.start();
}

export function sfx(name: string): void {
  if (!enabled) return;
  switch (name) {
    case 'shoot': {
      const now = performance.now();
      if (now - lastShot < 70) return;
      lastShot = now;
      tone(880, 0.06, 'triangle', 0.025, 0.6);
      break;
    }
    case 'hit':
      noise(0.05, 0.05, 2400);
      break;
    case 'kill':
      tone(520, 0.12, 'square', 0.03, 1.6);
      tone(780, 0.1, 'triangle', 0.03, 1.4, 0.05);
      break;
    case 'hurt':
      tone(180, 0.18, 'sawtooth', 0.06, 0.5);
      noise(0.12, 0.08, 600);
      break;
    case 'clear':
      [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.22, 'triangle', 0.05, 1, i * 0.08));
      break;
    case 'win':
      [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.35, 'triangle', 0.06, 1, i * 0.1));
      break;
    case 'lose':
      [392, 330, 262, 196].forEach((f, i) => tone(f, 0.4, 'sine', 0.06, 0.98, i * 0.16));
      break;
    case 'boss':
      tone(70, 0.9, 'sawtooth', 0.06, 0.7);
      tone(105, 0.9, 'sine', 0.06, 0.7, 0.1);
      break;
    case 'bossDown':
      noise(0.6, 0.15, 300);
      [262, 392, 523, 784].forEach((f, i) => tone(f, 0.4, 'triangle', 0.06, 1, 0.2 + i * 0.1));
      break;
    case 'star':
      tone(1047, 0.25, 'triangle', 0.06, 1.5);
      break;
    case 'flip':
      noise(0.08, 0.06, 3000);
      break;
    case 'cut':
      noise(0.09, 0.12, 4200);
      tone(1320, 0.12, 'triangle', 0.05, 0.5, 0.02);
      tone(660, 0.18, 'sine', 0.05, 1.5, 0.06);
      break;
    case 'snip':
      noise(0.04, 0.06, 5200);
      break;
    case 'tap':
      tone(660, 0.05, 'triangle', 0.04, 1.2);
      break;
  }
}

// ───────────────────────────── musique ─────────────────────────────
/*
  Musique synthétisée en direct (aucun fichier sous licence, §13) : une boîte à musique de théâtre
  d'ombres — notes pincées sur une gamme pentatonique de ré, bourdon grave, beaucoup de silences.
  Elle ne démarre qu'après un premier geste (règle des navigateurs) et suit le réglage « Musique ».
*/
const SCALE = [146.83, 174.61, 196.0, 220.0, 261.63, 293.66, 349.23, 392.0, 440.0];
let musicOn = false;
let musicTimer: ReturnType<typeof setInterval> | null = null;
let musicBus: GainNode | null = null;
let step = 0;
let degree = 4;

function pluck(a: AudioContext, bus: GainNode, freq: number, t: number, vol: number, dur: number): void {
  const o = a.createOscillator();
  const g = a.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(bus);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function musicTick(): void {
  if (!musicOn || !ac || ac.state !== 'running') return;
  if (!musicBus) {
    musicBus = ac.createGain();
    musicBus.gain.value = 0.5;
    musicBus.connect(ac.destination);
  }
  const t = ac.currentTime + 0.05;
  // bourdon : ré grave toutes les 16 croches, la quinte toutes les 32
  if (step % 16 === 0) pluck(ac, musicBus, step % 32 === 0 ? 73.42 : 110.0, t, 0.05, 3.2);
  // mélodie : marche aléatoire douce sur la gamme, une note sur deux en moyenne
  if (Math.random() < (step % 4 === 0 ? 0.8 : 0.35)) {
    degree = Math.max(0, Math.min(SCALE.length - 1, degree + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
    pluck(ac, musicBus, SCALE[degree], t, 0.022, 1.4);
    if (Math.random() < 0.15) pluck(ac, musicBus, SCALE[degree] * 2, t + 0.12, 0.01, 0.9);
  }
  step++;
}

export function setMusic(on: boolean): void {
  musicOn = on;
  if (on && !musicTimer) musicTimer = setInterval(musicTick, 330);
  if (!on && musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}

/** À appeler sur un geste de l'utilisateur : crée le contexte audio si la musique est active. */
export function wakeAudio(): void {
  if (musicOn) audio();
}
