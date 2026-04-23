import type { InputState } from "../systems/Input";
import { isHistoricMission } from "./HistoricMission";
import type { LanderState } from "./Lander";
import type { Mission } from "./Missions";
import { getTerrainHeightAt } from "./Physics";
import type { TerrainData } from "./Terrain";

export const ALARM_SEED_MULT = 31;
export const ALARM_SEED_MOD = 300;
export const ALARM_SEED_OFFSET = 200;
export const ALARM_LOCKOUT_FRAMES = 24;
export const ALTITUDE_ALARM_GATE_PX = 150;
export const ALTITUDE_BLACKOUT_AGL_PX = 50;
export const MASTER_ALARM_GATE_PX = 150;

export const ERA_COLORS = {
	APOLLO_AMBER: "#ffb000",
	ARTEMIS_CYAN: "#00ccff",
	HAZARD_RED: "#ff3030",
} as const;

export type AuthenticEra = "apollo" | "artemis";

export interface AlarmState {
	state: "IDLE" | "ARMED" | "ACTIVE" | "DONE";
	framesElapsed: number;
	scheduledFrame: number;
}

export interface MasterAlarmState {
	state: "IDLE" | "DONE";
}

export interface AuthenticState {
	era: AuthenticEra;
	alarm?: AlarmState;
	masterAlarm?: MasterAlarmState;
	/**
	 * One-shot HUD banner state. Set on first frame the lander drops below
	 * the AGL blackout threshold; counts down so the message disappears on
	 * its own. Lives on AuthenticState (not HUD) so it resets automatically
	 * via buildAuthenticState on flight start.
	 */
	lowAltMessage: { shown: boolean; framesRemaining: number };
}

export interface FlightConfig {
	authenticMode: boolean;
	authenticState: AuthenticState | null;
}

const APOLLO_11_ID = 511;

function eraFor(mission: Mission): AuthenticEra | null {
	if (!isHistoricMission(mission)) return null;
	if (mission.era === "2020s-artemis") return "artemis";
	if (mission.era === "1960s-70s-apollo") return "apollo";
	return null;
}

export function buildAuthenticState(
	mission: Mission,
	seed: number,
	isHeadless: boolean,
): AuthenticState | null {
	if (isHeadless) return null;
	const era = eraFor(mission);
	if (era === null) return null;

	const state: AuthenticState = {
		era,
		lowAltMessage: { shown: false, framesRemaining: 0 },
	};

	if (era === "apollo" && mission.id === APOLLO_11_ID) {
		state.alarm = {
			state: "ARMED",
			framesElapsed: 0,
			scheduledFrame:
				((Math.abs(seed) * ALARM_SEED_MULT) % ALARM_SEED_MOD) +
				ALARM_SEED_OFFSET,
		};
	}

	if (era === "apollo" && mission.id !== APOLLO_11_ID) {
		state.masterAlarm = { state: "IDLE" };
	}

	// Artemis-era landing ellipse scaffolding was never wired to a
	// renderer; removed in v0.6.0.0 polish pass. If a future sprint
	// brings back per-era visual features, the hook is a new optional
	// field on AuthenticState, populated here conditionally on era.

	return state;
}

export function applyAuthenticFilter(
	input: InputState,
	state: AuthenticState | null,
): InputState {
	if (state === null) return input;
	if (state.alarm?.state === "ACTIVE") {
		return { ...input, thrustUp: false };
	}
	return input;
}

/**
 * Sprint 7.2 Part 2 — per-era multiplier on the angular-rate landing gate.
 * Apollo LM RCS deadband was ~4°/s real-world; multiplying the Vanilla 8°/s
 * gate by 0.5 hits that exactly. Artemis modern hazard ellipse implies
 * precision but not Apollo-tight; 0.625 → 5°/s base. Luna 9 is auto-landing
 * so the gate is irrelevant — multiplier is 1.0 for safety.
 *
 * Per-mission tuning may have already lowered the Vanilla base (e.g. Apollo
 * 11 = 6°/s). Authentic multiplier composes: 6 × 0.5 = 3°/s on Apollo 11
 * Authentic. Plan acknowledges Apollo 15/17 Authentic at 3.5°/s is below
 * autopilot per-tick granularity (~4.3°/s) — those missions are pilot-only
 * in Authentic mode by design.
 */
export const AUTHENTIC_ANGULAR_RATE_MULTIPLIER: Record<
	"1960s-soviet" | "1960s-70s-apollo" | "2020s-artemis",
	number
> = {
	"1960s-soviet": 1.0,
	"1960s-70s-apollo": 0.5,
	"2020s-artemis": 0.625,
};

/**
 * Sprint 7.2 Part 2 — apply per-era authentic multiplier to a freshly-spawned
 * lander's landing-rate gate. Called by Game.ts after createLander, only for
 * historic missions in Authentic mode.
 *
 * Takes the era string primitive (not Mission) so callers without a Mission
 * object (GhostPlayer, future tests) can use it without dragging the mission
 * registry along. Pass undefined era for non-historic missions to no-op.
 *
 * Mutates lander in place. Idempotent only if called once per spawn — calling
 * twice would compose multipliers (don't).
 */
export function applyAuthenticPhysics(
	lander: LanderState,
	era: "1960s-soviet" | "1960s-70s-apollo" | "2020s-artemis" | undefined,
	authenticMode: boolean,
): void {
	if (!authenticMode || era === undefined) return;
	// Fallback to 1.0 (no-op) if a future era is added without a multiplier
	// entry. Without the `?? 1.0`, `lander.maxLandingAngularRate *= undefined`
	// would produce NaN and turn every landing into a silent SPINNING crash.
	const mult = AUTHENTIC_ANGULAR_RATE_MULTIPLIER[era] ?? 1.0;
	lander.maxLandingAngularRate *= mult;
}

/**
 * Event fired by updateAuthentic when the state machine transitions. Game
 * uses this to dispatch one-shot audio / HUD effects without polling the
 * state every tick (which would fire the alarm tone 24 times in a row).
 */
export type AuthenticTransition =
	| "alarm-fired"
	| "alarm-skipped"
	| "alarm-ended"
	| "master-alarm-fired"
	| null;

/**
 * Tick the Authentic state machine one physics frame. Called from
 * Game.onFixedUpdate BEFORE applyAuthenticFilter so ARMED → ACTIVE
 * transitions inject into the filter on the very frame the alarm starts.
 *
 * Returns a transition event for the caller to react to (audio, HUD
 * flash), or null if nothing changed state.
 *
 * Mutates `state` in place so the caller doesn't have to reassign. Pure
 * function otherwise — no global state, no allocations in the hot path
 * when no transition occurs.
 */
export function updateAuthentic(
	state: AuthenticState | null,
	lander: LanderState,
	terrain: TerrainData | null,
): AuthenticTransition {
	if (state === null) return null;

	// Apollo 11 1202 program alarm state machine.
	if (state.alarm) {
		const a = state.alarm;
		if (a.state === "ARMED") {
			if (a.framesElapsed >= a.scheduledFrame) {
				// Reached scheduled frame — gate-check AGL. Above gate: fire.
				// At or below: skip entirely (fast descenders get lucky).
				const aboveGate = terrain
					? getTerrainHeightAt(lander.x, terrain.points) - lander.y >
						ALTITUDE_ALARM_GATE_PX
					: true; // No terrain fallback: fire (matches plan intent)
				if (aboveGate) {
					a.state = "ACTIVE";
					a.framesElapsed = 0;
					return "alarm-fired";
				}
				a.state = "DONE";
				return "alarm-skipped";
			}
			a.framesElapsed += 1;
		} else if (a.state === "ACTIVE") {
			if (a.framesElapsed >= ALARM_LOCKOUT_FRAMES) {
				a.state = "DONE";
				return "alarm-ended";
			}
			a.framesElapsed += 1;
		}
	}

	// Apollo 15/17 MASTER ALARM — altitude-gated single fire, audio only.
	if (state.masterAlarm && state.masterAlarm.state === "IDLE" && terrain) {
		const agl = getTerrainHeightAt(lander.x, terrain.points) - lander.y;
		if (agl > 0 && agl < MASTER_ALARM_GATE_PX) {
			state.masterAlarm.state = "DONE";
			return "master-alarm-fired";
		}
	}

	return null;
}

export function isAltitudeBlackedOut(
	state: AuthenticState | null,
	lander: LanderState,
	terrain: TerrainData | null,
): boolean {
	if (state === null) return false;
	if (state.era !== "apollo") return false;
	if (!terrain) return false;
	const terrainY = getTerrainHeightAt(lander.x, terrain.points);
	const aglPx = terrainY - lander.y;
	return aglPx > 0 && aglPx < ALTITUDE_BLACKOUT_AGL_PX;
}

export function captionFor(state: AuthenticState | null): {
	text: string;
	color: string;
} | null {
	if (state === null) return null;
	if (state.era === "apollo") {
		return { text: "AUTHENTIC 1969 TECH", color: ERA_COLORS.APOLLO_AMBER };
	}
	return { text: "AUTHENTIC 2028 TECH", color: ERA_COLORS.ARTEMIS_CYAN };
}

const AUTHENTIC_KEY_PREFIX = "moonlander-authentic-";
const INTRO_SEEN_PREFIX = "moonlander-authentic-intro-seen-";
export const TUTORIAL_FRAMES = 180; // 3s at 60fps

export function hasSeenAuthenticIntro(missionId: number): boolean {
	try {
		return localStorage.getItem(`${INTRO_SEEN_PREFIX}${missionId}`) === "1";
	} catch {
		return true; // localStorage unavailable — suppress the overlay so
		// we don't spam players who can't persist the dismiss.
	}
}

export function markAuthenticIntroSeen(missionId: number): void {
	try {
		localStorage.setItem(`${INTRO_SEEN_PREFIX}${missionId}`, "1");
	} catch {
		// ignore
	}
}

export function loadAuthenticPreference(missionId: number): boolean {
	try {
		const raw = localStorage.getItem(`${AUTHENTIC_KEY_PREFIX}${missionId}`);
		return raw === "1";
	} catch {
		return false;
	}
}

export function saveAuthenticPreference(missionId: number, on: boolean): void {
	try {
		if (on) {
			localStorage.setItem(`${AUTHENTIC_KEY_PREFIX}${missionId}`, "1");
		} else {
			localStorage.removeItem(`${AUTHENTIC_KEY_PREFIX}${missionId}`);
		}
	} catch {
		// localStorage unavailable (private mode, quota) — preference won't
		// persist but current-session toggle still works via caller read.
	}
}
