/**
 * Sprint 7.4 — Campaign dialogue table.
 *
 * Two characters: Dr. Liam Hoshi (NASA Descent Systems engineer, briefing
 * + post-landing) and CapCom Maya Chen (Mission Control, in-flight only).
 * Voice rules per design doc:
 *
 *   Hoshi (FLIGHT:) — nerdy-earnest, peer-ish professional, professional
 *   warmth that grows across the arc. Quotes flight-dynamics numbers with
 *   precision. Never theatrical on a crash. Never says "small step" or
 *   "dear student." Mentions his mother (Apollo 15 flight dynamics
 *   engineer) exactly once across the campaign — Mission 3, Hadley Rille.
 *
 *   Chen (CAPCOM:) — clipped, procedural, radio-filtered. Reads events
 *   as facts, not editorial. Always feet/knots/degrees (Hoshi uses
 *   meters in his analysis; the unit difference IS the tonal contrast).
 *   Never first-person except "Copy" / "Confirmed" / "Standby." Almost
 *   never personality.
 *
 * Voice purity is enforced by tests in tests/campaign-dialogue.test.ts —
 * any new line that violates speaker rules trips a unit test.
 *
 * 35-line target hand-written below. Chen's procedural callouts are
 * defined ONCE and reused across missions; per-mission tables override
 * only when Hoshi-via-Chen relays or hazard-specific lines are needed.
 */

import type { FlightOutcomeResult } from "../game/FlightOutcome";

export type Speaker = "hoshi" | "chen";

export interface DialogueLine {
	speaker: Speaker;
	text: string;
}

/** Triggers CampaignChatter listens for. The first 8 mirror MissionChatter's
 * union. The last 2 are new — fired from Game.ts onFixedUpdate when the
 * alien starts an effect or the gravity storm enters its high phase. */
export type CampaignTrigger =
	| "flight-start"
	| "altitude-mid"
	| "altitude-final"
	| "fuel-15"
	| "fuel-5"
	| "drift"
	| "alien-spawn"
	| "storm-start";

/** Per-outcome key. `clean+hazard` and `crashed+hazard` are bonus tracks
 * that fire only when an alien or storm event was active during the
 * flight. Hoshi acknowledges that the player worked through an injected
 * scenario, and the line lands harder. */
export type PostLandingKey =
	| FlightOutcomeResult
	| "clean+hazard"
	| "crashed+hazard"
	| "crashed-on-rate"
	| "crashed-on-speed";

export interface MissionDialogue {
	/** Pre-flight briefing (1-2 lines, Hoshi). */
	briefing: DialogueLine[];
	/** Per-trigger override. Fall back to CHEN_PROCEDURAL when undefined. */
	triggers: Partial<Record<CampaignTrigger, DialogueLine>>;
	/** Post-landing variants by outcome. Fall back to clean/crashed if
	 * the more specific key is missing. */
	postLanding: Partial<Record<PostLandingKey, DialogueLine[]>>;
}

/**
 * Chen's standard procedural callouts. Reused across missions unless a
 * per-mission table overrides. These are her "voice baseline" — clipped
 * radio reads, no editorial.
 */
export const CHEN_PROCEDURAL: Record<CampaignTrigger, DialogueLine> = {
	"flight-start": {
		speaker: "chen",
		text: "Copy, lunar lander. You are go for descent.",
	},
	"altitude-mid": {
		speaker: "chen",
		text: "Altitude one thousand. Standby.",
	},
	"altitude-final": {
		speaker: "chen",
		text: "Two hundred feet. Looking good.",
	},
	"fuel-15": {
		speaker: "chen",
		text: "Quantity light. Watch your reserves.",
	},
	"fuel-5": {
		speaker: "chen",
		text: "Thirty seconds.",
	},
	drift: {
		speaker: "chen",
		text: "Watch your drift.",
	},
	"alien-spawn": {
		speaker: "chen",
		text: "Sensor anomaly contact. Bearing your position.",
	},
	"storm-start": {
		speaker: "chen",
		text: "Gravity anomaly forming. Three. Two. One. Anomaly active.",
	},
};

/**
 * Per-mission dialogue tables. Mission IDs (1-5) match `CAMPAIGN[]` in
 * `src/game/Missions.ts`.
 *
 * Arc shape across the 5 missions (Hoshi's posture):
 *   1. Polite, procedural — first lesson
 *   2. First "nice one" — noticed you did well
 *   3. Warmer, mom name-drop — Hadley Rille storm scenario
 *   4. Invested, takes ownership — "this one's my fault"
 *   5. Earned — "I wasn't sure anybody could do that"
 */
export const CAMPAIGN_DIALOGUE: Record<number, MissionDialogue> = {
	1: {
		briefing: [
			{
				speaker: "hoshi",
				text: "FLIGHT, Hoshi. Scenario one of five. Wide pads, generous fuel, no surprises. Get a feel for the controls. Begin powered descent when ready.",
			},
		],
		triggers: {},
		postLanding: {
			clean: [
				{
					speaker: "hoshi",
					text: "Touchdown. Clean — pad-centered, descent rate inside book values. Score's posted. See you in scenario two.",
				},
			],
			bounced: [
				{
					speaker: "hoshi",
					text: "That's a landing. Edge of tolerance, but the gate doesn't care about pretty. We'll work on the centering next time.",
				},
			],
			crashed: [
				{
					speaker: "hoshi",
					text: "Reset the simulator. Watch your descent rate before contact — most first crashes here are vertical.",
				},
			],
			timeout: [
				{
					speaker: "hoshi",
					text: "Clock ran out. The sim won't fly itself — try again, no rush.",
				},
			],
		},
	},

	2: {
		briefing: [
			{
				speaker: "hoshi",
				text: "Scenario two. Bumpier surface, narrower pads, light wind from the west. Watch your lateral drift on final.",
			},
		],
		triggers: {
			drift: {
				speaker: "chen",
				text: "Flight says watch your drift — wind component on final.",
			},
		},
		postLanding: {
			clean: [
				{
					speaker: "hoshi",
					text: "Nice one. You held drift inside two meters across a fifteen-knot crosswind. That's the shape of it.",
				},
			],
			bounced: [
				{
					speaker: "hoshi",
					text: "Landing. The wind got most of you on final — counter-burn earlier next pass and it'll center up.",
				},
			],
			crashed: [
				{
					speaker: "hoshi",
					text: "The wind wasn't your fault. The response to it was. Reset.",
				},
			],
			timeout: [
				{
					speaker: "hoshi",
					text: "Clock out. You can take time on this one — no penalty for a slow descent.",
				},
			],
		},
	},

	3: {
		briefing: [
			{
				speaker: "hoshi",
				text: "Scenario three. You've been flying the classic integrator so far. Starting now, rotation has momentum — if you spin and don't counter-burn, you keep spinning. There's a separate RCS tank below fuel; use it sparingly.",
			},
			{
				speaker: "hoshi",
				text: "Also: I scheduled a gravity anomaly in this run. It'll kick your attitude. My mom trained for something like it at Hadley. Go when ready.",
			},
		],
		triggers: {
			"storm-start": {
				speaker: "chen",
				text: "Gravity anomaly active. Flight: keep your rate under eight degrees.",
			},
		},
		postLanding: {
			clean: [
				{
					speaker: "hoshi",
					text: "Touchdown — pad-centered, ROT never crossed six. That was actually good. Mission three's the hardest one in concept; the rest is execution.",
				},
			],
			"clean+hazard": [
				{
					speaker: "hoshi",
					text: "Okay. You landed through a storm with margin and your ROT never exceeded six. I don't say this often — that was actually good.",
				},
			],
			bounced: [
				{
					speaker: "hoshi",
					text: "Landing. The new physics took bites out of your fuel and your rate. You'll want both back for scenario four.",
				},
			],
			crashed: [
				{
					speaker: "hoshi",
					text: "Reset. Rotation has momentum now — when you point the lander, hold the opposite key briefly to stop it.",
				},
			],
			"crashed-on-rate": [
				{
					speaker: "hoshi",
					text: "Your rate hit twelve degrees a second at contact. Gate is eight. I know it's tight — try a lighter RCS burn next pass.",
				},
			],
			"crashed-on-speed": [
				{
					speaker: "hoshi",
					text: "Vertical at contact was over the limit. With the storm in the mix you need more thrust earlier — the anomaly takes seconds you don't have.",
				},
			],
			timeout: [
				{
					speaker: "hoshi",
					text: "Clock ran out. Storm cycles don't reset — burn fuel to land within the window.",
				},
			],
		},
	},

	4: {
		briefing: [
			{
				speaker: "hoshi",
				text: "Scenario four. This one's my fault — I stacked three things into one run. Crevices in the terrain, gravity anomaly active, and a sensor contact will start interfering on approach. One pad's wider than the other. Pick the easy one if it shows up first.",
			},
		],
		triggers: {
			"alien-spawn": {
				speaker: "chen",
				text: "Sensor anomaly active. Flight: assume your readouts are unreliable until it clears.",
			},
			"storm-start": {
				speaker: "chen",
				text: "Anomaly active. Watch your ROT through the high phase.",
			},
		},
		postLanding: {
			clean: [
				{
					speaker: "hoshi",
					text: "Pad-centered, inside book values, through everything I threw at you. Honest answer — I expected you to bounce that. Nice flying.",
				},
			],
			"clean+hazard": [
				{
					speaker: "hoshi",
					text: "Through the anomaly, through the contact, pad-centered. That's the kind of run we write up.",
				},
			],
			bounced: [
				{
					speaker: "hoshi",
					text: "Landing. Off-center but the gate held. Honestly — given the stack of scenarios in there — I'll take it.",
				},
			],
			crashed: [
				{
					speaker: "hoshi",
					text: "Reset. The compounding's the lesson here — you can recover from any one hazard, but not from carrying the deficit forward.",
				},
			],
			"crashed+hazard": [
				{
					speaker: "hoshi",
					text: "You took the contact AND the anomaly on the same pass. That's the worst-case stack. The book answer is: hover, reorient, then descend. You fly your altitude — you don't fly the clock.",
				},
			],
			timeout: [
				{
					speaker: "hoshi",
					text: "Clock out. Hover-and-wait works on three. Four's longer than the timer allows. Burn earlier.",
				},
			],
		},
	},

	5: {
		briefing: [
			{
				speaker: "hoshi",
				text: "Scenario five. I designed this one and I'm not sure it's fair. One pad. Deep crevices. Forty-knot wind. The full hazard stack. Take your time on the briefing — there's no shame in studying the descent profile before you go.",
			},
			{
				speaker: "hoshi",
				text: "If you bounce it, that's a landing. If you center it, that's the campaign. Try anyway.",
			},
		],
		triggers: {
			"flight-start": {
				speaker: "chen",
				text: "Lunar lander, you are go for final descent. Flight is silent on this one.",
			},
			"alien-spawn": {
				speaker: "chen",
				text: "Sensor anomaly. No support — fly through it.",
			},
			"storm-start": {
				speaker: "chen",
				text: "Anomaly active.",
			},
		},
		postLanding: {
			clean: [
				{
					speaker: "hoshi",
					text: "Touchdown.",
				},
				{
					speaker: "hoshi",
					text: "Pad-centered. Through the stack. Inside every gate.",
				},
				{
					speaker: "hoshi",
					text: "Honestly — I wasn't sure anybody could do that.",
				},
			],
			"clean+hazard": [
				{
					speaker: "hoshi",
					text: "Touchdown. Through everything.",
				},
				{
					speaker: "hoshi",
					text: "I wasn't sure anybody could do that. And you did it on the hardest variant of the run.",
				},
			],
			bounced: [
				{
					speaker: "hoshi",
					text: "That's a landing. Off-center, edge of tolerance — but the gate held and you flew the entire campaign.",
				},
				{
					speaker: "hoshi",
					text: "Five for five. That's the qualification.",
				},
			],
			crashed: [
				{
					speaker: "hoshi",
					text: "Reset. Some pilots crash this one twenty times. Most never clear it. You have four landings behind you — you'll get this one too.",
				},
			],
			"crashed-on-rate": [
				{
					speaker: "hoshi",
					text: "Rate at contact was over the gate. The anomaly torque is the killer here — counter-burn the moment it hits, not when you see the readout drift.",
				},
			],
			timeout: [
				{
					speaker: "hoshi",
					text: "Clock out. The hardest scenario in the campaign is also the longest — try again, but commit to the descent earlier.",
				},
			],
		},
	},
};

/** Lookup: returns the dialogue line for a trigger on a mission, falling
 * back to CHEN_PROCEDURAL when the mission doesn't override. Returns
 * null when the mission has no dialogue at all (non-narrative campaign
 * mission, or non-campaign mode). */
export function getTriggerLine(
	missionId: number,
	trigger: CampaignTrigger,
): DialogueLine | null {
	const table = CAMPAIGN_DIALOGUE[missionId];
	if (!table) return null;
	return table.triggers[trigger] ?? CHEN_PROCEDURAL[trigger];
}

/** Lookup: returns the post-landing dialogue lines for an outcome. Falls
 * back from `clean+hazard` → `clean`, `crashed-on-rate`/`crashed-on-speed`
 * /`crashed+hazard` → `crashed`. Returns null when no dialogue exists. */
export function getPostLandingLines(
	missionId: number,
	key: PostLandingKey,
): DialogueLine[] | null {
	const table = CAMPAIGN_DIALOGUE[missionId];
	if (!table) return null;
	const direct = table.postLanding[key];
	if (direct) return direct;
	// Fallback chain: specific → general
	if (key === "clean+hazard") return table.postLanding.clean ?? null;
	if (
		key === "crashed-on-rate" ||
		key === "crashed-on-speed" ||
		key === "crashed+hazard"
	)
		return table.postLanding.crashed ?? null;
	return null;
}

/** Pick the most specific post-landing key that has dialogue available. */
export function selectPostLandingKey(
	missionId: number,
	result: FlightOutcomeResult,
	hazardFired: boolean,
	rateExceeded: boolean,
	speedExceeded: boolean,
): PostLandingKey | null {
	const table = CAMPAIGN_DIALOGUE[missionId];
	if (!table) return null;

	if (result === "clean") {
		if (hazardFired && table.postLanding["clean+hazard"]) return "clean+hazard";
		return "clean";
	}
	if (result === "bounced") return "bounced";
	if (result === "crashed") {
		if (rateExceeded && table.postLanding["crashed-on-rate"])
			return "crashed-on-rate";
		if (speedExceeded && table.postLanding["crashed-on-speed"])
			return "crashed-on-speed";
		if (hazardFired && table.postLanding["crashed+hazard"])
			return "crashed+hazard";
		return "crashed";
	}
	return "timeout";
}

/** Phrases banned in any Hoshi line. Test asserts none of these appear. */
export const HOSHI_BANNED_PHRASES = [
	"small step",
	"dear student",
	"my dear",
	"that's one for the books",
	"my padawan",
];

/** Phrases banned in any Chen line. Chen is procedural — no first-person
 * except in radio prefixes (which we strip when checking). */
export const CHEN_FORBIDDEN_REGEX = /\b(I|me|my)\b/i;
