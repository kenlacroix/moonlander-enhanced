import { createLander, updateLander, type LanderState } from "../game/Lander";
import { getLanderType } from "../game/LanderTypes";
import { checkCollision } from "../game/Physics";
import { generateTerrain, type TerrainData } from "../game/Terrain";
import { FIXED_TIMESTEP, WORLD_WIDTH } from "../utils/constants";
import { RLAgent, type TrainingStats } from "./RLAgent";

const MAX_STEPS_PER_EPISODE = 1500; // ~25 seconds at 60fps
const TRAINING_SEED = 1969; // fixed seed for consistent training terrain

export type TrainingState = "idle" | "training" | "paused";

export interface TrainingConfig {
	episodesPerBatch: number;  // episodes to run before yielding to UI
	speedMultiplier: number;   // physics steps per batch tick (for visualization)
	seed: number;
}

/**
 * Headless training loop for the RL agent.
 * Runs episodes without rendering, yields periodically for UI updates.
 */
export class TrainingLoop {
	agent: RLAgent;
	state: TrainingState = "idle";
	stats: TrainingStats[] = [];
	config: TrainingConfig = {
		episodesPerBatch: 5,
		speedMultiplier: 1,
		seed: TRAINING_SEED,
	};
	private terrain: TerrainData;
	private abortRequested = false;

	constructor() {
		this.agent = new RLAgent();
		this.terrain = generateTerrain(this.config.seed);
	}

	/** Initialize the agent's neural network */
	async init(): Promise<void> {
		await this.agent.init();
	}

	/** Start or resume training */
	async start(onProgress: (stats: TrainingStats) => void): Promise<void> {
		if (!this.agent.ready) await this.init();
		this.state = "training";
		this.abortRequested = false;

		while (this.state === "training" && !this.abortRequested) {
			for (let i = 0; i < this.config.episodesPerBatch; i++) {
				if (this.abortRequested) break;
				const result = await this.runEpisode();
				this.stats.push(result);
				onProgress(result);
			}

			// Yield to UI — let the browser breathe
			await new Promise(resolve => setTimeout(resolve, 0));
		}
	}

	/** Run a single training episode */
	private async runEpisode(): Promise<TrainingStats> {
		const landerType = getLanderType();
		const lander = createLander(WORLD_WIDTH / 2, 80, landerType);
		let totalReward = 0;
		let steps = 0;
		let landed = false;

		while (steps < MAX_STEPS_PER_EPISODE) {
			const state = this.agent.getState(lander, this.terrain);
			const action = this.agent.chooseAction(state);
			const input = this.agent.actionToInput(action);

			// Step physics
			updateLander(lander, input, FIXED_TIMESTEP);

			// Check collision
			const result = checkCollision(lander, this.terrain);
			const isDone = result.collided;
			landed = result.safeLanding && result.onPad !== null;

			const reward = this.agent.calculateReward(
				lander, this.terrain, landed, result.collided && !landed,
			);

			const nextState = this.agent.getState(lander, this.terrain);
			this.agent.remember(state, action, reward, nextState, isDone);

			totalReward += reward;
			steps++;

			if (isDone) break;

			// Train every 4 steps
			if (steps % 4 === 0) {
				await this.agent.trainBatch();
			}
		}

		this.agent.endEpisode(totalReward);

		return {
			episode: this.agent.episodeCount,
			totalReward,
			epsilon: this.agent.epsilon,
			landed,
			steps,
		};
	}

	/** Pause training */
	pause(): void {
		this.state = "paused";
		this.abortRequested = true;
	}

	/** Stop training completely */
	stop(): void {
		this.state = "idle";
		this.abortRequested = true;
	}

	/** Get the agent for replay mode */
	getAgent(): RLAgent {
		return this.agent;
	}
}
