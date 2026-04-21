/** Lander variants with different performance characteristics */

export interface LanderType {
	name: string;
	thrustMultiplier: number; // multiplied against THRUST_FORCE
	fuelMultiplier: number; // multiplied against starting fuel
	massMultiplier: number; // affects gravity pull (higher = heavier)
	rotationMultiplier: number; // v2: rotation speed scalar (instant angle set)
	/** Sprint 7.2 — RCS angular-accel + RCS-tank scalar under v3 physics.
	 * Optional so legacy seed data stays compatible. Defaults to 1.0. */
	rcsMultiplier?: number;
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
		rcsMultiplier: 1.0,
		color: "#4488ff",
		description: "Balanced. No surprises.",
	},
	heavy: {
		name: "ATLAS",
		thrustMultiplier: 1.4,
		fuelMultiplier: 1.3,
		massMultiplier: 1.5,
		rotationMultiplier: 0.7,
		rcsMultiplier: 0.8,
		color: "#ff6644",
		description: "More thrust, more fuel, but heavy and sluggish.",
	},
	light: {
		name: "SPARROW",
		thrustMultiplier: 0.7,
		fuelMultiplier: 0.7,
		massMultiplier: 0.6,
		rotationMultiplier: 1.5,
		rcsMultiplier: 1.2,
		color: "#44ffaa",
		description: "Light and nimble. Low fuel, low thrust.",
	},
	"apollo-lm": {
		name: "APOLLO LM",
		thrustMultiplier: 1.1,
		fuelMultiplier: 0.85,
		massMultiplier: 1.2,
		rotationMultiplier: 0.9,
		rcsMultiplier: 0.9,
		color: "#d4d4c8",
		description: "Lunar Module. Authentic descent stage.",
	},
	"artemis-lm": {
		name: "ARTEMIS LM",
		thrustMultiplier: 1.3,
		fuelMultiplier: 1.1,
		massMultiplier: 1.35,
		rotationMultiplier: 0.85,
		rcsMultiplier: 1.1,
		color: "#e8b878",
		description: "Modern Human Landing System. Heavier, more capable.",
	},
	"luna-9": {
		name: "LUNA 9",
		thrustMultiplier: 0.85,
		fuelMultiplier: 0.5,
		massMultiplier: 0.7,
		rotationMultiplier: 1.1,
		rcsMultiplier: 0.7,
		color: "#c8b080",
		description:
			"Soviet 1966 automated probe. Light, fuel-sparse, modest thrust.",
	},
};

export function getLanderType(name?: string): LanderType {
	return LANDER_TYPES[name ?? "standard"] ?? LANDER_TYPES.standard;
}
