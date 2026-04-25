/**
 * Sprint 7.5 — shared mission-list geometry for the mission-select
 * screen. Used by both `CanvasRenderer.drawMissionSelect` (rendering)
 * and `StateHandlers.updateMenu` (tap hit-testing). Keeping both call
 * sites in lockstep means a tap always hits the row the player is
 * looking at — no hit-test drift.
 *
 * Touch devices get larger rows so each tap target meets the iOS
 * 44-CSS-pixel minimum at typical phone landscape scaling. At a
 * canvas display height of ~390 CSS px (iPhone 14 landscape), a
 * 75 canvas-px row scales to ~41 CSS px — close enough to 44 to be
 * comfortable, while still showing 8 missions at once.
 *
 * Desktop keeps the tighter 48-px rows so users with mice/keyboards
 * see all 10 free-play missions without scrolling.
 */
export function getMissionListGeometry(isTouch: boolean): {
	startY: number;
	lineHeight: number;
	visibleCount: number;
} {
	if (isTouch) {
		return {
			startY: 110,
			lineHeight: 75,
			visibleCount: 8,
		};
	}
	return {
		startY: 130,
		lineHeight: 48,
		visibleCount: 10,
	};
}

/**
 * Title screen geometry. Matches `CanvasRenderer.drawTitle`. 8 options;
 * touch needs ~50px+ rows to be comfortable. Title screen has no list-
 * scroll concept so all 8 must always fit.
 */
export function getTitleGeometry(isTouch: boolean): {
	rowSpacing: number;
	rowHeight: number;
	xMin: number;
	xMax: number;
	firstRowY: (canvasHeight: number, optionCount: number) => number;
} {
	const rowSpacing = isTouch ? 60 : 50;
	const rowHeight = isTouch ? 56 : 46;
	return {
		rowSpacing,
		rowHeight,
		xMin: 1280 / 2 - 220,
		xMax: 1280 / 2 + 220,
		firstRowY: (canvasHeight: number, optionCount: number) =>
			canvasHeight / 2 - 20 - ((optionCount - 5) * rowSpacing) / 2,
	};
}
