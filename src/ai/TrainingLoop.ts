import { HeadlessGame } from "../game/HeadlessGame";
import { FIXED_TIMESTEP } from "../utils/constants";
import { RLAgent, type TrainingStats } from "./RLAgent";

const MAX_STEPS_PER_EPISODE = 1500;
const TRAINING_SEED = 1969;

export type TrainingState = "idle" | "training" | "paused";

export interface TrainingConfig {
	episodesPerBatch: number;
	speedMultiplier: number;
	seed: number;
}

export class TrainingLoop {
	agent: RLAgent;
	state: TrainingState = "idle";
	stats: TrainingStats[] = [];
	config: TrainingConfig = {
		episodesPerBatch: 5,
		speedMultiplier: 1,
		seed: TRAINING_SEED,
	};
	private game: HeadlessGame;
	private abortRequested = false;

	constructor() {
		this.agent = new RLAgent();
		this.game = new HeadlessGame(this.config.seed);
	}

	async init(): Promise<void> {
		await this.agent.init();
	}

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
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
	}

	private async runEpisode(): Promise<TrainingStats> {
		this.game.reset();
		let totalReward = 0;
		let steps = 0;
		let landed = false;

		while (steps < MAX_STEPS_PER_EPISODE) {
			const state = this.agent.getState(this.game.lander, this.game.terrain);
			const action = this.agent.chooseAction(state);
			const input = this.agent.actionToInput(action);

			const result = this.game.step(input, FIXED_TIMESTEP);
			landed = result.landed;

			const reward = this.agent.calculateReward(
				this.game.lander,
				this.game.terrain,
				landed,
				result.crashed,
			);

			const nextState = this.agent.getState(
				this.game.lander,
				this.game.terrain,
			);
			this.agent.remember(state, action, reward, nextState, result.done);

			totalReward += reward;
			steps++;

			if (result.done) break;
			if (steps % 4 === 0) await this.agent.trainBatch();
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

	pause(): void {
		this.state = "paused";
		this.abortRequested = true;
	}

	stop(): void {
		this.state = "idle";
		this.abortRequested = true;
	}

	getAgent(): RLAgent {
		return this.agent;
	}
}
