/**
 * Alien mischief system — a deterministic UFO that orbits the lander
 * and periodically interferes with controls, fuel, or physics.
 *
 * Fully deterministic (seeded RNG, no Math.random) for ghost replay compatibility.
 * Aliens are a hazard, not enemies. The player can't shoot them.
 */

import type { InputState } from "../systems/Input";
import { FUEL_BURN_RATE } from "../utils/constants";
import { createRng } from "../utils/math";
import type { LanderState } from "./Lander";
import type { DifficultyConfig } from "./Terrain";

export type AlienEffectType =
	| "fuel-siphon"
	| "controls-reversed"
	| "thrust-reduced"
	| "drag";

export interface AlienEffect {
	type: AlienEffectType;
}

export interface AlienState {
	x: number;
	y: number;
	orbitAngle: number;
	orbitRadius: number;
	activeEffect: AlienEffect | null;
	effectTimer: number;
	cooldownTimer: number;
	rng: () => number;
	effectJustStarted: boolean;
}

const ORBIT_BASE_RADIUS = 100;
const ORBIT_RADIUS_VARIANCE = 30;
const ORBIT_SPEED = 0.8;
const EFFECT_DURATION_MIN = 5;
const EFFECT_DURATION_MAX = 8;
const COOLDOWN_MIN = 10;
const COOLDOWN_MAX = 15;
const SIPHON_RATE = 0.5;
const THRUST_REDUCTION = 0.4;
const DRAG_FACTOR_H = 0.3;
const DRAG_FACTOR_V = 0.15;

const EFFECT_TYPES: AlienEffectType[] = [
	"fuel-siphon",
	"controls-reversed",
	"thrust-reduced",
	"drag",
];

/** Check if aliens should spawn for this seed */
export function shouldSpawnAlien(
	seed: number,
	difficulty?: DifficultyConfig,
): boolean {
	if (difficulty?.aliensEnabled === true) return true;
	if (difficulty?.aliensEnabled === false) return false;
	return (seed * 7 + 13) % 10 < 3;
}

/** Create a new alien with seeded RNG */
export function createAlien(seed: number): AlienState {
	const rng = createRng(seed * 31 + 7);
	return {
		x: 0,
		y: 0,
		orbitAngle: rng() * Math.PI * 2,
		orbitRadius: ORBIT_BASE_RADIUS,
		activeEffect: null,
		effectTimer: 0,
		cooldownTimer: COOLDOWN_MIN + rng() * (COOLDOWN_MAX - COOLDOWN_MIN),
		rng,
		effectJustStarted: false,
	};
}

/** Update alien position and effect timers */
export function updateAlien(
	alien: AlienState,
	landerX: number,
	landerY: number,
	dt: number,
	elapsed: number,
): void {
	// Orbit around lander with oscillating radius
	alien.orbitAngle += ORBIT_SPEED * dt;
	alien.orbitRadius =
		ORBIT_BASE_RADIUS + Math.sin(elapsed * 0.5) * ORBIT_RADIUS_VARIANCE;
	alien.x = landerX + Math.cos(alien.orbitAngle) * alien.orbitRadius;
	alien.y = landerY + Math.sin(alien.orbitAngle) * alien.orbitRadius * 0.6; // oval orbit

	alien.effectJustStarted = false;

	if (alien.activeEffect) {
		// Count down active effect
		alien.effectTimer -= dt;
		if (alien.effectTimer <= 0) {
			alien.activeEffect = null;
			alien.cooldownTimer =
				COOLDOWN_MIN + alien.rng() * (COOLDOWN_MAX - COOLDOWN_MIN);
		}
	} else {
		// Count down cooldown
		alien.cooldownTimer -= dt;
		if (alien.cooldownTimer <= 0) {
			// Pick a random effect
			const idx =
				Math.floor(alien.rng() * EFFECT_TYPES.length) % EFFECT_TYPES.length;
			alien.activeEffect = { type: EFFECT_TYPES[idx] };
			alien.effectTimer =
				EFFECT_DURATION_MIN +
				alien.rng() * (EFFECT_DURATION_MAX - EFFECT_DURATION_MIN);
			alien.effectJustStarted = true;
		}
	}
}

/** Apply alien effect to lander and input. Returns (potentially modified) input. */
export function applyAlienEffect(
	alien: AlienState,
	lander: LanderState,
	input: InputState,
	dt: number,
): InputState {
	if (!alien.activeEffect) return input;

	switch (alien.activeEffect.type) {
		case "fuel-siphon":
			lander.fuel = Math.max(
				0,
				lander.fuel - FUEL_BURN_RATE * SIPHON_RATE * dt,
			);
			return input;

		case "controls-reversed":
			return {
				...input,
				rotateLeft: input.rotateRight,
				rotateRight: input.rotateLeft,
			};

		case "thrust-reduced": {
			// Temporarily reduce thrust by saving/restoring the multiplier
			const origThrust = lander.landerType.thrustMultiplier;
			lander.landerType.thrustMultiplier *= THRUST_REDUCTION;
			// Caller will use the modified multiplier during updateLander
			// We need to restore it after — use a wrapper approach instead
			// Actually, just apply the velocity reduction directly
			lander.landerType.thrustMultiplier = origThrust;
			// Simpler: reduce thrust effect by damping thrust-induced velocity
			if (lander.thrusting) {
				const reduction = 1 - THRUST_REDUCTION;
				lander.vx *= 1 - reduction * dt * 2;
				lander.vy *= 1 - reduction * dt * 2;
			}
			return input;
		}

		case "drag":
			lander.vx *= 1 - DRAG_FACTOR_H * dt;
			lander.vy *= 1 - DRAG_FACTOR_V * dt;
			return input;

		default:
			return input;
	}
}

/** Get HUD label for current alien effect */
export function getAlienEffectLabel(alien: AlienState): string | null {
	if (!alien.activeEffect) return null;
	switch (alien.activeEffect.type) {
		case "fuel-siphon":
			return "SIPHONING FUEL";
		case "controls-reversed":
			return "CONTROLS REVERSED";
		case "thrust-reduced":
			return "THRUST REDUCED";
		case "drag":
			return "APPLYING DRAG";
		default:
			return null;
	}
}
