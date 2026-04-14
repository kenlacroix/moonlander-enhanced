import type { InputState } from "../systems/Input";
import {
	FUEL_BURN_RATE,
	ROTATION_SPEED,
	STARTING_FUEL,
} from "../utils/constants";
import type { LanderType } from "./LanderTypes";
import { applyGravity, thrustVector } from "./Physics";

export type LanderStatus = "idle" | "flying" | "landed" | "crashed";

export interface LanderState {
	x: number;
	y: number;
	vx: number;
	vy: number;
	angle: number; // degrees, 0 = pointing up
	angularVel: number;
	fuel: number;
	thrusting: boolean;
	status: LanderStatus;
	landerType: LanderType;
}

export function createLander(
	x: number,
	y: number,
	landerType: LanderType,
): LanderState {
	return {
		x,
		y,
		vx: 0,
		vy: 0,
		angle: 0,
		angularVel: 0,
		fuel: STARTING_FUEL * landerType.fuelMultiplier,
		thrusting: false,
		status: "flying",
		landerType,
	};
}

/** Update lander physics for one fixed timestep */
export function updateLander(
	lander: LanderState,
	input: InputState,
	dt: number,
): void {
	if (lander.status !== "flying") return;

	const lt = lander.landerType;

	// Rotation
	if (input.rotateLeft) {
		lander.angle -= ROTATION_SPEED * lt.rotationMultiplier * dt;
	}
	if (input.rotateRight) {
		lander.angle += ROTATION_SPEED * lt.rotationMultiplier * dt;
	}

	// Thrust
	lander.thrusting = input.thrustUp && lander.fuel > 0;
	if (lander.thrusting) {
		const thrust = thrustVector(lander.angle);
		lander.vx += thrust.x * lt.thrustMultiplier * dt;
		lander.vy += thrust.y * lt.thrustMultiplier * dt;
		lander.fuel = Math.max(0, lander.fuel - FUEL_BURN_RATE * dt);
	}

	// Gravity — mass multiplier makes heavier landers harder to slow down
	lander.vy = applyGravity(lander.vy, dt * lt.massMultiplier);

	// Integrate position
	lander.x += lander.vx * dt;
	lander.y += lander.vy * dt;

	// Prevent flying off screen top
	if (lander.y < 0) {
		lander.y = 0;
		lander.vy = Math.max(0, lander.vy);
	}
}
