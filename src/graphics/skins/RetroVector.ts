/**
 * Retro vector graphics skin — 1979 arcade aesthetic.
 * Green phosphor lines on black. No fills. Glow via shadowBlur.
 *
 * When active, overrides the canvas rendering style to use only
 * stroke operations with a single green color (#00ff44).
 */

const RETRO_GREEN = "#00ff44";
const RETRO_DIM = "#005511";
const PHOSPHOR_GLOW = 6;

export class RetroVectorSkin {
	active = false;

	toggle(): void {
		this.active = !this.active;
	}

	/** Apply retro style to canvas context before drawing */
	applyStyle(ctx: CanvasRenderingContext2D): void {
		if (!this.active) return;
		ctx.shadowColor = RETRO_GREEN;
		ctx.shadowBlur = PHOSPHOR_GLOW;
	}

	/** Get the primary color (replaces all colors when active) */
	getColor(): string {
		return RETRO_GREEN;
	}

	/** Get the dim color for less important elements */
	getDimColor(): string {
		return RETRO_DIM;
	}

	/** Draw scanline overlay effect */
	drawScanlines(
		ctx: CanvasRenderingContext2D,
		width: number,
		height: number,
	): void {
		if (!this.active) return;
		ctx.save();
		ctx.fillStyle = "rgba(0, 0, 0, 0.1)";
		for (let y = 0; y < height; y += 3) {
			ctx.fillRect(0, y, width, 1);
		}
		ctx.restore();
	}
}
