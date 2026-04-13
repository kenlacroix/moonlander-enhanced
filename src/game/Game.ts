import { CanvasRenderer } from "../render/CanvasRenderer";
import { Audio } from "../systems/Audio";
import { GhostPlayer, GhostRecorder, loadGhostForSeed } from "../systems/GhostReplay";
import { type InputState, Input } from "../systems/Input";
import { addScore, getBestScore } from "../systems/Leaderboard";
import { TelemetryRecorder } from "../systems/Telemetry";
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
import { Camera } from "./Camera";
import { createLander, type LanderState, updateLander } from "./Lander";
import { getLanderType } from "./LanderTypes";
import { ParticleSystem } from "./Particles";
import { CAMPAIGN, type Mission, MISSIONS, isMissionUnlocked, loadCampaignProgress, saveCampaignProgress } from "./Missions";
import type { DifficultyConfig } from "./Terrain";
import { type WindState, createWind, getWindLabel, updateWind } from "./Wind";
import { checkCollision, getTerrainHeightAt, normAngle } from "./Physics";
import { generateTerrain, type TerrainData } from "./Terrain";

export type GameStatus = "title" | "menu" | "playing" | "landed" | "crashed";
type GameMode = "freeplay" | "campaign";

export class Game {
	private renderer: CanvasRenderer;
	private audio: Audio;
	private input: Input;
	private camera: Camera;
	private particles: ParticleSystem;
	private lander!: LanderState;
	private terrain!: TerrainData;
	private status: GameStatus = "title";
	private score = 0;
	private seed: number;
	private selectedMission = 0;
	private lastRank: number | null = null;
	private gameMode: GameMode = "freeplay";
	private activeMission: Mission | null = null;
	private campaignCompleted = loadCampaignProgress();
	private titleSelection = 0; // 0 = free play, 1 = campaign
	private lastTime = 0;
	private accumulator = 0;
	private firstFrame = true;
	private messageTimer = 0;
	private fuelWarningCooldown = 0;
	private audioInitialized = false;
	private ghostRecorder = new GhostRecorder();
	private ghostPlayer: GhostPlayer | null = null;
	private telemetry = new TelemetryRecorder();
	private wind: WindState | null = null;
	private flightElapsed = 0;
	private fuelLeakActive = false;
	private fuelLeakTriggered = false;

	constructor(canvas: HTMLCanvasElement) {
		this.renderer = new CanvasRenderer(canvas);
		this.audio = new Audio();
		this.input = new Input();
		this.camera = new Camera();
		this.particles = new ParticleSystem();
		this.seed = MISSIONS[0].seed;
		this.reset();
		this.status = "title"; // start on title screen
	}

	private reset(): void {
		const diff = this.activeMission?.difficulty;
		this.terrain = generateTerrain(this.seed, diff);
		// Spawn lander above center of the world
		const spawnX = WORLD_WIDTH / 2;
		const spawnY = diff?.spawnY ?? 80;
		const landerType = getLanderType(diff?.landerType);
		this.lander = createLander(spawnX, spawnY, landerType);
		if (diff?.startingFuel !== undefined) {
			this.lander.fuel = diff.startingFuel;
		}
		this.status = "playing";
		this.score = 0;
		this.particles.clear();
		this.camera = new Camera();
		this.firstFrame = true;
		this.messageTimer = 0;
		this.fuelWarningCooldown = 0;
		this.ghostRecorder.start(this.seed);
		this.telemetry.reset();
		this.flightElapsed = 0;
		this.fuelLeakActive = false;
		this.fuelLeakTriggered = false;
		const windStrength = diff?.windStrength ?? 0;
		this.wind = windStrength > 0 ? createWind(this.seed, windStrength) : null;
		const ghostRun = loadGhostForSeed(this.seed);
		this.ghostPlayer = ghostRun ? new GhostPlayer(ghostRun) : null;
	}

	start(): void {
		this.lastTime = performance.now();
		requestAnimationFrame((t) => this.loop(t));
	}

	private loop(time: number): void {
		// Delta time in seconds
		let dt = (time - this.lastTime) / 1000;
		this.lastTime = time;

		// Skip first frame (large delta from engine warmup)
		if (this.firstFrame) {
			this.firstFrame = false;
			dt = 0;
		}

		// Clamp to prevent physics explosion on tab refocus
		dt = Math.min(dt, MAX_DELTA);

		const inputState = this.input.getState();

		// Init audio on first keypress (browser autoplay policy)
		if (!this.audioInitialized && (inputState.thrustUp || inputState.rotateLeft || inputState.rotateRight || inputState.restart || inputState.menuSelect)) {
			this.audio.init();
			this.audioInitialized = true;
		}

		// Title screen (Free Play vs Campaign)
		if (this.status === "title") {
			if (inputState.menuUp || inputState.menuDown) {
				this.titleSelection = this.titleSelection === 0 ? 1 : 0;
			}
			if (inputState.menuSelect) {
				this.gameMode = this.titleSelection === 0 ? "freeplay" : "campaign";
				this.selectedMission = 0;
				this.status = "menu";
			}
			this.renderTitle();
			requestAnimationFrame((t) => this.loop(t));
			return;
		}

		// Mission select navigation
		if (this.status === "menu") {
			const missions = this.gameMode === "campaign" ? CAMPAIGN : MISSIONS;
			if (inputState.menuUp) {
				this.selectedMission = (this.selectedMission - 1 + missions.length) % missions.length;
			}
			if (inputState.menuDown) {
				this.selectedMission = (this.selectedMission + 1) % missions.length;
			}
			if (inputState.menuSelect) {
				const mission = missions[this.selectedMission];
				// In campaign, check if mission is unlocked
				if (this.gameMode === "campaign" && !isMissionUnlocked(mission.id, this.campaignCompleted)) {
					// Can't select locked mission — do nothing
				} else {
					this.activeMission = mission;
					this.seed = mission.seed;
					this.reset();
				}
			}
			if (inputState.menuBack) {
				this.status = "title";
			}
			this.renderMenu();
			requestAnimationFrame((t) => this.loop(t));
			return;
		}

		// Handle restart — go back to menu
		if (inputState.restart && this.status !== "playing") {
			// In campaign, advance to next mission on success
			if (this.gameMode === "campaign" && this.status === "landed" && this.activeMission) {
				const nextIdx = this.selectedMission + 1;
				if (nextIdx < CAMPAIGN.length) {
					this.selectedMission = nextIdx;
					this.activeMission = CAMPAIGN[nextIdx];
					this.seed = this.activeMission.seed;
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
			this.status = "menu";
			requestAnimationFrame((t) => this.loop(t));
			return;
		}

		// Fixed timestep physics — pass the already-read input state
		this.accumulator += dt;
		while (this.accumulator >= FIXED_TIMESTEP) {
			this.fixedUpdate(FIXED_TIMESTEP, inputState);
			this.accumulator -= FIXED_TIMESTEP;
		}

		// Record telemetry
		if (this.status === "playing") {
			const terrainY = getTerrainHeightAt(this.lander.x, this.terrain.points);
			const altitude = terrainY - (this.lander.y + LANDER_HEIGHT / 2);
			this.telemetry.update(dt, altitude, this.lander.vy, this.lander.vx, this.lander.fuel);
		}

		// Update particles with real dt for smooth visuals
		this.particles.update(dt);

		// Audio: thruster hum follows thrust state
		this.audio.setThruster(this.lander.thrusting && this.status === "playing");

		// Audio: low fuel warning
		if (this.lander.fuel > 0 && this.lander.fuel < STARTING_FUEL * 0.15 && this.status === "playing") {
			this.fuelWarningCooldown -= dt;
			if (this.fuelWarningCooldown <= 0) {
				this.audio.playFuelWarning();
				this.fuelWarningCooldown = 0.8;
			}
		}

		// Emit exhaust particles while thrusting
		if (this.lander.thrusting && this.status === "playing") {
			const rad = (this.lander.angle + 90) * (Math.PI / 180);
			const exhaustX = this.lander.x + Math.cos(rad) * 18;
			const exhaustY = this.lander.y + Math.sin(rad) * 18;
			this.particles.emitExhaust(exhaustX, exhaustY, this.lander.angle);
		}

		// Camera follows lander
		this.camera.follow(this.lander.x, this.lander.y, dt);

		// Track message display time
		if (this.status !== "playing") {
			this.messageTimer += dt;
		}

		this.render();

		requestAnimationFrame((t) => this.loop(t));
	}

	private fixedUpdate(dt: number, inputState: InputState): void {
		if (this.status !== "playing") return;

		// Step ghost replay alongside player physics
		this.ghostPlayer?.step();

		this.ghostRecorder.record(inputState);
		updateLander(this.lander, inputState, dt);

		// Apply wind
		this.flightElapsed += dt;
		if (this.wind) {
			updateWind(this.wind, this.flightElapsed);
			this.lander.vx += this.wind.speed * dt;
		}

		// Fuel leak random event — 10% chance, triggers after a few seconds
		if (!this.fuelLeakTriggered && this.flightElapsed > 5) {
			this.fuelLeakTriggered = true;
			// Deterministic "random" based on seed — no Math.random in physics
			this.fuelLeakActive = (this.seed % 10) === 7;
		}
		if (this.fuelLeakActive && this.lander.fuel > 0) {
			this.lander.fuel = Math.max(0, this.lander.fuel - FUEL_BURN_RATE * 0.3 * dt);
		}

		// Check collision
		const result = checkCollision(this.lander, this.terrain);
		if (result.collided) {
			if (result.safeLanding && result.onPad) {
				// Successful landing
				this.lander.status = "landed";
				this.lander.vy = 0;
				this.lander.vx = 0;
				this.lander.y = result.onPad.y - LANDER_HEIGHT / 2;
				this.status = "landed";
				this.score = this.calculateScore(result.onPad);
				this.particles.emitDust(
					this.lander.x,
					result.onPad.y,
					result.onPad.width,
				);
				this.audio.setThruster(false);
				this.audio.playSuccess();
				this.ghostRecorder.save(this.score);
				this.lastRank = addScore(this.seed, this.score);
				if (this.gameMode === "campaign" && this.activeMission) {
					this.campaignCompleted.add(this.activeMission.id);
					saveCampaignProgress(this.campaignCompleted);
				}
			} else {
				// Crash
				this.lander.status = "crashed";
				this.status = "crashed";
				this.particles.emitExplosion(this.lander.x, this.lander.y);
				this.camera.shake(15);
				this.audio.setThruster(false);
				this.audio.playCrash();
			}
		}
	}

	private calculateScore(pad: { points: number }): number {
		let score = 100 * pad.points;

		// Fuel bonus
		score += Math.floor(this.lander.fuel * SCORE_FUEL_MULTIPLIER);

		// Gentle landing bonus
		if (Math.abs(this.lander.vy) < MAX_LANDING_SPEED * 0.5) {
			score += SCORE_SPEED_BONUS;
		}

		// Angle bonus
		if (Math.abs(normAngle(this.lander.angle)) < MAX_LANDING_ANGLE * 0.5) {
			score += SCORE_ANGLE_BONUS;
		}

		return score;
	}

	private render(): void {
		const offset = this.camera.getOffset();

		this.renderer.clear();
		this.renderer.drawBackground(this.camera);
		this.renderer.drawTerrain(this.terrain, offset);
		this.renderer.drawParticles(this.particles.particles, offset);
		if (this.ghostPlayer?.isActive()) {
			this.renderer.drawGhost(this.ghostPlayer.lander, offset);
		}
		this.renderer.drawLander(this.lander, offset);
		const windLabel = this.wind ? getWindLabel(this.wind) : null;
		this.renderer.drawHUD(this.lander, this.score, windLabel, this.fuelLeakActive);

		// Touch controls overlay
		if (this.input.isTouchDevice) {
			this.renderer.drawTouchControls();
		}

		// Post-flight telemetry chart
		if (this.status !== "playing" && this.telemetry.frames.length > 2) {
			this.renderer.drawTelemetry(this.telemetry.frames);
		}

		// Status messages
		if (this.status === "landed") {
			const isTouch = this.input.isTouchDevice;
			const isCampaignNext = this.gameMode === "campaign" && this.selectedMission < CAMPAIGN.length - 1;
			const nextHint = isCampaignNext ? "next mission" : "mission select";
			const hint = isTouch ? "Tap top to continue" : `Press R for ${nextHint}`;
			const title = this.gameMode === "campaign" ? "MISSION COMPLETE" : "LANDING SUCCESSFUL";
			const rankText = this.lastRank === 1 ? "  NEW BEST!" : this.lastRank ? `  #${this.lastRank}` : "";
			this.renderer.drawMessage(
				title,
				`Score: ${this.score}${rankText}  |  ${hint}`,
			);
		} else if (this.status === "crashed") {
			const hint = this.input.isTouchDevice ? "Tap top to continue" : "Press R for mission select";
			this.renderer.drawMessage("CRASH", hint);
		}
	}

	private renderTitle(): void {
		this.renderer.clear();
		this.renderer.drawTitle(this.titleSelection, this.campaignCompleted.size, CAMPAIGN.length);
	}

	private renderMenu(): void {
		const missions = this.gameMode === "campaign" ? CAMPAIGN : MISSIONS;
		const bestScores = new Map<number, number>();
		for (const m of missions) {
			const best = getBestScore(m.seed);
			if (best !== undefined) bestScores.set(m.seed, best);
		}
		this.renderer.clear();
		this.renderer.drawMissionSelect(
			missions,
			this.selectedMission,
			bestScores,
			this.gameMode === "campaign" ? this.campaignCompleted : undefined,
		);
	}
}
