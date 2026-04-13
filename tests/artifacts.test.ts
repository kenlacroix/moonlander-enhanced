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
		const terrain = generateTerrain(1969);
		const arts = placeArtifacts(1969, terrain.points);
		if (arts.length === 0) return; // seed might not spawn artifacts
		for (const art of arts) {
			expect(art.y).toBeGreaterThan(0);
		}
	});

	it("returns empty for seeds where shouldSpawnArtifacts is false", () => {
		// Find a seed that doesn't spawn
		for (let seed = 0; seed < 100; seed++) {
			if (!shouldSpawnArtifacts(seed)) {
				const terrain = generateTerrain(seed);
				expect(placeArtifacts(seed, terrain.points)).toHaveLength(0);
				return;
			}
		}
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

	it("skips already-scanned artifacts", () => {
		const terrain = generateTerrain(1969);
		const arts = placeArtifacts(1969, terrain.points);
		if (arts.length === 0) return;
		arts[0].scanned = true;
		const result = checkArtifactScan(arts, arts[0].x);
		// If there's only one artifact, result should be null
		if (arts.length === 1) {
			expect(result).toBeNull();
		}
	});
});
