import type { LanderState } from "../game/Lander";

export interface GhostPose {
	x: number;
	y: number;
	angle: number;
}

export interface RecordedEpisode {
	id: number;
	episode: number;
	seed: number;
	totalReward: number;
	landed: boolean;
	steps: number;
	inputs: number[];
	positions: GhostPose[];
}

/**
 * Rolling buffer of the last N recorded agent episodes. Captures the action
 * chosen at each step plus the lander's pose so the episode can be replayed
 * as canned input and rendered as a ghost trail after a player fork.
 */
export class EpisodeRecorder {
	private episodes: RecordedEpisode[] = [];
	private currentInputs: number[] = [];
	private currentPositions: GhostPose[] = [];
	private nextId = 1;
	private readonly maxKept: number;

	constructor(maxKept = 10) {
		this.maxKept = maxKept;
	}

	onStep(action: number, lander: LanderState): void {
		this.currentInputs.push(action);
		this.currentPositions.push({
			x: lander.x,
			y: lander.y,
			angle: lander.angle,
		});
	}

	onEpisodeEnd(
		episode: number,
		seed: number,
		totalReward: number,
		landed: boolean,
		steps: number,
	): RecordedEpisode | null {
		if (this.currentInputs.length === 0) {
			return null;
		}
		const recorded: RecordedEpisode = {
			id: this.nextId++,
			episode,
			seed,
			totalReward,
			landed,
			steps,
			inputs: this.currentInputs,
			positions: this.currentPositions,
		};
		this.currentInputs = [];
		this.currentPositions = [];
		this.episodes.push(recorded);
		if (this.episodes.length > this.maxKept) {
			this.episodes.splice(0, this.episodes.length - this.maxKept);
		}
		return recorded;
	}

	abortCurrent(): void {
		this.currentInputs = [];
		this.currentPositions = [];
	}

	getEpisodes(): RecordedEpisode[] {
		return this.episodes;
	}

	clear(): void {
		this.episodes = [];
		this.currentInputs = [];
		this.currentPositions = [];
	}
}
