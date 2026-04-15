import { describe, expect, it } from "vitest";
import { APOLLO_MISSIONS } from "../src/data/apolloMissions";
import { ARTEMIS_MISSIONS } from "../src/data/artemisMissions";
import { isHistoricMission } from "../src/game/HistoricMission";

describe("HistoricMission data files", () => {
	const all = [...APOLLO_MISSIONS, ...ARTEMIS_MISSIONS];

	it.each(all)("$name has all required fact-sheet fields", (m) => {
		expect(m.facts.craftName).toBeTruthy();
		expect(m.facts.date).toBeTruthy();
		expect(m.facts.commander).toBeTruthy();
		expect(m.facts.landingSite).toBeTruthy();
		expect(m.facts.coordinates).toBeTruthy();
		expect(m.facts.descentStartAltitudeM).toBeGreaterThan(0);
		expect(m.facts.notableMoment).toBeTruthy();
		expect(m.facts.historicalReferenceLabel).toBeTruthy();
		expect(m.facts.historicalReferenceValue).toBeGreaterThan(0);
		expect(m.facts.historicalReferenceUnit).toBeTruthy();
	});

	it.each(all)("$name has unique seed", (m) => {
		expect(typeof m.seed).toBe("number");
		expect(Number.isInteger(m.seed)).toBe(true);
	});

	it("all seeds are unique across the historic missions", () => {
		const seeds = all.map((m) => m.seed);
		expect(new Set(seeds).size).toBe(seeds.length);
	});

	it("isHistoricMission identifies historic missions", () => {
		for (const m of all) {
			expect(isHistoricMission(m)).toBe(true);
		}
		// And rejects a plain Mission
		expect(
			isHistoricMission({ id: 1, name: "x", seed: 1, description: "x" }),
		).toBe(false);
	});

	it("each landing mission declares at least one moment", () => {
		for (const m of all) {
			if (m.kind !== "landing") continue;
			expect(m.moments.length).toBeGreaterThan(0);
		}
	});

	it("Apollo 11 declares the famous fuel-margin moment", () => {
		const a11 = APOLLO_MISSIONS.find((m) => m.name.includes("APOLLO 11"));
		expect(a11).toBeDefined();
		expect(
			a11?.moments.some((m) => m.achievementId === "apollo-11-margin"),
		).toBe(true);
	});

	it("Apollo 15 uses the rille specialFeature", () => {
		const a15 = APOLLO_MISSIONS.find((m) => m.name.includes("APOLLO 15"));
		expect(a15?.difficulty?.specialFeature).toBe("rille");
	});

	it("Apollo 17 uses the valley specialFeature", () => {
		const a17 = APOLLO_MISSIONS.find((m) => m.name.includes("APOLLO 17"));
		expect(a17?.difficulty?.specialFeature).toBe("valley");
	});

	it("Artemis III uses the artemis-lm lander type", () => {
		const a3 = ARTEMIS_MISSIONS.find((m) => m.name.includes("ARTEMIS III"));
		expect(a3?.difficulty?.landerType).toBe("artemis-lm");
	});
});
