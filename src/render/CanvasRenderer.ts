import type { AlienState } from "../game/Alien";
import type { Artifact } from "../game/Artifacts";
import { type AuthenticState, ERA_COLORS } from "../game/AuthenticMode";
import type { Camera } from "../game/Camera";
import type { LanderState } from "../game/Lander";
import type { Mission } from "../game/Missions";
import type { Particle } from "../game/Particles";
import type { LandingPad, TerrainData } from "../game/Terrain";
import type { RetroVectorSkin } from "../graphics/skins/RetroVector";
import {
	STICK_CENTER,
	STICK_RADIUS,
	THRUST_CENTER,
	THRUST_RADIUS,
} from "../systems/Input";
import { getMissionListGeometry, getTitleGeometry } from "../utils/menuLayout";
import type { TelemetryFrame } from "../systems/Telemetry";
import {
	CANVAS_HEIGHT,
	CANVAS_WIDTH,
	COLOR_LANDER,
	COLOR_LANDER_ACCENT,
	COLOR_PAD,
	COLOR_PAD_BEACON,
	COLOR_TERRAIN,
	COLOR_TERRAIN_EDGE,
	LANDER_HEIGHT,
	LANDER_WIDTH,
} from "../utils/constants";
import { degToRad } from "../utils/math";
import { Background } from "./Background";
import { HUD } from "./HUD";
import type { IGameplayRenderer } from "./IGameplayRenderer";
import type { TerrainArchetype, TerrainPalette } from "./palette";

/** Sprint 7.1 — small unicode glyphs displayed next to mission names
 * on the mission-select screen so players can distinguish archetypes
 * at a glance. Colors match the archetype's default palette bias. */
const ARCHETYPE_GLYPHS: Record<
	TerrainArchetype,
	{ glyph: string; color: string; dimColor: string }
> = {
	rolling: { glyph: "○", color: "#9a9a9a", dimColor: "#555555" },
	"crater-field": { glyph: "●", color: "#c07058", dimColor: "#7a4a3a" },
	spires: { glyph: "▲", color: "#8a94a2", dimColor: "#5a6270" },
	mesa: { glyph: "■", color: "#c8b898", dimColor: "#a89878" },
	flats: { glyph: "≈", color: "#bbbbbb", dimColor: "#6a6a6a" },
};

/**
 * Canvas 2D renderer. Implements both the gameplay-layer interface
 * (IGameplayRenderer, so it can be swapped with WebGLGameplayRenderer)
 * and the UI-layer draw calls (drawHUD, drawTitle, drawMenu, etc. —
 * these stay Canvas-only forever since text/layout in WebGL is pure
 * cost for zero visual win).
 *
 * `transparentClear`: when WebGL is the active gameplay backend, this
 * renderer is used as the UI overlay. It must clear transparently so
 * the WebGL layer shows through underneath. When Canvas is the active
 * gameplay backend (WebGL fallback), this renderer does everything,
 * so clear() fills opaque black like before.
 */
export class CanvasRenderer implements IGameplayRenderer {
	readonly canvas: HTMLCanvasElement;
	readonly ctx: CanvasRenderingContext2D;
	private background: Background;
	private hud: HUD;
	private beaconPhase = 0;
	private retro: RetroVectorSkin | null = null;
	private transparentClear = false;

	constructor(canvas: HTMLCanvasElement) {
		this.canvas = canvas;
		// Set canvas to fixed game resolution
		canvas.width = CANVAS_WIDTH;
		canvas.height = CANVAS_HEIGHT;
		// CSS sizing lives in main.ts so both the UI canvas and the
		// WebGL canvas resize in lockstep. The offscreen canvas that
		// backs WebGLGameplayRenderer also goes through this
		// constructor but is never attached to the DOM, so sizing
		// there would be a no-op regardless.
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Canvas 2D context not available");
		this.ctx = ctx;

		this.background = new Background();
		this.hud = new HUD();
	}

	setTransparentClear(transparent: boolean): void {
		this.transparentClear = transparent;
	}

	present(): void {
		// Canvas 2D draws are immediate — there's no frame to commit.
	}

	resize(_width: number, _height: number): void {
		// Fixed-resolution canvas — resize is handled via CSS in fitToWindow.
		// Part C may use this to support DPR scaling.
	}

	destroy(): void {
		// Canvas 2D has no GPU resources to release.
	}

	setRetroSkin(skin: RetroVectorSkin | null): void {
		this.retro = skin;
	}

	clear(): void {
		if (this.transparentClear) {
			this.ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
		} else {
			this.ctx.fillStyle = "#000000";
			this.ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
		}
		// Apply scanline overlay in retro mode (always — the retro skin
		// intentionally overlays the scanlines across the final frame,
		// including when WebGL is drawing gameplay underneath).
		this.retro?.drawScanlines(this.ctx, CANVAS_WIDTH, CANVAS_HEIGHT);
	}

	drawBackground(
		camera: Camera,
		sunAngle?: number,
		palette?: Required<TerrainPalette>,
	): void {
		this.background.draw(this.ctx, camera.x, sunAngle, palette);
	}

	drawTerrain(
		terrain: TerrainData,
		offset: { x: number; y: number },
		palette?: Required<TerrainPalette>,
		hiddenPadRevealed = false,
	): void {
		const ctx = this.ctx;
		const points = terrain.points;
		if (points.length < 2) return;

		// Sprint 7.1 palette: fall back to system defaults when undefined
		// so freeplay missions with no palette still render as v0.6.0.0.
		const terrainColor = palette?.terrain ?? COLOR_TERRAIN;
		const terrainEdgeColor = palette?.terrainEdge ?? COLOR_TERRAIN_EDGE;

		ctx.save();
		ctx.translate(offset.x, offset.y);

		// Fill terrain polygon
		ctx.beginPath();
		ctx.moveTo(points[0].x, points[0].y);
		for (let i = 1; i < points.length; i++) {
			ctx.lineTo(points[i].x, points[i].y);
		}
		// Close along bottom
		ctx.lineTo(points[points.length - 1].x, CANVAS_HEIGHT + 200);
		ctx.lineTo(points[0].x, CANVAS_HEIGHT + 200);
		ctx.closePath();
		ctx.fillStyle = terrainColor;
		ctx.fill();

		// Terrain edge highlight
		ctx.beginPath();
		ctx.moveTo(points[0].x, points[0].y);
		for (let i = 1; i < points.length; i++) {
			ctx.lineTo(points[i].x, points[i].y);
		}
		ctx.strokeStyle = terrainEdgeColor;
		ctx.lineWidth = 2;
		ctx.stroke();

		// Landing pads
		this.beaconPhase += 0.03;
		for (const pad of terrain.pads) {
			if (pad.hidden && !hiddenPadRevealed) continue;
			this.drawPad(ctx, pad, palette?.accent);
		}

		ctx.restore();
	}

	private drawPad(
		ctx: CanvasRenderingContext2D,
		pad: LandingPad,
		accentOverride?: string,
	): void {
		// Sprint 7.1 PR 1.5 — hidden pads render in gold (base + beacon)
		// and at slightly stronger shadowBlur so post-reveal they read as
		// "different" at a glance from normal pads.
		const surfaceColor = pad.hidden ? "#c0b060" : COLOR_PAD;
		const beaconColor = pad.hidden
			? "#ffcc33"
			: (accentOverride ?? COLOR_PAD_BEACON);
		const beaconShadow = pad.hidden ? 12 : 10;
		const beaconPulseRate = pad.hidden ? 6 : 4;

		// Pad surface
		ctx.fillStyle = surfaceColor;
		ctx.fillRect(pad.x, pad.y - 2, pad.width, 4);

		// Score marker — hidden pads show the effective multiplier so
		// the 3× bonus is visible the moment the pad appears.
		ctx.fillStyle = surfaceColor;
		ctx.font = '12px "Courier New", monospace';
		ctx.textAlign = "center";
		const marker = pad.hidden ? "3x!" : `${pad.points}x`;
		ctx.fillText(marker, pad.x + pad.width / 2, pad.y - 14);

		// Blinking beacons on pad edges (palette-aware accent)
		const beaconOn = Math.sin(this.beaconPhase * beaconPulseRate) > 0;
		if (beaconOn) {
			ctx.fillStyle = beaconColor;
			ctx.shadowColor = beaconColor;
			ctx.shadowBlur = beaconShadow;
			ctx.beginPath();
			ctx.arc(pad.x + 4, pad.y - 2, 3, 0, Math.PI * 2);
			ctx.fill();
			ctx.beginPath();
			ctx.arc(pad.x + pad.width - 4, pad.y - 2, 3, 0, Math.PI * 2);
			ctx.fill();
			ctx.shadowBlur = 0;
		}
	}

	drawLander(lander: LanderState, offset: { x: number; y: number }): void {
		if (lander.status === "crashed") return;

		const ctx = this.ctx;
		ctx.save();
		ctx.translate(offset.x + lander.x, offset.y + lander.y);
		ctx.rotate(degToRad(lander.angle));

		const hw = LANDER_WIDTH / 2;
		const hh = LANDER_HEIGHT / 2;

		// Retro mode: green wireframe only
		if (this.retro) {
			this.retro.applyStyle(ctx);
			ctx.strokeStyle = this.retro.getColor();
			ctx.lineWidth = 1.5;
			// Body outline
			ctx.beginPath();
			ctx.moveTo(-hw * 0.6, -hh);
			ctx.lineTo(hw * 0.6, -hh);
			ctx.lineTo(hw, hh * 0.3);
			ctx.lineTo(hw * 0.8, hh * 0.6);
			ctx.lineTo(-hw * 0.8, hh * 0.6);
			ctx.lineTo(-hw, hh * 0.3);
			ctx.closePath();
			ctx.stroke();
			// Legs
			ctx.beginPath();
			ctx.moveTo(-hw * 0.6, hh * 0.6);
			ctx.lineTo(-hw * 1.0, hh);
			ctx.moveTo(hw * 0.6, hh * 0.6);
			ctx.lineTo(hw * 1.0, hh);
			ctx.stroke();
			// Thrust glow
			if (lander.thrusting) {
				ctx.strokeStyle = this.retro.getColor();
				ctx.beginPath();
				ctx.moveTo(-hw * 0.3, hh * 0.85);
				ctx.lineTo(0, hh + 15);
				ctx.lineTo(hw * 0.3, hh * 0.85);
				ctx.stroke();
			}
			ctx.restore();
			return;
		}

		// Lander body — simple geometric shape
		ctx.fillStyle = COLOR_LANDER;
		ctx.beginPath();
		// Main body (trapezoid)
		ctx.moveTo(-hw * 0.6, -hh); // top left
		ctx.lineTo(hw * 0.6, -hh); // top right
		ctx.lineTo(hw, hh * 0.3); // mid right
		ctx.lineTo(hw * 0.8, hh * 0.6); // lower right
		ctx.lineTo(-hw * 0.8, hh * 0.6); // lower left
		ctx.lineTo(-hw, hh * 0.3); // mid left
		ctx.closePath();
		ctx.fill();

		// Accent stripe — uses lander type color
		ctx.fillStyle = lander.landerType?.color ?? COLOR_LANDER_ACCENT;
		ctx.fillRect(-hw * 0.5, -hh * 0.3, hw, 3);

		// Legs
		ctx.strokeStyle = COLOR_LANDER;
		ctx.lineWidth = 2;
		// Left leg
		ctx.beginPath();
		ctx.moveTo(-hw * 0.6, hh * 0.6);
		ctx.lineTo(-hw * 1.0, hh);
		ctx.stroke();
		// Right leg
		ctx.beginPath();
		ctx.moveTo(hw * 0.6, hh * 0.6);
		ctx.lineTo(hw * 1.0, hh);
		ctx.stroke();
		// Foot pads
		ctx.fillStyle = COLOR_LANDER;
		ctx.fillRect(-hw * 1.15, hh - 2, hw * 0.3, 3);
		ctx.fillRect(hw * 0.85, hh - 2, hw * 0.3, 3);

		// Engine nozzle
		ctx.fillStyle = "#666666";
		ctx.beginPath();
		ctx.moveTo(-hw * 0.25, hh * 0.6);
		ctx.lineTo(hw * 0.25, hh * 0.6);
		ctx.lineTo(hw * 0.35, hh * 0.85);
		ctx.lineTo(-hw * 0.35, hh * 0.85);
		ctx.closePath();
		ctx.fill();

		// Thruster glow when thrusting
		if (lander.thrusting) {
			const glowGrad = ctx.createRadialGradient(0, hh, 2, 0, hh + 15, 20);
			glowGrad.addColorStop(0, "rgba(255, 102, 0, 0.8)");
			glowGrad.addColorStop(0.5, "rgba(255, 102, 0, 0.3)");
			glowGrad.addColorStop(1, "rgba(255, 102, 0, 0)");
			ctx.fillStyle = glowGrad;
			ctx.beginPath();
			ctx.arc(0, hh + 5, 20, 0, Math.PI * 2);
			ctx.fill();
		}

		ctx.restore();
	}

	/** Draw artifacts on terrain */
	drawArtifacts(artifacts: Artifact[], offset: { x: number; y: number }): void {
		const ctx = this.ctx;
		ctx.save();
		ctx.translate(offset.x, offset.y);

		for (const art of artifacts) {
			const x = art.x;
			const y = art.y;

			// Reset shadow state at top of each iteration to prevent leaking
			ctx.shadowColor = "transparent";
			ctx.shadowBlur = 0;

			if (art.scanned) {
				// Scanned: show a dim marker
				ctx.fillStyle = "rgba(0, 255, 136, 0.3)";
				ctx.font = '10px "Courier New", monospace';
				ctx.textAlign = "center";
				ctx.fillText("[SCANNED]", x, y - 20);
			} else {
				// Unscanned: glowing marker
				ctx.shadowColor = "#ffaa00";
				ctx.shadowBlur = 8;
			}

			// Draw artifact icon based on type
			ctx.fillStyle = art.scanned ? "#444444" : "#ffaa00";
			ctx.strokeStyle = art.scanned ? "#444444" : "#ffaa00";
			ctx.lineWidth = 1.5;

			switch (art.type) {
				case "flag":
					// Flag pole + rectangle
					ctx.beginPath();
					ctx.moveTo(x, y);
					ctx.lineTo(x, y - 18);
					ctx.stroke();
					ctx.fillRect(x, y - 18, 10, 7);
					break;
				case "rover-tracks":
					// Two parallel dashed lines
					ctx.setLineDash([3, 2]);
					ctx.beginPath();
					ctx.moveTo(x - 12, y - 2);
					ctx.lineTo(x + 12, y - 2);
					ctx.moveTo(x - 12, y - 5);
					ctx.lineTo(x + 12, y - 5);
					ctx.stroke();
					ctx.setLineDash([]);
					break;
				case "debris":
					// Angular debris shape
					ctx.beginPath();
					ctx.moveTo(x - 8, y);
					ctx.lineTo(x - 3, y - 10);
					ctx.lineTo(x + 5, y - 8);
					ctx.lineTo(x + 8, y - 2);
					ctx.lineTo(x + 2, y);
					ctx.closePath();
					ctx.stroke();
					break;
				case "footprints":
					// Two small ovals
					ctx.beginPath();
					ctx.ellipse(x - 4, y - 3, 3, 5, -0.2, 0, Math.PI * 2);
					ctx.fill();
					ctx.beginPath();
					ctx.ellipse(x + 5, y - 5, 3, 5, 0.2, 0, Math.PI * 2);
					ctx.fill();
					break;
				case "plaque":
					// Small rectangle with cross
					ctx.strokeRect(x - 6, y - 10, 12, 8);
					ctx.beginPath();
					ctx.moveTo(x, y - 10);
					ctx.lineTo(x, y - 2);
					ctx.moveTo(x - 6, y - 6);
					ctx.lineTo(x + 6, y - 6);
					ctx.stroke();
					break;
			}

			// Label below (no glow on label text)
			if (!art.scanned) {
				ctx.shadowBlur = 0;
				ctx.fillStyle = "rgba(255, 170, 0, 0.6)";
				ctx.font = '9px "Courier New", monospace';
				ctx.textAlign = "center";
				ctx.fillText(art.label, x, y + 14);
			}
		}

		ctx.restore();
	}

	/** Draw a ghost lander (translucent replay of best run) */
	drawGhost(lander: LanderState, offset: { x: number; y: number }): void {
		const ctx = this.ctx;
		ctx.save();
		ctx.globalAlpha = 0.25;
		ctx.translate(offset.x + lander.x, offset.y + lander.y);
		ctx.rotate(degToRad(lander.angle));

		const hw = LANDER_WIDTH / 2;
		const hh = LANDER_HEIGHT / 2;

		// Ghost body — simple outline
		ctx.strokeStyle = "#44aaff";
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.moveTo(-hw * 0.6, -hh);
		ctx.lineTo(hw * 0.6, -hh);
		ctx.lineTo(hw, hh * 0.3);
		ctx.lineTo(hw * 0.8, hh * 0.6);
		ctx.lineTo(-hw * 0.8, hh * 0.6);
		ctx.lineTo(-hw, hh * 0.3);
		ctx.closePath();
		ctx.stroke();

		// Ghost legs
		ctx.beginPath();
		ctx.moveTo(-hw * 0.6, hh * 0.6);
		ctx.lineTo(-hw * 1.0, hh);
		ctx.moveTo(hw * 0.6, hh * 0.6);
		ctx.lineTo(hw * 1.0, hh);
		ctx.stroke();

		ctx.restore();
	}

	drawParticles(particles: Particle[], offset: { x: number; y: number }): void {
		const ctx = this.ctx;
		ctx.save();
		ctx.translate(offset.x, offset.y);

		for (const p of particles) {
			ctx.globalAlpha = Math.max(0, p.life);
			ctx.fillStyle = p.color;

			if (p.type === "exhaust") {
				// Exhaust particles get a glow
				ctx.shadowColor = p.color;
				ctx.shadowBlur = 6;
			} else {
				ctx.shadowBlur = 0;
			}

			ctx.beginPath();
			ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
			ctx.fill();
		}

		ctx.globalAlpha = 1;
		ctx.shadowBlur = 0;
		ctx.restore();
	}

	drawHUD(
		lander: LanderState,
		score: number,
		windLabel: string | null,
		fuelLeak = false,
		autopilot = false,
		adaptiveLabel: string | null = null,
		alienEffect: string | null = null,
		gravityStormLabel: string | null = null,
		elapsedTime: number | null = null,
		bestTime: number | null = null,
		authenticState: AuthenticState | null = null,
		terrain: TerrainData | null = null,
		isPlaying = true,
		rcsTutorialFramesRemaining = 0,
		isTouch = false,
	): void {
		this.hud.draw(
			this.ctx,
			lander,
			score,
			windLabel,
			fuelLeak,
			autopilot,
			adaptiveLabel,
			alienEffect,
			gravityStormLabel,
			elapsedTime,
			bestTime,
			authenticState,
			terrain,
			isPlaying,
			rcsTutorialFramesRemaining,
			isTouch,
		);
	}

	drawTitle(
		selection: number,
		completedCount: number,
		totalCampaign: number,
		dailyDateLabel: string,
		dailyBestScore: number | undefined,
		isTouch = false,
	): void {
		const ctx = this.ctx;
		ctx.save();
		// Sprint 7.5 Tier 4 — touch devices get 1.45x font scaling on
		// title screen so option names + descriptions are legible at
		// phone-landscape canvas downscale. Helper mirrors HUD.ts pattern.
		const fMul = isTouch ? 1.45 : 1;
		const tf = (px: number, bold = false): string =>
			`${bold ? "bold " : ""}${Math.round(px * fMul)}px "Courier New", monospace`;

		// Mode options
		const dailyBestLabel = dailyBestScore ? `  Best: ${dailyBestScore}` : "";
		const options = [
			"FREE PLAY",
			"CAMPAIGN",
			"AI TRAINING",
			"AI THEATER",
			"EDITOR",
			"DAILY CHALLENGE",
			"HISTORIC MISSIONS",
			"RANDOM MISSION",
		];

		// Title + subtitle position scale up with row count so the FREE
		// PLAY box always has ~28 px of breathing room under the
		// subtitle baseline. Sprint 7.1 added the 8th row (RANDOM
		// MISSION) and the fixed title y started clipping into the
		// first selection box; anchoring titles relative to firstRowY
		// keeps the layout stable as options grow.
		ctx.fillStyle = "#00ff88";
		ctx.font = tf(48, true);
		ctx.textAlign = "center";
		const extraRows = Math.max(0, options.length - 5);
		const titleY = CANVAS_HEIGHT / 2 - 120 - (extraRows * 50) / 2;
		ctx.fillText("MOONLANDER", CANVAS_WIDTH / 2, titleY);

		ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
		ctx.font = tf(14);
		ctx.fillText("A LUNAR DESCENT SIMULATOR", CANVAS_WIDTH / 2, titleY + 20);
		// Touch hint — explains the tap interaction pattern for new players.
		if (isTouch) {
			ctx.fillStyle = "#00ff88";
			ctx.font = tf(13);
			ctx.fillText(
				"TAP A MODE TO LAUNCH",
				CANVAS_WIDTH / 2,
				titleY + Math.round(40 * fMul),
			);
		}
		const descriptions = [
			"10 missions. Pick any. Beat your ghost.",
			`5 missions, escalating difficulty. ${completedCount}/${totalCampaign} complete.`,
			"Watch an AI learn to land from scratch.",
			"Play while the AI trains on your terrain.",
			"Draw custom terrain. Share with a link.",
			`Today's seed: ${dailyDateLabel}.${dailyBestLabel}`,
			"Apollo, Artemis. Real missions. Real margins.",
			"Roll a procedural terrain. Share the URL.",
		];

		// Each row carries two text lines: the 22px bold option name (baseline y+8,
		// descender bottom ~y+12) and the 13px description (baseline y+26,
		// descender bottom ~y+29). Old box (y-14, height 40 → ends at y+26)
		// clipped the description descenders because the box bottom edge sat
		// exactly on the baseline. New box is 46 tall (ends at y+32), clear of
		// descenders with 3px of margin. rowSpacing bumped to 50 so adjacent
		// boxes have a 4px gap and don't visually fuse into one strip.
		// Sprint 7.5 — touch devices get larger, more spaced rows for
		// thumb-friendly hit targets. Geometry shared with updateTitle's
		// hit-test via getTitleGeometry helper.
		const titleGeo = getTitleGeometry(isTouch);
		const rowSpacing = titleGeo.rowSpacing;
		const rowHeight = titleGeo.rowHeight;
		const boxHalfW = (titleGeo.xMax - titleGeo.xMin) / 2;
		const firstRowY = titleGeo.firstRowY(CANVAS_HEIGHT, options.length);
		for (let i = 0; i < options.length; i++) {
			const y = firstRowY + i * rowSpacing;
			const isSelected = i === selection;

			// Sprint 7.5 Tier 5 — every option looks like a button on
			// touch (subtle outline + faint fill). Selected row gets a
			// stronger highlight on top.
			if (isTouch) {
				ctx.fillStyle = isSelected
					? "rgba(0, 255, 136, 0.12)"
					: "rgba(255, 255, 255, 0.04)";
				ctx.fillRect(
					CANVAS_WIDTH / 2 - boxHalfW,
					y - 14,
					boxHalfW * 2,
					rowHeight,
				);
				ctx.strokeStyle = isSelected
					? "#00ff88"
					: "rgba(255, 255, 255, 0.18)";
				ctx.lineWidth = isSelected ? 2 : 1;
				ctx.strokeRect(
					CANVAS_WIDTH / 2 - boxHalfW,
					y - 14,
					boxHalfW * 2,
					rowHeight,
				);
			} else if (isSelected) {
				ctx.fillStyle = "rgba(0, 255, 136, 0.1)";
				ctx.fillRect(
					CANVAS_WIDTH / 2 - boxHalfW,
					y - 14,
					boxHalfW * 2,
					rowHeight,
				);
				ctx.strokeStyle = "#00ff88";
				ctx.lineWidth = 1;
				ctx.strokeRect(
					CANVAS_WIDTH / 2 - boxHalfW,
					y - 14,
					boxHalfW * 2,
					rowHeight,
				);
			}

			ctx.fillStyle = isSelected ? "#00ff88" : "#666666";
			ctx.font = tf(22, true);
			ctx.textAlign = "center";
			ctx.fillText(options[i], CANVAS_WIDTH / 2, y + 8);

			ctx.fillStyle = isSelected
				? "rgba(255, 255, 255, 0.5)"
				: "rgba(255, 255, 255, 0.25)";
			ctx.font = tf(13);
			ctx.fillText(
				descriptions[i],
				CANVAS_WIDTH / 2,
				y + Math.round(26 * fMul),
			);
		}

		// Controls — desktop only. Touch users see "TAP TO LAUNCH" near title.
		if (!isTouch) {
			ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
			ctx.font = '14px "Courier New", monospace';
			ctx.fillText(
				"[UP/DOWN] Select    [ENTER] Start    [S] AI Settings",
				CANVAS_WIDTH / 2,
				CANVAS_HEIGHT - 30,
			);
		}

		ctx.restore();
	}

	drawMissionSelect(
		missions: Mission[],
		selectedIndex: number,
		bestScores: Map<number, number>,
		campaignProgress?: Set<number>,
		authenticInfo?: { missionId: number; on: boolean } | null,
		authenticBestScores?: Map<number, number>,
		cleanClears?: Set<number>,
		isTouch = false,
	): void {
		const ctx = this.ctx;
		ctx.save();
		// Sprint 7.5 Tier 4 — touch fonts scale 1.5x for legibility.
		const fMul = isTouch ? 1.5 : 1;
		const mf = (px: number, bold = false): string =>
			`${bold ? "bold " : ""}${Math.round(px * fMul)}px "Courier New", monospace`;
		const dy26 = Math.round(26 * fMul);

		// Title
		ctx.fillStyle = "#00ff88";
		ctx.font = mf(32, true);
		ctx.textAlign = "center";
		ctx.fillText("MOONLANDER", CANVAS_WIDTH / 2, 60);

		ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
		ctx.font = mf(14);
		ctx.fillText(
			isTouch ? "TAP A MISSION TO LAUNCH" : "SELECT MISSION",
			CANVAS_WIDTH / 2,
			90,
		);

		// Sprint 7.5 — use shared geometry so the rendered row
		// positions match what StateHandlers.updateMenu hit-tests.
		const { startY, lineHeight, visibleCount: max } = getMissionListGeometry(isTouch);
		const visibleCount = Math.min(missions.length, max);

		for (let i = 0; i < visibleCount; i++) {
			const m = missions[i];
			const y = startY + i * lineHeight;
			const isSelected = i === selectedIndex;

			// Campaign: check locked/completed
			const isLocked =
				campaignProgress !== undefined &&
				m.id > 1 &&
				!campaignProgress.has(m.id - 1);
			const isCompleted = campaignProgress?.has(m.id) ?? false;

			// Sprint 7.5 Tier 5 — touch devices show a subtle button-like
			// outline + faint fill on EVERY tappable row (not just the
			// selected one), so the whole list reads as a list of buttons
			// instead of just text. Selected row gets a stronger outline
			// + brighter fill on top.
			if (isTouch && !isLocked) {
				ctx.fillStyle = isSelected
					? "rgba(0, 255, 136, 0.12)"
					: "rgba(255, 255, 255, 0.04)";
				ctx.fillRect(
					CANVAS_WIDTH / 2 - 340,
					y - 16,
					680,
					lineHeight,
				);
				ctx.strokeStyle = isSelected
					? "#00ff88"
					: "rgba(255, 255, 255, 0.18)";
				ctx.lineWidth = isSelected ? 2 : 1;
				ctx.strokeRect(
					CANVAS_WIDTH / 2 - 340,
					y - 16,
					680,
					lineHeight,
				);
			} else if (isSelected && !isLocked) {
				// Desktop: only the selected row gets a highlight (legacy).
				ctx.fillStyle = "rgba(0, 255, 136, 0.1)";
				ctx.fillRect(
					CANVAS_WIDTH / 2 - 340,
					y - 16,
					680,
					lineHeight,
				);
				ctx.strokeStyle = "#00ff88";
				ctx.lineWidth = 1;
				ctx.strokeRect(
					CANVAS_WIDTH / 2 - 340,
					y - 16,
					680,
					lineHeight,
				);
			}

			// Status indicator for campaign
			ctx.textAlign = "left";
			if (campaignProgress !== undefined) {
				ctx.font = mf(14);
				if (isCompleted) {
					ctx.fillStyle = "#00ff88";
					ctx.fillText("[DONE]", CANVAS_WIDTH / 2 - 300, y + 6);
					if (cleanClears?.has(m.id)) {
						ctx.fillStyle = "#ffd84a";
						ctx.font = mf(16, true);
						ctx.fillText("\u2605", CANVAS_WIDTH / 2 - 240, y + 6);
					}
				} else if (isLocked) {
					ctx.fillStyle = "#444444";
					ctx.fillText("[LOCKED]", CANVAS_WIDTH / 2 - 300, y + 6);
				} else {
					ctx.fillStyle = "#ffaa00";
					ctx.fillText("[  >>  ]", CANVAS_WIDTH / 2 - 300, y + 6);
				}
			} else {
				ctx.fillStyle = isSelected ? "#00ff88" : "#888888";
				ctx.font = mf(16, true);
				ctx.fillText(
					`${String(m.id).padStart(2, "0")}`,
					CANVAS_WIDTH / 2 - 300,
					y + 6,
				);
			}

			// Sprint 7.1 — archetype glyph.
			const archetype = m.difficulty?.archetype;
			if (archetype && !isLocked) {
				const glyphInfo = ARCHETYPE_GLYPHS[archetype];
				if (glyphInfo) {
					ctx.fillStyle = isSelected ? glyphInfo.color : glyphInfo.dimColor;
					ctx.font = mf(16, true);
					ctx.fillText(glyphInfo.glyph, CANVAS_WIDTH / 2 - 245, y + 6);
				}
			}

			// Mission name
			const dimmed = isLocked;
			ctx.fillStyle = dimmed ? "#444444" : isSelected ? "#ffffff" : "#aaaaaa";
			ctx.font = mf(16, isSelected && !isLocked);
			ctx.fillText(m.name, CANVAS_WIDTH / 2 - 220, y + 6);

			// Description — only render when there's vertical room. On
			// touch the larger lineHeight gives ~28px clearance for the
			// description below the name; on desktop this matches the
			// legacy y+22 baseline.
			ctx.fillStyle = dimmed
				? "rgba(255, 255, 255, 0.15)"
				: isSelected
					? "rgba(255, 255, 255, 0.6)"
					: "rgba(255, 255, 255, 0.3)";
			ctx.font = mf(12);
			ctx.fillText(
				isLocked ? "Complete previous mission to unlock" : m.description,
				CANVAS_WIDTH / 2 - 220,
				y + (isTouch ? Math.round(22 * fMul) : 22),
			);

			// Best score — vanilla on the first line, Authentic best
			// stacked below when present (dual-track display).
			const best = bestScores.get(m.seed);
			const authBest = authenticBestScores?.get(m.seed);
			if (best !== undefined || authBest !== undefined) {
				ctx.textAlign = "right";
				if (best !== undefined) {
					ctx.fillStyle = "#00ff88";
					ctx.font = mf(14);
					ctx.fillText(`BEST: ${best}`, CANVAS_WIDTH / 2 + 300, y + 4);
				}
				if (authBest !== undefined) {
					ctx.fillStyle = ERA_COLORS.APOLLO_AMBER;
					ctx.font = mf(11);
					ctx.fillText(
						`AUTHENTIC: ${authBest}`,
						CANVAS_WIDTH / 2 + 300,
						y + Math.round(20 * fMul),
					);
				}
			}
		}

		// Controls hint — desktop only. Touch users see "TAP A MISSION TO LAUNCH" near top.
		if (!isTouch) {
			ctx.textAlign = "center";
			ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
			ctx.font = '14px "Courier New", monospace';
			ctx.fillText(
				"[UP/DOWN] Select    [ENTER] Launch    [I] Import ghost    [ESC] Back",
				CANVAS_WIDTH / 2,
				CANVAS_HEIGHT - 30,
			);
		}

		// Sprint 5.5 — Authentic Mode indicator for historic mission-select.
		// Only rendered when the caller passes authenticInfo (i.e. gameMode
		// === "historic" AND selected mission is a historic landing).
		if (authenticInfo) {
			const y = CANVAS_HEIGHT - 60;
			ctx.textAlign = "center";
			ctx.font = 'bold 14px "Courier New", monospace';
			ctx.fillStyle = authenticInfo.on
				? ERA_COLORS.APOLLO_AMBER
				: "rgba(255, 176, 0, 0.5)";
			ctx.fillText(
				`[A] AUTHENTIC MODE: ${authenticInfo.on ? "ON" : "OFF"}`,
				CANVAS_WIDTH / 2,
				y,
			);
		}

		ctx.restore();
	}

	/**
	 * Sprint 5.5 Authentic pre-launch tutorial overlay. Shown once per
	 * mission on first Authentic launch; blocks menu nav while visible.
	 * 3-card layout walks the player through what to expect before the
	 * briefing eats up the first 5s of flight.
	 */
	drawAuthenticTutorial(framesRemaining: number): void {
		const ctx = this.ctx;
		ctx.save();

		// Dim background
		ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
		ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

		const title = "AUTHENTIC MODE — 1969 TECH";
		const cards = [
			{
				head: "ANALOG INSTRUMENTS",
				body: "Your altitude readout goes blank in the last 50m — just like Armstrong. Trust your eyes.",
			},
			{
				head: "AGC EXECUTIVE OVERFLOW",
				body: "Somewhere in descent the 2KB flight computer chokes. Thrust locks for 400ms. Hold course — the computer will catch up.",
			},
			{
				head: "THE MARGIN",
				body: "Armstrong touched down with 22 seconds of fuel. Beat him.",
			},
		];

		ctx.fillStyle = ERA_COLORS.APOLLO_AMBER;
		ctx.font = 'bold 22px "Courier New", monospace';
		ctx.textAlign = "center";
		ctx.fillText(title, CANVAS_WIDTH / 2, 120);

		const cardW = 280;
		const cardH = 160;
		const gap = 20;
		const totalW = cards.length * cardW + (cards.length - 1) * gap;
		const startX = (CANVAS_WIDTH - totalW) / 2;
		const cardY = 170;

		for (let i = 0; i < cards.length; i++) {
			const cx = startX + i * (cardW + gap);
			ctx.strokeStyle = ERA_COLORS.APOLLO_AMBER;
			ctx.lineWidth = 1;
			ctx.strokeRect(cx, cardY, cardW, cardH);

			ctx.fillStyle = ERA_COLORS.APOLLO_AMBER;
			ctx.font = 'bold 14px "Courier New", monospace';
			ctx.textAlign = "left";
			ctx.fillText(cards[i].head, cx + 16, cardY + 28);

			ctx.fillStyle = "#ffffff";
			ctx.font = '12px "Courier New", monospace';
			wrapText(ctx, cards[i].body, cx + 16, cardY + 54, cardW - 32, 16);
		}

		const seconds = (framesRemaining / 60).toFixed(1);
		ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
		ctx.font = '14px "Courier New", monospace';
		ctx.textAlign = "center";
		ctx.fillText(
			`Auto-dismiss in ${seconds}s — press ENTER or ESC to launch`,
			CANVAS_WIDTH / 2,
			cardY + cardH + 40,
		);

		ctx.restore();
	}

	/** Training mode UI with reward graph */
	drawTrainingUI(
		episode: number,
		epsilon: number,
		lastLanded: boolean,
		lastReward: number,
		rewardHistory: number[],
	): void {
		const ctx = this.ctx;
		ctx.save();

		// Title
		ctx.fillStyle = "#ffaa00";
		ctx.font = 'bold 28px "Courier New", monospace';
		ctx.textAlign = "center";
		ctx.fillText("AI TRAINING MODE", CANVAS_WIDTH / 2, 50);

		// Stats
		ctx.font = '16px "Courier New", monospace';
		ctx.textAlign = "left";
		const sx = 60;
		let sy = 100;
		const lh = 26;

		ctx.fillStyle = "#00ff88";
		ctx.fillText(`Episode:     ${episode}`, sx, sy);
		sy += lh;
		ctx.fillText(`Exploration: ${(epsilon * 100).toFixed(1)}%`, sx, sy);
		sy += lh;

		ctx.fillStyle = lastLanded ? "#00ff88" : "#ff4444";
		ctx.fillText(`Last result: ${lastLanded ? "LANDED" : "CRASHED"}`, sx, sy);
		sy += lh;

		ctx.fillStyle = "#ffffff";
		ctx.fillText(`Last reward: ${lastReward.toFixed(1)}`, sx, sy);
		sy += lh;

		// Moving average
		if (rewardHistory.length > 0) {
			const window = Math.min(20, rewardHistory.length);
			const recent = rewardHistory.slice(-window);
			const avg = recent.reduce((a, b) => a + b, 0) / window;
			ctx.fillStyle = avg > 0 ? "#00ff88" : "#ff4444";
			ctx.fillText(`Avg reward (${window}): ${avg.toFixed(1)}`, sx, sy);
		}

		// Reward graph
		if (rewardHistory.length > 1) {
			const graphX = 60;
			const graphY = 280;
			const graphW = CANVAS_WIDTH - 120;
			const graphH = 300;

			// Background
			ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
			ctx.fillRect(graphX, graphY, graphW, graphH);

			// Zero line
			const minR = Math.min(...rewardHistory, -10);
			const maxR = Math.max(...rewardHistory, 10);
			const range = maxR - minR || 1;
			const zeroY = graphY + graphH - ((0 - minR) / range) * graphH;
			ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
			ctx.lineWidth = 1;
			ctx.setLineDash([4, 4]);
			ctx.beginPath();
			ctx.moveTo(graphX, zeroY);
			ctx.lineTo(graphX + graphW, zeroY);
			ctx.stroke();
			ctx.setLineDash([]);

			// Reward line
			ctx.strokeStyle = "#00ff88";
			ctx.lineWidth = 1.5;
			ctx.beginPath();
			const maxPoints = Math.min(rewardHistory.length, 500);
			const step =
				rewardHistory.length > maxPoints ? rewardHistory.length / maxPoints : 1;
			for (let i = 0; i < maxPoints; i++) {
				const idx = Math.floor(i * step);
				const rx = graphX + (i / maxPoints) * graphW;
				const ry =
					graphY + graphH - ((rewardHistory[idx] - minR) / range) * graphH;
				if (i === 0) ctx.moveTo(rx, ry);
				else ctx.lineTo(rx, ry);
			}
			ctx.stroke();

			// Moving average line (smoothed)
			if (rewardHistory.length > 20) {
				ctx.strokeStyle = "#ffaa00";
				ctx.lineWidth = 2;
				ctx.beginPath();
				const avgWindow = 20;
				for (let i = avgWindow; i < maxPoints; i++) {
					const idx = Math.floor(i * step);
					const startIdx = Math.max(0, idx - avgWindow);
					let sum = 0;
					for (let j = startIdx; j <= idx; j++) sum += rewardHistory[j];
					const avg = sum / (idx - startIdx + 1);
					const rx = graphX + (i / maxPoints) * graphW;
					const ry = graphY + graphH - ((avg - minR) / range) * graphH;
					if (i === avgWindow) ctx.moveTo(rx, ry);
					else ctx.lineTo(rx, ry);
				}
				ctx.stroke();
			}

			// Axis labels
			ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
			ctx.font = '10px "Courier New", monospace';
			ctx.textAlign = "right";
			ctx.fillText(`${maxR.toFixed(0)}`, graphX - 5, graphY + 12);
			ctx.fillText(`${minR.toFixed(0)}`, graphX - 5, graphY + graphH);
			ctx.textAlign = "center";
			ctx.fillText("Episodes", graphX + graphW / 2, graphY + graphH + 16);

			// Legend
			ctx.textAlign = "right";
			ctx.fillStyle = "#00ff88";
			ctx.fillText("raw", graphX + graphW, graphY - 8);
			ctx.fillStyle = "#ffaa00";
			ctx.fillText("avg ", graphX + graphW - 40, graphY - 8);
		}

		// Controls
		ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
		ctx.font = '14px "Courier New", monospace';
		ctx.textAlign = "center";
		ctx.fillText(
			"[ENTER] Watch agent play    [ESC] Back to menu",
			CANVAS_WIDTH / 2,
			CANVAS_HEIGHT - 30,
		);

		ctx.restore();
	}

	drawMessage(text: string, subtitle?: string): void {
		const ctx = this.ctx;
		ctx.save();
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";

		// Main message
		ctx.fillStyle = "#ffffff";
		ctx.font = 'bold 36px "Courier New", monospace';
		ctx.fillText(text, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 - 20);

		// Subtitle
		if (subtitle) {
			ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
			ctx.font = '18px "Courier New", monospace';
			ctx.fillText(subtitle, CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2 + 25);
		}

		ctx.restore();
	}

	/** Draw a mini telemetry chart (altitude over time) on the post-flight screen */
	drawTelemetry(frames: TelemetryFrame[]): void {
		if (frames.length < 2) return;

		const ctx = this.ctx;
		ctx.save();

		const chartX = CANVAS_WIDTH / 2 - 250;
		const chartY = CANVAS_HEIGHT / 2 + 60;
		const chartW = 500;
		const chartH = 100;

		// Background
		ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
		ctx.fillRect(chartX - 5, chartY - 5, chartW + 10, chartH + 25);

		// Find max altitude for scaling
		let maxAlt = 0;
		for (const f of frames) {
			if (f.altitude > maxAlt) maxAlt = f.altitude;
		}
		if (maxAlt < 10) maxAlt = 10;

		const maxTime = frames[frames.length - 1].time;
		if (maxTime <= 0) {
			ctx.restore();
			return;
		}

		// Altitude line
		ctx.strokeStyle = "#00ff88";
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		for (let i = 0; i < frames.length; i++) {
			const fx = chartX + (frames[i].time / maxTime) * chartW;
			const fy = chartY + chartH - (frames[i].altitude / maxAlt) * chartH;
			if (i === 0) ctx.moveTo(fx, fy);
			else ctx.lineTo(fx, fy);
		}
		ctx.stroke();

		// Labels
		ctx.fillStyle = "rgba(255, 255, 255, 0.5)";
		ctx.font = '10px "Courier New", monospace';
		ctx.textAlign = "left";
		ctx.fillText("ALT", chartX + 2, chartY + 12);
		ctx.textAlign = "right";
		ctx.fillText(`${Math.round(maxAlt)}`, chartX + chartW, chartY + 12);
		ctx.textAlign = "center";
		ctx.fillText(
			`${maxTime.toFixed(1)}s`,
			chartX + chartW / 2,
			chartY + chartH + 14,
		);

		ctx.restore();
	}

	/** Draw alien UFO sprite */
	drawAlien(
		alien: AlienState,
		landerX: number,
		landerY: number,
		offset: { x: number; y: number },
	): void {
		const ctx = this.ctx;
		ctx.save();
		ctx.translate(offset.x + alien.x, offset.y + alien.y);

		// UFO body (oval)
		ctx.fillStyle = "#88ffaa";
		ctx.shadowColor = "#88ffaa";
		ctx.shadowBlur = 8;
		ctx.beginPath();
		ctx.ellipse(0, 0, 12, 5, 0, 0, Math.PI * 2);
		ctx.fill();

		// Dome
		ctx.fillStyle = "#aaffcc";
		ctx.shadowBlur = 4;
		ctx.beginPath();
		ctx.ellipse(0, -4, 6, 5, 0, Math.PI, Math.PI * 2);
		ctx.fill();

		ctx.shadowBlur = 0;
		ctx.restore();

		// Tractor beam when effect is active
		if (alien.activeEffect) {
			ctx.save();
			const ax = offset.x + alien.x;
			const ay = offset.y + alien.y;
			const lx = offset.x + landerX;
			const ly = offset.y + landerY;
			const pulse = Math.sin(Date.now() * 0.008) * 0.3 + 0.4;
			ctx.strokeStyle = `rgba(68, 255, 136, ${pulse})`;
			ctx.lineWidth = 2;
			ctx.setLineDash([4, 6]);
			ctx.beginPath();
			ctx.moveTo(ax, ay);
			ctx.lineTo(lx, ly);
			ctx.stroke();
			ctx.setLineDash([]);
			ctx.restore();
		}
	}

	/** Draw mission briefing text (shown during first seconds of flight) */
	drawBriefing(text: string): void {
		const ctx = this.ctx;
		ctx.save();
		ctx.globalAlpha = 0.8;
		ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
		ctx.fillRect(CANVAS_WIDTH / 2 - 300, 10, 600, 60);
		ctx.globalAlpha = 1;
		ctx.fillStyle = "#44aaff";
		ctx.font = '12px "Courier New", monospace';
		ctx.textAlign = "center";
		ctx.fillText("MISSION CONTROL:", CANVAS_WIDTH / 2, 30);
		ctx.fillStyle = "#ffffff";
		ctx.font = '13px "Courier New", monospace';
		// Wrap text to fit
		const words = text.split(" ");
		let line = "";
		let y = 48;
		for (const word of words) {
			const test = line ? `${line} ${word}` : word;
			if (ctx.measureText(test).width > 560) {
				ctx.fillText(line, CANVAS_WIDTH / 2, y);
				line = word;
				y += 16;
				if (y > 62) break; // max 2 lines
			} else {
				line = test;
			}
		}
		if (line) ctx.fillText(line, CANVAS_WIDTH / 2, y);
		ctx.restore();
	}

	/** Draw post-landing/crash commentary from mission control */
	drawCommentary(text: string): void {
		const ctx = this.ctx;
		ctx.save();
		ctx.fillStyle = "rgba(68, 170, 255, 0.7)";
		ctx.font = '14px "Courier New", monospace';
		ctx.textAlign = "center";
		// Wrap text
		const words = text.split(" ");
		let line = "";
		let y = CANVAS_HEIGHT / 2 + 60;
		for (const word of words) {
			const test = line ? `${line} ${word}` : word;
			if (ctx.measureText(test).width > 600) {
				ctx.fillText(line, CANVAS_WIDTH / 2, y);
				line = word;
				y += 18;
			} else {
				line = test;
			}
		}
		if (line) ctx.fillText(line, CANVAS_WIDTH / 2, y);
		ctx.restore();
	}

	/** Draw post-crash flight analysis (positioned below commentary). */
	drawCrashAnalysis(text: string): void {
		const ctx = this.ctx;
		ctx.save();

		const boxW = 640;
		// Sits below the altitude telemetry chart (chart spans
		// CANVAS_HEIGHT/2 + 60 to CANVAS_HEIGHT/2 + 185). Previous value
		// was +130 which overlapped the chart by 55px and obscured the
		// descent curve behind the "FLIGHT ANALYSIS" panel.
		const startY = CANVAS_HEIGHT / 2 + 195;
		const paddingX = 20;
		const paddingY = 14;
		const lineHeight = 18;

		// Wrap first so we can size the box
		ctx.font = '13px "Courier New", monospace';
		const maxTextW = boxW - paddingX * 2;
		const words = text.split(" ");
		const lines: string[] = [];
		let line = "";
		for (const word of words) {
			const test = line ? `${line} ${word}` : word;
			if (ctx.measureText(test).width > maxTextW) {
				if (line) lines.push(line);
				line = word;
			} else {
				line = test;
			}
		}
		if (line) lines.push(line);

		const headerH = 22;
		const boxH = headerH + paddingY + lines.length * lineHeight + paddingY - 4;

		ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
		ctx.strokeStyle = "rgba(255, 170, 0, 0.6)";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.roundRect(CANVAS_WIDTH / 2 - boxW / 2, startY, boxW, boxH, 6);
		ctx.fill();
		ctx.stroke();

		ctx.fillStyle = "rgba(255, 170, 0, 0.9)";
		ctx.font = 'bold 12px "Courier New", monospace';
		ctx.textAlign = "left";
		ctx.fillText(
			"▸ FLIGHT ANALYSIS",
			CANVAS_WIDTH / 2 - boxW / 2 + paddingX,
			startY + paddingY + 4,
		);

		ctx.fillStyle = "rgba(255, 220, 180, 0.85)";
		ctx.font = '13px "Courier New", monospace';
		let y = startY + headerH + paddingY;
		for (const l of lines) {
			ctx.fillText(l, CANVAS_WIDTH / 2 - boxW / 2 + paddingX, y);
			y += lineHeight;
		}

		ctx.restore();
	}

	/** Draw artifact scan fact (positioned below commentary) */
	drawArtifactFact(text: string): void {
		const ctx = this.ctx;
		ctx.save();
		ctx.fillStyle = "rgba(255, 170, 0, 0.8)";
		ctx.font = '13px "Courier New", monospace';
		ctx.textAlign = "center";
		const words = text.split(" ");
		let line = "";
		let y = CANVAS_HEIGHT / 2 + 140;
		for (const word of words) {
			const test = line ? `${line} ${word}` : word;
			if (ctx.measureText(test).width > 600) {
				ctx.fillText(line, CANVAS_WIDTH / 2, y);
				line = word;
				y += 16;
			} else {
				line = test;
			}
		}
		if (line) ctx.fillText(line, CANVAS_WIDTH / 2, y);
		ctx.restore();
	}

	drawComparisonCard(
		playerScore: number,
		playerLanded: boolean,
		aiBestReward: number,
		aiEpisodes: number,
		aiLanded: boolean,
	): void {
		const ctx = this.ctx;
		ctx.save();
		const cardW = 400;
		const cardH = 140;
		const cx = CANVAS_WIDTH / 2;
		const cy = CANVAS_HEIGHT / 2 + 200;

		ctx.fillStyle = "rgba(0, 0, 0, 0.85)";
		ctx.strokeStyle = "#00ff88";
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.roundRect(cx - cardW / 2, cy - cardH / 2, cardW, cardH, 8);
		ctx.fill();
		ctx.stroke();

		ctx.font = 'bold 14px "Courier New", monospace';
		ctx.textAlign = "center";
		ctx.fillStyle = "#00ff88";
		ctx.fillText("HUMAN vs AI", cx, cy - cardH / 2 + 24);

		ctx.font = '13px "Courier New", monospace';
		const col1 = cx - 90;
		const col2 = cx + 90;
		let y = cy - cardH / 2 + 50;

		ctx.fillStyle = "#888";
		ctx.fillText("YOU", col1, y);
		ctx.fillText(`AI (${aiEpisodes} eps)`, col2, y);
		y += 24;

		ctx.fillStyle = playerLanded ? "#00ff88" : "#ff4444";
		ctx.fillText(playerLanded ? `LANDED ${playerScore}` : "CRASHED", col1, y);
		ctx.fillStyle = aiLanded ? "#00ff88" : "#ff4444";
		ctx.fillText(
			aiLanded ? `BEST ${aiBestReward.toFixed(0)}` : "LEARNING...",
			col2,
			y,
		);
		y += 24;

		ctx.fillStyle = "#ffaa00";
		ctx.font = 'bold 13px "Courier New", monospace';
		if (playerLanded && aiLanded) {
			const winner = playerScore > aiBestReward ? "YOU WIN!" : "AI WINS!";
			ctx.fillText(winner, cx, y);
		} else if (playerLanded) {
			ctx.fillText("YOU WIN — AI still learning", cx, y);
		} else {
			ctx.fillText("Both need more practice...", cx, y);
		}

		ctx.restore();
	}

	/** Draw relay mode indicator on mission select */
	drawRelayIndicator(active: boolean): void {
		const ctx = this.ctx;
		ctx.save();
		ctx.font = '14px "Courier New", monospace';
		ctx.textAlign = "right";
		ctx.fillStyle = active ? "#ffaa00" : "rgba(0, 255, 136, 0.4)";
		ctx.fillText(
			active ? "RELAY MODE: ON  [L] off" : "[L] Relay Mode",
			CANVAS_WIDTH - 20,
			CANVAS_HEIGHT - 20,
		);
		ctx.restore();
	}

	/** Draw autopilot decision annotations */
	drawAutopilotAnnotations(
		lander: LanderState,
		decision: {
			mode: string;
			targetPadX: number;
			targetPadY: number;
			targetPadWidth: number;
			desiredAngle: number;
			thrusting: boolean;
			altitude: number;
		},
		offset: { x: number; y: number },
	): void {
		const ctx = this.ctx;
		ctx.save();
		ctx.translate(offset.x, offset.y);

		const lx = lander.x;
		const ly = lander.y;

		// Target pad indicator (dotted circle + line)
		const padCx = decision.targetPadX + decision.targetPadWidth / 2;
		const padY = decision.targetPadY;
		ctx.setLineDash([4, 4]);
		ctx.strokeStyle = "rgba(255, 170, 0, 0.6)";
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.arc(padCx, padY - 10, decision.targetPadWidth / 2 + 10, 0, Math.PI * 2);
		ctx.stroke();
		// Line from lander to pad
		ctx.beginPath();
		ctx.moveTo(lx, ly);
		ctx.lineTo(padCx, padY - 10);
		ctx.stroke();
		ctx.setLineDash([]);

		// Thrust vector (green arrow from lander in thrust direction)
		if (decision.thrusting) {
			const rad = ((lander.angle - 90) * Math.PI) / 180;
			const vecLen = 40;
			ctx.strokeStyle = "#00ff88";
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.moveTo(lx, ly);
			ctx.lineTo(lx + Math.cos(rad) * vecLen, ly + Math.sin(rad) * vecLen);
			ctx.stroke();
			// Arrow head
			const headLen = 8;
			const headAngle = 0.4;
			ctx.beginPath();
			ctx.moveTo(lx + Math.cos(rad) * vecLen, ly + Math.sin(rad) * vecLen);
			ctx.lineTo(
				lx + Math.cos(rad - headAngle) * (vecLen - headLen),
				ly + Math.sin(rad - headAngle) * (vecLen - headLen),
			);
			ctx.moveTo(lx + Math.cos(rad) * vecLen, ly + Math.sin(rad) * vecLen);
			ctx.lineTo(
				lx + Math.cos(rad + headAngle) * (vecLen - headLen),
				ly + Math.sin(rad + headAngle) * (vecLen - headLen),
			);
			ctx.stroke();
		}

		// Gravity vector (red arrow downward)
		ctx.strokeStyle = "#ff4444";
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		ctx.moveTo(lx + 15, ly);
		ctx.lineTo(lx + 15, ly + 30);
		ctx.lineTo(lx + 12, ly + 25);
		ctx.moveTo(lx + 15, ly + 30);
		ctx.lineTo(lx + 18, ly + 25);
		ctx.stroke();

		// Mode label above lander
		ctx.fillStyle = "#ffaa00";
		ctx.font = 'bold 11px "Courier New", monospace';
		ctx.textAlign = "center";
		ctx.fillText(decision.mode, lx, ly - 25);

		// Altitude readout
		ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
		ctx.font = '10px "Courier New", monospace';
		ctx.fillText(`ALT: ${Math.round(decision.altitude)}`, lx, ly - 38);

		// Altitude zone markers (horizontal lines)
		ctx.strokeStyle = "rgba(255, 170, 0, 0.15)";
		ctx.lineWidth = 1;
		ctx.setLineDash([8, 8]);
		const zones = [20, 100, 300];
		for (const z of zones) {
			const zoneY = padY - z;
			if (zoneY > 0) {
				ctx.beginPath();
				ctx.moveTo(padCx - 100, zoneY);
				ctx.lineTo(padCx + 100, zoneY);
				ctx.stroke();
			}
		}
		ctx.setLineDash([]);

		ctx.restore();
	}

	/** Draw gravity preset selector on mission select menu */
	drawGravitySelector(preset: {
		name: string;
		gravity: number;
		color: string;
	}): void {
		const ctx = this.ctx;
		ctx.save();
		ctx.font = '14px "Courier New", monospace';
		ctx.textAlign = "right";
		ctx.fillStyle = preset.color;
		ctx.fillText(
			`GRAVITY: ${preset.name} (${preset.gravity} m/s\u00B2)`,
			CANVAS_WIDTH - 20,
			CANVAS_HEIGHT - 40,
		);
		ctx.fillStyle = "rgba(255, 255, 255, 0.35)";
		ctx.font = '11px "Courier New", monospace';
		ctx.fillText(
			"[\u2190 \u2192] Change gravity",
			CANVAS_WIDTH - 20,
			CANVAS_HEIGHT - 56,
		);
		ctx.restore();
	}

	/** Draw achievement unlock toast */
	drawAchievementToast(name: string, description: string, timer: number): void {
		const ctx = this.ctx;
		ctx.save();
		// Fade out in last second
		const alpha = Math.min(1, timer);
		ctx.globalAlpha = alpha;
		// Toast background
		const w = 320;
		const h = 50;
		const x = CANVAS_WIDTH / 2 - w / 2;
		const y = 80;
		ctx.fillStyle = "rgba(0, 0, 0, 0.8)";
		ctx.fillRect(x, y, w, h);
		ctx.strokeStyle = "#ffaa00";
		ctx.lineWidth = 2;
		ctx.strokeRect(x, y, w, h);
		// Badge icon (star)
		ctx.fillStyle = "#ffaa00";
		ctx.font = '20px "Courier New", monospace';
		ctx.textAlign = "left";
		ctx.fillText("\u2605", x + 12, y + 30);
		// Name
		ctx.fillStyle = "#ffaa00";
		ctx.font = 'bold 14px "Courier New", monospace';
		ctx.fillText(name, x + 38, y + 22);
		// Description
		ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
		ctx.font = '11px "Courier New", monospace';
		ctx.fillText(description, x + 38, y + 40);
		ctx.restore();
	}

	/** Draw semi-transparent touch control zones for mobile */
	/**
	 * Sprint 7.5 Tier 2 — visible virtual joystick (left) + thrust button
	 * (right). Replaces the old huge faint rectangles that were
	 * functionally invisible on phones.
	 *
	 * Geometry mirrors `STICK_CENTER`/`THRUST_CENTER` in Input.ts so the
	 * visible affordance matches the actual hit zone. Stick knob position
	 * is read from the live input state — when the player drags, the knob
	 * follows the finger inside the radius.
	 *
	 * @param stickKnob — knob offset from stick center; (0,0) when no
	 *   touch is on the stick. Renderer adds this to STICK_CENTER.
	 * @param thrustHeld — true when the thrust button is currently held;
	 *   renderer brightens the button fill so the player gets visual
	 *   feedback that thrust is firing.
	 */
	drawTouchControls(
		stickKnob: { dx: number; dy: number } = { dx: 0, dy: 0 },
		thrustHeld = false,
	): void {
		const ctx = this.ctx;
		ctx.save();

		// --- Virtual joystick (left) ---
		// Position + radius come from the same constants Input.ts uses
		// for hit testing, so the visible affordance always matches the
		// active hit zone.
		const stickX = STICK_CENTER.x;
		const stickY = STICK_CENTER.y;
		const stickRadius = STICK_RADIUS;

		// Outer ring (boundary of the stick's hit zone)
		ctx.globalAlpha = 0.35;
		ctx.fillStyle = "#003a5a";
		ctx.beginPath();
		ctx.arc(stickX, stickY, stickRadius, 0, Math.PI * 2);
		ctx.fill();

		ctx.globalAlpha = 0.7;
		ctx.strokeStyle = "#4488ff";
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.arc(stickX, stickY, stickRadius, 0, Math.PI * 2);
		ctx.stroke();

		// Center cross (visual reference for the deadzone)
		ctx.globalAlpha = 0.25;
		ctx.strokeStyle = "#88aaff";
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.moveTo(stickX - 18, stickY);
		ctx.lineTo(stickX + 18, stickY);
		ctx.moveTo(stickX, stickY - 18);
		ctx.lineTo(stickX, stickY + 18);
		ctx.stroke();

		// Knob (follows finger; defaults to center when released)
		const knobX = stickX + stickKnob.dx;
		const knobY = stickY + stickKnob.dy;
		ctx.globalAlpha = 0.85;
		ctx.fillStyle = "#88aaff";
		ctx.beginPath();
		ctx.arc(knobX, knobY, 38, 0, Math.PI * 2);
		ctx.fill();
		ctx.strokeStyle = "#ffffff";
		ctx.lineWidth = 2;
		ctx.stroke();

		// Label
		ctx.globalAlpha = 0.55;
		ctx.fillStyle = "#ffffff";
		ctx.font = 'bold 13px "Courier New", monospace';
		ctx.textAlign = "center";
		ctx.textBaseline = "middle";
		ctx.fillText("ROTATE", stickX, stickY + stickRadius + 18);

		// --- Thrust button (right) ---
		const thrustX = THRUST_CENTER.x;
		const thrustY = THRUST_CENTER.y;
		const thrustRadius = THRUST_RADIUS;

		ctx.globalAlpha = thrustHeld ? 0.85 : 0.45;
		ctx.fillStyle = thrustHeld ? "#ff8833" : "#5a2810";
		ctx.beginPath();
		ctx.arc(thrustX, thrustY, thrustRadius, 0, Math.PI * 2);
		ctx.fill();

		ctx.globalAlpha = thrustHeld ? 1.0 : 0.7;
		ctx.strokeStyle = "#ff6600";
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.arc(thrustX, thrustY, thrustRadius, 0, Math.PI * 2);
		ctx.stroke();

		// Inner glow when active
		if (thrustHeld) {
			ctx.globalAlpha = 0.6;
			ctx.fillStyle = "#ffcc66";
			ctx.beginPath();
			ctx.arc(thrustX, thrustY, 40, 0, Math.PI * 2);
			ctx.fill();
		}

		// Label
		ctx.globalAlpha = thrustHeld ? 1.0 : 0.7;
		ctx.fillStyle = "#ffffff";
		ctx.font = 'bold 16px "Courier New", monospace';
		ctx.fillText("THRUST", thrustX, thrustY);

		ctx.globalAlpha = 0.55;
		ctx.font = 'bold 13px "Courier New", monospace';
		ctx.fillText("HOLD", thrustX, thrustY + thrustRadius + 18);

		ctx.restore();
	}
}

/**
 * Simple word-wrap helper for small multi-line text blocks (Authentic
 * tutorial cards). Breaks on spaces, doesn't handle hyphenation. Fine for
 * short strings; don't use for user-provided content.
 */
function wrapText(
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	maxWidth: number,
	lineHeight: number,
): void {
	const words = text.split(/\s+/);
	let line = "";
	let cursorY = y;
	for (let i = 0; i < words.length; i++) {
		const probe = line ? `${line} ${words[i]}` : words[i];
		if (ctx.measureText(probe).width > maxWidth && line) {
			ctx.fillText(line, x, cursorY);
			line = words[i];
			cursorY += lineHeight;
		} else {
			line = probe;
		}
	}
	if (line) ctx.fillText(line, x, cursorY);
}
