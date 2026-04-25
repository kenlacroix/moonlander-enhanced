import { APOLLO_13, APOLLO_MISSIONS } from "../data/apolloMissions";
import { ARTEMIS_MISSIONS } from "../data/artemisMissions";
import { LUNA_MISSIONS } from "../data/lunaMissions";
import {
	computeHistoricYourValue,
	generateFlightReport,
} from "../systems/FlightRecorder";
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
import { buildShareUrl } from "../utils/shareUrl";
import { startAgentReplay } from "./AgentReplay";
import {
	buildAuthenticState,
	hasSeenAuthenticIntro,
	loadAuthenticPreference,
	markAuthenticIntroSeen,
	saveAuthenticPreference,
	TUTORIAL_FRAMES,
} from "./AuthenticMode";
import type { Game } from "./Game";
import { nextPreset, prevPreset } from "./GravityPresets";
import { type HistoricMission, isHistoricMission } from "./HistoricMission";
import {
	CAMPAIGN,
	getDailyMission,
	isMissionUnlocked,
	MISSIONS,
	type Mission,
} from "./Missions";
import { getTerrainHeightAt } from "./Physics";
import { generateRandomMission } from "./RandomMission";
import { createRelayState } from "./RelayMode";

const TITLE_OPTION_COUNT = 8;

/**
 * Historic missions, grouped by era for the mission-select grouping.
 * Order matters: this array order is what the menu cycles through.
 * 1960s Soviet first, then 1960s-70s Apollo (including Apollo 13's
 * non-landing survive mission), then 2020s Artemis.
 */
export const HISTORIC_MISSIONS: HistoricMission[] = [
	...LUNA_MISSIONS,
	...APOLLO_MISSIONS,
	APOLLO_13,
	...ARTEMIS_MISSIONS,
];

export function updateTitle(game: Game, input: InputState): void {
	if (input.menuUp)
		game.titleSelection =
			(game.titleSelection - 1 + TITLE_OPTION_COUNT) % TITLE_OPTION_COUNT;
	if (input.menuDown)
		game.titleSelection = (game.titleSelection + 1) % TITLE_OPTION_COUNT;
	if (input.menuSelect) {
		if (game.titleSelection === 2) {
			game.startTraining();
		} else if (game.titleSelection === 3) {
			game.gameMode = "ai-theater";
			game.selectedMission = 0;
			game.status = "menu";
		} else if (game.titleSelection === 4) {
			startEditor(game);
		} else if (game.titleSelection === 5) {
			game.gameMode = "freeplay";
			selectMission(game, getDailyMission());
		} else if (game.titleSelection === 6) {
			game.gameMode = "historic";
			game.selectedMission = 0;
			game.status = "menu";
		} else if (game.titleSelection === 7) {
			// Sprint 7.1 PR 1.5 — roll a fresh Random Mission and drop
			// straight into flight. Offline briefing is prerendered on the
			// mission object so no GENERATING overlay is needed for the
			// no-API-key path; the LLM call still runs in the background
			// for players who configured a key.
			game.gameMode = "freeplay";
			startRandomMission(game);
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
	const missions = getMenuMissions(game.gameMode);

	// Tutorial overlay tick — while active, block menu nav and launch.
	// Timeout OR dismiss (menuSelect / menuBack) closes it and writes the
	// seen-key so it never reappears for this mission.
	if (game.tutorialOverlay) {
		game.tutorialOverlay.framesRemaining -= 1;
		const dismissed = input.menuSelect || input.menuBack;
		if (game.tutorialOverlay.framesRemaining <= 0 || dismissed) {
			markAuthenticIntroSeen(game.tutorialOverlay.missionId);
			game.tutorialOverlay = null;
		}
		game.renderMenu();
		return;
	}

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
		} else if (
			isHistoricMission(mission) &&
			mission.kind === "landing" &&
			loadAuthenticPreference(mission.id) &&
			!hasSeenAuthenticIntro(mission.id)
		) {
			// First launch of Authentic on this mission — pop the tutorial
			// overlay instead of launching. The next menuSelect (or the 3s
			// timeout) dismisses it and the player can launch for real.
			game.tutorialOverlay = {
				missionId: mission.id,
				framesRemaining: TUTORIAL_FRAMES,
			};
		} else {
			selectMission(game, mission);
		}
	}
	// [A] toggle for Authentic Mode on the historic mission-select screen.
	// Context-scoped so it doesn't fight the in-flight autopilot-annotations
	// consumer (which only runs when game.status === "playing").
	if (input.toggleAnnotations && game.gameMode === "historic") {
		const mission = missions[game.selectedMission];
		if (mission && isHistoricMission(mission) && mission.kind === "landing") {
			const current = loadAuthenticPreference(mission.id);
			saveAuthenticPreference(mission.id, !current);
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
				const m = getMenuMissions(game.gameMode);
				const idx = m.findIndex((mi) => mi.seed === run.seed);
				if (idx >= 0) game.selectedMission = idx;
			}
		});
	}
	if (input.menuBack) game.status = "title";
	game.renderMenu();
}

export function handlePostFlightInput(game: Game, input: InputState): void {
	if (input.exportGhost && game.status === "landed") {
		downloadGhost(
			game.seed,
			game.currentFlight?.authenticMode ? "authentic" : "vanilla",
		);
	}
	if (
		input.flightReport &&
		(game.status === "landed" || game.status === "crashed")
	) {
		const historicRef =
			game.activeMission &&
			isHistoricMission(game.activeMission) &&
			game.activeMission.kind === "landing"
				? buildHistoricReference(game)
				: undefined;
		const authEra: "apollo" | "artemis" | undefined =
			game.currentFlight?.authenticMode && game.currentFlight.authenticState
				? game.currentFlight.authenticState.era
				: undefined;
		generateFlightReport(
			game.lander,
			game.terrain,
			game.telemetry.frames,
			game.activeMission?.name ?? `SEED ${game.seed}`,
			game.seed,
			game.score,
			game.status === "landed",
			historicRef,
			authEra,
		);
	}
	if (input.restart && game.status !== "playing") {
		handleRestart(game);
		return;
	}
	if (input.menuBack && game.status === "playing") {
		game.audio.setThruster(false);
		game.audio.soundtrack.stop();
		if (game.aiTheater.isActive) game.aiTheater.stop();
		game.aiTheaterComparison = null;
		game.currentFlight = null;
		game.status = "menu";
		return;
	}
	// Auto-landing missions (Luna 9) default the autopilot ON for
	// spectator-mode descent. But the PID doesn't always converge on
	// Luna 9's craft profile (low thrust 0.85x + low mass 0.7x) and
	// overshoots laterally on seed 91966 specifically. Pre-Part-2 this
	// was force-locked ON — player watched it crash every time. Allow
	// [P] to toggle so the player can take over and finish the descent
	// manually. Mission still auto-starts in autopilot mode; the change
	// is just "you can now rescue it."
	if (input.toggleAutopilot && game.status === "playing")
		game.autopilot.toggle();
	if (input.toggleAnnotations && game.status === "playing")
		game.autopilot.toggleAnnotations();
	if (input.toggleRetroSkin) {
		game.toggleRetroSkin();
	}
	// Sprint 7.4 — Space (or click via menuSelect) skips to the next
	// queued campaign chatter line. Only meaningful when a multi-line
	// briefing or post-landing sequence is mid-display. Replaying
	// players don't want to re-read the same Hoshi analysis.
	if (input.menuSelect && game.campaignHasQueuedLines) {
		game.campaignChatter.skip();
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
		if (
			game.activeMission &&
			isHistoricMission(game.activeMission) &&
			game.activeMission.kind === "landing"
		) {
			game.missionChatter.update({
				lander: game.lander,
				altitude,
				startingFuel:
					game.activeMission.difficulty?.startingFuel ?? STARTING_FUEL,
			});
		}
		// Sprint 7.4 — Campaign chatter update fires the same altitude/fuel/
		// drift triggers MissionChatter does, but for Campaign missions only.
		if (
			game.gameMode === "campaign" &&
			game.activeMission?.narrative?.enabled
		) {
			game.campaignChatter.update({
				lander: game.lander,
				altitude,
				startingFuel:
					game.activeMission.difficulty?.startingFuel ?? STARTING_FUEL,
			});
		}
	}
	game.missionChatter.tick(dt);
	game.campaignChatter.tick(dt);
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
	// Sprint 7.2 — visual RCS thrusters on lander corners while RCS is firing.
	// `rcsFiring` + `rcsFiringDirection` are set by updateLander only when
	// rotate input + rcs > 0; v2 legacy integrator pins them to false/0 so
	// v2 replays render identically. Reading direction from lander state
	// (set by the integrator from input) instead of live input lets this
	// run from the render path (updateFlightVisuals) without requiring
	// InputState access, and stays correct on the first rotate frame
	// (where angularVel is still 0 from the prior tick).
	if (game.lander.rcsFiring && game.status === "playing") {
		const dir = game.lander.rcsFiringDirection;
		const direction: -1 | 1 = dir === -1 ? -1 : 1;
		game.particles.emitRCS(
			game.lander.x,
			game.lander.y,
			game.lander.angle,
			direction,
		);
		// Sprint 7.2 — first-spin tutorial trigger. Fires once per player,
		// only under v3 physics (no point showing "rotation has momentum" to
		// a player replaying a v2 ghost). 180 frames = 3 seconds at 60Hz.
		game.maybeShowRcsTutorial();
	}
	// First-spin tutorial countdown (ticks independently of rcsFiring so a
	// player who triggers it then releases the key still sees the full message).
	if (game.rcsTutorialFramesRemaining > 0) {
		game.rcsTutorialFramesRemaining -= 1;
	}
	game.camera.follow(game.lander.x, game.lander.y, dt);
	if (game.achievementToastTimer > 0) {
		game.achievementToastTimer -= dt;
		if (game.achievementToastTimer <= 0) game.achievementToast = null;
	}
}

/**
 * Returns the mission list shown on the mission-select screen for the
 * active gameMode. Centralizing this means updateMenu, ghost-import, and
 * any future mission-list consumer share one source of truth.
 */
export function getMenuMissions(
	mode: "freeplay" | "campaign" | "ai-theater" | "historic",
): readonly Mission[] {
	if (mode === "campaign") return CAMPAIGN;
	if (mode === "historic") return HISTORIC_MISSIONS;
	return MISSIONS;
}

export function selectMission(game: Game, mission: Mission): void {
	game.activeMission = mission;
	game.setSeed(mission.seed);
	// Default to "landing" for everything; historic missions opt into
	// "survive" or "auto-landing" via their `kind` discriminator. This
	// must be set before reset() so the physics path branches correctly.
	game.missionMode = isHistoricMission(mission) ? mission.kind : "landing";
	// Sprint 5.5 — construct flight-scoped Authentic config for historic
	// landing missions. Non-historic and non-landing missions stay null.
	if (isHistoricMission(mission) && mission.kind === "landing") {
		const authenticOn = loadAuthenticPreference(mission.id);
		game.currentFlight = {
			authenticMode: authenticOn,
			authenticState: authenticOn
				? buildAuthenticState(mission, mission.seed, false)
				: null,
		};
	} else {
		game.currentFlight = null;
	}
	game.reset();
	// Sprint 5 Part B shipped auto-landing missions (Luna 9) with autopilot
	// force-enabled — player watched it fly. Shipped broken in v0.5.9.1:
	// autopilot PID overshoots on luna-9's craft profile and crashes every
	// time. v0.6.2.1 unlocked [P] so players could rescue, but by the time
	// overshoot is visible the lander is 18 px above terrain at vx=120 —
	// too late for a human save.
	//
	// v0.6.2.2: flip the default. Autopilot starts OFF on auto-landing
	// missions. Player flies Luna 9 themselves. [P] still engages the
	// autopilot mid-flight if they want to try the spectator experience.
	// Preserves the "auto-landing" kind for discriminated-union typing
	// (moments-free, no MAX_FLIGHT_DURATION) without forcing the crash.
	game.llm.fetchBriefing(
		game,
		mission,
		game.currentFlight?.authenticMode ?? false,
	);
	updateURL(mission.seed);
	if (isHistoricMission(mission) && mission.kind === "landing") {
		game.missionChatter.start(mission.facts, game.getLLMConfig());
	}
	// Sprint 7.4 — Campaign narrative dialogue. Activates only when the
	// player launched in Campaign mode AND the mission opted into the
	// narrative field. Free Play, Historic, and AI Theater never reach
	// this branch (gameMode is exclusive). The two chatter systems
	// (MissionChatter for Historic, CampaignChatter for Campaign) never
	// fire simultaneously — gameMode === "historic" vs "campaign" is
	// the discriminator.
	if (game.gameMode === "campaign" && mission.narrative?.enabled) {
		game.campaignChatter.start(mission.id, game.getLLMConfig());
	}
	if (game.gameMode === "ai-theater") {
		game.aiTheater.start(
			mission.seed,
			game.gravityPreset,
			mission.difficulty?.archetype,
		);
		game.aiTheater.setWatchBestHandler(() => {
			startAgentReplay(game, mission.seed);
		});
	}
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
	if (game.aiTheater.isActive) game.aiTheater.stop();
	game.aiTheaterComparison = null;
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
	// Clear any stale ?cfg= from a previous Random Mission so the new
	// seed-only URL doesn't silently decode back into the old random.
	url.searchParams.delete("cfg");
	window.history.replaceState(null, "", url.toString());
}

/**
 * Sprint 7.1 PR 1.5 — roll a fresh Random Mission and drop straight
 * into flight. Updates `?cfg=` in the URL so the current flight is
 * immediately shareable. Leaderboard is bypassed (see CollisionHandler).
 */
export function startRandomMission(game: Game): void {
	const mission = generateRandomMission();
	game.gameMode = "freeplay";
	selectMission(game, mission);
	// Replace `?seed=N` with `?cfg=<encoded>` so copy-URL actually shares
	// the rolled archetype (not just the seed, which a fresh re-roll on
	// someone else's browser would pair with a different archetype).
	const cfg = buildShareUrl({
		seed: mission.seed,
		archetype: mission.difficulty?.archetype,
	});
	if (cfg) {
		window.history.replaceState(null, "", cfg);
	}
}

/**
 * Build the "your value vs theirs" reference for the share card on a
 * historic-landing mission. Caller has already confirmed activeMission
 * is a HistoricMission with kind === "landing".
 */
function buildHistoricReference(game: Game):
	| {
			label: string;
			yourValue: number;
			theirValue: number;
			unit: string;
	  }
	| undefined {
	const m = game.activeMission;
	if (!m || !isHistoricMission(m) || m.kind !== "landing") return undefined;
	const facts = m.facts;
	// computeHistoricYourValue dispatches on the fact-sheet's unit string.
	// We pass everything it might need; unused fields cost nothing.
	// Drift = distance from nearest pad center at touchdown.
	const dur = Math.max(0.1, game.telemetry.getDuration());
	const drift = game.terrain.pads.reduce((best, p) => {
		const d = Math.abs(game.lander.x - (p.x + p.width / 2));
		return d < best ? d : best;
	}, Infinity);
	const yourValue = computeHistoricYourValue({
		label: facts.historicalReferenceLabel,
		unit: facts.historicalReferenceUnit,
		fuelRemaining: game.lander.fuel,
		flightDurationSec: dur,
		driftFromPadCenterPx: Number.isFinite(drift) ? drift : 0,
	});
	return {
		label: facts.historicalReferenceLabel,
		yourValue,
		theirValue: facts.historicalReferenceValue,
		unit: facts.historicalReferenceUnit,
	};
}
