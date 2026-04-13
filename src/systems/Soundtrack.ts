/**
 * Procedural ambient soundtrack that responds to game tension.
 *
 * Three layers:
 * 1. Base drone — two detuned sine oscillators (B1 + F2 tritone, inherently tense)
 * 2. Tension sweep — triangle oscillator with lowpass filter, sweeps up as altitude drops
 * 3. High shimmer — sine with LFO tremolo, only active on final approach
 *
 * All parameter changes use setTargetAtTime for smooth, non-jarring transitions.
 * Independent gain chain from SFX so music can be muted separately.
 */

// Frequencies
const DRONE_FREQ_1 = 61.74;     // B1
const DRONE_FREQ_2 = 87.31;     // F2 (tritone with B1)
const DRONE_RESOLVE_1 = 65.41;  // C2 (consonant resolution on landing)
const DRONE_RESOLVE_2 = 98.0;   // G2
const TENSION_FREQ_LOW = 164.8; // E3
const TENSION_FREQ_HIGH = 493.9;// B4
const SHIMMER_FREQ = 3000;
const LFO_RATE = 0.5;

// Gains (kept very low to sit under SFX)
const DRONE_MAX_GAIN = 0.06;
const TENSION_MAX_GAIN = 0.04;
const SHIMMER_MAX_GAIN = 0.02;

// Filter
const FILTER_MIN = 400;
const FILTER_MAX = 2000;

// Transition speed (seconds)
const SMOOTH_TAU = 1.0;

export class Soundtrack {
	private ctx: AudioContext | null = null;
	private masterGain: GainNode | null = null;

	// Layer 1: Drone
	private droneOsc1: OscillatorNode | null = null;
	private droneOsc2: OscillatorNode | null = null;
	private droneGain: GainNode | null = null;

	// Layer 2: Tension
	private tensionOsc: OscillatorNode | null = null;
	private tensionFilter: BiquadFilterNode | null = null;
	private tensionGain: GainNode | null = null;

	// Layer 3: Shimmer
	private shimmerOsc: OscillatorNode | null = null;
	private shimmerLfo: OscillatorNode | null = null;
	private shimmerLfoGain: GainNode | null = null;
	private shimmerGain: GainNode | null = null;

	private active = false;
	private muted = false;

	init(ctx: AudioContext): void {
		this.ctx = ctx;
		this.masterGain = ctx.createGain();
		this.masterGain.gain.value = 0;
		this.masterGain.connect(ctx.destination);

		// Layer 1: Drone (two detuned sines)
		this.droneOsc1 = ctx.createOscillator();
		this.droneOsc2 = ctx.createOscillator();
		this.droneGain = ctx.createGain();
		this.droneOsc1.type = "sine";
		this.droneOsc2.type = "sine";
		this.droneOsc1.frequency.value = DRONE_FREQ_1;
		this.droneOsc2.frequency.value = DRONE_FREQ_2;
		this.droneGain.gain.value = 0;
		this.droneOsc1.connect(this.droneGain);
		this.droneOsc2.connect(this.droneGain);
		this.droneGain.connect(this.masterGain);
		this.droneOsc1.start();
		this.droneOsc2.start();

		// Layer 2: Tension sweep with lowpass filter
		this.tensionOsc = ctx.createOscillator();
		this.tensionFilter = ctx.createBiquadFilter();
		this.tensionGain = ctx.createGain();
		this.tensionOsc.type = "triangle";
		this.tensionOsc.frequency.value = TENSION_FREQ_LOW;
		this.tensionFilter.type = "lowpass";
		this.tensionFilter.frequency.value = FILTER_MAX;
		this.tensionFilter.Q.value = 2;
		this.tensionGain.gain.value = 0;
		this.tensionOsc.connect(this.tensionFilter);
		this.tensionFilter.connect(this.tensionGain);
		this.tensionGain.connect(this.masterGain);
		this.tensionOsc.start();

		// Layer 3: Shimmer with LFO tremolo
		this.shimmerOsc = ctx.createOscillator();
		this.shimmerGain = ctx.createGain();
		this.shimmerLfo = ctx.createOscillator();
		this.shimmerLfoGain = ctx.createGain();
		this.shimmerOsc.type = "sine";
		this.shimmerOsc.frequency.value = SHIMMER_FREQ;
		this.shimmerGain.gain.value = 0;
		// LFO modulates shimmer gain
		this.shimmerLfo.type = "sine";
		this.shimmerLfo.frequency.value = LFO_RATE;
		this.shimmerLfoGain.gain.value = 0; // will be set by update()
		this.shimmerLfo.connect(this.shimmerLfoGain);
		this.shimmerLfoGain.connect(this.shimmerGain.gain);
		this.shimmerOsc.connect(this.shimmerGain);
		this.shimmerGain.connect(this.masterGain);
		this.shimmerOsc.start();
		this.shimmerLfo.start();
	}

	start(): void {
		if (!this.ctx || this.active) return;
		this.active = true;
		const now = this.ctx.currentTime;

		// Reset drone to tritone
		this.droneOsc1?.frequency.setTargetAtTime(DRONE_FREQ_1, now, 0.1);
		this.droneOsc2?.frequency.setTargetAtTime(DRONE_FREQ_2, now, 0.1);
		if (this.droneOsc1) this.droneOsc1.type = "sine";
		if (this.droneOsc2) this.droneOsc2.type = "sine";

		// Fade in master
		this.masterGain?.gain.setTargetAtTime(this.muted ? 0 : 1, now, 0.5);
		this.droneGain?.gain.setTargetAtTime(DRONE_MAX_GAIN * 0.5, now, SMOOTH_TAU);
	}

	stop(): void {
		if (!this.ctx || !this.active) return;
		this.active = false;
		const now = this.ctx.currentTime;
		this.masterGain?.gain.setTargetAtTime(0, now, 0.3);
	}

	setMuted(muted: boolean): void {
		this.muted = muted;
		if (!this.ctx || !this.active) return;
		const now = this.ctx.currentTime;
		this.masterGain?.gain.setTargetAtTime(muted ? 0 : 1, now, 0.2);
	}

	/** Update soundtrack based on tension (0 = calm, 1 = maximum tension) */
	update(tension: number): void {
		if (!this.ctx || !this.active) return;
		const now = this.ctx.currentTime;

		// Drone: volume scales with tension
		const droneVol = DRONE_MAX_GAIN * (0.5 + tension * 0.5);
		this.droneGain?.gain.setTargetAtTime(droneVol, now, SMOOTH_TAU);

		// Tension layer: fades in above 0.2 tension, pitch and filter sweep
		if (tension > 0.2) {
			const t = (tension - 0.2) / 0.8; // normalize 0.2-1.0 to 0-1
			const freq = TENSION_FREQ_LOW + t * (TENSION_FREQ_HIGH - TENSION_FREQ_LOW);
			const filterFreq = FILTER_MAX - t * (FILTER_MAX - FILTER_MIN);
			this.tensionOsc?.frequency.setTargetAtTime(freq, now, SMOOTH_TAU);
			this.tensionFilter?.frequency.setTargetAtTime(filterFreq, now, SMOOTH_TAU);
			this.tensionGain?.gain.setTargetAtTime(TENSION_MAX_GAIN * t, now, SMOOTH_TAU);
		} else {
			this.tensionGain?.gain.setTargetAtTime(0, now, SMOOTH_TAU);
		}

		// Shimmer: only on final approach (tension > 0.7)
		if (tension > 0.7) {
			const s = (tension - 0.7) / 0.3;
			this.shimmerGain?.gain.setTargetAtTime(SHIMMER_MAX_GAIN * s * 0.5, now, SMOOTH_TAU);
			this.shimmerLfoGain?.gain.setTargetAtTime(SHIMMER_MAX_GAIN * s * 0.5, now, SMOOTH_TAU);
		} else {
			this.shimmerGain?.gain.setTargetAtTime(0, now, SMOOTH_TAU);
			this.shimmerLfoGain?.gain.setTargetAtTime(0, now, SMOOTH_TAU);
		}
	}

	/** Resolve to consonance on successful landing */
	onLanded(): void {
		if (!this.ctx) return;
		const now = this.ctx.currentTime;
		// Drone resolves to C2 + G2 (perfect fifth, warm)
		this.droneOsc1?.frequency.setTargetAtTime(DRONE_RESOLVE_1, now, 0.5);
		this.droneOsc2?.frequency.setTargetAtTime(DRONE_RESOLVE_2, now, 0.5);
		// Open the filter, silence tension and shimmer
		this.tensionGain?.gain.setTargetAtTime(0, now, 0.3);
		this.shimmerGain?.gain.setTargetAtTime(0, now, 0.3);
		this.shimmerLfoGain?.gain.setTargetAtTime(0, now, 0.3);
		// Fade drone slowly
		this.droneGain?.gain.setTargetAtTime(DRONE_MAX_GAIN * 0.3, now, 2.0);
	}

	/** Dissonance and fade on crash */
	onCrashed(): void {
		if (!this.ctx) return;
		const now = this.ctx.currentTime;
		// Detune everything
		this.droneOsc1?.frequency.setTargetAtTime(58, now, 0.2);
		this.droneOsc2?.frequency.setTargetAtTime(93, now, 0.2);
		this.tensionOsc?.frequency.setTargetAtTime(200, now, 0.1);
		// Distortion: switch drone to sawtooth briefly
		if (this.droneOsc1) this.droneOsc1.type = "sawtooth";
		// Rapid fade to silence
		this.masterGain?.gain.setTargetAtTime(0, now, 0.8);
		this.active = false;
	}
}
