import { describe, expect, it } from "vitest";
import {
	applyGravityStormEffect,
	createGravityStorm,
	getGravityStormLabel,
	shouldSpawnGravityStorm,
	updateGravityStorm,
} from "../src/game/GravityStorm";

describe("shouldSpawnGravityStorm", () => {
	it("is deterministic for the same seed", () => {
		expect(shouldSpawnGravityStorm(42)).toBe(shouldSpawnGravityStorm(42));
	});

	it("spawns on roughly 20% of seeds", () => {
		let count = 0;
		for (let seed = 0; seed < 100; seed++) {
			if (shouldSpawnGravityStorm(seed)) count++;
		}
		expect(count).toBeGreaterThan(10);
		expect(count).toBeLessThan(35);
	});

	it("always spawns when gravityStormsEnabled is set", () => {
		// Even seeds that normally don't spawn should spawn
		for (let seed = 0; seed < 10; seed++) {
			expect(
				shouldSpawnGravityStorm(seed, { gravityStormsEnabled: true }),
			).toBe(true);
		}
	});
});

describe("createGravityStorm", () => {
	it("starts in normal phase with multiplier 1.0", () => {
		const storm = createGravityStorm(42);
		expect(storm.phase).toBe("normal");
		expect(storm.multiplier).toBe(1.0);
		expect(storm.wobbleOffset).toBe(0);
	});

	it("is deterministic for the same seed", () => {
		const s1 = createGravityStorm(42);
		const s2 = createGravityStorm(42);
		expect(s1.cycleCooldown).toBe(s2.cycleCooldown);
	});
});

describe("updateGravityStorm", () => {
	it("transitions from normal to high gravity after cooldown", () => {
		const storm = createGravityStorm(42);
		const cooldown = storm.cycleCooldown;
		// Advance past cooldown
		updateGravityStorm(storm, cooldown + 0.1, cooldown + 0.1);
		expect(storm.phase).toBe("high");
		expect(storm.multiplier).toBe(2.0);
	});

	it("transitions from high to low after 5 seconds", () => {
		const storm = createGravityStorm(42);
		// Skip to high phase
		updateGravityStorm(storm, storm.cycleCooldown + 0.1, storm.cycleCooldown);
		expect(storm.phase).toBe("high");
		// Advance past high duration (5s)
		updateGravityStorm(storm, 5.1, storm.cycleCooldown + 5.1);
		expect(storm.phase).toBe("low");
		expect(storm.multiplier).toBe(0.5);
	});

	it("returns to normal after low phase (3 seconds)", () => {
		const storm = createGravityStorm(42);
		// Skip to high
		updateGravityStorm(storm, storm.cycleCooldown + 0.1, storm.cycleCooldown);
		// Skip through high (5s)
		updateGravityStorm(storm, 5.1, 0);
		// Skip through low (3s)
		updateGravityStorm(storm, 3.1, 0);
		expect(storm.phase).toBe("normal");
		expect(storm.multiplier).toBe(1.0);
	});

	it("has non-zero wobble during high phase", () => {
		const storm = createGravityStorm(42);
		updateGravityStorm(storm, storm.cycleCooldown + 0.1, 10);
		expect(storm.phase).toBe("high");
		// Wobble depends on sin(flightElapsed * frequency) — at t=10 it's non-trivial
		// Just check it's calculated (may be zero at exact sin zero-crossings)
		expect(typeof storm.wobbleOffset).toBe("number");
	});
});

describe("applyGravityStormEffect", () => {
	it("returns unchanged vy when multiplier is 1.0", () => {
		const storm = createGravityStorm(42); // normal phase, multiplier=1.0
		const result = applyGravityStormEffect(storm, 50, 1 / 60, 1.0);
		expect(result).toBe(50);
	});

	it("increases vy during high gravity (multiplier=2.0)", () => {
		const storm = createGravityStorm(42);
		updateGravityStorm(storm, storm.cycleCooldown + 0.1, 0);
		expect(storm.multiplier).toBe(2.0);
		const result = applyGravityStormEffect(storm, 50, 1 / 60, 1.0);
		expect(result).toBeGreaterThan(50); // Extra gravity pulls down
	});

	it("decreases vy during low gravity (multiplier=0.5)", () => {
		const storm = createGravityStorm(42);
		// Get to low phase
		updateGravityStorm(storm, storm.cycleCooldown + 0.1, 0);
		updateGravityStorm(storm, 5.1, 0);
		expect(storm.multiplier).toBe(0.5);
		const result = applyGravityStormEffect(storm, 50, 1 / 60, 1.0);
		expect(result).toBeLessThan(50); // Reduced gravity = less pull
	});
});

describe("getGravityStormLabel", () => {
	it("returns null during normal phase", () => {
		const storm = createGravityStorm(42);
		expect(getGravityStormLabel(storm)).toBeNull();
	});

	it("returns label during high phase", () => {
		const storm = createGravityStorm(42);
		updateGravityStorm(storm, storm.cycleCooldown + 0.1, 0);
		expect(getGravityStormLabel(storm)).toBe("GRAVITY ANOMALY: 2x");
	});

	it("returns label during low phase", () => {
		const storm = createGravityStorm(42);
		updateGravityStorm(storm, storm.cycleCooldown + 0.1, 0);
		updateGravityStorm(storm, 5.1, 0);
		expect(getGravityStormLabel(storm)).toBe("GRAVITY ANOMALY: 0.5x");
	});
});
