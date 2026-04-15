import { actionToInput } from "../ai/AgentEnv";
import { Autopilot } from "../ai/Autopilot";
import {
	applyAdaptiveModifiers,
	getAdaptiveModifiers,
} from "../ai/DifficultyAdapter";
import type { RecordedEpisode } from "../ai/EpisodeRecorder";
import type { TrainingStats } from "../ai/RLAgent";
import { TrainingLoop } from "../ai/TrainingLoop";
import { type LLMConfig, loadLLMConfig } from "../api/LLMProvider";
import { RetroVectorSkin } from "../graphics/skins/RetroVector";
import { CanvasRenderer } from "../render/CanvasRenderer";
import { type Achievement, loadAchievements } from "../systems/Achievements";
import { Audio } from "../systems/Audio";
import {
	GhostPlayer,
	GhostRecorder,
	loadGhostForSeed,
} from "../systems/GhostReplay";
import { Input, type InputState } from "../systems/Input";
import { TelemetryRecorder } from "../systems/Telemetry";
import { SettingsOverlay } from "../ui/SettingsOverlay";
import {
	buildTerrainFromEditor,
	deserializeEditor,
	type EditorState,
} from "../ui/TerrainEditor";
import { WORLD_WIDTH } from "../utils/constants";
import { stepAgentReplay, updateAgentReplayFrame } from "./AgentReplay";
import { AITheater, type AITheaterComparison } from "./AITheater";
import { createAlien, shouldSpawnAlien } from "./Alien";
import type { Artifact } from "./Artifacts";
import { placeArtifacts } from "./Artifacts";
import { Camera } from "./Camera";
import { handleCollisionResult } from "./CollisionHandler";
import { GameLoop } from "./GameLoop";
import { GameRenderer, type GameStatus } from "./GameRenderer";
import { type GravityPreset, getDefaultPreset } from "./GravityPresets";
import { createGravityStorm, shouldSpawnGravityStorm } from "./GravityStorm";
import { createLander, type LanderState } from "./Lander";
import { getLanderType } from "./LanderTypes";
import { LLMIntegration } from "./LLMIntegration";
import { loadCampaignProgress, MISSIONS, type Mission } from "./Missions";
import { ParticleSystem } from "./Particles";
import { PhysicsManager } from "./PhysicsManager";
import type { RelayState } from "./RelayMode";
import {
	handlePostFlightInput,
	updateEditor,
	updateFlightVisuals,
	updateMenu,
	updateTitle,
	updateTraining,
} from "./StateHandlers";
import { generateTerrain, type TerrainData } from "./Terrain";
import { createWind, type WindState } from "./Wind";

export type { GameStatus } from "./GameRenderer";

export class Game {
	private canvasRenderer: CanvasRenderer;
	private gameRenderer: GameRenderer;
	private gameLoop: GameLoop;
	physics = new PhysicsManager();
	llm: LLMIntegration;
	audio: Audio;
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
	gameMode: "freeplay" | "campaign" | "ai-theater" = "freeplay";
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
	crashAnalysis = "";
	private settingsOverlay = new SettingsOverlay();
	private fuelWarningCooldown = 0;
	private audioInitialized = false;
	ghostRecorder = new GhostRecorder();
	ghostPlayer: GhostPlayer | null = null;
	telemetry = new TelemetryRecorder();
	autopilot = new Autopilot();
	wind: WindState | null = null;
	alien: ReturnType<typeof createAlien> | null = null;
	gravityStorm: ReturnType<typeof createGravityStorm> | null = null;
	relay: RelayState | null = null;
	artifacts: Artifact[] = [];
	private retroSkin = new RetroVectorSkin();
	aiTheater = new AITheater();
	aiTheaterComparison: AITheaterComparison | null = null;
	forkReplay: {
		episode: RecordedEpisode;
		frame: number;
		forked: boolean;
		forkFrame: number | null;
	} | null = null;
	editorState: EditorState | null = null;
	achievements = loadAchievements();
	achievementToast: Achievement | null = null;
	gravityPreset: GravityPreset = getDefaultPreset();
	achievementToastTimer = 0;
	private embedMode: boolean;
	private currentInput: InputState = {} as InputState;

	get camera(): Camera {
		return this.camera_;
	}
	get particles(): ParticleSystem {
		return this.particles_;
	}
	get seed(): number {
		return this.seed_;
	}
	get flightElapsed(): number {
		return this.physics.flightElapsed;
	}
	get fuelLeakActive(): boolean {
		return this.physics.fuelLeakActive;
	}
	get isEmbed(): boolean {
		return this.embedMode;
	}
	get canvas(): HTMLCanvasElement {
		return this.canvasRenderer.canvas;
	}
	get ctx(): CanvasRenderingContext2D {
		return this.canvasRenderer.ctx;
	}

	setSeed(s: number): void {
		this.seed_ = s;
	}
	resetCamera(): void {
		this.camera_ = new Camera();
	}
	resetLoop(): void {
		this.gameLoop.resetAccumulator();
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
		this.gameLoop = new GameLoop(
			() => this.onBeforeFrame(),
			(dt) => this.onFixedUpdate(dt),
			(dt) => this.onAfterFrame(dt),
		);
		this.aiTheater.setForkHandler((ep) => this.startForkReplay(ep));
		this.reset();

		if (customTerrain) {
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

	start(): void {
		this.gameLoop.start();
	}

	showSettings(): void {
		this.settingsOverlay.show((config) => {
			this.llmConfig = config;
		});
	}

	toggleRetroSkin(): void {
		this.retroSkin.toggle();
		this.gameRenderer.setRetroSkin(
			this.retroSkin.active ? this.retroSkin : null,
		);
	}

	clearEditor(): void {
		this.editorState = null;
	}

	renderTitle(): void {
		this.gameRenderer.renderTitle(this);
	}
	renderTraining(): void {
		this.gameRenderer.renderTraining(this);
	}
	renderMenu(): void {
		this.gameRenderer.renderMenu(this);
	}
	renderAgentReplay(): void {
		this.gameRenderer.renderAgentReplay(this);
	}

	updateFuelWarning(dt: number): void {
		this.fuelWarningCooldown -= dt;
		if (this.fuelWarningCooldown <= 0) {
			this.audio.playFuelWarning();
			this.fuelWarningCooldown = 0.8;
		}
	}

	spawnRelayLander(spawnX: number, spawnY: number): void {
		const diff = this.activeMission?.difficulty;
		this.lander = createLander(spawnX, spawnY, getLanderType(diff?.landerType));
		if (diff?.startingFuel !== undefined) this.lander.fuel = diff.startingFuel;
		this.status = "playing";
		this.particles_.clear();
		this.gameLoop.resetAccumulator();
		this.fuelWarningCooldown = 0;
		this.physics.reset();
		this.audio.soundtrack.start();
	}

	async startForkReplay(episode: RecordedEpisode): Promise<void> {
		await this.aiTheater.stop();
		this.setSeed(episode.seed);
		this.gameMode = "freeplay";
		// Lock the physics environment to match what HeadlessGame used when
		// the AI recorded this episode: Moon gravity and no adaptive modifiers.
		// An explicit empty `difficulty` object short-circuits the adaptive
		// path in reset() so terrain is generated identically to the AI's sim.
		// Without these locks the canned inputs diverge from the recorded
		// trajectory on seeds that resolve to EASY/HARD/EXPERT, or whenever
		// the player last picked a non-Moon preset.
		this.gravityPreset = getDefaultPreset();
		this.activeMission = {
			id: 0,
			name: `AI REPLAY · EP ${episode.episode}`,
			seed: episode.seed,
			description: "Replaying AI's run — press T to take over",
			difficulty: {},
		};
		this.reset();
		// Hazards null'd because AI trained in a clean headless sim without
		// them — keeping them active would immediately desync from the
		// recorded trajectory. Hazard-faithful fork is Sprint 3 Part B.
		this.wind = null;
		this.alien = null;
		this.gravityStorm = null;
		this.forkReplay = {
			episode,
			frame: 0,
			forked: false,
			forkFrame: null,
		};
	}

	async startTraining(): Promise<void> {
		this.status = "training";
		if (!this.trainingLoop) this.trainingLoop = new TrainingLoop();
		const savedEpsilon = this.trainingLoop.agent.epsilon;
		if (!this.trainingLoop.agent.ready) await this.trainingLoop.init();
		this.trainingLoop.agent.epsilon = savedEpsilon;
		this.trainingLoop.start((stats) => {
			this.latestTrainingStats = stats;
		});
	}

	stopTraining(): void {
		this.trainingLoop?.pause();
	}

	playCustomTerrain(): void {
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
		this.lander = createLander(WORLD_WIDTH / 2, 80, getLanderType());
		this.status = "playing";
		this.score = 0;
		this.crashAnalysis = "";
		this.particles_.clear();
		this.camera_ = new Camera();
		this.gameLoop.resetAccumulator();
		this.fuelWarningCooldown = 0;
		this.ghostRecorder.start(0);
		this.telemetry.reset();
		this.autopilot.enabled = false;
		this.physics.reset();
		this.wind = null;
		this.alien = null;
		this.gravityStorm = null;
		this.artifacts = [];
		this.relay = null;
		this.audio.soundtrack.start();
		this.ghostPlayer = null;
	}

	reset(): void {
		this.forkReplay = null;
		let diff = this.activeMission?.difficulty;
		if (this.gameMode === "freeplay" && !diff) {
			const modifiers = getAdaptiveModifiers(this.seed_);
			diff = applyAdaptiveModifiers(undefined, modifiers);
			this.adaptiveLabel = modifiers.label;
		} else {
			this.adaptiveLabel = null;
		}
		this.terrain = generateTerrain(this.seed_, diff);
		this.lander = createLander(
			WORLD_WIDTH / 2,
			diff?.spawnY ?? 80,
			getLanderType(diff?.landerType),
		);
		if (diff?.startingFuel !== undefined) this.lander.fuel = diff.startingFuel;
		this.status = "playing";
		this.score = 0;
		this.crashAnalysis = "";
		this.particles_.clear();
		this.camera_ = new Camera();
		this.gameLoop.resetAccumulator();
		this.fuelWarningCooldown = 0;
		this.ghostRecorder.start(this.seed_);
		this.telemetry.reset();
		this.autopilot.enabled = false;
		this.physics.reset();
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

	private onBeforeFrame(): void {
		this.currentInput = this.input.getState();
		if (
			!this.audioInitialized &&
			(this.currentInput.thrustUp ||
				this.currentInput.rotateLeft ||
				this.currentInput.rotateRight ||
				this.currentInput.restart ||
				this.currentInput.menuSelect)
		) {
			this.audio.init();
			this.audioInitialized = true;
		}
	}

	private onFixedUpdate(dt: number): void {
		if (this.status === "agent-replay") {
			stepAgentReplay(this, dt);
			return;
		}
		if (this.status !== "playing") return;

		this.ghostPlayer?.step();
		let physicsInput = this.autopilot.enabled
			? this.autopilot.computeInput(
					this.lander,
					this.terrain,
					this.gravityPreset.gameGravity,
				)
			: this.currentInput;

		if (this.forkReplay) {
			const fr = this.forkReplay;
			if (!fr.forked && this.currentInput.forkTakeover) {
				fr.forked = true;
				fr.forkFrame = fr.frame;
			}
			if (!fr.forked) {
				const action = fr.episode.inputs[fr.frame] ?? 0;
				physicsInput = actionToInput(action);
			}
			fr.frame++;
			if (!fr.forked && fr.frame >= fr.episode.inputs.length) {
				// AI run ended without player taking over — auto-fork so the
				// player can finish the landing from here.
				fr.forked = true;
				fr.forkFrame = fr.episode.inputs.length;
			}
		}

		const result = this.physics.step(
			dt,
			this.lander,
			this.terrain,
			physicsInput,
			this.gravityPreset.gameGravity,
			this.wind,
			this.alien,
			this.gravityStorm,
			this.seed_,
			(input) => this.ghostRecorder.record(input),
		);
		if (!result) return;
		handleCollisionResult(
			this,
			result.landed,
			result.score,
			result.padY,
			result.padWidth,
		);
	}

	private onAfterFrame(dt: number): void {
		const input = this.currentInput;
		switch (this.status) {
			case "title":
				updateTitle(this, input);
				return;
			case "training":
				updateTraining(this, input);
				return;
			case "editor":
				updateEditor(this, input);
				return;
			case "agent-replay":
				updateAgentReplayFrame(this, dt);
				return;
			case "menu":
				updateMenu(this, input);
				return;
			default:
				break;
		}
		handlePostFlightInput(this, input);
		updateFlightVisuals(this, dt);
		this.gameRenderer.render(this);
	}
}
