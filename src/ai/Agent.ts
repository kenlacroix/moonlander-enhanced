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

interface AgentMeta {
	label: string;
	color: string;
	description: string;
}

export const AGENT_META: Record<AgentKind, AgentMeta> = {
	dqn: {
		label: "DQN (fresh)",
		color: "#00ff88",
		description: "Remembers 20,000 past attempts; replays them to learn.",
	},
	"dqn-transfer": {
		label: "DQN (Moon→here)",
		color: "#ff88cc",
		description: "Started with Moon-trained memory; adapting to this world.",
	},
	pg: {
		label: "Policy Gradient",
		color: "#00aaff",
		description: "Doesn't remember — just adjusts after each full attempt.",
	},
	random: {
		label: "Random",
		color: "#888888",
		description: "Doesn't learn. Acts as a floor for comparison.",
	},
};
