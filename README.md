# MoonLander Enhanced

A browser-based, AI-enhanced reimagining of the 1979 Atari Moon Lander. Runs entirely in the browser. No install, no backend.

Current version: **v0.5.8.3** (see [`CHANGELOG.md`](./CHANGELOG.md)).

## What's interesting

- **Real lunar physics.** 1.62 m/s² gravity, rotational dynamics, fuel management. Land too fast or tilted and you crash.
- **Procedural terrain + seeded runs.** Same seed = same terrain. Share a URL, race the same map.
- **Historic missions.** Apollo 11, 15, 17 and Artemis III, each with accurate fuel budgets, lander stats, and radio chatter that fires on altitude and fuel events.
- **AI Theater.** Watch a DQN learn to land in real time at 50x speed, compare DQN vs policy gradient vs random, then fork any episode and try to beat the AI from that exact frame.
- **Smarter DQN (v0.5.8.0, Sprint 2.7).** Prioritized experience replay, 11-dim state vector with vertical acceleration and ground proximity, quality-scaled terminal reward. Agent learns to land in ~15 episodes instead of 40-60.
- **Hazards.** Alien UFOs that siphon fuel or reverse controls. Gravity storms. Fuel leaks. Lunar archaeology objects with Apollo-era trivia.
- **Ghost replays, leaderboards, shareable flight reports.** All client-side via localStorage + IndexedDB.

## Run it locally

```bash
npm install
npm run dev
```

Opens at `http://localhost:5173`. No API keys needed for core gameplay. Optional Claude API key in Settings unlocks dynamic mission briefings and post-flight coaching tips (rule-based fallback runs offline).

## Controls

- **Arrow keys or WASD** — rotate left/right, thrust
- **Space** — thrust (alt)
- **P** — toggle rule-based autopilot
- **A** — toggle autopilot annotation overlay
- **V** — toggle retro vector skin (1979 Atari look)
- **?** — compact vs expanded UI

## Project orientation

- **Code lives under `src/`** organized by concern: `game/`, `render/`, `ai/`, `systems/`, `api/`, `utils/`.
- **Full architecture + roadmap:** [`CLAUDE.md`](./CLAUDE.md) — the source of truth for project identity, tech stack, sprint plan, and gotchas.
- **Tests:** `npx vitest run` (219 tests). Types: `npx tsc --noEmit`. Lint: `npx biome check src/ tests/`.
- **Active plans:** [`.plans/`](./.plans/) — per-sprint plan files with CEO + Eng review reports.
- **Deferred work:** [`TODOS.md`](./TODOS.md).

## Status

Phases 1-3 shipped. Phase 4 (polish + shareability) mostly done. The "AI Theater First" long-term roadmap is mid-sprint, with Sprint 5 Part A (Historic Missions) shipped at v0.5.7.0, Sprint 2.7 (Smarter DQN) at v0.5.8.0, and Sprint 2.6 (AI Theater Explain Mode) Parts A+B+C at v0.5.8.1–v0.5.8.3. Next up: Sprint 5.5 (Authentic Mode).

## License

MIT — see `LICENSE` if present, otherwise assume MIT.
