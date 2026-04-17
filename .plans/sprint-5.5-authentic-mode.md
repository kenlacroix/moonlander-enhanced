# Sprint 5.5 — Authentic Mode (plan)

Status: CEO + Eng reviewed 2026-04-16 (CEO: SELECTIVE EXPANSION, 6 cherry-picks accepted, 8 Codex tensions resolved; Eng: 11 issues surfaced and resolved, 3 CRITICAL regression tests mandated). Re-scoped 2026-04-16 after /office-hours contextual-cockpit design: cockpit visual layer bundled into this sprint (Section 5) rather than shipping as separate Sprint 5.6 follow-up. Combined CC estimate: ~2.5-3.5h. Second CEO plan at `~/.gstack/projects/kenlacroix-moonlander-enhanced/ceo-plans/2026-04-16-sprint-5.5-cockpit-merge.md`. Ready to implement on branch `sprint-5.5/authentic-mode` (off main post-v0.5.8.0).

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

### 2.5. Contact light event (new, added when cockpit merged — Apollo 11/15/17)
- **Fires when** lander's lowest point is within `CONTACT_LIGHT_AGL_PX = 15` (~1m scaled) of pad surface, using true AGL from `Physics.getTerrainHeightAt` (same pattern as altitude blackout trigger).
- **One-shot per flight:** state `contactLight?: { state: "IDLE" | "DONE" }` on `AuthenticState`. Transitions IDLE → DONE on first fire. Never re-fires.
- **Audio:** new `Audio.playContactLight()` — short synthesized beep (Apollo lunar-contact tone style). Matches existing `playMasterAlarm`/`playProgramAlarm` per-event pattern.
- **Apollo 11, 15, 17** only (all pre-Artemis missions). Artemis III does not use contact light in this sprint (modern LM has different contact semantics; deferred as polish).
- **Deterministic:** trigger is a pure function of `(lander position, terrain)` which are both deterministic; no randomness.

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

### 5. Contextual Cockpit visual layer (Authentic ON) — merged from Sprint 5.6

*Bundled into this sprint 2026-04-16 per /plan-ceo-review Approach A, to avoid shipping a throwaway banner-callout intermediate version of Authentic Mode. Original design doc at `~/.gstack/projects/kenlacroix-moonlander-enhanced/ken-sprint-2.6-part-c-design-20260416-194223.md`. Sprint 8 3D cockpit remains separate and not replaced by this.*

**Rationale:** Sections 2-4 above introduce iconic events (altitude blackout, 1202 alarm, master alarm, hazard ellipse, contact light). Without the cockpit they surface as flat HUD banners. The cockpit is the natural visual home that gives these moments their emotional payload.

**Two-mode presentation (shared asset set):**

- **Mode 1 — Cinematic cut** (terminal events): touchdown, crash, contact-light illumination. Full-screen close-up of the relevant instrument for ~2-3 sec with 200ms crossfade in/out. Safe because flight is over or effectively over.
- **Mode 2 — PIP slide-in** (mid-flight events): 1202 alarm, altitude-blackout onset, altitude-blackout resolution, master alarm. Small ~220×160 panel slides from bottom-right corner (~200ms animation) for ~3 sec, then slides out. Sim view stays fully visible and interactive.

**Contact light event (new, deterministic):**
- Fires when lander's lowest point is within `CONTACT_LIGHT_AGL_PX = 15` (~1m scaled) of pad surface.
- Uses true AGL from `Physics.getTerrainHeightAt` (same pattern as altitude blackout in Section 2).
- Apollo 11 / 15 / 17 only. Artemis III does not receive contact light in this sprint (modern LM has different indicator semantics; deferred as polish).
- One-shot per flight (set a flag on the lander when fired).

**Slow-mo: CUT from scope** (eng-review-locked 2026-04-16):
- Decision: the PIP slide-in carries the cinematic payload on its own. Slow-mo added implementation risk (frame-skip logic in render loop) and test surface (the 4th regression test below) without clear user value.
- Consequence: the 4th regression test ("Cockpit slow-mo physics-determinism") is removed from the mandatory test list.
- If playtest shows a "moment needs to breathe" feel, revisit as a follow-up. Visual-only implementation via render frame-skip is documented as the preferred approach when it returns.

**Mobile fallback:**
- Cinematic cuts (Mode 1) preserved on mobile.
- PIP slide-in (Mode 2) suppressed on touch devices (220×160 on 375px is ~60% width — not a PIP, a takeover).
- Detection: same strategy as existing `AI Theater Mobile Responsive Fallback` TODO (P2). Likely UA-based or viewport-width threshold.
- On mobile during mid-flight events: fall back to Authentic Mode's banner callout (the "unbundled" version becomes the mobile presentation).

**Asset set (5 instruments, one style):**
- DSKY numerical display (noun/verb/program LED readout, green-on-black, monospaced)
- 8-ball attitude indicator (sphere, pitch/roll markings driven by `lander.angle`)
- Contact light bulb (off / green)
- Master alarm bulb (off / red)
- Radar altimeter bulb (off / amber / dark-during-blackout)

**Style: period-accurate Apollo LM** (amber + green-on-black, Apollo font where available). Retro-vector is *not* a separate asset set; if V-skin is active when a cockpit event fires, render the same assets through a vector render pass (P2 — ship only if retro+Authentic is a real usage combo).

**Accessibility:**
- Slide-in animation ON by default.
- New setting `Reduce motion` makes PIP appear instantly (no slide), respects `prefers-reduced-motion` CSS media query when set.

**Event collision rule (eng-review-locked 2026-04-16):**

Cockpit state shape added to `AuthenticState`:
```ts
type CockpitEvent =
  | "alarm-1202" | "altitude-blackout" | "master-alarm"  // mid-flight
  | "contact-light" | "touchdown" | "crash";              // terminal

cockpit?: {
  active: CockpitEvent | null,
  framesElapsed: number,
  isTerminal: boolean,  // derived from event type at activation
} | null

contactLight?: { state: "IDLE" | "DONE" }  // tracks one-shot firing
```

Rules (enforced in `updateAuthentic`):
1. Terminal events (contact-light, touchdown, crash) ALWAYS preempt any active mid-flight event.
2. Mid-flight events fire only when `cockpit.active === null`.
3. If two mid-flight events would overlap: second one is DROPPED (not queued). Keeps determinism trivial and the "rare-coincidence" case simple.
4. Cockpit state cleared to `null` on restart (StateHandlers `restartFlight`) alongside existing ghost-replay cleanup.

Retro-vector skin interaction: period-accurate cockpit always wins during event window (V-skin users who opted into Authentic get a temporary aesthetic mismatch — documented as intentional). Vector-variant render pass is deferred to TODOS as P2 polish.

**Renderer module (eng-review-locked 2026-04-16):**
- New file `src/render/CockpitRenderer.ts`, Canvas 2D, pure-function pattern mirroring `HUD.ts`.
- NOT shared with `AITheaterPanel.ts` — AI Theater is DOM-based (HTMLDivElement + child canvases); cockpit must draw inside the game canvas (same pipeline as HUD, terrain, lander) for correct compositing of cinematic crossfades and z-order.
- Signature: `renderCockpit(ctx, camera, authenticState, isTouchDevice): void`. Called from Renderer.ts render loop just before HUD draw. Early-return when no cockpit event is active (zero-allocation OFF path).
- Per-instrument draw functions (DSKY, 8-ball, contact-light, master-alarm, radar-altimeter) live in the same file.
- Mobile detection: reuse existing `Input.isTouchDevice` (src/systems/Input.ts:45). On touch, suppress Mode 2 (PIP) entirely; Mode 1 (cinematic cut) still runs.

**Kill gate (before writing cockpit code):**
- Produce 4 static Canvas-2D PNG mockups: contact light moment, 1202 alarm moment, altitude blackout onset, crash.
- Show side-by-side with current HUD banner version to 3 people.
- Rubric: "Which version makes you want to play Apollo 11 again?"
- If ≤1/3 prefer cockpit, ship Authentic Mode with banner callouts only (Sections 2-4 as-written, Section 5 cut).
- Cockpit code starts only if ≥2/3 prefer it.

**Cost:** ~60-90 min CC added on top of Sprint 5.5 base (~105-120 min), plus ~40 min CC for cockpit tests (14 new paths per eng review), total ~3-4h CC for combined sprint. Minus ~15 min saved by cutting slow-mo.

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
- **Cockpit slow-mo** (visual-only render frame-skip during PIP window): cut from this sprint's scope 2026-04-16 per eng review. Add only if playtest shows the moment "needs to breathe."
- **Cockpit retro-vector render pass**: if V-skin active when cockpit event fires, current behavior is period-accurate wins. Vector-style cockpit is P2 polish, add only if retro+Authentic combo gets real usage.
- **Artemis III contact light**: modern LM has different contact semantics; deferred to polish backlog. Contact light fires on Apollo 11/15/17 only this sprint.

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
- `tests/authentic-regression.test.ts` — **3 CRITICAL regression tests** (IRON RULE; 4th slow-mo test removed 2026-04-16 when slow-mo was cut from cockpit scope):
  1. OFF byte-identical: Apollo 11 seed 1969 + scripted 2000-frame input sequence, Authentic OFF → hash of (frame inputs + final lander state) matches pinned v0.5.7.0 fixture. Any drift in the OFF path breaks this.
  2. Fork replay vanilla-lock: toggle ON, fork a captured episode, verify replay runs with `authenticMode=false` and physics match original capture.
  3. 1202 skip-on-collision: seed + input sequence that arrives below `ALTITUDE_ALARM_GATE_PX` before `scheduledFrame` → alarm never fires, `state.alarm.state` stays IDLE (not ARMED), physics identical to a non-alarm-scheduled control seed.

- **`tests/cockpit.test.ts`** (new, eng-review-locked 2026-04-16 — 14 net-new paths):

  **CockpitRenderer unit tests:**
  - `renderCockpit(null authenticState)` → early return, zero canvas draw calls.
  - `renderCockpit` active terminal event → full-screen close-up drawn.
  - `renderCockpit` active mid-flight event + `isTouchDevice=false` → PIP slide-in drawn in bottom-right.
  - `renderCockpit` active mid-flight event + `isTouchDevice=true` → PIP suppressed (no draw calls for mid-flight mode).
  - Slide-in animation frame counter: PIP position interpolates over first ~200ms, holds, fades.
  - Per-instrument draw functions: DSKY digit rendering, 8-ball pitch/roll, contact-light bulb off→green, master-alarm off→red, radar altimeter tracking/dark states.

  **Cockpit event state machine (in `authentic-mode.test.ts`, extends existing file):**
  - Terminal event preempts mid-flight: simulate 1202 active, then contact-light triggers → `cockpit.active === "contact-light"`, previous state replaced.
  - Two mid-flight events: simulate 1202 active, then master-alarm triggers → second dropped (cockpit.active still `"alarm-1202"`).
  - Contact light deterministic: same seed + scripted inputs triggers contact light at same frame.
  - Contact light one-shot: `contactLight.state === "DONE"` after first fire; never re-enters IDLE.
  - Cockpit state cleared on restart: simulate active PIP mid-flight → call `restartFlight` → cockpit state is null on next frame.

  **Accessibility:**
  - `prefers-reduced-motion: reduce` set → PIP appears instantly, no slide animation (skip the 200ms interpolation).

  **Integration (in `authentic-integration.test.ts`, extends existing file):**
  - Apollo 11 Authentic ON full-flight happy-path: contact-light fires at touchdown, cinematic cut renders.
  - Event + AI Theater co-existence: AI Theater panel DOM + cockpit canvas render both visible, no z-order bug, cockpit draws on top of sim but below AI Theater DOM (AI Theater is DOM; cockpit is in-canvas, so z-order is natural).

  **Failure mode test:**
  - Cockpit restart mid-event: player hits R during PIP window → no visual artifact on next flight's first frame.
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
| CEO Review | `/plan-ceo-review` | Scope & strategy | 2 | CLEAR | Run 1: SELECTIVE EXPANSION, 12 accepted. Run 2 (2026-04-16): HOLD SCOPE, Approach A bundling — cockpit merged into Sprint 5.5 as Section 5. |
| Codex Review | `/codex review` | Independent 2nd opinion (outside voice) | 1 | issues_found→resolved | 8 structural tensions surfaced and resolved in Run 1. Run 2 (cockpit merge) skipped outside voice; re-run at next landing if architecture drifts. |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 2 | CLEAR | Run 1: 11 issues resolved, 3 regression tests. Run 2 (2026-04-16): 7 cockpit-layer issues resolved. Slow-mo cut; overlay corrected to new `CockpitRenderer.ts` (NOT shared with AITheaterPanel — different render paradigm); event state machine specified; contact-light event added; 14 new cockpit tests mandated. |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | UI scope now includes cockpit instruments. Recommend post-implementation `/design-review` on live site. |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | SKIPPED (solo dev, no DX surface). |

**CROSS-MODEL (Run 1):** Claude + Codex agreed on 7/8 tensions; diverged on altitude metric, resolved via hybrid (AGL trigger + pixel display).
**UNRESOLVED:** 0.
**VERDICT:** CEO + ENG CLEARED (both reviewed twice) — ready to implement. Branch `sprint-5.5/authentic-mode` off main (currently has 3 milestones already shipped: toggle, blackout, 1202). Remaining: Section 2.5 (contact light), Section 4 (Artemis ellipse), Section 5 (cockpit).
