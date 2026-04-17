import { AGENT_META, type AgentKind, type AgentStats } from "../ai/Agent";
import type { RewardBreakdown } from "../ai/AgentEnv";
import type { RecordedEpisode } from "../ai/EpisodeRecorder";
import type { GravityPreset } from "../game/GravityPresets";

const PANEL_WIDTH = 360;
const CHART_HEIGHT = 160;
const MAX_CHART_POINTS = 200;
const VISION_REFRESH_MS = 500;
const EXPLAIN_MODE_KEY = "moonlander-explain-mode";
const COMPACT_MODE_KEY = "moonlander-ai-theater-compact";
const TOUR_SEEN_KEY = "moonlander-ai-theater-tour-seen";
const FIRST_LANDING_GLOW_MS = 3000;

const BREAKDOWN_ROWS: ReadonlyArray<{
	key: keyof RewardBreakdown;
	label: string;
}> = [
	{ key: "terminal", label: "terminal (landing/crash)" },
	{ key: "proximity", label: "proximity to pad" },
	{ key: "descent", label: "descent progress" },
	{ key: "speed", label: "controlled descent speed" },
	{ key: "anglePenalty", label: "angle penalty" },
	{ key: "approach", label: "approach velocity" },
	{ key: "timeTax", label: "time tax" },
];

// Maps STATE_SIZE = 11 dimensions from AgentEnv.getState to display labels.
// Keep order aligned with AgentEnv.ts docstring — reordering here would
// mis-label the bars without breaking any type-checked reference.
const STATE_LABELS: readonly string[] = [
	"ΔX TO PAD",
	"ALTITUDE",
	"H-SPEED",
	"V-SPEED",
	"ANGLE",
	"ANG VEL",
	"FUEL",
	"OFF-PAD",
	"V-ACCEL",
	"PAD-ALT",
	"APPROACH",
];

// Human-readable tooltip body for each state dimension. Order matches STATE_LABELS.
const STATE_HINTS: readonly string[] = [
	"Horizontal distance from the lander to the pad center. Negative = pad to the left.",
	"Height above the terrain directly below. Clamped at 1 when very high up.",
	"Horizontal velocity. Positive = drifting right.",
	"Vertical velocity. Positive = falling (toward ground).",
	"Tilt angle from upright. 0 = vertical. Sign = lean direction.",
	"Angular velocity — how fast the lander is rotating.",
	"Fuel remaining as fraction of tank. 1.0 = full, 0 = empty.",
	"Horizontal offset from pad center, measured in pad-widths. 0 = centered.",
	"Vertical acceleration. Positive = accelerating downward. Thrust makes this negative.",
	"Altitude above the pad surface specifically (differs from ALTITUDE when flying over terrain).",
	"Velocity projected toward the pad. Positive = closing in, negative = drifting away.",
];

interface Track {
	rewardHistory: number[];
	bestReward: number;
	bestLanded: boolean;
	lastReward: number;
	episodes: number;
}

const AGENT_ORDER: AgentKind[] = ["dqn", "dqn-transfer", "pg", "random"];

export class AITheaterPanel {
	private panel: HTMLDivElement;
	private chartCanvas: HTMLCanvasElement;
	private chartCtx: CanvasRenderingContext2D;
	private episodeEl: HTMLSpanElement;
	private bestScoreEl: HTMLSpanElement;
	private currentScoreEl: HTMLSpanElement;
	private epsilonEl: HTMLSpanElement;
	private statusEl: HTMLSpanElement;
	private watchBtn: HTMLButtonElement;
	private narrationEl: HTMLDivElement = null!;
	private firstCrash = false;
	private onWatchBest: (() => void) | null = null;
	private onForkRequested: ((ep: RecordedEpisode) => void) | null = null;
	private episodesProvider: (() => RecordedEpisode[]) | null = null;
	private selectedEpisodeId: number | null = null;
	private tracks: Record<AgentKind, Track> = this.makeTracks();
	private forkInfoEl!: HTMLDivElement;
	private forkBtn!: HTMLButtonElement;
	private visionCanvas!: HTMLCanvasElement;
	private visionCtx!: CanvasRenderingContext2D;
	private dqnStateProvider: (() => number[] | null) | null = null;
	private visionRafId: number | null = null;
	private visionLastDraw = 0;
	private breakdownProvider: (() => RewardBreakdown | null) | null = null;
	private explainMode = false;
	private explainBtn!: HTMLButtonElement;
	private breakdownEl!: HTMLDivElement;
	private breakdownBodyEl!: HTMLDivElement;
	private compactMode = false;
	private compactBtn!: HTMLButtonElement;
	private visionSectionEl!: HTMLDivElement;
	private legendRowEls: Partial<Record<AgentKind, HTMLDivElement>> = {};
	private legendGlowTimers: Partial<Record<AgentKind, number>> = {};
	private tutorialEl: HTMLDivElement | null = null;
	private keydownHandler: ((e: KeyboardEvent) => void) | null = null;
	private visionTooltipEl!: HTMLDivElement;

	constructor() {
		this.panel = document.createElement("div");
		this.panel.id = "ai-theater-panel";
		Object.assign(this.panel.style, {
			position: "fixed",
			top: "0",
			right: "0",
			width: `${PANEL_WIDTH}px`,
			height: "100vh",
			background: "#0a0a0a",
			borderLeft: "2px solid #00ff88",
			color: "#e0e0e0",
			fontFamily: "'Courier New', monospace",
			fontSize: "13px",
			padding: "16px",
			display: "flex",
			flexDirection: "column",
			gap: "12px",
			zIndex: "100",
			overflowY: "auto",
		});

		const legendHtml = AGENT_ORDER.map((k) => {
			const meta = AGENT_META[k];
			return `
				<div data-legend-kind="${k}"
					style="display:flex;align-items:flex-start;gap:6px;margin-top:4px;
					padding:2px 4px;border-radius:4px;transition:box-shadow 0.3s ease">
					<span style="display:inline-block;width:10px;height:10px;background:${meta.color};
						border-radius:50%;flex-shrink:0;margin-top:3px"></span>
					<div style="flex:1;min-width:0">
						<div style="color:#ddd;font-size:11px;font-weight:bold">${meta.label}</div>
						<div style="color:#888;font-size:10px;line-height:1.3">${meta.description}</div>
					</div>
				</div>
			`;
		}).join("");

		this.panel.innerHTML = `
			<div style="color:#00ff88;font-size:16px;font-weight:bold;text-align:center;letter-spacing:2px">
				AI THEATER
			</div>
			<div id="at-world-label" style="color:#aaa;font-size:11px;text-align:center;margin-top:-8px">
				WORLD: MOON · g=1.62
			</div>
			<div style="border-bottom:1px solid #333;padding-bottom:8px">
				<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
					<div style="color:#888;font-size:11px">DQN STATUS</div>
					<div style="display:flex;gap:4px">
						<button id="at-explain"
							style="background:#1a1a1a;color:#888;border:1px solid #444;
							padding:2px 8px;cursor:pointer;font-family:inherit;font-size:10px;
							border-radius:3px;letter-spacing:1px"
							title="Toggle reward breakdown (shows what the DQN is actually optimizing)">
							EXPLAIN
						</button>
						<button id="at-compact"
							style="background:#1a1a1a;color:#888;border:1px solid #444;
							padding:2px 8px;cursor:pointer;font-family:inherit;font-size:10px;
							border-radius:3px;letter-spacing:1px;min-width:24px"
							title="Toggle compact mode — hides AI VISION and reward breakdown (shortcut: ?)">
							?
						</button>
					</div>
				</div>
				<span id="at-status" style="color:#ffaa00">INITIALIZING...</span>
			</div>
			<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
				<div>
					<div style="color:#888;font-size:11px">DQN EPISODES</div>
					<span id="at-episodes" style="color:#fff;font-size:18px">0</span>
				</div>
				<div>
					<div style="color:#888;font-size:11px">EXPLORATION</div>
					<span id="at-epsilon" style="color:#fff;font-size:18px">100%</span>
				</div>
				<div>
					<div style="color:#888;font-size:11px">DQN BEST</div>
					<span id="at-best" style="color:#00ff88;font-size:18px">—</span>
				</div>
				<div>
					<div style="color:#888;font-size:11px">DQN LAST</div>
					<span id="at-current" style="color:#fff;font-size:18px">—</span>
				</div>
			</div>
			<div id="at-breakdown" style="display:none;background:#0d0d0d;border:1px solid #333;
				border-radius:4px;padding:8px;font-size:11px;line-height:1.5">
				<div style="color:#888;font-size:10px;margin-bottom:4px">
					WHAT THE DQN OPTIMIZES — last episode
				</div>
				<div id="at-breakdown-body" style="color:#aaa">
					Waiting for first DQN episode (appears once an episode ends)...
				</div>
			</div>
			<div>
				<div style="color:#888;font-size:11px;margin-bottom:4px">REWARD CURVES (smoothed)</div>
				<canvas id="at-chart" width="${PANEL_WIDTH - 32}" height="${CHART_HEIGHT}"
					style="background:#111;border:1px solid #333;border-radius:4px;width:100%"></canvas>
				<div style="display:flex;flex-direction:column;margin-top:6px">${legendHtml}</div>
			</div>
			<div id="at-vision-section" style="border-top:1px solid #222;padding-top:8px;position:relative">
				<div style="color:#888;font-size:11px;margin-bottom:4px">
					AI VISION <span style="color:#555">— what the DQN sees this frame</span>
				</div>
				<canvas id="at-vision" width="${PANEL_WIDTH - 32}" height="160"
					style="background:#111;border:1px solid #333;border-radius:4px;width:100%"></canvas>
				<div id="at-vision-tooltip"
					style="display:none;position:absolute;background:#000;border:1px solid #00ff88;
					color:#e0e0e0;padding:6px 8px;font-size:10px;line-height:1.4;border-radius:4px;
					pointer-events:none;z-index:10;max-width:220px;box-shadow:0 2px 8px #000"></div>
			</div>
			<div style="border-top:1px solid #222;padding-top:8px">
				<div style="color:#888;font-size:11px;margin-bottom:4px">MISSION REPLAY</div>
				<div id="at-fork-info" style="color:#888;font-size:11px;line-height:1.4">
					Click any point on the DQN curve to pick an episode.
				</div>
				<button id="at-fork-btn" disabled
					style="margin-top:6px;width:100%;background:#1a1a1a;color:#00aaff;
					border:1px solid #00aaff;padding:8px;cursor:pointer;font-family:inherit;
					font-size:12px;border-radius:4px;letter-spacing:1px;opacity:0.5">
					REPLAY & FORK (press T to take over)
				</button>
			</div>
			<div id="at-narration"
				style="color:#aaa;font-size:12px;font-style:italic;min-height:36px;
				line-height:1.4;padding:6px 0;border-top:1px solid #222">
				Initializing three agents: DQN, Policy Gradient, Random baseline...
			</div>
			<button id="at-watch-btn" disabled
				style="background:#1a1a1a;color:#00ff88;border:1px solid #00ff88;padding:10px;
				cursor:pointer;font-family:inherit;font-size:13px;border-radius:4px;
				letter-spacing:1px;transition:background 0.2s">
				WATCH DQN PLAY NOW
			</button>
			<div id="at-watch-hint" style="color:#555;font-size:11px;text-align:center">
				Needs 20+ DQN episodes for decent performance
			</div>
			<div style="color:#555;font-size:11px;text-align:center;margin-top:auto">
				3 agents round-robin, same terrain, 50x speed
			</div>
		`;

		this.chartCanvas = this.panel.querySelector("#at-chart")!;
		this.chartCtx = this.chartCanvas.getContext("2d")!;
		this.episodeEl = this.panel.querySelector("#at-episodes")!;
		this.bestScoreEl = this.panel.querySelector("#at-best")!;
		this.currentScoreEl = this.panel.querySelector("#at-current")!;
		this.epsilonEl = this.panel.querySelector("#at-epsilon")!;
		this.narrationEl = this.panel.querySelector("#at-narration")!;
		this.statusEl = this.panel.querySelector("#at-status")!;
		this.watchBtn = this.panel.querySelector("#at-watch-btn")!;
		this.forkInfoEl = this.panel.querySelector(
			"#at-fork-info",
		) as HTMLDivElement;
		this.forkBtn = this.panel.querySelector(
			"#at-fork-btn",
		) as HTMLButtonElement;
		this.visionCanvas = this.panel.querySelector("#at-vision")!;
		this.visionCtx = this.visionCanvas.getContext("2d")!;
		this.explainBtn = this.panel.querySelector(
			"#at-explain",
		) as HTMLButtonElement;
		this.breakdownEl = this.panel.querySelector(
			"#at-breakdown",
		) as HTMLDivElement;
		this.breakdownBodyEl = this.breakdownEl.querySelector(
			"#at-breakdown-body",
		) as HTMLDivElement;
		this.compactBtn = this.panel.querySelector(
			"#at-compact",
		) as HTMLButtonElement;
		this.visionSectionEl = this.panel.querySelector(
			"#at-vision-section",
		) as HTMLDivElement;
		this.visionTooltipEl = this.panel.querySelector(
			"#at-vision-tooltip",
		) as HTMLDivElement;
		for (const kind of AGENT_ORDER) {
			const row = this.panel.querySelector(
				`[data-legend-kind="${kind}"]`,
			) as HTMLDivElement | null;
			if (row) this.legendRowEls[kind] = row;
		}
		this.explainBtn.addEventListener("click", () => this.toggleExplain());
		this.explainBtn.addEventListener("mouseenter", () => {
			if (!this.explainMode) this.explainBtn.style.borderColor = "#666";
		});
		this.explainBtn.addEventListener("mouseleave", () => {
			if (!this.explainMode) this.explainBtn.style.borderColor = "#444";
		});
		this.compactBtn.addEventListener("click", () => this.toggleCompact());
		this.compactBtn.addEventListener("mouseenter", () => {
			if (!this.compactMode) this.compactBtn.style.borderColor = "#666";
		});
		this.compactBtn.addEventListener("mouseleave", () => {
			if (!this.compactMode) this.compactBtn.style.borderColor = "#444";
		});
		this.visionCanvas.addEventListener("mousemove", (e) =>
			this.handleVisionHover(e),
		);
		this.visionCanvas.addEventListener("mouseleave", () => {
			this.visionTooltipEl.style.display = "none";
		});

		this.chartCanvas.addEventListener("click", (e) => this.handleChartClick(e));
		this.forkBtn.addEventListener("click", () => this.triggerFork());
		this.watchBtn.addEventListener("click", () => this.onWatchBest?.());
		this.watchBtn.addEventListener("mouseenter", () => {
			if (!this.watchBtn.disabled) this.watchBtn.style.background = "#00ff8822";
		});
		this.watchBtn.addEventListener("mouseleave", () => {
			this.watchBtn.style.background = "#1a1a1a";
		});
	}

	private makeTracks(): Record<AgentKind, Track> {
		const make = (): Track => ({
			rewardHistory: [],
			bestReward: -Infinity,
			bestLanded: false,
			lastReward: 0,
			episodes: 0,
		});
		return {
			dqn: make(),
			"dqn-transfer": make(),
			pg: make(),
			random: make(),
		};
	}

	mount(): void {
		document.body.appendChild(this.panel);
		// Read both prefs first so applyExplainMode can consult compactMode.
		this.compactMode = this.readCompactPref();
		this.explainMode = this.readExplainModePref();
		this.applyCompactMode();
		this.applyExplainMode();
		this.startVisionLoop();
		this.keydownHandler = (e: KeyboardEvent) => this.handleKeydown(e);
		window.addEventListener("keydown", this.keydownHandler);
		if (!this.hasSeenTour()) this.showTutorial();
	}

	unmount(): void {
		this.stopVisionLoop();
		if (this.keydownHandler) {
			window.removeEventListener("keydown", this.keydownHandler);
			this.keydownHandler = null;
		}
		for (const kind of AGENT_ORDER) {
			const t = this.legendGlowTimers[kind];
			if (t !== undefined) window.clearTimeout(t);
		}
		this.legendGlowTimers = {};
		this.tutorialEl?.remove();
		this.tutorialEl = null;
		this.panel.remove();
		this.tracks = this.makeTracks();
		this.firstCrash = false;
		this.selectedEpisodeId = null;
		this.onForkRequested = null;
		this.episodesProvider = null;
		this.dqnStateProvider = null;
		this.breakdownProvider = null;
	}

	setDqnStateProvider(provider: () => number[] | null): void {
		this.dqnStateProvider = provider;
	}

	setDqnBreakdownProvider(provider: () => RewardBreakdown | null): void {
		this.breakdownProvider = provider;
	}

	private readExplainModePref(): boolean {
		try {
			return localStorage.getItem(EXPLAIN_MODE_KEY) === "1";
		} catch {
			return false;
		}
	}

	private writeExplainModePref(on: boolean): void {
		try {
			localStorage.setItem(EXPLAIN_MODE_KEY, on ? "1" : "0");
		} catch {
			// localStorage unavailable (private browsing) — preference lives in-session only.
		}
	}

	private toggleExplain(): void {
		this.explainMode = !this.explainMode;
		this.writeExplainModePref(this.explainMode);
		this.applyExplainMode();
	}

	private applyExplainMode(): void {
		// Compact mode suppresses breakdown visibility regardless of explain state.
		this.breakdownEl.style.display =
			this.explainMode && !this.compactMode ? "block" : "none";
		this.explainBtn.style.color = this.explainMode ? "#00ff88" : "#888";
		this.explainBtn.style.borderColor = this.explainMode ? "#00ff88" : "#444";
		this.explainBtn.setAttribute(
			"aria-pressed",
			this.explainMode ? "true" : "false",
		);
		if (this.explainMode && !this.compactMode) this.renderBreakdown();
	}

	private readCompactPref(): boolean {
		try {
			return localStorage.getItem(COMPACT_MODE_KEY) === "1";
		} catch {
			return false;
		}
	}

	private writeCompactPref(on: boolean): void {
		try {
			localStorage.setItem(COMPACT_MODE_KEY, on ? "1" : "0");
		} catch {
			// localStorage unavailable (private browsing) — preference lives in-session only.
		}
	}

	private toggleCompact(): void {
		this.compactMode = !this.compactMode;
		this.writeCompactPref(this.compactMode);
		this.applyCompactMode();
	}

	private applyCompactMode(): void {
		this.visionSectionEl.style.display = this.compactMode ? "none" : "block";
		// Breakdown visibility follows compact mode when on; otherwise explain mode wins.
		this.breakdownEl.style.display =
			!this.compactMode && this.explainMode ? "block" : "none";
		this.compactBtn.style.color = this.compactMode ? "#00ff88" : "#888";
		this.compactBtn.style.borderColor = this.compactMode ? "#00ff88" : "#444";
		this.compactBtn.setAttribute(
			"aria-pressed",
			this.compactMode ? "true" : "false",
		);
	}

	private handleKeydown(e: KeyboardEvent): void {
		// Ignore when the user is typing into an input/textarea elsewhere.
		const target = e.target as HTMLElement | null;
		if (
			target?.tagName === "INPUT" ||
			target?.tagName === "TEXTAREA" ||
			target?.isContentEditable
		) {
			return;
		}
		if (e.key === "?") {
			e.preventDefault();
			this.toggleCompact();
		}
	}

	private hasSeenTour(): boolean {
		try {
			return localStorage.getItem(TOUR_SEEN_KEY) === "1";
		} catch {
			return true;
		}
	}

	private markTourSeen(): void {
		try {
			localStorage.setItem(TOUR_SEEN_KEY, "1");
		} catch {
			// private browsing — tutorial reappears next session, acceptable.
		}
	}

	private showTutorial(): void {
		if (this.tutorialEl) return;
		const overlay = document.createElement("div");
		Object.assign(overlay.style, {
			position: "absolute",
			top: "60px",
			left: "12px",
			right: "12px",
			zIndex: "200",
			display: "flex",
			flexDirection: "column",
			gap: "8px",
			pointerEvents: "none",
		});
		const cards: Array<{ title: string; body: string }> = [
			{
				title: "1 · REWARD CURVES",
				body: "Each colored line is one AI's score over episodes. Higher = better. Watch DQN climb past Random to know learning is working.",
			},
			{
				title: "2 · AI VISION",
				body: "The 11 bars below the chart are what the DQN sees every frame — altitude, speed, angle, fuel, distance to pad. Its whole world.",
			},
			{
				title: "3 · EXPLAIN",
				body: "Click EXPLAIN to see the reward breakdown — the exact numbers the DQN is trying to maximize. Press ? to hide these sections any time.",
			},
		];
		overlay.innerHTML = cards
			.map(
				(c, i) => `
				<div data-tour-card="${i}"
					style="background:#0a0a0a;border:2px solid #00ff88;border-radius:6px;
					padding:10px 12px;font-size:11px;line-height:1.5;color:#e0e0e0;
					pointer-events:auto;box-shadow:0 2px 12px rgba(0,255,136,0.2)">
					<div style="display:flex;justify-content:space-between;align-items:baseline;
						margin-bottom:4px">
						<div style="color:#00ff88;font-weight:bold;letter-spacing:1px">${c.title}</div>
						<button data-tour-dismiss="${i}"
							style="background:transparent;color:#666;border:none;cursor:pointer;
							font-family:inherit;font-size:14px;padding:0 4px">✕</button>
					</div>
					<div>${c.body}</div>
				</div>
			`,
			)
			.join("");
		const gotItBtn = document.createElement("button");
		gotItBtn.textContent = "GOT IT";
		Object.assign(gotItBtn.style, {
			background: "#00ff88",
			color: "#000",
			border: "none",
			padding: "8px",
			cursor: "pointer",
			fontFamily: "inherit",
			fontSize: "12px",
			fontWeight: "bold",
			letterSpacing: "2px",
			borderRadius: "4px",
			pointerEvents: "auto",
			marginTop: "4px",
		});
		gotItBtn.addEventListener("click", () => this.dismissTutorial());
		overlay.appendChild(gotItBtn);
		overlay.querySelectorAll("[data-tour-dismiss]").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				e.stopPropagation();
				const idx = (e.currentTarget as HTMLElement).getAttribute(
					"data-tour-dismiss",
				);
				const card = overlay.querySelector(`[data-tour-card="${idx}"]`);
				card?.remove();
				if (!overlay.querySelector("[data-tour-card]")) this.dismissTutorial();
			});
		});
		this.panel.appendChild(overlay);
		this.tutorialEl = overlay;
	}

	private dismissTutorial(): void {
		this.tutorialEl?.remove();
		this.tutorialEl = null;
		this.markTourSeen();
	}

	private handleVisionHover(e: MouseEvent): void {
		if (!this.dqnStateProvider) return;
		const rect = this.visionCanvas.getBoundingClientRect();
		const y = e.clientY - rect.top;
		const n = STATE_LABELS.length;
		const rowH = rect.height / n;
		const row = Math.max(0, Math.min(n - 1, Math.floor(y / rowH)));
		const state = this.dqnStateProvider();
		const label = STATE_LABELS[row];
		const hint = STATE_HINTS[row] ?? "";
		const raw = state && row < state.length ? state[row] : null;
		const rawStr =
			raw === null
				? "(no state yet — first episode still initializing)"
				: `value ${raw >= 0 ? "+" : ""}${raw.toFixed(3)} (range −1…+1)`;
		this.visionTooltipEl.innerHTML = `
			<div style="color:#00ff88;font-weight:bold;margin-bottom:2px">${label}</div>
			<div style="color:#bbb;margin-bottom:4px">${hint}</div>
			<div style="color:#888;font-size:9px">${rawStr}</div>
		`;
		// Position tooltip near the row, clamped inside the panel.
		const panelRect = this.panel.getBoundingClientRect();
		const top = rect.top - panelRect.top + row * rowH + rowH / 2 - 20;
		const left = Math.min(
			rect.right - panelRect.left - 230,
			e.clientX - panelRect.left + 10,
		);
		this.visionTooltipEl.style.top = `${top}px`;
		this.visionTooltipEl.style.left = `${Math.max(8, left)}px`;
		this.visionTooltipEl.style.display = "block";
	}

	private triggerLegendGlow(kind: AgentKind): void {
		const row = this.legendRowEls[kind];
		if (!row) return;
		const color = AGENT_META[kind].color;
		row.style.boxShadow = `0 0 12px ${color}, 0 0 4px ${color}`;
		const prev = this.legendGlowTimers[kind];
		if (prev !== undefined) window.clearTimeout(prev);
		this.legendGlowTimers[kind] = window.setTimeout(() => {
			row.style.boxShadow = "none";
			delete this.legendGlowTimers[kind];
		}, FIRST_LANDING_GLOW_MS);
	}

	private renderBreakdown(): void {
		const bd = this.breakdownProvider?.() ?? null;
		if (!bd) {
			this.breakdownBodyEl.textContent =
				"Waiting for first DQN episode (appears once an episode ends)...";
			return;
		}
		const fmt = (v: number) => (v >= 0 ? `+${v.toFixed(1)}` : v.toFixed(1));
		const color = (v: number) =>
			v > 0 ? "#00ff88" : v < 0 ? "#ff8866" : "#888";
		// Value column uses tabular-nums + fixed min-width so +/- digits line up
		// across rows without depending on HTML whitespace (which collapses).
		const numStyle =
			"font-family:monospace;font-variant-numeric:tabular-nums;" +
			"display:inline-block;min-width:5ch;text-align:right";
		const rows = BREAKDOWN_ROWS.map((row) => {
			const v = bd[row.key];
			return `
				<div style="display:flex;justify-content:space-between">
					<span style="color:${color(v)};${numStyle}">${fmt(v)}</span>
					<span style="color:#888">${row.label}</span>
				</div>
			`;
		}).join("");
		this.breakdownBodyEl.innerHTML = `
			${rows}
			<div style="display:flex;justify-content:space-between;
				border-top:1px solid #333;padding-top:4px;margin-top:4px">
				<span style="color:#fff;${numStyle}">${fmt(bd.total)}</span>
				<span style="color:#ccc;font-weight:bold">total</span>
			</div>
		`;
	}

	setWatchBestHandler(handler: () => void): void {
		this.onWatchBest = handler;
	}

	setForkRequestHandler(handler: (ep: RecordedEpisode) => void): void {
		this.onForkRequested = handler;
	}

	setEpisodesProvider(provider: () => RecordedEpisode[]): void {
		this.episodesProvider = provider;
	}

	setPreset(preset: GravityPreset): void {
		const label = this.panel.querySelector(
			"#at-world-label",
		) as HTMLDivElement | null;
		if (label) {
			label.textContent = `WORLD: ${preset.name.toUpperCase()} · g=${preset.gravity}`;
			label.style.color = preset.color;
		}
	}

	onEpisodeRecorded(_ep: RecordedEpisode): void {
		this.refreshForkInfo();
	}

	private getEpisodes(): RecordedEpisode[] {
		return this.episodesProvider?.() ?? [];
	}

	private handleChartClick(e: MouseEvent): void {
		const episodes = this.getEpisodes();
		if (episodes.length === 0) return;
		const rect = this.chartCanvas.getBoundingClientRect();
		const clickX = e.clientX - rect.left;
		const rel = Math.max(0, Math.min(1, clickX / rect.width));
		const dqnHistory = this.tracks.dqn.rewardHistory;
		if (dqnHistory.length < 2) return;
		const idxInHistory = Math.round(rel * (dqnHistory.length - 1));
		const episodeNum =
			this.tracks.dqn.episodes - (dqnHistory.length - 1 - idxInHistory);
		// Reject clicks on episodes that have rolled out of the recorder buffer.
		// The reward chart can show up to MAX_CHART_POINTS, but the recorder
		// only keeps the last N (= 10) episode trajectories. Silently picking
		// the closest buffered episode would launch a different run than the
		// user clicked.
		const minBuffered = episodes.reduce(
			(m, ep) => Math.min(m, ep.episode),
			episodes[0].episode,
		);
		if (episodeNum < minBuffered) {
			this.selectedEpisodeId = null;
			this.forkInfoEl.textContent = `Episode ${episodeNum} rolled out of the buffer. Click a more recent point (ep ${minBuffered}+).`;
			this.forkBtn.disabled = true;
			this.forkBtn.style.opacity = "0.5";
			this.drawChart();
			return;
		}
		const exact = episodes.find((ep) => ep.episode === episodeNum);
		this.selectedEpisodeId = (exact ?? episodes[episodes.length - 1]).id;
		this.refreshForkInfo();
		this.drawChart();
	}

	private refreshForkInfo(): void {
		const episodes = this.getEpisodes();
		if (episodes.length === 0) {
			this.forkInfoEl.textContent =
				"Click any point on the DQN curve to pick an episode.";
			this.forkBtn.disabled = true;
			this.forkBtn.style.opacity = "0.5";
			return;
		}
		const selected =
			episodes.find((ep) => ep.id === this.selectedEpisodeId) ?? null;
		if (!selected) {
			this.forkInfoEl.textContent = `${episodes.length} episode${episodes.length === 1 ? "" : "s"} buffered. Click the curve to pick one.`;
			this.forkBtn.disabled = true;
			this.forkBtn.style.opacity = "0.5";
			return;
		}
		const result = selected.landed ? "LANDED" : "CRASHED";
		this.forkInfoEl.innerHTML = `
			<div style="color:#00ff88">Episode ${selected.episode} · ${result}</div>
			<div style="color:#aaa">reward ${selected.totalReward.toFixed(0)} · ${selected.steps} frames</div>
		`;
		this.forkBtn.disabled = false;
		this.forkBtn.style.opacity = "1";
	}

	private triggerFork(): void {
		const episodes = this.getEpisodes();
		const selected =
			episodes.find((ep) => ep.id === this.selectedEpisodeId) ?? null;
		if (!selected || !this.onForkRequested) return;
		this.onForkRequested(selected);
	}

	updateStats(stats: AgentStats): void {
		const track = this.tracks[stats.kind];
		track.rewardHistory.push(stats.totalReward);
		if (track.rewardHistory.length > MAX_CHART_POINTS) {
			track.rewardHistory.shift();
		}
		track.lastReward = stats.totalReward;
		track.episodes = stats.episode;

		const isNewBest = stats.totalReward > track.bestReward;
		if (isNewBest) track.bestReward = stats.totalReward;
		const isFirstLanding = stats.landed && !track.bestLanded;
		if (stats.landed) track.bestLanded = true;
		if (isFirstLanding) this.triggerLegendGlow(stats.kind);
		const isFirstCrash = !stats.landed && !this.firstCrash;
		if (!stats.landed && stats.episode === 1 && stats.kind === "dqn") {
			this.firstCrash = true;
		}

		if (stats.kind === "dqn") {
			this.narrationEl.textContent = this.getNarration(
				stats,
				isNewBest,
				isFirstLanding,
				isFirstCrash,
			);
			this.episodeEl.textContent = String(stats.episode);
			this.bestScoreEl.textContent = track.bestReward.toFixed(0);
			this.currentScoreEl.textContent = stats.totalReward.toFixed(0);
			if (stats.epsilon !== undefined) {
				this.epsilonEl.textContent = `${(stats.epsilon * 100).toFixed(0)}%`;
			}
			this.statusEl.textContent = stats.landed ? "LANDED!" : "TRAINING...";
			this.statusEl.style.color = stats.landed ? "#00ff88" : "#ffaa00";

			const hintEl = this.panel.querySelector(
				"#at-watch-hint",
			) as HTMLDivElement;
			if (stats.episode >= 20) {
				this.watchBtn.disabled = false;
				if (hintEl) hintEl.textContent = "Watch the DQN attempt your terrain";
			} else if (hintEl) {
				hintEl.textContent = `Training... ${20 - stats.episode} episodes until ready`;
			}
		} else if (isFirstLanding) {
			this.narrationEl.textContent = `${AGENT_META[stats.kind].label} landed for the first time at episode ${stats.episode}.`;
		}

		this.drawChart();
		if (stats.kind === "dqn") {
			this.refreshForkInfo();
			if (this.explainMode) this.renderBreakdown();
		}
	}

	private getNarration(
		stats: AgentStats,
		isNewBest: boolean,
		isFirstLanding: boolean,
		isFirstCrash: boolean,
	): string {
		const eps = stats.epsilon ?? 0;
		if (isFirstLanding) {
			return `First DQN landing on episode ${stats.episode}! Gentle thrust near the pad is paying off.`;
		}
		if (isFirstCrash && stats.episode === 1) {
			return "First DQN attempt: crashed. It starts random and learns from failures. Policy gradient learns episode-by-episode. Random never learns.";
		}
		if (isNewBest && stats.landed) {
			return `New DQN best. Exploration at ${(eps * 100).toFixed(0)}% — balancing known strategies with new ones.`;
		}
		if (eps < 0.1) {
			return stats.landed
				? "DQN in exploitation phase. Compare its curve against policy gradient to see which algorithm climbs faster."
				: "DQN confident but still crashes on edge cases. Watch how PG's curve wiggles — higher variance on-policy.";
		}
		if (stats.episode % 10 === 0) {
			return `Episode ${stats.episode}. DQN uses a replay buffer; PG updates only at episode end; Random is the floor.`;
		}
		return stats.landed
			? "Landed. DQN reinforces this trajectory via Q-targets."
			: "Training... three algorithms, same terrain, different learning rules.";
	}

	private startVisionLoop(): void {
		if (this.visionRafId !== null) return;
		const tick = (t: number) => {
			this.visionRafId = requestAnimationFrame(tick);
			if (t - this.visionLastDraw < VISION_REFRESH_MS) return;
			this.visionLastDraw = t;
			this.drawVision();
		};
		this.visionRafId = requestAnimationFrame(tick);
	}

	private stopVisionLoop(): void {
		if (this.visionRafId !== null) {
			cancelAnimationFrame(this.visionRafId);
			this.visionRafId = null;
		}
	}

	private drawVision(): void {
		const ctx = this.visionCtx;
		const w = this.visionCanvas.width;
		const h = this.visionCanvas.height;
		ctx.clearRect(0, 0, w, h);

		const state = this.dqnStateProvider?.() ?? null;
		const n = STATE_LABELS.length;
		const rowH = h / n;
		const labelW = 66;
		const valueW = 40;
		const trackX = labelW + 4;
		const trackW = w - labelW - valueW - 8;
		const midX = trackX + trackW / 2;

		ctx.font = "10px 'Courier New', monospace";
		ctx.textBaseline = "middle";

		for (let i = 0; i < n; i++) {
			const y = i * rowH + rowH / 2;
			ctx.fillStyle = "#777";
			ctx.textAlign = "right";
			ctx.fillText(STATE_LABELS[i], labelW, y);

			ctx.strokeStyle = "#222";
			ctx.lineWidth = 1;
			ctx.strokeRect(trackX, y - 4, trackW, 8);
			ctx.fillStyle = "#1a1a1a";
			ctx.fillRect(trackX + 1, y - 3, trackW - 2, 6);

			ctx.strokeStyle = "#333";
			ctx.beginPath();
			ctx.moveTo(midX, y - 4);
			ctx.lineTo(midX, y + 4);
			ctx.stroke();

			if (state && i < state.length) {
				const v = Math.max(-1, Math.min(1, state[i]));
				const barW = (Math.abs(v) * trackW) / 2;
				ctx.fillStyle = v >= 0 ? "#00ff88" : "#ff6666";
				if (v >= 0) ctx.fillRect(midX, y - 3, barW, 6);
				else ctx.fillRect(midX - barW, y - 3, barW, 6);

				ctx.fillStyle = "#ccc";
				ctx.textAlign = "left";
				const sign = state[i] >= 0 ? "+" : "";
				ctx.fillText(`${sign}${state[i].toFixed(2)}`, trackX + trackW + 4, y);
			} else {
				ctx.fillStyle = "#444";
				ctx.textAlign = "left";
				ctx.fillText("—", trackX + trackW + 4, y);
			}
		}
	}

	private drawChart(): void {
		const ctx = this.chartCtx;
		const w = this.chartCanvas.width;
		const h = this.chartCanvas.height;

		ctx.clearRect(0, 0, w, h);

		const padding = 4;
		const plotH = h - padding * 2;
		const plotW = w - padding * 2;

		const allData: number[] = [];
		for (const k of AGENT_ORDER) allData.push(...this.tracks[k].rewardHistory);
		if (allData.length < 2) return;

		const min = Math.min(...allData);
		const max = Math.max(...allData);
		const range = max - min || 1;

		ctx.strokeStyle = "#222";
		ctx.lineWidth = 1;
		for (let i = 0; i < 4; i++) {
			const y = padding + (plotH / 3) * i;
			ctx.beginPath();
			ctx.moveTo(padding, y);
			ctx.lineTo(w - padding, y);
			ctx.stroke();
		}

		if (min < 0 && max > 0) {
			const zeroY = padding + plotH - ((0 - min) / range) * plotH;
			ctx.strokeStyle = "#444";
			ctx.setLineDash([4, 4]);
			ctx.beginPath();
			ctx.moveTo(padding, zeroY);
			ctx.lineTo(w - padding, zeroY);
			ctx.stroke();
			ctx.setLineDash([]);
		}

		// Draw each agent's smoothed curve (moving average window 10)
		for (const kind of AGENT_ORDER) {
			const data = this.tracks[kind].rewardHistory;
			if (data.length < 2) continue;

			ctx.strokeStyle = AGENT_META[kind].color;
			ctx.lineWidth = 2;
			ctx.globalAlpha = 0.95;
			ctx.beginPath();

			const windowSize = Math.min(10, data.length);
			let started = false;
			for (let i = 0; i < data.length; i++) {
				const start = Math.max(0, i - windowSize + 1);
				let sum = 0;
				for (let j = start; j <= i; j++) sum += data[j];
				const avg = sum / (i - start + 1);
				const x = padding + (i / Math.max(1, data.length - 1)) * plotW;
				const y = padding + plotH - ((avg - min) / range) * plotH;
				if (!started) {
					ctx.moveTo(x, y);
					started = true;
				} else {
					ctx.lineTo(x, y);
				}
			}
			ctx.stroke();
		}
		ctx.globalAlpha = 1;

		// Selected-episode marker on the DQN curve
		if (this.selectedEpisodeId !== null) {
			const episodes = this.getEpisodes();
			const selected = episodes.find((ep) => ep.id === this.selectedEpisodeId);
			const dqnHistory = this.tracks.dqn.rewardHistory;
			if (selected && dqnHistory.length >= 1) {
				const dqnEpisodes = this.tracks.dqn.episodes;
				const idxInHistory =
					dqnHistory.length - 1 - (dqnEpisodes - selected.episode);
				if (idxInHistory >= 0 && idxInHistory < dqnHistory.length) {
					const x =
						padding +
						(idxInHistory / Math.max(1, dqnHistory.length - 1)) * plotW;
					ctx.strokeStyle = "#00aaff";
					ctx.setLineDash([3, 3]);
					ctx.lineWidth = 1;
					ctx.beginPath();
					ctx.moveTo(x, padding);
					ctx.lineTo(x, padding + plotH);
					ctx.stroke();
					ctx.setLineDash([]);
				}
			}
		}
	}
}
