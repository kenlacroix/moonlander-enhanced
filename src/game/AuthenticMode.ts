import { getTerrainHeightAt } from "./Physics";
import type { LanderState } from "./Lander";
import type { InputState } from "../systems/Input";
import type { TerrainData } from "./Terrain";
import type { Mission } from "./Missions";
import { isHistoricMission } from "./HistoricMission";

export const ALARM_SEED_MULT = 31;
export const ALARM_SEED_MOD = 300;
export const ALARM_SEED_OFFSET = 200;
export const ALARM_LOCKOUT_FRAMES = 24;
export const ALTITUDE_ALARM_GATE_PX = 150;
export const ALTITUDE_BLACKOUT_AGL_PX = 50;
export const ELLIPSE_UPDATE_FRAMES = 15;
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

export interface EllipseState {
	lastUpdateFrame: number;
	touchdown: { x: number; y: number } | null;
}

export interface AuthenticState {
	era: AuthenticEra;
	alarm?: AlarmState;
	masterAlarm?: MasterAlarmState;
	ellipse?: EllipseState;
	hazardMask?: Uint8Array;
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

	if (era === "artemis") {
		state.ellipse = { lastUpdateFrame: -1, touchdown: null };
	}

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

export function loadAuthenticPreference(missionId: number): boolean {
	try {
		const raw = localStorage.getItem(`${AUTHENTIC_KEY_PREFIX}${missionId}`);
		return raw === "1";
	} catch {
		return false;
	}
}

export function saveAuthenticPreference(
	missionId: number,
	on: boolean,
): void {
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
