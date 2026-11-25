import { Game, W, H, FLOOR, PLUG_LEN, REP_R, TIE_R, GATHER_R, COMB_R, AIR_R, REEL_R, Cable, End, Port, Tie, Run, Reel, Hook, Duct, clamp } from './game';
import type { ToolId } from './tools';
import { COLORS, DeviceDef, Theme } from './levels';
import { drawBadge, drawStatusLed, type LedState } from './symbols';

type C2D = CanvasRenderingContext2D;

export interface DrawOpts { ui: boolean; tool: ToolId }

const PORT_BADGE_R = 11;
const PLUG_BADGE_R = 12;
const PLUG_SCALE = 1.22;

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
    case 'desk': g.addColorStop(0, '#cfdbe0'); g.addColorStop(1, '#aebfc6'); break;
    case 'radio': g.addColorStop(0, '#5b2f33'); g.addColorStop(1, '#3a1d22'); break;
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
  } else if (theme === 'desk') {
    // pegboard
    ctx.fillStyle = 'rgba(40,60,72,0.16)';
    for (let y = 26; y < FLOOR; y += 34) for (let x = 20; x < W; x += 34) { ctx.beginPath(); ctx.arc(x, y, 3.2, 0, Math.PI * 2); ctx.fill(); }
  } else if (theme === 'radio') {
    // vertical walnut slats
    for (let x = 0, i = 0; x < W; x += 30, i++) {
      const v = hash(i + 3);
      ctx.fillStyle = `rgba(${120 + v * 40},${66 + v * 22},${48 + v * 14},0.55)`;
      ctx.fillRect(x + 2, 0, 24, FLOOR);
      ctx.fillStyle = 'rgba(255,220,180,0.10)'; ctx.fillRect(x + 2, 0, 2, FLOOR);
      ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fillRect(x + 26, 0, 4, FLOOR);
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
    desk: ['#c79a6b', '#a27a4e'], radio: ['#2a1417', '#1c0d10'],
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
        ctx.save(); ctx.beginPath(); ctx.rect(sx, sy, sw, sh); ctx.clip();
        ctx.fillStyle = '#5fbf6a';
        ctx.beginPath(); ctx.ellipse(sx + sw * 0.3, sy + sh, sw * 0.4, sh * 0.45, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#48a456';
        ctx.beginPath(); ctx.ellipse(sx + sw * 0.8, sy + sh, sw * 0.35, sh * 0.35, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = '#ffe066';
        ctx.beginPath(); ctx.arc(sx + sw * 0.75, sy + sh * 0.3, 8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
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
    case 'dock':
      body(ctx, d, '#4a5464', '#333b48', 18);
      label(ctx, d.label, d.x + d.w / 2, d.y + 24, '#c9d4e4', 14);
      for (let i = 0; i < 5; i++) led(ctx, d.x + d.w / 2 - 48 + i * 24, d.y + 46, 4, g.allGood ? (blink(i) ? '#5dff95' : '#2c8f54') : '#1c222c', g.allGood);
      break;
    case 'console':
      body(ctx, d, '#2e3440', '#1d2129', 12);
      label(ctx, d.label, d.x + d.w / 2, d.y + d.h - 12, '#9fb0c8', 11);
      rr(ctx, d.x + 18, d.y + 46, d.w - 36, 10, 5);
      ctx.fillStyle = ok ? '#8fd4ff' : '#14171d';
      if (ok) { ctx.shadowColor = '#8fd4ff'; ctx.shadowBlur = 14; }
      ctx.fill(); ctx.shadowBlur = 0;
      break;
    case 'mic':
      body(ctx, d, '#3b3032', '#271e20', 10);
      label(ctx, d.label, d.x + d.w / 2, d.y + d.h - 12, '#e3c9a8', 11);
      rr(ctx, d.x + d.w / 2 - 42, d.y + 42, 84, 18, 5); ctx.fillStyle = ok ? '#e8442e' : '#3a2320';
      if (ok) { ctx.shadowColor = '#ff6a4d'; ctx.shadowBlur = 16; }
      ctx.fill(); ctx.shadowBlur = 0;
      label(ctx, ok ? 'ON AIR' : 'OFF AIR', d.x + d.w / 2, d.y + 51, ok ? '#fff' : '#8d6f68', 11);
      break;
    case 'speaker':
      body(ctx, d, '#2c2425', '#1a1415', 8);
      for (const k of [0.3, 0.7]) {
        const beat = ok ? 1 + Math.max(0, Math.sin(t * 7)) * 0.08 : 1;
        ctx.beginPath(); ctx.arc(d.x + d.w * k, d.y + 56, 17 * beat, 0, Math.PI * 2); ctx.fillStyle = '#0f0b0c'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = '#5c4a44'; ctx.stroke();
        ctx.beginPath(); ctx.arc(d.x + d.w * k, d.y + 56, 7 * beat, 0, Math.PI * 2); ctx.fillStyle = '#6b5750'; ctx.fill();
      }
      break;
    case 'mixer': {
      body(ctx, d, '#43383a', '#2c2426', 10);
      label(ctx, d.label, d.x + 46, d.y + 20, '#e3c9a8', 13);
      for (let i = 0; i < 11; i++) { // VU meters
        const lv = ok ? 0.35 + 0.6 * Math.abs(Math.sin(t * (2.2 + hash(i) * 3) + i)) : 0.08;
        for (let k = 0; k < 6; k++) {
          ctx.fillStyle = k / 6 < lv ? (k > 4 ? '#ffd166' : '#5dff95') : '#1b1516';
          ctx.fillRect(d.x + 100 + i * 33, d.y + 50 - k * 7, 22, 5);
        }
      }
      break;
    }
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
  if (g.level.tools.screw) drawScrew(ctx, p.x - 19, s === 1 ? p.y - 7 : p.y + 7, p.tight, !!p.end);
  if (p.pulse > 0) {
    ctx.strokeStyle = `rgba(255,255,255,${p.pulse * 0.8})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(p.x, p.y, 16 + (1 - p.pulse) * 20, 0, Math.PI * 2); ctx.stroke();
  }
}

function drawScrew(ctx: C2D, x: number, y: number, k: number, on: boolean) {
  const r = 8;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = k >= 1 ? '#f0cf7a' : on ? '#b9c0c9' : '#858c96'; ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = '#2a2e35'; ctx.stroke();
  ctx.save();
  ctx.translate(x, y); ctx.rotate(0.6 + k * Math.PI * 5);
  ctx.strokeStyle = '#2a2e35'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-5, 0); ctx.lineTo(5, 0); ctx.moveTo(0, -5); ctx.lineTo(0, 5); ctx.stroke();
  ctx.restore();
  if (k > 0 && k < 1) {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(x, y, r + 5, -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2); ctx.stroke();
  }
}

// ---------------------------------------------------------------- dust
let dustSprite: HTMLCanvasElement | null = null;
function drawDust(ctx: C2D, g: Game) {
  if (!g.dust.length) return;
  if (!dustSprite) {
    dustSprite = document.createElement('canvas');
    dustSprite.width = dustSprite.height = 64;
    const x = dustSprite.getContext('2d')!;
    for (let i = 0; i < 46; i++) {
      const a = hash(i) * Math.PI * 2, q = Math.sqrt(hash(i + 50)) * 24, r = 3 + hash(i + 90) * 6;
      const gr = x.createRadialGradient(32 + Math.cos(a) * q, 32 + Math.sin(a) * q, 0, 32 + Math.cos(a) * q, 32 + Math.sin(a) * q, r);
      gr.addColorStop(0, 'rgba(176,168,154,0.5)'); gr.addColorStop(1, 'rgba(176,168,154,0)');
      x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
    }
    x.strokeStyle = 'rgba(222,216,204,0.55)'; x.lineWidth = 0.9;
    for (let i = 0; i < 16; i++) { // lint fibres
      const a = hash(i + 7) * 6.3, q = hash(i + 33) * 20;
      const px = 32 + Math.cos(a) * q, py = 32 + Math.sin(a) * q;
      x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 6, py - 5 + hash(i) * 10, px + (hash(i + 2) - 0.5) * 22, py + (hash(i + 4) - 0.5) * 22); x.stroke();
    }
  }
  for (const d of g.dust) {
    ctx.globalAlpha = Math.max(0, d.a);
    ctx.drawImage(dustSprite, d.x - d.r * 1.5, d.y - d.r * 1.5, d.r * 3, d.r * 3);
  }
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- hooks & ducts
function drawHook(ctx: C2D, h: Hook, front: boolean, hot: boolean) {
  const w = 14 + h.cap * 5.4;
  ctx.lineCap = 'round';
  if (!front) {
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; rr(ctx, h.x - w - 7, h.y - 13, (w + 10) * 2, 34, 11); ctx.fill();
    ctx.fillStyle = '#8d97a5'; rr(ctx, h.x - w - 10, h.y - 17, (w + 10) * 2, 34, 11); ctx.fill();
    ctx.fillStyle = '#6d7785'; rr(ctx, h.x - w, h.y - 7, w * 2, 14, 7); ctx.fill();
    ctx.fillStyle = '#4c5561';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(h.x + s * (w + 4), h.y + 10, 2.6, 0, Math.PI * 2); ctx.fill(); }
    if (hot) { ctx.strokeStyle = '#fff3a8'; ctx.lineWidth = 3; rr(ctx, h.x - w - 14, h.y - 21, (w + 14) * 2, 42, 14); ctx.stroke(); }
    return;
  }
  // the bar that closes over the cables
  ctx.strokeStyle = '#3f4853'; ctx.lineWidth = 9;
  ctx.beginPath(); ctx.moveTo(h.x - w, h.y); ctx.quadraticCurveTo(h.x, h.y + 9, h.x + w, h.y); ctx.stroke();
  ctx.strokeStyle = '#c3cbd6'; ctx.lineWidth = 5.5;
  ctx.beginPath(); ctx.moveTo(h.x - w, h.y); ctx.quadraticCurveTo(h.x, h.y + 9, h.x + w, h.y); ctx.stroke();
  for (let i = 0; i < h.cap; i++) { // capacity dots
    ctx.beginPath(); ctx.arc(h.x + (i - (h.cap - 1) / 2) * 10, h.y - 12, 3, 0, Math.PI * 2);
    ctx.fillStyle = i < h.tie.entries.length ? '#5dff95' : '#4c5561'; ctx.fill();
  }
}

function drawDuct(ctx: C2D, g: Game, d: Duct, front: boolean, hot: boolean, ui: boolean) {
  const pitch = 18, fw = 13;
  if (!front) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(ctx, d.x + 5, d.y + 7, d.w, d.h, 5); ctx.fill();
    ctx.fillStyle = '#7f8892'; rr(ctx, d.x, d.y, d.w, d.h, 5); ctx.fill();
    ctx.fillStyle = '#69727c'; ctx.fillRect(d.x + 10, d.y + 2, d.w - 20, d.h - 4);
    if (hot) { ctx.strokeStyle = '#fff3a8'; ctx.lineWidth = 4; rr(ctx, d.x - 5, d.y - 5, d.w + 10, d.h + 10, 8); ctx.stroke(); }
    return;
  }
  // fingers on both sides
  for (let y = d.y + 3; y + fw <= d.y + d.h; y += pitch) for (const x of [d.x - 2, d.x + d.w - 10]) {
    ctx.fillStyle = '#5c646e'; rr(ctx, x, y + 1.5, 12, fw, 3); ctx.fill();
    ctx.fillStyle = '#c4cbd3'; rr(ctx, x, y, 12, fw, 3); ctx.fill();
  }
  const ly = d.y + d.h * d.lid;
  if (d.lid > 0) {
    const gr = ctx.createLinearGradient(d.x, 0, d.x + d.w, 0);
    gr.addColorStop(0, '#b9c1ca'); gr.addColorStop(0.2, '#eef1f5'); gr.addColorStop(0.8, '#dfe4ea'); gr.addColorStop(1, '#a9b1bb');
    ctx.fillStyle = gr; rr(ctx, d.x - 5, d.y - 4, d.w + 10, ly - d.y + 6, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(60,68,78,0.55)'; ctx.lineWidth = 1.5; ctx.stroke();
    if (d.shine > 0) {
      ctx.save();
      rr(ctx, d.x - 5, d.y - 4, d.w + 10, d.h + 8, 5); ctx.clip();
      const yy = d.y + d.h * (1.2 - d.shine * 1.4);
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath(); ctx.moveTo(d.x - 10, yy + 40); ctx.lineTo(d.x + d.w + 10, yy - 10); ctx.lineTo(d.x + d.w + 10, yy + 18); ctx.lineTo(d.x - 10, yy + 68); ctx.fill();
      ctx.restore();
    }
  }
  if (ui && d.lid < 1) {
    const h = g.lidHandle(d), ready = d.st[0].entries.length > 0;
    const bob = ready && g.grab?.kind !== 'lid' ? Math.sin(g.time * 5) * 2.5 : 0;
    ctx.globalAlpha = ready ? 1 : 0.55;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, h.x - 38, h.y - 12 + bob, 80, 28, 14); ctx.fill();
    ctx.fillStyle = '#f3f5f8'; rr(ctx, h.x - 40, h.y - 15 + bob, 80, 28, 14); ctx.fill();
    ctx.strokeStyle = '#5c646e'; ctx.lineWidth = 2; ctx.stroke();
    label(ctx, 'LID', h.x - 12, h.y + bob, '#2a2e35', 13);
    ctx.strokeStyle = '#2a2e35'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(h.x + 11, h.y - 3 + bob); ctx.lineTo(h.x + 18, h.y + 4 + bob); ctx.lineTo(h.x + 25, h.y - 3 + bob); ctx.stroke();
    ctx.globalAlpha = 1;
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

function drawPlug(ctx: C2D, g: Game, e: End, wire: boolean, hot: boolean, halo: boolean) {
  const pg = g.plugGeom(e);
  if (hot || halo) {
    // reachable head: soft capsule around it
    const k = halo && !hot ? 0.5 + 0.5 * Math.sin(g.time * 4 + e.cable.id) : 1;
    ctx.lineCap = 'round';
    ctx.strokeStyle = hot ? 'rgba(255,243,168,0.95)' : `rgba(255,255,255,${0.2 + 0.3 * k})`;
    ctx.lineWidth = (hot ? 40 : 34) + k * 3;
    ctx.beginPath(); ctx.moveTo(pg.ex - pg.dx * 12, pg.ey - pg.dy * 12); ctx.lineTo(pg.ex + pg.dx * 14, pg.ey + pg.dy * 14); ctx.stroke();
  }
  const col = COLORS[e.cable.color];
  ctx.save();
  ctx.translate(pg.ex, pg.ey);
  ctx.rotate(Math.atan2(pg.dy, pg.dx));
  const bounce = e.port ? 1 + Math.sin(Math.min(1, e.port.pulse * 1.4) * Math.PI) * 0.16 : 1;
  const grown = g.grab?.end === e && !g.grab.latch ? 1.1 : 1;
  ctx.scale(grown, PLUG_SCALE * bounce * grown);
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
  drawBadge(ctx, e.cable.color, pg.ex - pg.dx * 12, pg.ey - pg.dy * 12, PLUG_BADGE_R * (hot ? 1.15 : 1));
}

function drawTie(ctx: C2D, t: Tie, hi: boolean) {
  const m = t.entries.length;
  const half = ((m - 1) * REP_R) / 2 + 8;
  // closes with a little overshoot
  const k = Math.min(1, t.t * 1.5), sc = 1 + (1 - k) * 0.7 - Math.sin(k * Math.PI) * 0.12;
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.rotate(Math.atan2(t.ny, t.nx));
  ctx.scale(sc, sc);
  if (hi) { ctx.shadowColor = '#fff3a8'; ctx.shadowBlur = 14; }
  if (t.kind === 'velcro') {
    ctx.fillStyle = '#12151a'; rr(ctx, -half - 2, -9, half * 2 + 4, 18, 5); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#3b4d66'; rr(ctx, -half, -7.5, half * 2, 15, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 1; ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(-half + 3, -5); ctx.lineTo(half - 3, -5); ctx.moveTo(-half + 3, 5); ctx.lineTo(half - 3, 5); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#5d7596'; rr(ctx, half - 14, -7.5, 18, 15, 4); ctx.fill();
  } else {
    ctx.fillStyle = hi ? '#4a5260' : '#1c1f24';
    rr(ctx, -half, -4, half * 2, 8, 3); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(-half + 3, -3, half * 2 - 6, 1.5);
    ctx.fillStyle = hi ? '#4a5260' : '#1c1f24';
    rr(ctx, half - 2, -6, 9, 12, 2.5); ctx.fill();
    if (t.tail > 0) {
      rr(ctx, half + 5, -2.4, 24 * k, 4.8, 2); ctx.fill();
      // "snip here" mark
      ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2; ctx.setLineDash([3, 2.5]);
      ctx.beginPath(); ctx.moveTo(half + 10, -8); ctx.lineTo(half + 10, 8); ctx.stroke();
      ctx.setLineDash([]);
    }
  }
  ctx.restore();
}

function drawWrap(ctx: C2D, run: Run, hi: boolean) {
  const st = run.stations;
  const m = Math.max(...st.map((t) => t.entries.length)), half = ((m - 1) * 5) / 2 + 8;
  ctx.lineCap = 'round';
  for (let i = 0; i < st.length - 1; i++) {
    const a = st[i], b = st[i + 1];
    for (const q of [0.5]) {
      const x = a.x + (b.x - a.x) * q, y = a.y + (b.y - a.y) * q;
      const nx = a.nx + (b.nx - a.nx) * q, ny = a.ny + (b.ny - a.ny) * q;
      const tx = ny * 3.2, ty = -nx * 3.2;
      ctx.strokeStyle = hi ? '#565f6e' : '#171a1f'; ctx.lineWidth = 6.5;
      ctx.beginPath(); ctx.moveTo(x - nx * half - tx, y - ny * half - ty); ctx.lineTo(x + nx * half + tx, y + ny * half + ty); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.3)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x - nx * half * 0.6 - tx - 1, y - ny * half * 0.6 - ty - 1.4); ctx.lineTo(x + nx * half * 0.2 + tx - 1, y + ny * half * 0.2 + ty - 1.4); ctx.stroke();
    }
  }
  for (const t of [st[0], st[st.length - 1]]) { // end caps
    ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(t.x - t.nx * half, t.y - t.ny * half); ctx.lineTo(t.x + t.nx * half, t.y + t.ny * half); ctx.stroke();
  }
}

function drawCombPiece(ctx: C2D, t: { x: number; y: number; nx: number; ny: number }, lanes: number[], hi: boolean, handle: boolean) {
  const lo = Math.min(...lanes) - 10, hi2 = Math.max(...lanes) + 10;
  ctx.save();
  ctx.translate(t.x, t.y);
  ctx.rotate(Math.atan2(t.ny, t.nx));
  ctx.shadowColor = hi ? '#fff3a8' : 'rgba(0,0,0,0.35)'; ctx.shadowBlur = hi ? 14 : 5;
  ctx.fillStyle = handle ? '#ffd166' : '#e9eef5';
  rr(ctx, lo, -7, hi2 - lo, 6, 3); ctx.fill();
  rr(ctx, lo, 2, hi2 - lo, 6, 3); ctx.fill();
  ctx.shadowBlur = 0;
  const edges = [lo, ...lanes.slice(1).map((l, i) => (l + lanes[i]) / 2 - 1.5), hi2 - 3];
  for (const e of edges) ctx.fillRect(e, -6, 3, 13);
  ctx.restore();
}

function drawReel(ctx: C2D, g: Game, r: Reel, hi: boolean) {
  const c = r.cable, x = c.x[r.idx], y = c.y[r.idx], col = COLORS[c.color];
  const held = g.grab?.reel === r;
  const s = 1 + Math.sin(r.pop * Math.PI) * 0.22 + (held ? 0.06 : 0);
  const k = clamp(c.wound / (c.length * 0.58), 0, 1);
  ctx.save();
  ctx.translate(x, y); ctx.scale(s, s);
  ctx.beginPath(); ctx.arc(3, 5, REEL_R + 2, 0, Math.PI * 2); ctx.fillStyle = 'rgba(0,0,0,0.28)'; ctx.fill();
  if (hi) { ctx.shadowColor = '#fff3a8'; ctx.shadowBlur = 16; }
  ctx.beginPath(); ctx.arc(0, 0, REEL_R + 2, 0, Math.PI * 2); ctx.fillStyle = '#20252e'; ctx.fill();
  ctx.shadowBlur = 0;
  ctx.beginPath(); ctx.arc(0, 0, REEL_R - 1, 0, Math.PI * 2); ctx.fillStyle = '#434d5c'; ctx.fill();
  // wound turns pile up outwards from the hub
  const turns = Math.ceil(k * 4.4);
  for (let i = 0; i < turns; i++) {
    const rad = 8 + i * 3;
    ctx.beginPath(); ctx.arc(0, 0, rad, 0, Math.PI * 2);
    ctx.strokeStyle = col.dark; ctx.lineWidth = 3.4; ctx.stroke();
    ctx.strokeStyle = col.base; ctx.lineWidth = 2.2; ctx.stroke();
  }
  ctx.rotate(r.spin);
  ctx.fillStyle = '#f3f5f8';
  ctx.beginPath(); ctx.arc(0, 0, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#20252e'; ctx.lineWidth = 2;
  ctx.beginPath(); for (let i = 0; i < 3; i++) { const a = (i * Math.PI * 2) / 3; ctx.moveTo(0, 0); ctx.lineTo(Math.cos(a) * 6, Math.sin(a) * 6); } ctx.stroke();
  ctx.rotate(-r.spin);
  // crank handle
  ctx.save(); ctx.rotate(r.spin * 0.5); ctx.beginPath(); ctx.arc(0, -REEL_R + 1, 5, 0, Math.PI * 2); ctx.fillStyle = '#ffd166'; ctx.fill(); ctx.lineWidth = 1.5; ctx.strokeStyle = '#20252e'; ctx.stroke(); ctx.restore();
  ctx.restore();
  if (r.tight) drawStatusLed(ctx, x + REEL_R, y - REEL_R, 7, 'ok');
}

function drawLabel(ctx: C2D, c: Cable, i: number) {
  const k = c.label, pop = k < 1 ? Math.sin(k * Math.PI * 0.5) * (1 + Math.sin(k * Math.PI) * 0.3) : 1;
  const dx = c.x[i + 1] - c.x[i - 1], dy = c.y[i + 1] - c.y[i - 1];
  ctx.save();
  ctx.translate(c.x[i], c.y[i]);
  let a = Math.atan2(dy, dx) + Math.PI / 2; // across the cable, kept upright
  if (Math.cos(a) < 0) a += Math.PI;
  ctx.rotate(a);
  ctx.scale(pop, 1);
  ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, -14, -7, 31, 18, 3); ctx.fill();
  ctx.fillStyle = '#fffdf2'; rr(ctx, -15, -9, 30, 18, 3); ctx.fill();
  ctx.strokeStyle = COLORS[c.color].dark; ctx.lineWidth = 2; ctx.stroke();
  label(ctx, String(c.id + 1).padStart(2, '0'), 0, 0.5, '#14171c', 13);
  ctx.restore();
}

function drawPulse(ctx: C2D, c: Cable, t: number, from: 0 | 1, strong: boolean) {
  const e = t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t);
  const len = strong ? 0.22 : 0.08, n = c.n - 1;
  ctx.lineCap = 'round';
  for (let k = 0; k < 8; k++) {
    const f0 = clamp(e * (1 + len) - len + (len * k) / 8, 0, 1) * n, f1 = clamp(e * (1 + len) - len + (len * (k + 1)) / 8, 0, 1) * n;
    if (f1 - f0 < 0.01) continue;
    const at = (f: number) => {
      const q = from === 0 ? f : n - f, i = Math.min(n - 1, Math.floor(q)), u = q - i;
      return [c.x[i] + (c.x[i + 1] - c.x[i]) * u, c.y[i] + (c.y[i + 1] - c.y[i]) * u];
    };
    const [x0, y0] = at(f0), [x1, y1] = at(f1);
    const a = ((k + 1) / 8) * (strong ? 1 : 0.55);
    if (strong) { ctx.strokeStyle = `rgba(160,255,200,${a * 0.35})`; ctx.lineWidth = 18; ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
    ctx.strokeStyle = `rgba(255,255,255,${a})`; ctx.lineWidth = strong ? 6 : 3.5;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
  }
}

/** The tool itself, drawn at the pointer. */
function drawToolCursor(ctx: C2D, g: Game, tool: ToolId) {
  const { x, y } = g.pointer, t = g.time;
  if (x < 0 || g.power >= 0) return;
  const ring = (r: number) => {
    ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
    ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.beginPath(); ctx.arc(x, y, r + 1.5, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
  };
  if ((tool === 'zip' || tool === 'wrap') && !g.grab) ring(GATHER_R);
  if (tool === 'velcro' && !g.grab) ring(TIE_R + 18);
  if (tool === 'reel' && !g.grab) ring(30);
  if (tool === 'label' && !g.grab) ring(26);
  if (tool === 'comb' && g.grab?.kind !== 'run') {
    const n = 11;
    drawCombPiece(ctx, { x, y, nx: 1, ny: 0 }, Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) * ((COMB_R * 1.2) / n)), false, true);
  }
  if (tool === 'air') {
    const on = g.grab?.kind === 'air';
    if (on) {
      for (let i = 0; i < 12; i++) {
        const k = (t * 3.4 + hash(i) * 1.7) % 1, a = -2.5 + hash(i + 9) * 5 + Math.sin(t * 9 + i) * 0.2;
        ctx.fillStyle = `rgba(255,255,255,${0.4 * (1 - k)})`;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * k * AIR_R, y + Math.sin(a) * k * AIR_R, 3 + k * 9, 0, Math.PI * 2); ctx.fill();
      }
    } else ring(AIR_R * 0.8);
    ctx.save();
    ctx.translate(x + (on ? (Math.random() - 0.5) * 2 : 0), y + (on ? (Math.random() - 0.5) * 2 : 0));
    ctx.rotate(-0.5);
    ctx.fillStyle = '#c94f3a'; ctx.fillRect(2, -1.5, 26, 3);
    ctx.fillStyle = '#20252e'; rr(ctx, 26, -7, 22, 14, 4); ctx.fill();
    ctx.fillStyle = '#e8edf3'; rr(ctx, 46, -13, 62, 28, 8); ctx.fill();
    ctx.fillStyle = '#2f7bf5'; ctx.fillRect(58, -13, 30, 28);
    ctx.strokeStyle = '#20252e'; ctx.lineWidth = 2; rr(ctx, 46, -13, 62, 28, 8); ctx.stroke();
    ctx.restore();
  }
  if (tool === 'screw' && g.grab?.kind === 'screw' && g.grab.port) {
    const p = g.grab.port, sx = p.x - 19, sy = p.y - p.dir * 7;
    const spin = p.tight < 1 ? Math.sin(t * 50) * 1.2 : 0;
    ctx.save();
    ctx.translate(sx + spin, sy); ctx.rotate(p.dir === 1 ? 2.3 : -2.3 + Math.PI * 0);
    ctx.fillStyle = '#aab2bd'; ctx.fillRect(4, -2.5, 34, 5);
    ctx.fillStyle = '#e0592a'; rr(ctx, 36, -9, 48, 18, 8); ctx.fill();
    ctx.fillStyle = '#20252e'; for (const q of [-4.5, 0, 4.5]) ctx.fillRect(44, q - 1, 32, 2);
    ctx.restore();
  }
}

export function drawScene(ctx: C2D, g: Game, opts: DrawOpts) {
  const t = g.time, gr = g.grab, ui = opts.ui;
  const wire = g.level.plug === 'wire';
  const hover = ui && !gr ? g.hover : null;
  const heldTie = gr?.kind === 'tie' ? gr.tie : hover?.kind === 'tie' ? hover.tie : null;
  drawBackground(ctx, g.level.theme);
  for (const d of g.level.devices) drawDevice(ctx, g, d, t);
  drawDust(ctx, g);
  for (const p of g.ports) drawPort(ctx, g, p, t);

  // drop targets for a dragged cord
  let hotHook: Hook | null = null, hotDuct: Duct | null = null;
  if (ui && gr?.kind === 'cable' && gr.cable && gr.idx !== undefined && !gr.hold && gr.moved) {
    const x = gr.cable.x[gr.idx], y = gr.cable.y[gr.idx];
    hotHook = g.hookAt(x, y, gr.cable);
    hotDuct = hotHook ? null : g.ductAt(x, y, gr.cable);
  }
  for (const h of g.hooks) { drawHook(ctx, h, false, h === hotHook); if (!h.tie.entries.length) drawHook(ctx, h, true, false); }
  for (const d of g.ducts) drawDuct(ctx, g, d, false, d === hotDuct, ui);

  // shadows
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 9;
  for (const c of g.order) { cablePath(ctx, c, 3, 5); ctx.stroke(); }

  const litCable = hover?.kind === 'cable' ? hover.cable : null;
  // cables on a hook go behind its bar, the rest pass in front of it
  const onHook = new Set(g.hooks.flatMap((h) => h.tie.entries.map((e) => e.cable)));
  const layered = [...g.order].sort((a, b) => Number(onHook.has(b)) - Number(onHook.has(a)));
  let bars = false;
  for (const c of layered) {
    if (!bars && !onHook.has(c)) { bars = true; for (const h of g.hooks) if (h.tie.entries.length) drawHook(ctx, h, true, false); }
    if (c === litCable) { ctx.strokeStyle = 'rgba(255,243,168,0.55)'; ctx.lineWidth = 16; cablePath(ctx, c); ctx.stroke(); }
    drawCable(ctx, c, wire, g.isGrabbed(c));
  }
  if (hover?.kind === 'cable') { // exact grab point
    ctx.beginPath(); ctx.arc(hover.cable.x[hover.idx], hover.cable.y[hover.idx], 8, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,243,168,0.9)'; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = '#2a2205'; ctx.stroke();
  }
  for (const p of g.pulses) if (p.delay <= 0) drawPulse(ctx, p.cable, p.t, p.from, p.strong);

  // everything that holds cables
  const runs = new Set(g.ties.filter((q) => q.run).map((q) => q.run!));
  for (const run of runs) {
    const hi = !!heldTie && heldTie.run === run;
    if (run.kind === 'wrap') { if (run.stations.length > 1) drawWrap(ctx, run, hi); continue; }
    const last = run.stations[run.stations.length - 1], active = gr?.run === run;
    const lanes = (q: Tie) => (q.entries.length ? q.entries.map((e) => e.off).sort((a, b) => a - b) : [0]);
    if (run.stations[0].entries.length) drawCombPiece(ctx, run.stations[0], lanes(run.stations[0]), hi, false);
    if (active || last.entries.length) drawCombPiece(ctx, last, lanes(last), hi || active, active);
  }
  if (!bars) for (const h of g.hooks) if (h.tie.entries.length) drawHook(ctx, h, true, false);
  for (const d of g.ducts) drawDuct(ctx, g, d, true, false, ui);
  for (const tie of g.ties) if (tie.kind === 'zip' || tie.kind === 'velcro') drawTie(ctx, tie, ui && tie === heldTie);
  for (const r of g.reels) drawReel(ctx, g, r, ui && ((hover?.kind === 'reel' && hover.reel === r) || gr?.reel === r));
  for (const c of g.order) if (c.label > 0) { drawLabel(ctx, c, 5); drawLabel(ctx, c, c.n - 6); }

  // free sockets that match the plug in hand
  if (ui && gr?.end && !gr.latch) {
    const other = gr.end.cable.ends[1 - gr.end.which].port;
    for (const p of g.ports) {
      if (p.color !== gr.end.cable.color || (p.end && p.end.cable.color === p.color) || other?.side === p.side) continue;
      const k = 0.5 + 0.5 * Math.sin(t * 6);
      ctx.strokeStyle = `rgba(255,243,168,${0.45 + 0.4 * k})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(p.x, p.y + p.dir * 2, 19 + k * 4, 0, Math.PI * 2); ctx.stroke();
    }
  }
  // plug heads always on top: never buried under other cables
  for (const c of g.order) for (const e of c.ends) {
    const hot = ui && ((hover?.kind === 'plug' && hover.end === e) || gr?.end === e);
    drawPlug(ctx, g, e, wire, hot, ui && !e.port && gr?.end !== e);
  }

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
  for (const b of g.bits) {
    ctx.save();
    ctx.translate(b.x, b.y); ctx.rotate(b.rot);
    ctx.globalAlpha = Math.min(1, (1 - b.t / b.life) * 2);
    ctx.fillStyle = b.color; ctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
    ctx.restore();
  }

  if (!ui) return;
  if (g.hoverPort && gr?.end) {
    const p = g.hoverPort;
    const match = p.color === gr.end.cable.color;
    ctx.strokeStyle = match ? COLORS[p.color].light : 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3;
    ctx.setLineDash([5, 4]);
    ctx.beginPath(); ctx.arc(p.x, p.y, 24 + Math.sin(t * 10) * 2, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);
    // explicit match / no-match glyph next to the target port
    drawStatusLed(ctx, p.x - 28, p.dir === 1 ? p.y + 14 : p.y - 14, 8, match ? 'ok' : 'bad');
  }
  if (g.allGood && g.power < 0) { // what still crosses
    const k = 0.5 + 0.5 * Math.sin(t * 4);
    for (const q of g.crossPts) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.beginPath(); ctx.arc(q.x, q.y, 15 + k * 3, 0, Math.PI * 2); ctx.stroke();
      ctx.strokeStyle = '#ffd166'; ctx.beginPath(); ctx.arc(q.x, q.y, 13 + k * 3, 0, Math.PI * 2); ctx.stroke();
    }
  }
  drawToolCursor(ctx, g, opts.tool);
  if (g.power >= 0) { // lights out, then the room comes back as each cable lights up
    const dim = g.power < 0.35 ? Math.min(1, g.power * 8) : clamp(1 - (g.power - 0.45) / 1.9, 0, 1);
    ctx.fillStyle = `rgba(6,10,20,${0.55 * dim})`;
    ctx.fillRect(0, 0, W, H);
    for (const p of g.pulses) if (p.strong && p.delay <= 0) drawPulse(ctx, p.cable, p.t, p.from, true);
  } else if (g.allGood) {
    const a = 0.12 + 0.08 * Math.sin(t * 3);
    ctx.fillStyle = `rgba(120,255,170,${a})`;
    ctx.fillRect(0, 0, W, 4);
  }
}
