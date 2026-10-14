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