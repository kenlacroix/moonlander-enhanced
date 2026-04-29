import { beforeEach, describe, expect, it } from "vitest";
import { CampaignChatter } from "../src/api/CampaignChatter";
import {
	CAMPAIGN_DIALOGUE,
	CHEN_FORBIDDEN_REGEX,
	CHEN_PROCEDURAL,
	getPostLandingLines,
	getTriggerLine,
	HOSHI_BANNED_PHRASES,
	selectPostLandingKey,
} from "../src/data/campaignDialogue";
import type { FlightOutcome } from "../src/game/FlightOutcome";
import type { LanderState } from "../src/game/Lander";

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

describe("CampaignChatter — offline-first rule-based behavior", () => {
	let chatter: CampaignChatter;

	beforeEach(() => {
		chatter = new CampaignChatter();
	});

	it("fires the briefing line on start for mission 1 (Hoshi)", () => {
		chatter.start(1, null);
		const line = chatter.latest;
		expect(line).not.toBeNull();
		expect(line?.speaker).toBe("hoshi");
		expect(line?.text).toMatch(/scenario one/i);
	});

	it("falls through to CHEN_PROCEDURAL for triggers without per-mission override", () => {
		// Mission 1 has empty triggers — altitude-mid should fall back to Chen's
		// procedural callout.
		chatter.start(1, null);
		chatter.tick(10); // decay briefing
		chatter.update({
			lander: baseLander(),
			altitude: 100,
			startingFuel: 1200,
		});
		const line = chatter.latest;
		expect(line?.speaker).toBe("chen");
		expect(line?.text).toBe(CHEN_PROCEDURAL["altitude-mid"].text);
	});

	it("uses per-mission override on mission 3 storm-start (Hoshi-via-Chen relay)", () => {
		chatter.start(3, null);
		chatter.tick(10);
		chatter.onStormStart();
		const line = chatter.latest;
		expect(line?.speaker).toBe("chen");
		// Per-mission override on M3 says "Flight: keep your rate under eight degrees."
		expect(line?.text).toMatch(/flight: keep your rate/i);
	});

	it("does NOT re-fire alien-spawn on second call (one-shot per flight)", () => {
		chatter.start(4, null);
		chatter.tick(10);
		chatter.onAlienSpawn();
		const first = chatter.latest;
		expect(first).not.toBeNull();
		chatter.tick(10);
		chatter.onAlienSpawn();
		// Re-firing should NOT show a new alien-spawn line; latest should be null
		// after the first one's visibility window has elapsed.
		expect(chatter.latest).toBeNull();
	});

	it("complete() with clean outcome fires Hoshi's clean line on mission 1", () => {
		chatter.start(1, null);
		chatter.tick(10); // decay briefing
		const outcome: FlightOutcome = {
			result: "clean",
			fuelRemainingPct: 0.5,
			hazardsFired: { alien: false, storm: false, fuelLeak: false },
			landingMarginPx: 10,
		};
		chatter.complete(outcome);
		const line = chatter.latest;
		expect(line?.speaker).toBe("hoshi");
		expect(line?.text).toMatch(/clean|touchdown/i);
	});

	it("complete() with bounced outcome on mission 5 fires the multi-line bounced sequence", () => {
		chatter.start(5, null);
		chatter.tick(20); // decay briefing
		const outcome: FlightOutcome = {
			result: "bounced",
			fuelRemainingPct: 0.1,
			hazardsFired: { alien: true, storm: true, fuelLeak: false },
			landingMarginPx: 80,
			bestAngularRate: 5,
		};
		chatter.complete(outcome);
		expect(chatter.latest?.speaker).toBe("hoshi");
		expect(chatter.hasQueuedLines).toBe(true); // multi-line on M5 bounced
	});

	it("complete() with clean+hazard outcome promotes to the hazard variant when available", () => {
		chatter.start(3, null);
		chatter.tick(20);
		const outcome: FlightOutcome = {
			result: "clean",
			fuelRemainingPct: 0.4,
			hazardsFired: { alien: false, storm: true, fuelLeak: false },
			landingMarginPx: 5,
			bestAngularRate: 4,
		};
		chatter.complete(outcome);
		// M3 has a clean+hazard variant: "...landed through a storm with margin..."
		expect(chatter.latest?.text).toMatch(/storm/i);
	});

	it("skip() advances to the next line in a multi-line post-landing sequence", () => {
		chatter.start(5, null);
		chatter.tick(20);
		const outcome: FlightOutcome = {
			result: "clean",
			fuelRemainingPct: 0.5,
			hazardsFired: { alien: false, storm: false, fuelLeak: false },
			landingMarginPx: 5,
			bestAngularRate: 3,
		};
		chatter.complete(outcome);
		const first = chatter.latest?.text;
		chatter.skip();
		const second = chatter.latest?.text;
		expect(second).not.toBe(first);
		expect(second).toMatch(/pad-centered|through the stack|inside every gate/i);
	});
});

describe("Campaign dialogue table — coverage and structure", () => {
	it("every mission has a briefing", () => {
		for (const id of [1, 2, 3, 4, 5]) {
			const table = CAMPAIGN_DIALOGUE[id];
			expect(table).toBeDefined();
			expect(table.briefing.length).toBeGreaterThan(0);
		}
	});

	it("every mission has clean and crashed post-landing variants", () => {
		for (const id of [1, 2, 3, 4, 5]) {
			expect(getPostLandingLines(id, "clean")).not.toBeNull();
			expect(getPostLandingLines(id, "crashed")).not.toBeNull();
		}
	});

	it("every Hoshi line uses no banned phrases", () => {
		for (const id of [1, 2, 3, 4, 5]) {
			const table = CAMPAIGN_DIALOGUE[id];
			const lines = [
				...table.briefing,
				...Object.values(table.triggers),
				...Object.values(table.postLanding).flat(),
			];
			for (const line of lines) {
				if (line.speaker !== "hoshi") continue;
				const lower = line.text.toLowerCase();
				for (const banned of HOSHI_BANNED_PHRASES) {
					expect(lower).not.toContain(banned);
				}
			}
		}
	});

	it("every Chen line uses no first-person except in 'Flight says/Flight:' relays", () => {
		for (const trigger of Object.keys(CHEN_PROCEDURAL) as Array<
			keyof typeof CHEN_PROCEDURAL
		>) {
			const text = CHEN_PROCEDURAL[trigger].text;
			expect(text).not.toMatch(CHEN_FORBIDDEN_REGEX);
		}
		// Per-mission Chen overrides
		for (const id of [1, 2, 3, 4, 5]) {
			const table = CAMPAIGN_DIALOGUE[id];
			for (const line of Object.values(table.triggers)) {
				if (line.speaker !== "chen") continue;
				// Skip relay lines that quote Hoshi: "Flight says..." or "Flight: ..."
				if (/^Flight\b/.test(line.text)) continue;
				if (line.text.includes("Flight:")) continue;
				if (line.text.includes("Flight says")) continue;
				expect(line.text).not.toMatch(CHEN_FORBIDDEN_REGEX);
			}
		}
	});

	it("getTriggerLine falls back to CHEN_PROCEDURAL when mission has no override", () => {
		// Mission 1 has empty triggers, so altitude-mid hits the fallback.
		const line = getTriggerLine(1, "altitude-mid");
		expect(line?.text).toBe(CHEN_PROCEDURAL["altitude-mid"].text);
	});

	it("getTriggerLine returns null for non-narrative mission ids", () => {
		expect(getTriggerLine(999, "altitude-mid")).toBeNull();
	});

	it("selectPostLandingKey prefers crashed-on-rate when rateExceeded and dialogue exists", () => {
		// M3 has crashed-on-rate.
		const key = selectPostLandingKey(3, "crashed", false, true, false);
		expect(key).toBe("crashed-on-rate");
	});

	it("selectPostLandingKey falls through to crashed when rate-specific is missing", () => {
		// M1 has no crashed-on-rate variant.
		const key = selectPostLandingKey(1, "crashed", false, true, false);
		expect(key).toBe("crashed");
	});

	it("selectPostLandingKey picks clean+hazard when storm fired and variant exists", () => {
		// M3 has clean+hazard.
		const key = selectPostLandingKey(3, "clean", true, false, false);
		expect(key).toBe("clean+hazard");
	});
});
