# Changelog

All notable changes to MoonLander Enhanced will be documented in this file.

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
