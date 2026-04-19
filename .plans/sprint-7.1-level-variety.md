# Sprint 7.1 — Level Variety (plan)

Status: **CEO-reviewed 2026-04-19 in SCOPE EXPANSION mode.** 5/5 expansion opportunities accepted. Cross-model adversarial review caught 5 gaps, all resolved below. Ready for /plan-eng-review, then implement.

## Context

Hands-on play testing surfaced a real product problem: **every level feels about the same**, even across Free Play's 10 seeds, Campaign's 5 escalating missions, and the 5 shipped Historic missions (Apollo 11 / 15 / 17 / Artemis III / Luna 9). Apollo 13 Survive is the one outlier because the mode itself is different.

### What actually varies today (audit of 2026-04-19)

Per-mission `DifficultyConfig` exposes 12 dials (roughness, pad width/count, fuel, spawnY, wind, lander type, aliens, gravity storms, crevices, specialFeature rille/valley). All are **parameters on the same midpoint-displacement algorithm**. Different seeds produce different shapes but the same character: rolling grey hills with configurable jaggies. Two special-feature archetypes exist out of ~15 missions.

### What doesn't vary at all

Terrain color, sky color, starfield, Earth position, terrain algorithm, world dimensions, audio signature, and background parallax. Every mission lives in the same visual and auditory environment.

### Why the roadmap didn't cover this

Sprint 4 Part B (deferred): per-world color palette + sky tint. Sprint 9 (AI visual layer): AI-generated terrain *textures* via image API, wrapping the same flat geometry. Deferred historic missions: LROC heightmap accuracy. None address terrain *archetypes*. This sprint fills that gap.

## Goal

Kill the "every level feels the same" complaint. After this sprint, a player should experience multi-dimensional variety per mission: different geometry (archetypes), different color (palettes), different sound (audio motifs), different narrative (LLM-generated on Random), and different moments (hidden-pad reveals). Plus an infinite "Random Mission" mode for long-term replayability.

**Exit question:** Can a new player, shown 5 seconds of gameplay from each of 3 random missions, correctly identify that they're different places without reading the HUD name?

## Accepted scope (CEO review — EXPANSION mode)

The plan originally proposed 4 tiers with a recommendation of T1+T2 only. CEO review in EXPANSION mode surfaced 5 expansion opportunities; all 5 accepted. Full scope:

| # | Feature | Tier | Effort |
|---|---|---|---|
| 1 | Per-mission `TerrainPalette` (terrain/sky/starfield colors + density) | T1 | ~30-45 min |
| 2 | 5 terrain archetypes (`rolling` / `crater-field` / `spires` / `mesa` / `flats`) | T2 | ~1.5 hr |
| 3 | "Random Mission" procedural generator with LLM narrative + offline fallback | T4 | ~90-120 min |
| 4 | Dust plume reveals hidden elevated pad at low AGL (triple score) | T3 delight | ~20 min |
| 5 | Per-archetype palette default bias (crater→red, spires→blue-grey, etc.) | — | ~15 min |
| 6 | Per-archetype audio motif in adaptive soundtrack | — | ~30-40 min |
| 7 | Archetype + palette encoded in share URL (base64, seed + cfg) | — | ~15 min |

**Total effort:** ~4-5 hr CC, suggested split into 2 PRs (foundations first, generator second).

## Scope tier notes (for reference)

### Tier 1 — Per-mission visual palette

**Data model:**
```typescript
export interface TerrainPalette {
  terrain: string;       // main polygon fill
  terrainEdge: string;   // outline
  sky: string;           // opaque background clear
  starDensity?: number;  // multiplier on starfield count, default 1.0
  starTint?: string;     // default white
  accent?: string;       // optional pad beacon override
}

export interface Mission {
  // ...existing fields
  palette?: TerrainPalette;
}
```

### Tier 2 — Terrain archetypes

**Data model:**
```typescript
// DifficultyConfig addition
archetype?: "rolling" | "crater-field" | "spires" | "mesa" | "flats";
// specialFeature (rille | valley) overlays ON TOP of archetype.
```

**Archetype behaviors:**
- **`rolling`** (default, = current midpoint displacement)
- **`crater-field`**: 8-15 circular depressions, varying radius 20-80 px, rim highlights. Avoids pad zones.
- **`spires`**: 3-6 narrow peaks (8-20 px wide, 100-200 px tall) inserted between pads.
- **`mesa`**: 2-3 wide raised plateaus (200-400 px wide, 80-120 px tall). Opportunity for elevated pads on top.
- **`flats`**: very low roughness (0.1) + 3-5 boulder clusters (2-4 boulders each, 10-25 px radius).

**Archetype generators share a helper** `findFreeColumnsBetweenPads(pads, minWidth)` for pad-avoidance logic. Each generator is O(n) in terrain points.

### Tier 4 — Random Mission procedural generator

New title-screen option: `RANDOM MISSION`. Click → `MissionGenerator.generate()` synthesizes a fresh `DifficultyConfig` and Mission:
- Random archetype from available set
- Random palette (from curated bank or procedurally tinted)
- Random lander from LANDER_TYPES
- Random hazard combination (wind/alien/gravity-storm/crevices/fuel-leak)
- LLM narrative via `LLMProvider.fetchBriefing(customPrompt)`
- Seed derived from `Date.now() * 7919` (prime, collision-resistant)

**LLM fallback:** on any failure (no API key, timeout >5s, parse error, refusal), use a seeded template bank: `[archetype] + [noun] → "Crater Hevelius", "Ridge Aristarchus", "Plateau Copernicus"`. Narrative template: `"Drift ${x}, ${place}. ${fuelWord} propellant. Watch the ${hazard}."`

### Delight: hidden pad

At lander AGL < 100px, a dust plume effect reveals a pre-generated hidden pad. If the player lands on the hidden pad, score × 3 + `HIDDEN PAD BONUS` toast. Pad location is deterministic from seed. **Excluded from historic missions** (see Risk #3 below).

### Per-archetype palette bias

Each archetype has a default palette hint:
- `crater-field` → `{terrain: "#7a4a3a", sky: "#0a0505"}` (rust-red, volcanic)
- `spires` → `{terrain: "#5a6270", sky: "#020610"}` (cold blue-grey)
- `mesa` → `{terrain: "#a89878", sky: "#1a0e05"}` (warm tan, desert)
- `flats` → `{terrain: "#9a9a9a", sky: "#000000"}` (neutral grey)
- `rolling` → `{terrain: "#9a9a9a", sky: "#000000"}` (default)

Mission-specific palette overrides the archetype default. Archetype default overrides the system default (`COLOR_TERRAIN` / `COLOR_TERRAIN_EDGE`). One unified helper: `resolvePalette(mission, archetype)`.

### Per-archetype audio motif

Each archetype gets a 2-3 bar motif layered into the adaptive soundtrack:
- `rolling` → current music (no change)
- `crater-field` → low drone + scattered percussion
- `spires` → sparse high-register bell pattern
- `mesa` → warm layered pad
- `flats` → subtle ambient hum

Web Audio synth only. No new assets.

### Share URL encoding

`?seed=X&cfg=<base64>` where `cfg` encodes a minimal `{archetype, palette}` struct. Decoded config applies on load. **2KB cap** on decoded size (security). Unknown values fall back to defaults silently (see Gap #1 below).

## Mission assignment (final)

| Mission | Archetype | Palette | Dust pad | Why |
|---|---|---|---|---|
| TRANQUILITY BASE | flats | default grey | — | "Learn the controls" — flat + boulders matches description |
| SEA OF STORMS | rolling | default | optional | Middle-of-the-road |
| COPERNICUS CRATER | crater-field | archetype default red | optional | Name literally describes it |
| other freeplay | mixed per seed | mixed | optional | Free Play variety |
| Apollo 11 | rolling | `#9a9a9a` grey | **EXEMPT** | Sea of Tranquility historically is rolling; historic accuracy |
| Apollo 15 | rolling + rille | `#8a8a92` blue-grey | **EXEMPT** | Hadley Rille is the story |
| Apollo 17 | rolling + valley | `#a89878` warm tan, `#1a0e05` sky | **EXEMPT** | Taurus-Littrow valley is the story |
| Artemis III | mesa | `#4a5058` blue-grey shadow, `#020a14` polar midnight, 2x stars | **EXEMPT** | Shackleton rim is raised-plateau |
| Luna 9 | crater-field | `#787878` darker grey | **EXEMPT** | Ocean of Storms is maria with crater scatter |
| Apollo 13 (survive) | — | — | — | No landing |
| Campaign 1-5 | flats → crater-field → spires → mesa → rolling | mixed | optional | Deliberate escalation |

**Acknowledged risk (from outside-voice review):** 3 of 5 historic missions stay `rolling` (Apollo 11/15/17), so archetype alone barely diversifies the most-replayed content. Historic variety comes from palette + sun angle (Sprint 6 Part C) + audio motif + chatter (Sprint 5.5). Player-perceived variety is still multi-dimensional. If post-launch play testing shows this is insufficient, revisit in a later sprint.

## Gap fixes (from outside-voice adversarial review)

Five gaps surfaced by the adversarial plan review. All resolved:

### Gap 1: leaderboard key collision for Random Missions

**Problem:** Leaderboard keyed `{seed}-{mode}`. Random Mission generates a different `DifficultyConfig` per seed click (different archetype, lander, hazards), so two seed-42 runs can have wildly different difficulty yet share a leaderboard. Invalid comparison.

**Fix:** Random Missions are **excluded from the leaderboard** entirely. Rationale: infinite variety by definition has no shared frame of reference. Random Mission flights still record to a separate "last random flight" slot for the share card (no persistence beyond the session). Leaderboards remain meaningful for the 15+ curated missions. The share URL and LLM narrative give Random Missions their own identity that leaderboards would dilute.

### Gap 2: ghost replay determinism hole (USER DECISION)

**Problem:** Ghost replay stores input frames keyed by seed but doesn't snapshot terrain config. With archetypes + palettes, a ghost recorded before Sprint 7.1 replays onto newly-generated terrain and the lander desyncs visually (or physically if archetype shifts geometry).

**Fix (user-accepted option A):** Embed full `DifficultyConfig` snapshot in every ghost payload. Playback uses the embedded config, not the current mission config. Pre-7.1 ghosts get marked `legacy` (schema version bump), a one-time `"Your saved ghosts may replay incorrectly. Re-record recommended."` notice appears at first launch post-upgrade, and legacy ghosts are still playable but with a visual warning overlay.

**Implementation:** `GhostReplay.ts` gains a `schemaVersion: 2` field and `config: DifficultyConfig` on saved ghost payloads. `loadGhost()` detects pre-v2 entries and sets `legacy: true`.

### Gap 3: AI Training weight key collision

**Problem:** DQN weights stored in IndexedDB keyed `{seed}-{gravityPreset}`. Random Mission changes archetype + lander without changing seed or gravityPreset, so the trainer loads wrong weights into a different world.

**Fix:** Random Mission **disables DQN weight loading**. Each Random session starts with fresh weights (or falls back to the agent's in-memory state, never persists). Rationale: Random is for variety, not training. AI Training mode remains gated to its fixed seed (1969) and is unaffected. AI Theater mode also remains on its fixed seed.

**Alternatively considered:** extending the IndexedDB key to include archetype + landerType. Rejected as complexity creep — no benefit for the Random use case.

### Gap 4: Daily Challenge archetype derivation

**Problem:** Daily Challenge seeds from UTC date. If archetype is selected outside that derivation, yesterday's daily is non-reproducible (retry for a friend gets different terrain).

**Fix:** Daily Challenge derives archetype from UTC date hash: `archetypeIndex = hashDate(utcDate) % ARCHETYPE_COUNT`. Same date → same archetype → same terrain → reproducible. Palette derived similarly.

### Gap 5: Dust-plume hidden pad breaks historic margin scoring (USER DECISION)

**Problem:** Apollo 11 share card compares your landing margin to Armstrong's 22-second fuel reserve. A player who finds a hidden elevated pad (triple score) would post inflated margins that misrepresent the historical comparison.

**Fix (user-accepted option A):** Historic missions are **exempt** from the hidden-pad reveal. Hidden-pad generator only runs on freeplay + campaign + Random Mission. Apollo/Artemis/Luna scoring stays historically honest. Checked via `isHistoricMission(mission)`.

## Deliverables

### Code changes (by module)

**New files:**
- `src/game/MissionGenerator.ts` — procedural config synthesis (T4)
- `src/game/terrain/archetypes.ts` — 5 archetype generators + shared pad-avoidance helper
- `src/render/palette.ts` — `resolvePalette(mission, archetype)` hierarchy resolver

**Modified:**
- `src/game/Missions.ts` — `Mission.palette?` field + freeplay palette population
- `src/game/Terrain.ts` — `DifficultyConfig.archetype?` + dispatch to archetype module
- `src/render/Background.ts` — accept palette, read sky/star config
- `src/render/CanvasRenderer.ts` — terrain draw uses resolved palette
- `src/render/IGameplayRenderer.ts` — `drawTerrain` + `drawBackground` signatures extend to carry palette
- `src/data/*.ts` — apolloMissions, artemisMissions, lunaMissions populate palette + archetype
- `src/systems/GhostReplay.ts` — schema v2 with embedded config (Gap 2)
- `src/systems/Leaderboard.ts` — Random missions excluded from addScore (Gap 1)
- `src/ai/RLAgent.ts` — disable weight load for Random Missions (Gap 3)
- `src/game/Missions.ts` — daily-challenge archetype derivation (Gap 4)
- `src/game/Artifacts.ts` or new module — hidden-pad generator with historic-exempt check (Gap 5)
- `src/systems/Audio.ts` — per-archetype motif dispatch
- `src/game/StateHandlers.ts` — title-screen RANDOM MISSION option + handler
- `src/main.ts` — parse `?cfg=` base64 param alongside `?seed=` (URL share)

### Tests (target: +~37 tests, 279 → ~316)

- 25 archetype tests (5 per archetype × 5 archetypes: existence, pad avoidance, count-in-range, determinism, spawn-not-inside-feature)
- 3 palette resolution tests (mission > archetype > system hierarchy)
- 5 MissionGenerator tests (happy path, LLM timeout, parse fail, missing key, retry-loop guard)
- 3 share URL tests (encode→decode round-trip, unknown archetype defaults, oversized URL rejection)
- 1 ghost schema v2 test (legacy ghost loads as `legacy: true` with warning)

### Regression pin (hard requirement)

`tests/terrain-regression.test.ts`: seeds 1969, 4217, 7001 with `archetype: undefined` + `palette: undefined` produce **byte-identical** terrain to v0.6.0.0. Kills the sprint if it fails.

## Data migration

- Additive data model (palette, archetype both optional with safe defaults).
- Ghost schema v1 → v2: lazy on load, no blocking migration.
- localStorage schema: unchanged for leaderboard (Random missions don't write). Ghost schema additive.

## Deployment

Pure additive. Canvas default + WebGL opt-in behavior from v0.6 unchanged. Feature flag not needed.

## Success criteria

1. `npx vitest run` passes all existing (279) + new archetype/generator/ghost tests.
2. Regression pin for seeds 1969/4217/7001 byte-identical to v0.6.0.0.
3. Browse-smoke-test all 5 archetypes: visibly distinct at the same seed.
4. Browse-smoke-test all 5 historic-mission palettes: visibly distinct sky+terrain.
5. Random Mission button loads a generated mission with LLM narrative OR fallback.
6. Share URL round-trip: copy a random seed+cfg, paste, get identical mission.
7. Ghost schema migration: old ghost loads with `legacy` warning, replays without crash.
8. Historic missions: hidden pad NOT revealed on Apollo 11/15/17/Artemis III/Luna 9.
9. Random Missions DO NOT write to leaderboard.
10. Daily Challenge: same date → same archetype + palette + terrain.

## What's NOT in scope

- In-flight events beyond dust plume (moonquake geometry shift, solar flare HUD jam). Separate future sprint.
- Dynamic daily-random challenges beyond archetype derivation (e.g., "today's challenge is always spires").
- AI-generated terrain textures (Sprint 9 / Phase 3 graphics). Different axis — textures skin bitmaps, archetypes shape geometry.
- LROC heightmap accuracy for historic missions. Deferred polish.
- Extending palette to GravityPresets (Mars/Jupiter/Europa terrain + sky tint). Nice-to-have; separable.

## PR split recommendation

- **PR 1 (~2.5 hr CC):** T1 palettes + T2 archetypes + per-archetype palette bias + per-archetype audio + dust-plume hidden pad (with historic exemption). All foundations. Shippable on its own.
- **PR 2 (~2 hr CC):** T4 Random Mission generator + share URL encoding + ghost schema v2 + leaderboard exclusion + daily-challenge archetype derivation + DQN key collision fix.

PR 2 depends on PR 1 but PR 1 stands alone if PR 2 hits an unexpected snag.

## Exit question (reprise)

Can a new player, shown 5 seconds of gameplay from each of 3 random missions, correctly identify that they're different places without reading the HUD name?

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | EXPANSION mode, 5/5 expansions accepted; 5 adversarial gaps surfaced and resolved |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | Codex CLI unavailable; Claude adversarial subagent substituted (5 gaps, all resolved) |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | Not yet run — required before implementation |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | Recommended before implementation (UI scope includes RANDOM MISSION button, hidden-pad visual, archetype visual cues on mission-select) |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | Optional — no external dev surface |

**OUTSIDE VOICE (Claude subagent, substituted for Codex):** Found 5 gaps the CEO review missed:
1. Leaderboard collision — resolved by excluding Random from leaderboard
2. Ghost replay determinism — resolved by schema v2 + legacy flag
3. DQN weight key collision — resolved by disabling weight load for Random
4. Daily Challenge reproducibility — resolved by hash-derived archetype
5. Hidden-pad vs historic margin scoring — resolved by exempting historic missions

**UNRESOLVED:** 0 decisions.

**VERDICT:** CEO CLEARED — ready for /plan-eng-review. Recommended: run /plan-eng-review next to lock architecture + test plan before implementation.
