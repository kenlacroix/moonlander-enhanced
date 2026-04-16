# Sprint 2.7 — Smarter DQN (plan)

## Goal
Make the DQN agent visibly smarter, faster. Right now it crashes ~50 times before stumbling into its first landing, and even after 100+ episodes the behavior looks random for too long. A viewer watching AI Theater should see the agent "get it" within 15-20 episodes and then refine its approach — not flail for 50 episodes then suddenly land once by accident.

**Exit question:** Does watching the DQN learn feel like watching something figure it out, or like watching a random number generator get lucky?

## Why now

- Sprint 2.6 (Explain Mode) makes the learning process visible — but if the process itself is weak, explaining it just highlights how weak it is. "The AI sees 8 numbers and crashes 50 times" is not a good demo.
- The educational pitch ("TensorFlow Playground for RL") only works if the RL is compelling. Fast, visible learning is the hook.
- Every improvement here compounds: transfer learning (Sprint 4) is more interesting when the base Moon policy is actually good. Fork replay (Sprint 3) is more interesting when the AI's trajectory is worth forking from.

## Root causes (from playtest observation)

### 1. Reward shaping too sparse
Current: +100 land, -100 crash, ~+0.6 shaping per step. The shaping signal is tiny relative to the terminal rewards and doesn't clearly guide the agent toward "slow down near the pad." Most episodes end in crash → gradient says "everything was bad."

### 2. No prioritized experience replay
Current: uniform sampling from 20,000-entry buffer. The rare "almost landed but crashed at 2.1 m/s" frame is sampled at the same rate as 19,999 "falling through empty space" frames. The most informative experiences are the rarest.

### 3. State vector missing key information
Current 8-dim state: [dx-to-pad, altitude, hvel, vvel, angle, angular-vel (unused!), fuel, pad-center-ratio]. Missing:
- Vertical acceleration (is the agent braking or not?)
- Distance to ground directly below (not just pad-relative altitude)
- Velocity direction relative to pad (approaching or drifting away?)
- Time-to-impact estimate at current vvel

Angular velocity (dim 5) is always 0 — wasted dimension.

## Scope

### 1. Reward function overhaul
Replace the current weak shaping with a structured, human-readable reward:

```
REWARD PER STEP:
  +0.5 × (1 - normalized-distance-to-pad)      ← "get over the pad"
  +0.3 × (1 - normalized-altitude) × proximity  ← "descend while near pad"
  +0.3 × safe-speed-bonus                       ← "keep vertical speed manageable"
  -0.5 × angle-penalty                          ← "stay upright" (stronger than current -0.3)
  +0.2 × approach-velocity-bonus                ← "move toward the pad, not away"
  -0.02 × time-tax                              ← "don't hover forever" (doubled)

TERMINAL:
  +200 × landing-quality                        ← scaled by speed+angle+centering (not flat +100)
  -100 crash
```

Key change: terminal landing reward scales with quality so the agent learns GOOD landings, not just any landing. And shaping is ~2× stronger so the gradient signal is meaningful before the first landing.

### 2. Prioritized Experience Replay (PER)
Replace uniform sampling with proportional PER:
- Each experience gets a priority = |TD-error| + small epsilon
- Sampling probability proportional to priority^alpha (alpha=0.6)
- Importance-sampling weights correct for the non-uniform distribution (beta annealing from 0.4 to 1.0)
- Sum-tree data structure for O(log N) sampling

This makes "I almost landed but crashed" experiences get replayed ~10× more often than "I was falling through empty space" experiences. The agent focuses on its mistakes.

### 3. State vector expansion (8 → 11 dimensions)
Add 3 new dimensions:
- **Vertical acceleration** (current vvel - previous vvel) — "am I braking?"
- **Ground proximity** (terrain height directly below, not pad-relative) — "how close is the ground?"
- **Approach velocity** (dot product of velocity with direction-to-pad, normalized) — "am I heading toward the pad?"

Fix: actually populate angular velocity (dim 5) instead of hardcoding 0.

### 4. Training hyperparameter tuning
- **Epsilon decay**: 0.995 → 0.99 (explore more aggressively early, exploit sooner)
- **Target network update**: TAU=0.005 with soft update every 500 steps → TAU=0.01 every 200 steps (faster target convergence)
- **Batch size**: 64 → 128 (more stable gradients)
- **Learning rate**: 0.0005 → 0.001 with linear decay to 0.0001 over 200 episodes

### 5. Network architecture (optional)
Current: 64→64→4 (linear output). Consider:
- **Dueling DQN**: split final layer into value stream + advantage stream. Often learns faster because value and advantage are separate. Small code change (~20 lines).

## Out of scope
- Curriculum learning (start with easy terrain, progress to harder) — good idea but requires HeadlessGame to support dynamic difficulty mid-training
- Double DQN (use online network for action selection, target network for evaluation) — moderate lift, diminishing returns if PER is already in
- Actor-critic methods (A2C/PPO) — different algorithm family, not a DQN improvement
- Multi-step returns (n-step DQN) — nice-to-have, defer

## Architecture notes
- State vector expansion requires updating `STATE_SIZE` constant, `getState()` in AgentEnv, and both the DQN model architecture (input shape) and the Policy Gradient model. Existing saved weights in IndexedDB will be incompatible — migration strategy: detect old weights (wrong input shape), discard, and retrain from scratch. One-time cost.
- PER's sum-tree is ~80 lines of self-contained code. Replaces the flat array in RLAgent.memory. No external dependency needed.
- Reward breakdown (Sprint 2.6) benefits from the structured reward — each component is already named.

## Success criteria
- DQN achieves first landing within 15-20 episodes (currently ~40-60)
- DQN achieves consistent landings (>50% success rate) within 50 episodes (currently ~100+)
- AI Theater viewers see visible "getting smarter" behavior: early episodes crash randomly, mid episodes approach the pad but overshoot, late episodes land smoothly
- Policy Gradient also benefits from reward shaping (same calculateReward used)
- No regression in existing game behavior (reward function only affects AI training, not player scoring)

## Risks
- **Reward shaping can create local optima** — if we reward "being near pad" too strongly, the agent might learn to hover near the pad forever instead of landing. Mitigation: time-tax + terminal reward scaling.
- **PER adds complexity** — sum-tree is well-understood but still 80 more lines of code to maintain. Mitigation: clean implementation, unit-tested.
- **State expansion breaks saved models** — existing IndexedDB weights won't load with new input shape. Mitigation: catch the shape mismatch, log a warning, retrain from scratch. Players lose their trained agent but training is fast (~2 min to first landing with improved reward).
- **Hyperparameter sensitivity** — changes to LR, epsilon decay, batch size interact nonlinearly. Mitigation: test against a fixed seed, compare learning curves before/after.

## Slicing

**Part A — Reward shaping + state expansion (~3h human / ~30 min CC):**
1. Overhaul `calculateReward` and `calculateRewardBreakdown` in AgentEnv.ts
2. Expand `getState` from 8→11 dims; fix angular velocity
3. Update `STATE_SIZE` constant, DQN model input shape, PG model input shape
4. Weight migration: detect shape mismatch on load, discard + retrain
5. Tune epsilon decay and target network update rate
6. Tests: reward function unit tests, state vector shape tests

**Part B — Prioritized Experience Replay (~2h / ~20 min CC):**
1. `SumTree` data structure (~80 lines)
2. Replace RLAgent.memory flat array with PER buffer
3. TD-error tracking during trainBatch
4. Importance-sampling weight correction
5. Tests: SumTree operations, PER sampling distribution

**Part C — Dueling DQN + hyperparameter polish (~1h / ~10 min CC):**
1. Split final layer into value + advantage streams
2. Batch size 64→128, learning rate schedule
3. Benchmark: fixed-seed learning curve comparison (before/after)

**Total estimated:** ~6h human / ~60 min CC across one PR.

## CEO + Eng Review Decisions (2026-04-15)

1. **Approach A accepted** — full plan (reward + PER + state expansion + dueling). HOLD SCOPE mode.
2. **Implement reward overhaul AS the breakdown function** — `calculateRewardBreakdown()` from Sprint 2.6 becomes the primary implementation. `calculateReward()` is a thin wrapper: `.total`. DRY across both sprints.
3. **PG model must also update to 11-dim input** — not just DQN.
4. **Weight migration: log console warning** on shape mismatch, don't silently fail.
5. **SumTree determinism deferred** — current DQN already uses Math.random; seeded PER sampling can wait until deterministic replay is needed.
6. **16 test paths identified** across reward, state vector, SumTree, PER integration, dueling, and weight migration.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR | HOLD SCOPE: Approach A (full plan). 5 findings (2 arch, 1 error/rescue, 1 code quality, 1 perf). 16 test paths. 0 critical gaps. |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | SKIPPED (no UI scope) |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**VERDICT:** CEO CLEARED. Eng review recommended before implementation (PER + state expansion touch hot paths that previously had TF.js bugs). Run `/plan-eng-review .plans/sprint-2.7-smarter-dqn.md`.
