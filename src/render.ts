import { Game, W, H, FLOOR, PLUG_LEN, REP_R, TIE_R, Cable, End, Port } from './game';
import { COLORS, DeviceDef, Theme } from './levels';
import { drawBadge, drawStatusLed, type LedState } from './symbols';

type C2D = CanvasRenderingContext2D;

export interface DrawOpts { ui: boolean; tieMode: boolean }

const PORT_BADGE_R = 11;
const PLUG_BADGE_R = 10.5;

function rr(ctx: C2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function hash(n: number) {
  const s = Math.sin(n * 127.1) * 43758.5453;
  return s - Math.floor(s);
}

// ---------------------------------------------------------------- background
function drawBackground(ctx: C2D, theme: Theme) {
  const g = ctx.createLinearGradient(0, 0, 0, H);
  switch (theme) {
    case 'home': g.addColorStop(0, '#f4e6cf'); g.addColorStop(1, '#e8d2b0'); break;
    case 'cafe': g.addColorStop(0, '#b7654a'); g.addColorStop(1, '#8e4a35'); break;
    case 'workshop': g.addColorStop(0, '#a7adb3'); g.addColorStop(1, '#8a9096'); break;
    case 'studio': g.addColorStop(0, '#3a2b55'); g.addColorStop(1, '#2a1f40'); break;
    case 'datacenter': g.addColorStop(0, '#1b2638'); g.addColorStop(1, '#111a28'); break;
  }
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  if (theme === 'home') {
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    for (let x = 0; x < W; x += 48) ctx.fillRect(x, 0, 18, FLOOR);
    ctx.fillStyle = 'rgba(190,140,90,0.25)';
    for (let x = 24; x < W; x += 96) for (let y = 30; y < FLOOR; y += 80) {
      ctx.beginPath(); ctx.arc(x + 9, y + ((x / 96) % 2) * 40, 3, 0, Math.PI * 2); ctx.fill();
    }
  } else if (theme === 'cafe') {
    for (let y = 0, r = 0; y < FLOOR; y += 34, r++) {
      for (let x = (r % 2) * -40; x < W; x += 80) {
        const v = hash(x * 3 + y);
        ctx.fillStyle = `rgba(${150 + v * 40},${70 + v * 25},${50 + v * 20},0.55)`;
        rr(ctx, x + 2, y + 2, 76, 30, 3); ctx.fill();
      }
    }
  } else if (theme === 'workshop') {
    for (let i = 0; i < 260; i++) {
      ctx.fillStyle = `rgba(${hash(i) > 0.5 ? 255 : 0},${hash(i) > 0.5 ? 255 : 0},${hash(i) > 0.5 ? 255 : 0},${0.05 + hash(i + 7) * 0.08})`;
      ctx.beginPath(); ctx.arc(hash(i * 2) * W, hash(i * 3) * FLOOR, 1 + hash(i * 5) * 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'; ctx.lineWidth = 2;
    for (let x = 0; x < W; x += 180) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, FLOOR); ctx.stroke(); }
  } else if (theme === 'studio') {
    for (let y = 0; y < FLOOR; y += 60) for (let x = 0; x < W; x += 60) {
      const rot = ((x + y) / 60) % 2 === 0;
      for (let k = 0; k < 4; k++) {
        const gg = ctx.createLinearGradient(x, y, rot ? x + 60 : x, rot ? y : y + 60);
        gg.addColorStop(0, 'rgba(255,255,255,0.05)'); gg.addColorStop(1, 'rgba(0,0,0,0.12)');
        ctx.fillStyle = gg;
        if (rot) ctx.fillRect(x + k * 15, y + 2, 13, 56); else ctx.fillRect(x + 2, y + k * 15, 56, 13);
      }
    }
  } else if (theme === 'datacenter') {
    // rack frame rails
    for (const rx of [40, W - 64]) {
      ctx.fillStyle = '#2b3850'; ctx.fillRect(rx, 0, 24, FLOOR);
      ctx.fillStyle = '#0c121c';
      for (let y = 10; y < FLOOR; y += 22) ctx.fillRect(rx + 8, y, 8, 8);
    }
    ctx.fillStyle = 'rgba(80,160,255,0.05)';
    for (let x = 0; x < W; x += 30) ctx.fillRect(x, 0, 1, FLOOR);
  }

  // floor
  const fg = ctx.createLinearGradient(0, FLOOR - 6, 0, H);
  const floor: Record<Theme, [string, string]> = {
    home: ['#a8784c', '#8a5f39'], cafe: ['#3d2a22', '#2a1c16'], workshop: ['#5d6166', '#45484c'],
    studio: ['#1c1428', '#120c1b'], datacenter: ['#2a3446', '#1a2130'],
  };
  fg.addColorStop(0, floor[theme][0]); fg.addColorStop(1, floor[theme][1]);
  ctx.fillStyle = fg;
  ctx.fillRect(0, FLOOR - 6, W, H - FLOOR + 6);
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(0, FLOOR - 8, W, 3);
  if (theme === 'workshop') {
    for (let x = -20; x < W; x += 40) {
      ctx.fillStyle = '#f2c230';
      ctx.beginPath(); ctx.moveTo(x, H); ctx.lineTo(x + 20, FLOOR - 4); ctx.lineTo(x + 34, FLOOR - 4); ctx.lineTo(x + 14, H); ctx.fill();
    }
  }
}

// ---------------------------------------------------------------- devices
function devicePorts(g: Game, d: DeviceDef): Port[] {
  return g.ports.filter((p) => p.x >= d.x && p.x <= d.x + d.w && (Math.abs(p.y - d.y) < 3 || Math.abs(p.y - (d.y + d.h)) < 3));
}

function led(ctx: C2D, x: number, y: number, r: number, color: string | null, glow = true) {
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = color ?? '#2b2f36';
  if (color && glow) { ctx.shadowColor = color; ctx.shadowBlur = 10; }
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.arc(x - r * 0.3, y - r * 0.3, r * 0.35, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fill();
}

function body(ctx: C2D, d: DeviceDef, top: string, bot: string, radius = 10, stroke = 'rgba(0,0,0,0.35)') {
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  rr(ctx, d.x + 5, d.y + 8, d.w, d.h, radius); ctx.fill();
  const gr = ctx.createLinearGradient(0, d.y, 0, d.y + d.h);
  gr.addColorStop(0, top); gr.addColorStop(1, bot);
  ctx.fillStyle = gr;
  rr(ctx, d.x, d.y, d.w, d.h, radius); ctx.fill();
  ctx.strokeStyle = stroke; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  rr(ctx, d.x + 4, d.y + 3, d.w - 8, 6, 3); ctx.fill();
}

function label(ctx: C2D, text: string, x: number, y: number, color: string, size = 13) {
  ctx.fillStyle = color;
  ctx.font = `800 ${size}px system-ui, -apple-system, Segoe UI, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y);
}

function drawDevice(ctx: C2D, g: Game, d: DeviceDef, t: number) {
  const ports = devicePorts(g, d);
  const ok = ports.length > 0 && ports.every((p) => p.end && p.end.cable.valid());
  const blink = (k: number) => (Math.sin(t * 9 + k * 1.7) > 0.2 ? 1 : 0);
  switch (d.style) {
    case 'router': {
      ctx.fillStyle = '#2b2f36';
      for (const ax of [d.x + 26, d.x + d.w - 34]) { rr(ctx, ax, d.y - 70, 8, 74, 4); ctx.fill(); }
      body(ctx, d, '#f7f9fc', '#c9d1dc', 16);
      label(ctx, d.label, d.x + d.w / 2, d.y + 22, '#5a6474', 14);
      const leds: [string, LedState][] = [
        ['PWR', 'ok'],
        ['NET', ok || g.allGood ? 'ok' : 'warn'],
        ['WIFI', g.allGood ? 'ok' : 'off'],
      ];
      leds.forEach(([n, st], i) => {
        const lx = d.x + d.w / 2 - 60 + i * 60;
        drawStatusLed(ctx, lx, d.y + 40, 6.5, st, blink(i) === 1);
        label(ctx, n, lx, d.y + 54, '#8a93a1', 9);
      });
      break;
    }
    case 'ont':
      body(ctx, d, '#ffffff', '#dfe4ea', 10);
      label(ctx, d.label, d.x + d.w / 2, d.y + 44, '#596273', 12);
      drawStatusLed(ctx, d.x + d.w / 2, d.y + 58, 6, ok ? 'ok' : 'bad', blink(0) === 1);
      break;
    case 'tv': {
      body(ctx, d, '#2b2f36', '#1b1e23', 8);
      const sx = d.x + 8, sy = d.y + 38, sw = d.w - 16, sh = d.h - 46;
      if (ok) {
        const sg = ctx.createLinearGradient(0, sy, 0, sy + sh);
        sg.addColorStop(0, '#7cc8ff'); sg.addColorStop(1, '#d6f0ff');
        ctx.fillStyle = sg; ctx.fillRect(sx, sy, sw, sh);
        ctx.fillStyle = '#5fbf6a';
        ctx.beginPath(); ctx.ellipse(sx + sw * 0.3, sy + sh, sw * 0.4, sh * 0.45, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#48a456';
        ctx.beginPath(); ctx.ellipse(sx + sw * 0.8, sy + sh, sw * 0.35, sh * 0.35, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#ffe066';
        ctx.beginPath(); ctx.arc(sx + sw * 0.75, sy + sh * 0.3, 8, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#0c0e12'; ctx.fillRect(sx, sy, sw, sh);
        label(ctx, 'NO SIGNAL', sx + sw / 2, sy + sh / 2, blink(1) ? '#5d6675' : '#3a404b', 11);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + sw * 0.4, sy); ctx.lineTo(sx, sy + sh * 0.7); ctx.fill();
      break;
    }
    case 'pc':
      body(ctx, d, '#3a404b', '#262a31', 8);
      for (let i = 0; i < 4; i++) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(d.x + 14, d.y + 40 + i * 7, d.w - 28, 3); }
      ctx.beginPath(); ctx.arc(d.x + d.w / 2, d.y + d.h - 18, 8, 0, Math.PI * 2);
      ctx.strokeStyle = ok ? '#6fd3ff' : '#555c68'; ctx.lineWidth = 3;
      if (ok) { ctx.shadowColor = '#6fd3ff'; ctx.shadowBlur = 12; }
      ctx.stroke(); ctx.shadowBlur = 0;
      break;
    case 'printer':
      body(ctx, d, '#eceff3', '#c7ced8', 10);
      ctx.fillStyle = '#2b2f36'; ctx.fillRect(d.x + 16, d.y + 42, d.w - 32, 6);
      ctx.fillStyle = '#fff'; ctx.fillRect(d.x + 24, d.y + 48, d.w - 48, ok ? 16 : 4);
      if (ok) { ctx.fillStyle = '#b9c1cc'; for (let i = 0; i < 2; i++) ctx.fillRect(d.x + 30, d.y + 52 + i * 6, d.w - 60 - i * 12, 2); }
      label(ctx, d.label, d.x + d.w / 2, d.y + d.h - 10, '#6b7484', 10);
      break;
    case 'wallplate':
      body(ctx, d, '#ffffff', '#e5e8ec', 8);
      for (const sx of [d.x + 10, d.x + d.w - 10]) {
        ctx.fillStyle = '#c4cad3'; ctx.beginPath(); ctx.arc(sx, d.y + d.h / 2, 4, 0, Math.PI * 2); ctx.fill();
      }
      label(ctx, d.label, d.x + d.w / 2, d.y + d.h - 12, '#8a93a1', 10);
      break;
    case 'breaker': {
      body(ctx, d, '#d6dbe0', '#aeb5bd', 6);
      label(ctx, d.label, d.x + d.w / 2, d.y + 18, '#4e5560', 13);
      ctx.fillStyle = '#f2c230';
      ctx.beginPath(); ctx.moveTo(d.x + 18, d.y + 28); ctx.lineTo(d.x + 30, d.y + 8); ctx.lineTo(d.x + 42, d.y + 28); ctx.fill();
      label(ctx, '!', d.x + 30, d.y + 21, '#222', 12);
      for (const p of ports) {
        const on = p.end?.cable.valid();
        ctx.fillStyle = '#2d3138'; rr(ctx, p.x - 18, d.y + 36, 36, 62, 5); ctx.fill();
        ctx.fillStyle = '#f5f6f8'; rr(ctx, p.x - 9, on ? d.y + 42 : d.y + 66, 18, 26, 3); ctx.fill();
        label(ctx, on ? 'ON' : 'OFF', p.x, on ? d.y + 55 : d.y + 79, on ? '#1f8a4c' : '#a33', 9);
      }
      break;
    }
    case 'terminal':
      body(ctx, d, '#ece3c9', '#cfc3a1', 5);
      label(ctx, d.label, d.x + d.w / 2, d.y + d.h - 9, '#7d7254', 10);
      break;
    case 'patch':
      body(ctx, d, '#30343b', '#1d2025', 4);
      for (const ex of [d.x + 10, d.x + d.w - 10]) { ctx.fillStyle = '#0d0f12'; ctx.beginPath(); ctx.arc(ex, d.y + d.h / 2, 4, 0, Math.PI * 2); ctx.fill(); }
      label(ctx, d.label, d.x + d.w / 2, d.y + 18, '#9aa3b2', 12);
      ports.forEach((p, i) => label(ctx, String(i + 1).padStart(2, '0'), p.x, d.y + 40, '#d6dbe3', 10));
      break;
    case 'switch':
    case 'server': {
      body(ctx, d, d.style === 'switch' ? '#2a3448' : '#252a33', d.style === 'switch' ? '#1a2131' : '#17191f', 5);
      label(ctx, d.label, d.x + 60, d.y < H / 2 ? d.y + 20 : d.y + d.h - 12, '#8fb0d9', 12);
      if (d.style === 'server') {
        for (let i = 0; i < 6; i++) {
          ctx.fillStyle = '#0f1218'; rr(ctx, d.x + 14 + i * 38, d.y + 40, 32, 12, 2); ctx.fill();
          // working: bright blinking activity lights; broken: dim, steady (brightness, not just hue)
          led(ctx, d.x + 40 + i * 38, d.y + 46, 2.5, ok ? (blink(i) ? '#5dff95' : '#1f7a40') : '#5a1414', ok);
        }
      }
      drawStatusLed(ctx, d.x + d.w - 20, d.y < H / 2 ? d.y + 18 : d.y + d.h - 16, 6.5, ok || (d.style === 'switch' && g.allGood) ? 'ok' : 'warn', blink(3) === 1);
      break;
    }
  }
}

// ---------------------------------------------------------------- ports
function drawPort(ctx: C2D, g: Game, p: Port, t: number) {
  const s = p.dir; // 1 => opens downward (socket inside above y)
  ctx.fillStyle = '#121418';
  rr(ctx, p.x - 11, s === 1 ? p.y - 14 : p.y, 22, 14, 3); ctx.fill();
  ctx.fillStyle = '#2a2e35';
  rr(ctx, p.x - 8, s === 1 ? p.y - 11 : p.y + 3, 16, 8, 2); ctx.fill();
  // colour + symbol tag (readable without colour vision)
  drawBadge(ctx, p.color, p.x, s === 1 ? p.y - 28 : p.y + 28, PORT_BADGE_R);
  // link LED beside the socket, like a real jack: shape + brightness, not just hue
  const st = g.ledState(p);
  const ls: LedState = st === 'green' ? 'ok' : st === 'amber' ? 'warn' : st === 'red' ? 'bad' : 'off';
  drawStatusLed(ctx, p.x + 19, s === 1 ? p.y - 7 : p.y + 7, 7, ls, Math.sin(t * 10) > 0);
  if (p.pulse > 0) {
    ctx.strokeStyle = `rgba(255,255,255,${p.pulse * 0.8})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, 16 + (1 - p.pulse) * 20, 0, Math.PI * 2); ctx.stroke();
  }
}

// ---------------------------------------------------------------- cables
function cablePath(ctx: C2D, c: Cable, ox = 0, oy = 0) {
  ctx.beginPath();
  ctx.moveTo(c.x[0] + ox, c.y[0] + oy);
  for (let i = 1; i < c.n - 1; i++) {
    const mx = (c.x[i] + c.x[i + 1]) / 2, my = (c.y[i] + c.y[i + 1]) / 2;
    ctx.quadraticCurveTo(c.x[i] + ox, c.y[i] + oy, mx + ox, my + oy);
  }
  ctx.lineTo(c.x[c.n - 1] + ox, c.y[c.n - 1] + oy);
}

function drawCable(ctx: C2D, c: Cable, wire: boolean, lifted: boolean) {
  const col = COLORS[c.color];
  const w = wire ? 6 : 7;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (lifted) {
    ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = w + 4;
    cablePath(ctx, c, 8, 12); ctx.stroke();
  }
  ctx.strokeStyle = col.dark; ctx.lineWidth = w + 3;
  cablePath(ctx, c); ctx.stroke();
  ctx.strokeStyle = col.base; ctx.lineWidth = w;
  cablePath(ctx, c); ctx.stroke();
  ctx.strokeStyle = col.light; ctx.globalAlpha = 0.55; ctx.lineWidth = 1.8;
  cablePath(ctx, c, -1.2, -1.4); ctx.stroke();
  ctx.globalAlpha = 1;
}

function drawPlug(ctx: C2D, g: Game, e: End, wire: boolean) {
  const pg = g.plugGeom(e);
  const col = COLORS[e.cable.color];
  ctx.save();
  ctx.translate(pg.ex, pg.ey);
  ctx.rotate(Math.atan2(pg.dy, pg.dx));
  if (wire) {
    ctx.fillStyle = col.dark; rr(ctx, -2, -5, 9, 10, 3); ctx.fill();
    ctx.fillStyle = col.base; rr(ctx, -1, -4, 7, 8, 2); ctx.fill();
    const mg = ctx.createLinearGradient(0, -3, 0, 3);
    mg.addColorStop(0, '#f4f6f8'); mg.addColorStop(0.5, '#a9b0b9'); mg.addColorStop(1, '#e1e5ea');
    ctx.fillStyle = mg; rr(ctx, 6, -3, PLUG_LEN - 6, 6, 1.5); ctx.fill();
  } else {
    ctx.fillStyle = col.dark; rr(ctx, -3, -6, 10, 12, 3); ctx.fill();
    ctx.fillStyle = col.base; rr(ctx, -2, -5, 8, 10, 3); ctx.fill();
    ctx.fillStyle = 'rgba(225,236,248,0.92)'; rr(ctx, 5, -7, PLUG_LEN - 5, 14, 2); ctx.fill();
    ctx.strokeStyle = 'rgba(80,95,115,0.8)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#d9b44a';
    for (let k = -4; k <= 4; k += 2) ctx.fillRect(PLUG_LEN - 4, k - 0.5, 3, 1);
    ctx.fillStyle = 'rgba(80,95,115,0.5)'; ctx.fillRect(8, -8, 7, 2.5);
  }
  ctx.restore();
  // upright colour + symbol badge on the boot of every plug
  drawBadge(ctx, e.cable.color, pg.ex - pg.dx * 12, pg.ey - pg.dy * 12, PLUG_BADGE_R);
}

function drawTie(ctx: C2D, t: { x: number; y: number; nx: number; ny: number; entries: unknown[]; t: number }, hi: boolean) {
  const m = t.entries.length;
  const half = ((m - 1) * REP_R) / 2 + 8;
  const sc = 0.6 + 0.4 * Math.min(1, t.t * 1.5);
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.rotate(Math.atan2(t.ny, t.nx));
  ctx.scale(sc, sc);
  ctx.fillStyle = hi ? '#4a5260' : '#1c1f24';
  rr(ctx, -half, -3.5, half * 2, 7, 3); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-half + 3, -2.5, half * 2 - 6, 1.5);
  ctx.fillStyle = hi ? '#4a5260' : '#1c1f24';
  rr(ctx, half - 2, -5, 8, 10, 2); ctx.fill();
  rr(ctx, half + 4, -2, 16, 4, 2); ctx.fill();
  ctx.restore();
}

export function drawScene(ctx: C2D, g: Game, opts: DrawOpts) {
  const t = g.time;
  const wire = g.level.plug === 'wire';
  drawBackground(ctx, g.level.theme);
  for (const d of g.level.devices) drawDevice(ctx, g, d, t);
  for (const p of g.ports) drawPort(ctx, g, p, t);

  // shadows
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 9;
  for (const c of g.order) { cablePath(ctx, c, 3, 5); ctx.stroke(); }

  for (const c of g.order) {
    const lifted = g.isGrabbed(c);
    drawCable(ctx, c, wire, lifted);
    for (const e of c.ends) drawPlug(ctx, g, e, wire);
  }
  for (const tie of g.ties) drawTie(ctx, tie, opts.ui && g.grab?.tie === tie);

  for (const f of g.fx) {
    const k = f.t / 0.8;
    if (f.kind === 'ring') {
      ctx.strokeStyle = f.color; ctx.globalAlpha = 1 - k; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(f.x, f.y, 10 + k * 34, 0, Math.PI * 2); ctx.stroke();
      if (f.glyph) drawStatusLed(ctx, f.x + 26, f.y - 10 - k * 24, 9, f.glyph);
    } else {
      ctx.fillStyle = f.color; ctx.globalAlpha = 1 - k;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.beginPath(); ctx.arc(f.x + Math.cos(a) * (12 + k * 40), f.y + Math.sin(a) * (12 + k * 40), 3 * (1 - k) + 1, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  if (!opts.ui) return;
  if (g.hoverPort && g.grab?.end) {
    const p = g.hoverPort;
    const match = p.color === g.grab.end.cable.color;
    ctx.strokeStyle = match ? COLORS[p.color].light : 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.arc(p.x, p.y, 20 + Math.sin(t * 10) * 2, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    // explicit match / no-match glyph next to the target port
    drawStatusLed(ctx, p.x - 24, p.dir === 1 ? p.y + 14 : p.y - 14, 8, match ? 'ok' : 'bad');
  }
  if (opts.tieMode && g.pointer.x > 0) {
    ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
    ctx.beginPath(); ctx.arc(g.pointer.x, g.pointer.y, TIE_R, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  }
  if (g.allGood) {
    const a = 0.12 + 0.08 * Math.sin(t * 3);
    ctx.fillStyle = `rgba(120,255,170,${a})`;
    ctx.fillRect(0, 0, W, 4);
  }
}
