import { resetStateCache } from "../ai/AgentEnv";
import type { InputState } from "../systems/Input";
import { FIXED_TIMESTEP, LANDER_HEIGHT, WORLD_WIDTH } from "../utils/constants";
import { createLander, type LanderState, updateLander } from "./Lander";
import { getLanderType } from "./LanderTypes";
import { checkCollision } from "./Physics";
import {
	type DifficultyConfig,
	generateTerrain,
	type TerrainData,
} from "./Terrain";

export interface StepResult {
	done: boolean;
	landed: boolean;
	crashed: boolean;
	pad: { y: number; width: number; points: number } | null;
}

export interface HeadlessGameOptions {
	gravity?: number;
	landerType?: string;
	/** Sprint 7.2 Part 2 — per-mission overrides for autopilot convergence
	 * tests. When set, terrain is generated with this difficulty and the
	 * lander materializes the same per-mission physics (startingFuel,
	 * startingRCS, maxLandingAngularRate). Authentic-mode tightening is
	 * NOT applied here — tests that need authentic physics call
	 * applyAuthenticPhysics on the spawned lander themselves. */
	difficulty?: DifficultyConfig;
}

export class HeadlessGame {
	terrain: TerrainData;
	lander: LanderState;
	readonly seed: number;
	private done = false;
	private gravity: number | undefined;
	private difficulty: DifficultyConfig | undefined;
	private landerTypeName: string | undefined;

	constructor(seed: number, options?: HeadlessGameOptions) {
		this.seed = seed;
		this.gravity = options?.gravity;
		this.difficulty = options?.difficulty;
		this.landerTypeName =
			options?.landerType ?? options?.difficulty?.landerType;
		this.terrain = generateTerrain(seed, this.difficulty);
		this.lander = createLander(
			WORLD_WIDTH / 2,
			this.difficulty?.spawnY ?? 80,
			getLanderType(this.landerTypeName),
			this.difficulty,
		);
	}

	step(input: InputState, dt: number = FIXED_TIMESTEP): StepResult {
		if (this.done) {
			return {
				done: true,
				landed: this.lander.status === "landed",
				crashed: this.lander.status === "crashed",
				pad: null,
			};
		}

		updateLander(this.lander, input, dt, this.gravity);
		const result = checkCollision(this.lander, this.terrain);

		if (result.collided) {
			this.done = true;
			if (result.safeLanding && result.onPad) {
				this.lander.status = "landed";
				this.lander.vy = 0;
				this.lander.vx = 0;
				this.lander.y = result.onPad.y - LANDER_HEIGHT / 2;
				return {
					done: true,
					landed: true,
					crashed: false,
					pad: result.onPad,
				};
			}
			this.lander.status = "crashed";
			return { done: true, landed: false, crashed: true, pad: null };
		}

		return { done: false, landed: false, crashed: false, pad: null };
	}

	reset(): void {
		this.lander = createLander(
			WORLD_WIDTH / 2,
			this.difficulty?.spawnY ?? 80,
			getLanderType(this.landerTypeName),
			this.difficulty,
		);
		this.done = false;
		// Clear the module-level prevVy used by AgentEnv.getState so the
		// vertical-acceleration signal starts at 0 for the new episode.
		resetStateCache();
	}

	get isDone(): boolean {
		return this.done;
	}
}
