import type { InputState } from "./Input";
import type { LanderState } from "../game/Lander";
import { createLander, updateLander } from "../game/Lander";
import { getLanderType } from "../game/LanderTypes";
import { FIXED_TIMESTEP, WORLD_WIDTH } from "../utils/constants";

/** Compact input frame: 3 bits packed into a number */
type InputFrame = number;

function packInput(input: InputState): InputFrame {
	return (input.thrustUp ? 1 : 0) | (input.rotateLeft ? 2 : 0) | (input.rotateRight ? 4 : 0);
}

function unpackInput(frame: InputFrame): InputState {
	return {
		thrustUp: (frame & 1) !== 0,
		rotateLeft: (frame & 2) !== 0,
		rotateRight: (frame & 4) !== 0,
		restart: false,
		menuUp: false,
		menuDown: false,
		menuSelect: false,
		menuBack: false,
		toggleAutopilot: false,
		openSettings: false,
	};
}

export interface GhostRun {
	seed: number;
	score: number;
	frames: InputFrame[];
}

const STORAGE_KEY = "moonlander-ghosts";
const MAX_STORED_GHOSTS = 10;

export class GhostRecorder {
	private frames: InputFrame[] = [];
	private seed = 0;

	/** Start recording a new run */
	start(seed: number): void {
		this.seed = seed;
		this.frames = [];
	}

	/** Record one fixed timestep's input */
	record(input: InputState): void {
		this.frames.push(packInput(input));
	}

	/** Save the completed run if it beats the stored ghost for this seed */
	save(score: number): void {
		if (score <= 0 || this.frames.length === 0) return;

		const run: GhostRun = {
			seed: this.seed,
			score,
			frames: this.frames,
		};

		try {
			const ghosts = loadGhosts();
			const existing = ghosts.find((g) => g.seed === this.seed);

			if (existing) {
				if (score > existing.score) {
					existing.score = run.score;
					existing.frames = run.frames;
				}
			} else {
				ghosts.push(run);
				// Evict oldest if over limit
				if (ghosts.length > MAX_STORED_GHOSTS) {
					ghosts.shift();
				}
			}

			localStorage.setItem(STORAGE_KEY, JSON.stringify(ghosts));
		} catch {
			// localStorage unavailable (private mode, full, etc.)
		}
	}
}

export class GhostPlayer {
	lander: LanderState;
	private frames: InputFrame[];
	private frameIndex = 0;
	private active = true;

	constructor(run: GhostRun) {
		this.frames = run.frames;
		this.lander = createLander(WORLD_WIDTH / 2, 80, getLanderType());
	}

	/** Advance the ghost by one fixed timestep. Returns false when replay is done. */
	step(): boolean {
		if (!this.active || this.frameIndex >= this.frames.length) {
			this.active = false;
			return false;
		}

		const input = unpackInput(this.frames[this.frameIndex]);
		updateLander(this.lander, input, FIXED_TIMESTEP);
		this.frameIndex++;
		return true;
	}

	isActive(): boolean {
		return this.active;
	}
}

function loadGhosts(): GhostRun[] {
	try {
		const data = localStorage.getItem(STORAGE_KEY);
		if (!data) return [];
		return JSON.parse(data) as GhostRun[];
	} catch {
		return [];
	}
}

/** Load the ghost for a specific seed, if one exists */
export function loadGhostForSeed(seed: number): GhostRun | null {
	const ghosts = loadGhosts();
	return ghosts.find((g) => g.seed === seed) ?? null;
}
