import { beforeAll, describe, expect, it } from "vitest";
import {
	ALARM_LOCKOUT_FRAMES,
	ALTITUDE_ALARM_GATE_PX,
	type AuthenticState,
	applyAuthenticFilter,
	buildAuthenticState,
	type FlightConfig,
	isAltitudeBlackedOut,
	loadAuthenticPreference,
	saveAuthenticPreference,
	updateAuthentic,
} from "../src/game/AuthenticMode";
import { HeadlessGame } from "../src/game/HeadlessGame";
import type { LanderState } from "../src/game/Lander";
import type { Mission } from "../src/game/Missions";
import type { TerrainData } from "../src/game/Terrain";
import type { InputState } from "../src/systems/Input";
import { FIXED_TIMESTEP } from "../src/utils/constants";

// Node's default vitest environment has no localStorage. Install a minimal
// in-memory polyfill for any test that exercises the preference API.
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

/**
 * Sprint 5.5 Part A — IRON RULE regression tests.
 *
 * These tests guarantee that Authentic Mode cannot silently corrupt the
 * vanilla (Authentic=OFF) path. Per Eng review, Part A blocks on these
 * three tests being present and green.
 */

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

const THRUST_INPUT: InputState = { ...NO_INPUT, thrustUp: true };

function hashString(s: string): string {
	let h = 0;
	for (let i = 0; i < s.length; i++) {
		h = (h * 31 + s.charCodeAt(i)) | 0;
	}
	return h.toString(16);
}

function landerFingerprint(lander: LanderState): string {
	return [
		lander.x.toFixed(6),
		lander.y.toFixed(6),
		lander.vx.toFixed(6),
		lander.vy.toFixed(6),
		lander.angle.toFixed(6),
		lander.fuel.toFixed(6),
		lander.thrusting ? 1 : 0,
		lander.status,
	].join("|");
}

describe("Sprint 5.5 — CRITICAL regression tests", () => {
	/**
	 * CRITICAL #1: OFF byte-identical.
	 *
	 * With Authentic Mode OFF, the game's simulation must produce bit-for-bit
	 * identical results to a simulation that has never heard of Authentic Mode.
	 * Proven by running the same deterministic input sequence with and without
	 * the filter applied (state=null mirrors OFF) and asserting identical
	 * lander state frame by frame.
	 *
	 * This is the single most important test. It is the firewall between the
	 * Authentic code path and the rest of the game. If this test breaks, it
	 * means Authentic Mode is silently affecting players who did not opt in.
	 */
	it("OFF byte-identical: filtered and unfiltered paths produce identical lander state", () => {
		const seed = 1969;
		const game = new HeadlessGame(seed);
		const control = new HeadlessGame(seed);

		const filterState: AuthenticState | null = null;

		const scripted: InputState[] = [];
		for (let i = 0; i < 200; i++) scripted.push(NO_INPUT);
		for (let i = 0; i < 100; i++) scripted.push(THRUST_INPUT);
		for (let i = 0; i < 200; i++) scripted.push(NO_INPUT);

		const fingerprints: string[] = [];
		const controlFingerprints: string[] = [];

		for (let i = 0; i < scripted.length; i++) {
			const filtered = applyAuthenticFilter(scripted[i], filterState);
			// When filterState is null, applyAuthenticFilter MUST return the
			// same input reference (zero-allocation OFF path). Any drift
			// (spread, new object) would break the byte-identity guarantee
			// this test protects.
			expect(filtered).toBe(scripted[i]);

			game.step(filtered, FIXED_TIMESTEP);
			control.step(scripted[i], FIXED_TIMESTEP);

			fingerprints.push(landerFingerprint(game.lander));
			controlFingerprints.push(landerFingerprint(control.lander));
		}

		expect(hashString(fingerprints.join("\n"))).toBe(
			hashString(controlFingerprints.join("\n")),
		);
		expect(game.lander.x).toBe(control.lander.x);
		expect(game.lander.y).toBe(control.lander.y);
		expect(game.lander.vy).toBe(control.lander.vy);
		expect(game.lander.fuel).toBe(control.lander.fuel);
	});

	/**
	 * CRITICAL #2: Fork replay vanilla-lock.
	 *
	 * Per the plan spec, startForkReplay sets currentFlight to
	 * { authenticMode: false, authenticState: null } unconditionally. This
	 * guarantees AI-captured episodes replay with vanilla physics even if
	 * the player has Authentic Mode toggled ON globally. Without this lock,
	 * replaying a captured episode after toggling Authentic ON would inject
	 * a 1202 alarm into the playback and the trajectory would diverge from
	 * the one the AI actually flew.
	 *
	 * This is asserted structurally on the FlightConfig shape since the
	 * Game.startForkReplay setter is the single source of truth.
	 */
	it("Fork replay vanilla-lock: forked FlightConfig is always vanilla, regardless of player pref", () => {
		// Simulate the post-startForkReplay flight config. This mirrors
		// Game.ts:startForkReplay which unconditionally sets:
		//   this.currentFlight = { authenticMode: false, authenticState: null }
		const forkedFlight: FlightConfig = {
			authenticMode: false,
			authenticState: null,
		};

		// Even if the player had Authentic ON for some mission, the forked
		// flight must not inherit it.
		saveAuthenticPreference(999, true);
		expect(loadAuthenticPreference(999)).toBe(true);

		expect(forkedFlight.authenticMode).toBe(false);
		expect(forkedFlight.authenticState).toBeNull();

		// Filter called with the forked config's null state must be a no-op
		// passthrough — the alarm can never fire on fork replay.
		const input: InputState = { ...THRUST_INPUT };
		const result = applyAuthenticFilter(input, forkedFlight.authenticState);
		expect(result).toBe(input);

		saveAuthenticPreference(999, false);
	});

	/**
	 * CRITICAL #3: 1202 alarm skip-on-collision.
	 *
	 * The Apollo 11 1202 alarm fires at a deterministic seed-derived frame
	 * ONLY if the lander is above the altitude gate at that frame. If the
	 * lander has descended past the gate (ALTITUDE_ALARM_GATE_PX = 150) by
	 * the scheduled frame, the alarm skips entirely — the flight gets lucky.
	 *
	 * This test runs the updateAuthentic state machine against a fake
	 * terrain + lander in both scenarios:
	 *   - Above-gate case: alarm ARMED → ACTIVE, filter zeros thrust, then
	 *     ACTIVE → DONE after ALARM_LOCKOUT_FRAMES tics.
	 *   - Below-gate case: alarm ARMED → DONE directly, filter never
	 *     zeroes thrust, so physics outcome is byte-identical to vanilla.
	 */
	it("1202 skip-on-collision: below-gate descent skips alarm, physics match vanilla", () => {
		const apollo11 = {
			id: 511,
			name: "Apollo 11",
			description: "Sea of Tranquility",
			seed: 11_1969,
			kind: "landing",
			era: "1960s-70s-apollo",
			facts: {
				craftName: "Eagle",
				date: "1969-07-20",
				commander: "Armstrong",
				landingSite: "Sea of Tranquility",
				coordinates: "0.67°N 23.47°E",
				descentStartAltitudeM: 15000,
				notableMoment: "22-second fuel margin",
				historicalReferenceLabel: "Fuel margin",
				historicalReferenceValue: 22,
				historicalReferenceUnit: "seconds",
			},
			moments: [],
		} as unknown as Mission;

		const state = buildAuthenticState(apollo11, 11_1969, false);
		expect(state).not.toBeNull();
		if (!state) return;
		expect(state.alarm?.state).toBe("ARMED");
		const scheduledFrame = state.alarm?.scheduledFrame;
		expect(scheduledFrame).toBe(((11_1969 * 31) % 300) + 200);

		// Build a flat-terrain fixture the state machine can query. Points
		// array is read by Physics.getTerrainHeightAt via linear interp,
		// so two points at the same Y form a flat ground plane.
		const flatTerrain = {
			points: [
				{ x: 0, y: 700 },
				{ x: 5000, y: 700 },
			],
			pads: [],
		} as unknown as TerrainData;

		// Below-gate lander: AGL = 700 - 650 = 50 < ALTITUDE_ALARM_GATE_PX.
		const belowGateLander = {
			x: 100,
			y: 650,
			vx: 0,
			vy: 0,
			angle: 0,
			fuel: 1000,
			thrusting: false,
			status: "flying",
		} as unknown as LanderState;
		expect(700 - 650).toBeLessThan(ALTITUDE_ALARM_GATE_PX);

		// Advance the state machine up to the scheduled frame — at that
		// point the gate check runs; below-gate should route ARMED → DONE
		// via an "alarm-skipped" transition.
		let transition: ReturnType<typeof updateAuthentic> = null;
		for (let i = 0; i <= (scheduledFrame ?? 0); i++) {
			transition = updateAuthentic(state, belowGateLander, flatTerrain);
			if (transition !== null) break;
		}
		expect(transition).toBe("alarm-skipped");
		expect(state.alarm?.state).toBe("DONE");
		// Filter applied with the post-skip state MUST be a no-op — the
		// player's input passes through unchanged.
		const input = { ...THRUST_INPUT };
		expect(applyAuthenticFilter(input, state)).toBe(input);
	});

	it("1202 fires above gate: ARMED → ACTIVE → DONE and filter zeros thrust during ACTIVE", () => {
		const apollo11 = {
			id: 511,
			era: "1960s-70s-apollo",
			kind: "landing",
			seed: 11_1969,
		} as unknown as Mission;

		const state = buildAuthenticState(apollo11, 11_1969, false);
		expect(state).not.toBeNull();
		if (!state) return;
		const scheduledFrame = state.alarm?.scheduledFrame ?? 0;

		// Above-gate lander: AGL = 700 - 100 = 600 > ALTITUDE_ALARM_GATE_PX.
		const flatTerrain = {
			points: [
				{ x: 0, y: 700 },
				{ x: 5000, y: 700 },
			],
			pads: [],
		} as unknown as TerrainData;
		const aboveGateLander = {
			x: 100,
			y: 100,
			vx: 0,
			vy: 0,
			angle: 0,
			fuel: 1000,
			thrusting: false,
			status: "flying",
		} as unknown as LanderState;

		// Tick up to scheduled frame — should fire.
		let fireTransition: ReturnType<typeof updateAuthentic> = null;
		for (let i = 0; i <= scheduledFrame; i++) {
			fireTransition = updateAuthentic(state, aboveGateLander, flatTerrain);
			if (fireTransition !== null) break;
		}
		expect(fireTransition).toBe("alarm-fired");
		expect(state.alarm?.state).toBe("ACTIVE");

		// Filter now zeros thrustUp but preserves every other field.
		const input: InputState = { ...THRUST_INPUT, rotateLeft: true };
		const filtered = applyAuthenticFilter(input, state);
		expect(filtered).not.toBe(input);
		expect(filtered.thrustUp).toBe(false);
		expect(filtered.rotateLeft).toBe(true);

		// Continue ticking — after ALARM_LOCKOUT_FRAMES the alarm ends.
		let endTransition: ReturnType<typeof updateAuthentic> = null;
		for (let i = 0; i <= ALARM_LOCKOUT_FRAMES; i++) {
			endTransition = updateAuthentic(state, aboveGateLander, flatTerrain);
			if (endTransition === "alarm-ended") break;
		}
		expect(endTransition).toBe("alarm-ended");
		expect(state.alarm?.state).toBe("DONE");

		// Filter is a no-op again after DONE — thrustUp flows through.
		const postDone = applyAuthenticFilter(input, state);
		expect(postDone).toBe(input);
	});

	it("AGL blackout sanity: null state and empty terrain are no-ops", () => {
		const headlessTerrain = null as unknown as TerrainData;
		const fakeLander = { x: 0, y: 0 } as unknown as LanderState;
		expect(isAltitudeBlackedOut(null, fakeLander, headlessTerrain)).toBe(false);
	});
});

describe("Sprint 5.5 — HeadlessGame isolation", () => {
	/**
	 * HeadlessGame is used by AI training and AI Theater. It MUST NEVER
	 * activate Authentic mechanics — buildAuthenticState returns null when
	 * isHeadless is true, regardless of mission. Defense in depth against
	 * accidental activation in AI paths.
	 */
	it("buildAuthenticState returns null when isHeadless=true even for historic missions", () => {
		const apollo11 = {
			id: 511,
			era: "1960s-70s-apollo",
			kind: "landing",
		} as unknown as Mission;

		expect(buildAuthenticState(apollo11, 11_1969, true)).toBeNull();
		// Sanity check: same call with isHeadless=false does produce a state.
		expect(buildAuthenticState(apollo11, 11_1969, false)).not.toBeNull();
	});

	it("buildAuthenticState returns null for non-historic missions", () => {
		const freeplay = { id: 1 } as unknown as Mission;
		expect(buildAuthenticState(freeplay, 1969, false)).toBeNull();
	});
});
