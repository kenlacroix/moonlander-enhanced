import { describe, expect, it } from "vitest";
import { CAMPAIGN, MISSIONS } from "../src/game/Missions";
import { generateTerrain } from "../src/game/Terrain";

/**
 * Curated Free Play + Campaign missions opt into terrainVersion 2 with tuned
 * difficulty. These guard the load-bearing guarantee — dramatic terrain
 * (spires, crevices, narrow single pads) must still produce flat, landable
 * pads — plus the v2 opt-in and a coarse difficulty curve.
 */

const curated = [...MISSIONS, ...CAMPAIGN];

describe("curated missions — terrainVersion 2 opt-in", () => {
	it("every Free Play mission uses terrainVersion 2 with an archetype", () => {
		for (const m of MISSIONS) {
			expect(m.difficulty?.terrainVersion).toBe(2);
			expect(m.difficulty?.archetype).toBeDefined();
		}
	});

	it("every Campaign mission uses terrainVersion 2", () => {
		for (const m of CAMPAIGN) {
			expect(m.difficulty?.terrainVersion).toBe(2);
		}
	});
});

describe("curated missions — terrain is always landable", () => {
	it.each(curated)("$name (seed $seed) generates flat, landable pads", (m) => {
		const { points, pads } = generateTerrain(m.seed, m.difficulty);
		const wantPads = m.difficulty?.padCount ?? 2;
		expect(pads.length).toBe(wantPads);
		for (const pad of pads) {
			const onPad = points.filter(
				(p) => p.x >= pad.x && p.x <= pad.x + pad.width,
			);
			expect(onPad.length).toBeGreaterThan(0);
			// Every terrain point under the pad must sit at the pad height,
			// otherwise the lander can't actually touch down on it.
			for (const p of onPad) {
				expect(p.y).toBeCloseTo(pad.y, 5);
			}
			// Pad must be wide enough to be a real target.
			expect(pad.width).toBeGreaterThanOrEqual(m.difficulty?.padMinWidth ?? 60);
		}
	});

	it("terrain heights stay inside the valid band for every mission", () => {
		for (const m of curated) {
			const { points } = generateTerrain(m.seed, m.difficulty);
			for (const p of points) {
				expect(p.y).toBeGreaterThanOrEqual(220);
				expect(p.y).toBeLessThanOrEqual(620);
			}
		}
	});
});

describe("Free Play difficulty curve", () => {
	it("mission 1 is the most forgiving, mission 10 the least", () => {
		const first = MISSIONS[0].difficulty!;
		const last = MISSIONS[9].difficulty!;
		expect(first.startingFuel!).toBeGreaterThan(last.startingFuel!);
		expect(first.padMinWidth!).toBeGreaterThan(last.padMinWidth!);
		expect(last.padCount).toBe(1);
	});
});
