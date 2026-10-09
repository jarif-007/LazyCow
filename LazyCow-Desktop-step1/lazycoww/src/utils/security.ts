import { SavedShortcut } from '../types/actions';
import { hasDangerousActions } from './danger';

/**
 * One-time migration: for every shortcut that has no explicit `secured`
 * field yet, compute a default from its actions and the current global
 * toggle. Existing values are preserved — a user who already toggled a
 * shortcut keeps their choice.
 *
 * Called from Library on mount. Safe to run repeatedly (idempotent).
 */
export function migrateShortcutsSecured(shortcuts: SavedShortcut[]): { shortcuts: SavedShortcut[]; changed: boolean } {
    let changed = false;
    const next = shortcuts.map((sc) => {
        if (typeof sc.secured === 'boolean') return sc;
        changed = true;
        return { ...sc, secured: hasDangerousActions(sc.actions) };
    });
    return { shortcuts: next, changed };
}

/**
 * Read the current global "Secured Shortcuts" default. Used when creating
 * a new shortcut — the new shortcut inherits `secured` from this default.
 */
export function readSecuredShortcutsDefault(): boolean {
    try {
        const raw = localStorage.getItem('lazycow_settings');
        if (!raw) return true;
        const parsed = JSON.parse(raw);
        if (typeof parsed.securedShortcutsEnabled === 'boolean') return parsed.securedShortcutsEnabled;
        // Fall back to the pre-rename key if migration hasn't run yet.
        if (typeof parsed.showDangerWarnings === 'boolean') return parsed.showDangerWarnings;
        return true;
    } catch {
        return true;
    }
}

/**
 * Read the double-press window (in seconds) from settings. Falls back to 5.
 */
export function readSecuredDoublePressSeconds(): number {
    try {
        const raw = localStorage.getItem('lazycow_settings');
        if (!raw) return 5;
        const parsed = JSON.parse(raw);
        const n = Number(parsed?.securedDoublePressSeconds);
        if (Number.isFinite(n) && n >= 5 && n <= 30) return Math.round(n);
        return 5;
    } catch {
        return 5;
    }
}