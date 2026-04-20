import type { TerrainArchetype, TerrainPalette } from "../render/palette";

/**
 * Sprint 7.1 PR 1.5 — share URL encoding.
 *
 * Random Missions need a way for one player to say "hey, try this one"
 * without a backend. A `?cfg=<base64url>` query parameter carries the
 * mission's seed + archetype + (optional) palette overrides, so two
 * browsers decode the same payload → same DifficultyConfig → same
 * terrain → same Random Mission.
 *
 * Schema is deliberately tiny (single-letter keys) to keep the URL
 * short. Unknown fields are ignored by the decoder so the schema can
 * grow without breaking old links:
 *   { s: seed, a: archetype, p?: palette }
 *
 * Use only URL-safe base64 (no `+`, `/`, `=` padding) so the string
 * round-trips through share sheets, chat clients, and email without
 * mangling.
 */

/** What a share URL decodes into. Feeds directly into `DifficultyConfig`. */
export interface ShareConfig {
	seed: number;
	archetype?: TerrainArchetype;
	palette?: TerrainPalette;
}

const VALID_ARCHETYPES: TerrainArchetype[] = [
	"rolling",
	"crater-field",
	"spires",
	"mesa",
	"flats",
];

function base64UrlEncode(s: string): string {
	// `btoa` is available in all modern browsers and Node 16+. Swap
	// +/= for URL-safe characters and drop padding. Output matches
	// RFC 4648 §5.
	const b64 = btoa(s);
	return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlDecode(s: string): string | null {
	try {
		const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
		const pad = (4 - (b64.length % 4)) % 4;
		return atob(b64 + "=".repeat(pad));
	} catch {
		return null;
	}
}

/**
 * Encode a share config as a URL-safe base64 string suitable for use
 * as a `?cfg=` query-parameter value. Fails silently (returns null) if
 * the input is malformed — callers should fall back to a plain
 * `?seed=N` URL in that case.
 */
export function encodeShareConfig(config: ShareConfig): string | null {
	if (!Number.isFinite(config.seed)) return null;
	const compact: Record<string, unknown> = { s: config.seed };
	if (config.archetype) compact.a = config.archetype;
	if (config.palette) compact.p = config.palette;
	try {
		return base64UrlEncode(JSON.stringify(compact));
	} catch {
		return null;
	}
}

/**
 * Decode a `?cfg=` query-parameter value back into a ShareConfig.
 * Returns null on malformed input (bad base64, bad JSON, missing seed,
 * unknown archetype). Unknown top-level keys are ignored so the schema
 * can grow without breaking old links.
 */
export function decodeShareConfig(encoded: string): ShareConfig | null {
	const json = base64UrlDecode(encoded);
	if (!json) return null;
	let parsed: unknown;
	try {
		parsed = JSON.parse(json);
	} catch {
		return null;
	}
	if (!parsed || typeof parsed !== "object") return null;
	const obj = parsed as Record<string, unknown>;
	const seed = obj.s;
	if (typeof seed !== "number" || !Number.isFinite(seed)) return null;

	const result: ShareConfig = { seed };
	if (typeof obj.a === "string") {
		const archetype = obj.a as TerrainArchetype;
		if (VALID_ARCHETYPES.includes(archetype)) {
			result.archetype = archetype;
		}
	}
	if (obj.p && typeof obj.p === "object") {
		// Only copy the palette fields we recognize; ignore anything
		// extra so a bad payload can't inject renderer surprises.
		const p = obj.p as Record<string, unknown>;
		const palette: TerrainPalette = {
			terrain: typeof p.terrain === "string" ? p.terrain : "",
			terrainEdge: typeof p.terrainEdge === "string" ? p.terrainEdge : "",
			sky: typeof p.sky === "string" ? p.sky : "",
		};
		if (typeof p.starDensity === "number") palette.starDensity = p.starDensity;
		if (typeof p.starTint === "string") palette.starTint = p.starTint;
		if (typeof p.accent === "string") palette.accent = p.accent;
		// Require at least the three mandatory string fields to be valid
		// hex/color strings — a bare `{}` palette payload is dropped.
		if (palette.terrain && palette.terrainEdge && palette.sky) {
			result.palette = palette;
		}
	}
	return result;
}

/**
 * Read `?cfg=<value>` from the provided URL (defaults to window.location).
 * Convenience wrapper so `main.ts` can call this once on boot without
 * reimplementing the URLSearchParams dance.
 */
export function readShareConfigFromUrl(
	url: string = typeof window !== "undefined" ? window.location.href : "",
): ShareConfig | null {
	if (!url) return null;
	try {
		const params = new URL(url).searchParams;
		const cfg = params.get("cfg");
		return cfg ? decodeShareConfig(cfg) : null;
	} catch {
		return null;
	}
}

/**
 * Build a share URL for the given config, using the caller-provided
 * origin+pathname as the base (or `window.location.origin + pathname`
 * in the browser). Returns null if encoding fails.
 *
 * The share URL uses `?cfg=` and omits `?seed=` — the seed is already
 * inside the cfg payload. Consumers that want a legacy-compatible URL
 * should just stringify the seed separately.
 */
export function buildShareUrl(
	config: ShareConfig,
	base: string = typeof window !== "undefined"
		? window.location.origin + window.location.pathname
		: "",
): string | null {
	const encoded = encodeShareConfig(config);
	if (!encoded || !base) return null;
	const sep = base.includes("?") ? "&" : "?";
	return `${base}${sep}cfg=${encoded}`;
}
