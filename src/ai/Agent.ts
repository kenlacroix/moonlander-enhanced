import type { LanderState } from "../game/Lander";
import type { TerrainData } from "../game/Terrain";
import type { InputState } from "../systems/Input";

export type AgentKind = "dqn" | "dqn-transfer" | "pg" | "random";

export interface AgentStats {
	kind: AgentKind;
	episode: number;
	totalReward: number;
	landed: boolean;
	steps: number;
	epsilon?: number;
}

export interface Agent {
	readonly kind: AgentKind;
	ready: boolean;
	episodeCount: number;
	init(): Promise<void>;
	getState(lander: LanderState, terrain: TerrainData): number[];
	actionToInput(action: number): InputState;
	calculateReward(
		lander: LanderState,
		terrain: TerrainData,
		landed: boolean,
		crashed: boolean,
	): number;
	chooseAction(state: number[]): number;
	remember(
		state: number[],
		action: number,
		reward: number,
		nextState: number[],
		done: boolean,
	): void;
	trainBatch?(): Promise<void>;
	endEpisode(totalReward: number): Promise<void> | void;
	getRewardHistory(): number[];
	dispose(): void;
}

export const AGENT_COLORS: Record<AgentKind, string> = {
	dqn: "#00ff88",
	"dqn-transfer": "#ff88cc",
	pg: "#00aaff",
	random: "#888888",
};

export const AGENT_LABELS: Record<AgentKind, string> = {
	dqn: "DQN (fresh)",
	"dqn-transfer": "DQN (Moon→here)",
	pg: "Policy Gradient",
	random: "Random",
};
