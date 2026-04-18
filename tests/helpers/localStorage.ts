/**
 * Minimal in-memory localStorage polyfill for vitest's default Node env.
 * Install once in a `beforeAll` hook if `globalThis.localStorage` is absent.
 *
 * Shared across authentic-regression, authentic-integration, and ghost tests
 * so the polyfill lives in one place instead of copy-pasted three times.
 */
export function installLocalStoragePolyfill(): void {
	if (
		typeof (globalThis as { localStorage?: Storage }).localStorage !==
		"undefined"
	) {
		return;
	}
	const store = new Map<string, string>();
	(globalThis as { localStorage: Storage }).localStorage = {
		getItem: (k) => store.get(k) ?? null,
		setItem: (k, v) => {
			store.set(k, String(v));
		},
		removeItem: (k) => {
			store.delete(k);
		},
		clear: () => store.clear(),
		key: (i) => Array.from(store.keys())[i] ?? null,
		get length() {
			return store.size;
		},
	};
}
