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
		difficulty: {
			landerType: "artemis-lm",
			startingFuel: 1300,
			spawnY: 110,
			padMinWidth: 65,
			padMaxWidth: 95,
			padCount: 1,
			roughness: 0.55,
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
