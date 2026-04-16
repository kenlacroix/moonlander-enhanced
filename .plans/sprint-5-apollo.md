# Sprint 5 — Historic Missions (plan)

Status: CEO-reviewed 2026-04-15 (SCOPE EXPANSION mode, Approach C + 4 expansions accepted)

## Goal
Ship a playable museum of lunar exploration — Apollo + Artemis + Luna 9 + Apollo 13 survive — with authentic moment-markers that answer the sprint exit question ("would a space nerd share this?") through distinctive, comparable, share-worthy mechanics rather than just authentic flavor text.

**Exit question:** Would a space nerd share this with every space nerd they know?

## Scope (after CEO review)

### Missions (6 total, across 3 mission types)
- **Apollo 11** (landing) — Sea of Tranquility, 1969. Signature moment: Armstrong's ~22-second fuel margin.
- **Apollo 13 "Survive"** (non-landing) — 1970 loop-around-the-moon. Score on return-trajectory quality, not landing.
- **Apollo 15** (landing) — Hadley Rille, 1971. Signature feature: rille canyon near pad.
- **Apollo 17** (landing) — Taurus-Littrow Valley, 1972. Signature feature: valley walls.
- **Luna 9** (auto-landing) — Soviet 1966, first-ever soft lunar landing. Player spectates; game autopilots.
- **Artemis III** (landing) — Projected 2028, south polar region near Shackleton crater.

### New subsystems
1. **`HistoricMission` type** — extends `Mission` with `facts`, `moments[]`, `type: "landing" | "survive" | "auto-landing"`.
2. **Terrain `specialFeature` hook** — post-pass on `generateTerrain` for rille (Apollo 15) and valley (Apollo 17). Rille carves a narrow V trench; valley raises walls either side.
3. **Moments-as-Achievements** — extend the shipped Achievements subsystem with per-mission moment unlocks ("matched Armstrong's margin", "landed in Hadley Rille", "Shackleton rim touchdown").
4. **Mission Control chatter** (`src/api/MissionChatter.ts`) — LLM streams 2-4 short radio callouts during descent reacting to flight state (altitude, fuel, angle). Offline fallback is rule-based.
5. **Shareable scorecard** — extends `FlightRecorder` canvas-card to render a "your margin vs Armstrong" PNG card for any historic landing.

### Data / infra
- `src/data/apolloMissions.ts` — 3 landings + Apollo 13
- `src/data/artemisMissions.ts` — Artemis III
- `src/data/lunaMissions.ts` — Luna 9
- `LanderTypes.ts` — Apollo LM, Artemis LM, Luna-9 lander
- Title screen new row: **HISTORIC MISSIONS** (sibling to Free Play / Campaign / Daily / AI Theater)
- Mission select grouped by era: 1960s Soviet / 1960s-70s Apollo / 2020s Artemis
- Regression test pinning non-historic terrain determinism (since `specialFeature` touches `generateTerrain`)
- Briefing + chatter offline fallback (facts-only render, rule-based chatter) so no-API-key players get the full experience

## Source-of-truth model (LLM briefings)
Hybrid fact sheet + LLM stylizer. `src/data/*Missions.ts` holds verified facts per mission (date, crew, coordinates, descent altitude, fuel remaining, notable moment). The prompt template feeds those facts to the LLM with the instruction "use only these numbers/names, but write it like NASA mission control radioing the pilot." Voice is free, facts are locked. Offline fallback renders the fact sheet directly as a scrolling briefing. No API key still gets a complete experience.

## Historical terrain profile model
Hand-crafted evocative profiles, not satellite-accurate. Each mission has a fixed seed + `DifficultyConfig` override + optional `specialFeature`. A geologist won't be fooled; a space nerd will recognize the flavor. This is deliberate — real LROC heightmaps is a month of work with uncertain payoff vs the characterful hand-crafted version.

## Spacecraft accuracy model
Per-mission constraints via existing `DifficultyConfig` (fuel, spawnY, padWidth), plus one shared `apollo-lm` LanderType with mass/thrust roughly matching the real descent stage. Apollo 11 gets tight fuel. Apollo 15 gets extended-LM generosity. Artemis gets modern constraints. Luna 9 gets its own lightweight lander type. Per-mission LanderType variants (J-mission extended LM mass, etc.) deferred — we stay within the shipped physics engine.

## Risks (from CEO review)
- **Scope is large:** 6 missions + 4 subsystems. ~14h human / ~2-2.5h CC across two PRs. Split into Part A (landings + chatter + share card) and Part B (Apollo 13 Survive + Luna 9 auto-landing).
- **Apollo 13 complexity:** "Survive" mode is a new physics path. Simplify to a 2D "curve around, hit target altitude at Earth intercept" variant rather than a full orbital sim.
- **Moment tuning:** Armstrong's 22-second margin is famously tight. Moments are *bonus* achievements; landing on-pad scores normally so players don't crash-and-churn.
- **Chatter token cost:** LLM on every flight = API bill concern. Mitigation: offline rule-based fallback; chatter opt-in via LLM config.
- **Terrain engine change:** `specialFeature` hook touches load-bearing `generateTerrain`. Needs regression test.
- **Playtest debt:** Sprints 3+4 aren't playtested. Sprint 5 Part A stacks on them. Playtest 3+4 before merging Part A.

## Out of scope (deferred to TODOS.md / backlog)
- Apollo 12, 14, 16 (remaining Apollo landings)
- Luna 16 (sample return), Chang'e 3/4/5, SLIM 2024, Chandrayaan-3
- Satellite-accurate terrain from LROC heightmaps
- Real-trajectory overlay vs your flight path
- Polish bundle: NASA crew photos, historical landing quotes, Apollo DSKY HUD skin, era-appropriate audio tint, lunar-contact beep

## Recommended slicing

**Part A (first PR):** Foundations + Apollo landings + Artemis III + chatter + share card
1. `HistoricMission` type + facts schema (~30 min)
2. Apollo + Artemis LM lander types (~15 min)
3. `specialFeature` terrain hook (rille / valley) (~45 min)
4. 3 Apollo landings + Artemis III data + DifficultyConfig (~45 min)
5. HISTORIC MISSIONS title row + mission select (~45 min)
6. MissionBriefing `historicalContext` extension (~30 min)
7. Moment-markers via Achievements (~45 min)
8. Shareable comparison card (E4) (~30 min)
9. MissionChatter streaming during descent + offline fallback (~60 min)
10. Regression test for terrain determinism (~15 min)
11. Playtest + tuning pass (~45 min)

**Total Part A:** ~5 hours human / ~45-60 min CC

**Part B (follow-up PR):** Specialized mission types
1. Apollo 13 Survive mode (simplified 2D return-trajectory variant) (~4 hours human / ~30 min CC)
2. Luna 9 auto-landing (autopilot-driven spectator mission) (~3 hours human / ~25 min CC)

**Total Part B:** ~7 hours human / ~55 min CC

**Grand total:** ~12 hours human / ~2 hours CC across two PRs.

## Next step
Before implementation, run `/plan-eng-review` on Part A specifically. CEO review locked scope and strategy; eng review locks architecture, error paths, tests, observability.

## Eng Review Decisions (2026-04-15)

Run of `/plan-eng-review` locked these architectural choices:

1. **`HistoricMission` is a discriminated union** on `kind: "landing" | "survive" | "auto-landing"`. Landing missions have `facts + moments[]`; survive missions have `facts + targetTrajectory`; auto-landing missions have `facts + autopilotProfile`. Compile-time safety prevents "Apollo 13's missing `moments[]`" bugs.
2. **`Game.missionMode` is orthogonal to `lander.status`.** `missionMode: "landing" | "survive" | "auto-landing"` defaults to `"landing"` for all non-historic missions (set in `reset()` from `activeMission.kind`). `onFixedUpdate` branches on `missionMode` for win/lose logic; `lander.status` still represents physical lander state. Clean separation: status = lander, missionMode = rules.
3. **Moments implemented as mission-scoped Achievement IDs.** Extend the existing static `ACHIEVEMENTS[]` registry with entries like `{id: "apollo-11-margin", name: "ARMSTRONG MARGIN", description: "..."}` and pass `missionId` into `checkLandingAchievements` so mission-scoped checks only fire on their mission. No parallel unlock subsystem.
4. **MissionChatter is event-triggered, not continuous.** Fire one chatter line per trigger event: flight start, altitude < 1000m, altitude < 200m, fuel < 15%, fuel < 5% (Armstrong callout), horizontal drift, landing, crash. Debounce (don't refire). Offline fallback: same trigger map, fixed strings from fact sheet.
5. **Extract `src/api/streamingLLM.ts`** (~30 lines) — shared pipe used by both `MissionBriefing` and `MissionChatter`. DRY.
6. **Offline fallbacks are in scope, not polish.** Both briefings and chatter must work with no API key. Critical gap otherwise (silent LLM junk → broken UX).
7. **Terrain regression test is required.** Before landing the `specialFeature` hook in `generateTerrain`, add a pin-test for seeds 1969, 4217, 7001 asserting byte-identical output when no `specialFeature` set. Prevents silently breaking all existing missions.
8. **`MAX_FLIGHT_DURATION` timeout for Apollo 13 Survive** (Part B). Prevents infinite hover-in-zero-g. Mirrors existing `MAX_STEPS_PER_EPISODE`.

### Failure-mode gaps flagged (must be in plan, not implementation notes)
- `MissionChatter` network timeout → offline rule-based fallback must fire
- `MissionBriefing` LLM returns junk/refusal → fact-sheet fallback must render
- `specialFeature` out-of-bounds on small terrain → clamp to terrain width

### Post-Sprint-5 TODO (user-accepted)
- Add to `TODOS.md` during implementation: "Lightweight LLM eval harness for Briefing + Chatter prompts." Becomes valuable once HistoricMission subsystem has 6+ missions.

## Parallelization

| Lane | Steps | Notes |
|---|---|---|
| Lane A (seq) | 1 (HistoricMission type + data files) → 4 (title row/select) → 5 (MissionBriefing) → 6 (Moments) → 7 (Share card) | Depends on step 1 type |
| Lane B (parallel) | 2 (LanderType entries) + 3 (specialFeature terrain hook) | Independent |
| Lane C (after A) | 8 (MissionChatter) | Depends on 5's streamingLLM extract |

**Conflict flag:** steps 6 and 7 both touch the landing-result pipeline (`CollisionHandler` + `FlightRecorder`). Run sequentially within Lane A.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | SCOPE EXPANSION: 4 proposals, 4 accepted, 0 deferred. Approach C + "playable lunar museum" reframe. |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 3 arch findings (1 decision locked: missionMode orthogonal; 2 stated fixes), 5 code quality fixes, 22 test paths mapped (2 regressions, 3 critical gaps with fallbacks now in scope), 2 perf concerns mitigated. |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**UNRESOLVED:** 0

**VERDICT:** CEO + ENG CLEARED — ready to implement. Recommend Part A first (foundations + landings + chatter + share card), Part B follow-up PR (Apollo 13 Survive + Luna 9). Playtest Sprints 3+4 before merging Part A (they're stacked unplaytested).

