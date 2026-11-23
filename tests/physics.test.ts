/**
 * Physics rest test — run with `npm run test:physics`.
 *
 * For every level it runs the real `Game` simulation headless at the game's fixed
 * 60 Hz step, with no input, and measures how much the FREE (non-pinned) cable
 * nodes still move once things should have settled.
 *
 * Metrics, measured over the last REST_WINDOW frames of each idle phase:
 *   - maxDisp: largest per-frame displacement of any free node, in world px/frame
 *              (the world is 720x900 px; 1 px/frame is clearly visible jitter).
 *   - energy:  mean kinetic energy per frame, sum over free nodes of v²/2 (px²/frame²).
 *
 * Pass thresholds (see README "Physics rest test"):
 *   - maxDisp  < MAX_DISP  (0.02 px/frame → < 1/50 px, invisible at any zoom)
 *   - energy   < MAX_ENERGY (1e-3 px²/frame²)
 *   - every cable asleep at the end (in practice both metrics are then exactly 0)
 *
 * Scenarios per level:
 *   start  – the level exactly as the player receives it (tangle, some plugs in wrong ports)
 *   solved – every cable plugged into its matching ports (hanging cables)
 *   drag   – grab a free cable in the middle, swirl it around for 1.5 s, then drag it slowly
 *            along the floor (where static friction acts), release, then idle.
 *            Also checks that the grabbed node follows the pointer (< 1 px error) and that the
 *            rest of the cable actually moves while dragged (> 60 px: it still "feels" physical),
 *            and that sleeping neighbours are woken and pushed by it (> 5 px).
 *   tied   – solved level, a cable tie placed on a same-color group, then the tie is dragged.
 *   fuzz   – FUZZ_DRAGS random drags (seeded) of random plugs / cable points, each followed by idle.
 */
import { Game, type Cable } from '../src/game';
import { LEVELS } from '../src/levels';

const DT = 1 / 60;
const IDLE_FRAMES = 60 * Number(process.env.IDLE_S ?? 8); // idle seconds (default 8)
const REST_WINDOW = 60; // last 1 s is measured
const MAX_DISP = 0.02;
const MAX_ENERGY = 1e-3;

interface Stats {
  maxDisp: number; energy: number;
  /** seconds until the last frame in which some free node moved >= MAX_DISP */
  restAt: number;
  /** cables asleep at the end */
  asleep: number;
}

function snapshot(g: Game) {
  return g.cables.map((c) => ({ x: Float64Array.from(c.x), y: Float64Array.from(c.y) }));
}

/** Free = not pinned by a port, the grab, or a tie this frame. */
function isFree(g: Game, c: Cable, i: number) {
  if (c.pin[i]) return false;
  for (const e of c.ends) if (e.port && (i === c.endIdx(e.which) || i === c.innerIdx(e.which))) return false;
  return true;
}

function idle(g: Game, frames: number, window = REST_WINDOW): Stats {
  let maxDisp = 0, eSum = 0, lastMove = -1;
  let prev = snapshot(g);
  for (let f = 0; f < frames; f++) {
    g.step(DT);
    const cur = snapshot(g);
    let e = 0, m = 0;
    g.cables.forEach((c, ci) => {
      for (let i = 0; i < c.n; i++) {
        if (!isFree(g, c, i)) continue;
        const dx = cur[ci].x[i] - prev[ci].x[i], dy = cur[ci].y[i] - prev[ci].y[i];
        const d2 = dx * dx + dy * dy;
        e += d2 / 2;
        m = Math.max(m, Math.sqrt(d2));
      }
    });
    if (m >= MAX_DISP) lastMove = f;
    if (f >= frames - window) { eSum += e; maxDisp = Math.max(maxDisp, m); }
    prev = cur;
  }
  const asleep = g.cables.filter((c) => g.isAsleep(c)).length;
  return { maxDisp, energy: eSum / window, restAt: (lastMove + 1) / 60, asleep };
}

/** Grab the longest free stretch of some cable in the middle and swirl it. */
function dragScenario(g: Game): { stats: Stats; follow: number; bodyMoved: number; pushed: number; ok: boolean } {
  // pick a cable node at least 60 px away from every plug (otherwise the plug is grabbed)
  const plugs = g.cables.flatMap((c) => c.ends.map((e) => g.plugGeom(e)));
  let sx = 0, sy = 0, best = -1;
  for (const c of [...g.cables].sort((a, b) => b.n - a.n)) {
    for (let i = 4; i < c.n - 4; i++) {
      const d = Math.min(...plugs.map((p) => Math.hypot(p.cx - c.x[i], p.cy - c.y[i])));
      if (d > best) { best = d; sx = c.x[i]; sy = c.y[i]; }
    }
    if (best > 60) break;
  }
  const grabbed = g.pointerDown(sx, sy, false);
  if (!grabbed || g.grab?.kind !== 'cable') return { stats: { maxDisp: 99, energy: 99, restAt: 99, asleep: 0 }, follow: 99, bodyMoved: 0, pushed: 0, ok: false };
  const gc = g.grab.cable!, gi = g.grab.idx!;
  const before = snapshot(g);
  let follow = 0, bodyMoved = 0;
  const ci = g.cables.indexOf(gc);
  // how far did the rest of the dragged cable travel (should be a lot: it is pulled along)
  const trackBody = () => {
    for (let i = 0; i < gc.n; i++) {
      if (Math.abs(i - gi) < 4 || !isFree(g, gc, i)) continue;
      bodyMoved = Math.max(bodyMoved, Math.hypot(gc.x[i] - before[ci].x[i], gc.y[i] - before[ci].y[i]));
    }
  };
  const frames = 90;
  for (let f = 0; f < frames; f++) {
    const a = (f / frames) * Math.PI * 2;
    const px = 360 + Math.cos(a) * 200, py = 480 + Math.sin(a) * 160;
    g.pointerMove(px, py);
    g.step(DT);
    follow = Math.max(follow, Math.hypot(gc.x[gi] - px, gc.y[gi] - py));
    trackBody();
  }
  // slow drag along the floor: 120 px in 2 s (1 px/frame, below the static-friction threshold)
  for (let f = 0; f < 120; f++) {
    const px = 300 + f, py = 900;
    g.pointerMove(px, py);
    g.step(DT);
    if (f > 30) follow = Math.max(follow, Math.hypot(gc.x[gi] - px, gc.y[gi] - Math.min(py, 882)));
  }
  g.pointerUp();
  // the other (previously sleeping) cables must have been woken and pushed by the dragged one
  const after = snapshot(g);
  let pushed = 0;
  g.cables.forEach((c, k) => {
    if (c === gc) return;
    for (let i = 0; i < c.n; i++) pushed = Math.max(pushed, Math.hypot(after[k].x[i] - before[k].x[i], after[k].y[i] - before[k].y[i]));
  });
  const stats = idle(g, IDLE_FRAMES);
  return { stats, follow, bodyMoved, pushed, ok: true };
}

const FUZZ_DRAGS = Number(process.env.FUZZ_DRAGS ?? 4);

function rng(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Random grab (plug or cable point), random path for 0.5–2 s, release, idle. Worst stats win. */
function fuzzScenario(g: Game, seed: number): Stats {
  const r = rng(seed);
  let worst: Stats = { maxDisp: 0, energy: 0, restAt: 0, asleep: g.cables.length };
  for (let d = 0; d < FUZZ_DRAGS; d++) {
    const c = g.cables[Math.floor(r() * g.cables.length)];
    const i = Math.floor(r() * c.n);
    g.pointerDown(c.x[i], c.y[i], false);
    let x = c.x[i], y = c.y[i];
    const tx = 40 + r() * 640, ty = 120 + r() * 780;
    const frames = 30 + Math.floor(r() * 90);
    for (let f = 0; f < frames; f++) {
      x += (tx - x) * 0.08 + (r() - 0.5) * 30; y += (ty - y) * 0.08 + (r() - 0.5) * 30;
      g.pointerMove(x, y);
      g.step(DT);
    }
    g.pointerUp();
    const s = idle(g, IDLE_FRAMES);
    worst = {
      maxDisp: Math.max(worst.maxDisp, s.maxDisp), energy: Math.max(worst.energy, s.energy),
      restAt: Math.max(worst.restAt, s.restAt), asleep: Math.min(worst.asleep, s.asleep),
    };
  }
  return worst;
}

/** Solve, zip a same-color group with a tie, drag the tie around, release, idle. */
function tieScenario(g: Game): Stats | null {
  g.debugSolve();
  idle(g, 60);
  const byColor = new Map<string, Cable[]>();
  for (const c of g.cables) byColor.set(c.color, [...(byColor.get(c.color) ?? []), c]);
  const group = [...byColor.values()].find((cs) => cs.length >= 2);
  if (!group || g.tiesLeft <= 0) return null;
  const k = 0.5;
  const cx = group.reduce((s, c) => s + c.x[Math.round((c.n - 1) * k)], 0) / group.length;
  const cy = group.reduce((s, c) => s + c.y[Math.round((c.n - 1) * k)], 0) / group.length;
  if (!g.placeTie(cx, cy)) return null;
  idle(g, 60);
  const t = g.ties[0];
  g.pointerDown(t.x, t.y, false);
  for (let f = 0; f < 60; f++) { g.pointerMove(t.x + 40 * Math.sin(f / 10), t.y + f); g.step(DT); }
  g.pointerUp();
  return idle(g, IDLE_FRAMES);
}

const pass = (s: Stats, n: number) => s.maxDisp < MAX_DISP && s.energy < MAX_ENERGY && s.asleep === n;
const fmt = (s: Stats, n: number) =>
  `maxDisp=${s.maxDisp.toFixed(4).padStart(7)} px/f  energy=${s.energy.toExponential(2).padStart(9)}  at rest after ${s.restAt.toFixed(1).padStart(4)}s  asleep ${s.asleep}/${n}`;

let failures = 0;
const t0 = Date.now();
console.log(`Physics rest test — ${IDLE_FRAMES / 60}s idle, measured over last ${REST_WINDOW} frames.`);
console.log(`Thresholds: maxDisp < ${MAX_DISP} px/frame, energy < ${MAX_ENERGY} px²/frame²\n`);

for (const L of LEVELS) {
  const results: [string, Stats, string][] = [];

  const g1 = new Game(L);
  results.push(['start ', idle(g1, IDLE_FRAMES), '']);

  const g2 = new Game(L);
  g2.debugSolve();
  results.push(['solved', idle(g2, IDLE_FRAMES), '']);

  // drag starts from a fully settled (sleeping) scene, so it also tests waking by touch/contact
  const g3 = new Game(L);
  idle(g3, IDLE_FRAMES);
  const d = dragScenario(g3);
  const dragOk = d.ok && d.follow < 1 && d.bodyMoved > 60 && d.pushed > 5;
  if (!dragOk) failures++;
  results.push(['drag  ', d.stats, `| follow err ${d.follow.toFixed(2)}px, body moved ${d.bodyMoved.toFixed(0)}px, neighbours pushed ${d.pushed.toFixed(0)}px ${dragOk ? 'OK' : 'FAIL'}`]);

  const tStats = tieScenario(new Game(L));
  if (tStats) results.push(['tied  ', tStats, '| tie placed + dragged']);

  const g4 = new Game(L);
  idle(g4, 60);
  results.push(['fuzz  ', fuzzScenario(g4, L.seed * 7919), `| worst of ${FUZZ_DRAGS} random drags`]);

  const n = L.ports.length / 2;
  for (const [name, s, extra] of results) {
    const ok = pass(s, n);
    if (!ok) failures++;
    console.log(`L${L.id} ${name} ${ok ? 'PASS' : 'FAIL'}  ${fmt(s, n)} ${extra}`);
  }
}

console.log(`\n${failures ? `${failures} check(s) FAILED` : 'All levels at rest ✓'} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
process.exit(failures ? 1 : 0);
