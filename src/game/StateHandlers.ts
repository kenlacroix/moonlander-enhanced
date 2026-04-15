import { generateFlightReport } from "../systems/FlightRecorder";
import { downloadGhost, uploadGhost } from "../systems/GhostReplay";
import type { InputState } from "../systems/Input";
import {
	createEditorState,
	editorClick,
	editorDrag,
	editorRelease,
	editorUndo,
	renderEditor,
	serializeEditor,
} from "../ui/TerrainEditor";
import { LANDER_HEIGHT, STARTING_FUEL } from "../utils/constants";
import { startAgentReplay } from "./AgentReplay";
import type { Game } from "./Game";
import { nextPreset, prevPreset } from "./GravityPresets";
import {
	CAMPAIGN,
	isMissionUnlocked,
	MISSIONS,
	type Mission,
} from "./Missions";
import { getTerrainHeightAt } from "./Physics";
import { createRelayState } from "./RelayMode";

export function updateTitle(game: Game, input: InputState): void {
	if (input.menuUp) game.titleSelection = (game.titleSelection - 1 + 4) % 4;
	if (input.menuDown) game.titleSelection = (game.titleSelection + 1) % 4;
	if (input.menuSelect) {
		if (game.titleSelection === 2) {
			game.startTraining();
		} else if (game.titleSelection === 3) {
			startEditor(game);
		} else {
			game.gameMode = game.titleSelection === 0 ? "freeplay" : "campaign";
			game.selectedMission = 0;
			game.status = "menu";
		}
	}
	if (input.openSettings) {
		game.showSettings();
	}
	game.renderTitle();
}

export function updateTraining(game: Game, input: InputState): void {
	if (input.menuBack) {
		game.stopTraining();
		game.status = "title";
	}
	if (
		input.menuSelect &&
		game.trainingLoop &&
		game.trainingLoop.agent.episodeCount > 0
	) {
		game.stopTraining();
		startAgentReplay(game);
	}
	game.renderTraining();
}

export function updateEditor(game: Game, input: InputState): void {
	if (!game.editorState) return;
	if (input.menuBack) {
		game.clearEditor();
		game.status = "title";
		return;
	}
	if (input.menuSelect) {
		game.playCustomTerrain();
		return;
	}
	if (input.toggleAutopilot)
		game.editorState.placingPad = !game.editorState.placingPad;
	if (input.openSettings) {
		const encoded = serializeEditor(game.editorState);
		const url = new URL(window.location.href);
		url.searchParams.set("custom", encoded);
		url.searchParams.delete("seed");
		navigator.clipboard?.writeText(url.toString());
		window.history.replaceState(null, "", url.toString());
	}
	renderEditor(game.ctx, game.editorState);
}

export function updateMenu(game: Game, input: InputState): void {
	const missions = game.gameMode === "campaign" ? CAMPAIGN : MISSIONS;
	if (input.menuUp)
		game.selectedMission =
			(game.selectedMission - 1 + missions.length) % missions.length;
	if (input.menuDown)
		game.selectedMission = (game.selectedMission + 1) % missions.length;
	if (input.menuSelect) {
		const mission = missions[game.selectedMission];
		if (
			game.gameMode === "campaign" &&
			!isMissionUnlocked(mission.id, game.campaignCompleted)
		) {
			// Locked
		} else {
			selectMission(game, mission);
		}
	}
	if (input.toggleRelay && game.gameMode === "freeplay") {
		game.relay = game.relay ? null : createRelayState();
	}
	if (game.gameMode === "freeplay") {
		if (input.rotateLeft) game.gravityPreset = prevPreset(game.gravityPreset);
		if (input.rotateRight) game.gravityPreset = nextPreset(game.gravityPreset);
	}
	if (input.importGhost) {
		uploadGhost().then((run) => {
			if (run) {
				const m = game.gameMode === "campaign" ? CAMPAIGN : MISSIONS;
				const idx = m.findIndex((mi) => mi.seed === run.seed);
				if (idx >= 0) game.selectedMission = idx;
			}
		});
	}
	if (input.menuBack) game.status = "title";
	game.renderMenu();
}

export function handlePostFlightInput(game: Game, input: InputState): void {
	if (input.exportGhost && game.status === "landed") downloadGhost(game.seed);
	if (
		input.flightReport &&
		(game.status === "landed" || game.status === "crashed")
	) {
		generateFlightReport(
			game.lander,
			game.terrain,
			game.telemetry.frames,
			game.activeMission?.name ?? `SEED ${game.seed}`,
			game.seed,
			game.score,
			game.status === "landed",
		);
	}
	if (input.restart && game.status !== "playing") {
		handleRestart(game);
		return;
	}
	if (input.menuBack && game.status === "playing") {
		game.audio.setThruster(false);
		game.audio.soundtrack.stop();
		game.status = "menu";
		return;
	}
	if (input.toggleAutopilot && game.status === "playing")
		game.autopilot.toggle();
	if (input.toggleAnnotations && game.status === "playing")
		game.autopilot.toggleAnnotations();
	if (input.toggleRetroSkin) {
		game.toggleRetroSkin();
	}
}

export function updateFlightVisuals(game: Game, dt: number): void {
	if (game.status === "playing") {
		const terrainY = getTerrainHeightAt(game.lander.x, game.terrain.points);
		const altitude = terrainY - (game.lander.y + LANDER_HEIGHT / 2);
		game.telemetry.update(
			dt,
			altitude,
			game.lander.vy,
			game.lander.vx,
			game.lander.fuel,
		);
		game.audio.updateSoundtrack(Math.max(0, Math.min(1, 1 - altitude / 500)));
	}
	game.particles.update(dt);
	game.audio.setThruster(game.lander.thrusting && game.status === "playing");
	if (
		game.lander.fuel > 0 &&
		game.lander.fuel < STARTING_FUEL * 0.15 &&
		game.status === "playing"
	) {
		game.updateFuelWarning(dt);
	}
	if (game.lander.thrusting && game.status === "playing") {
		const rad = (game.lander.angle + 90) * (Math.PI / 180);
		game.particles.emitExhaust(
			game.lander.x + Math.cos(rad) * 18,
			game.lander.y + Math.sin(rad) * 18,
			game.lander.angle,
		);
	}
	game.camera.follow(game.lander.x, game.lander.y, dt);
	if (game.achievementToastTimer > 0) {
		game.achievementToastTimer -= dt;
		if (game.achievementToastTimer <= 0) game.achievementToast = null;
	}
}

function selectMission(game: Game, mission: Mission): void {
	game.activeMission = mission;
	game.setSeed(mission.seed);
	game.reset();
	game.llm.fetchBriefing(game, mission);
	updateURL(mission.seed);
}

function handleRestart(game: Game): void {
	if (game.isEmbed) {
		game.reset();
		return;
	}
	if (
		game.gameMode === "campaign" &&
		game.status === "landed" &&
		game.activeMission
	) {
		const nextIdx = game.selectedMission + 1;
		if (nextIdx < CAMPAIGN.length) {
			game.selectedMission = nextIdx;
			game.activeMission = CAMPAIGN[nextIdx];
			game.setSeed(game.activeMission.seed);
			game.reset();
			return;
		}
	}
	game.status = "menu";
}

function startEditor(game: Game): void {
	game.editorState = createEditorState();
	game.status = "editor";
	const canvas = game.canvas;
	canvas.addEventListener("mousedown", (e) => {
		if (game.status !== "editor" || !game.editorState) return;
		const rect = canvas.getBoundingClientRect();
		editorClick(
			game.editorState,
			e.clientX - rect.left,
			e.clientY - rect.top,
			e.button === 2,
		);
	});
	canvas.addEventListener("mousemove", (e) => {
		if (game.status !== "editor" || !game.editorState) return;
		if (e.buttons === 1) {
			const rect = canvas.getBoundingClientRect();
			editorDrag(game.editorState, e.clientX - rect.left, e.clientY - rect.top);
		}
	});
	canvas.addEventListener("mouseup", () => {
		if (game.editorState) editorRelease(game.editorState);
	});
	canvas.addEventListener("contextmenu", (e) => {
		if (game.status === "editor") e.preventDefault();
	});
	document.addEventListener("keydown", (e) => {
		if (game.status !== "editor" || !game.editorState) return;
		if (e.ctrlKey && e.code === "KeyZ") {
			e.preventDefault();
			editorUndo(game.editorState);
		}
	});
}

function updateURL(seed: number | null): void {
	const url = new URL(window.location.href);
	if (seed !== null) url.searchParams.set("seed", String(seed));
	else url.searchParams.delete("seed");
	window.history.replaceState(null, "", url.toString());
}
