/**
 * Gameplay test — run with `npm run test:tools`.
 * Exercises plug grabbing and every tool / fixture headless, through the same pointer API the
 * game uses, and checks that every job can still reach 3 stars with the tools it hands out.
 */
import { Game, GRAB_R, portAnchor, type Cable, type Port } from '../src/game';
import { LEVELS, type LevelDef } from '../src/levels';

let failures = 0;
function check(name: string, ok: boolean, info = '') {
  if (!ok) failures++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name} ${info}`);
}
const run = (g: Game, s: number) => { for (let i = 0; i < s * 60; i++) g.step(1 / 60); };
const level = (key: string): LevelDef => LEVELS.find((l) => l.key === key)!;
const events = (g: Game) => { const log: string[] = []; g.onEvent = (e) => log.push(e.type); return log; };
function drag(g: Game, pts: [number, number][], tool: Parameters<Game['pointerDown']>[2] = 'hand', frames = 30) {
  g.pointerDown(...pts[0], tool);
  for (let k = 1; k < pts.length; k++) for (let f = 1; f <= frames; f++) {
    const a = pts[k - 1], b = pts[k];
    g.pointerMove(a[0] + (b[0] - a[0]) * (f / frames), a[1] + (b[1] - a[1]) * (f / frames));
    g.step(1 / 60);
  }
}
function tap(g: Game, x: number, y: number) { g.pointerDown(x, y); g.step(1 / 60); g.pointerUp(); g.step(1 / 60); }
const byColor = (g: Game) => {
  const m = new Map<string, Cable[]>();
  for (const c of g.cables) m.set(c.color, [...(m.get(c.color) ?? []), c]);
  return [...m.values()].filter((v) => v.length > 1);
};
const mid = (cs: Cable[], k = 0.5) => {
  const at = (c: Cable) => { const y0 = c.y[0] < c.y[c.n - 1]; return Math.round((c.n - 1) * (y0 ? k : 1 - k)); };
  return { x: cs.reduce((s, c) => s + c.x[at(c)], 0) / cs.length, y: cs.reduce((s, c) => s + c.y[at(c)], 0) / cs.length };
};

// ---- grabbing plug heads
for (const L of LEVELS) {
  const g = new Game(L);
  run(g, 3);
  // every head can be picked by pressing anywhere within 12 px of it, and a wide ring around
  // isolated heads still gets it
  let ok = 0, n = 0, far = 0, farN = 0;
  const heads = g.cables.flatMap((c) => c.ends.map((e) => ({ e, p: g.plugGeom(e) })));
  for (const h of heads) {
    const nn = Math.min(...heads.filter((o) => o !== h).map((o) => Math.hypot(o.p.cx - h.p.cx, o.p.cy - h.p.cy)));
    n++;
    const k = g.pick(h.p.cx, h.p.cy);
    if (k?.kind === 'plug' && (k.end === h.e || nn < 24)) ok++;
    if (nn > 90) for (let a = 0; a < 8; a++) {
      farN++;
      const q = g.pick(h.p.cx + Math.cos(a) * (GRAB_R - 8), h.p.cy + Math.sin(a) * (GRAB_R - 8));
      if (q?.kind === 'plug' && q.end === h.e) far++;
    }
  }
  check(`${L.key}: heads pickable`, ok === n && far >= farN * 0.75, `${ok}/${n} direct, ${far}/${farN} from ${GRAB_R - 8}px away`);
}
{
  const g = new Game(level('rosa'));
  g.debugSolve(); run(g, 2);
  const log = events(g);
  const e = g.cables[0].ends[0], p = e.port!, q = g.plugGeom(e);
  tap(g, q.cx, q.cy); run(g, 1);
  check('tap does not unplug', e.port === p && !log.includes('unplug'));
  drag(g, [[q.cx, q.cy], [q.cx, q.cy + 120]]);
  check('pull pops the plug out', e.port === null && log.includes('unplug'));
  const a = portAnchor(p, 0);
  drag(g, [[q.cx, q.cy + 120], [a.x + 30, a.y + 24]]);
  check('magnet finds the port', g.hoverPort === p);
  g.pointerUp(); run(g, 0.5);
  check('plugs in and seats', e.port === p && log.includes('snap') && p.out < 0.1);
}
{ // swap: dropping the right cable on a port taken by a wrong one
  const g = new Game(level('cafe'));
  const wrong = g.ports.find((p) => p.end && p.end.cable.color !== p.color && g.cables.some((c) => c.color === p.color && c.ends.some((e) => !e.port)));
  if (wrong) {
    const c = g.cables.find((o) => o.color === wrong.color && o.ends.some((e) => !e.port))!;
    const e = c.ends.find((o) => !o.port)!, q = g.plugGeom(e);
    const log = events(g);
    drag(g, [[q.cx, q.cy], [wrong.x, wrong.y + wrong.dir * 30]], 'hand', 60);
    g.pointerUp(); run(g, 1);
    check('swap ejects the wrong plug', wrong.end === e || Math.hypot(q.cx - wrong.x, q.cy - wrong.y) > c.length, log.join(','));
  }
}
// ---- zip: place, trim, remove
{
  const g = new Game(level('cafe'));
  g.debugSolve(); run(g, 3);
  const log = events(g), grp = byColor(g)[0], m = mid(grp);
  check('zip gathers', g.useTool('zip', m.x, m.y) && g.ties.at(-1)!.entries.length === grp.length);
  run(g, 1);
  const t = g.ties.at(-1)!;
  tap(g, t.x, t.y); check('tap trims the tail', log.includes('trim') && t.tail === 0);
  tap(g, t.x, t.y); check('tap again removes it', log.includes('snip') && !g.ties.includes(t) && g.left.zip === 2);
}
// ---- reel
{
  const g = new Game(level('desk'));
  g.debugSolve(); run(g, 4);
  const c = g.cables[0], log = events(g), i = c.n >> 1;
  check('reel clips on', g.useTool('reel', c.x[i], c.y[i]) && g.reels.length === 1);
  const r = g.reels[0], sm = g.smoothness(c);
  g.pointerDown(c.x[r.idx], c.y[r.idx]);
  for (let f = 0; f < 60 * 4; f++) g.step(1 / 60);
  g.pointerUp(); run(g, 3);
  check('holding winds it taut', log.includes('windTight') && g.wound(r) > 80 && g.smoothness(c) > Math.max(0.9, sm - 0.01), `wound ${g.wound(r).toFixed(0)}px, smooth ${sm.toFixed(2)} -> ${g.smoothness(c).toFixed(2)}`);
  check('wound cable sleeps', g.isAsleep(c));
  const e = c.ends[1], q = g.plugGeom(e), w0 = g.wound(r);
  drag(g, [[q.cx, q.cy], [q.cx + 60, 860], [690, 860]], 'hand', 60);
  check('pulling pays cable out', g.wound(r) < w0 - 20 && log.includes('payout'), `${w0.toFixed(0)} -> ${g.wound(r).toFixed(0)}`);
  g.pointerUp(); run(g, 1);
  tap(g, c.x[r.idx], c.y[r.idx]); check('tap unspools', g.wound(r) === 0);
}
// ---- hooks
{
  const g = new Game(level('desk'));
  g.debugSolve(); run(g, 4);
  const h = g.hooks[0], log = events(g);
  const c = g.cables[0], i = c.n >> 1;
  drag(g, [[c.x[i], c.y[i]], [h.x, h.y]], 'hand', 60); g.pointerUp(); run(g, 4);
  const en = h.tie.entries[0];
  check('cable hooks on', !!en && log.includes('hook') && Math.hypot(en.cable.x[en.idx] - h.x, en.cable.y[en.idx] - h.y) < 14);
  const hc = en.cable;
  check('hooked cable sleeps', g.isAsleep(hc));
  drag(g, [[hc.x[en.idx], hc.y[en.idx]], [h.x + 90, h.y + 60]]); g.pointerUp();
  check('pull unhooks', h.tie.entries.length === 0 && log.includes('unhook'));
}
// ---- duct + lid + screws
{
  const g = new Game(level('panel'));
  g.debugSolve(); run(g, 3);
  const d = g.ducts[0], log = events(g);
  for (const c of g.cables) g.ductCable(d, c, c.n >> 1);
  run(g, 6);
  check('duct lanes', d.st.every((t) => t.entries.length === 6) && g.cables.every((c) => g.isAsleep(c)), `asleep ${g.cables.filter((c) => g.isAsleep(c)).length}/6`);
  const h = g.lidHandle(d);
  drag(g, [[h.x, h.y], [h.x, d.y + d.h + 10]], 'hand', 60); g.pointerUp();
  check('lid snaps shut', d.lid === 1 && log.includes('lidDone'));
  run(g, 6);
  check('closed duct swallows slack and rests', g.cables.every((c) => g.isAsleep(c)) && g.countCrossings() === 0, `crossings ${JSON.stringify(g.crossPts)}, asleep ${g.cables.filter((c) => g.isAsleep(c)).length}/6`);
  check('closed duct hides cables', g.pick(d.x + d.w / 2, d.y + d.h / 2)?.kind === 'lid');
  for (const p of g.ports) { g.pointerDown(p.x, p.y, 'screw'); for (let f = 0; f < 60; f++) g.step(1 / 60); g.pointerUp(); }
  check('screws tighten', g.ports.every((p) => p.tight === 1) && log.filter((e) => e === 'screwDone').length === g.ports.length);
  tap(g, d.x + d.w / 2, d.y + d.h / 2); check('tap reopens lid', d.lid === 0);
}
// ---- comb, velcro, label
{
  const g = new Game(level('pixel'));
  g.debugSolve(); run(g, 3);
  const log = events(g), m0 = mid(g.cables.slice(0, 6), 0.25), m1 = mid(g.cables.slice(0, 6), 0.8);
  // reachable targets: follow the cables' own run
  drag(g, [[m0.x, m0.y], [m1.x, m1.y]], 'comb', 60); g.pointerUp(); run(g, 4);
  const st = g.ties.filter((t) => t.kind === 'comb');
  check('comb lays lanes', st.length >= 4 && log.includes('combDone'), `${st.length} stations, ${st[0]?.entries.length} cables`);
  check('combed cables sleep', g.cables.every((c) => g.isAsleep(c)));
  const mids = st[2];
  check('velcro straps mixed colors', g.useTool('velcro', mids.x, mids.y) && new Set(g.ties.at(-1)!.entries.map((e) => e.cable.color)).size > 1);
  const c = g.cables[0];
  check('label prints', g.useTool('label', c.x[6], c.y[6]) && c.label > 0);
  run(g, 1);
  const e = st[st.length - 1];
  tap(g, st[0].x, st[0].y);
  check('tap removes comb', !g.ties.some((t) => t.kind === 'comb'), `${e.entries.length}`);
}
// ---- wrap
{
  const g = new Game(level('radio'));
  g.debugSolve(); run(g, 4);
  const log = events(g), grp = byColor(g)[0], a = mid(grp, 0.3), b = mid(grp, 0.6);
  drag(g, [[a.x, a.y], [b.x, b.y]], 'wrap', 60); g.pointerUp(); run(g, 4);
  check('spiral wraps a bundle', log.includes('wrapDone') && g.left.wrap === 2, `${g.ties.filter((t) => t.kind === 'wrap').length} stations`);
  check('wrapped cables sleep', grp.every((c) => g.isAsleep(c)));
}
// ---- air
{
  const g = new Game(level('rosa')), log = events(g);
  for (const d of g.level.devices) {
    const pts: [number, number][] = [];
    for (let y = d.y + 10; y < d.y + d.h; y += 30) pts.push([d.x, y], [d.x + d.w, y]);
    drag(g, pts, 'air', 45); g.pointerUp();
  }
  check('dust blows away', log.includes('dustDone'), `${g.dust.filter((d) => !d.gone).length} left`);
  run(g, 8);
  check('settles after the jet', g.cables.every((c) => g.isAsleep(c)));
}
// ---- power-up
{
  const g = new Game(level('cloud')), log = events(g);
  g.debugSolve(); g.powerOn(); run(g, 5);
  check('power sequence', log.filter((e) => e === 'pulse').length === g.cables.length && log.includes('powered'));
}

// ---- every job can reach 3 stars with the tools provided
console.log('');
for (const L of LEVELS) {
  const g = new Game(L);
  g.debugSolve(); run(g, 4);
  for (const d of g.ducts) { for (const c of g.cables) g.ductCable(d, c, c.n >> 1); run(g, 5); d.lid = 1; g.wakeAll(); run(g, 4); }
  if (g.left.reel) {
    const worst = [...g.cables].sort((a, b) => g.smoothness(a) - g.smoothness(b));
    for (const c of worst.slice(0, g.left.reel)) {
      const i = c.n >> 1;
      g.useTool('reel', c.x[i], c.y[i]);
      const r = g.reels.find((o) => o.cable === c);
      if (!r) continue;
      g.pointerDown(c.x[r.idx], c.y[r.idx]);
      if (g.grab?.kind === 'reel') for (let f = 0; f < 240; f++) g.step(1 / 60);
      g.pointerUp();
    }
    run(g, 2);
  }
  if (!g.ducts.length) for (const grp of byColor(g)) {
    for (const k of [0.5, 0.42, 0.58, 0.35, 0.65]) {
      const m = mid(grp, k);
      const kind = g.left.zip ? 'zip' : g.left.velcro ? 'velcro' : 'wrap';
      if (kind === 'wrap') {
        const b = mid(grp, k + 0.25);
        drag(g, [[m.x, m.y], [b.x, b.y]], 'wrap', 50); g.pointerUp(); run(g, 0.5);
        if (g.ties.some((t) => t.kind === 'wrap' && grp.every((c) => t.entries.some((e) => e.cable === c)))) break;
      } else {
        const n = g.ties.length;
        if (!g.useTool(kind, m.x, m.y)) continue;
        if (grp.every((c) => g.ties.at(-1)!.entries.some((e) => e.cable === c))) break;
        run(g, 0.5); const t = g.ties.at(-1)!; if (g.ties.length > n) { t.tail = 0; tap(g, t.x, t.y); }
      }
    }
    run(g, 1);
  }
  run(g, 3);
  for (const t of g.ties) t.tail = 0;
  g.dust = [];
  for (const c of g.cables) c.label = 1;
  for (const p of g.ports) p.tight = 1;
  const ev = g.evaluate();
  check(`${L.key}: 3 stars reachable`, ev.stars === 3, `score ${ev.score} cross ${ev.crossings} smooth ${ev.smooth.toFixed(2)} bundles ${ev.bundled}/${ev.bundleGroups} finish ${ev.finish.toFixed(2)}`);
}
console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll tools work ✓');
process.exit(failures ? 1 : 0);
