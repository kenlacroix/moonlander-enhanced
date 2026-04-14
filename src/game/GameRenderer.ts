/**
 * Game rendering dispatch. Reads game state and calls CanvasRenderer methods.
 * Extracted from Game.ts to separate rendering from game logic.
 */

import type { Autopilot } from "../ai/Autopilot";
import type { TrainingStats } from "../ai/RLAgent";
import type { TrainingLoop } from "../ai/TrainingLoop";
import type { CanvasRenderer } from "../render/CanvasRenderer";
import type { GhostPlayer } from "../systems/GhostReplay";
import type { Input } from "../systems/Input";
import { getBestScore } from "../systems/Leaderboard";
import type { TelemetryRecorder } from "../systems/Telemetry";
import { type AlienState, getAlienEffectLabel } from "./Alien";
import type { Artifact } from "./Artifacts";
import type { Camera } from "./Camera";
import { type GravityStormState, getGravityStormLabel } from "./GravityStorm";
import type { LanderState } from "./Lander";
import { CAMPAIGN, MISSIONS, type Mission } from "./Missions";
import type { ParticleSystem } from "./Particles";
import {
	getRelayLabel,
	getRelaySummary,
	isRelayComplete,
	type RelayState,
} from "./RelayMode";
import type { TerrainData } from "./Terrain";
import { getWindLabel, type WindState } from "./Wind";

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
	readonly artifactText: string;
	readonly flightElapsed: number;
	readonly titleSelection: number;
	readonly selectedMission: number;
	readonly gameMode: "freeplay" | "campaign";
	readonly campaignCompleted: Set<number>;
	readonly input: Input;
	readonly latestTrainingStats: TrainingStats | null;
	readonly trainingLoop: TrainingLoop | null;
	readonly seed: number;
	readonly activeMission: Mission | null;
	readonly achievementToast: { name: string; description: string } | null;
	readonly achievementToastTimer: number;
	readonly gravityPreset: { name: string; gravity: number; color: string };
}

export class GameRenderer {
	constructor(private renderer: CanvasRenderer) {}

	setRetroSkin(skin: Parameters<CanvasRenderer["setRetroSkin"]>[0]): void {
		this.renderer.setRetroSkin(skin);
	}

	render(state: GameRenderState): void {
		const offset = state.camera.getOffset();

		this.renderer.clear();
		this.renderer.drawBackground(state.camera);
		// Apply cosmetic terrain wobble during gravity storms
		const wobble = state.gravityStorm?.wobbleOffset ?? 0;
		const terrainOffset =
			wobble !== 0 ? { x: offset.x, y: offset.y + wobble } : offset;
		this.renderer.drawTerrain(state.terrain, terrainOffset);
		this.renderer.drawParticles(state.particles.particles, offset);
		if (state.ghostPlayer?.isActive()) {
			this.renderer.drawGhost(state.ghostPlayer.lander, offset);
		}
		if (state.artifacts.length > 0) {
			this.renderer.drawArtifacts(state.artifacts, offset);
		}
		if (state.alien) {
			this.renderer.drawAlien(
				state.alien,
				state.lander.x,
				state.lander.y,
				offset,
			);
		}
		this.renderer.drawLander(state.lander, offset);

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
		this.renderer.drawHUD(
			state.lander,
			state.score,
			windLabel,
			state.fuelLeakActive,
			state.autopilot.enabled,
			state.adaptiveLabel,
			alienLabel,
			stormLabel,
		);

		// Touch controls overlay
		if (state.input.isTouchDevice) {
			this.renderer.drawTouchControls();
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
				const nextHint = isCampaignNext ? "next mission" : "mission select";
				const ghostHint = isTouch ? "" : "  |  G ghost  |  F report";
				const hint = isTouch ? "Tap top to continue" : `R ${nextHint}`;
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
				this.renderer.drawMessage(
					title,
					`Score: ${state.score}${rankText}  |  ${hint}${ghostHint}`,
				);
			} else {
				const crashHint = state.input.isTouchDevice
					? "Tap top to continue"
					: "R mission select  |  F report";
				this.renderer.drawMessage("CRASH", crashHint);
			}
		}

		// LLM commentary (streams in word by word)
		if (state.llmText && state.status !== "playing") {
			this.renderer.drawCommentary(state.llmText);
		}

		// Artifact scan result (separate from commentary)
		if (state.artifactText && state.status !== "playing") {
			this.renderer.drawArtifactFact(state.artifactText);
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
	}

	renderTitle(state: GameRenderState): void {
		this.renderer.clear();
		this.renderer.drawTitle(
			state.titleSelection,
			state.campaignCompleted.size,
			CAMPAIGN.length,
		);
	}

	renderMenu(state: GameRenderState): void {
		const missions = state.gameMode === "campaign" ? CAMPAIGN : MISSIONS;
		const bestScores = new Map<number, number>();
		for (const m of missions) {
			const best = getBestScore(m.seed);
			if (best !== undefined) bestScores.set(m.seed, best);
		}
		this.renderer.clear();
		this.renderer.drawMissionSelect(
			missions,
			state.selectedMission,
			bestScores,
			state.gameMode === "campaign" ? state.campaignCompleted : undefined,
		);
		// Show relay mode indicator on free-play menu
		if (state.gameMode === "freeplay") {
			this.renderer.drawRelayIndicator(state.relay !== null);
			this.renderer.drawGravitySelector(state.gravityPreset);
		}
	}

	renderTraining(state: GameRenderState): void {
		this.renderer.clear();
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
		this.renderer.clear();
		this.renderer.drawBackground(state.camera);
		this.renderer.drawTerrain(state.terrain, offset);
		this.renderer.drawParticles(state.particles.particles, offset);
		this.renderer.drawLander(state.lander, offset);
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
	}
}
