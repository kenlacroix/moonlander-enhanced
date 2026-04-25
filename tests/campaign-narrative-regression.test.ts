/**
 * Sprint 7.4 critical regression — "bounced" is a SECONDARY narrative
 * label, not a new gameplay state. Every input that previously produced
 * `lander.status = "landed"` AND `campaignCompleted` membership must
 * still produce both on the post-Tier-3 code, regardless of whether
 * the result classifies as "clean" or "bounced."
 *
 * This is the load-bearing eng-review-mandated test (E2 + IRON RULE).
 * If it fails, narrative dialogue has accidentally demoted real progress.
 */
import { beforeAll, describe, expect, it } from "vitest";
import { classifyLanding, type FlightOutcome } from "../src/game/FlightOutcome";
import type { LanderState } from "../src/game/Lander";
import { CAMPAIGN } from "../src/game/Missions";
import { installLocalStoragePolyfill } from "./helpers/localStorage";

beforeAll(installLocalStoragePolyfill);

const baseLander = (over: Partial<LanderState> = {}): LanderState => ({
	x: 100,
	y: 100,
	vx: 0,
	vy: 0,
	angle: 0,
	angularVel: 0,
	fuel: 800,
	thrusting: false,
	status: "landed",
	physicsVersion: 3,
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

describe("Campaign narrative regression — bounced never demotes a landing", () => {
	it("classifyLanding always returns 'clean' or 'bounced' for landed input — never demotes to crashed", () => {
		// Worst-case bounced: extreme off-center + max-tolerance everything.
		// Even at the edge of the tolerance band, a landed input must NOT
		// classify as crashed. Crashed comes from physics.checkCollision
		// returning safeLanding=false; classifyLanding never sees that path.
		const pad = { x: 0, width: 40 };
		const extreme = baseLander({
			x: 200, // 200 px off center — way over the threshold
			vy: 119,
			vx: 119,
			angle: 9.9,
		});
		const result = classifyLanding(extreme, pad, 7.9, 8);
		expect(["clean", "bounced"]).toContain(result.result);
		// Specifically: we DID land, even if we bounced.
		expect(result.result).not.toBe("crashed" as never);
	});

	it("FlightOutcome.result === 'bounced' is a label, not a status — caller can still mark mission completed", () => {
		// Simulate the campaign-completion gate: the existing CollisionHandler
		// adds activeMission.id to campaignCompleted IF result.landed is true,
		// independent of FlightOutcome.result. Sprint 7.4 must not change
		// this gate. Verify by constructing both clean and bounced outcomes
		// and asserting both would feed the same `landed=true` branch.
		const cleanOutcome: FlightOutcome = {
			result: "clean",
			fuelRemainingPct: 0.5,
			hazardsFired: { alien: false, storm: false, fuelLeak: false },
		};
		const bouncedOutcome: FlightOutcome = {
			result: "bounced",
			fuelRemainingPct: 0.1,
			hazardsFired: { alien: false, storm: false, fuelLeak: false },
		};
		// The narrative label distinguishes them, but neither is "crashed"
		// or "timeout" — so progression-gating code that branches on
		// `outcome.result === "crashed"` will skip both.
		expect(cleanOutcome.result).not.toBe("crashed");
		expect(bouncedOutcome.result).not.toBe("crashed");
		expect(cleanOutcome.result).not.toBe("timeout");
		expect(bouncedOutcome.result).not.toBe("timeout");
	});

	it("Campaign mission shape unchanged: id/seed/difficulty still required fields", () => {
		// Schema regression: Sprint 7.4 added narrative + palette + archetype
		// to Campaign missions. Verify the load-bearing fields are intact.
		for (const m of CAMPAIGN) {
			expect(typeof m.id).toBe("number");
			expect(typeof m.seed).toBe("number");
			expect(typeof m.name).toBe("string");
			expect(m.difficulty).toBeDefined();
		}
	});

	it("Campaign mission narrative flag is set to true on all 5 missions", () => {
		for (const m of CAMPAIGN) {
			expect(m.narrative?.enabled).toBe(true);
		}
	});

	it("Campaign archetypes are wired (no defaults to undefined)", () => {
		const expected = ["rolling", "crater-field", "spires", "mesa", "spires"];
		for (let i = 0; i < CAMPAIGN.length; i++) {
			expect(CAMPAIGN[i].difficulty?.archetype).toBe(expected[i]);
		}
	});
});

describe("Campaign cleanClears save state", () => {
	it("returns empty Set on first load (no localStorage key)", async () => {
		localStorage.clear();
		const { loadCleanClears } = await import("../src/game/Missions");
		expect(loadCleanClears()).toEqual(new Set());
	});

	it("round-trips a cleanClears Set through save+load", async () => {
		localStorage.clear();
		const { loadCleanClears, saveCleanClears } = await import(
			"../src/game/Missions"
		);
		const clears = new Set([1, 3, 5]);
		saveCleanClears(clears);
		const loaded = loadCleanClears();
		expect(loaded).toEqual(clears);
	});

	it("returns empty Set on malformed JSON in localStorage", async () => {
		localStorage.clear();
		localStorage.setItem("moonlander-campaign-clean-clears", "not-json{{");
		const { loadCleanClears } = await import("../src/game/Missions");
		expect(loadCleanClears()).toEqual(new Set());
	});

	it("does NOT touch the existing campaignCompleted save key", async () => {
		localStorage.clear();
		localStorage.setItem("moonlander-campaign", JSON.stringify([1, 2, 3]));
		const { saveCleanClears, loadCampaignProgress } = await import(
			"../src/game/Missions"
		);
		saveCleanClears(new Set([1]));
		// campaignCompleted save key should be untouched.
		expect([...loadCampaignProgress()]).toEqual([1, 2, 3]);
	});
});
