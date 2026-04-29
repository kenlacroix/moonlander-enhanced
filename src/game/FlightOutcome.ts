/**
 * Sprint 7.4 — narrative outcome label for Campaign post-landing chatter.
 *
 * `FlightOutcome.result` is a SECONDARY label, not a new gameplay state.
 * `lander.status` stays binary (landed | crashed | flying | idle) and
 * `Game.status` stays binary (landed | crashed | ...). `bounced` never
 * demotes a landing — `lander.status === "landed"` whenever
 * `result === "clean" || result === "bounced"`. Campaign progression
 * (campaignCompleted Set) updates on any `landed`, regardless of label.
 *
 * The `cleanClears: Set<number>` save state holds mission IDs the player
 * has cleared with `result === "clean"` — used to render the star icon
 * on the mission menu next to the existing checkmark.
 */

import {
	MAX_LANDING_ANGLE,
	MAX_LANDING_ANGULAR_RATE,
	MAX_LANDING_SPEED,
} from "../utils/constants";
import type { LanderState } from "./Lander";
import { normAngle } from "./Physics";
import type { LandingPad } from "./Terrain";

export type FlightOutcomeResult = "clean" | "bounced" | "crashed" | "timeout";

export interface FlightOutcome {
	result: FlightOutcomeResult;
	fuelRemainingPct: number;
	hazardsFired: { alien: boolean; storm: boolean; fuelLeak: boolean };
	/** v3 only — undefined under v2 (no angular-rate gate) */
	bestAngularRate?: number;
	/** Defined on clean/bounced; absolute pixel distance from pad center */
	landingMarginPx?: number;
}

/** Per design doc: clean = pad-centered AND not in worst 20% of any tolerance. */
const LANDING_MARGIN_PX_THRESHOLD = 40;
const TOLERANCE_WORST_FRACTION = 0.8;

/**
 * Classify a landed flight as `clean` or `bounced`. Caller guarantees
 * landing tolerances were already met (lander.status === "landed").
 *
 * `clean` requires:
 *   - `landingMarginPx <= LANDING_MARGIN_PX_THRESHOLD` (pad-centered)
 *   - vertical speed at touchdown not in the last 20% of MAX_LANDING_SPEED
 *   - horizontal speed at touchdown not in the last 20% of MAX_LANDING_SPEED
 *   - angle deviation not in the last 20% of MAX_LANDING_ANGLE
 *   - v3 only: angular rate not in the last 20% of the per-mission gate
 *
 * Anything else is `bounced` — landed but ugly. Hoshi's branching dialogue
 * picks the right line based on this label.
 */
export function classifyLanding(
	lander: LanderState,
	pad: { x: number; width: number },
	bestAngularRate: number | undefined,
	maxLandingAngularRateOverride: number | undefined,
): { result: "clean" | "bounced"; landingMarginPx: number } {
	const padCenter = pad.x + pad.width / 2;
	const landingMarginPx = Math.abs(lander.x - padCenter);

	if (landingMarginPx > LANDING_MARGIN_PX_THRESHOLD) {
		return { result: "bounced", landingMarginPx };
	}

	const angleDev = Math.abs(normAngle(lander.angle));
	const vyMag = Math.abs(lander.vy);
	const vxMag = Math.abs(lander.vx);

	// "Worst 20% of tolerance band" = magnitude is at or above 80% of the gate.
	const vyClean = vyMag < MAX_LANDING_SPEED * TOLERANCE_WORST_FRACTION;
	const vxClean = vxMag < MAX_LANDING_SPEED * TOLERANCE_WORST_FRACTION;
	const angleClean = angleDev < MAX_LANDING_ANGLE * TOLERANCE_WORST_FRACTION;

	let rateClean = true;
	if (lander.physicsVersion === 3 && bestAngularRate !== undefined) {
		const gate = maxLandingAngularRateOverride ?? MAX_LANDING_ANGULAR_RATE;
		rateClean = bestAngularRate < gate * TOLERANCE_WORST_FRACTION;
	}

	const clean = vyClean && vxClean && angleClean && rateClean;
	return { result: clean ? "clean" : "bounced", landingMarginPx };
}

/** Find the closest pad to the lander x — used for landingMarginPx when
 * we know lander landed but don't have direct pad reference at outcome
 * emission time. */
export function nearestPad(
	landerX: number,
	pads: LandingPad[],
): { x: number; width: number } | null {
	let best: LandingPad | null = null;
	let bestD = Number.POSITIVE_INFINITY;
	for (const p of pads) {
		const d = Math.abs(landerX - (p.x + p.width / 2));
		if (d < bestD) {
			bestD = d;
			best = p;
		}
	}
	return best ? { x: best.x, width: best.width } : null;
}
