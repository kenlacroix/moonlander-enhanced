import { CANVAS_HEIGHT, CANVAS_WIDTH, WORLD_WIDTH } from "../utils/constants";
import { clamp, lerp } from "../utils/math";

export class Camera {
	x = 0;
	y = 0;
	targetX = 0;
	targetY = 0;
	shakeAmount = 0;
	shakeDecay = 0.9;
	/** Bright white flash triggered on crash. 1.0 = full white overlay,
	 * 0 = no flash. Decays each frame. Sprint 6 Part C cinematic touch:
	 * impact feels punchier when the screen briefly whites out. */
	flashAmount = 0;
	flashDecay = 0.88;

	/** Follow a target position with smooth interpolation */
	follow(targetX: number, targetY: number, dt: number): void {
		this.targetX = targetX - CANVAS_WIDTH / 2;
		this.targetY = targetY - CANVAS_HEIGHT / 2;

		// Smooth follow
		const smoothing = 1 - Math.exp(-3.0 * dt);
		this.x = lerp(this.x, this.targetX, smoothing);
		this.y = lerp(this.y, this.targetY, smoothing);

		// Clamp camera to world bounds
		this.x = clamp(this.x, 0, WORLD_WIDTH - CANVAS_WIDTH);
		this.y = clamp(this.y, -200, 200);
	}

	/** Add screen shake (e.g. on crash) */
	shake(amount: number): void {
		this.shakeAmount = amount;
	}

	/** Add impact flash (e.g. on crash). 0.6 is a readable full-screen
	 * whiteout that fades in ~8 frames. */
	flash(amount: number): void {
		this.flashAmount = amount;
	}

	/** Advance the flash decay. Called once per rendered frame. Separate
	 * from getOffset() so the flash runs during post-flight status when
	 * the camera no longer follows. */
	tickFlash(): void {
		if (this.flashAmount > 0.01) {
			this.flashAmount *= this.flashDecay;
		} else {
			this.flashAmount = 0;
		}
	}

	/** Get the current offset including shake */
	getOffset(): { x: number; y: number } {
		let sx = 0;
		let sy = 0;
		if (this.shakeAmount > 0.5) {
			sx = (Math.random() - 0.5) * this.shakeAmount;
			sy = (Math.random() - 0.5) * this.shakeAmount;
			this.shakeAmount *= this.shakeDecay;
		} else {
			this.shakeAmount = 0;
		}
		return { x: -this.x + sx, y: -this.y + sy };
	}
}
