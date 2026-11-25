# Cable Calm — Game Planning

> A cozy, satisfying job simulator about untangling and tidying cables in routers, electrical panels and datacenter racks. Built for Coolmath Games: short sessions, no violence, no text-heavy menus, instant fun on desktop and mobile.

---

## 1. Vision

**One-line pitch:** *PowerWash Simulator meets Unpacking, for cable nerds.* You arrive at a messy setup, untangle the spaghetti, click every plug into the right port, zip-tie the bundles, watch the LEDs light up — and compare the "before" and "after" photos.

**Core feeling:** calm satisfaction. Every action has tactile feedback (springy cable physics, a crisp *tk-CLACK* when a plug seats, a ratcheting *zzzip* when a tie closes, a green LED wave when everything works).

**Design pillars**
1. **Tactile first** – cables are physical ropes you can grab anywhere; plugs snap with sound + vibration.
2. **Order from chaos** – the mess is the content. Progress is visible every second (LEDs, tidy meter).
3. **Gentle mastery** – nobody fails. Connecting everything always completes the job; tidiness only changes stars.
4. **Clients with personality** – each job is a tiny story told in two lines.

## 2. Target & platform

| | |
|---|---|
| Audience | Coolmath players (8–16) + adults who love "oddly satisfying" content |
| Platforms | Desktop browsers (mouse) and mobile browsers (touch), portrait-friendly |
| Session length | 1–4 minutes per job |
| Monetization fit | Natural ad breaks between jobs (results screen → next job) |
| Content rating | Everyone. No violence, no real brands, no copyrighted assets |

## 3. Core loop

```
Read client brief → Untangle & connect (LEDs go green) → Tidy (ties, smooth runs, no crossings)
      ↑                                                                    ↓
   Next job  ←  Stars + client reaction  ←  Before/After comparison  ←  Finish job
```

1. **Brief** – client card: name, quirky role, short message, 2–3 goals.
2. **Untangle** – cables start plugged into wrong ports or lying on the floor in a tangle.
3. **Connect** – drag each plug into a port of the same color. One end on the top device, the other on the bottom device. Wrong color = red LED + dull thunk.
4. **All good** – when every cable is valid, device LEDs/screens come alive and *Finish job* unlocks.
5. **Tidy (optional, for stars)** – zip-tie same-color cables into bundles, remove crossings and loops.
6. **Results** – stars, tidiness score, metric breakdown, *before/after* slider (or side by side).

## 4. Mechanics

### 4.1 Cable physics
- Verlet rope: ~13 px segments, gravity, damping, 14 constraint iterations, 2 substeps @60 Hz.
- Bending stiffness (min distance between points i and i+2) makes cables behave like real patch cords, not string.
- Cables softly repel *other* cables (spatial hash grid), so dragging one snags and pushes its neighbours — they hook, slide and cross like the real thing.
- Small self-curls relax out automatically (a real cable twists free), but large tangles must be undone by the player.
- Plugged ends pin two points so the cable leaves the port straight.
- **Coming to rest (fix, Nov 2026).** Players reported a loose cable that "danced" forever. Cause: the curl remover teleported a loop's nodes onto a straight chord *shorter* than the loop every 12 frames; the distance constraints pushed them back out into a new curl, and so on forever (jumps of 60–140 px/frame). Secondary causes: no sleeping, floor friction that never fully stopped a slide, and a constraint-driven creep of coils/piles. Fix:
  - Curl removal is now a 2-opt swap (reverse the node order between the two crossing segments: no node moves), capped at 3 automatic fixes per cable until the player touches something.
  - Position-based friction: static + kinetic on the floor, and between touching cables.
  - Extra damping below 0.25 px/substep so slow creep dies out; normal damping when moving (drag feel unchanged).
  - Island sleeping: cables that touch or share a tie sleep together once every node stayed within 3 px for 40 frames (tolerance grows slowly after ~3 s without input). Sleeping cables are frozen static colliders; they wake when grabbed, when anything is plugged/unplugged/tied, when a curl fix touches them, or when an awake node moving > 0.5 px/frame touches them (checked at frame end, not mid-solver).
  - Regression test: `npm run test:physics` (see README).

### 4.2 Plugs & ports
- Grab a plug (generous 34 px radius for fingers) — if it was plugged, it pops out with an *unplug* sound.
- Grab anywhere on a cable body to pull it around.
- Magnetic snap zone (44 px) with a dashed highlight ring; release to seat the plug.
- Feedback per snap: layered synthesized click, port ring pulse, LED with shape + brightness, never hue alone (bright green ✓ = cable complete, mid amber ! = right color but other end not done, dark blinking red ✕ = wrong color), a ✓/✕ badge while hovering a port, `navigator.vibrate` pattern on supporting devices, extra chime + sparks when a cable becomes fully valid.

### 4.3 Cable ties
- Limited ties per job (1–4). Tap *Tie*, then tap where 2+ cables of the **same color** run close together.
- The tie gathers those cables (ordered by their current side-by-side position to avoid twisting) and zips them into a neat parallel bundle with a ratchet sound.
- Ties can be dragged to slide the bundle; tap a tie to snip it and get it back.

### 4.3a Tangles and slack (Nov 2026)
- **Braids:** two cables crossing twice with nothing held in between swap the shapes of those stretches (no visible movement), so the crossings vanish. Same color: any length. Different colors: only short twists (14 nodes); bigger tangles stay for the player.
- **Flick:** once everything is connected, tapping a yellow ring resolves that crossing. A held cable stays put and the free one goes around it. If it truly can't be undone, the game says why.
- **Lift:** the stretch in the player's hand passes over other cables instead of snagging.
- **Slack flows:** each segment has its own rest length; holders guide cables but don't clamp them, so slack evens out across ties, hooks, wraps and ducts (`Game.balance`), and reels wind both sides. Nodes are re-indexed when a stretch changes length a lot (`renode`).
- Bundle lanes are ordered like the ports once all their cables are plugged.

### 4.3b Tools of the trade (Nov 2026)
Tap tools act on a tap and a drag still moves cables, so there is no mode friction.

| Tool | What it does | The satisfying bit |
|---|---|---|
| Zip tie | Gathers one color; tap again to snip the tail | Ratchet, then a crisp snip and the tail flies off |
| Velcro | Gathers any colors, reusable | Rrrrip on removal |
| Spiral wrap | Drag along a same-color bundle | Rising ticks as the tube winds on |
| Reel | Clip on a long cable, hold to wind, tap to release; pays out when pulled | Accelerating ratchet, thunk when taut |
| Comb | Drag across cables: parallel lanes | Cables fall into place behind the comb |
| Label maker | Tap a working cable | Printer chatter, label wraps on |
| Air duster | Hold and sweep | Hiss, fluff flies, loose cables flutter |
| Screwdriver | Hold on a terminal | Spin, bite, brass screw |
| Hook (fixture) | Drop a cable on it; it slips through until slack evens out | Click, capacity dots |
| Duct (fixture) | Drop cables in, zip the lid down | Finger-by-finger clicks; slack is sucked inside |

Plug heads: 44–64 px grab radius (scaled to the screen), preference for loose/wrong heads, pull 18 px to pop (44 px if screwed), 60 px magnet with a bias to matching ports.

### 4.4 Tidiness score (0–100) and stars
| Metric | Weight | How it's measured |
|---|---|---|
| Connections | 10 | valid cables / total (all required to finish) |
| Crossings | 35 | crossings between cables + self-loops (−20% each). Twists inside one tied same-color bundle don't count |
| Smooth runs | 25 | total turning angle along each cable (loops, zig-zags, slack) + cable lying on the floor |
| Color bundles | 18 | for each color with 2+ cables, share of them gathered by one tie, strap, wrap or closed duct |
| Finishing touches | 12 | dust, labels, screws, duct lid, trimmed ties (only those the job has) |

Stars: 1★ = finished, 2★ ≥ 75, 3★ ≥ 90. Live tidy meter in the HUD.

### 4.5 Before / After
- A snapshot of the initial chaos is taken right after the level settles; another at *Finish job*.
- Results screen shows a draggable comparison slider (with a *Side by side* toggle). Future: share/download image.

## 5. Progression & content

### Prototype (this repo): 7 jobs
| # | Job | Tier | Cables | Colors | Ties | New idea |
|---|---|---|---|---|---|---|
| 1 | Grandma Rosa's Router | Home router | 3 | 2 | zip 1 | Drag & snap, air duster |
| 2 | Byte Me Café | Home router | 5 | 3 | zip 2 | Zip ties + snipping |
| 3 | Nina's Streaming Desk | Home office | 5 | 3 | zip 2 | Reels, hooks, cables that are too long |
| 4 | Sparky Workshop Panel | Electrical panel | 6 | 3 | zip 3 | Duct with lid, terminal screws |
| 5 | Pixel Pals Studio | Network rack | 8 | 3 | velcro 3 | Comb, velcro, labels |
| 6 | Radio Luna | Broadcast booth | 7 | 3 | wrap 3 | Spiral wrap |
| 7 | Cloud Nine Datacenter | Datacenter rack | 10 | 4 | velcro 2, wrap 2 | Everything together |

### Full game (proposal): 3 worlds × 10 jobs + bonus
1. **Home & Small Business** – routers, TVs, game consoles, printers, café POS. Introduces drag, snap, ties.
2. **Electrical** – fuse boxes, workshop panels, stage lighting. New: wire stripping mini-step, breaker test switch, wire gauge (thick cables are stiffer).
3. **Datacenter** – patch panels, server racks, fiber. New: cable length choice (pick 0.5 m / 1 m / 2 m cables from a tray), labels, velcro vs zip ties, cable trays/rings, cooling airflow bonus.
- **Bonus jobs:** "Speed tidy" (timer), "Blind patch" (only LEDs tell you), "Zen mode" (endless random rack, no score).
- **Unlocks:** cosmetic cable skins (braided, neon, pastel), tie colors, workshop van stickers. All earned with stars, no pay-to-win.
- **Client recurring cast:** Rosa, Marco, Dolores, Juno, Ada come back with bigger setups (light narrative arc).

## 6. Controls

| Action | Mouse | Touch |
|---|---|---|
| Move plug / cable | Click + drag | Finger drag |
| Unplug | Drag a plugged plug | Same |
| Place tie | *Tie* button (or **T**) → click | *Tie* button → tap |
| Move / remove tie | Drag / click tie | Drag / tap tie |
| Cancel tie mode | **Esc** or *Tie* button | *Tie* button |

Single-pointer input (extra fingers ignored) to avoid accidental multi-touch chaos.

## 7. Art & audio direction
- **Art:** clean flat-vector with soft shading, fully procedural Canvas 2D (no image assets). Each world has a distinct backdrop: striped wallpaper, brick café, concrete workshop with hazard floor, acoustic-foam studio, blue rack rails.
- **Readability:** color + symbol badge on every port and plug, link LED beside each socket, plug shape per world (RJ45 vs ferrule wires).
- **Colorblind support (done in M0):** Okabe–Ito-based palette with big lightness steps — Black ≡ bars, Blue ■ square, Orange ◆ diamond, Sky ▲ triangle, Yellow ● circle, White ★ star. No blue/purple, red/green or green/yellow pairs. Every symbol is on each plug, each port tag and the job legend (color name + count), so the game is fully playable in grayscale. `npm run test:colors` simulates protanopia, deuteranopia and tritanopia (Machado 2009 + Viénot/Brettel) and requires, for every pair of colors sharing a level, CIEDE2000 ≥ 20, |ΔL*| ≥ 12 and luminance contrast ≥ 1.4, plus unique symbols. Still open: a setting to show color names on badges.
- **Audio:** 100% synthesized with Web Audio (no files): two-stage latch click, unplug pop, zip-tie ratchet, snip, chimes, star dings. Mute toggle persisted. Planned: soft lo-fi ambience per world.
- **Haptics:** `navigator.vibrate` short patterns (snap, tie, all-good, stars) where supported.

## 8. Technical architecture
- **Stack:** TypeScript + Vite, Canvas 2D, no runtime dependencies. Bundle ≈ 45 KB (≈ 17 KB gzip).
- **Files:**
  - `src/game.ts` – simulation (Verlet ropes in flat typed arrays, spatial-hash repulsion, ports, ties, input logic, scoring).
  - `src/render.ts` – procedural drawing of backgrounds, devices, ports, cables, plugs, ties, FX.
  - `src/levels.ts` – data-driven job definitions (devices, ports, colors, ties, seed, client text).
  - `src/audio.ts` – Web Audio synth SFX + vibration helper.
  - `src/main.ts` – DOM UI (screens, HUD, results, before/after), fixed-timestep loop, pointer input.
- **World:** fixed 720×900 logical units, letterboxed and scaled to the stage, DPR-aware (capped at 2).
- **Determinism:** each job uses a seeded RNG for its initial tangle, so every player gets the same mess.
- **Persistence:** stars + mute in `localStorage`.
- **Deploy:** GitHub Actions → GitHub Pages (`base: /coolmath-cable-tidy/`).
- **Test hook:** `window.__cable` exposes plug/port positions and the evaluation, used by automated Playwright play-throughs.
- **Physics test:** `npm run test:physics` runs the real simulation headless on every job (start, solved, drag, tie, random drags) and asserts all cables come to rest.

## 9. Milestones
| Milestone | Content | Status |
|---|---|---|
| M0 Prototype | Physics, snap, ties, scoring, 5 jobs, before/after, Pages deploy | ✅ Done |
| M1 Vertical slice | Polish pass, tutorial ghost hand, ambience, 10 jobs (colorblind symbols shipped early) | Next |
| M2 Content | 3 worlds × 10 jobs, cable length tray, labels, trays/rings | |
| M3 Coolmath launch | Ad break hooks, analytics events, perf pass on low-end Android, localization | |

## 10. Risks & mitigations
| Risk | Mitigation |
|---|---|
| Rope physics too fiddly on small phones | Big grab radii, magnetic snap, single-pointer input, world scales to fit |
| Performance with 20+ cables | Flat typed arrays + spatial hash; reduce iterations adaptively |
| Players don't discover ties | Job 2 introduces ties with flashing button + hint; client goal mentions it |
| Score feels arbitrary | Metric breakdown on results; live meter; crossings highlighted (planned) |
| Color reliance | CVD-safe palette + symbol per color + shaped LEDs, guarded by `npm run test:colors` ✅ |

## 11. Success metrics (post-launch)
- ≥ 70% of players finish job 1; ≥ 40% reach job 5.
- Average session ≥ 6 minutes; ≥ 25% replay a job for 3★.
- Low rage-quit signals (reset spam < 2 per job on average).
