import type { LanderState, PhysicsVersion } from "../game/Lander";
import { createLander, updateLander, updateLanderLegacy } from "../game/Lander";
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
 * Schema evolution:
 *   v1 (pre-Sprint-7.1): no `version` field, no `difficulty`.
 *   v2 (Sprint 7.1 PR 1.5): embeds `difficulty` so Random Missions replay.
 *   v3 (Sprint 7.2): adds `physicsVersion: 2 | 3` header — authoritative
 *                    flag that picks which integrator runs during replay.
 *                    Pre-7.2 ghosts lack the field and default to
 *                    physicsVersion 2 so they replay under the rules they
 *                    were recorded under. No per-frame angularVel field is
 *                    needed because integration is deterministic from input
 *                    + fixed timestep once the correct integrator is picked.
 *
 * When a pre-v3 ghost loads we set `legacy: true` + `physicsVersion: 2` so
 * the replay UI can show a "legacy ghost" badge and the physics pipeline
 * knows to route through `updateLanderLegacy`.
 */
export const GHOST_SCHEMA_VERSION = 3;

export interface GhostRun {
	/** Schema version. Absent on v1 ghosts; 2 from Sprint 7.1; 3 from Sprint 7.2. */
	version?: number;
	seed: number;
	score: number;
	frames: InputFrame[];
	mode?: GhostMode;
	/** Embedded terrain/difficulty config so the ghost can be replayed
	 * outside the MISSIONS[] table (e.g. Random Missions). Optional on
	 * v1 ghosts, required on v2+. */
	difficulty?: DifficultyConfig;
	/** Sprint 7.2 — which physics integrator replays this ghost. Absent on
	 * v1/v2 ghosts (default 2 via migration). v3 ghosts always record 3. */
	physicsVersion?: PhysicsVersion;
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
			// Sprint 7.2 — every new recording is under v3 physics. Legacy
			// loads patch this to 2 via migrateGhost.
			physicsVersion: 3,
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
					existing.physicsVersion = run.physicsVersion;
					// Save path rewrites this slot with a fresh v3 ghost, so
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
	private physicsVersion: PhysicsVersion;

	constructor(run: GhostRun) {
		this.frames = run.frames;
		// Sprint 7.2 — pick integrator based on the ghost's recorded physics
		// version. v2 ghosts replay under v2 rules entirely (no angularVel
		// integration, no spinning-crash check). Missing/unknown defaults to
		// 2 because every pre-7.2 ghost was recorded under v2 physics.
		this.physicsVersion = run.physicsVersion === 3 ? 3 : 2;
		// Sprint 7.2 Part 2 — GhostPlayer is a visual overlay (synthetic Eagle
		// at default position). It doesn't reconstruct mission terrain/physics;
		// per-mission overrides intentionally not threaded here. The lander's
		// materialized maxLandingAngularRate falls back to the global default.
		this.lander = createLander(
			WORLD_WIDTH / 2,
			80,
			getLanderType(),
			undefined,
			this.physicsVersion,
		);
	}

	/** Advance the ghost by one fixed timestep. Returns false when replay is done. */
	step(): boolean {
		if (!this.active || this.frameIndex >= this.frames.length) {
			this.active = false;
			return false;
		}

		const input = unpackInput(this.frames[this.frameIndex]);
		if (this.physicsVersion === 2) {
			updateLanderLegacy(this.lander, input, FIXED_TIMESTEP);
		} else {
			updateLander(this.lander, input, FIXED_TIMESTEP);
		}
		this.frameIndex++;
		return true;
	}

	isActive(): boolean {
		return this.active;
	}
}

/** Normalize an incoming ghost record to the current schema expectations.
 *
 * - v1/v2 ghosts (lacking `physicsVersion`) get marked `physicsVersion: 2`
 *   so the replay pipeline routes them to `updateLanderLegacy` and skips
 *   the new spinning-crash landing check. They also get `legacy: true`.
 * - v3 ghosts pass through unchanged unless they're missing `physicsVersion`
 *   (schema drift defense — fall back to 2 + legacy if so).
 */
function migrateGhost(g: GhostRun): GhostRun {
	const physicsVersion: PhysicsVersion = g.physicsVersion === 3 ? 3 : 2;
	if (g.version === GHOST_SCHEMA_VERSION && g.physicsVersion === 3) {
		return g;
	}
	return { ...g, legacy: true, physicsVersion };
}

function loadGhosts(): GhostRun[] {
	try {
		const data = localStorage.getItem(STORAGE_KEY);
		if (!data) return [];
		const raw = JSON.parse(data) as GhostRun[];
		// Sprint 7.2 — try/catch the per-ghost migration too. A single
		// corrupt entry (bad fields, missing frames array) shouldn't kill
		// the whole replay panel. Skip the bad one, keep the rest.
		const out: GhostRun[] = [];
		for (const g of raw) {
			try {
				out.push(migrateGhost(g));
			} catch {
				// Drop the corrupt entry silently. The UI shows fewer ghosts
				// than stored; acceptable because the alternative is no
				// ghost replay UI at all.
			}
		}
		return out;
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
				existing.physicsVersion = run.physicsVersion;
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
