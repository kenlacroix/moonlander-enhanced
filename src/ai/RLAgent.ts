import * as tf from "@tensorflow/tfjs";
import type { LanderState } from "../game/Lander";
import type { TerrainData } from "../game/Terrain";
import type { InputState } from "../systems/Input";
import type { Agent } from "./Agent";
import {
	ACTION_COUNT,
	actionToInput,
	calculateReward,
	getState,
	STATE_SIZE,
} from "./AgentEnv";

/**
 * Deep Q-Network (DQN) agent that learns to land through trial and error.
 *
 * State space (8 dimensions, normalized to roughly -1..1):
 *   0: horizontal distance to nearest pad center (normalized by world width)
 *   1: altitude above terrain (normalized)
 *   2: horizontal velocity (normalized)
 *   3: vertical velocity (normalized)
 *   4: angle (normalized to -1..1 where 0 = upright)
 *   5: angular velocity (normalized)
 *   6: fuel remaining (0..1)
 *   7: distance to pad center relative to pad width (0 = centered, 1 = edge)
 *
 * Action space (4 discrete actions):
 *   0: nothing
 *   1: thrust
 *   2: rotate left
 *   3: rotate right
 */

const MEMORY_SIZE = 20000;
const BATCH_SIZE = 64;
const GAMMA = 0.99;
const LEARNING_RATE = 0.0005;
const EPSILON_START = 1.0;
const EPSILON_END = 0.05;
const EPSILON_DECAY = 0.995;
const TARGET_UPDATE_INTERVAL = 500;
const TAU = 0.005;

interface Experience {
	state: number[];
	action: number;
	reward: number;
	nextState: number[];
	done: boolean;
}

export interface TrainingStats {
	episode: number;
	totalReward: number;
	epsilon: number;
	landed: boolean;
	steps: number;
}

export class RLAgent implements Agent {
	readonly kind: "dqn" | "dqn-transfer";
	private model: tf.Sequential | null = null;
	private targetModel: tf.Sequential | null = null;
	private memory: Experience[] = [];
	private memoryIndex = 0;
	epsilon = EPSILON_START;
	episodeCount = 0;
	private rewardHistory: number[] = [];
	private stepsSinceTargetUpdate = 0;
	ready = false;

	constructor(kind: "dqn" | "dqn-transfer" = "dqn") {
		this.kind = kind;
	}

	/** Initialize the neural network. Call once before training. */
	async init(): Promise<void> {
		this.model = this.buildModel();
		this.targetModel = this.buildModel();
		this.syncTargetModel();
		this.ready = true;
	}

	private buildModel(): tf.Sequential {
		const model = tf.sequential();
		model.add(
			tf.layers.dense({
				inputShape: [STATE_SIZE],
				units: 64,
				activation: "relu",
			}),
		);
		model.add(
			tf.layers.dense({
				units: 64,
				activation: "relu",
			}),
		);
		model.add(
			tf.layers.dense({
				units: ACTION_COUNT,
				activation: "linear",
			}),
		);
		model.compile({
			optimizer: tf.train.adam(LEARNING_RATE),
			loss: "meanSquaredError",
		});
		return model;
	}

	private syncTargetModel(soft = false): void {
		if (!this.model || !this.targetModel) return;
		const modelWeights = this.model.getWeights();
		if (soft) {
			const targetWeights = this.targetModel.getWeights();
			this.targetModel.setWeights(
				modelWeights.map((w, i) =>
					w.mul(TAU).add(targetWeights[i].mul(1 - TAU)),
				),
			);
		} else {
			this.targetModel.setWeights(modelWeights.map((w) => w.clone()));
		}
	}

	/** Extract normalized state vector from game state */
	getState(lander: LanderState, terrain: TerrainData): number[] {
		return getState(lander, terrain);
	}

	/** Choose an action using epsilon-greedy policy */
	chooseAction(state: number[]): number {
		if (Math.random() < this.epsilon) {
			return Math.floor(Math.random() * ACTION_COUNT);
		}
		return tf.tidy(() => {
			if (!this.model) return 0;
			const input = tf.tensor2d([state]);
			const prediction = this.model.predict(input) as tf.Tensor;
			return prediction.argMax(1).dataSync()[0];
		});
	}

	/** Convert action index to InputState */
	actionToInput(action: number): InputState {
		return actionToInput(action);
	}

	/** Calculate reward for a transition */
	calculateReward(
		lander: LanderState,
		terrain: TerrainData,
		landed: boolean,
		crashed: boolean,
	): number {
		return calculateReward(lander, terrain, landed, crashed);
	}

	/** Store experience in replay buffer */
	remember(
		state: number[],
		action: number,
		reward: number,
		nextState: number[],
		done: boolean,
	): void {
		const exp: Experience = { state, action, reward, nextState, done };
		if (this.memory.length < MEMORY_SIZE) {
			this.memory.push(exp);
		} else {
			this.memory[this.memoryIndex % MEMORY_SIZE] = exp;
		}
		this.memoryIndex++;
	}

	private training = false;

	/** Train on a batch from replay memory */
	async trainBatch(): Promise<void> {
		if (!this.model || !this.targetModel) return;
		if (this.memory.length < BATCH_SIZE) return;
		if (this.training) return;

		this.training = true;
		try {
			const batch: Experience[] = [];
			for (let i = 0; i < BATCH_SIZE; i++) {
				const idx = Math.floor(Math.random() * this.memory.length);
				batch.push(this.memory[idx]);
			}

			const { states, targets } = tf.tidy(() => {
				const s = tf.tensor2d(batch.map((e) => e.state));
				const ns = tf.tensor2d(batch.map((e) => e.nextState));

				const currentQ = (
					this.model!.predict(s) as tf.Tensor
				).arraySync() as number[][];

				const nextQ = (
					this.targetModel!.predict(ns) as tf.Tensor
				).arraySync() as number[][];

				for (let i = 0; i < BATCH_SIZE; i++) {
					const target = batch[i].done
						? batch[i].reward
						: batch[i].reward + GAMMA * Math.max(...nextQ[i]);
					currentQ[i][batch[i].action] = target;
				}

				return {
					states: tf.tensor2d(batch.map((e) => e.state)),
					targets: tf.tensor2d(currentQ),
				};
			});

			await this.model.fit(states, targets, { epochs: 1, verbose: 0 });
			states.dispose();
			targets.dispose();

			this.stepsSinceTargetUpdate++;
			if (this.stepsSinceTargetUpdate >= TARGET_UPDATE_INTERVAL) {
				this.syncTargetModel(true);
				this.stepsSinceTargetUpdate = 0;
			}
		} finally {
			this.training = false;
		}
	}

	/** Decay epsilon after each episode */
	endEpisode(totalReward: number): void {
		this.episodeCount++;
		this.epsilon = Math.max(EPSILON_END, this.epsilon * EPSILON_DECAY);
		this.rewardHistory.push(totalReward);
	}

	/** Get recent reward history for plotting */
	getRewardHistory(): number[] {
		return this.rewardHistory;
	}

	/** Get smoothed reward (moving average over last 20 episodes) */
	getSmoothedReward(): number {
		const window = 20;
		const recent = this.rewardHistory.slice(-window);
		if (recent.length === 0) return 0;
		return recent.reduce((a, b) => a + b, 0) / recent.length;
	}

	async saveWeights(key: string): Promise<boolean> {
		if (!this.model) return false;
		try {
			await this.model.save(`indexeddb://moonlander-agent-${key}`);
			localStorage.setItem(
				`moonlander-agent-meta-${key}`,
				JSON.stringify({
					epsilon: this.epsilon,
					episodeCount: this.episodeCount,
					rewardHistory: this.rewardHistory.slice(-200),
				}),
			);
			return true;
		} catch {
			return false;
		}
	}

	async loadWeights(key: string): Promise<boolean> {
		try {
			const loaded = (await tf.loadLayersModel(
				`indexeddb://moonlander-agent-${key}`,
			)) as tf.Sequential;
			this.model = loaded;
			this.targetModel = this.buildModel();
			this.syncTargetModel();
			this.ready = true;
			const meta = localStorage.getItem(`moonlander-agent-meta-${key}`);
			if (meta) {
				const parsed = JSON.parse(meta);
				this.epsilon = parsed.epsilon ?? EPSILON_START;
				this.episodeCount = parsed.episodeCount ?? 0;
				this.rewardHistory = parsed.rewardHistory ?? [];
			}
			return true;
		} catch {
			return false;
		}
	}

	/** Clean up TensorFlow resources */
	dispose(): void {
		this.model?.dispose();
		this.targetModel?.dispose();
	}
}
