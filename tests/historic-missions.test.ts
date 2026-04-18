import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { APOLLO_13, APOLLO_MISSIONS } from "../src/data/apolloMissions";
import { ARTEMIS_MISSIONS } from "../src/data/artemisMissions";
import { LUNA_MISSIONS } from "../src/data/lunaMissions";
import { handleSurviveSuccess } from "../src/game/CollisionHandler";
import type { Game } from "../src/game/Game";
import { isHistoricMission } from "../src/game/HistoricMission";
import { LANDER_TYPES } from "../src/game/LanderTypes";
import { HISTORIC_MISSIONS } from "../src/game/StateHandlers";
import {
	_resetLeaderboardCacheForTests,
	getScores,
} from "../src/systems/Leaderboard";
import { MAX_FLIGHT_DURATION } from "../src/utils/constants";
import { installLocalStoragePolyfill } from "./helpers/localStorage";

describe("HistoricMission data files", () => {
	const all = [
		...APOLLO_MISSIONS,
		APOLLO_13,
		...ARTEMIS_MISSIONS,
		...LUNA_MISSIONS,
	];

	it.each(all)("$name has all required fact-sheet fields", (m) => {
		expect(m.facts.craftName).toBeTruthy();
		expect(m.facts.date).toBeTruthy();
		expect(m.facts.commander).toBeTruthy();
		expect(m.facts.landingSite).toBeTruthy();
		expect(m.facts.coordinates).toBeTruthy();
		// Survive missions (Apollo 13) never descend — descentStartAltitudeM
		// can legitimately be 0. Landing / auto-landing missions must have
		// a nonzero descent altitude.
		if (m.kind === "survive") {
			expect(m.facts.descentStartAltitudeM).toBeGreaterThanOrEqual(0);
		} else {
			expect(m.facts.descentStartAltitudeM).toBeGreaterThan(0);
		}
		expect(m.facts.notableMoment).toBeTruthy();
		expect(m.facts.historicalReferenceLabel).toBeTruthy();
		expect(m.facts.historicalReferenceValue).toBeGreaterThan(0);
		expect(m.facts.historicalReferenceUnit).toBeTruthy();
	});

	it.each(all)("$name has unique seed", (m) => {
		expect(typeof m.seed).toBe("number");
		expect(Number.isInteger(m.seed)).toBe(true);
	});

	it("all seeds are unique across the historic missions", () => {
		const seeds = all.map((m) => m.seed);
		expect(new Set(seeds).size).toBe(seeds.length);
	});

	it("isHistoricMission identifies historic missions", () => {
		for (const m of all) {
			expect(isHistoricMission(m)).toBe(true);
		}
		// And rejects a plain Mission
		expect(
			isHistoricMission({ id: 1, name: "x", seed: 1, description: "x" }),
		).toBe(false);
	});

	it("each landing mission declares at least one moment", () => {
		for (const m of all) {
			if (m.kind !== "landing") continue;
			expect(m.moments.length).toBeGreaterThan(0);
		}
	});

	it("Apollo 11 declares the famous fuel-margin moment", () => {
		const a11 = APOLLO_MISSIONS.find((m) => m.name.includes("APOLLO 11"));
		expect(a11).toBeDefined();
		expect(
			a11?.moments.some((m) => m.achievementId === "apollo-11-margin"),
		).toBe(true);
	});

	it("Apollo 15 uses the rille specialFeature", () => {
		const a15 = APOLLO_MISSIONS.find((m) => m.name.includes("APOLLO 15"));
		expect(a15?.difficulty?.specialFeature).toBe("rille");
	});

	it("Apollo 17 uses the valley specialFeature", () => {
		const a17 = APOLLO_MISSIONS.find((m) => m.name.includes("APOLLO 17"));
		expect(a17?.difficulty?.specialFeature).toBe("valley");
	});

	it("Artemis III uses the artemis-lm lander type", () => {
		const a3 = ARTEMIS_MISSIONS.find((m) => m.name.includes("ARTEMIS III"));
		expect(a3?.difficulty?.landerType).toBe("artemis-lm");
	});
});

describe("Sprint 5 Part B — Apollo 13 Survive mission", () => {
	it("is a survive-kind historic mission", () => {
		expect(APOLLO_13.kind).toBe("survive");
		expect(APOLLO_13.era).toBe("1960s-70s-apollo");
		expect(isHistoricMission(APOLLO_13)).toBe(true);
	});

	it("has a finite, positive survival duration", () => {
		expect(APOLLO_13.survivalDurationSec).toBeGreaterThan(0);
		// Hard timeout must be longer than the target, otherwise the flight
		// always fails before it can succeed.
		expect(APOLLO_13.survivalDurationSec).toBeLessThan(MAX_FLIGHT_DURATION);
	});

	it("uses the Apollo LM lander type", () => {
		expect(APOLLO_13.difficulty?.landerType).toBe("apollo-lm");
	});

	it("facts reflect the non-landing nature of the mission", () => {
		// Apollo 13 never landed — descent altitude and coordinates reflect
		// that. The renderer + briefing path both need to tolerate these.
		expect(APOLLO_13.facts.descentStartAltitudeM).toBe(0);
		expect(APOLLO_13.facts.landingSite.toLowerCase()).toContain("never landed");
	});
});

describe("Sprint 5 Part B — Luna 9 auto-landing mission", () => {
	const luna9 = LUNA_MISSIONS.find((m) => m.name.includes("LUNA 9"));

	it("is registered in LUNA_MISSIONS", () => {
		expect(luna9).toBeDefined();
	});

	it("is an auto-landing-kind historic mission", () => {
		expect(luna9?.kind).toBe("auto-landing");
		expect(luna9?.era).toBe("1960s-soviet");
	});

	it("uses the luna-9 lander type", () => {
		expect(luna9?.difficulty?.landerType).toBe("luna-9");
	});

	it("luna-9 lander type is registered in LANDER_TYPES", () => {
		expect(LANDER_TYPES["luna-9"]).toBeDefined();
		expect(LANDER_TYPES["luna-9"].name).toBe("LUNA 9");
	});

	it("facts describe the first soft lunar landing", () => {
		expect(luna9?.facts.date.startsWith("1966")).toBe(true);
		expect(luna9?.facts.landingSite.toLowerCase()).toContain("storms");
	});
});

describe("Sprint 5 Part B — HISTORIC_MISSIONS registration", () => {
	it("includes Apollo 13 and Luna 9 alongside Part A missions", () => {
		const ids = HISTORIC_MISSIONS.map((m) => m.id);
		expect(ids).toContain(APOLLO_13.id);
		for (const m of LUNA_MISSIONS) {
			expect(ids).toContain(m.id);
		}
		for (const m of APOLLO_MISSIONS) {
			expect(ids).toContain(m.id);
		}
		for (const m of ARTEMIS_MISSIONS) {
			expect(ids).toContain(m.id);
		}
	});

	it("orders missions by era: Soviet → Apollo → Artemis", () => {
		const eras = HISTORIC_MISSIONS.map((m) => m.era);
		const firstApolloIdx = eras.findIndex((e) => e === "1960s-70s-apollo");
		const firstSovietIdx = eras.findIndex((e) => e === "1960s-soviet");
		const firstArtemisIdx = eras.findIndex((e) => e === "2020s-artemis");
		// Soviet must come before the first Apollo, and every Apollo before
		// the first Artemis. (Using findIndex + lastIndexOf semantics would
		// be overkill for this ordering assertion.)
		expect(firstSovietIdx).toBeLessThan(firstApolloIdx);
		expect(firstApolloIdx).toBeLessThan(firstArtemisIdx);
	});

	it("covers three distinct mission kinds", () => {
		const kinds = new Set(HISTORIC_MISSIONS.map((m) => m.kind));
		expect(kinds.has("landing")).toBe(true);
		expect(kinds.has("survive")).toBe(true);
		expect(kinds.has("auto-landing")).toBe(true);
	});
});

// Regression: embed-mode auto-landing autopilot bug
// Found by /qa on 2026-04-18
// Report: .gstack/qa-reports/qa-report-moonlander-2026-04-18.md
// The Game constructor's urlSeed branch used to build a generic freeplay
// Mission, bypassing selectMission — which meant Luna 9's auto-landing
// autopilot was never engaged on a shared or embed URL. The fix looks up
// HISTORIC_MISSIONS by seed first; these tests pin the lookup contract.
describe("Sprint 5 Part B — URL-seed routing preserves historic kind", () => {
	it("Luna 9 seed resolves to its auto-landing mission", () => {
		const luna9 = LUNA_MISSIONS.find((m) => m.name.includes("LUNA 9"));
		expect(luna9).toBeDefined();
		const resolved = HISTORIC_MISSIONS.find((m) => m.seed === luna9?.seed);
		expect(resolved).toBe(luna9);
		expect(resolved?.kind).toBe("auto-landing");
	});

	it("Apollo 13 seed resolves to its survive mission", () => {
		const resolved = HISTORIC_MISSIONS.find((m) => m.seed === APOLLO_13.seed);
		expect(resolved).toBe(APOLLO_13);
		expect(resolved?.kind).toBe("survive");
	});

	it("a non-historic seed does not resolve", () => {
		// 1969 is the canonical freeplay/Apollo-11 terrain seed used across
		// tests. Picking a seed known NOT to collide with any historic
		// mission is the whole point of the null branch in the fix.
		const nonHistoricSeed = 424242;
		const collides = HISTORIC_MISSIONS.some(
			(m) => m.seed === nonHistoricSeed,
		);
		expect(collides).toBe(false);
		const resolved = HISTORIC_MISSIONS.find(
			(m) => m.seed === nonHistoricSeed,
		);
		expect(resolved).toBeUndefined();
	});
});

// Regression: handleSurviveSuccess hard-coded "vanilla" leaderboard mode
// Found by /qa on 2026-04-18
// Report: .gstack/qa-reports/qa-report-moonlander-2026-04-18.md
// Pre-fix, the survive-success path always wrote to the vanilla leaderboard
// slot, ignoring currentFlight.authenticMode. Authentic survive isn't wired
// today, but hard-coding the mode made the slot a silent future-bug trap
// (mirror handleCollisionResult's pattern). These tests pin the contract.
describe("Sprint 5 Part B — handleSurviveSuccess leaderboard mode routing", () => {
	beforeAll(installLocalStoragePolyfill);

	beforeEach(() => {
		localStorage.clear();
		_resetLeaderboardCacheForTests();
	});

	// Build just enough of a Game shape for handleSurviveSuccess: lander,
	// audio no-ops, ghost/telemetry stubs, seed + currentFlight. The real
	// Game object pulls in CanvasRenderer / WebAudio / DOM listeners, which
	// a unit test shouldn't need.
	function makeSurviveGame(authenticMode: boolean, seed: number): Game {
		const noop = () => {};
		return {
			status: "playing",
			score: 0,
			seed,
			lander: { fuel: 200 },
			audio: {
				setThruster: noop,
				playSuccess: noop,
				soundtrack: { onLanded: noop },
			},
			ghostRecorder: { save: noop },
			telemetry: { getDuration: () => 42 },
			currentFlight: { authenticMode, authenticState: null },
			lastRank: null,
		} as unknown as Game;
	}

	it("records to the vanilla slot when currentFlight.authenticMode is false", () => {
		const game = makeSurviveGame(false, APOLLO_13.seed);
		handleSurviveSuccess(game);
		expect(getScores(APOLLO_13.seed, "vanilla").length).toBe(1);
		expect(getScores(APOLLO_13.seed, "authentic").length).toBe(0);
	});

	it("records to the authentic slot when currentFlight.authenticMode is true", () => {
		const game = makeSurviveGame(true, APOLLO_13.seed);
		handleSurviveSuccess(game);
		expect(getScores(APOLLO_13.seed, "authentic").length).toBe(1);
		expect(getScores(APOLLO_13.seed, "vanilla").length).toBe(0);
	});

	it("falls back to vanilla when currentFlight is null", () => {
		const game = makeSurviveGame(false, APOLLO_13.seed);
		(game as { currentFlight: unknown }).currentFlight = null;
		handleSurviveSuccess(game);
		expect(getScores(APOLLO_13.seed, "vanilla").length).toBe(1);
	});
});
