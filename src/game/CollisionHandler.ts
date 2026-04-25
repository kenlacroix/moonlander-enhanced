import {
	type Achievement,
	checkLandingAchievements,
} from "../systems/Achievements";
import { addScore } from "../systems/Leaderboard";
import { SCORE_FUEL_MULTIPLIER, STARTING_FUEL } from "../utils/constants";
import {
	classifyLanding,
	type FlightOutcome,
	nearestPad,
} from "./FlightOutcome";
import type { Game } from "./Game";
import { HIDDEN_PAD_SCORE_MULTIPLIER } from "./HiddenPad";
import { isHistoricMission } from "./HistoricMission";
import { CAMPAIGN, saveCampaignProgress, saveCleanClears } from "./Missions";
import { normAngle } from "./Physics";
import { isRandomMission } from "./RandomMission";
import {
	advanceRelayLander,
	isRelayComplete,
	recordRelayLander,
} from "./RelayMode";

export function handleCollisionResult(
	game: Game,
	landed: boolean,
	score: number,
	padY: number,
	padWidth: number,
	hiddenPad = false,
): void {
	if (landed) {
		game.status = "landed";
		// Sprint 7.1 PR 1.5 — hidden-pad payout. Multiplier happens here
		// (not in PhysicsManager.calculateScore) so the toast + the
		// bonus land on the same event, and so freeplay leaderboard
		// entries reflect the full earned score.
		game.score = hiddenPad ? score * HIDDEN_PAD_SCORE_MULTIPLIER : score;
		game.particles.emitDust(game.lander.x, padY, padWidth);
		game.audio.setThruster(false);
		game.audio.playSuccess();
		game.audio.soundtrack.onLanded();
		game.ghostRecorder.save(game.score);
		// Sprint 7.1 PR 1.5 — Random Missions are excluded from the
		// leaderboard. Their seed space is pseudo-infinite and share-URL
		// driven; letting them into the board would pollute the
		// per-seed score slots with one-off rolls the player never
		// revisits. lastRank stays null for random runs — flight report
		// hides the RANK field in that case.
		game.lastRank =
			game.activeMission && isRandomMission(game.activeMission)
				? null
				: addScore(
						game.seed,
						game.score,
						game.telemetry.getDuration(),
						game.currentFlight?.authenticMode ? "authentic" : "vanilla",
					);
		game.llm.scanNearbyArtifact(game, game.artifacts, game.lander.x);
		game.llm.fetchCommentary(game, game.lander, game.score, true);
		game.missionChatter.onLanded();
		if (game.gameMode === "campaign" && game.activeMission) {
			game.campaignCompleted.add(game.activeMission.id);
			saveCampaignProgress(game.campaignCompleted);
		}
		// Sprint 7.4 — emit FlightOutcome for Campaign narrative dialogue.
		// Bounced never demotes a landing (campaignCompleted update above
		// runs unconditionally for any landed result). Clean clears get
		// the star on the mission menu via the parallel cleanClears Set.
		emitCampaignOutcome(game, true);
		checkAchievements(game);
		if (hiddenPad) {
			// Transient toast (not a persistent Achievement unlock) — fires
			// on every hidden-pad landing. Overrides any achievement toast
			// that might have queued the same frame so the bonus always
			// reads as the headline result.
			game.achievementToast = {
				id: "hidden-pad-bonus",
				name: "HIDDEN PAD BONUS",
				description: `Score × ${HIDDEN_PAD_SCORE_MULTIPLIER}`,
			};
			game.achievementToastTimer = 4;
		}
	} else {
		game.status = "crashed";
		game.particles.emitExplosion(game.lander.x, game.lander.y);
		// Sprint 6 Part C — impact feedback: bigger shake + brief flash.
		// The old shake(15) was visible but thin; crash is the single
		// most punishing moment of a run, and cinematic impact leans on
		// both kinetic (shake) and photic (flash) cues. Survive-timeout
		// picks up the same treatment a few lines below for consistency.
		game.camera.shake(40);
		game.camera.flash(0.6);
		game.audio.setThruster(false);
		game.audio.playCrash();
		game.audio.soundtrack.onCrashed();
		game.llm.fetchCommentary(game, game.lander, game.score, false);
		game.llm.fetchCrashAnalysis(
			game,
			game.lander,
			game.telemetry.frames,
			STARTING_FUEL,
		);
		game.missionChatter.onCrashed();
		// Sprint 7.4 — Campaign narrative crash outcome. The non-landing
		// branch handles all crash variants (vy/angle/rate/timeout); the
		// CampaignChatter dialogue table picks the most-specific variant.
		emitCampaignOutcome(game, false);
	}
	handleRelayAfterCollision(game);
	if (game.aiTheater.isActive) {
		game.aiTheaterComparison = game.aiTheater.getComparison(game.score, landed);
	}
}

function checkAchievements(game: Game): void {
	const thrustingLast3s = game.physics.thrustHistory.some((t) => t);
	const scannedCount = game.artifacts.filter((a) => a.scanned).length;
	const startingFuel =
		game.activeMission?.difficulty?.startingFuel ?? STARTING_FUEL;
	// Mission-scoped moments only fire when the active mission is a
	// HistoricMission with declared moments. This is what stops
	// "apollo-11-margin" from accidentally unlocking on a free-play run.
	const missionMoments =
		game.activeMission &&
		isHistoricMission(game.activeMission) &&
		game.activeMission.kind === "landing"
			? {
					moments: game.activeMission.moments,
					state: {
						landed: true,
						fuelRemaining: game.lander.fuel,
						startingFuel,
						flightDurationSec: game.telemetry.getDuration(),
						finalVerticalSpeed: game.lander.vy,
						finalHorizontalSpeed: game.lander.vx,
						finalAngleDeg: normAngle(game.lander.angle),
						landedOnPad: game.lander.status === "landed",
					},
				}
			: undefined;
	const newBadges = checkLandingAchievements(
		game.achievements,
		{
			landed: true,
			hSpeed: game.lander.vx,
			angle: normAngle(game.lander.angle),
			fuelPercent: (game.lander.fuel / startingFuel) * 100,
			thrustingLast3Seconds: thrustingLast3s,
			aliensActive: game.alien !== null,
			campaignComplete: game.campaignCompleted.size >= CAMPAIGN.length,
			artifactsScanned: scannedCount,
			artifactsTotal: game.artifacts.length,
		},
		missionMoments,
	);
	if (newBadges.length > 0) {
		game.achievementToast = newBadges[0];
		game.achievementToastTimer = 4;
	}
}

/**
 * Apollo 13 Survive mode success. Flight has reached `survivalDurationSec`
 * without crashing — the crew made it home. Reuses the lander-landed
 * audio / ghost / leaderboard wiring, but doesn't go through
 * `handleCollisionResult` because there's no pad (and dust-burst on a
 * survive success would look wrong). Score is fuel-preserving: base
 * payout + fuel-remaining bonus, since the whole story is "conserve
 * consumables to get home."
 */
export function handleSurviveSuccess(game: Game): void {
	game.status = "landed";
	const fuelBonus = Math.floor(game.lander.fuel * SCORE_FUEL_MULTIPLIER);
	game.score = 500 + fuelBonus;
	game.audio.setThruster(false);
	game.audio.playSuccess();
	game.audio.soundtrack.onLanded();
	game.ghostRecorder.save(game.score);
	game.lastRank = addScore(
		game.seed,
		game.score,
		game.telemetry.getDuration(),
		game.currentFlight?.authenticMode ? "authentic" : "vanilla",
	);
}

/**
 * Apollo 13 Survive hard timeout (MAX_FLIGHT_DURATION). Treated as a
 * failure: the crew ran out of consumables / didn't make the intercept
 * window in time. Re-uses crashed-status visuals + audio for a familiar
 * "mission failed" end-of-flight presentation.
 */
export function handleSurviveTimeout(game: Game): void {
	game.status = "crashed";
	game.particles.emitExplosion(game.lander.x, game.lander.y);
	// Match the pad-crash kinetic treatment so a survive timeout feels
	// like a real failure, not a quiet fade-out. Apollo 13 aborting
	// intercept deserves at least as much screen presence as an
	// auger-into-the-dust mistake.
	game.camera.shake(40);
	game.camera.flash(0.6);
	game.audio.setThruster(false);
	game.audio.playCrash();
	game.audio.soundtrack.onCrashed();
}

/**
 * Sprint 7.4 — emit a `FlightOutcome` to CampaignChatter on flight-end.
 * Classifies clean vs bounced (landed branch) using the FlightOutcome
 * helper; routes the outcome through CampaignChatter.complete() which
 * picks the most-specific Hoshi post-landing variant.
 *
 * No-ops when:
 *   - gameMode is not "campaign" (Free Play, Historic, AI Theater)
 *   - mission has no narrative.enabled flag
 *   - relay run is mid-cycle (don't fire post-landing chatter between
 *     relay landers — only on the final touchdown)
 */
function emitCampaignOutcome(game: Game, landed: boolean): void {
	if (game.gameMode !== "campaign") return;
	if (!game.activeMission?.narrative?.enabled) return;
	if (game.relay && !isRelayComplete(game.relay)) return;

	const startingFuel =
		game.activeMission.difficulty?.startingFuel ?? STARTING_FUEL;
	const fuelPct = Math.max(0, game.lander.fuel / startingFuel);
	const peakRate = game.flightPeakAngularRate;
	const bestAngularRate =
		game.lander.physicsVersion === 3 ? peakRate : undefined;
	const hazardsFired = { ...game.flightHazardsFired };

	let outcome: FlightOutcome;
	if (landed) {
		const pad = nearestPad(game.lander.x, game.terrain.pads);
		if (!pad) {
			// Defensive: should never happen on a successful landing path,
			// but the type system says nearestPad can return null on a
			// padless terrain. Treat as bounced to avoid awarding a star
			// on undefined data.
			outcome = {
				result: "bounced",
				fuelRemainingPct: fuelPct,
				hazardsFired,
				bestAngularRate,
			};
		} else {
			const cls = classifyLanding(
				game.lander,
				pad,
				bestAngularRate,
				game.lander.maxLandingAngularRate,
			);
			outcome = {
				result: cls.result,
				fuelRemainingPct: fuelPct,
				hazardsFired,
				bestAngularRate,
				landingMarginPx: cls.landingMarginPx,
			};
			if (cls.result === "clean" && game.activeMission) {
				game.cleanClears.add(game.activeMission.id);
				saveCleanClears(game.cleanClears);
			}
		}
	} else {
		outcome = {
			result: "crashed",
			fuelRemainingPct: fuelPct,
			hazardsFired,
			bestAngularRate,
		};
	}

	game.campaignChatter.complete(outcome);
}

function handleRelayAfterCollision(game: Game): void {
	if (!game.relay || (game.status !== "landed" && game.status !== "crashed"))
		return;
	const hasMore = recordRelayLander(
		game.relay,
		game.lander.x,
		game.lander.y,
		game.status,
		game.score,
	);
	if (hasMore) {
		setTimeout(() => {
			if (!game.relay || isRelayComplete(game.relay)) return;
			const spawn = advanceRelayLander(game.relay);
			game.spawnRelayLander(spawn.spawnX, spawn.spawnY);
		}, 1500);
	} else {
		game.score = game.relay.totalScore;
	}
}
