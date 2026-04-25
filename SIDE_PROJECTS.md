# Side Projects — MoonLander-adjacent ideas

Projects that aren't shipping inside the MoonLander Enhanced codebase but use it (or pair with it) as a canvas. Tracked here so they stay visible without polluting the main roadmap.

---

## DIY MoonLander Controller — "Tilt-to-Fly" Tutorial

**One-liner:** Build a physical controller for MoonLander Enhanced from a $15 micro:bit (or $8 Arduino), then play canyou.land using motion + buttons you wired yourself. Learn embedded C++ / Python and digital I/O in the process. AI-enhanced controller for an AI-enhanced game.

**Status:** Idea captured 2026-04-24. Not started.

### Why this exists

Two pulls met:
1. User wants to branch into hardware. Off-the-shelf gamepad support solves "feels good in hand" but doesn't teach anything.
2. MoonLander Enhanced is already an AI-enhanced game (RL agents, LLM-generated dialogue, LLM mission briefings). Adding an AI-enhanced **physical controller** that the player builds themselves doubles down on the differentiator: learn AI by playing, learn hardware by building, learn coding by wiring it together.

The teaching moment isn't the controller — it's the loop of "I wrote 30 lines of firmware, plugged it in, and now my circuit is flying a lander on canyou.land."

### The killer demo

Tilt the micro:bit. The lander rotates.

The micro:bit has a built-in 3-axis accelerometer. Mapping `accelerometer.x` to lander rotation is a 5-line firmware change. The player physically *tilts a circuit board the size of a credit card* and watches their lander tilt the same way on screen. That mapping is the hook — it's a physical-virtual coupling that lands instantly without explanation.

### Hardware target shortlist

| Board | Cost | Why pick it | Why skip it |
|-------|------|-------------|-------------|
| **micro:bit v2** | $15 | Built-in accelerometer (the killer demo), already in many schools, WebUSB/WebHID direct browser connection, MicroPython-friendly | Closed ecosystem, less "real embedded" feel |
| **Arduino Pro Micro / Leonardo** | $8-15 | Native USB HID gamepad emulation (no drivers, no app), real C++ embedded experience, breadboard-friendly | No built-in sensors; need pots + buttons separately |
| **Raspberry Pi Pico** | $4 | Cheapest, MicroPython OR C, 2 cores | Less curriculum support; HID requires CircuitPython |
| **Bare ESP32** | $5-10 | WiFi + Bluetooth, can be a wireless gamepad | Steeper learning curve; overkill for tutorial |

**Recommended starter path: micro:bit.** Cheapest learning curve, best demo, broadest school adoption. Tutorial graduates can move to Arduino Pro Micro for "now build a more serious controller" Module 2.

### Where the AI enhancement lives

The "AI-enhanced controller for an AI-enhanced game" framing isn't just marketing. Real angles:

1. **LLM-tutored assembly instructions.** A web tutorial page where the user types "I have a micro:bit and one button" and an LLM walks them through a customized wiring + firmware path. Beats a static instruction PDF.
2. **LLM-generated firmware stubs.** "I want my left stick to control thrust and a button to reset." The page hands them runnable MicroPython/C++ derived from a constrained prompt. They edit it, paste it into the IDE, flash it, fly.
3. **AI-tuned controller calibration.** Once the player is flying, the game observes their flight history (already tracked via Telemetry) and proposes firmware tweaks: "Your rotations are jerky — try adding `accel.x * 0.7` damping in your firmware." Couples back to the existing RL/AI Theater pipeline since both are about adapting to the player.
4. **AI-narrated build experience.** Hoshi (already a NASA engineer character in the game) becomes the tutorial voice: "Alright — solder the button to pin 16. While that cools, let me tell you about how Apollo 11 wired its hand controller." Builds on the existing campaign narrative voice.
5. **Adaptive haptics.** The micro:bit can buzz via its built-in motor pin. ML model (TF.js, in browser) trained on the player's flight history learns which moments need haptic feedback.

#1 and #2 are the cheapest wins for a v1 tutorial; #3 is the differentiator that makes it feel personalized; #4 is the polish that ties it back to MoonLander's existing voice.

### Scope sketches (three sizes)

**Tiny (1-2 days, weekend build):** A single web page with three sections — "buy this kit" (Amazon links to $25 starter pack), "wire it like this" (one wiring diagram, one photo), "flash this code" (one MicroPython block, copy-paste-and-go). Links to canyou.land. No AI. Proof of concept. Ship-ready as a tutorial blog post.

**Medium (~2 weeks, real tutorial site):** Multi-step interactive tutorial with the LLM tutor (#1 above) doing the customization. Three difficulty paths: micro:bit beginner → Arduino intermediate → ESP32 advanced. Each builds on the last. Code blocks are runnable in-browser via WebUSB upload. AI angle = the personalized walkthrough.

**Big (~6 weeks, separate product):** Full curriculum site. 10-15 modules: "your first LED" → "your first button" → "tilt-controlled lander" → "two-stick custom layout" → "build your own button mapping mode." MoonLander becomes the canvas for every lesson; new lessons add features that don't need to live in MoonLander itself ("write a Python script that records your gamepad inputs and replays them"). Runs out of MoonLander's repo entirely. AI tutor is the through-line — it scales, the static curriculum doesn't.

### Where it lives

**Not in this repo.** This is its own product with its own audience (hobbyists + students) and its own repo. MoonLander Enhanced stays focused. The tutorial site links *to* canyou.land as the showcase but doesn't ship inside it.

When ready to start, candidate names: `tilt-to-fly.dev`, `solder-and-fly`, `moonlander-controller`. Domain check first.

### Prerequisites before starting

- [ ] Sprint 7.5 (Mobile Quality) shipped — so the canyou.land showcase doesn't break under typical viewing conditions
- [ ] Off-the-shelf Gamepad API support shipped (P3 in TODOS.md) — proves the input plumbing works before adding firmware-driven inputs
- [ ] One physical micro:bit ordered + a weekend free to verify the killer demo actually works

Don't write a single line of tutorial copy until the micro:bit works on a real machine flying a real instance of MoonLander. The "is the demo as cool as it sounds in my head" question deserves a bench test before scope expands.

### Risks

- **Tutorial sites have a low completion rate.** "Buy this kit, wire it up, flash this code" loses 80% of readers between buy and wire. Mitigation: ship Tiny scope first as a single page; only build Medium/Big if Tiny gets traction.
- **micro:bit + WebUSB has browser gotchas.** Chrome only on most platforms; Safari blocks. Mitigation: WebHID where possible, fallback to "open this Python script in Mu Editor and flash it the regular way" for non-Chrome users.
- **Hardware costs shift.** Sourcing chips during shortages (the 2021-2022 thing). Mitigation: don't build curriculum that hard-depends on a specific chip — multi-board paths from day one.
- **AI tutor is the differentiator BUT also the operating cost.** LLM calls per tutorial session add up. Mitigation: cache aggressively, offer "no-AI" baseline path that still teaches.

### What I'd do first

A bench test, not a tutorial. Buy one micro:bit, wire one button + the built-in accelerometer to flight controls in MoonLander via WebHID. Spend a Saturday seeing if the experience actually clicks. If it does — write the Tiny tutorial page. If it doesn't — kill the project and stay with off-the-shelf gamepad support.

The buy-test-decide loop costs $15 + 4 hours. Cheapest possible signal on whether the bigger investment is worth it.

---

## AI-Enhanced Features (the differentiation layer)

The "AI-enhanced controller for an AI-enhanced game" framing only works if the AI does real work, not chatbot decoration. Most DIY-controller tutorials slap an LLM on the box and call it AI. The interesting question for THIS project is: what's uniquely possible because MoonLander Enhanced already has the AI substrate?

The features below are ranked by how much they leverage MoonLander's existing infrastructure (TF.js DQN agent, Telemetry recording, LLM persona pipeline, Ghost Replay system) vs. how much new work they require.

### Tier 1 — Ship in v1 (uses existing MoonLander infrastructure)

#### A. Personalized RL clone — "your AI plays you"

The single most differentiated angle. MoonLander already has a TF.js DQN agent (`src/ai/RLAgent.ts`) that trains in-browser. Train one on **your specific controller's input stream** — including reaction time, your wiring's noise floor, your hand-tremor patterns, your characteristic over- or under-correction.

The RL agent doesn't just learn to fly the lander; it learns to fly *like you*. After 50 flights with your controller, Ghost Replay shows two ghosts: your real best run, and your AI-clone playing on a model of you. Race yourself. Watch your AI clone make the same mistake you'd make.

**Why MoonLander uniquely enables this:**
- TF.js training pipeline already exists (Sprint 2.5 + 2.7)
- Telemetry recording already at 4 Hz (`src/systems/Telemetry.ts`)
- Ghost replay infrastructure already in place
- Save-state for AI weights in IndexedDB already shipped (Sprint 2.7)

**New work:** ~3-4 hours — capture controller input stream alongside game state during training, feed both to AgentEnv, store per-controller-fingerprint weight set. The hard part (training infrastructure) is done.

**Demo moment:** "Watch this — that's MY AI." Your controller. Your DQN. Your style.

#### B. Hoshi as build tutor

Sprint 7.4 just shipped a NASA Descent Systems engineer character with an offline-first LLM persona prompt (`src/api/CampaignChatter.ts` + `src/api/MissionBriefing.ts`). Reuse the same character voice for the hardware tutorial.

Tutorial page voice:
> "FLIGHT, Hoshi. Today we're wiring the accelerometer to your micro:bit. Solder the data line to pin 16. While the joint cools, let me tell you about how Apollo's hand controller had four mechanical backups stacked on top of each other — same redundancy logic you're about to build with two buttons."

**Why MoonLander uniquely enables this:**
- Hoshi character voice + banned-phrase list + persona prompt ALL EXIST
- LLM streaming infrastructure with offline fallback already shipped
- Voice purity tests + voice-contamination guard already enforce consistency

**New work:** ~2 hours — extend the persona prompt with hardware-tutorial context, add a "Hoshi mode" UI on the tutorial page that wraps prose in his voice. The character work is done.

**Demo moment:** The same engineer from your campaign briefing is now teaching you to solder. Continuity across game and tutorial = a coherent universe instead of two adjacent products.

#### C. Telemetry-driven firmware tuning

Every flight is already logged at 4Hz with altitude, vy, vx, fuel, angle, angular rate. After 20 flights with a DIY controller, an LLM analyzes the patterns and writes back to the player.

Example output:
> "Your rotations consistently overshoot by 3-4° before you counter-correct. That's a damping problem. Here's a 2-line patch for your firmware:
> ```python
> reading = accel.x * 0.7 + last_reading * 0.3
> ```
> Reflash and try Mission 3 again."

The game becomes a feedback loop into the player's own hardware. Each tuning pass measurably improves their flights.

**Why MoonLander uniquely enables this:**
- Telemetry already records the right metrics at the right cadence
- Flight Recorder already generates per-flight summaries (`src/systems/FlightRecorder.ts`)
- Crash analysis pipeline already exists (`src/api/CrashExplainer.ts`) — same LLM-with-rule-based-fallback pattern

**New work:** ~3 hours — telemetry-to-firmware-recommendation prompt, web UI showing "your last 20 flights" with the suggested patch, copy-to-clipboard button. The data pipeline is already there; this is just one more consumer of it.

**Demo moment:** Buy a kit, build a controller, fly badly, get a personalized firmware patch, reflash, fly better. Tight feedback loop.

### Tier 2 — Post-v1 (real but heavier)

#### D. AI debugging buddy

Plug in micro:bit, paste serial output into a chat field, LLM has full schematic + firmware context (you wrote it together) and diagnoses issues:
> "Your accelerometer is reporting 0xFF every read. Pin 19 isn't actually wired to GND — check your soldering on the second-from-left pad."

Self-paced learners die at the "why isn't this working" wall. This unlocks them. **Generic tutorial sites can't do this** because they don't have your specific schematic and firmware in context. The MoonLander tutorial path knows exactly what code you ran because the tutor just generated it for you (Tier 1 feature B).

**New work:** ~4-5 hours — serial port WebUSB capture, chat UI, prompt engineering for diagnosis. No MoonLander dependencies; could be a standalone web app.

#### E. Adaptive co-pilot — TinyML on the chip

Tiny ML model running ON the controller itself (TensorFlow Lite Micro fits on a Pico or ESP32). Smooths your input, or takes over briefly during anomalies (gravity storm hits, micro:bit assist-stabilizes for 200ms while you re-orient).

The "learn from your style" part lives on the hardware. Slick. The model is exported from MoonLander's TF.js training (Tier 1 feature A) — you train your AI clone in the browser, then quantize-and-flash a smaller version onto your controller.

**Why this is hard:** quantization-aware training, model size constraints, uploading model weights via WebUSB, on-chip inference timing. Real engineering project, ~2-3 weeks for someone new to TinyML.

**Why this is the cool one:** the controller becomes an AI artifact. It carries a model trained on you, running on a $4 chip, augmenting your gameplay in real time.

#### F. AI vision — webcam sees your breadboard

Laptop webcam looks at your breadboard. Computer vision identifies "two buttons, a potentiometer, an accelerometer" and *generates a firmware mapping for you*. The user just shows the camera what they built and the firmware writes itself.

Closes the "I don't know what this circuit is for" gap for true beginners. Scope-expensive — needs a vision model fine-tuned on breadboard photos, or a multi-modal LLM with fast enough inference for real-time. Probably $$$ in API calls per session unless cached aggressively.

**New work:** ~6-8 hours minimum, probably more. Real research project, not a build.

### Tier 3 — Speculative (interesting but won't ship)

#### G. Adaptive haptics via on-chip ML
Train a tiny model on what flight conditions a player wants haptic feedback for. Different vibration patterns per player preference, learned not configured. Cool but niche; most players will be fine with hardcoded patterns.

#### H. Personalized curriculum
After Module 1 (button + accelerometer), LLM looks at gameplay and suggests: "Your fuel management is your weak spot — let's add an analog throttle next." Personalized progression. Useful only if the curriculum is large enough that personalization matters; in v1 with 3-5 modules, just sequencing them matters more.

### What I'd actually pick for v1

**Tier 1 features A + B + C, in that order.** A is the differentiator (personalized RL clone). B is the polish that ties it back to MoonLander narratively (Hoshi continuity). C is the genuinely useful loop (firmware tuning from flight data).

**All three reuse infrastructure that already exists in MoonLander Enhanced.** Without it, you'd be spending ~30 hours building TF.js training pipelines, telemetry systems, and LLM persona infrastructure before you could even start on the hardware-tutorial part. Because MoonLander has them, the hardware tutorial inherits all of it for free.

That's the honest answer to "what would AI-enhanced DIY look like for THIS project specifically": a controller that **gets better the longer you use it**, narrated by **a character who already exists**, that produces **firmware patches generated from real flight data**. Not a chatbot strapped to a breadboard.

### What this rules out

- "Just slap GPT on the assembly instructions" — every other DIY tutorial site does this. It's not differentiated and the LLM has no context about what you actually built.
- "Make the controller voice-controlled" — adds zero value, eats a microphone budget, fails on noisy desks.
- "Generative AI controller designs" — the user wants to learn to build, not have the design picked for them. AI's role is to teach and tune, not to take over creative decisions.

---

## Related ideas (lighter sketches)

These are smaller side-project notes adjacent to MoonLander Enhanced. Add detail if and when they get serious.

### MoonLander Discord bot
Slash command `/moonlander` rolls today's daily seed, posts the share link + leaderboard. Friends can race the same terrain in a chat thread. ~2 hour build with discord.js. Depends on the daily-challenge backend (currently client-only).

### Kiosk mode for events
Special URL flag (`?kiosk=1`) that disables ESC, hides the menu chrome, and auto-restarts after each landing. For booth/demo settings. ~1 hour. Plays nice with the existing `?embed=1` mode.

### MoonLander screensaver / OBS overlay
The AI Theater training loop running headless on a desktop screensaver (using the existing HeadlessGame class). Watch RL agents converge while you take a coffee break. Or use it as an OBS browser-source overlay for streamers. ~3-4 hours. Already 80% of the work is done — just needs a screensaver-bundle path.

### Physical scoreboard (E-ink display)
A Raspberry Pi + e-ink display in a frame on the wall, polling the daily-challenge leaderboard once a day and showing the top 3 names. Nerdy office decor. Depends on the leaderboard backend.
