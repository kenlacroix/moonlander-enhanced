import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	GhostPlayer,
	GhostRecorder,
	importGhost,
	loadGhostForSeed,
} from "../src/systems/GhostReplay";
import type { InputState } from "../src/systems/Input";
import { installLocalStoragePolyfill } from "./helpers/localStorage";

beforeAll(installLocalStoragePolyfill);

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
		recorder.record({
			thrustUp: false,
			rotateLeft: true,
			rotateRight: false,
			restart: false,
		});

		// Recorder doesn't expose frames directly, but saving with score > 0
		// shouldn't throw (localStorage may not be available in test env)
		expect(() => recorder.save(100)).not.toThrow();
	});
});

describe("Sprint 5.5 — Ghost mode isolation", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("vanilla and authentic ghosts for the same seed are distinct slots", () => {
		const rec1 = new GhostRecorder();
		rec1.start(1969, "vanilla");
		rec1.record({
			thrustUp: true,
			rotateLeft: false,
			rotateRight: false,
		} as InputState);
		rec1.save(100);

		const rec2 = new GhostRecorder();
		rec2.start(1969, "authentic");
		rec2.record({
			thrustUp: false,
			rotateLeft: true,
			rotateRight: false,
		} as InputState);
		rec2.save(200);

		const vanilla = loadGhostForSeed(1969, "vanilla");
		const authentic = loadGhostForSeed(1969, "authentic");
		expect(vanilla?.score).toBe(100);
		expect(authentic?.score).toBe(200);
		expect(vanilla?.mode).toBe("vanilla");
		expect(authentic?.mode).toBe("authentic");
	});

	it("legacy ghost (no mode field) loads as vanilla", () => {
		localStorage.setItem(
			"moonlander-ghosts",
			JSON.stringify([{ seed: 42, score: 500, frames: [1, 0, 1] }]),
		);
		expect(loadGhostForSeed(42, "vanilla")?.score).toBe(500);
		expect(loadGhostForSeed(42, "authentic")).toBeNull();
	});

	it("imported ghost without mode field is saved as vanilla", () => {
		const raw = JSON.stringify({ seed: 99, score: 321, frames: [0, 1] });
		const imported = importGhost(raw);
		expect(imported?.mode).toBe("vanilla");
		expect(loadGhostForSeed(99, "vanilla")?.score).toBe(321);
		expect(loadGhostForSeed(99, "authentic")).toBeNull();
	});

	it("imported ghost with mode=authentic preserves mode", () => {
		const raw = JSON.stringify({
			seed: 99,
			score: 321,
			frames: [0, 1],
			mode: "authentic",
		});
		const imported = importGhost(raw);
		expect(imported?.mode).toBe("authentic");
		expect(loadGhostForSeed(99, "authentic")?.score).toBe(321);
		expect(loadGhostForSeed(99, "vanilla")).toBeNull();
	});

	/**
	 * GhostReplay.ts:86 — save() does a mode-scoped `find` and only
	 * overwrites the matching slot. Two things must hold:
	 *   1. Higher score in mode M overwrites the existing mode-M record.
	 *   2. A save in mode M must not touch a record in the *other* mode,
	 *      even when its score is lower than the incoming save.
	 * Without the mode-scoped find, an Authentic high score would silently
	 * clobber the vanilla best for the same seed.
	 */
	it("higher-score vanilla save overwrites vanilla slot but leaves authentic untouched", () => {
		// Seed both slots first.
		const rec1 = new GhostRecorder();
		rec1.start(1969, "vanilla");
		rec1.record({ thrustUp: true } as InputState);
		rec1.save(100);

		const rec2 = new GhostRecorder();
		rec2.start(1969, "authentic");
		rec2.record({ rotateLeft: true } as InputState);
		rec2.save(50);

		// New vanilla high score — higher than both existing records.
		const rec3 = new GhostRecorder();
		rec3.start(1969, "vanilla");
		rec3.record({ rotateRight: true } as InputState);
		rec3.record({ rotateRight: true } as InputState);
		rec3.save(500);

		// Vanilla slot was overwritten (higher score, new frames).
		const vanilla = loadGhostForSeed(1969, "vanilla");
		expect(vanilla?.score).toBe(500);
		expect(vanilla?.frames.length).toBe(2);

		// Authentic slot is completely untouched despite lower score.
		const authentic = loadGhostForSeed(1969, "authentic");
		expect(authentic?.score).toBe(50);
		expect(authentic?.frames.length).toBe(1);
	});

	it("lower-score save in same mode does not overwrite", () => {
		const rec1 = new GhostRecorder();
		rec1.start(1969, "authentic");
		rec1.record({ thrustUp: true } as InputState);
		rec1.record({ thrustUp: true } as InputState);
		rec1.save(400);

		const rec2 = new GhostRecorder();
		rec2.start(1969, "authentic");
		rec2.record({ rotateLeft: true } as InputState);
		rec2.save(100);

		// Original higher score and its frames are preserved.
		const ghost = loadGhostForSeed(1969, "authentic");
		expect(ghost?.score).toBe(400);
		expect(ghost?.frames.length).toBe(2);
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
