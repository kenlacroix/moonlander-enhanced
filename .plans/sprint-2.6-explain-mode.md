# Sprint 2.6 — AI Theater Explain Mode (plan)

**Status (2026-04-16):** Parts A + B shipped.
- Part A — AI VISION strip + AGENT_META registry → v0.5.8.1 (PR #27, merged `d9d743e`).
- Part B — Reward breakdown overlay + EXPLAIN toggle → v0.5.8.2 (PR #29, merged `4dc80af`).
- Part C — first-run tutorial + `?` compact toggle + E1/E2/E3 polish → remaining.
- Deferred findings from A+B (transfer DQN on non-Moon worlds, REWARD_COMPONENT_KEYS drift, Codex re-run) tracked in `TODOS.md` as the natural home for Part C to pick up.

## Goal
Turn AI Theater from "look, RL is happening" into "now I understand what RL is." Right now a viewer sees colored curves climbing and a percentage counting down, but can't tell you what the AI sees, what it's optimizing, or why one algorithm beats another. This sprint makes those three things concrete and visible.

**Exit question:** Can someone with zero RL background watch AI Theater for 60 seconds and leave knowing (a) what the AI sees, (b) what the AI is trying to maximize, and (c) why the three learning curves look different?

## Why now

- Sprints 2-4 built the RL infrastructure (DQN, Policy Gradient, Random baseline, transfer learning, fork replay).
- Sprint 5 shipped content (historic missions).
- The "educational differentiator" is the actual unique pitch for this project versus "another lunar lander clone." Right now AI Theater is closer to a benchmark than a teaching tool.
- Every piece needed for instructional value already exists in code — state vector is computed, reward function is computed, algorithm differences are implemented. The UX just doesn't surface them.

## Scope

### 1. Live "AI VISION" strip
A horizontal strip below the reward chart showing the 8-dimensional state vector in real time, labeled for humans.

```
AI VISION (what the DQN sees this frame):
  DIST-TO-PAD  ██████░░░░  +0.6
  ALTITUDE     ████████░░  +0.8
  H-SPEED      ██░░░░░░░░  +0.2
  V-SPEED      ██████░░░░  +0.6
  ANGLE        ░░░░░█░░░░  +0.0  ← upright
  ANGULAR VEL  ░░░░░█░░░░  +0.0
  FUEL         ███████░░░  +0.7
  PAD CENTER   ████░░░░░░  +0.4
```

Updates at reduced frequency (~2 Hz) to stay readable. Sampled from the currently-displayed DQN episode — the one driving the on-screen bar chart. Makes the input to the policy concrete.

### 2. Reward breakdown overlay
Per-episode breakdown below the "DQN LAST" cell showing what the episode actually scored, with each reward component as a signed contribution:

```
LAST EPISODE REWARD: +34.2
  + 18.4  proximity to pad
  + 12.1  descent progress
  +  5.2  safe vertical speed
  -  1.3  angle penalty
  -  0.2  time tax
```

Source: a new `rewardDebugBreakdown` that the DQN episode tracks as it sums components. Off by default, toggled on via an "EXPLAIN" button in the panel so it's never hiding the chart from users who don't care.

### 3. Algorithm cards
Inline one-liner under each legend entry explaining the strategy in plain language:

```
● DQN            Remembers 20,000 past attempts; replays them to learn.
● DQN (Moon→here) Started with Moon-trained memory; adapting to this world.
● Policy Gradient Doesn't remember — just adjusts after each full attempt.
● Random          Doesn't learn. Acts as a floor for comparison.
```

Always visible. Fits existing AGENT_LABELS pattern — add AGENT_DESCRIPTIONS registry in `Agent.ts`.

### 4. First-run EXPLAIN tutorial (one-time)
On first AI Theater open (detected via localStorage flag), show a 3-panel inline tutorial that walks through:
1. "This chart shows each AI's score over time"
2. "This strip is what the AI sees right now"
3. "This breakdown is the score it's trying to maximize"

Skippable, dismisses on click, never reappears. Non-blocking.

### 5. `?` toggle for compact mode
Power users and the space-saving case: press `?` (or click a small info icon in the panel header) to collapse AI VISION + reward breakdown into the condensed pre-Sprint-2.6 panel. Preference persisted in localStorage.

## Out of scope (deferred to backlog)

- Neural network weight visualization (animating layer weights during training) — cool but 2× the work and more advanced than the target audience needs
- Full glossary overlay (DQN, REINFORCE, epsilon, replay buffer with worked examples)
- Player-side education mode (force vectors during player flight) — stays in Sprint 10 scope
- Interactive "what if" knobs (let the viewer change the reward function and watch it re-train) — Sprint 11 territory
- Per-action Q-value exposure ("it chose THRUST with Q=8.2 vs NOTHING Q=3.1") — requires RLAgent API changes to expose prediction tensors; nice-to-have

## Architecture notes

- AI VISION strip pulls from `EpisodeRecorder.currentPositions` lookup at ~2 Hz; state vector reconstruction is free since `getState(lander, terrain)` is already pure.
- Reward breakdown requires instrumenting `calculateReward` in `AgentEnv.ts` to return a breakdown object instead of a scalar. DQN / PG / Random's existing scalar contract preserved; new debug path only active when AI Theater panel is mounted.
- AGENT_DESCRIPTIONS registry mirrors AGENT_LABELS — additive, zero behavior change for training.
- Panel width may need to expand from 360 → 400 px, or we accept vertical stacking. Check on narrow viewports (TODO mobile responsive is already logged).

## Risks

- **Information overload.** Adding 3 new UI blocks to a 360px panel could feel like a dashboard instead of a game. Mitigation: `?` toggle + first-run tutorial for new viewers + default-compact for returning.
- **Panel width clash.** Current 360px right-side panel narrows main canvas. Making it 400px or wider hurts gameplay real-estate. Mitigation: default keeps 360 with bars that auto-scale; expand only when user opens a collapsed section.
- **Reward breakdown accuracy.** Instrumenting `calculateReward` risks diverging the debug view from the actual training signal. Mitigation: single source of truth — breakdown struct feeds both the scalar sum (for training) and the panel display.
- **Tutorial fatigue.** First-run walkthroughs that block the screen are hated. Mitigation: inline cards, no modal, dismisses on any interaction, never reappears.

## Success criteria

- A non-RL viewer can answer "what does the AI see?" after 60 seconds
- A non-RL viewer can answer "what is the AI trying to maximize?" after 60 seconds
- A non-RL viewer can state one difference between DQN and Policy Gradient after 60 seconds
- No regression in training speed (state-vector reads must not saturate the main thread)
- First-run tutorial shows once, never blocks, fits on 360px panel without scroll
- Existing AI Theater flows (chart click, REPLAY & FORK, WATCH DQN) still work

## Slicing

**Part A — AI VISION strip + algorithm cards (~2h human / ~20 min CC):**
1. `AGENT_DESCRIPTIONS` registry in `Agent.ts` — one-liner per kind
2. `AITheaterPanel.drawVisionStrip()` — 8 labeled bars, 2Hz refresh
3. Panel layout: fit between chart and fork panel; auto-shrink on narrow viewport
4. Legend extension: render description under each AGENT_LABELS entry

**Part B — Reward breakdown + EXPLAIN toggle (~1.5h / ~15 min CC):**
1. `calculateRewardBreakdown()` in `AgentEnv.ts` returning `{ total, components: {...} }`
2. DQN records per-episode breakdown; panel reads via `AITheater.getLastBreakdown()`
3. EXPLAIN button in panel header — toggles breakdown visibility
4. localStorage preference `moonlander-explain-mode` = on/off

**Part C — First-run tutorial + polish (~1h / ~10 min CC):**
1. localStorage flag `moonlander-ai-theater-tour-seen`
2. 3 inline tutorial cards, each dismissible
3. QA pass: fresh browser, confirm tutorial appears once, dismisses cleanly, doesn't block clicks
4. Short "?" keyboard shortcut to toggle compact mode

**Total estimated:** ~4.5h human / ~45 min CC across one PR (or two if we split A+B from C).

## Eng Review Decisions (from CEO review session 2026-04-15)

1. **calculateRewardBreakdown** returns `{ total, components }` — training path uses `.total`, panel reads `.components`. Debug flag gates allocation so hot path stays scalar-only.
2. **AGENT_META collapse** — AGENT_LABELS + AGENT_COLORS + AGENT_DESCRIPTIONS merged into a single `AGENT_META: Record<AgentKind, { label, color, description }>`. DRY.
3. **AI VISION sampling** uses `requestAnimationFrame` throttled to ~2Hz (skip frames), not `setInterval`, so it naturally defers when frame budget is exhausted.
4. **Default expanded on first visit** (tutorial shows), persisted compact/expanded state for returning viewers.
5. **Test requirements:** (a) `calculateRewardBreakdown().total === calculateReward()` parity test, (b) localStorage flag prevents tutorial re-display.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | SCOPE EXPANSION: 4 proposals, 3 accepted (E1 random badge, E2 hover tooltips, E3 first-landing glow), 1 deferred (E4 live retrain → own future sprint). Collapsed AGENT_META registry. |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 1 | CLEAR | 2 findings (AGENT_META collapse accepted in CEO, reward breakdown approach confirmed), 7 test paths mapped, 0 critical gaps. |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**VERDICT:** CEO + ENG CLEARED — ready to implement. Reward breakdown approach confirmed (parallel function, debug-flag gated). AGENT_META collapse approved. 7 test paths identified. No critical gaps.
