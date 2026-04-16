import type { Agent, AgentStats } from "../ai/Agent";
import { EpisodeRecorder, type RecordedEpisode } from "../ai/EpisodeRecorder";
import { PolicyGradientAgent } from "../ai/PolicyGradientAgent";
import { RandomAgent } from "../ai/RandomAgent";
import { RLAgent } from "../ai/RLAgent";
import { AITheaterPanel } from "../ui/AITheaterPanel";
import { FIXED_TIMESTEP } from "../utils/constants";
import {
	type GravityPreset,
	getDefaultPreset,
	MOON_BASELINE_SEED,
} from "./GravityPresets";
import { HeadlessGame } from "./HeadlessGame";

const MAX_STEPS_PER_EPISODE = 1500;
// Yield to the browser event loop this often during an episode. Lower =
// smoother UI, higher = faster training. 15 keeps the UI responsive while
// 3-4 agents train concurrently on the main thread with the main game loop
// still running.
const STEPS_PER_TICK = 15;
// DQN fit() frequency. Every 12 steps strikes a balance between
// sample-efficient learning and not saturating the main thread with TF.js
// kernel launches. Previously 4 = ~375 fit calls per episode, which
// starved the UI while the player was also flying the lander.
const DQN_TRAIN_EVERY = 12;

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
	private transferDqn: RLAgent | null = null;
	private slots: AgentSlot[] = [];
	private training = false;
	private abortRequested = false;
	private bestReward = -Infinity;
	private bestLanded = false;
	private totalEpisodes = 0;
	private currentSeed: number | null = null;
	private currentPreset: GravityPreset = getDefaultPreset();
	private currentSlotIdx = 0;
	private recorder = new EpisodeRecorder(10);
	private forkHandler: ((episode: RecordedEpisode) => void) | null = null;
	private latestDqnState: number[] | null = null;

	constructor() {
		this.panel = new AITheaterPanel();
		this.dqn = new RLAgent("dqn");
	}

	async start(seed: number, preset?: GravityPreset): Promise<void> {
		this.currentSeed = seed;
		this.currentPreset = preset ?? getDefaultPreset();
		const isMoon = this.currentPreset.name === "Moon";
		const gravity = this.currentPreset.gameGravity;
		const pg = new PolicyGradientAgent();
		const random = new RandomAgent();
		this.slots = [
			{ agent: this.dqn, game: new HeadlessGame(seed, { gravity }) },
			{ agent: pg, game: new HeadlessGame(seed, { gravity }) },
			{ agent: random, game: new HeadlessGame(seed, { gravity }) },
		];
		// Transfer learning: when the world isn't Moon, spin up a second DQN
		// initialized from the Moon baseline weights and watch it adapt.
		this.transferDqn = null;
		if (!isMoon) {
			const transfer = new RLAgent("dqn-transfer");
			this.transferDqn = transfer;
			this.slots.push({
				agent: transfer,
				game: new HeadlessGame(seed, { gravity }),
			});
		}
		this.bestReward = -Infinity;
		this.bestLanded = false;
		this.totalEpisodes = 0;
		this.abortRequested = false;
		this.currentSlotIdx = 0;
		this.recorder.clear();
		this.panel.setPreset(this.currentPreset);

		this.panel.mount();
		this.panel.setEpisodesProvider(() => this.recorder.getEpisodes());
		this.panel.setDqnStateProvider(() => this.latestDqnState);
		this.panel.setForkRequestHandler((ep) => this.forkHandler?.(ep));
		this.adjustGameLayout(true);

		for (const slot of this.slots) {
			if (!slot.agent.ready) await slot.agent.init();
		}
		// Scope checkpoint keys by preset so a Jupiter run on seed N doesn't
		// resume from the Moon-trained weights (and vice-versa). The transfer
		// agent is the only thing that should cross worlds, and it explicitly
		// loads the Moon-keyed baseline below.
		await this.dqn.loadWeights(this.checkpointKey(seed, this.currentPreset));
		if (this.transferDqn) {
			// Load the canonical Moon baseline. Explicit "moon" suffix so this
			// key is stable even if the user is currently running on Jupiter.
			await this.transferDqn.loadWeights(`${MOON_BASELINE_SEED}-moon`);
			// Keep some exploration so it can adapt; don't collapse to greedy.
			this.transferDqn.epsilon = Math.max(this.transferDqn.epsilon, 0.2);
		}

		this.bestReward = -Infinity;
		this.totalEpisodes = this.dqn.episodeCount;

		this.training = true;
		this.runTrainingLoop();
	}

	async stop(): Promise<void> {
		this.training = false;
		this.abortRequested = true;
		if (this.currentSeed !== null) {
			await this.dqn.saveWeights(
				this.checkpointKey(this.currentSeed, this.currentPreset),
			);
		}
		for (const slot of this.slots) {
			if (slot.agent !== this.dqn) slot.agent.dispose();
		}
		this.transferDqn = null;
		this.slots = [];
		this.latestDqnState = null;
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

	setForkHandler(handler: (episode: RecordedEpisode) => void): void {
		this.forkHandler = handler;
	}

	getRecordedEpisodes(): RecordedEpisode[] {
		return this.recorder.getEpisodes();
	}

	getAgent(): RLAgent {
		return this.dqn;
	}

	getLatestDqnState(): number[] | null {
		return this.latestDqnState;
	}

	private async runTrainingLoop(): Promise<void> {
		while (this.training && !this.abortRequested) {
			const slot = this.slots[this.currentSlotIdx];
			try {
				const stats = await this.runEpisode(slot);
				if (slot.agent === this.dqn) {
					this.totalEpisodes = stats.episode;
					if (stats.totalReward > this.bestReward) {
						this.bestReward = stats.totalReward;
					}
					if (stats.landed) this.bestLanded = true;
				}
				this.panel.updateStats(stats);
			} catch (err) {
				// Without this catch an agent throwing mid-train would silently
				// kill the whole round-robin because runTrainingLoop is
				// fire-and-forget from start(). Log + continue so one bad
				// episode doesn't freeze the panel at 1 episode forever.
				console.error(`AITheater ${slot.agent.kind} episode failed:`, err);
			}
			this.currentSlotIdx = (this.currentSlotIdx + 1) % this.slots.length;
			await new Promise((resolve) => setTimeout(resolve, 0));
		}
	}

	private async runEpisode(slot: AgentSlot): Promise<AgentStats> {
		const { agent, game } = slot;
		const record = agent === this.dqn;
		if (record) this.recorder.abortCurrent();
		game.reset();
		let totalReward = 0;
		let steps = 0;
		let landed = false;
		let stepsThisTick = 0;

		while (steps < MAX_STEPS_PER_EPISODE) {
			const state = agent.getState(game.lander, game.terrain);
			const action = agent.chooseAction(state);
			const input = agent.actionToInput(action);

			if (agent === this.dqn) this.latestDqnState = state;
			if (record) this.recorder.onStep(action, game.lander);

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
			if (agent.trainBatch && steps % DQN_TRAIN_EVERY === 0)
				await agent.trainBatch();

			if (stepsThisTick >= STEPS_PER_TICK) {
				stepsThisTick = 0;
				await new Promise((resolve) => setTimeout(resolve, 0));
			}
		}

		await agent.endEpisode(totalReward);

		if (record && this.currentSeed !== null) {
			const recorded = this.recorder.onEpisodeEnd(
				agent.episodeCount,
				this.currentSeed,
				totalReward,
				landed,
				steps,
			);
			if (recorded) this.panel.onEpisodeRecorded(recorded);
		}

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

	/**
	 * Compose a checkpoint key from seed + preset name. Keeps per-world DQN
	 * weights separate in IndexedDB so switching gravity doesn't contaminate
	 * the fresh policy curve. The canonical Moon baseline lives at
	 * `${MOON_BASELINE_SEED}-moon`.
	 */
	private checkpointKey(seed: number, preset: GravityPreset): string {
		return `${seed}-${preset.name.toLowerCase()}`;
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
