import type { InputState } from "../systems/Input";
import {
	FUEL_BURN_RATE,
	LANDER_HEIGHT,
	MAX_LANDING_ANGLE,
	MAX_LANDING_SPEED,
	SCORE_ANGLE_BONUS,
	SCORE_FUEL_MULTIPLIER,
	SCORE_SPEED_BONUS,
} from "../utils/constants";
import { type AlienState, applyAlienEffect, updateAlien } from "./Alien";
import type { GravityStormState } from "./GravityStorm";
import { applyGravityStormEffect, updateGravityStorm } from "./GravityStorm";
import { type LanderState, updateLander } from "./Lander";
import { checkCollision, normAngle } from "./Physics";
import type { TerrainData } from "./Terrain";
import { updateWind, type WindState } from "./Wind";

export interface PhysicsResult {
	collided: boolean;
	landed: boolean;
	crashed: boolean;
	score: number;
	padY: number;
	padWidth: number;
}

export class PhysicsManager {
	flightElapsed = 0;
	fuelLeakActive = false;
	private fuelLeakTriggered = false;
	thrustHistory: boolean[] = [];

	reset(): void {
		this.flightElapsed = 0;
		this.fuelLeakActive = false;
		this.fuelLeakTriggered = false;
		this.thrustHistory = [];
	}

	step(
		dt: number,
		lander: LanderState,
		terrain: TerrainData,
		inputState: InputState,
		gameGravity: number,
		wind: WindState | null,
		alien: AlienState | null,
		gravityStorm: GravityStormState | null,
		seed: number,
		ghostRecordFn: (input: InputState) => void,
	): PhysicsResult | null {
		this.flightElapsed += dt;

		let resolvedInput = inputState;
		if (alien) {
			updateAlien(alien, lander.x, lander.y, dt, this.flightElapsed);
			resolvedInput = applyAlienEffect(alien, lander, inputState, dt);
		}

		ghostRecordFn(inputState);
		updateLander(lander, resolvedInput, dt, gameGravity);

		this.thrustHistory.push(lander.thrusting);
		if (this.thrustHistory.length > 180) this.thrustHistory.shift();

		if (wind) {
			updateWind(wind, this.flightElapsed);
			lander.vx += wind.speed * dt;
		}

		if (gravityStorm) {
			updateGravityStorm(gravityStorm, dt, this.flightElapsed);
			lander.vy = applyGravityStormEffect(
				gravityStorm,
				lander.vy,
				dt,
				lander.landerType.massMultiplier,
				gameGravity,
			);
		}

		if (!this.fuelLeakTriggered && this.flightElapsed > 5) {
			this.fuelLeakTriggered = true;
			this.fuelLeakActive = seed % 10 === 7;
		}
		if (this.fuelLeakActive && lander.fuel > 0) {
			lander.fuel = Math.max(0, lander.fuel - FUEL_BURN_RATE * 0.3 * dt);
		}

		const result = checkCollision(lander, terrain);
		if (!result.collided) return null;

		if (result.safeLanding && result.onPad) {
			lander.status = "landed";
			lander.vy = 0;
			lander.vx = 0;
			lander.y = result.onPad.y - LANDER_HEIGHT / 2;
			const score = this.calculateScore(lander, result.onPad);
			return {
				collided: true,
				landed: true,
				crashed: false,
				score,
				padY: result.onPad.y,
				padWidth: result.onPad.width,
			};
		}

		lander.status = "crashed";
		return {
			collided: true,
			landed: false,
			crashed: true,
			score: 0,
			padY: 0,
			padWidth: 0,
		};
	}

	private calculateScore(lander: LanderState, pad: { points: number }): number {
		let score = 100 * pad.points;
		score += Math.floor(lander.fuel * SCORE_FUEL_MULTIPLIER);
		if (Math.abs(lander.vy) < MAX_LANDING_SPEED * 0.5) {
			score += SCORE_SPEED_BONUS;
		}
		if (Math.abs(normAngle(lander.angle)) < MAX_LANDING_ANGLE * 0.5) {
			score += SCORE_ANGLE_BONUS;
		}
		return score;
	}
}
