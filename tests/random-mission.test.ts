import { describe, expect, it } from "vitest";
import {
	buildRandomMissionFromShare,
	generateRandomMission,
	isRandomMission,
	missionKind,
} from "../src/game/RandomMission";

/**
 * Sprint 7.1 PR 1.5 — Random Mission tests.
 *
 * The generator must:
 *  1. Produce a byte-identical Mission when given the same explicit seed.
 *  2. Pick an archetype from the pool (not rolling-only).
 *  3. Emit a non-empty offline briefing so the no-API-key path works.
 *  4. Carry kind:"random" so LLMIntegration and the leaderboard can
 *     branch on it.
 *  5. Round-trip through the share-URL path: seed + archetype hand-off
 *     produces the same name + briefing the original roll did.
 */

describe("generateRandomMission — determinism", () => {
	it("same explicit seed produces identical mission", () => {
		const a = generateRandomMission(1969);
		const b = generateRandomMission(1969);
		expect(a).toEqual(b);
	});

	it("different seeds produce different missions", () => {
		const a = generateRandomMission(1);
		const b = generateRandomMission(999999);
		// At minimum the name or archetype should differ across such
		// different seeds; equality would signal a broken RNG.
		const same =
			a.name === b.name && a.difficulty?.archetype === b.difficulty?.archetype;
		expect(same).toBe(false);
	});

	it("omitted seed produces a fresh (random) mission each call", () => {
		const a = generateRandomMission();
		const b = generateRandomMission();
		// Math.random drives it, so they'll almost always differ. Just
		// assert they're both valid random missions.
		expect(a.kind).toBe("random");
		expect(b.kind).toBe("random");
	});
});

describe("generateRandomMission — shape", () => {
	it('carries kind:"random" for type narrowing', () => {
		const m = generateRandomMission(42);
		expect(m.kind).toBe("random");
		expect(isRandomMission(m)).toBe(true);
		expect(missionKind(m)).toBe("random");
	});

	it("sets difficulty.archetype from the pool", () => {
		// Seed-hop enough times to confirm the pool covers ≥3 archetypes.
		const seen = new Set<string>();
		for (let s = 1; s < 100; s++) {
			const m = generateRandomMission(s);
			if (m.difficulty?.archetype) seen.add(m.difficulty.archetype);
		}
		expect(seen.size).toBeGreaterThanOrEqual(3);
	});

	it("generates a non-empty offline briefing", () => {
		const m = generateRandomMission(1);
		expect(m.offlineBriefing.length).toBeGreaterThan(0);
		expect(m.offlineBriefing).toContain(m.name);
	});

	it("generates a seed-carrying Mission that the game can select", () => {
		const m = generateRandomMission(42);
		expect(typeof m.seed).toBe("number");
		expect(m.name.length).toBeGreaterThan(0);
		expect(m.description.length).toBeGreaterThan(0);
	});
});

describe("buildRandomMissionFromShare — share URL round-trip", () => {
	it("reconstructs the same mission from (seed, archetype)", () => {
		const original = generateRandomMission(1969);
		const archetype = original.difficulty?.archetype;
		expect(archetype).toBeDefined();
		if (!archetype) return;
		const reconstructed = buildRandomMissionFromShare(1969, archetype);
		expect(reconstructed.name).toBe(original.name);
		expect(reconstructed.offlineBriefing).toBe(original.offlineBriefing);
		expect(reconstructed.difficulty?.archetype).toBe(archetype);
	});

	it("honors the archetype argument even if it differs from the RNG roll", () => {
		// Someone could hand-craft a share URL with a different archetype
		// than what the seed would have rolled. The constructor must
		// obey the caller, not the RNG.
		const m = buildRandomMissionFromShare(1969, "spires");
		expect(m.difficulty?.archetype).toBe("spires");
	});
});

describe("isRandomMission / missionKind", () => {
	it("rejects plain Mission objects", () => {
		const plain = { id: 1, name: "X", seed: 1, description: "" };
		expect(isRandomMission(plain)).toBe(false);
		expect(missionKind(plain)).toBeUndefined();
	});
});
