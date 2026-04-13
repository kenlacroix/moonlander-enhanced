/** Wind system — applies horizontal force that varies over time */

export interface WindState {
	/** Current wind speed in game units/s² (positive = rightward) */
	speed: number;
	/** Maximum wind strength for this mission */
	maxSpeed: number;
	/** Wind gust cycle frequency */
	frequency: number;
}

/** Create wind for a mission based on seed */
export function createWind(seed: number, strength: number): WindState {
	// Use seed to set direction and base frequency
	const dir = seed % 2 === 0 ? 1 : -1;
	return {
		speed: 0,
		maxSpeed: strength * dir,
		frequency: 0.3 + (seed % 7) * 0.1,
	};
}

/** Update wind — oscillates with gusts for organic feel */
export function updateWind(wind: WindState, elapsed: number): void {
	// Base oscillation + slower gust envelope
	const base = Math.sin(elapsed * wind.frequency);
	const gust = Math.sin(elapsed * wind.frequency * 0.3) * 0.5 + 0.5;
	wind.speed = wind.maxSpeed * base * gust;
}

/** Get wind label for HUD (direction arrow + speed) */
export function getWindLabel(wind: WindState): string {
	const absSpeed = Math.abs(wind.speed);
	if (absSpeed < 1) return "CALM";
	const arrow = wind.speed > 0 ? ">>>" : "<<<";
	const strength = absSpeed < 15 ? "LIGHT" : absSpeed < 30 ? "MODERATE" : "STRONG";
	return `${arrow} ${strength}`;
}
