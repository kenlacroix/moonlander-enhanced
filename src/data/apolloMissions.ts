import type { LandingMission, SurviveMission } from "../game/HistoricMission";

/**
 * Apollo landings + Apollo 13's non-landing "survive" mission.
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
		sunAngle: 20,
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
			eraOneLiner:
				"Eagle's 2KB guidance computer carried the crew down while Armstrong hunted for a boulder-free landing site in real time, juggling a 1202 executive overflow 10,000 feet up.",
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
		sunAngle: 40,
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
			eraOneLiner:
				"J-mission Falcon flew a steeper descent with an upgraded guidance computer — still analog instruments, still discrete RCS thrusters, still no hazard avoidance.",
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
		sunAngle: 65,
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
			eraOneLiner:
				"Last humans on the Moon flew the same 1960s guidance stack Apollo 11 used — Schmitt calling out instruments while Cernan wrestled a boulder-strewn valley.",
		},
		moments: [
			{
				achievementId: "taurus-littrow",
				check: ({ landed, landedOnPad }) => landed && landedOnPad,
			},
		],
	},
];

/**
 * Apollo 13 — the "survive" mission. O2 tank ruptured en route; the crew
 * used the LM as a lifeboat and slingshot around the Moon back to Earth.
 * In-game this is modeled as "stay flying (don't crash, don't run out of
 * control) for a target duration" — a highly compressed stand-in for the
 * real 87-hour return trajectory. `survivalDurationSec` is the target;
 * `MAX_FLIGHT_DURATION` is the hard upper bound.
 */
export const APOLLO_13: SurviveMission = {
	id: 513,
	name: "APOLLO 13 — AQUARIUS LIFEBOAT",
	seed: 13_1970,
	description: "Oxygen tank blew. Don't land — just get home alive.",
	kind: "survive",
	era: "1960s-70s-apollo",
	survivalDurationSec: 90,
	difficulty: {
		landerType: "apollo-lm",
		startingFuel: 700,
		spawnY: 60,
		// No pad required — but the terrain engine still generates them;
		// these values only matter for the very unlikely case the player
		// manually lands. Narrow pads discourage treating this as a
		// landing mission.
		padMinWidth: 40,
		padMaxWidth: 60,
		padCount: 1,
	},
	facts: {
		craftName: "Aquarius (LM) / Odyssey (CM)",
		date: "1970-04-11",
		commander: "Jim Lovell",
		lmPilot: "Fred Haise",
		cmPilot: "Jack Swigert",
		landingSite: "Never landed — free-return trajectory around the Moon",
		coordinates: "N/A (loop-around)",
		descentStartAltitudeM: 0,
		notableMoment:
			"Oxygen tank ruptured en route. Crew used the LM as a lifeboat and slingshot around the Moon back to Earth.",
		historicalReferenceLabel: "Lovell survival duration",
		historicalReferenceValue: 87,
		historicalReferenceUnit: "hours",
		eraOneLiner:
			"Aquarius' descent engine, designed for a 12-minute landing burn, became a 14-hour life-support burn to bend the crew's trajectory back to Earth.",
	},
};
