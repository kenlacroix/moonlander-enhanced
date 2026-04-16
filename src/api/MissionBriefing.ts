import type { MissionFacts } from "../game/HistoricMission";
import type { Mission } from "../game/Missions";
import {
	type LLMConfig,
	type LLMMessage,
	streamCompletion,
} from "./LLMProvider";

/**
 * Generates a narrative mission briefing from an LLM.
 * Each seed produces a unique briefing. Cached to avoid repeat calls.
 *
 * For historic missions, pass `historicalContext` so the LLM is locked
 * to the verified facts (no hallucinated dates, crew, or coordinates).
 * The cache is keyed by `${seed}-${factsHash}` for historic missions so
 * fact updates invalidate the cache.
 */

const briefingCache = new Map<string, string>();

export async function getMissionBriefing(
	config: LLMConfig,
	mission: Mission,
	onChunk: (text: string) => void,
	historicalContext?: MissionFacts,
): Promise<string> {
	const cacheKey = historicalContext
		? `${mission.seed}-h-${hashFacts(historicalContext)}`
		: String(mission.seed);
	const cached = briefingCache.get(cacheKey);
	if (cached) {
		onChunk(cached);
		return cached;
	}

	const messages: LLMMessage[] = historicalContext
		? historicMessages(mission, historicalContext)
		: genericMessages(mission);

	const fullText = await streamCompletion(config, messages, onChunk);
	briefingCache.set(cacheKey, fullText);
	return fullText;
}

/**
 * Offline fallback: render the fact sheet itself as a briefing-shaped
 * paragraph. Used when no LLM is configured so historic missions still
 * get authentic flavor.
 */
export function renderFactSheetBriefing(
	mission: Mission,
	facts: MissionFacts,
): string {
	const crew = [
		facts.commander && `Commander ${facts.commander}`,
		facts.lmPilot && `LM Pilot ${facts.lmPilot}`,
		facts.cmPilot && `CMP ${facts.cmPilot}`,
	]
		.filter(Boolean)
		.join(", ");
	return [
		`${mission.name} — ${facts.craftName}, ${facts.date}.`,
		crew && `Crew: ${crew}.`,
		`Landing site: ${facts.landingSite} (${facts.coordinates}).`,
		`Powered descent from ${facts.descentStartAltitudeM.toLocaleString()} m AGL.`,
		`Notable: ${facts.notableMoment}`,
	]
		.filter(Boolean)
		.join(" ");
}

function historicMessages(mission: Mission, facts: MissionFacts): LLMMessage[] {
	return [
		{
			role: "system",
			content: `You are NASA mission control radioing the lander pilot just before powered descent. Speak in short, clipped radio transmissions. Use ONLY the facts provided. Do not invent crew, dates, coordinates, fuel, or altitude numbers. If you don't know a value, omit it. 2-3 sentences. Plain text, no markdown.`,
		},
		{
			role: "user",
			content: `Mission: ${mission.name}
Craft: ${facts.craftName}
Date: ${facts.date}
Crew: ${facts.commander}${facts.lmPilot ? ` (cmdr) / ${facts.lmPilot} (LMP)` : ""}${facts.cmPilot ? ` / ${facts.cmPilot} (CMP)` : ""}
Landing site: ${facts.landingSite} (${facts.coordinates})
Descent start altitude: ${facts.descentStartAltitudeM} m
Notable moment: ${facts.notableMoment}

Generate a pre-descent radio briefing using only these facts.`,
		},
	];
}

function genericMessages(mission: Mission): LLMMessage[] {
	return [
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
}

/**
 * Cheap stable hash of the fact sheet for cache-key invalidation when
 * mission facts get edited in source. Not cryptographic; collisions
 * would just mean a stale cached briefing renders for a tweaked fact
 * sheet, which is acceptable.
 */
function hashFacts(facts: MissionFacts): string {
	const s = JSON.stringify(facts);
	let h = 5381;
	for (let i = 0; i < s.length; i++) h = (h * 33) ^ s.charCodeAt(i);
	return (h >>> 0).toString(36);
}
