import { describe, expect, it } from "vitest";
import { classifyLanding, nearestPad } from "../src/game/FlightOutcome";
import type { LanderState } from "../src/game/Lander";
import {
	MAX_LANDING_ANGLE,
	MAX_LANDING_ANGULAR_RATE,
	MAX_LANDING_SPEED,
} from "../src/utils/constants";

const baseLander = (over: Partial<LanderState> = {}): LanderState => ({
	x: 100,
	y: 100,
	vx: 0,
	vy: 0,
	angle: 0,
	angularVel: 0,
	fuel: 800,
	thrusting: false,
	status: "landed",
	physicsVersion: 3,
	landerType: {
		name: "TEST",
		thrustMultiplier: 1,
		fuelMultiplier: 1,
		massMultiplier: 1,
		rotationMultiplier: 1,
		color: "#fff",
		description: "",
	},
	...over,
});

describe("FlightOutcome.classifyLanding", () => {
	const pad = { x: 80, width: 40 };
	// pad center is at x=100

	it("clean when all metrics are well inside tolerance and pad-centered", () => {
		const lander = baseLander({
			x: 100, // dead-center
			vy: 0.1 * MAX_LANDING_SPEED,
			vx: 0.1 * MAX_LANDING_SPEED,
			angle: 1,
		});
		const result = classifyLanding(lander, pad, 1, 8);
		expect(result.result).toBe("clean");
		expect(result.landingMarginPx).toBe(0);
	});

	it("bounced when off-center beyond LANDING_MARGIN_PX_THRESHOLD", () => {
		const lander = baseLander({ x: 145 }); // 45 px from center
		const result = classifyLanding(lander, pad, 1, 8);
		expect(result.result).toBe("bounced");
		expect(result.landingMarginPx).toBe(45);
	});

	it("bounced when vertical speed is in worst 20% of tolerance band", () => {
		const lander = baseLander({
			x: 100,
			vy: 0.9 * MAX_LANDING_SPEED, // 90% of max = worst 20% (>= 80%)
		});
		const result = classifyLanding(lander, pad, 0, 8);
		expect(result.result).toBe("bounced");
	});

	it("bounced when angle is in worst 20% of tolerance band", () => {
		const lander = baseLander({
			x: 100,
			angle: 0.9 * MAX_LANDING_ANGLE, // 9° (90% of 10° gate)
		});
		const result = classifyLanding(lander, pad, 0, 8);
		expect(result.result).toBe("bounced");
	});

	it("bounced when angular rate is in worst 20% of tolerance band (v3)", () => {
		const lander = baseLander({ x: 100, physicsVersion: 3 });
		const peakRate = 0.9 * MAX_LANDING_ANGULAR_RATE; // 90% of gate
		const result = classifyLanding(
			lander,
			pad,
			peakRate,
			MAX_LANDING_ANGULAR_RATE,
		);
		expect(result.result).toBe("bounced");
	});

	it("v2 ignores angular rate even when bestAngularRate is high", () => {
		const lander = baseLander({ x: 100, physicsVersion: 2 });
		// v2 has no rate gate; should be clean despite high "rate".
		const result = classifyLanding(lander, pad, 100, 8);
		expect(result.result).toBe("clean");
	});

	it("uses per-mission gate override when provided", () => {
		const lander = baseLander({ x: 100, physicsVersion: 3 });
		// Apollo 11 gate is 6°/s. peakRate of 5.5 is 91% — bounced.
		const result = classifyLanding(lander, pad, 5.5, 6);
		expect(result.result).toBe("bounced");
	});
});

describe("FlightOutcome.nearestPad", () => {
	it("returns the closest pad center to landerX", () => {
		const pads = [
			{ x: 0, y: 100, width: 40, points: 1 },
			{ x: 200, y: 100, width: 40, points: 1 },
			{ x: 500, y: 100, width: 40, points: 1 },
		];
		expect(nearestPad(220, pads)).toEqual({ x: 200, width: 40 });
		expect(nearestPad(490, pads)).toEqual({ x: 500, width: 40 });
		expect(nearestPad(15, pads)).toEqual({ x: 0, width: 40 });
	});

	it("returns null on empty pad list", () => {
		expect(nearestPad(100, [])).toBeNull();
	});
});
