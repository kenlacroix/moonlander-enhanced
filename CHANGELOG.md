# Changelog

All notable changes to MoonLander Enhanced will be documented in this file.

## [0.5.3.0] - 2026-04-15

### Added
- Speedrun timer: live flight time in top-right HUD (MM:SS.SS). Tracks best landing time per seed (stored with leaderboard entries). Timer flashes green while beating the current best for that seed.

## [0.5.2.0] - 2026-04-15 (PR #14)

### Added
- Daily Challenge: new title-screen option using today's UTC date (`YYYYMMDD`) as the terrain seed — everyone plays the same map each day. Reuses the existing seed-keyed leaderboard so daily scores bucket by date automatically. No backend required.
- Post-crash flight analysis: "FLIGHT ANALYSIS" panel after crashes with one specific, actionable tip citing actual telemetry numbers (impact speed vs limit, angle, fuel). Uses the configured LLM when available; falls back to a deterministic rule-based analysis so the feature works offline.
- ESC-to-menu discoverability: surfaced `ESC MENU` in the in-flight controls line.

## [0.5.1.0] - 2026-04-15

### Fixed
- Stabilize DQN training loop and auto-enter agent replay after training completes.
- Prevent concurrent `TF.js fit()` calls during RL training (data races on shared model state).
- Gate "Watch AI's best run" button behind minimum 20 episodes so viewers don't watch a random-policy agent.
- Rebalance RL reward function to prevent declining learning curve.

### Added
- Persist RL model weights across sessions via IndexedDB.
- Wind and fuel-leak hazard unit tests.

## [0.5.0.0] - 2026-04-14 (Sprint 1 + Sprint 2)

### Added
- AI Theater MVP (Sprint 2): split-screen player-vs-AI training view on the same terrain seed. Live reward curve, episode counter, "Watch AI's best run" button, post-landing human-vs-AI comparison card, optional AI narration of autopilot decisions via LLM.

### Changed
- Decompose `Game.ts` into focused modules (Sprint 1): `GameLoop`, `GameState`, `CollisionHandler`, `StateHandlers`, `PhysicsManager`, `GameRenderer`, `LLMIntegration`. `Game.ts` now an orchestrator under 400 lines.
- Extract reusable `HeadlessGame` class from `TrainingLoop` so training and gameplay share the same simulation code.

## [0.4.7.0] - 2026-04-13

### Added
- Annotated autopilot: press A during autopilot flight to visualize AI decision-making. Shows thrust vector (green arrow), gravity vector (red arrow), target pad indicator (dotted circle + line), current mode label (NAVIGATING, MID DESCENT, CLOSE APPROACH, FINAL APPROACH), altitude readout, and altitude zone markers.

## [0.4.6.0] - 2026-04-13

### Added
- Physics sandbox: adjustable gravity on free-play mission select. Moon (1.62 m/s²), Mars (3.72), Earth (9.81), Jupiter (24.79), Zero-G (0.0). Cycle with left/right arrows. Color-coded HUD indicator. Autopilot and gravity storms adapt to selected gravity.

## [0.4.5.0] - 2026-04-13

### Added
- Achievement badges: 8 unlockable badges with toast notifications. First Contact, Textbook (perfect landing), Deadstick (no thrust), Mission Control (full campaign), Human Spirit (beat the AI), Close Encounter (survive aliens), Fuel Miser (>80% fuel), Archaeologist (scan all artifacts). Persisted in localStorage.

## [0.4.4.0] - 2026-04-13

### Added
- Terrain Editor: draw custom terrain from the title screen. Click to add control points, drag to move them, right-click to delete. Catmull-Rom spline interpolation for smooth curves. Place 1-2 landing pads with P key. Share custom terrain via URL with S key (`?custom=<base64>`). Ctrl+Z to undo.
- Terrain Crevices: sharp V-shaped dips carved into procedural terrain on harder missions. Campaign mission 4 has 2 crevices, mission 5 has 3. Configurable via `crevices` in DifficultyConfig.

## [0.4.3.0] - 2026-04-13

### Added
- Multi-Lander Relay Mode: press L on free-play mission select to toggle. Land 3 landers sequentially on the same terrain. Each spawns 100 units above the previous lander's final position. Combined score at the end. 1.5-second pause between landers with status display.

## [0.4.2.0] - 2026-04-13

### Added
- Gravity Storms: periodic gravity anomalies on ~20% of free-play missions and campaign missions 3-5. Gravity doubles for 5 seconds, then halves for 3 seconds, then normalizes. Repeats every 20-30 seconds. Cosmetic terrain wobble during anomalies. Red HUD warning shows active multiplier. Fully deterministic for ghost replay compatibility.

## [0.4.1.1] - 2026-04-13

### Changed
- Decompose Game.ts (920 lines) into 3 focused modules: GameRenderer.ts (rendering dispatch), LLMIntegration.ts (mission briefings, commentary, artifact scanning), and Game.ts (orchestrator). No gameplay changes.

## [0.4.1.0] - 2026-04-13

### Added
- Lunar Archaeology Mode: historical Apollo artifacts (flags, rover tracks, descent stage debris, boot prints, memorial plaques) scattered on ~40% of terrains. Land near one to scan it and learn a real historical fact via LLM, or see a hardcoded fallback offline. 5 artifact types with unique canvas sprites. Amber glow when unscanned, dims to gray after scanning.

## [0.4.0.0] - 2026-04-13

### Added
- Share any terrain with a link: `?seed=1969` in the URL loads that exact map. Address bar updates live when you launch a mission.
- PWA support: manifest + service worker with network-first caching. Installable on mobile, playable offline after first load.
- Embed mode: `?embed=1` skips the title screen and auto-restarts on the same seed. Drop an iframe on your portfolio or blog.
- Retro vector graphics skin: press V to toggle. Green phosphor wireframe lander with scanline overlay. 1979 arcade aesthetic.
- Ghost sharing: press G after landing to download your ghost run as a `.json` file. Press I on mission select to import a ghost file. Imported ghosts replay on the matching seed.

## [0.3.0.0] - 2026-04-13

### Added
- Rule-based autopilot: press P to toggle mid-flight. PID-style guidance finds nearest pad, manages descent rate across four altitude zones.
- DQN reinforcement learning agent: trains in-browser via TensorFlow.js. 8-dimensional state space, 4 discrete actions, experience replay with target network.
- AI Training mode: accessible from title screen. Live reward graph (raw + moving average), episode counter, exploration rate display. Press Enter to watch the trained agent play.
- Agent replay viewer: watch the trained AI attempt a landing at normal speed with full rendering.
- Multi-provider LLM integration: supports Anthropic (Claude), OpenAI (GPT), and any OpenAI-compatible API. Settings screen accessible with S key on title. API key stored in localStorage only.
- AI mission briefings: NASA radio-style narrative streams word-by-word during first 5 seconds of flight. Cached per seed.
- Mission control commentary: post-landing/crash reactions based on speed, angle, and fuel. Streaming text.
- Adaptive difficulty: free-play missions adjust based on leaderboard history. First play gets EASY (extra fuel, wider pads). Consistent high scores trigger HARD/EXPERT.
- Procedural soundtrack: three-layer adaptive music. Tritone drone (B1+F2), tension sweep with lowpass filter, shimmer with LFO tremolo. Builds as altitude drops. Resolves to consonance on landing, dissonance on crash.
- Alien mischief system: deterministic UFO entities orbit the lander and periodically interfere. Four effects: fuel siphon, controls reversed, thrust reduced, drag. Tractor beam visual, HUD warning, audio cue. ~30% of free-play missions, guaranteed on campaign 4-5.

## [0.2.0.0] - 2026-04-13

### Added
- Title screen with Free Play and Campaign mode selection
- 10 free-play missions with named lunar locations and fixed terrain seeds
- 5-mission campaign with escalating difficulty (terrain roughness, pad sizes, fuel limits, wind)
- Mission select screen with best scores per mission and campaign lock/unlock progression
- Sound design: procedural thruster hum, crash explosion, success jingle, low fuel warning beep (Web Audio API, no audio files)
- Ghost replay system: records inputs, saves best run per seed to localStorage, replays as translucent blue wireframe lander
- Touch/mobile controls: three-zone layout (left rotate, center thrust, right rotate) with visual overlay, tap-to-navigate menus
- Wind system: oscillating horizontal force with gust envelope, strength varies per mission, shown on HUD
- Three lander types (Eagle/Atlas/Sparrow) with different thrust, fuel, mass, and rotation characteristics
- Persistent leaderboard: top 5 scores per seed with dates, shows rank on landing ("NEW BEST!", "#2", etc.)
- Session telemetry: records altitude, speed, and fuel 4x/second, displays altitude-over-time chart on post-flight screen
- Fuel leak random event: 10% chance per mission (deterministic), drains fuel at 30% burn rate, "LEAK!" warning on HUD

### Fixed
- Wind no longer applies by default on free-play missions (was silently adding strength-20 wind)
- Ghost replay no longer advances during post-flight screen (was exhausting frame buffer before restart)
- Input state consumed once per frame instead of per physics step (fixes dropped restart/menu inputs)

## [0.1.0.0] - 2026-04-13

### Added
- Playable Moon Lander game with real lunar gravity (1.62 m/s²), thrust, and rotation controls
- Procedural terrain generation using midpoint displacement with seeded RNG
- Landing pad placement with safe-landing detection (speed and angle thresholds)
- Crash detection on terrain and pads with explosion particle effects
- Telemetry HUD showing altitude, vertical/horizontal speed, fuel, and angle
- Thruster exhaust particle system with directional emission
- Landing dust burst on touchdown
- Parallax starfield background with 3 depth layers and Earth rise
- Keyboard controls (arrow keys for thrust/rotate, R to restart)
- Scoring system with fuel, speed, and angle bonuses
- Fixed timestep physics loop with delta-time capping
- Camera system with smooth follow and screen shake on crash
- 36 unit tests covering physics, vector math, terrain interpolation, collision, and angle normalization
- Biome linter and knip dead code detection
- Code health dashboard via /health

### Fixed
- Camera smoothing now uses framerate-independent exponential decay
- Position integration no longer bakes in 60fps assumption
- Angle normalization handles arbitrary rotation values correctly
- Landing pad detection uses center-point overlap instead of full containment
- Score angle bonus uses proper angle normalization
