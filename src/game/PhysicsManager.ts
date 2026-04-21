import type { InputState } from "../systems/Input";
import {
	FUEL_BURN_RATE,
	LANDER_HEIGHT,
	MAX_LANDING_ANGLE,
	MAX_LANDING_SPEED,
	PHYSICS_V3,
	SCORE_ANGLE_BONUS,
	SCORE_FUEL_MULTIPLIER,
	SCORE_SPEED_BONUS,
} from "../utils/constants";
import { type AlienState, applyAlienEffect, updateAlien } from "./Alien";
import type { GravityStormState } from "./GravityStorm";
import { applyGravityStormEffect, updateGravityStorm } from "./GravityStorm";
import { type LanderState, updateLander, updateLanderLegacy } from "./Lander";
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
	/** Sprint 7.1 PR 1.5 — true when the pad touched was a hidden pad.
	 * CollisionHandler applies a 3× multiplier + HIDDEN PAD BONUS toast.
	 * The score here is the unmultiplied base; multiplication happens
	 * in CollisionHandler where the toast fires. */
	hiddenPad: boolean;
	/** Sprint 7.2 — true when the crash was specifically a spinning-at-touchdown
	 * crash (angular rate exceeded the landing threshold). Lets the renderer
	 * show "LANDED SPINNING — STRUCTURAL FAILURE" instead of the generic crash
	 * message. False on non-crash results and on any non-spin-related crash. */
	spinningCrash: boolean;
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
		// Sprint 7.2 — integrator dispatch. v2 ghost replays set
		// lander.physicsVersion = 2 on spawn (see GhostReplay.ts) so their
		// replay uses the frozen v2 integrator. New flights default to 3.
		// PHYSICS_V3 is a global kill switch — flip to false in
		// constants.ts to revert every flight (not just v2 replays) to v2
		// physics, e.g. if a post-ship regression needs a hotfix revert.
		if (lander.physicsVersion === 2 || !PHYSICS_V3) {
			updateLanderLegacy(lander, resolvedInput, dt, gameGravity);
		} else {
			updateLander(lander, resolvedInput, dt, gameGravity);
		}

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
				hiddenPad: result.onPad.hidden === true,
				spinningCrash: false,
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
			hiddenPad: false,
			spinningCrash: result.spinningCrash,
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
