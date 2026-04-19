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
	if (windowAspect > aspect) {
		canvas.style.height = "100vh";
		canvas.style.width = `${window.innerHeight * aspect}px`;
	} else {
		canvas.style.width = "100vw";
		canvas.style.height = `${window.innerWidth / aspect}px`;
	}
}
