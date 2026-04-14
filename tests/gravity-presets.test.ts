import { describe, expect, it } from "vitest";
import {
	GRAVITY_PRESETS,
	getDefaultPreset,
	getGravityPreset,
	nextPreset,
	prevPreset,
} from "../src/game/GravityPresets";

describe("GRAVITY_PRESETS", () => {
	it("has 5 presets", () => {
		expect(GRAVITY_PRESETS).toHaveLength(5);
	});

	it("Moon is first and default", () => {
		expect(GRAVITY_PRESETS[0].name).toBe("Moon");
		expect(getDefaultPreset().name).toBe("Moon");
	});

	it("all presets have positive or zero gameGravity", () => {
		for (const p of GRAVITY_PRESETS) {
			expect(p.gameGravity).toBeGreaterThanOrEqual(0);
		}
	});

	it("gameGravity scales correctly from real gravity", () => {
		const moon = GRAVITY_PRESETS[0];
		// Scale factor: gameGravity / gravity = 60
		expect(moon.gameGravity / moon.gravity).toBeCloseTo(60, 0);
	});
});

describe("getGravityPreset", () => {
	it("finds by name case-insensitive", () => {
		expect(getGravityPreset("mars")?.gravity).toBe(3.72);
		expect(getGravityPreset("EARTH")?.gravity).toBe(9.81);
	});

	it("returns undefined for unknown name", () => {
		expect(getGravityPreset("pluto")).toBeUndefined();
	});
});

describe("nextPreset / prevPreset", () => {
	it("cycles forward", () => {
		const moon = getDefaultPreset();
		expect(nextPreset(moon).name).toBe("Mars");
	});

	it("wraps around forward", () => {
		const last = GRAVITY_PRESETS[GRAVITY_PRESETS.length - 1];
		expect(nextPreset(last).name).toBe("Moon");
	});

	it("cycles backward", () => {
		const moon = getDefaultPreset();
		expect(prevPreset(moon).name).toBe("Zero-G");
	});
});
