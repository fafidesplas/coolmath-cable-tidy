// All sounds are synthesized at runtime with the Web Audio API (no audio files).
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted = localStorage.getItem('cablecalm.muted') === '1';

export function isMuted() { return muted; }
export function setMuted(m: boolean) {
  muted = m;
  localStorage.setItem('cablecalm.muted', m ? '1' : '0');
  if (master && ctx) master.gain.setTargetAtTime(m ? 0 : 0.7, ctx.currentTime, 0.02);
}

export function unlockAudio() {
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.7;
    master.connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

function ready() { return ctx && master && noise && ctx.state === 'running' ? ctx : null; }

function burst(at: number, dur: number, freq: number, q: number, gain: number, type: BiquadFilterType = 'bandpass') {
  const c = ctx!;
  const src = c.createBufferSource();
  src.buffer = noise;
  src.playbackRate.value = 0.8 + Math.random() * 0.4;
  const f = c.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, at);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  src.connect(f); f.connect(g); g.connect(master!);
  src.start(at, Math.random() * 0.5, dur + 0.02);
}

function tone(at: number, dur: number, f0: number, f1: number, gain: number, type: OscillatorType = 'sine') {
  const c = ctx!;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, at);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), at + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g); g.connect(master!);
  o.start(at); o.stop(at + dur + 0.02);
}

/** Pentatonic ladder: streaks of correct plugs climb it */
const PENTA = [784, 880, 1047, 1175, 1319, 1568, 1760, 2093, 2349, 2637, 3136];
const note = (i: number) => PENTA[Math.min(PENTA.length - 1, i)];

/** Two-stage plastic latch click: "tk-CLACK" */
export function sfxSnap(colorMatch: boolean, cableDone: boolean, combo = 0) {
  const c = ready(); if (!c) return;
  const t = c.currentTime;
  burst(t, 0.018, 4200, 3, 0.5, 'highpass');
  tone(t, 0.012, 2600, 1800, 0.12, 'square');
  burst(t + 0.035, 0.03, 2400, 2.5, 0.9);
  tone(t + 0.035, 0.03, 1300, 500, 0.18, 'triangle');
  if (!colorMatch) tone(t + 0.09, 0.18, 180, 120, 0.2, 'sawtooth');
  if (cableDone) {
    const f = PENTA[Math.min(PENTA.length - 1, combo)];
    tone(t + 0.08, 0.35, f, f, 0.12);
    tone(t + 0.13, 0.45, f * 1.5, f * 1.5, 0.08);
  }
}

export function sfxUnplug() {
  const c = ready(); if (!c) return;
  const t = c.currentTime;
  burst(t, 0.05, 900, 1.5, 0.6);
  tone(t, 0.07, 420, 140, 0.18, 'sine');
}

export function sfxGrab() {
  const c = ready(); if (!c) return;
  burst(c.currentTime, 0.06, 1800, 0.8, 0.12);
}

/** Zip-tie ratchet: accelerating micro-clicks */
export function sfxZip() {
  const c = ready(); if (!c) return;
  let t = c.currentTime;
  let gap = 0.034;
  for (let i = 0; i < 14; i++) {
    burst(t, 0.012, 3000 + i * 120, 4, 0.35 + i * 0.02);
    t += gap;
    gap *= 0.88;
  }
  burst(t + 0.02, 0.05, 2000, 2, 0.6);
}

export function sfxSnip() {
  const c = ready(); if (!c) return;
  const t = c.currentTime;
  burst(t, 0.03, 5000, 2, 0.6, 'highpass');
  tone(t, 0.05, 900, 300, 0.1, 'triangle');
}

export function sfxAllGood() {
  const c = ready(); if (!c) return;
  const t = c.currentTime;
  [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => {
    tone(t + i * 0.09, 0.6, f, f, 0.13, 'triangle');
    tone(t + i * 0.09, 0.4, f * 2, f * 2, 0.03, 'sine');
  });
}

export function sfxStar(i: number) {
  const c = ready(); if (!c) return;
  const f = [880, 1108.7, 1318.5][i] ?? 1318.5;
  tone(c.currentTime, 0.5, f, f, 0.15, 'triangle');
  tone(c.currentTime, 0.3, f * 1.5, f * 1.5, 0.05, 'sine');
}

export function sfxUi() {
  const c = ready(); if (!c) return;
  tone(c.currentTime, 0.05, 1400, 900, 0.06, 'triangle');
}

export function sfxError() {
  const c = ready(); if (!c) return;
  tone(c.currentTime, 0.12, 220, 160, 0.12, 'square');
}

/** Crisp snip of the tie tail + the bit hitting the floor */
export function sfxTrim() {
  const c = ready(); if (!c) return;
  const t = c.currentTime;
  burst(t, 0.02, 6000, 2, 0.7, 'highpass');
  burst(t + 0.03, 0.03, 3200, 4, 0.8);
  tone(t + 0.03, 0.06, 2100, 900, 0.12, 'triangle');
  burst(t + 0.42, 0.02, 1500, 6, 0.18);
  burst(t + 0.5, 0.015, 1700, 6, 0.1);
}

export function sfxVelcro() {
  const c = ready(); if (!c) return;
  const t = c.currentTime;
  for (let i = 0; i < 7; i++) burst(t + i * 0.014, 0.03, 1400 + i * 160, 1.2, 0.22);
  burst(t + 0.12, 0.08, 500, 1, 0.7, 'lowpass');
}

export function sfxRip() {
  const c = ready(); if (!c) return;
  const t = c.currentTime;
  for (let i = 0; i < 26; i++) burst(t + i * 0.011, 0.02, 1600 + i * 130 + Math.random() * 500, 1.5, 0.3);
}

/** One ratchet tooth of the reel; k 0..1 raises the pitch as the slack disappears */
export function sfxWind(k: number) {
  const c = ready(); if (!c) return;
  const t = c.currentTime;
  burst(t, 0.016, 2200 + k * 2600, 6, 0.4);
  tone(t, 0.03, 320 + k * 620, 300 + k * 560, 0.07, 'triangle');
}

export function sfxWindTight() {
  const c = ready(); if (!c) return;
  const t = c.currentTime;
  burst(t, 0.05, 700, 2, 0.8);
  tone(t, 0.16, 220, 110, 0.25, 'sine');
  tone(t + 0.06, 0.4, 1047, 1047, 0.12, 'triangle');
  tone(t + 0.13, 0.5, 1568, 1568, 0.09, 'triangle');
}

export function sfxUnspool() {
  const c = ready(); if (!c) return;
  let t = c.currentTime;
  for (let i = 0; i < 16; i++) { burst(t, 0.012, 4200 - i * 170, 5, 0.28); t += 0.012 + i * 0.0022; }
}

export function sfxPayout() {
  const c = ready(); if (!c) return;
  burst(c.currentTime, 0.014, 2000, 6, 0.28);
}

export function sfxComb(n: number) {
  const c = ready(); if (!c) return;
  const t = c.currentTime;
  for (let i = 0; i < 3; i++) burst(t + i * 0.012, 0.02, 2600 + n * 60 + i * 300, 5, 0.22);
  tone(t, 0.07, note(n % 10) / 2, note(n % 10) / 2, 0.035, 'sine');
}

export function sfxWrap(n: number) {
  const c = ready(); if (!c) return;
  const t = c.currentTime;
  burst(t, 0.03, 1100 + (n % 12) * 120, 3, 0.32);
  tone(t, 0.04, 500 + (n % 12) * 45, 700 + (n % 12) * 45, 0.05, 'triangle');
}

export function sfxDone() {
  const c = ready(); if (!c) return;
  const t = c.currentTime;
  burst(t, 0.04, 2400, 2.5, 0.7);
  [784, 1047, 1568].forEach((f, i) => tone(t + 0.05 + i * 0.06, 0.4, f, f, 0.1, 'triangle'));
}

export function sfxPrint() {
  const c = ready(); if (!c) return;
  const t = c.currentTime;
  for (let i = 0; i < 9; i++) { tone(t + i * 0.036, 0.026, 620 + (i % 3) * 90, 600, 0.06, 'square'); burst(t + i * 0.036, 0.02, 3400, 4, 0.12); }
  burst(t + 0.36, 0.03, 3600, 3, 0.6);
  tone(t + 0.4, 0.25, 1568, 1568, 0.07, 'triangle');
}

export function sfxDust() {
  const c = ready(); if (!c) return;
  burst(c.currentTime, 0.12, 900 + Math.random() * 600, 1, 0.14);
}

export function sfxScrew(k: number) {
  const c = ready(); if (!c) return;
  const t = c.currentTime;
  burst(t, 0.03, 1500 + k * 900, 5, 0.3);
  tone(t, 0.05, 170 + k * 130, 190 + k * 150, 0.08, 'sawtooth');
}

export function sfxScrewDone() {
  const c = ready(); if (!c) return;
  const t = c.currentTime;
  burst(t, 0.03, 900, 3, 0.9);
  tone(t, 0.09, 300, 150, 0.22, 'triangle');
  tone(t + 0.05, 0.25, 1319, 1319, 0.07, 'triangle');
}

export function sfxHook() {
  const c = ready(); if (!c) return;
  const t = c.currentTime;
  burst(t, 0.02, 1800, 3, 0.6);
  tone(t, 0.12, 900, 620, 0.1, 'triangle');
}

/** Lid fingers snapping in one after another, climbing in pitch */
export function sfxLid(k: number) {
  const c = ready(); if (!c) return;
  const t = c.currentTime;
  burst(t, 0.02, 2000 + k * 1800, 3, 0.7);
  tone(t, 0.06, 420 + k * 620, 300 + k * 400, 0.12, 'triangle');
}

export function sfxPop() {
  const c = ready(); if (!c) return;
  tone(c.currentTime, 0.09, 300, 760, 0.16, 'sine');
}

export function sfxMagnet() {
  const c = ready(); if (!c) return;
  tone(c.currentTime, 0.045, 620, 840, 0.05, 'sine');
}

export function sfxStrain() {
  const c = ready(); if (!c) return;
  tone(c.currentTime, 0.2, 120, 170, 0.1, 'sawtooth');
}

/** Main switch: heavy clunk and a rising hum */
export function sfxLever() {
  const c = ready(); if (!c) return;
  const t = c.currentTime;
  burst(t, 0.08, 300, 1.2, 1, 'lowpass');
  tone(t, 0.2, 130, 50, 0.4, 'sine');
  burst(t + 0.05, 0.03, 1800, 2, 0.6);
  tone(t + 0.15, 1.6, 55, 220, 0.07, 'sawtooth');
}

export function sfxPulse(i: number) {
  const c = ready(); if (!c) return;
  const t = c.currentTime, f = note(i) / 2;
  tone(t, 0.5, f, f, 0.14, 'triangle');
  tone(t + 0.02, 0.35, f * 2, f * 2, 0.04, 'sine');
}

let air: { src: AudioBufferSourceNode; g: GainNode } | null = null;
/** Continuous hiss of the air duster */
export function airOn() {
  const c = ready(); if (!c || air) return;
  const src = c.createBufferSource();
  src.buffer = noise; src.loop = true;
  const f = c.createBiquadFilter();
  f.type = 'bandpass'; f.frequency.value = 3400; f.Q.value = 0.6;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.22, c.currentTime + 0.05);
  src.connect(f); f.connect(g); g.connect(master!);
  src.start();
  air = { src, g };
}
export function airOff() {
  if (!air || !ctx) return;
  air.g.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.04);
  air.src.stop(ctx.currentTime + 0.25);
  air = null;
}

export function buzz(pattern: number | number[]) {
  try { if (!muted && 'vibrate' in navigator) navigator.vibrate(pattern); } catch { /* ignore */ }
}
