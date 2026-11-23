/**
 * Colour-blindness test — run with `npm run test:colors`.
 *
 * For every level, every pair of cable colours used in that level is simulated under
 * normal vision, protanopia, deuteranopia and tritanopia (full dichromacy, the worst case):
 *   - Machado 2009 (severity 1.0) for all three deficiencies,
 *   - plus Viénot 1999 (protan/deutan) and Brettel 1997 (tritan) as a cross-check.
 * The worst result over all methods is what counts.
 *
 * Pass thresholds (per pair of colours in the same level, under every vision type):
 *   - ΔE00 (CIEDE2000)  ≥ MIN_DE   = 20   (≈ 10 is "clearly different side by side";
 *                                        20 keeps them distinct even as thin cables)
 *   - |ΔL*| (lightness) ≥ MIN_DL   = 12   (a lightness step that survives any hue loss)
 *   - WCAG luminance contrast ratio ≥ MIN_CR = 1.4
 * Plus: every colour in the palette has a unique symbol, and every level colour exists in the
 * palette. The whole-palette worst pair is reported too (informative: colours that never share a
 * level may be closer).
 */
import { LEVELS } from '../src/levels';
import { COLORS, type ColorKey } from '../src/palette';
import { contrastRatio, deltaE2000, linToLab, luminance, simulateLinear, type Method, type Vision } from './colorblind';

const MIN_DE = 20;
const MIN_DL = 12;
const MIN_CR = 1.4;

const VISIONS: Vision[] = ['normal', 'protan', 'deutan', 'tritan'];
const METHODS: Record<Vision, Method[]> = {
  normal: ['machado'], protan: ['machado', 'vienot'], deutan: ['machado', 'vienot'], tritan: ['machado', 'brettel'],
};

interface PairStat { de: number; dl: number; cr: number }

function pairStat(a: ColorKey, b: ColorKey, v: Vision): PairStat {
  let worst: PairStat = { de: Infinity, dl: Infinity, cr: Infinity };
  for (const m of METHODS[v]) {
    const la = simulateLinear(COLORS[a].base, v, m), lb = simulateLinear(COLORS[b].base, v, m);
    const A = linToLab(la), B = linToLab(lb);
    worst = {
      de: Math.min(worst.de, deltaE2000(A, B)),
      dl: Math.min(worst.dl, Math.abs(A[0] - B[0])),
      cr: Math.min(worst.cr, contrastRatio(luminance(la), luminance(lb))),
    };
  }
  return worst;
}

let failures = 0;
const fail = (msg: string) => { failures++; console.log(`  FAIL ${msg}`); };

// ---- symbols
const keys = Object.keys(COLORS) as ColorKey[];
const symbols = keys.map((k) => COLORS[k].symbol);
console.log('Palette:');
for (const k of keys) {
  const lab = linToLab(simulateLinear(COLORS[k].base, 'normal'));
  console.log(`  ${k.padEnd(7)} ${COLORS[k].base}  L*=${lab[0].toFixed(0).padStart(3)}  symbol=${COLORS[k].symbol}`);
}
if (new Set(symbols).size !== symbols.length) fail(`symbols are not unique: ${symbols.join(', ')}`);
else console.log(`  symbols unique ✓ (${symbols.join(', ')})`);

// ---- per level
console.log(`\nPer level (worst pair per vision): ΔE00 ≥ ${MIN_DE}, |ΔL*| ≥ ${MIN_DL}, contrast ≥ ${MIN_CR}`);
for (const L of LEVELS) {
  const used = [...new Set(L.ports.map((p) => p.color))];
  for (const c of used) if (!COLORS[c]) fail(`L${L.id}: unknown colour ${c}`);
  const cells: string[] = [];
  for (const v of VISIONS) {
    let worst: (PairStat & { pair: string }) | null = null;
    for (let i = 0; i < used.length; i++) for (let j = i + 1; j < used.length; j++) {
      const s = pairStat(used[i], used[j], v);
      const pair = `${used[i]}/${used[j]}`;
      if (s.de < MIN_DE) fail(`L${L.id} ${v}: ${pair} ΔE00 ${s.de.toFixed(1)} < ${MIN_DE}`);
      if (s.dl < MIN_DL) fail(`L${L.id} ${v}: ${pair} ΔL* ${s.dl.toFixed(1)} < ${MIN_DL}`);
      if (s.cr < MIN_CR) fail(`L${L.id} ${v}: ${pair} contrast ${s.cr.toFixed(2)} < ${MIN_CR}`);
      if (!worst || s.de < worst.de) worst = { ...s, pair };
    }
    cells.push(worst ? `${v} ΔE ${worst.de.toFixed(1)} ΔL ${worst.dl.toFixed(0)} CR ${worst.cr.toFixed(2)} (${worst.pair})` : `${v} n/a`);
  }
  console.log(`L${L.id} [${used.join(', ')}]`);
  for (const c of cells) console.log(`    ${c}`);
}

// ---- whole palette (informative)
console.log('\nWhole palette, worst pair per vision (informative):');
for (const v of VISIONS) {
  let worst = { de: Infinity, pair: '' };
  for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
    const s = pairStat(keys[i], keys[j], v);
    if (s.de < worst.de) worst = { de: s.de, pair: `${keys[i]}/${keys[j]}` };
  }
  console.log(`  ${v.padEnd(6)} ΔE00 ${worst.de.toFixed(1)} (${worst.pair})`);
}

// ---- negative control: the pre-accessibility palette must be rejected by the same metric,
// otherwise the thresholds above would be meaningless.
const OLD: Record<string, string> = { blue: '#2f7bf5', purple: '#9b5cf0', red: '#e5484d', green: '#25b158', yellow: '#f5c518', orange: '#f58a1f' };
const OLD_BAD: [string, string, Vision][] = [['blue', 'purple', 'deutan'], ['red', 'green', 'deutan'], ['blue', 'purple', 'protan'], ['yellow', 'orange', 'deutan']];
console.log('\nNegative control (old palette, must FAIL the thresholds):');
for (const [a, b, v] of OLD_BAD) {
  let de = Infinity, dl = Infinity;
  for (const m of METHODS[v]) {
    const A = linToLab(simulateLinear(OLD[a], v, m)), B = linToLab(simulateLinear(OLD[b], v, m));
    de = Math.min(de, deltaE2000(A, B)); dl = Math.min(dl, Math.abs(A[0] - B[0]));
  }
  const rejected = de < MIN_DE || dl < MIN_DL;
  if (!rejected) fail(`control ${a}/${b} ${v} was not rejected`);
  console.log(`  old ${a}/${b} ${v}: ΔE00 ${de.toFixed(1)} ΔL* ${dl.toFixed(1)} → ${rejected ? 'rejected ✓' : 'NOT rejected'}`);
}

console.log(`\n${failures ? `${failures} check(s) FAILED` : 'All levels colour-blind safe ✓'}`);
process.exit(failures ? 1 : 0);
