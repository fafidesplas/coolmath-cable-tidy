export type ToolId = 'hand' | 'zip' | 'velcro' | 'reel' | 'comb' | 'wrap' | 'label' | 'air' | 'screw';

export const UNLIMITED = 99;
export const ALL_TOOLS: ToolId[] = ['hand', 'zip', 'velcro', 'wrap', 'reel', 'comb', 'label', 'air', 'screw'];

export interface ToolDef {
  name: string;
  /** shown while the tool is selected */
  hint: string;
  /** shown on the job card the first time the tool appears */
  about: string;
  /** tap = acts on a tap (a drag still moves cables); stroke = acts while you press and drag */
  mode: 'hand' | 'tap' | 'stroke';
  icon: string;
}

const svg = (inner: string) => `<svg viewBox="0 0 24 24">${inner}</svg>`;

export const TOOLS: Record<ToolId, ToolDef> = {
  hand: {
    name: 'Hand', mode: 'hand', about: '', hint: 'Drag plugs and cables. Pull a plug to pop it out.',
    icon: svg('<path d="M8 12V6a1.6 1.6 0 0 1 3.2 0v5M11.2 10V4.6a1.6 1.6 0 0 1 3.2 0V11M14.4 10.5V6.4a1.6 1.6 0 0 1 3.2 0V15c0 4-2.4 6-5.6 6-3 0-4.4-1.4-6-4.2L4.4 14a1.6 1.6 0 0 1 2.7-1.7L8 13.6"/>'),
  },
  zip: {
    name: 'Zip tie', mode: 'tap', about: 'Tap 2+ cables of one color to zip them. Tap again to snip the tail flush.',
    hint: 'Tap where 2+ same-color cables run close. Then tap the tie to snip its tail.',
    icon: svg('<path d="M4 12h9"/><rect x="13" y="8.5" width="5" height="7" rx="1.2"/><path d="M18 12h3.4"/><path d="M6 10.4v3.2M9 10.4v3.2"/>'),
  },
  velcro: {
    name: 'Velcro', mode: 'tap', about: 'A soft strap that holds cables of any color. Tap it to rip it off.',
    hint: 'Tap where 2+ cables run close — any color.',
    icon: svg('<rect x="3" y="8" width="18" height="8" rx="2.4"/><path d="M13 8v8M15.6 10.5h3M15.6 13.5h3"/>'),
  },
  wrap: {
    name: 'Spiral', mode: 'stroke', about: 'Press on a same-color bundle and drag along it to wrap it in spiral tube.',
    hint: 'Press on 2+ same-color cables and drag along them to wrap.',
    icon: svg('<path d="M4 15c1.6-8 4-8 4 0M9.300 15c1.600-8 4-8 4 0M14.600 15c1.600-8 4-8 4 0"/><path d="M3 18h18"/>'),
  },
  reel: {
    name: 'Reel', mode: 'tap', about: 'Clip it on a cable that is too long, then hold it to wind up the slack.',
    hint: 'Tap a cable to clip on a reel, then press and hold the reel to wind.',
    icon: svg('<circle cx="12" cy="12" r="8.500"/><circle cx="12" cy="12" r="4.500"/><circle cx="12" cy="12" r="1"/>'),
  },
  comb: {
    name: 'Comb', mode: 'stroke', about: 'Press across several cables and drag along: they fall into perfect lanes.',
    hint: 'Press across 2+ cables and drag along them.',
    icon: svg('<path d="M3 7h18v4H3z"/><path d="M6 11v7M10 11v7M14 11v7M18 11v7"/>'),
  },
  label: {
    name: 'Labels', mode: 'tap', about: 'Tap a working cable to print and wrap a label on both ends.',
    hint: 'Tap each working cable to label it.',
    icon: svg('<path d="M3 8h12l6 4-6 4H3z"/><path d="M6.500 12h6"/>'),
  },
  air: {
    name: 'Duster', mode: 'stroke', about: 'Hold and sweep to blast the dust off the gear.',
    hint: 'Hold and sweep over the dusty gear.',
    icon: svg('<rect x="3" y="9" width="8" height="12" rx="2"/><path d="M5 9V6h4v3M9 7h3"/><path d="M15 5l5-2M15 7.500h6M15 10l5 2"/>'),
  },
  screw: {
    name: 'Driver', mode: 'stroke', about: 'Hold on a connected terminal until its screw bites.',
    hint: 'Hold on each connected terminal to tighten its screw.',
    icon: svg('<path d="M14.500 3.500l6 6-4 4-6-6z"/><path d="M10.500 7.500L9 9l1 5-6.500 6.500M13 12.500L15 15"/>'),
  },
};
