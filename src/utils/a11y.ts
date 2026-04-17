/**
 * Accessibility helpers. Browser-only; gracefully degrade when
 * window.matchMedia is unavailable (node tests, older browsers).
 */

let reducedMotionQuery: MediaQueryList | null = null;

/**
 * True when the user has requested reduced motion via OS setting
 * (System Preferences → Accessibility on macOS, Settings → Ease of
 * Access → Display on Windows, etc). Consumers should drop strobing /
 * flashing / large-motion effects in favor of a steady visual.
 *
 * Cached MediaQueryList so repeated calls in the render hot path don't
 * re-query. `.matches` itself is cheap.
 */
export function prefersReducedMotion(): boolean {
	if (typeof window === "undefined" || !window.matchMedia) return false;
	if (!reducedMotionQuery) {
		reducedMotionQuery = window.matchMedia(
			"(prefers-reduced-motion: reduce)",
		);
	}
	return reducedMotionQuery.matches;
}
