import type { ColorKey, LevelDef } from './levels';
import { ALL_TOOLS, UNLIMITED, type ToolId } from './tools';

export const W = 720;
export const H = 900;
export const FLOOR = H - 18;
export const SEG = 13;
export const PLUG_LEN = 22;
export const REP_R = 9;
export const TIE_R = 72;
/** same-color cables this far from the tap are still gathered by a tie or wrap */
export const GATHER_R = 120;
const LIFT = 9; // nodes on each side of the hand that are lifted over the other cables
export const COMB_R = 140;
export const HOOK_R = 40;
export const REEL_R = 20;
export const AIR_R = 72;
export const GRAB_R = 46; // default plug grab radius (world px); touch screens pass a larger one

const GRAV = 1500;
const DAMP = 0.982;
const ITER = 14;
const SNAP_R = 60;
const BEND2 = 0.1; // soft long-range bending stiffness: rounds curves out like a real patch cord
const END_W = 0.45; // inverse mass of the plug end: heads feel heavier than the cord
const PULL = 18; // px you must pull before a seated plug pops out (so a tap never unplugs)
const PULL_TIGHT = 44; // ...when its terminal screw is tightened
const WIND_V = 190; // px of cable per second while winding a reel
const COMB_LANE = 11, WRAP_LANE = 5;
const SLACK = 1.06;
// Rest / sleeping (see README "Physics rest test")
const LOW_V = 0.25; // px per substep: below this, extra "static friction" damping kills creep
const LOW_DAMP = 0.8;
const FLOOR_STATIC = 0.6; // px per substep: slower nodes touching the floor stick (static friction)
const SLEEP_DIST = 3; // px: a cable whose nodes all stay within this of where they were...
const SLEEP_FRAMES = 40; // ...for ~0.66 s is "still" and may go to sleep (frozen, zero cost)
// Safety net: the longer nobody touches anything, the larger that tolerance gets (up to 4x after
// ~9 s), so even a slowly collapsing heap is guaranteed to come to rest.
const SLEEP_GROW_FRAMES = 180;
const SLEEP_GROW_MAX = 4;
const WAKE_V = 0.5; // px per frame: an awake node this fast touching a sleeping cable wakes it
const CAB_STATIC = 0.5; // px per substep: slower relative slides between touching cables stick
const CAB_KINETIC = 0.3; // fraction of a faster relative slide removed per contact pass
const MAX_BRAIDS = 12; // ditto for braids between a pair of cables
const BRAID_DIFF = 14; // longest twist (in nodes) two cables of different colors shed by themselves
const MAX_UNTWISTS = 8; // auto curl fixes per cable between player interactions
const GC = 40; // grid cols (cell 18px)
const GR = 50;
const CELL = 18;

export interface End { cable: Cable; which: 0 | 1; port: Port | null }

export interface Port {
  id: number; x: number; y: number; dir: 1 | -1; color: ColorKey; side: 'A' | 'B';
  end: End | null; pulse: number;
  /** px the plug currently sticks out (seating / pulling animation) */
  out: number;
  /** terminal screw 0..1 */
  tight: number;
}

export type TieKind = 'zip' | 'velcro' | 'comb' | 'wrap' | 'hook' | 'duct';
/** `t` (hook/duct entries): 0..1 how far the cable has slid into its lane */
export interface TieEntry { cable: Cable; idx: number; off: number; t?: number }
/** Anything that holds cable nodes at a place: ties, straps, comb/wrap stations, hooks, duct slots. */
export interface Tie {
  kind: TieKind; x: number; y: number; nx: number; ny: number; color: ColorKey; entries: TieEntry[]; t: number;
  /** zip ties: 1 = the tail still sticks out, 0 = trimmed flush */
  tail: number; run?: Run; duct?: Duct;
  /** holders with the same id grip one cable as a unit (all stations of a run, all slots of a duct) */
  gid: number;
}
/** A comb / spiral-wrap stroke: a chain of stations laid along the cables. */
export interface Run {
  kind: 'comb' | 'wrap'; gid: number; color: ColorKey; stations: Tie[];
  live: { cable: Cable; idx: number; s: number; lane: number }[];
  ux: number; uy: number; ended: boolean;
}
export interface Hook { x: number; y: number; cap: number; tie: Tie }
export interface Duct { x: number; y: number; w: number; h: number; st: Tie[]; lid: number; shine: number }
export interface Reel { cable: Cable; idx: number; spin: number; pop: number; tight: boolean; acc: number }
export interface Dust { x: number; y: number; r: number; a: number; hp: number; vx: number; vy: number; gone: boolean }
interface Cross { i: number; j: number; x: number; y: number }
export interface Pulse { cable: Cable; t: number; dur: number; from: 0 | 1; strong: boolean; delay: number }
export interface Bit { x: number; y: number; vx: number; vy: number; rot: number; vr: number; w: number; h: number; color: string; t: number; life: number; g: number }

export interface Fx { x: number; y: number; t: number; color: string; kind: 'ring' | 'spark'; glyph?: 'ok' | 'bad' }

export interface Grab {
  kind: 'plug' | 'cable' | 'tie' | 'reel' | 'lid' | 'run' | 'air' | 'screw';
  end?: End; cable?: Cable; idx?: number; tie?: Tie; reel?: Reel; duct?: Duct; run?: Run; port?: Port;
  /** plug still seated in this port (being pulled) */
  latch?: Port;
  /** port the plug was just pulled out of: no magnet until the pointer has left it */
  avoid?: Port;
  /** cable still held by this hook / duct */
  hold?: Hook | Duct;
  ox: number; oy: number; x: number; y: number; sx: number; sy: number; moved: boolean;
  t: number; over: number; touch: boolean;
}

export type Pick =
  | { kind: 'plug'; end: End } | { kind: 'cable'; cable: Cable; idx: number }
  | { kind: 'tie'; tie: Tie } | { kind: 'reel'; reel: Reel } | { kind: 'lid'; duct: Duct };

export interface Task { id: string; label: string; done: number; total: number }

export type GameEvent =
  | { type: 'flick' } | { type: 'trim' } | { type: 'velcro' } | { type: 'rip' } | { type: 'hook' } | { type: 'unhook' }
  | { type: 'wind'; k: number } | { type: 'windTight' } | { type: 'unspool' } | { type: 'payout' } | { type: 'reel' }
  | { type: 'comb'; n: number } | { type: 'combDone' } | { type: 'wrap'; n: number } | { type: 'wrapDone' }
  | { type: 'label' } | { type: 'dust' } | { type: 'dustDone' } | { type: 'screw'; k: number } | { type: 'screwDone' }
  | { type: 'lid'; k: number } | { type: 'lidDone' } | { type: 'lidOpen' } | { type: 'strain' } | { type: 'eject' }
  | { type: 'pulse'; i: number } | { type: 'powered' } | { type: 'magnet' }
  | { type: 'snap'; colorMatch: boolean; cableDone: boolean }
  | { type: 'unplug' }
  | { type: 'grab' }
  | { type: 'tie' }
  | { type: 'snip' }
  | { type: 'allgood' }
  | { type: 'broken' }
  | { type: 'toast'; text: string };

export interface Evaluation {
  connected: number; total: number;
  crossings: number; crossScore: number;
  smooth: number;
  bundled: number; bundleGroups: number; bundleScore: number;
  finish: number; tasks: Task[];
  score: number; stars: number;
}

export class Cable {
  n: number;
  seg: number;
  o: number;
  x!: Float32Array; y!: Float32Array; px!: Float32Array; py!: Float32Array;
  pin: Uint8Array;
  ends: [End, End];
  /** frames in a row this cable has stayed within SLEEP_DIST of its rest anchor */
  still = 0;
  /** automatic curl fixes since the player last interacted (capped so it can't loop forever) */
  untwists = 0;
  /** rest length of each segment; sums to `length - wound` (see Game.balance) */
  len: Float32Array;
  /** cum[i] = rest length from node 0 to node i */
  cum: Float32Array;
  /** px of cable currently on a reel */
  wound = 0;
  /** 0 = free node, otherwise the id of whatever holds it (tie, run, hook, duct) */
  grp: Int32Array;
  /** 0 = no label, otherwise its printing/wrapping animation 0..1 */
  label = 0;
  constructor(public id: number, public color: ColorKey, public length: number, offset: number) {
    const segs = Math.max(8, Math.round(length / SEG));
    this.n = segs + 1;
    this.seg = length / segs;
    this.len = new Float32Array(segs).fill(this.seg);
    this.cum = new Float32Array(this.n);
    this.grp = new Int32Array(this.n);
    this.measure();
    this.o = offset;
    this.pin = new Uint8Array(this.n);
    this.ends = [{ cable: this, which: 0, port: null }, { cable: this, which: 1, port: null }];
  }
  measure() {
    for (let i = 0; i < this.n - 1; i++) this.cum[i + 1] = this.cum[i] + this.len[i];
    this.seg = this.cum[this.n - 1] / (this.n - 1);
  }
  endIdx(w: 0 | 1) { return w === 0 ? 0 : this.n - 1; }
  innerIdx(w: 0 | 1) { return w === 0 ? 1 : this.n - 2; }
  valid(): boolean {
    const a = this.ends[0].port, b = this.ends[1].port;
    return !!a && !!b && a.color === this.color && b.color === this.color && a.side !== b.side;
  }
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function portAnchor(p: Port, extra = 0) {
  return { x: p.x, y: p.y + p.dir * (PLUG_LEN + p.out + extra) };
}

export class Game {
  cables: Cable[] = [];
  order: Cable[] = []; // draw order
  ports: Port[] = [];
  ties: Tie[] = [];
  fx: Fx[] = [];
  hooks: Hook[] = [];
  ducts: Duct[] = [];
  reels: Reel[] = [];
  dust: Dust[] = [];
  bits: Bit[] = [];
  pulses: Pulse[] = [];
  /** uses left of each tool in this job */
  left: Record<ToolId, number>;
  crossPts: { x: number; y: number; a: Cable; b: Cable }[] = [];
  /** what a press right now would grab (for the hover highlight) */
  hover: Pick | null = null;
  /** finishing power-up sequence: seconds since the lever was thrown (-1 = off) */
  power = -1;
  private nextGid = 1;
  private powerQueue: { at: number; cable: Cable; i: number }[] = [];
  private nextAmbient = 2;
  private dustTotal = 0;
  grab: Grab | null = null;
  hoverPort: Port | null = null;
  allGood = false;
  time = 0;
  private frame = 0;
  /** frames since the player last touched anything */
  private idleFrames = 0;
  pointer = { x: -999, y: -999 };
  onEvent: (e: GameEvent) => void = () => {};

  private X: Float32Array; private Y: Float32Array; private PX: Float32Array; private PY: Float32Array;
  private PIN: Uint8Array;
  private IM: Float32Array; // inverse mass (plug heads and reels are heavier)
  private FX: Float32Array; private FY: Float32Array; // positions at frame start
  private AX: Float32Array; private AY: Float32Array; // rest anchor (positions when `still` restarted)
  /** per cable: 1 = asleep (frozen until something touches/grabs/plugs it) */
  readonly sleep: Uint8Array;
  /** union-find over cables touching each other / sharing a tie this frame (sleep islands) */
  private uf: Int16Array;
  private laneOf!: Uint8Array;
  private ptC: Int16Array; private ptI: Int16Array;
  private grid = new Int32Array(GC * GR);
  private next: Int32Array;
  private total: number;

  constructor(public level: LevelDef) {
    this.left = Object.fromEntries(ALL_TOOLS.map((t) => [t, level.tools[t] ?? 0])) as Record<ToolId, number>;
    level.ports.forEach((p, i) => this.ports.push({ id: i, ...p, end: null, pulse: 0, out: 0, tight: 0 }));
    for (const f of level.fixtures ?? []) {
      const gid = this.nextGid++;
      const tie = (x: number, y: number, kind: TieKind): Tie => ({ kind, x, y, nx: 1, ny: 0, color: 'black', entries: [], t: 1, tail: 0, gid });
      if (f.type === 'hook') this.hooks.push({ x: f.x, y: f.y, cap: f.cap, tie: tie(f.x, f.y, 'hook') });
      else {
        const cx = f.x + f.w / 2;
        this.ducts.push({ x: f.x, y: f.y, w: f.w, h: f.h, lid: 0, shine: 0, st: [0, 0.5, 1].map((k) => tie(cx, f.y + 14 + (f.h - 28) * k, 'duct')) });
        const du = this.ducts[this.ducts.length - 1];
        for (const t of du.st) t.duct = du;
      }
    }
    this.ties.push(...this.hooks.map((h) => h.tie), ...this.ducts.flatMap((d) => d.st));

    // pair ports of each color, A[i] <-> B[i] by x order
    const colors = [...new Set(level.ports.map((p) => p.color))];
    const pairs: { color: ColorKey; len: number }[] = [];
    for (const color of colors) {
      const A = this.ports.filter((p) => p.side === 'A' && p.color === color).sort((a, b) => a.x - b.x);
      const B = this.ports.filter((p) => p.side === 'B' && p.color === color).sort((a, b) => a.x - b.x);
      for (let i = 0; i < Math.min(A.length, B.length); i++) {
        const a = portAnchor(A[i], SEG), b = portAnchor(B[i], SEG);
        let d = Math.hypot(a.x - b.x, a.y - b.y) * (level.slack ?? SLACK);
        // long enough to be routed through the duct
        for (const u of this.ducts) {
          const s0 = u.st[0], s1 = u.st[2];
          d = Math.max(d, (Math.hypot(a.x - s0.x, a.y - s0.y) + (s1.y - s0.y) + Math.hypot(b.x - s1.x, b.y - s1.y)) * 1.035 + SEG);
        }
        pairs.push({ color, len: 2 * SEG + d });
      }
    }
    let off = 0;
    pairs.forEach((p, i) => {
      const c = new Cable(i, p.color, p.len, off);
      off += c.n;
      this.cables.push(c);
    });
    this.total = off;
    this.X = new Float32Array(off); this.Y = new Float32Array(off);
    this.PX = new Float32Array(off); this.PY = new Float32Array(off);
    this.PIN = new Uint8Array(off);
    this.IM = new Float32Array(off).fill(1);
    for (const c of this.cables) { this.IM[c.o] = END_W; this.IM[c.o + c.n - 1] = END_W; }
    this.FX = new Float32Array(off); this.FY = new Float32Array(off);
    this.AX = new Float32Array(off); this.AY = new Float32Array(off);
    this.sleep = new Uint8Array(this.cables.length);
    this.uf = new Int16Array(this.cables.length);
    this.laneOf = new Uint8Array(this.cables.length);
    this.braids = new Uint8Array(this.cables.length ** 2);
    this.ptC = new Int16Array(off); this.ptI = new Int16Array(off);
    this.next = new Int32Array(off);
    for (const c of this.cables) {
      c.x = this.X.subarray(c.o, c.o + c.n);
      c.y = this.Y.subarray(c.o, c.o + c.n);
      c.px = this.PX.subarray(c.o, c.o + c.n);
      c.py = this.PY.subarray(c.o, c.o + c.n);
      c.pin = this.PIN.subarray(c.o, c.o + c.n);
      for (let i = 0; i < c.n; i++) { this.ptC[c.o + i] = c.id; this.ptI[c.o + i] = i; }
    }
    this.order = [...this.cables];
    this.scramble();
    for (let i = 0; i < 320; i++) this.step(1 / 60, true);
    this.wakeAll(); // the player sees the settled tangle; let it finish settling live
    this.fx = [];
    for (const p of this.ports) p.pulse = 0;
    this.time = 0;
    this.spawnDust();
    this.hover = null;
  }

  get tiesLeft() { return this.left.zip; }

  // ---------------------------------------------------------------- setup
  private scramble() {
    const rng = mulberry32(this.level.seed);
    const shuffle = <T>(arr: T[]) => {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    };
    const pos = new Map<End, { x: number; y: number }>();
    for (const c of shuffle([...this.cables])) {
      for (const w of shuffle([0, 1] as (0 | 1)[])) {
        const end = c.ends[w];
        const other = pos.get(c.ends[1 - w]);
        let placed = false;
        if (rng() > this.level.loose) {
          const cands = shuffle(this.ports.filter((p) => !p.end && p.color !== c.color));
          for (const p of cands) {
            const a = portAnchor(p);
            if (other && Math.hypot(a.x - other.x, a.y - other.y) > c.length * 0.85) continue;
            p.end = end; end.port = p; pos.set(end, a); placed = true;
            break;
          }
        }
        if (!placed) {
          let best: { x: number; y: number } | null = null;
          for (let t = 0; t < 40 && !best; t++) {
            const q = { x: 50 + rng() * (W - 100), y: FLOOR - rng() * 60 };
            if (!other || Math.hypot(q.x - other.x, q.y - other.y) < c.length * 0.8) best = q;
          }
          if (!best) {
            const o = other!;
            const ang = Math.PI * (0.25 + rng() * 0.5);
            best = { x: o.x + Math.cos(ang) * c.length * 0.5, y: Math.min(FLOOR, o.y + Math.sin(ang) * c.length * 0.5) };
          }
          pos.set(end, best);
        }
      }
      if (c.valid()) { // never start solved
        const p = c.ends[1].port!; p.end = null; c.ends[1].port = null;
        const a = pos.get(c.ends[0])!;
        pos.set(c.ends[1], { x: Math.min(W - 40, a.x + 80), y: FLOOR - 20 });
      }
    }
    // initial messy shape: random cubic bezier between both ends
    for (const c of this.cables) {
      const p0 = pos.get(c.ends[0])!, p3 = pos.get(c.ends[1])!;
      const p1 = { x: 60 + rng() * (W - 120), y: 260 + rng() * 520 };
      const p2 = { x: 60 + rng() * (W - 120), y: 260 + rng() * 520 };
      for (let i = 0; i < c.n; i++) {
        const t = i / (c.n - 1), u = 1 - t;
        const x = u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x;
        const y = u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y;
        c.x[i] = c.px[i] = x; c.y[i] = c.py[i] = y;
      }
    }
  }

  // ---------------------------------------------------------------- physics
  step(dt: number, silent = false) {
    this.time += dt;
    for (const t of this.ties) t.t = Math.min(1, t.t + dt * 4);
    for (const p of this.ports) p.pulse = Math.max(0, p.pulse - dt * 1.6);
    for (const f of this.fx) f.t += dt;
    this.fx = this.fx.filter((f) => f.t < 0.8);
    this.animate(dt);
    this.updateGrab(dt);
    this.computePins();
    for (const c of this.cables) if (!this.sleep[c.id]) this.balance(c);
    const sub = 2, h = dt / sub;
    this.FX.set(this.X); this.FY.set(this.Y);
    for (let i = 0; i < this.uf.length; i++) this.uf[i] = i;
    for (const t of this.ties) for (const e of t.entries) this.union(t.entries[0].cable.id, e.cable.id);
    this.forceWake();
    for (let s = 0; s < sub; s++) {
      this.computePins();
      this.integrate(h);
      for (let it = 0; it < ITER; it++) {
        this.solveDist(it % 2 === 1);
        if (it % 2 === 0) this.solveBend();
        if (it % 4 === 3) this.tether();
        if (it % 4 === 1) this.repel();
        this.applyPins();
        this.bounds();
      }
    }
    void silent;
    if (++this.frame % 12 === 0) { this.untwist(); this.unbraid(); }
    this.wakeByContact();
    this.updateSleep();
  }

  // ---------------------------------------------------------------- sleeping
  isAsleep(c: Cable) { return this.sleep[c.id] === 1; }

  wake(c: Cable) { this.sleep[c.id] = 0; c.still = 0; }

  private find(a: number): number {
    const uf = this.uf;
    while (uf[a] !== a) { uf[a] = uf[uf[a]]; a = uf[a]; }
    return a;
  }
  private union(a: number, b: number) { const ra = this.find(a), rb = this.find(b); if (ra !== rb) this.uf[ra] = rb; }

  /** Wake a cable together with every cable in its contact island. */
  private wakeIsland(c: Cable) {
    const r = this.find(c.id);
    for (const o of this.cables) if (this.find(o.id) === r) this.wake(o);
  }

  /** Player-driven change (grab, plug, tie...): wake everything and re-arm auto-untwist. */
  wakeAll() { this.idleFrames = 0; this.braids.fill(0); for (const c of this.cables) { this.wake(c); c.untwists = 0; } }

  /** Anything the player is touching (or a tie still closing) must simulate. */
  private forceWake() {
    const g = this.grab;
    if (g?.cable) this.wake(g.cable);
    if (g?.end) this.wake(g.end.cable);
    for (const t of this.ties) {
      for (const e of t.entries) if (t.t < 1 || (e.t ?? 1) < 1 || g?.tie === t) this.wake(e.cable);
    }
  }

  /**
   * Wake sleeping cables that an awake node is really pushing into: the node must have moved
   * more than WAKE_V over the whole frame. (Checking inside the solver woke cables from the
   * gravity step of resting neighbours, which then kept waking each other forever.)
   */
  private wakeByContact() {
    const { X, Y, FX, FY, ptC, sleep, grid, next } = this;
    if (!sleep.some((v) => v === 1)) return;
    const R2 = (REP_R + 4) * (REP_R + 4), V2 = WAKE_V * WAKE_V;
    for (let k = 0; k < this.total; k++) {
      if (sleep[ptC[k]]) continue;
      const vx = X[k] - FX[k], vy = Y[k] - FY[k];
      if (vx * vx + vy * vy < V2) continue;
      const cx = Math.min(GC - 1, Math.max(0, (X[k] / CELL) | 0));
      const cy = Math.min(GR - 1, Math.max(0, (Y[k] / CELL) | 0));
      for (let oy = -1; oy <= 1; oy++) {
        const yy = cy + oy;
        if (yy < 0 || yy >= GR) continue;
        for (let ox = -1; ox <= 1; ox++) {
          const xx = cx + ox;
          if (xx < 0 || xx >= GC) continue;
          for (let j = grid[xx + yy * GC]; j !== -1; j = next[j]) {
            if (!sleep[ptC[j]]) continue;
            const dx = X[j] - X[k], dy = Y[j] - Y[k];
            if (dx * dx + dy * dy < R2) this.wakeIsland(this.cables[ptC[j]]);
          }
        }
      }
    }
  }

  /**
   * A cable whose every node stayed within SLEEP_DIST of its anchor for SLEEP_FRAMES is "still".
   * Cables go to sleep per contact island, all at once, and only when the whole island is
   * still: putting one cable to sleep while a neighbour resting on it stays awake changes the
   * neighbour's contact response (it suddenly collides with a static body), which jolted it
   * and woke the sleeper again — another endless jitter loop.
   */
  private updateSleep() {
    const { X, Y, AX, AY, PX, PY } = this;
    const n = this.cables.length;
    if (this.grab) this.idleFrames = 0; else this.idleFrames++;
    const tol = SLEEP_DIST * Math.min(SLEEP_GROW_MAX, 1 + this.idleFrames / SLEEP_GROW_FRAMES);
    const blocked = new Uint8Array(n); // island root -> 1 if some member can't sleep
    for (const c of this.cables) {
      if (this.sleep[c.id]) continue;
      // Distance from a rest anchor rather than per-frame speed: tiny stick-slip creeps on the
      // floor (0.07 px every half second) would otherwise reset the counter forever.
      let m = Infinity;
      if (c.still > 0 && !this.isGrabbed(c)) {
        m = 0;
        for (let k = c.o; k < c.o + c.n; k++) {
          const dx = X[k] - AX[k], dy = Y[k] - AY[k];
          m = Math.max(m, dx * dx + dy * dy);
        }
      }
      if (m < tol * tol) c.still++;
      else {
        c.still = this.isGrabbed(c) ? 0 : 1;
        AX.set(X.subarray(c.o, c.o + c.n), c.o); AY.set(Y.subarray(c.o, c.o + c.n), c.o);
      }
      if (c.still < SLEEP_FRAMES) blocked[this.find(c.id)] = 1;
    }
    for (const c of this.cables) {
      if (this.sleep[c.id] || blocked[this.find(c.id)]) continue;
      this.sleep[c.id] = 1;
      for (let k = c.o; k < c.o + c.n; k++) { PX[k] = X[k]; PY[k] = Y[k]; }
    }
  }

  /**
   * Small curls (self-loops spanning few segments) relax out, like a real cable twisting free.
   * The crossing is removed with a "2-opt" swap: the node order between the two crossing
   * segments is reversed, so the loop becomes a hairpin WITHOUT moving any node. (The old
   * version teleported the loop's nodes onto a straight chord shorter than the loop; the
   * distance constraints then pushed them back out into a new curl, and the cycle repeated
   * every 12 frames forever — the "dancing cable" bug.) A cable with spare length lying on
   * the floor can legitimately buckle over itself again, so the number of automatic fixes is
   * capped per cable until the player touches something; after that it is allowed to rest.
   */
  private untwist() {
    for (const c of this.cables) {
      if (this.isGrabbed(c) || this.sleep[c.id] || c.untwists >= MAX_UNTWISTS) continue;
      const { x, y } = c;
      for (let i = 1; i < c.n - 4; i++) {
        for (let j = i + 3; j < Math.min(c.n - 2, i + 40); j++) {
          if (!segX(x[i], y[i], x[i + 1], y[i + 1], x[j], y[j], x[j + 1], y[j + 1])) continue;
          let blocked = false;
          for (let k = i + 1; k <= j && !blocked; k++) blocked = !!c.pin[k];
          if (!blocked) blocked = this.ties.some((t) => t.entries.some((e) => e.cable === c && e.idx > i && e.idx <= j));
          if (blocked) continue;
          this.reverse(c, i, j);
          this.wakeIsland(c);
          c.untwists++;
          i = j;
          break;
        }
      }
    }
  }

  /** Reverse the node order between two crossing segments: the loop opens without moving. */
  private reverse(c: Cable, i: number, j: number) {
    for (const v of [c.x, c.y, c.px, c.py]) for (let a = i + 1, b = j; a < b; a++, b--) { const t = v[a]; v[a] = v[b]; v[b] = t; }
  }

  /**
   * Braids: when two cables cross twice with nothing holding them in between, the two stretches
   * swap shapes (each cable takes the path the other one had), so both crossings vanish without
   * any visible movement; contact then pushes them apart on the right sides. Same-color cables
   * run together, so any braid between them slips loose; different colors only shed short twists,
   * big tangles are still the player's job. Budgeted like untwist() so the scene can rest.
   */
  private unbraid() {
    const cs = this.cables;
    const tr = cs.map((c) => (this.isGrabbed(c) ? null : this.trace(c)));
    for (let ia = 0; ia < cs.length; ia++) for (let ib = ia + 1; ib < cs.length; ib++) {
      const a = cs[ia], b = cs[ib];
      if ((this.sleep[ia] && this.sleep[ib]) || this.isGrabbed(a) || this.isGrabbed(b)) continue;
      const key = ia * cs.length + ib;
      if (this.braids[key] >= MAX_BRAIDS) continue;
      const max = a.color === b.color ? 80 : BRAID_DIFF;
      const xs = this.crossList(a, b, tr[ia]!, tr[ib]!);
      for (let k = 0; k + 1 < xs.length; k++) {
        const p = xs[k], q = xs[k + 1];
        if (q.i - p.i > max || Math.abs(q.j - p.j) > max) continue;
        if (!this.resolve(a, b, p, q)) continue;
        tr[ia] = this.trace(a); tr[ib] = this.trace(b);
        this.braids[key]++;
        this.wakeIsland(a); this.wakeIsland(b);
        break;
      }
    }
  }

  /** Node i of a cable, with virtual nodes past a seated plug (inside its device). */
  private nodeAt(c: Cable, i: number): [number, number] {
    const p = i < 0 ? c.ends[0].port : i >= c.n ? c.ends[1].port : null;
    if (p) return [p.x, p.y - p.dir * 60];
    const k = clamp(i, 0, c.n - 1);
    return [c.x[k], c.y[k]];
  }

  /** Flat copy of a cable's points including the virtual ends, with its bounding box. */
  private trace(c: Cable) {
    const i0 = c.ends[0].port ? -1 : 0, i1 = c.ends[1].port ? c.n : c.n - 1, m = i1 - i0 + 1;
    const x = new Float64Array(m), y = new Float64Array(m);
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let k = 0; k < m; k++) {
      const i = i0 + k, real = i >= 0 && i < c.n;
      const p = real ? null : this.nodeAt(c, i);
      const vx = (x[k] = p ? p[0] : c.x[i]), vy = (y[k] = p ? p[1] : c.y[i]);
      if (vx < x0) x0 = vx; if (vx > x1) x1 = vx; if (vy < y0) y0 = vy; if (vy > y1) y1 = vy;
    }
    return { x, y, m, i0, x0, x1, y0, y1 };
  }

  private crossList(a: Cable, b: Cable, A = this.trace(a), B = this.trace(b)) {
    const out: Cross[] = [];
    if (A.x1 < B.x0 || B.x1 < A.x0 || A.y1 < B.y0 || B.y1 < A.y0) return out;
    for (let i = 0; i < A.m - 1; i++) {
      const ax = A.x[i], ay = A.y[i], bx = A.x[i + 1], by = A.y[i + 1];
      const x0 = Math.min(ax, bx), x1 = Math.max(ax, bx), y0 = Math.min(ay, by), y1 = Math.max(ay, by);
      if (x1 < B.x0 || x0 > B.x1 || y1 < B.y0 || y0 > B.y1) continue;
      const hits: (Cross & { u: number })[] = [];
      for (let j = 0; j < B.m - 1; j++) {
        const cx = B.x[j], cy = B.y[j], dx = B.x[j + 1], dy = B.y[j + 1];
        if ((cx < x0 && dx < x0) || (cx > x1 && dx > x1) || (cy < y0 && dy < y0) || (cy > y1 && dy > y1)) continue;
        if (!segX(ax, ay, bx, by, cx, cy, dx, dy)) continue;
        const rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy;
        const u = ((cx - ax) * sy - (cy - ay) * sx) / (rx * sy - ry * sx || 1e-6);
        hits.push({ i: i + A.i0, j: j + B.i0, x: ax + rx * u, y: ay + ry * u, u });
      }
      if (hits.length) out.push(...hits.sort((m, n) => m.u - n.u));
    }
    return out;
  }

  /** Undo the double crossing p..q. Whatever is held stays put and the other cable goes around it. */
  private resolve(a: Cable, b: Cable, p: Cross, q: Cross): boolean {
    let ha = false, hb = false;
    const j0 = Math.min(p.j, q.j), j1 = Math.max(p.j, q.j);
    for (let i = Math.max(0, p.i + 1); i <= Math.min(a.n - 1, q.i); i++) ha ||= !!a.pin[i];
    for (let j = Math.max(0, j0 + 1); j <= Math.min(b.n - 1, j1); j++) hb ||= !!b.pin[j];
    if (ha && hb) return false;
    if (!ha && !hb) this.swapArcs(a, p.i, q.i, b, p.j, q.j, p, q);
    else if (hb) this.goAround(a, p.i, q.i, b, p, q, p.j, q.j);
    else if (p.j <= q.j) this.goAround(b, p.j, q.j, a, p, q, p.i, q.i);
    else this.goAround(b, q.j, p.j, a, q, p, q.i, p.i);
    return true;
  }

  /** Lay nodes i0+1..i1 of `m` along the other (held) cable, just off it on the side `m` comes from. */
  private goAround(m: Cable, i0: number, i1: number, o: Cable, p: Cross, q: Cross, op: number, oq: number) {
    const P: number[][] = [[p.x, p.y]];
    if (oq >= op) for (let j = op + 1; j <= oq; j++) P.push(this.nodeAt(o, j)); else for (let j = op; j > oq; j--) P.push(this.nodeAt(o, j));
    P.push([q.x, q.y]);
    const from = this.nodeAt(m, i0), t = P[1];
    const side = Math.sign((t[0] - p.x) * (from[1] - p.y) - (t[1] - p.y) * (from[0] - p.x)) || 1;
    const N = i1 - i0;
    for (let k = 1; k <= N; k++) {
      const u = k / (N + 1), c = along(P, u), d = along(P, Math.min(1, u + 0.04)), e = along(P, Math.max(0, u - 0.04));
      const tx = d[0] - e[0], ty = d[1] - e[1], l = Math.hypot(tx, ty) || 1;
      const i = i0 + k;
      m.x[i] = m.px[i] = clamp(c[0] - (ty / l) * side * 12, 8, W - 8);
      m.y[i] = m.py[i] = clamp(c[1] + (tx / l) * side * 12, 8, FLOOR);
    }
  }

  private swapArcs(a: Cable, i0: number, i1: number, b: Cable, jp: number, jq: number, p: { x: number; y: number }, q: { x: number; y: number }) {
    const fwd = jq >= jp, j0 = Math.min(jp, jq), j1 = Math.max(jp, jq);
    const A: number[][] = [[p.x, p.y]], B: number[][] = [[p.x, p.y]];
    for (let i = i0 + 1; i <= i1; i++) A.push([a.x[i], a.y[i]]);
    if (fwd) for (let j = j0 + 1; j <= j1; j++) B.push([b.x[j], b.y[j]]);
    else for (let j = j1; j > j0; j--) B.push([b.x[j], b.y[j]]);
    A.push([q.x, q.y]); B.push([q.x, q.y]);
    const put = (c: Cable, i: number, pt: number[]) => { c.x[i] = c.px[i] = pt[0]; c.y[i] = c.py[i] = pt[1]; };
    const na = i1 - i0, nb = j1 - j0;
    for (let k = 1; k <= na; k++) put(a, i0 + k, along(B, k / (na + 1)));
    for (let k = 1; k <= nb; k++) put(b, fwd ? j0 + k : j1 + 1 - k, along(A, k / (nb + 1)));
  }
  private braids: Uint8Array;

  private computePins() {
    this.PIN.fill(0);
    for (const c of this.cables) {
      for (const e of c.ends) {
        if (e.port) { c.pin[c.endIdx(e.which)] = 1; c.pin[c.innerIdx(e.which)] = 1; }
      }
    }
    const g = this.grab;
    if (g?.kind === 'plug' && g.end && !g.latch) g.end.cable.pin[g.end.cable.endIdx(g.end.which)] = 1;
    if (g?.kind === 'cable' && g.cable && g.idx !== undefined && !g.hold) g.cable.pin[g.idx] = 1;
    for (const t of this.ties) if (t.t >= 1) for (const e of t.entries) if ((e.t ?? 1) >= 1) e.cable.pin[e.idx] = 1;
  }

  private integrate(h: number) {
    const { X, Y, PX, PY, PIN, ptC, sleep } = this;
    const g = GRAV * h * h;
    const MAXV = 30;
    for (let k = 0; k < this.total; k++) {
      if (PIN[k] || sleep[ptC[k]]) { PX[k] = X[k]; PY[k] = Y[k]; continue; }
      let vx = X[k] - PX[k], vy = Y[k] - PY[k];
      const v = Math.hypot(vx, vy);
      const damp = v < LOW_V ? LOW_DAMP : DAMP;
      vx *= damp; vy *= damp;
      if (v > MAXV) { vx *= MAXV / v; vy *= MAXV / v; }
      PX[k] = X[k]; PY[k] = Y[k];
      X[k] += vx; Y[k] += vy + g;
    }
  }

  /** Sweeps alternate direction so tension spreads evenly instead of drifting towards one end. */
  private solveDist(back: boolean) {
    const IM = this.IM;
    for (const c of this.cables) {
      if (this.sleep[c.id]) continue;
      const { x, y, pin, len, o } = c;
      for (let q = 0; q < c.n - 1; q++) {
        const i = back ? c.n - 2 - q : q;
        const dx = x[i + 1] - x[i], dy = y[i + 1] - y[i];
        const d = Math.hypot(dx, dy) || 0.0001;
        const w1 = pin[i] ? 0 : IM[o + i], w2 = pin[i + 1] ? 0 : IM[o + i + 1];
        const ws = w1 + w2;
        if (!ws) continue;
        const k = (d - len[i]) / d / ws;
        x[i] += dx * k * w1; y[i] += dy * k * w1;
        x[i + 1] -= dx * k * w2; y[i + 1] -= dy * k * w2;
      }
    }
  }

  /**
   * Long-range tethers: no node may be further from a held node than the cable between them is
   * long. Keeps fast drags taut instead of rubbery without extra iterations.
   */
  private tether() {
    for (const c of this.cables) {
      if (this.sleep[c.id]) continue;
      const { x, y, pin, cum } = c;
      for (let p = 0; p < c.n; p++) {
        if (!pin[p]) continue;
        for (const s of [-1, 1]) for (let i = p + s; i >= 0 && i < c.n && !pin[i]; i += s) {
          const max = Math.abs(cum[i] - cum[p]) * 1.01;
          const dx = x[i] - x[p], dy = y[i] - y[p], d = Math.hypot(dx, dy);
          if (d > max) { x[i] = x[p] + (dx / d) * max; y[i] = y[p] + (dy / d) * max; }
        }
      }
    }
  }

  private solveBend() {
    for (const c of this.cables) {
      if (this.sleep[c.id]) continue;
      const { x, y, pin } = c;
      const cum = c.cum;
      for (let i = 0; i < c.n - 2; i++) {
        const dx = x[i + 2] - x[i], dy = y[i + 2] - y[i];
        const d = Math.hypot(dx, dy) || 0.0001;
        const min = (cum[i + 2] - cum[i]) * 0.91;
        if (d >= min) continue;
        const w1 = pin[i] ? 0 : 1, w2 = pin[i + 2] ? 0 : 1;
        const ws = w1 + w2;
        if (!ws) continue;
        const k = ((d - min) / d / ws) * 0.5;
        x[i] += dx * k * w1; y[i] += dy * k * w1;
        x[i + 2] -= dx * k * w2; y[i + 2] -= dy * k * w2;
      }
      for (let i = 0; i < c.n - 4; i++) {
        const dx = x[i + 4] - x[i], dy = y[i + 4] - y[i];
        const d = Math.hypot(dx, dy) || 0.0001;
        const min4 = (cum[i + 4] - cum[i]) * 0.875;
        if (d >= min4) continue;
        const w1 = pin[i] ? 0 : 1, w2 = pin[i + 4] ? 0 : 1;
        const ws = w1 + w2;
        if (!ws) continue;
        const k = ((d - min4) / d / ws) * BEND2;
        x[i] += dx * k * w1; y[i] += dy * k * w1;
        x[i + 4] -= dx * k * w2; y[i + 4] -= dy * k * w2;
      }
    }
  }

  private repel() {
    const { X, Y, PX, PY, PIN, grid, next, ptC, sleep } = this;
    grid.fill(-1);
    for (let k = 0; k < this.total; k++) {
      const cx = Math.min(GC - 1, Math.max(0, (X[k] / CELL) | 0));
      const cy = Math.min(GR - 1, Math.max(0, (Y[k] / CELL) | 0));
      const cell = cx + cy * GC;
      next[k] = grid[cell];
      grid[cell] = k;
    }
    const R2 = REP_R * REP_R;
    // cables sharing a duct are already in ordered lanes: let them slip past each other so a
    // crossing made while they were being laid pulls out as they go taut
    const gb = this.grab;
    let up = null as Cable | null, u0 = 0, u1 = -1;
    if (gb?.kind === 'cable' && gb.cable && !gb.hold && gb.moved) { up = gb.cable; u0 = gb.idx! - LIFT; u1 = gb.idx! + LIFT; }
    else if (gb?.kind === 'plug' && gb.end && !gb.latch) { up = gb.end.cable; if (gb.end.which === 0) u1 = LIFT; else { u0 = up.n - 1 - LIFT; u1 = up.n; } }
    if (up) { u0 += up.o; u1 = Math.min(u1 + up.o, up.o + up.n - 1); u0 = Math.max(u0, up.o); }
    const lane = this.laneOf.fill(0);
    this.ducts.forEach((d, i) => { for (const e of d.st[0].entries) lane[e.cable.id] = i + 1; });
    for (let k = 0; k < this.total; k++) {
      const cx = Math.min(GC - 1, Math.max(0, (X[k] / CELL) | 0));
      const cy = Math.min(GR - 1, Math.max(0, (Y[k] / CELL) | 0));
      for (let oy = -1; oy <= 1; oy++) {
        const yy = cy + oy;
        if (yy < 0 || yy >= GR) continue;
        for (let ox = -1; ox <= 1; ox++) {
          const xx = cx + ox;
          if (xx < 0 || xx >= GC) continue;
          for (let j = grid[xx + yy * GC]; j !== -1; j = next[j]) {
            if (j <= k) continue;
            if (ptC[j] === ptC[k]) continue; // a cable may pass over itself (no permanent knots)
            const dx = X[j] - X[k], dy = Y[j] - Y[k];
            const d2 = dx * dx + dy * dy;
            if (d2 >= R2 || d2 < 1e-6) continue;
            const dl = lane[ptC[k]];
            if (dl && dl === lane[ptC[j]]) continue;
            // the part in the player's hand passes over the rest instead of snagging on it
            if (up && ((k >= u0 && k <= u1) || (j >= u0 && j <= u1))) continue;
            this.union(ptC[k], ptC[j]);
            const sk = sleep[ptC[k]], sj = sleep[ptC[j]];
            if (sk && sj) continue;
            // sleeping cables act as static colliders (weight 0); see wakeByContact()
            const w1 = PIN[k] || sleep[ptC[k]] ? 0 : 1, w2 = PIN[j] || sleep[ptC[j]] ? 0 : 1;
            const ws = w1 + w2;
            if (!ws) continue;
            const d = Math.sqrt(d2);
            const f = ((REP_R - d) / d) * 0.55 / ws;
            X[k] -= dx * f * w1; Y[k] -= dy * f * w1;
            X[j] += dx * f * w2; Y[j] += dy * f * w2;
            // contact friction: remove (part of) the relative tangential slide this substep, so a
            // cable draped over another one comes to rest instead of creeping off it for seconds
            const nx = dx / d, ny = dy / d;
            const rx = (X[j] - PX[j]) - (X[k] - PX[k]), ry = (Y[j] - PY[j]) - (Y[k] - PY[k]);
            const rn = rx * nx + ry * ny;
            const tx = rx - rn * nx, ty = ry - rn * ny;
            const tl = Math.hypot(tx, ty);
            if (tl > 1e-6) {
              const c = (tl < CAB_STATIC ? 1 : CAB_KINETIC) / ws;
              X[k] += tx * c * w1; Y[k] += ty * c * w1;
              X[j] -= tx * c * w2; Y[j] -= ty * c * w2;
            }
          }
        }
      }
    }
  }

  private applyPins() {
    for (const c of this.cables) {
      for (const e of c.ends) {
        if (!e.port) continue;
        const a = portAnchor(e.port), b = portAnchor(e.port, SEG);
        const i = c.endIdx(e.which), j = c.innerIdx(e.which);
        c.x[i] = a.x; c.y[i] = a.y; c.x[j] = b.x; c.y[j] = b.y;
      }
    }
    const g = this.grab;
    if (g?.kind === 'plug' && g.end && !g.latch) {
      const c = g.end.cable, i = c.endIdx(g.end.which), j = c.innerIdx(g.end.which);
      let t = { x: clamp(g.x - g.ox, 8, W - 8), y: clamp(g.y - g.oy, 8, FLOOR) };
      const p = this.hoverPort;
      if (p && g.avoid !== p) {
        // magnet: the head is drawn towards the socket and turns to face it
        const a = portAnchor(p, 9), b = portAnchor(p, 9 + SEG);
        const m = this.magnet(p, t);
        t = { x: t.x + (a.x - t.x) * m, y: t.y + (a.y - t.y) * m };
        c.x[j] += (b.x - c.x[j]) * m * 0.6; c.y[j] += (b.y - c.y[j]) * m * 0.6;
      }
      t = this.reach(c, i, t.x, t.y, true);
      c.x[i] = t.x; c.y[i] = t.y;
    } else if (g?.kind === 'cable' && g.cable && g.idx !== undefined && !g.hold) {
      const t = this.reach(g.cable, g.idx, clamp(g.x - g.ox, 8, W - 8), clamp(g.y - g.oy, 8, FLOOR), true);
      g.cable.x[g.idx] = t.x; g.cable.y[g.idx] = t.y;
    } else if (g?.kind === 'tie' && g.tie && g.moved) {
      const t = g.tie;
      let x = clamp(g.x - g.ox, 20, W - 20), y = clamp(g.y - g.oy, 20, FLOOR - 10);
      for (let pass = 0; pass < 2; pass++) for (const e of t.entries) {
        const ex = x + t.nx * e.off, ey = y + t.ny * e.off;
        const r = this.reach(e.cable, e.idx, ex, ey, false);
        x += r.x - ex; y += r.y - ey;
      }
      t.x = x; t.y = y;
    }
    for (const t of this.ties) {
      for (const e of t.entries) {
        const a = Math.min(t.t, e.t ?? 1), k = a >= 1 ? 1 : 0.25 * a;
        const tx = t.x + t.nx * e.off, ty = t.y + t.ny * e.off;
        e.cable.x[e.idx] += (tx - e.cable.x[e.idx]) * k;
        e.cable.y[e.idx] += (ty - e.cable.y[e.idx]) * k;
      }
    }
    // whatever a closed duct swallowed stays inside it
    for (const d of this.ducts) if (d.lid >= 1) for (const e of d.st[0].entries) {
      const c = e.cable, o = d.st[2].entries.find((q) => q.cable === c);
      if (!o) continue;
      for (let i = Math.min(e.idx, o.idx); i <= Math.max(e.idx, o.idx); i++) {
        c.x[i] = clamp(c.x[i], d.x + 10, d.x + d.w - 10);
        c.y[i] = clamp(c.y[i], d.y + 8, d.y + d.h - 8);
      }
    }
  }

  private magnet(p: Port, t: { x: number; y: number }) {
    const a = portAnchor(p, 9);
    const k = clamp(1 - Math.hypot(t.x - a.x, t.y - a.y) / SNAP_R, 0, 1);
    return Math.min(0.92, k * 1.3);
  }

  /**
   * Cables don't stretch: limit where node i can be dragged to, given the nearest held nodes on
   * both sides. The excess is remembered (creak sound, and reels pay cable out).
   */
  private reach(c: Cable, i: number, x: number, y: number, grab: boolean) {
    let over = 0;
    for (let pass = 0; pass < 3; pass++) for (const s of [-1, 1]) {
      let j = i + s;
      while (j >= 0 && j < c.n && !c.pin[j]) j += s;
      if (j < 0 || j >= c.n) continue;
      const max = Math.abs(c.cum[j] - c.cum[i]) * 1.005;
      const dx = x - c.x[j], dy = y - c.y[j], d = Math.hypot(dx, dy);
      if (d <= max) continue;
      over = Math.max(over, d - max);
      x = c.x[j] + (dx / d) * max; y = c.y[j] + (dy / d) * max;
    }
    if (grab && this.grab) this.grab.over = over;
    return { x, y };
  }

  private bounds() {
    const { X, Y, PX, PIN, ptC, sleep } = this;
    for (let k = 0; k < this.total; k++) {
      if (sleep[ptC[k]]) continue;
      if (X[k] < 6) X[k] = 6; else if (X[k] > W - 6) X[k] = W - 6;
      if (Y[k] < 6) Y[k] = 6;
      else if (Y[k] >= FLOOR) {
        Y[k] = FLOOR;
        const vx = X[k] - PX[k];
        // Position-based friction. Static: a node resting on the floor that would slide less than
        // FLOOR_STATIC this substep is put back where it was (stops slow creep / rolling coils that
        // the constraint projection would otherwise push along forever). Kinetic: keep 40% of a slide.
        if (PIN[k]) continue; // the grabbed node always follows the pointer
        if (Math.abs(vx) < FLOOR_STATIC) X[k] = PX[k];
        else PX[k] = X[k] - vx * 0.4;
      }
    }
  }

  // ---------------------------------------------------------------- queries
  plugGeom(e: End) {
    const c = e.cable, i = c.endIdx(e.which), j = c.innerIdx(e.which);
    let dx = c.x[i] - c.x[j], dy = c.y[i] - c.y[j];
    const d = Math.hypot(dx, dy) || 1;
    dx /= d; dy /= d;
    if (e.port) { dx = 0; dy = -e.port.dir; }
    return {
      ex: c.x[i], ey: c.y[i], dx, dy,
      tx: c.x[i] + dx * PLUG_LEN, ty: c.y[i] + dy * PLUG_LEN,
      cx: c.x[i] + dx * PLUG_LEN * 0.5, cy: c.y[i] + dy * PLUG_LEN * 0.5,
    };
  }

  isGrabbed(c: Cable) {
    const g = this.grab;
    return !!g && (g.cable === c || g.end?.cable === c);
  }

  ledState(p: Port): 'off' | 'green' | 'amber' | 'red' {
    if (!p.end) return 'off';
    const c = p.end.cable;
    if (c.color !== p.color) return 'red';
    return c.valid() ? 'green' : 'amber';
  }

  connectedCount() { return this.cables.filter((c) => c.valid()).length; }

  // ---------------------------------------------------------------- input
  private distSeg(x: number, y: number, ax: number, ay: number, bx: number, by: number) {
    const vx = bx - ax, vy = by - ay;
    const k = clamp(((x - ax) * vx + (y - ay) * vy) / (vx * vx + vy * vy || 1), 0, 1);
    return Math.hypot(x - ax - vx * k, y - ay - vy * k);
  }

  private inClosedDuct(x: number, y: number, my = 4) {
    return this.ducts.find((d) => d.lid >= 1 && x > d.x - 6 && x < d.x + d.w + 6 && y > d.y - my && y < d.y + d.h + my) ?? null;
  }

  lidHandle(d: Duct) { return { x: d.x + d.w / 2, y: d.y + d.h * d.lid - (d.lid < 0.05 ? 16 : 0) }; }

  /** What a press at (x, y) would grab. Plug heads get a big, forgiving radius and go first. */
  pick(x: number, y: number, r = GRAB_R): Pick | null {
    let bestE: End | null = null, bs = Infinity, plugD = 0;
    for (const c of this.cables) for (const e of c.ends) {
      const g = this.plugGeom(e);
      const d = this.distSeg(x, y, g.ex - g.dx * 14, g.ey - g.dy * 14, g.tx, g.ty);
      if (d > r) continue;
      // when several heads are in reach, prefer the ones the player most likely wants
      const score = d + (!e.port ? -8 : c.valid() ? 8 : e.port.color === c.color ? 4 : -3);
      if (score < bs) { bs = score; bestE = e; plugD = d; }
    }
    let bc: Cable | null = null, bi = -1, bd = 24;
    const hidden = this.inClosedDuct(x, y);
    if (!hidden) for (const c of this.order) for (let i = 2; i < c.n - 2; i++) {
      const d = Math.hypot(c.x[i] - x, c.y[i] - y);
      if (d <= bd) { bd = d; bc = c; bi = i; }
    }
    for (const d of this.ducts) {
      if (d.lid >= 1) continue;
      const h = this.lidHandle(d);
      if (Math.hypot(h.x - x, h.y - y) < 28 && plugD === 0) return { kind: 'lid', duct: d };
    }
    if (hidden && !bestE) return { kind: 'lid', duct: hidden };
    for (const rl of this.reels) {
      const c = rl.cable;
      if (Math.hypot(c.x[rl.idx] - x, c.y[rl.idx] - y) < REEL_R + 8 && plugD + (bestE ? 0 : 99) > 14) return { kind: 'reel', reel: rl };
    }
    for (const t of this.ties) {
      if (t.kind === 'hook' || t.kind === 'duct') continue;
      if (t.run && t !== t.run.stations[0] && t !== t.run.stations[t.run.stations.length - 1]) continue;
      if (Math.hypot(t.x - x, t.y - y) < 24 && plugD + (bestE ? 0 : 99) > 14) return { kind: 'tie', tie: t };
    }
    // a cord right under the pointer wins over a head that is merely nearby
    if (bestE && !(bc && bd < 7 && plugD > 26)) return { kind: 'plug', end: bestE };
    if (bc) return { kind: 'cable', cable: bc, idx: bi };
    return null;
  }

  /** Returns true when a drag / stroke started. `tool` !== 'hand' for stroke tools. */
  pointerDown(x: number, y: number, tool: ToolId = 'hand', opts: { r?: number; touch?: boolean } = {}): boolean {
    this.pointer = { x, y };
    if (this.power >= 0) return false;
    const base = { ox: 0, oy: 0, x, y, sx: x, sy: y, moved: false, t: 0, over: 0, touch: !!opts.touch };
    if (tool === 'air') { this.grab = { kind: 'air', ...base }; return true; }
    if (tool === 'screw') {
      const p = this.screwAt(x, y);
      if (p) { this.grab = { kind: 'screw', port: p, ...base }; return true; }
    }
    if (tool === 'comb' || tool === 'wrap') {
      const run = this.startRun(tool, x, y);
      if (run) { this.wakeAll(); this.grab = { kind: 'run', run, ...base }; return true; }
    }
    this.wakeAll();
    const k = this.pick(x, y, opts.r);
    this.hover = null;
    if (!k) return false;
    switch (k.kind) {
      case 'plug': {
        const c = k.end.cable, i = c.endIdx(k.end.which);
        this.grab = { kind: 'plug', end: k.end, latch: k.end.port ?? undefined, ...base, ox: x - c.x[i], oy: y - c.y[i] };
        this.raise(c);
        this.onEvent({ type: 'grab' });
        return true;
      }
      case 'cable': {
        let idx = k.idx, hold: Hook | Duct | undefined;
        for (const h of this.hooks) for (const e of h.tie.entries) {
          if (e.cable === k.cable && Math.abs(e.idx - idx) <= 2) { hold = h; idx = e.idx; }
        }
        for (const d of this.ducts) {
          const es = d.st.map((t) => t.entries.find((e) => e.cable === k.cable));
          if (es[0] && es[2] && idx >= Math.min(es[0].idx, es[2].idx) - 1 && idx <= Math.max(es[0].idx, es[2].idx) + 1) hold = d;
        }
        // a cord that was combed is pulled out of the comb by grabbing it
        this.grab = { kind: 'cable', cable: k.cable, idx, hold, ...base, ox: x - k.cable.x[idx], oy: y - k.cable.y[idx] };
        this.raise(k.cable);
        this.onEvent({ type: 'grab' });
        return true;
      }
      case 'tie':
        this.grab = { kind: 'tie', tie: k.tie, ...base, ox: x - k.tie.x, oy: y - k.tie.y };
        return true;
      case 'reel': this.grab = { kind: 'reel', reel: k.reel, ...base }; return true;
      case 'lid': this.grab = { kind: 'lid', duct: k.duct, ...base }; return true;
    }
  }

  pointerMove(x: number, y: number, r?: number) {
    this.pointer = { x, y };
    const g = this.grab;
    if (!g) { this.hover = this.power >= 0 ? null : this.pick(x, y, r); return; }
    g.x = x; g.y = y;
    const pull = Math.hypot(x - g.sx, y - g.sy);
    if (pull > 8) g.moved = true;
    switch (g.kind) {
      case 'plug': this.movePlug(g, pull); break;
      case 'cable':
        if (g.hold && pull > 22) { this.release(g.hold, g.cable!); g.hold = undefined; }
        break;
      case 'lid': this.moveLid(g); break;
      case 'run': this.extendRun(g.run!, x, y); break;
      case 'screw': {
        const p = this.screwAt(x, y);
        if (p) g.port = p;
        break;
      }
    }
  }

  private movePlug(g: Grab, pull: number) {
    const e = g.end!, c = e.cable;
    if (g.latch) {
      const p = g.latch;
      const outward = Math.max(0, (g.y - g.sy) * p.dir);
      p.out = Math.min(7, outward * 0.35 + pull * 0.08); // rubbery resistance before the pop
      this.wake(c);
      if (pull < (p.tight >= 1 ? PULL_TIGHT : PULL)) return;
      p.end = null; e.port = null; p.out = 0; p.tight = 0;
      g.latch = undefined; g.avoid = p;
      this.fx.push({ x: p.x, y: p.y + p.dir * 4, t: 0.3, color: '#ffffff', kind: 'ring' });
      this.burst(p.x, p.y + p.dir * 4, 5, '#ffe9a8', 70, 0, p.dir * 40);
      this.onEvent({ type: 'unplug' });
      this.refreshAll();
    }
    const rx = clamp(g.x - g.ox, 8, W - 8), ry = clamp(g.y - g.oy, 8, FLOOR);
    if (g.avoid) {
      const a = portAnchor(g.avoid);
      if (Math.hypot(rx - a.x, ry - a.y) > SNAP_R + 6) g.avoid = undefined;
    }
    let best: Port | null = null, bs = SNAP_R;
    for (const p of this.ports) {
      const occ = p.end?.cable;
      if (occ && (occ.color === p.color || p.color !== c.color)) continue; // only swap out a wrong cable for a right one
      if (p === g.avoid && p.color !== c.color) continue;
      const other = c.ends[1 - e.which].port;
      const a = portAnchor(p, 6);
      const d = Math.min(Math.hypot(rx - a.x, ry - a.y), Math.hypot(g.x - p.x, g.y - p.y) + 4);
      if (d > SNAP_R) continue;
      const match = p.color === c.color && !(other && other.side === p.side);
      const score = d - (match ? 16 : 0) + (occ ? 6 : 0);
      if (score < bs) { bs = score; best = p; }
    }
    if (best && best !== this.hoverPort) this.onEvent({ type: 'magnet' });
    this.hoverPort = best;
  }

  private moveLid(g: Grab) {
    const d = g.duct!;
    if (d.lid >= 1 || !d.st[0].entries.length) return;
    const k = clamp((g.y - d.y) / d.h, 0, 1);
    if (k <= d.lid || k - d.lid > 0.5 || Math.abs(g.x - d.x - d.w / 2) > d.w + 50) return;
    if (Math.floor(k * 10) > Math.floor(d.lid * 10)) {
      this.onEvent({ type: 'lid', k });
      for (const s of [-1, 1]) this.bits.push(bit(d.x + d.w / 2 + (s * d.w) / 2, d.y + d.h * k, s * 60, -30, 3, 3, '#ffffff', 0.3, 200));
    }
    d.lid = k;
    if (k > 0.96) {
      d.lid = 1; d.shine = 1;
      this.onEvent({ type: 'lidDone' });
      this.sparkle(d.x + d.w / 2, d.y + d.h / 2, d.w, d.h);
    }
  }

  pointerUp() {
    const g = this.grab;
    this.grab = null;
    if (!g) return;
    this.wakeAll();
    const tap = !g.moved && g.t < 0.35;
    if (tap && this.allGood && (g.kind === 'cable' || (g.kind === 'plug' && g.latch)) && this.flick(g.x, g.y)) { this.hoverPort = null; return; }
    if (g.kind === 'plug' && g.end) {
      if (g.latch) g.latch.out = Math.max(g.latch.out, 0.01);
      else if (this.hoverPort) this.plugIn(g.end, this.hoverPort);
    } else if (g.kind === 'cable' && g.cable && g.idx !== undefined && !g.hold && g.moved) this.tryFixture(g.cable, g.idx);
    else if (g.kind === 'tie' && g.tie && tap) this.tapTie(g.tie);
    else if (g.kind === 'reel' && g.reel && tap) this.tapReel(g.reel);
    else if (g.kind === 'lid' && g.duct && tap && g.duct.lid >= 1) { g.duct.lid = 0; this.onEvent({ type: 'lidOpen' }); }
    else if (g.kind === 'run' && g.run) this.endRun(g.run);
    this.hoverPort = null;
  }

  /** Abort the current grab without any release effect (used when a tap belongs to a tool). */
  cancelGrab() {
    if (this.grab?.latch) this.grab.latch.out = Math.max(this.grab.latch.out, 0.01);
    this.grab = null; this.hoverPort = null;
  }

  private plugIn(e: End, p: Port) {
    const c = e.cable;
    if (p.end) { // swap: the wrong cable pops out
      const o = p.end, i = o.cable.endIdx(o.which);
      o.port = null; p.end = null;
      o.cable.x[i] += (o.cable.x[i] < W / 2 ? -1 : 1) * 22; o.cable.y[i] += p.dir * 16;
      o.cable.px[i] = o.cable.x[i]; o.cable.py[i] = o.cable.y[i] - p.dir * 8;
      this.onEvent({ type: 'eject' });
    }
    p.end = e; e.port = p; p.pulse = 1; p.out = 12; p.tight = 0;
    const colorMatch = p.color === c.color, done = c.valid();
    this.fx.push({ x: p.x, y: p.y, t: 0, color: colorMatch ? '#7dffb0' : '#ff8a8a', kind: 'ring', glyph: colorMatch ? 'ok' : 'bad' });
    if (done) {
      this.fx.push({ x: p.x, y: p.y, t: 0, color: '#fff3a8', kind: 'spark' });
      this.pulses.push({ cable: c, t: 0, dur: 0.7, from: e.which, strong: true, delay: 0.1 });
    }
    this.onEvent({ type: 'snap', colorMatch, cableDone: done });
    this.refreshAll();
  }

  private raise(c: Cable) {
    this.order = this.order.filter((o) => o !== c);
    this.order.push(c);
  }

  private refreshAll() {
    const good = this.cables.every((c) => c.valid());
    const was = this.allGood;
    this.allGood = good;
    this.relayout();
    if (good && !was) this.onEvent({ type: 'allgood' });
    if (!good && was) this.onEvent({ type: 'broken' });
  }

  // ---------------------------------------------------------------- per-frame extras
  private animate(dt: number) {
    for (const t of this.ties) for (const e of t.entries) if (e.t !== undefined && e.t < 1) e.t = Math.min(1, e.t + dt * 5);
    for (const p of this.ports) if (p.out > 0 && this.grab?.latch !== p) {
      p.out *= Math.exp(-dt * 26);
      if (p.out < 0.05) p.out = 0;
      if (p.end) this.wake(p.end.cable);
    }
    for (const c of this.cables) if (c.label > 0) c.label = Math.min(1, c.label + dt * 2.2);
    for (const r of this.reels) r.pop = Math.max(0, r.pop - dt * 3);
    for (const d of this.ducts) d.shine = Math.max(0, d.shine - dt * 0.9);
    for (const b of this.bits) { b.t += dt; b.vy += b.g * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.rot += b.vr * dt; }
    if (this.bits.length) this.bits = this.bits.filter((b) => b.t < b.life);
    for (const d of this.dust) if (d.gone) { d.x += d.vx * dt; d.y += d.vy * dt; d.vx *= 0.96; d.vy = d.vy * 0.96 - 60 * dt; d.r += dt * 14; d.a -= dt * 1.5; }
    if (this.dust.some((d) => d.a <= 0)) this.dust = this.dust.filter((d) => d.a > 0);
    for (const p of this.pulses) { if (p.delay > 0) p.delay -= dt; else p.t += dt / p.dur; }
    if (this.pulses.length) this.pulses = this.pulses.filter((p) => p.t < 1);
    if (this.power >= 0) {
      this.power += dt;
      while (this.powerQueue.length && this.powerQueue[0].at <= this.power) {
        const q = this.powerQueue.shift()!;
        this.pulses.push({ cable: q.cable, t: 0, dur: 0.6, from: q.cable.ends[0].port?.side === 'A' ? 0 : 1, strong: true, delay: 0 });
        this.onEvent({ type: 'pulse', i: q.i });
        if (!this.powerQueue.length) this.powerEnd = this.power + 1;
      }
      if (this.powerEnd > 0 && this.power > this.powerEnd) { this.powerEnd = -1; this.onEvent({ type: 'powered' }); }
    } else if (this.time > this.nextAmbient) {
      // working links carry a little traffic
      this.nextAmbient = this.time + 1.1;
      const ok = this.cables.filter((c) => c.valid());
      if (ok.length) {
        const c = ok[Math.floor(this.time * 7.3) % ok.length];
        this.pulses.push({ cable: c, t: 0, dur: 1.3, from: Math.floor(this.time) % 2 ? 1 : 0, strong: false, delay: 0 });
      }
    }
  }
  private powerEnd = -1;

  /** Throw the main switch: light runs through every cable in turn, then 'powered' fires. */
  powerOn() {
    this.cancelGrab();
    this.power = 0; this.powerEnd = -1; this.hover = null;
    const key = (c: Cable) => (c.ends[0].port?.side === 'A' ? c.ends[0].port.x : c.ends[1].port?.x ?? 0);
    const gap = Math.min(0.17, 1.5 / this.cables.length);
    this.powerQueue = [...this.cables].sort((a, b) => key(a) - key(b)).map((cable, i) => ({ at: 0.45 + i * gap, cable, i }));
  }

  private updateGrab(dt: number) {
    const g = this.grab;
    if (!g) return;
    g.t += dt;
    if ((g.kind === 'plug' && !g.latch && g.moved) || (g.kind === 'cable' && !g.hold)) {
      // the grabbed point glides under the pointer (and above the finger on touch, so you can see it)
      const oy = g.touch && g.kind === 'plug' ? 38 : 0;
      g.ox += (0 - g.ox) * 0.16; g.oy += (oy - g.oy) * 0.16;
    }
    if (g.over > 3 && (g.kind === 'plug' || g.kind === 'cable')) {
      const c = g.end?.cable ?? g.cable!;
      const at = g.end ? c.endIdx(g.end.which) : g.idx!;
      if (g.over > 10 && this.unzipComb(c, at)) { /* peeled out of the comb one tooth at a time */ }
      else if (c.wound > 0) { // a reel pays out like a retractable cord
        this.setWound(c, c.wound - Math.min(14, g.over));
        for (const r of this.reels) if (r.cable === c) { r.spin -= 0.25; r.tight = false; }
        if (this.frame % 4 === 0) this.onEvent({ type: 'payout' });
      } else if (g.over > 26 && g.t - this.lastStrain > 0.9) { this.lastStrain = g.t; this.onEvent({ type: 'strain' }); }
    } else if (g.t < 0.05) this.lastStrain = -1;
    if (g.kind === 'reel' && g.reel && g.t > 0.16) this.wind(g.reel, dt);
    if (g.kind === 'run' && g.run && g.moved) this.extendRun(g.run, g.x, g.y);
    if (g.kind === 'air') this.blow(g.x, g.y, dt);
    if (g.kind === 'screw' && g.port) {
      const p = g.port;
      if (p.end && p.tight < 1 && Math.hypot(p.x - g.x, p.y - g.y) < 44) {
        const k0 = Math.floor(p.tight * 9);
        p.tight = Math.min(1, p.tight + dt * 1.5);
        if (Math.floor(p.tight * 9) > k0) this.onEvent({ type: 'screw', k: p.tight });
        if (p.tight >= 1) {
          this.fx.push({ x: p.x, y: p.y, t: 0, color: '#ffe9a8', kind: 'ring' });
          this.burst(p.x, p.y, 6, '#e9eef5', 90, 0, 0);
          this.onEvent({ type: 'screwDone' });
        }
      }
    }
  }
  private lastStrain = -1;

  private burst(x: number, y: number, n: number, color: string, v: number, bx: number, by: number) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, q = v * (0.4 + Math.random() * 0.8);
      this.bits.push(bit(x, y, Math.cos(a) * q + bx, Math.sin(a) * q + by, 3, 3, color, 0.35 + Math.random() * 0.3, 260));
    }
  }

  private sparkle(x: number, y: number, w: number, h: number) {
    for (let i = 0; i < 14; i++) {
      this.bits.push(bit(x + (Math.random() - 0.5) * w, y + (Math.random() - 0.5) * h, (Math.random() - 0.5) * 60, -40 - Math.random() * 60, 4, 4, '#fff3a8', 0.6 + Math.random() * 0.4, 40));
    }
  }

  /** Render between two physics steps (for displays faster than 60 Hz). */
  interpolated(alpha: number, draw: () => void) {
    const { X, Y, FX, FY } = this;
    const sx = X.slice(), sy = Y.slice();
    for (let k = 0; k < this.total; k++) { X[k] = FX[k] + (sx[k] - FX[k]) * alpha; Y[k] = FY[k] + (sy[k] - FY[k]) * alpha; }
    draw();
    X.set(sx); Y.set(sy);
  }

  // ---------------------------------------------------------------- tools
  private use(t: ToolId) { if (this.left[t] < UNLIMITED) this.left[t]--; }
  private giveBack(t: ToolId) { if (this.left[t] < UNLIMITED) this.left[t]++; }
  private toast(text: string) { this.onEvent({ type: 'toast', text }); return false; }

  /** One-tap tools. Returns true if something happened. */
  useTool(tool: ToolId, x: number, y: number): boolean {
    switch (tool) {
      case 'zip': case 'velcro': return this.placeTie(x, y, tool);
      case 'reel': return this.placeReel(x, y);
      case 'label': return this.placeLabel(x, y);
      default: return false;
    }
  }

  private nearby(x: number, y: number, rad: number, margin: number) {
    const out: { cable: Cable; idx: number; d: number }[] = [];
    for (const c of this.cables) {
      let bi = -1, bd = rad;
      for (let i = margin; i < c.n - margin; i++) {
        const d = Math.hypot(c.x[i] - x, c.y[i] - y);
        if (d < bd) { bd = d; bi = i; }
      }
      if (bi < 0) continue;
      const clash = this.ties.some((t) => t.kind !== 'comb' && t.entries.some((e) => e.cable === c && Math.abs(e.idx - bi) < (t.kind === 'zip' || t.kind === 'velcro' ? 5 : 3)));
      if (!clash) out.push({ cable: c, idx: bi, d: bd });
    }
    return out;
  }

  /** Biggest (then closest) same-colour group of at least two. */
  private sameColor(cands: { cable: Cable; idx: number; d: number }[]) {
    const groups = new Map<ColorKey, typeof cands>();
    for (const c of cands) groups.set(c.cable.color, [...(groups.get(c.cable.color) ?? []), c]);
    let chosen: typeof cands | null = null;
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      if (!chosen || g.length > chosen.length ||
        (g.length === chosen.length && g.reduce((s, e) => s + e.d, 0) < chosen.reduce((s, e) => s + e.d, 0))) chosen = g;
    }
    return chosen;
  }

  /** Average position, common direction, and the cables sorted side by side. */
  private frameOf(chosen: { cable: Cable; idx: number }[]) {
    let tx = 0, ty = 0, cx = 0, cy = 0, rx = 0, ry = 0;
    chosen.forEach((e, k) => {
      const c = e.cable, i = e.idx;
      let dx = c.x[i + 1] - c.x[i - 1], dy = c.y[i + 1] - c.y[i - 1];
      const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      if (k === 0) { rx = dx; ry = dy; } else if (dx * rx + dy * ry < 0) { dx = -dx; dy = -dy; }
      tx += dx; ty += dy; cx += c.x[i]; cy += c.y[i];
    });
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl; ty /= tl; cx /= chosen.length; cy /= chosen.length;
    const nx = -ty, ny = tx;
    const side = (e: { cable: Cable; idx: number }) => (e.cable.x[e.idx] - cx) * nx + (e.cable.y[e.idx] - cy) * ny;
    return { cx, cy, nx, ny, tx, ty, sorted: [...chosen].sort((a, b) => side(a) - side(b)) };
  }

  placeTie(x: number, y: number, kind: 'zip' | 'velcro' = 'zip'): boolean {
    const cands = this.nearby(x, y, kind === 'zip' ? GATHER_R : TIE_R + 18, 3);
    const chosen = kind === 'zip' ? this.sameColor(cands) : cands.length >= 2 ? cands : null;
    if (this.extendTie(x, y, kind, cands)) return true;
    if (this.left[kind] <= 0) return this.toast(kind === 'zip' ? 'No cable ties left.' : 'No velcro straps left.');
    if (!chosen) return this.toast(kind === 'zip' ? 'Tie where 2+ cables of the SAME color run close together.' : 'Strap where 2+ cables run close together.');
    // a tie takes over the comb lanes right where it closes
    for (const t of this.ties) if (t.kind === 'comb') t.entries = t.entries.filter((e) => !chosen.some((h) => h.cable === e.cable && Math.abs(h.idx - e.idx) < 4));
    const f = this.frameOf(chosen), m = f.sorted.length;
    this.ties.push({
      kind, x: f.cx, y: f.cy, nx: f.nx, ny: f.ny, color: chosen[0].cable.color, t: 0, tail: kind === 'zip' ? 1 : 0, gid: this.nextGid++,
      entries: f.sorted.map((e, k) => ({ cable: e.cable, idx: e.idx, off: (k - (m - 1) / 2) * REP_R })),
    });
    this.orderLanes([this.ties[this.ties.length - 1]]);
    this.use(kind);
    this.wakeAll();
    this.fx.push({ x: f.cx, y: f.cy, t: 0, color: '#ffffff', kind: 'ring' });
    this.onEvent({ type: kind === 'zip' ? 'tie' : 'velcro' });
    return true;
  }

  feedTie(kind: 'zip' | 'velcro', x: number, y: number) { return this.extendTie(x, y, kind, this.nearby(x, y, GATHER_R, 3)); }

  /** Tapping by an existing tie or strap feeds in the cables that were left out. */
  private extendTie(x: number, y: number, kind: 'zip' | 'velcro', cands: { cable: Cable; idx: number; d: number }[]): boolean {
    const t = this.ties.find((o) => o.kind === kind && Math.hypot(o.x - x, o.y - y) < 60);
    if (!t) return false;
    const add = cands.filter((c) => c.d < TIE_R + 30 && !t.entries.some((e) => e.cable === c.cable) && (kind === 'velcro' || c.cable.color === t.color));
    if (!add.length) return false;
    for (const a of add) t.entries.push({ cable: a.cable, idx: a.idx, off: 0, t: 0 });
    const side = (e: TieEntry) => (e.cable.x[e.idx] - t.x) * t.nx + (e.cable.y[e.idx] - t.y) * t.ny;
    t.entries.sort((a, b) => side(a) - side(b));
    const m = t.entries.length;
    t.entries.forEach((e, k) => { e.off = (k - (m - 1) / 2) * REP_R; });
    if (kind === 'zip') t.tail = 1;
    this.orderLanes([t]);
    this.wakeAll();
    this.fx.push({ x: t.x, y: t.y, t: 0, color: '#ffffff', kind: 'ring' });
    this.onEvent({ type: kind === 'zip' ? 'tie' : 'velcro' });
    return true;
  }

  /**
   * When every cable in a bundle is plugged at both ends, line the lanes up with the ports so the
   * bundle itself never forces a crossing. `ts` are the stations of one holder.
   */
  private orderLanes(ts: Tie[]) {
    const t = ts[0], cs = [...new Set(ts.flatMap((q) => q.entries.map((e) => e.cable)))];
    if (!t || Math.abs(t.nx) < 0.35 || cs.some((c) => !c.ends[0].port || !c.ends[1].port)) return;
    const key = (c: Cable) => c.ends[0].port!.x + c.ends[1].port!.x;
    const order = cs.sort((a, b) => (key(a) - key(b)) * Math.sign(t.nx));
    for (const q of ts) {
      const offs = q.entries.map((e) => e.off).sort((a, b) => a - b);
      const sorted = [...q.entries].sort((a, b) => order.indexOf(a.cable) - order.indexOf(b.cable));
      sorted.forEach((e, k) => { if (Math.abs(e.off - offs[k]) > 0.5) { e.off = offs[k]; if (q.t >= 1) e.t = 0.3; } });
      q.entries = sorted;
    }
  }

  /**
   * Tap a crossing: the cable flicks over the other one, as long as nothing holds it there.
   * Returns false if there is no crossing at that point.
   */
  flick(x: number, y: number): boolean {
    let pt: (typeof this.crossPts)[number] | null = null, bd = 30;
    for (const p of this.crossPts) { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; pt = p; } }
    if (!pt) return false;
    const { a, b } = pt;
    let ok = false;
    if (a === b) {
      for (let i = 1; i < a.n - 4 && !ok; i++) for (let j = i + 3; j < a.n - 2 && !ok; j++) {
        if (!segX(a.x[i], a.y[i], a.x[i + 1], a.y[i + 1], a.x[j], a.y[j], a.x[j + 1], a.y[j + 1]) || Math.hypot(a.x[i] - pt.x, a.y[i] - pt.y) > 30) continue;
        let held = false;
        for (let k = i + 1; k <= j; k++) held ||= !!a.pin[k];
        if (held) continue;
        this.reverse(a, i, j);
        ok = true;
      }
      if (!ok) { // looped over its own plug: lay that end out straight
        const near = Math.hypot(a.x[1] - pt.x, a.y[1] - pt.y) < Math.hypot(a.x[a.n - 2] - pt.x, a.y[a.n - 2] - pt.y);
        const at = (k: number) => (near ? k : a.n - 1 - k);
        let m = 2;
        for (let k = 2; k < a.n - 6; k++) if (Math.hypot(a.x[at(k)] - pt.x, a.y[at(k)] - pt.y) < 26) m = k;
        const end = m + 5;
        let held = end > a.n - 4;
        for (let k = 2; k < end && !held; k++) held = !!a.pin[at(k)];
        if (!held) {
          const s0 = at(1), s1 = at(end);
          for (let k = 2; k < end; k++) { const u = (k - 1) / (end - 1), q = at(k); a.x[q] = a.px[q] = a.x[s0] + (a.x[s1] - a.x[s0]) * u; a.y[q] = a.py[q] = a.y[s0] + (a.y[s1] - a.y[s0]) * u; }
          ok = true;
        }
      }
    } else {
      const xs = this.crossList(a, b);
      let k = -1, d = 60;
      xs.forEach((q, i) => { const e = Math.hypot(q.x - pt!.x, q.y - pt!.y); if (e < d) { d = e; k = i; } });
      const pairs = [[k - 1, k], [k, k + 1]].filter(([u, v]) => u >= 0 && v < xs.length && k >= 0)
        .sort((m, n) => (xs[m[1]].i - xs[m[0]].i) - (xs[n[1]].i - xs[n[0]].i));
      for (const [u, v] of pairs) {
        const p = xs[u], q = xs[v];
        if (!this.resolve(a, b, p, q)) continue;
        ok = true;
        break;
      }
    }
    if (!ok) { this.toast(a.color === b.color ? 'These two go to each other’s ports: swap two of their plugs.' : 'Something holds these here. Move a plug, or loosen the tie or hook.'); return true; }
    this.wakeAll();
    this.burst(pt.x, pt.y, 8, '#fff3a8', 110, 0, -30);
    this.fx.push({ x: pt.x, y: pt.y, t: 0, color: '#7dffb0', kind: 'ring' });
    this.crossPts = this.crossPts.filter((p) => p !== pt);
    this.onEvent({ type: 'flick' });
    return true;
  }

  /** Where the tail of a zip tie ends (outside the last cable). */
  tieTail(t: Tie) {
    const h = ((t.entries.length - 1) * REP_R) / 2 + 24;
    return { x: t.x + t.nx * h, y: t.y + t.ny * h };
  }

  private tapTie(t: Tie) {
    if (t.kind === 'zip' && t.tail > 0) { // first tap: snip the tail flush
      t.tail = 0;
      const q = this.tieTail(t);
      const b = bit(q.x, q.y, t.nx * 130 + (Math.random() - 0.5) * 60, -190, 20, 4, '#1c1f24', 1.1, 900);
      b.rot = Math.atan2(t.ny, t.nx); b.vr = 14;
      this.bits.push(b);
      this.burst(q.x, q.y, 5, '#ffffff', 80, 0, -20);
      this.fx.push({ x: t.x, y: t.y, t: 0.2, color: '#7dffb0', kind: 'ring' });
      this.onEvent({ type: 'trim' });
      return;
    }
    if (t.run) {
      const run = t.run;
      this.ties = this.ties.filter((o) => o.run !== run);
      this.giveBack(run.kind);
    } else {
      this.ties = this.ties.filter((o) => o !== t);
      this.giveBack(t.kind as ToolId);
    }
    this.onEvent({ type: t.kind === 'velcro' ? 'rip' : 'snip' });
  }

  // ---- reel
  private placeReel(x: number, y: number): boolean {
    if (this.left.reel <= 0) return this.toast('No reels left — tap a reel to unspool or take it off.');
    let bc: Cable | null = null, bi = -1, bd = 34;
    for (const c of this.cables) {
      if (this.reels.some((r) => r.cable === c)) continue;
      for (let i = 6; i < c.n - 6; i++) {
        const d = Math.hypot(c.x[i] - x, c.y[i] - y);
        if (d < bd) { bd = d; bc = c; bi = i; }
      }
    }
    if (!bc) return this.toast('Tap a cable to clip a reel on it, then hold the reel to wind up the slack.');
    // not on a node that something already holds
    while (bi < bc.n - 6 && this.ties.some((t) => t.entries.some((e) => e.cable === bc && e.idx === bi))) bi++;
    this.reels.push({ cable: bc, idx: bi, spin: 0, pop: 1, tight: false, acc: 0 });
    this.IM[bc.o + bi] = 0.5;
    this.use('reel');
    this.wakeAll();
    this.onEvent({ type: 'reel' });
    return true;
  }

  wound(r: Reel) { return r.cable.wound; }

  /** Change how much cable is on the reel; the rest of the cord absorbs the difference evenly. */
  private setWound(c: Cable, w: number) {
    w = clamp(w, 0, c.length * 0.58);
    const k = (c.length - w) / (c.length - c.wound);
    for (let i = 0; i < c.n - 1; i++) c.len[i] *= k;
    c.wound = w;
    c.measure();
  }

  private wind(r: Reel, dt: number) {
    const c = r.cable;
    this.wake(c);
    // slack of every stretch, on both sides of whatever holds the cable
    let slack = 0;
    const st: { p: number; q: number; s: number }[] = [];
    for (const sp of this.spans(c)) {
      if (sp.rigid) continue;
      const len = c.cum[sp.q] - c.cum[sp.p];
      const s = Math.max(0, sp.held ? len - sp.d * 1.004 - 0.5 : len - (sp.q - sp.p) * 5.5);
      slack += s; st.push({ p: sp.p, q: sp.q, s });
    }
    const room = c.length * 0.58 - c.wound;
    if (slack < 2 || room < 1) {
      if (!r.tight) {
        r.tight = true; r.pop = 1;
        this.fx.push({ x: c.x[r.idx], y: c.y[r.idx], t: 0, color: '#fff3a8', kind: 'spark' });
        this.onEvent({ type: 'windTight' });
      }
      if (slack < 0.6) return;
    } else if (slack > 12) r.tight = false;
    const ease = 0.35 + 0.65 * clamp((this.grab!.t - 0.16) / 0.5, 0, 1); // spins up
    const amt = Math.min(slack, room, WIND_V * ease * dt, Math.max(0.3, slack * 0.15));
    for (const e of st) {
      const len = c.cum[e.q] - c.cum[e.p], k = 1 - (amt * e.s) / slack / len;
      for (let i = e.p; i < e.q; i++) c.len[i] *= k;
    }
    c.wound += amt;
    c.measure();
    if (r.tight) return;
    r.spin += (amt / dt / WIND_V) * dt * 16 + dt * 4;
    r.acc += amt;
    if (r.acc > 11) { r.acc = 0; this.onEvent({ type: 'wind', k: c.wound / (c.length * 0.58) }); }
  }

  private tapReel(r: Reel) {
    const c = r.cable;
    r.tight = false;
    if (c.wound > 1) { this.setWound(c, 0); r.pop = 1; this.onEvent({ type: 'unspool' }); return; }
    this.reels = this.reels.filter((o) => o !== r);
    this.IM[c.o + r.idx] = 1;
    this.giveBack('reel');
    this.onEvent({ type: 'snip' });
  }

  // ---- label maker
  private placeLabel(x: number, y: number): boolean {
    let bc: Cable | null = null, bd = 30;
    for (const c of this.cables) for (let i = 0; i < c.n; i++) {
      const d = Math.hypot(c.x[i] - x, c.y[i] - y);
      if (d < bd) { bd = d; bc = c; }
    }
    if (!bc) return this.toast('Tap a working cable to print its label.');
    if (bc.label > 0) return this.toast('That cable already has its label.');
    if (!bc.valid()) return this.toast('Connect both ends first, then label it.');
    bc.label = 0.01;
    for (const i of [4, bc.n - 5]) this.fx.push({ x: bc.x[i], y: bc.y[i], t: 0.2, color: '#ffffff', kind: 'ring' });
    this.onEvent({ type: 'label' });
    return true;
  }

  // ---- comb & spiral wrap strokes
  private startRun(kind: 'comb' | 'wrap', x: number, y: number): Run | null {
    for (const t of this.ties) if (t.run && (t === t.run.stations[0] || t === t.run.stations[t.run.stations.length - 1]) && Math.hypot(t.x - x, t.y - y) < 24) return null;
    if (this.left[kind] <= 0) { this.toast(kind === 'wrap' ? 'No spiral wrap left.' : 'No combs left.'); return null; }
    const cands = this.nearby(x, y, kind === 'comb' ? COMB_R : GATHER_R, 3).filter((e) => kind === 'comb' || !this.ties.some((t) => t.kind === 'wrap' && t.entries.some((q) => q.cable === e.cable)));
    const chosen = kind === 'wrap' ? this.sameColor(cands) : cands.length >= 2 ? cands.sort((a, b) => a.d - b.d).slice(0, 10) : null;
    if (!chosen) { this.toast(kind === 'wrap' ? 'Start the wrap on 2+ cables of the SAME color.' : 'Start combing where 2+ cables run close together.'); return null; }
    const f = this.frameOf(chosen), m = f.sorted.length, side = (e: { cable: Cable; idx: number }) => (e.cable.x[e.idx] - f.cx) * f.nx + (e.cable.y[e.idx] - f.cy) * f.ny;
    // the comb keeps the cables about as spread out as it found them, just perfectly even
    const sp = kind === 'comb' ? clamp(((side(f.sorted[m - 1]) - side(f.sorted[0])) / (m - 1)) * 0.85, COMB_LANE, 30) : WRAP_LANE;
    const run: Run = { kind, gid: this.nextGid++, color: chosen[0].cable.color, stations: [], ux: 0, uy: 0, ended: false, live: f.sorted.map((e, k) => ({ cable: e.cable, idx: e.idx, s: 0, lane: (k - (m - 1) / 2) * sp })) };
    this.addStation(run, f.cx, f.cy, f.nx, f.ny);
    return run;
  }

  private addStation(run: Run, x: number, y: number, nx: number, ny: number) {
    const t: Tie = { kind: run.kind, x, y, nx, ny, color: run.color, t: 0, tail: 0, run, gid: run.gid, entries: [] };
    for (const l of run.live) {
      const clash = this.ties.some((o) => o.run !== run && o.entries.some((e) => e.cable === l.cable && Math.abs(e.idx - l.idx) < 2));
      if (!clash) t.entries.push({ cable: l.cable, idx: l.idx, off: l.lane });
    }
    run.stations.push(t);
    this.ties.push(t);
  }

  private extendRun(run: Run, x: number, y: number) {
    const nodes = run.kind === 'comb' ? 2 : 1;
    for (let guard = 0; guard < 6 && !run.ended; guard++) {
      const L = run.stations[run.stations.length - 1];
      const step = Math.max(6, Math.min(...run.live.map((l) => {
        const to = clamp(l.idx + (l.s || 1) * nodes, 0, l.cable.n - 1);
        return Math.abs(l.cable.cum[to] - l.cable.cum[l.idx]);
      }))) * 0.985;
      let vx = x - L.x, vy = y - L.y;
      const d = Math.hypot(vx, vy);
      if (d < step) return;
      vx /= d; vy /= d;
      if (run.stations.length === 1) {
        // the first pull decides which way the stroke goes along each cable
        let nx = -vy, ny = vx;
        const along = Math.abs(L.nx * nx + L.ny * ny);
        if (along < 0.35) return; // pulled sideways
        if (nx * L.nx + ny * L.ny < 0) { nx = -nx; ny = -ny; }
        L.nx = nx; L.ny = ny; run.ux = vx; run.uy = vy;
        for (const l of run.live) {
          const c = l.cable;
          l.s = (c.x[l.idx + 1] - c.x[l.idx - 1]) * vx + (c.y[l.idx + 1] - c.y[l.idx - 1]) * vy >= 0 ? 1 : -1;
        }
      } else {
        vx = run.ux * 0.55 + vx * 0.45; vy = run.uy * 0.55 + vy * 0.45; // gentle curves only
        const l = Math.hypot(vx, vy);
        if (l < 0.3) return;
        vx /= l; vy /= l;
        if (vx * run.ux + vy * run.uy < 0.2) return; // no turning back
      }
      const nl = run.live.map((l) => ({ ...l, idx: l.idx + l.s * nodes })).filter((l) => l.idx >= 3 && l.idx <= l.cable.n - 4);
      if (nl.length < 2 || run.stations.length > 60) { run.ended = true; return; }
      let nx = -vy, ny = vx;
      if (nx * L.nx + ny * L.ny < 0) { nx = -nx; ny = -ny; }
      const cx = clamp(L.x + vx * step, 24, W - 24), cy = clamp(L.y + vy * step, 24, FLOOR - 8);
      // don't pull any cable further than its other end allows
      for (const l of nl) {
        const ex = cx + nx * l.lane, ey = cy + ny * l.lane;
        let j = l.idx + l.s;
        while (j >= 0 && j < l.cable.n && !l.cable.pin[j]) j += l.s;
        if (j < 0 || j >= l.cable.n) continue;
        if (Math.hypot(ex - l.cable.x[j], ey - l.cable.y[j]) > Math.abs(l.cable.cum[j] - l.cable.cum[l.idx]) * 1.004 + 2) return;
      }
      run.live = nl; run.ux = vx; run.uy = vy;
      this.addStation(run, cx, cy, nx, ny);
      if (run.kind === 'comb' || run.stations.length % 2 === 0) this.onEvent({ type: run.kind, n: run.stations.length });
    }
  }

  private endRun(run: Run) {
    if (run.stations.length < (run.kind === 'comb' ? 4 : 5)) {
      this.ties = this.ties.filter((t) => t.run !== run);
      this.toast(run.kind === 'comb' ? 'Keep dragging along the cables to comb them.' : 'Keep dragging along the bundle to wrap it.');
      return;
    }
    this.orderLanes(run.stations);
    this.use(run.kind);
    const e = run.stations[run.stations.length - 1];
    this.fx.push({ x: e.x, y: e.y, t: 0, color: '#fff3a8', kind: 'spark' });
    this.onEvent({ type: run.kind === 'comb' ? 'combDone' : 'wrapDone' });
  }

  /** Pulling a combed cable peels it out of the comb, starting with the nearest station. */
  private unzipComb(c: Cable, at: number): boolean {
    let bt: Tie | null = null, be: TieEntry | null = null, bd = Infinity;
    for (const s of [-1, 1]) { // only if the nearest thing holding this side is a comb
      let j = at + s;
      while (j >= 0 && j < c.n && !c.pin[j]) j += s;
      for (const t of this.ties) if (t.kind === 'comb') for (const e of t.entries) {
        if (e.cable === c && e.idx === j && Math.abs(j - at) < bd) { bd = Math.abs(j - at); bt = t; be = e; }
      }
    }
    if (!bt || !be) return false;
    bt.entries = bt.entries.filter((e) => e !== be);
    const run = bt.run!;
    if (!run.stations.some((t) => t.entries.length >= 2)) {
      this.ties = this.ties.filter((t) => t.run !== run);
      this.giveBack('comb');
    }
    this.computePins();
    this.onEvent({ type: 'comb', n: 1 });
    return true;
  }

  // ---- air duster
  private spawnDust() {
    const n = this.level.dust ?? 0;
    const rng = mulberry32(this.level.seed * 31 + 7);
    const ds = this.level.devices, area = ds.reduce((s, d) => s + d.w * d.h, 0);
    for (const d of ds) {
      const k = Math.round((n * d.w * d.h) / area);
      for (let i = 0; i < k; i++) {
        this.dust.push({ x: d.x + 8 + rng() * (d.w - 16), y: d.y + 8 + rng() * (d.h - 16), r: 9 + rng() * 13, a: 0.55 + rng() * 0.35, hp: 0.5 + rng() * 0.5, vx: 0, vy: 0, gone: false });
      }
    }
    this.dustTotal = this.dust.length;
  }

  private dustLeft() { return this.dust.filter((d) => !d.gone).length; }

  private blow(x: number, y: number, dt: number) {
    let hit = false;
    const before = this.dustLeft();
    for (const d of this.dust) {
      if (d.gone) continue;
      const dx = d.x - x, dy = d.y - y, q = Math.hypot(dx, dy);
      if (q > AIR_R) continue;
      d.hp -= dt * 7 * (1.15 - q / AIR_R);
      if (d.hp > 0) { d.x += (dx / (q || 1)) * dt * 30; d.y += (dy / (q || 1)) * dt * 30; continue; }
      d.gone = true; hit = true;
      const v = 130 + Math.random() * 120;
      d.vx = (dx / (q || 1)) * v + (Math.random() - 0.5) * 60; d.vy = (dy / (q || 1)) * v - 60;
    }
    // loose cables flutter in the jet
    for (let k = 0; k < this.total; k++) {
      if (this.PIN[k]) continue;
      const dx = this.X[k] - x, dy = this.Y[k] - y, q = Math.hypot(dx, dy);
      if (q > AIR_R || q < 1) continue;
      const f = (1 - q / AIR_R) * 0.55;
      this.wake(this.cables[this.ptC[k]]);
      this.PX[k] -= (dx / q) * f; this.PY[k] -= (dy / q) * f;
    }
    if (hit) this.onEvent({ type: 'dust' });
    if (before > 0 && this.dustLeft() === 0) {
      for (const d of this.level.devices) this.sparkle(d.x + d.w / 2, d.y + d.h / 2, d.w, d.h);
      this.onEvent({ type: 'dustDone' });
    }
  }

  // ---- screwdriver
  private screwAt(x: number, y: number): Port | null {
    let best: Port | null = null, bd = 40;
    for (const p of this.ports) {
      if (!p.end || p.tight >= 1) continue;
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  // ---- hooks & ducts
  hookAt(x: number, y: number, c: Cable): Hook | null {
    let best: Hook | null = null, bd = HOOK_R;
    for (const h of this.hooks) {
      if (h.tie.entries.length >= h.cap || h.tie.entries.some((e) => e.cable === c)) continue;
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  }

  ductAt(x: number, y: number, c: Cable): Duct | null {
    return this.ducts.find((d) => d.lid < 1 && x > d.x - 18 && x < d.x + d.w + 18 && y > d.y - 10 && y < d.y + d.h + 10 && !d.st[0].entries.some((e) => e.cable === c)) ?? null;
  }

  private tryFixture(c: Cable, idx: number) {
    const x = c.x[idx], y = c.y[idx];
    const h = this.hookAt(x, y, c);
    if (h && idx >= 3 && idx <= c.n - 4) { this.hookCable(h, c, idx); return; }
    const d = this.ductAt(x, y, c);
    if (d) this.ductCable(d, c, idx);
  }

  hookCable(h: Hook, c: Cable, idx: number) {
    this.dropHeldNear(c, idx, 2);
    h.tie.entries.push({ cable: c, idx, off: 0, t: 0 });
    this.layout(h.tie, 8);
    this.wakeAll();
    this.fx.push({ x: h.x, y: h.y, t: 0, color: '#7dffb0', kind: 'ring' });
    this.onEvent({ type: 'hook' });
  }

  ductCable(d: Duct, c: Cable, idx: number): boolean {
    const k = Math.max(3, Math.ceil((d.st[1].y - d.st[0].y) / c.seg - 0.15));
    if (c.n < 2 * k + 8) return this.toast('That cable is too short for the duct.');
    idx = clamp(idx, k + 3, c.n - 4 - k);
    // the station nearer the cable's upper end comes first
    const s = c.y[0] <= c.y[c.n - 1] ? 1 : -1;
    for (const q of [-k, 0, k]) this.dropHeldNear(c, idx + q, 2);
    d.st.forEach((t, i) => { t.entries.push({ cable: c, idx: idx + (i - 1) * k * s, off: 0, t: 0 }); this.layout(t, Math.min(13, (d.w - 24) / Math.max(1, t.entries.length - 1))); });
    this.wakeAll();
    this.fx.push({ x: d.x + d.w / 2, y: d.y + d.h / 2, t: 0, color: '#7dffb0', kind: 'ring' });
    this.onEvent({ type: 'hook' });
    return true;
  }

  private dropHeldNear(c: Cable, idx: number, r: number) {
    for (const t of this.ties) if (t.kind === 'comb') t.entries = t.entries.filter((e) => e.cable !== c || Math.abs(e.idx - idx) > r);
  }

  private release(h: Hook | Duct, c: Cable) {
    for (const t of 'tie' in h ? [h.tie] : h.st) { t.entries = t.entries.filter((e) => e.cable !== c); this.layout(t, 'tie' in h ? 8 : Math.min(13, (h.w - 24) / Math.max(1, t.entries.length - 1))); }
    this.onEvent({ type: 'unhook' });
  }

  /** Side-by-side lanes ordered like the cables' ports, so nothing has to cross. */
  private layout(t: Tie, spacing: number) {
    const key = (c: Cable) => {
      const ps = c.ends.filter((e) => e.port).map((e) => e.port!.x);
      return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : c.x[Math.floor(c.n / 2)];
    };
    t.entries.sort((a, b) => key(a.cable) - key(b.cable));
    const m = t.entries.length;
    t.entries.forEach((e, k) => {
      const off = (k - (m - 1) / 2) * spacing;
      if (Math.abs(off - e.off) > 0.5 && (e.t ?? 1) >= 1) e.t = 0.35; // slide over to the new lane
      e.off = off;
    });
  }

  /** Re-sort hook / duct lanes after plugs changed. */
  private relayout() {
    for (const h of this.hooks) this.layout(h.tie, 8);
    const seen = new Set<number>();
    for (const t of this.ties) {
      if (t.kind === 'hook' || t.kind === 'duct' || seen.has(t.gid)) continue;
      seen.add(t.gid);
      this.orderLanes(this.ties.filter((o) => o.gid === t.gid));
    }
    for (const d of this.ducts) for (const e of d.st[0].entries) {
      // laid in before its ends were plugged and now upside down: turn it around
      const c = e.cable, o = d.st[2].entries.find((q) => q.cable === c)!, p0 = c.ends[0].port, p1 = c.ends[1].port;
      const up = p0 ? p0.y < d.y : p1 ? p1.y > d.y : e.idx < o.idx; // does node 0 belong at the top?
      if (up !== e.idx < o.idx) { const i = e.idx; e.idx = o.idx; o.idx = i; e.t = o.t = 0.1; }
    }
    for (const d of this.ducts) for (const t of d.st) this.layout(t, Math.min(13, (d.w - 24) / Math.max(1, t.entries.length - 1)));
  }

  /**
   * Stretches of cable between held nodes. `rigid`: both ends gripped by the same unit (inside a
   * run or duct, or the two pinned nodes of a plug). `held` is false for a loose end.
   */
  private spans(c: Cable) {
    const out: { p: number; q: number; d: number; rigid: boolean; held: boolean; duct: Duct | null }[] = [];
    let last = -1;
    for (let i = 0; i < c.n; i++) {
      if (!c.pin[i]) continue;
      if (last < 0) { if (i > 0) out.push({ p: 0, q: i, d: 0, rigid: false, held: false, duct: null }); } else {
        const plug = (last === 0 && i === 1 && !!c.ends[0].port) || (last === c.n - 2 && i === c.n - 1 && !!c.ends[1].port);
        const same = c.grp[last] !== 0 && c.grp[last] === c.grp[i];
        const duct = same ? this.ducts.find((d) => d.st[0].gid === c.grp[i]) ?? null : null;
        out.push({ p: last, q: i, d: Math.hypot(c.x[i] - c.x[last], c.y[i] - c.y[last]), rigid: plug || same, held: true, duct });
      }
      last = i;
    }
    if (last < 0) out.push({ p: 0, q: c.n - 1, d: 0, rigid: false, held: false, duct: null });
    else if (last < c.n - 1) out.push({ p: last, q: c.n - 1, d: 0, rigid: false, held: false, duct: null });
    return out;
  }

  /**
   * Ties, hooks, wraps, combs and ducts guide a cable but don't clamp it: cable slips through them
   * until the slack is shared by all the stretches, so it can't get stuck as a loop on one side
   * while the other side is taut. Moves rest length between stretches; the total never changes.
   * The player's hand does clamp: nothing slips past a grabbed point.
   */
  private balance(c: Cable) {
    c.grp.fill(0);
    let soft = false;
    for (const t of this.ties) for (const e of t.entries) if (e.cable === c) {
      if (t.t >= 1 && (e.t ?? 1) >= 1) c.grp[e.idx] = t.gid; else soft = true;
    }
    const sp = this.spans(c);
    const g = this.grab, hand = g?.kind === 'cable' && g.cable === c && !g.hold ? g.idx! : -1;
    const want = sp.map((s) => c.cum[s.q] - c.cum[s.p]);
    const cur = want.slice();
    for (let a = 0; a < sp.length;) {
      if (!sp[a].held) { a++; continue; }
      let b = a;
      while (b + 1 < sp.length && sp[b + 1].held && sp[b].q !== hand) b++;
      // chain a..b
      let pool = 0, D = 0;
      for (let k = a; k <= b; k++) {
        if (sp[k].rigid) { pool += cur[k] - sp[k].d; want[k] = sp[k].d; } else { pool += cur[k]; D += sp[k].d; }
      }
      if (D > 1) {
        // a closed duct pulls the spare cable inside
        let spare = pool - D * 1.006 - 2;
        const inside = sp.filter((q, k) => k >= a && k <= b && q.duct && q.duct.lid >= 1).length;
        const each = spare / Math.max(1, inside);
        for (let k = a; k <= b && spare > 0; k++) if (sp[k].duct && sp[k].duct!.lid >= 1) {
          const take = Math.min(each, sp[k].d * 1.2);
          want[k] += take; spare -= take; pool -= take;
        }
        // taut: let a loose end feed in through the holder
        for (const l of [a - 1, b + 1]) if (pool < D && sp[l] && !sp[l].held && (l < a ? sp[a].p : sp[b].q) !== hand) {
          const feed = Math.min(D - pool, 5, Math.max(0, cur[l] - 40));
          want[l] -= feed; pool += feed;
        }
        for (let k = a; k <= b; k++) if (!sp[k].rigid) want[k] = (sp[k].d / D) * pool;
      } else for (let k = a; k <= b; k++) want[k] = cur[k];
      a = b + 1;
    }
    let m = 0;
    for (let k = 0; k < sp.length; k++) m = Math.max(m, Math.abs(want[k] - cur[k]));
    const f = m > 0.02 ? Math.min(0.5, 10 / m) : 0;
    for (let k = 0; k < sp.length; k++) {
      const { p, q } = sp[k], to = Math.max(1, cur[k] + (want[k] - cur[k]) * f), mean = to / (q - p), r = to / cur[k];
      for (let i = p; i < q; i++) c.len[i] = c.len[i] * r * 0.9 + mean * 0.1; // and even out inside the stretch
    }
    c.measure();
    if (!soft && hand < 0 && this.frame % 6 === 0) this.renode(c, sp);
  }

  /** Keep nodes evenly spread: if a stretch got much longer or shorter, re-index who holds what. */
  private renode(c: Cable, sp: { p: number; q: number; rigid: boolean; held: boolean }[]) {
    if (sp.length < 2 || this.grab?.kind === 'run') return;
    const len = sp.map((s) => c.cum[s.q] - c.cum[s.p]), free = sp.map((s) => !s.rigid);
    let L = 0, N = 0;
    sp.forEach((s, k) => { if (free[k]) { L += len[k]; N += s.q - s.p; } });
    const avg = L / N;
    if (!sp.some((s, k) => free[k] && (len[k] / (s.q - s.p) > avg * 1.3 || len[k] / (s.q - s.p) < avg * 0.72) && Math.abs(len[k] / avg - (s.q - s.p)) > 1.2)) return;
    const cnt = sp.map((s, k) => (free[k] ? Math.max(2, Math.round(len[k] / avg)) : s.q - s.p));
    let diff = c.n - 1 - cnt.reduce((a, b) => a + b, 0);
    while (diff !== 0) { // fix rounding on the biggest stretch
      let b = -1;
      free.forEach((f, k) => { if (f && (b < 0 || cnt[k] > cnt[b])) b = k; });
      if (b < 0 || (diff < 0 && cnt[b] <= 2)) return;
      cnt[b] += Math.sign(diff); diff -= Math.sign(diff);
    }
    if (cnt.every((n, k) => n === sp[k].q - sp[k].p)) return;
    const ox = c.x.slice(), oy = c.y.slice(), opx = c.px.slice(), opy = c.py.slice(), map = new Map<number, number>();
    const reels = this.reels.filter((r) => r.cable === c);
    let at = 0;
    const reelTo = new Map<Reel, number>();
    sp.forEach((s, k) => {
      const m0 = s.q - s.p, m1 = cnt[k];
      map.set(s.p, at); map.set(s.q, at + m1);
      for (let i = 0; i <= m1; i++) { // resample the same polyline: nothing visibly moves
        const u = s.p + (i / m1) * m0, j = Math.min(s.q - 1, Math.floor(u)), w = u - j;
        c.x[at + i] = ox[j] + (ox[j + 1] - ox[j]) * w; c.y[at + i] = oy[j] + (oy[j + 1] - oy[j]) * w;
        c.px[at + i] = opx[j] + (opx[j + 1] - opx[j]) * w; c.py[at + i] = opy[j] + (opy[j + 1] - opy[j]) * w;
        if (i < m1) c.len[at + i] = len[k] / m1;
      }
      for (const r of reels) if (r.idx >= s.p && r.idx < s.q) reelTo.set(r, at + clamp(Math.round(((r.idx - s.p) / m0) * m1), m1 > 1 ? 1 : 0, Math.max(0, m1 - 1)));
      at += m1;
    });
    for (const t of this.ties) for (const e of t.entries) if (e.cable === c) e.idx = map.get(e.idx) ?? e.idx;
    for (const [r, i] of reelTo) { this.IM[c.o + r.idx] = 1; r.idx = i; }
    for (const r of reels) this.IM[c.o + r.idx] = 0.5;
    c.measure();
    this.computePins();
    for (const t of this.ties) for (const e of t.entries) if (e.cable === c) c.grp[e.idx] = t.gid;
  }

  // ---- finishing touches
  private finishTasks(): Task[] {
    const out: Task[] = [], L = this.level;
    if (this.dustTotal) out.push({ id: 'dust', label: 'Dusted', done: this.dustTotal - this.dustLeft(), total: this.dustTotal });
    if (L.tools.label) out.push({ id: 'label', label: 'Labels', done: this.cables.filter((c) => c.label > 0).length, total: this.cables.length });
    if (L.tools.screw) out.push({ id: 'screw', label: 'Screws', done: this.ports.filter((p) => p.tight >= 1).length, total: this.ports.length });
    for (const d of this.ducts) out.push({ id: 'duct', label: 'Duct', done: d.st[0].entries.length * 0.5 + (d.lid >= 1 ? d.st[0].entries.length * 0.5 : 0), total: this.cables.length });
    const zips = this.ties.filter((t) => t.kind === 'zip');
    if (zips.length) out.push({ id: 'trim', label: 'Ties trimmed', done: zips.filter((t) => !t.tail).length, total: zips.length });
    return out;
  }

  // ---------------------------------------------------------------- scoring
  countCrossings(): number {
    let total = 0;
    this.crossPts = [];
    const hidden = (x: number, y: number) => !!this.inClosedDuct(x, y, 18);
    const cs = this.cables;
    const bb = cs.map((c) => {
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (let i = 0; i < c.n; i++) {
        x0 = Math.min(x0, c.x[i]); x1 = Math.max(x1, c.x[i]);
        y0 = Math.min(y0, c.y[i]); y1 = Math.max(y1, c.y[i]);
      }
      return { x0, y0, x1, y1 };
    });
    // self loops count as crossings too
    for (const c of cs) {
      let last = -99;
      for (let i = 0; i < c.n - 1; i++) {
        let hit = false;
        for (let j = i + 3; j < c.n - 1 && !hit; j++) {
          hit = segX(c.x[i], c.y[i], c.x[i + 1], c.y[i + 1], c.x[j], c.y[j], c.x[j + 1], c.y[j + 1]);
        }
        if (hit && !hidden(c.x[i], c.y[i])) { if (i - last > 3) { total++; this.crossPts.push({ x: c.x[i], y: c.y[i], a: c, b: c }); } last = i; }
      }
    }
    for (let a = 0; a < cs.length; a++) for (let b = a + 1; b < cs.length; b++) {
      const A = bb[a], B = bb[b];
      if (A.x1 < B.x0 || B.x1 < A.x0 || A.y1 < B.y0 || B.y1 < A.y0) continue;
      const ca = cs[a], cb = cs[b];
      // twists inside one tied bundle of the same color are fine
      if (ca.color === cb.color && this.ties.some((t) => t.kind !== 'comb' && t.entries.some((e) => e.cable === ca) && t.entries.some((e) => e.cable === cb))) continue;
      const hits: number[] = [];
      for (let i = 0; i < ca.n - 1; i++) {
        for (let j = 0; j < cb.n - 1; j++) {
          if (segX(ca.x[i], ca.y[i], ca.x[i + 1], ca.y[i + 1], cb.x[j], cb.y[j], cb.x[j + 1], cb.y[j + 1])) { hits.push(i); break; }
        }
      }
      let last = -99;
      for (const h of hits) { if (hidden(ca.x[h], ca.y[h])) continue; if (h - last > 3) { total++; this.crossPts.push({ x: ca.x[h], y: ca.y[h], a: ca, b: cb }); } last = h; }
    }
    return total;
  }

  smoothness(c: Cable): number {
    let turn = 0;
    const step = 3;
    let pdx = 0, pdy = 0, first = true;
    for (let i = 2; i + step < c.n - 1; i += step) {
      if (this.inClosedDuct(c.x[i], c.y[i])) continue;
      const dx = c.x[i + step] - c.x[i], dy = c.y[i + step] - c.y[i];
      if (!first) {
        const cross = pdx * dy - pdy * dx, dot = pdx * dx + pdy * dy;
        turn += Math.abs(Math.atan2(cross, dot));
      }
      pdx = dx; pdy = dy; first = false;
    }
    let onFloor = 0;
    for (let i = 0; i < c.n; i++) if (c.y[i] > FLOOR - 10) onFloor++;
    const deg = (turn * 180) / Math.PI;
    // routing through a hook or a duct legitimately adds bends
    let free = 110;
    for (const h of this.hooks) if (h.tie.entries.some((e) => e.cable === c)) free += 60;
    for (const d of this.ducts) if (d.st[0].entries.some((e) => e.cable === c)) free += 140;
    const s = clamp(1 - (deg - free) / 300, 0, 1);
    return s * (1 - Math.min(1, (onFloor / c.n) * 3));
  }

  evaluate(): Evaluation {
    const total = this.cables.length;
    const connected = this.connectedCount();
    const crossings = this.countCrossings();
    const crossScore = Math.max(0, 1 - crossings * 0.2);
    const smooth = this.cables.reduce((s, c) => s + this.smoothness(c), 0) / total;
    const byColor = new Map<ColorKey, number>();
    for (const c of this.cables) byColor.set(c.color, (byColor.get(c.color) ?? 0) + 1);
    let bundleGroups = 0, bundled = 0, frac = 0;
    for (const [color, n] of byColor) {
      if (n < 2) continue;
      bundleGroups++;
      let best = 0;
      for (const t of this.ties) {
        if (t.kind === 'comb' || t.kind === 'hook') continue;
        if (t.kind === 'duct' && !this.ducts.some((d) => d.lid >= 1 && d.st.includes(t))) continue;
        best = Math.max(best, new Set(t.entries.filter((e) => e.cable.color === color).map((e) => e.cable)).size);
      }
      if (best >= n) bundled++;
      frac += best >= 2 ? best / n : 0;
    }
    const bundleScore = bundleGroups ? frac / bundleGroups : 1;
    const fin = this.finishTasks();
    const finish = fin.length ? fin.reduce((s, t) => s + t.done / t.total, 0) / fin.length : 1;
    const tasks: Task[] = [{ id: 'conn', label: 'Plugged', done: connected, total }];
    if (bundleGroups) tasks.push({ id: 'bundle', label: 'Bundles', done: bundled, total: bundleGroups });
    tasks.push(...fin);
    const score = Math.round(10 * (connected / total) + 35 * crossScore + 25 * smooth + 18 * bundleScore + 12 * finish);
    const stars = connected < total ? 0 : score >= 90 ? 3 : score >= 75 ? 2 : 1;
    return { connected, total, crossings, crossScore, smooth, bundled, bundleGroups, bundleScore, finish, tasks, score, stars };
  }

  /** debug helper: solve connections instantly (used for automated tests only) */
  debugSolve() {
    for (const p of this.ports) { p.end = null; p.out = 0; }
    for (const c of this.cables) for (const e of c.ends) e.port = null;
    const used = new Set<Port>();
    for (const c of this.cables) {
      const a = this.ports.find((p) => p.side === 'A' && p.color === c.color && !used.has(p))!;
      const b = this.ports.find((p) => p.side === 'B' && p.color === c.color && !used.has(p))!;
      used.add(a); used.add(b);
      this.wake(c);
      a.end = c.ends[0]; c.ends[0].port = a;
      b.end = c.ends[1]; c.ends[1].port = b;
      const pa = portAnchor(a), pb = portAnchor(b);
      for (let i = 0; i < c.n; i++) {
        const t = i / (c.n - 1);
        c.x[i] = c.px[i] = pa.x + (pb.x - pa.x) * t + Math.sin(t * Math.PI) * 4;
        c.y[i] = c.py[i] = pa.y + (pb.y - pa.y) * t;
      }
    }
    this.refreshAll();
  }
}

function bit(x: number, y: number, vx: number, vy: number, w: number, h: number, color: string, life: number, g: number): Bit {
  return { x, y, vx, vy, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 16, w, h, color, t: 0, life, g };
}

/** Point at fraction k of a polyline's length. */
function along(P: number[][], k: number) {
  let L = 0;
  for (let i = 1; i < P.length; i++) L += Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
  let t = L * k;
  for (let i = 1; i < P.length; i++) {
    const d = Math.hypot(P[i][0] - P[i - 1][0], P[i][1] - P[i - 1][1]);
    if (t <= d || i === P.length - 1) { const u = d ? t / d : 0; return [P[i - 1][0] + (P[i][0] - P[i - 1][0]) * u, P[i - 1][1] + (P[i][1] - P[i - 1][1]) * u]; }
    t -= d;
  }
  return P[0];
}

export function clamp(v: number, a: number, b: number) { return v < a ? a : v > b ? b : v; }

function segX(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number) {
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
