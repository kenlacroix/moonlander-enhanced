import { describe, expect, it } from "vitest";
import { generateTerrain } from "../src/game/Terrain";

describe("generateTerrain — determinism", () => {
	it("produces identical output for the same seed", () => {
		const a = generateTerrain(1969);
		const b = generateTerrain(1969);
		expect(a.points).toEqual(b.points);
		expect(a.pads).toEqual(b.pads);
	});

	it("produces different output for different seeds", () => {
		const a = generateTerrain(1969);
		const b = generateTerrain(4217);
		expect(a.points).not.toEqual(b.points);
	});
});

describe("generateTerrain — specialFeature regression", () => {
	// CRITICAL: terrain output must be byte-identical for non-historic seeds
	// after adding the specialFeature hook. Without this guarantee we'd
	// silently break every existing free-play and campaign mission.
	const knownSeeds = [1969, 4217, 7001];

	it.each(
		knownSeeds,
	)("seed %i: identical output with no difficulty vs empty difficulty", (seed) => {
		const baseline = generateTerrain(seed);
		const withEmptyDiff = generateTerrain(seed, {});
		expect(withEmptyDiff.points).toEqual(baseline.points);
		expect(withEmptyDiff.pads).toEqual(baseline.pads);
	});

	it.each(
		knownSeeds,
	)("seed %i: identical output with difficulty that omits specialFeature", (seed) => {
		const baseline = generateTerrain(seed);
		const withOtherFields = generateTerrain(seed, {
			roughness: undefined,
			crevices: 0,
		});
		expect(withOtherFields.points).toEqual(baseline.points);
		expect(withOtherFields.pads).toEqual(baseline.pads);
	});
});

describe("generateTerrain — specialFeature: rille", () => {
	it("changes terrain output vs no specialFeature on the same seed", () => {
		const baseline = generateTerrain(1969);
		const withRille = generateTerrain(1969, { specialFeature: "rille" });
		expect(withRille.points).not.toEqual(baseline.points);
	});

	it("preserves pad positions and y-heights", () => {
		const baseline = generateTerrain(1969);
		const withRille = generateTerrain(1969, { specialFeature: "rille" });
		expect(withRille.pads.map((p) => ({ x: p.x, y: p.y, w: p.width }))).toEqual(
			baseline.pads.map((p) => ({ x: p.x, y: p.y, w: p.width })),
		);
	});

	it("does not modify terrain points within pad zones", () => {
		const baseline = generateTerrain(1969);
		const withRille = generateTerrain(1969, { specialFeature: "rille" });
		for (const pad of baseline.pads) {
			const baselineOnPad = baseline.points.filter(
				(p) => p.x >= pad.x && p.x <= pad.x + pad.width,
			);
			const featureOnPad = withRille.points.filter(
				(p) => p.x >= pad.x && p.x <= pad.x + pad.width,
			);
			expect(featureOnPad).toEqual(baselineOnPad);
		}
	});

	it("is deterministic for the same seed + feature", () => {
		const a = generateTerrain(1969, { specialFeature: "rille" });
		const b = generateTerrain(1969, { specialFeature: "rille" });
		expect(a.points).toEqual(b.points);
	});
});

describe("generateTerrain — specialFeature: valley", () => {
	it("raises terrain near world edges (lower y = higher visually)", () => {
		const baseline = generateTerrain(7001);
		const withValley = generateTerrain(7001, { specialFeature: "valley" });
		// Compare leftmost non-pad points: valley should pull them up
		// (smaller y in screen coords). We sample the first 5 points.
		const firstFew = (pts: typeof baseline.points) => pts.slice(0, 5);
		const baselineSum = firstFew(baseline.points).reduce((s, p) => s + p.y, 0);
		const featureSum = firstFew(withValley.points).reduce((s, p) => s + p.y, 0);
		expect(featureSum).toBeLessThan(baselineSum);
	});

	it("preserves pad positions and y-heights", () => {
		const baseline = generateTerrain(7001);
		const withValley = generateTerrain(7001, { specialFeature: "valley" });
		expect(
			withValley.pads.map((p) => ({ x: p.x, y: p.y, w: p.width })),
		).toEqual(baseline.pads.map((p) => ({ x: p.x, y: p.y, w: p.width })));
	});

	it("is deterministic for the same seed + feature", () => {
		const a = generateTerrain(7001, { specialFeature: "valley" });
		const b = generateTerrain(7001, { specialFeature: "valley" });
		expect(a.points).toEqual(b.points);
	});
});
