# Changelog

All notable changes to MoonLander Enhanced will be documented in this file.

## [0.5.9.1] - 2026-04-18 (Sprint 5 Part B + Sprint 5.5 polish)

### Added
- **Luna 9 auto-landing mission.** Pick Luna 9 from HISTORIC MISSIONS and watch the first soft lunar landing (1966) play out. The autopilot flies, you spectate. `[P]` is gated off for the duration so you can't yank control mid-descent. Ships with a Luna-9 lander type carrying its own mass, thrust, and fuel profile.
- **Apollo 13 "Survive" mission.** No pad, no landing. Keep the crew alive long enough to come home. Success fires at the survive duration, a miss wipes you at the hard timeout. Score rewards fuel preservation, because conserving consumables IS the story of Apollo 13.
- **Mission-kind-aware chatter.** Radio callouts now respect whether you're landing, surviving, or spectating. Landing callouts stay on landing missions, so Apollo 13 doesn't yell "100 meters" at you mid-freefall.

### Changed
- **Shared and embedded links actually work on historic missions.** Sending a friend `?seed=<luna9>&embed=1` used to drop them into generic freeplay with the lander unpowered. Now it opens Luna 9 with the autopilot engaged and `[P]` gated off, identical to picking it from the menu. Non-historic seeds still route to freeplay.
- **Apollo 13 survive leaderboards route by mode.** Entries now honor the active flight's Authentic-vs-vanilla config for its leaderboard slot. Observable behavior unchanged today (Apollo 13 doesn't expose Authentic yet), but the routing is ready for when it does.

### Architecture
- **HistoricMission discriminated union.** `kind: "landing" | "survive" | "auto-landing"` on the mission type makes it a compile error for Apollo 13 to forget its survive duration or Luna 9 to skip autopilot setup.
- **`ERA_COLORS` fully adopted.** CanvasRenderer, FlightRecorder, and HUD consume the era-color module directly. No more `#ffb000` / `#00ccff` string literals in the render path.
- **Shared localStorage test polyfill.** Deduplicated from three test files (`authentic-regression`, `authentic-integration`, `ghost`) into `tests/helpers/localStorage.ts`.
- 273 → 279 tests passing. Six new tests pin the URL-seed routing contract (Luna 9 → auto-landing, Apollo 13 → survive, unknown seed → freeplay) and the survive-success leaderboard mode routing. Four new Sprint 5.5 coverage tests cover the master-alarm gate boundary, altitude-blackout boundaries, mission-briefing authentic cache partitioning, and ghost mode-scoped save overwrites. Seeds 1969, 4217, 7001 now pin byte-identical non-historic terrain.

### Deferred
- Apollo 13 and Luna 9 Authentic variants (era-specific mechanics for the new mission kinds).
- Leaderboard read hoist out of `renderMenu` hot path (`getBestScore` runs 2N times/frame; minor today, amplifies with mission count).
- Part B scaffolding dead code: `EllipseState`, `hazardMask`, `ELLIPSE_UPDATE_FRAMES` — populated for Artemis but never read.
- `/codex review` outside voice on this diff (blocked 2026-04-16 by account limit, reset 2026-04-20).

## [0.5.9.0] - 2026-04-17 (Sprint 5.5 Part A: Authentic Mode)

### Added
- **Authentic Mode toggle on historic missions.** Pick Apollo 11 / 15 / 17 / Artemis III on the HISTORIC MISSIONS screen and hit `A` to flip an era-accurate tech layer on or off. Preference sticks per-mission across sessions. Default is OFF — vanilla runs are byte-identical to before.
- **Apollo 11: the 1202 program alarm.** Somewhere in descent (seed-deterministic, between 3.3 and 8.3 seconds in), the AGC throws an executive overflow. Thrust input goes dead for 400ms, the HUD banner flashes amber (2.5 Hz, WCAG 2.3.1-compliant), and a synthesized warble plays. Fast descenders who are already below 150px AGL at the scheduled frame dodge it entirely — Apollo crews called that a lucky break.
- **Apollo 11/15/17: altitude blackout under 50 AGL.** Your altitude readout goes to `---` in the final meters, mirroring Armstrong landing with no callouts for the last 25 feet. First-frame "LOW-ALT READOUT UNAVAILABLE" primer so it reads as "this is the simulation" instead of "the game broke."
- **Apollo 15/17: master alarm cue.** Soft one-shot audio when the lander crosses 150 AGL. No input lockout — advisory only, like it was in the real stack.
- **Era captions and era colors.** HUD shows `AUTHENTIC 1969 TECH` in DSKY amber on Apollo, `AUTHENTIC 2028 TECH` in cyan on Artemis.
- **Pre-launch tutorial overlay.** First time you flip Authentic ON for a mission, a 3-card overlay on the mission-select screen primes you for analog instruments, AGC overflow, and the fuel-margin challenge. Dismissible with ENTER or ESC; 3-second auto-dismiss; never reappears for a mission you've already seen.
- **AUTHENTIC corner badge on share cards.** Flight reports from Authentic runs stamp an era-colored `AUTHENTIC 1969` or `AUTHENTIC 2028` corner badge.
- **Dual-track leaderboard on historic mission-select.** `BEST` and `AUTHENTIC` best scores render stacked, so you can see your two tracks side by side.
- **Era-flavored mission briefings.** With Authentic ON, the LLM briefing prompt shifts to emphasize era-tech context (2KB flight computer, discrete RCS, orbital LRO maps). Offline fallback appends an `eraOneLiner` drawn from verified mission facts.
- **prefers-reduced-motion support.** When the OS requests reduced motion, the 1202 banner renders as steady amber instead of a strobe.

### Changed
- **Ghost replays partition by mode.** Authentic ghosts don't overwrite vanilla bests on the same seed. Legacy ghosts (pre-5.5) load as vanilla.
- **Leaderboard records partition by mode.** Same seed, separate slots for `vanilla` and `authentic`. Pre-5.5 records migrate lazily on first vanilla write.
- **Mission briefing cache partitions by mode.** Toggling Authentic returns a fresh briefing, not the cached opposite-mode one.
- **Fork replays are vanilla-locked.** Captured AI episodes replay without Authentic mechanics regardless of your current preference, so the physics stays faithful to the original capture.

### Architecture
- New module `src/game/AuthenticMode.ts`: pure functions, typed state machine, zero-allocation OFF path. Verified byte-identical via regression test — the filter returns the same input reference when inactive, so Authentic cannot perturb vanilla flights.
- 3 IRON RULE regression tests (OFF byte-identical, fork-replay vanilla-lock, 1202 skip-on-collision) plus unit, integration, and ghost-mode-isolation coverage. 242 tests green (up from 226).
- New `src/utils/a11y.ts` with cached `prefersReducedMotion()` helper for the hot render path.

### Deferred
- Artemis III hazard-aware landing ellipse (Part B).
- Apollo 13 "Survive" and Luna 9 auto-landing Authentic variants (Part B).
- Contextual cockpit visual layer (scope-expansion idea captured in `.plans/sprint-5.5-authentic-mode.md`; not in this release).
- Codex outside-voice review (account reset window open, listed in TODOS for follow-up).
- Test coverage gaps for master-alarm, blackout positive path, briefing cache-key, ghost overwrite (listed in TODOS).

## [0.5.8.3] - 2026-04-16 (Sprint 2.6 Part C: Tutorial + Compact Toggle + Polish)

### Added
- First-run 3-card inline tutorial inside the AI Theater panel — explains what AI VISION, the reward curves, and the algorithm cards are showing. Dismiss per-card (✕) or all at once (GOT IT). Shown once, remembered via `moonlander-ai-theater-tour-seen`.
- Compact-mode toggle for AI Theater. Press `?` (or the `?` button next to EXPLAIN) to hide AI VISION + reward breakdown and restore the pre-2.6 dense layout. Persists via `moonlander-ai-theater-compact`. Default: expanded.
- Hover tooltips on AI VISION bars — plain-language description of each state dimension plus the raw signed value.
- First-landing glow on the legend card for each agent — 3-second pulse in the agent's own color the first time it lands. Per-agent timer so overlapping firsts don't collide.

### Deferred
- E1 (RANDOM badge on exploratory actions) — needs plumbing the exploration/exploitation branch from `RLAgent` through `AgentStats` to the panel. Left for a follow-up so Part C stays UI-only.

## [0.5.8.2] - 2026-04-16 (Sprint 2.6 Part B: Reward Breakdown Overlay)

### Added
- EXPLAIN button in the AI Theater header. Toggle it to reveal a reward breakdown for the last DQN episode — total, then the component contributions (terminal landing/crash, proximity, descent, speed, angle penalty, approach, time tax). Positives render green, penalties red. Now you can see *why* the agent's score moved.
- Preference persists across sessions via localStorage (`moonlander-explain-mode`). Off by default — new viewers still get the compact layout they saw before.

### Changed
- AI Theater now accumulates the per-component reward breakdown during DQN episodes by calling `calculateRewardBreakdown()` directly (single source of truth from Sprint 2.7). Non-DQN agents keep the scalar fast path.

## [0.5.8.1] - 2026-04-16 (Sprint 2.6 Part A: AI Theater Explain Mode)

### Added
- AI VISION strip in the AI Theater panel: 11 labeled bars showing the DQN's state vector in real time (ΔX to pad, altitude, speeds, angle, fuel, approach velocity, and the rest). Bars are centered at zero, sign-colored (green positive, red negative), and refresh at 2 Hz so it's readable as the agent plays.
- Plain-language algorithm descriptions under each legend entry — "Remembers 20,000 past attempts; replays them to learn" (DQN), "Doesn't remember — just adjusts after each full attempt" (Policy Gradient), and so on. No ML background needed to follow what's on the chart.

### Changed
- Consolidated `AGENT_LABELS` + `AGENT_COLORS` into a single `AGENT_META` registry with `{ label, color, description }` per agent kind. One source of truth for every place that renders an agent.

## [0.5.8.0] - 2026-04-16 (Sprint 2.7: Smarter DQN)

### Added
- DQN now actually learns from its failures. Prioritized Experience Replay samples surprising transitions (high TD-error) ~10x more often than mundane ones, so the agent focuses on its mistakes instead of the 19,999 "falling through empty space" frames that all look the same.
- Agent "sees" more: state vector expanded from 8 to 11 dimensions with vertical acceleration (is the agent braking?), ground proximity (how close is the dirt below me, not just the pad?), and approach velocity (am I heading toward the pad or drifting past it?). Angular velocity is now populated too, fixing a long-standing hardcoded `0`.
- Landing quality matters. Terminal reward now scales from +100 (messy but legal) to +200 (perfect landing — zero speed, upright, pad-centered). Agent learns to prefer *good* landings, not just any landing.

### Changed
- Reward shaping roughly doubled in strength so the gradient signal is meaningful before the first landing. New components: approach-velocity bonus and stronger angle penalty. Breakdown exposed via `calculateRewardBreakdown()` for Sprint 2.6's Explain Mode.
- DQN network widened from 64 to 128 units per hidden layer (more capacity, still fast).
- Faster hyperparameters: epsilon decay 0.995 → 0.99, target network soft-update every 200 steps (was 500), batch size 64 → 128, learning rate 0.0005 → 0.001.

### Architecture
- New `SumTree` data structure (O(log N) prioritized sampling, 80-line ring-buffer with unit tests).
- Module-level `prevVy` cache with `resetStateCache()` hook for episode boundaries (HeadlessGame.reset and AgentReplay.startAgentReplay call it).
- Saved IndexedDB weights from pre-Sprint-2.7 auto-detected via `stateSize` metadata; agent discards them, logs a console warning, and retrains from scratch. One-time cost; training is fast.

### Deferred
- True Dueling DQN architecture (split value/advantage streams) — parked as TODO. The wider network (128 units) captures most of the capacity benefit without switching to TF.js functional API. True dueling follow-up PR if needed.
- Double DQN, n-step returns, curriculum learning — all tracked as post-Sprint-2.7 RL improvements.

## [0.5.7.0] - 2026-04-15 (Sprint 5 Part A)

### Added
- **HISTORIC MISSIONS** title-screen row. Pick it to see Apollo 11 (Sea of Tranquility), Apollo 15 (Hadley Rille), Apollo 17 (Taurus-Littrow), and Artemis III (Shackleton crater rim) — each with verified facts, mission-tuned fuel/altitude, and an authentic LM lander variant.
- Mission control radio chatter during descent on historic missions. Triggered by altitude crossings (1000m, 200m), fuel thresholds (the famous "30 seconds" callout at <5%), horizontal drift, landing, and crash. Streams via your configured LLM if you have one; falls back to authentic rule-based callouts so it works with no API key.
- Briefings for historic missions are locked to the verified fact sheet — the LLM is told to use only the facts provided so it never hallucinates a date or crew member. With no API key, the briefing renders the fact sheet directly.
- "Margin vs Armstrong" comparison on the shareable flight report card. Press F after a historic landing to download a card showing your fuel margin vs the historical reference (e.g. Armstrong's famous ~22-second margin on Apollo 11).
- Mission-scoped achievements: ARMSTRONG MARGIN (land Apollo 11 with under 3% fuel), EAGLE TOUCHDOWN (clean Apollo 11 landing), HADLEY RILLE, VALLEY OF THE LAST, SOUTH POLE. Each fires only on its own mission — landing tight on free play won't unlock them.
- Two new Apollo-flavor terrain features: rille (a narrow V-trench carved between pads, used by Apollo 15) and valley (raised mountain walls at world edges, used by Apollo 17). Both preserve pad heights so they never make landings impossible.
- Apollo LM and Artemis LM lander variants (heavier, more authentic descent stages).

### Changed
- `DifficultyConfig` accepts an optional `specialFeature: "rille" | "valley"` post-pass. Existing seeds without it produce byte-identical terrain (regression-tested).
- `Game.missionMode` is now an orthogonal field to `lander.status`, defaulting to "landing". Sprint 5 Part B (Apollo 13 "Survive", Luna 9 auto-landing) will use the other kinds.

### Architecture
- `HistoricMission` is a TypeScript discriminated union on `kind: "landing" | "survive" | "auto-landing"` so missing-field bugs surface at compile time.
- New `MissionChatter` debounces each event so each fires at most once per flight, and caps concurrent in-flight LLM requests at 1 to keep the main thread responsive.

## [0.5.6.1] - 2026-04-15

### Fixed
- AI Theater UI no longer freezes during training. Three fixes: yields to the browser 3x more often per episode (`STEPS_PER_TICK` 50→15), DQN now fits every 12 steps instead of every 4 so TF.js doesn't saturate the main thread, and the training loop is wrapped in try/catch so a single episode failure doesn't silently halt the round-robin.
- Policy Gradient agent was silently failing every episode since 0.5.4.0 with "sample weight is not supported yet." TF.js `Sequential.fit()` doesn't accept the `sampleWeight` option. Rewrote PG to use `optimizer.minimize(lossFn)` with a manual REINFORCE loss (`-mean(advantage * log π(a|s))`). Now the policy gradient curve in AI Theater actually moves.
- AI Theater's DQN checkpoints are now scoped by gravity preset (`${seed}-${preset}`). Previously, training seed N on Moon then on Jupiter resumed Jupiter from Moon weights. Worse, running AI Theater on Jupiter with seed 1969 was overwriting the canonical Moon baseline the transfer agent depends on.
- Fork replay now locks to Moon gravity + bypasses adaptive difficulty modifiers so the canned AI inputs actually reproduce the recorded trajectory (previously diverged on EASY/HARD/EXPERT seeds or after the player picked a non-Moon preset).
- Chart click rejects out-of-buffer episode selections instead of silently picking the closest buffered episode, so "REPLAY & FORK" launches the run you actually clicked.

## [0.5.6.0] - 2026-04-15 (Sprint 4 Part A)

### Added
- Multi-world transfer learning (Part A): three new gravity presets — Asteroid (0.25 m/s²), Europa (1.315), Titan (1.352) — alongside the existing Moon / Mars / Earth / Jupiter / Zero-G. AI Theater now passes the selected preset into its headless simulations, so the agents actually train under the current world's gravity.
- Transfer-learning slot in AI Theater: when you launch AI Theater on any non-Moon world, a fourth DQN joins the round-robin — it loads the Moon-baseline weights (seed 1969) and keeps a floor exploration rate, then tries to adapt. The panel draws its curve in pink alongside the fresh DQN / PG / Random lines so the "Moon strategy crashes on Jupiter, then adapts" moment is visible.
- World label header in the AI Theater panel (e.g. `WORLD: EUROPA · g=1.315`), colored by preset.

### Changed
- `getDefaultPreset()` still returns Moon, but by name lookup now that it's no longer the first entry in the preset list.

## [0.5.5.0] - 2026-04-15 (Sprint 3 Part A)

### Added
- Mission Replay Archaeology (Part A): AI Theater records the DQN's last 10 episodes (inputs + trajectory). Click any point on the DQN reward curve to pick an episode, then hit "REPLAY & FORK" to launch it in the live game with the AI driving. Press **T** at any moment to take over controls. The AI's remaining trajectory renders as a blue dashed ghost trail after the fork, so you can see where the AI would have gone versus where you take the run.
- Hazard-faithful forks (alien/storm/wind state sync + frame-level scrubber) tracked as Sprint 3 Part B in backlog — current implementation disables hazards during replay so the AI's canned inputs reproduce its training-sim trajectory.

## [0.5.4.0] - 2026-04-15 (Sprint 2.5)

### Added
- RL algorithm comparison: AI Theater now runs three agents round-robin on the same terrain — DQN, Policy Gradient (REINFORCE), and a random baseline. Three colored learning curves on the same chart make the algorithmic differences visible at a glance.
- Shared `Agent` interface + `AgentEnv` module so new algorithms drop in without changing the training loop.

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
