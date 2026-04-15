import { describe, expect, it } from "vitest";
import { HeadlessGame } from "../src/game/HeadlessGame";
import type { InputState } from "../src/systems/Input";
import { FIXED_TIMESTEP } from "../src/utils/constants";

const NO_INPUT: InputState = {
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
	forkTakeover: false,
};

describe("HeadlessGame", () => {
	it("creates terrain and lander from seed", () => {
		const game = new HeadlessGame(1969);
		expect(game.terrain.points.length).toBeGreaterThan(0);
		expect(game.terrain.pads.length).toBeGreaterThan(0);
		expect(game.lander.status).toBe("flying");
		expect(game.seed).toBe(1969);
	});

	it("produces deterministic terrain for the same seed", () => {
		const a = new HeadlessGame(42);
		const b = new HeadlessGame(42);
		expect(a.terrain.points).toEqual(b.terrain.points);
		expect(a.terrain.pads).toEqual(b.terrain.pads);
	});

	it("lander falls under gravity when no input", () => {
		const game = new HeadlessGame(1969);
		const initialY = game.lander.y;
		for (let i = 0; i < 60; i++) {
			game.step(NO_INPUT, FIXED_TIMESTEP);
		}
		expect(game.lander.y).toBeGreaterThan(initialY);
		expect(game.lander.vy).toBeGreaterThan(0);
	});

	it("eventually crashes if no thrust applied", () => {
		const game = new HeadlessGame(1969);
		let result = { done: false, landed: false, crashed: false, pad: null };
		for (let i = 0; i < 5000 && !result.done; i++) {
			result = game.step(NO_INPUT, FIXED_TIMESTEP);
		}
		expect(result.done).toBe(true);
		expect(result.crashed).toBe(true);
		expect(game.lander.status).toBe("crashed");
	});

	it("isDone returns true after collision", () => {
		const game = new HeadlessGame(1969);
		expect(game.isDone).toBe(false);
		for (let i = 0; i < 5000 && !game.isDone; i++) {
			game.step(NO_INPUT, FIXED_TIMESTEP);
		}
		expect(game.isDone).toBe(true);
	});

	it("reset restores lander to initial state", () => {
		const game = new HeadlessGame(1969);
		for (let i = 0; i < 5000 && !game.isDone; i++) {
			game.step(NO_INPUT, FIXED_TIMESTEP);
		}
		expect(game.isDone).toBe(true);
		game.reset();
		expect(game.isDone).toBe(false);
		expect(game.lander.status).toBe("flying");
		expect(game.lander.vy).toBe(0);
	});

	it("returns done=true on subsequent steps after collision", () => {
		const game = new HeadlessGame(1969);
		for (let i = 0; i < 5000 && !game.isDone; i++) {
			game.step(NO_INPUT, FIXED_TIMESTEP);
		}
		const extra = game.step(NO_INPUT, FIXED_TIMESTEP);
		expect(extra.done).toBe(true);
	});

	it("respects custom gravity option", () => {
		const normal = new HeadlessGame(1969);
		const heavy = new HeadlessGame(1969, { gravity: 9.81 });
		const low = new HeadlessGame(1969, { gravity: 0.5 });
		normal.step(NO_INPUT, FIXED_TIMESTEP);
		heavy.step(NO_INPUT, FIXED_TIMESTEP);
		low.step(NO_INPUT, FIXED_TIMESTEP);
		expect(heavy.lander.vy).not.toEqual(normal.lander.vy);
		expect(low.lander.vy).not.toEqual(normal.lander.vy);
		expect(low.lander.vy).toBeLessThan(heavy.lander.vy);
	});
});
