import type { LandingMission } from "../game/HistoricMission";

/**
 * Apollo landings (Part A). Apollo 13 "Survive" lands in Part B.
 *
 * Seeds are fixed for shareability + leaderboard determinism. Numbers
 * cited in `facts` come from NASA mission summaries; Wikipedia's Apollo
 * missions pages are good cross-references.
 *
 * `historicalReferenceValue` is the numeric the share-card compares
 * against. Player's value is computed at landing and rendered next to
 * this value as the "margin vs Armstrong" hook.
 */
export const APOLLO_MISSIONS: LandingMission[] = [
	{
		id: 511,
		name: "APOLLO 11 — TRANQUILITY",
		seed: 11_1969,
		description: "Sea of Tranquility, July 20 1969. Land like Armstrong.",
		kind: "landing",
		era: "1960s-70s-apollo",
		difficulty: {
			landerType: "apollo-lm",
			startingFuel: 800,
			spawnY: 90,
			padMinWidth: 80,
			padMaxWidth: 110,
			padCount: 1,
		},
		facts: {
			craftName: "Eagle",
			date: "1969-07-20",
			commander: "Neil Armstrong",
			lmPilot: "Buzz Aldrin",
			cmPilot: "Michael Collins",
			landingSite: "Sea of Tranquility",
			coordinates: "0.67°N 23.47°E",
			descentStartAltitudeM: 15240,
			notableMoment:
				"Manual descent past a boulder field. Touchdown with ~20 seconds of fuel remaining.",
			historicalReferenceLabel: "Armstrong fuel margin",
			historicalReferenceValue: 22,
			historicalReferenceUnit: "seconds",
		},
		moments: [
			{
				achievementId: "apollo-11-margin",
				check: ({ landed, landedOnPad, fuelRemaining, startingFuel }) => {
					if (!landed || !landedOnPad) return false;
					// Fuel margin = remaining / starting. ~3% mirrors Armstrong's
					// famous tight-margin landing. Tighter than that = unlocked.
					return fuelRemaining / startingFuel < 0.03;
				},
			},
			{
				achievementId: "apollo-11-clean",
				check: ({ landed, landedOnPad, finalVerticalSpeed, finalAngleDeg }) =>
					landed &&
					landedOnPad &&
					Math.abs(finalVerticalSpeed) < 1 &&
					Math.abs(finalAngleDeg) < 3,
			},
		],
	},
	{
		id: 515,
		name: "APOLLO 15 — HADLEY RILLE",
		seed: 15_1971,
		description: "Hadley Rille at the foot of the Apennines. Watch the canyon.",
		kind: "landing",
		era: "1960s-70s-apollo",
		difficulty: {
			landerType: "apollo-lm",
			startingFuel: 1100,
			spawnY: 100,
			padMinWidth: 70,
			padMaxWidth: 100,
			padCount: 1,
			specialFeature: "rille",
		},
		facts: {
			craftName: "Falcon",
			date: "1971-07-30",
			commander: "David Scott",
			lmPilot: "James Irwin",
			cmPilot: "Alfred Worden",
			landingSite: "Hadley Rille / Apennine Mountains",
			coordinates: "26.13°N 3.63°E",
			descentStartAltitudeM: 15240,
			notableMoment:
				"First J-mission with extended LM fuel and the Lunar Roving Vehicle. Landing site is a winding rille canyon.",
			historicalReferenceLabel: "Scott descent precision",
			historicalReferenceValue: 5,
			historicalReferenceUnit: "m drift",
		},
		moments: [
			{
				achievementId: "hadley-rille",
				check: ({ landed, landedOnPad }) => landed && landedOnPad,
			},
		],
	},
	{
		id: 517,
		name: "APOLLO 17 — TAURUS-LITTROW",
		seed: 17_1972,
		description: "Final Apollo landing. Valley between two mountain massifs.",
		kind: "landing",
		era: "1960s-70s-apollo",
		difficulty: {
			landerType: "apollo-lm",
			startingFuel: 1100,
			spawnY: 95,
			padMinWidth: 70,
			padMaxWidth: 100,
			padCount: 1,
			specialFeature: "valley",
		},
		facts: {
			craftName: "Challenger",
			date: "1972-12-11",
			commander: "Eugene Cernan",
			lmPilot: "Harrison Schmitt",
			cmPilot: "Ronald Evans",
			landingSite: "Taurus-Littrow Valley",
			coordinates: "20.19°N 30.77°E",
			descentStartAltitudeM: 15240,
			notableMoment:
				"Last humans on the Moon. Schmitt was the only geologist in the Apollo crews.",
			historicalReferenceLabel: "Cernan descent time",
			historicalReferenceValue: 12,
			historicalReferenceUnit: "min",
		},
		moments: [
			{
				achievementId: "taurus-littrow",
				check: ({ landed, landedOnPad }) => landed && landedOnPad,
			},
		],
	},
];
