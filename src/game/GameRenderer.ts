/**
 * Game rendering dispatch. Reads game state and calls CanvasRenderer methods.
 * Extracted from Game.ts to separate rendering from game logic.
 */

import type { Autopilot } from "../ai/Autopilot";
import type { GhostPose } from "../ai/EpisodeRecorder";
import type { TrainingStats } from "../ai/RLAgent";
import type { TrainingLoop } from "../ai/TrainingLoop";
import { APOLLO_MISSIONS } from "../data/apolloMissions";
import { ARTEMIS_MISSIONS } from "../data/artemisMissions";
import type { CanvasRenderer } from "../render/CanvasRenderer";
import type { IGameplayRenderer } from "../render/IGameplayRenderer";
import { resolvePalette } from "../render/palette";
import type { GhostPlayer } from "../systems/GhostReplay";
import type { Input } from "../systems/Input";
import { getBestScore, getBestTime } from "../systems/Leaderboard";
import type { TelemetryRecorder } from "../systems/Telemetry";
import { type AlienState, getAlienEffectLabel } from "./Alien";
import type { Artifact } from "./Artifacts";
import { type FlightConfig, loadAuthenticPreference } from "./AuthenticMode";
import type { Camera } from "./Camera";
import { type GravityStormState, getGravityStormLabel } from "./GravityStorm";
import { isHistoricMission } from "./HistoricMission";
import type { LanderState } from "./Lander";
import {
	CAMPAIGN,
	getDailyDateLabel,
	getDailySeed,
	MISSIONS,
	type Mission,
} from "./Missions";
import type { ParticleSystem } from "./Particles";
import {
	getRelayLabel,
	getRelaySummary,
	isRelayComplete,
	type RelayState,
} from "./RelayMode";
import type { TerrainData } from "./Terrain";
import { getWindLabel, type WindState } from "./Wind";

/**
 * Mirror of StateHandlers.getMenuMissions. Defined here too so the
 * renderer doesn't import StateHandlers (which would create a cycle:
 * GameRenderer → StateHandlers → Game → GameRenderer).
 */
function getMenuMissionsForRender(
	mode: "freeplay" | "campaign" | "ai-theater" | "historic",
): readonly Mission[] {
	if (mode === "campaign") return CAMPAIGN;
	if (mode === "historic") return [...APOLLO_MISSIONS, ...ARTEMIS_MISSIONS];
	return MISSIONS;
}

export type GameStatus =
	| "title"
	| "menu"
	| "playing"
	| "landed"
	| "crashed"
	| "training"
	| "agent-replay"
	| "settings"
	| "editor";

/** Read-only view of Game state needed by the renderer. */
export interface GameRenderState {
	readonly status: GameStatus;
	readonly lander: LanderState;
	readonly terrain: TerrainData;
	readonly camera: Camera;
	readonly particles: ParticleSystem;
	readonly artifacts: Artifact[];
	readonly alien: AlienState | null;
	readonly gravityStorm: GravityStormState | null;
	readonly relay: RelayState | null;
	readonly ghostPlayer: GhostPlayer | null;
	readonly telemetry: TelemetryRecorder;
	readonly autopilot: Autopilot;
	readonly wind: WindState | null;
	readonly fuelLeakActive: boolean;
	readonly adaptiveLabel: string | null;
	readonly score: number;
	readonly lastRank: number | null;
	readonly llmText: string;
	readonly missionChatterText: string;
	readonly artifactText: string;
	readonly crashAnalysis: string;
	readonly flightElapsed: number;
	readonly titleSelection: number;
	readonly selectedMission: number;
	readonly gameMode: "freeplay" | "campaign" | "ai-theater" | "historic";
	readonly campaignCompleted: Set<number>;
	readonly input: Input;
	readonly latestTrainingStats: TrainingStats | null;
	readonly trainingLoop: TrainingLoop | null;
	readonly seed: number;
	readonly activeMission: Mission | null;
	readonly achievementToast: { name: string; description: string } | null;
	readonly achievementToastTimer: number;
	readonly gravityPreset: { name: string; gravity: number; color: string };
	readonly aiTheaterComparison: {
		playerScore: number;
		playerLanded: boolean;
		aiBestReward: number;
		aiEpisodes: number;
		aiLanded: boolean;
	} | null;
	readonly forkReplay: {
		readonly episode: {
			readonly episode: number;
			readonly totalReward: number;
			readonly landed: boolean;
			readonly positions: GhostPose[];
			readonly inputs: number[];
		};
		readonly frame: number;
		readonly forked: boolean;
		readonly forkFrame: number | null;
	} | null;
	readonly currentFlight: FlightConfig | null;
	readonly tutorialOverlay: {
		readonly missionId: number;
		readonly framesRemaining: number;
	} | null;
}

export class GameRenderer {
	constructor(
		private renderer: CanvasRenderer,
		private gameplay: IGameplayRenderer,
	) {}

	setRetroSkin(skin: Parameters<CanvasRenderer["setRetroSkin"]>[0]): void {
		this.renderer.setRetroSkin(skin);
	}

	/** True when the previous rendered frame drew the gameplay layer.
	 * Used to wipe the WebGL canvas one time on transition from a
	 * gameplay screen to a UI-only screen (title / menu / training),
	 * after which the canvas stays black and no texture uploads
	 * happen until the next gameplay frame. */
	private lastFrameDrewGameplay = false;
	/** Frame counter used to throttle the training screen's redraw.
	 * Training runs the RL agent on the main thread; every rAF spent
	 * redrawing the reward chart is time the agent doesn't spend
	 * learning. 6x throttle gives a 10 Hz chart refresh, which is
	 * still visually live, at 1/6 the draw cost. */
	private trainingFrameTick = 0;

	/** Full clear for gameplay screens: both layers get wiped, and the
	 * gameplay-drawn flag is set so presentFrame() knows to commit. */
	private clearGameplayFrame(): void {
		this.gameplay.clear();
		if (this.gameplay !== this.renderer) {
			this.renderer.clear();
		}
		this.lastFrameDrewGameplay = true;
	}

	/** UI-only clear for screens that don't touch the gameplay layer
	 * (title, menu, training). Clears the UI layer every frame so the
	 * UI stays responsive, but the gameplay layer only gets wiped once
	 * on transition from gameplay → UI. Saves ~3.7 MB per frame of
	 * texture upload on those screens. */
	private clearUIFrame(): void {
		if (this.lastFrameDrewGameplay) {
			this.gameplay.clear();
			this.gameplay.present();
			this.lastFrameDrewGameplay = false;
		}
		// The UI clear happens even when gameplay === renderer — the
		// canvas has to be cleared every frame for the UI to redraw.
		this.renderer.clear();
	}

	/** Commit the gameplay layer's frame. No-op on Canvas (draws are
	 * immediate); WebGL uploads the dirty texture and submits.
	 * Called only when the gameplay layer actually changed this
	 * frame, which is every frame on gameplay screens. */
	private presentFrame(): void {
		this.gameplay.present();
	}

	private drawAIGhostTrail(
		fork: NonNullable<GameRenderState["forkReplay"]>,
		offset: { x: number; y: number },
	): void {
		const start = fork.forkFrame ?? 0;
		const positions = fork.episode.positions.slice(start);
		if (positions.length < 2) return;
		const ctx = this.renderer.ctx;
		ctx.save();
		ctx.translate(offset.x, offset.y);
		ctx.strokeStyle = "#00aaff";
		ctx.globalAlpha = 0.55;
		ctx.lineWidth = 2;
		ctx.setLineDash([4, 4]);
		ctx.beginPath();
		ctx.moveTo(positions[0].x, positions[0].y);
		for (let i = 1; i < positions.length; i++) {
			ctx.lineTo(positions[i].x, positions[i].y);
		}
		ctx.stroke();
		ctx.setLineDash([]);

		const end = positions[positions.length - 1];
		ctx.globalAlpha = 0.8;
		ctx.fillStyle = "#00aaff";
		ctx.beginPath();
		ctx.arc(end.x, end.y, 5, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
		ctx.globalAlpha = 1;
	}

	/** Prominent post-landing call-to-action pinned to the bottom of
	 * the screen so it reads as the primary next action instead of
	 * being buried in the score line's run-on sentence. */
	private drawContinueCTA(text: string, highlighted: boolean): void {
		const ctx = this.renderer.ctx;
		ctx.save();
		ctx.font = 'bold 16px "Courier New", monospace';
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		const y = 720 - 48;
		const padX = 18;
		const metrics = ctx.measureText(text);
		const w = metrics.width + padX * 2;
		const h = 32;
		const x = 1280 / 2 - w / 2;
		// Highlighted (next-mission available) gets a brighter border
		// so the eye catches it over the "mission select" fallback.
		const border = highlighted ? "#00ff88" : "rgba(255,255,255,0.55)";
		const fill = highlighted ? "#00ff88" : "#ffffff";
		ctx.fillStyle = "rgba(0,0,0,0.75)";
		ctx.strokeStyle = border;
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.roundRect(x, y - h / 2, w, h, 5);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = fill;
		ctx.fillText(text, 1280 / 2, y + 1);
		ctx.restore();
	}

	private drawChatterCaption(text: string): void {
		const ctx = this.renderer.ctx;
		ctx.save();
		ctx.font = "13px 'Courier New', monospace";
		ctx.textAlign = "center";
		ctx.textBaseline = "top";
		const padX = 14;
		const padY = 6;
		const metrics = ctx.measureText(text);
		const w = metrics.width + padX * 2;
		const h = 22;
		const x = 1280 / 2 - w / 2;
		const y = 80;
		ctx.fillStyle = "rgba(0,0,0,0.65)";
		ctx.strokeStyle = "#ff8866";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.rect(x, y, w, h);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = "#ffd9c2";
		ctx.fillText(text, 1280 / 2, y + padY - 1);
		ctx.restore();
	}

	private drawForkCaption(
		fork: NonNullable<GameRenderState["forkReplay"]>,
	): void {
		const ctx = this.renderer.ctx;
		ctx.save();
		ctx.font = "14px 'Courier New', monospace";
		ctx.textAlign = "center";
		ctx.textBaseline = "top";
		const text = fork.forked
			? `YOU FORKED AT FRAME ${fork.forkFrame ?? 0} · AI FINISHED AT ${fork.episode.totalReward.toFixed(0)} REWARD`
			: `AI REPLAY · FRAME ${fork.frame}/${fork.episode.inputs.length} · PRESS T TO TAKE OVER`;
		const padX = 14;
		const padY = 6;
		const metrics = ctx.measureText(text);
		const w = metrics.width + padX * 2;
		const h = 22;
		const x = 1280 / 2 - w / 2;
		const y = 52;
		ctx.fillStyle = fork.forked ? "rgba(0,170,255,0.15)" : "rgba(0,0,0,0.55)";
		ctx.strokeStyle = "#00aaff";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.rect(x, y, w, h);
		ctx.fill();
		ctx.stroke();
		ctx.fillStyle = "#00aaff";
		ctx.fillText(text, 1280 / 2, y + padY - 1);
		ctx.restore();
	}

	render(state: GameRenderState): void {
		const offset = state.camera.getOffset();

		this.clearGameplayFrame();
		// Sprint 7.1 — resolve the palette once per frame and pass
		// to both Background and terrain draw.
		const palette = resolvePalette(
			state.activeMission,
			state.activeMission?.difficulty?.archetype,
		);
		this.gameplay.drawBackground(
			state.camera,
			state.activeMission?.sunAngle,
			palette,
		);
		// Apply cosmetic terrain wobble during gravity storms
		const wobble = state.gravityStorm?.wobbleOffset ?? 0;
		const terrainOffset =
			wobble !== 0 ? { x: offset.x, y: offset.y + wobble } : offset;
		this.gameplay.drawTerrain(state.terrain, terrainOffset, palette);
		this.gameplay.drawParticles(state.particles.particles, offset);
		if (state.ghostPlayer?.isActive()) {
			this.gameplay.drawGhost(state.ghostPlayer.lander, offset);
		}
		if (state.artifacts.length > 0) {
			this.gameplay.drawArtifacts(state.artifacts, offset);
		}
		if (state.alien) {
			this.gameplay.drawAlien(
				state.alien,
				state.lander.x,
				state.lander.y,
				offset,
			);
		}
		this.gameplay.drawLander(state.lander, offset);

		if (state.forkReplay?.forked) {
			this.drawAIGhostTrail(state.forkReplay, offset);
		}

		// Autopilot annotations (force vectors, target, decision labels)
		if (
			state.autopilot.annotationsVisible &&
			state.autopilot.decision &&
			state.status === "playing"
		) {
			this.renderer.drawAutopilotAnnotations(
				state.lander,
				state.autopilot.decision,
				offset,
			);
		}

		const windLabel = state.wind ? getWindLabel(state.wind) : null;
		const alienLabel = state.alien ? getAlienEffectLabel(state.alien) : null;
		const stormLabel = state.gravityStorm
			? getGravityStormLabel(state.gravityStorm)
			: null;
		const elapsed =
			state.status === "playing" || state.status === "landed"
				? state.telemetry.getDuration()
				: null;
		const scoreMode = state.currentFlight?.authenticMode
			? "authentic"
			: "vanilla";
		this.renderer.drawHUD(
			state.lander,
			state.score,
			windLabel,
			state.fuelLeakActive,
			state.autopilot.enabled,
			state.adaptiveLabel,
			alienLabel,
			stormLabel,
			elapsed,
			getBestTime(state.seed, scoreMode) ?? null,
			state.currentFlight?.authenticState ?? null,
			state.terrain ?? null,
			state.status === "playing",
		);

		// Touch controls overlay
		if (state.input.isTouchDevice) {
			this.renderer.drawTouchControls();
		}

		if (state.forkReplay) {
			this.drawForkCaption(state.forkReplay);
		}

		if (state.missionChatterText) {
			this.drawChatterCaption(state.missionChatterText);
		}

		// Post-flight telemetry chart
		if (state.status !== "playing" && state.telemetry.frames.length > 2) {
			this.renderer.drawTelemetry(state.telemetry.frames);
		}

		// Relay HUD label
		if (state.relay && state.status === "playing") {
			this.renderer.drawMessage("", getRelayLabel(state.relay));
		}

		// Status messages
		if (state.status === "landed" || state.status === "crashed") {
			if (state.relay && !isRelayComplete(state.relay)) {
				// Relay mid-run: show brief status, next lander spawns automatically
				const msg = state.status === "landed" ? "LANDED!" : "CRASHED!";
				this.renderer.drawMessage(
					`${getRelayLabel(state.relay)} — ${msg}`,
					"Next lander incoming...",
				);
			} else if (state.relay && isRelayComplete(state.relay)) {
				// Relay complete: show combined results
				this.renderer.drawMessage(
					"RELAY COMPLETE",
					getRelaySummary(state.relay),
				);
			} else if (state.status === "landed") {
				const isTouch = state.input.isTouchDevice;
				const isCampaignNext =
					state.gameMode === "campaign" &&
					state.selectedMission < CAMPAIGN.length - 1;
				const title =
					state.gameMode === "campaign"
						? "MISSION COMPLETE"
						: "LANDING SUCCESSFUL";
				const rankText =
					state.lastRank === 1
						? "  NEW BEST!"
						: state.lastRank
							? `  #${state.lastRank}`
							: "";
				// Ghost + report are secondary — keep them in the subtitle
				// mixed with the score. The "continue" hint gets its own
				// prominent line below so campaign players don't lose the
				// next-mission path in a run-on sentence.
				const secondary = isTouch
					? ""
					: "G ghost  |  F report";
				const subtitleRight = secondary ? `  |  ${secondary}` : "";
				this.renderer.drawMessage(
					title,
					`Score: ${state.score}${rankText}${subtitleRight}`,
				);
				// Primary call-to-action: where does R take you?
				const ctaText = isTouch
					? "TAP TOP TO CONTINUE"
					: isCampaignNext
						? "PRESS R  →  NEXT MISSION"
						: state.gameMode === "campaign"
							? "PRESS R  →  CAMPAIGN COMPLETE"
							: "PRESS R  →  MISSION SELECT";
				this.drawContinueCTA(ctaText, isCampaignNext);
			} else {
				const crashHint = state.input.isTouchDevice
					? "Tap top to continue"
					: "R mission select  |  F report";
				this.renderer.drawMessage("CRASH", crashHint);
			}
		}

		// AI Theater comparison card
		if (
			state.aiTheaterComparison &&
			(state.status === "landed" || state.status === "crashed")
		) {
			const c = state.aiTheaterComparison;
			this.renderer.drawComparisonCard(
				c.playerScore,
				c.playerLanded,
				c.aiBestReward,
				c.aiEpisodes,
				c.aiLanded,
			);
		}

		// LLM commentary (streams in word by word)
		if (state.llmText && state.status !== "playing") {
			this.renderer.drawCommentary(state.llmText);
		}

		// Artifact scan result (separate from commentary)
		if (state.artifactText && state.status !== "playing") {
			this.renderer.drawArtifactFact(state.artifactText);
		}

		// Post-crash flight analysis (coaching)
		if (state.crashAnalysis && state.status === "crashed") {
			this.renderer.drawCrashAnalysis(state.crashAnalysis);
		}

		// Mission briefing (shown during first seconds of flight)
		if (
			state.llmText &&
			state.status === "playing" &&
			state.flightElapsed < 5
		) {
			this.renderer.drawBriefing(state.llmText);
		}

		// Achievement toast notification
		if (state.achievementToast && state.achievementToastTimer > 0) {
			this.renderer.drawAchievementToast(
				state.achievementToast.name,
				state.achievementToast.description,
				state.achievementToastTimer,
			);
		}

		// Sprint 6 Part C — crash flash. Drawn on the UI canvas so it
		// covers both the gameplay (WebGL or Canvas) and UI layers.
		// tickFlash advances the decay; the flash is a brief whiteout
		// that fades across ~8 frames after impact.
		if (state.camera.flashAmount > 0) {
			const ctx = this.renderer.ctx;
			ctx.save();
			ctx.fillStyle = `rgba(255, 255, 255, ${state.camera.flashAmount})`;
			ctx.fillRect(0, 0, 1280, 720);
			ctx.restore();
			state.camera.tickFlash();
		}

		this.presentFrame();
	}

	renderTitle(state: GameRenderState): void {
		this.clearUIFrame();
		this.renderer.drawTitle(
			state.titleSelection,
			state.campaignCompleted.size,
			CAMPAIGN.length,
			getDailyDateLabel(),
			getBestScore(getDailySeed()),
		);
	}

	renderMenu(state: GameRenderState): void {
		const missions = getMenuMissionsForRender(state.gameMode);
		const bestScores = new Map<number, number>();
		for (const m of missions) {
			const best = getBestScore(m.seed);
			if (best !== undefined) bestScores.set(m.seed, best);
		}
		// Sprint 5.5 — Authentic Mode indicator. Only populated when viewing
		// historic missions and the selected mission is a historic landing.
		let authenticInfo: { missionId: number; on: boolean } | null = null;
		if (state.gameMode === "historic") {
			const selected = missions[state.selectedMission];
			if (
				selected &&
				isHistoricMission(selected) &&
				selected.kind === "landing"
			) {
				authenticInfo = {
					missionId: selected.id,
					on: loadAuthenticPreference(selected.id),
				};
			}
		}
		this.clearUIFrame();
		// Dual-track leaderboard: when on historic missions, also pull the
		// Authentic best score for each seed so the row can show both.
		const authenticBestScores =
			state.gameMode === "historic" ? new Map<number, number>() : undefined;
		if (authenticBestScores) {
			for (const m of missions) {
				const best = getBestScore(m.seed, "authentic");
				if (best !== undefined) authenticBestScores.set(m.seed, best);
			}
		}
		this.renderer.drawMissionSelect(
			[...missions],
			state.selectedMission,
			bestScores,
			state.gameMode === "campaign" ? state.campaignCompleted : undefined,
			authenticInfo,
			authenticBestScores,
		);
		// Show relay mode indicator on free-play menu
		if (state.gameMode === "freeplay") {
			this.renderer.drawRelayIndicator(state.relay !== null);
			this.renderer.drawGravitySelector(state.gravityPreset);
		}
		if (state.tutorialOverlay) {
			this.renderer.drawAuthenticTutorial(
				state.tutorialOverlay.framesRemaining,
			);
		}
	}

	renderTraining(state: GameRenderState): void {
		// Throttle to 10 Hz (every 6 rAF ticks at 60 Hz). The training
		// loop runs the RL agent on the same thread as rendering, so
		// every rAF spent redrawing the reward chart is main-thread
		// time the agent could have used for a forward pass. 10 Hz is
		// still live-feeling for a reward curve that updates once per
		// episode anyway.
		this.trainingFrameTick = (this.trainingFrameTick + 1) % 6;
		if (this.trainingFrameTick !== 0) return;
		this.clearUIFrame();
		const history = state.trainingLoop?.agent.getRewardHistory() ?? [];
		const stats = state.latestTrainingStats;
		this.renderer.drawTrainingUI(
			stats?.episode ?? 0,
			stats?.epsilon ?? 1,
			stats?.landed ?? false,
			stats?.totalReward ?? 0,
			history,
		);
	}

	renderAgentReplay(state: GameRenderState): void {
		const offset = state.camera.getOffset();
		this.clearGameplayFrame();
		const palette = resolvePalette(
			state.activeMission,
			state.activeMission?.difficulty?.archetype,
		);
		this.gameplay.drawBackground(
			state.camera,
			state.activeMission?.sunAngle,
			palette,
		);
		this.gameplay.drawTerrain(state.terrain, offset, palette);
		this.gameplay.drawParticles(state.particles.particles, offset);
		this.gameplay.drawLander(state.lander, offset);
		this.renderer.drawHUD(state.lander, 0, null, false, false);

		if (state.lander.status === "landed") {
			this.renderer.drawMessage(
				"AGENT LANDED!",
				"Press R to replay  |  ESC for menu",
			);
		} else if (state.lander.status === "crashed") {
			this.renderer.drawMessage(
				"AGENT CRASHED",
				"Press R to replay  |  ESC for menu",
			);
		} else {
			this.renderer.drawMessage("", "AI AGENT PLAYING  |  ESC for menu");
		}
		this.presentFrame();
	}
}
