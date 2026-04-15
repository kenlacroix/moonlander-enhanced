import {
	AGENT_COLORS,
	AGENT_LABELS,
	type AgentKind,
	type AgentStats,
} from "../ai/Agent";
import type { RecordedEpisode } from "../ai/EpisodeRecorder";
import type { GravityPreset } from "../game/GravityPresets";

const PANEL_WIDTH = 360;
const CHART_HEIGHT = 160;
const MAX_CHART_POINTS = 200;

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

		const legendHtml = AGENT_ORDER.map(
			(k) => `
				<div style="display:flex;align-items:center;gap:6px">
					<span style="display:inline-block;width:14px;height:3px;background:${AGENT_COLORS[k]}"></span>
					<span style="color:#aaa;font-size:11px">${AGENT_LABELS[k]}</span>
				</div>
			`,
		).join("");

		this.panel.innerHTML = `
			<div style="color:#00ff88;font-size:16px;font-weight:bold;text-align:center;letter-spacing:2px">
				AI THEATER
			</div>
			<div id="at-world-label" style="color:#aaa;font-size:11px;text-align:center;margin-top:-8px">
				WORLD: MOON · g=1.62
			</div>
			<div style="border-bottom:1px solid #333;padding-bottom:8px">
				<div style="color:#888;font-size:11px;margin-bottom:4px">DQN STATUS</div>
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
			<div>
				<div style="color:#888;font-size:11px;margin-bottom:4px">REWARD CURVES (smoothed)</div>
				<canvas id="at-chart" width="${PANEL_WIDTH - 32}" height="${CHART_HEIGHT}"
					style="background:#111;border:1px solid #333;border-radius:4px;width:100%"></canvas>
				<div style="display:flex;justify-content:space-around;margin-top:6px">${legendHtml}</div>
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
	}

	unmount(): void {
		this.panel.remove();
		this.tracks = this.makeTracks();
		this.firstCrash = false;
		this.selectedEpisodeId = null;
		this.onForkRequested = null;
		this.episodesProvider = null;
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
			this.narrationEl.textContent = `${AGENT_LABELS[stats.kind]} landed for the first time at episode ${stats.episode}.`;
		}

		this.drawChart();
		if (stats.kind === "dqn") this.refreshForkInfo();
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

			ctx.strokeStyle = AGENT_COLORS[kind];
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
