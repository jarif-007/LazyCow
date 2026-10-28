/**
 * Usage counter for the App Drawer's "Frequently used" row.
 *
 * We count how many times the user *picks* an app from the drawer — not
 * how many times a shortcut containing it runs. The drawer is a selection
 * surface, so counting selections is the cleanest intent signal. If users
 * later want "frequently-run shortcuts to show up", that's a v2 addition.
 *
 * Storage: localStorage, keyed by the app's absolute path (lowercased for
 * dedup). Paths are stable; app names can change.
 */

const STORAGE_KEY = 'lazycow-app-usage';

type UsageMap = Record<string, number>;

function readUsage(): UsageMap {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return {};
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as UsageMap;
    } catch { /* ignore */ }
    return {};
}

/** Bump the counter for one app path. Called when the user picks an app. */
export function recordAppUsage(appPath: string): void {
    const usage = readUsage();
    const key = appPath.toLowerCase();
    usage[key] = (usage[key] || 0) + 1;
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(usage));
    } catch { /* quota errors — ignore */ }
}

/**
 * Return the top N most-used apps from the given list, sorted by usage
 * count descending. Apps with zero usage are excluded — so a fresh install
 * has an empty "frequently used" row, which is correct.
 */
export function getFrequentlyUsedApps(
    allApps: InstalledAppForIPC[],
    limit = 8
): InstalledAppForIPC[] {
    const usage = readUsage();
    return allApps
        .filter((a) => (usage[a.path.toLowerCase()] || 0) > 0)
        .sort((a, b) => (usage[b.path.toLowerCase()] || 0) - (usage[a.path.toLowerCase()] || 0))
        .slice(0, limit);
}

/** Reset all usage data. Used by the Settings factory reset (localStorage.clear). */
export function clearAppUsage(): void {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
}