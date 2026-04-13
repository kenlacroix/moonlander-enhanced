import { CANVAS_HEIGHT, CANVAS_WIDTH, WORLD_WIDTH } from "../utils/constants";
import { clamp, lerp } from "../utils/math";

export class Camera {
	x = 0;
	y = 0;
	targetX = 0;
	targetY = 0;
	shakeAmount = 0;
	shakeDecay = 0.9;

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
