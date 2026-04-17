import type { Mission } from "./Missions";

/**
 * Verified historical/projected facts shown in the briefing UI and fed to
 * the LLM as locked context. The LLM is prompted to use only these
 * numbers/names/dates so it can stylize without hallucinating.
 *
 * Keeping this strict: every field is required so every mission's offline
 * fallback briefing renders the same shape.
 */
export interface MissionFacts {
	craftName: string; // "Eagle", "Falcon", "Challenger", "Starship HLS"
	date: string; // "1969-07-20" or projected like "2028-Q3"
	commander: string;
	lmPilot?: string; // pilot of the lander itself; omitted for solo or auto-landing
	cmPilot?: string; // command-module pilot left in orbit; omitted for missions without one
	landingSite: string; // "Sea of Tranquility"
	coordinates: string; // "0.67°N 23.47°E"
	descentStartAltitudeM: number; // meters above the surface at powered-descent start
	notableMoment: string; // one-line "the story everyone tells"
	historicalReferenceLabel: string; // for share card: e.g. "Armstrong fuel margin"
	historicalReferenceValue: number; // numeric value the player tries to match
	historicalReferenceUnit: string; // "seconds", "m/s", etc.
	/**
	 * One-sentence era-tech note used by Authentic Mode briefings. Sets
	 * the scene for the tech-era constraint the Authentic mechanics are
	 * dramatizing (e.g. "Eagle's 2KB guidance computer carried the crew
	 * down while Armstrong hunted for a boulder-free landing site in real
	 * time."). Optional — missions without it skip era framing.
	 */
	eraOneLiner?: string;
}

/**
 * A historic mission moment that unlocks an Achievement when met. Each
 * declares the achievement id (which must exist in the static Achievements
 * registry) and a predicate evaluated at landing time. Predicates run on
 * the same lander+telemetry data the rest of the game scoring sees.
 */
export interface MissionMoment {
	achievementId: string;
	check: (state: MomentCheckState) => boolean;
}

export interface MomentCheckState {
	landed: boolean;
	fuelRemaining: number;
	startingFuel: number;
	flightDurationSec: number;
	finalVerticalSpeed: number;
	finalHorizontalSpeed: number;
	finalAngleDeg: number;
	landedOnPad: boolean;
}

/**
 * Discriminated union over mission types. Compile-time safety prevents
 * "Apollo 13 missing moments[]" or "Luna 9 missing autopilotProfile"
 * bugs that a flat record with optional fields would allow.
 */
export type HistoricMissionKind = "landing" | "survive" | "auto-landing";

interface BaseHistoricMission extends Mission {
	era: "1960s-soviet" | "1960s-70s-apollo" | "2020s-artemis";
	facts: MissionFacts;
}

export interface LandingMission extends BaseHistoricMission {
	kind: "landing";
	moments: MissionMoment[];
}

export interface SurviveMission extends BaseHistoricMission {
	kind: "survive";
	// Loop-around / non-landing return-trajectory mission. Part B will
	// add scoring fields here (target altitude + earth-intercept window).
	// Stubbed in Part A so the type union is complete.
}

export interface AutoLandingMission extends BaseHistoricMission {
	kind: "auto-landing";
	// Spectator mission. Autopilot drives. Part B will add the descent
	// profile config; stubbed here so missionMode routing compiles.
}

export type HistoricMission =
	| LandingMission
	| SurviveMission
	| AutoLandingMission;

/** Type guard: a Mission is a HistoricMission if it has a `kind` field. */
export function isHistoricMission(m: Mission): m is HistoricMission {
	return "kind" in m;
}
