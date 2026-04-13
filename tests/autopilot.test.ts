import { describe, expect, it } from "vitest";
import { Autopilot } from "../src/ai/Autopilot";
import { createLander } from "../src/game/Lander";
import { getLanderType } from "../src/game/LanderTypes";
import { generateTerrain } from "../src/game/Terrain";
import { vec2 } from "../src/utils/math";

describe("Autopilot", () => {
	const terrain = generateTerrain(1969);
	const landerType = getLanderType();

	it("starts disabled", () => {
		const ap = new Autopilot();
		expect(ap.enabled).toBe(false);
	});

	it("toggles on and off", () => {
		const ap = new Autopilot();
		ap.toggle();
		expect(ap.enabled).toBe(true);
		ap.toggle();
		expect(ap.enabled).toBe(false);
	});

	it("returns null input when disabled", () => {
		const ap = new Autopilot();
		const lander = createLander(2000, 80, landerType);
		const input = ap.computeInput(lander, terrain);
		expect(input.thrustUp).toBe(false);
		expect(input.rotateLeft).toBe(false);
		expect(input.rotateRight).toBe(false);
	});

	it("produces thrust when lander is high and falling fast", () => {
		const ap = new Autopilot();
		ap.enabled = true;
		const lander = createLander(2000, 100, landerType);
		lander.vy = 500; // falling fast
		const input = ap.computeInput(lander, terrain);
		expect(input.thrustUp).toBe(true);
	});

	it("rotates toward the nearest pad", () => {
		const ap = new Autopilot();
		ap.enabled = true;
		// Place lander far to the left of the first pad
		const pad = terrain.pads[0];
		const lander = createLander(pad.x - 300, 200, landerType);
		const input = ap.computeInput(lander, terrain);
		// Should rotate right to head toward pad (positive angle = right tilt)
		expect(input.rotateRight).toBe(true);
		expect(input.rotateLeft).toBe(false);
	});

	it("does not thrust when angle is too far off vertical", () => {
		const ap = new Autopilot();
		ap.enabled = true;
		const lander = createLander(2000, 200, landerType);
		lander.angle = 90; // sideways
		lander.vy = 300;
		const input = ap.computeInput(lander, terrain);
		expect(input.thrustUp).toBe(false);
	});
});
