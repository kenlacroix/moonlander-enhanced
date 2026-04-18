const STORAGE_KEY = "moonlander-leaderboard";
const MAX_ENTRIES_PER_SEED = 5;

/**
 * Sprint 5.5 — records key by `${seed}-${mode}` so Authentic runs and
 * vanilla runs don't overwrite each other's best scores. Pre-5.5 records
 * were keyed by `${seed}` alone; those are migrated lazily on first
 * read to `${seed}-vanilla`.
 */
export type ScoreMode = "vanilla" | "authentic";

export interface LeaderboardEntry {
	score: number;
	date: string; // ISO date string
	time?: number; // seconds from spawn to landing (successful runs only)
}

type LeaderboardData = Record<string, LeaderboardEntry[]>;

function makeKey(seed: number, mode: ScoreMode): string {
	return `${seed}-${mode}`;
}

/**
 * Read one seed-scoped record slot. Handles the 5.5 migration: if the
 * vanilla key is missing but the legacy `${seed}` key exists, treat the
 * legacy entry as vanilla. Pure read — doesn't write the migration back,
 * so a concurrent reader gets a consistent view. The rewrite happens on
 * the next addScore call for that seed.
 */
function getEntries(
	data: LeaderboardData,
	seed: number,
	mode: ScoreMode,
): LeaderboardEntry[] {
	const key = makeKey(seed, mode);
	if (data[key]) return data[key];
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
	const key = makeKey(seed, mode);
	// First-write migration: if we're about to write a vanilla record and
	// the legacy `${seed}` entry exists, seed the new slot with its entries
	// then drop the legacy key. Idempotent — subsequent calls no-op.
	if (mode === "vanilla" && data[String(seed)] && !data[key]) {
		data[key] = data[String(seed)];
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
