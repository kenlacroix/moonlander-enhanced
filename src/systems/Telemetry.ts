/** Records flight telemetry for post-flight visualization */

export interface TelemetryFrame {
	time: number; // seconds into flight
	altitude: number; // y distance above terrain
	vSpeed: number; // vertical speed
	hSpeed: number; // horizontal speed
	fuel: number; // remaining fuel
}

export class TelemetryRecorder {
	frames: TelemetryFrame[] = [];
	private elapsed = 0;
	private sampleInterval = 0.25; // record 4x per second
	private nextSample = 0;

	reset(): void {
		this.frames = [];
		this.elapsed = 0;
		this.nextSample = 0;
	}

	/** Call every frame with dt and current lander state */
	update(
		dt: number,
		altitude: number,
		vSpeed: number,
		hSpeed: number,
		fuel: number,
	): void {
		this.elapsed += dt;
		if (this.elapsed >= this.nextSample) {
			this.frames.push({
				time: Math.round(this.elapsed * 100) / 100,
				altitude: Math.round(altitude),
				vSpeed: Math.round(vSpeed * 10) / 10,
				hSpeed: Math.round(hSpeed * 10) / 10,
				fuel: Math.round(fuel),
			});
			this.nextSample += this.sampleInterval;
		}
	}

	/** Get the duration of the recorded flight */
	getDuration(): number {
		return this.elapsed;
	}
}
