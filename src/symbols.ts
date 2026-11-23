import { COLORS, type ColorKey, type SymbolKey } from './palette';

type C2D = CanvasRenderingContext2D;

/** Path of `s` centred on (x, y), fitting inside radius r. */
function symbolPath(ctx: C2D, s: SymbolKey, x: number, y: number, r: number) {
  ctx.beginPath();
  switch (s) {
    case 'circle': ctx.arc(x, y, r * 0.78, 0, Math.PI * 2); break;
    case 'square': ctx.rect(x - r * 0.68, y - r * 0.68, r * 1.36, r * 1.36); break;
    case 'diamond': ctx.moveTo(x, y - r); ctx.lineTo(x + r * 0.8, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r * 0.8, y); ctx.closePath(); break;
    case 'triangle': ctx.moveTo(x, y - r * 0.92); ctx.lineTo(x + r * 0.95, y + r * 0.72); ctx.lineTo(x - r * 0.95, y + r * 0.72); ctx.closePath(); break;
    case 'star':
      for (let i = 0; i < 10; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r * 1.02;
        if (i) ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); else ctx.moveTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
      }
      ctx.closePath();
      break;
    case 'bars':
      for (let i = -1; i <= 1; i++) ctx.rect(x - r * 0.8, y + i * r * 0.62 - r * 0.2, r * 1.6, r * 0.4);
      break;
  }
}

/**
 * Colour badge: a disc filled with the cable colour, a dark ring, and the colour's symbol in a
 * contrasting ink. Always drawn upright so it reads the same everywhere.
 */
export function drawBadge(ctx: C2D, color: ColorKey, x: number, y: number, r: number) {
  const c = COLORS[color];
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = c.base; ctx.fill();
  ctx.lineWidth = Math.max(1.5, r * 0.16); ctx.strokeStyle = '#0d0f13'; ctx.stroke();
  symbolPath(ctx, c.symbol, x, y, r * 0.58);
  ctx.fillStyle = c.ink; ctx.fill();
}

const SVG_PATHS: Record<SymbolKey, string> = {
  circle: '<circle cx="12" cy="12" r="5.4"/>',
  square: '<rect x="7.2" y="7.2" width="9.6" height="9.6"/>',
  diamond: '<path d="M12 5 L17.6 12 L12 19 L6.4 12Z"/>',
  triangle: '<path d="M12 5.6 L18.6 17 L5.4 17Z"/>',
  star: '<path d="M12 4.9 L13.9 9.4 L18.8 9.8 L15 13 L16.2 17.8 L12 15.2 L7.8 17.8 L9 13 L5.2 9.8 L10.1 9.4Z"/>',
  bars: '<rect x="6.4" y="6.6" width="11.2" height="2.8"/><rect x="6.4" y="10.6" width="11.2" height="2.8"/><rect x="6.4" y="14.6" width="11.2" height="2.8"/>',
};

/** Same badge as inline SVG for the HTML UI (legend chips). */
export function badgeSvg(color: ColorKey, size = 22) {
  const c = COLORS[color];
  return `<svg class="badge" width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" style="stroke:none">`
    + `<circle cx="12" cy="12" r="10.6" fill="${c.base}" stroke="#0d0f13" stroke-width="1.8"/>`
    + `<g fill="${c.ink}">${SVG_PATHS[c.symbol]}</g></svg>`;
}

// ---------------------------------------------------------------- status LEDs
export type LedState = 'off' | 'ok' | 'warn' | 'bad';

/**
 * Status LED that never relies on hue alone:
 *   ok   – bright green, glowing, with a check mark
 *   warn – mid-brightness amber, with an exclamation mark
 *   bad  – dark red (blinks darker), with a cross
 *   off  – unlit grey, no glyph
 */
export function drawStatusLed(ctx: C2D, x: number, y: number, r: number, st: LedState, blinkOn = true) {
  const fill = st === 'ok' ? '#5dff95' : st === 'warn' ? '#f0a21a' : st === 'bad' ? (blinkOn ? '#d0242b' : '#6e1216') : '#2b2f36';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  if (st === 'ok') { ctx.shadowColor = fill; ctx.shadowBlur = r * 2.4; }
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.lineWidth = Math.max(1, r * 0.18); ctx.strokeStyle = '#0d0f13'; ctx.stroke();
  if (st === 'off') return;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = st === 'bad' ? '#ffffff' : '#10140f';
  ctx.fillStyle = ctx.strokeStyle;
  ctx.lineWidth = Math.max(1.4, r * 0.32);
  ctx.beginPath();
  if (st === 'ok') {
    ctx.moveTo(x - r * 0.48, y + r * 0.02); ctx.lineTo(x - r * 0.12, y + r * 0.4); ctx.lineTo(x + r * 0.52, y - r * 0.38);
    ctx.stroke();
  } else if (st === 'bad') {
    const k = r * 0.38;
    ctx.moveTo(x - k, y - k); ctx.lineTo(x + k, y + k); ctx.moveTo(x + k, y - k); ctx.lineTo(x - k, y + k);
    ctx.stroke();
  } else {
    ctx.moveTo(x, y - r * 0.5); ctx.lineTo(x, y + r * 0.1); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y + r * 0.45, r * 0.15, 0, Math.PI * 2); ctx.fill();
  }
}
