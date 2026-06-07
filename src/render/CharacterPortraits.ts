/**
 * Sprint 7.6 — Animated character portraits.
 *
 * Hand-authored SVG busts for the campaign characters. Each SVG contains
 * three mouth groups (mouth-closed / mouth-half / mouth-open) at the same
 * anchor position; toggling which one is visible animates talking. The
 * busts are rasterized once per frame-state via data-URL Image, and
 * consumers gate on readiness — get() returns null until the image has
 * decoded, so the caption never waits on art (text-only is the fallback,
 * identical to pre-7.6 behavior).
 *
 * Silhouette is the color-blind-safe channel: Hoshi = rectangular glasses,
 * side-parted hair, lanyard badge inside a mission-patch roundel; Chen =
 * blunt-cut bob, over-ear headset cups, boom mic. Neither identity depends
 * on the mint/amber accent colors, and the FLIGHT:/CAPCOM: speaker prefix
 * in the caption remains untouched (portraits are additive).
 */

import type { Speaker } from "../data/campaignDialogue";

/** 0 = closed, 1 = half, 2 = open. */
export type MouthFrame = 0 | 1 | 2;

/** Caption box + portrait frame accent colors per speaker. The SVG
 * palettes below anchor to these values — change them together. */
export const SPEAKER_COLORS: Record<Speaker, { border: string; text: string }> =
	{
		hoshi: { border: "#7fc8b8", text: "#c8f0e8" },
		chen: { border: "#d8a868", text: "#f0d8a8" },
	};

const MOUTH_GROUP_IDS = ["mouth-closed", "mouth-half", "mouth-open"] as const;

/** Talk loop: closed → half → open → half at ~7 fps. */
const MOUTH_SEQUENCE: readonly MouthFrame[] = [0, 1, 2, 1];
const MOUTH_FRAME_MS = 140;

/** Mouth frame for a free-running clock (Date.now()), matching the
 * Date.now()-driven pulse pattern already used in CanvasRenderer. Callers
 * gate on prefersReducedMotion() and pass frame 0 instead. */
export function mouthFrameAt(nowMs: number): MouthFrame {
	const idx = Math.floor(nowMs / MOUTH_FRAME_MS) % MOUTH_SEQUENCE.length;
	return MOUTH_SEQUENCE[idx] ?? 0;
}

/** Dr. Liam Hoshi (FLIGHT) — NASA mission-patch flat illustration on a
 * roundel, mint palette anchored to his #7fc8b8 caption color. */
const HOSHI_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">
<circle cx="60" cy="60" r="58" fill="#0d2230"/>
<circle cx="60" cy="60" r="58" fill="none" stroke="#7fc8b8" stroke-width="3"/>
<circle cx="60" cy="60" r="51" fill="none" stroke="#c8f0e8" stroke-width="1"/>
<path d="M18 120 Q60 76 102 120 Z" fill="#1c4a4a"/>
<path d="M18 120 Q60 76 102 120" fill="none" stroke="#7fc8b8" stroke-width="2"/>
<path d="M47 100 L60 91 L73 100 L73 120 L47 120 Z" fill="#0d2230"/>
<rect x="56" y="86" width="8" height="14" fill="#c8f0e8"/>
<rect x="55" y="101" width="10" height="15" rx="1.5" fill="#7fc8b8"/>
<line x1="55" y1="105" x2="65" y2="105" stroke="#0d2230" stroke-width="1.2"/>
<line x1="55" y1="109" x2="65" y2="109" stroke="#0d2230" stroke-width="1.2"/>
<line x1="55" y1="113" x2="65" y2="113" stroke="#0d2230" stroke-width="1.2"/>
<path d="M40 86 Q40 60 60 60 Q80 60 80 86" fill="#1c2e3a"/>
<ellipse cx="44.5" cy="61" rx="3" ry="4.5" fill="#c69a76"/>
<ellipse cx="75.5" cy="61" rx="3" ry="4.5" fill="#c69a76"/>
<path d="M44 52 Q44 28 60 28 Q76 28 76 52 L76 60 Q70 46 60 46 Q50 46 44 60 Z" fill="#241a16"/>
<path d="M44 56 Q43 38 55 33 Q51 45 62 44 Q72 45 74 38 Q77 48 76 58 Q70 48 60 48 Q49 48 44 56 Z" fill="#3a2a20"/>
<path d="M46 50 Q46 82 60 86 Q74 82 74 50 Q74 43 60 43 Q46 43 46 50 Z" fill="#c69a76"/>
<path d="M46 50 Q46 43 60 43 Q74 43 74 50 Q74 60 71 66 Q66 52 60 52 Q54 52 49 66 Q46 60 46 50 Z" fill="#d8aa84"/>
<rect x="48" y="56" width="11" height="8" rx="2" fill="#15252e" stroke="#c8f0e8" stroke-width="2.2"/>
<rect x="61" y="56" width="11" height="8" rx="2" fill="#15252e" stroke="#c8f0e8" stroke-width="2.2"/>
<line x1="59" y1="59" x2="61" y2="59" stroke="#c8f0e8" stroke-width="2.2"/>
<line x1="48" y1="58" x2="44" y2="57" stroke="#c8f0e8" stroke-width="2.2"/>
<line x1="72" y1="58" x2="76" y2="57" stroke="#c8f0e8" stroke-width="2.2"/>
<ellipse cx="53.5" cy="59" rx="2.2" ry="2.6" fill="#1c2e3a"/>
<ellipse cx="66.5" cy="59" rx="2.2" ry="2.6" fill="#1c2e3a"/>
<path d="M47 51 Q50 47 57 49" fill="none" stroke="#241a16" stroke-width="2"/>
<path d="M63 49 Q70 47 73 51" fill="none" stroke="#241a16" stroke-width="2"/>
<path d="M58 66 Q60 69 62 66" fill="none" stroke="#b07a58" stroke-width="1.5"/>
<g id="mouth-closed">
<line x1="54" y1="76" x2="66" y2="76" stroke="#8a4a3a" stroke-width="2.4" stroke-linecap="round"/>
</g>
<g id="mouth-half" visibility="hidden">
<ellipse cx="60" cy="76.5" rx="6" ry="3" fill="#5a2a22"/>
<path d="M54 75 Q60 73.5 66 75" fill="none" stroke="#8a4a3a" stroke-width="1.4"/>
</g>
<g id="mouth-open" visibility="hidden">
<ellipse cx="60" cy="77" rx="6" ry="5" fill="#5a2a22"/>
</g>
</svg>`;

/** CapCom Maya Chen — 16-bit pixel-art bust (SNES portrait box), amber
 * palette anchored to her #d8a868 caption color. Headset + boom mic is
 * her diagnostic comms-operator silhouette. */
const CHEN_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" shape-rendering="crispEdges">
<rect width="120" height="120" fill="#1a1410"/>
<rect x="6" y="14" width="20" height="14" fill="#3a2c18"/>
<rect x="94" y="14" width="20" height="14" fill="#3a2c18"/>
<rect x="9" y="17" width="14" height="3" fill="#6b4f24"/>
<rect x="9" y="22" width="10" height="3" fill="#6b4f24"/>
<rect x="97" y="17" width="14" height="3" fill="#6b4f24"/>
<rect x="97" y="22" width="10" height="3" fill="#6b4f24"/>
<rect x="14" y="92" width="92" height="28" fill="#2e3640"/>
<rect x="14" y="92" width="92" height="5" fill="#3c4754"/>
<polygon points="48,92 60,108 72,92 66,92 60,100 54,92" fill="#1f262e"/>
<rect x="58" y="92" width="4" height="20" fill="#d8a868"/>
<rect x="52" y="112" width="16" height="6" fill="#7a5a2c"/>
<rect x="52" y="84" width="16" height="12" fill="#caa078"/>
<rect x="52" y="84" width="16" height="3" fill="#a8825e"/>
<rect x="34" y="26" width="52" height="46" fill="#1c1410"/>
<rect x="30" y="34" width="6" height="40" fill="#1c1410"/>
<rect x="84" y="34" width="6" height="40" fill="#1c1410"/>
<rect x="34" y="26" width="52" height="6" fill="#2a1f16"/>
<rect x="40" y="30" width="4" height="4" fill="#3a2a1c"/>
<rect x="72" y="30" width="4" height="4" fill="#3a2a1c"/>
<rect x="40" y="34" width="40" height="46" fill="#e0b486"/>
<rect x="40" y="34" width="40" height="4" fill="#ecc497"/>
<rect x="40" y="74" width="40" height="6" fill="#caa078"/>
<rect x="40" y="34" width="40" height="8" fill="#1c1410"/>
<rect x="44" y="40" width="6" height="2" fill="#1c1410"/>
<rect x="58" y="40" width="6" height="2" fill="#1c1410"/>
<rect x="72" y="40" width="4" height="2" fill="#1c1410"/>
<rect x="44" y="46" width="12" height="2" fill="#2a1c12"/>
<rect x="64" y="46" width="12" height="2" fill="#2a1c12"/>
<rect x="44" y="50" width="11" height="6" fill="#fbf3e8"/>
<rect x="65" y="50" width="11" height="6" fill="#fbf3e8"/>
<rect x="49" y="50" width="4" height="6" fill="#3a2618"/>
<rect x="67" y="50" width="4" height="6" fill="#3a2618"/>
<rect x="50" y="51" width="2" height="2" fill="#fbf3e8"/>
<rect x="68" y="51" width="2" height="2" fill="#fbf3e8"/>
<rect x="58" y="58" width="4" height="8" fill="#caa078"/>
<rect x="58" y="64" width="6" height="2" fill="#b8906a"/>
<rect x="44" y="62" width="5" height="4" fill="#d89a72"/>
<rect x="71" y="62" width="5" height="4" fill="#d89a72"/>
<rect x="36" y="22" width="48" height="5" fill="#524a3e"/>
<rect x="34" y="24" width="4" height="6" fill="#524a3e"/>
<rect x="82" y="24" width="4" height="6" fill="#524a3e"/>
<rect x="36" y="22" width="48" height="2" fill="#665c4e"/>
<rect x="30" y="52" width="12" height="18" fill="#423a30"/>
<rect x="32" y="54" width="8" height="14" fill="#5c5244"/>
<rect x="33" y="55" width="6" height="5" fill="#302a22"/>
<rect x="78" y="52" width="12" height="18" fill="#423a30"/>
<rect x="80" y="54" width="8" height="14" fill="#5c5244"/>
<rect x="81" y="55" width="6" height="5" fill="#302a22"/>
<rect x="30" y="68" width="3" height="10" fill="#524a3e"/>
<rect x="31" y="76" width="14" height="3" fill="#524a3e"/>
<rect x="44" y="74" width="3" height="6" fill="#524a3e"/>
<rect x="31" y="79" width="14" height="1" fill="#302a22"/>
<rect x="46" y="72" width="7" height="8" fill="#d8a868"/>
<rect x="47" y="73" width="5" height="6" fill="#f0d8a8"/>
<g id="mouth-closed">
<rect x="56" y="71" width="10" height="2" fill="#8a4a3c"/>
</g>
<g id="mouth-half" visibility="hidden">
<rect x="56" y="70" width="10" height="4" fill="#6a2e26"/>
<rect x="57" y="71" width="8" height="2" fill="#a85a4a"/>
</g>
<g id="mouth-open" visibility="hidden">
<rect x="56" y="69" width="10" height="7" fill="#5a221c"/>
<rect x="58" y="73" width="6" height="1" fill="#e8d2c4"/>
</g>
<g fill="#000000" opacity="0.10">
<rect x="0" y="3" width="120" height="1"/>
<rect x="0" y="9" width="120" height="1"/>
<rect x="0" y="15" width="120" height="1"/>
<rect x="0" y="21" width="120" height="1"/>
<rect x="0" y="27" width="120" height="1"/>
<rect x="0" y="33" width="120" height="1"/>
<rect x="0" y="39" width="120" height="1"/>
<rect x="0" y="45" width="120" height="1"/>
<rect x="0" y="51" width="120" height="1"/>
<rect x="0" y="57" width="120" height="1"/>
<rect x="0" y="63" width="120" height="1"/>
<rect x="0" y="69" width="120" height="1"/>
<rect x="0" y="75" width="120" height="1"/>
<rect x="0" y="81" width="120" height="1"/>
<rect x="0" y="87" width="120" height="1"/>
<rect x="0" y="93" width="120" height="1"/>
<rect x="0" y="99" width="120" height="1"/>
<rect x="0" y="105" width="120" height="1"/>
<rect x="0" y="111" width="120" height="1"/>
<rect x="0" y="117" width="120" height="1"/>
</g>
</svg>`;

export const PORTRAIT_SVGS: Record<Speaker, string> = {
	hoshi: HOSHI_SVG,
	chen: CHEN_SVG,
};

/**
 * Return the SVG with exactly one mouth group visible. Source SVGs author
 * mouth-closed visible and the other two hidden; this rewrites the three
 * <g> opening tags so `frame` is the visible one.
 */
export function buildFrameSvg(svg: string, frame: MouthFrame): string {
	return MOUTH_GROUP_IDS.reduce((out, id, i) => {
		const tag =
			i === frame ? `<g id="${id}">` : `<g id="${id}" visibility="hidden">`;
		return out.replace(new RegExp(`<g id="${id}"[^>]*>`), tag);
	}, svg);
}

/**
 * Lazily rasterizes the 6 frame images (2 speakers × 3 mouth states) from
 * data URLs on first get(). No-op outside the browser (headless / tests).
 */
export class CharacterPortraits {
	private frames: Map<string, HTMLImageElement> | null = null;

	/** Kick off rasterization ahead of the first campaign line so the
	 * caption doesn't pop from text-only to portrait mid-display. */
	preload(): void {
		this.load();
	}

	private load(): void {
		if (this.frames || typeof Image === "undefined") return;
		this.frames = new Map();
		for (const speaker of Object.keys(PORTRAIT_SVGS) as Speaker[]) {
			for (const frame of [0, 1, 2] as const) {
				const img = new Image();
				// Decode failure (strict CSP without img-src data:, exotic
				// SVG restrictions) degrades to text-only captions — warn so
				// the loss is visible, mirroring the WebGL-fallback rule.
				img.onerror = () => {
					console.warn(
						`CharacterPortraits: ${speaker} frame ${frame} failed to decode — captions stay text-only`,
					);
				};
				img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
					buildFrameSvg(PORTRAIT_SVGS[speaker], frame),
				)}`;
				this.frames.set(`${speaker}:${frame}`, img);
			}
		}
	}

	/** Frame image, or null while still decoding — caller draws text-only
	 * until the art is ready, never blocking on it. */
	get(speaker: Speaker, frame: MouthFrame): HTMLImageElement | null {
		this.load();
		const img = this.frames?.get(`${speaker}:${frame}`);
		return img?.complete && img.naturalWidth > 0 ? img : null;
	}
}
