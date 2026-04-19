import {
	CANVAS_HEIGHT,
	PAD_COUNT,
	PAD_MAX_WIDTH,
	PAD_MIN_WIDTH,
	TERRAIN_MAX_HEIGHT,
	TERRAIN_MIN_HEIGHT,
	TERRAIN_ROUGHNESS,
	WORLD_WIDTH,
} from "../utils/constants";
import { createRng, lerp, type Vec2, vec2 } from "../utils/math";
import { applyArchetype } from "./terrain/archetypes";

export interface LandingPad {
	x: number;
	y: number;
	width: number;
	points: number; // score multiplier — narrower pad = more points
}

export interface TerrainData {
	points: Vec2[];
	pads: LandingPad[];
	seed: number;
}

/** Difficulty overrides for campaign mode */
export interface DifficultyConfig {
	roughness?: number; // 0-1, higher = rougher terrain
	padMinWidth?: number; // minimum pad width in px
	padMaxWidth?: number; // maximum pad width in px
	padCount?: number; // number of landing pads
	startingFuel?: number; // fuel override
	spawnY?: number; // starting altitude (lower = harder)
	windStrength?: number; // wind force (0 = none, 50+ = strong)
	landerType?: string; // lander variant name
	aliensEnabled?: boolean; // force alien spawn (campaign)
	gravityStormsEnabled?: boolean; // force gravity storms (campaign)
	crevices?: number; // number of sharp crevices to carve (0 = none)
	/**
	 * Optional post-pass terrain feature for historic missions.
	 * - "rille": narrow V-trench carved between pads (Apollo 15 / Hadley Rille flavor)
	 * - "valley": tall walls raised at world edges, central plain preserved (Apollo 17 / Taurus-Littrow flavor)
	 */
	specialFeature?: "rille" | "valley";
	/**
	 * Sprint 7.1 — terrain archetype dispatch. Selects the post-midpoint-
	 * displacement processor used to give the mission its geometric
	 * character. Undefined falls through to the default (no extra
	 * processing, byte-identical to v0.6.0.0 midpoint displacement).
	 * `rolling` is a no-op value that also bypasses dispatch — use it
	 * when a mission needs an explicit archetype tag for palette or UX
	 * purposes but doesn't want the geometry touched. Archetype applies
	 * before `specialFeature`, so Apollo 15 (archetype=rolling +
	 * specialFeature=rille) keeps both behaviors.
	 */
	archetype?:
		| "rolling"
		| "crater-field"
		| "spires"
		| "mesa"
		| "flats";
}

/** Generate terrain using midpoint displacement, seeded for determinism */
export function generateTerrain(
	seed: number,
	difficulty?: DifficultyConfig,
): TerrainData {
	const rng = createRng(seed);

	const roughness = difficulty?.roughness ?? TERRAIN_ROUGHNESS;

	// Start with two endpoints
	const baseY =
		CANVAS_HEIGHT - lerp(TERRAIN_MIN_HEIGHT, TERRAIN_MAX_HEIGHT, 0.5);
	let heights = [baseY - 50 + rng() * 100, baseY - 50 + rng() * 100];

	// Midpoint displacement iterations
	const iterations = 8;
	for (let iter = 0; iter < iterations; iter++) {
		const newHeights: number[] = [];
		const scale = roughness * 0.5 ** iter * 150;
		for (let i = 0; i < heights.length - 1; i++) {
			newHeights.push(heights[i]);
			const mid = (heights[i] + heights[i + 1]) / 2 + (rng() - 0.5) * scale;
			newHeights.push(mid);
		}
		newHeights.push(heights[heights.length - 1]);
		heights = newHeights;
	}

	// Carve crevices — sharp V-shaped dips for harder missions
	const creviceCount = difficulty?.crevices ?? 0;
	if (creviceCount > 0) {
		const segmentLen = Math.floor(heights.length / (creviceCount + 1));
		for (let c = 0; c < creviceCount; c++) {
			const center =
				segmentLen * (c + 1) + Math.floor((rng() - 0.5) * segmentLen * 0.4);
			const depth = 60 + rng() * 80; // 60-140 units deep
			const halfWidth = 3 + Math.floor(rng() * 5); // 3-7 points wide each side
			for (let j = -halfWidth; j <= halfWidth; j++) {
				const idx = center + j;
				if (idx >= 0 && idx < heights.length) {
					const t = 1 - Math.abs(j) / (halfWidth + 1);
					heights[idx] += depth * t * t; // quadratic falloff for V shape
				}
			}
		}
	}

	// Clamp heights to valid range (remember: y increases downward in screen coords)
	const minY = CANVAS_HEIGHT - TERRAIN_MAX_HEIGHT;
	const maxY = CANVAS_HEIGHT - TERRAIN_MIN_HEIGHT;
	heights = heights.map((h) => Math.max(minY, Math.min(maxY, h)));

	// Map heights to world-space points
	const step = WORLD_WIDTH / (heights.length - 1);
	const points: Vec2[] = heights.map((h, i) => vec2(i * step, h));

	// Place landing pads
	const pads = placeLandingPads(points, rng, difficulty);

	// Sprint 7.1 — optional archetype post-pass. Runs after pads so it
	// can avoid touching pad zones. `rolling` and `undefined` are
	// no-ops (bypass dispatch entirely), preserving v0.6.0.0 output
	// exactly. The regression pin for MISSIONS[] seeds + Apollo 11/15/17
	// depends on that no-op path.
	applyArchetype(difficulty?.archetype, points, pads, rng);

	// Optional historic-mission flavor pass. Runs after pads AND after
	// archetype so "rolling + rille" stays identical to v0.5.x behavior
	// and a mission could in principle combine archetype + specialFeature
	// (e.g. crater-field + rille) if a future mission opts in.
	if (difficulty?.specialFeature) {
		applySpecialFeature(points, pads, rng, difficulty.specialFeature);
	}

	return { points, pads, seed };
}

/**
 * Apply a historic-mission terrain flavor pass.
 *
 * Both features preserve pad heights — they only modify points outside
 * pad zones. Without this guarantee we'd silently make landings
 * impossible by tilting the pad surface.
 */
function applySpecialFeature(
	points: Vec2[],
	pads: LandingPad[],
	rng: () => number,
	feature: "rille" | "valley",
): void {
	const isOnPad = (x: number): boolean =>
		pads.some((p) => x >= p.x - 4 && x <= p.x + p.width + 4);

	if (feature === "rille") {
		// Hadley Rille: narrow V-trench between pads. Center it in the
		// largest pad-free gap so it never bisects a landing zone.
		const gaps: { center: number; width: number }[] = [];
		const sorted = [...pads].sort((a, b) => a.x - b.x);
		let prev = 0;
		for (const p of sorted) {
			if (p.x > prev) {
				gaps.push({ center: (prev + p.x) / 2, width: p.x - prev });
			}
			prev = p.x + p.width;
		}
		if (prev < WORLD_WIDTH) {
			gaps.push({
				center: (prev + WORLD_WIDTH) / 2,
				width: WORLD_WIDTH - prev,
			});
		}
		const target = gaps.reduce(
			(best, g) => (g.width > best.width ? g : best),
			gaps[0] ?? { center: WORLD_WIDTH / 2, width: WORLD_WIDTH },
		);

		const trenchHalf = Math.min(80, target.width * 0.25);
		const depth = 90 + rng() * 40; // 90-130 deep
		for (const p of points) {
			const dx = p.x - target.center;
			if (Math.abs(dx) > trenchHalf) continue;
			if (isOnPad(p.x)) continue;
			const t = 1 - Math.abs(dx) / trenchHalf;
			p.y += depth * t * t; // V-shape via quadratic falloff
		}
		return;
	}

	if (feature === "valley") {
		// Taurus-Littrow: raise mountain walls at the world edges, leave
		// a central plain intact. Falloff is cosine-shaped so the walls
		// blend naturally into the existing terrain.
		const wallSpan = WORLD_WIDTH * 0.18;
		const peak = 120 + rng() * 40; // 120-160 high
		for (const p of points) {
			if (isOnPad(p.x)) continue;
			let t = 0;
			if (p.x < wallSpan) {
				t = 1 - p.x / wallSpan;
			} else if (p.x > WORLD_WIDTH - wallSpan) {
				t = 1 - (WORLD_WIDTH - p.x) / wallSpan;
			} else {
				continue;
			}
			// y axis points down on screen, so subtract to raise terrain
			p.y -= peak * t * t;
		}
	}
}

function placeLandingPads(
	points: Vec2[],
	rng: () => number,
	difficulty?: DifficultyConfig,
): LandingPad[] {
	const pads: LandingPad[] = [];
	const padCount = difficulty?.padCount ?? PAD_COUNT;
	const padMin = difficulty?.padMinWidth ?? PAD_MIN_WIDTH;
	const padMax = difficulty?.padMaxWidth ?? PAD_MAX_WIDTH;
	const segmentWidth = WORLD_WIDTH / (padCount + 1);

	for (let i = 0; i < padCount; i++) {
		// Pick a zone for this pad
		const zoneStart = segmentWidth * (i + 0.5);
		const zoneEnd = segmentWidth * (i + 1.5);
		const padCenterX = zoneStart + rng() * (zoneEnd - zoneStart);

		// Width: random between min and max — narrower = more points
		const padWidth = padMin + rng() * (padMax - padMin);

		// Find terrain height at pad center and flatten the pad area
		const padX = padCenterX - padWidth / 2;
		const padRight = padCenterX + padWidth / 2;

		// Get average height in pad zone and flatten those terrain points
		let sumY = 0;
		let count = 0;
		for (const p of points) {
			if (p.x >= padX && p.x <= padRight) {
				sumY += p.y;
				count++;
			}
		}
		const padY =
			count > 0 ? sumY / count : points[Math.floor(points.length / 2)].y;

		// Flatten terrain under pad
		for (const p of points) {
			if (p.x >= padX && p.x <= padRight) {
				p.y = padY;
			}
		}

		// Score inversely proportional to width
		const widthRatio = 1 - (padWidth - padMin) / (padMax - padMin);
		const scoreMultiplier = 1 + Math.floor(widthRatio * 3); // 1x to 4x

		pads.push({
			x: padX,
			y: padY,
			width: padWidth,
			points: scoreMultiplier,
		});
	}

	return pads;
}
