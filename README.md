[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/ngadukun/coral-bay-heat-3/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/ngadukun/coral-bay-heat-3/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

# Coral Bay Heat

An original open-world crime game that runs entirely offline in a desktop
browser — a sun-drenched coastal city of pastel towers, palm boulevards and a
working marina, built with three.js and plain ES modules. No build step, no
network requests, all sound synthesised live with WebAudio.

Built for the make.fun competition: https://make.fun/bounty/gta6-01

## The story

Marina "Mari" Solano, a retired getaway driver, comes home to Coral Bay owing
the harbour more money than she has. A thirteen-mission story chain carries
her from café collections to a five-star harbour finale under the fireworks,
working for her Aunt Rosa and the harbour fixer Valen Cruz.

## How to play

Open `game/index.html` (or serve the repo with `node serve.ts` and visit
http://localhost:8080). Choose **New Game** or **Continue** — progress saves
to localStorage automatically at mission ends and from the pause menu.

### Controls

| Input | Action |
| --- | --- |
| WASD | Move / drive |
| Mouse | Orbit camera (click the game to lock the pointer) |
| Shift | Sprint on foot |
| Space | Jump on foot / handbrake drift in a car |
| E | Enter/exit car, talk, start a job, buy at the gun corner |
| Left click | Punch, or fire the pistol once Mari owns one |
| T | Start a taxi fare (in a taxi) or a street race (at a race start) |
| Esc | Pause menu with progress, Save and Restart |

### Systems

- Five districts on one island grid — Downtown, the Marina and boardwalk,
  Coral Beach, the Suburbs and the Port — with traffic lights, lamps that
  light at dusk, neon signage, billboards and lit windows at night.
- Traffic AI that follows lanes, keeps spacing, brakes for lights and
  obstacles, honks, and flees gunfire; pedestrians who stroll, idle, cross
  and run screaming from danger.
- A one-to-five star wanted system: police pursue, ram and box in, set
  roadblocks at three stars, and step out to shoot. Stay unseen to cool the
  heat. Get caught slow and close and the Busted meter fills; lose all
  health and you are Wasted. Both cost cash and a trip across town.
- Day-night cycle (~6 minutes a day) with dawn/dusk golden grading, stars,
  clouds, clear/overcast/rain weather, wet-looking roads, and fireworks over
  the marina on clear nights.
- Fully synthesised sound: engine, sirens, horns, gunshots, chimes, rain,
  gulls, and a laid-back menu groove that ducks under sirens.

### The thirteen missions

1. **Welcome Home** — drive Aunt Rosa home, then back to her café.
2. **Collections** — three debtors, one who runs.
3. **Hot Cargo** — steal a sports car from the Port under its own alarm.
4. **Beach Party Bust** — grab the cash case and escape on foot and by car.
5. **The Middleman** — tail a rival, then survive the warehouse shootout.
6. **Night Run** — four drops across the island against the clock.
7. **Settle Up** — defend Rosa's Café through three waves.
8. **The Harbour Job** — hook the boat trailer and run a five-star escape.
9. **Harbor Nights: Night Ledger** — Valen's cooked books, settled after dark.
10. **Harbor Nights: Buoy Money** — wade out and tap Valen's neon buoys.
11. **Harbor Nights: Smuggler's Tide** — a timed van run to the beach.
12. **Neon Grand Prix** — Valen's eight-checkpoint night street race.
13. **Fireworks Finale** — hold the pier, then watch the sky you bought back.

### Side content

- **Taxi fares** against the clock from any taxi.
- **Two street races** — Downtown Dash and the Coast Run.
- **22 golden shells** hidden on piers, alleys and the beach (cash every 5).
- **14 neon buoys** floating around the island (cash every 3).
- **Stunt jumps** off the port and beach ramps, with a slow-motion bonus.
- **Gun Shop Corner** downtown: pistol $300, ammo $50.

## Build notes

- `game/vendor/three.min.js` is the only library file (three.js r149 UMD,
  minified); everything else is hand-written modules under `game/src/`,
  one job each: city generation, sky/weather/fireworks, traffic, pedestrians,
  police/wanted, vehicles, player/combat, particles, sound synthesis,
  missions and mission data, minimap, save, input, staged screenshot scenes
  and the main loop.
- The world is deterministic from a fixed seed (`?seed=`), and the four
  judged screenshots are staged scenes of the real game via
  `?shot=cover|chase|port|finale` with fixed cameras — see `shots.json`.
- `node main.ts` copies `game/` and `screenshots/` out and writes the
  dossier; `vendor/makefun-game.ts` is the kit's own file, untouched.
