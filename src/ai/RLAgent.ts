import * as tf from "@tensorflow/tfjs";
import type { LanderState } from "../game/Lander";
import { getTerrainHeightAt, normAngle } from "../game/Physics";
import type { LandingPad, TerrainData } from "../game/Terrain";
import type { InputState } from "../systems/Input";
import {
	LANDER_HEIGHT,
	MAX_LANDING_SPEED,
	STARTING_FUEL,
} from "../utils/constants";

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

const STATE_SIZE = 8;
const ACTION_COUNT = 4;
const MEMORY_SIZE = 10000;
const BATCH_SIZE = 64;
const GAMMA = 0.99;
const LEARNING_RATE = 0.001;
const EPSILON_START = 1.0;
const EPSILON_END = 0.05;
const EPSILON_DECAY = 0.998;

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

export class RLAgent {
	private model: tf.Sequential | null = null;
	private targetModel: tf.Sequential | null = null;
	private memory: Experience[] = [];
	private memoryIndex = 0;
	epsilon = EPSILON_START;
	episodeCount = 0;
	private rewardHistory: number[] = [];
	private updateTargetEvery = 100;
	private stepsSinceTargetUpdate = 0;
	ready = false;

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

	private syncTargetModel(): void {
		if (!this.model || !this.targetModel) return;
		const weights = this.model.getWeights();
		this.targetModel.setWeights(weights.map((w) => w.clone()));
	}

	/** Extract normalized state vector from game state */
	getState(lander: LanderState, terrain: TerrainData): number[] {
		const pad = this.findNearestPad(lander, terrain);
		const padCenterX = pad ? pad.x + pad.width / 2 : lander.x;
		const padWidth = pad?.width ?? 100;
		const terrainY = getTerrainHeightAt(lander.x, terrain.points);
		const altitude = terrainY - (lander.y + LANDER_HEIGHT / 2);

		return [
			(padCenterX - lander.x) / 2000, // dx to pad (normalized)
			Math.min(altitude / 500, 1), // altitude (capped)
			lander.vx / 300, // horizontal velocity
			lander.vy / 300, // vertical velocity
			normAngle(lander.angle) / 180, // angle (-1..1)
			0, // angular velocity (unused for now)
			lander.fuel / STARTING_FUEL, // fuel fraction
			pad ? Math.abs(lander.x - padCenterX) / padWidth : 1, // distance to pad center ratio
		];
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
		return {
			thrustUp: action === 1,
			rotateLeft: action === 2,
			rotateRight: action === 3,
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
		};
	}

	/** Calculate reward for a transition */
	calculateReward(
		lander: LanderState,
		terrain: TerrainData,
		landed: boolean,
		crashed: boolean,
	): number {
		if (landed) return 100;
		if (crashed) return -100;

		const pad = this.findNearestPad(lander, terrain);
		if (!pad) return -1;

		const padCenterX = pad.x + pad.width / 2;
		const terrainY = getTerrainHeightAt(lander.x, terrain.points);
		const altitude = terrainY - (lander.y + LANDER_HEIGHT / 2);

		let reward = 0;

		// Reward being close to pad horizontally
		const dx = Math.abs(lander.x - padCenterX);
		reward += Math.max(0, 1 - dx / 1000) * 0.5;

		// Reward controlled descent (small positive vy is good)
		if (lander.vy > 0 && lander.vy < MAX_LANDING_SPEED * 2) {
			reward += 0.3;
		}

		// Penalize being tilted
		const anglePenalty = Math.abs(normAngle(lander.angle)) / 180;
		reward -= anglePenalty * 0.5;

		// Small time penalty to encourage efficiency
		reward -= 0.1;

		return reward;
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

	/** Train on a batch from replay memory */
	async trainBatch(): Promise<void> {
		if (!this.model || !this.targetModel) return;
		if (this.memory.length < BATCH_SIZE) return;

		// Sample random batch
		const batch: Experience[] = [];
		for (let i = 0; i < BATCH_SIZE; i++) {
			const idx = Math.floor(Math.random() * this.memory.length);
			batch.push(this.memory[idx]);
		}

		await tf.tidy(() => {
			const states = tf.tensor2d(batch.map((e) => e.state));
			const nextStates = tf.tensor2d(batch.map((e) => e.nextState));

			// Current Q values
			const currentQ = (
				this.model!.predict(states) as tf.Tensor
			).arraySync() as number[][];

			// Target Q values from target network
			const nextQ = (
				this.targetModel!.predict(nextStates) as tf.Tensor
			).arraySync() as number[][];

			// Update Q values with Bellman equation
			for (let i = 0; i < BATCH_SIZE; i++) {
				const target = batch[i].done
					? batch[i].reward
					: batch[i].reward + GAMMA * Math.max(...nextQ[i]);
				currentQ[i][batch[i].action] = target;
			}

			const targetTensor = tf.tensor2d(currentQ);
			this.model!.fit(states, targetTensor, { epochs: 1, verbose: 0 });
		});

		// Periodically sync target network
		this.stepsSinceTargetUpdate++;
		if (this.stepsSinceTargetUpdate >= this.updateTargetEvery) {
			this.syncTargetModel();
			this.stepsSinceTargetUpdate = 0;
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

	private findNearestPad(
		lander: LanderState,
		terrain: TerrainData,
	): LandingPad | null {
		if (terrain.pads.length === 0) return null;
		let best = terrain.pads[0];
		let bestDist = Math.abs(lander.x - (best.x + best.width / 2));
		for (const pad of terrain.pads) {
			const dist = Math.abs(lander.x - (pad.x + pad.width / 2));
			if (dist < bestDist) {
				best = pad;
				bestDist = dist;
			}
		}
		return best;
	}

	/** Clean up TensorFlow resources */
	dispose(): void {
		this.model?.dispose();
		this.targetModel?.dispose();
	}
}
