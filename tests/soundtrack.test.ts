import { describe, expect, it } from "vitest";
import { Soundtrack } from "../src/systems/Soundtrack";

/**
 * Sprint 7.1 PR 1.5 — per-archetype motif smoke tests.
 *
 * The Soundtrack class wraps Web Audio nodes that can't be unit-tested
 * directly in Node / jsdom. These tests just prove:
 *  1. `setArchetype` accepts every known archetype (including undefined)
 *     without throwing.
 *  2. Instantiating + calling setArchetype is safe BEFORE `init()` (the
 *     flow Game uses on reset).
 *  3. Methods that require an AudioContext no-op gracefully without one.
 */

describe("Soundtrack — per-archetype setup", () => {
	it("setArchetype accepts every archetype without throwing", () => {
		const st = new Soundtrack();
		expect(() => st.setArchetype("rolling")).not.toThrow();
		expect(() => st.setArchetype("crater-field")).not.toThrow();
		expect(() => st.setArchetype("spires")).not.toThrow();
		expect(() => st.setArchetype("mesa")).not.toThrow();
		expect(() => st.setArchetype("flats")).not.toThrow();
	});

	it("setArchetype(undefined) is allowed and uses the default profile", () => {
		const st = new Soundtrack();
		expect(() => st.setArchetype(undefined)).not.toThrow();
	});

	it("methods no-op safely without an AudioContext", () => {
		const st = new Soundtrack();
		// None of these should throw when ctx has never been initialized.
		expect(() => st.start()).not.toThrow();
		expect(() => st.update(0.5)).not.toThrow();
		expect(() => st.stop()).not.toThrow();
		expect(() => st.onLanded()).not.toThrow();
		expect(() => st.onCrashed()).not.toThrow();
		expect(() => st.setMuted(true)).not.toThrow();
	});

	it("setArchetype before init() still leaves the soundtrack safe to call", () => {
		// Matches Game.reset()'s flow: setArchetype is called every reset,
		// but init() only fires once on first audio interaction.
		const st = new Soundtrack();
		st.setArchetype("crater-field");
		st.setArchetype("spires");
		expect(() => st.start()).not.toThrow();
	});
});
