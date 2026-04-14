import { describe, expect, it } from "vitest";
import {
	advanceRelayLander,
	createRelayState,
	getRelayLabel,
	getRelaySummary,
	isRelayComplete,
	recordRelayLander,
} from "../src/game/RelayMode";

describe("createRelayState", () => {
	it("starts at lander 1 with no recorded landers", () => {
		const relay = createRelayState();
		expect(relay.active).toBe(true);
		expect(relay.currentLander).toBe(1);
		expect(relay.landers).toHaveLength(0);
		expect(relay.totalScore).toBe(0);
	});
});

describe("recordRelayLander", () => {
	it("records a landed lander and returns true for more", () => {
		const relay = createRelayState();
		const hasMore = recordRelayLander(relay, 500, 400, "landed", 250);
		expect(hasMore).toBe(true);
		expect(relay.landers).toHaveLength(1);
		expect(relay.totalScore).toBe(250);
	});

	it("records a crashed lander with zero score", () => {
		const relay = createRelayState();
		recordRelayLander(relay, 500, 400, "crashed", 0);
		expect(relay.landers[0].status).toBe("crashed");
		expect(relay.landers[0].score).toBe(0);
	});

	it("returns false after 3 landers", () => {
		const relay = createRelayState();
		recordRelayLander(relay, 100, 200, "landed", 100);
		recordRelayLander(relay, 200, 300, "crashed", 0);
		const hasMore = recordRelayLander(relay, 300, 400, "landed", 200);
		expect(hasMore).toBe(false);
		expect(relay.totalScore).toBe(300);
	});
});

describe("advanceRelayLander", () => {
	it("spawns next lander above previous position", () => {
		const relay = createRelayState();
		recordRelayLander(relay, 500, 400, "landed", 100);
		const spawn = advanceRelayLander(relay);
		expect(spawn.spawnX).toBe(500);
		expect(spawn.spawnY).toBe(300); // 400 - 100
		expect(relay.currentLander).toBe(2);
	});

	it("clamps spawn altitude to minimum 20", () => {
		const relay = createRelayState();
		recordRelayLander(relay, 500, 50, "landed", 100);
		const spawn = advanceRelayLander(relay);
		expect(spawn.spawnY).toBe(20); // max(20, 50-100) = 20
	});
});

describe("isRelayComplete", () => {
	it("returns false before 3 landers", () => {
		const relay = createRelayState();
		recordRelayLander(relay, 100, 200, "landed", 100);
		expect(isRelayComplete(relay)).toBe(false);
	});

	it("returns true after 3 landers", () => {
		const relay = createRelayState();
		recordRelayLander(relay, 100, 200, "landed", 100);
		recordRelayLander(relay, 200, 300, "crashed", 0);
		recordRelayLander(relay, 300, 400, "landed", 200);
		expect(isRelayComplete(relay)).toBe(true);
	});
});

describe("getRelayLabel", () => {
	it("shows current lander number", () => {
		const relay = createRelayState();
		expect(getRelayLabel(relay)).toBe("LANDER 1/3");
		recordRelayLander(relay, 100, 200, "landed", 100);
		advanceRelayLander(relay);
		expect(getRelayLabel(relay)).toBe("LANDER 2/3");
	});
});

describe("getRelaySummary", () => {
	it("shows score for each lander and total", () => {
		const relay = createRelayState();
		recordRelayLander(relay, 100, 200, "landed", 150);
		recordRelayLander(relay, 200, 300, "crashed", 0);
		recordRelayLander(relay, 300, 400, "landed", 250);
		const summary = getRelaySummary(relay);
		expect(summary).toContain("Lander 1: 150");
		expect(summary).toContain("Lander 2: CRASHED");
		expect(summary).toContain("Lander 3: 250");
		expect(summary).toContain("Total: 400");
	});
});
