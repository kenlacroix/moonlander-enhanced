import { afterEach, describe, expect, it, vi } from "vitest";
import {
	buildFrameSvg,
	CHATTER_PANEL,
	CharacterPortraits,
	layoutChatterPanel,
	MIN_CAPTION_CHARS,
	MONO_CHAR_EM,
	type MouthFrame,
	mouthFrameAt,
	PORTRAIT_SVGS,
	SPEAKER_COLORS,
	wrapMonospace,
} from "../src/render/CharacterPortraits";

const GROUP_IDS = ["mouth-closed", "mouth-half", "mouth-open"] as const;

function openingTag(svg: string, id: string): string {
	const match = svg.match(new RegExp(`<g id="${id}"[^>]*>`));
	if (!match) throw new Error(`missing mouth group ${id}`);
	return match[0];
}

describe("portrait SVGs", () => {
	for (const [speaker, svg] of Object.entries(PORTRAIT_SVGS)) {
		it(`${speaker} contains all three mouth groups, closed visible`, () => {
			for (const id of GROUP_IDS) {
				expect(svg).toContain(`<g id="${id}"`);
			}
			expect(openingTag(svg, "mouth-closed")).not.toContain("hidden");
			expect(openingTag(svg, "mouth-half")).toContain("hidden");
			expect(openingTag(svg, "mouth-open")).toContain("hidden");
		});
	}
});

describe("buildFrameSvg", () => {
	for (const frame of [0, 1, 2] as const) {
		it(`frame ${frame} makes exactly that group visible`, () => {
			for (const svg of Object.values(PORTRAIT_SVGS)) {
				const out = buildFrameSvg(svg, frame);
				GROUP_IDS.forEach((id, i) => {
					if (i === frame) {
						expect(openingTag(out, id)).not.toContain("hidden");
					} else {
						expect(openingTag(out, id)).toContain("hidden");
					}
				});
			}
		});
	}
});

describe("mouthFrameAt", () => {
	it("cycles closed → half → open → half at 140ms steps", () => {
		const frames: MouthFrame[] = [0, 140, 280, 420, 560].map(mouthFrameAt);
		expect(frames).toEqual([0, 1, 2, 1, 0]);
	});
});

describe("CharacterPortraits outside the browser", () => {
	it("get() degrades to null without Image (headless/tests)", () => {
		expect(new CharacterPortraits().get("hoshi", 0)).toBeNull();
	});
});

describe("CharacterPortraits readiness", () => {
	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it("returns the image once decoded", () => {
		vi.stubGlobal(
			"Image",
			class {
				src = "";
				complete = true;
				naturalWidth = 1;
			},
		);
		expect(new CharacterPortraits().get("chen", 2)).not.toBeNull();
	});

	it("returns null while still decoding", () => {
		vi.stubGlobal(
			"Image",
			class {
				src = "";
				complete = false;
				naturalWidth = 0;
			},
		);
		expect(new CharacterPortraits().get("hoshi", 1)).toBeNull();
	});
});

describe("wrapMonospace", () => {
	it("wraps on word boundaries with no line over the column", () => {
		const lines = wrapMonospace(
			"the quick brown fox jumps over the lazy dog",
			12,
		);
		expect(lines.length).toBeGreaterThan(1);
		for (const line of lines) expect(line.length).toBeLessThanOrEqual(12);
		// every break is at a space (no word was split)
		for (const line of lines) expect(line).not.toMatch(/^\s|\s$/);
	});

	it("reconstructs the original text when joined with spaces", () => {
		const text = "the quick brown fox jumps over the lazy dog again";
		expect(wrapMonospace(text, 12).join(" ")).toBe(text);
	});

	it("hard-breaks a word longer than the column instead of overflowing", () => {
		const lines = wrapMonospace("supercalifragilistic", 8);
		for (const line of lines) expect(line.length).toBeLessThanOrEqual(8);
		expect(lines.join("")).toBe("supercalifragilistic");
		expect(lines.length).toBe(3);
	});

	it("returns a single line for short text", () => {
		expect(wrapMonospace("short line", 40)).toEqual(["short line"]);
	});

	it("returns [] for empty string", () => {
		expect(wrapMonospace("", 40)).toEqual([]);
	});

	it("survives a degenerate non-positive column (floors to 1 char)", () => {
		// A non-positive budget must not hang or emit empty lines — the
		// guard floors it to one char per line.
		for (const budget of [0, -5]) {
			const lines = wrapMonospace("hi yo", budget);
			expect(lines).toEqual(["h", "i", "y", "o"]);
		}
	});
});

describe("layoutChatterPanel hostile input (LLM-streamed text)", () => {
	for (const isTouch of [false, true] as const) {
		it(`oversized text never grows past the thrust zone (isTouch=${isTouch})`, () => {
			const huge = `FLIGHT: ${"all work and no play makes jack a dull boy ".repeat(50)}`;
			const layout = layoutChatterPanel(huge, isTouch);
			expect(layout.boxY + layout.boxH).toBeLessThanOrEqual(480);
			expect(layout.lines.at(-1)).toMatch(/…$/);
		});
	}

	it("normalizes newlines/tabs/multi-spaces before wrapping", () => {
		const layout = layoutChatterPanel(
			"CAPCOM: Copy.\nDescend\t when  ready.",
			false,
		);
		expect(layout.lines.join(" ")).toBe("CAPCOM: Copy. Descend when ready.");
	});

	it("whitespace-only text degrades to a single blank line", () => {
		const layout = layoutChatterPanel("   \n  ", false);
		expect(layout.lines).toEqual([""]);
		expect(layout.boxH).toBeGreaterThan(0);
	});
});

describe("SPEAKER_COLORS", () => {
	it("pins the per-speaker accent colors the SVG palettes anchor to", () => {
		expect(SPEAKER_COLORS.hoshi).toEqual({
			border: "#7fc8b8",
			text: "#c8f0e8",
		});
		expect(SPEAKER_COLORS.chen).toEqual({
			border: "#d8a868",
			text: "#f0d8a8",
		});
	});
});

describe("layoutChatterPanel", () => {
	// Longest real dialogue line in the game — mission 4 briefing (Hoshi),
	// 251 chars, copied verbatim from src/data/campaignDialogue.ts.
	const LONGEST_DIALOGUE =
		"Scenario four. This one's my fault — I stacked three things into one run. Crevices in the terrain, gravity anomaly active, and a sensor contact will start interfering on approach. One pad's wider than the other. Pick the easy one if it shows up first.";
	// Mid-length post-landing analysis line (crashed+hazard, Hoshi), 183 chars.
	const MID_DIALOGUE =
		"You took the contact AND the anomaly on the same pass. That's the worst-case stack. The book answer is: hover, reorient, then descend. You fly your altitude — you don't fly the clock.";

	const CASES: Array<[string, string]> = [
		["short callout", "CAPCOM: Watch your drift."],
		["longest briefing", `FLIGHT: ${LONGEST_DIALOGUE}`],
		["mid post-landing", `FLIGHT: ${MID_DIALOGUE}`],
	];

	// The 251-char line is the longest line we lay out — guard the fixture
	// so a future edit to the dialogue file doesn't silently weaken it.
	it("longest fixture is the documented 251-char line", () => {
		expect(LONGEST_DIALOGUE.length).toBe(251);
	});

	for (const isTouch of [false, true] as const) {
		for (const [label, text] of CASES) {
			describe(`${label} (isTouch=${isTouch})`, () => {
				const layout = layoutChatterPanel(text, isTouch);
				const padX = isTouch ? 18 : 14;
				const expectedPortraitPx = isTouch ? 96 : 64;

				it("is right-anchored exactly at CHATTER_PANEL.RIGHT", () => {
					expect(layout.boxX + layout.boxW).toBe(CHATTER_PANEL.RIGHT);
				});

				it("top edge sits at CHATTER_PANEL.TOP", () => {
					expect(layout.boxY).toBe(CHATTER_PANEL.TOP);
				});

				it("portrait stays right of LEFT_MIN (clear of descent path + sun halo)", () => {
					expect(layout.portraitX).toBeGreaterThanOrEqual(
						CHATTER_PANEL.LEFT_MIN,
					);
				});

				it("panel bottom clears the touch thrust zone (<= 480)", () => {
					const panelBottom = Math.max(
						layout.boxY + layout.boxH,
						layout.portraitY + layout.portraitPx,
					);
					expect(panelBottom).toBeLessThanOrEqual(480);
				});

				it("box width fits the longest wrapped line exactly", () => {
					const longest = layout.lines.reduce(
						(n, l) => Math.max(n, l.length),
						MIN_CAPTION_CHARS,
					);
					expect(layout.boxW).toBe(
						Math.ceil(longest * layout.fontPx * MONO_CHAR_EM) + 2 * padX,
					);
					for (const line of layout.lines) {
						expect(
							line.length * layout.fontPx * MONO_CHAR_EM,
						).toBeLessThanOrEqual(layout.boxW - 2 * padX);
					}
				});

				it("portrait is vertically centered on the box (±1px)", () => {
					const center = layout.boxY + layout.boxH / 2 - layout.portraitPx / 2;
					expect(Math.abs(layout.portraitY - center)).toBeLessThanOrEqual(1);
				});

				it(`portrait is ${expectedPortraitPx}px`, () => {
					expect(layout.portraitPx).toBe(expectedPortraitPx);
				});
			});
		}
	}
});
