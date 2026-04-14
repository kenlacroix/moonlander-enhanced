/**
 * Multi-Lander Relay — land 3 landers sequentially on the same terrain.
 * Each spawns 100 units above the previous lander's final X position.
 * Combined score displayed after all 3.
 */

export interface RelayLander {
	x: number;
	y: number;
	status: "landed" | "crashed";
	score: number;
}

export interface RelayState {
	active: boolean;
	currentLander: number; // 1, 2, or 3
	landers: RelayLander[];
	totalScore: number;
}

const RELAY_LANDER_COUNT = 3;
const SPAWN_ALTITUDE_OFFSET = 100; // spawn this many units above final position

/** Create fresh relay state */
export function createRelayState(): RelayState {
	return {
		active: true,
		currentLander: 1,
		landers: [],
		totalScore: 0,
	};
}

/** Record a completed lander and check if relay continues */
export function recordRelayLander(
	relay: RelayState,
	x: number,
	y: number,
	status: "landed" | "crashed",
	score: number,
): boolean {
	relay.landers.push({ x, y, status, score });
	relay.totalScore += score;
	return relay.landers.length < RELAY_LANDER_COUNT;
}

/** Advance to next lander. Returns spawn position. */
export function advanceRelayLander(relay: RelayState): {
	spawnX: number;
	spawnY: number;
} {
	const last = relay.landers[relay.landers.length - 1];
	relay.currentLander++;
	return {
		spawnX: last.x,
		spawnY: Math.max(20, last.y - SPAWN_ALTITUDE_OFFSET),
	};
}

/** Check if relay is complete (all 3 landers done) */
export function isRelayComplete(relay: RelayState): boolean {
	return relay.landers.length >= RELAY_LANDER_COUNT;
}

/** Get relay HUD label */
export function getRelayLabel(relay: RelayState): string {
	return `LANDER ${relay.currentLander}/${RELAY_LANDER_COUNT}`;
}

/** Get relay summary for post-flight display */
export function getRelaySummary(relay: RelayState): string {
	const lines = relay.landers.map(
		(l, i) => `Lander ${i + 1}: ${l.status === "landed" ? l.score : "CRASHED"}`,
	);
	lines.push(`Total: ${relay.totalScore}`);
	return lines.join("  |  ");
}
