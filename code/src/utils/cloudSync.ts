                                   import { supabase } from './supabase';
import { SavedShortcut } from '../types/actions';

/**
 * Manual deep-compare to check if a local shortcut exactly matches the cloud version.
 * We avoid JSON.stringify because Supabase reorders JSONB keys, which causes false
 * positives (ghost sync loops).
 */
export function areShortcutsEqual(local: SavedShortcut, remote: SavedShortcut): boolean {
    // 1. Basic Info
    if (local.name !== remote.name) return false;
    if ((local.description || '') !== (remote.description || '')) return false;
    if (local.hotkey !== remote.hotkey) return false;

    // 2. Security Flags
    if ((local.secured ?? false) !== (remote.secured ?? false)) return false;
    if ((local.isSecuredCustom ?? false) !== (remote.isSecuredCustom ?? false)) return false;

    // 3. Actions
    if (local.actions.length !== remote.actions.length) return false;
    for (let i = 0; i < local.actions.length; i++) {
        const la = local.actions[i];
        const ra = remote.actions[i];
        if (
            la.id !== ra.id ||
            la.type !== ra.type ||
            la.title !== ra.title ||
            la.value !== ra.value ||
            (la.safetyOverride ?? null) !== (ra.safetyOverride ?? null)
        ) {
            return false;
        }
    }

    // 4. Window Layout
    const lwl = local.windowLayout;
    const rwl = remote.windowLayout;

    if ((lwl?.enabled ?? false) !== (rwl?.enabled ?? false)) return false;
    if ((lwl?.layoutId ?? null) !== (rwl?.layoutId ?? null)) return false;

    const lAssign = lwl?.assignments || {};
    const rAssign = rwl?.assignments || {};
    const lKeys = Object.keys(lAssign);
    const rKeys = Object.keys(rAssign);

    if (lKeys.length !== rKeys.length) return false;
    for (const key of lKeys) {
        if (lAssign[key] !== rAssign[key]) return false;
    }

    return true;
}

/**
 * Uploads a local shortcut to the cloud.
 * If the shortcut already exists (by ID), it updates it.
 */
/**
 * Before uploading, we attach a 'hint' to path-based actions.
 * We don't strip the path on upload, because the DB should hold the original
 * absolute path for the originating device to restore perfectly.
 */
function sanitizeShortcutForUpload(shortcut: SavedShortcut): SavedShortcut {
    const sanitizedActions = shortcut.actions.map(action => {
        if (['launch_app', 'open_file', 'open_folder'].includes(action.type)) {
            if (action.value && !action.hint) {
                // Extract filename (e.g. "C:\...\chrome.exe" -> "chrome.exe")
                const basename = action.value.split(/[/\\]/).pop() || action.value;
                return { ...action, hint: basename };
            }
        }
        return action;
    });
    return { ...shortcut, actions: sanitizedActions };
}

/**
 * When downloading/restoring, we check if the local path exists.
 * If it doesn't, we wipe the value and keep the hint. For apps, we try
 * to auto-resolve the hint to a newly installed app.
 */
export async function hydrateDownloadedShortcut(shortcut: SavedShortcut): Promise<SavedShortcut> {
    const hydratedActions = await Promise.all(shortcut.actions.map(async (action) => {
        if (!['launch_app', 'open_file', 'open_folder'].includes(action.type)) {
            return action;
        }

        // UWP apps use `shell:AppsFolder\...` which is not a real file path.
        // checkPathExists would return false and we'd wipe the UWP app!
        if (action.value?.startsWith('shell:')) {
            return action;
        }

        let needsResolution = false;
        let targetHint = action.hint;

        // Determine if we need to wipe the value and try to resolve it
        if (!action.value) {
            needsResolution = true;
        } else {
            const exists = await window.electronAPI?.checkPathExists(action.value);
            if (!exists) {
                needsResolution = true;
                if (!targetHint) {
                    targetHint = action.value.split(/[/\\]/).pop() || action.value;
                }
            }
        }

        if (needsResolution) {
            // For launch_app, try to find the app on this device
            if (action.type === 'launch_app' && targetHint) {
                try {
                    const installedApps = await window.electronAPI?.listInstalledApps();
                    const found = installedApps?.find(a =>
                        a.name.toLowerCase().includes(targetHint!.toLowerCase().replace('.exe', '')) ||
                        a.path.toLowerCase().endsWith(targetHint!.toLowerCase())
                    );
                    if (found) {
                        return { ...action, value: found.path, hint: targetHint };
                    }
                } catch (e) { /* ignore */ }
            }
            // If not launch_app or not found, clear value and keep hint
            return { ...action, value: '', hint: targetHint };
        }

        return action;
    }));

    return { ...shortcut, actions: hydratedActions };
}

export async function uploadShortcutToCloud(shortcut: SavedShortcut): Promise<SavedShortcut> {
    const sanitized = sanitizeShortcutForUpload(shortcut);
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) throw new Error("You must be logged in to sync.");

    const payload = {
        id: sanitized.id,
        user_id: session.user.id,
        name: sanitized.name,
        description: sanitized.description || '',
        hotkey: sanitized.hotkey || '',
        actions: sanitized.actions,
        window_layout: shortcut.windowLayout || null,
        secured: shortcut.secured ?? false,
        // Round-trip the manual-toggle flag. Without this, areShortcutsEqual
        // sees `true !== undefined` on every fetch and the shortcut stays
        // "pending" forever — the ghost sync loop after toggling Secured.
        is_secured_custom: shortcut.isSecuredCustom ?? false,
        updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('shortcuts').upsert(payload);

    if (error) {
        // If RLS violation, it means the ID belongs to another user (e.g. logging in
        // with Google on a device that previously used Email/Password).
        // We generate a new ID and try again so it becomes a new shortcut for this user.
        if (error.code === '42501' || error.message.includes('row-level security')) {
            console.warn(`[sync] ID collision for ${shortcut.id}. Generating new ID for this user.`);
            const newId = `sc-${crypto.randomUUID()}`;
            payload.id = newId;
            const retry = await supabase.from('shortcuts').upsert(payload);
            if (retry.error) throw new Error(`Failed to upload shortcut: ${retry.error.message}`);
            return { ...shortcut, id: newId }; // Return the updated shortcut
        }
        throw new Error(`Failed to upload shortcut: ${error.message}`);
    }
    return shortcut;
}

/**
 * Downloads all shortcuts belonging to the logged-in user.
 */
export async function downloadShortcutsFromCloud(): Promise<SavedShortcut[]> {
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) throw new Error("You must be logged in to sync.");

    const { data, error } = await supabase
        .from('shortcuts')
        .select('*')
        .eq('user_id', session.user.id);

    if (error) throw new Error(`Failed to download shortcuts: ${error.message}`);

    return (data || []).map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        hotkey: row.hotkey,
        actions: row.actions,
        windowLayout: row.window_layout,
        secured: row.secured,
        isSecuredCustom: row.is_secured_custom ?? false,
        createdAt: row.created_at,
    }));
}

/**
 * Generates a unique ID for this specific PC and stores it in localStorage.
 * We also try to grab the hostname (PC name) for display purposes.
 */
export function getOrCreateDeviceId(): { id: string; name: string } {
    const storageKey = 'lazycow-device-id';
    const nameKey = 'lazycow-device-name';
    let id = localStorage.getItem(storageKey);
    let name = localStorage.getItem(nameKey);

    if (!id) {
        id = `dev-${crypto.randomUUID()}`;
        localStorage.setItem(storageKey, id);
    }
    if (!name) {
        name = `Windows PC (${id.slice(4, 8)})`;
        localStorage.setItem(nameKey, name);
    }
    return { id, name };
}

export async function updateDevicePresence() {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    
    const device = getOrCreateDeviceId();
    await supabase.from('user_devices').upsert({
        id: device.id,
        user_id: session.user.id,
        device_name: device.name,
        last_active: new Date().toISOString(),
    });
}

export async function getConnectedDevices() {
    const { data, error } = await supabase
        .from('user_devices')
        .select('*')
        .order('last_active', { ascending: false });
    if (error) throw error;
    return data || [];
}

export async function removeDevice(id: string) {
    const { error } = await supabase.from('user_devices').delete().eq('id', id);
    if (error) throw error;
}

/**
 * Permanently deletes a shortcut from the cloud database.
 */
export async function deleteShortcutFromCloud(id: string): Promise<void> {
    const { error } = await supabase.from('shortcuts').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete from cloud: ${error.message}`);
}