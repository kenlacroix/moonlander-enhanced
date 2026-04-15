import { describe, expect, it } from "vitest";
import { renderFactSheetBriefing } from "../src/api/MissionBriefing";
import { APOLLO_MISSIONS } from "../src/data/apolloMissions";

describe("MissionBriefing — offline fact-sheet fallback", () => {
	const a11 = APOLLO_MISSIONS.find((m) => m.name.includes("APOLLO 11"));
	if (!a11 || a11.kind !== "landing")
		throw new Error("Apollo 11 missing or wrong kind");

	it("renders the mission name, craft, and date", () => {
		const text = renderFactSheetBriefing(a11, a11.facts);
		expect(text).toContain(a11.name);
		expect(text).toContain(a11.facts.craftName);
		expect(text).toContain(a11.facts.date);
	});

	it("renders crew names", () => {
		const text = renderFactSheetBriefing(a11, a11.facts);
		expect(text).toContain(a11.facts.commander);
		if (a11.facts.lmPilot) expect(text).toContain(a11.facts.lmPilot);
		if (a11.facts.cmPilot) expect(text).toContain(a11.facts.cmPilot);
	});

	it("renders landing site and coordinates", () => {
		const text = renderFactSheetBriefing(a11, a11.facts);
		expect(text).toContain(a11.facts.landingSite);
		expect(text).toContain(a11.facts.coordinates);
	});

	it("renders the descent start altitude", () => {
		const text = renderFactSheetBriefing(a11, a11.facts);
		expect(text).toMatch(/15,?240/);
	});

	it("renders the notable moment", () => {
		const text = renderFactSheetBriefing(a11, a11.facts);
		expect(text).toContain(a11.facts.notableMoment);
	});

	it("only uses values from the fact sheet (no hallucinated numbers)", () => {
		const text = renderFactSheetBriefing(a11, a11.facts);
		// The text shouldn't contain a year that isn't in the fact sheet.
		const yearMatches = text.match(/\b(19|20)\d{2}\b/g) ?? [];
		for (const year of yearMatches) {
			expect(a11.facts.date.includes(year)).toBe(true);
		}
	});
});
