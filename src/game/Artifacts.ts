/**
 * Lunar Archaeology — historical artifacts scattered on terrain.
 *
 * Land near an artifact to scan it. Each artifact triggers an LLM call
 * for a real historical fact about the Apollo program. Deterministic
 * placement via seeded RNG.
 */

import { WORLD_WIDTH } from "../utils/constants";
import type { Vec2 } from "../utils/math";
import { createRng } from "../utils/math";
import { getTerrainHeightAt } from "./Physics";

export type ArtifactType =
	| "flag"
	| "rover-tracks"
	| "debris"
	| "footprints"
	| "plaque";

export interface Artifact {
	x: number;
	y: number;
	type: ArtifactType;
	scanned: boolean;
	label: string;
	fact: string | null; // populated after LLM scan
}

const ARTIFACT_TYPES: { type: ArtifactType; label: string; prompt: string }[] =
	[
		{
			type: "flag",
			label: "AMERICAN FLAG",
			prompt:
				"Tell a short historical fact about the American flags left on the Moon by Apollo astronauts. What happened to them?",
		},
		{
			type: "rover-tracks",
			label: "ROVER TRACKS",
			prompt:
				"Tell a short historical fact about the Lunar Roving Vehicle used on Apollo 15, 16, and 17. What was surprising about driving on the Moon?",
		},
		{
			type: "debris",
			label: "DESCENT STAGE",
			prompt:
				"Tell a short historical fact about the Apollo Lunar Module descent stages left on the Moon. How many are still there?",
		},
		{
			type: "footprints",
			label: "BOOT PRINTS",
			prompt:
				"Tell a short historical fact about the first footprints on the Moon. Why will they last millions of years?",
		},
		{
			type: "plaque",
			label: "MEMORIAL PLAQUE",
			prompt:
				"Tell a short historical fact about the memorial plaques and items left on the Moon, like the fallen astronaut figurine or the Apollo 11 plaque.",
		},
	];

const SCAN_RADIUS = 80; // game units — how close lander must land to scan

/** Check if artifacts should spawn for this seed (~40% of missions) */
export function shouldSpawnArtifacts(seed: number): boolean {
	return (seed * 13 + 3) % 10 < 4;
}

/** Place 1-2 artifacts on the terrain, deterministic by seed */
export function placeArtifacts(
	seed: number,
	terrainPoints: Vec2[],
): Artifact[] {
	if (!shouldSpawnArtifacts(seed)) return [];

	const rng = createRng(seed * 17 + 11);
	const count = 1 + Math.floor(rng() * 2); // 1 or 2 artifacts
	const artifacts: Artifact[] = [];

	for (let i = 0; i < count; i++) {
		// Pick a random x position (avoid edges)
		const margin = WORLD_WIDTH * 0.15;
		const x = margin + rng() * (WORLD_WIDTH - margin * 2);
		const y = getTerrainHeightAt(x, terrainPoints);

		// Pick artifact type
		const typeIdx = Math.floor(rng() * ARTIFACT_TYPES.length);
		const artType = ARTIFACT_TYPES[typeIdx];

		artifacts.push({
			x,
			y,
			type: artType.type,
			scanned: false,
			label: artType.label,
			fact: null,
		});
	}

	return artifacts;
}

/** Check if any unscanned artifact is within scan radius of landing position */
export function checkArtifactScan(
	artifacts: Artifact[],
	landerX: number,
): Artifact | null {
	for (const art of artifacts) {
		if (!art.scanned && Math.abs(art.x - landerX) < SCAN_RADIUS) {
			return art;
		}
	}
	return null;
}

/** Get the LLM prompt for an artifact type */
export function getArtifactPrompt(artifact: Artifact): string {
	const artType = ARTIFACT_TYPES.find((a) => a.type === artifact.type);
	return (
		artType?.prompt ??
		"Tell a short historical fact about the Apollo Moon missions."
	);
}
