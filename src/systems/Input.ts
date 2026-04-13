export interface InputState {
	thrustUp: boolean;
	rotateLeft: boolean;
	rotateRight: boolean;
	restart: boolean;
}

export class Input {
	private keys = new Set<string>();
	private _restartPressed = false;

	constructor() {
		window.addEventListener("keydown", (e) => {
			this.keys.add(e.code);
			if (e.code === "KeyR" || e.code === "Space") {
				this._restartPressed = true;
			}
			// Prevent scrolling with arrow keys / space
			if (
				["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(
					e.code,
				)
			) {
				e.preventDefault();
			}
		});

		window.addEventListener("keyup", (e) => {
			this.keys.delete(e.code);
		});
	}

	getState(): InputState {
		const state: InputState = {
			thrustUp: this.keys.has("ArrowUp") || this.keys.has("KeyW"),
			rotateLeft: this.keys.has("ArrowLeft") || this.keys.has("KeyA"),
			rotateRight: this.keys.has("ArrowRight") || this.keys.has("KeyD"),
			restart: this._restartPressed,
		};
		this._restartPressed = false;
		return state;
	}
}
