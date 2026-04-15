const STORAGE_KEY = "moonlander-leaderboard";
const MAX_ENTRIES_PER_SEED = 5;

export interface LeaderboardEntry {
	score: number;
	date: string; // ISO date string
	time?: number; // seconds from spawn to landing (successful runs only)
}

type LeaderboardData = Record<string, LeaderboardEntry[]>;

function load(): LeaderboardData {
	try {
		const data = localStorage.getItem(STORAGE_KEY);
		if (data) return JSON.parse(data) as LeaderboardData;
	} catch {
		// localStorage unavailable
	}
	return {};
}

function save(data: LeaderboardData): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
	} catch {
		// localStorage unavailable
	}
}

/** Add a score for a seed. Returns the rank (1-based) or null if it didn't make the board. */
export function addScore(
	seed: number,
	score: number,
	time?: number,
): number | null {
	if (score <= 0) return null;

	const data = load();
	const key = String(seed);
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
export function getBestTime(seed: number): number | undefined {
	const entries = getScores(seed);
	let best: number | undefined;
	for (const e of entries) {
		if (e.time !== undefined && (best === undefined || e.time < best)) {
			best = e.time;
		}
	}
	return best;
}

/** Get top scores for a seed */
export function getScores(seed: number): LeaderboardEntry[] {
	const data = load();
	return data[String(seed)] ?? [];
}

/** Get the best score for a seed (for mission select display) */
export function getBestScore(seed: number): number | undefined {
	const entries = getScores(seed);
	return entries.length > 0 ? entries[0].score : undefined;
}
