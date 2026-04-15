import type { LanderState } from "../game/Lander";
import { getTerrainHeightAt, normAngle } from "../game/Physics";
import type { LandingPad, TerrainData } from "../game/Terrain";
import type { InputState } from "../systems/Input";
import {
	LANDER_HEIGHT,
	MAX_LANDING_SPEED,
	STARTING_FUEL,
} from "../utils/constants";

export const STATE_SIZE = 8;
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

export function getState(lander: LanderState, terrain: TerrainData): number[] {
	const pad = findNearestPad(lander, terrain);
	const padCenterX = pad ? pad.x + pad.width / 2 : lander.x;
	const padWidth = pad?.width ?? 100;
	const terrainY = getTerrainHeightAt(lander.x, terrain.points);
	const altitude = terrainY - (lander.y + LANDER_HEIGHT / 2);

	return [
		(padCenterX - lander.x) / 2000,
		Math.min(altitude / 500, 1),
		lander.vx / 300,
		lander.vy / 300,
		normAngle(lander.angle) / 180,
		0,
		lander.fuel / STARTING_FUEL,
		pad ? Math.abs(lander.x - padCenterX) / padWidth : 1,
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
	};
}

export function calculateReward(
	lander: LanderState,
	terrain: TerrainData,
	landed: boolean,
	crashed: boolean,
): number {
	if (landed) return 100;
	if (crashed) return -100;

	const pad = findNearestPad(lander, terrain);
	if (!pad) return -1;

	const padCenterX = pad.x + pad.width / 2;
	const terrainY = getTerrainHeightAt(lander.x, terrain.points);
	const altitude = terrainY - (lander.y + LANDER_HEIGHT / 2);

	let reward = 0;
	const dx = Math.abs(lander.x - padCenterX);
	const proximity = Math.max(0, 1 - dx / 1000);
	reward += proximity * 0.3;

	const normalizedAlt = Math.min(altitude / 500, 1);
	reward += (1 - normalizedAlt) * proximity * 0.3;

	if (lander.vy > 0 && lander.vy < MAX_LANDING_SPEED * 2) {
		reward += 0.2;
	} else if (lander.vy > MAX_LANDING_SPEED * 3) {
		reward -= 0.2;
	}

	const anglePenalty = Math.abs(normAngle(lander.angle)) / 180;
	reward -= anglePenalty * 0.3;
	reward -= 0.01;

	return reward;
}
