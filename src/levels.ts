import type { ColorKey } from './palette';
export { COLORS, SYMBOL_GLYPH } from './palette';
export type { ColorKey, SymbolKey } from './palette';

export type DeviceStyle =
  | 'router' | 'ont' | 'tv' | 'pc' | 'printer' | 'wallplate'
  | 'breaker' | 'terminal' | 'patch' | 'switch' | 'server';

export interface DeviceDef { x: number; y: number; w: number; h: number; label: string; style: DeviceStyle }

/** dir 1 = socket opens downward (top device), -1 = socket opens upward (bottom device) */
export interface PortDef { x: number; y: number; dir: 1 | -1; color: ColorKey; side: 'A' | 'B' }

export type Theme = 'home' | 'cafe' | 'workshop' | 'studio' | 'datacenter';

export interface LevelDef {
  id: number;
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
  ties: number;
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
    title: "Grandma Rosa's Router",
    tier: 'Home router',
    client: 'Rosa',
    clientRole: 'Retired, 3 cats, 0 patience for buffering',
    avatar: '#e58fb0',
    message:
      "My grandson says the internet \"lives in the yellow cable, the one with the circle\". I may have dusted behind the TV and... rearranged things. Now the TV is sulking and the cats are judging me.",
    goals: ['Plug every cable into ports of its color & symbol', 'Avoid crossed cables'],
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
    ties: 1,
    seed: 11,
    plug: 'rj45',
    loose: 0.25,
  },
  {
    id: 2,
    title: 'Byte Me Café',
    tier: 'Home router',
    client: 'Marco',
    clientRole: 'Barista, latte artist, cable villain',
    avatar: '#c98b4e',
    message:
      "Customers can't upload photos of their latte art and that is basically a crisis. The back office looks like spaghetti carbonara. Extra foam for whoever fixes it!",
    goals: ['Connect everything by color & symbol', 'Bundle the blue ■ cables with a cable tie'],
    tip: 'NEW: Cable ties! Tap the Tie button, then tap where 2+ cables of the same color (same symbol) run close together.',
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
    ties: 2,
    seed: 23,
    plug: 'rj45',
    loose: 0.2,
  },
  {
    id: 3,
    title: 'Sparky Workshop Panel',
    tier: 'Electrical panel',
    client: 'Dolores',
    clientRole: 'Furniture maker, owns 41 clamps',
    avatar: '#7fb069',
    message:
      'Every time I switch on the bandsaw, the radio dies. My nephew "helped" with the panel. Please make it boring and safe again. Boring is beautiful.',
    goals: ['Wire each breaker to its matching terminal', 'Bundle wires by color', 'Zero crossings'],
    tip: 'Orange ◆, black ≡ and white ★ wires go to matching terminals. Ties keep each color in a neat run.',
    theme: 'workshop',
    devices: [
      { x: 120, y: 80, w: 480, h: 140, label: 'MAIN PANEL', style: 'breaker' },
      { x: 90, y: BOT, w: 540, h: 70, label: 'TERMINAL BLOCK', style: 'terminal' },
    ],
    ports: [
      ...row(['orange', 'orange', 'black', 'black', 'white', 'white'], 360, TOP, 64, 1, 'A'),
      ...row(['orange', 'orange', 'black', 'black', 'white', 'white'], 360, BOT, 86, -1, 'B'),
    ],
    ties: 3,
    seed: 37,
    plug: 'wire',
    loose: 0.2,
  },
  {
    id: 4,
    title: 'Pixel Pals Studio',
    tier: 'Network rack',
    client: 'Juno',
    clientRole: 'Indie game dev, runs on cold brew',
    avatar: '#9b7bf0',
    message:
      'Our build server keeps "taking a nap". I think a cable is unplugged. Or eight. Also the rack looks like a bowl of rainbow noodles and our streamer is coming tomorrow.',
    goals: ['Patch panel to switch, symbol for symbol', 'One tie per color group', 'No crossings'],
    tip: 'Plan the order: matching colors (same symbol) side by side means no crossings.',
    theme: 'studio',
    devices: [
      { x: 110, y: 130, w: 500, h: 90, label: 'PATCH PANEL', style: 'patch' },
      { x: 90, y: BOT, w: 540, h: 70, label: 'SWITCH 24', style: 'switch' },
    ],
    ports: [
      ...row(['sky', 'sky', 'sky', 'orange', 'orange', 'orange', 'black', 'black'], 360, TOP, 54, 1, 'A'),
      ...row(['sky', 'sky', 'sky', 'orange', 'orange', 'orange', 'black', 'black'], 360, BOT, 64, -1, 'B'),
    ],
    ties: 3,
    seed: 41,
    plug: 'rj45',
    loose: 0.15,
  },
  {
    id: 5,
    title: 'Cloud Nine Datacenter',
    tier: 'Datacenter rack',
    client: 'Ada',
    clientRole: 'Site reliability engineer, has seen things',
    avatar: '#4fb3d9',
    message:
      'The night shift tried to "optimize" rack 7. Two servers are offline and someone tied a bow. A literal bow. Please restore order. I believe in you.',
    goals: ['Bring both servers online', 'Bundle all four color groups', 'A rack you could frame'],
    tip: 'Ten cables, four colors. Fix the connections first, then tie each color group.',
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
    ties: 4,
    seed: 57,
    plug: 'rj45',
    loose: 0.15,
  },
];
