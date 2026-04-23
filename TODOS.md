# TODOS — MoonLander Enhanced

Deferred work from CEO reviews (2026-04-13, 2026-04-14). Items not in current scope but worth tracking.

---

## P3 — Polish

### Sprint 5.5 follow-ups (from /review pre-ship audit)
Tracked from Pre-Landing Review against main on `sprint-5.5/authentic-mode` — accepted as defer, listed here so they don't get lost.

- **Run /codex review on the Sprint 5.5 diff once account reset window reopens** — adversarial 2nd opinion was blocked 2026-04-16 (account limit, reset 2026-04-20). Sprint is now shippable but the outside-voice pass hasn't happened.

### Add a favicon
Currently the browser console logs a 404 for `/favicon.ico`. Purely cosmetic but produces a console error on every page load.
- **Why:** Clean console on load; tiny branding win.
- **Effort:** XS (CC: ~5 min — SVG lunar lander silhouette or 1969 Apollo mission patch vibe)
- **Depends on:** Nothing

---

## P1/P2/P3 — Sprint 7.2 deferrals (CEO + adversarial review 2026-04-20)

### Luna 9 autopilot PID doesn't converge on this seed (MITIGATED 2026-04-23)
Luna 9 was `kind: "auto-landing"` with autopilot force-enabled from v0.5.9.1 through v0.6.2.1. Autopilot overshoots on luna-9's craft profile (thrust 0.85×, mass 0.7×) on seed 91966 — crashes at x=2177, vx=116 px/s at frame 262. Byte-identical crash across spawnY (40-100), fuel (500-800), RCS (80-120). Pure PID trajectory problem, not input starvation.
- **v0.6.2.1:** Unlocked `[P]` toggle so player could rescue. Insufficient — by the time overshoot is visible the lander is 18 px above terrain with vx=120, unrescuable.
- **v0.6.2.2:** Flipped the default. Autopilot starts OFF on Luna 9; player flies. `[P]` still engages the spectator demo mid-flight. Mission is now landable.
- **Real fix if desired:** Restoring the original spectator-mode intent requires either (a) autopilot PID retune for low-thrustMultiplier craft, (b) switch Luna 9 to a seed where autopilot converges (breaks share-URL determinism on seed 9_1966), or (c) autopilot's horizontal-velocity damping more aggressive when craft has low thrust authority.
- **Effort:** M (CC: ~30-60 min for autopilot retune + seed sweep)
- **Priority:** P3 (downgraded from P2 — functional now, just not the original vision)
- **Depends on:** Nothing. Standalone investigation.

### Sprint 7.2 mobile touch-input retest
Adversarial review flagged: new physics requires two-axis attitude management on mobile with no tactile feedback. After Sprint 7.2 PR 1 lands, retest via `/browse` on a mobile viewport. If feel regresses, options: "simple mode" toggle (heavier angular damping on touch), relaxed landing tolerance (`MAX_LANDING_ANGULAR_RATE = 16 °/s` on mobile), or the first-spin tutorial card is enough.
- **Why:** Mobile has 30%+ of sessions and new physics might be unplayable there.
- **Effort:** S (CC: ~30 min retest + ~30 min fix if needed)
- **Priority:** P1 after 7.2 ships
- **Depends on:** Sprint 7.2 PR 1 shipped

### Gravity-storm torque (Sprint 7.2 expansion #4, deferred)
Apply random angular impulse from gravity anomalies under rigid-body physics — today they only wobble terrain cosmetically. After rigid-body physics ships, this turns gravity storms into genuine attitude hazards. Defer until post-7.2 playtest so magnitude tuning has real feel data.
- **Why:** Makes an existing hazard threatening in a way that previously wasn't possible (no angular momentum existed).
- **Effort:** S (CC: ~20 min)
- **Priority:** P2
- **Depends on:** Sprint 7.2 rigid-body physics shipped

### Sprint 7.2.1 follow-up: Authentic-mode RCS flavor
Apollo 11 RCS quad failure events (per historical record — one quad was running lean). Apollo 13 Survive reworked around RCS-primary scoring (the mission was about attitude control!). Deferred from 7.2 base to keep the integrator-rewrite PR focused.
- **Why:** Authentic Mode gets richer, Apollo 13 Survive becomes genuinely about its historical problem.
- **Effort:** M (CC: ~30 min both missions)
- **Priority:** P2
- **Depends on:** Sprint 7.2 shipped

### "Dead Reckoning" achievement (Sprint 7.2 expansion #5, deferred)
Neil Armstrong landed Apollo 11 with legendary RCS efficiency. A badge rewarding the same. Land 3 consecutive missions without pressing rotate-left or rotate-right (or with 0 RCS consumed). Defer until post-7.2 so the threshold can be data-driven.
- **Why:** Gives players a reason to master the new physics beyond just surviving it.
- **Effort:** S (CC: ~15 min)
- **Priority:** P3
- **Depends on:** Sprint 7.2 shipped + enough playtest data to calibrate threshold

### Sprint 7.3 — Engine gimbal + center-of-mass shift (platonic physics)
Approach D from 7.2 CEO review. Real LM had gimbaled DPS engine; CoM shifts as fuel burns. Should happen only after 7.2 battle-tests the momentum foundation.
- **Why:** Platonic physics sim, Education Mode flagship demo.
- **Effort:** XL (CC: ~6-8 hr, two PRs)
- **Priority:** P3
- **Depends on:** Sprint 7.2 shipped + 1-2 weeks of playtest

### Sunset v2 ghost replay in Sprint 7.3+
Ghost v2 replay path (`updateLanderLegacy` + legacy landing check branch in CollisionHandler) is a permanent physics fork per Sprint 7.2. If no physics-affecting code touches it for 2 sprints, consider sunsetting: keep v2 leaderboard scores, drop replay capability (replaced by "legacy flight — score only").
- **Why:** Every future physics change has to be dual-implemented or explicitly broken. Tax compounds.
- **Effort:** S (CC: ~20 min)
- **Priority:** P3
- **Depends on:** Sprint 7.3 landing, 2+ sprints without touching the legacy path

---

## P2 — CEO Review Findings (2026-04-14)

### AI Theater Mobile Responsive Fallback
On narrow screens, stack AI Theater panels vertically or switch to sequential mode.
- **Why:** Split-screen doesn't work on mobile. Kill signal (sequential fallback) exists but needs explicit mobile detection.
- **Effort:** S (CC: ~30 min)
- **Depends on:** Sprint 2 (AI Theater MVP)

### Terrain Editor URL Param Validation
Validate/sanitize base64 custom terrain data from ?custom= URL parameter on deserialization.
- **Why:** Pre-existing security surface. Crafted URLs could cause unexpected behavior. Becomes more visible with URL sharing expansion.
- **Effort:** S (CC: ~30 min)
- **Depends on:** Nothing (can be done anytime)

### Service Worker Cache Verification Post-WebGL
Verify service worker network-first cache handles WebGL asset transition correctly.
- **Why:** Users on stale SW might see Canvas while new WebGL assets load.
- **Effort:** S (CC: ~15 min)
- **Depends on:** Sprint 6 (WebGL Visual Upgrade)

---

## P1 — Historic Missions (Sprint 5, CEO+Eng reviewed 2026-04-15)

### Sprint 5 Part A — Historic Missions foundations + Apollo + Artemis
Active plan at `.plans/sprint-5-apollo.md`. CEO plan at `~/.gstack/projects/kenlacroix-moonlander-enhanced/ceo-plans/2026-04-15-sprint-5-apollo.md`.
- **Scope:** Apollo 11/15/17 + Artemis III + mission chatter + "margin vs Armstrong" share card. Single PR.
- **Effort:** ~5h human / ~45-60 min CC.
- **Status:** ✅ SHIPPED v0.5.7.0 (PR #22, merged 2026-04-15).

### Sprint 5.5 — Authentic Mode (CEO reviewed 2026-04-16, Codex-challenged)
Active plan at `.plans/sprint-5.5-authentic-mode.md`. CEO plan at `~/.gstack/projects/kenlacroix-moonlander-enhanced/ceo-plans/2026-04-16-sprint-5.5-authentic-mode.md`.
- **Scope:** Per-mission Authentic toggle (default OFF) + Apollo 11 signature moments (altitude blackout via true AGL, 1202 alarm skip-on-collision) + Apollo 15/17 polish + Artemis III hazard-aware landing ellipse (fused from original ellipse+ribbon) + mobile touch toggle + dual-track leaderboard (`{seed}-{mode}` keyed).
- **Effort:** ~9h human / ~105-120 min CC across one PR.
- **Status:** CEO + Eng reviewed (0 unresolved; 3 CRITICAL regression tests mandated: OFF byte-identical, fork-replay vanilla-lock, 1202 skip-on-collision). Ready to implement on branch `sprint-5.5/authentic-mode` off main post-v0.5.8.0.

### Sprint 5.5 polish backlog (post-ship)
- **Standalone hazard ribbon overlay:** Sprint 5.5 fused ribbon into the landing ellipse (red on hazardous slope). If playtest shows fusion alone doesn't communicate "autonomous hazard detection" strongly enough, add a terrain-wide slope tint in a narrow altitude band. P2 post-5.5.
- **Authentic variants for deferred historic missions:** Apollo 12/14/16, Luna 9, Chang'e series, SLIM 2024, Chandrayaan-3. Each inherits era-specific signature moments from the AuthenticMode subsystem. Compounds as Sprint 5 Part B and beyond land more missions. P2.

### Sprint 5 Part B — Specialized mission types
Follow-up PR after Part A ships.
- **Scope:** Apollo 13 "Survive" (non-landing loop-around) + Luna 9 auto-landing.
- **Effort:** ~7h human / ~55 min CC.
- **Status:** ✅ SHIPPED v0.5.9.1 (alongside Sprint 5.5 polish + 2 /qa fixes).

### Deferred historic missions (post-Sprint 5)
Apollo 12, 14, 16; Luna 16 (sample return); Chang'e 3/4/5; SLIM 2024; Chandrayaan-3. Enable the "playable lunar museum" theme once the HistoricMission subsystem is battle-tested by Sprint 5.

---

## P3 — Pre-existing UX quirks surfaced during play-test (2026-04-16)

### Refresh drops player back into last-played mission (intentional, but surprising for dev)
`main.ts` reads `?seed=N` from the URL on load and `selectMission` in `src/game/StateHandlers.ts:272` writes the current mission's seed to the URL via `replaceState`. Shipping as designed for URL-encoded-seed sharing (Phase 4): a friend opens `?seed=1969` and lands in that mission. But when the developer refreshes their own tab mid-session, they get dropped back into the last mission instead of the title screen. Even refreshing during an AI Theater session pulls you into the AI's background-training seed. Workaround today: manually strip the URL to `localhost:5173/` before refresh.
- **Possible fix (small):** only auto-enter "playing" when the seed came from a shared link (e.g., sniff `document.referrer`, or require an explicit `?play=1` co-param), otherwise return to menu and pre-select that mission.
- **Possible fix (tiny):** make the menu's "Back to menu" / ESC path clear the `?seed=` query param, so the next refresh lands on the title screen.
- **Why it matters:** every new contributor will hit this on their first refresh after touching any mission.
- **Effort:** XS (CC: ~10 min for the tiny fix, ~20 min for the smarter one)

### ESC doesn't reliably return to menu
ESC works in some contexts but not others (user flagged as known). Needs a single unified handler in the input system that maps ESC → title screen from every non-critical state (playing, training, editor, AI theater, mission select, etc.).
- **Why it matters:** primary "get me out of here" affordance, broken.
- **Effort:** S (CC: ~20 min — thread an `escapeToMenu` action through `Input.ts` and each status handler)

---

## P2 — Sprint 2.6 Explain Mode — deferred findings (from /review on PR #28, 2026-04-16)

### Transfer DQN breakdown missing on non-Moon worlds
On Europa/Jupiter/etc., the transfer-DQN slot (Moon-trained policy adapting to the new world) runs through the non-DQN reward path, so `lastDqnBreakdown` never reflects it. The reward chart shows both DQN curves but the EXPLAIN overlay only mirrors the fresh DQN. A user watching a Jupiter transfer run sees a breakdown that doesn't correspond to the policy they're watching adapt.
- **Why:** Found by the adversarial subagent (confidence 6/10). Real gap, most visible when someone demos transfer learning.
- **Effort:** S (CC: ~20 min — track breakdown for both `agent === this.dqn || agent === this.transferDqn` with separate `lastDqnBreakdown` / `lastTransferBreakdown` fields and a panel label indicating which agent the current breakdown belongs to)
- **Natural home:** Sprint 2.6 Part C, since Part C is already touching the panel to add the first-run tutorial and `?` compact toggle.

### REWARD_COMPONENT_KEYS single source of truth
`RewardBreakdown` fields live in three places with no compile-time link: the TypeScript interface in `src/ai/AgentEnv.ts:141`, the per-step accumulator loop in `src/game/AITheater.ts:runEpisode`, and the `BREAKDOWN_ROWS` array in `src/ui/AITheaterPanel.ts:11`. Adding a new reward component to the interface won't trip the compiler at the other two sites — the overlay will silently skip it and the accumulator will drop it.
- **Why:** Found by the maintainability specialist twice (confidence 9/10). Only matters when someone extends `RewardBreakdown`, which isn't planned before a potential Sprint 2.8.
- **Fix sketch:** Export `const REWARD_COMPONENT_KEYS = [...] as const satisfies ReadonlyArray<Exclude<keyof RewardBreakdown, "total">>` from `AgentEnv.ts`. Drive the accumulator and `BREAKDOWN_ROWS` keys from it.
- **Effort:** S (CC: ~15 min)

### Color palette constants across AITheaterPanel
`#00ff88`, `#ff8866`, `#888`, `#333`, `#0d0d0d` repeat as inline hex literals across the panel. Any future theme work (light mode, accessibility palette) has to hunt string literals.
- **Why:** Flagged by the maintainability specialist (confidence 8/10). Out of Sprint 2.6 scope but good cleanup for a separate refactor.
- **Effort:** S (CC: ~20 min — pull into a `THEATER_COLORS` constant at the top of `AITheaterPanel.ts`)

### Codex second opinion on PR #28 (blocked by account usage limit)
`/codex review --base feat/sprint-2.6-explain-mode-part-a` hit "You've hit your usage limit" on 2026-04-16 (reset 2026-04-20 21:35). Run after the limit resets to get an independent cross-model review covering:
1. The claim that bypassing `agent.calculateReward` for DQN and calling `calculateRewardBreakdown` directly produces an identical training signal.
2. EXPLAIN toggle + localStorage persistence edge cases.
3. Drift between `RewardBreakdown` type and the 3 places it's referenced (ties into the `REWARD_COMPONENT_KEYS` item above).
- **Why:** The three focus areas above were already flagged by the Claude adversarial subagent during /review, but Codex provides a genuinely independent second model opinion the Claude passes can't replace.
- **Effort:** XS (CC: ~5 min once account resets)

---

## P1 — Deferred Cherry-Picks (post-v1.0)

### Daily Challenge — client-side shipped, backend open
Client-side version shipped 2026-04-15 (PR #14): UTC date (`YYYYMMDD`) as the seed, same terrain for everyone each day, scores bucket into the existing seed-keyed leaderboard automatically.

**Remaining (backend sync):** Shared cross-player leaderboard per day, name entry, and 24-hour reset visualization. Needs serverless backend (Cloudflare Workers or Vercel Edge) — blocked by hosting provider choice.

### Split-Screen Local Multiplayer
Two players, same terrain, side by side on one screen.
- **Why:** The ultimate "share with a friend" feature — literally play together.
- **Effort:** L (human: ~2 weeks / CC: ~2 hours)
- **Requires:** Split canvas viewport, dual input systems (WASD + arrows), independent lander physics, split HUD rendering.
- **Complexity:** CanvasRenderer needs viewport clipping. Camera system needs per-player tracking. Input.ts needs player ID routing.
- **Blocked by:** Game.ts decomposition should be complete first.

---

## P2 — Phase 6: Competitive Layer

### Global Leaderboard
Serverless API (same backend as daily challenge). Score + seed + ghost hash. No accounts.
- **Why:** Competition drives retention.
- **Depends on:** Daily challenge backend (shared infrastructure).

### Ghost Download from Leaderboard
Watch the #1 player's run before you try.
- **Why:** Learning from the best is compelling.
- **Depends on:** Global leaderboard API + ghost file storage.

### Seed-of-the-Week
Curated by LLM based on terrain interestingness (roughness variance, pad difficulty score).
- **Why:** Community engagement without user-generated content moderation.
- **Depends on:** Global leaderboard + LLM provider configured.

---

## P3 — Phase 7: Visual Upgrade (WebGL)

PixiJS WebGL renderer swap-in (game logic untouched per IRenderer pattern).
- Bloom shader on thruster plume and landing pad beacons
- Heat distortion shader behind engine bell
- Normal mapping on terrain surface
- Dynamic sun lighting per mission
- Lander spotlight on final approach
- 10x particle count via WebGL particle containers
- Camera trauma system for screen shake

**Why:** Makes it look like a real game. Portfolio differentiator.
**Effort:** XL (human: ~1 month / CC: ~6-8 hours across multiple sessions)
**Risk:** PixiJS v8 API differs from v7 tutorials. WebGL context loss handling needed.

---

## P3 — Phase 8: Audio Evolution

- Procedural ambient radio chatter (seeded beeps, static, garbled transmissions)
- Heartbeat audio synced with descent rate
- Doppler effect on thruster hum
- Per-mission musical key (each seed generates different tritone root)
- Spatial audio (Web Audio panning) for aliens, wind, terrain proximity

**Why:** Sound design becomes the game. Close your eyes and feel the tension.
**Effort:** L (human: ~2 weeks / CC: ~3-4 hours)

---

## P2 — Phase 9: Multiplayer

### WebRTC Peer-to-Peer Multiplayer (no server needed)
Two browsers connect directly via WebRTC DataChannel. Same seed = same terrain, so only input frames (~20 bytes/sec) need syncing. Opponent renders as translucent lander reusing the ghost replay rendering pipeline.
- **Why:** The ultimate "play with a friend" feature. Zero infrastructure cost. Works offline after connection.
- **Effort:** M (human: ~1 week / CC: ~30 min)
- **Signaling options:** Copy-paste offer/answer strings (zero infra, ugly UX), or lightweight relay via Cloudflare Worker (~20 LOC) or PeerJS free tier for room codes.
- **Key advantage:** Deterministic physics means brief disconnections can replay from last known inputs without desync.
- **~200 LOC** game-side. Reuses ghost rendering pipeline for opponent lander.
- **Blocked by:** Game.ts decomposition (cleaner to integrate after split).

### Other Multiplayer Modes
- Async multiplayer via WebSocket: see other players' landers as real-time ghosts
- Race mode: same seed, first to land wins, visible timer
- Sabotage mode: interference powers using alien effect system

**Effort:** XL for the full suite. WebRTC P2P is the minimum viable multiplayer.
**Depends on:** WebRTC P2P as foundation. WebSocket modes need serverless backend from Phase 6.

---

## P3 — Phase 10: Education Mode (partial — sandbox + annotated autopilot in v1.0)

Remaining items after cherry-picks ship:
- Orbital mechanics intro: start from orbit, deorbit burn, two-phase landing
- Real Apollo mission replays: recreate Apollo 11's descent as a playable mission
- RL agent explainer: visualize neural network weights, animate reward signal

**Why:** Teaches real physics. Differentiator from other lander games.
**Effort:** L per feature.

---

## P3 — Phase 11: Platform

- Mission SDK: JSON schema for user-created missions
- Plugin system for custom lander types, skins, effects
- Classroom mode: teacher creates mission sets, students compete
- Headless simulation API for RL agent benchmarking

**Why:** "People build things you didn't plan."
**Effort:** XL. Architecture design needed.
**Risk:** Over-engineering for a solo project. Only pursue if there's community demand.

---

## Completed

### v0.6.0.0 milestone + backlog polish
**Completed:** v0.6.0.0 (2026-04-19). MINOR bump marking Sprint 6 complete (Parts A+B+C shipped this session). Removed dead Part B scaffolding (`EllipseState`, `hazardMask`, `ELLIPSE_UPDATE_FRAMES`) that was populated but never consumed. Noted that the "hoist leaderboard reads out of renderMenu hot path" TODO was based on outdated info — Sprint 5.5's in-memory cache already makes repeated `getBestScore` calls O(1), not O(localStorage).

### Sprint 6 Part C — Mission sun + crash feedback
**Completed:** v0.5.9.4 (2026-04-19). Per-mission sun discs in the skybox (Apollo 11 / 15 / 17 / Artemis III / Luna 9 each get their own angle), bigger crash shake (15 → 40), bright impact flash (0.6 α fading over 30 frames) on pad crashes, survive-timeouts, and AI-replay crashes. Closes out Sprint 6's "WebGL visual upgrade" arc.

### Sprint 6 Part B — Scene-wide bloom + Canvas default + tablet/UX fixes
**Completed:** v0.5.9.3 (2026-04-19). `AdvancedBloomFilter` attached to the texture-sprite pipeline; every bright pixel in the scene glows on the WebGL path. Canvas 2D became the default backend with WebGL opt-in via `?renderer=webgl` (real-world testing showed WebGL context loss on tablets where TF.js grabs a second context). Plus a bundle of fixes from hands-on play testing: title-screen box clipping, altitude-chart vs FLIGHT-ANALYSIS overlap, campaign-progression CTA visibility, AI-Training main-thread yields to avoid Firefox "page is slow" warnings.

### Sprint 6 Part A — WebGL foundation
**Completed:** v0.5.9.2 (2026-04-18). `IGameplayRenderer` extract + PixiJS v8 `WebGLGameplayRenderer` (texture-sprite approach) + automatic Canvas fallback + `?renderer=canvas` debug override + dual-canvas DOM. Parts B (shader effects) and C (lighting + screen shake) remain in the active roadmap.

### Sprint 5 Part B — Specialized mission types
**Completed:** v0.5.9.1 (2026-04-18). Apollo 13 Survive + Luna 9 auto-landing shipped alongside Sprint 5.5 polish.

### Sprint 5.5 polish batch (Part B PR)
**Completed:** v0.5.9.1 (2026-04-18). Shipped alongside Sprint 5 Part B.
- ✅ Fill 4 test coverage gaps (master-alarm, `isAltitudeBlackedOut` boundary, MissionBriefing authentic cache-key, ghost mode-scoped save)
- ✅ Replace `#ffb000` / `#00ccff` literals with `ERA_COLORS` (CanvasRenderer, FlightRecorder, HUD)
- ✅ Extract shared `localStorage` test polyfill (`tests/helpers/localStorage.ts`)

### /qa fixes on the Sprint 5 Part B diff
**Completed:** v0.5.9.1 (2026-04-18). Two SHOULD-FIX items from prior /review.
- ✅ Embed/shared-URL with historic seed now routes through `selectMission` (Luna 9 autopilot engages on `?seed=<luna9>&embed=1`)
- ✅ `handleSurviveSuccess` honors `currentFlight.authenticMode` for leaderboard slot routing (mirrors `handleCollisionResult`)
