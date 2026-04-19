import type { AutoLandingMission } from "../game/HistoricMission";

/**
 * Soviet Luna program missions. Luna 9 (1966) was the first spacecraft
 * of any nation to achieve a soft landing on another celestial body and
 * the first to transmit photographs from the lunar surface.
 *
 * These are `kind: "auto-landing"` — the player spectates while the
 * built-in autopilot flies the descent. The "1960s-soviet" era slot is
 * defined here for the first time; later Luna/Soviet missions (Luna 13,
 * Luna 16, etc.) would extend this list.
 */
export const LUNA_MISSIONS: AutoLandingMission[] = [
	{
		id: 6109,
		name: "LUNA 9 — OCEAN OF STORMS",
		seed: 9_1966,
		description:
			"First-ever soft landing on another celestial body. Watch the autopilot fly.",
		kind: "auto-landing",
		era: "1960s-soviet",
		sunAngle: -25,
		difficulty: {
			landerType: "luna-9",
			startingFuel: 500,
			spawnY: 100,
			padMinWidth: 90,
			padMaxWidth: 130,
			padCount: 1,
			roughness: 0.35,
		},
		facts: {
			craftName: "Luna 9",
			date: "1966-02-03",
			commander: "Automated (Soviet ground control)",
			landingSite: "Oceanus Procellarum (Ocean of Storms)",
			coordinates: "7.08°N 64.37°W",
			descentStartAltitudeM: 8500,
			notableMoment:
				"First successful soft landing on the Moon. Transmitted the first photographs from the lunar surface hours after touchdown.",
			historicalReferenceLabel: "Luna 9 descent duration",
			historicalReferenceValue: 75,
			historicalReferenceUnit: "seconds",
			eraOneLiner:
				"No crew, no guidance computer on board — Luna 9 navigated via an airbag-cushioned descent and a ground-station radio tether, eight months before the first Surveyor.",
		},
	},
];
