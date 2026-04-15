import { RLAgent, type TrainingStats } from "../ai/RLAgent";
import { AITheaterPanel } from "../ui/AITheaterPanel";
import { FIXED_TIMESTEP } from "../utils/constants";
import { HeadlessGame } from "./HeadlessGame";

const EPISODES_PER_BATCH = 5;
const MAX_STEPS_PER_EPISODE = 1500;
const STEPS_PER_TICK = 50;

export interface AITheaterComparison {
	playerScore: number;
	playerLanded: boolean;
	aiBestReward: number;
	aiEpisodes: number;
	aiLanded: boolean;
}

export class AITheater {
	private panel: AITheaterPanel;
	private agent: RLAgent;
	private game: HeadlessGame | null = null;
	private training = false;
	private abortRequested = false;
	private bestReward = -Infinity;
	private bestLanded = false;
	private totalEpisodes = 0;
	private currentSeed: number | null = null;

	constructor() {
		this.panel = new AITheaterPanel();
		this.agent = new RLAgent();
	}

	async start(seed: number): Promise<void> {
		this.currentSeed = seed;
		this.game = new HeadlessGame(seed);
		this.bestReward = -Infinity;
		this.bestLanded = false;
		this.totalEpisodes = 0;
		this.abortRequested = false;

		this.panel.mount();
		this.adjustGameLayout(true);

		if (!this.agent.ready) await this.agent.init();
		await this.agent.loadWeights(String(seed));

		this.bestReward = -Infinity;
		this.totalEpisodes = this.agent.episodeCount;

		this.training = true;
		this.runTrainingLoop();
	}

	async stop(): Promise<void> {
		this.training = false;
		this.abortRequested = true;
		if (this.currentSeed !== null) {
			await this.agent.saveWeights(String(this.currentSeed));
		}
		this.panel.unmount();
		this.adjustGameLayout(false);
		this.game = null;
		this.currentSeed = null;
	}

	get isActive(): boolean {
		return this.currentSeed !== null;
	}

	getComparison(
		playerScore: number,
		playerLanded: boolean,
	): AITheaterComparison {
		return {
			playerScore,
			playerLanded,
			aiBestReward: this.bestReward,
			aiEpisodes: this.totalEpisodes,
			aiLanded: this.bestLanded,
		};
	}

	setWatchBestHandler(handler: () => void): void {
		this.panel.setWatchBestHandler(handler);
	}

	getAgent(): RLAgent {
		return this.agent;
	}

	private async runTrainingLoop(): Promise<void> {
		while (this.training && !this.abortRequested) {
			for (let i = 0; i < EPISODES_PER_BATCH; i++) {
				if (this.abortRequested) return;
				const stats = await this.runEpisode();
				this.totalEpisodes = stats.episode;
				if (stats.totalReward > this.bestReward) {
					this.bestReward = stats.totalReward;
				}
				if (stats.landed) this.bestLanded = true;
				this.panel.updateStats(stats);
			}
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
	}

	private async runEpisode(): Promise<TrainingStats> {
		if (!this.game) throw new Error("No game initialized");
		this.game.reset();
		let totalReward = 0;
		let steps = 0;
		let landed = false;
		let stepsThisTick = 0;

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
			stepsThisTick++;

			if (result.done) break;
			if (steps % 4 === 0) await this.agent.trainBatch();

			if (stepsThisTick >= STEPS_PER_TICK) {
				stepsThisTick = 0;
				await new Promise((resolve) => setTimeout(resolve, 0));
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

	private adjustGameLayout(split: boolean): void {
		const canvas = document.getElementById("game-canvas");
		if (!canvas) return;

		if (split) {
			canvas.style.maxWidth = `calc(100vw - 360px)`;
		} else {
			canvas.style.maxWidth = "";
		}
	}
}
