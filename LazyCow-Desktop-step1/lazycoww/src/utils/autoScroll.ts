/**
 * Shared reader for the user's auto-scroll speed preference.
 * Used by Library's selection-mode drag and (eventually) Builder's
 * ActionSequence — single source of truth so the two surfaces can't drift.
 *
 * Reads `lazycow_settings.autoScrollSpeed` (2–20, default 9).
 */
const DEFAULT_SPEED = 9;

export function readAutoScrollSpeed(): number {
    try {
        const raw = localStorage.getItem('lazycow_settings');
        if (!raw) return DEFAULT_SPEED;
        const v = Number(JSON.parse(raw)?.autoScrollSpeed);
        if (Number.isFinite(v) && v >= 2 && v <= 20) return v;
    } catch {
        /* ignore */
    }
    return DEFAULT_SPEED;
}