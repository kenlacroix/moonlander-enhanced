import { type LLMConfig, type LLMMessage, streamCompletion } from "./LLMProvider";
import type { Mission } from "../game/Missions";

/**
 * Generates a narrative mission briefing from an LLM.
 * Each seed produces a unique briefing. Cached to avoid repeat calls.
 */

const briefingCache = new Map<number, string>();

export async function getMissionBriefing(
	config: LLMConfig,
	mission: Mission,
	onChunk: (text: string) => void,
): Promise<string> {
	// Check cache
	const cached = briefingCache.get(mission.seed);
	if (cached) {
		onChunk(cached);
		return cached;
	}

	const messages: LLMMessage[] = [
		{
			role: "system",
			content: `You are a NASA mission controller in 1969. You speak in short, clipped radio transmissions.
You are briefing the pilot before a lunar descent. Be atmospheric and tense.
Keep it to 2-3 sentences. Reference the mission name and terrain conditions.
Do not use markdown. Plain text only.`,
		},
		{
			role: "user",
			content: `Mission: ${mission.name}. Terrain seed: ${mission.seed}. Description: ${mission.description}. Generate a pre-descent briefing.`,
		},
	];

	const fullText = await streamCompletion(config, messages, onChunk);
	briefingCache.set(mission.seed, fullText);
	return fullText;
}
