import type { TrainingStats } from "../ai/RLAgent";

const PANEL_WIDTH = 360;
const CHART_HEIGHT = 140;
const MAX_CHART_POINTS = 200;

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
	private rewardHistory: number[] = [];
	private bestReward = -Infinity;
	private onWatchBest: (() => void) | null = null;

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

		this.panel.innerHTML = `
			<div style="color:#00ff88;font-size:16px;font-weight:bold;text-align:center;letter-spacing:2px">
				AI THEATER
			</div>
			<div style="border-bottom:1px solid #333;padding-bottom:8px">
				<div style="color:#888;font-size:11px;margin-bottom:4px">STATUS</div>
				<span id="at-status" style="color:#ffaa00">INITIALIZING...</span>
			</div>
			<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
				<div>
					<div style="color:#888;font-size:11px">EPISODES</div>
					<span id="at-episodes" style="color:#fff;font-size:18px">0</span>
				</div>
				<div>
					<div style="color:#888;font-size:11px">EXPLORATION</div>
					<span id="at-epsilon" style="color:#fff;font-size:18px">100%</span>
				</div>
				<div>
					<div style="color:#888;font-size:11px">BEST REWARD</div>
					<span id="at-best" style="color:#00ff88;font-size:18px">—</span>
				</div>
				<div>
					<div style="color:#888;font-size:11px">LAST REWARD</div>
					<span id="at-current" style="color:#fff;font-size:18px">—</span>
				</div>
			</div>
			<div>
				<div style="color:#888;font-size:11px;margin-bottom:4px">REWARD CURVE</div>
				<canvas id="at-chart" width="${PANEL_WIDTH - 32}" height="${CHART_HEIGHT}"
					style="background:#111;border:1px solid #333;border-radius:4px;width:100%"></canvas>
			</div>
			<button id="at-watch-btn" disabled
				style="background:#1a1a1a;color:#00ff88;border:1px solid #00ff88;padding:10px;
				cursor:pointer;font-family:inherit;font-size:13px;border-radius:4px;
				letter-spacing:1px;transition:background 0.2s">
				WATCH AI'S BEST RUN
			</button>
			<div style="color:#555;font-size:11px;text-align:center;margin-top:auto">
				AI trains on your terrain at 50x speed
			</div>
		`;

		this.chartCanvas = this.panel.querySelector("#at-chart")!;
		this.chartCtx = this.chartCanvas.getContext("2d")!;
		this.episodeEl = this.panel.querySelector("#at-episodes")!;
		this.bestScoreEl = this.panel.querySelector("#at-best")!;
		this.currentScoreEl = this.panel.querySelector("#at-current")!;
		this.epsilonEl = this.panel.querySelector("#at-epsilon")!;
		this.statusEl = this.panel.querySelector("#at-status")!;
		this.watchBtn = this.panel.querySelector("#at-watch-btn")!;

		this.watchBtn.addEventListener("click", () => this.onWatchBest?.());
		this.watchBtn.addEventListener("mouseenter", () => {
			if (!this.watchBtn.disabled) this.watchBtn.style.background = "#00ff8822";
		});
		this.watchBtn.addEventListener("mouseleave", () => {
			this.watchBtn.style.background = "#1a1a1a";
		});
	}

	mount(): void {
		document.body.appendChild(this.panel);
	}

	unmount(): void {
		this.panel.remove();
		this.rewardHistory = [];
		this.bestReward = -Infinity;
	}

	setWatchBestHandler(handler: () => void): void {
		this.onWatchBest = handler;
	}

	updateStats(stats: TrainingStats): void {
		this.rewardHistory.push(stats.totalReward);
		if (this.rewardHistory.length > MAX_CHART_POINTS) {
			this.rewardHistory.shift();
		}

		if (stats.totalReward > this.bestReward) {
			this.bestReward = stats.totalReward;
		}

		this.episodeEl.textContent = String(stats.episode);
		this.bestScoreEl.textContent = this.bestReward.toFixed(0);
		this.currentScoreEl.textContent = stats.totalReward.toFixed(0);
		this.epsilonEl.textContent = `${(stats.epsilon * 100).toFixed(0)}%`;
		this.statusEl.textContent = stats.landed ? "LANDED!" : "TRAINING...";
		this.statusEl.style.color = stats.landed ? "#00ff88" : "#ffaa00";

		if (stats.episode > 0) {
			this.watchBtn.disabled = false;
		}

		this.drawChart();
	}

	private drawChart(): void {
		const ctx = this.chartCtx;
		const w = this.chartCanvas.width;
		const h = this.chartCanvas.height;
		const data = this.rewardHistory;

		ctx.clearRect(0, 0, w, h);

		if (data.length < 2) return;

		const min = Math.min(...data);
		const max = Math.max(...data);
		const range = max - min || 1;
		const padding = 4;
		const plotH = h - padding * 2;
		const plotW = w - padding * 2;

		// Grid lines
		ctx.strokeStyle = "#222";
		ctx.lineWidth = 1;
		for (let i = 0; i < 4; i++) {
			const y = padding + (plotH / 3) * i;
			ctx.beginPath();
			ctx.moveTo(padding, y);
			ctx.lineTo(w - padding, y);
			ctx.stroke();
		}

		// Zero line if in range
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

		// Reward curve
		ctx.strokeStyle = "#00ff88";
		ctx.lineWidth = 1.5;
		ctx.beginPath();
		for (let i = 0; i < data.length; i++) {
			const x = padding + (i / (data.length - 1)) * plotW;
			const y = padding + plotH - ((data[i] - min) / range) * plotH;
			if (i === 0) ctx.moveTo(x, y);
			else ctx.lineTo(x, y);
		}
		ctx.stroke();

		// Moving average (window of 10)
		if (data.length >= 10) {
			ctx.strokeStyle = "#ffaa00";
			ctx.lineWidth = 2;
			ctx.beginPath();
			let started = false;
			for (let i = 9; i < data.length; i++) {
				let sum = 0;
				for (let j = i - 9; j <= i; j++) sum += data[j];
				const avg = sum / 10;
				const x = padding + (i / (data.length - 1)) * plotW;
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
	}
}
