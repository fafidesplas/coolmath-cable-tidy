# Cable Calm — Tidy Tech Jobs

A cozy, satisfying job simulator: untangle messy cables, click every plug into its matching port, zip-tie same-color bundles, light up all the LEDs and compare the before/after photos.

**Play it:** https://fafidesplas.github.io/coolmath-cable-tidy/

- Verlet rope physics: cables bend, hang, snag and cross each other
- Synthesized click / unplug / zip-tie sounds (Web Audio) + vibration on supported phones
- Cable ties that gather same-color cables into clean bundles
- Tidiness score (crossings, smooth runs, color bundles) with 1–3 stars
- Before/after comparison slider at the end of every job
- 5 jobs: home router → café → electrical panel → studio rack → datacenter rack
- Mouse and touch, responsive layout. 100% original, procedural art, no asset files

See [PLANNING.md](PLANNING.md) for the full game design.

## Run locally

```bash
npm install
npm run dev       # http://localhost:5173/coolmath-cable-tidy/
npm run build     # type-check (tsc) + production build into dist/
npm run preview   # serve the production build
npm run test:physics  # headless physics rest test on every level
```

Requires Node 20+.

## Controls

| Action | Desktop | Mobile |
|---|---|---|
| Move a plug or cable | click + drag | drag with finger |
| Plug in | release a plug near a port | same |
| Cable tie | **Tie** button or `T`, then click | **Tie** button, then tap |
| Remove a tie | click it | tap it |

## Physics rest test

`npm run test:physics` (`tests/physics.test.ts`, bundled with rolldown and run in Node) loads every level and runs the real simulation at the game's fixed 60 Hz step, without input, in five scenarios: the level as dealt (`start`), all cables plugged correctly (`solved`), a cable body swirled and then slowly dragged along the floor (`drag`, starting from a fully settled scene), a cable tie placed and dragged (`tied`), and 4 seeded random drags (`fuzz`). Every idle phase lasts 8 s (`IDLE_S=…` to change) and the last second is measured over the free (unpinned) cable nodes:

| Metric | Threshold | Why |
|---|---|---|
| max displacement of any free node | < 0.02 px/frame | 1/50 of a world pixel: invisible at any zoom |
| mean kinetic energy (Σ v²/2) | < 0.001 px²/frame² | no collective drift either |
| cables asleep | all of them | the scene is truly frozen (both metrics are then exactly 0) |

The drag checks also assert the grabbed point follows the pointer (< 1 px error), the rest of the cable is pulled along (> 60 px) and sleeping neighbours are woken and pushed (> 5 px), so the fix doesn't make cables stiff or sticky. Typical time to rest: 1–5 s.

Fix history: cables used to jitter forever because the automatic curl remover teleported loop nodes every 12 frames and nothing ever went to sleep. See PLANNING.md §4.1.

## Accessibility (color blindness)

Colors are never the only cue:

- **Palette** (Okabe–Ito based, CIE L* from 17 to 100 so lightness alone separates them): Black ≡ bars · Blue ■ square · Orange ◆ diamond · Sky ▲ triangle · Yellow ● circle · White ★ star. Colors that share a level are chosen to stay apart under every type of color blindness.
- **Symbols** on every plug, every port tag and in the job legend (name + cable count). The game is playable in grayscale.
- **LEDs** use shape + brightness, not just hue: bright green ✓ = working, amber ! = half connected, dark blinking red ✕ = wrong port. The HUD counter and the hover/snap feedback use the same ✓ / ✕.

`npm run test:colors` (`tests/colors.test.ts`) simulates protanopia, deuteranopia and tritanopia (Machado 2009 at full severity, cross-checked with Viénot 1999 / Brettel 1997) and fails if any two colors in the same level have CIEDE2000 < 20, lightness difference |ΔL*| < 12 or luminance contrast < 1.4 under any vision type, or if symbols aren't unique. ΔE00 ≈ 10 is already "clearly different" side by side; 20 keeps thin cables distinct. A negative control checks that the old palette (blue/purple, red/green, yellow/orange) is rejected.

## Deploy

Every push to `main` builds and deploys to GitHub Pages via `.github/workflows/deploy.yml`. Vite `base` is `/coolmath-cable-tidy/`.
