import {
	CANVAS_HEIGHT,
	CANVAS_WIDTH,
	COLOR_EARTH,
	STAR_COUNT_LAYER_1,
	STAR_COUNT_LAYER_2,
	STAR_COUNT_LAYER_3,
	STAR_LAYER_1_SPEED,
	STAR_LAYER_2_SPEED,
	STAR_LAYER_3_SPEED,
} from "../utils/constants";
import { createRng } from "../utils/math";

interface Star {
	x: number;
	y: number;
	size: number;
	brightness: number;
}

interface StarLayer {
	stars: Star[];
	speed: number;
}

export class Background {
	private layers: StarLayer[] = [];

	constructor() {
		const rng = createRng(42); // fixed seed for consistent starfield
		this.layers = [
			this.generateLayer(STAR_COUNT_LAYER_1, STAR_LAYER_1_SPEED, 0.5, 1.5, rng),
			this.generateLayer(STAR_COUNT_LAYER_2, STAR_LAYER_2_SPEED, 1, 2, rng),
			this.generateLayer(STAR_COUNT_LAYER_3, STAR_LAYER_3_SPEED, 1.5, 3, rng),
		];
	}

	private generateLayer(
		count: number,
		speed: number,
		minSize: number,
		maxSize: number,
		rng: () => number,
	): StarLayer {
		const stars: Star[] = [];
		for (let i = 0; i < count; i++) {
			stars.push({
				x: rng() * CANVAS_WIDTH * 3, // wider than screen for parallax
				y: rng() * CANVAS_HEIGHT,
				size: minSize + rng() * (maxSize - minSize),
				brightness: 0.3 + rng() * 0.7,
			});
		}
		return { stars, speed };
	}

	draw(ctx: CanvasRenderingContext2D, cameraX: number): void {
		// Draw star layers with parallax
		for (const layer of this.layers) {
			for (const star of layer.stars) {
				const sx =
					((((star.x - cameraX * layer.speed) % (CANVAS_WIDTH * 3)) +
						CANVAS_WIDTH * 3) %
						(CANVAS_WIDTH * 3)) -
					CANVAS_WIDTH;
				if (sx < -10 || sx > CANVAS_WIDTH + 10) continue;

				ctx.globalAlpha = star.brightness;
				ctx.fillStyle = "#ffffff";
				ctx.beginPath();
				ctx.arc(sx, star.y, star.size / 2, 0, Math.PI * 2);
				ctx.fill();
			}
		}
		ctx.globalAlpha = 1;

		// Earth rise — semi-circle on upper-right horizon
		const earthX = CANVAS_WIDTH - 120 - cameraX * 0.008;
		const earthY = 60;
		const earthRadius = 50;

		ctx.save();
		// Glow
		const glow = ctx.createRadialGradient(
			earthX,
			earthY,
			earthRadius * 0.8,
			earthX,
			earthY,
			earthRadius * 1.5,
		);
		glow.addColorStop(0, "rgba(68, 136, 204, 0.15)");
		glow.addColorStop(1, "rgba(68, 136, 204, 0)");
		ctx.fillStyle = glow;
		ctx.beginPath();
		ctx.arc(earthX, earthY, earthRadius * 1.5, 0, Math.PI * 2);
		ctx.fill();

		// Earth body
		const earthGrad = ctx.createRadialGradient(
			earthX - 10,
			earthY - 10,
			5,
			earthX,
			earthY,
			earthRadius,
		);
		earthGrad.addColorStop(0, "#6699dd");
		earthGrad.addColorStop(0.5, COLOR_EARTH);
		earthGrad.addColorStop(1, "#224466");
		ctx.fillStyle = earthGrad;
		ctx.beginPath();
		ctx.arc(earthX, earthY, earthRadius, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	}
}
