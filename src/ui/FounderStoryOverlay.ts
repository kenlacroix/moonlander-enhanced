/**
 * v0.6.13.0 — in-game "Founder's Story" panel. A DOM overlay (Canvas can't
 * host links/scrolling text) opened from the #open-story button in the site
 * credit footer. Holds a short "why I built this" blurb and a real outbound
 * link to the full write-up on the author's site — the engaging half of the
 * reciprocal link to kennethlacroix.me. Mirrors the SettingsOverlay pattern.
 */

const STORY_URL = "https://kennethlacroix.me/blog/moonlander-enhanced";

export class FounderStoryOverlay {
	private overlay: HTMLDivElement;

	constructor() {
		this.overlay = document.createElement("div");
		this.overlay.id = "founder-story-overlay";
		this.overlay.style.cssText = `
			display: none; position: fixed; inset: 0; z-index: 200;
			background: rgba(2,4,8,0.82); color: #cdd9e5;
			font-family: "Courier New", monospace;
			align-items: center; justify-content: center; padding: 16px;
		`;
		this.overlay.innerHTML = `
			<div role="dialog" aria-label="Founder's story" style="
				width: 520px; max-width: 100%; max-height: 88vh; overflow-y: auto;
				background: #080c14; border: 1px solid #2a5a7a; border-radius: 8px;
				padding: 28px 30px; box-shadow: 0 8px 40px rgba(0,0,0,0.6);">
				<h2 style="color: #33ccff; margin: 0 0 4px 0; font-size: 20px;">THE STORY</h2>
				<p style="color: #6a8aa0; font-size: 12px; margin: 0 0 18px 0;">
					Why a 1979 arcade game got a 2026 rebuild.
				</p>
				<p style="font-size: 13px; line-height: 1.7; margin: 0 0 14px 0;">
					MoonLander started as a way to learn by building — game loops, real
					lunar physics (gravity at a true 1.62&nbsp;m/s²), and in-browser AI,
					wrapped around the 1979 arcade classic. No engine, no backend, no
					install: just a canvas, TypeScript, and a lot of iterations.
				</p>
				<p style="font-size: 13px; line-height: 1.7; margin: 0 0 14px 0;">
					It grew well past the original — historic Apollo missions, AI agents
					that learn to land in your browser, procedural terrain, a narrative
					campaign, and an experimental 3D mode. Every release ships to
					<span style="color:#8fd6ff;">canyou.land</span> the same day it's built.
				</p>
				<p style="font-size: 13px; line-height: 1.7; margin: 0 0 22px 0;">
					If you want the longer story of how and why it was built — the vibe,
					the dead ends, the physics rabbit holes — it's written up here:
				</p>
				<div style="display: flex; gap: 10px; align-items: center; flex-wrap: wrap;">
					<a href="${STORY_URL}" target="_blank" rel="author" style="
						flex: 1; min-width: 200px; text-align: center; padding: 11px 14px;
						background: #33ccff; color: #04121c; border-radius: 5px;
						font-weight: bold; text-decoration: none;">Read the full story →</a>
					<button id="founder-story-close" type="button" style="
						padding: 11px 18px; background: #18222c; color: #cdd9e5;
						border: 1px solid #2a5a7a; border-radius: 5px; font: inherit;
						cursor: pointer;">CLOSE</button>
				</div>
			</div>
		`;
		document.body.appendChild(this.overlay);

		const opener = document.getElementById("open-story");
		opener?.addEventListener("click", () => this.show());
		this.overlay
			.querySelector("#founder-story-close")
			?.addEventListener("click", () => this.hide());
		// Click the dim backdrop (but not the dialog) to dismiss.
		this.overlay.addEventListener("click", (e) => {
			if (e.target === this.overlay) this.hide();
		});
		window.addEventListener("keydown", (e) => {
			if (e.key === "Escape" && this.overlay.style.display !== "none") {
				this.hide();
			}
		});
	}

	show(): void {
		this.overlay.style.display = "flex";
	}

	private hide(): void {
		this.overlay.style.display = "none";
	}
}
