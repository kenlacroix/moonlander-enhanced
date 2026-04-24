/**
 * Gravity Storms — periodic gravity anomalies mid-flight.
 *
 * Gravity cycles: normal → 2x (5s) → 0.5x (3s) → normal.
 * Repeats every 20-30 seconds (seeded interval).
 * Fully deterministic for ghost replay compatibility.
 * Terrain wobble is cosmetic only (does not affect collision).
 *
 * v0.6.2.4 — under v3 rigid-body physics, each phase transition also
 * generates a seeded random angular impulse applied to the lander.
 * Turns gravity anomalies from cosmetic (terrain wobble, vy delta) into
 * actual attitude hazards. Magnitude is tuned below the landing-rate
 * gate so a single jolt from a stable attitude doesn't auto-crash, but
 * compounding jolts + poor counter-burn discipline will.
 */

import { GRAVITY } from "../utils/constants";
import { createRng } from "../utils/math";
import type { DifficultyConfig } from "./Terrain";

export type StormPhase = "normal" | "high" | "low";

export interface GravityStormState {
	phase: StormPhase;
	multiplier: number;
	phaseTimer: number;
	cycleCooldown: number;
	rng: () => number;
	wobbleOffset: number; // cosmetic terrain wobble amplitude
	/** v0.6.2.4 — angular impulse pending application to lander.angularVel.
	 * Set on phase transitions (normal→high, high→low), cleared on
	 * consumeAngularImpulse. Sign is direction (+ clockwise, - ccw).
	 * Always 0 under v2 physics (never consumed). */
	pendingAngularImpulse: number;
}

const HIGH_GRAVITY_MULTIPLIER = 2.0;
const LOW_GRAVITY_MULTIPLIER = 0.5;
const HIGH_DURATION = 5;
const LOW_DURATION = 3;
const COOLDOWN_MIN = 20;
const COOLDOWN_MAX = 30;
const WOBBLE_AMPLITUDE = 5; // game units, cosmetic only
const WOBBLE_FREQUENCY = 3; // Hz

/** Max instantaneous angular-velocity delta from a single storm jolt,
 * in degrees/second. ±MAX_STORM_TORQUE means a single jolt from 0°/s
 * puts the lander at most at that rate. Set below global 8°/s gate
 * and below the per-mission Apollo gates (6-7°/s) so a single jolt
 * from a stable attitude is survivable. Two jolts per storm cycle
 * (high-entry, low-entry) means compounding is possible if player
 * doesn't counter-burn between transitions. */
export const MAX_STORM_TORQUE = 5;

/** Check if gravity storms should occur for this seed (~20% of missions) */
export function shouldSpawnGravityStorm(
	seed: number,
	diff?: DifficultyConfig,
): boolean {
	if (diff?.gravityStormsEnabled) return true;
	return (seed * 11 + 7) % 10 < 2;
}

/** Create initial gravity storm state */
export function createGravityStorm(seed: number): GravityStormState {
	const rng = createRng(seed * 23 + 17);
	return {
		phase: "normal",
		multiplier: 1.0,
		phaseTimer: 0,
		cycleCooldown: COOLDOWN_MIN + rng() * (COOLDOWN_MAX - COOLDOWN_MIN),
		rng,
		wobbleOffset: 0,
		pendingAngularImpulse: 0,
	};
}

/** Update gravity storm state. Returns the gravity multiplier to apply. */
export function updateGravityStorm(
	storm: GravityStormState,
	dt: number,
	flightElapsed: number,
): void {
	if (storm.phase === "normal") {
		storm.cycleCooldown -= dt;
		if (storm.cycleCooldown <= 0) {
			// Start high gravity phase. Seeded jolt ±MAX_STORM_TORQUE.
			storm.phase = "high";
			storm.multiplier = HIGH_GRAVITY_MULTIPLIER;
			storm.phaseTimer = HIGH_DURATION;
			storm.pendingAngularImpulse = (storm.rng() * 2 - 1) * MAX_STORM_TORQUE;
		}
		storm.wobbleOffset = 0;
	} else if (storm.phase === "high") {
		storm.phaseTimer -= dt;
		storm.wobbleOffset =
			Math.sin(flightElapsed * WOBBLE_FREQUENCY * Math.PI * 2) *
			WOBBLE_AMPLITUDE;
		if (storm.phaseTimer <= 0) {
			// Transition to low gravity. Second jolt of the cycle.
			storm.phase = "low";
			storm.multiplier = LOW_GRAVITY_MULTIPLIER;
			storm.phaseTimer = LOW_DURATION;
			storm.pendingAngularImpulse = (storm.rng() * 2 - 1) * MAX_STORM_TORQUE;
		}
	} else if (storm.phase === "low") {
		storm.phaseTimer -= dt;
		storm.wobbleOffset =
			Math.sin(flightElapsed * WOBBLE_FREQUENCY * Math.PI * 2) *
			WOBBLE_AMPLITUDE *
			0.5;
		if (storm.phaseTimer <= 0) {
			// Return to normal, reset cooldown
			storm.phase = "normal";
			storm.multiplier = 1.0;
			storm.phaseTimer = 0;
			storm.cycleCooldown =
				COOLDOWN_MIN + storm.rng() * (COOLDOWN_MAX - COOLDOWN_MIN);
			storm.wobbleOffset = 0;
		}
	}
}

/** Apply gravity storm effect to lander velocity */
export function applyGravityStormEffect(
	storm: GravityStormState,
	vy: number,
	dt: number,
	massMultiplier: number,
	baseGravity = GRAVITY,
): number {
	if (storm.multiplier === 1.0) return vy;
	// updateLander already applied 1x gravity. Add the delta.
	return vy + baseGravity * (storm.multiplier - 1) * dt * massMultiplier;
}

/** v0.6.2.4 — consume and clear the pending angular impulse. Returns the
 * signed delta to add to lander.angularVel (deg/s). Returns 0 if no
 * jolt is pending. Safe to call every tick; only phase transitions
 * set a non-zero value.
 *
 * Called by PhysicsManager for v3 landers only. v2 landers don't
 * integrate angularVel, so applying an impulse would have no effect
 * and could desync v2 ghost replays — cheaper to just not consume. */
export function consumeAngularImpulse(storm: GravityStormState): number {
	const impulse = storm.pendingAngularImpulse;
	storm.pendingAngularImpulse = 0;
	return impulse;
}

/** Get HUD label for active gravity anomaly */
export function getGravityStormLabel(storm: GravityStormState): string | null {
	if (storm.phase === "high") return "GRAVITY ANOMALY: 2x";
	if (storm.phase === "low") return "GRAVITY ANOMALY: 0.5x";
	return null;
}
