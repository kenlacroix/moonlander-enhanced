import type { DifficultyConfig } from "./Terrain";

/** Fixed mission definitions with deterministic seeds */
export interface Mission {
	id: number;
	name: string;
	seed: number;
	description: string;
	difficulty?: DifficultyConfig;
}

/** Free-play missions — all use default difficulty */
export const MISSIONS: Mission[] = [
	{ id: 1, name: "TRANQUILITY BASE", seed: 1969, description: "Flat terrain, wide pads. Learn the controls." },
	{ id: 2, name: "SEA OF STORMS", seed: 4217, description: "Moderate terrain. Watch your speed." },
	{ id: 3, name: "COPERNICUS CRATER", seed: 7331, description: "Rough terrain. Narrow pads." },
	{ id: 4, name: "TYCHO HIGHLANDS", seed: 1138, description: "High altitude start. Conserve fuel." },
	{ id: 5, name: "MARE IMBRIUM", seed: 2001, description: "Deep valleys. Precision required." },
	{ id: 6, name: "ARISTARCHUS RIDGE", seed: 9973, description: "Jagged peaks. Thread the needle." },
	{ id: 7, name: "OCEANUS PROCELLARUM", seed: 3141, description: "Wide open. Speed is the enemy." },
	{ id: 8, name: "SOUTH POLE BASIN", seed: 6502, description: "Extreme terrain. Expert only." },
	{ id: 9, name: "FAR SIDE", seed: 8086, description: "No easy landing zones." },
	{ id: 10, name: "THE FINAL DESCENT", seed: 42, description: "Everything you've learned. Good luck." },
];

/** Campaign missions — 5 missions with escalating difficulty */
export const CAMPAIGN: Mission[] = [
	{
		id: 1,
		name: "FIRST CONTACT",
		seed: 1001,
		description: "Easy terrain, generous pads and fuel. Prove you can land.",
		difficulty: { roughness: 0.3, padMinWidth: 100, padMaxWidth: 140, padCount: 3, startingFuel: 1200, windStrength: 0 },
	},
	{
		id: 2,
		name: "ROUGH APPROACH",
		seed: 2002,
		description: "Bumpier surface. Pads are narrower. Stay steady.",
		difficulty: { roughness: 0.5, padMinWidth: 70, padMaxWidth: 110, padCount: 2, startingFuel: 1000, windStrength: 15 },
	},
	{
		id: 3,
		name: "FUEL CRISIS",
		seed: 3003,
		description: "Standard terrain but limited fuel. Every drop counts.",
		difficulty: { roughness: 0.5, padMinWidth: 60, padMaxWidth: 100, padCount: 2, startingFuel: 700 },
	},
	{
		id: 4,
		name: "NEEDLE THREADING",
		seed: 4004,
		description: "Jagged terrain, tiny pads. Precision landing.",
		difficulty: { roughness: 0.8, padMinWidth: 40, padMaxWidth: 70, padCount: 2, startingFuel: 900, windStrength: 30 },
	},
	{
		id: 5,
		name: "THE IMPOSSIBLE",
		seed: 5005,
		description: "Extreme terrain, one small pad, minimal fuel. Good luck.",
		difficulty: { roughness: 0.9, padMinWidth: 35, padMaxWidth: 50, padCount: 1, startingFuel: 600, windStrength: 40 },
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

/** Check if a campaign mission is unlocked (previous mission completed, or it's mission 1) */
export function isMissionUnlocked(missionId: number, completed: Set<number>): boolean {
	if (missionId === 1) return true;
	return completed.has(missionId - 1);
}
