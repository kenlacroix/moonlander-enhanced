import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
	GhostPlayer,
	GhostRecorder,
	importGhost,
	loadGhostForSeed,
} from "../src/systems/GhostReplay";
import type { InputState } from "../src/systems/Input";

beforeAll(() => {
	if (
		typeof (globalThis as { localStorage?: Storage }).localStorage ===
		"undefined"
	) {
		const store = new Map<string, string>();
		(globalThis as { localStorage: Storage }).localStorage = {
			getItem: (k) => store.get(k) ?? null,
			setItem: (k, v) => {
				store.set(k, String(v));
			},
			removeItem: (k) => {
				store.delete(k);
			},
			clear: () => store.clear(),
			key: (i) => Array.from(store.keys())[i] ?? null,
			get length() {
				return store.size;
			},
		};
	}
});

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
