/**
 * Achievement badges — localStorage-persisted unlock conditions.
 * Checked after each landing. Toast notification on unlock.
 */

export interface Achievement {
	id: string;
	name: string;
	description: string;
}

const ACHIEVEMENTS: Achievement[] = [
	{
		id: "first-landing",
		name: "FIRST CONTACT",
		description: "Land successfully for the first time",
	},
	{
		id: "perfect-landing",
		name: "TEXTBOOK",
		description: "Land with 0 horizontal speed and angle < 2°",
	},
	{
		id: "no-thrust",
		name: "DEADSTICK",
		description: "Land without using thrust in the last 3 seconds",
	},
	{
		id: "full-campaign",
		name: "MISSION CONTROL",
		description: "Complete all 5 campaign missions",
	},
	{
		id: "beat-the-ai",
		name: "HUMAN SPIRIT",
		description: "Score higher than the autopilot on the same seed",
	},
	{
		id: "survive-aliens",
		name: "CLOSE ENCOUNTER",
		description: "Land successfully with aliens active",
	},
	{
		id: "fuel-miser",
		name: "FUEL MISER",
		description: "Land with > 80% fuel remaining",
	},
	{
		id: "archaeologist",
		name: "ARCHAEOLOGIST",
		description: "Scan all artifacts on a terrain with 2 artifacts",
	},
	// Sprint 5 historic-mission "moments". Each unlocks only on its
	// specific mission (mission-scoped via checkLandingAchievements'
	// missionMoments parameter). Achievement IDs must match
	// MissionMoment.achievementId in the mission data files.
	{
		id: "apollo-11-margin",
		name: "ARMSTRONG MARGIN",
		description:
			"Apollo 11: land with under 3% fuel remaining (~22 sec margin)",
	},
	{
		id: "apollo-11-clean",
		name: "EAGLE TOUCHDOWN",
		description:
			"Apollo 11: land near-vertical with under 1 m/s vertical speed",
	},
	{
		id: "hadley-rille",
		name: "HADLEY RILLE",
		description: "Apollo 15: land in the Hadley Rille canyon",
	},
	{
		id: "taurus-littrow",
		name: "VALLEY OF THE LAST",
		description: "Apollo 17: land in the Taurus-Littrow valley",
	},
	{
		id: "shackleton-rim",
		name: "SOUTH POLE",
		description: "Artemis III: land on the Shackleton crater rim",
	},
];

const STORAGE_KEY = "moonlander-achievements";

/** Load unlocked achievement IDs from localStorage */
export function loadAchievements(): Set<string> {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return new Set();
		return new Set(JSON.parse(raw));
	} catch {
		return new Set();
	}
}

/** Save unlocked achievements to localStorage */
function saveAchievements(unlocked: Set<string>): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify([...unlocked]));
	} catch {
		// localStorage full or unavailable
	}
}

/** Check and unlock a specific achievement. Returns the achievement if newly unlocked. */
export function unlockAchievement(
	unlocked: Set<string>,
	id: string,
): Achievement | null {
	if (unlocked.has(id)) return null;
	const achievement = ACHIEVEMENTS.find((a) => a.id === id);
	if (!achievement) return null;
	unlocked.add(id);
	saveAchievements(unlocked);
	return achievement;
}

/** Get all achievements with unlock status */
export function getAllAchievements(
	unlocked: Set<string>,
): (Achievement & { earned: boolean })[] {
	return ACHIEVEMENTS.map((a) => ({
		...a,
		earned: unlocked.has(a.id),
	}));
}

/**
 * Predicate used by mission-scoped "moment" achievements. Mission data
 * files declare these alongside an achievementId; checkLandingAchievements
 * runs them only when the corresponding mission is active.
 */
export interface MissionMomentCheck {
	achievementId: string;
	check: (state: {
		landed: boolean;
		fuelRemaining: number;
		startingFuel: number;
		flightDurationSec: number;
		finalVerticalSpeed: number;
		finalHorizontalSpeed: number;
		finalAngleDeg: number;
		landedOnPad: boolean;
	}) => boolean;
}

/** Check landing conditions and return any newly unlocked achievements */
export function checkLandingAchievements(
	unlocked: Set<string>,
	conditions: {
		landed: boolean;
		hSpeed: number;
		angle: number;
		fuelPercent: number;
		thrustingLast3Seconds: boolean;
		aliensActive: boolean;
		campaignComplete: boolean;
		artifactsScanned: number;
		artifactsTotal: number;
	},
	missionMoments?: {
		moments: MissionMomentCheck[];
		state: {
			landed: boolean;
			fuelRemaining: number;
			startingFuel: number;
			flightDurationSec: number;
			finalVerticalSpeed: number;
			finalHorizontalSpeed: number;
			finalAngleDeg: number;
			landedOnPad: boolean;
		};
	},
): Achievement[] {
	const newlyUnlocked: Achievement[] = [];

	if (!conditions.landed) return newlyUnlocked;

	// First landing
	const first = unlockAchievement(unlocked, "first-landing");
	if (first) newlyUnlocked.push(first);

	// Perfect landing: 0 h-speed, angle < 2
	if (Math.abs(conditions.hSpeed) < 0.5 && Math.abs(conditions.angle) < 2) {
		const perfect = unlockAchievement(unlocked, "perfect-landing");
		if (perfect) newlyUnlocked.push(perfect);
	}

	// No thrust in last 3 seconds
	if (!conditions.thrustingLast3Seconds) {
		const deadstick = unlockAchievement(unlocked, "no-thrust");
		if (deadstick) newlyUnlocked.push(deadstick);
	}

	// Full campaign
	if (conditions.campaignComplete) {
		const campaign = unlockAchievement(unlocked, "full-campaign");
		if (campaign) newlyUnlocked.push(campaign);
	}

	// Survive aliens
	if (conditions.aliensActive) {
		const aliens = unlockAchievement(unlocked, "survive-aliens");
		if (aliens) newlyUnlocked.push(aliens);
	}

	// Fuel miser: > 80% fuel
	if (conditions.fuelPercent > 80) {
		const miser = unlockAchievement(unlocked, "fuel-miser");
		if (miser) newlyUnlocked.push(miser);
	}

	// Archaeologist: scan all artifacts (needs 2+)
	if (
		conditions.artifactsTotal >= 2 &&
		conditions.artifactsScanned >= conditions.artifactsTotal
	) {
		const arch = unlockAchievement(unlocked, "archaeologist");
		if (arch) newlyUnlocked.push(arch);
	}

	// Mission-scoped moments: only fire when the active mission declares
	// them. This is what stops "apollo-11-margin" from accidentally
	// unlocking on a free-play mission that happens to land tight on fuel.
	if (missionMoments) {
		for (const moment of missionMoments.moments) {
			if (moment.check(missionMoments.state)) {
				const unlocked_ = unlockAchievement(unlocked, moment.achievementId);
				if (unlocked_) newlyUnlocked.push(unlocked_);
			}
		}
	}

	return newlyUnlocked;
}

/** Total achievement count */
export function getAchievementCount(): number {
	return ACHIEVEMENTS.length;
}
