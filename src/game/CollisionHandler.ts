import {
	type Achievement,
	checkLandingAchievements,
} from "../systems/Achievements";
import { addScore } from "../systems/Leaderboard";
import { STARTING_FUEL } from "../utils/constants";
import type { Game } from "./Game";
import { isHistoricMission } from "./HistoricMission";
import { CAMPAIGN, saveCampaignProgress } from "./Missions";
import { normAngle } from "./Physics";
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
): void {
	if (landed) {
		game.status = "landed";
		game.score = score;
		game.particles.emitDust(game.lander.x, padY, padWidth);
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
		game.llm.scanNearbyArtifact(game, game.artifacts, game.lander.x);
		game.llm.fetchCommentary(game, game.lander, game.score, true);
		game.missionChatter.onLanded();
		if (game.gameMode === "campaign" && game.activeMission) {
			game.campaignCompleted.add(game.activeMission.id);
			saveCampaignProgress(game.campaignCompleted);
		}
		checkAchievements(game);
	} else {
		game.status = "crashed";
		game.particles.emitExplosion(game.lander.x, game.lander.y);
		game.camera.shake(15);
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
