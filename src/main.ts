import { Game } from "./game/Game";
import { createGameplayRenderer } from "./render/createGameplayRenderer";
import { fitCanvasToWindow } from "./render/fitCanvasToWindow";
import { readShareConfigFromUrl } from "./utils/shareUrl";

const uiCanvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const glCanvas = document.getElementById("game-canvas-gl") as HTMLCanvasElement;
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
// Sprint 7.1 PR 1.5 — `?cfg=<base64url>` carries a full ShareConfig
// (seed + archetype + optional palette). Takes precedence over
// `?seed=` when both are present — the payload is the richer signal.
const shareConfig = readShareConfigFromUrl();

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
		shareConfig ?? undefined,
	);
	game.start();

	// Sprint 7.5 Tier 4 — auto-fullscreen on first touch. Chrome's URL
	// bar eats ~10-15% of phone landscape height even after collapse;
	// requesting Fullscreen API hides it entirely. Skip if:
	//   - not a touch device (desktop users don't expect fullscreen)
	//   - already in standalone display mode (PWA install — fullscreen
	//     already active via manifest "display": "fullscreen")
	//   - in embed mode (iframe context — fullscreen would break host)
	//
	// One-shot: arm a single touchend listener that requests fullscreen
	// on first user gesture (browsers require user activation for the
	// API), then removes itself. Subsequent flights stay fullscreen for
	// the session unless the user explicitly exits via system back.
	//
	// iOS Safari only supports fullscreen on <video> elements, not
	// arbitrary HTML — the call below is a silent no-op there. iOS users
	// get fullscreen via PWA install only.
	const isStandalone =
		window.matchMedia("(display-mode: standalone)").matches ||
		window.matchMedia("(display-mode: fullscreen)").matches;
	const isTouchDevice =
		"ontouchstart" in window || navigator.maxTouchPoints > 0;
	if (isTouchDevice && !isStandalone && !embedMode) {
		const tryFullscreen = () => {
			window.removeEventListener("touchend", tryFullscreen);
			window.removeEventListener("click", tryFullscreen);
			const el = document.documentElement as HTMLElement & {
				webkitRequestFullscreen?: () => Promise<void>;
			};
			if (el.requestFullscreen) {
				el.requestFullscreen().catch(() => {
					/* user denied / browser refused — silent fallback */
				});
			} else if (el.webkitRequestFullscreen) {
				try {
					el.webkitRequestFullscreen();
				} catch {
					/* webkit safari quirk */
				}
			}
		};
		window.addEventListener("touchend", tryFullscreen, { once: true });
		window.addEventListener("click", tryFullscreen, { once: true });
	}
})();
