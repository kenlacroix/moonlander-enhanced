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

- [x] Black Box Flight Recorder — canvas-rendered flight report card (altitude curve, speed at touchdown, fuel efficiency grade A-F, terrain silhouette with descent path). One-tap save to camera roll. Built for screenshots and social sharing.
- [x] Lunar Archaeology Mode — random artifacts scattered on terrain (Apollo flags, rover tracks, old lander debris). Land near one to scan it and get a real historical fact via the LLM provider. Exploration meets education.
- [ ] Gravity Storms — periodic gravity anomalies mid-flight. Gravity doubles, halves, then normalizes. Visible terrain distortion, HUD warning, soundtrack spike. Deterministic and seeded like wind.
- [ ] Multi-Lander Relay — land 3 landers sequentially on the same terrain. Each starts from the last landing/crash site. Combined score. Ghost replay shows all 3 overlaid.
- [ ] Terrain Editor — draw custom terrain with mouse/touch, place pads manually, name it, share as a compact base64 URL. Replace midpoint displacement with user-drawn control points.

**Exit question:** Does this game have something no other Moon Lander has?

---

## Phase 6 — Competitive Layer

**Theme:** You vs the world.

- [ ] Global leaderboard via serverless API (Cloudflare Workers or Vercel Edge). Score + seed + ghost hash. No accounts, just a player name.
- [ ] Daily challenge: one shared seed, everyone gets the same terrain, 24-hour leaderboard reset at midnight UTC.
- [ ] Ghost download from the leaderboard. Watch the #1 player's run before you try.
- [ ] Seed-of-the-week community picks. Curated by LLM based on terrain interestingness (roughness variance, pad difficulty score).
- [ ] Achievement badges (localStorage): "First Landing", "No Thrust Landing", "Full Campaign", "Beat the AI", "Survive the Aliens".

**Exit question:** Do strangers compete against each other on your game?

---

## Phase 7 — Visual Upgrade (WebGL)

**Theme:** It looks like a real game now.

- [ ] PixiJS WebGL renderer (swap-in, game logic untouched per IRenderer pattern).
- [ ] Bloom shader on thruster plume and landing pad beacons.
- [ ] Heat distortion shader behind engine bell.
- [ ] Normal mapping on terrain surface for 3D feel on 2D geometry.
- [ ] Dynamic sun lighting per mission (angle changes, casts lander shadow).
- [ ] Lander spotlight illuminating terrain on final approach.
- [ ] Particle count 10x via WebGL particle containers.
- [ ] Screen shake with camera trauma system.

**Exit question:** Does someone watching over your shoulder say "that looks cool"?

---

## Phase 8 — Audio Evolution

**Theme:** The sound design becomes the game.

- [ ] Procedural ambient radio chatter (seeded beeps, static bursts, garbled transmissions).
- [ ] Heartbeat audio layer synced with descent rate. Faster heartbeat = faster descent.
- [ ] Doppler effect on thruster hum when camera moves relative to lander.
- [ ] Per-mission musical key. Each seed generates a different tritone root so every mission sounds different.
- [ ] Spatial audio (Web Audio panning) for aliens, wind, terrain proximity warnings.
- [ ] Sound design for the terrain editor (drawing sounds, pad placement click).

**Exit question:** Can you close your eyes and still feel the tension?

---

## Phase 9 — Multiplayer

**Theme:** Land together or crash trying.

- [ ] Split-screen local multiplayer (2 players, same terrain, side by side).
- [ ] Async multiplayer via WebSocket: see other players' landers in real time as ghosts.
- [ ] Race mode: same seed, first to land wins. Visible timer.
- [ ] Sabotage mode: each player has one interference power (wind gust, gravity spike) using the alien effect system.

**Exit question:** Do you text someone "try to beat this" and they actually do?

---

## Phase 10 — Education Mode

**Theme:** The game teaches you real physics.

- [ ] Physics sandbox: adjustable gravity slider (Moon, Mars, Earth, Jupiter, zero-g).
- [ ] Orbital mechanics intro: start from orbit, deorbit burn, then descent. Two-phase landing.
- [ ] Real Apollo mission replays: recreate Apollo 11's descent as a playable mission with actual altitude/speed data overlay.
- [ ] Annotated autopilot: when active, show WHY it makes each decision (force vectors, target indicators).
- [ ] RL agent explainer: visualize neural network weights during training, show which inputs matter most, animate reward signal.

**Exit question:** Can you watch the RL agent improve and understand why?

---

## Phase 11 — Platform

**Theme:** It's not a game anymore. It's a thing people build on.

- [ ] Mission SDK: JSON schema for user-created missions with custom terrain, events, win conditions, narrative.
- [ ] Plugin system for custom lander types, skins, and effects.
- [ ] Classroom mode: teacher creates mission sets, students compete, teacher sees score/telemetry dashboard.
- [ ] Headless simulation API: run N landings with given inputs, return scores. For benchmarking RL agents.
- [ ] Open source community contributions: mission packs, skins, sound packs.

**Exit question:** Are people building things you didn't plan?

---

## Verification

- Run `npm run dev` and open http://localhost:5173
- Thrust with up arrow, rotate with left/right arrows
- Land on a green pad at low speed and near-vertical angle
- Crash into terrain to see explosion particles
- Press R to restart after landing or crashing
- Check HUD updates in real time during flight
