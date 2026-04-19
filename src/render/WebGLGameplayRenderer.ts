import { AdvancedBloomFilter } from "pixi-filters";
import { Application, Sprite, Texture } from "pixi.js";
import type { AlienState } from "../game/Alien";
import type { Artifact } from "../game/Artifacts";
import type { Camera } from "../game/Camera";
import type { LanderState } from "../game/Lander";
import type { Particle } from "../game/Particles";
import type { TerrainData } from "../game/Terrain";
import { CANVAS_HEIGHT, CANVAS_WIDTH } from "../utils/constants";
import { CanvasRenderer } from "./CanvasRenderer";
import type { IGameplayRenderer, Offset } from "./IGameplayRenderer";

/**
 * Sprint 6 Part A — WebGL gameplay renderer, texture-sprite approach.
 *
 * Why not native PixiJS primitives for every draw call? Part A's goal
 * is to ship the pipeline: WebGL context, IGameplayRenderer swap,
 * Canvas fallback, feature parity with the Canvas path. Reimplementing
 * every draw method in PixiJS Graphics is ~300 LOC of parallel logic
 * that drifts the moment CanvasRenderer changes. Zero visual delta at
 * this stage anyway.
 *
 * Instead: reuse CanvasRenderer's logic on an offscreen 2D canvas,
 * upload that canvas as a GPU texture on present(), and let PixiJS
 * blit it. Byte-identical visuals today. Part B layers shader filters
 * (bloom, heat distortion, normal maps) onto this same textured sprite.
 * Part C may migrate specific high-impact draws (lander, plume) to
 * native primitives once we know where the visual wins concentrate.
 *
 * Trade-off: one full-canvas texture upload per frame. At 1280×720
 * that's ~3.7 MB per frame, 220 MB/s at 60 Hz. Every consumer GPU in
 * the last decade handles that without breathing hard; the bottleneck
 * in this game is physics + Canvas 2D rasterization, not uploads.
 */
export class WebGLGameplayRenderer implements IGameplayRenderer {
	readonly canvas: HTMLCanvasElement;
	private offscreen: HTMLCanvasElement;
	private backing: CanvasRenderer;
	private app: Application;
	private sprite: Sprite;

	/**
	 * Private constructor — callers must use WebGLGameplayRenderer.create()
	 * because PixiJS v8's Application.init is async. Exposing the async
	 * factory instead of a constructor keeps the init failure mode
	 * (WebGL unavailable, context lost on init) in the factory's error
	 * path where the top-level caller can catch it and fall back.
	 */
	private constructor(
		canvas: HTMLCanvasElement,
		offscreen: HTMLCanvasElement,
		backing: CanvasRenderer,
		app: Application,
		sprite: Sprite,
	) {
		this.canvas = canvas;
		this.offscreen = offscreen;
		this.backing = backing;
		this.app = app;
		this.sprite = sprite;
	}

	static async create(
		canvas: HTMLCanvasElement,
	): Promise<WebGLGameplayRenderer> {
		const offscreen = document.createElement("canvas");
		offscreen.width = CANVAS_WIDTH;
		offscreen.height = CANVAS_HEIGHT;
		const backing = new CanvasRenderer(offscreen);

		const app = new Application();
		await app.init({
			canvas,
			width: CANVAS_WIDTH,
			height: CANVAS_HEIGHT,
			background: 0x000000,
			// We drive rendering from our own fixed-timestep game loop;
			// don't let PixiJS spin up a second ticker.
			autoStart: false,
			sharedTicker: false,
			// Match CanvasRenderer's pixelated aesthetic.
			roundPixels: true,
			antialias: false,
		});

		const texture = Texture.from(offscreen);
		const sprite = new Sprite(texture);
		sprite.width = CANVAS_WIDTH;
		sprite.height = CANVAS_HEIGHT;

		// Sprint 6 Part B — scene-wide bloom. The texture-sprite
		// pipeline lets us attach one filter to one sprite and have
		// every bright pixel in the rendered frame glow: pad beacons,
		// thruster exhaust, the lander's bright edges, and explosion
		// particles all light up for free.
		//
		// Threshold 0.5 means "only pixels brighter than mid-grey
		// bloom." Beacons (#00ff88) and thruster colors (bright
		// orange/yellow) sit well above the bar; the dark grey terrain
		// and black sky stay clean. Intensity 0.8 gives a visible
		// halo without washing the frame out. Bloom scale 1 keeps the
		// glow radius tight so bloom stays readable at gameplay speed.
		const bloom = new AdvancedBloomFilter({
			threshold: 0.5,
			bloomScale: 1.0,
			brightness: 1.0,
			blur: 8,
			quality: 4,
		});
		sprite.filters = [bloom];

		app.stage.addChild(sprite);

		// Paint the initial black background once so the canvas shows
		// something before any game frames run. Without this, the title
		// screen (which doesn't touch the gameplay layer) starts with a
		// blank/default-colored GL canvas peeking through the
		// transparent-cleared UI overlay.
		app.renderer.render(app.stage);

		// WebGL contexts can be lost at any time. Most commonly on
		// mobile/tablet browsers where the browser enforces a small
		// cap on concurrent contexts per tab, and TF.js grabbing a
		// second context can kick PixiJS off. When that happens, the
		// gameplay layer silently freezes on the last frame while the
		// UI canvas keeps drawing — confusing. Reload into the Canvas
		// 2D fallback path (?renderer=canvas) so the user gets a
		// working game on the same URL without a hard refresh.
		canvas.addEventListener(
			"webglcontextlost",
			(e) => {
				e.preventDefault();
				console.warn(
					"[renderer] WebGL context lost — reloading in Canvas 2D fallback mode",
				);
				const url = new URL(window.location.href);
				if (url.searchParams.get("renderer") !== "canvas") {
					url.searchParams.set("renderer", "canvas");
					window.location.replace(url.toString());
				}
			},
			{ once: true },
		);

		return new WebGLGameplayRenderer(
			canvas,
			offscreen,
			backing,
			app,
			sprite,
		);
	}

	clear(): void {
		this.backing.clear();
	}

	drawBackground(camera: Camera): void {
		this.backing.drawBackground(camera);
	}

	drawTerrain(terrain: TerrainData, offset: Offset): void {
		this.backing.drawTerrain(terrain, offset);
	}

	drawLander(lander: LanderState, offset: Offset): void {
		this.backing.drawLander(lander, offset);
	}

	drawGhost(lander: LanderState, offset: Offset): void {
		this.backing.drawGhost(lander, offset);
	}

	drawParticles(particles: Particle[], offset: Offset): void {
		this.backing.drawParticles(particles, offset);
	}

	drawArtifacts(artifacts: Artifact[], offset: Offset): void {
		this.backing.drawArtifacts(artifacts, offset);
	}

	drawAlien(
		alien: AlienState,
		landerX: number,
		landerY: number,
		offset: Offset,
	): void {
		this.backing.drawAlien(alien, landerX, landerY, offset);
	}

	present(): void {
		// Mark the texture source dirty so PixiJS re-uploads the offscreen
		// canvas to the GPU on the next render, then submit the frame.
		this.sprite.texture.source.update();
		this.app.renderer.render(this.app.stage);
	}

	resize(_width: number, _height: number): void {
		// Fixed-resolution — same reasoning as CanvasRenderer.
	}

	destroy(): void {
		this.app.destroy(true, { children: true, texture: true });
	}
}
