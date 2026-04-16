import { beforeEach, describe, expect, it } from "vitest";
import { APOLLO_MISSIONS } from "../src/data/apolloMissions";
import {
	checkLandingAchievements,
	type MissionMomentCheck,
} from "../src/systems/Achievements";

const noLocalStorage = (): void => {
	// Vitest jsdom provides localStorage; clear it between tests.
	try {
		localStorage.clear();
	} catch {
		// ignore
	}
};

const baseConditions = {
	landed: true,
	hSpeed: 0.1,
	angle: 0,
	fuelPercent: 50,
	thrustingLast3Seconds: false,
	aliensActive: false,
	campaignComplete: false,
	artifactsScanned: 0,
	artifactsTotal: 0,
};

describe("checkLandingAchievements — mission-scoped moments", () => {
	beforeEach(noLocalStorage);

	it("Apollo 11 fuel-margin moment unlocks at <3% fuel", () => {
		const a11 = APOLLO_MISSIONS.find((m) => m.name.includes("APOLLO 11"));
		if (!a11 || a11.kind !== "landing") throw new Error("Apollo 11 missing");
		const unlocked = new Set<string>();
		const newBadges = checkLandingAchievements(unlocked, baseConditions, {
			moments: a11.moments,
			state: {
				landed: true,
				fuelRemaining: 20,
				startingFuel: 800,
				flightDurationSec: 60,
				finalVerticalSpeed: 0.5,
				finalHorizontalSpeed: 0.1,
				finalAngleDeg: 1,
				landedOnPad: true,
			},
		});
		expect(newBadges.map((b) => b.id)).toContain("apollo-11-margin");
	});

	it("Apollo 11 fuel-margin moment does NOT unlock at 50% fuel", () => {
		const a11 = APOLLO_MISSIONS.find((m) => m.name.includes("APOLLO 11"));
		if (!a11 || a11.kind !== "landing") throw new Error("Apollo 11 missing");
		const unlocked = new Set<string>();
		const newBadges = checkLandingAchievements(unlocked, baseConditions, {
			moments: a11.moments,
			state: {
				landed: true,
				fuelRemaining: 400,
				startingFuel: 800,
				flightDurationSec: 60,
				finalVerticalSpeed: 0.5,
				finalHorizontalSpeed: 0.1,
				finalAngleDeg: 1,
				landedOnPad: true,
			},
		});
		expect(newBadges.map((b) => b.id)).not.toContain("apollo-11-margin");
	});

	// CRITICAL: this is the cross-mission scoping check. apollo-11-margin
	// must NOT unlock during a free-play run that happens to land tight.
	it("apollo-11-margin does NOT unlock when no missionMoments passed", () => {
		const unlocked = new Set<string>();
		const newBadges = checkLandingAchievements(unlocked, baseConditions);
		expect(newBadges.map((b) => b.id)).not.toContain("apollo-11-margin");
		expect(newBadges.map((b) => b.id)).not.toContain("hadley-rille");
		expect(newBadges.map((b) => b.id)).not.toContain("taurus-littrow");
		expect(newBadges.map((b) => b.id)).not.toContain("shackleton-rim");
	});

	it("apollo-11-margin does NOT unlock during Apollo 15 mission", () => {
		const a15 = APOLLO_MISSIONS.find((m) => m.name.includes("APOLLO 15"));
		if (!a15 || a15.kind !== "landing") throw new Error("Apollo 15 missing");
		const unlocked = new Set<string>();
		// Even with tight fuel margin, only Apollo 15's moments are checked
		// because we passed Apollo 15's moment list.
		const newBadges = checkLandingAchievements(unlocked, baseConditions, {
			moments: a15.moments,
			state: {
				landed: true,
				fuelRemaining: 20, // would unlock A11 margin if it were checked
				startingFuel: 800,
				flightDurationSec: 60,
				finalVerticalSpeed: 0.5,
				finalHorizontalSpeed: 0.1,
				finalAngleDeg: 1,
				landedOnPad: true,
			},
		});
		expect(newBadges.map((b) => b.id)).not.toContain("apollo-11-margin");
		// Apollo 15 declares hadley-rille on any safe landing.
		expect(newBadges.map((b) => b.id)).toContain("hadley-rille");
	});

	it("custom moment with falsy check does not unlock", () => {
		const unlocked = new Set<string>();
		const moments: MissionMomentCheck[] = [
			{
				achievementId: "apollo-11-margin",
				check: () => false,
			},
		];
		const newBadges = checkLandingAchievements(unlocked, baseConditions, {
			moments,
			state: {
				landed: true,
				fuelRemaining: 0,
				startingFuel: 1000,
				flightDurationSec: 60,
				finalVerticalSpeed: 0.5,
				finalHorizontalSpeed: 0.1,
				finalAngleDeg: 1,
				landedOnPad: true,
			},
		});
		expect(newBadges.map((b) => b.id)).not.toContain("apollo-11-margin");
	});
});
