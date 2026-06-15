/**
 * Player-facing "what's new" entries, newest first. Curated and deliberately
 * short — this is the heads-up toast on the title screen, NOT the dev-facing
 * CHANGELOG.md. Add a one-or-two sentence entry here on every release (wired
 * into /document-release). The newest entry's `version` is the single source
 * of truth for "current version" used by the toast gate, so no separate
 * VERSION import is needed in-app. See [[WhatsNewToast.ts]].
 */
export interface WhatsNewEntry {
	version: string;
	date: string;
	summary: string;
}

export const WHATS_NEW: readonly WhatsNewEntry[] = [
	{
		version: "0.6.9.0",
		date: "2026-06-14",
		summary:
			"The title and mission-select screens now have their own calm ambient music — a soft pad with a sparse arpeggio — instead of silence before you fly.",
	},
	{
		version: "0.6.8.0",
		date: "2026-06-14",
		summary:
			"The title screen now flags when the game's been updated — click this card to see what changed, or dismiss it. You're looking at it.",
	},
	{
		version: "0.6.7.0",
		date: "2026-06-14",
		summary:
			"Random Missions now generate genuinely different terrain — cratered fields, jagged spires, terraced mesas, and rolling plains each get their own shape. Roll a new mission to see it.",
	},
	{
		version: "0.6.6.0",
		date: "2026-06-14",
		summary:
			"Gamepad support! Plug in any Xbox, PlayStation, or 8BitDo controller and fly with the stick and triggers — with rumble on thrust, impact, and gravity storms.",
	},
	{
		version: "0.6.5.0",
		date: "2026-06-07",
		summary:
			"Campaign flight director Hoshi and CapCom Chen now have animated portraits that talk during briefings, callouts, and post-landing analysis.",
	},
];

/** The newest release — the version the toast compares against last-seen. */
export const LATEST_VERSION = WHATS_NEW[0]?.version ?? "";

/**
 * Whether to show the toast. Shows only when the player has seen a PRIOR
 * version (i.e. an actual update happened). A brand-new player (`seen` null)
 * sees nothing — the caller persists `LATEST_VERSION` silently so the next
 * release triggers the toast.
 */
export function isUpdatePending(
	seen: string | null,
	latest: string = LATEST_VERSION,
): boolean {
	if (!latest) return false;
	if (seen === null) return false;
	return seen !== latest;
}
