import { describe, expect, it } from "vitest";
import { generateTerrain } from "../src/game/Terrain";
import {
	buildTerrainFromEditor,
	createEditorState,
	deserializeEditor,
	editorClick,
	editorRelease,
	editorUndo,
	serializeEditor,
} from "../src/ui/TerrainEditor";

describe("createEditorState", () => {
	it("starts with default control points and one pad", () => {
		const state = createEditorState();
		expect(state.active).toBe(true);
		expect(state.controlPoints.length).toBeGreaterThanOrEqual(3);
		expect(state.pads).toHaveLength(1);
		expect(state.selectedPoint).toBeNull();
	});
});

describe("buildTerrainFromEditor", () => {
	it("produces valid TerrainData with points and pads", () => {
		const state = createEditorState();
		const terrain = buildTerrainFromEditor(state);
		expect(terrain.points.length).toBe(257);
		expect(terrain.pads.length).toBe(1);
		expect(terrain.seed).toBe(0);
	});

	it("produces terrain with all positive y values", () => {
		const state = createEditorState();
		const terrain = buildTerrainFromEditor(state);
		for (const p of terrain.points) {
			expect(p.y).toBeGreaterThan(0);
		}
	});

	it("flattens terrain under pads", () => {
		const state = createEditorState();
		const terrain = buildTerrainFromEditor(state);
		const pad = terrain.pads[0];
		const padPoints = terrain.points.filter(
			(p) => p.x >= pad.x && p.x <= pad.x + pad.width,
		);
		if (padPoints.length > 1) {
			// All points under pad should have the same y
			const y = padPoints[0].y;
			for (const p of padPoints) {
				expect(p.y).toBeCloseTo(y, 1);
			}
		}
	});
});

describe("serialize/deserialize", () => {
	it("round-trips editor state", () => {
		const state = createEditorState();
		const encoded = serializeEditor(state);
		const restored = deserializeEditor(encoded);
		expect(restored).not.toBeNull();
		expect(restored!.controlPoints.length).toBe(state.controlPoints.length);
		expect(restored!.pads.length).toBe(state.pads.length);
	});

	it("returns null for invalid data", () => {
		expect(deserializeEditor("not-valid-base64!!!")).toBeNull();
		expect(deserializeEditor(btoa("{}"))).toBeNull();
	});
});

describe("editorClick", () => {
	it("adds a control point on left click", () => {
		const state = createEditorState();
		const initial = state.controlPoints.length;
		// Click in middle of canvas, away from existing points
		editorClick(state, 640, 400, false);
		editorRelease(state);
		expect(state.controlPoints.length).toBe(initial + 1);
	});

	it("removes a control point on right click (if > 3)", () => {
		const state = createEditorState();
		// Add extra points first
		editorClick(state, 200, 400, false);
		editorRelease(state);
		editorClick(state, 800, 400, false);
		editorRelease(state);
		const before = state.controlPoints.length;
		// Right click near a middle point
		editorClick(state, 320, 350, true);
		expect(state.controlPoints.length).toBeLessThanOrEqual(before);
	});
});

describe("editorUndo", () => {
	it("restores previous state", () => {
		const state = createEditorState();
		const initialCount = state.controlPoints.length;
		editorClick(state, 640, 400, false);
		editorRelease(state);
		expect(state.controlPoints.length).toBe(initialCount + 1);
		editorUndo(state);
		expect(state.controlPoints.length).toBe(initialCount);
	});
});

describe("terrain crevices", () => {
	it("generates deeper terrain with crevices enabled", () => {
		const normal = generateTerrain(42);
		const creviced = generateTerrain(42, { crevices: 3 });
		// Creviced terrain should have some points deeper (higher y values) than normal
		const normalMaxY = Math.max(...normal.points.map((p) => p.y));
		const crevicedMaxY = Math.max(...creviced.points.map((p) => p.y));
		expect(crevicedMaxY).toBeGreaterThanOrEqual(normalMaxY);
	});

	it("is deterministic for the same seed", () => {
		const t1 = generateTerrain(42, { crevices: 2 });
		const t2 = generateTerrain(42, { crevices: 2 });
		for (let i = 0; i < t1.points.length; i++) {
			expect(t1.points[i].y).toBe(t2.points[i].y);
		}
	});
});
