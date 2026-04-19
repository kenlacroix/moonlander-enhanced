import { Game } from "./game/Game";
import { createGameplayRenderer } from "./render/createGameplayRenderer";
import { fitCanvasToWindow } from "./render/fitCanvasToWindow";

const uiCanvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const glCanvas = document.getElementById(
	"game-canvas-gl",
) as HTMLCanvasElement;
if (!uiCanvas) {
	throw new Error("Canvas element #game-canvas not found");
}
if (!glCanvas) {
	throw new Error("Canvas element #game-canvas-gl not found");
}

// Check URL parameters
const params = new URLSearchParams(window.location.search);
const urlSeed = params.get("seed");
const embedMode = params.get("embed") === "1";
const customTerrain = params.get("custom");

// Renderer selection is async because PixiJS v8's Application.init is
// async. Gate Game construction on the result so the constructor
// receives a fully initialized renderer, no await-later surprises.
(async () => {
	const { gameplay, backend } = await createGameplayRenderer(
		glCanvas,
		uiCanvas,
	);
	if (backend === "canvas") {
		// Fallback path: the single Canvas 2D renderer (which happens to
		// be the `gameplay` here) draws everything, including UI. The
		// separate WebGL canvas isn't used — hide it.
		glCanvas.style.display = "none";
	}
	// Size both canvases identically (or just the UI canvas in fallback,
	// since the GL canvas is hidden). Single source of truth for sizing
	// prevents the two layers drifting out of alignment.
	const fitAll = () => {
		fitCanvasToWindow(uiCanvas);
		if (backend === "webgl") fitCanvasToWindow(glCanvas);
	};
	fitAll();
	window.addEventListener("resize", fitAll);
	const game = new Game(
		uiCanvas,
		gameplay,
		backend,
		urlSeed ? Number.parseInt(urlSeed, 10) : undefined,
		embedMode,
		customTerrain ?? undefined,
	);
	game.start();
})();
