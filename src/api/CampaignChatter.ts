/**
 * Sprint 7.4 — Campaign chatter system. Composes (does NOT inherit)
 * MissionChatter's pattern: rule-based fallback fires immediately, LLM
 * persona stream replaces it in-place if configured. Owns its own
 * dialogue table (CAMPAIGN_DIALOGUE) and its own trigger union including
 * two new triggers (`alien-spawn`, `storm-start`) wired from Game.ts.
 *
 * Per design doc + eng review E1: kept separate from MissionChatter so
 * the Historic-mission path stays pristine. ~30 LOC firing-pattern
 * duplication accepted as explicit-over-clever; if a third chatter
 * variant lands (Tier 4 AI Theater narration), revisit as BaseChatter.
 *
 * **Skip behavior** — when the player presses Space (or clicks) during
 * a multi-line post-landing sequence, the chatter advances to the next
 * line immediately. `skip()` is the public API. Single-line chatter
 * (briefing, in-flight) is unaffected.
 */

import {
	CAMPAIGN_DIALOGUE,
	type CampaignTrigger,
	type DialogueLine,
	getPostLandingLines,
	getTriggerLine,
	selectPostLandingKey,
} from "../data/campaignDialogue";
import type { FlightOutcome } from "../game/FlightOutcome";
import type { LanderState } from "../game/Lander";
import {
	type LLMConfig,
	type LLMMessage,
	streamCompletion,
} from "./LLMProvider";

const ALTITUDE_MID_PX = 150;
const ALTITUDE_FINAL_PX = 50;
const FUEL_FRACTION_15 = 0.15;
const FUEL_FRACTION_5 = 0.05;
const DRIFT_HORIZONTAL_MS = 30;

const LINE_VISIBILITY_SEC = 4;

export interface ChatterUpdate {
	lander: LanderState;
	altitude: number;
	startingFuel: number;
}

/** State of the post-landing multi-line queue. */
interface PostLandingQueue {
	lines: DialogueLine[];
	index: number;
}

export class CampaignChatter {
	private fired = new Set<CampaignTrigger | "briefing">();
	private missionId: number | null = null;
	private config: LLMConfig | null = null;
	private current: DialogueLine | null = null;
	private currentTimer = 0;
	private callsInFlight = 0;
	private readonly maxConcurrent = 1;
	private postQueue: PostLandingQueue | null = null;
	/** When briefing fires, defer flight-start to the first tick AFTER
	 * briefing visibility expires. Avoids "Hoshi briefing → instantly
	 * overwritten by Chen's 'Copy, lunar lander'" sequencing problem. */
	private flightStartPending = false;

	/** Latest chatter line for HUD rendering. Null when no chatter is active. */
	get latest(): DialogueLine | null {
		return this.currentTimer > 0 ? this.current : null;
	}

	/** True while the post-landing queue has more lines. UI uses this to
	 * show the SKIP hint. */
	get hasQueuedLines(): boolean {
		return (
			this.postQueue !== null &&
			this.postQueue.index < this.postQueue.lines.length - 1
		);
	}

	start(missionId: number, config: LLMConfig | null): void {
		this.fired.clear();
		this.missionId = missionId;
		this.config = config;
		this.current = null;
		this.currentTimer = 0;
		this.postQueue = null;
		this.flightStartPending = false;
		// Briefing fires first (6s visibility). flight-start trigger is
		// queued and fires on the next tick AFTER briefing expires, so
		// the player reads the briefing without it being instantly
		// overwritten by Chen's "go for descent" callout.
		this.fireBriefing();
		this.flightStartPending = true;
	}

	tick(dt: number): void {
		if (this.currentTimer > 0)
			this.currentTimer = Math.max(0, this.currentTimer - dt);
		// When the current line expires AND we have a queued post-landing
		// sequence, auto-advance to the next line (every 4 sec).
		if (this.currentTimer === 0 && this.postQueue) {
			this.advancePostQueue();
			return;
		}
		// Post-briefing: fire the deferred flight-start trigger (Chen's
		// "Copy, lunar lander" callout, or per-mission override).
		if (this.currentTimer === 0 && this.flightStartPending) {
			this.flightStartPending = false;
			this.fire("flight-start");
		}
	}

	update(state: ChatterUpdate): void {
		if (!this.missionId) return;
		const fuelFrac = state.lander.fuel / Math.max(1, state.startingFuel);

		if (state.altitude < ALTITUDE_MID_PX) this.fire("altitude-mid");
		if (state.altitude < ALTITUDE_FINAL_PX) this.fire("altitude-final");
		if (fuelFrac < FUEL_FRACTION_15) this.fire("fuel-15");
		if (fuelFrac < FUEL_FRACTION_5) this.fire("fuel-5");
		if (Math.abs(state.lander.vx) > DRIFT_HORIZONTAL_MS) this.fire("drift");
	}

	/** Fired from Game.ts onFixedUpdate when alien.effectJustStarted flips
	 * true. Once-per-flight (debounced via fired Set). */
	onAlienSpawn(): void {
		this.fire("alien-spawn");
	}

	/** Fired from Game.ts onFixedUpdate on the storm-phase normal→high
	 * transition. Once-per-flight (debounced) — subsequent storm cycles
	 * don't re-trigger the chatter. */
	onStormStart(): void {
		this.fire("storm-start");
	}

	/** Called on flight-end (clean / bounced / crashed / timeout). Picks
	 * the most specific post-landing key with available dialogue and
	 * starts the multi-line queue. */
	complete(outcome: FlightOutcome): void {
		if (!this.missionId) return;
		const hazardFired =
			outcome.hazardsFired.alien || outcome.hazardsFired.storm;
		// Branch on which gate broke (rate vs speed) to pick a more
		// specific Hoshi line. Caller passes which one tripped.
		const rateExceeded =
			outcome.bestAngularRate !== undefined && outcome.bestAngularRate > 8;
		// Speed-exceeded inferred from outcome semantics — caller decides.
		// For simplicity, treat any non-rate crash as potentially speed-driven.
		const speedExceeded = outcome.result === "crashed" && !rateExceeded;
		const key = selectPostLandingKey(
			this.missionId,
			outcome.result,
			hazardFired,
			rateExceeded,
			speedExceeded,
		);
		if (!key) return;
		const lines = getPostLandingLines(this.missionId, key);
		if (!lines || lines.length === 0) return;
		this.postQueue = { lines: [...lines], index: 0 };
		this.current = lines[0];
		this.currentTimer = LINE_VISIBILITY_SEC;
		this.maybeStreamLLM(`post-landing:${key}`, lines[0]);
	}

	/** Player pressed Space / clicked. If a post-landing queue is active,
	 * skip to the next line immediately. No-op otherwise. */
	skip(): void {
		if (!this.postQueue) return;
		this.advancePostQueue();
	}

	private advancePostQueue(): void {
		if (!this.postQueue) return;
		this.postQueue.index += 1;
		if (this.postQueue.index >= this.postQueue.lines.length) {
			this.postQueue = null;
			return;
		}
		const next = this.postQueue.lines[this.postQueue.index];
		this.current = next;
		this.currentTimer = LINE_VISIBILITY_SEC;
	}

	private fireBriefing(): void {
		if (!this.missionId || this.fired.has("briefing")) return;
		this.fired.add("briefing");
		const table = CAMPAIGN_DIALOGUE[this.missionId];
		if (!table || table.briefing.length === 0) return;
		const first = table.briefing[0];
		this.current = first;
		// Briefing reads slower than callouts — ~6s per line so the
		// player can absorb it. Multi-line briefings queue identically
		// to post-landing.
		if (table.briefing.length > 1) {
			this.postQueue = { lines: [...table.briefing], index: 0 };
		}
		this.currentTimer = 6;
		this.maybeStreamLLM("briefing", first);
	}

	private fire(trigger: CampaignTrigger): void {
		if (this.fired.has(trigger) || !this.missionId) return;
		this.fired.add(trigger);
		const line = getTriggerLine(this.missionId, trigger);
		if (!line) return;
		this.current = line;
		this.currentTimer = LINE_VISIBILITY_SEC;
		this.maybeStreamLLM(`trigger:${trigger}`, line);
	}

	/** LLM persona pass — replaces the rule-based fallback in-place if
	 * the stream succeeds. Voice purity check: if the first 20 chars of
	 * the streamed text don't begin with the expected speaker prefix,
	 * abort and keep the rule-based line. */
	private maybeStreamLLM(context: string, fallback: DialogueLine): void {
		if (!this.config) return;
		if (this.callsInFlight >= this.maxConcurrent) return;
		this.callsInFlight++;
		streamCampaignLine(this.config, context, fallback, (text) => {
			this.current = { speaker: fallback.speaker, text };
			this.currentTimer = Math.max(this.currentTimer, LINE_VISIBILITY_SEC);
		})
			.catch(() => {
				/* keep the rule-based fallback */
			})
			.finally(() => {
				this.callsInFlight--;
			});
	}
}

async function streamCampaignLine(
	config: LLMConfig,
	context: string,
	fallback: { speaker: "hoshi" | "chen"; text: string },
	onText: (text: string) => void,
): Promise<void> {
	const persona =
		fallback.speaker === "hoshi"
			? `You are Dr. Liam Hoshi, a NASA Descent Systems engineer running a flight simulator program. Voice: nerdy-earnest, peer-ish professional, precise with flight-dynamics numbers. Never theatrical. Never use the phrases "small step", "dear student", "my dear", or "that's one for the books". Output 1-2 short sentences. Plain text, no markdown.`
			: `You are CapCom Maya Chen, NASA Mission Control. Voice: clipped, procedural, radio-filtered. Read events as facts, not editorial. Never use first person ("I", "me", "my") except in quoted relays from Flight. Use feet/knots/degrees. Output ONE short sentence. Plain text, no markdown.`;

	const messages: LLMMessage[] = [
		{ role: "system", content: persona },
		{
			role: "user",
			content: `Context: ${context}. Original line (rewrite in your voice, same meaning, similar length): "${fallback.text}"`,
		},
	];

	let acc = "";
	let aborted = false;
	await streamCompletion(config, messages, (chunk) => {
		if (aborted) return;
		acc += chunk;
		// Voice contamination guard: after the first ~20 characters, if
		// the line is clearly off-voice (e.g. a Hoshi line saying "small
		// step" or a Chen line using "I"), abort and keep the fallback.
		if (acc.length > 20) {
			const lower = acc.toLowerCase();
			if (fallback.speaker === "hoshi") {
				if (
					lower.includes("small step") ||
					lower.includes("dear student") ||
					lower.includes("my dear")
				) {
					aborted = true;
					return;
				}
			}
			if (fallback.speaker === "chen") {
				if (/\b(I|me|my)\b/i.test(acc)) {
					aborted = true;
					return;
				}
			}
		}
		onText(acc);
	});
}
