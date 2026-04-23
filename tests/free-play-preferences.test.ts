/**
 * v0.6.3.0 — Free Play Sandbox preferences.
 *
 * Tests for the GamePreferences module + the pure resolveFlightPolicy
 * helper that gates per-flight physics and hazard behavior. Plus
 * integration tests that exercise the policy through createLander +
 * PhysicsManager + Game.reset paths.
 *
 * Schema decisions covered:
 * - Free Play defaults: physics v2, all hazards OFF (decision #2, #3)
 * - Campaign per-mission physicsVersion ramp (decision #5)
 * - Pure resolveFlightPolicy with no Game-class state (decision #6)
 * - Defensive localStorage paths (missing key, malformed JSON)
 */

import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createLander } from "../src/game/Lander";
import { getLanderType } from "../src/game/LanderTypes";
import type { Mission } from "../src/game/Missions";
import { CAMPAIGN } from "../src/game/Missions";
import { PhysicsManager } from "../src/game/PhysicsManager";
import type { TerrainData } from "../src/game/Terrain";
import {
	type GamePreferences,
	loadGamePreferences,
	resolveFlightPolicy,
	saveGamePreferences,
} from "../src/systems/GamePreferences";
import { vec2 } from "../src/utils/math";
import { installLocalStoragePolyfill } from "./helpers/localStorage";

const STORAGE_KEY = "moonlander-game-prefs";

function clearPrefs(): void {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// ignore
	}
}

beforeAll(installLocalStoragePolyfill);
beforeEach(clearPrefs);

// ============================================================================
// Tests 1-4: localStorage layer (load + save + defensive paths)
// ============================================================================

describe("loadGamePreferences / saveGamePreferences", () => {
	it("loadGamePreferences returns empty object when localStorage missing", () => {
		clearPrefs();
		expect(loadGamePreferences()).toEqual({});
	});

	it("loadGamePreferences returns empty object on malformed JSON (defensive)", () => {
		localStorage.setItem(STORAGE_KEY, "{not valid json");
		expect(loadGamePreferences()).toEqual({});
	});

	it("saveGamePreferences + load round-trip preserves physicsV3", () => {
		saveGamePreferences({ physicsV3: true });
		expect(loadGamePreferences().physicsV3).toBe(true);
	});

	it("saveGamePreferences + load round-trip preserves all hazard flags", () => {
		saveGamePreferences({ aliens: true, storms: true, fuelLeaks: true });
		const loaded = loadGamePreferences();
		expect(loaded.aliens).toBe(true);
		expect(loaded.storms).toBe(true);
		expect(loaded.fuelLeaks).toBe(true);
	});
});

// ============================================================================
// Tests 5-13: resolveFlightPolicy — every branch
// ============================================================================

describe("resolveFlightPolicy", () => {
	const noMission: Mission | null = null;
	const emptyPrefs: GamePreferences = {};

	it("Free Play + no prefs → v2 + all hazards OFF (defaults)", () => {
		const policy = resolveFlightPolicy("freeplay", noMission, emptyPrefs);
		expect(policy.physicsVersion).toBe(2);
		expect(policy.aliens).toBe(false);
		expect(policy.storms).toBe(false);
		expect(policy.fuelLeaks).toBe(false);
	});

	it("Free Play + physicsV3=true → physicsVersion 3", () => {
		const policy = resolveFlightPolicy("freeplay", noMission, {
			physicsV3: true,
		});
		expect(policy.physicsVersion).toBe(3);
	});

	it("Free Play + aliens=true → aliens enabled", () => {
		const policy = resolveFlightPolicy("freeplay", noMission, { aliens: true });
		expect(policy.aliens).toBe(true);
	});

	it("Free Play + storms=true → storms enabled", () => {
		const policy = resolveFlightPolicy("freeplay", noMission, { storms: true });
		expect(policy.storms).toBe(true);
	});

	it("Free Play + fuelLeaks=true → fuelLeaks enabled", () => {
		const policy = resolveFlightPolicy("freeplay", noMission, {
			fuelLeaks: true,
		});
		expect(policy.fuelLeaks).toBe(true);
	});

	it("Campaign + mission.difficulty.physicsVersion=2 → v2 (the ramp)", () => {
		const mission: Mission = {
			id: 1,
			name: "TEST",
			seed: 1,
			description: "",
			difficulty: { physicsVersion: 2 },
		};
		const policy = resolveFlightPolicy("campaign", mission, {});
		expect(policy.physicsVersion).toBe(2);
		expect(policy.aliens).toBe(true);
		expect(policy.storms).toBe(true);
		expect(policy.fuelLeaks).toBe(true);
	});

	it("Campaign + mission with no physicsVersion override → v3 (default)", () => {
		const mission: Mission = {
			id: 1,
			name: "TEST",
			seed: 1,
			description: "",
			difficulty: { roughness: 0.5 },
		};
		const policy = resolveFlightPolicy("campaign", mission, {});
		expect(policy.physicsVersion).toBe(3);
	});

	it("Historic + any prefs → v3 + all hazards true (ignore prefs)", () => {
		const policy = resolveFlightPolicy("historic", noMission, {
			physicsV3: false,
			aliens: false,
			storms: false,
		});
		expect(policy.physicsVersion).toBe(3);
		expect(policy.aliens).toBe(true);
		expect(policy.storms).toBe(true);
		expect(policy.fuelLeaks).toBe(true);
	});

	it("AI Theater + any prefs → v3 + all hazards true (ignore prefs)", () => {
		const policy = resolveFlightPolicy("ai-theater", noMission, {
			physicsV3: false,
			aliens: false,
		});
		expect(policy.physicsVersion).toBe(3);
		expect(policy.aliens).toBe(true);
	});
});

// ============================================================================
// Tests 14-18: Integration — policy actually flows into Lander + PhysicsManager
// ============================================================================

describe("Integration — policy flows into spawn + physics", () => {
	function makeFlatPad(): TerrainData {
		return {
			points: [
				vec2(0, 500),
				vec2(200, 500),
				vec2(400, 500),
				vec2(600, 500),
				vec2(800, 500),
			],
			pads: [{ x: 200, y: 500, width: 200, points: 1 }],
			seed: 1,
		};
	}

	const NULL_INPUT = {
		thrustUp: false,
		rotateLeft: false,
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

	it("createLander with physicsVersion=2 produces v2 lander (no RCS tank usage)", () => {
		const lander = createLander(100, 100, getLanderType(), undefined, 2);
		expect(lander.physicsVersion).toBe(2);
		// Sanity: v2 dispatch through PhysicsManager pins angularVel at 0
		// even when rotate input fires, because updateLanderLegacy doesn't
		// integrate angular momentum.
		const pm = new PhysicsManager();
		pm.step(
			1 / 60,
			lander,
			makeFlatPad(),
			{ ...NULL_INPUT, rotateLeft: true },
			100,
			null,
			null,
			null,
			1,
			() => {},
		);
		expect(lander.angularVel).toBe(0);
	});

	it("Campaign Mission 1 (FIRST CONTACT) data has physicsVersion:2 (the ramp)", () => {
		const mission1 = CAMPAIGN.find((m) => m.id === 1);
		expect(mission1?.difficulty?.physicsVersion).toBe(2);
		const policy = resolveFlightPolicy("campaign", mission1 ?? null, {});
		expect(policy.physicsVersion).toBe(2);
	});

	it("Campaign Mission 4 (NEEDLE THREADING) data forces v3 + aliens + storms", () => {
		const mission4 = CAMPAIGN.find((m) => m.id === 4);
		expect(mission4?.difficulty?.physicsVersion).toBe(3);
		expect(mission4?.difficulty?.aliensEnabled).toBe(true);
		expect(mission4?.difficulty?.gravityStormsEnabled).toBe(true);
		const policy = resolveFlightPolicy("campaign", mission4 ?? null, {});
		expect(policy.physicsVersion).toBe(3);
	});

	it("PhysicsManager fuel-leak path skipped when policy.fuelLeaks=false (seed 17 would otherwise fire)", () => {
		const pm = new PhysicsManager();
		pm.reset();
		pm.setHazardPolicy({
			physicsVersion: 2,
			aliens: false,
			storms: false,
			fuelLeaks: false,
		});
		const lander = createLander(100, 100, getLanderType(), undefined, 2);
		// Use seed 17 — would normally trigger fuel leak (17 % 10 === 7).
		// Step through 6 simulated seconds (past the 5s trigger threshold).
		// Step for 6 simulated seconds. Don't break on crash — PhysicsManager.step
		// keeps incrementing flightElapsed and the fuel-leak trigger fires at
		// t > 5s regardless of lander.status. Tests the fuel-leak gate, not
		// the lander integrator.
		for (let i = 0; i < 60 * 6; i++) {
			pm.step(
				1 / 60,
				lander,
				makeFlatPad(),
				NULL_INPUT,
				100,
				null,
				null,
				null,
				17,
				() => {},
			);
		}
		expect(pm.fuelLeakActive).toBe(false);
	});

	it("PhysicsManager fuel-leak path FIRES when policy.fuelLeaks=true on seed 17 (gating works both ways)", () => {
		const pm = new PhysicsManager();
		pm.reset();
		pm.setHazardPolicy({
			physicsVersion: 2,
			aliens: false,
			storms: false,
			fuelLeaks: true,
		});
		const lander = createLander(100, 100, getLanderType(), undefined, 2);
		// Step for 6 simulated seconds. Don't break on crash — PhysicsManager.step
		// keeps incrementing flightElapsed and the fuel-leak trigger fires at
		// t > 5s regardless of lander.status. Tests the fuel-leak gate, not
		// the lander integrator.
		for (let i = 0; i < 60 * 6; i++) {
			pm.step(
				1 / 60,
				lander,
				makeFlatPad(),
				NULL_INPUT,
				100,
				null,
				null,
				null,
				17,
				() => {},
			);
		}
		expect(pm.fuelLeakActive).toBe(true);
	});
});
