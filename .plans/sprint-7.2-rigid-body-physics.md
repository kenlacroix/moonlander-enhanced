# Sprint 7.2 — Rigid-Body Physics (plan)

Status: **CEO + Eng reviewed 2026-04-20.** 4 scope expansions accepted, 2 deferred. Claude subagent adversarial review caught 3 structural issues + 2 blockers, all resolved. Eng review locked 3 architecture decisions (physicsVersion on LanderState, copy-and-rename v2 integrator, replay sets version at start), 1 code-quality decision (autopilot full rewrite in PR 1), and 3 test gaps (PhysicsManager dispatch, AgentEnv state vector non-zero, leaderboard v2/v3 partition). Ready to implement.

CEO plan at `~/.gstack/projects/kenlacroix-moonlander-enhanced/ceo-plans/2026-04-20-sprint-7.2-rigid-body-physics.md`.
Test plan artifact at `~/.gstack/projects/kenlacroix-moonlander-enhanced/root-main-eng-review-test-plan-20260420-221648.md`.

## Context

Hands-on play testing surfaced a realism gap the roadmap didn't cover: **rotation is free.** The player can spin the lander 360° with zero fuel cost while the main descent thruster is the only thing burning propellant. For a game that otherwise cites real lunar gravity to three decimal places (1.62 m/s²) and real mission names (Apollo 11/15/17, Luna 9, Artemis III), this is a glaring omission.

### What the physics does today

Rotation is an instant angle-set: `lander.angle -= ROTATION_SPEED * dt` while `rotateLeft` is held, `+=` while `rotateRight` is held. Release the key and the lander stops rotating instantly. Fuel cost: zero.

Landing check is two-dimensional: vertical speed under 120 game-units/s AND angle within 10° of vertical. Angular velocity is not checked. You can touch down spinning at any rate and the game counts it as a safe landing.

`LanderState.angularVel` already exists as a field (Sprint 2.7 added it when expanding the RL state vector from 8 dims to 11), but it's never integrated into physics. Dead scaffolding, ready to be connected.

### What Apollo actually did

The Lunar Module had **two separate propellant systems**:
- **DPS (Descent Propulsion System):** one main engine, ~10,000 kg of Aerozine 50 + N2O4. Main thrust down.
- **RCS (Reaction Control System):** 16 thrusters in four quads on the corners, ~287 kg of hypergolic propellant. Attitude control only.

The RCS-to-DPS propellant ratio was roughly 3%. Rotation burns real fuel, and it burns from a completely separate tank. Neil Armstrong's 1969 descent worried about RCS propellant state as much as DPS, because running out of RCS meant losing attitude control — even if the main engine had plenty left.

### What the roadmap says

Nothing about angular momentum. The "Education Mode" in Sprint 10 wants to teach real physics, but the current physics doesn't contain the most pedagogically valuable concept: inertia / angular momentum. Sprint 2.7 added angular velocity to the RL state vector but left it wired to input rather than integrated state. Sprint 7.2 completes that loop.

## Goal

Turn the lander into an actual rigid body. After this sprint:
1. **Rotation burns RCS propellant** from a separate tank, with a separate HUD meter
2. **Rotation has inertia** — release the key, the lander keeps spinning
3. **Landing requires attitude stability** — touching down while spinning is a crash
4. **Ghost replays deterministic under the new physics** (schema v3)
5. **RL agent auto-retrains** via the existing stateSize-mismatch migration, and you can watch it discover "stop spinning before landing"

**Exit question:** Does the lander feel like it has mass? Can a player who's never played before tell that rotation costs something?

## Accepted scope

CEO-reviewed in SELECTIVE EXPANSION mode. Expansion decisions + adversarial-review adjustments baked in.

| # | Feature | Priority | Effort (CC) |
|---|---|---|---|
| 1 | Angular velocity integration in `updateLander` (with `MAX_ANGULAR_VEL = 360` clamp) | Core | ~25 min |
| 2 | `STARTING_RCS` + `RCS_BURN_RATE` + `PHYSICS_V3` feature flag constants | Core | ~15 min |
| 3 | RCS meter on HUD (below fuel bar) | Core | ~20 min |
| 4 | Landing safety check adds `|angularVel| < MAX_LANDING_ANGULAR_RATE` (gated by `physicsVersion`) | Core | ~15 min |
| 5 | Autopilot rewrite — two-stage PID, RCS-starvation graceful degrade | Core | ~90 min (revised from 45 after adversarial review) |
| 6 | Ghost schema v3 — record `angularVel` per frame, try/catch legacy replay | Core | ~25 min |
| 7 | Campaign + freeplay mission tuning — CONSTANTS ONLY in PR 1, per-mission data-driven in PR 2 | Core | ~15 min PR 1 |
| 8 | AI Theater: VISION strip label update + `REWARD_COMPONENT_KEYS` single source of truth | Polish | ~20 min |
| 9 | Reward breakdown: new terminal reward penalty for spinning at touchdown | Polish | ~15 min |
| 10 | **Visual RCS thrusters** (accepted expansion #1) — corner puffs on rotate input | Polish | ~15 min |
| 11 | **First-spin tutorial card** (accepted expansion #2) — one-shot, localStorage-gated | Polish | ~15 min |
| 12 | **Angular momentum overlay** (accepted expansion #3) — `M` key toggle, arrow vector | Polish | ~30 min |
| 13 | **Editor URL param validation** (accepted expansion #6) — kills P2 security TODO | Polish | ~10 min |
| 14 | **RL force-retrain on REWARD_VERSION mismatch** (cross-model tension #1 resolution) | Core | ~10 min |
| 15 | Authentic-mode Apollo 11 RCS quad failure (DEFERRED to 7.2.1 per adversarial review) | — | — |
| 16 | Apollo 13 Survive RCS-primary scoring (DEFERRED to 7.2.1) | — | — |

**Revised total estimate: ~6-7 hours CC** (adversarial review surfaced that the 45-min autopilot rewrite is really 90 min once RCS-starvation tuning is included, and that per-mission RCS balancing wants post-playtest data, not a priori tuning). Split into two PRs.

### Deferred to TODOS.md
- **Gravity-storm torque** — apply random angular impulse during gravity anomalies. Wants post-playtest tuning. P2.
- **"Dead Reckoning" achievement** — land 3 missions without touching RCS. Post-playtest, threshold-to-be-determined. P3.
- **Apollo 11 RCS quad failures** — authentic flavor, not load-bearing. Ship in 7.2.1 follow-up.
- **Apollo 13 Survive RCS-primary scoring** — wants its own tuning pass. 7.2.1 follow-up.
- **Per-mission RCS tuning table** (post-playtest) — ship constants-only in PR 1, tune per-mission in PR 2 after 7.2 base is played.

## Design decisions (first cut)

### Physics integration

```typescript
// Lander.ts — new physics body per fixed timestep:
if (input.rotateLeft && lander.rcs > 0) {
  lander.angularVel -= ANGULAR_ACCEL * lt.rcsMultiplier * dt;
  lander.rcs = Math.max(0, lander.rcs - RCS_BURN_RATE * dt);
}
if (input.rotateRight && lander.rcs > 0) {
  lander.angularVel += ANGULAR_ACCEL * lt.rcsMultiplier * dt;
  lander.rcs = Math.max(0, lander.rcs - RCS_BURN_RATE * dt);
}
lander.angle += lander.angularVel * dt;
```

No angular damping. Vacuum means momentum persists. If you want to stop spinning, you must counter-burn. Empty RCS tank = stuck at current angular rate.

### Constants (first cut, tune in rebalance)

```typescript
// src/utils/constants.ts
export const ANGULAR_ACCEL = 60;             // degrees/sec² from one RCS burn
export const MAX_LANDING_ANGULAR_RATE = 8;   // degrees/sec — above this = crash
export const STARTING_RCS = 100;             // units (vs 1000 main fuel)
export const RCS_BURN_RATE = 15;             // units/sec while RCS firing
```

Numbers chosen so a full spin from rest costs about 10-15% of starting RCS — punishing but not crippling. Landing-rate threshold picked so you have to *intentionally* arrest spin, not just be lucky.

### Lander type multipliers

Each lander type gets an `rcsMultiplier` extending the existing `thrustMultiplier` / `fuelMultiplier` / `massMultiplier` pattern:
- **Eagle:** 1.0 (baseline)
- **Atlas:** 0.8 (heavier, sluggish RCS — matches its slow main thrust)
- **Sparrow:** 1.2 (nimble, responsive — matches its high main thrust)
- **Apollo LM:** 0.9 (authentic: real LM was attitude-control-sluggish)
- **Artemis LM:** 1.1 (authentic: modern RCS, faster response)
- **Luna 9:** 0.7 (1966 Soviet soft-lander, minimal attitude control)

### Landing check

```typescript
// CollisionHandler.ts — tightened:
const safeV = Math.abs(lander.vy) < MAX_LANDING_SPEED;
const safeAngle = Math.abs(angleFromVertical) < MAX_LANDING_ANGLE;
const safeRotation = Math.abs(lander.angularVel) < MAX_LANDING_ANGULAR_RATE;
const safeLanding = safeV && safeAngle && safeRotation;
```

Failure mode on spin-crash: message reads "LANDED SPINNING — STRUCTURAL FAILURE" to teach the player why this counts as a crash.

### Autopilot rewrite

Current autopilot PID sets `rotateLeft` / `rotateRight` bits based on angle error. Under rigid-body physics, that over-rotates every time (the lander has momentum).

New design: PID target is `angularVel`, computed from angle error via a two-stage controller:
1. Outer loop: angle error → desired angular velocity (simple P controller)
2. Inner loop: angular velocity error → RCS burn direction (bang-bang with deadband)

Deadband avoids limit-cycle chatter that would drain RCS. Deadband width is the RCS dispose step size — the smallest change one frame of burn produces.

### Ghost schema v3

Schema v2 (Sprint 7.1) records input frames + archetype + palette. Under rigid-body physics, input frames alone are enough for deterministic replay — integration is deterministic given the same fixed timestep. But pre-v3 ghosts replayed under v3 physics will diverge (the old "instant angle set" becomes "apply angular accel → integrate").

**Resolution (cross-model tension #2, 2026-04-20):** v2 ghosts replay under v2 rules *entirely* — old landing check, angularVel hard-pinned at 0. No retroactive application of v3 rules to v2 historical artifacts. Implementation: `physicsVersion` field on every ghost, explicit branch in both `updateLander` (integrator) AND `CollisionHandler.checkLanding` (landing safety check). Legacy path is well-isolated and well-tested, not silently different.

**Technical-debt acknowledgment:** `updateLanderLegacy` + the legacy landing-check branch are permanent forks of the physics code. Every future physics change (Sprint 7.3 CoM shift, gravity-storm torque) must either be dual-implemented or explicitly broken. Adversarial review flagged this as a maintenance tax every sprint pays. The tax is accepted because the alternative (invalidate all v2 user history) is worse. We'll revisit in Sprint 7.3 — if the legacy path hasn't been touched in 2 sprints, consider sunsetting v2 replay (keep leaderboard scores, drop replay capability).

**Load path error handling:** `loadReplay` wraps legacy-integrator entry in try/catch. Corrupt v2 files fall back to "ghost unavailable" toast, not crash.

Schema v3 adds `angularVel` to each recorded frame (4 bytes × frames = trivial cost). `physicsVersion: 2 | 3` header field is authoritative — `legacy: true` is derived, not stored.

### RL auto-retrain

`STATE_SIZE` stays at 11. `angularVel` was always dim 5 of the state vector; Sprint 2.7 made it carry a real input-derived value. Under rigid-body physics it carries the actual integrated angular velocity — no dimension change, so the existing `stateSize` mismatch guard in RLAgent.ts doesn't fire.

**Resolution (cross-model tension #1, 2026-04-20):** The reward structure changes (terminal reward now penalizes touchdown rotation) and the dynamics change (rotation persists). Adversarial review pointed out that legacy weights under v3 physics likely land near 0%, not "suboptimal" — the old policy will press rotate-left/rotate-right as it always did, burning RCS and accumulating spin it never learned to arrest. A broken pre-trained agent with a soft toast is worse UX than an empty episode counter.

**Decision: force retrain on REWARD_VERSION mismatch.** On weight load, if `metadata.rewardVersion !== current`, delete weights from IndexedDB, log `"Physics changed — starting fresh from episode 0"`, and let the next training run begin empty. AI Theater shows a clean slate rather than a broken agent. Transparent and honest.

**REWARD_COMPONENT_KEYS single source of truth:** Sprint 2.6 deferred unifying the reward-component key list across `calculateRewardBreakdown()`, the AI Theater overlay, and the breakdown renderer (3 call sites, drift hazard). This sprint adds an 8th component (spin-penalty) which makes that drift worse. Promoting the unification from "deferred" to "part of this sprint" — export `REWARD_COMPONENT_KEYS` from one module, import from all three call sites.

### Campaign rebalance

Mission-by-mission: new `startingRCS` field on `DifficultyConfig` (defaults to `STARTING_RCS` constant).
- Missions 1-3: extra RCS budget (1.5× default) — teach the new system
- Missions 4-7: default
- Missions 8-10: tight RCS (0.7× default) — demand efficient attitude work
- Historic missions: authentic values (Apollo LM ~300 kg RCS → translates to ~110 units game-equivalent; Luna 9 much less)

Difficulty adaptation (Easy/Normal/Hard/Expert) multiplies `startingRCS` so beginners have breathing room.

### Authentic mode additions

Two new moments on top of Sprint 5.5 Authentic Mode:
- **Apollo 11:** During long burn phases, random RCS quad failure drops one quad's capacity by 50% for 3 seconds (historical — Armstrong noted one quad was running lean). Toast: `RCS QUAD FAILURE — DEGRADED ATTITUDE CONTROL`.
- **Apollo 13 Survive:** RCS is the primary propellant for the loop-around burn. New scoring dimension: RCS efficiency. Running out = loss of attitude control = mission failure (reuse the "uncontrolled spin" crash mode).

## Mission assignment (tentative)

| Mission | RCS budget | Notes |
|---|---|---|
| Free Play 1-3 | 150 (1.5×) | Learning curve |
| Free Play 4-7 | 100 (default) | Standard |
| Free Play 8-10 | 70 (0.7×) | Tight budget |
| Campaign C1-C5 | 120, 100, 90, 80, 70 | Escalating |
| Apollo 11 | 110 (authentic) | Real LM budget ≈ 287 kg scaled |
| Apollo 15 | 100 | Hadley Rille approach wants spare RCS |
| Apollo 17 | 100 | Taurus-Littrow valley |
| Artemis III | 130 | Modern RCS, larger budget |
| Luna 9 | 80 | Minimal Soviet attitude control |
| Apollo 13 Survive | 200 (RCS-primary) | Authentic scoring: RCS efficiency |
| Random Mission | 100 | Default |

## Deliverables

### Code changes (by module)
- `src/utils/constants.ts` — new constants (`ANGULAR_ACCEL`, `MAX_LANDING_ANGULAR_RATE`, `STARTING_RCS`, `RCS_BURN_RATE`)
- `src/game/Lander.ts` — add `rcs` field to `LanderState`, integrate `angularVel` in `updateLander`, deduct RCS on rotate inputs
- `src/game/LanderTypes.ts` — add `rcsMultiplier` to each lander type
- `src/game/Missions.ts` + `src/game/CampaignMissions.ts` — `startingRCS` field on `DifficultyConfig`
- `src/game/CollisionHandler.ts` — add angular-rate check to landing safety
- `src/game/Autopilot.ts` — two-stage PID rewrite (outer: angle → target ω, inner: ω error → RCS input)
- `src/game/RLAgent.ts` — bump `REWARD_VERSION` in weight metadata, warn on mismatch
- `src/game/AITheater.ts` — update VISION strip tooltip for dim 5 (now integrated angular velocity), explain RCS tank
- `src/systems/GhostReplay.ts` — schema v3 with `angularVel` per frame, `physicsVersion: 3`, legacy integrator for v2 replays
- `src/render/HUD.ts` — add RCS meter bar under fuel
- `src/render/CanvasRenderer.ts` + `WebGLGameplayRenderer.ts` — RCS meter renders on both backends
- `src/game/HistoricMission.ts` — Apollo 11 RCS quad failure event, Apollo 13 RCS-primary scoring

### Tests (target: +~39 tests, 381 → ~420)

**Eng-review gap fills (3 additional tests on top of the CEO-review set):**
- Gap A: PhysicsManager dispatch test — when `lander.physicsVersion === 2`, `updateLanderLegacy` is called, not `updateLander` (1 test). Prevents silent divergence of v2 replays.
- Gap B: AgentEnv state vector test — after 100 fixed-input frames under v3, dim 5 (`lander.angularVel / 180`) is non-zero and within ±2.0 (1 test). Prevents RL training on zero-information state dim.
- Gap C: Leaderboard physicsVersion partition — `addScore(seed, v2score, ..., "2")` and `addScore(seed, v3score, ..., "3")` both persist without overwrite (1 test). Prevents v2 score data loss when v3 scores start landing.


- Lander physics: angular velocity integration, RCS depletion, momentum persistence after input release (5 tests)
- `MAX_ANGULAR_VEL = 360` clamp: integrator never exceeds the ceiling even under pathological input (2 tests — adversarial review)
- Collision handler: safeRotation check boundary at 7.9/8.0/8.1 °/s (2 tests)
- **Autopilot converges to 10/10 freeplay landings (seeds 1969, 4217, 7331, 1138, 2001, 9973, 3141, 6502, 8086, 42) without RCS starvation** (1 integration test, 10 assertions — addresses subagent concern that success criterion #4 had no test)
- Autopilot: two-stage PID converges on target angle without oscillation, deadband prevents chatter (3 tests)
- Autopilot: RCS-starvation graceful degrade (no chatter when RCS=0, accepts current ω as best target) (1 test)
- Ghost v2 replay under v2 rules: old landing check applies, angularVel stays 0 throughout (3 tests)
- Ghost v3 records angularVel correctly, round-trips (2 tests)
- Ghost legacy load corrupt file: fallback to "ghost unavailable" toast, no crash (1 test)
- RCS meter: renders on both backends, low-RCS warning at <10% (2 tests)
- Mission: every mission specifies a valid `startingRCS` in [0, 1000] (1 test, loops all missions)
- Reward breakdown: terminal reward penalty scales with touchdown angular rate (2 tests)
- REWARD_COMPONENT_KEYS imports match across 3 call sites (1 test — prevents drift)
- RL: REWARD_VERSION mismatch deletes weights + logs (2 tests)
- Visual RCS thrusters (expansion #1): corner puff particles emit on rotate input, stop when RCS=0 (2 tests)
- First-spin tutorial (expansion #2): shows once, localStorage flag persists, never reappears (2 tests)
- Angular momentum overlay (expansion #3): M key toggles render, invisible by default (1 test)
- Editor URL validation (expansion #6): malformed base64 / malformed JSON / valid round-trip (3 tests)

### Regression pin (hard requirement)
Physics v2 → v3 is a breaking change for existing ghost files. The regression pin here is: **every pre-v3 ghost that was previously valid must still replay successfully via the legacy integrator path**, and **the new v3 physics must produce byte-identical terrain at seeds 1969, 4217, 7001** (same as Sprint 7.1 pin — terrain determinism is orthogonal to lander integration).

## Data migration

- Ghost files: v2 schema flagged as `legacy: true` on load, replayed with legacy integrator.
- Leaderboard: entries get a `physicsVersion: 2 | 3` field. Display shows both sets ("Pre-RCS" and "Current") with a small legend explaining the split. Never overwrite v2 entries.
- RL weights: REWARD_VERSION mismatch logs warning, shows "retrain recommended" in AI Theater, keeps old weights loadable.

## Deployment

Since this project is no-deploy-target, ship = merge + push. No production flip, no staging environment. Optional follow-up: pin a CHANGELOG entry that calls out the physics change so players know why their v2 ghosts are marked legacy.

## Success criteria

1. Rotation consumes a visibly separate RCS tank on the HUD, and empty RCS = cannot rotate.
2. Release rotation key: lander keeps spinning at the built-up angular rate.
3. Landing while spinning above 8 °/s triggers `LANDED SPINNING — STRUCTURAL FAILURE`.
4. Autopilot successfully lands on 10/10 freeplay missions without RCS starvation.
5. RL agent (DQN) trained from scratch in AI Theater converges to at least 50% landing rate within 200 episodes on seed 1969 (same bar as Sprint 2.7).
6. Every v2 ghost in the regression corpus still replays successfully.
7. Terrain determinism pin passes (seeds 1969, 4217, 7001 byte-identical).
8. 381 → ~420 tests passing (revised from ~406 after eng review added 3 gap-fill tests).

## What's NOT in scope

- 3D rotation axes (still 2D pitch only; yaw/roll = future)
- RCS thruster individual quad modeling (four quads treated as one pool)
- Multi-body dynamics (tether, docking — out of scope for this sprint)
- Physics rewrite for the terrain editor (editor already has its own simplified physics)
- Tutorial overlay rework (Sprint 10 territory)

## PR split recommendation

Re-scoped twice: after adversarial review (autopilot 45 → 90 min, per-mission tuning post-playtest) and after eng review (autopilot full rewrite promoted to PR 1 due to AI Theater coupling).

- **PR 1 — Core physics + HUD + autopilot (~4 hr CC):** items 1-5 (integration + MAX_ANGULAR_VEL clamp, RCS tank, HUD meter, landing check with `physicsVersion` branch on LanderState, full two-stage PID autopilot with RCS-starvation handling), item 6 (ghost v3 with legacy v2 replay path, `physicsVersion` set on replay start), item 7 (constants-only mission tuning), item 10 (visual RCS thrusters), item 11 (first-spin tutorial), item 14 (force-retrain on REWARD_VERSION mismatch), PHYSICS_V3 feature flag. **Ships a coherent playable state — AI Theater works day 1.**
- **PR 2 — Polish + overlay + data-driven tuning (~2.5 hr CC):** item 8 (VISION strip label + REWARD_COMPONENT_KEYS single-source-of-truth unification), item 9 (reward spin-penalty component), item 12 (angular momentum M-key overlay), item 13 (editor URL validation carryover), per-mission RCS tuning from PR 1 playtest data. Ships polish and the Education Mode preview.

Both PRs ship as patch-version bumps. PR 1 = v0.6.0.2 (or v0.6.1.0 if minor bump is justified for the physics change). PR 2 = next patch.

## Architecture decisions (eng review 2026-04-20)

1. **`physicsVersion: 2 | 3` lives on `LanderState`** — same object that carries `landerType`, `fuel`, `angularVel`. Default 3 on new flights. Set to 2 on v2 ghost replay start. Single field, two consumers: `PhysicsManager.step` (integrator dispatch at line 67) and `Physics.ts:46-49` (safe-landing check). One state field, two branches, minimal plumbing.
2. **`updateLander` and `updateLanderLegacy` are two separate copy-renamed functions** — not a parameterized single function. ~30 LOC duplicate code in exchange for zero drift risk. v2 integrator is frozen: never touched again. Any Sprint 7.3 physics change only modifies `updateLander`.
3. **GhostRecorder sets `lander.physicsVersion` at replay start** — single write site, zero coupling through the hot path. `startReplay(ghost)` reads `ghost.physicsVersion ?? 2` and assigns to the spawned LanderState. Everything downstream (integrator dispatch, collision check) reads from `lander.physicsVersion`.

## Diagrams

### Physics dispatch data flow

```
Game.tick()
    │
    ▼
PhysicsManager.step(lander, input, dt, ...)
    │
    ├── lander.physicsVersion === 2 ?
    │         │
    │         ├── YES ─► updateLanderLegacy(lander, input, dt, gameGravity)
    │         │              └── instant angle set, no angularVel, no RCS
    │         │
    │         └── NO  ─► updateLander(lander, input, dt, gameGravity)
    │                        ├── integrate angularVel with RCS burn
    │                        ├── clamp to ±MAX_ANGULAR_VEL (360 °/s)
    │                        ├── angle += angularVel * dt
    │                        └── deduct RCS if rotation input held
    │
    └─► detectCollision(lander, terrain)
            └── safeLanding = |vy|<120 && |vx|<120 && angleDev<10
                              && (lander.physicsVersion === 2
                                  || |lander.angularVel| <= 8)
```

### Ghost v2 → v3 replay flow

```
user clicks "Replay" on saved ghost
        │
        ▼
GhostReplay.load(ghostFile)
        │
        ├── try parse physicsVersion
        │     ├── 3 → v3 ghost, use angularVel per frame
        │     ├── 2 → legacy: angularVel hard-pinned 0
        │     └── missing → default 2 (pre-7.2 files lacked the field)
        │
        ├── try/catch corrupt file
        │     └── CATCH → toast "Ghost unavailable", return null
        │
        ▼
startReplay(ghost, lander)
        │
        └── lander.physicsVersion = ghost.physicsVersion  ← single write site
        │
        ▼
(Game tick loop picks correct integrator via LanderState.physicsVersion)
```

## Touch / mobile input acknowledgment

Adversarial review flagged: mobile users now need two-axis attitude management on a touchscreen, plus a second meter to watch, with no tactile feedback when momentum accumulates. This is a real UX concern. Before PR 1 lands, manually touch-test the new physics on a phone and decide whether:
- Mobile needs a "simple mode" toggle that applies heavier angular damping (arcade-style on touch only)
- Or the RCS tutorial card is sufficient + the HUD meter makes momentum visible
- Or mobile landing tolerances (`MAX_LANDING_ANGULAR_RATE`) are relaxed to `16 °/s` vs desktop `8 °/s`

Not a blocker for PR 1, but tracked here so it doesn't slip. Will retest via `/browse` after PR 1 lands and write a finding into TODOS.md if mobile feel regresses.

## Open questions — resolved during review

All four open questions answered during the CEO + adversarial + eng review pass:
1. **Worth a sprint vs 20-min bolt-on?** CEO-review answer: B (rigid body + separate RCS). Approach D (full gimbal + CoM) deferred to Sprint 7.3.
2. **Separate RCS or shared fuel pool?** Resolved: separate RCS tank. Unlocks Apollo 13 Survive RCS-primary scoring hook and "out of RCS with fuel to spare" crisis moments.
3. **Apollo 13 Survive rework?** Deferred to 7.2.1 — keep 7.2 scope tight, rework Apollo 13 in a focused follow-up PR.
4. **Autopilot PID vs LQR/MPC?** Stays rule-based PID in 7.2 (two-stage, RCS-starvation aware). LQR/MPC elevation belongs to Sprint 10 Education Mode demo.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | SELECTIVE EXPANSION: 6 proposals, 4 accepted, 2 deferred; 3 gap-fixes folded in |
| Outside Voice | Claude subagent | Independent 2nd opinion | 1 | ISSUES FIXED | 3 structural criticisms, 2 blockers — all resolved (force-retrain RL, v2-rules-forever ghosts, autopilot retune, PR split, mobile call-out) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 4 issues found, 4 resolved: physicsVersion on LanderState, copy-and-rename legacy integrator, replay sets version at start, autopilot full rewrite in PR 1; +3 test gaps filled (dispatch, dim 5, leaderboard partition); target 381 → ~420 tests |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | NOT NEEDED | HUD changes fit existing patterns (RCS meter below fuel bar, overlay reuses autopilot-annotation style) |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | NOT NEEDED | Not a developer-facing product |

**CROSS-MODEL:** Claude subagent adversarial review surfaced issues the CEO review missed. Eng review independently surfaced 4 more concrete architectural issues by reading actual code signatures (`PhysicsManager.step`, `Physics.ts:46-49`, `Lander.ts:44-84`). All 7 findings across both reviews folded into the plan.

**UNRESOLVED:** 0 decisions outstanding.

**VERDICT:** CEO + ENG CLEARED — ready to implement. Start with PR 1 (core physics + HUD + autopilot, ~4 hr CC).
