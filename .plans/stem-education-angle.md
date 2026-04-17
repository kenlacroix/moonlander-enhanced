# STEM Education / Public Learning Angle

**Status:** plan — two sprints (Part A ready anytime, Part B after Sprint 6).

*CEO-reviewed 2026-04-16 in SCOPE EXPANSION mode. Split into A (sharp, near-term positioning push) + B (platform play), sequenced. CEO plan at `~/.gstack/projects/kenlacroix-moonlander-enhanced/ceo-plans/2026-04-16-stem-education-angle.md` (pending writeup).*

## The thought

MoonLander Enhanced sits at the intersection of physics, game dev, and AI/ML — all concrete, all playable, all in the browser with no install. That's a rare combination. But the right framing isn't "STEM classroom tool" (a market-segment framing that needs gatekeeper buy-in). It's **"the TensorFlow Playground of reinforcement learning, except it's a game."** One URL, 60 seconds to understanding, immediate play. CLAUDE.md's long-term vision states this directly — this plan operationalizes it.

The audience wedge, narrowed:

- **Primary:** self-directed learners — high schoolers with a laptop, CS undergrads, curious adults on HN / r/MachineLearning / X.
- **Downstream (Part B):** hackathon participants, capstone students, university RL courses.
- **Not the entry point:** K-12 teachers. That's a gatekeeper-heavy channel. Worth revisiting only once Part A has demand signal.

## Why it fits (what's already shipped)

- **AI Theater + Explain Mode.** The DQN-learning-in-real-time panel, the reward-breakdown overlay (Sprint 2.6B), the AI VISION strip (Sprint 2.6A). That's the 60-second hook.
- **Multi-world physics.** `GravityPresets.ts` has Asteroid, Europa, Titan, Moon, Mars, Earth — raw m/s² values and the scale factor are explicit in the file. This is the tangible physics knob.
- **Historic missions.** Apollo 11/15/17 + Artemis III with authentic fuel budgets and mission-control chatter (Sprint 5A).
- **Fork-from-episode.** Sprint 3A lets you press T to take over the AI's attempt mid-landing. Counterfactual thinking made concrete.
- **Zero setup.** Browser-only, runs on school Chromebooks. `?seed=` URL sharing already works.
- **Open source + well-commented.** `CLAUDE.md` explains the architecture. `.plans/` shows how engineering plans get written and reviewed. The code is readable.

## Part A — RL Playground Public Launch

*Ready to sprint anytime. ~30–60 min CC.*

Goal: take the current game from "undiscovered solo project" to "has a front door and a shareable pitch." One narrow wedge (self-directed learners), one distribution channel, measurable in GitHub stars and referrer logs within two weeks.

### Scope

1. **README.md** (the front door — doesn't currently exist).
   - Capsule pitch at the top: *"Watch a reinforcement learning agent figure out how to land on the moon. In your browser. In 60 seconds. Then read the code."*
   - One looping GIF or screenshot of AI Theater learning in real time.
   - Three-line "how to try it" (URL, keys, press P for autopilot or open AI Theater).
   - Three-line "how to read the code" → `Lander.ts`, `RLAgent.ts`, `GravityPresets.ts`.
   - Link to LEARN.md for the deeper tour.

2. **LEARN.md** (self-directed learner tour, replaces the "TEACHER.md" framing).
   - "Try this" progression: land once → open AI Theater → change gravity to Mars via `GravityPresets.ts` → open `RLAgent.ts` and find `calculateReward`.
   - Each step links to the exact file/function/line, with the experiment (what to change, what to observe).
   - No grade-level prescriptions. Readers self-select.

3. **Lesson-plan hooks in `GravityPresets.ts` and `RLAgent.ts`.**
   - Light comment pass on `GravityPresets.ts` — already shows raw m/s². Add "Try changing Mars to 25.0 — what happens?" prompts inline.
   - `RLAgent.ts` `calculateReward` gets a comment block: "this is the objective function. Change any coefficient and watch the AI Theater curves re-learn."
   - Do NOT rewrite `constants.ts` as the knob — the scaled `GRAVITY = 97.2` is a poor pedagogical entry point (it's 1.62 × 60 for pixel-space integration). `GravityPresets.ts` is the right abstraction.

4. **Distribution push (one channel, not five).**
   - Draft an HN Show HN post OR a tweet-thread. Pick one based on whichever the author actually uses.
   - Lead with the AI Theater GIF. Tagline: "I built a TensorFlow Playground for reinforcement learning, except it's a 1979 moon lander." Link to the live site and the repo.
   - Watch GitHub traffic for 14 days.

### Explicit non-scope (deferred or killed)

- Classroom framing (5 grade-specific lesson plans). Killed for Part A — too broad, needs gatekeepers. Revisit only if teachers self-select from the self-directed launch.
- GitHub Classroom template. Deferred to Part B.
- Mission SDK / community missions. Deferred to Part B / Sprint 10.
- Full guided-tour overlay on first load. Sprint 2.6C's inline tutorial pattern is enough for now; extending it to the core game is a follow-up.
- Submitting to STEM-ed directories (code.org gallery, NASA ed resources). Low-signal; skip until there's a real artifact + traffic.

### Exit question

Did the distribution push generate any signal? Stars, forks, referrer spikes, inbound messages, course adoptions, a retweet from someone who teaches RL? If yes → schedule Part B. If no after 4 weeks → the premise was wrong; do not sink 3 weeks into Part B.

## Part B — Hackathon / Capstone Platform

*Deferred. Schedule after Sprint 6 (WebGL) AND after Part A produced a demand signal.*

Goal: turn MoonLander Enhanced into a platform that other people build on. Every community mission compounds the value of the thing. Aligns with the "AI Theater First" + long-term vision in CLAUDE.md.

### Probable scope (to be re-planned when triggered)

- **Mission SDK** (already listed as Sprint 10): JSON schema for community missions — seed, terrain hints, pads, hazards, chatter, success criteria. Strict validation on load, because this is a trust boundary (pre-existing `Terrain Editor URL Param Validation` TODO flags this surface).
- **GitHub Classroom template.** Starter issue template ("good first mission"). Fork-once-teach-many pattern.
- **Community mission leaderboard.** Per-mission, per-seed. Probably still localStorage — server-side scoring isn't worth the infra until there's real traffic.
- **"Land this mission" URL scheme.** Encodes mission ID + seed + optional authentic-mode flag. Share-to-learn primitive.
- **One or two flagship community missions** seeded by the author to prove the pattern before asking others to contribute.

### Why defer

- **Demand signal.** Part B is a platform; platforms without users are cathedrals in deserts. Part A is the pulse check.
- **WebGL matters more for B than A.** A viral moment on r/MachineLearning rewards the "whoa" factor. Canvas-rendered hackathon platform gets "neat" but not "share this."
- **Scope.** ~3 weeks human / ~10–15h CC is a big swing for a solo project. The sprint cadence of the last two months has been the project's strength. Don't break it speculatively.

### Exit question

Did the platform produce at least one non-author community mission within 30 days of Mission SDK shipping? If yes → platform is real, keep investing. If no → the SDK is good code but the demand wasn't there; shelve and extract any reusable pieces into the core game.

## What's different from the original "parked thought"

- **Wedge narrowed:** five classroom framings → one self-directed-learner framing for Part A. Classroom framing lives only if Part A produces a teacher-shaped demand signal.
- **Sequence explicit:** A before B, with B gated on A producing signal AND Sprint 6 shipping.
- **Factual fix:** the original plan said "change `GRAVITY` in `constants.ts` and immediately see the consequence." `GRAVITY = 97.2` is a scaled pixel-space value, not 1.62 m/s² directly. Pedagogical entry point is `GravityPresets.ts`, which exposes both the real m/s² and the `SCALE = 60` factor.
- **Distribution is part of scope.** The original plan's "submit to STEM-ed directories" is replaced with one targeted distribution push (HN or X).
- **TEACHER.md → LEARN.md.** Self-directed framing, not teacher framing.

## GSTACK REVIEW REPORT

| Review | Trigger | Why | Runs | Status | Findings |
|--------|---------|-----|------|--------|----------|
| CEO Review | `/plan-ceo-review` | Scope & strategy | 1 | CLEAR (EXPANSION) | 8 proposals, 5 accepted, 2 deferred, 1 rejected |
| Codex Review | `/codex review` | Independent 2nd opinion | 0 | — | — |
| Eng Review | `/plan-eng-review` | Architecture & tests (required) | 0 | — | — |
| Design Review | `/plan-design-review` | UI/UX gaps | 0 | — | — |
| DX Review | `/plan-devex-review` | Developer experience gaps | 0 | — | — |

**UNRESOLVED:** 0

**VERDICT:** CEO CLEARED (EXPANSION mode, A-then-C sequenced). Eng review not required for Part A (docs-only); required for Part B when triggered (Mission SDK is a trust boundary).
