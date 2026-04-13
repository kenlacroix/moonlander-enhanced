import type { InputState } from "../systems/Input";
import {
	FUEL_BURN_RATE,
	ROTATION_SPEED,
	STARTING_FUEL,
} from "../utils/constants";
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
}

export function createLander(x: number, y: number): LanderState {
	return {
		x,
		y,
		vx: 0,
		vy: 0,
		angle: 0,
		angularVel: 0,
		fuel: STARTING_FUEL,
		thrusting: false,
		status: "flying",
	};
}

/** Update lander physics for one fixed timestep */
export function updateLander(
	lander: LanderState,
	input: InputState,
	dt: number,
): void {
	if (lander.status !== "flying") return;

	// Rotation
	if (input.rotateLeft) {
		lander.angle -= ROTATION_SPEED * dt;
	}
	if (input.rotateRight) {
		lander.angle += ROTATION_SPEED * dt;
	}

	// Thrust
	lander.thrusting = input.thrustUp && lander.fuel > 0;
	if (lander.thrusting) {
		const thrust = thrustVector(lander.angle);
		lander.vx += thrust.x * dt;
		lander.vy += thrust.y * dt;
		lander.fuel = Math.max(0, lander.fuel - FUEL_BURN_RATE * dt);
	}

	// Gravity (always applies)
	lander.vy = applyGravity(lander.vy, dt);

	// Integrate position
	lander.x += lander.vx * dt;
	lander.y += lander.vy * dt;

	// Prevent flying off screen top
	if (lander.y < 0) {
		lander.y = 0;
		lander.vy = Math.max(0, lander.vy);
	}
}
