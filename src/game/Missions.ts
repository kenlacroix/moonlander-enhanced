import type { TerrainPalette } from "../render/palette";
import type { DifficultyConfig } from "./Terrain";

/** Fixed mission definitions with deterministic seeds */
export interface Mission {
	id: number;
	name: string;
	seed: number;
	description: string;
	difficulty?: DifficultyConfig;
	/**
	 * Sun angle from vertical, in degrees. Positive is to the right of
	 * center, negative to the left. Drives the sun disc position in
	 * the skybox so each mission gets its own lighting identity.
	 * Apollo 11 had a low morning sun (~20°); Apollo 17 landed with
	 * long afternoon shadows (~65°); Artemis III targets polar
	 * regions where the sun grazes the horizon (~85°). Freeplay
	 * missions omit this and render with a default mid-morning angle.
	 */
	sunAngle?: number;
	/**
	 * Sprint 7.1 — per-mission visual skin (terrain, sky, starfield
	 * color + density). Optional; falls back to the archetype's default
	 * bias (when the mission has `difficulty.archetype` set), which
	 * falls back to the system default (byte-identical to v0.6.0.0).
	 * Set this on missions that want a specific curated look — Apollo
	 * 17's warm afternoon tan, Artemis III's polar-midnight blue,
	 * Luna 9's austere darker-grey. Freeplay missions usually omit it
	 * so freeplay terrain keeps its pre-Sprint-7.1 appearance.
	 */
	palette?: TerrainPalette;
}

/** Free-play missions — all use default difficulty */
export const MISSIONS: Mission[] = [
	{
		id: 1,
		name: "TRANQUILITY BASE",
		seed: 1969,
		description: "Flat terrain, wide pads. Learn the controls.",
	},
	{
		id: 2,
		name: "SEA OF STORMS",
		seed: 4217,
		description: "Moderate terrain. Watch your speed.",
	},
	{
		id: 3,
		name: "COPERNICUS CRATER",
		seed: 7331,
		description: "Rough terrain. Narrow pads.",
		difficulty: {
			archetype: "crater-field",
		},
	},
	{
		id: 4,
		name: "TYCHO HIGHLANDS",
		seed: 1138,
		description: "High altitude start. Conserve fuel.",
	},
	{
		id: 5,
		name: "MARE IMBRIUM",
		seed: 2001,
		description: "Deep valleys. Precision required.",
	},
	{
		id: 6,
		name: "ARISTARCHUS RIDGE",
		seed: 9973,
		description: "Jagged peaks. Thread the needle.",
	},
	{
		id: 7,
		name: "OCEANUS PROCELLARUM",
		seed: 3141,
		description: "Wide open. Speed is the enemy.",
	},
	{
		id: 8,
		name: "SOUTH POLE BASIN",
		seed: 6502,
		description: "Extreme terrain. Expert only.",
	},
	{
		id: 9,
		name: "FAR SIDE",
		seed: 8086,
		description: "No easy landing zones.",
	},
	{
		id: 10,
		name: "THE FINAL DESCENT",
		seed: 42,
		description: "Everything you've learned. Good luck.",
	},
];

/** Campaign missions — 5 missions with escalating difficulty.
 *
 * v0.6.3.0 — physics ramp. Missions 1-2 use classic v2 physics
 * (rotate-instant, no RCS tank, no angular-rate landing gate) so new
 * players can learn pad-targeting and fuel management without also
 * fighting rigid-body rotation. Mission 3 introduces v3 physics
 * (rotation has momentum, separate RCS tank, angular-rate gate); the
 * "RCS" and "ROT" HUD readouts appear at this point. Missions 3-5 are
 * all v3 so the rest of the campaign teaches mastery of the new
 * mechanics. The transition is currently silent (no in-game callout);
 * when the Tier 3 narrative sprint ships, this is where the flight
 * instructor character would explain what just changed.
 */
export const CAMPAIGN: Mission[] = [
	{
		id: 1,
		name: "FIRST CONTACT",
		seed: 1001,
		description: "Easy terrain, generous pads and fuel. Prove you can land.",
		difficulty: {
			roughness: 0.3,
			padMinWidth: 100,
			padMaxWidth: 140,
			padCount: 3,
			startingFuel: 1200,
			windStrength: 0,
			physicsVersion: 2,
		},
	},
	{
		id: 2,
		name: "ROUGH APPROACH",
		seed: 2002,
		description: "Bumpier surface. Pads are narrower. Stay steady.",
		difficulty: {
			roughness: 0.5,
			padMinWidth: 70,
			padMaxWidth: 110,
			padCount: 2,
			startingFuel: 1000,
			windStrength: 15,
			physicsVersion: 2,
		},
	},
	{
		id: 3,
		name: "FUEL CRISIS",
		seed: 3003,
		description:
			"Standard terrain but limited fuel. Every drop counts. Rotation now has momentum — counter-burn to stop spinning.",
		difficulty: {
			roughness: 0.5,
			padMinWidth: 60,
			padMaxWidth: 100,
			padCount: 2,
			startingFuel: 700,
			gravityStormsEnabled: true,
			physicsVersion: 3,
		},
	},
	{
		id: 4,
		name: "NEEDLE THREADING",
		seed: 4004,
		description: "Jagged terrain with crevices, tiny pads. Precision landing.",
		difficulty: {
			roughness: 0.8,
			padMinWidth: 40,
			padMaxWidth: 70,
			padCount: 2,
			startingFuel: 900,
			windStrength: 30,
			aliensEnabled: true,
			gravityStormsEnabled: true,
			crevices: 2,
			physicsVersion: 3,
		},
	},
	{
		id: 5,
		name: "THE IMPOSSIBLE",
		seed: 5005,
		description:
			"Extreme terrain with deep crevices, one small pad. Good luck.",
		difficulty: {
			roughness: 0.9,
			padMinWidth: 35,
			padMaxWidth: 50,
			padCount: 1,
			startingFuel: 600,
			windStrength: 40,
			aliensEnabled: true,
			gravityStormsEnabled: true,
			crevices: 3,
			physicsVersion: 3,
		},
	},
];

const CAMPAIGN_STORAGE_KEY = "moonlander-campaign";

/** Load campaign progress (which missions are completed) */
export function loadCampaignProgress(): Set<number> {
	try {
		const data = localStorage.getItem(CAMPAIGN_STORAGE_KEY);
		if (data) return new Set(JSON.parse(data) as number[]);
	} catch {
		// localStorage unavailable
	}
	return new Set();
}

/** Save campaign mission as completed */
export function saveCampaignProgress(completed: Set<number>): void {
	try {
		localStorage.setItem(CAMPAIGN_STORAGE_KEY, JSON.stringify([...completed]));
	} catch {
		// localStorage unavailable
	}
}

/** UTC date (YYYYMMDD) as a numeric seed. Same value for everyone on the same UTC day. */
export function getDailySeed(date: Date = new Date()): number {
	const y = date.getUTCFullYear();
	const m = date.getUTCMonth() + 1;
	const d = date.getUTCDate();
	return y * 10000 + m * 100 + d;
}

/** Format the daily seed's date as a short human-readable label (UTC). */
export function getDailyDateLabel(date: Date = new Date()): string {
	const y = date.getUTCFullYear();
	const m = String(date.getUTCMonth() + 1).padStart(2, "0");
	const d = String(date.getUTCDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

/** Synthesize today's daily-challenge mission.
 *
 * Sprint 7.1 PR 1.5 — derives an archetype from the UTC date so every
 * player gets the same archetype on the same day. Pure function of the
 * date, no RNG call per-render. Cycles `rolling → crater-field →
 * spires → mesa → flats` so every archetype shows up roughly every 5
 * days. `rolling` keeps the pre-7.1 default look for ~20% of days.
 */
const DAILY_ARCHETYPE_CYCLE = [
	"rolling",
	"crater-field",
	"spires",
	"mesa",
	"flats",
] as const;

export function getDailyArchetype(
	date: Date = new Date(),
): (typeof DAILY_ARCHETYPE_CYCLE)[number] {
	// Days-since-epoch (UTC) → modulo cycle length. Stable across TZs.
	const daysSinceEpoch = Math.floor(date.getTime() / 86_400_000);
	return DAILY_ARCHETYPE_CYCLE[
		((daysSinceEpoch % DAILY_ARCHETYPE_CYCLE.length) +
			DAILY_ARCHETYPE_CYCLE.length) %
			DAILY_ARCHETYPE_CYCLE.length
	];
}

export function getDailyMission(date: Date = new Date()): Mission {
	const seed = getDailySeed(date);
	const archetype = getDailyArchetype(date);
	return {
		id: 0,
		name: "DAILY CHALLENGE",
		seed,
		description: `UTC ${getDailyDateLabel(date)} — same terrain for everyone, today only.`,
		difficulty: { archetype },
	};
}

/** Check if a campaign mission is unlocked (previous mission completed, or it's mission 1) */
export function isMissionUnlocked(
	missionId: number,
	completed: Set<number>,
): boolean {
	if (missionId === 1) return true;
	return completed.has(missionId - 1);
}
