import type { InputState } from "../systems/Input";
import {
	ANGULAR_ACCEL,
	FUEL_BURN_RATE,
	MAX_ANGULAR_VEL,
	RCS_BURN_RATE,
	ROTATION_SPEED,
	STARTING_FUEL,
	STARTING_RCS,
} from "../utils/constants";
import { clamp } from "../utils/math";
import type { LanderType } from "./LanderTypes";
import { applyGravity, thrustVector } from "./Physics";

export type LanderStatus = "idle" | "flying" | "landed" | "crashed";

/**
 * Sprint 7.2 — physicsVersion on LanderState is the single source of truth for
 * which integrator runs and which landing-safety rules apply. New flights
 * default to 3. v2 ghost replays set this to 2 on spawn (see GhostReplay.ts),
 * then everything downstream branches on `lander.physicsVersion`.
 */
export type PhysicsVersion = 2 | 3;

export interface LanderState {
	x: number;
	y: number;
	vx: number;
	vy: number;
	angle: number; // degrees, 0 = pointing up
	angularVel: number; // degrees/sec; v2 leaves this at 0, v3 integrates it
	fuel: number;
	/** Sprint 7.2 — reaction control system propellant. Separate tank from fuel,
	 * used for rotation only (mirrors Apollo LM DPS/RCS split). Always 0 and
	 * ignored under physicsVersion 2. */
	rcs: number;
	thrusting: boolean;
	/** Sprint 7.2 — true while rotate-left or rotate-right is consuming RCS.
	 * Rendered as corner puffs in the particle system. Always false under v2. */
	rcsFiring: boolean;
	/** Sprint 7.2 — which direction the RCS is firing this frame.
	 *  -1 = rotateLeft (counter-clockwise torque → right-front quadrant puffs)
	 *  +1 = rotateRight (clockwise torque → left-front quadrant puffs)
	 *   0 = not firing
	 * Stored on the lander so the render path can pick the correct corner
	 * without having to peek at the input system (which varies per tick
	 * vs. per-frame and isn't always in scope). Always 0 under v2. */
	rcsFiringDirection: -1 | 0 | 1;
	status: LanderStatus;
	landerType: LanderType;
	physicsVersion: PhysicsVersion;
}

export function createLander(
	x: number,
	y: number,
	landerType: LanderType,
	physicsVersion: PhysicsVersion = 3,
): LanderState {
	return {
		x,
		y,
		vx: 0,
		vy: 0,
		angle: 0,
		angularVel: 0,
		fuel: STARTING_FUEL * landerType.fuelMultiplier,
		// Scale RCS by lander type — Apollo LM sluggish (0.9), Sparrow nimble (1.2),
		// Luna 9 minimal (0.7). Defaults to 1.0 if a lander type didn't opt in.
		rcs: STARTING_RCS * (landerType.rcsMultiplier ?? 1),
		thrusting: false,
		rcsFiring: false,
		rcsFiringDirection: 0,
		status: "flying",
		landerType,
		physicsVersion,
	};
}

/**
 * Sprint 7.2 — rigid-body lander integrator.
 *
 * v3 ASCII data flow (per fixed timestep):
 *
 *   input.rotateLeft  ──► (rcs>0) ? angularVel -= ANGULAR_ACCEL * dt, rcs -= RCS_BURN_RATE * dt : no-op
 *   input.rotateRight ──► (rcs>0) ? angularVel += ANGULAR_ACCEL * dt, rcs -= RCS_BURN_RATE * dt : no-op
 *   clamp angularVel to ±MAX_ANGULAR_VEL
 *   angle += angularVel * dt
 *   input.thrustUp    ──► (fuel>0) ? apply thrust, fuel -= FUEL_BURN_RATE * dt : no-op
 *   apply gravity to vy
 *   integrate x,y
 *
 * Empty RCS tank = cannot rotate (angularVel stays at whatever it was — you're
 * stuck spinning). Empty fuel = cannot thrust (you fall). Both tanks are
 * independent.
 */
export function updateLander(
	lander: LanderState,
	input: InputState,
	dt: number,
	gravityOverride?: number,
): void {
	if (lander.status !== "flying") return;

	const lt = lander.landerType;
	const rcsMult = lt.rcsMultiplier ?? 1;

	// Rotation — RCS-gated, momentum-preserving. Release the rotate key and the
	// lander keeps spinning at its built-up angular velocity (vacuum, no drag).
	lander.rcsFiring = false;
	lander.rcsFiringDirection = 0;
	if (input.rotateLeft && lander.rcs > 0) {
		lander.angularVel -= ANGULAR_ACCEL * rcsMult * dt;
		lander.rcs = Math.max(0, lander.rcs - RCS_BURN_RATE * dt);
		lander.rcsFiring = true;
		lander.rcsFiringDirection = -1;
	}
	if (input.rotateRight && lander.rcs > 0) {
		lander.angularVel += ANGULAR_ACCEL * rcsMult * dt;
		lander.rcs = Math.max(0, lander.rcs - RCS_BURN_RATE * dt);
		lander.rcsFiring = true;
		lander.rcsFiringDirection = 1;
	}
	// Clamp angular velocity so a pathological autopilot or malformed input
	// can't spin the integrator into runaway floating-point territory.
	lander.angularVel = clamp(
		lander.angularVel,
		-MAX_ANGULAR_VEL,
		MAX_ANGULAR_VEL,
	);
	lander.angle += lander.angularVel * dt;

	// Thrust
	lander.thrusting = input.thrustUp && lander.fuel > 0;
	if (lander.thrusting) {
		const thrust = thrustVector(lander.angle);
		lander.vx += thrust.x * lt.thrustMultiplier * dt;
		lander.vy += thrust.y * lt.thrustMultiplier * dt;
		lander.fuel = Math.max(0, lander.fuel - FUEL_BURN_RATE * dt);
	}

	// Gravity — mass multiplier makes heavier landers harder to slow down
	lander.vy = applyGravity(lander.vy, dt * lt.massMultiplier, gravityOverride);

	// Integrate position
	lander.x += lander.vx * dt;
	lander.y += lander.vy * dt;

	// Prevent flying off screen top
	if (lander.y < 0) {
		lander.y = 0;
		lander.vy = Math.max(0, lander.vy);
	}
}

/**
 * Sprint 7.2 — v2 legacy integrator. Copy-renamed from the pre-7.2 updateLander
 * (not parameterized) so the v2 code path is frozen: no drift risk as the v3
 * integrator evolves. Called exclusively via PhysicsManager dispatch when
 * `lander.physicsVersion === 2` (set by GhostReplay.ts on v2 replay spawn).
 *
 * Rotation is instant angle-set. No angularVel integration. No RCS tank.
 * Behaves byte-identical to the v2 production integrator at time of freeze.
 */
export function updateLanderLegacy(
	lander: LanderState,
	input: InputState,
	dt: number,
	gravityOverride?: number,
): void {
	if (lander.status !== "flying") return;

	const lt = lander.landerType;

	// Rotation (v2): instant angle set, no fuel cost, no inertia.
	if (input.rotateLeft) {
		lander.angle -= ROTATION_SPEED * lt.rotationMultiplier * dt;
	}
	if (input.rotateRight) {
		lander.angle += ROTATION_SPEED * lt.rotationMultiplier * dt;
	}
	// Belt-and-suspenders: v2 ghosts shouldn't accumulate angularVel under any
	// circumstance. Pin to 0 so downstream reads stay consistent.
	lander.angularVel = 0;
	lander.rcsFiring = false;
	lander.rcsFiringDirection = 0;

	// Thrust
	lander.thrusting = input.thrustUp && lander.fuel > 0;
	if (lander.thrusting) {
		const thrust = thrustVector(lander.angle);
		lander.vx += thrust.x * lt.thrustMultiplier * dt;
		lander.vy += thrust.y * lt.thrustMultiplier * dt;
		lander.fuel = Math.max(0, lander.fuel - FUEL_BURN_RATE * dt);
	}

	// Gravity
	lander.vy = applyGravity(lander.vy, dt * lt.massMultiplier, gravityOverride);

	// Integrate position
	lander.x += lander.vx * dt;
	lander.y += lander.vy * dt;

	// Prevent flying off screen top
	if (lander.y < 0) {
		lander.y = 0;
		lander.vy = Math.max(0, lander.vy);
	}
}
