import type { FlightPolicy } from "../systems/GamePreferences";
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
import {
	applyGravityStormEffect,
	consumeAngularImpulse,
	updateGravityStorm,
} from "./GravityStorm";
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
	/** v0.6.3.0 — hazard policy for this flight. Gates random fuel-leak
	 * spawn. Set once by Game.reset() after `resolveFlightPolicy`; cleared
	 * by reset(). When undefined, legacy behavior applies (fuel leak gated
	 * only by seed % 10 === 7) so ghost replays and any caller that forgets
	 * to set the policy stay byte-identical to pre-v0.6.3.0. */
	private hazardPolicy: FlightPolicy | null = null;

	reset(): void {
		this.flightElapsed = 0;
		this.fuelLeakActive = false;
		this.fuelLeakTriggered = false;
		this.thrustHistory = [];
		this.hazardPolicy = null;
	}

	/** v0.6.3.0 — set the per-flight hazard policy. Must be called AFTER
	 * reset() (which clears it to null) and BEFORE step() starts firing
	 * the fuel-leak trigger at t=5s. Game.reset() handles the ordering. */
	setHazardPolicy(policy: FlightPolicy): void {
		this.hazardPolicy = policy;
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
		// Integrator dispatch by per-lander physicsVersion. v2 ghost replays
		// set physicsVersion=2 on spawn (see GhostReplay.ts). Free Play reads
		// from GamePreferences (default v2); Campaign uses per-mission ramp
		// via DifficultyConfig.physicsVersion; Historic and AI Theater always
		// v3. The compile-time PHYSICS_V3 kill switch was removed in v0.6.3.0
		// when the user-facing toggle became the primary safety net.
		if (lander.physicsVersion === 2) {
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
			// v0.6.2.4 — apply angular jolt from storm phase transitions to
			// v3 landers only. v2 landers don't integrate angularVel so the
			// impulse would do nothing (and could risk desync if a v2 ghost
			// replay ever saw a non-zero read). Always consume to clear the
			// pending value even on v2 — belt-and-suspenders against drift.
			const angularImpulse = consumeAngularImpulse(gravityStorm);
			if (lander.physicsVersion === 3) {
				lander.angularVel += angularImpulse;
			}
		}

		if (!this.fuelLeakTriggered && this.flightElapsed > 5) {
			this.fuelLeakTriggered = true;
			// v0.6.3.0 — gate random fuel leak on the flight policy. If no
			// policy set (ghost replay, hand-constructed test fixtures,
			// callers that forgot to call setHazardPolicy) the policy-less
			// default is legacy behavior: seed % 10 === 7 still triggers, so
			// pre-v0.6.3.0 ghosts replay byte-identical.
			const fuelLeakAllowed = this.hazardPolicy?.fuelLeaks ?? true;
			this.fuelLeakActive = fuelLeakAllowed && seed % 10 === 7;
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
