import {
	isUpdatePending,
	LATEST_VERSION,
	WHATS_NEW,
	type WhatsNewEntry,
} from "../data/whatsNew";

/**
 * Title-screen "what's new" toast. A small DOM corner card (Canvas can't do
 * clickable text, and the title is keyboard-driven on desktop) shown once when
 * the build version is newer than the last version the player saw. Collapsed
 * by default — click to expand the summary, X to dismiss. Dismissing or
 * leaving the title persists the seen-version so it never nags twice for the
 * same release. See [[whats-new]].
 */

const STORAGE_KEY = "moonlander-last-seen-version";

function loadSeen(): string | null {
	try {
		return localStorage.getItem(STORAGE_KEY);
	} catch {
		return null;
	}
}

function saveSeen(version: string): void {
	try {
		localStorage.setItem(STORAGE_KEY, version);
	} catch {
		// localStorage unavailable (private mode) — degrade silently.
	}
}

export class WhatsNewToast {
	private overlay: HTMLDivElement;
	private pending: boolean;
	private expanded = false;
	private visible = false;

	constructor() {
		const seen = loadSeen();
		// Suppress in embed mode — embeds hide all chrome.
		const embed = document.body.classList.contains("embed");
		this.pending = !embed && isUpdatePending(seen);
		// Brand-new player: record the current version silently so only a
		// future update raises the toast.
		if (seen === null && LATEST_VERSION) saveSeen(LATEST_VERSION);

		this.overlay = document.createElement("div");
		this.overlay.id = "whats-new-toast";
		this.overlay.style.cssText = `
			display: none; position: fixed; right: 16px; bottom: 16px; z-index: 50;
			width: 300px; max-width: calc(100vw - 32px);
			background: rgba(8, 12, 20, 0.94); color: #fff;
			border: 1px solid #33ccff; border-radius: 6px;
			font-family: "Courier New", monospace; box-shadow: 0 4px 16px rgba(0,0,0,0.5);
			overflow: hidden;
		`;
		this.overlay.innerHTML = `
			<div id="wn-header" style="display: flex; align-items: center; gap: 8px;
				padding: 10px 12px; cursor: pointer;">
				<span aria-hidden="true" style="color: #33ccff;">✦</span>
				<span style="flex: 1; font-size: 12px; font-weight: bold; color: #33ccff;">
					Updated to v${LATEST_VERSION}
				</span>
				<span id="wn-caret" style="color: #88aabb; font-size: 11px;">details ▸</span>
				<button id="wn-dismiss" aria-label="Dismiss" style="background: none; border: none;
					color: #88aabb; font-size: 16px; line-height: 1; cursor: pointer; padding: 0 2px;">×</button>
			</div>
			<div id="wn-body" style="display: none; padding: 0 12px 12px 12px;
				font-size: 12px; line-height: 1.5; color: #cdd9e5;"></div>
		`;
		document.body.appendChild(this.overlay);

		this.overlay.querySelector("#wn-header")?.addEventListener("click", (e) => {
			if ((e.target as HTMLElement).id === "wn-dismiss") return;
			this.toggleExpanded();
		});
		this.overlay
			.querySelector("#wn-dismiss")
			?.addEventListener("click", (e) => {
				e.stopPropagation();
				this.dismiss();
			});
	}

	/** Drive visibility from the game's current screen. Show on the title
	 * screen; when the player navigates away (or dismisses), mark the version
	 * seen so it never reappears for this release. */
	update(onTitle: boolean): void {
		if (!this.pending) {
			this.setVisible(false);
			return;
		}
		if (onTitle) {
			this.setVisible(true);
		} else if (this.visible) {
			// Player started a game without dismissing — count as seen.
			this.markSeen();
		}
	}

	private toggleExpanded(): void {
		this.expanded = !this.expanded;
		const body = this.overlay.querySelector("#wn-body") as HTMLDivElement;
		const caret = this.overlay.querySelector("#wn-caret") as HTMLSpanElement;
		if (this.expanded) {
			body.textContent = this.latestSummary();
			body.style.display = "block";
			caret.textContent = "hide ▾";
		} else {
			body.style.display = "none";
			caret.textContent = "details ▸";
		}
	}

	private latestSummary(): string {
		const entry: WhatsNewEntry | undefined = WHATS_NEW[0];
		return entry ? entry.summary : "";
	}

	private setVisible(show: boolean): void {
		if (show === this.visible) return;
		this.visible = show;
		this.overlay.style.display = show ? "block" : "none";
	}

	private dismiss(): void {
		this.markSeen();
	}

	private markSeen(): void {
		this.pending = false;
		this.setVisible(false);
		if (LATEST_VERSION) saveSeen(LATEST_VERSION);
	}
}
