const STORAGE_KEY = "moonlander-leaderboard";
const MAX_ENTRIES_PER_SEED = 5;

/**
 * Sprint 5.5 — records key by `${seed}-${mode}` so Authentic and vanilla
 * runs don't overwrite each other's best scores.
 *
 * Sprint 7.2 — adds a third axis: `${seed}-${mode}-v${physicsVersion}` so
 * pre-7.2 scores (recorded under v2 physics, free rotation) and post-7.2
 * scores (recorded under v3 physics, RCS-gated rotation) stay in separate
 * buckets. Pre-7.2 scores are frozen at the legacy `${seed}-${mode}` key;
 * all new writes go to the versioned key. Reads prefer the versioned key
 * and fall back to the legacy key only under physicsVersion 2.
 */
export type ScoreMode = "vanilla" | "authentic";
export type PhysicsBucket = 2 | 3;

export interface LeaderboardEntry {
	score: number;
	date: string; // ISO date string
	time?: number; // seconds from spawn to landing (successful runs only)
}

type LeaderboardData = Record<string, LeaderboardEntry[]>;

function makeKey(
	seed: number,
	mode: ScoreMode,
	physicsVersion: PhysicsBucket = 3,
): string {
	// v2 reads use the legacy key (no version suffix) so pre-7.2 scores
	// stay visible. v3 reads/writes use the new versioned key.
	return physicsVersion === 2
		? `${seed}-${mode}`
		: `${seed}-${mode}-v${physicsVersion}`;
}

/**
 * Read one seed-scoped record slot. Handles two migrations:
 *   - Sprint 5.5: legacy `${seed}` → `${seed}-vanilla`
 *   - Sprint 7.2: `${seed}-${mode}` (v2 scores) → `${seed}-${mode}-v3`
 *
 * The 7.2 partition is intentional: v2 scores were earned under free
 * rotation, v3 scores under RCS-gated rotation. They're not comparable.
 * To keep the UI from looking broken on upgrade (empty leaderboards on
 * day 1), reads prefer the v3 key but FALL BACK to the v2 key when v3
 * has nothing yet. First v3 write for the seed+mode creates the new
 * bucket; v2 scores remain frozen at their original key for archival.
 *
 * Pure read — doesn't write the migration back. Rewrite happens on the
 * next addScore call for that seed.
 */
function getEntries(
	data: LeaderboardData,
	seed: number,
	mode: ScoreMode,
): LeaderboardEntry[] {
	const v3Key = makeKey(seed, mode, 3);
	if (data[v3Key]) return data[v3Key];
	const legacyKey = makeKey(seed, mode, 2);
	if (data[legacyKey]) return data[legacyKey];
	if (mode === "vanilla" && data[String(seed)]) return data[String(seed)];
	return [];
}

// In-memory mirror of the parsed leaderboard. Single-player game with no
// cross-tab writers, so the cache is always consistent with our own writes.
// Lazily populated on first read; invalidated on every write-through.
// Previous behavior was: every getBestScore call ran localStorage.getItem +
// JSON.parse. renderMenu calls getBestScore 2N times per frame (vanilla +
// authentic for each mission), which compounds as mission count grows.
let cached: LeaderboardData | null = null;

function load(): LeaderboardData {
	if (cached) return cached;
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		cached = raw ? (JSON.parse(raw) as LeaderboardData) : {};
	} catch {
		cached = {};
	}
	return cached;
}

function save(data: LeaderboardData): void {
	cached = data;
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	} catch {
		// localStorage unavailable
	}
}

/**
 * Drop the in-memory cache. Only needed in tests that write to
 * localStorage directly (bypassing save()) to seed legacy-format data.
 */
export function _resetLeaderboardCacheForTests(): void {
	cached = null;
}

/** Add a score for a seed. Returns the rank (1-based) or null if it didn't make the board. */
export function addScore(
	seed: number,
	score: number,
	time?: number,
	mode: ScoreMode = "vanilla",
): number | null {
	if (score <= 0) return null;

	const data = load();
	// Sprint 7.2 — all new writes are v3 physics scores. v2 scores live at
	// the pre-7.2 key (no version suffix) and are never written to again.
	const key = makeKey(seed, mode, 3);
	const legacyKey = makeKey(seed, mode, 2);
	// Sprint 5.5 first-write migration (legacy `${seed}` → `${seed}-vanilla`)
	// still applies — scope it to the v2 legacy key so it doesn't stomp the
	// v3 bucket. Idempotent — subsequent calls no-op.
	if (mode === "vanilla" && data[String(seed)] && !data[legacyKey]) {
		data[legacyKey] = data[String(seed)];
		delete data[String(seed)];
	}
	const entries = data[key] ?? [];

	const entry: LeaderboardEntry = {
		score,
		date: new Date().toISOString().slice(0, 10),
		...(time !== undefined ? { time } : {}),
	};

	entries.push(entry);
	entries.sort((a, b) => b.score - a.score);
	data[key] = entries.slice(0, MAX_ENTRIES_PER_SEED);
	save(data);

	const rank = data[key].findIndex((e) => e === entry);
	return rank >= 0 ? rank + 1 : null;
}

/** Get the best (fastest) successful landing time for a seed, in seconds. */
export function getBestTime(
	seed: number,
	mode: ScoreMode = "vanilla",
): number | undefined {
	const entries = getScores(seed, mode);
	let best: number | undefined;
	for (const e of entries) {
		if (e.time !== undefined && (best === undefined || e.time < best)) {
			best = e.time;
		}
	}
	return best;
}

/** Get top scores for a seed */
export function getScores(
	seed: number,
	mode: ScoreMode = "vanilla",
): LeaderboardEntry[] {
	return getEntries(load(), seed, mode);
}

/** Get the best score for a seed (for mission select display) */
export function getBestScore(
	seed: number,
	mode: ScoreMode = "vanilla",
): number | undefined {
	const entries = getScores(seed, mode);
	return entries.length > 0 ? entries[0].score : undefined;
}
