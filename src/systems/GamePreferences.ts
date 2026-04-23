/**
 * Game-wide user preferences.
 *
 * v0.6.3.0 — Free Play Sandbox. After Sprint 7.2 shipped rigid-body physics
 * (rotation carries momentum, separate RCS propellant tank, angular-rate
 * landing gate), playtest feedback said Free Play felt noticeably harder.
 * This module exposes the physics version and the three Free Play hazards
 * (aliens, storms, fuel leaks) as user preferences, persisted to
 * localStorage. Campaign, Historic, and AI Theater ignore these — they
 * use their per-mission configuration.
 *
 * The pure `resolveFlightPolicy()` helper is the single gate that every
 * flight passes through. Called inside Game.reset() so no stateful
 * override fields live on Game itself.
 */

import type { Mission } from "../game/Missions";

const STORAGE_KEY = "moonlander-game-prefs";

export interface GamePreferences {
	/** true = rigid-body (v3), undefined/false = classic (v2). Default v2. */
	physicsV3?: boolean;
	/** Free Play alien spawns. Default false. */
	aliens?: boolean;
	/** Free Play gravity storms. Default false. */
	storms?: boolean;
	/** Free Play fuel leaks. Default false. */
	fuelLeaks?: boolean;
}

/**
 * Resolved per-flight policy. Every flight gets one of these at reset()
 * time. The physics version applies to the lander; the hazard booleans
 * gate random-spawn at the call site in Game.reset (campaign missions
 * with their own DifficultyConfig.aliensEnabled / gravityStormsEnabled
 * still force through on top).
 */
export interface FlightPolicy {
	physicsVersion: 2 | 3;
	aliens: boolean;
	storms: boolean;
	fuelLeaks: boolean;
}

export type GameMode = "freeplay" | "campaign" | "ai-theater" | "historic";

/** Load preferences from localStorage. Defensive: returns empty object on
 * missing key, malformed JSON, or localStorage throwing (private mode). */
export function loadGamePreferences(): GamePreferences {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return {};
		const parsed = JSON.parse(raw);
		if (!parsed || typeof parsed !== "object") return {};
		return parsed as GamePreferences;
	} catch {
		return {};
	}
}

/** Persist preferences. Silent failure on localStorage unavailable —
 * session-local toggle still works in memory via the caller's own state. */
export function saveGamePreferences(prefs: GamePreferences): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
	} catch {
		// Private mode, quota, etc. Swallow.
	}
}

/**
 * Compute the flight policy for a given game mode + mission + prefs.
 *
 * Policy table:
 *
 * | gameMode    | physicsVersion                          | hazards              |
 * |-------------|-----------------------------------------|----------------------|
 * | historic    | always 3                                | always all-true      |
 * | ai-theater  | always 3                                | always all-true      |
 * | campaign    | mission.difficulty.physicsVersion ?? 3  | always all-true *    |
 * | freeplay    | prefs.physicsV3 ? 3 : 2                 | per-pref, default F  |
 *
 * * Campaign hazards flagged true here so spawn gating passes; per-mission
 *   `DifficultyConfig.aliensEnabled` / `gravityStormsEnabled` still force
 *   actual spawn or suppress at the Game.reset() call site.
 *
 * Pure function — no side effects. All inputs passed in explicitly so
 * tests can exercise every branch without a Game instance.
 */
export function resolveFlightPolicy(
	gameMode: GameMode,
	mission: Mission | null,
	prefs: GamePreferences,
): FlightPolicy {
	if (gameMode === "historic" || gameMode === "ai-theater") {
		return { physicsVersion: 3, aliens: true, storms: true, fuelLeaks: true };
	}
	if (gameMode === "campaign") {
		return {
			physicsVersion: mission?.difficulty?.physicsVersion ?? 3,
			aliens: true,
			storms: true,
			fuelLeaks: true,
		};
	}
	// freeplay
	return {
		physicsVersion: prefs.physicsV3 ? 3 : 2,
		aliens: prefs.aliens ?? false,
		storms: prefs.storms ?? false,
		fuelLeaks: prefs.fuelLeaks ?? false,
	};
}
