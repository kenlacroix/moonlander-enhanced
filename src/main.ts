import { Game } from "./game/Game";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
if (!canvas) {
	throw new Error("Canvas element #game-canvas not found");
}

const game = new Game(canvas);
game.start();
