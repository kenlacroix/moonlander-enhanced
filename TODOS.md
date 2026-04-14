# TODOS — MoonLander Enhanced

Deferred work from CEO review (2026-04-13). Items not in current scope but worth tracking.

---

## P1 — Deferred Cherry-Picks (post-v1.0)

### Daily Challenge
One shared seed per day, 24-hour leaderboard reset at midnight UTC.
- **Why:** Makes the game a daily ritual, not a one-time visit. High shareability.
- **Effort:** M (human: ~1 week / CC: ~30 min)
- **Requires:** Serverless backend (Cloudflare Workers or Vercel Edge). API for daily seed + score submission + leaderboard fetch.
- **Game-side:** ~200 LOC. Seed fetched from API on title screen. Leaderboard view for daily scores. No accounts, just player name.
- **Blocked by:** Need to choose hosting provider and set up backend. No backend exists today.

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
