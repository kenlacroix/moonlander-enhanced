import { Game } from "./game/Game";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
if (!canvas) {
	throw new Error("Canvas element #game-canvas not found");
}

// Check URL parameters
const params = new URLSearchParams(window.location.search);
const urlSeed = params.get("seed");
const embedMode = params.get("embed") === "1";

const game = new Game(
	canvas,
	urlSeed ? Number.parseInt(urlSeed, 10) : undefined,
	embedMode,
);
game.start();
