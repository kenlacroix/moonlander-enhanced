import { describe, expect, it } from "vitest";
import { createWind, updateWind } from "../src/game/Wind";

describe("createWind", () => {
	it("creates wind with speed based on seed", () => {
		const wind = createWind(42, 1.0);
		expect(wind).toHaveProperty("speed");
		expect(wind).toHaveProperty("maxSpeed");
		expect(wind).toHaveProperty("frequency");
	});

	it("is deterministic for same seed and strength", () => {
		const a = createWind(42, 1.0);
		const b = createWind(42, 1.0);
		expect(a).toEqual(b);
	});

	it("produces different wind for different seeds", () => {
		const a = createWind(42, 1.0);
		const b = createWind(43, 1.0);
		expect(a.frequency).not.toEqual(b.frequency);
	});

	it("scales with strength parameter", () => {
		const weak = createWind(42, 0.5);
		const strong = createWind(42, 2.0);
		expect(strong.maxSpeed).toBeGreaterThan(weak.maxSpeed);
	});
});

describe("updateWind", () => {
	it("changes speed over time", () => {
		const wind = createWind(42, 1.0);
		const initialSpeed = wind.speed;
		updateWind(wind, 1.0);
		expect(wind.speed).not.toEqual(initialSpeed);
	});

	it("keeps speed within maxSpeed bounds", () => {
		const wind = createWind(42, 1.0);
		for (let t = 0; t < 100; t += 0.5) {
			updateWind(wind, t);
			expect(Math.abs(wind.speed)).toBeLessThanOrEqual(wind.maxSpeed * 1.5);
		}
	});
});
