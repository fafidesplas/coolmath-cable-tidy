import type { ColorKey } from './palette';
import type { ToolId } from './tools';
export { COLORS, SYMBOL_GLYPH } from './palette';
export type { ColorKey, SymbolKey } from './palette';

export type DeviceStyle =
  | 'router' | 'ont' | 'tv' | 'pc' | 'printer' | 'wallplate'
  | 'breaker' | 'terminal' | 'patch' | 'switch' | 'server'
  | 'dock' | 'console' | 'mic' | 'mixer' | 'speaker';

export interface DeviceDef { x: number; y: number; w: number; h: number; label: string; style: DeviceStyle }

/** dir 1 = socket opens downward (top device), -1 = socket opens upward (bottom device) */
export interface PortDef { x: number; y: number; dir: 1 | -1; color: ColorKey; side: 'A' | 'B' }

/** hook: J-hook / cable ring with room for `cap` cables. duct: slotted trunking with a snap-on lid. */
export type FixtureDef =
  | { type: 'hook'; x: number; y: number; cap: number }
  | { type: 'duct'; x: number; y: number; w: number; h: number };

export type Theme = 'home' | 'cafe' | 'desk' | 'workshop' | 'studio' | 'radio' | 'datacenter';

export interface LevelDef {
  id: number;
  /** stable save key */
  key: string;
  title: string;
  tier: string;
  client: string;
  clientRole: string;
  avatar: string;
  message: string;
  goals: string[];
  tip: string;
  theme: Theme;
  devices: DeviceDef[];
  ports: PortDef[];
  /** uses of each tool in this job (UNLIMITED = 99); missing = not available */
  tools: Partial<Record<ToolId, number>>;
  /** tools introduced here (explained on the job card) */
  newTools?: ToolId[];
  fixtures?: FixtureDef[];
  /** cable length / straight distance (default 1.06: no spare cable) */
  slack?: number;
  /** number of dust clumps on the devices */
  dust?: number;
  seed: number;
  plug: 'rj45' | 'wire';
  loose: number;
}

function row(colors: ColorKey[], cx: number, y: number, spacing: number, dir: 1 | -1, side: 'A' | 'B'): PortDef[] {
  const x0 = cx - ((colors.length - 1) * spacing) / 2;
  return colors.map((color, i) => ({ x: Math.round(x0 + i * spacing), y, dir, color, side }));
}

const TOP = 220;
const BOT = 780;

export const LEVELS: LevelDef[] = [
  {
    id: 1,
    key: 'rosa',
    title: "Grandma Rosa's Router",
    tier: 'Home router',
    client: 'Rosa',
    clientRole: 'Retired, 3 cats, 0 patience for buffering',
    avatar: '#e58fb0',
    message:
      "My grandson says the internet \"lives in the yellow cable, the one with the circle\". I may have dusted behind the TV and... rearranged things. Now the TV is sulking and the cats are judging me.",
    goals: ['Plug every cable into ports of its color & symbol', 'Avoid crossed cables', 'Blow the dust off'],
    tip: 'Drag a plug into a port with the SAME color and symbol. Grab a cable in the middle to untangle it.',
    theme: 'home',
    devices: [
      { x: 220, y: 120, w: 280, h: 100, label: 'HOME ROUTER', style: 'router' },
      { x: 110, y: BOT, w: 120, h: 70, label: 'FIBER', style: 'ont' },
      { x: 280, y: BOT, w: 160, h: 90, label: 'TV', style: 'tv' },
      { x: 500, y: BOT, w: 100, h: 90, label: 'PC', style: 'pc' },
    ],
    ports: [
      ...row(['yellow', 'blue', 'blue'], 360, TOP, 70, 1, 'A'),
      { x: 170, y: BOT, dir: -1, color: 'yellow', side: 'B' },
      { x: 360, y: BOT, dir: -1, color: 'blue', side: 'B' },
      { x: 550, y: BOT, dir: -1, color: 'blue', side: 'B' },
    ],
    tools: { air: 99, zip: 1 },
    newTools: ['air'],
    dust: 40,
    seed: 11,
    plug: 'rj45',
    loose: 0.25,
  },
  {
    id: 2,
    key: 'cafe',
    title: 'Byte Me Café',
    tier: 'Home router',
    client: 'Marco',
    clientRole: 'Barista, latte artist, cable villain',
    avatar: '#c98b4e',
    message:
      "Customers can't upload photos of their latte art and that is basically a crisis. The back office looks like spaghetti carbonara. Extra foam for whoever fixes it!",
    goals: ['Connect everything by color & symbol', 'Zip the blue ■ cables and snip the tail', 'Get rid of the coffee dust'],
    tip: 'NEW: Zip ties! Pick the tool, tap where 2+ same-color cables run close, then tap the tie to snip its tail.',
    theme: 'cafe',
    devices: [
      { x: 170, y: 110, w: 380, h: 110, label: 'CAFÉ ROUTER', style: 'router' },
      { x: 80, y: BOT, w: 120, h: 70, label: 'FIBER', style: 'ont' },
      { x: 225, y: BOT, w: 270, h: 60, label: 'WALL JACKS', style: 'wallplate' },
      { x: 525, y: BOT, w: 120, h: 80, label: 'PRINTER', style: 'printer' },
    ],
    ports: [
      ...row(['yellow', 'blue', 'blue', 'blue', 'black'], 360, TOP, 62, 1, 'A'),
      ...row(['yellow', 'blue', 'blue', 'blue', 'black'], 360, BOT, 110, -1, 'B'),
    ],
    tools: { air: 99, zip: 2 },
    newTools: ['zip'],
    dust: 34,
    seed: 23,
    plug: 'rj45',
    loose: 0.2,
  },
  {
    id: 3,
    key: 'desk',
    title: "Nina's Streaming Desk",
    tier: 'Home office',
    client: 'Nina',
    clientRole: 'Streamer, famous for her cable-fail clips',
    avatar: '#6fa8dc',
    message:
      "I bought the five-meter cables because they were on sale. Last night I stood up mid-stream and the whole desk came with me. Chat loved it. My back did not.",
    goals: ['Connect the dock to everything', 'Wind up the spare cable with reels', 'Route cables through the hooks'],
    tip: 'These cables are way too long. Clip a Reel on one, then hold the reel to wind it. Drop cables on the hooks to hang them.',
    theme: 'desk',
    devices: [
      { x: 170, y: 120, w: 380, h: 100, label: 'USB DOCK', style: 'dock' },
      { x: 70, y: BOT, w: 170, h: 86, label: 'PC', style: 'pc' },
      { x: 275, y: BOT, w: 170, h: 90, label: 'MONITOR', style: 'tv' },
      { x: 480, y: BOT, w: 170, h: 80, label: 'CONSOLE', style: 'console' },
    ],
    ports: [
      ...row(['blue', 'blue', 'yellow', 'black', 'black'], 360, TOP, 66, 1, 'A'),
      ...row(['blue', 'blue'], 155, BOT, 70, -1, 'B'),
      { x: 360, y: BOT, dir: -1, color: 'yellow', side: 'B' },
      ...row(['black', 'black'], 565, BOT, 70, -1, 'B'),
    ],
    tools: { reel: 5, zip: 2 },
    newTools: ['reel'],
    fixtures: [{ type: 'hook', x: 220, y: 500, cap: 3 }, { type: 'hook', x: 500, y: 500, cap: 3 }],
    slack: 1.4,
    seed: 83,
    plug: 'rj45',
    loose: 0.25,
  },
  {
    id: 4,
    key: 'panel',
    title: 'Sparky Workshop Panel',
    tier: 'Electrical panel',
    client: 'Dolores',
    clientRole: 'Furniture maker, owns 41 clamps',
    avatar: '#7fb069',
    message:
      'Every time I switch on the bandsaw, the radio dies. My nephew "helped" with the panel. Please make it boring and safe again. Boring is beautiful.',
    goals: ['Wire each breaker to its matching terminal', 'Lay the wires in the duct and snap the lid on', 'Tighten every terminal screw'],
    tip: 'Drop wires into the slotted duct, then drag its lid handle all the way down. Hold the Driver on each terminal.',
    theme: 'workshop',
    devices: [
      { x: 120, y: 80, w: 480, h: 140, label: 'MAIN PANEL', style: 'breaker' },
      { x: 90, y: BOT, w: 540, h: 70, label: 'TERMINAL BLOCK', style: 'terminal' },
    ],
    ports: [
      ...row(['orange', 'orange', 'black', 'black', 'white', 'white'], 360, TOP, 64, 1, 'A'),
      ...row(['orange', 'orange', 'black', 'black', 'white', 'white'], 360, BOT, 86, -1, 'B'),
    ],
    tools: { screw: 99, zip: 3 },
    newTools: ['screw'],
    fixtures: [{ type: 'duct', x: 300, y: 385, w: 120, h: 210 }],
    seed: 37,
    plug: 'wire',
    loose: 0.2,
  },
  {
    id: 5,
    key: 'pixel',
    title: 'Pixel Pals Studio',
    tier: 'Network rack',
    client: 'Juno',
    clientRole: 'Indie game dev, runs on cold brew',
    avatar: '#9b7bf0',
    message:
      'Our build server keeps "taking a nap". I think a cable is unplugged. Or eight. Also the rack looks like a bowl of rainbow noodles and our streamer is coming tomorrow.',
    goals: ['Patch panel to switch, symbol for symbol', 'Comb the cables into lanes and strap them', 'Label every cable'],
    tip: 'NEW: the Comb. Press across several cables and drag along them.',
    theme: 'studio',
    devices: [
      { x: 110, y: 130, w: 500, h: 90, label: 'PATCH PANEL', style: 'patch' },
      { x: 90, y: BOT, w: 540, h: 70, label: 'SWITCH 24', style: 'switch' },
    ],
    ports: [
      ...row(['sky', 'sky', 'sky', 'orange', 'orange', 'orange', 'black', 'black'], 360, TOP, 54, 1, 'A'),
      ...row(['sky', 'sky', 'sky', 'orange', 'orange', 'orange', 'black', 'black'], 360, BOT, 64, -1, 'B'),
    ],
    tools: { comb: 3, velcro: 3, label: 99 },
    newTools: ['comb', 'velcro', 'label'],
    slack: 1.16,
    seed: 41,
    plug: 'rj45',
    loose: 0.15,
  },
  {
    id: 6,
    key: 'radio',
    title: 'Radio Luna',
    tier: 'Broadcast booth',
    client: 'Sol',
    clientRole: 'Night host, voice like warm honey',
    avatar: '#c8703f',
    message:
      "We go live at midnight and there's a hum. I followed one cable for twenty minutes and it ended at the toaster. Make it look like a place where jazz happens?",
    goals: ['Patch the mixer to the booth', 'Wrap each bundle in spiral tube', 'Hang the runs and wind the slack'],
    tip: 'NEW: Spiral wrap. Press on 2+ same-color cables and drag along them.',
    theme: 'radio',
    devices: [
      { x: 120, y: 110, w: 480, h: 110, label: 'MIXER', style: 'mixer' },
      { x: 70, y: BOT, w: 190, h: 80, label: 'MICS', style: 'mic' },
      { x: 285, y: BOT, w: 150, h: 80, label: 'DECK', style: 'console' },
      { x: 460, y: BOT, w: 190, h: 80, label: 'MONITORS', style: 'speaker' },
    ],
    ports: [
      ...row(['orange', 'orange', 'orange', 'white', 'white', 'black', 'black'], 360, TOP, 58, 1, 'A'),
      ...row(['orange', 'orange', 'orange'], 165, BOT, 56, -1, 'B'),
      ...row(['white', 'white'], 360, BOT, 62, -1, 'B'),
      ...row(['black', 'black'], 555, BOT, 66, -1, 'B'),
    ],
    tools: { wrap: 3, reel: 4, label: 99 },
    newTools: ['wrap'],
    fixtures: [{ type: 'hook', x: 200, y: 470, cap: 4 }, { type: 'hook', x: 520, y: 470, cap: 4 }],
    slack: 1.22,
    seed: 71,
    plug: 'rj45',
    loose: 0.2,
  },
  {
    id: 7,
    key: 'cloud',
    title: 'Cloud Nine Datacenter',
    tier: 'Datacenter rack',
    client: 'Ada',
    clientRole: 'Site reliability engineer, has seen things',
    avatar: '#4fb3d9',
    message:
      'The night shift tried to "optimize" rack 7. Two servers are offline and someone tied a bow. A literal bow. Please restore order. I believe in you.',
    goals: ['Bring both servers online', 'Bundle all four color groups', 'Dust, comb, strap, label: a rack you could frame'],
    tip: 'Ten cables, four colors. Connect first, then comb and strap each side.',
    theme: 'datacenter',
    devices: [
      { x: 120, y: 140, w: 480, h: 80, label: 'CORE SWITCH', style: 'switch' },
      { x: 90, y: BOT, w: 250, h: 80, label: 'SERVER A', style: 'server' },
      { x: 380, y: BOT, w: 250, h: 80, label: 'SERVER B', style: 'server' },
    ],
    ports: [
      ...row(['sky', 'sky', 'sky', 'white', 'white', 'black', 'black', 'black', 'orange', 'orange'], 360, TOP, 46, 1, 'A'),
      ...row(['sky', 'sky', 'sky', 'white', 'white'], 215, BOT, 44, -1, 'B'),
      ...row(['black', 'black', 'black', 'orange', 'orange'], 505, BOT, 44, -1, 'B'),
    ],
    tools: { air: 99, comb: 2, velcro: 2, wrap: 2, label: 99 },
    slack: 1.16,
    dust: 40,
    seed: 57,
    plug: 'rj45',
    loose: 0.15,
  },
];
