# Sprint 7.2 Part 2 — Per-Mission Data-Driven RCS Tuning (plan)

**Status: ✅ COMPLETE — shipped v0.6.2.0 (PR #43, commit `2070f97`).** Per-mission `maxLandingAngularRate` + `startingRCS` overrides on `DifficultyConfig`; `applyAuthenticPhysics` helper; Apollo 11 Authentic tightened to 3°/s.

Part 1 shipped in commit `a473f2a` (PR #42, v0.6.1.0) with rigid-body rotation, a separate RCS propellant tank, and an 8°/s angular-rate landing check. Every knob was a global constant. This sprint moves the **landing-rate tolerance** into per-mission `DifficultyConfig` so Apollo 11 can land with historical-reference precision while freeplay stays forgiving, and closes the feedback loop so players understand WHY they crash when they do.

## Context

### What Part 1 left as globals

```ts
// src/utils/constants.ts (lines 10–22)
export const MAX_LANDING_ANGULAR_RATE = 8;   // deg/s — above = crash
export const STARTING_RCS = 100;             // units
// (ANGULAR_ACCEL, MAX_ANGULAR_VEL, RCS_BURN_RATE stay global — not per-mission)
```

`rcsMultiplier` on each `LanderType` already scales tank size per craft (Apollo LM 0.9×, Sparrow 1.2×, Luna-9 0.7×). Craft property, not mission property. Unchanged.

### What's already half-wired

`DifficultyConfig.startingRCS?: number` already exists in `src/game/Terrain.ts:49` and is already applied in `Game.ts:399, 520` as a post-mutation. Part 1 shipped that hook; Part 2 populates data for it plus adds the landing-rate knob.

### What's *not* wired

`maxLandingAngularRate` — currently read globally by `Physics.checkCollision` (`src/game/Physics.ts:63`).

## Goal

After this sprint:

1. **Apollo 11 Vanilla lands with 6°/s tolerance**, Apollo 15/17 with 7°/s, Artemis III with 6°/s. Freeplay + campaign + Random Missions stay on 8°/s.
2. **Authentic Mode tightens Apollo era to 4°/s, Artemis to 5°/s** — matches real Apollo LM RCS deadband (~4°/s), still reachable by autopilot.
3. **HUD shows live angular rate vs mission gate during descent** — closes feedback loop. No more "crashed spinning, why?".
4. **All per-mission overrides flow through `createLander` via `difficulty?: DifficultyConfig`** — consolidates existing `startingFuel` / `startingRCS` post-mutations into one entry point.
5. **Ghost replay, leaderboard, RL training all unchanged** — verified against code paths, not assumed.

**Exit question:** Does Apollo 11 Authentic feel historically tight, autopilot-landable, and give the player enough feedback to understand a "SPINNING" crash when it happens?

## Locked decisions (from /plan-eng-review + outside voice)

| # | Decision | Why |
|---|---|---|
| 1 | **Scope: only `maxLandingAngularRate` + `startingRCS`.** Drop `angularAccel`, `maxAngularVel`, `rcsBurnRate` from DifficultyConfig. | Only 2 fields actually populated in the tuning table. Others would be scaffolding. Removes autopilot-deadband-coupling risk entirely. |
| 2 | **Authentic mode via helper `applyAuthenticPhysics(lander, era, authenticMode)` in `AuthenticMode.ts`.** Called by Game.ts after createLander. | Centralizes authentic logic. Takes `era` primitive (not Mission object) so callers without mission (tests, future) can use it. |
| 3 | **All overrides consolidate INTO `createLander(x, y, type, difficulty?, physicsVersion?)`.** Remove `startingFuel` / `startingRCS` post-mutations from Game.ts:399-400 and :520. | DRY. One entry point for lander initialization, including overrides. |
| 4 | **Autopilot convergence regression test scoped to Vanilla only** (Apollo 11 @ 6°/s, Apollo 15 @ 7°/s, Apollo 17 @ 7°/s, Artemis III @ 6°/s). | Autopilot per-tick correction is ~4.3°/s granularity. Lands within 6-7°/s, tests would fail at 4°/s. |
| 5 | **Authentic tolerances: Apollo era 4°/s (×0.5 of 8), Apollo 15/17 4.5°/s, Artemis III 5°/s (×0.625), Luna 1.0× (auto-landing, irrelevant).** | 4°/s matches real Apollo LM RCS deadband. Still autopilot-landable. No "broken autopilot" trap when players toggle [P] in Authentic. |
| 6 | **Luna 9 `startingRCS: 80`** is deliberate buffer for auto-landing (vs natural 70 from 100 × 0.7 multiplier). Rationale updated. | Autopilot fires RCS throughout descent; 70 units runs thin on some seeds. |
| 7 | **HUD live angular-rate-vs-gate readout** built in Part 2 (not deferred). | Per-mission gates without live feedback = invisible difficulty. One small HUD line closes the loop. |

## Scope — 12 items, ~2.5 hr CC

| # | Item | Files | Risk |
|---|---|---|---|
| 1 | Add `maxLandingAngularRate?: number` to `DifficultyConfig` in `Terrain.ts` | 1 | Low |
| 2 | Add `difficulty?: DifficultyConfig` param to `createLander`. Materialize `maxLandingAngularRate` onto LanderState (fallback to `MAX_LANDING_ANGULAR_RATE`). Move `startingFuel` / `startingRCS` overrides INSIDE createLander. | 1 | Low |
| 3 | Update all 7 createLander call sites to pass difficulty when available. `Game.ts:398, 473, 514` (main/custom/reset spawns), `Game.ts:spawnRelayLander`, `HeadlessGame.ts:32, 74`, `AgentReplay.ts:27`, `GhostReplay.ts:179`. Last three pass `undefined` (no mission). Delete the 4 post-mutation override lines in Game.ts:399-400 and :520. | 3 | Medium |
| 4 | `Physics.checkCollision` reads `lander.maxLandingAngularRate` instead of global constant | 1 | Low |
| 5 | New `applyAuthenticPhysics(lander, era, authenticMode)` helper in `AuthenticMode.ts`. Era → multiplier map: `"1960s-70s-apollo": 0.5`, `"2020s-artemis": 0.625`, `"1960s-soviet": 1.0`. Called from Game.ts after createLander for main + relay spawns. | 1 | Low |
| 6 | Populate Apollo 11/15/17 + Artemis III + Luna 9 with `startingRCS` and `maxLandingAngularRate` per tuning table | 3 | Low |
| 7 | Per-mission 15/17 override granularity: Apollo 15 → 7°/s, Apollo 17 → 7°/s (both have terrain quirks — rille/valley — rationale: precision). | (in #6) | — |
| 8 | **HUD live angular-rate readout.** Adds "ROT: 5.2°/s / 6°/s" to HUD during descent. Color: white under 80% of gate, amber 80-99%, red at/over gate. Hidden when lander not flying. | 1 | Low |
| 9 | Extend `HeadlessGame` to accept optional `DifficultyConfig` for convergence tests. (Currently takes no mission data.) | 1 | Low |
| 10 | Per-mission test suite in `tests/sprint-7.2-part2-mission-tuning.test.ts` — 11 cases (see Test plan) | 1 | Low |
| 11 | CHANGELOG + VERSION bump (v0.6.2.0) | 2 | Low |
| 12 | Manual playtest: Apollo 11 Vanilla/Authentic (manual + autopilot), Luna 9, freeplay seed 1969, custom terrain | — | — |

**Total touched files: ~10.** No high-risk items; autopilot threading was scope-reduced out.

## Architecture

### Data flow

```
                Mission data              createLander               LanderState
                                          (x, y, type,               (runtime)
                                           difficulty?, phys?)
                                                │
apolloMissions  ─ startingRCS: 120   ──────────►│  rcs = difficulty?.startingRCS
apolloMissions  ─ maxLandingAngularRate: 6 ────►│           ?? STARTING_RCS * rcsMult
                                                │
                                                │  maxLandingAngularRate = difficulty?
                                                │    .maxLandingAngularRate
                                                │    ?? MAX_LANDING_ANGULAR_RATE
                                                ▼
                                          lander instance
                                                │
            ┌───────────────────────────────────┴─────────────────┐
            │                                                     │
   applyAuthenticPhysics                                  Game.ts : spawn
   (lander, era, auth=true)                               continues normally
            │
            │ era = "1960s-70s-apollo"
            │ lander.maxLandingAngularRate *= 0.5
            ▼
      Physics.checkCollision(lander, terrain)
            │
            │ reads lander.maxLandingAngularRate (NOT the constant)
            ▼
      landed vs spinningCrash decision
```

### Why materialize on LanderState vs threading mission context

Every consumer (`Physics.checkCollision`, `HUD`, hypothetical future callers) reads from the lander object, not from module-level constants and not from a passed-down mission. Ghost replay works because the lander's materialized value at createLander time is what the integrator sees. Leaderboard partition stays seed + physics-version. No new coupling.

### Authentic helper signature — takes era, not Mission

```ts
// src/game/AuthenticMode.ts
export function applyAuthenticPhysics(
  lander: LanderState,
  era: Era | undefined,   // undefined for non-historic missions
  authenticMode: boolean,
): void {
  if (!authenticMode || !era) return;
  const mult = AUTHENTIC_ANGULAR_RATE_MULTIPLIER[era] ?? 1.0;
  lander.maxLandingAngularRate *= mult;
}
```

Called by `Game.ts` after createLander in main + relay spawns. `GhostPlayer` doesn't call it (replay uses default Eagle/default spawn — authentic is for live play). `HeadlessGame` / `AgentReplay` don't call it (no authentic mode in training).

### Proposed tuning table

| Mission | `startingRCS` | `maxLandingAngularRate` (Vanilla) | Authentic (×multiplier) | Rationale |
|---|---|---|---|---|
| Apollo 11 Tranquility | 120 | 6°/s | **4°/s** (×0.5) | Historical LM RCS deadband = 4°/s. Vanilla gives margin. |
| Apollo 15 Hadley | 110 | 7°/s | **3.5°/s** (×0.5) | Rille terrain needs precision. |
| Apollo 17 Taurus-Littrow | 110 | 7°/s | **3.5°/s** (×0.5) | Valley floor, precise. |
| Artemis III Shackleton | 140 | 6°/s | **3.75°/s** (×0.625) | Polar morning, hazard ellipse implies precision. |
| Luna 9 | 80 | — (auto-landing, gate irrelevant) | — | 80 is a deliberate buffer over the 70-unit natural default (100 × 0.7 lander mult). Autopilot fires RCS throughout descent. |
| Apollo 13 Survive | — (no landing) | — | — | Timer mission. |
| Freeplay / campaign / Random | default 100 | default 8°/s | n/a | Unchanged. |

Note: Apollo 15 and 17 authentic values (3.5°/s) are BELOW autopilot per-tick granularity (~4.3°/s). Players in Authentic + manual on those missions get pure-pilot difficulty. Players on autopilot will likely crash — acceptable because those missions historically were demanding ("Armstrong would have done it by hand anyway"). Pin this with a manual-playtest check, not an automated regression.

## Test plan — 11 cases

File: `tests/sprint-7.2-part2-mission-tuning.test.ts`.

1. `createLander materializes maxLandingAngularRate from DifficultyConfig`
2. `createLander falls back to MAX_LANDING_ANGULAR_RATE when field omitted`
3. `createLander consolidates startingFuel override (replaces Game.ts post-mutation)`
4. `createLander consolidates startingRCS override (replaces Game.ts post-mutation)`
5. `Physics.checkCollision reads lander.maxLandingAngularRate, not the global constant`
6. `applyAuthenticPhysics tightens Apollo-era gate to 0.5× base`
7. `applyAuthenticPhysics tightens Artemis-era gate to 0.625× base`
8. `applyAuthenticPhysics no-ops when authenticMode=false`
9. `applyAuthenticPhysics no-ops when era is undefined (non-historic)`
10. `[REGRESSION] Autopilot converges and lands Apollo 11 Vanilla within 6°/s gate` — HeadlessGame with Apollo 11 difficulty + autopilot input, assert `|lander.angularVel| < 6` at touchdown and `lander.status === "landed"`. Repeat for Apollo 15 (7°/s), Apollo 17 (7°/s), Artemis III (6°/s).
11. `v3 ghost schema forward-compat: pre-Part-2 v3 ghost (embedded DifficultyConfig without maxLandingAngularRate) replays under default 8°/s gate and lander.maxLandingAngularRate === MAX_LANDING_ANGULAR_RATE`

Plus unchanged: all 413 tests from `tests/sprint-7.2-physics.test.ts` stay green (createLander's default-arg fallback preserves existing behavior).

## Risks + mitigations

| Risk | Mitigation |
|---|---|
| `Game.ts:spawnRelayLander` call site forgets to apply authentic → silent downgrade mid-run | Item #3 explicitly lists this site. Test #6 via an integration pattern: create lander with Apollo mission + authenticMode, assert maxLandingAngularRate === 4. |
| Apollo 15/17 Authentic at 3.5°/s is autopilot-unlandable | Acknowledged in tuning table. Scoped to manual-play-only for those missions. If playtest says this is player-hostile, loosen via constant tweak, no schema change. |
| Pre-Part-2 ghost recorded against 8°/s now replays against mission tolerance | Ghost replay uses default Eagle/default spawn (not mission-specific). GhostPlayer doesn't call applyAuthenticPhysics. Materialized maxLandingAngularRate defaults to 8°/s because createLander receives no difficulty. Verified in code at GhostReplay.ts:179. Test #11 pins this. |
| Leaderboard contamination | Seed uniquely identifies mission. Same seed + mode + physics version → same mission config → same materialized values → same leaderboard bucket. Unchanged. |
| RL agent Q-value drift from tightened terminal reward | AI Theater uses freeplay Moon + per-world physics (Europa, Mars, Jupiter). No historic missions in training distribution. `src/ai/` doesn't import from `src/data/apolloMissions.ts` etc. REWARD_VERSION stays at 3. |
| HUD readout visible during freeplay where it's just "8°/s" → clutter | Only show readout when `lander.status === "flying"`. Format keeps it to one ~20-char line. Cost-benefit: low. |

## Ship criteria

- All 413 existing tests green + 11 new tests.
- Biome clean, tsc clean.
- Manual playtest: Apollo 11 Vanilla lands on manual AND autopilot. Apollo 11 Authentic lands on manual AND autopilot. Apollo 15 Authentic lands on manual. Luna 9 auto-lands. Freeplay seed 1969 plays identically to pre-Part-2.
- HUD angular-rate indicator visible, shows correct mission-specific gate, color transitions work (white → amber → red).
- Single PR, cluster of focused commits. VERSION → 0.6.2.0. CHANGELOG entry under "Sprint 7.2 Part 2".

## Out of scope (explicitly deferred)

- Campaign mission tuning — deferred until playtest data says physics-shaped escalation is needed.
- Gravity-storm angular torque — separate TODO, post-playtest.
- Per-world physics (Europa, Titan) — transfer-learning concerns, separate sprint.
- RL terminal-reward angular-rate penalty — Sprint 2.7's reward already penalizes spinning. No change here.
- RCS-quad authentic variation (Apollo 11 1202-era lean-quad simulation) — tracked in TODOS.md.
- "Authentic = manual-only" purist mode — can be a future toggle if playtest prefers it; not this sprint.
- Apollo 15/17 Authentic autopilot-landability — explicit trade; playtest-tune only.

## Call site inventory (7 createLander sites, 5 files)

For item #3. Exhaustive list:

| File:Line | Context | Pass difficulty? | Apply authentic after? |
|---|---|---|---|
| `Game.ts:398` | `spawnRelayLander` — relay mode lander #2/#3 | yes (activeMission.difficulty) | yes |
| `Game.ts:473` | `playCustomTerrain` — custom user-drawn terrain, no mission | no (no mission) | no |
| `Game.ts:514` | `reset` — main mission spawn | yes (activeMission.difficulty) | yes |
| `HeadlessGame.ts:32` | training / convergence tests | optional (new param, #9) | no |
| `HeadlessGame.ts:74` | training restart | optional (new param, #9) | no |
| `AgentReplay.ts:27` | RL replay viewer | no | no |
| `GhostReplay.ts:179` | ghost playback (visual overlay) | no | no |

---

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 0 | — | Not run (solo-dev, scope already tight) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | ISSUES_RESOLVED | 7 issues found, 7 resolved inline (scope-reduced 4 fields → 1, helper pattern, consolidation, 2 test additions, authentic tuning loosened 3°/s → 4°/s, Luna 9 rationale fixed, HUD indicator in-scope) |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | AUTH_FAILED | Codex 401 unauthorized — fell back to Claude subagent |
| Outside Voice | `codex-plan-review` | Adversarial challenge | 1 | ISSUES_RESOLVED | 7 findings; 5 valid (verified in code), 2 invalidated by codebase reality (ghost replay determinism, strategic miscalibration out of scope) |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | Not run (tiny HUD addition, can check live during implementation) |

**CROSS-MODEL:** Claude review + Claude-subagent outside voice agreed on scope reduction (drop 3 unused fields), helper-pattern architecture, and need for byte-identical ghost test. Disagreed on ghost replay impact (outside voice assumed GhostPlayer uses mission data; actual code uses defaults). Resolved by reading `GhostReplay.ts:172-184` — GhostPlayer spawns synthetic Eagle lander, no difficulty, no landing check. Test #11 updated to match reality.

**UNRESOLVED:** 0.

**VERDICT:** ENG REVIEW CLEARED — ready to implement.

### Review findings + resolutions (for traceability)

| # | Finding | Resolution | Evidence |
|---|---|---|---|
| 1 | 4 new DifficultyConfig fields vs 2 actually populated (complexity trigger: 8+ files) | Scope reduced to `maxLandingAngularRate` only. `angularAccel`, `maxAngularVel`, `rcsBurnRate` dropped. | Tuning table in plan; scope item #1 in revised plan |
| 2 | Authentic multiplier as post-mutation (plan) vs helper | `applyAuthenticPhysics(lander, era, authenticMode)` in AuthenticMode.ts. Takes era primitive so GhostPlayer can't accidentally misuse it. | Architecture section, scope item #5 |
| 3 | `startingFuel`/`startingRCS` post-mutations scattered in Game.ts | Consolidated INTO createLander via new `difficulty?` param. Deletes 4 lines of post-mutation. | Scope item #3 in revised plan |
| 4 | Missing autopilot convergence regression test for tightened Vanilla gates | Added test #10 (Apollo 11 @ 6°/s, 15/17 @ 7°/s, Artemis @ 6°/s) via HeadlessGame. | Test plan #10 |
| 5 | Ghost replay determinism test pinned wiring not trajectory | Changed to v3 ghost forward-compat test (#11) — pre-Part-2 ghosts replay under default 8°/s because GhostPlayer doesn't pass difficulty. Verified in code at GhostReplay.ts:179. | Risks table row 3 + test plan #11 |
| 6 | Apollo 11 Authentic 3°/s was autopilot-unlandable AND tighter than real LM spec | Loosened to 4°/s (matches historical Apollo LM RCS deadband exactly). Artemis to 5°/s. | Tuning table |
| 7 | Luna 9 `startingRCS: 80` vs 70 baseline — rationale said "small" but value was larger | Confirmed deliberate buffer. Rationale in tuning table updated. | Tuning table row 5 |
| + | HUD angular-rate-vs-gate readout | Added to scope (item #8) — closes feedback loop on SPINNING crashes | Scope item #8 |
| + | HeadlessGame needs DifficultyConfig plumbing for convergence tests | Added as scope item #9 | Scope item #9 |

### NOT in scope

- Per-mission `angularAccel` / `maxAngularVel` / `rcsBurnRate` overrides (Decision 1)
- Campaign mission tuning — post-playtest if warranted
- Apollo 15/17 Authentic autopilot-landability — accepted tradeoff; manual-play expected
- "Authentic = manual-only" purist toggle — future TODO if playtest wants it
- Gravity-storm angular torque, per-world physics, RL reward shaping — separate sprints/TODOs
- RCS-quad authentic variation — tracked in TODOS.md

### What already exists

- `DifficultyConfig.startingRCS?: number` at `Terrain.ts:49` — from Part 1, reused.
- `LanderType.rcsMultiplier` — from Part 1, unchanged. Still scales tank size per craft.
- `AuthenticMode.ts` infrastructure (`buildAuthenticState`, `applyAuthenticFilter`) — helper pattern reused for new `applyAuthenticPhysics`.
- Ghost schema v3 with embedded `DifficultyConfig` — unchanged, no bump.
- Leaderboard v2/v3 partition — unchanged; per-mission tolerance rides inside seed.

### Failure modes (audit)

| Path | Failure | Test | Error handling | User visibility |
|---|---|---|---|---|
| createLander with malformed difficulty | Runtime crash | TypeScript catches at compile | — | — |
| applyAuthenticPhysics with unknown era | Multiplier defaults to 1.0 (safe no-op) | Test #9 | `?? 1.0` fallback | Silent (correct behavior) |
| Game.ts:spawnRelayLander forgets authentic call | Relay lander #2/#3 uses Vanilla gate in Authentic run | Manual playtest | None | Silent downgrade in Authentic mode |
| HUD readout miscalculated because field undefined | Crash or NaN | Test #1/#2 pin defaults | `?? MAX_LANDING_ANGULAR_RATE` fallback in createLander | Would be visible |
| Pre-Part-2 ghost replay diverges | Wrong visual ghost trajectory | Test #11 | Default 8°/s via createLander fallback | Silent — ghosts are cosmetic |

Critical gaps flagged: **0.** The relay-spawn authentic-call risk is mitigated by Item #3's explicit enumeration of all 7 call sites.

### Parallelization strategy

Sequential implementation — all scope items touch overlapping modules (Lander + Game + AuthenticMode + Physics + tests). Implementation order:

1. Scope items #1–4 (DifficultyConfig field + createLander signature + Physics.checkCollision read)
2. Item #5 (applyAuthenticPhysics helper)
3. Item #3 (all 7 createLander call sites updated)
4. Item #6–7 (mission data)
5. Item #9 (HeadlessGame extension)
6. Item #10 (11 tests)
7. Item #8 (HUD readout)
8. Item #11–12 (CHANGELOG, VERSION, manual playtest)

No parallelization opportunity — would create merge conflicts on Lander.ts + Game.ts.

### Completion Summary

- Step 0 Scope Challenge: **scope reduced** (4 fields → 1; dropped autopilot-threading risk)
- Architecture Review: 1 issue (authentic helper location) → 2A resolved
- Code Quality Review: 1 issue (override consolidation) → 3A resolved
- Test Review: 2 gaps → 4A + 5A resolved, 11 tests planned, diagram produced
- Performance Review: 0 issues
- Outside Voice: ran (Claude subagent fallback; Codex auth failed). 7 findings: 5 valid, 2 invalidated after code verification. 3 substantive resolved inline.
- NOT in scope: written (7 items)
- What already exists: written
- TODOS.md updates: 1 proposed → built in scope (HUD indicator)
- Failure modes: 5 paths audited, 0 critical gaps
- Parallelization: sequential (1 lane)
- Lake Score: 7/7 recommendations chose complete option
