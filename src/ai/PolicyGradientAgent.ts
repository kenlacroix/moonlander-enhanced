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

const GAMMA = 0.99;
const LEARNING_RATE = 0.001;

interface Step {
	state: number[];
	action: number;
	reward: number;
}

/**
 * REINFORCE (policy gradient) agent.
 * Learns a stochastic policy directly — samples actions from softmax output,
 * then updates parameters at episode end using discounted returns as
 * per-step loss weights. No replay buffer, no value function, no target
 * network: simpler than DQN but higher variance.
 *
 * Training note: TF.js `model.fit()` does not support the `sampleWeight`
 * parameter on sequential models ("sample weight is not supported yet").
 * We therefore skip `model.compile()` entirely and run gradient steps
 * manually with `optimizer.minimize(lossFn)`. The loss is the standard
 * REINFORCE objective: `-mean(advantage * log prob(action | state))`.
 */
export class PolicyGradientAgent implements Agent {
	readonly kind = "pg" as const;
	private model: tf.Sequential | null = null;
	private optimizer: tf.Optimizer | null = null;
	private trajectory: Step[] = [];
	private rewardHistory: number[] = [];
	episodeCount = 0;
	ready = false;
	private training = false;

	async init(): Promise<void> {
		const model = tf.sequential();
		model.add(
			tf.layers.dense({
				inputShape: [STATE_SIZE],
				units: 64,
				activation: "relu",
			}),
		);
		model.add(tf.layers.dense({ units: ACTION_COUNT, activation: "softmax" }));
		this.model = model;
		this.optimizer = tf.train.adam(LEARNING_RATE);
		this.ready = true;
	}

	getState(lander: LanderState, terrain: TerrainData): number[] {
		return getState(lander, terrain);
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

	chooseAction(state: number[]): number {
		if (!this.model) return Math.floor(Math.random() * ACTION_COUNT);
		return tf.tidy(() => {
			const input = tf.tensor2d([state]);
			const probs = this.model?.predict(input) as tf.Tensor;
			const arr = probs.dataSync();
			const r = Math.random();
			let cum = 0;
			for (let i = 0; i < arr.length; i++) {
				cum += arr[i];
				if (r < cum) return i;
			}
			return arr.length - 1;
		});
	}

	remember(state: number[], action: number, reward: number): void {
		this.trajectory.push({ state, action, reward });
	}

	async endEpisode(totalReward: number): Promise<void> {
		this.episodeCount++;
		this.rewardHistory.push(totalReward);

		if (
			!this.model ||
			!this.optimizer ||
			this.trajectory.length === 0 ||
			this.training
		) {
			this.trajectory = [];
			return;
		}

		this.training = true;
		try {
			const traj = this.trajectory;
			this.trajectory = [];

			// Discounted returns (G_t)
			const returns = new Array(traj.length);
			let g = 0;
			for (let i = traj.length - 1; i >= 0; i--) {
				g = traj[i].reward + GAMMA * g;
				returns[i] = g;
			}
			// Normalize to reduce variance.
			const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
			const variance =
				returns.reduce((a, b) => a + (b - mean) ** 2, 0) / returns.length;
			const std = Math.sqrt(variance) || 1;
			const advantages = returns.map((r) => (r - mean) / std);

			const states = tf.tensor2d(traj.map((s) => s.state));
			const actions = tf.tensor1d(
				traj.map((s) => s.action),
				"int32",
			);
			const adv = tf.tensor1d(advantages);

			// REINFORCE loss: -mean(advantage * log π(a|s)).
			// `optimizer.minimize` computes gradients of all trainable vars
			// via the passed loss function and applies an Adam step.
			this.optimizer.minimize(() => {
				const probs = this.model?.apply(states) as tf.Tensor2D;
				const mask = tf.oneHot(actions, ACTION_COUNT);
				// Selected action prob per step: [N]
				const selected = tf.sum(tf.mul(probs, mask), 1);
				const logProbs = tf.log(tf.add(selected, 1e-8));
				const weighted = tf.mul(adv, logProbs);
				return tf.neg(tf.mean(weighted)) as tf.Scalar;
			});

			states.dispose();
			actions.dispose();
			adv.dispose();
			// Yield to the browser between episodes so the main thread can
			// repaint and process user clicks.
			await tf.nextFrame();
		} finally {
			this.training = false;
		}
	}

	getRewardHistory(): number[] {
		return this.rewardHistory;
	}

	dispose(): void {
		this.model?.dispose();
	}
}
