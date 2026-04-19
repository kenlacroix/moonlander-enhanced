import type { LandingMission } from "../game/HistoricMission";

/**
 * Projected Artemis missions. Numbers and crew are NASA's announced
 * targets as of mid-2020s; treat as projected, not historical.
 */
export const ARTEMIS_MISSIONS: LandingMission[] = [
	{
		id: 5103,
		name: "ARTEMIS III — SHACKLETON",
		seed: 3_2028,
		description:
			"South polar landing near Shackleton crater. Permanent shadows, harsh slopes.",
		kind: "landing",
		era: "2020s-artemis",
		sunAngle: 85,
		// Sprint 7.1 — mesa archetype: Shackleton's rim is a raised-
		// plateau environment, terrain-wise. Polar palette: cold blue-grey
		// shadow terrain under polar-midnight sky (grazing sun at 85°
		// leaves most of the scene in low-angle reflection, not direct
		// light). 2x starfield density since the polar sky is clearer.
		palette: {
			terrain: "#4a5058",
			terrainEdge: "#6a7078",
			sky: "#020a14",
			starDensity: 2.0,
			starTint: "#e0e8ff",
		},
		difficulty: {
			landerType: "artemis-lm",
			startingFuel: 1300,
			spawnY: 110,
			padMinWidth: 65,
			padMaxWidth: 95,
			padCount: 1,
			roughness: 0.55,
			archetype: "mesa",
		},
		facts: {
			craftName: "Starship HLS",
			date: "2028 (projected)",
			commander: "TBD",
			lmPilot: "TBD",
			landingSite: "South polar region (Shackleton crater rim)",
			coordinates: "~89.9°S",
			descentStartAltitudeM: 18000,
			notableMoment:
				"First crewed lunar landing since Apollo 17. Targeting permanently shadowed regions to look for water ice.",
			historicalReferenceLabel: "Shackleton rim accuracy",
			historicalReferenceValue: 100,
			historicalReferenceUnit: "m drift",
			eraOneLiner:
				"Starship HLS brings orbital LRO hazard maps, GPS-class positioning, autonomous terrain-relative navigation, and digital continuous throttle — a 60-year leap from Apollo's AGC and discrete RCS bursts.",
		},
		moments: [
			{
				achievementId: "shackleton-rim",
				check: ({ landed, landedOnPad }) => landed && landedOnPad,
			},
		],
	},
];
