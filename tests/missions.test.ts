import { describe, expect, it } from "vitest";
import { CAMPAIGN, isMissionUnlocked, MISSIONS } from "../src/game/Missions";

describe("missions", () => {
	it("has 10 free play missions with unique seeds", () => {
		expect(MISSIONS).toHaveLength(10);
		const seeds = new Set(MISSIONS.map((m) => m.seed));
		expect(seeds.size).toBe(10);
	});

	it("has 5 campaign missions with difficulty configs", () => {
		expect(CAMPAIGN).toHaveLength(5);
		for (const m of CAMPAIGN) {
			expect(m.difficulty).toBeDefined();
		}
	});

	it("campaign difficulty escalates", () => {
		// Roughness should increase
		const roughness = CAMPAIGN.map((m) => m.difficulty!.roughness!);
		for (let i = 1; i < roughness.length; i++) {
			expect(roughness[i]).toBeGreaterThanOrEqual(roughness[i - 1]);
		}

		// Pad max width should decrease
		const padMax = CAMPAIGN.map((m) => m.difficulty!.padMaxWidth!);
		for (let i = 1; i < padMax.length; i++) {
			expect(padMax[i]).toBeLessThanOrEqual(padMax[i - 1]);
		}
	});
});

describe("isMissionUnlocked", () => {
	it("mission 1 is always unlocked", () => {
		expect(isMissionUnlocked(1, new Set())).toBe(true);
	});

	it("mission 2 is locked until mission 1 is completed", () => {
		expect(isMissionUnlocked(2, new Set())).toBe(false);
		expect(isMissionUnlocked(2, new Set([1]))).toBe(true);
	});

	it("mission 5 requires mission 4", () => {
		expect(isMissionUnlocked(5, new Set([1, 2, 3]))).toBe(false);
		expect(isMissionUnlocked(5, new Set([1, 2, 3, 4]))).toBe(true);
	});
});
