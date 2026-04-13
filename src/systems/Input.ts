export interface InputState {
	thrustUp: boolean;
	rotateLeft: boolean;
	rotateRight: boolean;
	restart: boolean;
	menuUp: boolean;
	menuDown: boolean;
	menuSelect: boolean;
	menuBack: boolean;
	toggleAutopilot: boolean;
}

/** Touch zone identifiers */
type TouchZone = "left" | "right" | "thrust" | "none";

export class Input {
	private keys = new Set<string>();
	private _restartPressed = false;
	private _menuUpPressed = false;
	private _menuDownPressed = false;
	private _menuSelectPressed = false;
	private _menuBackPressed = false;
	private _autopilotToggled = false;

	// Touch state
	private touchActive = new Map<number, TouchZone>();
	private _touchRestart = false;
	private _touchMenuSelect = false;
	readonly isTouchDevice: boolean;

	constructor() {
		this.isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;

		window.addEventListener("keydown", (e) => {
			this.keys.add(e.code);
			if (e.code === "KeyR") {
				this._restartPressed = true;
			}
			if (e.code === "ArrowUp" || e.code === "KeyW") {
				this._menuUpPressed = true;
			}
			if (e.code === "ArrowDown" || e.code === "KeyS") {
				this._menuDownPressed = true;
			}
			if (e.code === "Enter" || e.code === "Space") {
				this._menuSelectPressed = true;
			}
			if (e.code === "Escape" || e.code === "KeyM") {
				this._menuBackPressed = true;
			}
			if (e.code === "KeyP") {
				this._autopilotToggled = true;
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

		// Touch events
		window.addEventListener("touchstart", (e) => {
			e.preventDefault();
			for (let i = 0; i < e.changedTouches.length; i++) {
				const t = e.changedTouches[i];
				const zone = this.getTouchZone(t.clientX, t.clientY);
				this.touchActive.set(t.identifier, zone);
			}
		}, { passive: false });

		window.addEventListener("touchmove", (e) => {
			e.preventDefault();
			for (let i = 0; i < e.changedTouches.length; i++) {
				const t = e.changedTouches[i];
				const zone = this.getTouchZone(t.clientX, t.clientY);
				this.touchActive.set(t.identifier, zone);
			}
		}, { passive: false });

		window.addEventListener("touchend", (e) => {
			e.preventDefault();
			for (let i = 0; i < e.changedTouches.length; i++) {
				const t = e.changedTouches[i];
				const zone = this.touchActive.get(t.identifier);
				this.touchActive.delete(t.identifier);

				const relY = t.clientY / window.innerHeight;
				if (relY < 0.3) {
					// Tap upper area = restart / launch mission
					this._touchRestart = true;
					this._touchMenuSelect = true;
				} else if (relY >= 0.3 && relY < 0.7) {
					// Tap middle area in menu = scroll down through missions
					this._menuDownPressed = true;
				}
			}
		}, { passive: false });

		window.addEventListener("touchcancel", (e) => {
			for (let i = 0; i < e.changedTouches.length; i++) {
				this.touchActive.delete(e.changedTouches[i].identifier);
			}
		});
	}

	private getTouchZone(clientX: number, _clientY: number): TouchZone {
		const relX = clientX / window.innerWidth;
		if (relX < 0.3) return "left";
		if (relX > 0.7) return "right";
		return "thrust";
	}

	private hasTouchZone(zone: TouchZone): boolean {
		for (const z of this.touchActive.values()) {
			if (z === zone) return true;
		}
		return false;
	}

	getState(): InputState {
		const state: InputState = {
			thrustUp: this.keys.has("ArrowUp") || this.keys.has("KeyW") || this.hasTouchZone("thrust"),
			rotateLeft: this.keys.has("ArrowLeft") || this.keys.has("KeyA") || this.hasTouchZone("left"),
			rotateRight: this.keys.has("ArrowRight") || this.keys.has("KeyD") || this.hasTouchZone("right"),
			restart: this._restartPressed || this._touchRestart,
			menuUp: this._menuUpPressed,
			menuDown: this._menuDownPressed,
			menuSelect: this._menuSelectPressed || this._touchMenuSelect,
			menuBack: this._menuBackPressed,
			toggleAutopilot: this._autopilotToggled,
		};
		this._restartPressed = false;
		this._menuUpPressed = false;
		this._menuDownPressed = false;
		this._menuSelectPressed = false;
		this._menuBackPressed = false;
		this._autopilotToggled = false;
		this._touchRestart = false;
		this._touchMenuSelect = false;
		return state;
	}
}
