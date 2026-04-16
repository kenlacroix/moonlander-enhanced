import { resetStateCache } from "../ai/AgentEnv";
import type { InputState } from "../systems/Input";
import { FIXED_TIMESTEP, LANDER_HEIGHT, WORLD_WIDTH } from "../utils/constants";
import { createLander, type LanderState, updateLander } from "./Lander";
import { getLanderType } from "./LanderTypes";
import { checkCollision } from "./Physics";
import { generateTerrain, type TerrainData } from "./Terrain";

export interface StepResult {
	done: boolean;
	landed: boolean;
	crashed: boolean;
	pad: { y: number; width: number; points: number } | null;
}

export interface HeadlessGameOptions {
	gravity?: number;
	landerType?: string;
}

export class HeadlessGame {
	terrain: TerrainData;
	lander: LanderState;
	readonly seed: number;
	private done = false;
	private gravity: number | undefined;

	constructor(seed: number, options?: HeadlessGameOptions) {
		this.seed = seed;
		this.gravity = options?.gravity;
		this.terrain = generateTerrain(seed);
		this.lander = createLander(
			WORLD_WIDTH / 2,
			80,
			getLanderType(options?.landerType),
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
		this.lander = createLander(WORLD_WIDTH / 2, 80, getLanderType());
		this.done = false;
		// Clear the module-level prevVy used by AgentEnv.getState so the
		// vertical-acceleration signal starts at 0 for the new episode.
		resetStateCache();
	}

	get isDone(): boolean {
		return this.done;
	}
}
