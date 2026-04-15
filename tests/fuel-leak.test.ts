import { describe, expect, it } from "vitest";
import { PhysicsManager } from "../src/game/PhysicsManager";

describe("fuel leak trigger", () => {
	it("activates on seed % 10 === 7 after 5 seconds", () => {
		const pm = new PhysicsManager();
		expect(pm.fuelLeakActive).toBe(false);

		const lander = makeLander();
		const terrain = makeTerrain();
		const input = noInput();

		for (let i = 0; i < 400; i++) {
			pm.step(0.016, lander, terrain, input, 1.62, null, null, null, 7, () => {});
		}
		expect(pm.fuelLeakActive).toBe(true);
	});

	it("does not activate on seeds where seed % 10 !== 7", () => {
		const pm = new PhysicsManager();
		const lander = makeLander();
		const terrain = makeTerrain();
		const input = noInput();

		for (let i = 0; i < 400; i++) {
			pm.step(0.016, lander, terrain, input, 1.62, null, null, null, 42, () => {});
		}
		expect(pm.fuelLeakActive).toBe(false);
	});

	it("drains fuel when active", () => {
		const pm = new PhysicsManager();
		const lander = makeLander();
		const terrain = makeTerrain();
		const input = noInput();

		for (let i = 0; i < 400; i++) {
			pm.step(0.016, lander, terrain, input, 1.62, null, null, null, 7, () => {});
		}
		expect(pm.fuelLeakActive).toBe(true);
		const fuelBefore = lander.fuel;
		pm.step(0.016, lander, terrain, input, 1.62, null, null, null, 7, () => {});
		expect(lander.fuel).toBeLessThan(fuelBefore);
	});

	it("resets on physics manager reset", () => {
		const pm = new PhysicsManager();
		const lander = makeLander();
		const terrain = makeTerrain();
		const input = noInput();

		for (let i = 0; i < 400; i++) {
			pm.step(0.016, lander, terrain, input, 1.62, null, null, null, 7, () => {});
		}
		expect(pm.fuelLeakActive).toBe(true);
		pm.reset();
		expect(pm.fuelLeakActive).toBe(false);
	});
});

function makeLander() {
	return {
		x: 640,
		y: 80,
		vx: 0,
		vy: 0,
		angle: 0,
		angularVel: 0,
		fuel: 1000,
		thrusting: false,
		status: "flying" as const,
		landerType: {
			name: "standard",
			thrustMultiplier: 1.0,
			rotationMultiplier: 1.0,
			massMultiplier: 1.0,
			fuelMultiplier: 1.0,
			description: "test",
		},
	};
}

function makeTerrain() {
	return {
		points: [
			{ x: 0, y: 600 },
			{ x: 1280, y: 600 },
		],
		pads: [],
		seed: 7,
	};
}

function noInput() {
	return {
		thrustUp: false,
		rotateLeft: false,
		rotateRight: false,
		restart: false,
		menuSelect: false,
		menuBack: false,
		menuUp: false,
		menuDown: false,
		exportGhost: false,
		importGhost: false,
		toggleAutopilot: false,
		toggleAnnotations: false,
		toggleRetroSkin: false,
		flightReport: false,
		toggleRelay: false,
		openSettings: false,
	};
}
