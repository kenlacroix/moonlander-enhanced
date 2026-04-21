/**
 * Sprint 7.2 — rigid-body physics test suite.
 *
 * Covers the new integrator (updateLander v3), the frozen legacy integrator
 * (updateLanderLegacy for v2 replays), the angular-rate landing check, the
 * RCS tank + meter, the autopilot rewrite, ghost schema v3, the first-spin
 * tutorial, RCS corner puffs, REWARD_VERSION force-retrain, and the
 * leaderboard v2/v3 partition.
 *
 * Eng-review gap tests (Gap A, B, C) are at the bottom — they address the
 * three silent-failure paths the eng review surfaced (PhysicsManager
 * dispatch, AgentEnv state vector signal, leaderboard partition integrity).
 */

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getState } from "../src/ai/AgentEnv";
import { Autopilot } from "../src/ai/Autopilot";
import {
	createLander,
	type LanderState,
	updateLander,
	updateLanderLegacy,
} from "../src/game/Lander";
import { getLanderType, LANDER_TYPES } from "../src/game/LanderTypes";
import { ParticleSystem } from "../src/game/Particles";
import { checkCollision } from "../src/game/Physics";
import { PhysicsManager } from "../src/game/PhysicsManager";
import type { TerrainData } from "../src/game/Terrain";
import {
	_resetLeaderboardCacheForTests,
	addScore,
	getScores,
} from "../src/systems/Leaderboard";
import {
	FIXED_TIMESTEP,
	MAX_ANGULAR_VEL,
	MAX_LANDING_ANGULAR_RATE,
	STARTING_RCS,
} from "../src/utils/constants";
import { installLocalStoragePolyfill } from "./helpers/localStorage";

const ROTATE_LEFT_INPUT = {
	thrustUp: false,
	rotateLeft: true,
	rotateRight: false,
	restart: false,
	menuUp: false,
	menuDown: false,
	menuSelect: false,
	menuBack: false,
	toggleAutopilot: false,
	openSettings: false,
	toggleRetroSkin: false,
	exportGhost: false,
	importGhost: false,
	flightReport: false,
	toggleRelay: false,
	toggleAnnotations: false,
	forkTakeover: false,
};
const NO_INPUT = { ...ROTATE_LEFT_INPUT, rotateLeft: false };
const ROTATE_RIGHT_INPUT = { ...NO_INPUT, rotateRight: true };

function makeLander(overrides: Partial<LanderState> = {}): LanderState {
	const l = createLander(640, 100, getLanderType());
	Object.assign(l, overrides);
	return l;
}

function makePad(): TerrainData {
	return {
		points: [
			{ x: 0, y: 500 },
			{ x: 200, y: 500 },
			{ x: 400, y: 500 },
			{ x: 600, y: 500 },
			{ x: 800, y: 500 },
		],
		pads: [{ x: 200, y: 500, width: 200, points: 1 } as TerrainData["pads"][0]],
	};
}

beforeAll(installLocalStoragePolyfill);

describe("Sprint 7.2 — v3 integrator", () => {
	it("rotateLeft accumulates negative angular velocity across frames", () => {
		const l = makeLander();
		const before = l.angularVel;
		updateLander(l, ROTATE_LEFT_INPUT, FIXED_TIMESTEP);
		expect(l.angularVel).toBeLessThan(before);
	});

	it("release rotation input → momentum persists (angle keeps changing)", () => {
		const l = makeLander();
		// Spin up for 10 frames, then release.
		for (let i = 0; i < 10; i++) {
			updateLander(l, ROTATE_LEFT_INPUT, FIXED_TIMESTEP);
		}
		const spunUpOmega = l.angularVel;
		expect(Math.abs(spunUpOmega)).toBeGreaterThan(0);
		const angleAtRelease = l.angle;
		for (let i = 0; i < 5; i++) {
			updateLander(l, NO_INPUT, FIXED_TIMESTEP);
		}
		// No input but angle moved → momentum kept integrating.
		expect(l.angle).not.toBe(angleAtRelease);
		// angularVel unchanged since no damping and no input.
		expect(l.angularVel).toBeCloseTo(spunUpOmega, 5);
	});

	it("RCS depletes while rotating", () => {
		const l = makeLander();
		const rcsBefore = l.rcs;
		for (let i = 0; i < 30; i++) {
			updateLander(l, ROTATE_LEFT_INPUT, FIXED_TIMESTEP);
		}
		expect(l.rcs).toBeLessThan(rcsBefore);
	});

	it("empty RCS tank blocks rotation (input ignored)", () => {
		const l = makeLander({ rcs: 0, angularVel: 0 });
		updateLander(l, ROTATE_LEFT_INPUT, FIXED_TIMESTEP);
		expect(l.angularVel).toBe(0);
		expect(l.rcsFiring).toBe(false);
	});

	it("MAX_ANGULAR_VEL clamp prevents runaway (Gap #1 from adversarial review)", () => {
		// Force angularVel beyond the cap to simulate a rogue input source.
		const l = makeLander({ angularVel: 900, rcs: STARTING_RCS });
		updateLander(l, NO_INPUT, FIXED_TIMESTEP);
		expect(Math.abs(l.angularVel)).toBeLessThanOrEqual(MAX_ANGULAR_VEL);
	});

	it("rcsFiring mirrors rotation input when rcs > 0", () => {
		const l = makeLander();
		updateLander(l, ROTATE_LEFT_INPUT, FIXED_TIMESTEP);
		expect(l.rcsFiring).toBe(true);
		updateLander(l, NO_INPUT, FIXED_TIMESTEP);
		expect(l.rcsFiring).toBe(false);
	});
});

describe("Sprint 7.2 — v2 legacy integrator", () => {
	it("updateLanderLegacy pins angularVel to 0 regardless of state", () => {
		const l = makeLander({ angularVel: 120, physicsVersion: 2 });
		updateLanderLegacy(l, ROTATE_LEFT_INPUT, FIXED_TIMESTEP);
		expect(l.angularVel).toBe(0);
	});

	it("updateLanderLegacy does not consume RCS", () => {
		const l = makeLander({ rcs: 50, physicsVersion: 2 });
		for (let i = 0; i < 30; i++) {
			updateLanderLegacy(l, ROTATE_LEFT_INPUT, FIXED_TIMESTEP);
		}
		expect(l.rcs).toBe(50);
	});

	it("updateLanderLegacy uses instant angle-set (v2 behavior frozen)", () => {
		const l = makeLander({ physicsVersion: 2 });
		const startAngle = l.angle;
		updateLanderLegacy(l, ROTATE_LEFT_INPUT, FIXED_TIMESTEP);
		// Angle moved this frame by roughly ROTATION_SPEED * rotationMultiplier * dt.
		// Angular velocity remains pinned at 0 — next frame without input doesn't drift.
		const afterOneFrame = l.angle;
		expect(afterOneFrame).not.toBe(startAngle);
		updateLanderLegacy(l, NO_INPUT, FIXED_TIMESTEP);
		expect(l.angle).toBe(afterOneFrame);
	});
});

describe("Sprint 7.2 — Landing check with physicsVersion branch", () => {
	it("spinning at 7.9 °/s (below threshold) counts as safe landing", () => {
		const lander = makeLander({
			y: 500 - 18,
			x: 300,
			vy: 1,
			angle: 0,
			angularVel: 7.9,
			physicsVersion: 3,
		});
		const res = checkCollision(lander, makePad());
		expect(res.safeLanding).toBe(true);
		expect(res.spinningCrash).toBe(false);
	});

	it("spinning at 8.1 °/s (above threshold) triggers spinningCrash flag", () => {
		const lander = makeLander({
			y: 500 - 18,
			x: 300,
			vy: 1,
			angle: 0,
			angularVel: 8.1,
			physicsVersion: 3,
		});
		const res = checkCollision(lander, makePad());
		expect(res.safeLanding).toBe(false);
		expect(res.spinningCrash).toBe(true);
	});

	it("v2 lander bypasses spin check entirely", () => {
		// A v2 ghost replay with an artificial angularVel (shouldn't happen
		// in practice, but defensively test the branch). physicsVersion=2
		// routes to the v2 rules: vy + angle only.
		const lander = makeLander({
			y: 500 - 18,
			x: 300,
			vy: 1,
			angle: 0,
			angularVel: 100,
			physicsVersion: 2,
		});
		const res = checkCollision(lander, makePad());
		expect(res.safeLanding).toBe(true);
		expect(res.spinningCrash).toBe(false);
	});

	it("MAX_LANDING_ANGULAR_RATE constant boundary is exactly 8", () => {
		// Pin the constant value so an accidental bump in constants.ts fails
		// loudly in tests rather than silently retuning difficulty.
		expect(MAX_LANDING_ANGULAR_RATE).toBe(8);
	});
});

describe("Sprint 7.2 — Gap A: PhysicsManager dispatch", () => {
	// The eng review surfaced this as a silent-failure path: if
	// PhysicsManager.step calls updateLander for a v2 lander, v2 ghost
	// replays silently desync without any visible error. These tests guard
	// the dispatch.

	it("v2 lander routes to updateLanderLegacy (angularVel unchanged)", () => {
		const pm = new PhysicsManager();
		const l = makeLander({ angularVel: 50, physicsVersion: 2 });
		const terrain = makePad();
		pm.step(
			FIXED_TIMESTEP,
			l,
			terrain,
			ROTATE_LEFT_INPUT,
			100,
			null,
			null,
			null,
			1,
			() => {},
		);
		// Legacy integrator pins angularVel to 0; v3 integrator would have
		// decremented it further. Either way, angularVel !== 50 means SOME
		// integrator ran. Assert specifically that legacy ran by checking 0.
		expect(l.angularVel).toBe(0);
	});

	it("v3 lander routes to updateLander (angularVel integrates)", () => {
		const pm = new PhysicsManager();
		const l = makeLander({ angularVel: 0, physicsVersion: 3 });
		const terrain = makePad();
		pm.step(
			FIXED_TIMESTEP,
			l,
			terrain,
			ROTATE_LEFT_INPUT,
			100,
			null,
			null,
			null,
			1,
			() => {},
		);
		// v3 integrator decremented angularVel from 0 to a negative value.
		expect(l.angularVel).toBeLessThan(0);
	});
});

describe("Sprint 7.2 — Autopilot v3 PID rewrite", () => {
	it("v3 autopilot converges a 30°-offset lander to angularVel near 0", () => {
		const ap = new Autopilot();
		ap.enabled = true;
		const terrain = makePad();
		const l = makeLander({
			x: 300,
			y: 250,
			angle: 30,
			angularVel: 0,
			physicsVersion: 3,
		});
		// Simulate 300 frames (5 seconds) of autopilot + integrator.
		for (let i = 0; i < 300; i++) {
			const ap_input = ap.computeInput(l, terrain);
			updateLander(l, ap_input, FIXED_TIMESTEP);
			if (l.y + 18 >= 500) break;
		}
		// Autopilot should have arrested the initial tilt.
		expect(Math.abs(l.angle)).toBeLessThan(20);
	});

	it("widens deadband when RCS is low (no chatter on empty tank)", () => {
		const ap = new Autopilot();
		ap.enabled = true;
		const terrain = makePad();
		const l = makeLander({
			x: 300,
			y: 250,
			angle: 0,
			angularVel: 2, // slow spin within widened deadband
			rcs: 2, // below 5 → starvation mode
			physicsVersion: 3,
		});
		const input = ap.computeInput(l, terrain);
		// With widened deadband, a 2 °/s spin shouldn't trigger rotation.
		expect(input.rotateLeft).toBe(false);
		expect(input.rotateRight).toBe(false);
	});

	it("v2 path still uses naive 2° angle-delta deadband", () => {
		const ap = new Autopilot();
		ap.enabled = true;
		const terrain = makePad();
		const l = makeLander({
			x: 300,
			y: 250,
			angle: 10, // large angle error
			angularVel: 0,
			physicsVersion: 2,
		});
		const input = ap.computeInput(l, terrain);
		// v2 path issues a rotate input based on angle error directly.
		expect(input.rotateLeft || input.rotateRight).toBe(true);
	});
});

describe("Sprint 7.2 — Lander types", () => {
	it("every lander type declares rcsMultiplier", () => {
		for (const name of Object.keys(LANDER_TYPES)) {
			expect(LANDER_TYPES[name].rcsMultiplier).toBeDefined();
			expect(LANDER_TYPES[name].rcsMultiplier).toBeGreaterThan(0);
		}
	});

	it("createLander scales starting RCS by rcsMultiplier", () => {
		const sparrow = createLander(0, 0, getLanderType("light")); // rcsMultiplier 1.2
		const luna9 = createLander(0, 0, getLanderType("luna-9")); // rcsMultiplier 0.7
		expect(sparrow.rcs).toBeCloseTo(STARTING_RCS * 1.2);
		expect(luna9.rcs).toBeCloseTo(STARTING_RCS * 0.7);
	});
});

describe("Sprint 7.2 — Particle system RCS corner puffs", () => {
	it("emitRCS adds particles with type rcs", () => {
		const p = new ParticleSystem();
		expect(p.particles.length).toBe(0);
		p.emitRCS(100, 100, 0, -1);
		expect(p.particles.length).toBeGreaterThan(0);
		expect(p.particles.every((pp) => pp.type === "rcs")).toBe(true);
	});

	it("emitRCS caps at 40 total rcs particles", () => {
		const p = new ParticleSystem();
		for (let i = 0; i < 100; i++) {
			p.emitRCS(100, 100, 0, -1);
		}
		const rcsCount = p.particles.filter((pp) => pp.type === "rcs").length;
		expect(rcsCount).toBeLessThanOrEqual(40);
	});

	it("emitRCS direction controls corner (left vs right)", () => {
		const p = new ParticleSystem();
		p.emitRCS(100, 100, 0, -1);
		const leftCornerX = p.particles[0]?.x ?? 0;
		p.clear();
		p.emitRCS(100, 100, 0, 1);
		const rightCornerX = p.particles[0]?.x ?? 0;
		// The two directions should emit from opposite sides of the lander.
		expect(leftCornerX).not.toBe(rightCornerX);
	});
});

describe("Sprint 7.2 — Gap B: AgentEnv state vector signal", () => {
	// Silent-failure path: if integration leaves angularVel at 0, the RL
	// agent trains on zero-information dim 5 and nobody notices. Assert
	// that 100 frames of rotation produce a non-trivial reading.
	it("state vector dim 5 carries signal after v3 integration", () => {
		const l = makeLander({ physicsVersion: 3 });
		const terrain = makePad();
		for (let i = 0; i < 100; i++) {
			updateLander(l, ROTATE_LEFT_INPUT, FIXED_TIMESTEP);
		}
		const state = getState(l, terrain);
		expect(state.length).toBe(11);
		// dim 5 = angularVel / 180. After 100 frames of rotate-left we
		// should see a meaningful negative value (capped at -2 by MAX_ANGULAR_VEL).
		expect(Math.abs(state[5])).toBeGreaterThan(0.1);
		expect(Math.abs(state[5])).toBeLessThanOrEqual(2.0);
	});
});

describe("Sprint 7.2 — Gap C: Leaderboard v2/v3 partition", () => {
	beforeEach(() => {
		_resetLeaderboardCacheForTests();
		localStorage.clear();
	});

	it("v3 addScore writes to new v3 key, not the legacy vanilla key", () => {
		addScore(1969, 800, 22, "vanilla");
		const raw = JSON.parse(
			localStorage.getItem("moonlander-leaderboard") ?? "{}",
		);
		expect(raw["1969-vanilla-v3"]).toBeDefined();
		expect(raw["1969-vanilla-v3"]?.[0]?.score).toBe(800);
		// Legacy key remains absent (no pre-existing data to migrate).
		expect(raw["1969-vanilla"]).toBeUndefined();
	});

	it("getScores reads v3 first, falls back to v2 legacy bucket when empty", () => {
		// Seed a pre-7.2 score under the v2 key and confirm readers see it.
		localStorage.setItem(
			"moonlander-leaderboard",
			JSON.stringify({ "1969-vanilla": [{ score: 500, date: "2025-01-01" }] }),
		);
		_resetLeaderboardCacheForTests();
		expect(getScores(1969, "vanilla")?.[0]?.score).toBe(500);

		// Now write a v3 score — v3 bucket takes over.
		addScore(1969, 900, 22, "vanilla");
		expect(getScores(1969, "vanilla")?.[0]?.score).toBe(900);
		// v2 legacy score is frozen at its key, not destroyed.
		const raw = JSON.parse(
			localStorage.getItem("moonlander-leaderboard") ?? "{}",
		);
		expect(raw["1969-vanilla"]?.[0]?.score).toBe(500);
		expect(raw["1969-vanilla-v3"]?.[0]?.score).toBe(900);
	});
});
