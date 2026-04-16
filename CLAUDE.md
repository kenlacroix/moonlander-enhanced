# MoonLander — Claude Code Context

## Project Identity
- **Repo name:** `moonlander-enhanced`
- **Tagline:** A browser-based, AI-enhanced reimagining of the 1979 Moon Lander arcade game
- **Owner:** Solo developer / vibe coding project
- **Primary goal:** Learn game dev, physics simulation, and AI/ML concepts by building
- **Secondary goal:** Shareable, no-install experience — runs entirely in the browser

---

## Tech Stack
- **Runtime:** Browser only — no backend required for core game
- **Language:** TypeScript
- **Renderer Phase 1:** HTML5 Canvas (2D) — fast to build, 60fps, sufficient for MVP
- **Renderer Phase 2+:** PixiJS (WebGL) — GPU-accelerated, drop-in upgrade path from Canvas
- **Renderer Phase 4 (optional):** Three.js — full 3D lunar surface mode
- **Shaders:** GLSL fragment/vertex shaders via PixiJS filters (bloom, heat distortion, normal maps)
- **Game loop:** Custom requestAnimationFrame loop (no heavy framework)
- **Physics:** Custom — real lunar gravity (1.62 m/s²), rotational dynamics
- **AI gameplay:** TensorFlow.js — in-browser RL agent training (Phase 3)
- **AI visuals:** TensorFlow.js — neural style transfer for unlockable skins (Phase 3)
- **AI generative:** Claude API — mission briefings, mission control commentary (Phase 3)
- **AI textures:** Image generation API — unique terrain textures per mission seed (Phase 4)
- **Build tool:** Vite
- **Package manager:** npm
- **Styling:** CSS modules or plain CSS — minimal, game-focused UI
- **No game framework** (Phaser, etc.) unless complexity demands it — keep it lean

---

## Repo Structure
```
moonlander-enhanced/
├── CLAUDE.md                  ← you are here
├── README.md
├── index.html
├── package.json
├── vite.config.ts
├── tsconfig.json
├── src/
│   ├── main.ts                ← entry point, bootstraps game
│   ├── game/
│   │   ├── Game.ts            ← main game loop, state machine
│   │   ├── Lander.ts          ← lander physics, controls, state
│   │   ├── Terrain.ts         ← procedural terrain generation
│   │   ├── Physics.ts         ← gravity, thrust, collision math
│   │   ├── Particles.ts       ← thruster exhaust, dust, explosions
│   │   └── Camera.ts          ← viewport, zoom, parallax
│   ├── render/
│   │   ├── Renderer.ts        ← render backend switcher (Canvas → WebGL)
│   │   ├── CanvasRenderer.ts  ← Phase 1: pure Canvas 2D implementation
│   │   ├── WebGLRenderer.ts   ← Phase 2: PixiJS WebGL implementation
│   │   ├── HUD.ts             ← telemetry overlay (speed, fuel, altitude)
│   │   └── Background.ts      ← starfield, Earth rise, parallax layers
│   ├── graphics/
│   │   ├── shaders/
│   │   │   ├── bloom.glsl     ← bloom/glow for thruster and pad lights
│   │   │   ├── heatwave.glsl  ← heat distortion behind engine plume
│   │   │   ├── normalmap.glsl ← terrain surface normal mapping (3D feel)
│   │   │   └── scanline.glsl  ← retro CRT scanline effect (skin)
│   │   ├── LightingSystem.ts  ← sun angle, shadow casting, lander spotlight
│   │   ├── TerrainRenderer.ts ← terrain texture tiling, procedural rock detail
│   │   ├── LanderSprite.ts    ← lander draw: vector base + WebGL glow layers
│   │   ├── PlumeRenderer.ts   ← thruster plume: particles + shader distortion
│   │   ├── SkinManager.ts     ← manages active visual skin, skin unlock state
│   │   └── skins/
│   │       ├── RetroVector.ts ← 1979 arcade vector graphics skin
│   │       ├── Painterly.ts   ← TF.js neural style transfer skin
│   │       └── NeonFuture.ts  ← synthwave neon aesthetic skin
│   ├── ai/
│   │   ├── Autopilot.ts       ← rule-based autopilot (Phase 2)
│   │   ├── RLAgent.ts         ← TensorFlow.js RL agent (Phase 3)
│   │   ├── StyleTransfer.ts   ← TF.js neural style transfer for skins (Phase 3)
│   │   └── TextureGen.ts      ← image API calls for AI terrain textures (Phase 4)
│   ├── api/
│   │   ├── MissionControl.ts  ← Claude API: live commentary on landing
│   │   └── MissionBriefing.ts ← Claude API: per-seed mission narrative + art prompt
│   ├── systems/
│   │   ├── Input.ts           ← keyboard, touch, gamepad input
│   │   ├── Audio.ts           ← Web Audio API, thruster hum, crash, jingle
│   │   ├── Telemetry.ts       ← session recording, ghost replay data
│   │   └── SaveState.ts       ← localStorage: scores, settings, ghosts, skins
│   └── utils/
│       ├── noise.ts           ← Perlin/simplex noise for terrain + texture variation
│       ├── math.ts            ← vectors, interpolation, clamp helpers
│       └── constants.ts       ← physics constants, game tuning, graphics config
├── public/
│   └── assets/
│       ├── textures/          ← base terrain textures, lander sprite sheets
│       ├── audio/             ← thruster, crash, success, ambient sounds
│       └── styles/            ← reference images for neural style transfer skins
└── tests/
    ├── physics.test.ts        ← unit tests for physics math
    └── terrain.test.ts        ← terrain generation determinism tests
```

---

## Game Concepts

### Core Loop
1. Lander spawns above procedurally generated lunar terrain
2. Player controls thrust (up) and rotation (left/right)
3. Goal: land on a designated flat pad at safe velocity and angle
4. Fuel is finite — waste it and you fall
5. Score based on: landing precision, fuel remaining, descent time, angle on touchdown

### Physics Model
- Gravity: 1.62 m/s² downward (real lunar surface gravity)
- Thrust: applies force in lander's current facing direction
- Rotation: angular velocity with damping (no atmosphere but thruster-based RCS)
- Collision: terrain polygon vs lander bounding box; safe landing = vertical speed < 2 m/s, angle < 10°
- No atmosphere = no drag (except optional "solar wind" challenge mode)

### Lander State Machine
```
IDLE → FLYING → LANDING_SUCCESS
                → CRASH
                → OUT_OF_FUEL → FREEFALL → CRASH
```

### Terrain Generation
- Midpoint displacement algorithm seeded by mission number
- Same seed = same terrain (enables ghost racing and leaderboards)
- Landing pads: 1-3 per map, width inversely proportional to point value
- Difficulty scales: pad width, terrain roughness, initial altitude, fuel allowance

---

## Roadmap

### Phase 1 — Playable Core (MVP) ✅ COMPLETE
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

**Exit question:** Is the physics fun to fight against? Does landing feel rewarding?

---

### Phase 2 — Depth and Replayability ✅ COMPLETE
**Theme:** Every run is different. You want one more go.
- [x] Multiple terrain seeds / mission select (10 free-play + 5 campaign missions)
- [x] Wind system (direction + strength shown on HUD)
- [x] Multiple lander types (Eagle, Atlas, Sparrow — different thrust/weight/fuel)
- [x] Ghost replay system (record inputs, play back best run)
- [x] Persistent leaderboard per terrain seed (localStorage)
- [x] Session telemetry log (altitude curve, speed over time at 4Hz)
- [x] Touch/mobile input support
- [x] Sound design (Web Audio API — synthesized thruster hum, crash, landing chime)
- [x] Earth rise parallax layer
- [x] Fuel leak random event
- [x] Campaign mode (5 missions, escalating difficulty)

**Exit question:** Do you come back to beat your own ghost? Is the campaign satisfying?

---

### Phase 3 — AI and Learning Layer ✅ COMPLETE
**Theme:** The game teaches you how AI thinks.
- [x] Rule-based autopilot (toggle with P key, PID-style guidance across 4 altitude zones)
- [x] TensorFlow.js RL agent — DQN with 8-D state, trains in browser
- [x] Training mode UI (episode count, reward stats, speed multiplier)
- [x] Agent replay viewer (watch best agent run at normal speed)
- [x] Claude API — dynamic mission briefings per terrain seed (streaming, cached)
- [x] Claude API — mission control commentary on landing quality
- [x] Difficulty adaptation based on player history (Easy/Normal/Hard/Expert)

**Exit question:** Can you watch the RL agent improve in real time and understand why?

---

### Phase 4 — Polish and Shareability ⚠️ MOSTLY COMPLETE
**Theme:** Send someone a link. They get it in 10 seconds.
- [x] URL-encoded terrain seeds (`?seed=1969` — share exact map with friends)
- [x] Async ghost sharing (export/import ghost run as JSON)
- [x] Retro vector graphics skin (unlockable, toggle with V key)
- [ ] 3D mode exploration (Three.js spike — actual lunar surface)
- [x] PWA support (installable, offline play via service worker)
- [x] Embed mode (`?embed=1` — plays in an iframe for portfolio/blog)

**Exit question:** Would a stranger share this with a friend?

---

### Bonus Features (shipped beyond original roadmap)
- [x] Alien/UFO hazard system — deterministic UFO orbits with fuel-siphon, controls-reversed, thrust-reduced, drag effects (~30% of missions)
- [x] Gravity storms — periodic gravity anomalies with cosmetic terrain wobble (~20% of missions)
- [x] Lunar archaeology — historical artifacts (flags, rover tracks, plaques) with LLM-powered Apollo facts (~40% of missions)
- [x] Terrain editor — draw custom terrain with mouse/touch, base64 URL sharing, undo stack
- [x] Multi-lander relay mode — land 3 landers sequentially, combined scoring
- [x] Gravity sandbox — Moon/Mars/Earth/Jupiter/Zero-G presets
- [x] Achievement system — 8 badges with localStorage persistence and toast notifications
- [x] Flight report card — post-flight altitude curve, descent visualization, shareable canvas card
- [x] Dynamic soundtrack — Web Audio synthesized 3-layer adaptive music (bass, melody, drums)
- [x] Autopilot annotations — visual debug overlay with force vectors and decision labels (toggle with A key)
- [x] Settings overlay — configure LLM API key, toggle features
- [x] Terrain crevices — difficulty-scaling hazards
- [x] Daily challenge (client-side) — UTC date as seed, shared terrain per day, reuses seed-keyed leaderboard
- [x] Post-crash flight analysis — LLM-generated coaching tip with deterministic rule-based fallback
- [x] Speedrun timer — live MM:SS.SS in HUD, per-seed best time tracking, beats-best-time highlight
- [x] RL model persistence — DQN weights saved/loaded via IndexedDB across sessions

---

## Graphics Roadmap

### Graphics Phase 1 — Canvas 2D ✅ COMPLETE
**Theme:** Looks intentional, not unfinished.
- [x] Vector lander shape with dynamic rotation
- [x] Filled terrain polygon with flat color + edge highlight
- [x] Radial gradient glow on thruster (Canvas compositing)
- [x] Particle system: exhaust plume, dust burst, explosion fragments
- [x] Parallax starfield (3 depth layers, different scroll speeds)
- [x] Earth rise on horizon (semi-circle, subtle glow)
- [x] Landing pad with blinking beacon lights
- [x] HUD in clean monospace font — altitude, v-speed, h-speed, fuel, angle

**What you learn:** Canvas API, 2D transforms, compositing modes, particle systems

---

### Graphics Phase 2 — WebGL via PixiJS ❌ NOT STARTED
**Theme:** It looks like a real game now.
- [ ] Swap `CanvasRenderer.ts` for `WebGLRenderer.ts` — game logic untouched
- [ ] Bloom/glow shader on thruster plume and landing pad lights (`bloom.glsl`)
- [ ] Heat distortion shader behind engine bell (`heatwave.glsl`)
- [ ] Normal mapping on terrain surface — flat polygon looks 3D (`normalmap.glsl`)
- [ ] Dynamic sun lighting — angle changes per mission, casts lander shadow on ground
- [ ] Lander spotlight — illuminates terrain directly below on final approach
- [ ] Procedural rock detail on terrain surface (noise-driven micro-geometry)
- [ ] Smoother particle rendering via PixiJS particle container (10x more particles)
- [ ] Screen shake on crash (camera trauma system)

**What you learn:** WebGL pipeline, GLSL shader basics, PixiJS API, GPU compositing

---

### Graphics Phase 3 — AI Visual Layer ⚠️ PARTIAL
**Theme:** The visuals are generative. Every run looks unique.

**Neural Style Transfer Skins (TensorFlow.js, runs in browser)**
- [ ] `StyleTransfer.ts` captures canvas frame, runs TF.js style model, outputs styled frame
- [ ] Style images live in `public/assets/styles/` — one per skin
- [ ] Skins available: Painterly (impressionist), Neon Future (synthwave)
- [ ] Performance note: style transfer runs at ~10fps — used as a "replay mode" filter, not real-time
- [ ] Unlocked by: completing campaign missions

**Retro Vector Skin (pure code, no ML)** ✅ COMPLETE
- [x] `RetroVector.ts` overrides all draw calls with green vector lines on black
- [x] Phosphor glow effect via Canvas shadow blur
- [x] Mimics original 1979 Atari vector display
- [x] Toggle with V key

**AI Terrain Textures (image generation API)**
- [ ] `TextureGen.ts` builds a prompt from mission seed: terrain type, lighting, mineral content
- [ ] Calls image generation API (e.g. fal.ai, Replicate, or similar)
- [ ] Returns a tileable 512x512 texture applied to terrain polygon surface
- [ ] Cached to localStorage by seed — only generates once per mission
- [ ] Graceful fallback: flat color if API unavailable or offline

**What you learn:** TensorFlow.js model inference, image generation APIs, texture mapping, browser performance constraints

---

### Graphics Phase 4 — 3D Mode ❌ NOT STARTED
**Theme:** Same physics, completely different dimension.
- [ ] Three.js replaces PixiJS for this mode only — separate entry point
- [ ] Actual lunar surface mesh generated from same terrain seed
- [ ] Lander is a 3D model (low-poly NASA-inspired descent stage)
- [ ] Earth visible in skybox, slowly rotating
- [ ] Volumetric thruster plume via Three.js particle system
- [ ] Camera follows lander with cinematic lag and tilt
- [ ] Same physics engine underneath — only the renderer changes

**What you learn:** Three.js scene graph, 3D camera systems, mesh generation from 2D data, skyboxes

---

## Long-Term Roadmap — AI Theater First

**Vision:** MoonLander Enhanced becomes the "TensorFlow Playground of reinforcement learning" except it's a game you actually want to play. One URL where someone plays, watches an AI learn to beat them, compares RL algorithms, forks any AI decision, then races a friend on the same terrain. Real physics, real AI, all in the browser.

**Approach:** AI Theater First (validated by CEO review + cross-model consensus). Lead with the unique differentiator (visible AI learning), then add content depth, then visual upgrade, then multiplayer and 3D.

### Sprint 1 — Foundation (Game.ts Decomposition) ✅ COMPLETE
- [x] Split Game.ts (~900 lines) into GameLoop, GameState, Game orchestrator (GameRenderer.ts already extracted)
- [x] Generalize existing TrainingLoop.ts into reusable HeadlessGame class
- [x] Target: Game.ts under 350 lines, all tests pass, game plays identically

**Exit question:** Is Game.ts maintainable now? Can you add a feature without touching 5 concerns?

---

### Sprint 2 — AI Theater MVP ✅ COMPLETE
- [x] Split-screen layout: player (left) + AI training (right, same seed, 50x real-time)
- [x] Live reward curve below AI panel (canvas line chart)
- [x] Episode counter, best score, current score updating in real time
- [x] "Watch AI's best run" button using existing ghost replay (gated behind 20-episode minimum)
- [x] Comparison card on landing: player vs AI scores
- [x] Human vs AI shareable scorecard (extends FlightRecorder.ts pattern)
- [x] AI narration of decisions via LLM reading autopilot decision state

**Exit question:** Does watching the AI learn make you understand RL better than reading about it?

---

### Sprint 2.5 — RL Algorithm Comparison ✅ COMPLETE
- [x] Implement simple policy gradient agent (REINFORCE) alongside existing DQN
- [x] Run DQN vs policy gradient vs random agent side-by-side in AI Theater (round-robin)
- [x] Three learning curves on the same chart (smoothed, color-coded, with legend)
- [x] Educational labels explaining why algorithms differ

**Exit question:** Can a non-ML person understand why DQN wins by watching the curves?

---

### Sprint 2.6 — AI Theater Explain Mode ⚠️ Parts A+B shipped (v0.5.8.1 / v0.5.8.2); Part C remaining

*CEO+Eng reviewed 2026-04-15 in SCOPE EXPANSION mode. Plan at `.plans/sprint-2.6-explain-mode.md`. CEO plan at `~/.gstack/projects/kenlacroix-moonlander-enhanced/ceo-plans/2026-04-15-sprint-2.6-explain-mode.md`.*

**Part A — AI VISION strip + AGENT_META registry ✅ COMPLETE (v0.5.8.1, PR #27)**
- [x] AI VISION strip: 11 labeled horizontal bars showing the state vector in real time (~2Hz, rAF-throttled). (State vector grew from 8 to 11 dims in Sprint 2.7, so the strip shipped with 11 bars.)
- [x] Algorithm description cards under each legend entry (AGENT_META collapsed registry replacing AGENT_LABELS + AGENT_COLORS + AGENT_DESCRIPTIONS).

**Part B — Reward breakdown overlay ✅ COMPLETE (v0.5.8.2, PR #29)**
- [x] Reward breakdown overlay: per-episode component totals (terminal, proximity, descent, speed, angle penalty, approach, time tax) via `calculateRewardBreakdown()`, toggled with EXPLAIN button. Preference persists via `localStorage["moonlander-explain-mode"]`.

**Part C — Tutorial + polish (remaining)**
- [ ] First-run 3-card inline tutorial (localStorage `moonlander-ai-theater-tour-seen`), dismissible, never reappears
- [ ] `?` keyboard toggle for compact vs expanded mode (localStorage-persisted)
- [ ] E1: RANDOM badge flashes on exploratory actions (makes epsilon concrete)
- [ ] E2: Hover tooltips on state-vector bars (raw value + human-readable label)
- [ ] E3: First-landing glow on algorithm card (3 sec on first success)

**Part C also natural home for deferred findings from Parts A+B** (tracked in TODOS.md):
- Transfer DQN breakdown on non-Moon worlds (Part B found that on Europa/Jupiter/etc. the transfer-DQN slot isn't captured in the overlay)
- `REWARD_COMPONENT_KEYS` single source of truth (drift hazard across 3 call sites)
- Codex second opinion on Parts A+B (blocked 2026-04-16 by account limit, reset 2026-04-20)

**Deferred:** E4 interactive reward-function sliders (live retrain) — promoted to its own future sprint.

**Exit question:** Can someone with zero RL background watch AI Theater for 60 seconds and leave knowing what the AI sees, what it's optimizing, and why the curves differ?

---

### Sprint 2.7 — Smarter DQN ✅ COMPLETE (v0.5.8.0)

*CEO-reviewed 2026-04-15 in HOLD SCOPE mode. Plan at `.plans/sprint-2.7-smarter-dqn.md`. Approach A shipped with Part C split: hyperparameters + wider network landed now, true Dueling DQN deferred.*

**Part A — Reward shaping + state expansion ✅**
- [x] Overhauled `calculateReward` with structured, stronger shaping and quality-scaled terminal reward (100 → 200 for perfect landing)
- [x] Implemented as `calculateRewardBreakdown()` returning named components; scalar `calculateReward` is a thin wrapper (Sprint 2.6 ready to consume the breakdown)
- [x] State vector expanded 8 → 11 dims: vertical acceleration, ground proximity, approach velocity; angular velocity (dim 5) fixed from hardcoded 0
- [x] STATE_SIZE constant updated (propagates to DQN + PG model input shapes automatically)
- [x] Weight migration: IndexedDB metadata includes `stateSize`; mismatch logs warning and triggers fresh retrain

**Part B — Prioritized Experience Replay ✅**
- [x] `SumTree` data structure (80 LOC, O(log N) sampling, 7 unit tests)
- [x] Replaced RLAgent.memory flat array with PER buffer
- [x] TD-error tracking with priority updates after each trainBatch
- [x] Importance-sampling weights computed with beta annealing (0.4 → 1.0 over 100 episodes)

**Part C — Hyperparameter polish + wider network ✅ / true Dueling DQN ⏸ deferred**
- [x] Network widened 64 → 128 units per hidden layer (captures most of Dueling's capacity benefit without TF.js functional-API complexity)
- [x] Batch size 64 → 128, learning rate 0.0005 → 0.001, epsilon decay 0.995 → 0.99, target network update every 200 steps (was 500)
- [ ] True Dueling DQN (split value/advantage streams) — deferred to backlog; would require switching from Sequential to functional API

**Exit question:** Does watching the DQN learn feel like watching something figure it out, or like watching a random number generator get lucky?

---

### Sprint 3 — Mission Replay Archaeology — split into A (MVP) + B (hazard-faithful)

**Part A — Replay + fork-on-keypress ✅ COMPLETE**
- [x] AI Theater records DQN episode inputs + trajectory positions (rolling buffer of last 10)
- [x] Click an episode on the reward chart to select it
- [x] "REPLAY & FORK" button launches the episode in the live game, AI driving the lander
- [x] Press T during replay to take over controls from that exact frame
- [x] AI's remaining trajectory renders as ghost trail after fork
- [ ] Post-landing score comparison (deferred to Part B — AI reward / player score axes aren't directly comparable; needs design)

**Part B — Hazard-faithful fork + frame scrubber (deferred, see backlog):**
- [ ] Serialize Alien / GravityStorm / Wind / Physics timer state so forked runs recreate the AI's exact world
- [ ] Frame-level scrubber on episode timeline for arbitrary fork point (not just "press TAB during playback")
- [ ] Keyframe system (every 60 frames) so scrubbing is instant rather than a full replay

**Exit question:** Is "can I beat the AI from here?" a compelling loop?

---

### Sprint 4 — Multi-World Transfer Learning — split into A (MVP) + B (polish)

**Part A — Extra worlds + transfer visualization ✅ COMPLETE**
- [x] Extend GravityPresets.ts with Europa (1.315), Titan (1.352), Asteroid (0.25)
- [x] Train AI on Moon, drop it on other worlds, watch it adapt (or fail)
- [x] Transfer learning visualization: overlay Moon-trained vs fresh policy curves in AI Theater
- [x] Zero-G already present as existing opt-in preset

**Part B — Deferred (see backlog):**
- [ ] Per-world terrain generation parameters (roughness, color palette, pad style)
- [ ] Per-world background tint / sky colors to make worlds visually distinct
- [ ] Procedural audio per world (Mars hiss, Europa ice creak, Jupiter radio noise)

**Exit question:** Does watching the AI panic on Jupiter teach you about distribution shift?

---

### Sprint 5 — Historic Missions — split into A (foundations + landings) + B (specialized types)

*CEO-reviewed 2026-04-15 in SCOPE EXPANSION mode. Plan at `.plans/sprint-5-apollo.md`. CEO plan at `~/.gstack/projects/kenlacroix-moonlander-enhanced/ceo-plans/2026-04-15-sprint-5-apollo.md`. Reframed from "Apollo Recreations" to "a playable museum of lunar exploration" spanning 1966 (Luna 9) through 2028 (Artemis III).*

**Part A — Foundations + Apollo landings + Artemis + chatter + share card ✅ COMPLETE (v0.5.7.0)**
- [x] `HistoricMission` discriminated union type on `kind: "landing" | "survive" | "auto-landing"`
- [x] Fact-sheet data files: `apolloMissions.ts`, `artemisMissions.ts` (hybrid LLM+fact source of truth; offline fallback renders facts directly)
- [x] 3 Apollo landings (11, 15, 17) + Artemis III projection, each with DifficultyConfig + fact sheet
- [x] Apollo LM + Artemis LM lander types
- [x] Terrain `specialFeature` hook: rille (Apollo 15 / Hadley) and valley (Apollo 17 / Taurus-Littrow)
- [x] Title screen HISTORIC MISSIONS row + mission select
- [x] `Game.missionMode` orthogonal to `lander.status`, defaults to `"landing"`
- [x] MissionBriefing extended with `historicalContext` parameter; offline fallback renders fact sheet
- [x] Moment-markers as mission-scoped Achievement IDs (apollo-11-margin, apollo-11-clean, hadley-rille, taurus-littrow, shackleton-rim)
- [x] Shareable "margin vs historic reference" scorecard (extends FlightRecorder canvas-card)
- [x] `MissionChatter.ts` — event-triggered radio callouts during descent (altitude 1000m/200m, fuel 15%/5%, drift, landing, crash); rule-based offline fallback
- [x] Regression test pinning non-historic terrain determinism (seeds 1969, 4217, 7001 produce byte-identical output when `specialFeature` unset)

**Part B — Specialized mission types (~7h human / ~55 min CC, follow-up PR):**
- [ ] Apollo 13 "Survive" — non-landing loop-around mission, simplified 2D return-trajectory scoring via `missionMode === "survive"` branch, with `MAX_FLIGHT_DURATION` timeout
- [ ] Luna 9 (1966 Soviet first soft landing) — `missionMode === "auto-landing"`, autopilot-driven, player spectates
- [ ] Luna-9 lander type entry

**Deferred (backlog):**
- [ ] Apollo 12, 14, 16; Luna 16 (sample return); Chang'e 3/4/5; SLIM 2024; Chandrayaan-3
- [ ] Satellite-accurate terrain from LROC heightmaps
- [ ] Real-trajectory overlay vs player flight path
- [ ] Polish bundle: NASA crew photos, historical landing quotes, Apollo DSKY HUD skin, era-appropriate audio tint, lunar-contact beep

**Exit question:** Would a space nerd share this with every space nerd they know?

---

### Sprint 6 — WebGL Visual Upgrade — L (~3-4hr CC)
- [ ] Extract formal IRenderer interface from CanvasRenderer.ts
- [ ] PixiJS v8 WebGLRenderer implementing IRenderer (keep 2D-focused, ThreeJSAdapter later)
- [ ] Bloom/glow shader on thruster plume and landing pad beacons
- [ ] Heat distortion shader behind engine bell
- [ ] Normal mapping on terrain surface
- [ ] Dynamic sun lighting per mission
- [ ] Screen shake on crash
- [ ] Canvas fallback when WebGL unavailable

**Exit question:** Does the WebGL version make you go "whoa" compared to Canvas?

---

### Sprint 7 — Peer-to-Peer Multiplayer — M (~2hr CC)
- [ ] Audit physics code for determinism (no Math.random outside seeded PRNG)
- [ ] WebRTC DataChannel, zero server (copy-paste offer/answer or PeerJS relay)
- [ ] Same seed = same terrain, sync input frames only (~20 bytes/sec)
- [ ] Opponent renders as translucent ghost lander
- [ ] Daily challenge seed (client-side, UTC day as seed)

**Exit question:** Does racing a real human change how the game feels?

---

### Sprint 8 — 3D Cockpit Mode — XL (~5-6hr CC)
- [ ] Three.js renderer with ThreeJSAdapter (translates 2D IRenderer calls to scene graph)
- [ ] Lunar surface mesh from terrain seed (heightmap to geometry)
- [ ] Low-poly LM model, Earth in skybox
- [ ] Cockpit first-person view, chase cam, orbital zoom-out
- [ ] Volumetric thruster plume particles

**Exit question:** Does 3D mode feel like a different game or a gimmick?

---

### Sprint 9 — AI Visual Layer — M (~2hr CC)
- [ ] TF.js neural style transfer for Painterly and Neon Future skins (replay-mode filter)
- [ ] AI terrain textures via image gen API, cached by seed
- [ ] Generative skyboxes per mission seed

**Exit question:** Do AI visuals make you replay just to see what it generates?

---

### Sprint 10 — Education + Platform (core) — M (~2hr CC)
- [ ] Education mode: real-time force vector overlays, physics lesson panel
- [ ] Mission SDK: JSON schema for community missions

**Exit question:** Has this grown beyond a solo project? Is that good or bad?

---

**Total estimated CC time:** ~28-32 hours across all sprints

---

### Graphics Constants and Config
```typescript
// src/utils/constants.ts — graphics section
export const GRAPHICS = {
  // Renderer backend — swap to 'webgl' for Phase 2
  BACKEND: 'canvas' as 'canvas' | 'webgl' | 'three',

  // Particle counts (Canvas vs WebGL limits differ)
  MAX_THRUSTER_PARTICLES: 80,
  MAX_EXPLOSION_PARTICLES: 200,
  MAX_DUST_PARTICLES: 60,

  // Lighting
  SUN_ANGLE_MIN: 15,       // degrees above horizon
  SUN_ANGLE_MAX: 45,
  SHADOW_OPACITY: 0.6,
  SPOTLIGHT_RADIUS: 120,   // px — lander ground spotlight

  // Bloom shader
  BLOOM_STRENGTH: 1.4,
  BLOOM_THRESHOLD: 0.6,
  THRUSTER_GLOW_COLOR: 0xff6600,
  PAD_BEACON_COLOR: 0x00ff88,

  // Style transfer
  STYLE_TRANSFER_SIZE: 256,  // resize canvas to this before inference
  STYLE_TRANSFER_FPS: 10,    // target fps in styled replay mode

  // Parallax layers (scroll multipliers)
  STAR_LAYER_1_SPEED: 0.01,
  STAR_LAYER_2_SPEED: 0.03,
  STAR_LAYER_3_SPEED: 0.06,
  EARTH_PARALLAX_SPEED: 0.008,
};
```

---

### Renderer Architecture — How the Swap Works
`Renderer.ts` is a thin interface that both `CanvasRenderer` and `WebGLRenderer` implement:
```typescript
interface IRenderer {
  drawTerrain(points: Vec2[], pads: LandingPad[]): void;
  drawLander(state: LanderState): void;
  drawParticles(particles: Particle[]): void;
  drawBackground(camera: Camera): void;
  drawHUD(state: GameState): void;
  clear(): void;
}
```
Game logic calls `renderer.drawLander()` — it never knows or cares whether Canvas or WebGL is underneath. This means upgrading from Phase 1 to Phase 2 graphics is a config change, not a rewrite.

---

## Development Principles
- **Vibe first, refactor later** — get it running, then clean it up
- **One file per system** — keep concerns separated from the start
- **Constants file is king** — all physics tuning in `constants.ts`, never magic numbers in logic
- **Test physics math** — the rest can be eyeballed, but vector math deserves unit tests
- **No premature optimization** — Canvas 2D is fast enough for this at 60fps
- **Comment the physics** — future you will not remember why you picked 1.62

---

## Key Constants (starting values, tune freely)
```typescript
// src/utils/constants.ts
export const GRAVITY = 1.62;           // m/s² lunar surface gravity
export const THRUST_FORCE = 5.0;       // m/s² thrust acceleration
export const ROTATION_SPEED = 3.0;     // degrees/frame
export const MAX_LANDING_SPEED = 2.0;  // m/s vertical — above this = crash
export const MAX_LANDING_ANGLE = 10;   // degrees from vertical — above = crash
export const STARTING_FUEL = 1000;     // arbitrary fuel units
export const FUEL_BURN_RATE = 0.5;     // units/frame while thrusting
export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;
export const TARGET_FPS = 60;
```

---

## Known Gotchas

### requestAnimationFrame & Timing
- **Background tab throttling** — browsers throttle `requestAnimationFrame` to ~1fps when the tab is hidden. If your game loop uses frame deltas naively, physics will explode when the tab comes back into focus after a long pause. Always clamp your delta time: `const dt = Math.min(delta, 50)` (50ms = 20fps floor) before passing it to physics.
- **Frame delta accumulation** — don't use `delta` directly as a physics step. Use a fixed timestep accumulator pattern: accumulate real time, step physics in fixed 16.67ms chunks, interpolate rendering. Prevents physics from being framerate-dependent.
- **First frame spike** — the very first `requestAnimationFrame` callback often has a huge delta (300-500ms) because of JS engine warmup. Ignore the first frame entirely.

### PixiJS Versioning
- **v7 vs v8 are breaking** — PixiJS v8 (released 2024) has a completely different API from v7. Most tutorials online are v7. Pick one and pin it in `package.json`. This project uses **PixiJS v8** — do not follow v7 examples.
- **WebGL context loss** — browsers can revoke the WebGL context (e.g. too many tabs, GPU driver reset). PixiJS has a `contextlost` / `contextrestored` event — handle it or the game will silently freeze.
- **Canvas fallback** — PixiJS auto-falls back to Canvas if WebGL isn't available. This is usually fine but means shader effects silently disappear. Add a console warning when fallback is detected.

### TensorFlow.js
- **Model loading is async and slow** — TF.js models can be 5-50MB. Never block the game start on model loading. Load models in the background after the game is playable, show a non-blocking "AI loading..." indicator.
- **First inference is always slow** — TF.js JIT-compiles on the first `model.predict()` call. Run one dummy inference on load to warm up the GPU before the player triggers it.
- **Memory leaks** — TF.js tensors must be manually disposed with `tensor.dispose()` or `tf.tidy()`. Forgetting this in a game loop causes memory to grow until the tab crashes. Wrap all inference in `tf.tidy(() => { ... })`.
- **Mobile GPU limits** — style transfer at 512px is too heavy for most mobile GPUs. Downscale to 256px for mobile, detect via `navigator.hardwareConcurrency < 4`.

### Claude API
- **CORS in browser** — the Anthropic API supports browser-side calls but requires your API key to be exposed in client-side JS. For a personal/portfolio project this is acceptable. For anything public-facing, proxy through a serverless function (Vercel, Cloudflare Workers) to keep the key server-side.
- **Streaming responses** — use streaming (`stream: true`) for mission control commentary so text appears word-by-word rather than all at once after a 2-3 second wait. Much better UX.
- **Rate limits** — the API has per-minute token limits. Mission briefings are fine. Don't call the API on every frame or every landing — debounce to once per mission start/end.

### localStorage
- **5MB browser limit** — ghost replays and AI textures can add up fast. Implement a cache eviction strategy: keep only the last 10 ghosts and last 20 textures, evict oldest first.
- **Serialization cost** — `JSON.stringify` on large ghost replay arrays (thousands of input frames) can cause frame drops. Serialize asynchronously using `setTimeout` or a Web Worker.
- **Private/incognito mode** — localStorage throws in some private browsing modes. Always wrap in try/catch and degrade gracefully.

### Vite + GLSL
- **Import GLSL as raw string** — add this to `vite.config.ts`:
  ```typescript
  assetsInclude: ['**/*.glsl']
  ```
  Then import shaders as: `import bloomShader from './shaders/bloom.glsl?raw'`
- **Hot module replacement breaks WebGL** — Vite's HMR can cause WebGL context issues during development. If the canvas goes blank after a hot reload, a full page refresh fixes it. This is a dev-only issue.

### General Browser
- **Audio autoplay policy** — browsers block audio until the user interacts with the page. Initialize Web Audio API only inside an input event handler (click, keydown). First thruster sound on first keypress is fine; background music on page load will be silently blocked.
- **Canvas resolution vs CSS size** — always set `canvas.width` and `canvas.height` to physical pixels (multiply by `window.devicePixelRatio`) and CSS size separately. Failing to do this makes everything blurry on retina/HiDPI displays.

---

## Git Conventions

### Branch Strategy
```
main          ← always playable, never broken
dev           ← active development, merges into main when stable
phase-1       ← Phase 1 feature work, merges into dev
phase-2       ← Phase 2 feature work (start after Phase 1 ships)
graphics-webgl ← WebGL upgrade spike (can run parallel to game phases)
ai-rl-agent   ← RL agent work (isolated, heavy experimentation)
```

## Health Stack

- typecheck: tsc --noEmit
- lint: npx biome check .
- test: npx vitest run
- deadcode: npx knip

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
