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

/** Generate terrain using midpoint displacement, seeded for determinism */
export function generateTerrain(seed: number): TerrainData {
	const rng = createRng(seed);

	// Start with two endpoints
	const baseY =
		CANVAS_HEIGHT - lerp(TERRAIN_MIN_HEIGHT, TERRAIN_MAX_HEIGHT, 0.5);
	let heights = [baseY - 50 + rng() * 100, baseY - 50 + rng() * 100];

	// Midpoint displacement iterations
	const iterations = 8;
	for (let iter = 0; iter < iterations; iter++) {
		const newHeights: number[] = [];
		const scale = TERRAIN_ROUGHNESS * 0.5 ** iter * 150;
		for (let i = 0; i < heights.length - 1; i++) {
			newHeights.push(heights[i]);
			const mid = (heights[i] + heights[i + 1]) / 2 + (rng() - 0.5) * scale;
			newHeights.push(mid);
		}
		newHeights.push(heights[heights.length - 1]);
		heights = newHeights;
	}

	// Clamp heights to valid range (remember: y increases downward in screen coords)
	const minY = CANVAS_HEIGHT - TERRAIN_MAX_HEIGHT;
	const maxY = CANVAS_HEIGHT - TERRAIN_MIN_HEIGHT;
	heights = heights.map((h) => Math.max(minY, Math.min(maxY, h)));

	// Map heights to world-space points
	const step = WORLD_WIDTH / (heights.length - 1);
	const points: Vec2[] = heights.map((h, i) => vec2(i * step, h));

	// Place landing pads
	const pads = placeLandingPads(points, rng);

	return { points, pads, seed };
}

function placeLandingPads(points: Vec2[], rng: () => number): LandingPad[] {
	const pads: LandingPad[] = [];
	const segmentWidth = WORLD_WIDTH / (PAD_COUNT + 1);

	for (let i = 0; i < PAD_COUNT; i++) {
		// Pick a zone for this pad
		const zoneStart = segmentWidth * (i + 0.5);
		const zoneEnd = segmentWidth * (i + 1.5);
		const padCenterX = zoneStart + rng() * (zoneEnd - zoneStart);

		// Width: random between min and max — narrower = more points
		const padWidth = PAD_MIN_WIDTH + rng() * (PAD_MAX_WIDTH - PAD_MIN_WIDTH);

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
		const widthRatio =
			1 - (padWidth - PAD_MIN_WIDTH) / (PAD_MAX_WIDTH - PAD_MIN_WIDTH);
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
