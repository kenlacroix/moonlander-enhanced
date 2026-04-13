import { CanvasRenderer } from "../render/CanvasRenderer";
import { Input } from "../systems/Input";
import {
	FIXED_TIMESTEP,
	LANDER_HEIGHT,
	MAX_DELTA,
	MAX_LANDING_ANGLE,
	MAX_LANDING_SPEED,
	SCORE_ANGLE_BONUS,
	SCORE_FUEL_MULTIPLIER,
	SCORE_SPEED_BONUS,
	WORLD_WIDTH,
} from "../utils/constants";
import { Camera } from "./Camera";
import { createLander, type LanderState, updateLander } from "./Lander";
import { ParticleSystem } from "./Particles";
import { checkCollision, normAngle } from "./Physics";
import { generateTerrain, type TerrainData } from "./Terrain";

export type GameStatus = "playing" | "landed" | "crashed";

export class Game {
	private renderer: CanvasRenderer;
	private input: Input;
	private camera: Camera;
	private particles: ParticleSystem;
	private lander!: LanderState;
	private terrain!: TerrainData;
	private status: GameStatus = "playing";
	private score = 0;
	private seed: number;
	private lastTime = 0;
	private accumulator = 0;
	private firstFrame = true;
	private messageTimer = 0;

	constructor(canvas: HTMLCanvasElement) {
		this.renderer = new CanvasRenderer(canvas);
		this.input = new Input();
		this.camera = new Camera();
		this.particles = new ParticleSystem();
		this.seed = Date.now();
		this.reset();
	}

	private reset(): void {
		this.terrain = generateTerrain(this.seed);
		// Spawn lander above center of the world, high up
		const spawnX = WORLD_WIDTH / 2;
		const spawnY = 80;
		this.lander = createLander(spawnX, spawnY);
		this.status = "playing";
		this.score = 0;
		this.particles.clear();
		this.camera = new Camera();
		this.firstFrame = true;
		this.messageTimer = 0;
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

		// Handle restart
		if (inputState.restart && this.status !== "playing") {
			this.seed = Date.now();
			this.reset();
		}

		// Fixed timestep physics
		this.accumulator += dt;
		while (this.accumulator >= FIXED_TIMESTEP) {
			this.fixedUpdate(FIXED_TIMESTEP);
			this.accumulator -= FIXED_TIMESTEP;
		}

		// Update particles with real dt for smooth visuals
		this.particles.update(dt);

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

	private fixedUpdate(dt: number): void {
		if (this.status !== "playing") return;

		const inputState = this.input.getState();
		updateLander(this.lander, inputState, dt);

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
			} else {
				// Crash
				this.lander.status = "crashed";
				this.status = "crashed";
				this.particles.emitExplosion(this.lander.x, this.lander.y);
				this.camera.shake(15);
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
		this.renderer.drawLander(this.lander, offset);
		this.renderer.drawHUD(this.lander, this.score);

		// Status messages
		if (this.status === "landed") {
			this.renderer.drawMessage(
				"LANDING SUCCESSFUL",
				`Score: ${this.score}  |  Press R to fly again`,
			);
		} else if (this.status === "crashed") {
			this.renderer.drawMessage("CRASH", "Press R to try again");
		}
	}
}
