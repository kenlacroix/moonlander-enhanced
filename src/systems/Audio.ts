/**
 * Web Audio API sound system.
 * All sounds are synthesized procedurally — no audio files needed.
 * Initialized on first user interaction (browser autoplay policy).
 */

import { Soundtrack } from "./Soundtrack";

export class Audio {
	private ctx: AudioContext | null = null;
	private thrusterOsc: OscillatorNode | null = null;
	private thrusterGain: GainNode | null = null;
	private isThrusterPlaying = false;
	private initialized = false;
	readonly soundtrack = new Soundtrack();

	/** Call on first keydown/click to unlock audio context */
	init(): void {
		if (this.initialized) return;
		this.ctx = new AudioContext();
		this.initialized = true;

		// Initialize soundtrack with shared context
		this.soundtrack.init(this.ctx);

		// Pre-create thruster nodes (reused across on/off cycles)
		this.thrusterOsc = this.ctx.createOscillator();
		this.thrusterGain = this.ctx.createGain();

		// Thruster: low sawtooth rumble + noise-like modulation
		this.thrusterOsc.type = "sawtooth";
		this.thrusterOsc.frequency.value = 55; // low A
		this.thrusterGain.gain.value = 0;

		this.thrusterOsc.connect(this.thrusterGain);
		this.thrusterGain.connect(this.ctx.destination);
		this.thrusterOsc.start();
	}

	/** Resume the AudioContext if it was suspended.
	 *
	 * Mobile browsers suspend the context when the page is backgrounded
	 * (lock screen, app switch). On return, calling `ctx.resume()` from
	 * inside a user gesture restores audio. Call this on every gesture
	 * — it's a no-op when the context is already running. */
	resumeIfSuspended(): void {
		if (this.ctx?.state === "suspended") {
			this.ctx.resume().catch(() => {
				/* iOS Safari sometimes rejects outside a gesture; harmless */
			});
		}
	}

	/** Ramp thruster hum on/off */
	setThruster(on: boolean): void {
		if (!this.ctx || !this.thrusterGain) return;
		if (on === this.isThrusterPlaying) return;
		this.isThrusterPlaying = on;

		const now = this.ctx.currentTime;
		this.thrusterGain.gain.cancelScheduledValues(now);
		if (on) {
			this.thrusterGain.gain.setTargetAtTime(0.15, now, 0.05);
		} else {
			this.thrusterGain.gain.setTargetAtTime(0, now, 0.08);
		}
	}

	/** Short explosion burst on crash */
	playCrash(): void {
		if (!this.ctx) return;

		// White noise burst through a bandpass filter
		const duration = 0.6;
		const bufferSize = this.ctx.sampleRate * duration;
		const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
		const data = buffer.getChannelData(0);

		for (let i = 0; i < bufferSize; i++) {
			// Noise with exponential decay
			data[i] = (Math.random() * 2 - 1) * Math.exp((-i / bufferSize) * 5);
		}

		const source = this.ctx.createBufferSource();
		source.buffer = buffer;

		const filter = this.ctx.createBiquadFilter();
		filter.type = "lowpass";
		filter.frequency.value = 800;

		const gain = this.ctx.createGain();
		gain.gain.value = 0.4;

		source.connect(filter);
		filter.connect(gain);
		gain.connect(this.ctx.destination);
		source.start();
	}

	/** Success jingle: ascending three-note chime */
	playSuccess(): void {
		if (!this.ctx) return;

		const notes = [523.25, 659.25, 783.99]; // C5, E5, G5
		const noteLength = 0.2;

		for (let i = 0; i < notes.length; i++) {
			const osc = this.ctx.createOscillator();
			const gain = this.ctx.createGain();

			osc.type = "sine";
			osc.frequency.value = notes[i];

			const startTime = this.ctx.currentTime + i * noteLength;
			gain.gain.setValueAtTime(0, startTime);
			gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
			gain.gain.exponentialRampToValueAtTime(
				0.001,
				startTime + noteLength * 1.5,
			);

			osc.connect(gain);
			gain.connect(this.ctx.destination);
			osc.start(startTime);
			osc.stop(startTime + noteLength * 2);
		}
	}

	/** Low fuel warning beep */
	playFuelWarning(): void {
		if (!this.ctx) return;

		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();

		osc.type = "square";
		osc.frequency.value = 880; // A5

		const now = this.ctx.currentTime;
		gain.gain.setValueAtTime(0.08, now);
		gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

		osc.connect(gain);
		gain.connect(this.ctx.destination);
		osc.start(now);
		osc.stop(now + 0.1);
	}

	/**
	 * Apollo 11 1202 program alarm — ~200ms warble. Two square-wave bursts
	 * at alternating pitches mimic the "master alarm" klaxon used in Apollo
	 * mission audio. Graceful no-op when AudioContext is suspended.
	 */
	playProgramAlarm(): void {
		if (!this.ctx) return;

		const now = this.ctx.currentTime;
		const pitches = [660, 880, 660, 880];
		const noteLen = 0.05;
		for (let i = 0; i < pitches.length; i++) {
			const osc = this.ctx.createOscillator();
			const gain = this.ctx.createGain();
			osc.type = "square";
			osc.frequency.value = pitches[i];
			const start = now + i * noteLen;
			gain.gain.setValueAtTime(0, start);
			gain.gain.linearRampToValueAtTime(0.08, start + 0.005);
			gain.gain.exponentialRampToValueAtTime(0.001, start + noteLen);
			osc.connect(gain);
			gain.connect(this.ctx.destination);
			osc.start(start);
			osc.stop(start + noteLen);
		}
	}

	/**
	 * Apollo 15/17 MASTER ALARM — softer one-shot; no input lockout paired
	 * with this cue. Single ~250ms triangle note; deliberately less urgent
	 * than 1202 since it's advisory.
	 */
	playMasterAlarm(): void {
		if (!this.ctx) return;

		const now = this.ctx.currentTime;
		const osc = this.ctx.createOscillator();
		const gain = this.ctx.createGain();
		osc.type = "triangle";
		osc.frequency.value = 520;
		gain.gain.setValueAtTime(0, now);
		gain.gain.linearRampToValueAtTime(0.05, now + 0.02);
		gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
		osc.connect(gain);
		gain.connect(this.ctx.destination);
		osc.start(now);
		osc.stop(now + 0.25);
	}

	/** Alien mischief warning — two-tone triangle warble */
	playAlienWarning(): void {
		if (!this.ctx) return;

		const now = this.ctx.currentTime;
		for (let i = 0; i < 2; i++) {
			const osc = this.ctx.createOscillator();
			const gain = this.ctx.createGain();
			osc.type = "triangle";
			osc.frequency.value = i === 0 ? 440 : 660;
			const start = now + i * 0.15;
			gain.gain.setValueAtTime(0, start);
			gain.gain.linearRampToValueAtTime(0.06, start + 0.02);
			gain.gain.exponentialRampToValueAtTime(0.001, start + 0.15);
			osc.connect(gain);
			gain.connect(this.ctx.destination);
			osc.start(start);
			osc.stop(start + 0.15);
		}
	}

	/** Update soundtrack tension level */
	updateSoundtrack(tension: number): void {
		this.soundtrack.update(tension);
	}
}
