/**
 * Persistence for the App Drawer's visibility + custom-app state.
 *
 * React state in `AppDrawerModal` is the source of truth at runtime.
 * These helpers are called only to load initial state and to persist
 * each mutation back to localStorage.
 *
 * Storage shape:
 *   `lazycow-app-visibility` — { hidden: string[], visible: string[] }
 *       Keys are lowercased absolute paths.
 *       `hidden`  = user explicitly hid it
 *       `visible` = user explicitly unhid a system app
 *   `lazycow-custom-apps` — InstalledAppForIPC[]
 *       Apps the user added via "Add to drawer"
 */

const VISIBILITY_KEY = 'lazycow-app-visibility';
const CUSTOM_APPS_KEY = 'lazycow-custom-apps';

interface VisibilityMap {
    hidden: string[];
    visible: string[];
}

function readVisibility(): VisibilityMap {
    try {
        const raw = localStorage.getItem(VISIBILITY_KEY);
        if (!raw) return { hidden: [], visible: [] };
        const parsed = JSON.parse(raw);
        return {
            hidden: Array.isArray(parsed?.hidden) ? parsed.hidden : [],
            visible: Array.isArray(parsed?.visible) ? parsed.visible : [],
        };
    } catch {
        return { hidden: [], visible: [] };
    }
}

/**
 * Load the set of explicitly-hidden app paths. Note: system apps are NOT
 * in this set on first run — the drawer treats `app.system === true` as
 * hidden by default via the same set once the user has interacted with
 * it. To keep the check simple, we prefetch nothing: the drawer merges
 * `app.system` with the returned set at render time.
 */
export function readHiddenSet(): Set<string> {
    return new Set(readVisibility().hidden);
}

export function writeHiddenSet(hidden: Set<string>): void {
    const existing = readVisibility();
    try {
        localStorage.setItem(
            VISIBILITY_KEY,
            JSON.stringify({ hidden: [...hidden], visible: existing.visible })
        );
    } catch { /* quota errors — ignore */ }
}

/**
 * The explicit-visible set. A system app (VC++ redist, etc.) is
 * auto-hidden; adding its path here overrides that and shows it. Unhiding
 * any app writes to this set — for non-system apps it's redundant with
 * clearing `hidden`, but it keeps the mutation uniform.
 */
export function readVisibleSet(): Set<string> {
    return new Set(readVisibility().visible);
}

export function writeVisibleSet(visible: Set<string>): void {
    const existing = readVisibility();
    try {
        localStorage.setItem(
            VISIBILITY_KEY,
            JSON.stringify({ hidden: existing.hidden, visible: [...visible] })
        );
    } catch { /* quota errors — ignore */ }
}

export function readCustomApps(): InstalledAppForIPC[] {
    try {
        const raw = localStorage.getItem(CUSTOM_APPS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((x): x is InstalledAppForIPC =>
            x !== null &&
            typeof x === 'object' &&
            typeof (x as { name?: unknown }).name === 'string' &&
            typeof (x as { path?: unknown }).path === 'string'
        );
    } catch {
        return [];
    }
}

export function writeCustomApps(apps: InstalledAppForIPC[]): void {
    try {
        localStorage.setItem(CUSTOM_APPS_KEY, JSON.stringify(apps));
    } catch { /* quota errors — ignore */ }
}