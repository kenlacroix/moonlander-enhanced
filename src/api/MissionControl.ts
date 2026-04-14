import type { LanderState } from "../game/Lander";
import { normAngle } from "../game/Physics";
import { MAX_LANDING_ANGLE, MAX_LANDING_SPEED } from "../utils/constants";
import {
	type LLMConfig,
	type LLMMessage,
	streamCompletion,
} from "./LLMProvider";

/**
 * Post-landing commentary from mission control.
 * Reacts to how the landing went — fuel efficiency, speed, angle, precision.
 */

export async function getMissionControlCommentary(
	config: LLMConfig,
	lander: LanderState,
	score: number,
	landed: boolean,
	onChunk: (text: string) => void,
): Promise<string> {
	const angle = Math.abs(normAngle(lander.angle));
	const vy = Math.abs(lander.vy);
	const vx = Math.abs(lander.vx);
	const fuelPct = Math.round((lander.fuel / 1000) * 100);

	let situation: string;
	if (!landed) {
		situation = `The lander crashed. Final speed: ${vy.toFixed(0)} vertical, ${vx.toFixed(0)} horizontal. Angle: ${angle.toFixed(0)} degrees. Fuel remaining: ${fuelPct}%.`;
	} else {
		const speedQuality =
			vy < MAX_LANDING_SPEED * 0.3
				? "feather-light"
				: vy < MAX_LANDING_SPEED * 0.7
					? "clean"
					: "hard but safe";
		const angleQuality =
			angle < 2
				? "dead center"
				: angle < MAX_LANDING_ANGLE * 0.5
					? "well-aligned"
					: "tilted but within limits";
		const fuelQuality =
			fuelPct > 50
				? "plenty of fuel left"
				: fuelPct > 20
					? "fuel was getting tight"
					: "running on fumes";
		situation = `Successful landing. Touchdown was ${speedQuality}, ${angleQuality}. ${fuelQuality}. Score: ${score}.`;
	}

	const messages: LLMMessage[] = [
		{
			role: "system",
			content: `You are a NASA mission controller reacting to a lunar landing attempt in real time.
Speak in short, punchy radio transmissions. Use call signs like "Eagle" and "Houston".
Show emotion — relief for success, tension for close calls, dark humor for crashes.
Keep it to 1-2 sentences. No markdown. Plain text only.`,
		},
		{
			role: "user",
			content: situation,
		},
	];

	return streamCompletion(config, messages, onChunk);
}
