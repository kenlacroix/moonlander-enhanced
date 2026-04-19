import type { AlienState } from "../game/Alien";
import type { Artifact } from "../game/Artifacts";
import type { Camera } from "../game/Camera";
import type { LanderState } from "../game/Lander";
import type { Particle } from "../game/Particles";
import type { TerrainData } from "../game/Terrain";

export interface Offset {
	x: number;
	y: number;
}

/**
 * Gameplay-only rendering surface. The split is deliberate: everything
 * that benefits from shaders (terrain, lander, particles, alien, ghost)
 * goes through this interface. Everything else (HUD text, menus,
 * briefings, flight analysis, etc.) stays on CanvasRenderer, since a
 * WebGL rewrite of text/layout code is pure cost for zero visual win.
 *
 * Sprint 6 Part A ships two implementations:
 *   CanvasRenderer (already implements this — the existing methods
 *     happen to match the shape, so the class just adds `implements`)
 *   WebGLGameplayRenderer (new, PixiJS v8)
 *
 * A factory picks one at startup. WebGL init failure falls back to
 * Canvas so the game is always playable.
 */
export interface IGameplayRenderer {
	/** The DOM canvas this renderer draws into. Exposed so the caller
	 * can size it, style it, or read context for retro-skin overlays. */
	readonly canvas: HTMLCanvasElement;

	clear(): void;
	drawBackground(camera: Camera): void;
	drawTerrain(terrain: TerrainData, offset: Offset): void;
	drawLander(lander: LanderState, offset: Offset): void;
	drawGhost(lander: LanderState, offset: Offset): void;
	drawParticles(particles: Particle[], offset: Offset): void;
	drawArtifacts(artifacts: Artifact[], offset: Offset): void;
	drawAlien(
		alien: AlienState,
		landerX: number,
		landerY: number,
		offset: Offset,
	): void;

	/** Commit the accumulated frame. Called at the end of every game
	 * frame after all draws complete. No-op on Canvas (draws are
	 * immediate); WebGL implementations use it to upload dirty
	 * textures and submit the frame to the GPU. */
	present(): void;

	/** Resize the drawing surface. No-op for fixed-resolution canvases;
	 * implementations that use DPR scaling or different backbuffers
	 * wire this up in Part B / C. */
	resize(width: number, height: number): void;

	/** Release GPU resources. Called on page unload or backend swap. */
	destroy(): void;
}
