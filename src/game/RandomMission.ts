import type { TerrainArchetype } from "../render/palette";
import { createRng } from "../utils/math";
import type { Mission } from "./Missions";

/**
 * Sprint 7.1 PR 1.5 — Random Mission generator.
 *
 * A Random Mission is a procedurally generated freeplay mission: pick a
 * random seed, pick an archetype, generate a name + a short offline
 * briefing, and hand it back as a Mission object that the rest of the
 * game already knows how to play. Share URL encoding (`?cfg=`) makes
 * the result reproducible across browsers.
 *
 * Random missions carry `kind: "random"` so LLMIntegration can fall back
 * to the `offlineBriefing` field when no API key is configured, and so
 * the leaderboard + daily-challenge + DQN subsystems can exclude them
 * from their keyspaces (see Gap #1/#3/#4 in the Sprint 7.1 plan).
 */

export interface RandomMission extends Mission {
	kind: "random";
	/** Prerendered briefing used as the offline fallback when no LLM is
	 * configured. Intentionally flavorful — reads like a 1-2 sentence
	 * radio transmission without needing API access. */
	offlineBriefing: string;
}

export function isRandomMission(m: Mission): m is RandomMission {
	return (m as RandomMission).kind === "random";
}

/** Type guard for any Mission that carries a `kind` field. Mirrors
 * `isHistoricMission` so callers can narrow in switch statements. */
type Kinded = Mission & { kind: string };

/** Pool of procedurally generated mission names. Keep at least one
 * word from the name pinned to the archetype for flavor. */
const ARCHETYPE_NAME_POOLS: Record<TerrainArchetype, readonly string[]> = {
	rolling: [
		"OPERATION LOW STRATA",
		"PROCEDURE ROLLING 7",
		"EXERCISE FLAT WAKE",
		"MISSION GREY HORIZON",
	],
	"crater-field": [
		"OPERATION CRATER WALK",
		"PROCEDURE IMPACT 9",
		"EXERCISE BROKEN FLOOR",
		"MISSION CRATER GAMBIT",
		"OPERATION POCKMARK",
	],
	spires: [
		"OPERATION STANDING STONE",
		"PROCEDURE SPIRE 4",
		"EXERCISE COLD TEETH",
		"MISSION TALL SHADOW",
		"OPERATION NEEDLE POINT",
	],
	mesa: [
		"OPERATION HIGH TABLE",
		"PROCEDURE MESA 3",
		"EXERCISE FLAT CROWN",
		"MISSION LONG PLATEAU",
	],
	flats: [
		"OPERATION STILLWATER",
		"PROCEDURE FLATS 6",
		"EXERCISE QUIET BASIN",
		"MISSION GENTLE FLOOR",
	],
};

/** Short sentence tags keyed by archetype — used for offline briefings
 * so the player sees SOMETHING tonal even with no API key. */
const ARCHETYPE_BRIEF_TAGS: Record<TerrainArchetype, readonly string[]> = {
	rolling: [
		"Low-relief terrain, standard approach procedures apply.",
		"Soft terrain profile. Conserve fuel — no surprises expected.",
		"Typical lunar mare. Watch lateral drift, pad abundance is average.",
	],
	"crater-field": [
		"Heavy cratering. Expect pocked terrain, narrow approach corridors.",
		"Impact field ahead. Most of the ground is unusable — pick a pad early.",
		"Fresh regolith everywhere. Pads are flat but the approach is noisy.",
	],
	spires: [
		"Spire formations stand tall on the approach vector. Expect vertical obstacles.",
		"Jagged topography. Pads sit between near-vertical stones. Lateral precision critical.",
		"Cold stone forest ahead. Watch your angle — clipping a spire ends the run.",
	],
	mesa: [
		"Elevated plateaus dominate the landing zone. Pads sit on the tabletops.",
		"Mesa country. Pad elevations vary more than usual — don't drift off the edge.",
		"High plateaus. Approach from above, drop in vertical — the walls will catch you.",
	],
	flats: [
		"Smoothed basin floor. Visually sparse, landing windows are generous.",
		"Glass-flat surface. No margin for style errors — pads are narrow targets.",
		"Quiet plain. Standard descent profile. Let the ground come to you.",
	],
};

/** All archetypes eligible for Random Mission rolls. `rolling` is in
 * the pool so Random keeps some variety of "normal" missions, but the
 * non-rolling slots are weighted heavier so the mode feels discoverably
 * different from freeplay. */
const ARCHETYPE_POOL: readonly TerrainArchetype[] = [
	"rolling",
	"crater-field",
	"crater-field",
	"spires",
	"spires",
	"mesa",
	"mesa",
	"flats",
	"flats",
];

/**
 * Generate a Random Mission. When `explicitSeed` is provided the
 * mission is reproducible byte-for-byte (used by share URLs). When
 * omitted, a fresh random seed is drawn from `Math.random()` so each
 * "Roll a new mission" click produces something different.
 */
export function generateRandomMission(explicitSeed?: number): RandomMission {
	const seed =
		explicitSeed !== undefined
			? explicitSeed
			: Math.floor(Math.random() * 1_000_000);
	const rng = createRng(seed);
	const archetype = ARCHETYPE_POOL[Math.floor(rng() * ARCHETYPE_POOL.length)];
	const nameList = ARCHETYPE_NAME_POOLS[archetype];
	const name = nameList[Math.floor(rng() * nameList.length)];
	const briefTags = ARCHETYPE_BRIEF_TAGS[archetype];
	const tag = briefTags[Math.floor(rng() * briefTags.length)];
	const lat = (rng() * 90 - 45).toFixed(1);
	const lon = (rng() * 360 - 180).toFixed(1);
	const coordHemiLat = Number(lat) >= 0 ? "N" : "S";
	const coordHemiLon = Number(lon) >= 0 ? "E" : "W";
	const coords = `${Math.abs(Number(lat))}°${coordHemiLat} ${Math.abs(Number(lon))}°${coordHemiLon}`;
	const description = `Random mission. ${tag}`;
	const offlineBriefing = `${name}. Landing zone at ${coords}. ${tag}`;

	return {
		kind: "random",
		id: -1,
		name,
		seed,
		description,
		difficulty: { archetype },
		offlineBriefing,
	};
}

/**
 * Build a random mission deterministically from a seed+archetype pair
 * (the payload that comes out of a share URL). Reuses the same name +
 * briefing pools so a decoded share URL renders the same flavor the
 * original player saw.
 */
export function buildRandomMissionFromShare(
	seed: number,
	archetype: TerrainArchetype,
): RandomMission {
	// Reconstruct by seeding the RNG and skipping past the archetype
	// roll (which the share URL already decided). The RNG still advances
	// for name + tag + coords so the rest of the mission stays stable.
	const rng = createRng(seed);
	// Advance rng once to stay in lockstep with generateRandomMission's
	// archetype pick (we discard the result — share URL carries the
	// authoritative archetype).
	rng();
	const nameList = ARCHETYPE_NAME_POOLS[archetype];
	const name = nameList[Math.floor(rng() * nameList.length)];
	const briefTags = ARCHETYPE_BRIEF_TAGS[archetype];
	const tag = briefTags[Math.floor(rng() * briefTags.length)];
	const lat = (rng() * 90 - 45).toFixed(1);
	const lon = (rng() * 360 - 180).toFixed(1);
	const coordHemiLat = Number(lat) >= 0 ? "N" : "S";
	const coordHemiLon = Number(lon) >= 0 ? "E" : "W";
	const coords = `${Math.abs(Number(lat))}°${coordHemiLat} ${Math.abs(Number(lon))}°${coordHemiLon}`;
	const description = `Random mission. ${tag}`;
	const offlineBriefing = `${name}. Landing zone at ${coords}. ${tag}`;

	return {
		kind: "random",
		id: -1,
		name,
		seed,
		description,
		difficulty: { archetype },
		offlineBriefing,
	};
}

/** Exported for LLMIntegration's fallback path — it needs to know a
 * mission's kind even when the `RandomMission` interface isn't in
 * scope. Mirrors the `isHistoricMission` shape. */
export function missionKind(m: Mission): string | undefined {
	return (m as Kinded).kind;
}
