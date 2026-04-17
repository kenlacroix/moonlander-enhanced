import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { renderFactSheetBriefing } from "../src/api/MissionBriefing";
import {
	hasSeenAuthenticIntro,
	loadAuthenticPreference,
	markAuthenticIntroSeen,
	saveAuthenticPreference,
} from "../src/game/AuthenticMode";
import type { MissionFacts } from "../src/game/HistoricMission";
import type { Mission } from "../src/game/Missions";
import { addScore, getBestScore, getScores } from "../src/systems/Leaderboard";

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

beforeEach(() => {
	localStorage.clear();
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
