import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Main-process-only preferences store.
 *
 * These settings must be readable BEFORE `app.whenReady()` — before the
 * renderer boots. That rules out `localStorage` (which lives inside the
 * Chromium process). A tiny JSON file in `userData` is the simplest
 * thing that works.
 *
 * Current contents: `hardwareAcceleration` only. Add fields here only
 * when a setting must be known before the window exists. Do NOT mirror
 * anything from `lazycow_settings` — that lives in the renderer's
 * localStorage and is pushed to the main process via IPC on demand.
 */

export interface MainPreferences {
    /**
     * Default false — matches the app's historical behaviour. Chromium's
     * Direct3D backend causes visible glitches (frozen regions, colour
     * tints, broken ClearType) and mild input lag on a class of Windows
     * laptop GPUs. Users on unaffected hardware can opt in via
     * Settings → General → Hardware Acceleration.
     */
    hardwareAcceleration?: boolean
}

const FILE_NAME = 'preferences.json'

function prefsPath(): string {
    return path.join(app.getPath('userData'), FILE_NAME)
}

/**
 * Synchronous read — used at module load in main.ts, before app is ready.
 * Returns `{}` on any failure so a corrupt file can never brick startup.
 */
export function readPreferencesSync(): MainPreferences {
    try {
        const raw = fs.readFileSync(prefsPath(), 'utf8')
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
            return parsed as MainPreferences
        }
    } catch {
        /* missing or corrupt — fall through to default */
    }
    return {}
}

/**
 * Merge-write the given preferences so partial updates don't clobber
 * unrelated keys. Errors are logged, not thrown — a failed preference
 * write should never surface as a crash.
 */
export function writePreferences(update: Partial<MainPreferences>): void {
    try {
        const current = readPreferencesSync()
        const next = { ...current, ...update }
        fs.mkdirSync(path.dirname(prefsPath()), { recursive: true })
        fs.writeFileSync(prefsPath(), JSON.stringify(next, null, 2), 'utf8')
    } catch (err) {
        console.warn('[preferences] write failed:', err)
    }
}