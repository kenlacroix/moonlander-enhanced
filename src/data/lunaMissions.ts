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
		// Sprint 7.1 — Oceanus Procellarum is a maria, historically smooth,
		// but pocked with secondary craters. crater-field archetype plus
		// a darker austere grey palette evokes the first-ever spacecraft
		// photos from Luna 9 (low-contrast, eerie).
		palette: {
			terrain: "#787878",
			terrainEdge: "#989898",
			sky: "#000000",
		},
		difficulty: {
			landerType: "luna-9",
			startingFuel: 500,
			// Sprint 7.2 Part 2 — luna-9 rcsMultiplier is 0.7 → natural default 70.
			// 80 is a small deliberate buffer for auto-landing. Luna 9 has a
			// fixed single seed (9_1966) so the claim is deterministic — if
			// the autopilot ever runs dry at 70 on this one seed it's a real
			// regression, not a random-seed edge case. Landing gate
			// (maxLandingAngularRate) intentionally NOT overridden — Luna 9
			// is auto-landed; the angular-rate gate is irrelevant either way.
			startingRCS: 80,
			spawnY: 100,
			padMinWidth: 90,
			padMaxWidth: 130,
			padCount: 1,
			roughness: 0.35,
			archetype: "crater-field",
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
