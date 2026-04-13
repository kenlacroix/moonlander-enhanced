import type { LanderState } from "../game/Lander";
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
	): void {
		ctx.save();
		ctx.font = '14px "Courier New", monospace';
		ctx.textBaseline = "top";

		const x = 20;
		let y = 20;
		const lineHeight = 22;

		// Altitude (distance from bottom of screen — approximate)
		const altitude = Math.max(0, CANVAS_HEIGHT - lander.y - 100).toFixed(0);
		this.drawLabel(ctx, x, y, "ALT", `${altitude} m`);
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
		this.drawLabel(ctx, x, y, "FUEL", `${fuelPct}%`, fuelWarn);
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

		// Score (top right)
		if (score > 0) {
			ctx.fillStyle = COLOR_HUD;
			ctx.font = '20px "Courier New", monospace';
			ctx.textAlign = "right";
			ctx.fillText(`SCORE: ${score}`, CANVAS_WIDTH - 20, 20);
		}

		// Controls hint (bottom center)
		ctx.fillStyle = "rgba(0, 255, 136, 0.4)";
		ctx.font = '12px "Courier New", monospace';
		ctx.textAlign = "center";
		ctx.fillText(
			"↑ THRUST   ← → ROTATE   R RESTART",
			CANVAS_WIDTH / 2,
			CANVAS_HEIGHT - 20,
		);

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
