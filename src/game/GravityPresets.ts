/**
 * Gravity presets for the physics sandbox.
 * Players can select a gravity environment on the free-play mission select screen.
 */

export interface GravityPreset {
	name: string;
	gravity: number; // m/s² (real-world value, displayed to player)
	gameGravity: number; // game units/s² (scaled for the physics engine)
	color: string; // HUD display color
}

// Base game gravity: GRAVITY = 97.2 game units/s² represents 1.62 m/s² (Moon)
// Scale factor: 97.2 / 1.62 = 60
const SCALE = 60;

export const GRAVITY_PRESETS: GravityPreset[] = [
	{ name: "Moon", gravity: 1.62, gameGravity: 1.62 * SCALE, color: "#00ff88" },
	{ name: "Mars", gravity: 3.72, gameGravity: 3.72 * SCALE, color: "#ff6644" },
	{
		name: "Earth",
		gravity: 9.81,
		gameGravity: 9.81 * SCALE,
		color: "#4488ff",
	},
	{
		name: "Jupiter",
		gravity: 24.79,
		gameGravity: 24.79 * SCALE,
		color: "#ffaa00",
	},
	{ name: "Zero-G", gravity: 0, gameGravity: 0, color: "#aa44ff" },
];

/** Get a preset by name (case-insensitive) */
export function getGravityPreset(name: string): GravityPreset | undefined {
	return GRAVITY_PRESETS.find(
		(p) => p.name.toLowerCase() === name.toLowerCase(),
	);
}

/** Get the default preset (Moon) */
export function getDefaultPreset(): GravityPreset {
	return GRAVITY_PRESETS[0];
}

/** Cycle to the next preset */
export function nextPreset(current: GravityPreset): GravityPreset {
	const idx = GRAVITY_PRESETS.indexOf(current);
	return GRAVITY_PRESETS[(idx + 1) % GRAVITY_PRESETS.length];
}

/** Cycle to the previous preset */
export function prevPreset(current: GravityPreset): GravityPreset {
	const idx = GRAVITY_PRESETS.indexOf(current);
	return GRAVITY_PRESETS[
		(idx - 1 + GRAVITY_PRESETS.length) % GRAVITY_PRESETS.length
	];
}
