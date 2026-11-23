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
```

Requires Node 20+.

## Controls

| Action | Desktop | Mobile |
|---|---|---|
| Move a plug or cable | click + drag | drag with finger |
| Plug in | release a plug near a port | same |
| Cable tie | **Tie** button or `T`, then click | **Tie** button, then tap |
| Remove a tie | click it | tap it |

## Deploy

Every push to `main` builds and deploys to GitHub Pages via `.github/workflows/deploy.yml`. Vite `base` is `/coolmath-cable-tidy/`.
