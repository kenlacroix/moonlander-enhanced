import type { LanderState } from "../game/Lander";
import type { TerrainData } from "../game/Terrain";
import type { InputState } from "../systems/Input";
import type { Agent } from "./Agent";
import {
	ACTION_COUNT,
	actionToInput,
	calculateReward,
	getState,
} from "./AgentEnv";

/**
 * Random baseline: samples actions uniformly. Doesn't learn.
 * Serves as a lower bound that illustrates how much lift the learning
 * algorithms actually provide.
 */
export class RandomAgent implements Agent {
	readonly kind = "random" as const;
	ready = true;
	episodeCount = 0;
	private rewardHistory: number[] = [];

	async init(): Promise<void> {}

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

	chooseAction(): number {
		return Math.floor(Math.random() * ACTION_COUNT);
	}

	remember(): void {}

	endEpisode(totalReward: number): void {
		this.episodeCount++;
		this.rewardHistory.push(totalReward);
	}

	getRewardHistory(): number[] {
		return this.rewardHistory;
	}

	dispose(): void {}
}
