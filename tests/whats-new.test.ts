import { describe, expect, it } from "vitest";
import {
	isUpdatePending,
	LATEST_VERSION,
	WHATS_NEW,
} from "../src/data/whatsNew";

describe("whatsNew — data integrity", () => {
	it("has at least one entry", () => {
		expect(WHATS_NEW.length).toBeGreaterThan(0);
	});

	it("LATEST_VERSION is the newest entry's version", () => {
		expect(LATEST_VERSION).toBe(WHATS_NEW[0].version);
	});

	it("every entry has a version, date, and non-empty summary", () => {
		for (const e of WHATS_NEW) {
			expect(e.version).toMatch(/^\d+\.\d+\.\d+/);
			expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
			expect(e.summary.trim().length).toBeGreaterThan(0);
		}
	});

	it("entries are ordered newest-first", () => {
		const cmp = (a: string, b: string) => {
			const pa = a.split(".").map(Number);
			const pb = b.split(".").map(Number);
			for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
				const d = (pa[i] ?? 0) - (pb[i] ?? 0);
				if (d !== 0) return d;
			}
			return 0;
		};
		for (let i = 1; i < WHATS_NEW.length; i++) {
			expect(
				cmp(WHATS_NEW[i - 1].version, WHATS_NEW[i].version),
			).toBeGreaterThan(0);
		}
	});

	it("versions are unique", () => {
		const versions = WHATS_NEW.map((e) => e.version);
		expect(new Set(versions).size).toBe(versions.length);
	});
});

describe("isUpdatePending", () => {
	it("is false for a brand-new player (no seen version)", () => {
		expect(isUpdatePending(null, "0.6.7.0")).toBe(false);
	});

	it("is false when seen version equals latest", () => {
		expect(isUpdatePending("0.6.7.0", "0.6.7.0")).toBe(false);
	});

	it("is true when an older version was seen", () => {
		expect(isUpdatePending("0.6.6.0", "0.6.7.0")).toBe(true);
		expect(isUpdatePending("0.6.5.0", "0.6.7.0")).toBe(true);
	});

	it("is false when there is no latest version", () => {
		expect(isUpdatePending("0.6.6.0", "")).toBe(false);
	});

	it("defaults latest to LATEST_VERSION", () => {
		expect(isUpdatePending(LATEST_VERSION)).toBe(false);
	});
});
