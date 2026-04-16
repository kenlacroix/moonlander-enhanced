# TODOS — MoonLander Enhanced

Deferred work from CEO reviews (2026-04-13, 2026-04-14). Items not in current scope but worth tracking.

---

## P3 — Polish

### Add a favicon
Currently the browser console logs a 404 for `/favicon.ico`. Purely cosmetic but produces a console error on every page load.
- **Why:** Clean console on load; tiny branding win.
- **Effort:** XS (CC: ~5 min — SVG lunar lander silhouette or 1969 Apollo mission patch vibe)
- **Depends on:** Nothing

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

### Deferred historic missions (post-Sprint 5)
Apollo 12, 14, 16; Luna 16 (sample return); Chang'e 3/4/5; SLIM 2024; Chandrayaan-3. Enable the "playable lunar museum" theme once the HistoricMission subsystem is battle-tested by Sprint 5.

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
