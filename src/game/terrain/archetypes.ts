import { CANVAS_HEIGHT, WORLD_WIDTH } from "../../utils/constants";
import type { Vec2 } from "../../utils/math";
import type { LandingPad } from "../Terrain";

/**
 * Archetype generators run AFTER midpoint displacement and AFTER pad
 * placement but BEFORE any `specialFeature` post-pass. They mutate
 * the points array in place, avoiding pad zones so landings stay
 * possible. Each archetype uses only the provided `rng` for
 * deterministic output.
 *
 * Helper `findFreeColumnsBetweenPads` gives every generator a
 * consistent way to pick terrain columns that don't overlap any pad
 * (with a safety margin), so we don't accidentally make a mission
 * unlandable by dropping a crater on a pad.
 */

/** Padding in pixels around each pad that archetype generators must
 * avoid touching. Matches the convention in applySpecialFeature so
 * "rille + crater-field" produces consistent pad-safety behavior. */
const PAD_AVOID_MARGIN = 4;

export function isOnOrNearPad(x: number, pads: LandingPad[]): boolean {
	return pads.some(
		(p) => x >= p.x - PAD_AVOID_MARGIN && x <= p.x + p.width + PAD_AVOID_MARGIN,
	);
}

/**
 * Find contiguous ranges of terrain columns that don't overlap any
 * pad. Used by `spires` and `mesa` to pick insertion points that
 * won't sit on top of a landing pad. Returns ranges in `x` world-
 * space coordinates. Each range is wide enough to fit `minWidth`.
 */
export function findFreeColumnsBetweenPads(
	pads: LandingPad[],
	minWidth: number,
): { start: number; end: number }[] {
	const sorted = [...pads].sort((a, b) => a.x - b.x);
	const ranges: { start: number; end: number }[] = [];
	let cursor = 0;
	for (const p of sorted) {
		const rangeEnd = p.x - PAD_AVOID_MARGIN;
		if (rangeEnd - cursor >= minWidth) {
			ranges.push({ start: cursor, end: rangeEnd });
		}
		cursor = p.x + p.width + PAD_AVOID_MARGIN;
	}
	if (WORLD_WIDTH - cursor >= minWidth) {
		ranges.push({ start: cursor, end: WORLD_WIDTH });
	}
	return ranges;
}

/**
 * Apply a crater-field archetype: 8-15 circular depressions of
 * varying radius. Each crater adds a parabolic indent at a non-pad
 * location, with a subtle rim lip so the crater reads as a crater
 * and not just a random dip.
 */
export function applyCraterField(
	points: Vec2[],
	pads: LandingPad[],
	rng: () => number,
): void {
	const count = 8 + Math.floor(rng() * 8); // 8-15
	const usableRanges = findFreeColumnsBetweenPads(pads, 60);
	if (usableRanges.length === 0) return;

	for (let i = 0; i < count; i++) {
		const range = usableRanges[Math.floor(rng() * usableRanges.length)];
		const center = range.start + rng() * (range.end - range.start);
		const radius = 20 + rng() * 60; // 20-80 px
		const depth = 20 + rng() * 25; // 20-45 px
		for (const p of points) {
			if (isOnOrNearPad(p.x, pads)) continue;
			const dx = p.x - center;
			const dist = Math.abs(dx);
			if (dist > radius * 1.15) continue;
			if (dist > radius) {
				// Rim lip — a small bump just outside the crater rim so
				// the crater edge reads as raised material, not a
				// random gouge.
				const rimT = 1 - (dist - radius) / (radius * 0.15);
				p.y -= rimT * 4;
			} else {
				const t = 1 - dist / radius;
				p.y += depth * t * t; // quadratic falloff = parabolic bowl
			}
		}
	}
}

/**
 * Apply a spires archetype: 3-6 narrow tall peaks between pads.
 * Each spire is 8-20 px wide and 100-200 px tall. Creates vertical-
 * threading gameplay where the player has to navigate between
 * slender vertical hazards. Spires never sit on pads.
 */
export function applySpires(
	points: Vec2[],
	pads: LandingPad[],
	rng: () => number,
): void {
	const count = 3 + Math.floor(rng() * 4); // 3-6
	const usableRanges = findFreeColumnsBetweenPads(pads, 40);
	if (usableRanges.length === 0) return;

	for (let i = 0; i < count; i++) {
		const range = usableRanges[Math.floor(rng() * usableRanges.length)];
		const center = range.start + rng() * (range.end - range.start);
		const halfWidth = 4 + rng() * 6; // half-width 4-10 px → total 8-20 px
		const height = 100 + rng() * 100; // 100-200 px tall
		for (const p of points) {
			if (isOnOrNearPad(p.x, pads)) continue;
			const dx = p.x - center;
			const dist = Math.abs(dx);
			if (dist > halfWidth) continue;
			const t = 1 - dist / halfWidth;
			// y increases downward; subtract to raise terrain
			p.y -= height * t ** 0.6; // sharper-than-linear rise for spire shape
		}
	}
}

/**
 * Apply a mesa archetype: 2-3 wide raised plateaus (200-400 px wide,
 * 80-120 px tall). Flat-topped raised sections with gradual slopes
 * at each edge. Good for missions where the player might have to
 * make a decision about landing on top of a plateau vs on the
 * ground below.
 */
export function applyMesa(
	points: Vec2[],
	pads: LandingPad[],
	rng: () => number,
): void {
	const count = 2 + Math.floor(rng() * 2); // 2-3
	const usableRanges = findFreeColumnsBetweenPads(pads, 250);
	if (usableRanges.length === 0) return;

	for (let i = 0; i < count; i++) {
		const range = usableRanges[Math.floor(rng() * usableRanges.length)];
		const rangeSpan = range.end - range.start;
		if (rangeSpan < 250) continue;
		const mesaWidth = 200 + rng() * 200; // 200-400 px
		const halfMesa = Math.min(mesaWidth, rangeSpan * 0.8) / 2;
		const centerMin = range.start + halfMesa;
		const centerMax = range.end - halfMesa;
		if (centerMin >= centerMax) continue;
		const center = centerMin + rng() * (centerMax - centerMin);
		const height = 80 + rng() * 40; // 80-120 px
		const slopeWidth = 30; // px over which terrain ramps up to the plateau
		for (const p of points) {
			if (isOnOrNearPad(p.x, pads)) continue;
			const dx = p.x - center;
			const dist = Math.abs(dx);
			const innerEdge = halfMesa - slopeWidth;
			if (dist <= innerEdge) {
				// Flat top of the mesa
				p.y -= height;
			} else if (dist <= halfMesa) {
				// Slope down to surrounding terrain
				const t = 1 - (dist - innerEdge) / slopeWidth;
				p.y -= height * t;
			}
		}
	}
}

/**
 * Apply a flats archetype: smooth the terrain toward a baseline
 * (low roughness feel) and scatter 3-5 boulder clusters. Flats is
 * designed for "learn the controls" missions — the terrain puzzle
 * is minimal, the challenge is piloting.
 */
export function applyFlats(
	points: Vec2[],
	pads: LandingPad[],
	rng: () => number,
): void {
	// Smooth heights toward the median of non-pad points. Preserves
	// the seeded character of the heights slightly but trims out
	// extreme bumps.
	const nonPadYs: number[] = [];
	for (const p of points) {
		if (!isOnOrNearPad(p.x, pads)) nonPadYs.push(p.y);
	}
	if (nonPadYs.length === 0) return;
	const sortedYs = [...nonPadYs].sort((a, b) => a - b);
	const medianY = sortedYs[Math.floor(sortedYs.length / 2)];
	const smoothingStrength = 0.8; // pull 80% toward median
	for (const p of points) {
		if (isOnOrNearPad(p.x, pads)) continue;
		p.y = p.y * (1 - smoothingStrength) + medianY * smoothingStrength;
	}

	// Scatter boulder clusters — small bumps sitting on top of the
	// smoothed surface. Each cluster is 2-4 boulders in a small area.
	const clusterCount = 3 + Math.floor(rng() * 3); // 3-5
	const usableRanges = findFreeColumnsBetweenPads(pads, 80);
	if (usableRanges.length === 0) return;

	for (let c = 0; c < clusterCount; c++) {
		const range = usableRanges[Math.floor(rng() * usableRanges.length)];
		const clusterCenter = range.start + rng() * (range.end - range.start);
		const clusterSpread = 30 + rng() * 30;
		const boulderCount = 2 + Math.floor(rng() * 3); // 2-4
		for (let b = 0; b < boulderCount; b++) {
			const boulderX = clusterCenter + (rng() - 0.5) * clusterSpread * 2;
			const boulderRadius = 10 + rng() * 15; // 10-25 px
			const boulderHeight = 15 + rng() * 15; // 15-30 px
			for (const p of points) {
				if (isOnOrNearPad(p.x, pads)) continue;
				const dx = p.x - boulderX;
				const dist = Math.abs(dx);
				if (dist > boulderRadius) continue;
				const t = 1 - dist / boulderRadius;
				p.y -= boulderHeight * t * t;
			}
		}
	}
}

/**
 * Dispatch to the archetype generator. Called from generateTerrain
 * after pad placement, before specialFeature. `rolling` and undefined
 * are no-ops (bypass dispatch), preserving v0.6.0.0 behavior for
 * freeplay missions that don't set archetype.
 *
 * The regression pin for MISSIONS[] seeds + Apollo 11/15/17 depends
 * on `rolling` and `undefined` producing identical output to
 * calling generateTerrain without any archetype field at all.
 */
export function applyArchetype(
	archetype:
		| "rolling"
		| "crater-field"
		| "spires"
		| "mesa"
		| "flats"
		| undefined,
	points: Vec2[],
	pads: LandingPad[],
	rng: () => number,
): void {
	// Silence the CANVAS_HEIGHT import; future archetypes may need it
	// for clamp math. Keeping the import prevents re-adding it later.
	void CANVAS_HEIGHT;
	if (!archetype || archetype === "rolling") return;
	switch (archetype) {
		case "crater-field":
			applyCraterField(points, pads, rng);
			return;
		case "spires":
			applySpires(points, pads, rng);
			return;
		case "mesa":
			applyMesa(points, pads, rng);
			return;
		case "flats":
			applyFlats(points, pads, rng);
			return;
	}
}
