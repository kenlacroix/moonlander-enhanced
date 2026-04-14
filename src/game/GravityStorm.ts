/**
 * Gravity Storms — periodic gravity anomalies mid-flight.
 *
 * Gravity cycles: normal → 2x (5s) → 0.5x (3s) → normal.
 * Repeats every 20-30 seconds (seeded interval).
 * Fully deterministic for ghost replay compatibility.
 * Terrain wobble is cosmetic only (does not affect collision).
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
}

const HIGH_GRAVITY_MULTIPLIER = 2.0;
const LOW_GRAVITY_MULTIPLIER = 0.5;
const HIGH_DURATION = 5;
const LOW_DURATION = 3;
const COOLDOWN_MIN = 20;
const COOLDOWN_MAX = 30;
const WOBBLE_AMPLITUDE = 5; // game units, cosmetic only
const WOBBLE_FREQUENCY = 3; // Hz

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
			// Start high gravity phase
			storm.phase = "high";
			storm.multiplier = HIGH_GRAVITY_MULTIPLIER;
			storm.phaseTimer = HIGH_DURATION;
		}
		storm.wobbleOffset = 0;
	} else if (storm.phase === "high") {
		storm.phaseTimer -= dt;
		storm.wobbleOffset =
			Math.sin(flightElapsed * WOBBLE_FREQUENCY * Math.PI * 2) *
			WOBBLE_AMPLITUDE;
		if (storm.phaseTimer <= 0) {
			// Transition to low gravity
			storm.phase = "low";
			storm.multiplier = LOW_GRAVITY_MULTIPLIER;
			storm.phaseTimer = LOW_DURATION;
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

/** Get HUD label for active gravity anomaly */
export function getGravityStormLabel(storm: GravityStormState): string | null {
	if (storm.phase === "high") return "GRAVITY ANOMALY: 2x";
	if (storm.phase === "low") return "GRAVITY ANOMALY: 0.5x";
	return null;
}
