/** Lander variants with different performance characteristics */

export interface LanderType {
	name: string;
	thrustMultiplier: number; // multiplied against THRUST_FORCE
	fuelMultiplier: number; // multiplied against starting fuel
	massMultiplier: number; // affects gravity pull (higher = heavier)
	rotationMultiplier: number; // affects rotation speed
	color: string; // accent color
	description: string;
}

export const LANDER_TYPES: Record<string, LanderType> = {
	standard: {
		name: "EAGLE",
		thrustMultiplier: 1.0,
		fuelMultiplier: 1.0,
		massMultiplier: 1.0,
		rotationMultiplier: 1.0,
		color: "#4488ff",
		description: "Balanced. No surprises.",
	},
	heavy: {
		name: "ATLAS",
		thrustMultiplier: 1.4,
		fuelMultiplier: 1.3,
		massMultiplier: 1.5,
		rotationMultiplier: 0.7,
		color: "#ff6644",
		description: "More thrust, more fuel, but heavy and sluggish.",
	},
	light: {
		name: "SPARROW",
		thrustMultiplier: 0.7,
		fuelMultiplier: 0.7,
		massMultiplier: 0.6,
		rotationMultiplier: 1.5,
		color: "#44ffaa",
		description: "Light and nimble. Low fuel, low thrust.",
	},
};

export function getLanderType(name?: string): LanderType {
	return LANDER_TYPES[name ?? "standard"] ?? LANDER_TYPES.standard;
}
