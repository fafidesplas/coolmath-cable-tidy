import './style.css';
import { Game, W, H, Evaluation, GameEvent } from './game';
import { LEVELS, COLORS, type ColorKey } from './levels';
import { ALL_TOOLS, TOOLS, UNLIMITED, type ToolId } from './tools';
import { badgeSvg } from './symbols';
import { drawScene } from './render';
import * as sfx from './audio';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const cv = $<HTMLCanvasElement>('cv');
const ctx = cv.getContext('2d')!;
const stage = $('stage');
const overlay = $('overlay');
const tray = $('tray');
const btnFinish = $<HTMLButtonElement>('btn-finish');
const btnSound = $<HTMLButtonElement>('btn-sound');

const SOUND_ON = '<svg viewBox="0 0 24 24"><path d="M4 10v4h4l5 4V6L8 10H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
const SOUND_OFF = '<svg viewBox="0 0 24 24"><path d="M4 10v4h4l5 4V6L8 10H4z"/><path d="M17 10l4 4M21 10l-4 4"/></svg>';
const STAR = '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>';

let game: Game | null = null;
let levelIdx = 0;
let tool: ToolId = 'hand';
/** correct plugs in a row: the chime climbs a scale */
let combo = 0;
/** a tap-tool press in progress: becomes a tool use unless it turns into a drag */
let pressed: { x: number; y: number; t: number } | null = null;
let doneTasks = new Set<string>();
let paused = true;
let beforeShot = '';
let scale = 1, offX = 0, offY = 0, dpr = 1;
let pointerId: number | null = null;
let hintTimer = 0;
let toastTimer = 0;

/** stars by level key (older saves were a plain array of the first five jobs) */
const saved: Record<string, number> = (() => {
  try {
    const v = JSON.parse(localStorage.getItem('cablecalm.stars') || '{}');
    if (!Array.isArray(v)) return v ?? {};
    const old = ['rosa', 'cafe', 'panel', 'pixel', 'cloud'];
    return Object.fromEntries(v.map((n, i) => [old[i], n]).filter(([k, n]) => k && n));
  } catch { return {}; }
})();
const starsOf = (i: number) => saved[LEVELS[i].key] ?? 0;
/** review shortcut: add ?all to the URL to open every job */
const openAll = new URLSearchParams(location.search).has('all');
/** a job is open if it is the first, was already done, or the one before it is done */
const unlocked = (i: number) => openAll || i === 0 || starsOf(i) > 0 || starsOf(i - 1) > 0;
const saveStars = () => localStorage.setItem('cablecalm.stars', JSON.stringify(saved));

// ---------------------------------------------------------------- layout
function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = stage.getBoundingClientRect();
  cv.width = Math.round(r.width * dpr);
  cv.height = Math.round(r.height * dpr);
  scale = Math.min(r.width / W, r.height / H);
  offX = (r.width - W * scale) / 2;
  offY = (r.height - H * scale) / 2;
}
window.addEventListener('resize', resize);

function toWorld(e: PointerEvent) {
  const r = cv.getBoundingClientRect();
  return { x: (e.clientX - r.left - offX) / scale, y: (e.clientY - r.top - offY) / scale };
}

// ---------------------------------------------------------------- ui helpers
function toast(text: string) {
  const t = $('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => t.classList.remove('show'), 2200);
}

function hint(text: string, ms = 6000) {
  const h = $('hint');
  h.textContent = text;
  h.classList.add('show');
  clearTimeout(hintTimer);
  hintTimer = window.setTimeout(() => h.classList.remove('show'), ms);
}

function setTool(t: ToolId, quiet = false) {
  if (!game) t = 'hand';
  else if (t !== 'hand' && !game.level.tools[t]) return;
  if (tool !== t && game) game.cancelGrab();
  sfx.airOff();
  tool = t;
  tray.querySelectorAll<HTMLButtonElement>('.ttool').forEach((b) => {
    b.classList.toggle('active', b.dataset.t === t);
    b.setAttribute('aria-pressed', String(b.dataset.t === t));
  });
  if (!quiet && t !== 'hand') hint(TOOLS[t].hint, 4500);
  else if (!quiet) $('hint').classList.remove('show');
  updateCursor();
}

function levelTools(): ToolId[] {
  return game ? ALL_TOOLS.filter((t) => t === 'hand' || game!.level.tools[t]) : [];
}

function buildTray() {
  tray.innerHTML = levelTools().map((t, i) => `
    <button class="ttool" data-t="${t}" title="${TOOLS[t].name} (${i + 1})" aria-label="${TOOLS[t].name}">
      ${TOOLS[t].icon}<span>${TOOLS[t].name}</span><b class="n" hidden></b>
    </button>`).join('');
  tray.querySelectorAll<HTMLButtonElement>('.ttool').forEach((b) => {
    b.onclick = () => {
      if (!game || paused || game.power >= 0) return;
      sfx.unlockAudio(); sfx.sfxUi();
      const t = b.dataset.t as ToolId;
      setTool(tool === t ? 'hand' : t);
    };
  });
}

function updateHud() {
  if (!game) return;
  const n = game.connectedCount(), t = game.cables.length;
  const conn = $('conn');
  conn.textContent = `${n}/${t}`;
  conn.title = n === t ? 'All connections working' : 'Some connections not working yet';
  conn.classList.toggle('ok', n === t);
  tray.querySelectorAll<HTMLButtonElement>('.ttool').forEach((b) => {
    const k = b.dataset.t as ToolId, left = game!.left[k], el = b.querySelector<HTMLElement>('.n')!;
    el.hidden = k === 'hand' || left >= UNLIMITED;
    el.textContent = String(left);
    b.classList.toggle('empty', k !== 'hand' && left <= 0);
  });
  btnFinish.disabled = !game.allGood || game.power >= 0;
}

function updateMeter() {
  if (!game) return;
  const ev = game.evaluate();
  $('meter-fill').style.width = `${ev.score}%`;
  const box = $('tasks');
  const list = [...ev.tasks.slice(0, 1), { id: 'cross', label: 'Crossings', done: ev.crossings ? 0 : 1, total: 1 }, ...ev.tasks.slice(1)];
  // keep the chips in place and only touch what changed, so the tick animation plays once
  for (const t of list) {
    let el = box.querySelector<HTMLElement>(`[data-id="${t.id}"]`);
    if (!el) { el = document.createElement('div'); el.className = 'task'; el.dataset.id = t.id; box.append(el); }
    const ok = t.done >= t.total && (t.id !== 'cross' || game.allGood);
    const text = t.id === 'cross' ? `Crossings ${ev.crossings}` : t.id === 'dust' ? `${t.label} ${Math.floor((t.done / t.total) * 100)}%` : `${t.label} ${Math.floor(t.done)}/${t.total}`;
    if (el.textContent !== text) el.textContent = text;
    el.classList.toggle('ok', ok);
    if (ok) doneTasks.add(t.id); else doneTasks.delete(t.id);
  }
  box.querySelectorAll<HTMLElement>('.task').forEach((el) => { if (!list.some((t) => t.id === el.dataset.id)) el.remove(); });
}

function starsHtml(n: number) {
  return [0, 1, 2].map((i) => `<span class="${i < n ? '' : 'off'}">★</span>`).join('');
}

function showOverlay(html: string) {
  overlay.innerHTML = html;
  overlay.classList.add('show');
  paused = true;
}
function hideOverlay() {
  overlay.classList.remove('show');
  overlay.innerHTML = '';
  paused = false;
}

// ---------------------------------------------------------------- screens
function titleScreen() {
  game = null; buildTray(); $('tasks').innerHTML = '';
  showOverlay(`
    <div class="card title-card">
      <svg class="logo-cables" viewBox="0 0 300 90">
        <path d="M10 20 C 90 20, 110 70, 290 70" stroke="${COLORS.blue.base}"/>
        <path d="M10 45 C 100 45, 120 45, 290 45" stroke="${COLORS.yellow.base}" style="animation-delay:.2s"/>
        <path d="M10 70 C 90 70, 110 20, 290 20" stroke="${COLORS.orange.base}" style="animation-delay:.4s"/>
      </svg>
      <div class="logo"><span>Cable</span> <span>Calm</span></div>
      <p class="tagline">Untangle. Click. Zip. Breathe.<br/>A cozy job simulator for cable tidiers.</p>
      <div class="row"><button class="btn green" id="go-play">Play</button></div>
      <p style="font-size:12px;opacity:.55;margin-top:14px">Plug · comb · wind · wrap · zip · label · power on</p>
      <p class="a11y-note">Colorblind-friendly: every color also has its own symbol ${(Object.keys(COLORS) as ColorKey[]).map((k) => badgeSvg(k, 18)).join('')}</p>
    </div>`);
  $('go-play').onclick = () => { sfx.unlockAudio(); sfx.sfxUi(); levelSelect(); };
}

function levelSelect() {
  game = null; buildTray(); $('tasks').innerHTML = '';
  const items = LEVELS.map((l, i) => {
    const locked = !unlocked(i);
    return `<button class="lvl" data-i="${i}" ${locked ? 'disabled' : ''}>
      <div class="num">${locked ? '🔒' : l.id}</div>
      <div class="info"><div class="t">${l.title}</div><div class="s">${l.tier} · ${l.client}</div></div>
      <div class="stars">${starsHtml(starsOf(i))}</div>
    </button>`;
  }).join('');
  showOverlay(`<div class="card"><h2>Job board</h2><p style="opacity:.7">Pick a job. Earn stars to unlock the next client.</p><div class="levels">${items}</div></div>`);
  overlay.querySelectorAll<HTMLButtonElement>('.lvl').forEach((b) => {
    b.onclick = () => { sfx.unlockAudio(); sfx.sfxUi(); startLevel(Number(b.dataset.i)); };
  });
}

function startLevel(i: number) {
  levelIdx = i;
  const L = LEVELS[i];
  game = new Game(L);
  game.onEvent = onGameEvent;
  beforeShot = snapshot(game);
  combo = 0; doneTasks = new Set(); pressed = null; pointerId = null;
  $('tasks').innerHTML = '';
  buildTray();
  setTool('hand', true);
  $('lvl-name').textContent = `${L.id}. ${L.title}`;
  $('lvl-sub').textContent = `${L.tier} · client: ${L.client}`;
  updateHud(); updateMeter();
  showOverlay(`
    <div class="card">
      <span class="tier">Job ${L.id} · ${L.tier}</span>
      <h2 style="margin-top:8px">${L.title}</h2>
      <div class="client">
        <div class="avatar" style="background:${L.avatar}">${L.client[0]}</div>
        <div class="bubble"><div class="who">${L.client}</div><div class="role">${L.clientRole}</div>${L.message}</div>
      </div>
      <ul class="goals">${L.goals.map((g) => `<li>${g}</li>`).join('')}</ul>
      ${(L.newTools ?? []).map((t) => `<div class="newtool"><div class="ic">${TOOLS[t].icon}</div><div><b>New: ${TOOLS[t].name}.</b> ${TOOLS[t].about}</div></div>`).join('')}
      ${legendHtml(L.ports.map((p) => p.color))}
      <div class="row"><button class="btn alt" id="b-back">Job board</button><button class="btn green" id="b-start">Start job</button></div>
    </div>`);
  $('b-back').onclick = () => { sfx.sfxUi(); levelSelect(); };
  $('b-start').onclick = () => {
    sfx.unlockAudio(); sfx.sfxUi();
    hideOverlay();
    hint(L.tip, 7000);
    for (const t of L.newTools ?? []) tray.querySelector(`[data-t="${t}"]`)?.classList.add('flash');
  };
}

/** Legend chips: colour + symbol + name + how many cables of it the job has. */
function legendHtml(portColors: ColorKey[]) {
  const counts = new Map<ColorKey, number>();
  for (const c of portColors) counts.set(c, (counts.get(c) ?? 0) + 1);
  const chips = [...counts].map(([c, n]) =>
    `<span class="chip">${badgeSvg(c)}<span>${COLORS[c].name}</span><small>×${n / 2}</small></span>`).join('');
  return `<div class="legend" aria-label="Cable colors in this job">${chips}</div>`;
}

function snapshot(g: Game): string {
  const k = 0.6;
  const c = document.createElement('canvas');
  c.width = W * k; c.height = H * k;
  const x = c.getContext('2d')!;
  x.scale(k, k);
  drawScene(x, g, { ui: false, tool: 'hand' });
  return c.toDataURL('image/jpeg', 0.85);
}

function finishLevel() {
  const L = LEVELS[levelIdx];
  if (!game || !game.allGood) return;
  setTool('hand', true);
  const ev: Evaluation = game.evaluate();
  const after = snapshot(game);
  saved[L.key] = Math.max(saved[L.key] ?? 0, ev.stars);
  saveStars();
  const hasNext = levelIdx < LEVELS.length - 1;
  const line = ev.stars === 3 ? `"${L.client}: It's... beautiful. I'm framing this."`
    : ev.stars === 2 ? `"${L.client}: Everything works and it looks great. Thank you!"`
      : `"${L.client}: It works! It's a little... spaghetti-ish, but it works."`;
  showOverlay(`
    <div class="card">
      <h2 style="text-align:center">Job done!</h2>
      <div class="result-stars">${STAR}${STAR}${STAR}</div>
      <div class="score">Tidiness score: <span id="score-num">0</span></div>
      <p style="text-align:center;font-size:14px;opacity:.75;margin-top:4px">${line}</p>
      <ul class="metrics">
        <li>Connections<b>${ev.connected}/${ev.total} ✓</b></li>
        <li>Crossings<b>${ev.crossings === 0 ? 'None ✓' : ev.crossings}</b></li>
        <li>Smooth runs<b>${Math.round(ev.smooth * 100)}%</b></li>
        <li>Color bundles<b>${ev.bundleGroups ? `${ev.bundled}/${ev.bundleGroups}` : '—'}</b></li>
        <li>Finishing touches<b>${Math.round(ev.finish * 100)}%</b></li>
      </ul>
      <div class="compare" id="cmp">
        <img class="after" src="${after}" alt="After"/>
        <img class="before" src="${beforeShot}" alt="Before"/>
        <div class="handle"></div>
        <span class="tag l">BEFORE</span><span class="tag r">AFTER</span>
      </div>
      <button class="linkbtn" id="b-side">Side by side</button>
      <div class="row">
        <button class="btn alt" id="b-retry">Retry</button>
        <button class="btn alt" id="b-board">Job board</button>
        ${hasNext ? '<button class="btn green" id="b-next">Next job</button>' : '<button class="btn green" id="b-end">The end ♥</button>'}
      </div>
    </div>`);
  // stars + count-up
  const svgs = overlay.querySelectorAll('.result-stars svg');
  svgs.forEach((s, i) => setTimeout(() => {
    s.classList.add('in');
    if (i < ev.stars) { s.classList.add('lit'); sfx.sfxStar(i); sfx.buzz(20); }
  }, 300 + i * 300));
  const num = $('score-num');
  const t0 = performance.now();
  const tick = () => {
    const k = Math.min(1, (performance.now() - t0) / 900);
    num.textContent = String(Math.round(ev.score * k));
    if (k < 1) requestAnimationFrame(tick);
  };
  tick();
  // compare slider
  const cmp = $('cmp');
  const setSplit = (clientX: number) => {
    const r = cmp.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * 100;
    (cmp.querySelector('.before') as HTMLElement).style.clipPath = `inset(0 ${100 - p}% 0 0)`;
    (cmp.querySelector('.handle') as HTMLElement).style.left = `${p}%`;
  };
  let dragging = false;
  cmp.addEventListener('pointerdown', (e) => { if (cmp.classList.contains('side')) return; dragging = true; cmp.setPointerCapture(e.pointerId); setSplit(e.clientX); });
  cmp.addEventListener('pointermove', (e) => { if (dragging) setSplit(e.clientX); });
  cmp.addEventListener('pointerup', () => { dragging = false; });
  $('b-side').onclick = () => {
    const side = cmp.classList.toggle('side');
    $('b-side').textContent = side ? 'Slider view' : 'Side by side';
  };
  $('b-retry').onclick = () => { sfx.sfxUi(); startLevel(levelIdx); };
  $('b-board').onclick = () => { sfx.sfxUi(); levelSelect(); };
  if (hasNext) $('b-next').onclick = () => { sfx.sfxUi(); startLevel(levelIdx + 1); };
  else $('b-end').onclick = () => { sfx.sfxUi(); endScreen(); };
}

function endScreen() {
  const total = LEVELS.reduce((a, _, i) => a + starsOf(i), 0);
  showOverlay(`<div class="card title-card">
    <div class="logo"><span>All</span> <span>tidy!</span></div>
    <p class="tagline">You finished every job in the prototype.<br/>Stars collected: <b>${total}/${LEVELS.length * 3}</b></p>
    <p style="font-size:13px;opacity:.6">More clients are on their way: offices, studios, stadiums, a space station…</p>
    <div class="row"><button class="btn green" id="b-board2">Job board</button></div>
  </div>`);
  $('b-board2').onclick = () => { sfx.sfxUi(); levelSelect(); };
}

function flash() {
  const f = $('flash');
  f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
}

// ---------------------------------------------------------------- events
function onGameEvent(e: GameEvent) {
  switch (e.type) {
    case 'snap':
      combo = e.cableDone ? combo + 1 : e.colorMatch ? combo : 0;
      sfx.sfxSnap(e.colorMatch, e.cableDone, Math.max(0, combo - 1));
      sfx.buzz(e.colorMatch ? (e.cableDone ? [18, 40, 25] : 18) : [10, 30, 10]);
      if (!e.colorMatch) toast('Wrong port! Its LED shows ✕ — match the color and symbol.');
      break;
    case 'unplug': sfx.sfxUnplug(); sfx.buzz(12); break;
    case 'eject': sfx.sfxPop(); break;
    case 'magnet': sfx.sfxMagnet(); sfx.buzz(4); break;
    case 'grab': sfx.sfxGrab(); break;
    case 'strain': sfx.sfxStrain(); sfx.buzz(15); break;
    case 'tie': sfx.sfxZip(); sfx.buzz([6, 20, 6, 20, 6, 20, 14]); break;
    case 'flick': sfx.sfxPop(); sfx.buzz(14); break;
    case 'trim': sfx.sfxTrim(); sfx.buzz([8, 20, 14]); break;
    case 'snip': sfx.sfxSnip(); sfx.buzz(10); break;
    case 'velcro': sfx.sfxVelcro(); sfx.buzz([8, 10, 8, 10, 20]); break;
    case 'rip': sfx.sfxRip(); sfx.buzz([5, 10, 5, 10, 5, 10, 5]); break;
    case 'reel': sfx.sfxHook(); sfx.buzz(14); hint('Press and hold the reel to wind up the slack. Tap it to let the cable out.', 4500); break;
    case 'wind': sfx.sfxWind(e.k); sfx.buzz(4); break;
    case 'windTight': sfx.sfxWindTight(); sfx.buzz([20, 30, 30]); break;
    case 'unspool': sfx.sfxUnspool(); sfx.buzz([4, 12, 4, 12, 4]); break;
    case 'payout': sfx.sfxPayout(); break;
    case 'comb': sfx.sfxComb(e.n); sfx.buzz(5); break;
    case 'wrap': sfx.sfxWrap(e.n); sfx.buzz(5); break;
    case 'combDone': case 'wrapDone': sfx.sfxDone(); sfx.buzz([12, 30, 20]); break;
    case 'label': sfx.sfxPrint(); sfx.buzz([4, 20, 4, 20, 4, 20, 14]); break;
    case 'dust': sfx.sfxDust(); break;
    case 'dustDone': sfx.sfxDone(); sfx.buzz([12, 30, 20]); toast('Spotless!'); break;
    case 'screw': sfx.sfxScrew(e.k); sfx.buzz(5); break;
    case 'screwDone': sfx.sfxScrewDone(); sfx.buzz(22); break;
    case 'hook': sfx.sfxHook(); sfx.buzz(14); break;
    case 'unhook': sfx.sfxUnplug(); break;
    case 'lid': sfx.sfxLid(e.k); sfx.buzz(9); return;
    case 'lidDone': sfx.sfxDone(); sfx.buzz([25, 20, 35]); break;
    case 'lidOpen': sfx.sfxUnplug(); sfx.buzz(10); break;
    case 'pulse': sfx.sfxPulse(e.i); sfx.buzz(10); break;
    case 'powered': sfx.sfxAllGood(); sfx.buzz([30, 60, 60]); flash(); setTimeout(finishLevel, 900); break;
    case 'allgood':
      setTimeout(() => sfx.sfxDone(), 250);
      sfx.buzz([30, 60, 30]);
      hint('Everything is connected! Tap a yellow ring to flick a crossing loose, then press “Power on”.', 5000);
      break;
    case 'broken': break;
    case 'toast': sfx.sfxError(); toast(e.text); break;
  }
  updateHud();
}

// ---------------------------------------------------------------- input
/** Plug grab radius in world px: at least a fingertip on touch, comfortable with a mouse. */
const grabRadius = (e: PointerEvent) => Math.min(64, Math.max(44, (e.pointerType === 'touch' ? 30 : 22) / scale));

function updateCursor() {
  if (!game || paused) { cv.style.cursor = 'default'; return; }
  if (game.grab) cv.style.cursor = tool === 'hand' || TOOLS[tool].mode === 'tap' ? 'grabbing' : 'none';
  else if (tool === 'hand') cv.style.cursor = game.hover ? (game.hover.kind === 'tie' || game.hover.kind === 'reel' ? 'pointer' : 'grab') : 'default';
  else cv.style.cursor = tool === 'air' || tool === 'comb' ? 'none' : 'crosshair';
}

cv.addEventListener('pointerdown', (e) => {
  if (!game || paused || game.power >= 0) return;
  if (pointerId !== null || e.button > 0) return;
  sfx.unlockAudio();
  const p = toWorld(e);
  const mode = TOOLS[tool].mode;
  const opts = { r: grabRadius(e), touch: e.pointerType === 'touch' };
  const grabbed = game.pointerDown(p.x, p.y, mode === 'stroke' ? tool : 'hand', opts);
  if (mode === 'tap') pressed = { x: p.x, y: p.y, t: performance.now() };
  if (grabbed || pressed) { pointerId = e.pointerId; cv.setPointerCapture(e.pointerId); }
  if (game.grab?.kind === 'air') sfx.airOn();
  updateCursor();
  e.preventDefault();
});
cv.addEventListener('pointermove', (e) => {
  if (!game) return;
  if (pointerId !== null && e.pointerId !== pointerId) return;
  const p = toWorld(e);
  if (pressed && Math.hypot(p.x - pressed.x, p.y - pressed.y) > 10) pressed = null; // it was a drag after all
  game.pointerMove(p.x, p.y, grabRadius(e));
  updateCursor();
});
const up = (e: PointerEvent) => {
  if (!game || e.pointerId !== pointerId) return;
  pointerId = null;
  sfx.airOff();
  const k = game.grab?.kind;
  // near an existing tie the tool first feeds in cables that were left out
  if (pressed && game.grab?.kind === 'tie' && (tool === 'zip' || tool === 'velcro') && game.feedTie(tool, pressed.x, pressed.y)) { game.cancelGrab(); pressed = null; updateHud(); updateMeter(); return; }
  const fixture = k === 'tie' || k === 'reel' || k === 'lid';
  if (pressed && performance.now() - pressed.t < 450 && !fixture) {
    game.cancelGrab();
    if (e.type === 'pointerup') game.useTool(tool, pressed.x, pressed.y);
  } else game.pointerUp();
  pressed = null;
  // out of uses: fall back to the hand
  if (tool !== 'hand' && game.left[tool] <= 0) setTool('hand', true);
  updateHud(); updateMeter(); updateCursor();
};
cv.addEventListener('pointerup', up);
cv.addEventListener('pointercancel', up);
cv.addEventListener('pointerleave', () => { if (game && pointerId === null) { game.pointer = { x: -999, y: -999 }; game.hover = null; } });
document.addEventListener('contextmenu', (e) => e.preventDefault());

btnFinish.onclick = () => {
  if (!game || paused || !game.allGood || game.power >= 0) return;
  sfx.unlockAudio();
  setTool('hand', true);
  sfx.sfxLever(); sfx.buzz(60);
  game.powerOn();
  updateHud();
};
$('btn-reset').onclick = () => { if (!game) return; sfx.sfxUi(); startLevel(levelIdx); };
$('btn-menu').onclick = () => { sfx.unlockAudio(); sfx.sfxUi(); setTool('hand', true); levelSelect(); };
const refreshSound = () => { btnSound.innerHTML = sfx.isMuted() ? SOUND_OFF : SOUND_ON; };
btnSound.onclick = () => { sfx.unlockAudio(); sfx.setMuted(!sfx.isMuted()); refreshSound(); };
refreshSound();
window.addEventListener('keydown', (e) => {
  if (!game || paused || e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.key === 'Escape') setTool('hand');
  const n = Number(e.key);
  if (n >= 1 && n <= levelTools().length) { sfx.sfxUi(); setTool(levelTools()[n - 1]); }
});

// ---------------------------------------------------------------- loop
let last = performance.now();
let acc = 0;
let frame = 0;
let fps = 60;
function loop(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  if (dt > 0) fps += (1 / dt - fps) * 0.05;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#141a26';
  ctx.fillRect(0, 0, cv.width, cv.height);
  if (game) {
    if (!paused) {
      acc += dt;
      let steps = 0;
      while (acc >= 1 / 60 && steps < 3) { game.step(1 / 60); acc -= 1 / 60; steps++; }
      if (steps === 3) acc = 0;
      if (++frame % 20 === 0) updateMeter();
    }
    ctx.setTransform(scale * dpr, 0, 0, scale * dpr, offX * dpr, offY * dpr);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
    const draw = () => drawScene(ctx, game!, { ui: !paused, tool });
    // on fast displays blend between physics steps so motion is as smooth as the screen allows
    if (fps > 75 && !paused) game.interpolated(Math.min(1, acc * 60), draw); else draw();
    ctx.restore();
  }
  requestAnimationFrame(loop);
}

// ---------------------------------------------------------------- debug/test hook
(window as unknown as Record<string, unknown>).__cable = {
  game: () => game,
  toClient: (x: number, y: number) => {
    const r = cv.getBoundingClientRect();
    return { x: r.left + offX + x * scale, y: r.top + offY + y * scale };
  },
  plugs: () => game ? game.cables.flatMap((c) => c.ends.map((e) => {
    const g = game!.plugGeom(e);
    return { cable: c.id, which: e.which, color: c.color, x: g.cx, y: g.cy, port: e.port?.id ?? null };
  })) : [],
  ports: () => game ? game.ports.map((p) => ({ id: p.id, x: p.x, y: p.y, color: p.color, side: p.side, used: !!p.end })) : [],
  evaluate: () => game?.evaluate(),
};

resize();
titleScreen();
requestAnimationFrame(loop);
