import {
	GRAVITY,
	LANDER_HEIGHT,
	MAX_LANDING_ANGLE,
	MAX_LANDING_SPEED,
	THRUST_FORCE,
} from "../utils/constants";
import { degToRad, type Vec2, vec2 } from "../utils/math";
import type { LanderState } from "./Lander";
import type { LandingPad, TerrainData } from "./Terrain";

export interface CollisionResult {
	collided: boolean;
	onPad: LandingPad | null;
	safeLanding: boolean;
}

/** Apply gravity to velocity */
export function applyGravity(vy: number, dt: number): number {
	return vy + GRAVITY * dt;
}

/** Compute thrust vector from lander angle */
export function thrustVector(angleDeg: number): Vec2 {
	// 0° = pointing up, thrust pushes in the direction the lander faces
	const rad = degToRad(angleDeg - 90);
	return vec2(Math.cos(rad) * THRUST_FORCE, Math.sin(rad) * THRUST_FORCE);
}

/** Check if lander collides with terrain, and whether it's a safe landing */
export function checkCollision(
	lander: LanderState,
	terrain: TerrainData,
): CollisionResult {
	const landerBottom = lander.y + LANDER_HEIGHT / 2;

	// Check if lander overlaps a landing pad (center must be over pad)
	for (const pad of terrain.pads) {
		if (lander.x >= pad.x && lander.x <= pad.x + pad.width) {
			if (landerBottom >= pad.y) {
				const angleDev = Math.abs(normAngle(lander.angle));
				const safeLanding =
					Math.abs(lander.vy) <= MAX_LANDING_SPEED &&
					Math.abs(lander.vx) <= MAX_LANDING_SPEED &&
					angleDev <= MAX_LANDING_ANGLE;
				return { collided: true, onPad: pad, safeLanding };
			}
		}
	}

	// Check terrain collision — find the terrain height at lander's x position
	const terrainY = getTerrainHeightAt(lander.x, terrain.points);
	if (landerBottom >= terrainY) {
		return { collided: true, onPad: null, safeLanding: false };
	}

	return { collided: false, onPad: null, safeLanding: false };
}

/** Get terrain height at a given x by linearly interpolating between terrain points */
export function getTerrainHeightAt(x: number, points: Vec2[]): number {
	if (points.length < 2) return Infinity;

	// Find the two points bracketing x
	for (let i = 0; i < points.length - 1; i++) {
		if (x >= points[i].x && x <= points[i + 1].x) {
			const t = (x - points[i].x) / (points[i + 1].x - points[i].x);
			return points[i].y + t * (points[i + 1].y - points[i].y);
		}
	}

	// If x is outside terrain bounds, return the nearest edge height
	if (x < points[0].x) return points[0].y;
	return points[points.length - 1].y;
}

/** Normalize angle to -180..180 range */
export function normAngle(angle: number): number {
	return ((angle % 360) + 540) % 360 - 180;
}
