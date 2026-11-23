/**
 * Cable palette — colour-vision-deficiency (CVD) safe.
 *
 * Based on the Okabe–Ito palette, tuned so every colour sits on a clearly different lightness
 * step (CIE L* ≈ 17 / 40 / 55 / 76 / 88 / 100). Lightness survives every type of colour
 * blindness, so even when two hues collapse together the cables still read as darker/lighter.
 * No blue/purple, red/green or green/yellow pairs exist any more.
 *
 * Colour is never the only cue: every colour also has a unique symbol, drawn on each plug,
 * each port tag and in the job legend. `npm run test:colors` checks all of this.
 */
export type ColorKey = 'black' | 'blue' | 'orange' | 'sky' | 'yellow' | 'white';

export type SymbolKey = 'bars' | 'square' | 'diamond' | 'triangle' | 'circle' | 'star';

export interface CableColor {
  /** main cable colour (what the player sees; what the CVD test measures) */
  base: string;
  /** outline / rim */
  dark: string;
  /** specular highlight */
  light: string;
  /** ink used for the symbol drawn on top of `base` */
  ink: string;
  name: string;
  symbol: SymbolKey;
}

export const COLORS: Record<ColorKey, CableColor> = {
  // black cables get a light rim so they stay visible on the dark rack backgrounds
  black: { base: '#2a2a2e', dark: '#9aa1ab', light: '#6b707a', ink: '#ffffff', name: 'Black', symbol: 'bars' },
  blue: { base: '#0060a8', dark: '#002f57', light: '#78b4ea', ink: '#ffffff', name: 'Blue', symbol: 'square' },
  orange: { base: '#e05a00', dark: '#7a3000', light: '#ffb27f', ink: '#ffffff', name: 'Orange', symbol: 'diamond' },
  sky: { base: '#6cc4f5', dark: '#24729e', light: '#d4f0ff', ink: '#10202c', name: 'Sky', symbol: 'triangle' },
  yellow: { base: '#f5dd1e', dark: '#8a7600', light: '#fff8b8', ink: '#1e1a00', name: 'Yellow', symbol: 'circle' },
  white: { base: '#ffffff', dark: '#7d848f', light: '#ffffff', ink: '#1a1d22', name: 'White', symbol: 'star' },
};

export const SYMBOL_GLYPH: Record<SymbolKey, string> = {
  bars: '≡', square: '■', diamond: '◆', triangle: '▲', circle: '●', star: '★',
};
