import { CanvasRenderer } from "./CanvasRenderer";
import type { IGameplayRenderer } from "./IGameplayRenderer";
import { WebGLGameplayRenderer } from "./WebGLGameplayRenderer";

/**
 * Result of renderer selection. `backend` is reported so the HUD /
 * settings panel can surface which pipeline is active ("WEBGL" vs
 * "CANVAS fallback") and so Part B / C can toggle features that only
 * exist on the WebGL backend.
 */
export interface RendererSelection {
	gameplay: IGameplayRenderer;
	backend: "webgl" | "canvas";
}

/**
 * Select a gameplay renderer at startup. Tries WebGL first; on any
 * failure (WebGL context unavailable, driver reset, PixiJS init throws)
 * falls back to Canvas 2D so the game is always playable. The caller
 * is expected to pass two distinct canvases: `glCanvas` for the WebGL
 * backend, `canvasFallback` for the Canvas 2D backend. On fallback,
 * `glCanvas` is left untouched and should be hidden by the caller.
 *
 * `?renderer=canvas` URL parameter forces the Canvas 2D path. Useful
 * for debugging, for users on hardened configs where WebGL init
 * succeeds but later breaks, and for /qa parity checks.
 */
export async function createGameplayRenderer(
	glCanvas: HTMLCanvasElement,
	canvasFallback: HTMLCanvasElement,
): Promise<RendererSelection> {
	const params = new URLSearchParams(window.location.search);
	const forceCanvas = params.get("renderer") === "canvas";
	if (forceCanvas) {
		console.info("[renderer] Canvas 2D forced by ?renderer=canvas");
		return {
			gameplay: new CanvasRenderer(canvasFallback),
			backend: "canvas",
		};
	}

	// Cheap pre-flight: does the browser expose a WebGL context at all?
	// Avoids paying the PixiJS async init cost on browsers where WebGL
	// is disabled (Lynx, textmode, hardened configs).
	const probe = glCanvas.getContext("webgl2") ?? glCanvas.getContext("webgl");
	if (!probe) {
		console.warn("[renderer] WebGL unavailable — using Canvas 2D fallback");
		return {
			gameplay: new CanvasRenderer(canvasFallback),
			backend: "canvas",
		};
	}

	try {
		const gameplay = await WebGLGameplayRenderer.create(glCanvas);
		return { gameplay, backend: "webgl" };
	} catch (err) {
		console.warn(
			"[renderer] WebGL init failed, falling back to Canvas 2D:",
			err,
		);
		return {
			gameplay: new CanvasRenderer(canvasFallback),
			backend: "canvas",
		};
	}
}
