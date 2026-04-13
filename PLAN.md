# MoonLander Enhanced — Project Plan

## Phase 1 — Playable Core (MVP) ✓ COMPLETE (v0.1.0.0)

**Theme:** It works. It feels good. You can lose.

- [x] Vite + TypeScript project scaffold
- [x] Canvas renderer with game loop
- [x] Lander with thrust + rotation + real lunar gravity
- [x] Procedural terrain (midpoint displacement)
- [x] Landing pad placement and detection
- [x] Crash vs safe landing detection
- [x] Telemetry HUD (altitude, vertical speed, horizontal speed, fuel, angle)
- [x] Thruster particle system (exhaust plume)
- [x] Landing dust particle burst
- [x] Explosion on crash
- [x] Parallax starfield background
- [x] Keyboard input (arrow keys + space)
- [x] Basic scoring
- [x] "Try again" restart flow
- [x] Unit tests for physics and math (36 tests)
- [x] Biome linter + knip dead code detection
- [x] Pre-landing review: fixed camera smoothing, position integration, angle normalization, pad collision, score calculation

**Exit question:** Is the physics fun to fight against? Does landing feel rewarding?

---

## Phase 2 — Depth and Replayability

**Theme:** Every run is different. You want one more go.

- [x] Sound design (Web Audio API — thruster hum, crash, success jingle, low fuel warning)
- [x] Ghost replay system (record inputs, play back best run)
- [x] Multiple terrain seeds / mission select
- [x] Touch/mobile input support
- [x] Campaign mode (5 missions, escalating difficulty)
- [x] Persistent leaderboard per terrain seed (localStorage)
- [x] Session telemetry log (altitude curve, speed over time)
- [x] Earth rise parallax layer (shipped in Phase 1)
- [x] Wind system (direction + strength shown on HUD)
- [x] Multiple lander types (different thrust/weight/fuel ratios)
- [x] Fuel leak random event

**Exit question:** Do you come back to beat your own ghost? Is the campaign satisfying?

---

## Phase 3 — AI and Learning Layer

**Theme:** The game teaches you how AI thinks.

- [x] Rule-based autopilot (toggle on/off mid-flight, watch it solve)
- [x] TensorFlow.js RL agent — trains in browser, visible reward curve
- [x] Training mode UI (episode count, reward graph, speed multiplier)
- [x] Agent replay viewer (watch best agent run at normal speed)
- [x] Claude API — dynamic mission briefings per terrain seed
- [x] Claude API — mission control commentary on landing quality
- [x] Difficulty adaptation based on player history

**Exit question:** Can you watch the RL agent improve in real time and understand why?

---

## Phase 4 — Polish and Shareability

**Theme:** Send someone a link. They get it in 10 seconds.

- [x] URL-encoded terrain seeds (share exact map with friends)
- [x] Async ghost sharing (export/import ghost run as JSON)
- [x] Retro vector graphics skin (unlockable)
- [ ] 3D mode exploration (Three.js spike — actual lunar surface)
- [x] PWA support (installable, offline play)
- [x] Embed mode (plays in an iframe for portfolio/blog)

**Exit question:** Would a stranger share this with a friend?

---

## Phase 5 — Unique Features

**Theme:** Things only this game can do. Make it unforgettable.

- [ ] Black Box Flight Recorder — canvas-rendered flight report card (altitude curve, speed at touchdown, fuel efficiency grade A-F, terrain silhouette with descent path). One-tap save to camera roll. Built for screenshots and social sharing.
- [ ] Lunar Archaeology Mode — random artifacts scattered on terrain (Apollo flags, rover tracks, old lander debris). Land near one to scan it and get a real historical fact via the LLM provider. Exploration meets education.
- [ ] Gravity Storms — periodic gravity anomalies mid-flight. Gravity doubles, halves, then normalizes. Visible terrain distortion, HUD warning, soundtrack spike. Deterministic and seeded like wind.
- [ ] Multi-Lander Relay — land 3 landers sequentially on the same terrain. Each starts from the last landing/crash site. Combined score. Ghost replay shows all 3 overlaid.
- [ ] Terrain Editor — draw custom terrain with mouse/touch, place pads manually, name it, share as a compact base64 URL. Replace midpoint displacement with user-drawn control points.

**Exit question:** Does this game have something no other Moon Lander has?

---

## Verification

- Run `npm run dev` and open http://localhost:5173
- Thrust with up arrow, rotate with left/right arrows
- Land on a green pad at low speed and near-vertical angle
- Crash into terrain to see explosion particles
- Press R to restart after landing or crashing
- Check HUD updates in real time during flight
