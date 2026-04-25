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
	openSettings: boolean;
	toggleRetroSkin: boolean;
	exportGhost: boolean;
	importGhost: boolean;
	flightReport: boolean;
	toggleRelay: boolean;
	toggleAnnotations: boolean;
	forkTakeover: boolean;
	/** Sprint 7.5 Tier 1 — last touchend position translated to
	 * canvas-internal coordinates (1280x720 space). Optional: only the
	 * Input class populates it; synthetic InputState consumers (Autopilot,
	 * AgentEnv, GhostReplay) leave it absent. Menu handlers hit-test
	 * mission rows against this; flight handlers ignore it (they use
	 * touchActive zones for left/right/thrust). One-shot: cleared after
	 * getState() reads it. */
	tapCanvas?: { x: number; y: number } | null;
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
	private _settingsPressed = false;
	private _retroToggled = false;
	private _exportGhost = false;
	private _importGhost = false;
	private _flightReport = false;
	private _relayToggled = false;
	private _annotationsToggled = false;
	private _forkPressed = false;

	// Touch state
	private touchActive = new Map<number, TouchZone>();
	private _touchRestart = false;
	private _touchMenuSelect = false;
	/** Sprint 7.5 Tier 1 — last touchend canvas-coordinate position. */
	private _tapCanvas: { x: number; y: number } | null = null;
	private canvas: HTMLCanvasElement | null = null;
	readonly isTouchDevice: boolean;

	/** Sprint 7.5 Tier 1 — register the canvas element so touchend can
	 * translate viewport CSS-pixel coordinates into canvas-internal
	 * 1280x720 coordinates for hit-testing. Called from Game ctor.
	 * Optional: keyboard-only consumers don't need it. */
	setCanvas(canvas: HTMLCanvasElement): void {
		this.canvas = canvas;
	}

	constructor() {
		this.isTouchDevice =
			"ontouchstart" in window || navigator.maxTouchPoints > 0;

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
			if (e.code === "KeyS" && !this.keys.has("ArrowDown")) {
				this._settingsPressed = true;
			}
			if (e.code === "KeyV") {
				this._retroToggled = true;
			}
			if (e.code === "KeyG") {
				this._exportGhost = true;
			}
			if (e.code === "KeyI") {
				this._importGhost = true;
			}
			if (e.code === "KeyF") {
				this._flightReport = true;
			}
			if (e.code === "KeyL") {
				this._relayToggled = true;
			}
			if (e.code === "KeyA") {
				this._annotationsToggled = true;
			}
			if (e.code === "KeyT") {
				this._forkPressed = true;
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
		window.addEventListener(
			"touchstart",
			(e) => {
				e.preventDefault();
				for (let i = 0; i < e.changedTouches.length; i++) {
					const t = e.changedTouches[i];
					const zone = this.getTouchZone(t.clientX, t.clientY);
					this.touchActive.set(t.identifier, zone);
				}
			},
			{ passive: false },
		);

		window.addEventListener(
			"touchmove",
			(e) => {
				e.preventDefault();
				for (let i = 0; i < e.changedTouches.length; i++) {
					const t = e.changedTouches[i];
					const zone = this.getTouchZone(t.clientX, t.clientY);
					this.touchActive.set(t.identifier, zone);
				}
			},
			{ passive: false },
		);

		window.addEventListener(
			"touchend",
			(e) => {
				e.preventDefault();
				for (let i = 0; i < e.changedTouches.length; i++) {
					const t = e.changedTouches[i];
					const zone = this.touchActive.get(t.identifier);
					this.touchActive.delete(t.identifier);

					// Sprint 7.5 Tier 1 — translate touchend to canvas
					// coordinates so menu handlers can hit-test against
					// rendered mission rows. Replaces the undiscoverable
					// "tap upper third = select, middle third = scroll"
					// Y-zone gesture. The new model: tap any visible
					// mission row to highlight + launch it directly.
					if (this.canvas) {
						const rect = this.canvas.getBoundingClientRect();
						const relX = (t.clientX - rect.left) / rect.width;
						const relY = (t.clientY - rect.top) / rect.height;
						if (relX >= 0 && relX <= 1 && relY >= 0 && relY <= 1) {
							this._tapCanvas = {
								x: relX * 1280,
								y: relY * 720,
							};
						}
					}

					// Preserve tap-upper = restart for post-flight screen
					// (where there's no list to hit-test against). Only
					// fires _touchRestart, NOT _touchMenuSelect — menu
					// state now uses tapCanvas hit-testing in handlers.
					const relYWindow = t.clientY / window.innerHeight;
					if (relYWindow < 0.3) {
						this._touchRestart = true;
					}
				}
			},
			{ passive: false },
		);

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
			thrustUp:
				this.keys.has("ArrowUp") ||
				this.keys.has("KeyW") ||
				this.hasTouchZone("thrust"),
			rotateLeft:
				this.keys.has("ArrowLeft") ||
				this.keys.has("KeyA") ||
				this.hasTouchZone("left"),
			rotateRight:
				this.keys.has("ArrowRight") ||
				this.keys.has("KeyD") ||
				this.hasTouchZone("right"),
			restart: this._restartPressed || this._touchRestart,
			menuUp: this._menuUpPressed,
			menuDown: this._menuDownPressed,
			menuSelect: this._menuSelectPressed || this._touchMenuSelect,
			menuBack: this._menuBackPressed,
			toggleAutopilot: this._autopilotToggled,
			openSettings: this._settingsPressed,
			toggleRetroSkin: this._retroToggled,
			exportGhost: this._exportGhost,
			importGhost: this._importGhost,
			flightReport: this._flightReport,
			toggleRelay: this._relayToggled,
			toggleAnnotations: this._annotationsToggled,
			forkTakeover: this._forkPressed,
			tapCanvas: this._tapCanvas,
		};
		this._restartPressed = false;
		this._menuUpPressed = false;
		this._menuDownPressed = false;
		this._menuSelectPressed = false;
		this._menuBackPressed = false;
		this._autopilotToggled = false;
		this._settingsPressed = false;
		this._retroToggled = false;
		this._exportGhost = false;
		this._importGhost = false;
		this._flightReport = false;
		this._relayToggled = false;
		this._annotationsToggled = false;
		this._forkPressed = false;
		this._touchRestart = false;
		this._touchMenuSelect = false;
		this._tapCanvas = null;
		return state;
	}
}
