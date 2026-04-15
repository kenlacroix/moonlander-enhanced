import { FIXED_TIMESTEP, MAX_DELTA } from "../utils/constants";

export class GameLoop {
	private lastTime = 0;
	private accumulator = 0;
	private firstFrame = true;
	private running = false;

	constructor(
		private onBeforeFrame: (dt: number) => void,
		private onFixedUpdate: (dt: number) => void,
		private onAfterFrame: (dt: number) => void,
	) {}

	start(): void {
		this.running = true;
		this.lastTime = performance.now();
		this.firstFrame = true;
		requestAnimationFrame((t) => this.tick(t));
	}

	stop(): void {
		this.running = false;
	}

	resetAccumulator(): void {
		this.accumulator = 0;
		this.firstFrame = true;
	}

	private tick(time: number): void {
		if (!this.running) return;

		let dt = (time - this.lastTime) / 1000;
		this.lastTime = time;

		if (this.firstFrame) {
			this.firstFrame = false;
			dt = 0;
		}
		dt = Math.min(dt, MAX_DELTA);

		this.onBeforeFrame(dt);

		this.accumulator += dt;
		while (this.accumulator >= FIXED_TIMESTEP) {
			this.onFixedUpdate(FIXED_TIMESTEP);
			this.accumulator -= FIXED_TIMESTEP;
		}

		this.onAfterFrame(dt);

		requestAnimationFrame((t) => this.tick(t));
	}
}
