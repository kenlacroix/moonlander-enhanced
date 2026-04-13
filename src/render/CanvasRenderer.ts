import type { Camera } from "../game/Camera";
import type { LanderState } from "../game/Lander";
import type { Mission } from "../game/Missions";
import type { Particle } from "../game/Particles";
import type { LandingPad, TerrainData } from "../game/Terrain";
import type { TelemetryFrame } from "../systems/Telemetry";
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

		// Accent stripe — uses lander type color
		ctx.fillStyle = lander.landerType?.color ?? COLOR_LANDER_ACCENT;
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

	/** Draw a ghost lander (translucent replay of best run) */
	drawGhost(lander: LanderState, offset: { x: number; y: number }): void {
		const ctx = this.ctx;
		ctx.save();
		ctx.globalAlpha = 0.25;
		ctx.translate(offset.x + lander.x, offset.y + lander.y);
		ctx.rotate(degToRad(lander.angle));

		const hw = LANDER_WIDTH / 2;
		const hh = LANDER_HEIGHT / 2;

		// Ghost body — simple outline
		ctx.strokeStyle = "#44aaff";
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.moveTo(-hw * 0.6, -hh);
		ctx.lineTo(hw * 0.6, -hh);
		ctx.lineTo(hw, hh * 0.3);
		ctx.lineTo(hw * 0.8, hh * 0.6);
		ctx.lineTo(-hw * 0.8, hh * 0.6);
		ctx.lineTo(-hw, hh * 0.3);
		ctx.closePath();
		ctx.stroke();

		// Ghost legs
		ctx.beginPath();
		ctx.moveTo(-hw * 0.6, hh * 0.6);
		ctx.lineTo(-hw * 1.0, hh);
		ctx.moveTo(hw * 0.6, hh * 0.6);
		ctx.lineTo(hw * 1.0, hh);
		ctx.stroke();

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

	drawHUD(lander: LanderState, score: number, windLabel: string | null, fuelLeak = false, autopilot = false, adaptiveLabel: string | null = null): void {
		this.hud.draw(this.ctx, lander, score, windLabel, fuelLeak, autopilot, adaptiveLabel);
	}

	drawTitle(selection: number, completedCount: number, totalCampaign: number): void {
		const ctx = this.ctx;
		ctx.save();

		// Title
		ctx.fillStyle = "#00ff88";
		ctx.font = 'bold 48px "Courier New", monospace';
		ctx.textAlign = "center";
		ctx.fillText("MOONLANDER", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 120);

		ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
		ctx.font = '14px "Courier New", monospace';
		ctx.fillText("A LUNAR DESCENT SIMULATOR", CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 80);

		// Mode options
		const options = ["FREE PLAY", "CAMPAIGN", "AI TRAINING"];
		const descriptions = [
			"10 missions. Pick any. Beat your ghost.",
			`5 missions, escalating difficulty. ${completedCount}/${totalCampaign} complete.`,
			"Watch an AI learn to land from scratch.",
		];

		for (let i = 0; i < 3; i++) {
			const y = CANVAS_HEIGHT / 2 + i * 60;
			const isSelected = i === selection;

			if (isSelected) {
				ctx.fillStyle = "rgba(0, 255, 136, 0.1)";
				ctx.fillRect(CANVAS_WIDTH / 2 - 200, y - 18, 400, 50);
				ctx.strokeStyle = "#00ff88";
				ctx.lineWidth = 1;
				ctx.strokeRect(CANVAS_WIDTH / 2 - 200, y - 18, 400, 50);
			}

			ctx.fillStyle = isSelected ? "#00ff88" : "#666666";
			ctx.font = `bold 22px "Courier New", monospace`;
			ctx.textAlign = "center";
			ctx.fillText(options[i], CANVAS_WIDTH / 2, y + 8);

			ctx.fillStyle = isSelected ? "rgba(255, 255, 255, 0.5)" : "rgba(255, 255, 255, 0.25)";
			ctx.font = '13px "Courier New", monospace';
			ctx.fillText(descriptions[i], CANVAS_WIDTH / 2, y + 26);
		}

		// Controls
		ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
		ctx.font = '14px "Courier New", monospace';
		ctx.fillText("[UP/DOWN] Select    [ENTER] Start", CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30);

		ctx.restore();
	}

	drawMissionSelect(missions: Mission[], selectedIndex: number, bestScores: Map<number, number>, campaignProgress?: Set<number>): void {
		const ctx = this.ctx;
		ctx.save();

		// Title
		ctx.fillStyle = "#00ff88";
		ctx.font = 'bold 32px "Courier New", monospace';
		ctx.textAlign = "center";
		ctx.fillText("MOONLANDER", CANVAS_WIDTH / 2, 60);

		ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
		ctx.font = '14px "Courier New", monospace';
		ctx.fillText("SELECT MISSION", CANVAS_WIDTH / 2, 90);

		// Mission list
		const startY = 130;
		const lineHeight = 48;
		const visibleCount = Math.min(missions.length, 10);

		for (let i = 0; i < visibleCount; i++) {
			const m = missions[i];
			const y = startY + i * lineHeight;
			const isSelected = i === selectedIndex;

			// Campaign: check locked/completed
			const isLocked = campaignProgress !== undefined && m.id > 1 && !campaignProgress.has(m.id - 1);
			const isCompleted = campaignProgress?.has(m.id) ?? false;

			// Selection highlight
			if (isSelected && !isLocked) {
				ctx.fillStyle = "rgba(0, 255, 136, 0.1)";
				ctx.fillRect(CANVAS_WIDTH / 2 - 320, y - 14, 640, 40);

				ctx.strokeStyle = "#00ff88";
				ctx.lineWidth = 1;
				ctx.strokeRect(CANVAS_WIDTH / 2 - 320, y - 14, 640, 40);
			}

			// Status indicator for campaign
			ctx.textAlign = "left";
			if (campaignProgress !== undefined) {
				ctx.font = '14px "Courier New", monospace';
				if (isCompleted) {
					ctx.fillStyle = "#00ff88";
					ctx.fillText("[DONE]", CANVAS_WIDTH / 2 - 300, y + 6);
				} else if (isLocked) {
					ctx.fillStyle = "#444444";
					ctx.fillText("[LOCKED]", CANVAS_WIDTH / 2 - 300, y + 6);
				} else {
					ctx.fillStyle = "#ffaa00";
					ctx.fillText("[  >>  ]", CANVAS_WIDTH / 2 - 300, y + 6);
				}
			} else {
				ctx.fillStyle = isSelected ? "#00ff88" : "#888888";
				ctx.font = 'bold 16px "Courier New", monospace';
				ctx.fillText(`${String(m.id).padStart(2, "0")}`, CANVAS_WIDTH / 2 - 300, y + 6);
			}

			// Mission name
			const dimmed = isLocked;
			ctx.fillStyle = dimmed ? "#444444" : isSelected ? "#ffffff" : "#aaaaaa";
			ctx.font = `${isSelected && !isLocked ? "bold " : ""}16px "Courier New", monospace`;
			ctx.fillText(m.name, CANVAS_WIDTH / 2 - 220, y + 6);

			// Description
			ctx.fillStyle = dimmed ? "rgba(255, 255, 255, 0.15)" : isSelected ? "rgba(255, 255, 255, 0.6)" : "rgba(255, 255, 255, 0.3)";
			ctx.font = '12px "Courier New", monospace';
			ctx.fillText(isLocked ? "Complete previous mission to unlock" : m.description, CANVAS_WIDTH / 2 - 220, y + 22);

			// Best score
			const best = bestScores.get(m.seed);
			if (best !== undefined) {
				ctx.textAlign = "right";
				ctx.fillStyle = "#00ff88";
				ctx.font = '14px "Courier New", monospace';
				ctx.fillText(`BEST: ${best}`, CANVAS_WIDTH / 2 + 300, y + 6);
			}
		}

		// Controls hint
		ctx.textAlign = "center";
		ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
		ctx.font = '14px "Courier New", monospace';
		ctx.fillText("[UP/DOWN] Select    [ENTER] Launch    [ESC] Back to menu", CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30);

		ctx.restore();
	}

	/** Training mode UI with reward graph */
	drawTrainingUI(
		episode: number,
		epsilon: number,
		lastLanded: boolean,
		lastReward: number,
		rewardHistory: number[],
	): void {
		const ctx = this.ctx;
		ctx.save();

		// Title
		ctx.fillStyle = "#ffaa00";
		ctx.font = 'bold 28px "Courier New", monospace';
		ctx.textAlign = "center";
		ctx.fillText("AI TRAINING MODE", CANVAS_WIDTH / 2, 50);

		// Stats
		ctx.font = '16px "Courier New", monospace';
		ctx.textAlign = "left";
		const sx = 60;
		let sy = 100;
		const lh = 26;

		ctx.fillStyle = "#00ff88";
		ctx.fillText(`Episode:     ${episode}`, sx, sy); sy += lh;
		ctx.fillText(`Exploration: ${(epsilon * 100).toFixed(1)}%`, sx, sy); sy += lh;

		ctx.fillStyle = lastLanded ? "#00ff88" : "#ff4444";
		ctx.fillText(`Last result: ${lastLanded ? "LANDED" : "CRASHED"}`, sx, sy); sy += lh;

		ctx.fillStyle = "#ffffff";
		ctx.fillText(`Last reward: ${lastReward.toFixed(1)}`, sx, sy); sy += lh;

		// Moving average
		if (rewardHistory.length > 0) {
			const window = Math.min(20, rewardHistory.length);
			const recent = rewardHistory.slice(-window);
			const avg = recent.reduce((a, b) => a + b, 0) / window;
			ctx.fillStyle = avg > 0 ? "#00ff88" : "#ff4444";
			ctx.fillText(`Avg reward (${window}): ${avg.toFixed(1)}`, sx, sy);
		}

		// Reward graph
		if (rewardHistory.length > 1) {
			const graphX = 60;
			const graphY = 280;
			const graphW = CANVAS_WIDTH - 120;
			const graphH = 300;

			// Background
			ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
			ctx.fillRect(graphX, graphY, graphW, graphH);

			// Zero line
			const minR = Math.min(...rewardHistory, -10);
			const maxR = Math.max(...rewardHistory, 10);
			const range = maxR - minR || 1;
			const zeroY = graphY + graphH - ((0 - minR) / range) * graphH;
			ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
			ctx.lineWidth = 1;
			ctx.setLineDash([4, 4]);
			ctx.beginPath();
			ctx.moveTo(graphX, zeroY);
			ctx.lineTo(graphX + graphW, zeroY);
			ctx.stroke();
			ctx.setLineDash([]);

			// Reward line
			ctx.strokeStyle = "#00ff88";
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			const maxPoints = Math.min(rewardHistory.length, 500);
			const step = rewardHistory.length > maxPoints ? rewardHistory.length / maxPoints : 1;
			for (let i = 0; i < maxPoints; i++) {
				const idx = Math.floor(i * step);
				const rx = graphX + (i / maxPoints) * graphW;
				const ry = graphY + graphH - ((rewardHistory[idx] - minR) / range) * graphH;
				if (i === 0) ctx.moveTo(rx, ry);
				else ctx.lineTo(rx, ry);
			}
			ctx.stroke();

			// Moving average line (smoothed)
			if (rewardHistory.length > 20) {
				ctx.strokeStyle = "#ffaa00";
				ctx.lineWidth = 2;
				ctx.beginPath();
				const avgWindow = 20;
				for (let i = avgWindow; i < maxPoints; i++) {
					const idx = Math.floor(i * step);
					const startIdx = Math.max(0, idx - avgWindow);
					let sum = 0;
					for (let j = startIdx; j <= idx; j++) sum += rewardHistory[j];
					const avg = sum / (idx - startIdx + 1);
					const rx = graphX + (i / maxPoints) * graphW;
					const ry = graphY + graphH - ((avg - minR) / range) * graphH;
					if (i === avgWindow) ctx.moveTo(rx, ry);
					else ctx.lineTo(rx, ry);
				}
				ctx.stroke();
			}

			// Axis labels
			ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
			ctx.font = '10px "Courier New", monospace';
			ctx.textAlign = "right";
			ctx.fillText(`${maxR.toFixed(0)}`, graphX - 5, graphY + 12);
			ctx.fillText(`${minR.toFixed(0)}`, graphX - 5, graphY + graphH);
			ctx.textAlign = "center";
			ctx.fillText("Episodes", graphX + graphW / 2, graphY + graphH + 16);

			// Legend
			ctx.textAlign = "right";
			ctx.fillStyle = "#00ff88";
			ctx.fillText("raw", graphX + graphW, graphY - 8);
			ctx.fillStyle = "#ffaa00";
			ctx.fillText("avg ", graphX + graphW - 40, graphY - 8);
		}

		// Controls
		ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
		ctx.font = '14px "Courier New", monospace';
		ctx.textAlign = "center";
		ctx.fillText("[ENTER] Watch agent play    [ESC] Back to menu", CANVAS_WIDTH / 2, CANVAS_HEIGHT - 30);

		ctx.restore();
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

	/** Draw a mini telemetry chart (altitude over time) on the post-flight screen */
	drawTelemetry(frames: TelemetryFrame[]): void {
		if (frames.length < 2) return;

		const ctx = this.ctx;
		ctx.save();

		const chartX = CANVAS_WIDTH / 2 - 250;
		const chartY = CANVAS_HEIGHT / 2 + 60;
		const chartW = 500;
		const chartH = 100;

		// Background
		ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
		ctx.fillRect(chartX - 5, chartY - 5, chartW + 10, chartH + 25);

		// Find max altitude for scaling
		let maxAlt = 0;
		for (const f of frames) {
			if (f.altitude > maxAlt) maxAlt = f.altitude;
		}
		if (maxAlt < 10) maxAlt = 10;

		const maxTime = frames[frames.length - 1].time;
		if (maxTime <= 0) { ctx.restore(); return; }

		// Altitude line
		ctx.strokeStyle = "#00ff88";
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		for (let i = 0; i < frames.length; i++) {
			const fx = chartX + (frames[i].time / maxTime) * chartW;
			const fy = chartY + chartH - (frames[i].altitude / maxAlt) * chartH;
			if (i === 0) ctx.moveTo(fx, fy);
			else ctx.lineTo(fx, fy);
		}
		ctx.stroke();

		// Labels
		ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
		ctx.font = '10px "Courier New", monospace';
		ctx.textAlign = "left";
		ctx.fillText("ALT", chartX + 2, chartY + 12);
		ctx.textAlign = "right";
		ctx.fillText(`${Math.round(maxAlt)}`, chartX + chartW, chartY + 12);
		ctx.textAlign = "center";
		ctx.fillText(`${maxTime.toFixed(1)}s`, chartX + chartW / 2, chartY + chartH + 14);

		ctx.restore();
	}

	/** Draw semi-transparent touch control zones for mobile */
	drawTouchControls(): void {
		const ctx = this.ctx;
		ctx.save();
		ctx.globalAlpha = 0.15;

		const zoneH = CANVAS_HEIGHT * 0.35;
		const zoneY = CANVAS_HEIGHT - zoneH;
		const sideW = CANVAS_WIDTH * 0.3;
		const centerX = sideW;
		const centerW = CANVAS_WIDTH - sideW * 2;

		// Left rotate zone
		ctx.fillStyle = "#4488ff";
		ctx.fillRect(0, zoneY, sideW, zoneH);

		// Right rotate zone
		ctx.fillRect(CANVAS_WIDTH - sideW, zoneY, sideW, zoneH);

		// Thrust zone (center)
		ctx.fillStyle = "#ff6600";
		ctx.fillRect(centerX, zoneY, centerW, zoneH);

		// Labels
		ctx.globalAlpha = 0.4;
		ctx.fillStyle = "#ffffff";
		ctx.font = 'bold 18px "Courier New", monospace';
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText("< ROTATE", sideW / 2, zoneY + zoneH / 2);
		ctx.fillText("ROTATE >", CANVAS_WIDTH - sideW / 2, zoneY + zoneH / 2);
		ctx.fillText("THRUST", CANVAS_WIDTH / 2, zoneY + zoneH / 2);

		// Tap hint at top
		ctx.globalAlpha = 0.3;
		ctx.font = '14px "Courier New", monospace';
		ctx.fillText("TAP HERE TO RESTART", CANVAS_WIDTH / 2, 20);

		ctx.restore();
	}
}
