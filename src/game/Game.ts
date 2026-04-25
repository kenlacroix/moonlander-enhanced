import { actionToInput } from "../ai/AgentEnv";
import { Autopilot } from "../ai/Autopilot";
import {
	applyAdaptiveModifiers,
	getAdaptiveModifiers,
} from "../ai/DifficultyAdapter";
import type { RecordedEpisode } from "../ai/EpisodeRecorder";
import type { TrainingStats } from "../ai/RLAgent";
import { TrainingLoop } from "../ai/TrainingLoop";
import { CampaignChatter } from "../api/CampaignChatter";
import { type LLMConfig, loadLLMConfig } from "../api/LLMProvider";
import { MissionChatter } from "../api/MissionChatter";
import { RetroVectorSkin } from "../graphics/skins/RetroVector";
import { CanvasRenderer } from "../render/CanvasRenderer";
import type { IGameplayRenderer } from "../render/IGameplayRenderer";
import { type Achievement, loadAchievements } from "../systems/Achievements";
import { Audio } from "../systems/Audio";
import {
	loadGamePreferences,
	resolveFlightPolicy,
} from "../systems/GamePreferences";
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
import { MAX_FLIGHT_DURATION, WORLD_WIDTH } from "../utils/constants";
import type { ShareConfig } from "../utils/shareUrl";
import { stepAgentReplay, updateAgentReplayFrame } from "./AgentReplay";
import { AITheater, type AITheaterComparison } from "./AITheater";
import { createAlien, shouldSpawnAlien } from "./Alien";
import type { Artifact } from "./Artifacts";
import { placeArtifacts } from "./Artifacts";
import {
	applyAuthenticFilter,
	applyAuthenticPhysics,
	buildAuthenticState,
	type FlightConfig,
	updateAuthentic,
} from "./AuthenticMode";
import { Camera } from "./Camera";
import {
	handleCollisionResult,
	handleSurviveSuccess,
	handleSurviveTimeout,
} from "./CollisionHandler";
import { GameLoop } from "./GameLoop";
import { GameRenderer, type GameStatus } from "./GameRenderer";
import { type GravityPreset, getDefaultPreset } from "./GravityPresets";
import { createGravityStorm, shouldSpawnGravityStorm } from "./GravityStorm";
import {
	findHiddenPad,
	isHiddenPadRevealed,
	maybeGenerateHiddenPad,
} from "./HiddenPad";
import { isHistoricMission } from "./HistoricMission";
import { createLander, type LanderState } from "./Lander";
import { getLanderType } from "./LanderTypes";
import { LLMIntegration } from "./LLMIntegration";
import {
	loadCampaignProgress,
	loadCleanClears,
	MISSIONS,
	type Mission,
} from "./Missions";
import { ParticleSystem } from "./Particles";
import { PhysicsManager } from "./PhysicsManager";
import type { RelayState } from "./RelayMode";
import {
	HISTORIC_MISSIONS,
	handlePostFlightInput,
	selectMission,
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
	/** Sprint 6 Part A — gameplay draws (terrain, lander, particles,
	 * alien, ghost, artifacts) dispatch through this. WebGL when the
	 * backend initialized cleanly, Canvas 2D otherwise. UI draws
	 * (HUD, menus, briefings) always stay on canvasRenderer. */
	readonly gameplayRenderer: IGameplayRenderer;
	readonly rendererBackend: "webgl" | "canvas";
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
	/** Sprint 7.2 — set to true when the most recent crash was specifically a
	 * spinning-at-touchdown crash (angular rate exceeded MAX_LANDING_ANGULAR_RATE
	 * but vy and angle were otherwise safe). Lets the renderer show
	 * "LANDED SPINNING — STRUCTURAL FAILURE" instead of the generic message.
	 * Reset on each flight start. */
	lastSpinningCrash = false;
	gameMode: "freeplay" | "campaign" | "ai-theater" | "historic" = "freeplay";
	/**
	 * Mission ruleset, orthogonal to lander.status. "landing" is the
	 * normal lander-on-pad goal. Sprint 5 historic missions can declare
	 * "survive" (Apollo 13 loop-around, Part B) or "auto-landing"
	 * (Luna 9, Part B). Defaults to "landing" for everything except
	 * historic missions that opt into another kind.
	 */
	missionMode: "landing" | "survive" | "auto-landing" = "landing";
	/**
	 * Flight-scoped Authentic Mode config. Non-null only while a historic
	 * mission flight is active (constructed in selectMission, cleared on
	 * return-to-title / non-historic paths). Never set during AI Theater,
	 * HeadlessGame, fork replays, or freeplay — those paths keep it null.
	 */
	currentFlight: FlightConfig | null = null;
	/**
	 * Sprint 5.5 pre-launch Authentic tutorial overlay. Non-null only
	 * during the 3-second block shown on mission-select the first time a
	 * player launches Authentic on a given mission. Key:
	 * moonlander-authentic-intro-seen-{missionId} written on dismiss so
	 * the overlay never reappears for that mission.
	 */
	tutorialOverlay: {
		missionId: number;
		framesRemaining: number;
	} | null = null;
	activeMission: Mission | null = null;
	campaignCompleted = loadCampaignProgress();
	/**
	 * Sprint 7.4 — clean-clear progress (mission completed with
	 * `FlightOutcome.result === "clean"`). Parallel to campaignCompleted
	 * so the existing save schema is untouched. Mission menu renders a
	 * star next to the [DONE] checkmark for missions in this Set.
	 */
	cleanClears = loadCleanClears();
	titleSelection = 0;
	trainingLoop: TrainingLoop | null = null;
	latestTrainingStats: TrainingStats | null = null;
	adaptiveLabel: string | null = null;
	private llmConfig: LLMConfig | null = null;

	getLLMConfig(): LLMConfig | null {
		return this.llmConfig;
	}
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
	missionChatter = new MissionChatter();
	/** Sprint 7.4 — Campaign-only narrative chatter (Hoshi briefing +
	 * Chen in-flight + Hoshi post-landing). Activated in selectMission
	 * when `gameMode === "campaign"` AND `mission.narrative?.enabled`.
	 * MissionChatter handles Historic missions; the two systems never
	 * fire simultaneously (gameMode is exclusive). */
	campaignChatter = new CampaignChatter();
	/** Sprint 7.4 — track which hazards fired during the current flight
	 * so post-landing dialogue can branch on hazardsFired. Reset on
	 * each reset(). The `*Active` and `*Started` semantics are different
	 * from the live alien/storm states: these latch to true the first
	 * frame the hazard's effect started, regardless of whether it's
	 * still active at touchdown. */
	flightHazardsFired = { alien: false, storm: false, fuelLeak: false };
	/** Sprint 7.4 — track previous storm phase so we can detect the
	 * normal→high transition for the storm-start chatter trigger.
	 * Updated in onFixedUpdate after physics.step(). */
	private prevStormPhase: "normal" | "high" | "low" = "normal";
	/** Sprint 7.4 — peak angular rate seen during the current flight
	 * (v3 only). Tracked frame-by-frame in onFixedUpdate. Used by
	 * FlightOutcome to populate bestAngularRate. v2 missions stay 0. */
	flightPeakAngularRate = 0;
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
	/** Sprint 7.1 PR 1.5 — hidden pad reveal latch. Starts false on every
	 * flight, flips true the frame the lander first crosses the reveal
	 * AGL. A one-shot dust-plume burst fires on that transition; the
	 * renderer only draws the gold hidden pad while this is true. */
	hiddenPadRevealed = false;
	/** Sprint 7.2 — one-shot "first spin" tutorial. Frames remaining to
	 * display the "Rotation has momentum — counter-burn to stop" message.
	 * Triggered on the first rotate input of the session when the player
	 * has not previously dismissed it (localStorage-gated). */
	rcsTutorialFramesRemaining = 0;
	private rcsTutorialSeen = false;

	/** Sprint 7.2 — fire the first-spin tutorial once per player. No-op if
	 * already seen (localStorage check). Sets a 180-frame countdown (3 s at
	 * 60Hz) for the HUD to render the message, then persists the flag so
	 * the message never reappears. Called from StateHandlers when `rcsFiring`
	 * is true and the game is in "playing" state. */
	maybeShowRcsTutorial(): void {
		if (this.rcsTutorialSeen) return;
		this.rcsTutorialSeen = true;
		this.rcsTutorialFramesRemaining = 180;
		try {
			localStorage.setItem("moonlander-rcs-tutorial-seen", "1");
		} catch {
			// localStorage unavailable (private mode). The tutorial will
			// re-show next session, which is acceptable.
		}
	}
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
	get missionChatterText(): string {
		return this.missionChatter.latestText;
	}
	/** Sprint 7.4 — campaign chatter line (with speaker) for prefix-aware
	 * rendering. Null when no campaign chatter is active. */
	get campaignChatterLine(): {
		speaker: "hoshi" | "chen";
		text: string;
	} | null {
		return this.campaignChatter.latest;
	}
	/** Sprint 7.4 — true when a multi-line post-landing sequence has
	 * more lines queued. UI shows the [SPACE] SKIP hint. */
	get campaignHasQueuedLines(): boolean {
		return this.campaignChatter.hasQueuedLines;
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
		gameplayRenderer: IGameplayRenderer,
		rendererBackend: "webgl" | "canvas",
		urlSeed?: number,
		embedMode = false,
		customTerrain?: string,
		shareConfig?: ShareConfig,
	) {
		this.embedMode = embedMode;
		this.rendererBackend = rendererBackend;
		this.gameplayRenderer = gameplayRenderer;
		// Sprint 7.2 — read the first-spin tutorial flag once at startup.
		// localStorage access is cheap, but it avoids spamming synchronous
		// reads every frame in the hot path.
		try {
			this.rcsTutorialSeen =
				localStorage.getItem("moonlander-rcs-tutorial-seen") === "1";
		} catch {
			this.rcsTutorialSeen = false;
		}
		// WebGL mode: gameplayRenderer is WebGLGameplayRenderer on its own
		// GL canvas; CanvasRenderer is a fresh UI overlay on the 2D canvas,
		// clearing transparently so the WebGL layer shows through.
		// Canvas fallback: gameplayRenderer IS the CanvasRenderer bound to
		// the same 2D canvas. Reuse it as both gameplay and UI renderer
		// instead of double-constructing.
		if (rendererBackend === "webgl") {
			this.canvasRenderer = new CanvasRenderer(canvas);
			this.canvasRenderer.setTransparentClear(true);
		} else {
			this.canvasRenderer = gameplayRenderer as CanvasRenderer;
		}
		this.gameRenderer = new GameRenderer(
			this.canvasRenderer,
			this.gameplayRenderer,
		);
		this.llm = new LLMIntegration(() => this.llmConfig);
		this.audio = new Audio();
		this.input = new Input();
		this.camera_ = new Camera();
		this.particles_ = new ParticleSystem();
		// Sprint 7.1 PR 1.5 — a `?cfg=` payload carries its own seed;
		// prefer it over any raw `?seed=` parameter (they should agree
		// in practice, but if a caller mixed them the cfg is the
		// richer signal).
		this.seed_ = shareConfig?.seed ?? urlSeed ?? MISSIONS[0].seed;
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
		} else if (shareConfig) {
			// `?cfg=` carries seed + archetype + palette. Bypass the
			// historic lookup — a share URL describes a Random Mission or
			// freeplay variant, not a canonical historic landing.
			this.gameMode = "freeplay";
			this.activeMission = {
				id: 0,
				name: `SHARED ${shareConfig.seed}`,
				seed: shareConfig.seed,
				description: "Shared mission",
				difficulty: shareConfig.archetype
					? { archetype: shareConfig.archetype }
					: undefined,
				palette: shareConfig.palette,
			};
			this.status = "playing";
			this.reset();
		} else if (urlSeed && !Number.isNaN(urlSeed)) {
			// Shared/embed URLs must route historic seeds through selectMission
			// so auto-landing (Luna 9) gets its autopilot force-enabled and
			// survive (Apollo 13) gets its missionMode set. Before this lookup
			// every urlSeed fell into the freeplay path below, so a shared
			// Luna 9 link silently played as freeplay with the player flying.
			const historic = HISTORIC_MISSIONS.find((m) => m.seed === urlSeed);
			if (historic) {
				this.gameMode = "historic";
				selectMission(this, historic);
			} else {
				this.gameMode = "freeplay";
				this.activeMission = {
					id: 0,
					name: `SEED ${urlSeed}`,
					seed: urlSeed,
					description: "Shared mission",
				};
				this.status = "playing";
			}
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
		// v0.6.3.0 — relay spawns share the initial flight's physics policy.
		// Re-resolving here would re-read user prefs which could drift mid-
		// flight if the user opened Settings between relay #1 and #2.
		// Simplest consistent behavior: use the existing lander's
		// physicsVersion (which was set at the initial reset() call).
		const physicsVersion = this.lander.physicsVersion;
		this.lander = createLander(
			spawnX,
			spawnY,
			getLanderType(diff?.landerType),
			diff,
			physicsVersion,
		);
		// Sprint 7.2 Part 2 — relay lander #2/#3 must reapply authentic-mode
		// tightening since createLander can't reach into AuthenticMode without
		// a circular dependency. era is undefined for non-historic missions
		// (helper no-ops). Skipped when authenticMode is false (also no-op).
		applyAuthenticPhysics(
			this.lander,
			this.activeMission && isHistoricMission(this.activeMission)
				? this.activeMission.era
				: undefined,
			this.currentFlight?.authenticMode ?? false,
		);
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
		// Sprint 5.5 fork-replay vanilla-lock: captured episodes always replay
		// without Authentic mechanics. Mirrors the gravity/hazard lock above
		// — toggling Authentic after capture would diverge the trajectory.
		this.currentFlight = { authenticMode: false, authenticState: null };
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
		this.currentFlight = null;
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
		// v0.6.3.0 — resolve the per-flight policy once, use it everywhere.
		// Free Play reads user prefs (default v2, no hazards); Campaign uses
		// the per-mission DifficultyConfig.physicsVersion ramp; Historic and
		// AI Theater stay forced v3 + all hazards passed through to
		// per-mission gating. Pure function, no cached state on Game.
		const flightPolicy = resolveFlightPolicy(
			this.gameMode,
			this.activeMission,
			loadGamePreferences(),
		);
		this.terrain = generateTerrain(this.seed_, diff);
		const hiddenPad = maybeGenerateHiddenPad(
			this.activeMission,
			this.terrain,
			this.seed_,
		);
		if (hiddenPad) this.terrain.pads.push(hiddenPad);
		this.hiddenPadRevealed = false;
		this.lastSpinningCrash = false;
		this.lander = createLander(
			WORLD_WIDTH / 2,
			diff?.spawnY ?? 80,
			getLanderType(diff?.landerType),
			diff,
			flightPolicy.physicsVersion,
		);
		// Sprint 7.2 Part 2 — see spawnRelayLander for the same pattern. Authentic
		// tightening must apply here too; createLander materialized the per-mission
		// base, helper composes the era multiplier on top.
		applyAuthenticPhysics(
			this.lander,
			this.activeMission && isHistoricMission(this.activeMission)
				? this.activeMission.era
				: undefined,
			this.currentFlight?.authenticMode ?? false,
		);
		this.status = "playing";
		this.score = 0;
		this.crashAnalysis = "";
		this.particles_.clear();
		this.camera_ = new Camera();
		this.gameLoop.resetAccumulator();
		this.fuelWarningCooldown = 0;
		const ghostMode = this.currentFlight?.authenticMode
			? "authentic"
			: "vanilla";
		this.ghostRecorder.start(this.seed_, ghostMode, diff);
		this.telemetry.reset();
		this.autopilot.enabled = false;
		this.physics.reset();
		this.physics.setHazardPolicy(flightPolicy);
		const windStrength = diff?.windStrength ?? 0;
		this.wind = windStrength > 0 ? createWind(this.seed_, windStrength) : null;
		this.alien =
			flightPolicy.aliens && shouldSpawnAlien(this.seed_, diff)
				? createAlien(this.seed_)
				: null;
		this.gravityStorm =
			flightPolicy.storms && shouldSpawnGravityStorm(this.seed_, diff)
				? createGravityStorm(this.seed_)
				: null;
		// Sprint 7.4 — reset per-flight narrative state.
		this.flightHazardsFired = { alien: false, storm: false, fuelLeak: false };
		this.prevStormPhase = this.gravityStorm?.phase ?? "normal";
		this.flightPeakAngularRate = 0;
		this.artifacts = placeArtifacts(this.seed_, this.terrain.points);
		// Sprint 7.1 PR 1.5 — hand the archetype to the soundtrack before
		// start(), so the next flight's drone / shimmer / tension profile
		// reflects the terrain type. Default/rolling keeps the legacy
		// tritone mix byte-identical to v0.6.0.0.
		this.audio.soundtrack.setArchetype(diff?.archetype);
		this.audio.soundtrack.start();
		const ghostRun = loadGhostForSeed(this.seed_, ghostMode);
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

		// Sprint 5.5 — tick the Authentic state machine before the filter,
		// so an ARMED → ACTIVE transition this frame immediately zeroes
		// thrust on the same frame. Audio fires once on transition.
		const authenticState = this.currentFlight?.authenticState ?? null;
		const transition = updateAuthentic(
			authenticState,
			this.lander,
			this.terrain,
		);
		if (transition === "alarm-fired") this.audio.playProgramAlarm();
		else if (transition === "master-alarm-fired") this.audio.playMasterAlarm();
		physicsInput = applyAuthenticFilter(physicsInput, authenticState);

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
		// Sprint 7.4 — narrative trigger detection. Runs every frame, but
		// CampaignChatter.fire is one-shot per trigger so re-firing is a
		// no-op. Hazard flags latch to true the first frame the effect
		// activates and stay true through the rest of the flight.
		if (this.alien?.effectJustStarted) {
			this.flightHazardsFired.alien = true;
			this.campaignChatter.onAlienSpawn();
		}
		if (
			this.gravityStorm &&
			this.prevStormPhase === "normal" &&
			this.gravityStorm.phase === "high"
		) {
			this.flightHazardsFired.storm = true;
			this.campaignChatter.onStormStart();
		}
		if (this.gravityStorm) {
			this.prevStormPhase = this.gravityStorm.phase;
		}
		if (this.fuelLeakActive) {
			this.flightHazardsFired.fuelLeak = true;
		}
		if (this.lander.physicsVersion === 3) {
			const rate = Math.abs(this.lander.angularVel);
			if (rate > this.flightPeakAngularRate) {
				this.flightPeakAngularRate = rate;
			}
		}
		if (!result) {
			// Sprint 7.1 PR 1.5 — hidden-pad reveal latch. Fires a one-shot
			// dust plume on the frame the lander first crosses the reveal
			// AGL so the player sees the pad "appear out of the dust"
			// rather than pop in. Check runs only before the pad is
			// revealed so we emit exactly once per flight.
			if (!this.hiddenPadRevealed) {
				const hidden = findHiddenPad(this.terrain);
				if (
					hidden &&
					isHiddenPadRevealed(hidden, this.lander.x, this.lander.y)
				) {
					this.hiddenPadRevealed = true;
					this.particles_.emitDust(
						hidden.x + hidden.width / 2,
						hidden.y,
						hidden.width,
					);
				}
			}

			// Sprint 5 Part B — Apollo 13 "survive" mission terminates on
			// a time condition rather than a pad touch. Ran after physics
			// so any collision this frame takes precedence (a crash on the
			// final millisecond is still a crash).
			if (
				this.missionMode === "survive" &&
				this.activeMission &&
				isHistoricMission(this.activeMission) &&
				this.activeMission.kind === "survive"
			) {
				if (
					this.physics.flightElapsed >= this.activeMission.survivalDurationSec
				) {
					handleSurviveSuccess(this);
				} else if (this.physics.flightElapsed >= MAX_FLIGHT_DURATION) {
					handleSurviveTimeout(this);
				}
			}
			return;
		}
		// Sprint 7.2 — stash the spinning-crash flag so the result overlay
		// can show "LANDED SPINNING — STRUCTURAL FAILURE" instead of the
		// generic crash banner. Reset to false on landed results.
		this.lastSpinningCrash = result.crashed && result.spinningCrash;
		handleCollisionResult(
			this,
			result.landed,
			result.score,
			result.padY,
			result.padWidth,
			result.hiddenPad,
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
