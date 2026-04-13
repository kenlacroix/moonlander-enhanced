/**
 * Multi-provider LLM abstraction.
 * Supports Anthropic (Claude), OpenAI (GPT), and any OpenAI-compatible API.
 * API key stored in localStorage, never committed to code.
 */

export type ProviderType = "anthropic" | "openai" | "custom";

export interface LLMConfig {
	provider: ProviderType;
	apiKey: string;
	model: string;
	baseUrl?: string; // for custom/self-hosted endpoints
}

export interface LLMMessage {
	role: "user" | "assistant" | "system";
	content: string;
}

const STORAGE_KEY = "moonlander-llm-config";

const DEFAULT_MODELS: Record<ProviderType, string> = {
	anthropic: "claude-sonnet-4-20250514",
	openai: "gpt-4o-mini",
	custom: "gpt-4o-mini",
};

const DEFAULT_URLS: Record<ProviderType, string> = {
	anthropic: "https://api.anthropic.com",
	openai: "https://api.openai.com",
	custom: "",
};

export function loadLLMConfig(): LLMConfig | null {
	try {
		const data = localStorage.getItem(STORAGE_KEY);
		if (data) return JSON.parse(data) as LLMConfig;
	} catch {
		// localStorage unavailable
	}
	return null;
}

export function saveLLMConfig(config: LLMConfig): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
	} catch {
		// localStorage unavailable
	}
}

export function clearLLMConfig(): void {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// localStorage unavailable
	}
}

/** Stream a completion from the configured LLM provider */
export async function streamCompletion(
	config: LLMConfig,
	messages: LLMMessage[],
	onChunk: (text: string) => void,
): Promise<string> {
	if (config.provider === "anthropic") {
		return streamAnthropic(config, messages, onChunk);
	}
	// OpenAI and custom both use the OpenAI-compatible API format
	return streamOpenAI(config, messages, onChunk);
}

async function streamAnthropic(
	config: LLMConfig,
	messages: LLMMessage[],
	onChunk: (text: string) => void,
): Promise<string> {
	const systemMsg = messages.find(m => m.role === "system");
	const userMessages = messages.filter(m => m.role !== "system").map(m => ({
		role: m.role,
		content: m.content,
	}));

	const response = await fetch(`${config.baseUrl || DEFAULT_URLS.anthropic}/v1/messages`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"x-api-key": config.apiKey,
			"anthropic-version": "2023-06-01",
			"anthropic-dangerous-direct-browser-access": "true",
		},
		body: JSON.stringify({
			model: config.model || DEFAULT_MODELS.anthropic,
			max_tokens: 300,
			stream: true,
			system: systemMsg?.content ?? "",
			messages: userMessages,
		}),
	});

	if (!response.ok) {
		throw new Error(`Anthropic API error: ${response.status}`);
	}

	return readSSEStream(response, (event) => {
		if (event.type === "content_block_delta") {
			const text = event.delta?.text ?? "";
			if (text) onChunk(text);
			return text;
		}
		return "";
	});
}

async function streamOpenAI(
	config: LLMConfig,
	messages: LLMMessage[],
	onChunk: (text: string) => void,
): Promise<string> {
	const baseUrl = config.baseUrl || DEFAULT_URLS.openai;

	const response = await fetch(`${baseUrl}/v1/chat/completions`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			"Authorization": `Bearer ${config.apiKey}`,
		},
		body: JSON.stringify({
			model: config.model || DEFAULT_MODELS.openai,
			max_tokens: 300,
			stream: true,
			messages: messages.map(m => ({ role: m.role, content: m.content })),
		}),
	});

	if (!response.ok) {
		throw new Error(`OpenAI API error: ${response.status}`);
	}

	return readSSEStream(response, (event) => {
		const delta = event.choices?.[0]?.delta?.content ?? "";
		if (delta) onChunk(delta);
		return delta;
	});
}

// biome-ignore lint/suspicious/noExplicitAny: SSE events have varied shapes
async function readSSEStream(response: Response, extractText: (event: any) => string): Promise<string> {
	const reader = response.body?.getReader();
	if (!reader) throw new Error("No response body");

	const decoder = new TextDecoder();
	let fullText = "";
	let buffer = "";

	while (true) {
		const { done, value } = await reader.read();
		if (done) break;

		buffer += decoder.decode(value, { stream: true });
		const lines = buffer.split("\n");
		buffer = lines.pop() ?? "";

		for (const line of lines) {
			if (!line.startsWith("data: ")) continue;
			const data = line.slice(6).trim();
			if (data === "[DONE]") continue;
			try {
				const event = JSON.parse(data);
				fullText += extractText(event);
			} catch {
				// skip malformed JSON
			}
		}
	}

	return fullText;
}
