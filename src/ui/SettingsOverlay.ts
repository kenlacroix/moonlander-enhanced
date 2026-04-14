import {
	clearLLMConfig,
	type LLMConfig,
	loadLLMConfig,
	type ProviderType,
	saveLLMConfig,
} from "../api/LLMProvider";

/**
 * HTML overlay for LLM API settings.
 * Canvas can't do text inputs, so this is a DOM overlay that sits on top.
 */

export class SettingsOverlay {
	private overlay: HTMLDivElement;
	private onClose: ((config: LLMConfig | null) => void) | null = null;

	constructor() {
		this.overlay = document.createElement("div");
		this.overlay.id = "settings-overlay";
		this.overlay.style.cssText = `
			display: none; position: fixed; inset: 0; z-index: 100;
			background: rgba(0,0,0,0.9); color: #fff;
			font-family: "Courier New", monospace;
			display: none; flex-direction: column; align-items: center; justify-content: center;
		`;
		this.overlay.innerHTML = `
			<div style="width: 400px; padding: 30px;">
				<h2 style="color: #00ff88; margin: 0 0 8px 0; font-size: 20px;">AI SETTINGS</h2>
				<p style="color: #888; font-size: 12px; margin: 0 0 20px 0;">
					Optional. Enables AI mission briefings and commentary.<br>
					Key is stored in your browser only, never sent to us.
				</p>
				<label style="color: #aaa; font-size: 12px;">Provider</label>
				<select id="llm-provider" style="width: 100%; padding: 8px; margin: 4px 0 12px 0;
					background: #111; color: #fff; border: 1px solid #333; font-family: inherit;">
					<option value="anthropic">Anthropic (Claude)</option>
					<option value="openai">OpenAI (GPT)</option>
					<option value="custom">Custom (OpenAI-compatible)</option>
				</select>
				<label style="color: #aaa; font-size: 12px;">API Key</label>
				<input id="llm-key" type="password" placeholder="sk-... or your API key"
					style="width: 100%; padding: 8px; margin: 4px 0 12px 0;
					background: #111; color: #fff; border: 1px solid #333; font-family: inherit; box-sizing: border-box;">
				<label style="color: #aaa; font-size: 12px;">Model (optional)</label>
				<input id="llm-model" type="text" placeholder="Leave blank for default"
					style="width: 100%; padding: 8px; margin: 4px 0 12px 0;
					background: #111; color: #fff; border: 1px solid #333; font-family: inherit; box-sizing: border-box;">
				<div id="llm-custom-url" style="display: none;">
					<label style="color: #aaa; font-size: 12px;">Base URL</label>
					<input id="llm-url" type="text" placeholder="https://your-api.com"
						style="width: 100%; padding: 8px; margin: 4px 0 12px 0;
						background: #111; color: #fff; border: 1px solid #333; font-family: inherit; box-sizing: border-box;">
				</div>
				<div style="display: flex; gap: 10px; margin-top: 16px;">
					<button id="llm-save" style="flex: 1; padding: 10px; background: #00ff88; color: #000;
						border: none; font-family: inherit; font-weight: bold; cursor: pointer;">SAVE</button>
					<button id="llm-clear" style="padding: 10px; background: #333; color: #fff;
						border: none; font-family: inherit; cursor: pointer;">CLEAR</button>
					<button id="llm-cancel" style="padding: 10px; background: #333; color: #fff;
						border: none; font-family: inherit; cursor: pointer;">CANCEL</button>
				</div>
				<p id="llm-status" style="color: #888; font-size: 11px; margin-top: 12px; text-align: center;"></p>
			</div>
		`;
		document.body.appendChild(this.overlay);

		// Wire events
		const providerSelect = this.overlay.querySelector(
			"#llm-provider",
		) as HTMLSelectElement;
		providerSelect.addEventListener("change", () => {
			const customUrl = this.overlay.querySelector(
				"#llm-custom-url",
			) as HTMLDivElement;
			customUrl.style.display =
				providerSelect.value === "custom" ? "block" : "none";
		});

		this.overlay
			.querySelector("#llm-save")!
			.addEventListener("click", () => this.handleSave());
		this.overlay
			.querySelector("#llm-clear")!
			.addEventListener("click", () => this.handleClear());
		this.overlay
			.querySelector("#llm-cancel")!
			.addEventListener("click", () => this.hide());
	}

	show(onClose: (config: LLMConfig | null) => void): void {
		this.onClose = onClose;
		const config = loadLLMConfig();

		const provider = this.overlay.querySelector(
			"#llm-provider",
		) as HTMLSelectElement;
		const key = this.overlay.querySelector("#llm-key") as HTMLInputElement;
		const model = this.overlay.querySelector("#llm-model") as HTMLInputElement;
		const url = this.overlay.querySelector("#llm-url") as HTMLInputElement;
		const status = this.overlay.querySelector(
			"#llm-status",
		) as HTMLParagraphElement;

		provider.value = config?.provider ?? "anthropic";
		key.value = config?.apiKey ?? "";
		model.value = config?.model ?? "";
		url.value = config?.baseUrl ?? "";
		status.textContent = config ? "Currently configured." : "No API key set.";

		const customUrl = this.overlay.querySelector(
			"#llm-custom-url",
		) as HTMLDivElement;
		customUrl.style.display = provider.value === "custom" ? "block" : "none";

		this.overlay.style.display = "flex";
		key.focus();
	}

	private hide(): void {
		this.overlay.style.display = "none";
		this.onClose?.(loadLLMConfig());
		this.onClose = null;
	}

	private handleSave(): void {
		const provider = (
			this.overlay.querySelector("#llm-provider") as HTMLSelectElement
		).value as ProviderType;
		const apiKey = (
			this.overlay.querySelector("#llm-key") as HTMLInputElement
		).value.trim();
		const model = (
			this.overlay.querySelector("#llm-model") as HTMLInputElement
		).value.trim();
		const baseUrl = (
			this.overlay.querySelector("#llm-url") as HTMLInputElement
		).value.trim();
		const status = this.overlay.querySelector(
			"#llm-status",
		) as HTMLParagraphElement;

		if (!apiKey) {
			status.textContent = "API key is required.";
			status.style.color = "#ff4444";
			return;
		}

		const config: LLMConfig = {
			provider,
			apiKey,
			model: model || "",
			baseUrl: baseUrl || undefined,
		};
		saveLLMConfig(config);
		status.textContent = "Saved!";
		status.style.color = "#00ff88";
		setTimeout(() => this.hide(), 500);
	}

	private handleClear(): void {
		clearLLMConfig();
		(this.overlay.querySelector("#llm-key") as HTMLInputElement).value = "";
		(this.overlay.querySelector("#llm-model") as HTMLInputElement).value = "";
		(this.overlay.querySelector("#llm-url") as HTMLInputElement).value = "";
		const status = this.overlay.querySelector(
			"#llm-status",
		) as HTMLParagraphElement;
		status.textContent = "Cleared.";
		status.style.color = "#888";
	}
}
