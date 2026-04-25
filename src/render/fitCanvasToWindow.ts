/**
 * Sprint 7.5 — no-op. Canvas sizing is now pure CSS via aspect-ratio
 * + max-w/h on `#game-stage` in index.html. The browser handles
 * viewport changes (orientation, iOS URL-bar collapse) without
 * JS coordination.
 *
 * Kept as an exported function so main.ts and any future caller can
 * keep importing it without breaking. If the call sites get cleaned
 * up later, this file can be deleted.
 */
export function fitCanvasToWindow(_canvas: HTMLCanvasElement): void {
	// No-op. CSS handles sizing now.
}
