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
if (embedMode) {
	document.body.classList.add("embed");
}
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

	// Sprint 7.5 Tier 4 — explicit fullscreen toggle button for mobile.
	// Auto-request on first touch is unreliable (Chrome sometimes refuses
	// silently). A persistent button gives the user direct control AND
	// works in PWAs that aren't yet installed.
	//
	// Skip rendering when:
	//   - not a touch device (desktop has no URL bar issue)
	//   - already in standalone display mode (PWA install handles it)
	//   - embed mode (iframe — fullscreen would break the host)
	//
	// Layout: 44x44 button, top-left of viewport (safe area where the
	// canvas can't get tapped accidentally). DOM-rendered (not on canvas)
	// so it's tappable independent of game state.
	const isStandalone =
		window.matchMedia("(display-mode: standalone)").matches ||
		window.matchMedia("(display-mode: fullscreen)").matches;
	const isTouchDevice =
		"ontouchstart" in window || navigator.maxTouchPoints > 0;

	const requestFullscreen = (): void => {
		const el = document.documentElement as HTMLElement & {
			webkitRequestFullscreen?: () => Promise<void>;
		};
		if (el.requestFullscreen) {
			el.requestFullscreen().catch(() => {
				/* silently ignore */
			});
		} else if (el.webkitRequestFullscreen) {
			try {
				el.webkitRequestFullscreen();
			} catch {
				/* ignore */
			}
		}
	};

	if (isTouchDevice && !isStandalone && !embedMode) {
		// Try once on first touch (works on most Android Chrome paths)
		const tryFullscreen = (): void => {
			window.removeEventListener("touchend", tryFullscreen);
			window.removeEventListener("click", tryFullscreen);
			requestFullscreen();
		};
		window.addEventListener("touchend", tryFullscreen, { once: true });
		window.addEventListener("click", tryFullscreen, { once: true });

		// Always-visible fullscreen toggle button. Top-left, just inside
		// the safe area. Hides itself once fullscreen is active.
		const btn = document.createElement("button");
		btn.id = "fullscreen-btn";
		btn.setAttribute("aria-label", "Enter fullscreen");
		btn.textContent = "⛶";
		btn.style.cssText = `
			position: fixed;
			top: 8px;
			left: 8px;
			width: 44px;
			height: 44px;
			padding: 0;
			border: 2px solid rgba(0, 255, 136, 0.7);
			background: rgba(0, 0, 0, 0.7);
			color: #00ff88;
			font-family: monospace;
			font-size: 24px;
			line-height: 1;
			cursor: pointer;
			z-index: 100;
			border-radius: 6px;
			touch-action: manipulation;
			user-select: none;
			-webkit-user-select: none;
		`;
		btn.addEventListener("click", (e) => {
			e.stopPropagation();
			requestFullscreen();
		});
		btn.addEventListener("touchend", (e) => {
			e.preventDefault();
			e.stopPropagation();
			requestFullscreen();
		});
		document.body.appendChild(btn);

		// Hide the button once fullscreen is active so it doesn't clutter
		// the viewport. Show again if the user exits fullscreen.
		const updateBtnVisibility = (): void => {
			const fs =
				document.fullscreenElement ||
				(document as { webkitFullscreenElement?: Element })
					.webkitFullscreenElement;
			btn.style.display = fs ? "none" : "block";
		};
		document.addEventListener("fullscreenchange", updateBtnVisibility);
		document.addEventListener("webkitfullscreenchange", updateBtnVisibility);
	}
})();
