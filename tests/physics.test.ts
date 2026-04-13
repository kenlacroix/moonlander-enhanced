import { describe, expect, it } from "vitest";
import {
	applyGravity,
	checkCollision,
	getTerrainHeightAt,
	normAngle,
	thrustVector,
} from "../src/game/Physics";
import {
	GRAVITY,
	MAX_LANDING_ANGLE,
	MAX_LANDING_SPEED,
	THRUST_FORCE,
} from "../src/utils/constants";
import { vec2 } from "../src/utils/math";

describe("applyGravity", () => {
	it("increases downward velocity by gravity * dt", () => {
		const vy = 0;
		const dt = 1;
		expect(applyGravity(vy, dt)).toBeCloseTo(GRAVITY);
	});

	it("accumulates over multiple steps", () => {
		let vy = 0;
		const dt = 1 / 60;
		for (let i = 0; i < 60; i++) {
			vy = applyGravity(vy, dt);
		}
		expect(vy).toBeCloseTo(GRAVITY, 1);
	});

	it("returns unchanged velocity when dt is 0", () => {
		expect(applyGravity(5, 0)).toBe(5);
	});
});

describe("thrustVector", () => {
	it("thrusts upward when angle is 0 (pointing up)", () => {
		const v = thrustVector(0);
		expect(v.x).toBeCloseTo(0, 5);
		expect(v.y).toBeCloseTo(-THRUST_FORCE, 5);
	});

	it("thrusts right when angle is 90", () => {
		const v = thrustVector(90);
		expect(v.x).toBeCloseTo(THRUST_FORCE, 5);
		expect(v.y).toBeCloseTo(0, 5);
	});

	it("thrusts left when angle is -90", () => {
		const v = thrustVector(-90);
		expect(v.x).toBeCloseTo(-THRUST_FORCE, 5);
		expect(v.y).toBeCloseTo(0, 5);
	});
});

describe("getTerrainHeightAt", () => {
	const points = [vec2(0, 100), vec2(100, 200), vec2(200, 100)];

	it("interpolates between terrain points", () => {
		expect(getTerrainHeightAt(50, points)).toBeCloseTo(150);
	});

	it("returns exact height at a terrain point", () => {
		expect(getTerrainHeightAt(100, points)).toBeCloseTo(200);
	});

	it("returns edge height when x is out of bounds", () => {
		expect(getTerrainHeightAt(-10, points)).toBe(100);
		expect(getTerrainHeightAt(300, points)).toBe(100);
	});

	it("returns Infinity for fewer than 2 points", () => {
		expect(getTerrainHeightAt(50, [vec2(0, 100)])).toBe(Infinity);
	});
});

describe("normAngle", () => {
	it("normalizes positive angles", () => {
		expect(normAngle(0)).toBeCloseTo(0);
		expect(normAngle(90)).toBeCloseTo(90);
		expect(normAngle(180)).toBeCloseTo(-180);
		expect(normAngle(270)).toBeCloseTo(-90);
		expect(normAngle(360)).toBeCloseTo(0);
	});

	it("normalizes negative angles", () => {
		expect(normAngle(-90)).toBeCloseTo(-90);
		expect(normAngle(-180)).toBeCloseTo(-180);
		expect(normAngle(-270)).toBeCloseTo(90);
		expect(normAngle(-360)).toBeCloseTo(0);
	});

	it("handles large angles from prolonged spinning", () => {
		expect(normAngle(720 + 45)).toBeCloseTo(45);
		expect(normAngle(-720 - 45)).toBeCloseTo(-45);
		expect(normAngle(1080)).toBeCloseTo(0);
	});
});

describe("checkCollision", () => {
	const terrain = {
		points: [vec2(0, 500), vec2(200, 500), vec2(400, 500), vec2(600, 500)],
		pads: [{ x: 200, y: 500, width: 100, pointValue: 100 }],
	};

	it("detects safe landing on pad within limits", () => {
		const lander = {
			x: 250,
			y: 500 - 18,
			vx: 0,
			vy: 1.0,
			angle: 0,
			fuel: 100,
			thrusting: false,
		};
		const result = checkCollision(lander, terrain);
		expect(result.collided).toBe(true);
		expect(result.onPad).not.toBeNull();
		expect(result.safeLanding).toBe(true);
	});

	it("detects crash on pad when too fast", () => {
		const lander = {
			x: 250,
			y: 500 - 18,
			vx: 0,
			vy: MAX_LANDING_SPEED + 1,
			angle: 0,
			fuel: 100,
			thrusting: false,
		};
		const result = checkCollision(lander, terrain);
		expect(result.collided).toBe(true);
		expect(result.onPad).not.toBeNull();
		expect(result.safeLanding).toBe(false);
	});

	it("detects crash on pad when angle too steep", () => {
		const lander = {
			x: 250,
			y: 500 - 18,
			vx: 0,
			vy: 1.0,
			angle: MAX_LANDING_ANGLE + 5,
			fuel: 100,
			thrusting: false,
		};
		const result = checkCollision(lander, terrain);
		expect(result.collided).toBe(true);
		expect(result.safeLanding).toBe(false);
	});

	it("detects terrain crash (not on pad)", () => {
		const lander = {
			x: 50,
			y: 500 - 18,
			vx: 0,
			vy: 1.0,
			angle: 0,
			fuel: 100,
			thrusting: false,
		};
		const result = checkCollision(lander, terrain);
		expect(result.collided).toBe(true);
		expect(result.onPad).toBeNull();
		expect(result.safeLanding).toBe(false);
	});

	it("returns no collision when above terrain", () => {
		const lander = {
			x: 250,
			y: 200,
			vx: 0,
			vy: 1.0,
			angle: 0,
			fuel: 100,
			thrusting: false,
		};
		const result = checkCollision(lander, terrain);
		expect(result.collided).toBe(false);
	});
});
