import type { LanderState } from "../game/Lander";
import { normAngle } from "../game/Physics";
import type { TelemetryFrame } from "../systems/Telemetry";
import { MAX_LANDING_ANGLE, MAX_LANDING_SPEED } from "../utils/constants";
import {
	type LLMConfig,
	type LLMMessage,
	streamCompletion,
} from "./LLMProvider";

/**
 * Post-crash flight analysis. Turns telemetry + final lander state into
 * actionable advice. LLM path gives nuanced coaching; offline fallback
 * applies deterministic rules so the feature always works.
 */

export interface CrashFacts {
	finalVSpeed: number;
	finalHSpeed: number;
	finalAngle: number;
	finalFuelPct: number;
	peakVSpeed: number;
	fuelRanOut: boolean;
	flightDuration: number;
}

export function extractCrashFacts(
	lander: LanderState,
	frames: TelemetryFrame[],
	startingFuel: number,
): CrashFacts {
	const lastFrame = frames[frames.length - 1];
	let peakVSpeed = Math.abs(lander.vy);
	for (const f of frames) {
		const v = Math.abs(f.vSpeed);
		if (v > peakVSpeed) peakVSpeed = v;
	}
	const fuelRanOut = lander.fuel <= 0 || frames.some((f) => f.fuel <= 0);
	return {
		finalVSpeed: Math.abs(lander.vy),
		finalHSpeed: Math.abs(lander.vx),
		finalAngle: Math.abs(normAngle(lander.angle)),
		finalFuelPct: Math.round((lander.fuel / startingFuel) * 100),
		peakVSpeed,
		fuelRanOut,
		flightDuration: lastFrame?.time ?? 0,
	};
}

/** Deterministic, always-available analysis. Cites the numbers that killed you. */
export function offlineCrashAnalysis(facts: CrashFacts): string {
	const reasons: string[] = [];
	if (facts.finalVSpeed > MAX_LANDING_SPEED) {
		reasons.push(
			`Impact at ${facts.finalVSpeed.toFixed(1)} m/s vertical — the safe limit is ${MAX_LANDING_SPEED}. Start braking earlier; a last-second burn rarely saves it.`,
		);
	}
	if (facts.finalHSpeed > MAX_LANDING_SPEED) {
		reasons.push(
			`Horizontal drift was ${facts.finalHSpeed.toFixed(1)} m/s. Kill sideways motion before final descent — rotate into the drift and burn.`,
		);
	}
	if (facts.finalAngle > MAX_LANDING_ANGLE) {
		reasons.push(
			`Touchdown angle ${facts.finalAngle.toFixed(0)}° exceeded the ${MAX_LANDING_ANGLE}° limit. Level out before the last 100 m.`,
		);
	}
	if (facts.fuelRanOut) {
		reasons.push(
			"Fuel ran out mid-descent. Throttle earlier, not harder — gravity doesn't wait.",
		);
	}
	if (reasons.length === 0) {
		return "Clipped terrain on the way down. The lunar surface has teeth — check your approach path, not just the pad.";
	}
	return reasons.join(" ");
}

export async function getCrashExplanation(
	config: LLMConfig,
	facts: CrashFacts,
	onChunk: (text: string) => void,
): Promise<string> {
	const summary = `Vertical speed at impact: ${facts.finalVSpeed.toFixed(1)} m/s (limit ${MAX_LANDING_SPEED}).
Horizontal speed: ${facts.finalHSpeed.toFixed(1)} m/s (limit ${MAX_LANDING_SPEED}).
Angle: ${facts.finalAngle.toFixed(0)}° (limit ${MAX_LANDING_ANGLE}°).
Fuel remaining: ${facts.finalFuelPct}%${facts.fuelRanOut ? " — ran out mid-flight" : ""}.
Peak descent speed: ${facts.peakVSpeed.toFixed(1)} m/s.
Flight duration: ${facts.flightDuration.toFixed(1)}s.`;

	const messages: LLMMessage[] = [
		{
			role: "system",
			content: `You are a veteran flight instructor debriefing a lunar-lander crash. Give ONE specific, actionable tip — the single most important thing to fix next run. 2 sentences max. Reference actual numbers from the data. No markdown, no fluff, no pep talk.`,
		},
		{ role: "user", content: summary },
	];
	return streamCompletion(config, messages, onChunk);
}
