import type { ColorKey, LevelDef } from './levels';

export const W = 720;
export const H = 900;
export const FLOOR = H - 18;
export const SEG = 13;
export const PLUG_LEN = 18;
export const REP_R = 9;
export const TIE_R = 72;

const GRAV = 1500;
const DAMP = 0.982;
const ITER = 14;
const SNAP_R = 44;
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
const MAX_UNTWISTS = 3; // auto curl fixes per cable between player interactions
const GC = 40; // grid cols (cell 18px)
const GR = 50;
const CELL = 18;

export interface End { cable: Cable; which: 0 | 1; port: Port | null }

export interface Port {
  id: number; x: number; y: number; dir: 1 | -1; color: ColorKey; side: 'A' | 'B';
  end: End | null; pulse: number;
}

export interface TieEntry { cable: Cable; idx: number; off: number }
export interface Tie { x: number; y: number; nx: number; ny: number; color: ColorKey; entries: TieEntry[]; t: number }

export interface Fx { x: number; y: number; t: number; color: string; kind: 'ring' | 'spark' }

interface Grab {
  kind: 'plug' | 'cable' | 'tie';
  end?: End; cable?: Cable; idx?: number; tie?: Tie;
  ox: number; oy: number; x: number; y: number; sx: number; sy: number; moved: boolean;
}

export type GameEvent =
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
  constructor(public id: number, public color: ColorKey, public length: number, offset: number) {
    const segs = Math.max(8, Math.round(length / SEG));
    this.n = segs + 1;
    this.seg = length / segs;
    this.o = offset;
    this.pin = new Uint8Array(this.n);
    this.ends = [{ cable: this, which: 0, port: null }, { cable: this, which: 1, port: null }];
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
  return { x: p.x, y: p.y + p.dir * (PLUG_LEN + extra) };
}

export class Game {
  cables: Cable[] = [];
  order: Cable[] = []; // draw order
  ports: Port[] = [];
  ties: Tie[] = [];
  fx: Fx[] = [];
  tiesLeft: number;
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
  private FX: Float32Array; private FY: Float32Array; // positions at frame start
  private AX: Float32Array; private AY: Float32Array; // rest anchor (positions when `still` restarted)
  /** per cable: 1 = asleep (frozen until something touches/grabs/plugs it) */
  readonly sleep: Uint8Array;
  /** union-find over cables touching each other / sharing a tie this frame (sleep islands) */
  private uf: Int16Array;
  private ptC: Int16Array; private ptI: Int16Array;
  private grid = new Int32Array(GC * GR);
  private next: Int32Array;
  private total: number;

  constructor(public level: LevelDef) {
    this.tiesLeft = level.ties;
    level.ports.forEach((p, i) => this.ports.push({ id: i, ...p, end: null, pulse: 0 }));

    // pair ports of each color, A[i] <-> B[i] by x order
    const colors = [...new Set(level.ports.map((p) => p.color))];
    const pairs: { color: ColorKey; len: number }[] = [];
    for (const color of colors) {
      const A = this.ports.filter((p) => p.side === 'A' && p.color === color).sort((a, b) => a.x - b.x);
      const B = this.ports.filter((p) => p.side === 'B' && p.color === color).sort((a, b) => a.x - b.x);
      for (let i = 0; i < Math.min(A.length, B.length); i++) {
        const a = portAnchor(A[i], SEG), b = portAnchor(B[i], SEG);
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        pairs.push({ color, len: 2 * SEG + d * SLACK });
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
    this.FX = new Float32Array(off); this.FY = new Float32Array(off);
    this.AX = new Float32Array(off); this.AY = new Float32Array(off);
    this.sleep = new Uint8Array(this.cables.length);
    this.uf = new Int16Array(this.cables.length);
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
  }

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
    const sub = 2, h = dt / sub;
    this.FX.set(this.X); this.FY.set(this.Y);
    for (let i = 0; i < this.uf.length; i++) this.uf[i] = i;
    for (const t of this.ties) for (const e of t.entries) this.union(t.entries[0].cable.id, e.cable.id);
    this.forceWake();
    for (let s = 0; s < sub; s++) {
      this.computePins();
      this.integrate(h);
      for (let it = 0; it < ITER; it++) {
        this.solveDist();
        if (it % 2 === 0) this.solveBend();
        if (it % 4 === 1) this.repel();
        this.applyPins();
        this.bounds();
      }
    }
    void silent;
    if (++this.frame % 12 === 0) this.untwist();
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
  wakeAll() { this.idleFrames = 0; for (const c of this.cables) { this.wake(c); c.untwists = 0; } }

  /** Anything the player is touching (or a tie still closing) must simulate. */
  private forceWake() {
    const g = this.grab;
    if (g?.cable) this.wake(g.cable);
    if (g?.end) this.wake(g.end.cable);
    for (const t of this.ties) {
      if (t.t < 1 || g?.tie === t) for (const e of t.entries) this.wake(e.cable);
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
      const { x, y, px, py } = c;
      for (let i = 1; i < c.n - 4; i++) {
        for (let j = i + 3; j < Math.min(c.n - 2, i + 26); j++) {
          if (!segX(x[i], y[i], x[i + 1], y[i + 1], x[j], y[j], x[j + 1], y[j + 1])) continue;
          let blocked = false;
          for (let k = i + 1; k <= j && !blocked; k++) blocked = !!c.pin[k];
          if (!blocked) blocked = this.ties.some((t) => t.entries.some((e) => e.cable === c && e.idx > i && e.idx <= j));
          if (blocked) continue;
          for (let a = i + 1, b = j; a < b; a++, b--) {
            let t = x[a]; x[a] = x[b]; x[b] = t;
            t = y[a]; y[a] = y[b]; y[b] = t;
            t = px[a]; px[a] = px[b]; px[b] = t;
            t = py[a]; py[a] = py[b]; py[b] = t;
          }
          this.wakeIsland(c);
          c.untwists++;
          i = j;
          break;
        }
      }
    }
  }

  private computePins() {
    this.PIN.fill(0);
    for (const c of this.cables) {
      for (const e of c.ends) {
        if (e.port) { c.pin[c.endIdx(e.which)] = 1; c.pin[c.innerIdx(e.which)] = 1; }
      }
    }
    const g = this.grab;
    if (g?.kind === 'plug' && g.end) g.end.cable.pin[g.end.cable.endIdx(g.end.which)] = 1;
    if (g?.kind === 'cable' && g.cable && g.idx !== undefined) g.cable.pin[g.idx] = 1;
    for (const t of this.ties) if (t.t >= 1) for (const e of t.entries) e.cable.pin[e.idx] = 1;
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

  private solveDist() {
    for (const c of this.cables) {
      if (this.sleep[c.id]) continue;
      const { x, y, pin, seg } = c;
      for (let i = 0; i < c.n - 1; i++) {
        const dx = x[i + 1] - x[i], dy = y[i + 1] - y[i];
        const d = Math.hypot(dx, dy) || 0.0001;
        const w1 = pin[i] ? 0 : 1, w2 = pin[i + 1] ? 0 : 1;
        const ws = w1 + w2;
        if (!ws) continue;
        const k = (d - seg) / d / ws;
        x[i] += dx * k * w1; y[i] += dy * k * w1;
        x[i + 1] -= dx * k * w2; y[i + 1] -= dy * k * w2;
      }
    }
  }

  private solveBend() {
    for (const c of this.cables) {
      if (this.sleep[c.id]) continue;
      const { x, y, pin } = c;
      const min = c.seg * 1.82;
      for (let i = 0; i < c.n - 2; i++) {
        const dx = x[i + 2] - x[i], dy = y[i + 2] - y[i];
        const d = Math.hypot(dx, dy) || 0.0001;
        if (d >= min) continue;
        const w1 = pin[i] ? 0 : 1, w2 = pin[i + 2] ? 0 : 1;
        const ws = w1 + w2;
        if (!ws) continue;
        const k = ((d - min) / d / ws) * 0.5;
        x[i] += dx * k * w1; y[i] += dy * k * w1;
        x[i + 2] -= dx * k * w2; y[i + 2] -= dy * k * w2;
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
    if (g?.kind === 'plug' && g.end) {
      const c = g.end.cable, i = c.endIdx(g.end.which);
      c.x[i] = clamp(g.x - g.ox, 8, W - 8); c.y[i] = clamp(g.y - g.oy, 8, FLOOR);
    } else if (g?.kind === 'cable' && g.cable && g.idx !== undefined) {
      g.cable.x[g.idx] = clamp(g.x, 8, W - 8); g.cable.y[g.idx] = clamp(g.y, 8, FLOOR);
    } else if (g?.kind === 'tie' && g.tie) {
      g.tie.x = clamp(g.x - g.ox, 20, W - 20); g.tie.y = clamp(g.y - g.oy, 20, FLOOR - 10);
    }
    for (const t of this.ties) {
      const k = t.t >= 1 ? 1 : 0.25 * t.t;
      for (const e of t.entries) {
        const tx = t.x + t.nx * e.off, ty = t.y + t.ny * e.off;
        e.cable.x[e.idx] += (tx - e.cable.x[e.idx]) * k;
        e.cable.y[e.idx] += (ty - e.cable.y[e.idx]) * k;
      }
    }
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
  pointerDown(x: number, y: number, tieMode: boolean): boolean {
    this.pointer = { x, y };
    if (tieMode) { this.placeTie(x, y); return false; }
    this.wakeAll();
    // plugs
    let bestE: End | null = null, bd = 34;
    for (const c of this.cables) for (const e of c.ends) {
      const g = this.plugGeom(e);
      const d = Math.min(Math.hypot(g.cx - x, g.cy - y), Math.hypot(g.ex - x, g.ey - y) + 4);
      if (d < bd) { bd = d; bestE = e; }
    }
    if (bestE) {
      const c = bestE.cable, i = c.endIdx(bestE.which);
      if (bestE.port) {
        bestE.port.end = null; bestE.port = null;
        this.onEvent({ type: 'unplug' });
        this.refreshAll();
      } else this.onEvent({ type: 'grab' });
      this.grab = { kind: 'plug', end: bestE, ox: x - c.x[i], oy: y - c.y[i], x, y, sx: x, sy: y, moved: false };
      this.raise(c);
      return true;
    }
    // ties
    for (const t of this.ties) {
      if (Math.hypot(t.x - x, t.y - y) < 26) {
        this.grab = { kind: 'tie', tie: t, ox: x - t.x, oy: y - t.y, x, y, sx: x, sy: y, moved: false };
        return true;
      }
    }
    // cable body
    let bc: Cable | null = null, bi = -1; bd = 22;
    for (const c of this.order) for (let i = 0; i < c.n; i++) {
      const d = Math.hypot(c.x[i] - x, c.y[i] - y);
      if (d <= bd) {
        const plugged = (i <= 1 && c.ends[0].port) || (i >= c.n - 2 && c.ends[1].port);
        if (plugged) continue;
        bd = d; bc = c; bi = i;
      }
    }
    if (bc) {
      this.grab = { kind: 'cable', cable: bc, idx: bi, ox: 0, oy: 0, x, y, sx: x, sy: y, moved: false };
      this.raise(bc);
      this.onEvent({ type: 'grab' });
      return true;
    }
    return false;
  }

  pointerMove(x: number, y: number) {
    this.pointer = { x, y };
    const g = this.grab;
    if (!g) return;
    g.x = x; g.y = y;
    if (Math.hypot(x - g.sx, y - g.sy) > 8) g.moved = true;
    if (g.kind === 'plug' && g.end) {
      const pg = this.plugGeom(g.end);
      let best: Port | null = null, bd = SNAP_R;
      for (const p of this.ports) {
        if (p.end) continue;
        const d = Math.min(Math.hypot(pg.tx - p.x, pg.ty - p.y), Math.hypot(x - p.x, y - p.y) + 6);
        if (d < bd) { bd = d; best = p; }
      }
      this.hoverPort = best;
    }
  }

  pointerUp() {
    const g = this.grab;
    this.grab = null;
    if (!g) return;
    this.wakeAll();
    if (g.kind === 'plug' && g.end && this.hoverPort) {
      const p = this.hoverPort, e = g.end;
      p.end = e; e.port = p; p.pulse = 1;
      const c = e.cable;
      const a = portAnchor(p), b = portAnchor(p, SEG);
      const i = c.endIdx(e.which), j = c.innerIdx(e.which);
      c.x[i] = c.px[i] = a.x; c.y[i] = c.py[i] = a.y;
      c.x[j] = c.px[j] = b.x; c.y[j] = c.py[j] = b.y;
      const colorMatch = p.color === c.color;
      const done = c.valid();
      this.fx.push({ x: p.x, y: p.y, t: 0, color: colorMatch ? '#7dffb0' : '#ff8a8a', kind: 'ring' });
      if (done) this.fx.push({ x: p.x, y: p.y, t: 0, color: '#fff3a8', kind: 'spark' });
      this.onEvent({ type: 'snap', colorMatch, cableDone: done });
      this.refreshAll();
    } else if (g.kind === 'tie' && g.tie && !g.moved) {
      this.ties = this.ties.filter((t) => t !== g.tie);
      this.tiesLeft++;
      this.onEvent({ type: 'snip' });
    }
    this.hoverPort = null;
  }

  private raise(c: Cable) {
    this.order = this.order.filter((o) => o !== c);
    this.order.push(c);
  }

  private refreshAll() {
    const good = this.cables.every((c) => c.valid());
    if (good && !this.allGood) this.onEvent({ type: 'allgood' });
    if (!good && this.allGood) this.onEvent({ type: 'broken' });
    this.allGood = good;
  }

  placeTie(x: number, y: number): boolean {
    if (this.tiesLeft <= 0) { this.onEvent({ type: 'toast', text: 'No cable ties left. Tap a tie to remove it.' }); return false; }
    const cands: { cable: Cable; idx: number; d: number }[] = [];
    for (const c of this.cables) {
      let bi = -1, bd = TIE_R;
      for (let i = 3; i < c.n - 3; i++) {
        const d = Math.hypot(c.x[i] - x, c.y[i] - y);
        if (d < bd) { bd = d; bi = i; }
      }
      if (bi < 0) continue;
      const clash = this.ties.some((t) => t.entries.some((e) => e.cable === c && Math.abs(e.idx - bi) < 5));
      if (!clash) cands.push({ cable: c, idx: bi, d: bd });
    }
    const groups = new Map<ColorKey, typeof cands>();
    for (const c of cands) {
      const g = groups.get(c.cable.color) ?? [];
      g.push(c); groups.set(c.cable.color, g);
    }
    let chosen: typeof cands | null = null;
    for (const g of groups.values()) {
      if (g.length < 2) continue;
      if (!chosen || g.length > chosen.length ||
        (g.length === chosen.length && g.reduce((s, e) => s + e.d, 0) < chosen.reduce((s, e) => s + e.d, 0))) chosen = g;
    }
    if (!chosen) {
      this.onEvent({ type: 'toast', text: 'Tie where 2+ cables of the SAME color run close together.' });
      return false;
    }
    // average tangent
    let tx = 0, ty = 0, cx = 0, cy = 0;
    let rx = 0, ry = 0;
    chosen.forEach((e, k) => {
      const c = e.cable, i = e.idx;
      let dx = c.x[i + 1] - c.x[i - 1], dy = c.y[i + 1] - c.y[i - 1];
      const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      if (k === 0) { rx = dx; ry = dy; } else if (dx * rx + dy * ry < 0) { dx = -dx; dy = -dy; }
      tx += dx; ty += dy; cx += c.x[i]; cy += c.y[i];
    });
    const tl = Math.hypot(tx, ty) || 1;
    tx /= tl; ty /= tl;
    cx /= chosen.length; cy /= chosen.length;
    const nx = -ty, ny = tx;
    const sorted = [...chosen].sort((a, b) =>
      ((a.cable.x[a.idx] - cx) * nx + (a.cable.y[a.idx] - cy) * ny) - ((b.cable.x[b.idx] - cx) * nx + (b.cable.y[b.idx] - cy) * ny));
    const m = sorted.length;
    const tie: Tie = {
      x: cx, y: cy, nx, ny, color: chosen[0].cable.color, t: 0,
      entries: sorted.map((e, k) => ({ cable: e.cable, idx: e.idx, off: (k - (m - 1) / 2) * REP_R })),
    };
    this.ties.push(tie);
    this.tiesLeft--;
    this.wakeAll();
    this.fx.push({ x: cx, y: cy, t: 0, color: '#ffffff', kind: 'ring' });
    this.onEvent({ type: 'tie' });
    return true;
  }

  // ---------------------------------------------------------------- scoring
  countCrossings(): number {
    let total = 0;
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
        if (hit) { if (i - last > 3) total++; last = i; }
      }
    }
    for (let a = 0; a < cs.length; a++) for (let b = a + 1; b < cs.length; b++) {
      const A = bb[a], B = bb[b];
      if (A.x1 < B.x0 || B.x1 < A.x0 || A.y1 < B.y0 || B.y1 < A.y0) continue;
      const ca = cs[a], cb = cs[b];
      // twists inside one tied bundle of the same color are fine
      if (ca.color === cb.color && this.ties.some((t) => t.entries.some((e) => e.cable === ca) && t.entries.some((e) => e.cable === cb))) continue;
      const hits: number[] = [];
      for (let i = 0; i < ca.n - 1; i++) {
        for (let j = 0; j < cb.n - 1; j++) {
          if (segX(ca.x[i], ca.y[i], ca.x[i + 1], ca.y[i + 1], cb.x[j], cb.y[j], cb.x[j + 1], cb.y[j + 1])) { hits.push(i); break; }
        }
      }
      let last = -99;
      for (const h of hits) { if (h - last > 3) total++; last = h; }
    }
    return total;
  }

  smoothness(c: Cable): number {
    let turn = 0;
    const step = 3;
    let pdx = 0, pdy = 0, first = true;
    for (let i = 2; i + step < c.n - 1; i += step) {
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
    const s = clamp(1 - (deg - 110) / 300, 0, 1);
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
        if (t.color !== color) continue;
        best = Math.max(best, new Set(t.entries.map((e) => e.cable)).size);
      }
      if (best >= n) bundled++;
      frac += best >= 2 ? best / n : 0;
    }
    const bundleScore = bundleGroups ? frac / bundleGroups : 1;
    const score = Math.round(10 * (connected / total) + 40 * crossScore + 25 * smooth + 25 * bundleScore);
    const stars = connected < total ? 0 : score >= 90 ? 3 : score >= 75 ? 2 : 1;
    return { connected, total, crossings, crossScore, smooth, bundled, bundleGroups, bundleScore, score, stars };
  }

  /** debug helper: solve connections instantly (used for automated tests only) */
  debugSolve() {
    for (const p of this.ports) p.end = null;
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

export function clamp(v: number, a: number, b: number) { return v < a ? a : v > b ? b : v; }

function segX(ax: number, ay: number, bx: number, by: number, cx: number, cy: number, dx: number, dy: number) {
  const d1 = (dx - cx) * (ay - cy) - (dy - cy) * (ax - cx);
  const d2 = (dx - cx) * (by - cy) - (dy - cy) * (bx - cx);
  const d3 = (bx - ax) * (cy - ay) - (by - ay) * (cx - ax);
  const d4 = (bx - ax) * (dy - ay) - (by - ay) * (dx - ax);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
