import { describe, expect, it } from "vitest";
import {
	checkLandingAchievements,
	getAchievementCount,
	getAllAchievements,
	unlockAchievement,
} from "../src/systems/Achievements";

function baseConditions() {
	return {
		landed: true,
		hSpeed: 0,
		angle: 0,
		fuelPercent: 50,
		thrustingLast3Seconds: true,
		aliensActive: false,
		campaignComplete: false,
		artifactsScanned: 0,
		artifactsTotal: 0,
	};
}

describe("unlockAchievement", () => {
	it("unlocks a new achievement", () => {
		const unlocked = new Set<string>();
		const result = unlockAchievement(unlocked, "first-landing");
		expect(result).not.toBeNull();
		expect(result!.id).toBe("first-landing");
		expect(unlocked.has("first-landing")).toBe(true);
	});

	it("returns null for already unlocked", () => {
		const unlocked = new Set(["first-landing"]);
		expect(unlockAchievement(unlocked, "first-landing")).toBeNull();
	});

	it("returns null for unknown achievement", () => {
		const unlocked = new Set<string>();
		expect(unlockAchievement(unlocked, "nonexistent")).toBeNull();
	});
});

describe("checkLandingAchievements", () => {
	it("unlocks first-landing on any successful landing", () => {
		const unlocked = new Set<string>();
		const badges = checkLandingAchievements(unlocked, baseConditions());
		expect(badges.some((b) => b.id === "first-landing")).toBe(true);
	});

	it("does not unlock on crash", () => {
		const unlocked = new Set<string>();
		const badges = checkLandingAchievements(unlocked, {
			...baseConditions(),
			landed: false,
		});
		expect(badges).toHaveLength(0);
	});

	it("unlocks perfect-landing with low speed and angle", () => {
		const unlocked = new Set<string>();
		const badges = checkLandingAchievements(unlocked, {
			...baseConditions(),
			hSpeed: 0.1,
			angle: 1,
		});
		expect(badges.some((b) => b.id === "perfect-landing")).toBe(true);
	});

	it("does not unlock perfect-landing with high angle", () => {
		const unlocked = new Set<string>();
		const badges = checkLandingAchievements(unlocked, {
			...baseConditions(),
			hSpeed: 0,
			angle: 5,
		});
		expect(badges.some((b) => b.id === "perfect-landing")).toBe(false);
	});

	it("unlocks no-thrust when not thrusting", () => {
		const unlocked = new Set<string>();
		const badges = checkLandingAchievements(unlocked, {
			...baseConditions(),
			thrustingLast3Seconds: false,
		});
		expect(badges.some((b) => b.id === "no-thrust")).toBe(true);
	});

	it("unlocks fuel-miser with > 80% fuel", () => {
		const unlocked = new Set<string>();
		const badges = checkLandingAchievements(unlocked, {
			...baseConditions(),
			fuelPercent: 85,
		});
		expect(badges.some((b) => b.id === "fuel-miser")).toBe(true);
	});

	it("unlocks survive-aliens when aliens are active", () => {
		const unlocked = new Set<string>();
		const badges = checkLandingAchievements(unlocked, {
			...baseConditions(),
			aliensActive: true,
		});
		expect(badges.some((b) => b.id === "survive-aliens")).toBe(true);
	});

	it("unlocks archaeologist with 2+ artifacts all scanned", () => {
		const unlocked = new Set<string>();
		const badges = checkLandingAchievements(unlocked, {
			...baseConditions(),
			artifactsScanned: 2,
			artifactsTotal: 2,
		});
		expect(badges.some((b) => b.id === "archaeologist")).toBe(true);
	});

	it("does not unlock archaeologist with 1 artifact", () => {
		const unlocked = new Set<string>();
		const badges = checkLandingAchievements(unlocked, {
			...baseConditions(),
			artifactsScanned: 1,
			artifactsTotal: 1,
		});
		expect(badges.some((b) => b.id === "archaeologist")).toBe(false);
	});
});

describe("getAllAchievements", () => {
	it("returns all 8 achievements with earned status", () => {
		const unlocked = new Set(["first-landing"]);
		const all = getAllAchievements(unlocked);
		expect(all).toHaveLength(8);
		expect(all.find((a) => a.id === "first-landing")!.earned).toBe(true);
		expect(all.find((a) => a.id === "perfect-landing")!.earned).toBe(false);
	});
});

describe("getAchievementCount", () => {
	it("returns 8", () => {
		expect(getAchievementCount()).toBe(8);
	});
});
