import './style.css';
import { Game, W, H, Evaluation, GameEvent } from './game';
import { LEVELS } from './levels';
import { drawScene } from './render';
import * as sfx from './audio';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const cv = $<HTMLCanvasElement>('cv');
const ctx = cv.getContext('2d')!;
const stage = $('stage');
const overlay = $('overlay');
const btnTie = $<HTMLButtonElement>('btn-tie');
const btnFinish = $<HTMLButtonElement>('btn-finish');
const btnSound = $<HTMLButtonElement>('btn-sound');

const SOUND_ON = '<svg viewBox="0 0 24 24"><path d="M4 10v4h4l5 4V6L8 10H4z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>';
const SOUND_OFF = '<svg viewBox="0 0 24 24"><path d="M4 10v4h4l5 4V6L8 10H4z"/><path d="M17 10l4 4M21 10l-4 4"/></svg>';
const STAR = '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>';

let game: Game | null = null;
let levelIdx = 0;
let tieMode = false;
let paused = true;
let beforeShot = '';
let scale = 1, offX = 0, offY = 0, dpr = 1;
let pointerId: number | null = null;
let hintTimer = 0;
let toastTimer = 0;

const stars: number[] = (() => {
  try { return JSON.parse(localStorage.getItem('cablecalm.stars') || '[]'); } catch { return []; }
})();
const saveStars = () => localStorage.setItem('cablecalm.stars', JSON.stringify(stars));

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

function setTieMode(on: boolean) {
  tieMode = on && !!game && game.tiesLeft > 0;
  btnTie.classList.toggle('active', tieMode);
  if (tieMode) hint('Tap where 2+ same-color cables run close together to zip them into a bundle.', 4000);
}

function updateHud() {
  if (!game) return;
  const n = game.connectedCount(), t = game.cables.length;
  const conn = $('conn');
  conn.textContent = `${n}/${t}`;
  conn.classList.toggle('ok', n === t);
  $('tie-count').textContent = String(game.tiesLeft);
  btnFinish.disabled = !game.allGood;
}

function updateMeter() {
  if (!game) return;
  const ev = game.evaluate();
  $('meter-fill').style.width = `${ev.score}%`;
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
  game = null;
  showOverlay(`
    <div class="card title-card">
      <svg class="logo-cables" viewBox="0 0 300 90">
        <path d="M10 20 C 90 20, 110 70, 290 70" stroke="#2f7bf5"/>
        <path d="M10 45 C 100 45, 120 45, 290 45" stroke="#f5c518" style="animation-delay:.2s"/>
        <path d="M10 70 C 90 70, 110 20, 290 20" stroke="#25b158" style="animation-delay:.4s"/>
      </svg>
      <div class="logo"><span>Cable</span> <span>Calm</span></div>
      <p class="tagline">Untangle. Click. Zip. Breathe.<br/>A cozy job simulator for cable tidiers.</p>
      <div class="row"><button class="btn green" id="go-play">Play</button></div>
      <p style="font-size:12px;opacity:.55;margin-top:14px">Drag plugs into matching ports · tie same colors · light every LED</p>
    </div>`);
  $('go-play').onclick = () => { sfx.unlockAudio(); sfx.sfxUi(); levelSelect(); };
}

function levelSelect() {
  game = null;
  const items = LEVELS.map((l, i) => {
    const locked = i > 0 && !(stars[i - 1] > 0);
    return `<button class="lvl" data-i="${i}" ${locked ? 'disabled' : ''}>
      <div class="num">${locked ? '🔒' : l.id}</div>
      <div class="info"><div class="t">${l.title}</div><div class="s">${l.tier} · ${l.client}</div></div>
      <div class="stars">${starsHtml(stars[i] ?? 0)}</div>
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
  setTieMode(false);
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
      <div class="row"><button class="btn alt" id="b-back">Job board</button><button class="btn green" id="b-start">Start job</button></div>
    </div>`);
  $('b-back').onclick = () => { sfx.sfxUi(); levelSelect(); };
  $('b-start').onclick = () => {
    sfx.unlockAudio(); sfx.sfxUi();
    hideOverlay();
    hint(L.tip, 7000);
    if (L.ties > 0 && i === 1) btnTie.classList.add('flash');
    setTimeout(() => btnTie.classList.remove('flash'), 3000);
  };
}

function snapshot(g: Game): string {
  const k = 0.6;
  const c = document.createElement('canvas');
  c.width = W * k; c.height = H * k;
  const x = c.getContext('2d')!;
  x.scale(k, k);
  drawScene(x, g, { ui: false, tieMode: false });
  return c.toDataURL('image/jpeg', 0.85);
}

function finishLevel() {
  if (!game || !game.allGood) return;
  setTieMode(false);
  const ev: Evaluation = game.evaluate();
  const after = snapshot(game);
  stars[levelIdx] = Math.max(stars[levelIdx] ?? 0, ev.stars);
  saveStars();
  const L = LEVELS[levelIdx];
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
  const total = stars.reduce((a, b) => a + (b || 0), 0);
  showOverlay(`<div class="card title-card">
    <div class="logo"><span>All</span> <span>tidy!</span></div>
    <p class="tagline">You finished every job in the prototype.<br/>Stars collected: <b>${total}/${LEVELS.length * 3}</b></p>
    <p style="font-size:13px;opacity:.6">More clients are on their way: offices, studios, stadiums, a space station…</p>
    <div class="row"><button class="btn green" id="b-board2">Job board</button></div>
  </div>`);
  $('b-board2').onclick = () => { sfx.sfxUi(); levelSelect(); };
}

// ---------------------------------------------------------------- events
function onGameEvent(e: GameEvent) {
  switch (e.type) {
    case 'snap':
      sfx.sfxSnap(e.colorMatch, e.cableDone);
      sfx.buzz(e.colorMatch ? (e.cableDone ? [18, 40, 25] : 18) : [10, 30, 10]);
      if (!e.colorMatch) toast('Wrong color! Its LED is red — try a matching port.');
      break;
    case 'unplug': sfx.sfxUnplug(); sfx.buzz(8); break;
    case 'grab': sfx.sfxGrab(); break;
    case 'tie': sfx.sfxZip(); sfx.buzz([6, 20, 6, 20, 6, 20, 14]); setTieMode(false); break;
    case 'snip': sfx.sfxSnip(); sfx.buzz(10); toast('Tie removed'); break;
    case 'allgood':
      setTimeout(() => sfx.sfxAllGood(), 250);
      sfx.buzz([30, 60, 30, 60, 60]);
      hint('Everything works! Tidy up with ties & smooth runs, then press “Finish job”.', 5000);
      break;
    case 'broken': break;
    case 'toast': sfx.sfxError(); toast(e.text); break;
  }
  updateHud();
}

// ---------------------------------------------------------------- input
cv.addEventListener('pointerdown', (e) => {
  if (!game || paused) return;
  if (pointerId !== null) return;
  sfx.unlockAudio();
  const p = toWorld(e);
  const wasTie = tieMode;
  const grabbed = game.pointerDown(p.x, p.y, tieMode);
  if (wasTie) { updateHud(); return; }
  if (grabbed) { pointerId = e.pointerId; cv.setPointerCapture(e.pointerId); }
  e.preventDefault();
});
cv.addEventListener('pointermove', (e) => {
  if (!game) return;
  if (pointerId !== null && e.pointerId !== pointerId) return;
  const p = toWorld(e);
  game.pointerMove(p.x, p.y);
});
const up = (e: PointerEvent) => {
  if (!game || e.pointerId !== pointerId) return;
  pointerId = null;
  game.pointerUp();
  updateHud();
};
cv.addEventListener('pointerup', up);
cv.addEventListener('pointercancel', up);
cv.addEventListener('pointerleave', () => { if (game && pointerId === null) game.pointer = { x: -999, y: -999 }; });
document.addEventListener('contextmenu', (e) => e.preventDefault());

btnTie.onclick = () => {
  if (!game || paused) return;
  sfx.unlockAudio();
  if (game.tiesLeft <= 0) { sfx.sfxError(); toast('No ties left — tap a placed tie to remove it.'); return; }
  sfx.sfxUi();
  setTieMode(!tieMode);
};
btnFinish.onclick = () => { sfx.sfxUi(); finishLevel(); };
$('btn-reset').onclick = () => { if (!game) return; sfx.sfxUi(); startLevel(levelIdx); };
$('btn-menu').onclick = () => { sfx.unlockAudio(); sfx.sfxUi(); setTieMode(false); levelSelect(); };
const refreshSound = () => { btnSound.innerHTML = sfx.isMuted() ? SOUND_OFF : SOUND_ON; };
btnSound.onclick = () => { sfx.unlockAudio(); sfx.setMuted(!sfx.isMuted()); refreshSound(); };
refreshSound();
window.addEventListener('keydown', (e) => {
  if (e.key === 't' || e.key === 'T') btnTie.click();
  if (e.key === 'Escape') setTieMode(false);
});

// ---------------------------------------------------------------- loop
let last = performance.now();
let acc = 0;
let frame = 0;
function loop(now: number) {
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
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
    drawScene(ctx, game, { ui: !paused, tieMode });
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
