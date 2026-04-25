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
