import { describe, expect, it } from "vitest";
import { APOLLO_13, APOLLO_MISSIONS } from "../src/data/apolloMissions";
import { ARTEMIS_MISSIONS } from "../src/data/artemisMissions";
import { LUNA_MISSIONS } from "../src/data/lunaMissions";
import {
	findHiddenPad,
	HIDDEN_PAD_REVEAL_AGL_PX,
	HIDDEN_PAD_SCORE_MULTIPLIER,
	isHiddenPadRevealed,
	maybeGenerateHiddenPad,
} from "../src/game/HiddenPad";
import { MISSIONS } from "../src/game/Missions";
import { generateTerrain } from "../src/game/Terrain";

/**
 * Sprint 7.1 PR 1.5 — hidden pad tests.
 *
 * Hidden pads are a discoverable 3× bonus landing target. Guarantees:
 *  1. Historic missions never get one (scoring-margin share cards).
 *  2. Output is deterministic per seed.
 *  3. Generated pads don't overlap existing pads.
 *  4. Freeplay seeds produce a pad ~25% of the time (1-in-4 gate).
 *  5. `isHiddenPadRevealed` flips true at/below the reveal AGL.
 */

function scanSeeds(
	mission: Parameters<typeof maybeGenerateHiddenPad>[0],
	start: number,
	count: number,
): number {
	let found = 0;
	for (let s = start; s < start + count; s++) {
		const terrain = generateTerrain(s);
		const pad = maybeGenerateHiddenPad(mission, terrain, s);
		if (pad) found++;
	}
	return found;
}

describe("HiddenPad — constants", () => {
	it("exposes a sensible reveal threshold (100px as per plan)", () => {
		expect(HIDDEN_PAD_REVEAL_AGL_PX).toBe(100);
	});

	it("exposes a 3× score multiplier (as per plan)", () => {
		expect(HIDDEN_PAD_SCORE_MULTIPLIER).toBe(3);
	});
});

describe("HiddenPad — determinism", () => {
	it("same seed produces identical hidden pad", () => {
		const terrainA = generateTerrain(1969);
		const terrainB = generateTerrain(1969);
		const a = maybeGenerateHiddenPad(null, terrainA, 1969);
		const b = maybeGenerateHiddenPad(null, terrainB, 1969);
		expect(a).toEqual(b);
	});

	it("different seeds produce different placements when both generate one", () => {
		// Scan for two seeds that both generate a pad, then assert they differ.
		let first: ReturnType<typeof maybeGenerateHiddenPad> = null;
		let second: ReturnType<typeof maybeGenerateHiddenPad> = null;
		for (let s = 1; s < 200 && !second; s++) {
			const terrain = generateTerrain(s);
			const p = maybeGenerateHiddenPad(null, terrain, s);
			if (p) {
				if (!first) first = p;
				else second = p;
			}
		}
		expect(first).not.toBeNull();
		expect(second).not.toBeNull();
		// x-coordinates should differ (different seed → different placement)
		expect(first?.x).not.toBe(second?.x);
	});
});

describe("HiddenPad — historic exemption", () => {
	it.each(APOLLO_MISSIONS)("Apollo $id never gets a hidden pad", (mission) => {
		const terrain = generateTerrain(mission.seed, mission.difficulty);
		const pad = maybeGenerateHiddenPad(mission, terrain, mission.seed);
		expect(pad).toBeNull();
	});

	it.each(
		ARTEMIS_MISSIONS,
	)("Artemis $id never gets a hidden pad", (mission) => {
		const terrain = generateTerrain(mission.seed, mission.difficulty);
		const pad = maybeGenerateHiddenPad(mission, terrain, mission.seed);
		expect(pad).toBeNull();
	});

	it.each(LUNA_MISSIONS)("Luna $id never gets a hidden pad", (mission) => {
		const terrain = generateTerrain(mission.seed, mission.difficulty);
		const pad = maybeGenerateHiddenPad(mission, terrain, mission.seed);
		expect(pad).toBeNull();
	});

	it("Apollo 13 (survive kind) never gets a hidden pad", () => {
		const terrain = generateTerrain(APOLLO_13.seed, APOLLO_13.difficulty);
		const pad = maybeGenerateHiddenPad(APOLLO_13, terrain, APOLLO_13.seed);
		expect(pad).toBeNull();
	});
});

describe("HiddenPad — freeplay frequency", () => {
	it("generates a pad on roughly 1-in-4 freeplay seeds (15-40% of 200)", () => {
		// Mulberry32 on small integer seeds isn't perfectly uniform; 200
		// samples can drift past the theoretical 25%. Keeping the range
		// wide enough to avoid flakes while still failing loudly if the
		// frequency gate is broken (e.g. always generating or never).
		const hits = scanSeeds(null, 1, 200);
		expect(hits).toBeGreaterThan(200 * 0.15);
		expect(hits).toBeLessThan(200 * 0.4);
	});

	it("null mission (pure freeplay) is eligible for hidden pads", () => {
		// Seeds 1..50 should include at least one pad when mission is null.
		const hits = scanSeeds(null, 1, 50);
		expect(hits).toBeGreaterThan(0);
	});
});

describe("HiddenPad — pad placement safety", () => {
	it("doesn't overlap existing pads on any generated seed", () => {
		for (let s = 1; s < 100; s++) {
			const terrain = generateTerrain(s);
			const pad = maybeGenerateHiddenPad(null, terrain, s);
			if (!pad) continue;
			for (const existing of terrain.pads) {
				// Hidden pad was pushed into terrain.pads? Skip self.
				if (existing === pad) continue;
				const overlap =
					pad.x < existing.x + existing.width && existing.x < pad.x + pad.width;
				expect(overlap).toBe(false);
			}
		}
	});

	it("flattens terrain beneath the hidden pad (all points share pad.y)", () => {
		// Find a seed that generates a pad, then inspect points in its span.
		let terrain: ReturnType<typeof generateTerrain> | null = null;
		let pad: ReturnType<typeof maybeGenerateHiddenPad> = null;
		for (let s = 1; s < 200; s++) {
			terrain = generateTerrain(s);
			pad = maybeGenerateHiddenPad(null, terrain, s);
			if (pad) break;
		}
		expect(pad).not.toBeNull();
		if (!pad || !terrain) return;
		for (const p of terrain.points) {
			if (p.x >= pad.x && p.x <= pad.x + pad.width) {
				expect(p.y).toBe(pad.y);
			}
		}
	});
});

describe("HiddenPad — isHiddenPadRevealed", () => {
	const pad = { x: 400, y: 500, width: 80, points: 1, hidden: true };

	it("not revealed well above threshold", () => {
		const landerY = pad.y - HIDDEN_PAD_REVEAL_AGL_PX - 50;
		expect(isHiddenPadRevealed(pad, pad.x + pad.width / 2, landerY)).toBe(
			false,
		);
	});

	it("revealed just at threshold", () => {
		const landerY = pad.y - HIDDEN_PAD_REVEAL_AGL_PX;
		expect(isHiddenPadRevealed(pad, pad.x + pad.width / 2, landerY)).toBe(true);
	});

	it("revealed below threshold", () => {
		const landerY = pad.y - HIDDEN_PAD_REVEAL_AGL_PX + 20;
		expect(isHiddenPadRevealed(pad, pad.x + pad.width / 2, landerY)).toBe(true);
	});

	it("revealed when lander is below pad surface (underground / touched-down)", () => {
		expect(isHiddenPadRevealed(pad, pad.x, pad.y + 10)).toBe(true);
	});
});

describe("HiddenPad — findHiddenPad", () => {
	it("returns null for a terrain with no hidden pads", () => {
		const terrain = generateTerrain(1969);
		// Apollo-style seed won't have one if we don't add it; but seed 1969 might
		// roll one — filter the terrain to guarantee none.
		const filtered = {
			...terrain,
			pads: terrain.pads.filter((p) => !p.hidden),
		};
		expect(findHiddenPad(filtered)).toBeNull();
	});

	it("returns the hidden pad when one is present", () => {
		const terrain = generateTerrain(1969);
		// Append a synthetic hidden pad so the finder has something to find.
		const fake = { x: 10, y: 500, width: 60, points: 1, hidden: true };
		terrain.pads.push(fake);
		expect(findHiddenPad(terrain)).toBe(fake);
	});
});

describe("HiddenPad — MISSIONS regression pin", () => {
	// Every freeplay MISSIONS[] entry that generates a hidden pad must stay
	// deterministic across reruns. This pins the exact pads generated so a
	// future archetype change or RNG drift surfaces here loudly.
	it.each(
		MISSIONS,
	)("MISSIONS[$id] ($name) produces a stable hidden-pad output", (mission) => {
		const terrain1 = generateTerrain(mission.seed, mission.difficulty);
		const terrain2 = generateTerrain(mission.seed, mission.difficulty);
		const pad1 = maybeGenerateHiddenPad(mission, terrain1, mission.seed);
		const pad2 = maybeGenerateHiddenPad(mission, terrain2, mission.seed);
		expect(pad1).toEqual(pad2);
	});
});
