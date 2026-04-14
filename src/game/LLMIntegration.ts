/**
 * LLM integration for mission briefings, commentary, and artifact scanning.
 * Extracted from Game.ts to isolate async LLM operations from game logic.
 */

import type { LLMConfig } from "../api/LLMProvider";
import { getMissionBriefing } from "../api/MissionBriefing";
import { getMissionControlCommentary } from "../api/MissionControl";
import {
	type Artifact,
	type ArtifactType,
	checkArtifactScan,
	getArtifactPrompt,
} from "./Artifacts";
import type { LanderState } from "./Lander";
import type { Mission } from "./Missions";

/** Mutable handle for LLM methods to write results back to Game state. */
export interface LLMStateHandle {
	llmText: string;
	llmLoading: boolean;
	artifactText: string;
}

export class LLMIntegration {
	constructor(private getConfig: () => LLMConfig | null) {}

	fetchBriefing(state: LLMStateHandle, mission: Mission): void {
		const config = this.getConfig();
		if (!config) {
			state.llmText = "";
			return;
		}
		state.llmText = "";
		state.llmLoading = true;
		getMissionBriefing(config, mission, (chunk) => {
			state.llmText += chunk;
		})
			.catch(() => {
				// API error — silent, game is playable without it
			})
			.finally(() => {
				state.llmLoading = false;
			});
	}

	fetchCommentary(
		state: LLMStateHandle,
		lander: LanderState,
		score: number,
		landed: boolean,
	): void {
		const config = this.getConfig();
		if (!config) {
			state.llmText = "";
			return;
		}
		state.llmText = "";
		state.llmLoading = true;
		getMissionControlCommentary(config, lander, score, landed, (chunk) => {
			state.llmText += chunk;
		})
			.catch(() => {
				// API error — silent
			})
			.finally(() => {
				state.llmLoading = false;
			});
	}

	scanNearbyArtifact(
		state: LLMStateHandle,
		artifacts: Artifact[],
		landerX: number,
	): void {
		const scanned = checkArtifactScan(artifacts, landerX);
		if (!scanned) return;

		scanned.scanned = true;
		const config = this.getConfig();

		if (config) {
			const prompt = getArtifactPrompt(scanned);
			state.artifactText = "";
			import("../api/LLMProvider")
				.then(({ streamCompletion }) => {
					streamCompletion(
						config,
						[
							{
								role: "system",
								content:
									"You are a lunar historian. Give one fascinating, specific historical fact in 1-2 sentences. No markdown. Plain text only.",
							},
							{ role: "user", content: prompt },
						],
						(chunk) => {
							state.artifactText += chunk;
						},
					)
						.then((full) => {
							scanned.fact = full;
						})
						.catch(() => {
							scanned.fact = getOfflineFact(scanned.type);
							state.artifactText = scanned.fact;
						});
				})
				.catch(() => {
					scanned.fact = getOfflineFact(scanned.type);
					state.artifactText = scanned.fact;
				});
		} else {
			scanned.fact = getOfflineFact(scanned.type);
			state.artifactText = scanned.fact;
		}
	}
}

export function getOfflineFact(type: ArtifactType): string {
	switch (type) {
		case "flag":
			return "Five of the six Apollo flags are likely still standing. Apollo 11's flag was knocked over by the ascent engine exhaust.";
		case "rover-tracks":
			return "The Lunar Roving Vehicle had a top speed of 11.2 mph. It cost $38 million in 1971 and was left on the Moon after each mission.";
		case "debris":
			return "Six Apollo descent stages sit on the Moon today. They served as launch pads for the ascent stage and were never designed to return.";
		case "footprints":
			return "With no wind or water, the Apollo bootprints will remain undisturbed for millions of years, slowly eroded only by micrometeorites.";
		case "plaque":
			return "A small aluminum figurine called 'Fallen Astronaut' was placed on the Moon by Apollo 15 in 1971, memorializing 14 astronauts and cosmonauts who died.";
		default:
			return "The Apollo program left over 800 pounds of equipment on the lunar surface across six landing sites.";
	}
}
