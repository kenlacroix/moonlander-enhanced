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
import { SumTree } from "./SumTree";

/**
 * Deep Q-Network agent (Sprint 2.7: Smarter DQN).
 *
 * Improvements over Sprint 2.5 baseline:
 *   - 11-dim state vector (vs 8): vertical accel, ground proximity,
 *     approach velocity, and fixed angular-velocity dim.
 *   - Prioritized Experience Replay via SumTree — samples experiences
 *     proportional to TD-error so the agent focuses on mistakes.
 *   - Stronger reward shaping with quality-scaled terminal reward
 *     (see AgentEnv.calculateRewardBreakdown).
 *   - Wider network (128 units) and faster epsilon decay for quicker
 *     exploration-to-exploitation transition.
 *   - Weight migration: loading old 8-dim weights into an 11-dim model
 *     logs a warning and falls back to fresh init.
 *
 * Action space (4 discrete): 0 nothing, 1 thrust, 2 rotate left, 3 rotate right.
 */

const MEMORY_SIZE = 20000;
const BATCH_SIZE = 128;
const GAMMA = 0.99;
const LEARNING_RATE = 0.001;
const EPSILON_START = 1.0;
const EPSILON_END = 0.05;
const EPSILON_DECAY = 0.99;
const TARGET_UPDATE_INTERVAL = 200;
const TAU = 0.01;

// PER hyperparameters
const PER_ALPHA = 0.6; // how much prioritization (0 = uniform, 1 = full)
const PER_BETA_START = 0.4;
const PER_BETA_END = 1.0;
const PER_BETA_ANNEAL_EPISODES = 100;
const PER_EPSILON = 0.01; // minimum priority — prevents 0 probability
const PER_MAX_PRIORITY_INIT = 1.0;

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
	private optimizer: tf.Optimizer | null = null;
	private memory = new SumTree<Experience>(MEMORY_SIZE);
	private maxPriority = PER_MAX_PRIORITY_INIT;
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
		// Separate Adam optimizer used by trainBatch's manual gradient step.
		// Held as a field so PER importance-sampling weights can actually
		// apply to the loss (TF.js Sequential.fit() doesn't support
		// sampleWeight — prior learning from Sprint 2.5's PG breakage).
		this.optimizer = tf.train.adam(LEARNING_RATE);
		this.ready = true;
	}

	private buildModel(): tf.Sequential {
		const model = tf.sequential();
		// Wider trunk (128 vs 64 in Sprint 2.5) gives the Q-function more
		// capacity to represent the state → action-value mapping. With
		// 11-dim state and 4 actions this is still a tiny network; inference
		// stays well under 1ms.
		model.add(
			tf.layers.dense({
				inputShape: [STATE_SIZE],
				units: 128,
				activation: "relu",
			}),
		);
		model.add(tf.layers.dense({ units: 128, activation: "relu" }));
		model.add(tf.layers.dense({ units: ACTION_COUNT, activation: "linear" }));
		// No compile() — we train via optimizer.minimize so IS weights
		// can be applied to the loss. compile() only matters for fit().
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

	getState(lander: LanderState, terrain: TerrainData): number[] {
		return getState(lander, terrain);
	}

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

	actionToInput(action: number): InputState {
		return actionToInput(action);
	}

	calculateReward(
		lander: LanderState,
		terrain: TerrainData,
		landed: boolean,
		crashed: boolean,
	): number {
		return calculateReward(lander, terrain, landed, crashed);
	}

	/**
	 * Store experience in the prioritized replay buffer. Fresh experiences
	 * get priority = current max so they're guaranteed to be sampled at
	 * least once (before their TD-error is known).
	 */
	remember(
		state: number[],
		action: number,
		reward: number,
		nextState: number[],
		done: boolean,
	): void {
		const exp: Experience = { state, action, reward, nextState, done };
		this.memory.add(this.maxPriority ** PER_ALPHA, exp);
	}

	private training = false;

	private currentBeta(): number {
		// Anneal beta from 0.4 to 1.0 over the first N episodes.
		// Beta controls how much the importance-sampling weights correct
		// for the non-uniform PER sampling distribution.
		const progress = Math.min(1, this.episodeCount / PER_BETA_ANNEAL_EPISODES);
		return PER_BETA_START + (PER_BETA_END - PER_BETA_START) * progress;
	}

	/**
	 * Train on a prioritized batch from replay memory.
	 *
	 * Samples proportional to priority via SumTree, computes TD-errors to
	 * update leaf priorities, and runs a gradient step via
	 * `optimizer.minimize` with a weighted MSE loss so PER importance-
	 * sampling weights are actually applied (the TF.js Sequential.fit
	 * path ignores sampleWeight — this is the same bug that broke
	 * Sprint 2.5's PG training).
	 *
	 * Loss: `mean(w_i * (target_i − Q(s_i, a_i))^2)`.
	 */
	async trainBatch(): Promise<void> {
		if (!this.model || !this.targetModel || !this.optimizer) return;
		if (this.memory.size < BATCH_SIZE) return;
		if (this.training) return;

		this.training = true;
		try {
			const total = this.memory.total;
			const segment = total / BATCH_SIZE;
			const beta = this.currentBeta();

			const sampled: {
				exp: Experience;
				treeIndex: number;
				priority: number;
			}[] = [];
			for (let i = 0; i < BATCH_SIZE; i++) {
				const target = segment * i + Math.random() * segment;
				const { index, priority, data } = this.memory.get(
					Math.min(target, total - 1e-6),
				);
				sampled.push({ exp: data, treeIndex: index, priority });
			}

			// Importance-sampling weights: w_i ∝ (1 / (N * P(i)))^beta.
			// Normalize by max weight so the gradient scale stays bounded.
			const N = this.memory.size;
			const probs = sampled.map((s) => s.priority / total);
			const weightsRaw = probs.map((p) => (N * p) ** -beta);
			const maxW = Math.max(...weightsRaw);
			const weights = weightsRaw.map((w) => w / maxW);

			// Compute targets + TD-errors OUTSIDE the minimize closure so we
			// can return them for priority updates. The target network is
			// frozen during this step (as is standard for DQN).
			const { targetsArr, tdErrors } = tf.tidy(() => {
				const nextStatesT = tf.tensor2d(sampled.map((x) => x.exp.nextState));
				const statesT = tf.tensor2d(sampled.map((x) => x.exp.state));
				const currentQ = (
					this.model!.predict(statesT) as tf.Tensor
				).arraySync() as number[][];
				const nextQ = (
					this.targetModel!.predict(nextStatesT) as tf.Tensor
				).arraySync() as number[][];

				const tdErrs: number[] = [];
				for (let i = 0; i < BATCH_SIZE; i++) {
					const exp = sampled[i].exp;
					const target = exp.done
						? exp.reward
						: exp.reward + GAMMA * Math.max(...nextQ[i]);
					const old = currentQ[i][exp.action];
					tdErrs.push(Math.abs(target - old));
					currentQ[i][exp.action] = target;
				}
				return { targetsArr: currentQ, tdErrors: tdErrs };
			});

			// Manual gradient step with IS-weighted MSE. Loss:
			//   mean(w_i * (target_i[a_i] − Q(s_i)[a_i])^2)
			// We use the full-vector target (unchanged Q for non-taken
			// actions, bellman-target for taken action) so gradients on
			// non-taken actions are 0 by construction. IS weight then
			// scales the whole per-sample squared error.
			const statesT = tf.tensor2d(sampled.map((x) => x.exp.state));
			const targetsT = tf.tensor2d(targetsArr);
			const weightsT = tf.tensor1d(weights);
			this.optimizer.minimize(() => {
				const q = this.model?.apply(statesT) as tf.Tensor2D;
				const perAction = tf.square(tf.sub(q, targetsT)); // [B, A]
				const perSample = tf.sum(perAction, 1); // [B]
				const weighted = tf.mul(perSample, weightsT); // [B]
				return tf.mean(weighted) as tf.Scalar;
			});
			statesT.dispose();
			targetsT.dispose();
			weightsT.dispose();

			// Update priorities in the SumTree based on fresh TD-errors.
			for (let i = 0; i < BATCH_SIZE; i++) {
				const priority = (tdErrors[i] + PER_EPSILON) ** PER_ALPHA;
				this.memory.update(sampled[i].treeIndex, priority);
				if (tdErrors[i] + PER_EPSILON > this.maxPriority) {
					this.maxPriority = tdErrors[i] + PER_EPSILON;
				}
			}

			this.stepsSinceTargetUpdate++;
			if (this.stepsSinceTargetUpdate >= TARGET_UPDATE_INTERVAL) {
				this.syncTargetModel(true);
				this.stepsSinceTargetUpdate = 0;
			}
		} finally {
			this.training = false;
		}
	}

	endEpisode(totalReward: number): void {
		this.episodeCount++;
		this.epsilon = Math.max(EPSILON_END, this.epsilon * EPSILON_DECAY);
		this.rewardHistory.push(totalReward);
	}

	getRewardHistory(): number[] {
		return this.rewardHistory;
	}

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
					stateSize: STATE_SIZE, // Sprint 2.7: record state-vector size
				}),
			);
			return true;
		} catch {
			return false;
		}
	}

	async loadWeights(key: string): Promise<boolean> {
		try {
			// Check metadata first for state-size mismatch. Pre-Sprint-2.7
			// weights may not have this field; treat as incompatible.
			const meta = localStorage.getItem(`moonlander-agent-meta-${key}`);
			if (meta) {
				const parsed = JSON.parse(meta);
				if (parsed.stateSize !== undefined && parsed.stateSize !== STATE_SIZE) {
					console.warn(
						`[RLAgent] Discarding saved weights for "${key}": state-vector size changed from ${parsed.stateSize} to ${STATE_SIZE}. Retraining from scratch.`,
					);
					return false;
				}
				if (parsed.stateSize === undefined) {
					// Legacy pre-Sprint-2.7 weights — assume 8-dim and discard.
					console.warn(
						`[RLAgent] Discarding legacy saved weights for "${key}" (no stateSize metadata; likely pre-Sprint-2.7). Retraining from scratch.`,
					);
					return false;
				}
			}

			const loaded = (await tf.loadLayersModel(
				`indexeddb://moonlander-agent-${key}`,
			)) as tf.Sequential;
			this.model = loaded;
			this.targetModel = this.buildModel();
			this.syncTargetModel();
			this.ready = true;
			if (meta) {
				const parsed = JSON.parse(meta);
				this.epsilon = parsed.epsilon ?? EPSILON_START;
				this.episodeCount = parsed.episodeCount ?? 0;
				this.rewardHistory = parsed.rewardHistory ?? [];
			}
			return true;
		} catch (err) {
			// Shape-mismatch errors from TF.js land here too; treat as
			// "no compatible saved weights" and let caller retrain.
			if (err instanceof Error) {
				console.warn(
					`[RLAgent] loadWeights failed for "${key}": ${err.message}. Retraining.`,
				);
			}
			return false;
		}
	}

	dispose(): void {
		this.model?.dispose();
		this.targetModel?.dispose();
	}
}
