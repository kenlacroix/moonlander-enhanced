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
import type { TerrainPalette } from "./palette";

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

	draw(
		ctx: CanvasRenderingContext2D,
		cameraX: number,
		sunAngleDeg?: number,
		palette?: Required<TerrainPalette>,
	): void {
		// Sprint 7.1 — palette-aware sky tint. Render behind everything
		// else, on top of the clear(). When palette is undefined, skip
		// (system default is already black from clear()); this keeps
		// freeplay output byte-identical to v0.6.0.0.
		if (palette && palette.sky !== "#000000") {
			ctx.fillStyle = palette.sky;
			ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
		}

		// Sprint 7.1 — palette-aware starfield tint + density.
		const starTint = palette?.starTint ?? "#ffffff";
		const densityMult = palette?.starDensity ?? 1.0;

		// Draw star layers with parallax. Density < 1 skips some stars;
		// density > 1 draws each star multiple times with offsets (so
		// polar missions can have more stars without needing more
		// stored star data).
		for (const layer of this.layers) {
			for (const star of layer.stars) {
				// Skip fraction for density < 1. Deterministic via
				// star.x (seeded at construction) so the same star
				// always renders or doesn't.
				if (densityMult < 1 && (star.x * 1000) % 1 > densityMult) {
					continue;
				}
				const sx =
					((((star.x - cameraX * layer.speed) % (CANVAS_WIDTH * 3)) +
						CANVAS_WIDTH * 3) %
						(CANVAS_WIDTH * 3)) -
					CANVAS_WIDTH;
				if (sx < -10 || sx > CANVAS_WIDTH + 10) continue;

				ctx.globalAlpha = star.brightness;
				ctx.fillStyle = starTint;
				ctx.beginPath();
				ctx.arc(sx, star.y, star.size / 2, 0, Math.PI * 2);
				ctx.fill();

				// Density > 1 draws additional offset ghosts of each
				// star to fake higher star count without restructuring.
				if (densityMult > 1.01) {
					const extras = Math.floor(densityMult - 1) + 1;
					for (let e = 0; e < extras; e++) {
						const extraX = sx + ((star.y * 37 * (e + 1)) % 40) - 20;
						const extraY =
							(star.y + ((star.x * 13 * (e + 1)) % 30) - 15 + CANVAS_HEIGHT) %
							CANVAS_HEIGHT;
						ctx.beginPath();
						ctx.arc(extraX, extraY, star.size / 2.5, 0, Math.PI * 2);
						ctx.fill();
					}
				}
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

		// Sprint 6 Part C — mission-specific sun. Lives on the left
		// half of the sky so it doesn't overlap Earth (which is fixed
		// top-right). Angle 0 = overhead-ish (top-center-left), angle
		// 90 = horizon (far left). Negative angles push further right
		// but stay clear of Earth's corner. Apollo 11 (20°) sits high-
		// left, Apollo 17 (65°) mid-left, Artemis III (85°) grazing
		// the left horizon for polar-morning feel, Luna 9 (-25°)
		// mirrors to the right of center. Subtle camera parallax
		// (0.005×) keeps the sun near-fixed while the lander scrolls.
		const angle = sunAngleDeg ?? 30;
		ctx.save();
		const rad = (angle * Math.PI) / 180;
		const sunX = CANVAS_WIDTH / 2 - Math.sin(rad) * 500 - cameraX * 0.005;
		const sunY = 90 + Math.abs(Math.sin(rad)) * 60;
		const sunRadius = 14;
		// Outer halo
		const halo = ctx.createRadialGradient(
			sunX,
			sunY,
			sunRadius * 0.7,
			sunX,
			sunY,
			sunRadius * 4,
		);
		halo.addColorStop(0, "rgba(255, 240, 200, 0.35)");
		halo.addColorStop(1, "rgba(255, 240, 200, 0)");
		ctx.fillStyle = halo;
		ctx.beginPath();
		ctx.arc(sunX, sunY, sunRadius * 4, 0, Math.PI * 2);
		ctx.fill();
		// Solid sun disc
		const disc = ctx.createRadialGradient(
			sunX - 2,
			sunY - 2,
			1,
			sunX,
			sunY,
			sunRadius,
		);
		disc.addColorStop(0, "#ffffff");
		disc.addColorStop(0.7, "#ffeec0");
		disc.addColorStop(1, "#ffcc66");
		ctx.fillStyle = disc;
		ctx.beginPath();
		ctx.arc(sunX, sunY, sunRadius, 0, Math.PI * 2);
		ctx.fill();
		ctx.restore();
	}
}
