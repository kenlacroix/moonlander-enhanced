import type { MissionFacts } from "../game/HistoricMission";
import type { LanderState } from "../game/Lander";
import {
	type LLMConfig,
	type LLMMessage,
	streamCompletion,
} from "./LLMProvider";

/**
 * Mission control chatter during descent. Event-triggered, NOT continuous —
 * fires one short callout per state transition (altitude crossings, fuel
 * thresholds, drift, landing, crash). Each event fires at most once per
 * flight (debounced) so we don't burn LLM tokens or spam the player.
 *
 * Online (LLM configured): streams a 1-line callout via the same
 * streamCompletion pipe MissionBriefing uses, locked to the fact sheet
 * so it stays in voice and doesn't hallucinate.
 *
 * Offline (no API key): rule-based fixed strings keyed off the fact
 * sheet so no-LLM players still get the radio chatter feel. Critical
 * gap from eng review — must work with no API key.
 */

type ChatterTrigger =
	| "flight-start"
	| "altitude-mid"
	| "altitude-final"
	| "fuel-15"
	| "fuel-5"
	| "drift"
	| "landed"
	| "crashed";

// Altitude thresholds are GAME-SPACE PIXELS, not meters. The lander
// spawns roughly 250-350 px above terrain depending on mission, so:
//   ~150 px = mid-descent (the in-game equivalent of "altitude 1000m")
//   ~50 px  = final approach (the in-game equivalent of "200 feet")
// The radio-call wording stays in feet/meters for atmosphere; the
// underlying trigger is the screen-space crossing.
const ALTITUDE_MID_PX = 150;
const ALTITUDE_FINAL_PX = 50;
const FUEL_FRACTION_15 = 0.15;
const FUEL_FRACTION_5 = 0.05;
const DRIFT_HORIZONTAL_MS = 30;

export interface ChatterUpdate {
	lander: LanderState;
	altitude: number;
	startingFuel: number;
}

export class MissionChatter {
	private fired = new Set<ChatterTrigger>();
	private facts: MissionFacts | null = null;
	private config: LLMConfig | null = null;
	private current = "";
	private currentTimer = 0;
	private callsInFlight = 0;
	private readonly maxConcurrent = 1;

	/** Latest chatter line for HUD rendering. Empty string when no chatter is active. */
	get latestText(): string {
		return this.currentTimer > 0 ? this.current : "";
	}

	start(facts: MissionFacts, config: LLMConfig | null): void {
		this.fired.clear();
		this.facts = facts;
		this.config = config;
		this.current = "";
		this.currentTimer = 0;
		this.fire("flight-start");
	}

	/** Per-frame tick. Decays the on-screen chatter visibility timer. */
	tick(dt: number): void {
		if (this.currentTimer > 0)
			this.currentTimer = Math.max(0, this.currentTimer - dt);
	}

	/** Check transition triggers based on current flight state. */
	update(state: ChatterUpdate): void {
		if (!this.facts) return;
		const fuelFrac = state.lander.fuel / Math.max(1, state.startingFuel);

		if (state.altitude < ALTITUDE_MID_PX) this.fire("altitude-mid");
		if (state.altitude < ALTITUDE_FINAL_PX) this.fire("altitude-final");
		if (fuelFrac < FUEL_FRACTION_15) this.fire("fuel-15");
		if (fuelFrac < FUEL_FRACTION_5) this.fire("fuel-5");
		if (Math.abs(state.lander.vx) > DRIFT_HORIZONTAL_MS) this.fire("drift");
	}

	onLanded(): void {
		this.fire("landed");
	}

	onCrashed(): void {
		this.fire("crashed");
	}

	private fire(trigger: ChatterTrigger): void {
		if (this.fired.has(trigger) || !this.facts) return;
		this.fired.add(trigger);

		// Always show the offline fallback immediately — guarantees something
		// appears even if the LLM is slow or not configured.
		const fallback = ruleBasedChatter(trigger, this.facts);
		this.current = fallback;
		this.currentTimer = 4; // seconds visible

		if (!this.config) return;
		// Cap concurrent in-flight LLM requests so a slow model doesn't
		// stack up streams and starve the UI.
		if (this.callsInFlight >= this.maxConcurrent) return;
		this.callsInFlight++;
		const facts = this.facts;
		streamLLMChatter(this.config, trigger, facts, (text) => {
			// Replace the fallback with the streaming LLM text in-place.
			this.current = text;
			this.currentTimer = 4;
		})
			.catch(() => {
				/* keep the rule-based fallback */
			})
			.finally(() => {
				this.callsInFlight--;
			});
	}
}

function ruleBasedChatter(
	trigger: ChatterTrigger,
	facts: MissionFacts,
): string {
	switch (trigger) {
		case "flight-start":
			return `${facts.craftName}, you are go for landing.`;
		case "altitude-mid":
			return "Altitude 1000.";
		case "altitude-final":
			return "200 feet, looking good.";
		case "fuel-15":
			return "Quantity light.";
		case "fuel-5":
			return "30 seconds.";
		case "drift":
			return "Watch your drift.";
		case "landed":
			return `${facts.craftName} has landed at ${facts.landingSite}.`;
		case "crashed":
			return `Houston, we've lost ${facts.craftName}.`;
	}
}

async function streamLLMChatter(
	config: LLMConfig,
	trigger: ChatterTrigger,
	facts: MissionFacts,
	onText: (text: string) => void,
): Promise<void> {
	const messages: LLMMessage[] = [
		{
			role: "system",
			content: `You are NASA mission control radioing the lander pilot during powered descent. Output a SINGLE SHORT radio call (under 12 words). Plain text, no markdown. Use ONLY the facts provided. Do not invent crew, dates, coordinates, altitude, or fuel numbers.`,
		},
		{
			role: "user",
			content: `Mission: ${facts.craftName} at ${facts.landingSite}. Crew: ${facts.commander}.
Trigger event: ${describeTrigger(trigger)}.
Output one short radio call.`,
		},
	];
	let acc = "";
	await streamCompletion(config, messages, (chunk) => {
		acc += chunk;
		onText(acc);
	});
}

function describeTrigger(trigger: ChatterTrigger): string {
	switch (trigger) {
		case "flight-start":
			return "Powered descent has begun. You are go for landing.";
		case "altitude-mid":
			return "Lander is at mid-descent. About halfway down.";
		case "altitude-final":
			return "Lander is on final approach. Very close to the surface.";
		case "fuel-15":
			return "Fuel is below 15%. Quantity warning.";
		case "fuel-5":
			return "Fuel is below 5%. The famous 30-seconds-remaining callout.";
		case "drift":
			return "Lander has significant horizontal drift. Cautioning the pilot.";
		case "landed":
			return "Touchdown. Lander has landed safely.";
		case "crashed":
			return "Lander has crashed. Loss of signal.";
	}
}
