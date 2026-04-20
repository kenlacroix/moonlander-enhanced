import { describe, expect, it } from "vitest";
import {
	decodeShareConfig,
	encodeShareConfig,
	readShareConfigFromUrl,
} from "../src/utils/shareUrl";

/**
 * Sprint 7.1 PR 1.5 — share URL encoding round-trip tests.
 *
 * The encoder must produce URL-safe base64 that survives a real
 * copy-paste from a chat client or share sheet. The decoder must be
 * strict about validating its input — a malformed `?cfg=` should drop
 * to null, not crash the boot flow.
 */

describe("Share URL — round trip", () => {
	it("encodes and decodes a seed-only config", () => {
		const encoded = encodeShareConfig({ seed: 1969 });
		expect(encoded).toBeTruthy();
		const decoded = decodeShareConfig(encoded!);
		expect(decoded?.seed).toBe(1969);
		expect(decoded?.archetype).toBeUndefined();
		expect(decoded?.palette).toBeUndefined();
	});

	it("encodes and decodes seed + archetype", () => {
		const encoded = encodeShareConfig({
			seed: 42,
			archetype: "crater-field",
		});
		const decoded = decodeShareConfig(encoded!);
		expect(decoded?.seed).toBe(42);
		expect(decoded?.archetype).toBe("crater-field");
	});

	it("encodes and decodes seed + archetype + palette", () => {
		const encoded = encodeShareConfig({
			seed: 42,
			archetype: "spires",
			palette: {
				terrain: "#5a6270",
				terrainEdge: "#8a94a2",
				sky: "#020610",
				starDensity: 1.5,
				starTint: "#e0e8ff",
				accent: "#00ff88",
			},
		});
		const decoded = decodeShareConfig(encoded!);
		expect(decoded?.palette?.terrain).toBe("#5a6270");
		expect(decoded?.palette?.starDensity).toBe(1.5);
		expect(decoded?.palette?.accent).toBe("#00ff88");
	});

	it("produces URL-safe base64 (no +, /, or = chars)", () => {
		// Many seeds to exercise the character set of the output.
		for (let i = 0; i < 100; i++) {
			const encoded = encodeShareConfig({
				seed: i * 999,
				archetype: "mesa",
			});
			expect(encoded).toBeTruthy();
			expect(encoded!).not.toMatch(/[+/=]/);
		}
	});
});

describe("Share URL — decoder validation", () => {
	it("rejects malformed base64", () => {
		expect(decodeShareConfig("!!!not-base64!!!")).toBeNull();
	});

	it("rejects bad JSON even if base64 is valid", () => {
		// "hello" base64-url → "aGVsbG8"; valid base64, garbage JSON.
		expect(decodeShareConfig("aGVsbG8")).toBeNull();
	});

	it("rejects a payload with no seed", () => {
		// {a: "crater-field"} encoded — missing seed.
		const encoded = encodeShareConfig({
			seed: 1,
			archetype: "crater-field",
		});
		// Patch the encoded string to simulate a missing seed by
		// encoding directly without the `s` field.
		expect(encoded).toBeTruthy();
		// Encode `{"a":"crater-field"}` by hand:
		const hand = Buffer.from(JSON.stringify({ a: "crater-field" }))
			.toString("base64")
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/g, "");
		expect(decodeShareConfig(hand)).toBeNull();
	});

	it("rejects an unknown archetype (silently strips it)", () => {
		const hand = Buffer.from(JSON.stringify({ s: 1, a: "hypercube" }))
			.toString("base64")
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/g, "");
		const decoded = decodeShareConfig(hand);
		expect(decoded?.seed).toBe(1);
		expect(decoded?.archetype).toBeUndefined();
	});

	it("drops a palette with missing mandatory fields", () => {
		const encoded = encodeShareConfig({ seed: 1 });
		// Inject a malformed palette directly.
		const hand = Buffer.from(JSON.stringify({ s: 1, p: { terrain: "#abc" } }))
			.toString("base64")
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/g, "");
		const decoded = decodeShareConfig(hand);
		expect(decoded?.palette).toBeUndefined();
	});

	it("ignores unknown top-level keys (forward-compat)", () => {
		// Future schemas can add fields; old decoders must tolerate them.
		const hand = Buffer.from(
			JSON.stringify({ s: 7, a: "flats", z: "future-field" }),
		)
			.toString("base64")
			.replace(/\+/g, "-")
			.replace(/\//g, "_")
			.replace(/=+$/g, "");
		const decoded = decodeShareConfig(hand);
		expect(decoded?.seed).toBe(7);
		expect(decoded?.archetype).toBe("flats");
	});
});

describe("Share URL — encoder validation", () => {
	it("returns null for a non-finite seed", () => {
		expect(encodeShareConfig({ seed: Number.NaN })).toBeNull();
		expect(encodeShareConfig({ seed: Infinity })).toBeNull();
	});
});

describe("Share URL — readShareConfigFromUrl", () => {
	it("parses ?cfg= out of a full URL", () => {
		const encoded = encodeShareConfig({ seed: 99, archetype: "flats" });
		const url = `https://example.com/?cfg=${encoded}`;
		const decoded = readShareConfigFromUrl(url);
		expect(decoded?.seed).toBe(99);
		expect(decoded?.archetype).toBe("flats");
	});

	it("returns null when no cfg param is present", () => {
		expect(readShareConfigFromUrl("https://example.com/")).toBeNull();
		expect(readShareConfigFromUrl("https://example.com/?seed=1")).toBeNull();
	});

	it("returns null on a malformed URL", () => {
		expect(readShareConfigFromUrl("not-a-url")).toBeNull();
	});
});
