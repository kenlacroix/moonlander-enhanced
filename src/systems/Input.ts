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
type TouchZone = "left" | "right" | "thrust" | "stick" | "thrustBtn" | "none";

/**
 * Sprint 7.5 Tier 2 — virtual joystick + thrust button geometry in
 * canvas-internal coordinates (1280x720 space). Both controls are
 * thumb-friendly: 100-px stick radius (200-px diameter target) and
 * 100-px thrust button radius. Far above the iOS 44-px hit target
 * minimum even at 30%-scale on a small phone.
 */
// Pushed close to the canvas corners (1280x720) so on landscape phones
// — which letterbox the 16:9 canvas inside a 20-22:9 viewport — the
// visible affordance is near the screen edge where thumbs naturally
// rest. Letterbox-fallback in classifyTouch handles taps outside the
// canvas; this is just where the on-canvas dot is drawn.
export const STICK_CENTER = { x: 140, y: 600 };
export const STICK_RADIUS = 110;
export const STICK_DEADZONE = 25;
export const THRUST_CENTER = { x: 1140, y: 600 };
export const THRUST_RADIUS = 110;

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
	/** Sprint 7.5 Tier 2 — virtual stick knob position relative to its
	 * center, in canvas pixels. Clamped to STICK_RADIUS. (0, 0) when no
	 * touch is active. Renderer reads this to draw the knob. */
	private _stickKnob: { dx: number; dy: number } = { dx: 0, dy: 0 };
	/** Sprint 7.5 Tier 2 — true while a touch is held on the thrust
	 * button (not just inside its bounds; tracked by touch identifier). */
	private _thrustHeld = false;
	private canvas: HTMLCanvasElement | null = null;
	readonly isTouchDevice: boolean;

	get stickKnob(): { dx: number; dy: number } {
		return this._stickKnob;
	}
	get thrustHeld(): boolean {
		return this._thrustHeld;
	}

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

		// `e.preventDefault()` on touchstart blocks the browser from
		// synthesizing a click event for that touch. Apply it only when
		// the touch lands on the canvas / virtual controls so DOM
		// buttons (fullscreen toggle, AI Theater EXIT/EXPLAIN/COMPACT,
		// share-card download, etc.) keep firing on tap.
		const isInteractiveTarget = (target: EventTarget | null): boolean =>
			target instanceof Element &&
			target.closest("button, a, input, select, textarea, [role='button']") !==
				null;

		// Touch events
		window.addEventListener(
			"touchstart",
			(e) => {
				if (!isInteractiveTarget(e.target)) e.preventDefault();
				for (let i = 0; i < e.changedTouches.length; i++) {
					const t = e.changedTouches[i];
					const zone = this.classifyTouch(t.clientX, t.clientY);
					this.touchActive.set(t.identifier, zone);
					if (zone === "stick") this.updateStickKnob(t.clientX, t.clientY);
					if (zone === "thrustBtn") this._thrustHeld = true;
				}
			},
			{ passive: false },
		);

		window.addEventListener(
			"touchmove",
			(e) => {
				if (!isInteractiveTarget(e.target)) e.preventDefault();
				for (let i = 0; i < e.changedTouches.length; i++) {
					const t = e.changedTouches[i];
					const existing = this.touchActive.get(t.identifier);
					// Sprint 7.5 Tier 2 — once a touch claims the stick or
					// thrust button, it KEEPS that role even if the finger
					// drags outside the control's hit zone. This is the
					// expected mobile-game UX: pull the stick down past the
					// edge and rotation still tracks. Only re-classify
					// rotate/thrust legacy zones (which behave like the old
					// drag-into-zone model).
					if (existing === "stick") {
						this.updateStickKnob(t.clientX, t.clientY);
					} else if (existing === "thrustBtn") {
						// Thrust button is binary; movement doesn't change state
					} else {
						const zone = this.classifyTouch(t.clientX, t.clientY);
						this.touchActive.set(t.identifier, zone);
					}
				}
			},
			{ passive: false },
		);

		window.addEventListener(
			"touchend",
			(e) => {
				if (!isInteractiveTarget(e.target)) e.preventDefault();
				for (let i = 0; i < e.changedTouches.length; i++) {
					const t = e.changedTouches[i];
					const zone = this.touchActive.get(t.identifier);
					this.touchActive.delete(t.identifier);

					// Sprint 7.5 Tier 2 — release virtual stick / thrust button.
					if (zone === "stick") {
						this._stickKnob = { dx: 0, dy: 0 };
					} else if (zone === "thrustBtn") {
						// Multi-touch: another finger may still be on thrust.
						let stillHeld = false;
						for (const z of this.touchActive.values()) {
							if (z === "thrustBtn") {
								stillHeld = true;
								break;
							}
						}
						this._thrustHeld = stillHeld;
					}

					// Sprint 7.5 Tier 1 — tap-on-row hit testing for menu
					// navigation. Skip if the touch was a virtual control
					// (stick/thrust) — those aren't taps, they're held controls.
					if (
						zone !== "stick" &&
						zone !== "thrustBtn" &&
						this.canvas
					) {
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
					if (relYWindow < 0.3 && zone !== "stick" && zone !== "thrustBtn") {
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

	/**
	 * Sprint 7.5 Tier 2 — convert a CSS-pixel touch position to canvas
	 * coordinates and check which virtual control it lands on.
	 *
	 *   1. If inside the stick circle → "stick"
	 *   2. If inside the thrust button circle → "thrustBtn"
	 *   3. Otherwise (and not on a virtual control) → "none"
	 *
	 * The legacy left/right/thrust zone fallback is removed in this
	 * sprint — visible virtual controls replace invisible zones. If the
	 * canvas reference isn't set yet (very early in startup), fall back
	 * to the old proportional-zone classification so keyboard-first
	 * desktop dev sessions don't break.
	 */
	private classifyTouch(clientX: number, clientY: number): TouchZone {
		if (!this.canvas) {
			// Pre-canvas-init fallback. Should never matter on real mobile.
			const relX = clientX / window.innerWidth;
			if (relX < 0.3) return "left";
			if (relX > 0.7) return "right";
			return "thrust";
		}
		const rect = this.canvas.getBoundingClientRect();
		const relX = (clientX - rect.left) / rect.width;
		const relY = (clientY - rect.top) / rect.height;
		// Letterbox fallback: phones in landscape are typically 20-22:9
		// while the canvas is 16:9, leaving black bars on left and right
		// where the player's thumbs naturally rest. Off-canvas taps in
		// the bottom half of the viewport route to the nearest virtual
		// control so the stick + thrust button are reachable from the
		// screen edge. Top-half off-canvas taps stay "none" so DOM
		// overlays (fullscreen button, EXIT in AI Theater) still work.
		if (relX < 0 || relX > 1 || relY < 0 || relY > 1) {
			const vpRelY = clientY / window.innerHeight;
			if (vpRelY > 0.4 && (relX < 0 || relX > 1)) {
				return relX < 0 ? "stick" : "thrustBtn";
			}
			return "none";
		}
		const canvasX = relX * 1280;
		const canvasY = relY * 720;
		const stickDx = canvasX - STICK_CENTER.x;
		const stickDy = canvasY - STICK_CENTER.y;
		if (stickDx * stickDx + stickDy * stickDy <= STICK_RADIUS * STICK_RADIUS) {
			return "stick";
		}
		const thrustDx = canvasX - THRUST_CENTER.x;
		const thrustDy = canvasY - THRUST_CENTER.y;
		if (
			thrustDx * thrustDx + thrustDy * thrustDy <=
			THRUST_RADIUS * THRUST_RADIUS
		) {
			return "thrustBtn";
		}
		return "none";
	}

	/** Sprint 7.5 Tier 2 — translate a stick-touch's CSS-pixel position
	 * to canvas coords and update the knob offset (clamped to STICK_RADIUS).
	 * Called on touchstart and every touchmove for the stick touch. */
	private updateStickKnob(clientX: number, clientY: number): void {
		if (!this.canvas) return;
		const rect = this.canvas.getBoundingClientRect();
		const relX = (clientX - rect.left) / rect.width;
		const relY = (clientY - rect.top) / rect.height;
		const canvasX = relX * 1280;
		const canvasY = relY * 720;
		let dx = canvasX - STICK_CENTER.x;
		let dy = canvasY - STICK_CENTER.y;
		const dist = Math.sqrt(dx * dx + dy * dy);
		if (dist > STICK_RADIUS) {
			dx = (dx / dist) * STICK_RADIUS;
			dy = (dy / dist) * STICK_RADIUS;
		}
		this._stickKnob = { dx, dy };
	}

	private hasTouchZone(zone: TouchZone): boolean {
		for (const z of this.touchActive.values()) {
			if (z === zone) return true;
		}
		return false;
	}

	getState(): InputState {
		// Sprint 7.5 Tier 2 — virtual stick X-offset drives rotation.
		// Past STICK_DEADZONE (25 px) the rotate input fires; below it,
		// no rotation. Using a deadzone prevents accidental fire from
		// finger jitter when the player intends to hold the stick centered.
		const stickRotateLeft = this._stickKnob.dx < -STICK_DEADZONE;
		const stickRotateRight = this._stickKnob.dx > STICK_DEADZONE;
		const state: InputState = {
			thrustUp:
				this.keys.has("ArrowUp") ||
				this.keys.has("KeyW") ||
				this._thrustHeld ||
				this.hasTouchZone("thrust"),
			rotateLeft:
				this.keys.has("ArrowLeft") ||
				this.keys.has("KeyA") ||
				stickRotateLeft ||
				this.hasTouchZone("left"),
			rotateRight:
				this.keys.has("ArrowRight") ||
				this.keys.has("KeyD") ||
				stickRotateRight ||
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
