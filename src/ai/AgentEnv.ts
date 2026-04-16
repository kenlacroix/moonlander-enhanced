import type { LanderState } from "../game/Lander";
import { getTerrainHeightAt, normAngle } from "../game/Physics";
import type { LandingPad, TerrainData } from "../game/Terrain";
import type { InputState } from "../systems/Input";
import {
	LANDER_HEIGHT,
	MAX_LANDING_SPEED,
	STARTING_FUEL,
} from "../utils/constants";

/**
 * State vector size — 11 dimensions (Sprint 2.7).
 *
 * 0:  dx to nearest pad center (normalized by world width)
 * 1:  altitude above terrain at lander.x (pad-relative)
 * 2:  horizontal velocity
 * 3:  vertical velocity
 * 4:  angle (−1..1, 0 = upright)
 * 5:  angular velocity — previously hardcoded 0, now populated
 * 6:  fuel fraction (0..1)
 * 7:  horizontal distance to pad center / pad width
 * 8:  vertical acceleration (this-frame vy − prev-frame vy) — "am I braking?"
 * 9:  altitude above the pad surface (informative when terrain between
 *     lander and pad is higher than the pad itself)
 * 10: approach velocity toward pad (dot of velocity with unit dir-to-pad)
 *
 * Changing STATE_SIZE breaks saved IndexedDB weights with old 8-dim shape.
 * RLAgent.loadWeights catches the shape mismatch and logs a warning.
 */
export const STATE_SIZE = 11;
export const ACTION_COUNT = 4;

export function findNearestPad(
	lander: LanderState,
	terrain: TerrainData,
): LandingPad | null {
	if (terrain.pads.length === 0) return null;
	let best = terrain.pads[0];
	let bestDist = Math.abs(lander.x - (best.x + best.width / 2));
	for (const pad of terrain.pads) {
		const dist = Math.abs(lander.x - (pad.x + pad.width / 2));
		if (dist < bestDist) {
			best = pad;
			bestDist = dist;
		}
	}
	return best;
}

/**
 * Module-level cache of previous vertical velocity for acceleration
 * computation. Reset to 0 at the start of each episode via
 * `resetStateCache()`. Using a module-level field keeps getState pure
 * from the caller's perspective without threading "prev state" through
 * every call site.
 */
let prevVy = 0;

export function resetStateCache(): void {
	prevVy = 0;
}

export function getState(lander: LanderState, terrain: TerrainData): number[] {
	const pad = findNearestPad(lander, terrain);
	const padCenterX = pad ? pad.x + pad.width / 2 : lander.x;
	const padCenterY = pad?.y ?? 0;
	const padWidth = pad?.width ?? 100;
	const terrainY = getTerrainHeightAt(lander.x, terrain.points);
	const altitude = terrainY - (lander.y + LANDER_HEIGHT / 2);

	// New dims (Sprint 2.7)
	const vertAccel = (lander.vy - prevVy) / 300; // normalized, −1..1 typical
	prevVy = lander.vy;

	// Altitude above the pad surface specifically (dim 9). This differs
	// from dim 1 (altitude above the terrain directly below lander.x) —
	// when the agent is flying OVER non-pad terrain, dim 1 measures
	// ground clearance but dim 9 measures how much further it still needs
	// to descend to reach the landing target. Informative during final
	// approach and when terrain between the lander and the pad is higher
	// than the pad itself.
	const altitudeAbovePad = pad
		? Math.max(-1, Math.min(1, (pad.y - (lander.y + LANDER_HEIGHT / 2)) / 500))
		: Math.min(altitude / 500, 1);

	// Approach velocity: dot of velocity with unit vector toward pad
	let approachVel = 0;
	if (pad) {
		const dxRaw = padCenterX - lander.x;
		const dyRaw = padCenterY - lander.y;
		const dist = Math.sqrt(dxRaw * dxRaw + dyRaw * dyRaw) || 1;
		const ux = dxRaw / dist;
		const uy = dyRaw / dist;
		// Positive = moving toward pad
		approachVel = (lander.vx * ux + lander.vy * uy) / 300;
	}

	return [
		(padCenterX - lander.x) / 2000,
		Math.min(altitude / 500, 1),
		lander.vx / 300,
		lander.vy / 300,
		normAngle(lander.angle) / 180,
		lander.angularVel / 180, // previously hardcoded 0
		lander.fuel / STARTING_FUEL,
		pad ? Math.abs(lander.x - padCenterX) / padWidth : 1,
		vertAccel,
		altitudeAbovePad,
		approachVel,
	];
}

export function actionToInput(action: number): InputState {
	return {
		thrustUp: action === 1,
		rotateLeft: action === 2,
		rotateRight: action === 3,
		restart: false,
		menuUp: false,
		menuDown: false,
		menuSelect: false,
		menuBack: false,
		toggleAutopilot: false,
		openSettings: false,
		toggleRetroSkin: false,
		exportGhost: false,
		importGhost: false,
		flightReport: false,
		toggleRelay: false,
		toggleAnnotations: false,
		forkTakeover: false,
	};
}

/**
 * Structured reward with a named component breakdown. Training path
 * uses `.total` (via `calculateReward` wrapper); Sprint 2.6 Explain
 * Mode reads `.components` for the panel display. Single source of
 * truth prevents the debug view from drifting from the training signal.
 */
export interface RewardBreakdown {
	total: number;
	terminal: number; // landing or crash contribution
	proximity: number; // "be near the pad"
	descent: number; // "descend while near pad"
	speed: number; // "keep vertical speed manageable"
	anglePenalty: number; // "stay upright"
	approach: number; // "move toward the pad"
	timeTax: number; // "don't hover forever"
}

const EMPTY_BREAKDOWN = (total: number): RewardBreakdown => ({
	total,
	terminal: total,
	proximity: 0,
	descent: 0,
	speed: 0,
	anglePenalty: 0,
	approach: 0,
	timeTax: 0,
});

/**
 * Compute the per-step reward with component breakdown.
 *
 * Terminal reward scales with landing quality (Sprint 2.7) so the agent
 * learns to prefer GOOD landings, not just any landing. Shaping signals
 * are roughly 2× stronger than the pre-Sprint-2.7 reward so the gradient
 * before the first landing is meaningful.
 */
export function calculateRewardBreakdown(
	lander: LanderState,
	terrain: TerrainData,
	landed: boolean,
	crashed: boolean,
): RewardBreakdown {
	if (crashed) return EMPTY_BREAKDOWN(-100);

	const pad = findNearestPad(lander, terrain);

	if (landed) {
		// Quality-scaled landing: baseline 100, bonus for clean + centered
		const speedFactor = Math.max(
			0,
			1 - Math.abs(lander.vy) / MAX_LANDING_SPEED,
		); // 1 = smooth stop, 0 = hit the speed limit
		const angleFactor = Math.max(0, 1 - Math.abs(normAngle(lander.angle)) / 10); // 1 = upright, 0 = 10°+ tilt
		const centerFactor = pad
			? Math.max(
					0,
					1 - Math.abs(lander.x - (pad.x + pad.width / 2)) / (pad.width / 2),
				)
			: 0.5;
		const quality = speedFactor * angleFactor * centerFactor;
		// Range: 100 (worst acceptable landing) to 200 (perfect landing)
		return EMPTY_BREAKDOWN(100 + quality * 100);
	}

	if (!pad) return EMPTY_BREAKDOWN(-1);

	const padCenterX = pad.x + pad.width / 2;
	const padCenterY = pad.y;
	const terrainY = getTerrainHeightAt(lander.x, terrain.points);
	const altitude = terrainY - (lander.y + LANDER_HEIGHT / 2);

	// Proximity: be near the pad (stronger weight than Sprint 2.5)
	const dx = Math.abs(lander.x - padCenterX);
	const proximityNorm = Math.max(0, 1 - dx / 1000);
	const proximity = proximityNorm * 0.5;

	// Descent: descend while near the pad
	const normalizedAlt = Math.min(altitude / 500, 1);
	const descent = (1 - normalizedAlt) * proximityNorm * 0.3;

	// Speed: reward controlled descent, penalize wild falls
	let speed = 0;
	if (lander.vy > 0 && lander.vy < MAX_LANDING_SPEED * 2) {
		speed = 0.3;
	} else if (lander.vy > MAX_LANDING_SPEED * 3) {
		speed = -0.3;
	}

	// Angle: stay upright (stronger than pre-Sprint-2.7)
	const angleNorm = Math.abs(normAngle(lander.angle)) / 180;
	const anglePenalty = -angleNorm * 0.5;

	// Approach: reward velocity vector pointing at the pad
	const dxRaw = padCenterX - lander.x;
	const dyRaw = padCenterY - lander.y;
	const dist = Math.sqrt(dxRaw * dxRaw + dyRaw * dyRaw) || 1;
	const ux = dxRaw / dist;
	const uy = dyRaw / dist;
	const approachRaw = (lander.vx * ux + lander.vy * uy) / 100;
	// Clamp so a wild falling run doesn't rack up huge approach-reward
	const approach = Math.max(-0.3, Math.min(0.3, approachRaw * 0.2));

	// Time tax (doubled from Sprint 2.5)
	const timeTax = -0.02;

	const total = proximity + descent + speed + anglePenalty + approach + timeTax;

	return {
		total,
		terminal: 0,
		proximity,
		descent,
		speed,
		anglePenalty,
		approach,
		timeTax,
	};
}

/** Thin wrapper for training hot path. Avoids per-step struct allocation. */
export function calculateReward(
	lander: LanderState,
	terrain: TerrainData,
	landed: boolean,
	crashed: boolean,
): number {
	return calculateRewardBreakdown(lander, terrain, landed, crashed).total;
}
