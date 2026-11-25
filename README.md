# Cable Calm — Tidy Tech Jobs

A cozy, satisfying job simulator: untangle messy cables, click every plug into its matching port, zip-tie same-color bundles, light up all the LEDs and compare the before/after photos.

**Play it:** https://fafidesplas.github.io/coolmath-cable-tidy/

- Verlet rope physics: cables bend, hang, snag, go taut (they never stretch) and cross each other
- Forgiving plug heads: big grab radius, always drawn on top, hover highlight, magnetic sockets, pull-to-pop, swap
- Tools of the trade: zip ties (with tail snipping), velcro, spiral wrap, reels, cable comb, label maker, air duster, screwdriver
- Fixtures: cable hooks and slotted duct with a snap-on lid that swallows the slack
- Synthesized sounds (Web Audio) + vibration on supported phones; streaks of correct plugs climb a scale
- Live checklist and tidiness score with 1–3 stars; leftover crossings are circled
- "Power on" finale: light runs through every cable before the before/after comparison
- 7 jobs: home router → café → streaming desk → electrical panel → studio rack → radio booth → datacenter
- Mouse and touch, responsive layout. 100% original, procedural art, no asset files

See [PLANNING.md](PLANNING.md) for the full game design.

## Run locally

```bash
npm install
npm run dev       # http://localhost:5173/coolmath-cable-tidy/
npm run build     # type-check (tsc) + production build into dist/
npm run preview   # serve the production build
# tip: add ?all to the URL to unlock every job for review
npm run test:physics  # headless physics rest test on every level
npm run test:tools    # plug grabbing, every tool/fixture, 3 stars reachable on every job
```

Requires Node 20+.

## Controls

| Action | Desktop | Mobile |
|---|---|---|
| Move a plug or cable | click + drag | drag with finger |
| Unplug | pull the plug | same |
| Plug in / swap a wrong plug out | release near a port | same |
| Pick a tool | click it or `1`–`9`, `Esc` = hand | tap it |
| Zip tie, velcro, reel, label | click (dragging still moves cables) | tap |
| Wind a reel / let it out | hold it / click it | hold / tap |
| Snip a tie's tail, then remove it | click, click again | tap, tap again |
| Comb, spiral wrap, duster, driver | press and drag / hold | same |
| Hook or duct | drop a cable on it; drag the LID handle down | same |

## Physics rest test

`npm run test:physics` (`tests/physics.test.ts`, bundled with rolldown and run in Node) loads every level and runs the real simulation at the game's fixed 60 Hz step, without input, in five scenarios: the level as dealt (`start`), all cables plugged correctly (`solved`), a cable body swirled and then slowly dragged along the floor (`drag`, starting from a fully settled scene), a cable tie placed and dragged (`tied`), and 4 seeded random drags (`fuzz`). Every idle phase lasts 8 s (`IDLE_S=…` to change) and the last second is measured over the free (unpinned) cable nodes:

| Metric | Threshold | Why |
|---|---|---|
| max displacement of any free node | < 0.02 px/frame | 1/50 of a world pixel: invisible at any zoom |
| mean kinetic energy (Σ v²/2) | < 0.001 px²/frame² | no collective drift either |
| cables asleep | all of them | the scene is truly frozen (both metrics are then exactly 0) |

The drag checks also assert the grabbed point follows the pointer (< 1 px error while it can reach it), the cable goes taut instead of stretching (< 12%), the rest of the cable is pulled along (> 30 px) and sleeping neighbours are woken and pushed (> 5 px), so the fix doesn't make cables stiff or sticky. Typical time to rest: 1–5 s.

Fix history: cables used to jitter forever because the automatic curl remover teleported loop nodes every 12 frames and nothing ever went to sleep. See PLANNING.md §4.1.

## Accessibility (color blindness)

Colors are never the only cue:

- **Palette** (Okabe–Ito based, CIE L* from 17 to 100 so lightness alone separates them): Black ≡ bars · Blue ■ square · Orange ◆ diamond · Sky ▲ triangle · Yellow ● circle · White ★ star. Colors that share a level are chosen to stay apart under every type of color blindness.
- **Symbols** on every plug, every port tag and in the job legend (name + cable count). The game is playable in grayscale.
- **LEDs** use shape + brightness, not just hue: bright green ✓ = working, amber ! = half connected, dark blinking red ✕ = wrong port. The HUD counter and the hover/snap feedback use the same ✓ / ✕.

`npm run test:colors` (`tests/colors.test.ts`) simulates protanopia, deuteranopia and tritanopia (Machado 2009 at full severity, cross-checked with Viénot 1999 / Brettel 1997) and fails if any two colors in the same level have CIEDE2000 < 20, lightness difference |ΔL*| < 12 or luminance contrast < 1.4 under any vision type, or if symbols aren't unique. ΔE00 ≈ 10 is already "clearly different" side by side; 20 keeps thin cables distinct. A negative control checks that the old palette (blue/purple, red/green, yellow/orange) is rejected.

## Deploy

Every push to `main` builds and deploys to GitHub Pages via `.github/workflows/deploy.yml`. Vite `base` is `/coolmath-cable-tidy/`.
