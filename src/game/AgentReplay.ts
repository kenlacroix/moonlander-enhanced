import type { RLAgent } from "../ai/RLAgent";
import { LANDER_HEIGHT, WORLD_WIDTH } from "../utils/constants";
import type { Game } from "./Game";
import { createLander, updateLander } from "./Lander";
import { getLanderType } from "./LanderTypes";
import { checkCollision } from "./Physics";
import { generateTerrain } from "./Terrain";

function getAgent(game: Game): RLAgent | null {
	if (game.aiTheater.isActive) return game.aiTheater.getAgent();
	return game.trainingLoop?.agent ?? null;
}

export function startAgentReplay(game: Game, seed?: number): void {
	const agent = getAgent(game);
	if (!agent) return;
	const replaySeed = seed ?? game.seed ?? 1969;
	game.setSeed(replaySeed);
	game.activeMission = null;
	game.terrain = generateTerrain(game.seed);
	game.lander = createLander(WORLD_WIDTH / 2, 80, getLanderType());
	game.particles.clear();
	game.resetCamera();
	game.resetLoop();
	agent.epsilon = 0;
	game.status = "agent-replay";
}

export function stepAgentReplay(game: Game, dt: number): void {
	const agent = getAgent(game);
	if (game.lander.status !== "flying" || !agent) return;
	const state = agent.getState(game.lander, game.terrain);
	const action = agent.chooseAction(state);
	const agentInput = agent.actionToInput(action);
	updateLander(game.lander, agentInput, dt);
	const result = checkCollision(game.lander, game.terrain);
	if (result.collided) {
		if (result.safeLanding && result.onPad) {
			game.lander.status = "landed";
			game.lander.vy = 0;
			game.lander.vx = 0;
			game.lander.y = result.onPad.y - LANDER_HEIGHT / 2;
			game.audio.playSuccess();
		} else {
			game.lander.status = "crashed";
			game.particles.emitExplosion(game.lander.x, game.lander.y);
			game.camera.shake(15);
			game.audio.playCrash();
		}
	}
}

export function updateAgentReplayFrame(game: Game, dt: number): void {
	game.particles.update(dt);
	if (game.lander.thrusting) {
		const rad = (game.lander.angle + 90) * (Math.PI / 180);
		game.particles.emitExhaust(
			game.lander.x + Math.cos(rad) * 18,
			game.lander.y + Math.sin(rad) * 18,
			game.lander.angle,
		);
	}
	game.camera.follow(game.lander.x, game.lander.y, dt);
	const input = game.input.getState();
	if (input.menuBack) {
		if (game.aiTheater.isActive) game.aiTheater.stop();
		game.status = "title";
		return;
	}
	if (input.restart && game.lander.status !== "flying") {
		startAgentReplay(game);
		return;
	}
	game.renderAgentReplay();
}
