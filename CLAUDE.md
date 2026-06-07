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
- **Renderer:** HTML5 Canvas 2D (default) + PixiJS v8 WebGL (opt-in via `?renderer=webgl`)
- **Renderer Phase 4 (optional):** Three.js — full 3D lunar surface mode
- **Game loop:** Custom requestAnimationFrame loop (no heavy framework)
- **Physics:** Custom — real lunar gravity (1.62 m/s²), rotational dynamics, rigid-body v3
- **AI gameplay:** TensorFlow.js — DQN + Policy Gradient agents, in-browser training
- **AI generative:** Claude API — mission briefings, commentary, coaching
- **Build tool:** Vite
- **Package manager:** npm
- **No game framework** (Phaser, etc.) unless complexity demands it

---

## Repo Structure
```
moonlander-enhanced/
├── CLAUDE.md
├── README.md
├── index.html
├── package.json / vite.config.ts / tsconfig.json
├── src/
│   ├── main.ts
│   ├── game/
│   │   ├── Game.ts / GameLoop.ts / GameState.ts
│   │   ├── Lander.ts / Physics.ts / Terrain.ts
│   │   ├── Particles.ts / Camera.ts / GravityStorm.ts
│   │   └── HeadlessGame.ts / TrainingLoop.ts
│   ├── render/
│   │   ├── CanvasRenderer.ts / WebGLGameplayRenderer.ts
│   │   ├── HUD.ts / Background.ts / GameRenderer.ts
│   │   └── menuLayout.ts
│   ├── graphics/
│   │   ├── shaders/ (bloom.glsl, heatwave.glsl, normalmap.glsl, scanline.glsl)
│   │   ├── LightingSystem.ts / TerrainRenderer.ts / LanderSprite.ts
│   │   ├── PlumeRenderer.ts / SkinManager.ts
│   │   └── skins/ (RetroVector.ts, Painterly.ts, NeonFuture.ts)
│   ├── ai/
│   │   ├── Autopilot.ts / RLAgent.ts / StyleTransfer.ts / TextureGen.ts
│   ├── api/
│   │   ├── MissionControl.ts / MissionBriefing.ts / MissionChatter.ts
│   │   └── CampaignChatter.ts
│   ├── data/
│   │   ├── apolloMissions.ts / artemisMissions.ts / lunaMissions.ts
│   ├── systems/
│   │   ├── Input.ts / Audio.ts / Telemetry.ts / SaveState.ts
│   │   ├── GamePreferences.ts / FlightRecorder.ts / Achievements.ts
│   └── utils/
│       ├── noise.ts / math.ts / constants.ts / GravityPresets.ts
├── public/assets/ (textures/, audio/, styles/)
└── tests/
```

---

## Game Concepts

### Core Loop
1. Lander spawns above procedurally generated lunar terrain
2. Player controls thrust (up) and rotation (left/right)
3. Goal: land on a designated flat pad at safe velocity and angle
4. Fuel is finite — waste it and you fall
5. Score: landing precision × fuel remaining × descent time × angle on touchdown

### Physics Model
- Gravity: 1.62 m/s² (real lunar surface)
- Thrust: force in lander's current facing direction
- Rotation: angular momentum with RCS propellant tank (physics v3) or simple damping (v2)
- Landing gates: vertical speed < 2 m/s, angle < 10°, angular rate < 8°/s (v3)
- `lander.physicsVersion: 2 | 3` — v2 frozen for ghost replay determinism

### Terrain Generation
- Midpoint displacement, seeded by mission number
- Same seed = same terrain (ghost racing, leaderboards, URL sharing)
- 5 archetypes: `rolling`, `crater-field`, `spires`, `mesa`, `flats`
- Historic missions pin byte-identical seeds (regression-tested)

### Lander State Machine
```
IDLE → FLYING → LANDING_SUCCESS | CRASH | OUT_OF_FUEL → FREEFALL → CRASH
```

---

## Renderer Architecture
`IGameplayRenderer` interface — game logic is renderer-agnostic:
```typescript
interface IGameplayRenderer {
  drawTerrain(points: Vec2[], pads: LandingPad[]): void;
  drawLander(state: LanderState): void;
  drawParticles(particles: Particle[]): void;
  drawBackground(camera: Camera): void;
  clear(): void;
}
```
Canvas 2D is default. WebGL (PixiJS v8 with bloom) is opt-in via `?renderer=webgl`. UI (HUD, menus) always stays on a separate Canvas 2D overlay.

---

## Roadmap

### Completed — Game Phases
- **Phase 1** ✅ — Playable core: Canvas, physics, terrain, HUD, particles, scoring
- **Phase 2** ✅ — Depth: seeds, ghosts, leaderboard, wind, multiple landers, campaign, audio
- **Phase 3** ✅ — AI layer: DQN/PG agents, TF.js, Claude API briefings + commentary
- **Phase 4** ✅ (mostly) — Polish: PWA, embed, URL seeds, ghost sharing, retro vector skin

### Completed — Bonus Features (shipped beyond roadmap)
UFOs, gravity storms, lunar archaeology, terrain editor, multi-lander relay, gravity sandbox, achievements, flight report card, adaptive soundtrack, speedrun timer, daily challenge, RL model persistence, post-crash coaching, WebGL bloom + sun angle + impact flash.

### Completed — AI Theater Sprints
- **Sprint 1** ✅ — Game.ts decomposed (GameLoop/GameState/Game, HeadlessGame)
- **Sprint 2** ✅ — AI Theater MVP: split-screen, live reward curve, episode counter
- **Sprint 2.5** ✅ — RL algorithm comparison: DQN vs PG vs random, 3 curves
- **Sprint 2.6** ✅ (v0.5.8.x) — Explain mode: AI VISION strip, reward breakdown overlay, tutorial cards
- **Sprint 2.7** ✅ (v0.5.8.0) — Smarter DQN: reward shaping, 11-D state, PER, wider network
- **Sprint 3** ✅ — Mission replay archaeology: episode select, REPLAY & FORK, T-takeover
- **Sprint 4** ✅ — Multi-world transfer: Europa/Titan/Asteroid, transfer curve overlay

### Completed — Content Sprints
- **Sprint 5** ✅ (v0.5.7.0, v0.5.9.1) — Historic missions: Apollo 11/15/17, Artemis III, Luna 9, Apollo 13 survive, `MissionChatter`
- **Sprint 5.5** ✅ (v0.5.9.0-1) — Authentic mode: per-era events (1202 alarm, blackout), dual leaderboard, era colors
- **Sprint 6** ✅ (v0.5.9.2-4) — WebGL upgrade: PixiJS bloom, per-mission sun angle, impact flash
- **Sprint 7.1** ✅ (v0.6.0.1, v0.6.1.0) — Level variety: palettes, 5 archetypes, random mission, hidden pads, audio motifs
- **Sprint 7.2** ✅ (v0.6.1.0, v0.6.2.x) — Rigid-body physics v3: angular momentum, RCS tank, per-mission tolerances
- **Sprint 7.3** ✅ (v0.6.3.x) — Free Play sandbox: v2 default + opt-in hazards, gravity-storm torque (v3 only)
- **Sprint 7.4** ✅ (v0.6.4.0) — Campaign narrative: Hoshi/Chen characters, 35 dialogue lines, clean-clear stars, campaign archetypes
- **Sprint 7.5** ✅ — Mobile quality: canvas scaling, touch HUD, AI Theater fallback, portrait overlay, audio gate
- **Sprint 7.6** ✅ (v0.6.5.0) — Animated portraits: Hoshi/Chen SVG busts, 3-frame mouths, right-anchored wrapped chatter panel (`CHATTER_PANEL`), color-blind-safe silhouettes

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

### Sprint 10 — Education + Platform — M (~2hr CC)
- [ ] Education mode: real-time force vector overlays, physics lesson panel
- [ ] Mission SDK: JSON schema for community missions

---

### Sprint 11 — Peer-to-Peer Multiplayer — M (~2hr CC)
- [ ] Audit physics for determinism (no Math.random outside seeded PRNG)
- [ ] WebRTC DataChannel, zero server (copy-paste offer/answer or PeerJS relay)
- [ ] Same seed = same terrain, sync input frames only (~20 bytes/sec)
- [ ] Opponent renders as translucent ghost lander

**Exit question:** Does racing a real human change how the game feels?

---

## Key Constants
```typescript
export const GRAVITY = 1.62;           // m/s² lunar surface gravity
export const THRUST_FORCE = 5.0;       // m/s² thrust acceleration
export const MAX_LANDING_SPEED = 2.0;  // m/s vertical
export const MAX_LANDING_ANGLE = 10;   // degrees from vertical
export const MAX_LANDING_ANGULAR_RATE = 8; // °/s (v3 only)
export const STARTING_FUEL = 1000;
export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;
export const TARGET_FPS = 60;
```

---

## Known Gotchas

### requestAnimationFrame & Timing
- **Background tab throttling** — clamp delta: `const dt = Math.min(delta, 50)` (50ms = 20fps floor)
- **Frame delta accumulation** — use fixed timestep accumulator, not raw delta, for physics
- **First frame spike** — ignore the first rAF callback (300-500ms warmup spike)

### PixiJS v8 (not v7 — APIs are breaking between versions)
- **WebGL context loss** — handle `contextlost`/`contextrestored` or game silently freezes
- **Canvas fallback** — PixiJS auto-falls back; add console warning so shader loss is visible

### TensorFlow.js
- **Model loading async** — never block game start; show non-blocking indicator
- **First inference slow** — run one dummy `model.predict()` on load to warm JIT
- **Memory leaks** — wrap all inference in `tf.tidy(() => { ... })`; tensors must be disposed
- **Mobile GPU** — downscale style transfer to 256px on mobile (`hardwareConcurrency < 4`)

### Claude API
- **CORS** — API key exposed client-side is acceptable for personal/portfolio; proxy for public
- **Streaming** — use `stream: true` for commentary; word-by-word UX vs 2-3s wait
- **Rate limits** — debounce to once per mission start/end, never per frame

### localStorage
- **5MB limit** — keep last 10 ghosts, last 20 textures; evict oldest first
- **Serialization cost** — `JSON.stringify` large arrays async (setTimeout or Worker)
- **Private/incognito** — always wrap in try/catch, degrade gracefully

### Vite + GLSL
- Import shaders as `import bloomShader from './shaders/bloom.glsl?raw'`
- Add `assetsInclude: ['**/*.glsl']` to `vite.config.ts`
- HMR breaks WebGL in dev — full page refresh fixes blank canvas

### General Browser
- **Audio autoplay** — init Web Audio API only inside an input event handler
- **Canvas HiDPI** — set `canvas.width/height` to physical pixels × `devicePixelRatio`

---

## Development Principles
- **Vibe first, refactor later** — get it running, then clean it up
- **Constants file is king** — all physics tuning in `constants.ts`, never magic numbers in logic
- **Test physics math** — vector math deserves unit tests; the rest can be eyeballed
- **Comment the physics** — future you will not remember why you picked 1.62

---

## Git Conventions

### Branch Strategy
```
main          ← always playable, never broken
dev           ← active development, merges into main when stable
```

## Health Stack
- typecheck: `tsc --noEmit`
- lint: `npx biome check .`
- test: `npx vitest run`
- deadcode: `npx knip`

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.

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

## gstack

Use the `/browse` skill from gstack for ALL web browsing. Never use
`mcp__claude-in-chrome__*` tools.

Available gstack skills:
`/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`,
`/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`,
`/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`,
`/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`,
`/retro`, `/investigate`, `/document-release`, `/codex`, `/cso`, `/autoplan`,
`/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`,
`/unfreeze`, `/gstack-upgrade`, `/learn`.
