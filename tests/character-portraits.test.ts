import { afterEach, describe, expect, it, vi } from "vitest";
import {
	buildFrameSvg,
	CharacterPortraits,
	type MouthFrame,
	mouthFrameAt,
	PORTRAIT_SVGS,
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
