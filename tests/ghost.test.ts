import { describe, expect, it } from "vitest";
import { GhostRecorder, GhostPlayer } from "../src/systems/GhostReplay";
import type { InputState } from "../src/systems/Input";

describe("GhostRecorder", () => {
	it("records input frames", () => {
		const recorder = new GhostRecorder();
		recorder.start(42);

		const input: InputState = {
			thrustUp: true,
			rotateLeft: false,
			rotateRight: true,
			restart: false,
		};
		recorder.record(input);
		recorder.record({ thrustUp: false, rotateLeft: true, rotateRight: false, restart: false });

		// Recorder doesn't expose frames directly, but saving with score > 0
		// shouldn't throw (localStorage may not be available in test env)
		expect(() => recorder.save(100)).not.toThrow();
	});
});

describe("GhostPlayer", () => {
	it("replays frames and stops when done", () => {
		const run = {
			seed: 42,
			score: 100,
			frames: [1, 0, 5, 0, 0], // 5 frames of input
		};

		const player = new GhostPlayer(run);
		expect(player.isActive()).toBe(true);

		// Step through all frames
		for (let i = 0; i < 5; i++) {
			expect(player.step()).toBe(true);
		}

		// Next step should return false (no more frames)
		expect(player.step()).toBe(false);
		expect(player.isActive()).toBe(false);
	});

	it("updates lander position during replay", () => {
		// Frame value 1 = thrustUp, which applies thrust upward
		const run = {
			seed: 42,
			score: 100,
			frames: [0, 0, 0, 0, 0], // no thrust, just gravity
		};

		const player = new GhostPlayer(run);
		const startY = player.lander.y;

		player.step();
		player.step();

		// Gravity should have moved the lander down
		expect(player.lander.y).toBeGreaterThan(startY);
	});
});
