import {
	COLOR_PAD_BEACON,
	COLOR_TERRAIN,
	COLOR_TERRAIN_EDGE,
} from "../utils/constants";

/**
 * Per-mission visual skin. Missions opt in by setting their `palette`
 * field; archetypes provide a default bias when the mission omits it.
 * Missing values fall back to the system defaults in `constants.ts`,
 * which produces the same output as v0.6.0.0 for freeplay missions
 * that keep `palette: undefined`.
 */
export interface TerrainPalette {
	/** Main polygon fill color for terrain. */
	terrain: string;
	/** Terrain outline/edge color. */
	terrainEdge: string;
	/** Sky background color. Drawn behind the starfield. */
	sky: string;
	/** Multiplier on star counts. 1.0 = default, 2.0 = polar-dark, etc. */
	starDensity?: number;
	/** Primary star tint. Default white. */
	starTint?: string;
	/** Override for the pad beacon color (bright pulsing accent). */
	accent?: string;
}

/**
 * Archetype classification. Dispatched from `generateTerrain` to the
 * archetype-specific post-processor. `rolling` is the default (bypasses
 * dispatch, produces the same output as v0.6.0.0 midpoint displacement).
 * See `src/game/terrain/archetypes.ts` for the generators.
 */
export type TerrainArchetype =
	| "rolling"
	| "crater-field"
	| "spires"
	| "mesa"
	| "flats";

/**
 * Default palette bias per archetype. Picked up when a mission doesn't
 * set its own `palette` but does set an `archetype`. Gives generated
 * (Random Mission) terrain an archetype-appropriate look with no
 * additional data to curate.
 *
 * Rolling stays neutral grey to match the pre-Sprint-7.1 default, so
 * freeplay missions without a palette render identically to v0.6.0.0.
 */
const ARCHETYPE_DEFAULT_PALETTES: Record<TerrainArchetype, TerrainPalette> = {
	rolling: {
		terrain: COLOR_TERRAIN,
		terrainEdge: COLOR_TERRAIN_EDGE,
		sky: "#000000",
	},
	"crater-field": {
		terrain: "#7a4a3a",
		terrainEdge: "#a0665a",
		sky: "#0a0505",
	},
	spires: {
		terrain: "#5a6270",
		terrainEdge: "#8a94a2",
		sky: "#020610",
		starDensity: 1.2,
	},
	mesa: {
		terrain: "#a89878",
		terrainEdge: "#c8b898",
		sky: "#1a0e05",
	},
	flats: {
		terrain: "#9a9a9a",
		terrainEdge: COLOR_TERRAIN_EDGE,
		sky: "#000000",
	},
};

/**
 * Palette used when no mission palette or archetype is specified.
 * Byte-identical to pre-Sprint-7.1 rendering — the regression pin
 * for MISSIONS[] seeds and Apollo 11/15/17 depends on this.
 */
const SYSTEM_DEFAULT_PALETTE: TerrainPalette = {
	terrain: COLOR_TERRAIN,
	terrainEdge: COLOR_TERRAIN_EDGE,
	sky: "#000000",
	starDensity: 1.0,
	starTint: "#ffffff",
	accent: COLOR_PAD_BEACON,
};

/**
 * Resolve the palette to use for rendering this mission. Order:
 *   1. mission.palette (explicit curation)
 *   2. archetype-default palette (archetype bias)
 *   3. system default (matches v0.6.0.0 exactly)
 *
 * Partial mission palettes merge with the archetype default, so a
 * mission can override just the sky color without restating the
 * terrain color. Consumers should never read COLOR_TERRAIN directly
 * once palettes ship — they should always go through this helper.
 */
export function resolvePalette(
	mission: { palette?: TerrainPalette } | null | undefined,
	archetype: TerrainArchetype | undefined,
): Required<TerrainPalette> {
	const archetypeDefault = archetype
		? ARCHETYPE_DEFAULT_PALETTES[archetype]
		: SYSTEM_DEFAULT_PALETTE;
	const override: Partial<TerrainPalette> = mission?.palette ?? {};
	return {
		terrain: override.terrain ?? archetypeDefault.terrain,
		terrainEdge: override.terrainEdge ?? archetypeDefault.terrainEdge,
		sky: override.sky ?? archetypeDefault.sky,
		starDensity:
			override.starDensity ??
			archetypeDefault.starDensity ??
			SYSTEM_DEFAULT_PALETTE.starDensity ??
			1.0,
		starTint:
			override.starTint ??
			archetypeDefault.starTint ??
			SYSTEM_DEFAULT_PALETTE.starTint ??
			"#ffffff",
		accent:
			override.accent ??
			archetypeDefault.accent ??
			SYSTEM_DEFAULT_PALETTE.accent ??
			COLOR_PAD_BEACON,
	};
}
