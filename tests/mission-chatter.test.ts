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

	it("fires mid-descent chatter when altitude crosses the mid threshold", () => {
		chatter.start(facts, null);
		chatter.tick(0.1); // decay flight-start a bit
		// Threshold is 150 px; 100 is well below.
		chatter.update({ lander: baseLander(), altitude: 100, startingFuel: 800 });
		expect(chatter.latestText).toMatch(/1000|altitude/i);
	});

	it("does NOT refire altitude-mid on a second crossing", () => {
		chatter.start(facts, null);
		chatter.update({ lander: baseLander(), altitude: 100, startingFuel: 800 });
		const first = chatter.latestText;
		chatter.tick(5); // expire visibility
		expect(chatter.latestText).toBe("");
		// Re-cross — should not fire again.
		chatter.update({ lander: baseLander(), altitude: 100, startingFuel: 800 });
		expect(chatter.latestText).toBe("");
		expect(first).toMatch(/1000|altitude/i);
	});

	it("does NOT fire mid-descent chatter at spawn altitude (~300 px)", () => {
		chatter.start(facts, null);
		chatter.tick(5); // clear flight-start
		// Apollo missions spawn around y=80-110, terrain near 400-500,
		// so altitude is ~300 px at start. The mid threshold (150) must
		// NOT trigger from there. Codex P2 fix: previously the threshold
		// was 1000, which was always true.
		chatter.update({ lander: baseLander(), altitude: 280, startingFuel: 800 });
		expect(chatter.latestText).toBe("");
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
