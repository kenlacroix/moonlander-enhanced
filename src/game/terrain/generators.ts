import {
	CANVAS_HEIGHT,
	TERRAIN_MAX_HEIGHT,
	TERRAIN_MIN_HEIGHT,
} from "../../utils/constants";
import { lerp } from "../../utils/math";

// y increases downward; BASELINE_Y is the mid-range surface height shared by
// all v2 generators, matching the v1 midpoint baseline.

/**
 * terrainVersion 2 base-shape generators.
 *
 * Unlike the Sprint 7.1 archetype post-passes in `archetypes.ts` — which
 * decorate a shared midpoint-displacement base — these generators REPLACE
 * the base shape per archetype, so each archetype reads as a structurally
 * different surface rather than the same rolling hills with bumps.
 *
 * Every generator is deterministic in the provided `rng`: noise tables and
 * feature placement are drawn from it, so a (seed, archetype) pair always
 * reproduces byte-identical heights. They return a heights array (screen-y,
 * y increases downward) the same length as the v1 midpoint output, so the
 * downstream pad placement / clamp / point mapping in `generateTerrain` is
 * unchanged. v2 is gated to Random Missions, so existing v1 ghosts and the
 * historic regression pins are never touched. See [[Terrain.ts]].
 */

/** Match the v1 midpoint output length (2 endpoints, 8 doubling iterations
 * → 2^8 + 1 points) so pad placement and world-step math are identical. */
export const V2_POINT_COUNT = 257;

const BASELINE_Y =
	CANVAS_HEIGHT - lerp(TERRAIN_MIN_HEIGHT, TERRAIN_MAX_HEIGHT, 0.5);

/** Seeded 1-D value noise: a wrapped table of random values, smoothstep-
 * interpolated. Output in [0, 1). Deterministic given `rng`. */
function makeNoise(rng: () => number, tableSize = 256): (x: number) => number {
	const table = Array.from({ length: tableSize }, () => rng());
	const at = (i: number): number =>
		table[((i % tableSize) + tableSize) % tableSize];
	return (x: number): number => {
		const i = Math.floor(x);
		const f = x - i;
		const t = f * f * (3 - 2 * f); // smoothstep
		return at(i) + (at(i + 1) - at(i)) * t;
	};
}

/** Fractal Brownian motion — summed octaves of value noise. Output ~[0, 1]. */
function fbm(
	noise: (x: number) => number,
	x: number,
	octaves: number,
	freq: number,
): number {
	let amp = 1;
	let sum = 0;
	let norm = 0;
	let f = freq;
	for (let o = 0; o < octaves; o++) {
		sum += amp * noise(x * f);
		norm += amp;
		amp *= 0.5;
		f *= 2;
	}
	return sum / norm;
}

/** Ridged multifractal — sharp peaks where the noise crosses its midline.
 * Output ~[0, 1] but biased toward thin high ridges. */
function ridged(
	noise: (x: number) => number,
	x: number,
	octaves: number,
	freq: number,
): number {
	let amp = 1;
	let sum = 0;
	let norm = 0;
	let f = freq;
	for (let o = 0; o < octaves; o++) {
		const r = 1 - Math.abs(2 * noise(x * f) - 1);
		sum += amp * r * r;
		norm += amp;
		amp *= 0.5;
		f *= 2;
	}
	return sum / norm;
}

/** Crater-field: a Voronoi-style cratered mare. Starts from gentle fBm
 * undulation, then carves many overlapping parabolic bowls with rim lips so
 * the whole surface reads as cratered, not "hills plus a few dips". */
export function genCraterField(
	rng: () => number,
	count = V2_POINT_COUNT,
): number[] {
	const noise = makeNoise(rng);
	const heights = new Array<number>(count);
	for (let i = 0; i < count; i++) {
		const nx = (i / (count - 1)) * 6;
		heights[i] = BASELINE_Y + (2 * fbm(noise, nx, 3, 1) - 1) * 35;
	}

	const craters = 28 + Math.floor(rng() * 18); // 28-45
	for (let c = 0; c < craters; c++) {
		const center = Math.floor(rng() * count);
		const radius = 6 + Math.floor(rng() * 24); // 6-29 points
		const depth = 25 + rng() * 45; // 25-70 px
		for (let j = -Math.ceil(radius * 1.2); j <= Math.ceil(radius * 1.2); j++) {
			const idx = center + j;
			if (idx < 0 || idx >= count) continue;
			const dist = Math.abs(j);
			if (dist > radius) {
				// Rim lip just outside the bowl — raised ejecta.
				const rimT = 1 - (dist - radius) / (radius * 0.2);
				if (rimT > 0) heights[idx] -= rimT * 6;
			} else {
				const t = 1 - dist / radius;
				heights[idx] += depth * t * t; // parabolic bowl
			}
		}
	}
	return heights;
}

/** Spires: ridged-noise ridgelines — thin, sharp vertical hazards with deep
 * troughs between, replacing the v1 "scatter a few tall columns" approach. */
export function genSpires(rng: () => number, count = V2_POINT_COUNT): number[] {
	const noise = makeNoise(rng);
	const heights = new Array<number>(count);
	for (let i = 0; i < count; i++) {
		const nx = (i / (count - 1)) * 9;
		const r = ridged(noise, nx, 6, 1);
		// y increases downward: subtract to raise sharp peaks above baseline.
		heights[i] = BASELINE_Y + 60 - r ** 1.4 * 230;
	}
	return heights;
}

/** Mesa: domain-warped fBm, terraced into flat-topped plateaus with wandering
 * edges — genuine stepped tablelands rather than slope-sided bumps. */
export function genMesa(rng: () => number, count = V2_POINT_COUNT): number[] {
	const base = makeNoise(rng);
	const warp = makeNoise(rng);
	const heights = new Array<number>(count);
	const levels = 4;
	for (let i = 0; i < count; i++) {
		const nx = (i / (count - 1)) * 5;
		const warped = nx + (2 * fbm(warp, nx, 4, 1) - 1) * 1.5;
		const w = fbm(base, warped, 5, 1);
		const terraced = Math.floor(w * levels) / (levels - 1);
		heights[i] = BASELINE_Y - terraced * 175;
	}
	return heights;
}

/** Rolling: gentle domain-warped fBm — smooth hills, the v2 default for the
 * `rolling` archetype so even "normal" random missions vary their base shape. */
export function genRolling(
	rng: () => number,
	count = V2_POINT_COUNT,
): number[] {
	const base = makeNoise(rng);
	const warp = makeNoise(rng);
	const heights = new Array<number>(count);
	for (let i = 0; i < count; i++) {
		const nx = (i / (count - 1)) * 4;
		const warped = nx + (2 * fbm(warp, nx, 3, 1) - 1) * 0.8;
		heights[i] = BASELINE_Y - (2 * fbm(base, warped, 4, 1) - 1) * 85;
	}
	return heights;
}

/** Flats: very-low-amplitude fBm — a near-level plain for "learn the
 * controls" rolls; the challenge is piloting, not terrain. */
export function genFlats(rng: () => number, count = V2_POINT_COUNT): number[] {
	const noise = makeNoise(rng);
	const heights = new Array<number>(count);
	for (let i = 0; i < count; i++) {
		const nx = (i / (count - 1)) * 3;
		heights[i] = BASELINE_Y - (2 * fbm(noise, nx, 3, 1) - 1) * 25;
	}
	return heights;
}

export type TerrainArchetype =
	| "rolling"
	| "crater-field"
	| "spires"
	| "mesa"
	| "flats";

/** Dispatch to the v2 base generator for an archetype. Used by
 * generateTerrain when `difficulty.terrainVersion === 2`. */
export function generateV2Base(
	archetype: TerrainArchetype | undefined,
	rng: () => number,
): number[] {
	switch (archetype) {
		case "crater-field":
			return genCraterField(rng);
		case "spires":
			return genSpires(rng);
		case "mesa":
			return genMesa(rng);
		case "flats":
			return genFlats(rng);
		default:
			return genRolling(rng);
	}
}
