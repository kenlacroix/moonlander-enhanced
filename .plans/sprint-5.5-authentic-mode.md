# Sprint 5.5 — Authentic Mode (plan)

Status: CEO review complete 2026-04-16 (SELECTIVE EXPANSION, 6 cherry-picks accepted, 8 cross-model tensions resolved via Codex outside voice). Ready for `/plan-eng-review`.

## Context
Historic missions today (Sprint 5 Part A, v0.5.7.0) use the same physics as Free Play with different fuel budgets and terrain flavor. Apollo 11 and Artemis III feel mechanically identical even though 1969 and 2028 lunar tech are wildly different: Apollo had a 2KB flight computer, no GPS, analog instruments, discrete RCS thrusters, no hazard avoidance; Artemis has orbital LRO maps, GPS, autonomous hazard detection, digital continuous throttle. Briefing text says "Armstrong had 22 seconds of fuel" but the player can't *feel* that tech-era gap.

**Decisions locked in exploration (2026-04-16):**
- Approach: per-mission **opt-in toggle**, default OFF. Casual players stay in modern physics; players who want to experience the era opt in.
- Intensity: **signature moments only** — 1-2 distinctive mechanics per era that evoke the tech without dominating the game. Not full tech simulation.

## Goal
Give the player the option to experience real tech-era constraints without punishing those who just want to fly. Default to modern physics; on toggle, Apollo missions feel like 1969 and Artemis feels like 2028.

**Exit question:** Does a player who flips Authentic Mode on Apollo 11 feel the difference within one flight, without feeling like the game is broken?

## Scope

### 1. Authentic Mode toggle (per-mission)
- State lives on `Game.currentFlight: FlightConfig | null` (NOT a top-level Game.authenticMode boolean — avoids leaks across freeplay/campaign/AI-replay/fork-replay reset paths per Codex review). `currentFlight` is constructed in `selectMission()` and cleared on return-to-title.
- Historic mission-select screen adds `[A] AUTHENTIC MODE: OFF/ON` indicator.
  - **Desktop:** toggle with `A` key (context-scoped dispatch in StateHandlers.updateMenu; during flight `A` still toggles autopilot annotations — same Input flag, different consumer).
  - **Mobile:** draw a tap-zone button next to the indicator for touch users. Desktop-only keybinding was a Codex catch.
- Per-mission localStorage: `moonlander-authentic-{missionId}`. Try/catch wraps load/save (SecurityError, QuotaExceededError).
- HUD caption colors: **Apollo = `#ffb000` amber** (DSKY reference), **Artemis = `#00ccff` cyan**. Text: `AUTHENTIC 1969 TECH` / `AUTHENTIC 2028 TECH`.
- **Storage key isolation (Codex catch):** Ghost / Leaderboard / MissionBriefing cache keys gain a mode suffix: `{seed}-vanilla` or `{seed}-authentic`. Old keys without suffix treated as `vanilla` (implicit migration). Otherwise Authentic ghosts silently overwrite vanilla runs for the same seed.

### 2. Apollo 11 signature moments (Authentic ON)
- **Altitude blackout below 50m AGL**: HUD altitude readout shows `---` when lander is within 50m of terrain below (TRUE AGL from `Physics.getTerrainHeightAt`, not pixel math — Codex catch, pixels drift with camera). HUD display metric stays pixel-based elsewhere; only the blackout *trigger* uses AGL. First-frame-under-50m shows 1-second `LOW-ALT READOUT UNAVAILABLE (AUTHENTIC)` message to prevent 'feels broken.'
- **"1202 program alarm"**: once during descent.
  - **Scheduled frame:** `((seed * 31) % 300) + 200` (deterministic per seed).
  - **Altitude gate:** fire only if altitude > 150px at scheduled frame.
  - **Collision rule (Codex catch):** if scheduled frame arrives below 150px, **skip entirely** — no alarm this flight. Fast descenders get lucky. Determinism is preserved; outcome is a pure function of (seed, player trajectory).
  - **Effect:** player's thrust input is zeroed for ~400ms (24 frames at 60fps, counted off physics frames so pause-resume works). Since the filter runs in `Game.update` input phase BEFORE physics, `lander.thrusting` never sets, plume doesn't draw, fuel doesn't burn — all three stay coherent automatically.
  - **Visual + audio:** HUD flash `1202 PROGRAM ALARM — EXECUTIVE OVERFLOW`. Synthesized ~200ms warble via existing Audio class (mirrors fuel-warning beep; no new assets). Graceful no-op when AudioContext suspended.

### 3. Apollo 15 + 17 (inherit from Apollo 11)
- Same altitude blackout below 50 AGL (analog instruments across the Apollo program).
- No 1202 alarm — that was Apollo 11-specific.
- Softer **"MASTER ALARM"** audio cue: fires ONCE per flight when AGL first drops below `MASTER_ALARM_GATE_PX` (150). Deterministic. Audio-only, no input lockout. Synthesized tone via `Audio.playMasterAlarm()` (distinct from 1202 warble).

### 4. Artemis III signature moment (Authentic ON) — fused per Codex scope challenge

**Hazard-aware landing ellipse (single mechanic):**
- Translucent ring on terrain below showing projected touchdown if no inputs change. 4Hz update, radius scaled to velocity uncertainty.
- **Default color:** amber (`#ffb000`) — safe touchdown projection.
- **Hazard color:** red (`#ff3030`) — if the terrain slope AT the projected touchdown point exceeds the hazard threshold.
- Slope data for each terrain cell is computed ONCE at mission start (terrain is static).
- Makes the mission feel easier (prediction) AND teaches the player "2028 tech will warn you about bad landing sites." One visual carries both the predictive-guidance and hazard-detection story.
- `Number.isFinite(vx) && Number.isFinite(vy)` guard on projection to prevent NaN-explode during edge cases.

*Rationale (from Codex review):* original plan had ellipse + separate hazard-ribbon overlay. Codex flagged as overbuilt for a "signature moment" mandate. Fusion keeps both ideas' value in one mechanic at ~15 min CC vs original ~20 min.

## Accepted from CEO review (cherry-picks)

- **Pre-launch tutorial overlay:** First time user picks Authentic on a mission, a 3s overlay appears ON the mission-select screen (NOT in flight — Codex caught that briefing already occupies first 5s of flight and there's no pause system). Blocks launch briefly. Key: `moonlander-authentic-intro-seen-{missionId}`, written on dismiss (not first render).
- **Share card AUTHENTIC badge:** `FlightRecorder` canvas card gets an era-colored corner badge when `currentFlight.authenticMode === true`.
- **Authentic-aware MissionBriefing:** `MissionBriefing` receives `authentic: true`; LLM prompt emphasizes era-tech context; offline fallback appends `eraOneLiner` field (new on `MissionFacts`) verified per mission (Apollo 11 example: "Eagle's 2KB guidance computer carried the crew down while Armstrong hunted for a boulder-free landing site in real time.").
- **Dual-track leaderboard:** Upgraded from "deferred" after Codex caught the comparability bug. Mission-select shows `BEST` and `BEST (AUTHENTIC)` side-by-side using the `{seed}-{mode}` keyed storage from Section 1.

## Not in scope
- Free Play, Campaign, Daily Challenge, AI Theater, AI training — unaffected.
- Lander physics: unchanged. Authentic Mode is mechanics-on-top-of-physics.
- HUD altitude display metric — stays pixel-based. Only the blackout *trigger* uses true AGL. Full HUD-to-meters conversion is Sprint-2.7-sized and out of scope here.

## Deferred
- **Apollo DSKY HUD skin**: stays in Sprint 5 polish backlog.
- **Full tech simulation** (thrust lag, RCS discrete bursts, instrument refresh caps): rejected in favor of signature moments.
- **Luna 9 Authentic Mode**: Luna 9 is auto-landing spectator; Authentic Mode not meaningful.
- **Apollo 13 Authentic Mode**: Apollo 13 is survive mission; signature-moment design for non-landing needs separate scope.

## Key design constraint
Every signature moment must be **deterministic per seed** so ghost replays and fork-replay (Sprint 3) stay faithful. Alarms fire at seed-derived frames, not `Math.random()`.

## Success criteria
- Player can toggle Authentic Mode on the Apollo 11 mission select and see the indicator change.
- On next Apollo 11 flight, altitude readout blanks under 50m AGL.
- 1202 alarm fires exactly once per flight at a reproducible frame for the same seed.
- Artemis III with Authentic ON shows amber landing ellipse updating in real-time.
- Hazard ribbon visible below ~200m only on Artemis.
- Default mode (OFF) is byte-identical to v0.5.7.0 behavior — regression-tested by pinning a ghost replay.
- No regression in physics test suite.

## Risks
- **Altitude blackout feels broken** → 1-second HUD message on first frame under 50m AGL; pre-launch tutorial primes context.
- **1202 alarm feels unfair** → altitude gate > 150px + skip-on-collision rule keeps lockout recoverable and deterministic.
- **Landing ellipse cheapens challenge** → 4Hz update + velocity-uncertainty radius + red-on-hazard color — player still has to land it.
- **Save-format fragility** → namespace under `moonlander-authentic-{missionId}` + `{seed}-{mode}` on ghost/leaderboard/briefing. Try/catch on every load. Corrupt JSON deletes the key, defaults OFF.
- **State leak across modes (Codex)** → `FlightConfig` struct lives only on active flight; impossible to leak to freeplay/campaign/AI-replay.

## Architecture (locked)

**New module:** `src/game/AuthenticMode.ts` — pure functions + typed state object, mirroring `Alien.ts` / `GravityStorm.ts` pattern (Approach C, selected over Approach A class-per-moment and Approach B distributed).

**Named constants at top of AuthenticMode.ts (with history rationale):**
```
ALARM_SEED_MULT = 31           // deterministic seed transform for 1202 trigger
ALARM_SEED_MOD = 300           // range constraint (200..499 frames)
ALARM_SEED_OFFSET = 200        // earliest trigger frame (~3.3s at 60fps, post-spawn settle)
ALARM_LOCKOUT_FRAMES = 24      // ~400ms at 60fps — real Apollo 11 1202 lockout duration
ALTITUDE_ALARM_GATE_PX = 150   // 1202 fires only above this altitude; fast descents skip
ALTITUDE_BLACKOUT_AGL_PX = 50  // Armstrong lost altitude callouts for last ~25 feet
ELLIPSE_UPDATE_FRAMES = 15     // 4Hz at 60fps — deliberately non-laser-precise
MASTER_ALARM_GATE_PX = 150     // Apollo 15/17 audio cue fires once below this altitude

ERA_COLORS = {
  APOLLO_AMBER: "#ffb000",     // DSKY EL display reference
  ARTEMIS_CYAN: "#00ccff",     // 2028 tech aesthetic
  HAZARD_RED: "#ff3030"        // landing-ellipse danger color
}
```

**State shape (locked):**
```
FlightConfig = {
  authenticMode: boolean,
  authenticState: AuthenticState | null,  // null when mode OFF
}

AuthenticState = {
  era: "apollo" | "artemis",
  alarm?: { state: "IDLE" | "ARMED" | "ACTIVE" | "DONE", framesElapsed: number, scheduledFrame: number },
  masterAlarm?: { state: "IDLE" | "DONE" },  // Apollo 15/17 audio-only
  ellipse?: { lastUpdateFrame: number, touchdown: { x, y } | null },
  hazardMask?: Uint8Array,  // precomputed at mission start
}
```

**Input filter placement (locked):** Inside `Game.onFixedUpdate()` — specifically between `physicsInput = ...` (Game.ts:416–422) and `this.physics.step(..., physicsInput, ...)` (Game.ts:443). Concrete line:
```ts
physicsInput = applyAuthenticFilter(physicsInput, this.currentFlight?.authenticState ?? null);
```
**Zero-allocation OFF path:** `applyAuthenticFilter(input, null)` MUST return the same `input` reference (not spread). Only when `state.alarm?.state === "ACTIVE"` does it return `{ ...input, thrustUp: false }`. This keeps the OFF path byte-identical for allocation behavior (matters for determinism + GC-pressure baseline).

**Autopilot interaction (documented intent):** The filter runs AFTER `physicsInput = autopilot.computeInput(...)`, so when autopilot is ON and 1202 fires, autopilot's thrust is ALSO zeroed for the 400ms lockout. Real 1202 was a computer executive overload — it ignored inputs from whoever was flying. Documented as intended, not a bug.

**Storage shape (per-surface native — Codex tension A, eng-review-locked):**
- **`GhostReplay.ts`**: add `mode: "vanilla" | "authentic"` field to `GhostRun` interface. `loadGhostForSeed(seed, mode)` filters by both. Legacy GhostRun (no mode field) treated as `"vanilla"` on load. `exportGhost`/`importGhost` carry the mode through; import with no mode defaults to vanilla.
- **`Leaderboard.ts`**: change Record key from `String(seed)` to `` `${seed}-${mode}` ``. Legacy `String(seed)` entries remain readable; on first write, migration converts the record to the new key shape.
- **`MissionBriefing.ts`**: in-memory `briefingCache` cacheKey synthesis appends `authentic` flag. Cache invalidates cleanly across toggle changes.

**Fork-replay vanilla-lock (Codex tension 1B, eng-review-locked):** `startForkReplay` in StateHandlers sets `game.currentFlight = { authenticMode: false, authenticState: null }` unconditionally. Fork replays are ALWAYS vanilla — matches Sprint 3's existing gravity-lock pattern. Prevents the bug where toggling Authentic ON after capture would inject 1202 into playback and diverge physics.

**HeadlessGame / AI Theater isolation (eng-review-locked 1D):** `buildAuthenticState(mission, seed, isHeadless)` returns `null` when `isHeadless === true` OR when `!isHistoricMission(mission)`. HeadlessGame constructor sets `currentFlight = null`. Defense in depth — AI training paths cannot accidentally activate Authentic Mode.

**Tutorial overlay ownership (eng-review-locked 1G):** Add `game.tutorialOverlay: { missionId: string, framesRemaining: number } | null`. Initialized in `selectMission` when `authenticMode === true` AND `moonlander-authentic-intro-seen-{missionId}` is NOT set. `updateMenu` decrements `framesRemaining` each tick; blocks `menuSelect` while active. On `framesRemaining === 0` OR explicit dismiss, writes the seen-key and clears the overlay. Renderer reads `game.tutorialOverlay` on the mission-select screen. Overlay is mission-select scoped — never exists during flight.

**MASTER ALARM trigger (Apollo 15/17, eng-review-locked 1F):** Altitude-gated deterministic. Fires ONCE per flight when AGL first drops below `MASTER_ALARM_GATE_PX` (150 AGL). Audio-only via `playMasterAlarm()` in Audio.ts. No input lockout. State tracked as `authenticState.masterAlarm.state` ("IDLE" → "DONE").

## Slicing

**Part A — Toggle + Apollo 11 (~6h human / ~75–90 min CC):**
1. `Game.currentFlight: FlightConfig | null` state; `FlightConfig` constructed in `selectMission`, cleared on return-to-title
2. localStorage load/save for `moonlander-authentic-{missionId}` with try/catch
3. Mode suffix migration for ghost/leaderboard/briefing-cache keys → `{seed}-{mode}` (implicit vanilla migration for pre-5.5 keys)
4. StateHandlers `[A]` key context-scoped dispatch on historic mission-select; touch-zone button for mobile
5. Pre-launch tutorial overlay (mission-select, 3s, write-on-dismiss `moonlander-authentic-intro-seen-{missionId}`)
6. `src/game/AuthenticMode.ts` — pure functions: `buildAuthenticState`, `updateAuthentic`, `applyAuthenticFilter`, `isAltitudeBlackedOut`
7. Apollo 11 `ProgramAlarm`: deterministic scheduledFrame = `((seed * 31) % 300) + 200`, altitude-gate > 150px, skip-on-collision
8. HUD altitude blackout (trigger = true AGL via `Physics.getTerrainHeightAt`, display stays pixel-based)
9. HUD caption `AUTHENTIC 1969 TECH` in `#ffb000` amber
10. Synthesized 1202 alarm tone (~200ms warble via Audio class; no-op on suspended AudioContext)
11. Share card AUTHENTIC badge (era-colored corner)
12. MissionBriefing `authentic: true` plumbed; `eraOneLiner` field on `MissionFacts`; offline fallback appends; Apollo 11 line verified
13. Dual-track leaderboard display on mission-select (`BEST` + `BEST (AUTHENTIC)`) — storage already dual-tracked from item 3

**Part A tests (eng-review-locked: 4-file split):**
- `tests/authentic-regression.test.ts` — **3 CRITICAL regression tests** (per IRON RULE):
  1. OFF byte-identical: Apollo 11 seed 1969 + scripted 2000-frame input sequence, Authentic OFF → hash of (frame inputs + final lander state) matches pinned v0.5.7.0 fixture. Any drift in the OFF path breaks this.
  2. Fork replay vanilla-lock: toggle ON, fork a captured episode, verify replay runs with `authenticMode=false` and physics match original capture.
  3. 1202 skip-on-collision: seed + input sequence that arrives below `ALTITUDE_ALARM_GATE_PX` before `scheduledFrame` → alarm never fires, `state.alarm.state` stays IDLE (not ARMED), physics identical to a non-alarm-scheduled control seed.
- `tests/authentic-mode.test.ts` — unit tests for every AuthenticMode.ts function:
  - `buildAuthenticState`: null for non-historic / headless; deterministic Apollo/Artemis; alarm/masterAlarm/ellipse/hazardMask correctly shaped per era.
  - `updateAuthentic`: state machine IDLE→ARMED→ACTIVE→DONE, skip-on-collision, frames-elapsed counting, MASTER ALARM single-fire.
  - `applyAuthenticFilter`: null → same reference returned (zero-allocation proof); ACTIVE → `{...input, thrustUp: false}`; all other fields pass through.
  - `isAltitudeBlackedOut`: era gate (Apollo only), AGL threshold, defensive null-terrain.
  - `projectTouchdown`: NaN guard, upward-velocity null, happy parabola intersection, off-world null.
  - `buildHazardMask`: empty/flat/sloped terrain cases.
- `tests/authentic-integration.test.ts` — integration paths:
  - localStorage roundtrip happy path; SecurityError on load → default OFF; QuotaExceededError on save → warn, doesn't crash; corrupt JSON on intro-seen key → defaults to unshown.
  - Tutorial overlay lifecycle: construct on first-Authentic-flight, decrement in updateMenu, write seen-key on dismiss, skip on subsequent flights.
  - FlightRecorder share card: badge rendered when `currentFlight.authenticMode === true`, absent otherwise.
  - MissionBriefing authentic flag: cacheKey includes flag; offline fallback appends `eraOneLiner` when authentic ON.
- `tests/ghost.test.ts` (extended) — GhostRun `mode` field; legacy (no-mode) ghost treated as vanilla; `loadGhostForSeed(seed, mode)` filters by both; save writes mode; export/import roundtrips mode.
- **Manual PR-description checklist** (no formal LLM eval suite exists): run MissionBriefing with `authentic: true` for all four missions (Apollo 11/15/17, Artemis III), paste outputs in PR, human-verify each emphasizes era-tech AND is consistent with the corresponding `eraOneLiner` fallback.

**Pause-resume 1202 chaos test:** Deferred contingent on pause-system existence. Pre-implementation step: verify whether a pause feature exists in Game/status. If yes, write test; if no, omit and don't create pause-overlay interaction rules.

**Part B — Artemis III hazard-aware ellipse (~2h / ~20 min CC):**
1. `src/game/AuthenticMode.ts` extended: `buildHazardMask(terrain, threshold)`, `projectTouchdown(vx, vy, terrain)` (Number.isFinite guarded)
2. Renderer integration: `renderLandingEllipse(ctx, state, camera)` — amber default, red when projected touchdown slope > threshold
3. 4Hz update gate off physics frame count
4. Caption `AUTHENTIC 2028 TECH` in `#00ccff` cyan
5. Tests: projection determinism, hazard-coloring branch, 4Hz update interval, NaN-input skip

**Part C — Apollo 15 + 17 polish (~1h / ~10 min CC):**
1. Altitude blackout inherits automatically (Apollo era)
2. "MASTER ALARM" synthesized audio cue near final approach (softer — no input lockout)
3. `eraOneLiner` field populated for Apollo 15, Apollo 17, Artemis III in fact sheets

**Total:** ~9h human / ~105–120 min CC across one PR (or Part A first, B/C follow-up).

## Next steps
1. ~~Run `/plan-ceo-review`~~ — ✅ complete (SELECTIVE EXPANSION, Codex outside voice ran, 8 tensions resolved)
2. Run `/plan-eng-review .plans/sprint-5.5-authentic-mode.md` (required gate before implementation)
3. Branch `sprint-5.5/authentic-mode` off main after Sprint 2.7 PR #24 merges
4. Implement Part A first, playtest, then B and C

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | SELECTIVE EXPANSION. 14 proposals, 12 accepted (6 cherry-picks + 7 Codex-driven fixes, minus 1 duplicate), 1 deferred (upgraded in-review), 0 skipped. 0 critical gaps. |
| Codex Review | `/codex review` | Independent 2nd opinion (outside voice) | 1 | issues_found→resolved | 8 structural tensions surfaced: storage keying, state-boundary leak, 1202 collision rule, AGL vs pixel, tutorial collision, mobile gap, leaderboard comparability, Artemis scope. All 8 resolved via AskUserQuestion; plan + CEO plan updated. |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 11 issues surfaced, 11 resolved. 3 CRITICAL regression tests mandated (IRON RULE: OFF byte-identical, fork-replay vanilla-lock, 1202 skip-on-collision). Test plan artifact written to `~/.gstack/projects/`. |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | UI scope detected (mission-select indicator, HUD caption, landing ellipse, tutorial overlay). Recommend post-implementation `/design-review` on live site. |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | SKIPPED (solo dev, no DX surface). |

**CROSS-MODEL:** Claude + Codex agreed on 7/8 tensions; diverged on altitude metric (Claude: pixel for HUD consistency, Codex: AGL for physics correctness). Resolved via hybrid (AGL trigger + pixel display).
**UNRESOLVED:** 0.
**VERDICT:** CEO + ENG CLEARED — ready to implement. Branch `sprint-5.5/authentic-mode` off main after Sprint 2.7 PR #24 merges.
