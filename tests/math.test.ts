import { describe, expect, it } from "vitest";
import {
	addVec2,
	clamp,
	createRng,
	degToRad,
	distVec2,
	lengthVec2,
	lerp,
	normalizeVec2,
	radToDeg,
	scaleVec2,
	vec2,
} from "../src/utils/math";

describe("vec2 operations", () => {
	it("adds two vectors", () => {
		const result = addVec2(vec2(1, 2), vec2(3, 4));
		expect(result).toEqual({ x: 4, y: 6 });
	});

	it("scales a vector", () => {
		const result = scaleVec2(vec2(3, 4), 2);
		expect(result).toEqual({ x: 6, y: 8 });
	});

	it("computes vector length", () => {
		expect(lengthVec2(vec2(3, 4))).toBe(5);
	});

	it("normalizes a vector", () => {
		const n = normalizeVec2(vec2(3, 4));
		expect(lengthVec2(n)).toBeCloseTo(1);
		expect(n.x).toBeCloseTo(0.6);
		expect(n.y).toBeCloseTo(0.8);
	});

	it("normalizes zero vector to zero", () => {
		const n = normalizeVec2(vec2(0, 0));
		expect(n).toEqual({ x: 0, y: 0 });
	});

	it("computes distance between two points", () => {
		expect(distVec2(vec2(0, 0), vec2(3, 4))).toBe(5);
	});
});

describe("clamp", () => {
	it("clamps below minimum", () => {
		expect(clamp(-5, 0, 10)).toBe(0);
	});

	it("clamps above maximum", () => {
		expect(clamp(15, 0, 10)).toBe(10);
	});

	it("passes through values in range", () => {
		expect(clamp(5, 0, 10)).toBe(5);
	});
});

describe("lerp", () => {
	it("returns a at t=0", () => {
		expect(lerp(10, 20, 0)).toBe(10);
	});

	it("returns b at t=1", () => {
		expect(lerp(10, 20, 1)).toBe(20);
	});

	it("returns midpoint at t=0.5", () => {
		expect(lerp(10, 20, 0.5)).toBe(15);
	});
});

describe("angle conversion", () => {
	it("converts degrees to radians", () => {
		expect(degToRad(180)).toBeCloseTo(Math.PI);
		expect(degToRad(90)).toBeCloseTo(Math.PI / 2);
	});

	it("converts radians to degrees", () => {
		expect(radToDeg(Math.PI)).toBeCloseTo(180);
		expect(radToDeg(Math.PI / 2)).toBeCloseTo(90);
	});

	it("round-trips correctly", () => {
		expect(radToDeg(degToRad(45))).toBeCloseTo(45);
	});
});

describe("createRng", () => {
	it("produces deterministic output for same seed", () => {
		const rng1 = createRng(42);
		const rng2 = createRng(42);
		for (let i = 0; i < 10; i++) {
			expect(rng1()).toBe(rng2());
		}
	});

	it("produces values in [0, 1)", () => {
		const rng = createRng(123);
		for (let i = 0; i < 100; i++) {
			const v = rng();
			expect(v).toBeGreaterThanOrEqual(0);
			expect(v).toBeLessThan(1);
		}
	});

	it("produces different values for different seeds", () => {
		const rng1 = createRng(1);
		const rng2 = createRng(2);
		expect(rng1()).not.toBe(rng2());
	});
});
