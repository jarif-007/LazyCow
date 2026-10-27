import { SavedShortcut } from '../types/actions';

/**
 * Shared read/write helpers for lazycow-shortcuts.
 *
 * Chromium's localStorage writes are asynchronous — they're flushed to disk
 * on Chromium's own schedule, and NOT flushed at all on a hard kill
 * (Ctrl+C in dev mode, taskkill, power loss). This caused a real data-loss
 * incident on 2026-10-15: the user duplicated shortcuts, killed the dev
 * server, and everything was gone on restart.
 *
 * Fix: mirror every write to disk via a synchronous IPC call. Disk is the
 * safety net — if localStorage loses writes, we restore from disk on
 * startup. See electron/main.ts for the IPC handlers.
 */

const KEY = 'lazycow-shortcuts';

/** Write to localStorage AND disk. Call this everywhere we persist shortcuts. */
export function persistShortcuts(list: SavedShortcut[]): void {
    try {
        localStorage.setItem(KEY, JSON.stringify(list));
    } catch (err) {
        console.warn('[shortcut-storage] localStorage write failed:', err);
    }
    // Fire-and-forget the disk mirror. If IPC fails, we've at least written
    // localStorage; if localStorage fails, disk is the fallback.
    window.electronAPI?.writeShortcutsToDisk(list);
    
    // Trigger instant update for the Account page
    window.dispatchEvent(new CustomEvent('lazycow-shortcuts-changed'));
}

/** Read the current shortcut list from localStorage. Synchronous. */
export function readShortcuts(): SavedShortcut[] {
    try {
        const raw = localStorage.getItem(KEY) || '[]';
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

/**
 * Called once on Library mount. If localStorage is empty (fresh origin,
 * or a dev-mode hard kill ate the writes), try the disk mirror. On success,
 * sync the disk data back into localStorage so all existing code paths see it.
 *
 * Returns the recovered list, or null if nothing was recovered.
 */
// ─── Deletion tracking ──────────────────────────────────────────────────
// When a user deletes a shortcut in Library, we record the ID here so the
// Account page can offer "push this deletion to cloud". Without it, deleting
// a synced shortcut left the cloud copy orphaned with no way to propagate.
// Cleanup: ID is filtered out against the live cloud list at render time, so
// stale entries are harmless; they're pruned after each successful push.
const PENDING_DELETIONS_KEY = 'lazycow-pending-deletions';

export function readPendingDeletions(): string[] {
    try {
        const raw = localStorage.getItem(PENDING_DELETIONS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
}

export function addPendingDeletion(id: string): void {
    const current = readPendingDeletions();
    if (!current.includes(id)) {
        current.push(id);
        try { localStorage.setItem(PENDING_DELETIONS_KEY, JSON.stringify(current)); } catch { /* ignore */ }
    }
}

export function addPendingDeletions(ids: string[]): void {
    const current = readPendingDeletions();
    let changed = false;
    for (const id of ids) {
        if (!current.includes(id)) { current.push(id); changed = true; }
    }
    if (changed) {
        try { localStorage.setItem(PENDING_DELETIONS_KEY, JSON.stringify(current)); } catch { /* ignore */ }
    }
}

export function removePendingDeletions(ids: string[]): void {
    const current = readPendingDeletions();
    const next = current.filter(id => !ids.includes(id));
    if (next.length !== current.length) {
        try { localStorage.setItem(PENDING_DELETIONS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    }
}

// ─── Per-shortcut "auto-sync edits" opt-in ──────────────────────────────
// Users who opt in are OK with edits to THIS shortcut being auto-pushed by
// the timer, without the manual review that non-opted-in shortcuts require.
// Not part of SavedShortcut — deliberately excluded so toggling it doesn't
// appear as a "diff" in areShortcutsEqual and trigger a spurious pending state.
const AUTO_SYNC_EDITS_KEY = 'lazycow-auto-sync-edits';

export function readAutoSyncEdits(): string[] {
    try {
        const raw = localStorage.getItem(AUTO_SYNC_EDITS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
}

export function writeAutoSyncEdits(ids: string[]): void {
    try { localStorage.setItem(AUTO_SYNC_EDITS_KEY, JSON.stringify(ids)); } catch { /* ignore */ }
}

export async function recoverShortcutsFromDiskIfEmpty(): Promise<SavedShortcut[] | null> {
    const stored = localStorage.getItem(KEY);
    if (stored && stored !== '[]') return null;

    try {
        const res = await window.electronAPI?.readShortcutsFromDisk();
        if (res?.ok && Array.isArray(res.data) && res.data.length > 0) {
            const shortcuts = res.data as SavedShortcut[];
            localStorage.setItem(KEY, JSON.stringify(shortcuts));
            return shortcuts;
        }
    } catch (err) {
        console.warn('[shortcut-storage] disk recovery failed:', err);
    }
    return null;
}