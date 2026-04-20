import type { LanderState } from "../game/Lander";
import { createLander, updateLander } from "../game/Lander";
import { getLanderType } from "../game/LanderTypes";
import type { DifficultyConfig } from "../game/Terrain";
import { FIXED_TIMESTEP, WORLD_WIDTH } from "../utils/constants";
import type { InputState } from "./Input";

/** Compact input frame: 3 bits packed into a number */
type InputFrame = number;

function packInput(input: InputState): InputFrame {
	return (
		(input.thrustUp ? 1 : 0) |
		(input.rotateLeft ? 2 : 0) |
		(input.rotateRight ? 4 : 0)
	);
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
		toggleRetroSkin: false,
		exportGhost: false,
		importGhost: false,
		flightReport: false,
		toggleRelay: false,
		toggleAnnotations: false,
		forkTakeover: false,
	};
}

/**
 * Sprint 5.5 — ghosts are partitioned by `mode: "vanilla" | "authentic"`
 * so an Authentic Apollo 11 replay can't overwrite a vanilla best on the
 * same seed. Legacy ghosts (no mode field) read back as vanilla.
 */
export type GhostMode = "vanilla" | "authentic";

/**
 * Sprint 7.1 PR 1.5 — schema version 2. v1 ghosts have no `version` field
 * and no `difficulty` (the whole DifficultyConfig was implicit from the
 * seed + mission lookup). v2 ghosts embed the DifficultyConfig directly
 * so a Random-Mission run — where the archetype + palette come from a
 * share URL, not a stable MISSIONS[] entry — replays correctly.
 *
 * Version dispatch is intentionally single-field: the loader looks at
 * `version`, and any missing/older value is treated as v1. When a v1
 * ghost loads we set `legacy: true` so the replay UI can show a "legacy
 * ghost" badge — on seeds where terrain generation drifted between
 * versions, the replay may desync and this flag is the only user-visible
 * warning we can give.
 */
export const GHOST_SCHEMA_VERSION = 2;

export interface GhostRun {
	/** Schema version. Absent on v1 ghosts; 2 from Sprint 7.1 onward. */
	version?: number;
	seed: number;
	score: number;
	frames: InputFrame[];
	mode?: GhostMode;
	/** Embedded terrain/difficulty config so the ghost can be replayed
	 * outside the MISSIONS[] table (e.g. Random Missions). Optional on
	 * v1 ghosts, required on v2. */
	difficulty?: DifficultyConfig;
	/** True when this ghost was loaded without a schema version — i.e.
	 * it predates v2 and its difficulty context is unknown. Consumers
	 * should flag it in the UI so the player knows the replay may
	 * desync on terrain changes. */
	legacy?: boolean;
}

const STORAGE_KEY = "moonlander-ghosts";
const MAX_STORED_GHOSTS = 10;

export class GhostRecorder {
	private frames: InputFrame[] = [];
	private seed = 0;
	private mode: GhostMode = "vanilla";
	private difficulty: DifficultyConfig | undefined;

	/** Start recording a new run. `mode` defaults to vanilla for
	 * non-historic paths. `difficulty` is embedded in the saved ghost
	 * (v2 schema) so replays outside MISSIONS[] (Random Missions,
	 * share-URL decodes) reconstruct the exact terrain. */
	start(
		seed: number,
		mode: GhostMode = "vanilla",
		difficulty?: DifficultyConfig,
	): void {
		this.seed = seed;
		this.mode = mode;
		this.difficulty = difficulty;
		this.frames = [];
	}

	/** Record one fixed timestep's input */
	record(input: InputState): void {
		this.frames.push(packInput(input));
	}

	/** Save the completed run if it beats the stored ghost for this seed+mode */
	save(score: number): void {
		if (score <= 0 || this.frames.length === 0) return;

		const run: GhostRun = {
			version: GHOST_SCHEMA_VERSION,
			seed: this.seed,
			score,
			frames: this.frames,
			mode: this.mode,
			difficulty: this.difficulty,
		};

		try {
			const ghosts = loadGhosts();
			const existing = ghosts.find(
				(g) => g.seed === this.seed && (g.mode ?? "vanilla") === this.mode,
			);

			if (existing) {
				if (score > existing.score) {
					existing.version = run.version;
					existing.score = run.score;
					existing.frames = run.frames;
					existing.mode = run.mode;
					existing.difficulty = run.difficulty;
					// Save path rewrites this slot with a fresh v2 ghost, so
					// the legacy flag is no longer accurate.
					existing.legacy = undefined;
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

/** Stamp a migration flag on v1 ghosts as they load. Preserves the rest
 * of the stored shape so save() can still write a fresh v2 ghost into
 * the same slot without double-migration. */
function migrateGhost(g: GhostRun): GhostRun {
	if (g.version === GHOST_SCHEMA_VERSION) return g;
	return { ...g, legacy: true };
}

function loadGhosts(): GhostRun[] {
	try {
		const data = localStorage.getItem(STORAGE_KEY);
		if (!data) return [];
		const raw = JSON.parse(data) as GhostRun[];
		return raw.map(migrateGhost);
	} catch {
		return [];
	}
}

/**
 * Load the ghost for a specific seed + mode, if one exists. Legacy ghosts
 * without a `mode` field are treated as vanilla — an Authentic query will
 * not match them, so each mode gets its own best ghost cleanly.
 */
export function loadGhostForSeed(
	seed: number,
	mode: GhostMode = "vanilla",
): GhostRun | null {
	const ghosts = loadGhosts();
	return (
		ghosts.find((g) => g.seed === seed && (g.mode ?? "vanilla") === mode) ??
		null
	);
}

/** Export a ghost run as a JSON string for sharing */
export function exportGhost(
	seed: number,
	mode: GhostMode = "vanilla",
): string | null {
	const ghost = loadGhostForSeed(seed, mode);
	if (!ghost) return null;
	return JSON.stringify(ghost);
}

/** Import a ghost run from JSON string. Returns the imported run or null on error. */
export function importGhost(json: string): GhostRun | null {
	try {
		const parsed = JSON.parse(json) as GhostRun;
		if (
			typeof parsed.seed !== "number" ||
			typeof parsed.score !== "number" ||
			!Array.isArray(parsed.frames)
		) {
			return null;
		}
		// Imported ghosts without a mode field default to vanilla — they
		// were exported pre-5.5 or from a non-historic mission. Keeps
		// imports from silently colonizing an Authentic slot.
		const runMode: GhostMode =
			parsed.mode === "authentic" ? "authentic" : "vanilla";
		// Pre-Sprint-7.1 exports have no version: migrate via the same
		// shared helper so the `legacy` flag ends up consistent across
		// the load + import paths.
		const run = migrateGhost({ ...parsed, mode: runMode });
		const ghosts = loadGhosts();
		const existing = ghosts.find(
			(g) => g.seed === run.seed && (g.mode ?? "vanilla") === runMode,
		);
		if (existing) {
			if (run.score > existing.score) {
				existing.version = run.version;
				existing.score = run.score;
				existing.frames = run.frames;
				existing.mode = runMode;
				existing.difficulty = run.difficulty;
				existing.legacy = run.legacy;
			}
		} else {
			ghosts.push(run);
			if (ghosts.length > MAX_STORED_GHOSTS) {
				ghosts.shift();
			}
		}
		localStorage.setItem(STORAGE_KEY, JSON.stringify(ghosts));
		return run;
	} catch {
		return null;
	}
}

/** Download a ghost as a .json file */
export function downloadGhost(seed: number, mode: GhostMode = "vanilla"): void {
	const json = exportGhost(seed, mode);
	if (!json) return;
	const blob = new Blob([json], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = `moonlander-ghost-${seed}.json`;
	a.click();
	URL.revokeObjectURL(url);
}

/** Prompt user to pick a .json file and import it. Returns a promise with the result. */
export function uploadGhost(): Promise<GhostRun | null> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".json";
		input.addEventListener("change", () => {
			const file = input.files?.[0];
			if (!file) {
				resolve(null);
				return;
			}
			const reader = new FileReader();
			reader.onload = () => {
				const result = importGhost(reader.result as string);
				resolve(result);
			};
			reader.onerror = () => resolve(null);
			reader.readAsText(file);
		});
		input.click();
	});
}
