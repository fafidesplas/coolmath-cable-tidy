/**
 * Tangle test — run with `npm run test:tangle`.
 * Plays each job like a messy player (seeded random drags, plugging everything where it belongs
 * with the pointer API, dropping cables on hooks) and measures what is left to untangle, plus
 * whether reels and bundles leave slack stuck on one side.
 */
import { Game, portAnchor, type Cable } from '../src/game';
import { LEVELS, type LevelDef } from '../src/levels';

let failures = 0;
const check = (name: string, ok: boolean, info = '') => { if (!ok) failures++; console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${info}`); };
const run = (g: Game, s: number) => { for (let i = 0; i < s * 60; i++) g.step(1 / 60); };
function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function dragTo(g: Game, x: number, y: number, frames = 45) {
  const p = { ...g.pointer };
  for (let f = 1; f <= frames; f++) { g.pointerMove(p.x + (x - p.x) * (f / frames), p.y + (y - p.y) * (f / frames)); g.step(1 / 60); }
}
/** Plug every cable into its left-to-right port pair (what a sensible player aims for). */
function plugAll(g: Game) {
  for (let round = 0; round < 3; round++) for (const c of g.cables) {
    const same = g.cables.filter((o) => o.color === c.color), k = same.indexOf(c);
    for (const side of ['A', 'B'] as const) {
      const port = g.ports.filter((p) => p.side === side && p.color === c.color).sort((a, b) => a.x - b.x)[k];
      const e = c.ends[side === 'A' ? 0 : 1];
      if (e.port === port) continue;
      const q = g.plugGeom(e);
      g.pointerDown(q.cx, q.cy);
      if (g.grab?.end !== e) { // someone else's head is on top: take this one directly
        g.cancelGrab();
        g.grab = { kind: 'plug', end: e, latch: e.port ?? undefined, ox: 0, oy: 0, x: q.ex, y: q.ey, sx: q.ex, sy: q.ey, moved: false, t: 0, over: 0, touch: false };
        g.pointer = { x: q.ex, y: q.ey };
      }
      dragTo(g, (q.ex + portAnchor(port).x) / 2, 500, 25);
      const a = portAnchor(port, 4);
      dragTo(g, a.x, a.y, 35);
      g.pointerUp();
      for (let i = 0; i < 10; i++) g.step(1 / 60);
    }
  }
}
function slackOf(g: Game, c: Cable) { // worst slack of any held span, relative to its length
  let last = -1, worst = 0;
  for (let i = 0; i < c.n; i++) {
    if (!c.pin[i]) continue;
    if (last >= 0 && i - last > 2) {
      let arc = 0;
      for (let k = last; k < i; k++) arc += Math.hypot(c.x[k + 1] - c.x[k], c.y[k + 1] - c.y[k]);
      worst = Math.max(worst, arc - Math.hypot(c.x[i] - c.x[last], c.y[i] - c.y[last]));
    }
    last = i;
  }
  return worst;
}
/** Flick every crossing the way a player would: tap the rings until none are left. */
function flickAll(g: Game) {
  for (let t = 0; t < 14 && g.countCrossings(); t++) { const p = g.crossPts[t % g.crossPts.length]; g.flick(p.x, p.y); run(g, 1); }
  run(g, 2);
  return g.countCrossings();
}
const lv = (key: string): LevelDef => LEVELS.find((l) => l.key === key)!;

let sum = 0, n = 0;
for (const L of LEVELS) {
  const left: number[] = [], after: number[] = [], plugged: number[] = [];
  for (let seed = 1; seed <= 4; seed++) {
    const r = rng(seed * 977 + L.id), g = new Game(L);
    for (let d = 0; d < 6; d++) { // stir the pot
      const c = g.cables[Math.floor(r() * g.cables.length)], i = 3 + Math.floor(r() * (c.n - 6));
      g.pointerDown(c.x[i], c.y[i]);
      for (let k = 0; k < 3; k++) dragTo(g, 60 + r() * 600, 300 + r() * 450, 20);
      g.pointerUp();
    }
    plugAll(g);
    for (const h of g.hooks) for (const c of g.cables.filter((o) => Math.abs((o.ends[0].port?.x ?? 360) - h.x) < 110).slice(0, h.cap)) {
      const i = Math.round(c.n * 0.4);
      g.hookCable(h, c, i);
      for (let f = 0; f < 30; f++) g.step(1 / 60);
    }
    run(g, 20);
    left.push(g.countCrossings()); after.push(flickAll(g)); run(g, 15);
    if (g.cables.some((c) => !g.isAsleep(c))) check(`${L.key}#${seed} comes to rest`, false);
  }
  sum += left.reduce((a, b) => a + b, 0); n += left.length;
  check(`${L.key}: plugged by pointer`, plugged.every((p) => p === L.ports.length / 2), plugged.join(' '));
  check(`${L.key}: rings can be flicked away`, after.every((v) => v === 0), after.join(' '));
  check(`${L.key}: few crossings left`, left.reduce((a, b) => a + b, 0) / left.length <= 5.5, left.join(' '));
}
console.log(`mean crossings left: ${(sum / n).toFixed(2)}\n`);

// slack must not get stuck beside a bundle: wrap / tie first, then wind
for (const [key, kind] of [['radio', 'wrap'], ['desk', 'zip'], ['desk', 'hook']] as const) {
  const g = new Game(lv(key));
  g.debugSolve(); run(g, 4);
  const grp = g.cables.filter((c) => c.color === (key === 'radio' ? 'white' : 'blue'));
  const at = (c: Cable, k: number) => Math.round((c.n - 1) * (c.y[0] < c.y[c.n - 1] ? k : 1 - k));
  const m = (k: number) => ({ x: grp.reduce((s, c) => s + c.x[at(c, k)], 0) / grp.length, y: grp.reduce((s, c) => s + c.y[at(c, k)], 0) / grp.length });
  if (kind === 'wrap') { g.pointerDown(m(0.6).x, m(0.6).y, 'wrap'); dragTo(g, m(0.75).x, m(0.75).y + 20, 60); g.pointerUp(); }
  else if (kind === 'zip') g.useTool('zip', m(0.6).x, m(0.6).y);
  else for (const c of grp) g.hookCable(g.hooks[0], c, at(c, 0.7));
  run(g, 3);
  const held = grp.every((c) => g.ties.some((t) => t.entries.some((e) => e.cable === c)));
  for (const c of grp) {
    const i = at(c, 0.2);
    g.useTool('reel', c.x[i], c.y[i]);
    const r = g.reels.find((o) => o.cable === c);
    if (!r) continue;
    g.pointerDown(c.x[r.idx], c.y[r.idx]);
    if (g.grab?.kind === 'reel') for (let f = 0; f < 360; f++) g.step(1 / 60);
    g.pointerUp();
  }
  run(g, 4);
  const worst = Math.max(...grp.map((c) => slackOf(g, c)));
  check(`${key}/${kind}: reel takes the slack on both sides`, held && g.reels.length === grp.length && worst < 12, `worst ${worst.toFixed(1)}px`);
}
console.log(failures ? `\n${failures} check(s) FAILED` : '\nNothing tangles or gets stuck ✓');
process.exit(failures ? 1 : 0);
