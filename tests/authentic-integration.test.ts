import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
	getMissionBriefing,
	renderFactSheetBriefing,
} from "../src/api/MissionBriefing";
import {
	hasSeenAuthenticIntro,
	loadAuthenticPreference,
	markAuthenticIntroSeen,
	saveAuthenticPreference,
} from "../src/game/AuthenticMode";
import type { MissionFacts } from "../src/game/HistoricMission";
import type { Mission } from "../src/game/Missions";
import {
	_resetLeaderboardCacheForTests,
	addScore,
	getBestScore,
	getScores,
} from "../src/systems/Leaderboard";
import { installLocalStoragePolyfill } from "./helpers/localStorage";

// Stub the network-backed streamCompletion so the cache-key tests don't hit
// a real LLM. The stub records every invocation so tests can assert how many
// times the "network" was called for a given (mission, authentic) pair.
const streamCompletionMock = vi.fn(
	async (
		_config: unknown,
		messages: { role: string; content: string }[],
		onChunk: (text: string) => void,
	) => {
		const systemMsg = messages.find((m) => m.role === "system")?.content ?? "";
		// Emit distinct text for authentic vs vanilla system prompts so tests
		// can also verify the two modes receive distinct prompts, not just
		// distinct cache slots.
		const fakeText = systemMsg.includes("AUTHENTIC mode")
			? "AUTHENTIC BRIEFING STUB"
			: "VANILLA BRIEFING STUB";
		onChunk(fakeText);
		return fakeText;
	},
);

vi.mock("../src/api/LLMProvider", () => ({
	streamCompletion: (
		config: unknown,
		messages: { role: string; content: string }[],
		onChunk: (text: string) => void,
	) => streamCompletionMock(config, messages, onChunk),
}));

beforeAll(installLocalStoragePolyfill);

beforeEach(() => {
	localStorage.clear();
	_resetLeaderboardCacheForTests();
});

describe("Sprint 5.5 — localStorage preference roundtrip", () => {
	it("saveAuthenticPreference ON writes the key; load returns true", () => {
		saveAuthenticPreference(511, true);
		expect(loadAuthenticPreference(511)).toBe(true);
	});

	it("saveAuthenticPreference OFF removes the key; load returns false", () => {
		saveAuthenticPreference(511, true);
		saveAuthenticPreference(511, false);
		expect(loadAuthenticPreference(511)).toBe(false);
	});

	it("per-mission isolation: one mission's pref does not affect another", () => {
		saveAuthenticPreference(511, true);
		saveAuthenticPreference(515, false);
		expect(loadAuthenticPreference(511)).toBe(true);
		expect(loadAuthenticPreference(515)).toBe(false);
	});
});

describe("Sprint 5.5 — tutorial seen-key lifecycle", () => {
	it("hasSeenAuthenticIntro is false until marked", () => {
		expect(hasSeenAuthenticIntro(511)).toBe(false);
		markAuthenticIntroSeen(511);
		expect(hasSeenAuthenticIntro(511)).toBe(true);
	});

	it("intro-seen is per-mission — marking one does not affect another", () => {
		markAuthenticIntroSeen(511);
		expect(hasSeenAuthenticIntro(511)).toBe(true);
		expect(hasSeenAuthenticIntro(515)).toBe(false);
	});
});

describe("Sprint 5.5 — Leaderboard mode isolation + legacy migration", () => {
	it("vanilla and authentic records are separate slots for the same seed", () => {
		addScore(1969, 100, 30, "vanilla");
		addScore(1969, 200, 25, "authentic");
		expect(getBestScore(1969, "vanilla")).toBe(100);
		expect(getBestScore(1969, "authentic")).toBe(200);
	});

	it("authentic score does not overwrite vanilla record on same seed", () => {
		addScore(1969, 500, 20, "vanilla");
		addScore(1969, 50, 40, "authentic");
		expect(getBestScore(1969, "vanilla")).toBe(500);
		expect(getBestScore(1969, "authentic")).toBe(50);
	});

	it("legacy String(seed) records read back as vanilla", () => {
		// Simulate a pre-5.5 record written under the legacy key.
		localStorage.setItem(
			"moonlander-leaderboard",
			JSON.stringify({
				"1969": [{ score: 777, date: "2025-01-01" }],
			}),
		);
		expect(getBestScore(1969, "vanilla")).toBe(777);
		expect(getBestScore(1969, "authentic")).toBeUndefined();
	});

	it("first vanilla write after legacy migrates the key", () => {
		localStorage.setItem(
			"moonlander-leaderboard",
			JSON.stringify({
				"1969": [{ score: 777, date: "2025-01-01" }],
			}),
		);
		addScore(1969, 800, 22, "vanilla");
		const entries = getScores(1969, "vanilla");
		// Both the legacy 777 and the new 800 should be present; legacy
		// key gone. Sorted desc by score.
		expect(entries.map((e) => e.score)).toEqual([800, 777]);
		const raw = JSON.parse(
			localStorage.getItem("moonlander-leaderboard") ?? "{}",
		);
		expect(raw["1969"]).toBeUndefined();
		expect(raw["1969-vanilla"]).toBeDefined();
	});
});

describe("Sprint 5.5 — MissionBriefing offline fallback with eraOneLiner", () => {
	const apollo11Facts: MissionFacts = {
		craftName: "Eagle",
		date: "1969-07-20",
		commander: "Neil Armstrong",
		lmPilot: "Buzz Aldrin",
		cmPilot: "Michael Collins",
		landingSite: "Sea of Tranquility",
		coordinates: "0.67°N 23.47°E",
		descentStartAltitudeM: 15240,
		notableMoment: "Manual descent past a boulder field.",
		historicalReferenceLabel: "Armstrong fuel margin",
		historicalReferenceValue: 22,
		historicalReferenceUnit: "seconds",
		eraOneLiner:
			"Eagle's 2KB guidance computer carried the crew down while Armstrong hunted for a boulder-free landing site.",
	};

	const mission: Mission = {
		id: 511,
		name: "APOLLO 11",
		description: "Sea of Tranquility",
		seed: 11_1969,
	};

	it("vanilla briefing does not include eraOneLiner", () => {
		const text = renderFactSheetBriefing(mission, apollo11Facts, false);
		expect(text).not.toContain("2KB guidance computer");
		expect(text).not.toContain("Era:");
	});

	it("authentic briefing appends eraOneLiner when present", () => {
		const text = renderFactSheetBriefing(mission, apollo11Facts, true);
		expect(text).toContain("2KB guidance computer");
		expect(text).toContain("Era:");
	});

	it("authentic briefing gracefully omits era line when eraOneLiner absent", () => {
		const factsNoEra: MissionFacts = {
			...apollo11Facts,
			eraOneLiner: undefined,
		};
		const text = renderFactSheetBriefing(mission, factsNoEra, true);
		expect(text).not.toContain("Era:");
		expect(text).toContain("Eagle"); // still renders the rest
	});
});

describe("Sprint 5.5 — MissionBriefing cache-key partitioning by authentic flag", () => {
	const llmConfig = {
		provider: "anthropic" as const,
		apiKey: "test-key",
		model: "claude-test",
	};

	const apollo11Facts: MissionFacts = {
		craftName: "Eagle",
		date: "1969-07-20",
		commander: "Neil Armstrong",
		lmPilot: "Buzz Aldrin",
		landingSite: "Sea of Tranquility",
		coordinates: "0.67°N 23.47°E",
		descentStartAltitudeM: 15240,
		notableMoment: "Manual descent past a boulder field.",
		historicalReferenceLabel: "Fuel margin",
		historicalReferenceValue: 22,
		historicalReferenceUnit: "seconds",
		eraOneLiner: "2KB guidance computer.",
	};

	// The MissionBriefing cache is a module-level Map with no public reset.
	// Each test uses a distinct seed so prior-test cache entries don't bleed
	// in. This keeps the tests independent without needing to export an
	// internal cache for tests to poke at.
	function mission(seed: number): Mission {
		return {
			id: 511,
			name: `APOLLO 11 (seed ${seed})`,
			description: "Sea of Tranquility",
			seed,
		};
	}

	function freeplay(seed: number): Mission {
		return {
			id: 1,
			name: `FREEPLAY (seed ${seed})`,
			description: "generic",
			seed,
		};
	}

	beforeEach(() => {
		streamCompletionMock.mockClear();
	});

	it("historic: authentic=false and authentic=true miss the cache independently", async () => {
		const sink = () => {};
		const m = mission(1_000_001);
		const vanilla = await getMissionBriefing(
			llmConfig,
			m,
			sink,
			apollo11Facts,
			false,
		);
		const authentic = await getMissionBriefing(
			llmConfig,
			m,
			sink,
			apollo11Facts,
			true,
		);
		// Both variants hit the network — two separate cache slots.
		expect(streamCompletionMock).toHaveBeenCalledTimes(2);
		expect(vanilla).toBe("VANILLA BRIEFING STUB");
		expect(authentic).toBe("AUTHENTIC BRIEFING STUB");
	});

	it("historic: second call with the same authentic flag hits the cache", async () => {
		const sink = () => {};
		const m = mission(1_000_002);
		await getMissionBriefing(llmConfig, m, sink, apollo11Facts, true);
		await getMissionBriefing(llmConfig, m, sink, apollo11Facts, true);
		// First call populates the cache, second hits it — one network call.
		expect(streamCompletionMock).toHaveBeenCalledTimes(1);
	});

	it("non-historic (no facts): authentic=false and authentic=true miss independently", async () => {
		const sink = () => {};
		// No historicalContext passed — exercises the `${seed}${authSuffix}`
		// branch of the cache key, not the hashed historic branch.
		const m = freeplay(1_000_003);
		await getMissionBriefing(llmConfig, m, sink, undefined, false);
		await getMissionBriefing(llmConfig, m, sink, undefined, true);
		expect(streamCompletionMock).toHaveBeenCalledTimes(2);
	});
});
