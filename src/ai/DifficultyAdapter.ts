import { getScores } from "../systems/Leaderboard";
import type { DifficultyConfig } from "../game/Terrain";

/**
 * Adjusts mission difficulty based on player performance history.
 *
 * Looks at the player's recent scores on a given seed. If they're
 * consistently landing well, it tightens the parameters. If they're
 * struggling (no scores or low scores), it eases up.
 *
 * Only applies to free-play missions. Campaign uses fixed difficulty.
 */

export interface AdaptiveModifiers {
	fuelBonus: number;       // extra fuel (can be negative for penalty)
	padWidthBonus: number;   // extra pad width (can be negative)
	windReduction: number;   // wind strength reduction (0-1 multiplier)
	label: string;           // "EASY" | "NORMAL" | "HARD" | "EXPERT"
}

export function getAdaptiveModifiers(seed: number): AdaptiveModifiers {
	const scores = getScores(seed);

	if (scores.length === 0) {
		// Never played this mission. Slight help.
		return { fuelBonus: 100, padWidthBonus: 10, windReduction: 0.5, label: "EASY" };
	}

	if (scores.length < 3) {
		// Played a few times. Normal difficulty.
		return { fuelBonus: 0, padWidthBonus: 0, windReduction: 0, label: "NORMAL" };
	}

	// Average of last 3 scores
	const recent = scores.slice(0, 3);
	const avgScore = recent.reduce((a, b) => a + b.score, 0) / recent.length;

	if (avgScore > 500) {
		// Consistently good. Make it harder.
		return { fuelBonus: -150, padWidthBonus: -15, windReduction: -0.3, label: "EXPERT" };
	}

	if (avgScore > 300) {
		// Decent. Slight challenge increase.
		return { fuelBonus: -50, padWidthBonus: -5, windReduction: -0.1, label: "HARD" };
	}

	// Struggling. Normal.
	return { fuelBonus: 0, padWidthBonus: 0, windReduction: 0, label: "NORMAL" };
}

/** Apply adaptive modifiers to a difficulty config */
export function applyAdaptiveModifiers(
	base: DifficultyConfig | undefined,
	modifiers: AdaptiveModifiers,
): DifficultyConfig {
	return {
		roughness: base?.roughness,
		padMinWidth: Math.max(30, (base?.padMinWidth ?? 60) + modifiers.padWidthBonus),
		padMaxWidth: Math.max(40, (base?.padMaxWidth ?? 120) + modifiers.padWidthBonus),
		padCount: base?.padCount,
		startingFuel: (base?.startingFuel ?? 1000) + modifiers.fuelBonus,
		spawnY: base?.spawnY,
		windStrength: Math.max(0, (base?.windStrength ?? 0) * (1 + modifiers.windReduction)),
		landerType: base?.landerType,
	};
}
