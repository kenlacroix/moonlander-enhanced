import { beforeEach, describe, expect, it } from "vitest";
import { MissionChatter } from "../src/api/MissionChatter";
import { APOLLO_MISSIONS } from "../src/data/apolloMissions";
import type { LanderState } from "../src/game/Lander";

const apollo11 = APOLLO_MISSIONS.find((m) => m.name.includes("APOLLO 11"));
if (!apollo11 || apollo11.kind !== "landing") {
	throw new Error("Apollo 11 missing");
}
const facts = apollo11.facts;

const baseLander = (over: Partial<LanderState> = {}): LanderState => ({
	x: 0,
	y: 0,
	vx: 0,
	vy: 0,
	angle: 0,
	angularVel: 0,
	fuel: 800,
	thrusting: false,
	status: "flying",
	landerType: {
		name: "TEST",
		thrustMultiplier: 1,
		fuelMultiplier: 1,
		massMultiplier: 1,
		rotationMultiplier: 1,
		color: "#fff",
		description: "",
	},
	...over,
});

describe("MissionChatter — offline rule-based fallback", () => {
	let chatter: MissionChatter;

	beforeEach(() => {
		chatter = new MissionChatter();
	});

	it("fires flight-start chatter immediately on start (no LLM)", () => {
		chatter.start(facts, null);
		expect(chatter.latestText).toMatch(/go for landing/i);
		expect(chatter.latestText).toContain(facts.craftName);
	});

	it("fires altitude-1000 once when crossing 1000m", () => {
		chatter.start(facts, null);
		chatter.tick(0.1); // decay flight-start a bit
		chatter.update({ lander: baseLander(), altitude: 999, startingFuel: 800 });
		expect(chatter.latestText).toMatch(/1000/);
	});

	it("does NOT refire altitude-1000 on a second crossing", () => {
		chatter.start(facts, null);
		chatter.update({ lander: baseLander(), altitude: 999, startingFuel: 800 });
		const first = chatter.latestText;
		chatter.tick(5); // expire visibility
		expect(chatter.latestText).toBe("");
		// Re-cross 1000 — should not fire again.
		chatter.update({ lander: baseLander(), altitude: 999, startingFuel: 800 });
		expect(chatter.latestText).toBe("");
		expect(first).toMatch(/1000/);
	});

	it("fires the famous 30-seconds chatter at <5% fuel", () => {
		chatter.start(facts, null);
		chatter.tick(5);
		chatter.update({
			lander: baseLander({ fuel: 30 }),
			altitude: 100,
			startingFuel: 800,
		});
		expect(chatter.latestText).toMatch(/30 seconds/i);
	});

	it("fires drift chatter on high horizontal velocity", () => {
		chatter.start(facts, null);
		chatter.tick(5);
		chatter.update({
			lander: baseLander({ vx: 50 }),
			altitude: 500,
			startingFuel: 800,
		});
		expect(chatter.latestText).toMatch(/drift/i);
	});

	it("fires landing chatter referencing the craft name", () => {
		chatter.start(facts, null);
		chatter.tick(5);
		chatter.onLanded();
		expect(chatter.latestText).toContain(facts.craftName);
		expect(chatter.latestText).toMatch(/landed|tranquility/i);
	});

	it("fires crash chatter referencing the craft name", () => {
		chatter.start(facts, null);
		chatter.tick(5);
		chatter.onCrashed();
		expect(chatter.latestText).toContain(facts.craftName);
		expect(chatter.latestText).toMatch(/lost|signal/i);
	});

	it("latestText decays to empty after the visibility window", () => {
		chatter.start(facts, null);
		expect(chatter.latestText).not.toBe("");
		chatter.tick(5);
		expect(chatter.latestText).toBe("");
	});
});
