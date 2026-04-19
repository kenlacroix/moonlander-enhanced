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
 * Select a gameplay renderer at startup.
 *
 * **Default is Canvas 2D.** Sprint 6 Part A shipped a WebGL pipeline
 * (IGameplayRenderer + PixiJS v8 + auto-fallback), but in real-world
 * testing WebGL hits context-loss issues on tablets and other
 * browsers that cap concurrent WebGL contexts per tab — TF.js
 * grabbing a context for AI Training / AI Theater bumps PixiJS off.
 * Canvas has no such cap, and Part A's visual output is identical
 * to the WebGL path anyway (the "whoa" effects ship in Part B). So
 * Canvas is the shipped default until Part B's shader work lands and
 * we revisit the rollout story.
 *
 * Opt into WebGL per-session with `?renderer=webgl`. The factory
 * will try WebGL, and if PixiJS init or the WebGL context fail it
 * still falls back to Canvas so the game is always playable. The
 * WebGL canvas also self-handles `webglcontextlost` by reloading
 * into Canvas mode.
 *
 * `?renderer=canvas` is a no-op under the new default but kept for
 * explicitness and so saved share-URLs that carry it keep working.
 */
export async function createGameplayRenderer(
	glCanvas: HTMLCanvasElement,
	canvasFallback: HTMLCanvasElement,
): Promise<RendererSelection> {
	const params = new URLSearchParams(window.location.search);
	const optInWebGL = params.get("renderer") === "webgl";

	if (!optInWebGL) {
		// Default path — ship Canvas. Everything Part A does visually
		// is equivalent between backends. Part B's shaders will make
		// WebGL the headline.
		return {
			gameplay: new CanvasRenderer(canvasFallback),
			backend: "canvas",
		};
	}

	// Opt-in WebGL. Cheap pre-flight: does the browser expose a WebGL
	// context at all? Avoids paying the PixiJS async init cost on
	// browsers where WebGL is disabled (Lynx, textmode, hardened configs).
	const probe = glCanvas.getContext("webgl2") ?? glCanvas.getContext("webgl");
	if (!probe) {
		console.warn(
			"[renderer] ?renderer=webgl requested but WebGL unavailable — using Canvas 2D",
		);
		return {
			gameplay: new CanvasRenderer(canvasFallback),
			backend: "canvas",
		};
	}

	try {
		const gameplay = await WebGLGameplayRenderer.create(glCanvas);
		console.info("[renderer] WebGL enabled via ?renderer=webgl");
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
