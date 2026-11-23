/**
 * Colour-vision-deficiency (CVD) simulation + perceptual colour difference.
 *
 * Simulations (all applied to linear-light sRGB, results clamped to [0,1]):
 *   - Machado, Oliveira & Fernandes 2009, severity 1.0 (full dichromacy) for protan, deutan, tritan.
 *   - Viénot, Brettel & Mollon 1999 for protan and deutan (cross-check, as in DaltonLens).
 *   - Brettel, Viénot & Mollon 1997 for tritan (two half-planes, DaltonLens matrices).
 * Difference: CIEDE2000 (ΔE00) in CIELAB, D65 white.
 */
export type Vision = 'normal' | 'protan' | 'deutan' | 'tritan';
type M3 = number[][];

const MACHADO: Record<Exclude<Vision, 'normal'>, M3> = {
  protan: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
  deutan: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  tritan: [[1.255528, -0.076749, -0.178779], [-0.078411, 0.930809, 0.147602], [0.004733, 0.691367, 0.3039]],
};
const VIENOT: Record<'protan' | 'deutan', M3> = {
  protan: [[0.11238, 0.88762, 0.0], [0.11238, 0.88762, 0.0], [0.00401, -0.00401, 1.0]],
  deutan: [[0.29275, 0.70725, 0.0], [0.29275, 0.70725, 0.0], [-0.02234, 0.02234, 1.0]],
};
// Brettel 1997 tritan, linear sRGB (DaltonLens "sRGB" variant)
const BRETTEL_TRITAN = {
  h1: [[1.01277, 0.13548, -0.14826], [-0.01243, 0.86812, 0.14431], [0.07589, 0.805, 0.11911]],
  h2: [[0.93678, 0.18979, -0.12657], [0.06154, 0.81526, 0.1232], [-0.37562, 1.12767, 0.24796]],
  sep: [0.03901, -0.02788, -0.01113],
};

export const hexToRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const toLin = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const mul = (m: M3, v: number[]) => m.map((r) => Math.min(1, Math.max(0, r[0] * v[0] + r[1] * v[1] + r[2] * v[2])));

export type Method = 'machado' | 'vienot' | 'brettel';

/** linear sRGB of `hex` as seen with `vision` using `method` */
export function simulateLinear(hex: string, vision: Vision, method: Method = 'machado'): number[] {
  const l = hexToRgb(hex).map(toLin);
  if (vision === 'normal') return l;
  if (method === 'machado') return mul(MACHADO[vision], l);
  if (method === 'vienot') {
    if (vision === 'tritan') throw new Error('Viénot is only defined for protan/deutan');
    return mul(VIENOT[vision], l);
  }
  if (vision !== 'tritan') throw new Error('Brettel is used here only for tritan');
  const s = BRETTEL_TRITAN.sep;
  const d = s[0] * l[0] + s[1] * l[1] + s[2] * l[2];
  return mul(d >= 0 ? BRETTEL_TRITAN.h1 : BRETTEL_TRITAN.h2, l);
}

export function linToLab(l: number[]): [number, number, number] {
  const X = (0.4124564 * l[0] + 0.3575761 * l[1] + 0.1804375 * l[2]) / 0.95047;
  const Y = 0.2126729 * l[0] + 0.7151522 * l[1] + 0.072175 * l[2];
  const Z = (0.0193339 * l[0] + 0.119192 * l[1] + 0.9503041 * l[2]) / 1.08883;
  const f = (t: number) => (t > 216 / 24389 ? Math.cbrt(t) : (24389 / 27 * t + 16) / 116);
  return [116 * f(Y) - 16, 500 * (f(X) - f(Y)), 200 * (f(Y) - f(Z))];
}

/** relative luminance (WCAG) of a linear sRGB colour */
export const luminance = (l: number[]) => 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2];
export const contrastRatio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

const rad = (d: number) => (d * Math.PI) / 180;

/** CIEDE2000 colour difference (Sharma, Wu & Dalal 2005) */
export function deltaE2000(a: number[], b: number[]): number {
  const [L1, a1, b1] = a, [L2, a2, b2] = b;
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cb = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cb ** 7 / (Cb ** 7 + 25 ** 7)));
  const a1p = a1 * (1 + G), a2p = a2 * (1 + G);
  const C1p = Math.hypot(a1p, b1), C2p = Math.hypot(a2p, b2);
  const hue = (x: number, y: number) => { if (x === 0 && y === 0) return 0; const t = (Math.atan2(y, x) * 180) / Math.PI; return t < 0 ? t + 360 : t; };
  const h1p = hue(a1p, b1), h2p = hue(a2p, b2);
  const dLp = L2 - L1, dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) { dhp = h2p - h1p; if (dhp > 180) dhp -= 360; else if (dhp < -180) dhp += 360; }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin(rad(dhp / 2));
  const Lbp = (L1 + L2) / 2, Cbp = (C1p + C2p) / 2;
  let hbp = h1p + h2p;
  if (C1p * C2p !== 0) hbp = Math.abs(h1p - h2p) > 180 ? (h1p + h2p + (h1p + h2p < 360 ? 360 : -360)) / 2 : (h1p + h2p) / 2;
  const T = 1 - 0.17 * Math.cos(rad(hbp - 30)) + 0.24 * Math.cos(rad(2 * hbp)) + 0.32 * Math.cos(rad(3 * hbp + 6)) - 0.2 * Math.cos(rad(4 * hbp - 63));
  const dth = 30 * Math.exp(-(((hbp - 275) / 25) ** 2));
  const RC = 2 * Math.sqrt(Cbp ** 7 / (Cbp ** 7 + 25 ** 7));
  const SL = 1 + (0.015 * (Lbp - 50) ** 2) / Math.sqrt(20 + (Lbp - 50) ** 2);
  const SC = 1 + 0.045 * Cbp, SH = 1 + 0.015 * Cbp * T;
  const RT = -Math.sin(rad(2 * dth)) * RC;
  return Math.sqrt((dLp / SL) ** 2 + (dCp / SC) ** 2 + (dHp / SH) ** 2 + RT * (dCp / SC) * (dHp / SH));
}
