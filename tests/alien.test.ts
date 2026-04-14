import { describe, expect, it } from "vitest";
import {
	applyAlienEffect,
	createAlien,
	getAlienEffectLabel,
	shouldSpawnAlien,
	updateAlien,
} from "../src/game/Alien";
import { createLander } from "../src/game/Lander";
import { getLanderType } from "../src/game/LanderTypes";

describe("shouldSpawnAlien", () => {
	it("is deterministic for the same seed", () => {
		const a = shouldSpawnAlien(1969);
		const b = shouldSpawnAlien(1969);
		expect(a).toBe(b);
	});

	it("respects aliensEnabled override", () => {
		expect(shouldSpawnAlien(1, { aliensEnabled: true })).toBe(true);
		expect(shouldSpawnAlien(1, { aliensEnabled: false })).toBe(false);
	});

	it("spawns on roughly 30% of seeds", () => {
		let count = 0;
		for (let seed = 0; seed < 100; seed++) {
			if (shouldSpawnAlien(seed)) count++;
		}
		expect(count).toBeGreaterThan(15);
		expect(count).toBeLessThan(45);
	});
});

describe("alien determinism", () => {
	it("produces identical state from the same seed", () => {
		const a1 = createAlien(42);
		const a2 = createAlien(42);

		// Run 100 ticks
		for (let i = 0; i < 100; i++) {
			updateAlien(a1, 2000, 300, 1 / 60, i / 60);
			updateAlien(a2, 2000, 300, 1 / 60, i / 60);
		}

		expect(a1.x).toBe(a2.x);
		expect(a1.y).toBe(a2.y);
		expect(a1.cooldownTimer).toBe(a2.cooldownTimer);
		expect(a1.activeEffect?.type).toBe(a2.activeEffect?.type);
	});
});

describe("alien effects", () => {
	it("controls-reversed swaps left and right", () => {
		const alien = createAlien(42);
		alien.activeEffect = { type: "controls-reversed" };
		const lander = createLander(2000, 300, getLanderType());
		const input = {
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
		};
		const result = applyAlienEffect(alien, lander, input, 1 / 60);
		expect(result.rotateLeft).toBe(false);
		expect(result.rotateRight).toBe(true);
	});

	it("fuel-siphon drains fuel", () => {
		const alien = createAlien(42);
		alien.activeEffect = { type: "fuel-siphon" };
		const lander = createLander(2000, 300, getLanderType());
		const startFuel = lander.fuel;
		const input = {
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
		};
		applyAlienEffect(alien, lander, input, 1);
		expect(lander.fuel).toBeLessThan(startFuel);
	});

	it("getAlienEffectLabel returns null when no effect active", () => {
		const alien = createAlien(42);
		expect(getAlienEffectLabel(alien)).toBeNull();
	});

	it("getAlienEffectLabel returns label when effect active", () => {
		const alien = createAlien(42);
		alien.activeEffect = { type: "drag" };
		expect(getAlienEffectLabel(alien)).toBe("APPLYING DRAG");
	});
});
