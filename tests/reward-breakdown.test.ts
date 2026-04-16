import { beforeEach, describe, expect, it } from "vitest";
import {
	calculateReward,
	calculateRewardBreakdown,
	getState,
	resetStateCache,
	STATE_SIZE,
} from "../src/ai/AgentEnv";
import type { LanderState } from "../src/game/Lander";
import type { TerrainData } from "../src/game/Terrain";

function makeLander(over: Partial<LanderState> = {}): LanderState {
	return {
		x: 640,
		y: 400,
		vx: 0,
		vy: 0,
		angle: 0,
		angularVel: 0,
		fuel: 1000,
		thrusting: false,
		status: "flying",
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
	};
}

function makeTerrain(): TerrainData {
	// 3 points, pad at center spanning x=620..660 at y=500
	return {
		points: [
			{ x: 0, y: 500 },
			{ x: 640, y: 500 },
			{ x: 1280, y: 500 },
		],
		pads: [{ x: 620, y: 500, width: 40, points: 1 }],
		seed: 1,
	};
}

describe("calculateReward / calculateRewardBreakdown (Sprint 2.7)", () => {
	beforeEach(resetStateCache);

	it("calculateReward returns the same value as calculateRewardBreakdown().total", () => {
		const lander = makeLander();
		const terrain = makeTerrain();
		const scalar = calculateReward(lander, terrain, false, false);
		const bd = calculateRewardBreakdown(lander, terrain, false, false);
		expect(scalar).toBe(bd.total);
	});

	it("crash returns terminal −100 with zero shaping components", () => {
		const bd = calculateRewardBreakdown(
			makeLander(),
			makeTerrain(),
			false,
			true,
		);
		expect(bd.total).toBe(-100);
		expect(bd.terminal).toBe(-100);
		expect(bd.proximity).toBe(0);
		expect(bd.descent).toBe(0);
		expect(bd.anglePenalty).toBe(0);
	});

	it("perfect landing scales terminal reward up to 200", () => {
		// lander exactly on pad center, 0 speed, 0 angle
		const lander = makeLander({
			x: 640, // pad center
			y: 480,
			vx: 0,
			vy: 0,
			angle: 0,
		});
		const bd = calculateRewardBreakdown(lander, makeTerrain(), true, false);
		// speedFactor=1, angleFactor=1, centerFactor=1 → quality=1 → 200
		expect(bd.total).toBe(200);
	});

	it("worst acceptable landing returns ~100", () => {
		// high speed + tilted + off-center
		const lander = makeLander({
			x: 620, // pad edge (centerFactor low)
			vy: 2, // at MAX_LANDING_SPEED (speedFactor=0)
			angle: 10, // at max angle (angleFactor=0)
		});
		const bd = calculateRewardBreakdown(lander, makeTerrain(), true, false);
		// quality → 0, total → 100
		expect(bd.total).toBe(100);
	});

	it("mid-flight: non-zero shaping components sum to total", () => {
		const lander = makeLander({ x: 620, y: 400, vy: 1, angle: 5 });
		const bd = calculateRewardBreakdown(lander, makeTerrain(), false, false);
		const sum =
			bd.proximity +
			bd.descent +
			bd.speed +
			bd.anglePenalty +
			bd.approach +
			bd.timeTax;
		expect(bd.total).toBeCloseTo(sum, 6);
		expect(bd.terminal).toBe(0);
	});

	it("approach toward pad is rewarded more than drifting away", () => {
		const terrain = makeTerrain();
		const toward = makeLander({ x: 500, vx: 30, y: 400 }); // moving right toward pad
		const away = makeLander({ x: 500, vx: -30, y: 400 }); // moving left away
		const rToward = calculateRewardBreakdown(toward, terrain, false, false);
		const rAway = calculateRewardBreakdown(away, terrain, false, false);
		expect(rToward.approach).toBeGreaterThan(rAway.approach);
	});

	it("angle penalty grows with tilt", () => {
		const terrain = makeTerrain();
		const upright = makeLander({ angle: 0 });
		const tilted = makeLander({ angle: 45 });
		const rUpright = calculateRewardBreakdown(upright, terrain, false, false);
		const rTilted = calculateRewardBreakdown(tilted, terrain, false, false);
		expect(rTilted.anglePenalty).toBeLessThan(rUpright.anglePenalty);
	});
});

describe("getState (Sprint 2.7 — 11 dims)", () => {
	beforeEach(resetStateCache);

	it("returns 11 dimensions", () => {
		const s = getState(makeLander(), makeTerrain());
		expect(s).toHaveLength(STATE_SIZE);
		expect(s).toHaveLength(11);
	});

	it("angular velocity dim (5) is populated from lander.angularVel (not hardcoded 0)", () => {
		const s = getState(makeLander({ angularVel: 90 }), makeTerrain());
		expect(s[5]).toBeCloseTo(0.5, 3); // 90 / 180 = 0.5
	});

	it("vertical acceleration (dim 8) tracks vy deltas across calls", () => {
		resetStateCache();
		const t = makeTerrain();
		const s1 = getState(makeLander({ vy: 10 }), t);
		expect(s1[8]).toBeCloseTo(10 / 300, 3); // prevVy was 0
		const s2 = getState(makeLander({ vy: 30 }), t);
		expect(s2[8]).toBeCloseTo(20 / 300, 3); // delta 20
	});

	it("resetStateCache zeroes the accel history", () => {
		const t = makeTerrain();
		getState(makeLander({ vy: 50 }), t); // populate prevVy
		resetStateCache();
		const s = getState(makeLander({ vy: 10 }), t);
		expect(s[8]).toBeCloseTo(10 / 300, 3); // starts fresh
	});

	it("approach velocity (dim 10) positive when moving toward pad", () => {
		const t = makeTerrain();
		// Pad at x=640, lander at x=400 moving right → approaching
		const s = getState(makeLander({ x: 400, y: 450, vx: 50, vy: 0 }), t);
		expect(s[10]).toBeGreaterThan(0);
	});

	it("deterministic: same lander + terrain + cache state → same output", () => {
		const t = makeTerrain();
		const l = makeLander({ vy: 5 });
		resetStateCache();
		const s1 = getState(l, t);
		resetStateCache();
		const s2 = getState(l, t);
		expect(s1).toEqual(s2);
	});
});
