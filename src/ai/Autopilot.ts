import type { LanderState } from "../game/Lander";
import { getTerrainHeightAt, normAngle } from "../game/Physics";
import type { LandingPad, TerrainData } from "../game/Terrain";
import type { InputState } from "../systems/Input";
import {
	GRAVITY,
	LANDER_HEIGHT,
	MAX_LANDING_SPEED,
	THRUST_FORCE,
} from "../utils/constants";

/**
 * Rule-based autopilot controller.
 *
 * Strategy: PID-style guidance in two axes.
 * - Horizontal: rotate to push toward target pad center, then cancel horizontal velocity
 * - Vertical: maintain safe descent rate proportional to altitude above pad
 *
 * The autopilot produces an InputState each tick, same interface as the player.
 * Toggle it on/off mid-flight to watch it work (or take over when it's about to crash).
 */

const NULL_INPUT: InputState = {
	thrustUp: false,
	rotateLeft: false,
	rotateRight: false,
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
};

export class Autopilot {
	enabled = false;

	toggle(): void {
		this.enabled = !this.enabled;
	}

	/** Compute autopilot input for the current state */
	computeInput(lander: LanderState, terrain: TerrainData): InputState {
		if (!this.enabled) return NULL_INPUT;

		const pad = this.findTargetPad(lander, terrain);
		if (!pad) return NULL_INPUT;

		const lt = lander.landerType;
		const padCenterX = pad.x + pad.width / 2;
		const terrainY = getTerrainHeightAt(lander.x, terrain.points);
		const altitude = terrainY - (lander.y + LANDER_HEIGHT / 2);

		// How far off-center from the pad
		const dx = padCenterX - lander.x;
		const distToPad = Math.abs(dx);

		// Current angle normalized to -180..180
		const angle = normAngle(lander.angle);

		// --- Desired angle ---
		// Far from pad: tilt toward it (max 30 degrees)
		// Close to pad: cancel horizontal velocity, go vertical
		let desiredAngle = 0;

		if (distToPad > pad.width * 0.3) {
			// Navigate toward pad: angle proportional to distance, capped
			const tiltStrength = Math.min(distToPad / 200, 1.0);
			desiredAngle = dx > 0 ? tiltStrength * 30 : -tiltStrength * 30;

			// Also counteract existing horizontal velocity
			const vxCorrection = -lander.vx * 0.15;
			desiredAngle += Math.max(-15, Math.min(15, vxCorrection));
		} else {
			// Over the pad: cancel horizontal velocity
			const vxCorrection = -lander.vx * 0.3;
			desiredAngle = Math.max(-20, Math.min(20, vxCorrection));
		}

		// --- Rotation control ---
		const angleError = normAngle(desiredAngle - angle);
		const rotateLeft = angleError < -2;
		const rotateRight = angleError > 2;

		// --- Thrust control ---
		// Desired descent rate: slower as we get closer to ground
		// At high altitude: allow faster descent to save fuel
		// At low altitude: brake hard
		const maxSafeSpeed = MAX_LANDING_SPEED * 0.7; // leave margin
		const effectiveGravity = GRAVITY * lt.massMultiplier;
		const effectiveThrust = THRUST_FORCE * lt.thrustMultiplier;

		let shouldThrust = false;

		if (altitude < 20) {
			// Final approach: thrust if descending at all
			shouldThrust = lander.vy > maxSafeSpeed * 0.3;
		} else if (altitude < 100) {
			// Close approach: maintain slow descent
			const targetVy = maxSafeSpeed * 0.6;
			shouldThrust = lander.vy > targetVy;
		} else if (altitude < 300) {
			// Mid approach: allow moderate descent
			const targetVy = maxSafeSpeed * 1.5;
			shouldThrust = lander.vy > targetVy;
		} else {
			// High altitude: save fuel, only thrust if falling too fast
			// Calculate stopping distance: v²/(2a) where a = thrust - gravity
			const netDecel = effectiveThrust - effectiveGravity;
			if (netDecel > 0) {
				const stoppingDist = (lander.vy * lander.vy) / (2 * netDecel);
				// Start braking when stopping distance approaches altitude
				shouldThrust = stoppingDist > altitude * 0.6;
			} else {
				// Can't decelerate (shouldn't happen with normal constants)
				shouldThrust = true;
			}
		}

		// Don't thrust if angle is too far off — we'd go sideways
		if (Math.abs(angle) > 45) {
			shouldThrust = false;
		}

		// Low fuel conservation: less aggressive when fuel is scarce
		if (lander.fuel < 100 && altitude > 50) {
			shouldThrust = shouldThrust && lander.vy > maxSafeSpeed * 2;
		}

		return {
			thrustUp: shouldThrust,
			rotateLeft,
			rotateRight,
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
		};
	}

	/** Find the best landing pad to target */
	private findTargetPad(
		lander: LanderState,
		terrain: TerrainData,
	): LandingPad | null {
		if (terrain.pads.length === 0) return null;

		// Pick the closest pad by horizontal distance
		let best = terrain.pads[0];
		let bestDist = Math.abs(lander.x - (best.x + best.width / 2));

		for (let i = 1; i < terrain.pads.length; i++) {
			const pad = terrain.pads[i];
			const dist = Math.abs(lander.x - (pad.x + pad.width / 2));
			if (dist < bestDist) {
				best = pad;
				bestDist = dist;
			}
		}

		return best;
	}
}
