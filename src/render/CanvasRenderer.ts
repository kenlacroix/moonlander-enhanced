import type { Camera } from "../game/Camera";
import type { LanderState } from "../game/Lander";
import type { Particle } from "../game/Particles";
import type { LandingPad, TerrainData } from "../game/Terrain";
import {
	CANVAS_HEIGHT,
	CANVAS_WIDTH,
	COLOR_LANDER,
	COLOR_LANDER_ACCENT,
	COLOR_PAD,
	COLOR_PAD_BEACON,
	COLOR_TERRAIN,
	COLOR_TERRAIN_EDGE,
	LANDER_HEIGHT,
	LANDER_WIDTH,
} from "../utils/constants";
import { degToRad } from "../utils/math";
import { Background } from "./Background";
import { HUD } from "./HUD";

export class CanvasRenderer {
	private canvas: HTMLCanvasElement;
	private ctx: CanvasRenderingContext2D;
	private background: Background;
	private hud: HUD;
	private beaconPhase = 0;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		// Set canvas to fixed game resolution
		canvas.width = CANVAS_WIDTH;
		canvas.height = CANVAS_HEIGHT;

		// Scale CSS size to fit window while maintaining aspect ratio
		this.fitToWindow();
		window.addEventListener("resize", () => this.fitToWindow());

		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Canvas 2D context not available");
		this.ctx = ctx;

		this.background = new Background();
		this.hud = new HUD();
	}

	private fitToWindow(): void {
		const aspect = CANVAS_WIDTH / CANVAS_HEIGHT;
		const windowAspect = window.innerWidth / window.innerHeight;
		if (windowAspect > aspect) {
			this.canvas.style.height = "100vh";
			this.canvas.style.width = `${window.innerHeight * aspect}px`;
		} else {
			this.canvas.style.width = "100vw";
			this.canvas.style.height = `${window.innerWidth / aspect}px`;
		}
	}

	clear(): void {
		this.ctx.fillStyle = "#000000";
		this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
	}

	drawBackground(camera: Camera): void {
		this.background.draw(this.ctx, camera.x);
	}

	drawTerrain(terrain: TerrainData, offset: { x: number; y: number }): void {
		const ctx = this.ctx;
		const points = terrain.points;
		if (points.length < 2) return;

		ctx.save();
		ctx.translate(offset.x, offset.y);

		// Fill terrain polygon
		ctx.beginPath();
		ctx.moveTo(points[0].x, points[0].y);
		for (let i = 1; i < points.length; i++) {
			ctx.lineTo(points[i].x, points[i].y);
		}
		// Close along bottom
		ctx.lineTo(points[points.length - 1].x, CANVAS_HEIGHT + 200);
		ctx.lineTo(points[0].x, CANVAS_HEIGHT + 200);
		ctx.closePath();
		ctx.fillStyle = COLOR_TERRAIN;
		ctx.fill();

		// Terrain edge highlight
		ctx.beginPath();
		ctx.moveTo(points[0].x, points[0].y);
		for (let i = 1; i < points.length; i++) {
			ctx.lineTo(points[i].x, points[i].y);
		}
		ctx.strokeStyle = COLOR_TERRAIN_EDGE;
		ctx.lineWidth = 2;
		ctx.stroke();

		// Landing pads
		this.beaconPhase += 0.03;
		for (const pad of terrain.pads) {
			this.drawPad(ctx, pad);
		}

		ctx.restore();
	}

	private drawPad(ctx: CanvasRenderingContext2D, pad: LandingPad): void {
		// Pad surface
		ctx.fillStyle = COLOR_PAD;
		ctx.fillRect(pad.x, pad.y - 2, pad.width, 4);

		// Score marker
		ctx.fillStyle = COLOR_PAD;
		ctx.font = '12px "Courier New", monospace';
		ctx.textAlign = "center";
		ctx.fillText(`${pad.points}x`, pad.x + pad.width / 2, pad.y - 14);

		// Blinking beacons on pad edges
		const beaconOn = Math.sin(this.beaconPhase * 4) > 0;
		if (beaconOn) {
			ctx.fillStyle = COLOR_PAD_BEACON;
			ctx.shadowColor = COLOR_PAD_BEACON;
			ctx.shadowBlur = 10;
			ctx.beginPath();
			ctx.arc(pad.x + 4, pad.y - 2, 3, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.arc(pad.x + pad.width - 4, pad.y - 2, 3, 0, Math.PI * 2);
			ctx.fill();
			ctx.shadowBlur = 0;
		}
	}

	drawLander(lander: LanderState, offset: { x: number; y: number }): void {
		if (lander.status === "crashed") return;

		const ctx = this.ctx;
		ctx.save();
		ctx.translate(offset.x + lander.x, offset.y + lander.y);
		ctx.rotate(degToRad(lander.angle));

		const hw = LANDER_WIDTH / 2;
		const hh = LANDER_HEIGHT / 2;

		// Lander body — simple geometric shape
		ctx.fillStyle = COLOR_LANDER;
		ctx.beginPath();
		// Main body (trapezoid)
		ctx.moveTo(-hw * 0.6, -hh); // top left
		ctx.lineTo(hw * 0.6, -hh); // top right
		ctx.lineTo(hw, hh * 0.3); // mid right
		ctx.lineTo(hw * 0.8, hh * 0.6); // lower right
		ctx.lineTo(-hw * 0.8, hh * 0.6); // lower left
		ctx.lineTo(-hw, hh * 0.3); // mid left
		ctx.closePath();
		ctx.fill();

		// Accent stripe
		ctx.fillStyle = COLOR_LANDER_ACCENT;
		ctx.fillRect(-hw * 0.5, -hh * 0.3, hw, 3);

		// Legs
		ctx.strokeStyle = COLOR_LANDER;
		ctx.lineWidth = 2;
		// Left leg
		ctx.beginPath();
		ctx.moveTo(-hw * 0.6, hh * 0.6);
		ctx.lineTo(-hw * 1.0, hh);
		ctx.stroke();
		// Right leg
		ctx.beginPath();
		ctx.moveTo(hw * 0.6, hh * 0.6);
		ctx.lineTo(hw * 1.0, hh);
		ctx.stroke();
		// Foot pads
		ctx.fillStyle = COLOR_LANDER;
		ctx.fillRect(-hw * 1.15, hh - 2, hw * 0.3, 3);
		ctx.fillRect(hw * 0.85, hh - 2, hw * 0.3, 3);

		// Engine nozzle
		ctx.fillStyle = "#666666";
		ctx.beginPath();
		ctx.moveTo(-hw * 0.25, hh * 0.6);
		ctx.lineTo(hw * 0.25, hh * 0.6);
		ctx.lineTo(hw * 0.35, hh * 0.85);
		ctx.lineTo(-hw * 0.35, hh * 0.85);
		ctx.closePath();
		ctx.fill();

		// Thruster glow when thrusting
		if (lander.thrusting) {
			const glowGrad = ctx.createRadialGradient(0, hh, 2, 0, hh + 15, 20);
			glowGrad.addColorStop(0, "rgba(255, 102, 0, 0.8)");
			glowGrad.addColorStop(0.5, "rgba(255, 102, 0, 0.3)");
			glowGrad.addColorStop(1, "rgba(255, 102, 0, 0)");
			ctx.fillStyle = glowGrad;
			ctx.beginPath();
			ctx.arc(0, hh + 5, 20, 0, Math.PI * 2);
			ctx.fill();
		}

		ctx.restore();
	}

	drawParticles(particles: Particle[], offset: { x: number; y: number }): void {
		const ctx = this.ctx;
		ctx.save();
		ctx.translate(offset.x, offset.y);

		for (const p of particles) {
			ctx.globalAlpha = Math.max(0, p.life);
			ctx.fillStyle = p.color;

			if (p.type === "exhaust") {
				// Exhaust particles get a glow
				ctx.shadowColor = p.color;
				ctx.shadowBlur = 6;
			} else {
				ctx.shadowBlur = 0;
			}

			ctx.beginPath();
			ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
			ctx.fill();
		}

		ctx.globalAlpha = 1;
		ctx.shadowBlur = 0;
		ctx.restore();
	}

	drawHUD(lander: LanderState, score: number): void {
		this.hud.draw(this.ctx, lander, score);
	}

	drawMessage(text: string, subtitle?: string): void {
		const ctx = this.ctx;
		ctx.save();
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";

		// Main message
		ctx.fillStyle = "#ffffff";
		ctx.font = 'bold 36px "Courier New", monospace';
		ctx.fillText(text, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);

		// Subtitle
		if (subtitle) {
			ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
			ctx.font = '18px "Courier New", monospace';
			ctx.fillText(subtitle, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 25);
		}

		ctx.restore();
	}
}
