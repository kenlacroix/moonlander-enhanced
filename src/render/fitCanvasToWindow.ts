import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../utils/constants";

/**
 * Size a canvas element to the browser viewport while preserving the
 * game's fixed aspect ratio (1280x720). Separated from CanvasRenderer
 * because Sprint 6 Part A stacks two canvases (WebGL gameplay + Canvas
 * 2D UI) and both need the same CSS size or the UI drifts off the
 * gameplay layer.
 *
 * Before this helper lived here, only CanvasRenderer's constructor
 * called the equivalent logic, so the WebGL canvas kept its intrinsic
 * 1280x720 size while the UI canvas stretched to fill the window,
 * which produced visible stacking and shrank the effective gameplay
 * viewport.
 */
export function fitCanvasToWindow(canvas: HTMLCanvasElement): void {
	const aspect = CANVAS_WIDTH / CANVAS_HEIGHT;
	const windowAspect = window.innerWidth / window.innerHeight;
	// Sprint 7.5 Tier 1 — mobile viewport bug fix. The previous
	// implementation set ONE axis to "100vh"/"100vw" (CSS unit) while
	// computing the OTHER from `window.innerHeight`/`window.innerWidth`.
	// On iOS Safari those don't agree: `100vh` is the full viewport
	// including the URL bar's max-extent, while `window.innerHeight`
	// is the currently-visible viewport (URL bar may be showing or
	// collapsed). The mismatch produced wrong aspect ratio and
	// bottom-cutoff. Use direct pixel values from window.inner* on
	// both axes so both dimensions are computed from the same source.
	if (windowAspect > aspect) {
		// Phone landscape (wider than 16:9): fit to height, compute width
		canvas.style.height = `${window.innerHeight}px`;
		canvas.style.width = `${window.innerHeight * aspect}px`;
	} else {
		// Tall window (narrower than 16:9): fit to width, compute height
		canvas.style.width = `${window.innerWidth}px`;
		canvas.style.height = `${window.innerWidth / aspect}px`;
	}
}
