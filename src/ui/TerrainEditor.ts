/**
 * Terrain Editor — draw custom terrain with mouse/touch, place pads, share via URL.
 *
 * Control points are interpolated with Catmull-Rom splines to produce smooth terrain.
 * Terrain data serializes to a compact base64 URL parameter.
 */

import type { LandingPad, TerrainData } from "../game/Terrain";
import {
	CANVAS_HEIGHT,
	CANVAS_WIDTH,
	TERRAIN_MAX_HEIGHT,
	TERRAIN_MIN_HEIGHT,
	WORLD_WIDTH,
} from "../utils/constants";
import { type Vec2, vec2 } from "../utils/math";

interface ControlPoint {
	x: number; // 0-1 normalized
	y: number; // 0-1 normalized (0 = top, 1 = bottom of terrain range)
}

interface EditorPad {
	x: number; // 0-1 normalized center position
	width: number; // pixels
}

export interface EditorState {
	active: boolean;
	controlPoints: ControlPoint[];
	pads: EditorPad[];
	selectedPoint: number | null;
	placingPad: boolean;
	undoStack: ControlPoint[][];
}

const MIN_PAD_COUNT = 1;
const MAX_PAD_COUNT = 2;
const POINT_RADIUS = 8;
const TERRAIN_RESOLUTION = 257; // points in final terrain

export function createEditorState(): EditorState {
	// Start with a gentle default terrain (5 evenly spaced points)
	const defaults: ControlPoint[] = [
		{ x: 0, y: 0.5 },
		{ x: 0.25, y: 0.45 },
		{ x: 0.5, y: 0.55 },
		{ x: 0.75, y: 0.5 },
		{ x: 1, y: 0.5 },
	];
	return {
		active: true,
		controlPoints: defaults,
		pads: [{ x: 0.5, width: 80 }],
		selectedPoint: null,
		placingPad: false,
		undoStack: [defaults.map((p) => ({ ...p }))],
	};
}

/** Convert screen coordinates to normalized editor coordinates */
function screenToNorm(
	screenX: number,
	screenY: number,
): { x: number; y: number } {
	const minY = CANVAS_HEIGHT - TERRAIN_MAX_HEIGHT;
	const maxY = CANVAS_HEIGHT - TERRAIN_MIN_HEIGHT;
	return {
		x: Math.max(0, Math.min(1, screenX / CANVAS_WIDTH)),
		y: Math.max(0, Math.min(1, (screenY - minY) / (maxY - minY))),
	};
}

/** Convert normalized coordinates to screen coordinates */
function normToScreen(nx: number, ny: number): { sx: number; sy: number } {
	const minY = CANVAS_HEIGHT - TERRAIN_MAX_HEIGHT;
	const maxY = CANVAS_HEIGHT - TERRAIN_MIN_HEIGHT;
	return {
		sx: nx * CANVAS_WIDTH,
		sy: minY + ny * (maxY - minY),
	};
}

/** Handle mouse/touch click in editor */
export function editorClick(
	state: EditorState,
	screenX: number,
	screenY: number,
	isRightClick: boolean,
): void {
	const norm = screenToNorm(screenX, screenY);

	if (isRightClick) {
		// Right-click: delete nearest point (keep min 3)
		if (state.controlPoints.length > 3) {
			const idx = findNearestPoint(state, screenX, screenY);
			if (idx !== null && idx !== 0 && idx !== state.controlPoints.length - 1) {
				pushUndo(state);
				state.controlPoints.splice(idx, 1);
			}
		}
		return;
	}

	if (state.placingPad) {
		// Place a landing pad at click position
		if (state.pads.length < MAX_PAD_COUNT) {
			state.pads.push({ x: norm.x, width: 80 });
		}
		state.placingPad = false;
		return;
	}

	// Check if clicking near an existing point
	const nearIdx = findNearestPoint(state, screenX, screenY);
	if (nearIdx !== null) {
		state.selectedPoint = nearIdx;
		return;
	}

	// Add a new control point at click position
	pushUndo(state);
	state.controlPoints.push(norm);
	state.controlPoints.sort((a, b) => a.x - b.x);
}

/** Handle mouse drag in editor */
export function editorDrag(
	state: EditorState,
	screenX: number,
	screenY: number,
): void {
	if (state.selectedPoint === null) return;
	const norm = screenToNorm(screenX, screenY);
	const pt = state.controlPoints[state.selectedPoint];
	// Don't let user move first/last point horizontally
	if (
		state.selectedPoint === 0 ||
		state.selectedPoint === state.controlPoints.length - 1
	) {
		pt.y = norm.y;
	} else {
		pt.x = norm.x;
		pt.y = norm.y;
	}
}

/** Handle mouse release in editor */
export function editorRelease(state: EditorState): void {
	if (state.selectedPoint !== null) {
		pushUndo(state);
	}
	state.selectedPoint = null;
}

/** Undo last action */
export function editorUndo(state: EditorState): void {
	if (state.undoStack.length > 1) {
		state.undoStack.pop();
		const prev = state.undoStack[state.undoStack.length - 1];
		state.controlPoints = prev.map((p) => ({ ...p }));
	}
}

function pushUndo(state: EditorState): void {
	state.undoStack.push(state.controlPoints.map((p) => ({ ...p })));
	if (state.undoStack.length > 30) state.undoStack.shift();
}

function findNearestPoint(
	state: EditorState,
	screenX: number,
	screenY: number,
): number | null {
	let bestIdx: number | null = null;
	let bestDist = POINT_RADIUS * 2;
	for (let i = 0; i < state.controlPoints.length; i++) {
		const { sx, sy } = normToScreen(
			state.controlPoints[i].x,
			state.controlPoints[i].y,
		);
		const dx = screenX - sx;
		const dy = screenY - sy;
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist < bestDist) {
			bestDist = dist;
			bestIdx = i;
		}
	}
	return bestIdx;
}

/** Catmull-Rom spline interpolation between control points */
function catmullRom(
	p0: number,
	p1: number,
	p2: number,
	p3: number,
	t: number,
): number {
	const t2 = t * t;
	const t3 = t2 * t;
	return (
		0.5 *
		(2 * p1 +
			(-p0 + p2) * t +
			(2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
			(-p0 + 3 * p1 - 3 * p2 + p3) * t3)
	);
}

/** Generate TerrainData from editor control points */
export function buildTerrainFromEditor(state: EditorState): TerrainData {
	const pts = state.controlPoints;
	const minY = CANVAS_HEIGHT - TERRAIN_MAX_HEIGHT;
	const maxY = CANVAS_HEIGHT - TERRAIN_MIN_HEIGHT;
	const terrainRange = maxY - minY;

	// Interpolate control points to TERRAIN_RESOLUTION points using Catmull-Rom
	const points: Vec2[] = [];
	const step = WORLD_WIDTH / (TERRAIN_RESOLUTION - 1);

	for (let i = 0; i < TERRAIN_RESOLUTION; i++) {
		const nx = i / (TERRAIN_RESOLUTION - 1); // 0-1

		// Find the segment this x falls in
		let segIdx = 0;
		for (let j = 0; j < pts.length - 1; j++) {
			if (nx >= pts[j].x && nx <= pts[j + 1].x) {
				segIdx = j;
				break;
			}
			if (j === pts.length - 2) segIdx = j;
		}

		const p0 = pts[Math.max(0, segIdx - 1)];
		const p1 = pts[segIdx];
		const p2 = pts[Math.min(pts.length - 1, segIdx + 1)];
		const p3 = pts[Math.min(pts.length - 1, segIdx + 2)];

		const segLen = p2.x - p1.x;
		const t = segLen > 0 ? (nx - p1.x) / segLen : 0;

		const ny = catmullRom(p0.y, p1.y, p2.y, p3.y, Math.max(0, Math.min(1, t)));
		const worldY = minY + Math.max(0, Math.min(1, ny)) * terrainRange;
		points.push(vec2(i * step, worldY));
	}

	// Build pads from editor pad positions
	const pads: LandingPad[] = state.pads.map((ep) => {
		const padCenterX = ep.x * WORLD_WIDTH;
		const padX = padCenterX - ep.width / 2;
		const padRight = padCenterX + ep.width / 2;

		// Find average terrain height at pad position and flatten
		let sumY = 0;
		let count = 0;
		for (const p of points) {
			if (p.x >= padX && p.x <= padRight) {
				sumY += p.y;
				count++;
			}
		}
		const padY =
			count > 0 ? sumY / count : points[Math.floor(points.length / 2)].y;

		for (const p of points) {
			if (p.x >= padX && p.x <= padRight) {
				p.y = padY;
			}
		}

		return {
			x: padX,
			y: padY,
			width: ep.width,
			points: 2, // custom terrains always 2x score
		};
	});

	return { points, pads, seed: 0 };
}

/** Serialize editor state to compact base64 for URL sharing */
export function serializeEditor(state: EditorState): string {
	const data = {
		cp: state.controlPoints.map((p) => [
			Math.round(p.x * 1000) / 1000,
			Math.round(p.y * 1000) / 1000,
		]),
		pads: state.pads.map((p) => [Math.round(p.x * 1000) / 1000, p.width]),
	};
	return btoa(JSON.stringify(data));
}

/** Deserialize editor state from base64 URL parameter */
export function deserializeEditor(encoded: string): EditorState | null {
	try {
		const data = JSON.parse(atob(encoded));
		if (!data.cp || !Array.isArray(data.cp)) return null;
		const controlPoints: ControlPoint[] = data.cp.map(
			(p: [number, number]) => ({ x: p[0], y: p[1] }),
		);
		const pads: EditorPad[] = (data.pads ?? []).map((p: [number, number]) => ({
			x: p[0],
			width: p[1],
		}));
		if (pads.length === 0) pads.push({ x: 0.5, width: 80 });
		return {
			active: true,
			controlPoints,
			pads,
			selectedPoint: null,
			placingPad: false,
			undoStack: [controlPoints.map((p) => ({ ...p }))],
		};
	} catch {
		return null;
	}
}

/** Render the editor UI */
export function renderEditor(
	ctx: CanvasRenderingContext2D,
	state: EditorState,
): void {
	ctx.save();

	// Background
	ctx.fillStyle = "#0a0a1a";
	ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

	// Terrain range guidelines
	const minY = CANVAS_HEIGHT - TERRAIN_MAX_HEIGHT;
	const maxY = CANVAS_HEIGHT - TERRAIN_MIN_HEIGHT;
	ctx.strokeStyle = "rgba(0, 255, 136, 0.15)";
	ctx.setLineDash([5, 5]);
	ctx.beginPath();
	ctx.moveTo(0, minY);
	ctx.lineTo(CANVAS_WIDTH, minY);
	ctx.moveTo(0, maxY);
	ctx.lineTo(CANVAS_WIDTH, maxY);
	ctx.stroke();
	ctx.setLineDash([]);

	// Draw interpolated terrain preview
	const terrain = buildTerrainFromEditor(state);
	const scaleX = CANVAS_WIDTH / WORLD_WIDTH;
	ctx.beginPath();
	ctx.moveTo(0, CANVAS_HEIGHT);
	for (const p of terrain.points) {
		ctx.lineTo(p.x * scaleX, p.y);
	}
	ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT);
	ctx.closePath();
	ctx.fillStyle = "rgba(0, 255, 136, 0.1)";
	ctx.fill();
	ctx.strokeStyle = "#00ff88";
	ctx.lineWidth = 1.5;
	ctx.beginPath();
	for (let i = 0; i < terrain.points.length; i++) {
		const p = terrain.points[i];
		if (i === 0) ctx.moveTo(p.x * scaleX, p.y);
		else ctx.lineTo(p.x * scaleX, p.y);
	}
	ctx.stroke();

	// Draw landing pads
	for (const pad of terrain.pads) {
		ctx.fillStyle = "#00ff88";
		ctx.fillRect(pad.x * scaleX, pad.y - 2, pad.width * scaleX, 4);
		ctx.fillStyle = "rgba(0, 255, 136, 0.3)";
		ctx.font = '10px "Courier New", monospace';
		ctx.textAlign = "center";
		ctx.fillText("PAD", (pad.x + pad.width / 2) * scaleX, pad.y - 8);
	}

	// Draw control points
	for (let i = 0; i < state.controlPoints.length; i++) {
		const { sx, sy } = normToScreen(
			state.controlPoints[i].x,
			state.controlPoints[i].y,
		);
		const isSelected = i === state.selectedPoint;
		ctx.beginPath();
		ctx.arc(sx, sy, POINT_RADIUS, 0, Math.PI * 2);
		ctx.fillStyle = isSelected ? "#ffaa00" : "#00ff88";
		ctx.fill();
		ctx.strokeStyle = "#ffffff";
		ctx.lineWidth = 1;
		ctx.stroke();
	}

	// Title and instructions
	ctx.fillStyle = "#00ff88";
	ctx.font = 'bold 24px "Courier New", monospace';
	ctx.textAlign = "center";
	ctx.fillText("TERRAIN EDITOR", CANVAS_WIDTH / 2, 30);

	ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
	ctx.font = '12px "Courier New", monospace';
	ctx.fillText(
		"CLICK: add point   DRAG: move point   RIGHT-CLICK: delete   CTRL+Z: undo",
		CANVAS_WIDTH / 2,
		55,
	);
	ctx.fillText(
		`P: place pad (${state.pads.length}/${MAX_PAD_COUNT})   ENTER: play   ESC: back   S: share URL`,
		CANVAS_WIDTH / 2,
		72,
	);

	if (state.placingPad) {
		ctx.fillStyle = "#ffaa00";
		ctx.fillText("CLICK TO PLACE PAD", CANVAS_WIDTH / 2, 95);
	}

	ctx.restore();
}
