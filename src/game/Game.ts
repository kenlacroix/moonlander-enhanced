import { Autopilot } from "../ai/Autopilot";
import {
	applyAdaptiveModifiers,
	getAdaptiveModifiers,
} from "../ai/DifficultyAdapter";
import type { TrainingStats } from "../ai/RLAgent";
import { TrainingLoop } from "../ai/TrainingLoop";
import { type LLMConfig, loadLLMConfig } from "../api/LLMProvider";
import { RetroVectorSkin } from "../graphics/skins/RetroVector";
import { CanvasRenderer } from "../render/CanvasRenderer";
import {
	type Achievement,
	checkLandingAchievements,
	loadAchievements,
} from "../systems/Achievements";
import { Audio } from "../systems/Audio";
import { generateFlightReport } from "../systems/FlightRecorder";
import {
	downloadGhost,
	GhostPlayer,
	GhostRecorder,
	loadGhostForSeed,
	uploadGhost,
} from "../systems/GhostReplay";
import { Input, type InputState } from "../systems/Input";
import { addScore } from "../systems/Leaderboard";
import { TelemetryRecorder } from "../systems/Telemetry";
import { SettingsOverlay } from "../ui/SettingsOverlay";
import {
	buildTerrainFromEditor,
	createEditorState,
	deserializeEditor,
	type EditorState,
	editorClick,
	editorDrag,
	editorRelease,
	editorUndo,
	renderEditor,
	serializeEditor,
} from "../ui/TerrainEditor";
import {
	FIXED_TIMESTEP,
	FUEL_BURN_RATE,
	LANDER_HEIGHT,
	MAX_DELTA,
	MAX_LANDING_ANGLE,
	MAX_LANDING_SPEED,
	SCORE_ANGLE_BONUS,
	SCORE_FUEL_MULTIPLIER,
	SCORE_SPEED_BONUS,
	STARTING_FUEL,
	WORLD_WIDTH,
} from "../utils/constants";
import {
	type AlienState,
	applyAlienEffect,
	createAlien,
	shouldSpawnAlien,
	updateAlien,
} from "./Alien";
import type { Artifact } from "./Artifacts";
import { placeArtifacts } from "./Artifacts";
import { Camera } from "./Camera";
import { GameRenderer, type GameStatus } from "./GameRenderer";
import {
	type GravityPreset,
	getDefaultPreset,
	nextPreset,
	prevPreset,
} from "./GravityPresets";
import {
	applyGravityStormEffect,
	createGravityStorm,
	type GravityStormState,
	shouldSpawnGravityStorm,
	updateGravityStorm,
} from "./GravityStorm";
import { createLander, type LanderState, updateLander } from "./Lander";
import { getLanderType } from "./LanderTypes";
import { LLMIntegration } from "./LLMIntegration";
import {
	CAMPAIGN,
	isMissionUnlocked,
	loadCampaignProgress,
	MISSIONS,
	type Mission,
	saveCampaignProgress,
} from "./Missions";
import { ParticleSystem } from "./Particles";
import { checkCollision, getTerrainHeightAt, normAngle } from "./Physics";
import {
	advanceRelayLander,
	createRelayState,
	isRelayComplete,
	type RelayState,
	recordRelayLander,
} from "./RelayMode";
import type { DifficultyConfig } from "./Terrain";
import { generateTerrain, type TerrainData } from "./Terrain";
import { createWind, updateWind, type WindState } from "./Wind";

export type { GameStatus } from "./GameRenderer";

export class Game {
	private canvasRenderer: CanvasRenderer;
	private gameRenderer: GameRenderer;
	private llm: LLMIntegration;
	private audio: Audio;
	input: Input;
	private camera_: Camera;
	private particles_: ParticleSystem;
	lander!: LanderState;
	terrain!: TerrainData;
	status: GameStatus = "title";
	score = 0;
	private seed_: number;
	selectedMission = 0;
	lastRank: number | null = null;
	gameMode: "freeplay" | "campaign" = "freeplay";
	activeMission: Mission | null = null;
	campaignCompleted = loadCampaignProgress();
	titleSelection = 0;
	trainingLoop: TrainingLoop | null = null;
	latestTrainingStats: TrainingStats | null = null;
	adaptiveLabel: string | null = null;
	private llmConfig: LLMConfig | null = null;
	llmText = "";
	llmLoading = false;
	artifactText = "";
	private settingsOverlay = new SettingsOverlay();
	private lastTime = 0;
	private accumulator = 0;
	private firstFrame = true;
	private messageTimer = 0;
	private fuelWarningCooldown = 0;
	private audioInitialized = false;
	private ghostRecorder = new GhostRecorder();
	ghostPlayer: GhostPlayer | null = null;
	telemetry = new TelemetryRecorder();
	autopilot = new Autopilot();
	wind: WindState | null = null;
	flightElapsed = 0;
	fuelLeakActive = false;
	private fuelLeakTriggered = false;
	alien: AlienState | null = null;
	gravityStorm: GravityStormState | null = null;
	relay: RelayState | null = null;
	artifacts: Artifact[] = [];
	private retroSkin = new RetroVectorSkin();
	private editorState: EditorState | null = null;
	private achievements = loadAchievements();
	achievementToast: Achievement | null = null;
	gravityPreset: GravityPreset = getDefaultPreset();
	achievementToastTimer = 0;
	private thrustHistory: boolean[] = []; // last N frames of thrust state
	private embedMode: boolean;

	// Accessors for GameRenderState interface compatibility
	get camera(): Camera {
		return this.camera_;
	}
	get particles(): ParticleSystem {
		return this.particles_;
	}
	get seed(): number {
		return this.seed_;
	}

	constructor(
		canvas: HTMLCanvasElement,
		urlSeed?: number,
		embedMode = false,
		customTerrain?: string,
	) {
		this.embedMode = embedMode;
		this.canvasRenderer = new CanvasRenderer(canvas);
		this.gameRenderer = new GameRenderer(this.canvasRenderer);
		this.llm = new LLMIntegration(() => this.llmConfig);
		this.audio = new Audio();
		this.input = new Input();
		this.camera_ = new Camera();
		this.particles_ = new ParticleSystem();
		this.seed_ = urlSeed ?? MISSIONS[0].seed;
		this.llmConfig = loadLLMConfig();
		this.reset();

		if (customTerrain) {
			// Load custom terrain from URL parameter
			const editor = deserializeEditor(customTerrain);
			if (editor) {
				this.editorState = editor;
				this.playCustomTerrain();
			} else {
				this.status = "title";
			}
		} else if (urlSeed && !Number.isNaN(urlSeed)) {
			this.gameMode = "freeplay";
			this.activeMission = {
				id: 0,
				name: `SEED ${urlSeed}`,
				seed: urlSeed,
				description: "Shared mission",
			};
			this.status = "playing";
		} else {
			this.status = "title";
		}
	}

	private reset(): void {
		let diff = this.activeMission?.difficulty;
		if (this.gameMode === "freeplay" && !diff) {
			const modifiers = getAdaptiveModifiers(this.seed_);
			diff = applyAdaptiveModifiers(undefined, modifiers);
			this.adaptiveLabel = modifiers.label;
		} else {
			this.adaptiveLabel = null;
		}
		this.terrain = generateTerrain(this.seed_, diff);
		const spawnX = WORLD_WIDTH / 2;
		const spawnY = diff?.spawnY ?? 80;
		const landerType = getLanderType(diff?.landerType);
		this.lander = createLander(spawnX, spawnY, landerType);
		if (diff?.startingFuel !== undefined) {
			this.lander.fuel = diff.startingFuel;
		}
		this.status = "playing";
		this.score = 0;
		this.particles_.clear();
		this.camera_ = new Camera();
		this.firstFrame = true;
		this.messageTimer = 0;
		this.fuelWarningCooldown = 0;
		this.ghostRecorder.start(this.seed_);
		this.telemetry.reset();
		this.autopilot.enabled = false;
		this.flightElapsed = 0;
		this.fuelLeakActive = false;
		this.fuelLeakTriggered = false;
		this.thrustHistory = [];
		const windStrength = diff?.windStrength ?? 0;
		this.wind = windStrength > 0 ? createWind(this.seed_, windStrength) : null;
		this.alien = shouldSpawnAlien(this.seed_, diff)
			? createAlien(this.seed_)
			: null;
		this.gravityStorm = shouldSpawnGravityStorm(this.seed_, diff)
			? createGravityStorm(this.seed_)
			: null;
		this.artifacts = placeArtifacts(this.seed_, this.terrain.points);
		this.audio.soundtrack.start();
		const ghostRun = loadGhostForSeed(this.seed_);
		this.ghostPlayer = ghostRun ? new GhostPlayer(ghostRun) : null;
	}

	start(): void {
		this.lastTime = performance.now();
		requestAnimationFrame((t) => this.loop(t));
	}

	private loop(time: number): void {
		let dt = (time - this.lastTime) / 1000;
		this.lastTime = time;

		if (this.firstFrame) {
			this.firstFrame = false;
			dt = 0;
		}
		dt = Math.min(dt, MAX_DELTA);

		const inputState = this.input.getState();

		// Init audio on first keypress (browser autoplay policy)
		if (
			!this.audioInitialized &&
			(inputState.thrustUp ||
				inputState.rotateLeft ||
				inputState.rotateRight ||
				inputState.restart ||
				inputState.menuSelect)
		) {
			this.audio.init();
			this.audioInitialized = true;
		}

		// Title screen (4 options: Free Play, Campaign, AI Training, Editor)
		if (this.status === "title") {
			if (inputState.menuUp) {
				this.titleSelection = (this.titleSelection - 1 + 4) % 4;
			}
			if (inputState.menuDown) {
				this.titleSelection = (this.titleSelection + 1) % 4;
			}
			if (inputState.menuSelect) {
				if (this.titleSelection === 2) {
					this.startTraining();
				} else if (this.titleSelection === 3) {
					this.startEditor();
				} else {
					this.gameMode = this.titleSelection === 0 ? "freeplay" : "campaign";
					this.selectedMission = 0;
					this.status = "menu";
				}
			}
			if (inputState.openSettings) {
				this.settingsOverlay.show((config) => {
					this.llmConfig = config;
				});
			}
			this.gameRenderer.renderTitle(this);
			requestAnimationFrame((t) => this.loop(t));
			return;
		}

		// Training mode
		if (this.status === "training") {
			if (inputState.menuBack) {
				this.stopTraining();
				this.status = "title";
			}
			if (
				inputState.menuSelect &&
				this.trainingLoop &&
				this.trainingLoop.agent.episodeCount > 0
			) {
				this.stopTraining();
				this.startAgentReplay();
			}
			this.gameRenderer.renderTraining(this);
			requestAnimationFrame((t) => this.loop(t));
			return;
		}

		// Editor mode
		if (this.status === "editor" && this.editorState) {
			if (inputState.menuBack) {
				this.editorState = null;
				this.status = "title";
				requestAnimationFrame((t) => this.loop(t));
				return;
			}
			if (inputState.menuSelect) {
				// Play the custom terrain
				this.playCustomTerrain();
				requestAnimationFrame((t) => this.loop(t));
				return;
			}
			if (inputState.toggleAutopilot) {
				// P key: toggle pad placement mode
				this.editorState.placingPad = !this.editorState.placingPad;
			}
			if (inputState.openSettings) {
				// S key: share URL
				const encoded = serializeEditor(this.editorState);
				const url = new URL(window.location.href);
				url.searchParams.set("custom", encoded);
				url.searchParams.delete("seed");
				navigator.clipboard?.writeText(url.toString());
				window.history.replaceState(null, "", url.toString());
			}
			// Ctrl+Z undo handled via keydown listener below
			this.renderEditorFrame();
			requestAnimationFrame((t) => this.loop(t));
			return;
		}

		// Agent replay mode
		if (this.status === "agent-replay") {
			if (inputState.menuBack) {
				this.status = "title";
				requestAnimationFrame((t) => this.loop(t));
				return;
			}
			if (inputState.restart && this.lander.status !== "flying") {
				this.startAgentReplay();
				requestAnimationFrame((t) => this.loop(t));
				return;
			}
			this.accumulator += dt;
			while (this.accumulator >= FIXED_TIMESTEP) {
				if (this.lander.status === "flying" && this.trainingLoop) {
					const state = this.trainingLoop.agent.getState(
						this.lander,
						this.terrain,
					);
					const action = this.trainingLoop.agent.chooseAction(state);
					const agentInput = this.trainingLoop.agent.actionToInput(action);
					updateLander(this.lander, agentInput, FIXED_TIMESTEP);
					const result = checkCollision(this.lander, this.terrain);
					if (result.collided) {
						if (result.safeLanding && result.onPad) {
							this.lander.status = "landed";
							this.lander.vy = 0;
							this.lander.vx = 0;
							this.lander.y = result.onPad.y - LANDER_HEIGHT / 2;
							this.audio.playSuccess();
						} else {
							this.lander.status = "crashed";
							this.particles_.emitExplosion(this.lander.x, this.lander.y);
							this.camera_.shake(15);
							this.audio.playCrash();
						}
					}
				}
				this.accumulator -= FIXED_TIMESTEP;
			}
			this.particles_.update(dt);
			if (this.lander.thrusting) {
				const rad = (this.lander.angle + 90) * (Math.PI / 180);
				this.particles_.emitExhaust(
					this.lander.x + Math.cos(rad) * 18,
					this.lander.y + Math.sin(rad) * 18,
					this.lander.angle,
				);
			}
			this.camera_.follow(this.lander.x, this.lander.y, dt);
			this.gameRenderer.renderAgentReplay(this);
			requestAnimationFrame((t) => this.loop(t));
			return;
		}

		// Mission select
		if (this.status === "menu") {
			const missions = this.gameMode === "campaign" ? CAMPAIGN : MISSIONS;
			if (inputState.menuUp) {
				this.selectedMission =
					(this.selectedMission - 1 + missions.length) % missions.length;
			}
			if (inputState.menuDown) {
				this.selectedMission = (this.selectedMission + 1) % missions.length;
			}
			if (inputState.menuSelect) {
				const mission = missions[this.selectedMission];
				if (
					this.gameMode === "campaign" &&
					!isMissionUnlocked(mission.id, this.campaignCompleted)
				) {
					// Locked
				} else {
					this.activeMission = mission;
					this.seed_ = mission.seed;
					this.reset();
					this.llm.fetchBriefing(this, mission);
					this.updateURL(mission.seed);
				}
			}
			// Toggle relay mode (L key) — only in free-play
			if (inputState.toggleRelay && this.gameMode === "freeplay") {
				this.relay = this.relay ? null : createRelayState();
			}
			// Gravity preset selector (left/right arrows on free-play menu)
			if (this.gameMode === "freeplay") {
				if (inputState.rotateLeft) {
					this.gravityPreset = prevPreset(this.gravityPreset);
				}
				if (inputState.rotateRight) {
					this.gravityPreset = nextPreset(this.gravityPreset);
				}
			}
			if (inputState.importGhost) {
				uploadGhost().then((run) => {
					if (run) {
						const missions = this.gameMode === "campaign" ? CAMPAIGN : MISSIONS;
						const idx = missions.findIndex((m) => m.seed === run.seed);
						if (idx >= 0) this.selectedMission = idx;
					}
				});
			}
			if (inputState.menuBack) {
				this.status = "title";
			}
			this.gameRenderer.renderMenu(this);
			requestAnimationFrame((t) => this.loop(t));
			return;
		}

		// Ghost export
		if (inputState.exportGhost && this.status === "landed") {
			downloadGhost(this.seed_);
		}

		// Flight report card
		if (
			inputState.flightReport &&
			(this.status === "landed" || this.status === "crashed")
		) {
			generateFlightReport(
				this.lander,
				this.terrain,
				this.telemetry.frames,
				this.activeMission?.name ?? `SEED ${this.seed_}`,
				this.seed_,
				this.score,
				this.status === "landed",
			);
		}

		// Handle restart
		if (inputState.restart && this.status !== "playing") {
			if (this.embedMode) {
				this.reset();
				requestAnimationFrame((t) => this.loop(t));
				return;
			}
			if (
				this.gameMode === "campaign" &&
				this.status === "landed" &&
				this.activeMission
			) {
				const nextIdx = this.selectedMission + 1;
				if (nextIdx < CAMPAIGN.length) {
					this.selectedMission = nextIdx;
					this.activeMission = CAMPAIGN[nextIdx];
					this.seed_ = this.activeMission.seed;
					this.reset();
					requestAnimationFrame((t) => this.loop(t));
					return;
				}
			}
			this.status = "menu";
			requestAnimationFrame((t) => this.loop(t));
			return;
		}

		// Return to menu mid-flight
		if (inputState.menuBack && this.status === "playing") {
			this.audio.setThruster(false);
			this.audio.soundtrack.stop();
			this.status = "menu";
			requestAnimationFrame((t) => this.loop(t));
			return;
		}

		// Autopilot toggle
		if (inputState.toggleAutopilot && this.status === "playing") {
			this.autopilot.toggle();
		}

		// Retro skin toggle
		if (inputState.toggleRetroSkin) {
			this.retroSkin.toggle();
			this.gameRenderer.setRetroSkin(
				this.retroSkin.active ? this.retroSkin : null,
			);
		}

		// Resolved input (autopilot or player)
		const physicsInput = this.autopilot.enabled
			? this.autopilot.computeInput(
					this.lander,
					this.terrain,
					this.gravityPreset.gameGravity,
				)
			: inputState;

		// Fixed timestep physics
		this.accumulator += dt;
		while (this.accumulator >= FIXED_TIMESTEP) {
			this.fixedUpdate(FIXED_TIMESTEP, physicsInput);
			this.accumulator -= FIXED_TIMESTEP;
		}

		// Telemetry and soundtrack
		if (this.status === "playing") {
			const terrainY = getTerrainHeightAt(this.lander.x, this.terrain.points);
			const altitude = terrainY - (this.lander.y + LANDER_HEIGHT / 2);
			this.telemetry.update(
				dt,
				altitude,
				this.lander.vy,
				this.lander.vx,
				this.lander.fuel,
			);
			const tension = Math.max(0, Math.min(1, 1 - altitude / 500));
			this.audio.updateSoundtrack(tension);
		}

		this.particles_.update(dt);
		this.audio.setThruster(this.lander.thrusting && this.status === "playing");

		// Low fuel warning
		if (
			this.lander.fuel > 0 &&
			this.lander.fuel < STARTING_FUEL * 0.15 &&
			this.status === "playing"
		) {
			this.fuelWarningCooldown -= dt;
			if (this.fuelWarningCooldown <= 0) {
				this.audio.playFuelWarning();
				this.fuelWarningCooldown = 0.8;
			}
		}

		// Exhaust particles
		if (this.lander.thrusting && this.status === "playing") {
			const rad = (this.lander.angle + 90) * (Math.PI / 180);
			const exhaustX = this.lander.x + Math.cos(rad) * 18;
			const exhaustY = this.lander.y + Math.sin(rad) * 18;
			this.particles_.emitExhaust(exhaustX, exhaustY, this.lander.angle);
		}

		this.camera_.follow(this.lander.x, this.lander.y, dt);

		if (this.status !== "playing") {
			this.messageTimer += dt;
		}

		// Achievement toast countdown
		if (this.achievementToastTimer > 0) {
			this.achievementToastTimer -= dt;
			if (this.achievementToastTimer <= 0) {
				this.achievementToast = null;
			}
		}

		this.gameRenderer.render(this);
		requestAnimationFrame((t) => this.loop(t));
	}

	private fixedUpdate(dt: number, inputState: InputState): void {
		if (this.status !== "playing") return;

		this.ghostPlayer?.step();

		this.flightElapsed += dt;
		let resolvedInput = inputState;
		if (this.alien) {
			updateAlien(
				this.alien,
				this.lander.x,
				this.lander.y,
				dt,
				this.flightElapsed,
			);
			resolvedInput = applyAlienEffect(this.alien, this.lander, inputState, dt);
			if (this.alien.effectJustStarted) {
				this.audio.playAlienWarning();
			}
		}

		this.ghostRecorder.record(inputState);
		updateLander(
			this.lander,
			resolvedInput,
			dt,
			this.gravityPreset.gameGravity,
		);

		// Track thrust history for "no thrust" achievement (last 3 seconds = ~180 frames)
		this.thrustHistory.push(this.lander.thrusting);
		if (this.thrustHistory.length > 180) this.thrustHistory.shift();

		if (this.wind) {
			updateWind(this.wind, this.flightElapsed);
			this.lander.vx += this.wind.speed * dt;
		}

		// Gravity storm
		if (this.gravityStorm) {
			updateGravityStorm(this.gravityStorm, dt, this.flightElapsed);
			this.lander.vy = applyGravityStormEffect(
				this.gravityStorm,
				this.lander.vy,
				dt,
				this.lander.landerType.massMultiplier,
				this.gravityPreset.gameGravity,
			);
		}

		// Fuel leak random event
		if (!this.fuelLeakTriggered && this.flightElapsed > 5) {
			this.fuelLeakTriggered = true;
			this.fuelLeakActive = this.seed_ % 10 === 7;
		}
		if (this.fuelLeakActive && this.lander.fuel > 0) {
			this.lander.fuel = Math.max(
				0,
				this.lander.fuel - FUEL_BURN_RATE * 0.3 * dt,
			);
		}

		// Collision
		const result = checkCollision(this.lander, this.terrain);
		if (result.collided) {
			if (result.safeLanding && result.onPad) {
				this.lander.status = "landed";
				this.lander.vy = 0;
				this.lander.vx = 0;
				this.lander.y = result.onPad.y - LANDER_HEIGHT / 2;
				this.status = "landed";
				this.score = this.calculateScore(result.onPad);
				this.particles_.emitDust(
					this.lander.x,
					result.onPad.y,
					result.onPad.width,
				);
				this.audio.setThruster(false);
				this.audio.playSuccess();
				this.audio.soundtrack.onLanded();
				this.ghostRecorder.save(this.score);
				this.lastRank = addScore(this.seed_, this.score);
				this.llm.scanNearbyArtifact(this, this.artifacts, this.lander.x);
				this.llm.fetchCommentary(this, this.lander, this.score, true);
				if (this.gameMode === "campaign" && this.activeMission) {
					this.campaignCompleted.add(this.activeMission.id);
					saveCampaignProgress(this.campaignCompleted);
				}
				// Check achievements
				const thrustingLast3s = this.thrustHistory.some((t) => t);
				const scannedCount = this.artifacts.filter((a) => a.scanned).length;
				const newBadges = checkLandingAchievements(this.achievements, {
					landed: true,
					hSpeed: this.lander.vx,
					angle: normAngle(this.lander.angle),
					fuelPercent: (this.lander.fuel / STARTING_FUEL) * 100,
					thrustingLast3Seconds: thrustingLast3s,
					aliensActive: this.alien !== null,
					campaignComplete: this.campaignCompleted.size >= CAMPAIGN.length,
					artifactsScanned: scannedCount,
					artifactsTotal: this.artifacts.length,
				});
				if (newBadges.length > 0) {
					this.achievementToast = newBadges[0];
					this.achievementToastTimer = 4;
				}
			} else {
				this.lander.status = "crashed";
				this.status = "crashed";
				this.particles_.emitExplosion(this.lander.x, this.lander.y);
				this.camera_.shake(15);
				this.audio.setThruster(false);
				this.audio.playCrash();
				this.audio.soundtrack.onCrashed();
				this.llm.fetchCommentary(this, this.lander, this.score, false);
			}

			// Relay mode: record lander result and auto-advance
			if (
				this.relay &&
				(this.status === "landed" || this.status === "crashed")
			) {
				const hasMore = recordRelayLander(
					this.relay,
					this.lander.x,
					this.lander.y,
					this.status,
					this.score,
				);
				if (hasMore) {
					// Auto-spawn next lander after brief delay
					setTimeout(() => {
						if (!this.relay || isRelayComplete(this.relay)) return;
						const spawn = advanceRelayLander(this.relay);
						this.spawnRelayLander(spawn.spawnX, spawn.spawnY);
					}, 1500);
				} else {
					// Relay complete — show combined score
					this.score = this.relay.totalScore;
				}
			}
		}
	}

	private spawnRelayLander(spawnX: number, spawnY: number): void {
		const diff = this.activeMission?.difficulty;
		const landerType = getLanderType(diff?.landerType);
		this.lander = createLander(spawnX, spawnY, landerType);
		if (diff?.startingFuel !== undefined) {
			this.lander.fuel = diff.startingFuel;
		}
		this.status = "playing";
		this.particles_.clear();
		this.firstFrame = true;
		this.fuelWarningCooldown = 0;
		this.flightElapsed = 0;
		this.fuelLeakActive = false;
		this.fuelLeakTriggered = false;
		this.audio.soundtrack.start();
	}

	private calculateScore(pad: { points: number }): number {
		let score = 100 * pad.points;
		score += Math.floor(this.lander.fuel * SCORE_FUEL_MULTIPLIER);
		if (Math.abs(this.lander.vy) < MAX_LANDING_SPEED * 0.5) {
			score += SCORE_SPEED_BONUS;
		}
		if (Math.abs(normAngle(this.lander.angle)) < MAX_LANDING_ANGLE * 0.5) {
			score += SCORE_ANGLE_BONUS;
		}
		return score;
	}

	private async startTraining(): Promise<void> {
		this.status = "training";
		if (!this.trainingLoop) {
			this.trainingLoop = new TrainingLoop();
		}
		const savedEpsilon = this.trainingLoop.agent.epsilon;
		if (!this.trainingLoop.agent.ready) {
			await this.trainingLoop.init();
		}
		this.trainingLoop.agent.epsilon = savedEpsilon;
		this.trainingLoop.start((stats) => {
			this.latestTrainingStats = stats;
		});
	}

	private stopTraining(): void {
		this.trainingLoop?.pause();
	}

	private startEditor(): void {
		this.editorState = createEditorState();
		this.status = "editor";
		// Set up mouse/touch handlers for the editor
		const canvas = this.canvasRenderer.canvas;
		const onDown = (e: MouseEvent) => {
			if (this.status !== "editor" || !this.editorState) return;
			const rect = canvas.getBoundingClientRect();
			editorClick(
				this.editorState,
				e.clientX - rect.left,
				e.clientY - rect.top,
				e.button === 2,
			);
		};
		const onMove = (e: MouseEvent) => {
			if (this.status !== "editor" || !this.editorState) return;
			if (e.buttons === 1) {
				const rect = canvas.getBoundingClientRect();
				editorDrag(
					this.editorState,
					e.clientX - rect.left,
					e.clientY - rect.top,
				);
			}
		};
		const onUp = () => {
			if (this.editorState) editorRelease(this.editorState);
		};
		const onKey = (e: KeyboardEvent) => {
			if (this.status !== "editor" || !this.editorState) return;
			if (e.ctrlKey && e.code === "KeyZ") {
				e.preventDefault();
				editorUndo(this.editorState);
			}
		};
		const onContext = (e: MouseEvent) => {
			if (this.status === "editor") e.preventDefault();
		};
		canvas.addEventListener("mousedown", onDown);
		canvas.addEventListener("mousemove", onMove);
		canvas.addEventListener("mouseup", onUp);
		canvas.addEventListener("contextmenu", onContext);
		document.addEventListener("keydown", onKey);
	}

	private playCustomTerrain(): void {
		if (!this.editorState) return;
		this.terrain = buildTerrainFromEditor(this.editorState);
		this.seed_ = 0;
		this.gameMode = "freeplay";
		this.activeMission = {
			id: 0,
			name: "CUSTOM TERRAIN",
			seed: 0,
			description: "Player-designed terrain",
		};
		const landerType = getLanderType();
		this.lander = createLander(WORLD_WIDTH / 2, 80, landerType);
		this.status = "playing";
		this.score = 0;
		this.particles_.clear();
		this.camera_ = new Camera();
		this.firstFrame = true;
		this.messageTimer = 0;
		this.fuelWarningCooldown = 0;
		this.ghostRecorder.start(0);
		this.telemetry.reset();
		this.autopilot.enabled = false;
		this.flightElapsed = 0;
		this.fuelLeakActive = false;
		this.fuelLeakTriggered = false;
		this.wind = null;
		this.alien = null;
		this.gravityStorm = null;
		this.artifacts = [];
		this.relay = null;
		this.audio.soundtrack.start();
		this.ghostPlayer = null;
	}

	private renderEditorFrame(): void {
		const ctx = this.canvasRenderer.ctx;
		if (this.editorState) {
			renderEditor(ctx, this.editorState);
		}
	}

	private startAgentReplay(): void {
		if (!this.trainingLoop) return;
		this.seed_ = 1969;
		this.activeMission = null;
		this.terrain = generateTerrain(this.seed_);
		const landerType = getLanderType();
		this.lander = createLander(WORLD_WIDTH / 2, 80, landerType);
		this.particles_.clear();
		this.camera_ = new Camera();
		this.accumulator = 0;
		this.firstFrame = true;
		this.trainingLoop.agent.epsilon = 0;
		this.status = "agent-replay";
	}

	private updateURL(seed: number | null): void {
		const url = new URL(window.location.href);
		if (seed !== null) {
			url.searchParams.set("seed", String(seed));
		} else {
			url.searchParams.delete("seed");
		}
		window.history.replaceState(null, "", url.toString());
	}
}
