import { PAD_MIN_WIDTH } from "../utils/constants";
import { createRng } from "../utils/math";
import { isHistoricMission } from "./HistoricMission";
import type { Mission } from "./Missions";
import type { LandingPad, TerrainData } from "./Terrain";
import { findFreeColumnsBetweenPads } from "./terrain/archetypes";

/**
 * Sprint 7.1 PR 1.5 — hidden pads.
 *
 * A hidden pad is a second landing target that the renderer hides until
 * the lander drops below REVEAL_AGL_PX. Landing on one awards a 3×
 * score multiplier (applied in CollisionHandler) plus a HIDDEN PAD
 * BONUS toast. Physics treats it like any other pad in `terrain.pads`,
 * so collision + safe-landing checks just work.
 *
 * Historic missions (Apollo / Artemis / Luna / Apollo 13) are gated off
 * in `maybeGenerateHiddenPad` — they stay byte-identical to their
 * curated terrain so the Authentic-Mode scoring-margin share cards
 * stay historically honest. All freeplay and Random Mission paths opt
 * in by default via the seed-modulo gate.
 */

/** AGL (pixels above ground) below which the hidden pad is revealed. */
export const HIDDEN_PAD_REVEAL_AGL_PX = 100;

/** Score multiplier applied when landing on a hidden pad. */
export const HIDDEN_PAD_SCORE_MULTIPLIER = 3;

/** Hidden pads appear on roughly 1 in 4 eligible missions — frequent
 * enough to feel like a discoverable rule, rare enough to stay a
 * surprise. Deterministic per seed so share URLs and leaderboards stay
 * reproducible. */
const HIDDEN_PAD_FREQUENCY = 4;

/** Pad width range for hidden pads. Narrower than regular pads so
 * finding one late (post-reveal) still demands a real approach. */
const HIDDEN_PAD_WIDTH_MIN = PAD_MIN_WIDTH;
const HIDDEN_PAD_WIDTH_MAX = PAD_MIN_WIDTH + 20;

/**
 * Generate a hidden pad for this mission/seed, or null if the mission
 * is ineligible (historic) or the RNG roll didn't land in a hidden
 * mission.
 *
 * Determinism: uses `createRng(seed ^ 0x5AD_PAD)` so hidden-pad
 * placement is reproducible from the same seed without colliding with
 * the RNG stream used by `generateTerrain` (which starts from
 * `createRng(seed)` directly).
 */
export function maybeGenerateHiddenPad(
	mission: Mission | null,
	terrain: TerrainData,
	seed: number,
): LandingPad | null {
	if (mission && isHistoricMission(mission)) return null;

	const rng = createRng(seed ^ 0x5ad5eed);
	const roll = Math.floor(rng() * HIDDEN_PAD_FREQUENCY);
	if (roll !== 0) return null;

	const gaps = findFreeColumnsBetweenPads(
		terrain.pads,
		HIDDEN_PAD_WIDTH_MAX + 8,
	);
	if (gaps.length === 0) return null;

	const gap = gaps[Math.floor(rng() * gaps.length)];
	const padWidth =
		HIDDEN_PAD_WIDTH_MIN +
		rng() * (HIDDEN_PAD_WIDTH_MAX - HIDDEN_PAD_WIDTH_MIN);
	const maxStart = gap.end - padWidth;
	const padX = gap.start + rng() * (maxStart - gap.start);
	const padRight = padX + padWidth;

	// Average terrain height under the chosen span, then flatten it in
	// place so the hidden pad sits on a landable shelf — same treatment
	// regular pads get in `placeLandingPads`.
	let sumY = 0;
	let count = 0;
	for (const p of terrain.points) {
		if (p.x >= padX && p.x <= padRight) {
			sumY += p.y;
			count++;
		}
	}
	if (count === 0) return null;
	const padY = sumY / count;
	for (const p of terrain.points) {
		if (p.x >= padX && p.x <= padRight) p.y = padY;
	}

	return {
		x: padX,
		y: padY,
		width: padWidth,
		points: 1,
		hidden: true,
	};
}

/**
 * True when the lander has dropped below the reveal AGL over the
 * hidden pad's x-span. Called each frame; transition false → true is
 * what fires the dust-plume reveal effect (see Game.onFixedUpdate).
 */
export function isHiddenPadRevealed(
	hiddenPad: LandingPad,
	landerX: number,
	landerY: number,
): boolean {
	// Reveal as soon as the lander is anywhere near the pad's altitude.
	// Using pad.y directly (not per-column terrain) keeps the reveal
	// zone rectangular and easy to reason about.
	const agl = hiddenPad.y - landerY;
	if (agl < 0) return true; // below pad surface → always revealed
	return agl <= HIDDEN_PAD_REVEAL_AGL_PX;
}

/** Locate the single hidden pad in a terrain (if any). */
export function findHiddenPad(terrain: TerrainData): LandingPad | null {
	return terrain.pads.find((p) => p.hidden) ?? null;
}
