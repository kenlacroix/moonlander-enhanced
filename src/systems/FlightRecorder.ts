/**
 * Black Box Flight Recorder
 *
 * Renders a shareable flight report card as a standalone canvas image.
 * Shows: altitude curve, descent path on terrain silhouette, speed at
 * touchdown, fuel efficiency grade, mission name, score, and duration.
 * One-tap save to camera roll on mobile.
 */

import type { LanderState } from "../game/Lander";
import type { TerrainData } from "../game/Terrain";
import {
	CANVAS_HEIGHT,
	FUEL_BURN_RATE,
	MAX_LANDING_SPEED,
	STARTING_FUEL,
} from "../utils/constants";
import type { TelemetryFrame } from "./Telemetry";

const CARD_WIDTH = 800;
const CARD_HEIGHT = 500;

interface FlightReport {
	missionName: string;
	seed: number;
	score: number;
	landed: boolean;
	duration: number;
	finalVSpeed: number;
	finalHSpeed: number;
	finalAngle: number;
	fuelUsed: number;
	fuelStarted: number;
	frames: TelemetryFrame[];
	terrainPoints: { x: number; y: number }[];
	historicReference?: {
		label: string; // e.g. "Armstrong fuel margin"
		yourValue: number; // computed at landing
		theirValue: number; // historical reference
		unit: string; // "seconds", "m drift", etc.
	};
}

/**
 * Compute the player's "your value" for a historic mission's reference
 * metric. The metric type is dispatched on the unit string so we render
 * the right quantity for each historic mission's reference.
 *
 * Supported units:
 * - "seconds" → remaining-fuel-as-seconds-of-thrust (constant burn rate)
 * - "m drift" → distance from pad center at landing in approximate meters
 * - "min"     → flight duration converted to minutes
 *
 * Anything else falls back to flight duration in seconds. Adding a new
 * unit means adding a case here and the corresponding fact-sheet entry.
 */
export interface HistoricComparisonInput {
	label: string;
	unit: string;
	fuelRemaining: number;
	flightDurationSec: number;
	driftFromPadCenterPx: number;
}

// Game-space pixels to "meters" conversion. The lander HUD reports speed
// at ~scaled units; the pad is ~80px wide. Treat 1m ≈ 1px for share-card
// purposes — close enough for "you drifted 47m" UX without making players
// solve unit puzzles.
const PIXELS_PER_METER = 1;

export function computeHistoricYourValue(
	input: HistoricComparisonInput,
): number {
	const unitLower = input.unit.toLowerCase().trim();
	if (unitLower === "seconds" || unitLower === "sec" || unitLower === "s") {
		// Remaining fuel ÷ thrust burn rate. Uses the project-wide constant,
		// not an averaged-over-coasting estimate, so the "seconds remaining"
		// figure matches what the player would have seen if they kept
		// thrusting from touchdown.
		return Math.round((input.fuelRemaining / FUEL_BURN_RATE) * 10) / 10;
	}
	if (unitLower === "m drift" || unitLower === "m" || unitLower === "meters") {
		return Math.round(input.driftFromPadCenterPx / PIXELS_PER_METER);
	}
	if (unitLower === "min" || unitLower === "minutes") {
		return Math.round((input.flightDurationSec / 60) * 10) / 10;
	}
	// Unknown unit: don't fabricate a number. Caller can guard on
	// historicReference being undefined to skip rendering instead.
	return Math.round(input.flightDurationSec * 10) / 10;
}

function getFuelGrade(pctRemaining: number): { letter: string; color: string } {
	if (pctRemaining >= 60) return { letter: "A", color: "#00ff88" };
	if (pctRemaining >= 40) return { letter: "B", color: "#88ff44" };
	if (pctRemaining >= 25) return { letter: "C", color: "#ffaa00" };
	if (pctRemaining >= 10) return { letter: "D", color: "#ff6644" };
	return { letter: "F", color: "#ff2222" };
}

function getLandingGrade(
	landed: boolean,
	vSpeed: number,
): { label: string; color: string } {
	if (!landed) return { label: "CRASH", color: "#ff4444" };
	if (vSpeed < MAX_LANDING_SPEED * 0.3)
		return { label: "PERFECT", color: "#00ff88" };
	if (vSpeed < MAX_LANDING_SPEED * 0.6)
		return { label: "SMOOTH", color: "#88ff44" };
	return { label: "HARD", color: "#ffaa00" };
}

/** Generate a flight report card and trigger download */
export function generateFlightReport(
	lander: LanderState,
	terrain: TerrainData,
	frames: TelemetryFrame[],
	missionName: string,
	seed: number,
	score: number,
	landed: boolean,
	historicReference?: FlightReport["historicReference"],
): void {
	const report: FlightReport = {
		missionName,
		seed,
		score,
		landed,
		duration: frames.length > 0 ? frames[frames.length - 1].time : 0,
		finalVSpeed: Math.abs(lander.vy),
		finalHSpeed: Math.abs(lander.vx),
		finalAngle: lander.angle,
		fuelUsed: STARTING_FUEL * lander.landerType.fuelMultiplier - lander.fuel,
		fuelStarted: STARTING_FUEL * lander.landerType.fuelMultiplier,
		frames,
		terrainPoints: terrain.points,
		historicReference,
	};

	const canvas = document.createElement("canvas");
	canvas.width = CARD_WIDTH;
	canvas.height = CARD_HEIGHT;
	const ctx = canvas.getContext("2d");
	if (!ctx) return;

	renderCard(ctx, report);

	// Download
	canvas.toBlob((blob) => {
		if (!blob) return;
		const url = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = url;
		a.download = `moonlander-${report.missionName.replace(/\s+/g, "-").toLowerCase()}-${score}.png`;
		a.click();
		URL.revokeObjectURL(url);
	}, "image/png");
}

function renderCard(ctx: CanvasRenderingContext2D, r: FlightReport): void {
	// Background
	ctx.fillStyle = "#0a0a0a";
	ctx.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

	// Border
	ctx.strokeStyle = "#00ff88";
	ctx.lineWidth = 2;
	ctx.strokeRect(4, 4, CARD_WIDTH - 8, CARD_HEIGHT - 8);

	// Header
	ctx.fillStyle = "#00ff88";
	ctx.font = 'bold 24px "Courier New", monospace';
	ctx.textAlign = "left";
	ctx.fillText("FLIGHT REPORT", 30, 40);

	ctx.fillStyle = "#666666";
	ctx.font = '12px "Courier New", monospace';
	ctx.fillText(`MOONLANDER ENHANCED  |  SEED: ${r.seed}`, 30, 58);

	// Mission name
	ctx.fillStyle = "#ffffff";
	ctx.font = 'bold 18px "Courier New", monospace';
	ctx.fillText(r.missionName, 30, 85);

	// Landing result
	const landing = getLandingGrade(r.landed, r.finalVSpeed);
	ctx.fillStyle = landing.color;
	ctx.font = 'bold 32px "Courier New", monospace';
	ctx.textAlign = "right";
	ctx.fillText(landing.label, CARD_WIDTH - 30, 50);

	// Score
	if (r.score > 0) {
		ctx.fillStyle = "#ffffff";
		ctx.font = 'bold 20px "Courier New", monospace';
		ctx.fillText(`${r.score} PTS`, CARD_WIDTH - 30, 80);
	}

	// Stats row
	ctx.textAlign = "left";
	ctx.font = '14px "Courier New", monospace';
	let sx = 30;
	const sy = 115;

	// Duration
	ctx.fillStyle = "#888888";
	ctx.fillText("FLIGHT TIME", sx, sy);
	ctx.fillStyle = "#ffffff";
	ctx.fillText(`${r.duration.toFixed(1)}s`, sx, sy + 18);
	sx += 150;

	// V-Speed at touchdown
	ctx.fillStyle = "#888888";
	ctx.fillText("V-SPEED", sx, sy);
	ctx.fillStyle = r.finalVSpeed > MAX_LANDING_SPEED ? "#ff4444" : "#ffffff";
	ctx.fillText(`${r.finalVSpeed.toFixed(0)} u/s`, sx, sy + 18);
	sx += 130;

	// H-Speed
	ctx.fillStyle = "#888888";
	ctx.fillText("H-SPEED", sx, sy);
	ctx.fillStyle = "#ffffff";
	ctx.fillText(`${r.finalHSpeed.toFixed(0)} u/s`, sx, sy + 18);
	sx += 130;

	// Fuel grade
	const fuelPct = ((r.fuelStarted - r.fuelUsed) / r.fuelStarted) * 100;
	const grade = getFuelGrade(fuelPct);
	ctx.fillStyle = "#888888";
	ctx.fillText("FUEL GRADE", sx, sy);
	ctx.fillStyle = grade.color;
	ctx.font = 'bold 22px "Courier New", monospace';
	ctx.fillText(grade.letter, sx, sy + 20);

	// Fuel bar
	sx += 60;
	ctx.fillStyle = "#888888";
	ctx.font = '14px "Courier New", monospace';
	ctx.fillText(`${fuelPct.toFixed(0)}%`, sx, sy + 18);

	// --- Altitude chart ---
	const chartX = 30;
	const chartY = 160;
	const chartW = CARD_WIDTH - 60;
	const chartH = 140;

	// Chart background
	ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
	ctx.fillRect(chartX, chartY, chartW, chartH);

	if (r.frames.length > 1) {
		let maxAlt = 0;
		for (const f of r.frames) {
			if (f.altitude > maxAlt) maxAlt = f.altitude;
		}
		if (maxAlt < 10) maxAlt = 10;
		const maxTime = r.frames[r.frames.length - 1].time || 1;

		// Altitude fill
		ctx.fillStyle = "rgba(0, 255, 136, 0.1)";
		ctx.beginPath();
		ctx.moveTo(chartX, chartY + chartH);
		for (const f of r.frames) {
			const fx = chartX + (f.time / maxTime) * chartW;
			const fy = chartY + chartH - (f.altitude / maxAlt) * chartH;
			ctx.lineTo(fx, fy);
		}
		ctx.lineTo(chartX + chartW, chartY + chartH);
		ctx.closePath();
		ctx.fill();

		// Altitude line
		ctx.strokeStyle = "#00ff88";
		ctx.lineWidth = 2;
		ctx.beginPath();
		for (let i = 0; i < r.frames.length; i++) {
			const fx = chartX + (r.frames[i].time / maxTime) * chartW;
			const fy = chartY + chartH - (r.frames[i].altitude / maxAlt) * chartH;
			if (i === 0) ctx.moveTo(fx, fy);
			else ctx.lineTo(fx, fy);
		}
		ctx.stroke();

		// Speed line (overlay in different color)
		ctx.strokeStyle = "rgba(255, 170, 0, 0.5)";
		ctx.lineWidth = 1;
		let maxSpeed = 1;
		for (const f of r.frames) {
			const s = Math.abs(f.vSpeed);
			if (s > maxSpeed) maxSpeed = s;
		}
		ctx.beginPath();
		for (let i = 0; i < r.frames.length; i++) {
			const fx = chartX + (r.frames[i].time / maxTime) * chartW;
			const fy =
				chartY + chartH - (Math.abs(r.frames[i].vSpeed) / maxSpeed) * chartH;
			if (i === 0) ctx.moveTo(fx, fy);
			else ctx.lineTo(fx, fy);
		}
		ctx.stroke();

		// Chart labels
		ctx.fillStyle = "#00ff88";
		ctx.font = '10px "Courier New", monospace';
		ctx.textAlign = "left";
		ctx.fillText("ALT", chartX + 4, chartY + 12);
		ctx.fillStyle = "rgba(255, 170, 0, 0.7)";
		ctx.fillText("SPD", chartX + 30, chartY + 12);
	}

	// --- Terrain silhouette with descent path ---
	const terrainY = 330;
	const terrainH = 120;
	const terrainW = CARD_WIDTH - 60;

	if (r.terrainPoints.length > 1) {
		const minTX = r.terrainPoints[0].x;
		const maxTX = r.terrainPoints[r.terrainPoints.length - 1].x;
		const rangeX = maxTX - minTX || 1;
		let minTY = Infinity;
		let maxTY = -Infinity;
		for (const p of r.terrainPoints) {
			if (p.y < minTY) minTY = p.y;
			if (p.y > maxTY) maxTY = p.y;
		}
		const rangeY = maxTY - minTY || 1;

		// Terrain fill
		ctx.fillStyle = "rgba(255, 255, 255, 0.05)";
		ctx.beginPath();
		ctx.moveTo(30, terrainY + terrainH);
		for (const p of r.terrainPoints) {
			const px = 30 + ((p.x - minTX) / rangeX) * terrainW;
			const py = terrainY + ((p.y - minTY) / rangeY) * terrainH;
			ctx.lineTo(px, py);
		}
		ctx.lineTo(30 + terrainW, terrainY + terrainH);
		ctx.closePath();
		ctx.fill();

		// Terrain outline
		ctx.strokeStyle = "#333333";
		ctx.lineWidth = 1;
		ctx.beginPath();
		for (let i = 0; i < r.terrainPoints.length; i++) {
			const px = 30 + ((r.terrainPoints[i].x - minTX) / rangeX) * terrainW;
			const py =
				terrainY + ((r.terrainPoints[i].y - minTY) / rangeY) * terrainH;
			if (i === 0) ctx.moveTo(px, py);
			else ctx.lineTo(px, py);
		}
		ctx.stroke();

		// Descent path from telemetry (x positions mapped to terrain space)
		if (r.frames.length > 1) {
			ctx.strokeStyle = "rgba(68, 136, 255, 0.6)";
			ctx.lineWidth = 1.5;
			ctx.setLineDash([3, 3]);
			ctx.beginPath();
			for (let i = 0; i < r.frames.length; i++) {
				// Approximate x from altitude change... we don't have x in telemetry
				// Use the lander's final position and work backward from altitude
				// For now, spread descent path across the terrain width proportionally
				const fx = 30 + (i / r.frames.length) * terrainW;
				const altNorm = r.frames[i].altitude / (r.frames[0].altitude || 1);
				const fy = terrainY + (1 - altNorm) * terrainH * 0.9;
				if (i === 0) ctx.moveTo(fx, fy);
				else ctx.lineTo(fx, fy);
			}
			ctx.stroke();
			ctx.setLineDash([]);
		}
	}

	// Footer
	// Historic mission "your value vs theirs" comparison line. Only
	// renders when the caller passed historicReference (i.e. this is a
	// HistoricMission). Sits above the footer.
	if (r.historicReference) {
		const ref = r.historicReference;
		const yourBeat = ref.yourValue < ref.theirValue;
		ctx.textAlign = "center";
		ctx.font = 'bold 14px "Courier New", monospace';
		ctx.fillStyle = yourBeat ? "#00ff88" : "#ffaa00";
		ctx.fillText(
			`${ref.label.toUpperCase()}: YOU ${ref.yourValue} ${ref.unit} · REF ${ref.theirValue} ${ref.unit}`,
			CARD_WIDTH / 2,
			CARD_HEIGHT - 40,
		);
	}

	ctx.fillStyle = "#333333";
	ctx.font = '11px "Courier New", monospace';
	ctx.textAlign = "center";
	ctx.fillText(
		"MOONLANDER ENHANCED  |  moonlander.dev",
		CARD_WIDTH / 2,
		CARD_HEIGHT - 18,
	);

	// Lander type
	ctx.textAlign = "right";
	ctx.fillStyle = "#444444";
	ctx.fillText(
		new Date().toISOString().slice(0, 10),
		CARD_WIDTH - 30,
		CARD_HEIGHT - 18,
	);
}
