import { describe, expect, it } from "vitest";
import { checkArtifactScan, placeArtifacts, shouldSpawnArtifacts } from "../src/game/Artifacts";
import { generateTerrain } from "../src/game/Terrain";

describe("shouldSpawnArtifacts", () => {
	it("is deterministic for the same seed", () => {
		expect(shouldSpawnArtifacts(42)).toBe(shouldSpawnArtifacts(42));
	});

	it("spawns on roughly 40% of seeds", () => {
		let count = 0;
		for (let seed = 0; seed < 100; seed++) {
			if (shouldSpawnArtifacts(seed)) count++;
		}
		expect(count).toBeGreaterThan(25);
		expect(count).toBeLessThan(55);
	});
});

describe("placeArtifacts", () => {
	it("produces identical artifacts from the same seed", () => {
		const terrain = generateTerrain(1969);
		const a1 = placeArtifacts(1969, terrain.points);
		const a2 = placeArtifacts(1969, terrain.points);
		expect(a1.length).toBe(a2.length);
		for (let i = 0; i < a1.length; i++) {
			expect(a1[i].x).toBe(a2[i].x);
			expect(a1[i].type).toBe(a2[i].type);
		}
	});

	it("places artifacts on the terrain surface", () => {
		// Use a seed known to spawn artifacts
		let spawnSeed = -1;
		for (let s = 0; s < 100; s++) {
			if (shouldSpawnArtifacts(s)) { spawnSeed = s; break; }
		}
		expect(spawnSeed).toBeGreaterThanOrEqual(0);
		const terrain = generateTerrain(spawnSeed);
		const arts = placeArtifacts(spawnSeed, terrain.points);
		expect(arts.length).toBeGreaterThan(0);
		for (const art of arts) {
			expect(art.y).toBeGreaterThan(0);
		}
	});

	it("returns empty for seeds where shouldSpawnArtifacts is false", () => {
		for (let seed = 0; seed < 100; seed++) {
			if (!shouldSpawnArtifacts(seed)) {
				const terrain = generateTerrain(seed);
				expect(placeArtifacts(seed, terrain.points)).toHaveLength(0);
				return;
			}
		}
	});

	it("can place 2 artifacts for some seeds", () => {
		let foundTwo = false;
		for (let seed = 0; seed < 200 && !foundTwo; seed++) {
			if (!shouldSpawnArtifacts(seed)) continue;
			const terrain = generateTerrain(seed);
			if (placeArtifacts(seed, terrain.points).length === 2) foundTwo = true;
		}
		expect(foundTwo).toBe(true);
	});
});

describe("checkArtifactScan", () => {
	it("returns artifact when lander is within scan radius", () => {
		const terrain = generateTerrain(1969);
		const arts = placeArtifacts(1969, terrain.points);
		if (arts.length === 0) return;
		const result = checkArtifactScan(arts, arts[0].x + 10);
		expect(result).not.toBeNull();
		expect(result?.type).toBe(arts[0].type);
	});

	it("returns null when lander is far from artifacts", () => {
		const terrain = generateTerrain(1969);
		const arts = placeArtifacts(1969, terrain.points);
		if (arts.length === 0) return;
		const result = checkArtifactScan(arts, arts[0].x + 500);
		expect(result).toBeNull();
	});

	it("returns null at exact scan boundary (exclusive)", () => {
		const terrain = generateTerrain(1969);
		const arts = placeArtifacts(1969, terrain.points);
		if (arts.length === 0) return;
		// SCAN_RADIUS = 80, condition is strict < so exactly 80 should be null
		expect(checkArtifactScan(arts, arts[0].x + 80)).toBeNull();
		// 79 should hit
		expect(checkArtifactScan(arts, arts[0].x + 79)).not.toBeNull();
	});

	it("returns null for empty artifacts array", () => {
		expect(checkArtifactScan([], 500)).toBeNull();
	});

	it("skips already-scanned artifacts", () => {
		// Use hand-crafted artifacts to avoid seed dependency
		const arts = [
			{ x: 100, y: 50, type: "flag" as const, scanned: true, label: "FLAG", fact: null },
			{ x: 5000, y: 50, type: "plaque" as const, scanned: false, label: "PLAQUE", fact: null },
		];
		// Only the scanned artifact is nearby — should return null
		const result = checkArtifactScan(arts, 100);
		expect(result).toBeNull();
	});
});
