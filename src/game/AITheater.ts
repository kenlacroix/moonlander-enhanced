import type { Agent, AgentStats } from "../ai/Agent";
import { PolicyGradientAgent } from "../ai/PolicyGradientAgent";
import { RandomAgent } from "../ai/RandomAgent";
import { RLAgent } from "../ai/RLAgent";
import { AITheaterPanel } from "../ui/AITheaterPanel";
import { FIXED_TIMESTEP } from "../utils/constants";
import { HeadlessGame } from "./HeadlessGame";

const MAX_STEPS_PER_EPISODE = 1500;
const STEPS_PER_TICK = 50;

export interface AITheaterComparison {
	playerScore: number;
	playerLanded: boolean;
	aiBestReward: number;
	aiEpisodes: number;
	aiLanded: boolean;
}

interface AgentSlot {
	agent: Agent;
	game: HeadlessGame;
}

export class AITheater {
	private panel: AITheaterPanel;
	private dqn: RLAgent;
	private slots: AgentSlot[] = [];
	private training = false;
	private abortRequested = false;
	private bestReward = -Infinity;
	private bestLanded = false;
	private totalEpisodes = 0;
	private currentSeed: number | null = null;
	private currentSlotIdx = 0;

	constructor() {
		this.panel = new AITheaterPanel();
		this.dqn = new RLAgent();
	}

	async start(seed: number): Promise<void> {
		this.currentSeed = seed;
		const pg = new PolicyGradientAgent();
		const random = new RandomAgent();
		this.slots = [
			{ agent: this.dqn, game: new HeadlessGame(seed) },
			{ agent: pg, game: new HeadlessGame(seed) },
			{ agent: random, game: new HeadlessGame(seed) },
		];
		this.bestReward = -Infinity;
		this.bestLanded = false;
		this.totalEpisodes = 0;
		this.abortRequested = false;
		this.currentSlotIdx = 0;

		this.panel.mount();
		this.adjustGameLayout(true);

		for (const slot of this.slots) {
			if (!slot.agent.ready) await slot.agent.init();
		}
		await this.dqn.loadWeights(String(seed));

		this.bestReward = -Infinity;
		this.totalEpisodes = this.dqn.episodeCount;

		this.training = true;
		this.runTrainingLoop();
	}

	async stop(): Promise<void> {
		this.training = false;
		this.abortRequested = true;
		if (this.currentSeed !== null) {
			await this.dqn.saveWeights(String(this.currentSeed));
		}
		for (const slot of this.slots) {
			if (slot.agent !== this.dqn) slot.agent.dispose();
		}
		this.slots = [];
		this.panel.unmount();
		this.adjustGameLayout(false);
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
		return this.dqn;
	}

	private async runTrainingLoop(): Promise<void> {
		while (this.training && !this.abortRequested) {
			const slot = this.slots[this.currentSlotIdx];
			const stats = await this.runEpisode(slot);
			if (slot.agent === this.dqn) {
				this.totalEpisodes = stats.episode;
				if (stats.totalReward > this.bestReward) {
					this.bestReward = stats.totalReward;
				}
				if (stats.landed) this.bestLanded = true;
			}
			this.panel.updateStats(stats);
			this.currentSlotIdx = (this.currentSlotIdx + 1) % this.slots.length;
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
	}

	private async runEpisode(slot: AgentSlot): Promise<AgentStats> {
		const { agent, game } = slot;
		game.reset();
		let totalReward = 0;
		let steps = 0;
		let landed = false;
		let stepsThisTick = 0;

		while (steps < MAX_STEPS_PER_EPISODE) {
			const state = agent.getState(game.lander, game.terrain);
			const action = agent.chooseAction(state);
			const input = agent.actionToInput(action);

			const result = game.step(input, FIXED_TIMESTEP);
			landed = result.landed;

			const reward = agent.calculateReward(
				game.lander,
				game.terrain,
				landed,
				result.crashed,
			);

			const nextState = agent.getState(game.lander, game.terrain);
			agent.remember(state, action, reward, nextState, result.done);

			totalReward += reward;
			steps++;
			stepsThisTick++;

			if (result.done) break;
			if (agent.trainBatch && steps % 4 === 0) await agent.trainBatch();

			if (stepsThisTick >= STEPS_PER_TICK) {
				stepsThisTick = 0;
				await new Promise((resolve) => setTimeout(resolve, 0));
			}
		}

		await agent.endEpisode(totalReward);

		const epsilon = agent instanceof RLAgent ? agent.epsilon : undefined;
		return {
			kind: agent.kind,
			episode: agent.episodeCount,
			totalReward,
			landed,
			steps,
			...(epsilon !== undefined ? { epsilon } : {}),
		} as AgentStats;
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
