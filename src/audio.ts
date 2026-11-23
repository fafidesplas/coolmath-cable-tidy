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

/** Two-stage plastic latch click: "tk-CLACK" */
export function sfxSnap(colorMatch: boolean, cableDone: boolean) {
  const c = ready(); if (!c) return;
  const t = c.currentTime;
  burst(t, 0.018, 4200, 3, 0.5, 'highpass');
  tone(t, 0.012, 2600, 1800, 0.12, 'square');
  burst(t + 0.035, 0.03, 2400, 2.5, 0.9);
  tone(t + 0.035, 0.03, 1300, 500, 0.18, 'triangle');
  if (!colorMatch) tone(t + 0.09, 0.18, 180, 120, 0.2, 'sawtooth');
  if (cableDone) {
    tone(t + 0.08, 0.35, 1318, 1318, 0.12);
    tone(t + 0.13, 0.45, 1975, 1975, 0.08);
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

export function buzz(pattern: number | number[]) {
  try { if (!muted && 'vibrate' in navigator) navigator.vibrate(pattern); } catch { /* ignore */ }
}
