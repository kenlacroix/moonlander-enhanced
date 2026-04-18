import {
	type AuthenticState,
	captionFor,
	ERA_COLORS,
	isAltitudeBlackedOut,
} from "../game/AuthenticMode";
import type { LanderState } from "../game/Lander";
import type { TerrainData } from "../game/Terrain";
import { prefersReducedMotion } from "../utils/a11y";
import {
	CANVAS_HEIGHT,
	CANVAS_WIDTH,
	COLOR_HUD,
	COLOR_HUD_WARNING,
	MAX_LANDING_ANGLE,
	MAX_LANDING_SPEED,
	STARTING_FUEL,
} from "../utils/constants";

export class HUD {
	draw(
		ctx: CanvasRenderingContext2D,
		lander: LanderState,
		score: number,
		windLabel: string | null = null,
		fuelLeak = false,
		autopilot = false,
		adaptiveLabel: string | null = null,
		alienEffect: string | null = null,
		gravityStormLabel: string | null = null,
		elapsedTime: number | null = null,
		bestTime: number | null = null,
		authenticState: AuthenticState | null = null,
		terrain: TerrainData | null = null,
		isPlaying = true,
	): void {
		ctx.save();
		ctx.font = '14px "Courier New", monospace';
		ctx.textBaseline = "top";

		const x = 20;
		let y = 20;
		const lineHeight = 22;

		// Altitude (distance from bottom of screen — approximate).
		// Authentic (Apollo era only): readout blanks to "---" when lander is
		// within 50 pixels AGL, mirroring Armstrong losing callouts for the
		// last ~25 feet of descent. Display metric stays pixel-based; only
		// the BLACKOUT trigger uses true AGL via Physics.getTerrainHeightAt.
		const blackedOut = isAltitudeBlackedOut(authenticState, lander, terrain);
		if (blackedOut) {
			this.drawLabel(ctx, x, y, "ALT", "---");
			if (authenticState && !authenticState.lowAltMessage.shown) {
				authenticState.lowAltMessage.shown = true;
				authenticState.lowAltMessage.framesRemaining = 60;
			}
		} else {
			const altitude = Math.max(0, CANVAS_HEIGHT - lander.y - 100).toFixed(0);
			this.drawLabel(ctx, x, y, "ALT", `${altitude} m`);
		}
		y += lineHeight;

		// Vertical speed — warn if too fast
		const vyAbs = Math.abs(lander.vy).toFixed(1);
		const vyWarn = Math.abs(lander.vy) > MAX_LANDING_SPEED;
		this.drawLabel(
			ctx,
			x,
			y,
			"V-SPD",
			`${lander.vy >= 0 ? "+" : "-"}${vyAbs} m/s`,
			vyWarn,
		);
		y += lineHeight;

		// Horizontal speed
		const hSpeed = Math.abs(lander.vx).toFixed(1);
		const hWarn = Math.abs(lander.vx) > MAX_LANDING_SPEED;
		this.drawLabel(ctx, x, y, "H-SPD", `${hSpeed} m/s`, hWarn);
		y += lineHeight;

		// Angle — warn if too tilted
		const angle = lander.angle.toFixed(1);
		const angleWarn =
			Math.abs(lander.angle % 360) > MAX_LANDING_ANGLE &&
			Math.abs(lander.angle % 360) < 360 - MAX_LANDING_ANGLE;
		this.drawLabel(ctx, x, y, "ANGLE", `${angle}°`, angleWarn);
		y += lineHeight;

		// Fuel — warn if low
		const fuelPct = ((lander.fuel / STARTING_FUEL) * 100).toFixed(0);
		const fuelWarn = lander.fuel < STARTING_FUEL * 0.2;
		const fuelText = fuelLeak ? `${fuelPct}% LEAK!` : `${fuelPct}%`;
		this.drawLabel(ctx, x, y, "FUEL", fuelText, fuelWarn || fuelLeak);
		y += lineHeight;

		// Fuel bar
		const barWidth = 120;
		const barHeight = 8;
		const barX = x + 60;
		ctx.strokeStyle = COLOR_HUD;
		ctx.lineWidth = 1;
		ctx.strokeRect(barX, y, barWidth, barHeight);
		const fillWidth = (lander.fuel / STARTING_FUEL) * barWidth;
		ctx.fillStyle = fuelWarn ? COLOR_HUD_WARNING : COLOR_HUD;
		ctx.fillRect(barX, y, fillWidth, barHeight);

		// Wind indicator
		if (windLabel) {
			y += lineHeight;
			this.drawLabel(ctx, x, y, "WIND", windLabel);
		}

		// Autopilot indicator
		if (autopilot) {
			y += lineHeight;
			ctx.fillStyle = "#ffaa00";
			ctx.textAlign = "left";
			ctx.fillText("AUTO", x, y);
			ctx.fillStyle = "#ffaa00";
			ctx.fillText("ENGAGED  [P] off", x + 60, y);
		}

		// Alien effect warning
		if (alienEffect) {
			y += lineHeight;
			this.drawLabel(ctx, x, y, "ALIEN", alienEffect, true);
			// Override color to alien green
			ctx.fillStyle = "#88ffaa";
			ctx.fillText(alienEffect, x + 60, y);
		}

		// Gravity storm warning
		if (gravityStormLabel) {
			y += lineHeight;
			ctx.fillStyle = "#ff4444";
			ctx.textAlign = "left";
			ctx.fillText(gravityStormLabel, x, y);
		}

		// Score (top right)
		if (score > 0) {
			ctx.fillStyle = COLOR_HUD;
			ctx.font = '20px "Courier New", monospace';
			ctx.textAlign = "right";
			ctx.fillText(`SCORE: ${score}`, CANVAS_WIDTH - 20, 20);
		}

		// Timer (top right, below score). Flashes green when under best time.
		if (elapsedTime !== null) {
			const beatingBest = bestTime !== null && elapsedTime < bestTime;
			ctx.fillStyle = beatingBest ? "#00ff88" : "rgba(255, 255, 255, 0.7)";
			ctx.font = '14px "Courier New", monospace';
			ctx.textAlign = "right";
			const timerY = score > 0 ? 46 : 20;
			ctx.fillText(
				`TIME  ${formatTime(elapsedTime)}`,
				CANVAS_WIDTH - 20,
				timerY,
			);
			if (bestTime !== null) {
				ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
				ctx.font = '11px "Courier New", monospace';
				ctx.fillText(
					`BEST  ${formatTime(bestTime)}`,
					CANVAS_WIDTH - 20,
					timerY + 16,
				);
			}
		}

		// Adaptive difficulty label (top right, below score)
		if (adaptiveLabel && adaptiveLabel !== "NORMAL") {
			const labelColor =
				adaptiveLabel === "EASY"
					? "#44aaff"
					: adaptiveLabel === "HARD"
						? "#ffaa00"
						: "#ff4444";
			ctx.fillStyle = labelColor;
			ctx.font = '12px "Courier New", monospace';
			ctx.textAlign = "right";
			ctx.fillText(`DIFFICULTY: ${adaptiveLabel}`, CANVAS_WIDTH - 20, 44);
		}

		// Controls hint (bottom center)
		ctx.fillStyle = "rgba(0, 255, 136, 0.4)";
		ctx.font = '12px "Courier New", monospace';
		ctx.textAlign = "center";
		ctx.fillText(
			"↑ THRUST   ← → ROTATE   P AUTOPILOT   R RESTART   ESC MENU",
			CANVAS_WIDTH / 2,
			CANVAS_HEIGHT - 20,
		);

		// Authentic Mode overlays — suppressed on landed/crashed so they
		// don't stack on top of the post-flight result screen. Caption,
		// 1202 banner, and LOW-ALT message all gate on isPlaying.
		if (isPlaying) {
			// Authentic Mode caption (top center) — era-colored tech label.
			// While the 1202 alarm is ACTIVE, the caption is replaced with
			// the program-alarm banner. 12-frame half-cycle → 2.5 Hz full
			// cycle, comfortably below the WCAG 2.3.1 3-flashes/sec ceiling
			// (saturated-red flashing is the specific seizure concern).
			// prefers-reduced-motion: render steady amber, no strobing.
			const caption = captionFor(authenticState);
			if (caption) {
				if (authenticState?.alarm?.state === "ACTIVE") {
					const reduce = prefersReducedMotion();
					const flashRed =
						!reduce &&
						Math.floor(authenticState.alarm.framesElapsed / 12) % 2 === 0;
					ctx.fillStyle = flashRed
						? ERA_COLORS.HAZARD_RED
						: ERA_COLORS.APOLLO_AMBER;
					ctx.font = 'bold 14px "Courier New", monospace';
					ctx.textAlign = "center";
					ctx.fillText(
						"1202 PROGRAM ALARM — EXECUTIVE OVERFLOW",
						CANVAS_WIDTH / 2,
						12,
					);
				} else {
					ctx.fillStyle = caption.color;
					ctx.font = 'bold 13px "Courier New", monospace';
					ctx.textAlign = "center";
					ctx.fillText(caption.text, CANVAS_WIDTH / 2, 12);
				}
			}

			// One-shot message on first frame below AGL blackout threshold.
			// Drawn near the top-center, just below the AUTHENTIC caption,
			// so it doesn't collide with the left-column fuel bar.
			if (authenticState && authenticState.lowAltMessage.framesRemaining > 0) {
				authenticState.lowAltMessage.framesRemaining -= 1;
				ctx.fillStyle = ERA_COLORS.APOLLO_AMBER;
				ctx.font = 'bold 12px "Courier New", monospace';
				ctx.textAlign = "center";
				ctx.fillText(
					"LOW-ALT READOUT UNAVAILABLE (AUTHENTIC)",
					CANVAS_WIDTH / 2,
					32,
				);
			}
		}

		ctx.restore();
	}

	private drawLabel(
		ctx: CanvasRenderingContext2D,
		x: number,
		y: number,
		label: string,
		value: string,
		warn = false,
	): void {
		ctx.fillStyle = "rgba(0, 255, 136, 0.6)";
		ctx.textAlign = "left";
		ctx.fillText(label, x, y);
		ctx.fillStyle = warn ? COLOR_HUD_WARNING : COLOR_HUD;
		ctx.fillText(value, x + 60, y);
	}
}

function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = seconds - mins * 60;
	return `${mins}:${secs.toFixed(2).padStart(5, "0")}`;
}
