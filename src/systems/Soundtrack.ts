/**
 * Procedural ambient soundtrack that responds to game tension.
 *
 * Three layers:
 * 1. Base drone — two detuned oscillators
 * 2. Tension sweep — triangle oscillator with lowpass filter, sweeps up as altitude drops
 * 3. High shimmer — sine with LFO tremolo, only active on final approach
 *
 * All parameter changes use setTargetAtTime for smooth, non-jarring transitions.
 * Independent gain chain from SFX so music can be muted separately.
 *
 * Sprint 7.1 PR 1.5 — per-archetype motif. Each terrain archetype
 * picks a `SoundtrackProfile` that shifts drone pitches + oscillator
 * shape + shimmer tuning so different worlds feel different before the
 * player consciously notices. `rolling` (and undefined) keep the old
 * tritone default so freeplay missions that opt out of archetypes
 * sound byte-identical to v0.6.0.0.
 */

import type { TerrainArchetype } from "../render/palette";

// LFO rate is archetype-agnostic — the tremolo speed just reads as
// "life in the tone," so every profile shares it.
const LFO_RATE = 0.5;

// Filter
const FILTER_MIN = 400;
const FILTER_MAX = 2000;

// Transition speed (seconds)
const SMOOTH_TAU = 1.0;

/** Per-archetype sonic profile. Every value is optional so profiles
 * can override just the knobs that matter for their mood while
 * inheriting the rest from `DEFAULT_PROFILE`. */
interface SoundtrackProfile {
	/** Base drone frequency 1 (tension interval root). */
	droneFreq1: number;
	/** Base drone frequency 2 (tension interval partner). */
	droneFreq2: number;
	/** Drone resolve pitch 1 on landed. */
	droneResolve1: number;
	/** Drone resolve pitch 2 on landed. */
	droneResolve2: number;
	/** Drone oscillator waveform. Sine is smoothest; triangle/sawtooth
	 * add grit for rougher archetypes. */
	droneType: OscillatorType;
	/** Low / high endpoints of the tension-layer pitch sweep. */
	tensionFreqLow: number;
	tensionFreqHigh: number;
	/** Shimmer (high ambient layer) root frequency. */
	shimmerFreq: number;
	/** Peak gains — tuned so the whole mix sits under SFX at max tension. */
	droneMaxGain: number;
	tensionMaxGain: number;
	shimmerMaxGain: number;
}

/** Rolling / undefined archetype — legacy B1 + F2 tritone. Byte-
 * identical to v0.6.0.0 so freeplay missions that keep archetype
 * undefined sound unchanged. */
const DEFAULT_PROFILE: SoundtrackProfile = {
	droneFreq1: 61.74, // B1
	droneFreq2: 87.31, // F2 (tritone with B1)
	droneResolve1: 65.41, // C2 (consonant resolution)
	droneResolve2: 98.0, // G2 (perfect fifth)
	droneType: "sine",
	tensionFreqLow: 164.8, // E3
	tensionFreqHigh: 493.9, // B4
	shimmerFreq: 3000,
	droneMaxGain: 0.06,
	tensionMaxGain: 0.04,
	shimmerMaxGain: 0.02,
};

/** Per-archetype profiles. Overrides the default where it matters for
 * the mood, inherits elsewhere. */
const ARCHETYPE_PROFILES: Record<TerrainArchetype, SoundtrackProfile> = {
	rolling: DEFAULT_PROFILE,
	// Crater-field: deeper, rumblier, grittier. Sawtooth drone and
	// lower root sell the "nowhere to hide" mood.
	"crater-field": {
		...DEFAULT_PROFILE,
		droneFreq1: 46.25, // F#1 (well below B1)
		droneFreq2: 69.3, // C#2
		droneResolve1: 49.0, // G1
		droneResolve2: 73.42, // D2
		droneType: "sawtooth",
		tensionFreqLow: 130.8, // C3
		shimmerFreq: 2200,
		droneMaxGain: 0.07,
	},
	// Spires: cold, crystalline. Pure sine drone, higher shimmer for
	// that "tall thin" feeling.
	spires: {
		...DEFAULT_PROFILE,
		droneFreq1: 82.41, // E2
		droneFreq2: 123.47, // B2 (perfect fifth above — less tense)
		droneResolve1: 87.31, // F2
		droneResolve2: 130.81, // C3
		droneType: "sine",
		tensionFreqLow: 196.0, // G3
		tensionFreqHigh: 587.33, // D5 (brighter top)
		shimmerFreq: 3800,
		shimmerMaxGain: 0.028,
	},
	// Mesa: warm, open, patient. Triangle drone at mid-range with a
	// more consonant interval so the mood stays steady.
	mesa: {
		...DEFAULT_PROFILE,
		droneFreq1: 65.41, // C2
		droneFreq2: 98.0, // G2 (perfect fifth — consonant from the start)
		droneResolve1: 65.41, // C2 (already consonant)
		droneResolve2: 98.0,
		droneType: "triangle",
		tensionFreqLow: 146.83, // D3
		tensionFreqHigh: 440, // A4
		shimmerFreq: 2600,
	},
	// Flats: minimal, sparse. Almost nothing going on, lets silence do
	// the work. Very quiet tension layer, no shimmer punch.
	flats: {
		...DEFAULT_PROFILE,
		droneFreq1: 73.42, // D2
		droneFreq2: 110.0, // A2
		droneResolve1: 73.42,
		droneResolve2: 110.0,
		droneType: "sine",
		tensionFreqLow: 174.61, // F3
		tensionFreqHigh: 349.23, // F4 (narrower sweep)
		shimmerFreq: 2800,
		tensionMaxGain: 0.025,
		shimmerMaxGain: 0.012,
	},
};

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
	/** Current archetype profile. Swappable between flights via
	 * `setArchetype`. Defaults to the legacy rolling/tritone mix. */
	private profile: SoundtrackProfile = DEFAULT_PROFILE;

	init(ctx: AudioContext): void {
		this.ctx = ctx;
		this.masterGain = ctx.createGain();
		this.masterGain.gain.value = 0;
		this.masterGain.connect(ctx.destination);

		// Layer 1: Drone (two detuned oscillators per archetype)
		this.droneOsc1 = ctx.createOscillator();
		this.droneOsc2 = ctx.createOscillator();
		this.droneGain = ctx.createGain();
		this.droneOsc1.type = this.profile.droneType;
		this.droneOsc2.type = this.profile.droneType;
		this.droneOsc1.frequency.value = this.profile.droneFreq1;
		this.droneOsc2.frequency.value = this.profile.droneFreq2;
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
		this.tensionOsc.frequency.value = this.profile.tensionFreqLow;
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
		this.shimmerOsc.frequency.value = this.profile.shimmerFreq;
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

		// Reset drone to the archetype's base interval + waveform
		this.droneOsc1?.frequency.setTargetAtTime(
			this.profile.droneFreq1,
			now,
			0.1,
		);
		this.droneOsc2?.frequency.setTargetAtTime(
			this.profile.droneFreq2,
			now,
			0.1,
		);
		if (this.droneOsc1) this.droneOsc1.type = this.profile.droneType;
		if (this.droneOsc2) this.droneOsc2.type = this.profile.droneType;

		// Shimmer root may differ per archetype; re-seat it on start so
		// switching archetypes between flights takes effect.
		this.shimmerOsc?.frequency.setTargetAtTime(
			this.profile.shimmerFreq,
			now,
			0.1,
		);

		// Fade in master
		this.masterGain?.gain.setTargetAtTime(this.muted ? 0 : 1, now, 0.5);
		this.droneGain?.gain.setTargetAtTime(
			this.profile.droneMaxGain * 0.5,
			now,
			SMOOTH_TAU,
		);
	}

	/** Sprint 7.1 PR 1.5 — swap the archetype profile. Applied on the
	 * next `start()` call (i.e. next flight). Passing `undefined` (or
	 * `rolling`) restores the default profile. */
	setArchetype(archetype: TerrainArchetype | undefined): void {
		this.profile = archetype ? ARCHETYPE_PROFILES[archetype] : DEFAULT_PROFILE;
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
		const droneVol = this.profile.droneMaxGain * (0.5 + tension * 0.5);
		this.droneGain?.gain.setTargetAtTime(droneVol, now, SMOOTH_TAU);

		// Tension layer: fades in above 0.2 tension, pitch and filter sweep
		if (tension > 0.2) {
			const t = (tension - 0.2) / 0.8; // normalize 0.2-1.0 to 0-1
			const freq =
				this.profile.tensionFreqLow +
				t * (this.profile.tensionFreqHigh - this.profile.tensionFreqLow);
			const filterFreq = FILTER_MAX - t * (FILTER_MAX - FILTER_MIN);
			this.tensionOsc?.frequency.setTargetAtTime(freq, now, SMOOTH_TAU);
			this.tensionFilter?.frequency.setTargetAtTime(
				filterFreq,
				now,
				SMOOTH_TAU,
			);
			this.tensionGain?.gain.setTargetAtTime(
				this.profile.tensionMaxGain * t,
				now,
				SMOOTH_TAU,
			);
		} else {
			this.tensionGain?.gain.setTargetAtTime(0, now, SMOOTH_TAU);
		}

		// Shimmer: only on final approach (tension > 0.7)
		if (tension > 0.7) {
			const s = (tension - 0.7) / 0.3;
			this.shimmerGain?.gain.setTargetAtTime(
				this.profile.shimmerMaxGain * s * 0.5,
				now,
				SMOOTH_TAU,
			);
			this.shimmerLfoGain?.gain.setTargetAtTime(
				this.profile.shimmerMaxGain * s * 0.5,
				now,
				SMOOTH_TAU,
			);
		} else {
			this.shimmerGain?.gain.setTargetAtTime(0, now, SMOOTH_TAU);
			this.shimmerLfoGain?.gain.setTargetAtTime(0, now, SMOOTH_TAU);
		}
	}

	/** Resolve to consonance on successful landing */
	onLanded(): void {
		if (!this.ctx) return;
		const now = this.ctx.currentTime;
		// Drone resolves to the archetype's consonant pair.
		this.droneOsc1?.frequency.setTargetAtTime(
			this.profile.droneResolve1,
			now,
			0.5,
		);
		this.droneOsc2?.frequency.setTargetAtTime(
			this.profile.droneResolve2,
			now,
			0.5,
		);
		// Open the filter, silence tension and shimmer
		this.tensionGain?.gain.setTargetAtTime(0, now, 0.3);
		this.shimmerGain?.gain.setTargetAtTime(0, now, 0.3);
		this.shimmerLfoGain?.gain.setTargetAtTime(0, now, 0.3);
		// Fade drone slowly
		this.droneGain?.gain.setTargetAtTime(
			this.profile.droneMaxGain * 0.3,
			now,
			2.0,
		);
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
