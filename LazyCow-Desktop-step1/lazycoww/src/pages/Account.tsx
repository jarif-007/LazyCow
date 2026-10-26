import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../utils/supabase';
import { uploadShortcutToCloud, downloadShortcutsFromCloud, deleteShortcutFromCloud, areShortcutsEqual, hydrateDownloadedShortcut } from '../utils/cloudSync';
import { SavedShortcut, isUwpPath } from '../types/actions';
import {
    persistShortcuts,
    readPendingDeletions,
    removePendingDeletions,
    readAutoSyncEdits,
    writeAutoSyncEdits,
} from '../utils/shortcutStorage';
import { readSecuredDoublePressSeconds } from '../utils/security';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'motion/react';

// ==========================================
// REUSABLE INFO ICON COMPONENT
// ==========================================
const InfoIcon = ({ onClick }: { onClick: (e: React.MouseEvent) => void }) => (
    <button
        onClick={onClick}
        className="p-1 rounded-full hover:bg-muted text-muted-foreground transition-colors relative group/info shrink-0"
        aria-label="Card Information"
    >
        <span className="material-symbols-outlined text-[16px]">info</span>
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-max max-w-[200px] bg-foreground text-background text-[11px] font-body-sm font-medium px-2.5 py-1.5 rounded-lg opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-all z-50 pointer-events-none shadow-xl">
            Click to learn more
            <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-foreground" />
        </div>
    </button>
);

// ==========================================
// MAIN ACCOUNT COMPONENT
// ==========================================
interface AccountProps {
    /** Navigate to the Builder pre-loaded with the shortcut, focused on a specific action. */
    onEditShortcut: (shortcut: SavedShortcut, focusActionId?: string) => void;
}

export const Account: React.FC<AccountProps> = ({ onEditShortcut }) => {
    const [focusedCard, setFocusedCard] = useState<string | null>(null);
    const [infoCard, setInfoCard] = useState<string | null>(null);
    const [syncFilter, setSyncFilter] = useState<'all' | 'error' | 'ready' | 'deleted' | 'remote'>('all');

    // Auto-sync is OFF by default. Users opt in. When on, it only pushes
    // NEW shortcuts — never edits to already-synced shortcuts. Edits always
    // require a manual "Sync Now" so users can't lose local-only work via
    // an auto-push they didn't intend. Persisted to lazycow_settings so the
    // toggle survives reloads.
    const [isSyncEnabled, setIsSyncEnabled] = useState<boolean>(() => {
        try {
            const raw = localStorage.getItem('lazycow_settings');
            if (!raw) return false;
            const s = JSON.parse(raw);
            return s.autoSyncEnabled === true;
        } catch { return false; }
    });
    const [syncingIds, setSyncingIds] = useState<Set<string>>(new Set());

    // --- Real Data State ---
    const [user, setUser] = useState({ name: 'Loading...', email: '', initials: '..' });

    // The Diff Engine States — split for instant pending updates.
    // localShortcuts: read sync from localStorage on mount, refreshed on every
    //   'lazycow-shortcuts-changed' event. No network involved.
    // remoteShortcuts: null until first cloud fetch resolves. The pending diff
    //   is computed against this cache, so saving in Builder shows the new
    //   pending state instantly — no "Scanning..." delay.
    // syncErrors: populated by the background broken-path scan. Runs after
    //   local changes (debounced) and never blocks the pending view.
    const [localShortcuts, setLocalShortcuts] = useState<SavedShortcut[]>(() => {
        try { return JSON.parse(localStorage.getItem('lazycow-shortcuts') || '[]'); } catch { return []; }
    });
    const [remoteShortcuts, setRemoteShortcuts] = useState<SavedShortcut[] | null>(null);
    const [syncErrors, setSyncErrors] = useState<{ id: string; name: string; missing: string; actionId: string }[]>([]);
    const [pendingDeletions, setPendingDeletions] = useState<string[]>(() => readPendingDeletions());
    const [autoSyncEdits, setAutoSyncEdits] = useState<string[]>(() => readAutoSyncEdits());
    // remoteError = last cloud-fetch failure message. Cleared on any successful
    // fetch. The UI uses this to (a) show a "cloud unreachable" banner when a
    // stale cache is in use, or (b) show a full blocked state when the first
    // fetch has never succeeded.
    const [remoteError, setRemoteError] = useState<string | null>(null);

    // Throttle + debounce refs for the split refresh pipeline.
    // lastRemoteFetchRef: prevents focus from hammering Supabase (30s throttle).
    // scanTimerRef: debounces broken-path scan (300ms) so rapid saves trigger
    //   one scan, not N.
    const lastRemoteFetchRef = useRef<number>(0);
    const scanTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Loading is only true during the FIRST cloud fetch AND while there is
    // no error blocking it. After that, cached remote drives the pending
    // diff with zero perceived delay.
    const isLoading = remoteShortcuts === null && !remoteError;

    // History Log State
    const [history, setHistory] = useState<{ id: string; action: string; target: string; time: string; icon: string }[]>([]);

    // Cloud Vault State
    const [showVault, setShowVault] = useState(false);
    const [isVaultLoading, setIsVaultLoading] = useState(false);

    useEffect(() => {
        document.body.style.overflow = (focusedCard || infoCard || showVault) ? 'hidden' : 'unset';
        return () => { document.body.style.overflow = 'unset'; };
    }, [focusedCard, infoCard, showVault]);

    /**
     * Sync-local refresh. Re-reads localStorage into state. No network,
     * no async — the pending diff recomputes on the next render.
     */
    const refreshLocal = useCallback((): SavedShortcut[] => {
        let parsed: SavedShortcut[] = [];
        try { parsed = JSON.parse(localStorage.getItem('lazycow-shortcuts') || '[]'); } catch { /* ignore */ }
        setLocalShortcuts(parsed);
        return parsed;
    }, []);

    /**
     * Async cloud fetch. Populates remoteShortcuts and unblocks the pending
     * diff. On error, falls back to [] only if we don't already have cached
     * data — stale cached remote is better than a false "everything is new".
     */
    const refreshRemote = useCallback(async () => {
        try {
            const remote = await downloadShortcutsFromCloud();
            setRemoteShortcuts(remote);
            setRemoteError(null);
            lastRemoteFetchRef.current = Date.now();
        } catch (err) {
            console.error('Could not fetch remote shortcuts:', err);
            // Do NOT overwrite the existing cache. If it's null (first fetch
            // ever), leave it null so the UI shows the "cloud unreachable"
            // blocked state rather than falsely claiming every local
            // shortcut is "new to cloud". If cache exists, keep it and show
            // a stale-state banner so pending diff stays meaningful.
            setRemoteError(err instanceof Error ? err.message : 'Network error');
        }
    }, []);

    /**
     * Background broken-path scan. Slow (IPC per path action), so it runs
     * after the pending diff is already visible. Updates syncErrors, which
     * affects the error tile and blocks those shortcuts from syncing — it
     * never blocks the pending list from rendering.
     */
    const scanBrokenPaths = useCallback(async () => {
        let parsed: SavedShortcut[] = [];
        try { parsed = JSON.parse(localStorage.getItem('lazycow-shortcuts') || '[]'); } catch { return; }

        const errors: { id: string; name: string; missing: string; actionId: string }[] = [];
        for (const sc of parsed) {
            for (const action of sc.actions) {
                if (['launch_app', 'open_file', 'open_folder'].includes(action.type)) {
                    if (action.type === 'launch_app' && isUwpPath(action.value)) continue;
                    if (!action.value.trim()) {
                        errors.push({ id: sc.id, name: sc.name, missing: '(empty path)', actionId: action.id });
                        break;
                    }
                    const exists = await window.electronAPI?.checkPathExists(action.value);
                    if (!exists) {
                        const missingFile = action.value.split('\\').pop() || action.value;
                        errors.push({ id: sc.id, name: sc.name, missing: missingFile, actionId: action.id });
                        break;
                    }
                }
            }
        }
        setSyncErrors(errors);
    }, []);

    /**
     * User info fetch — once per mount. Auth state changes trigger a full
     * Account remount via App.tsx's auth gate, so we don't need to listen.
     */
    const fetchUser = useCallback(async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            const email = session.user.email || '';
            const derivedName = email.split('@')[0];
            const capitalizedName = derivedName.charAt(0).toUpperCase() + derivedName.slice(1);
            const initials = capitalizedName.substring(0, 2).toUpperCase();
            setUser({ name: capitalizedName, email: email, initials: initials });
        }
    }, []);

    // ── Mount: fetch user, cloud, and scan paths. Local is already loaded
    // via the useState initializer. Order matters: remote first so pending
    // can render as soon as the fetch lands, then scan runs in the background.
    useEffect(() => {
        void fetchUser();
        void refreshRemote();
        void scanBrokenPaths();
    }, [fetchUser, refreshRemote, scanBrokenPaths]);

    // ── Local shortcuts changed (save in Builder, delete in Library, etc.).
    // Refresh state instantly — no network, no "Scanning..." mask. Pending
    // diff recomputes on the next render. Path scan is debounced so rapid
    // saves don't spawn N parallel scans.
    useEffect(() => {
        const onShortcutsChanged = () => {
            refreshLocal();
            // Re-read pending deletions immediately so the Sync Center updates
            // the moment a user deletes a shortcut in the Library.
            setPendingDeletions(readPendingDeletions());
            if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
            scanTimerRef.current = setTimeout(() => { void scanBrokenPaths(); }, 300);
        };
        window.addEventListener('lazycow-shortcuts-changed', onShortcutsChanged);
        return () => {
            window.removeEventListener('lazycow-shortcuts-changed', onShortcutsChanged);
            if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        };
    }, [refreshLocal, scanBrokenPaths]);

    // ── Focus: refresh local always (cheap). Refresh remote only if >30s
    // since the last fetch — focus fires on every window click, and we don't
    // want to hammer Supabase. Debounce scan in case the user alt-tabbed to
    // Explorer to fix a path.
    useEffect(() => {
        const onFocus = () => {
            refreshLocal();
            if (Date.now() - lastRemoteFetchRef.current > 30000) {
                void refreshRemote();
            }
            if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
            scanTimerRef.current = setTimeout(() => { void scanBrokenPaths(); }, 300);
        };
        window.addEventListener('focus', onFocus);
        return () => {
            window.removeEventListener('focus', onFocus);
            if (scanTimerRef.current) clearTimeout(scanTimerRef.current);
        };
    }, [refreshLocal, refreshRemote, scanBrokenPaths]);

    // (areShortcutsEqual moved to utils/cloudSync.ts so Library can use it too)
    // Pending diff — instant, computed from cached remote. Returns [] while
    // the first cloud fetch is still in flight, so the UI doesn't falsely
    // show every local shortcut as "new to cloud" during the initial load.
    const pendingShortcuts = remoteShortcuts === null ? [] : localShortcuts.filter(local => {
        // Ignore drafts with no hotkey
        if (!local.hotkey || local.hotkey.trim() === '') return false;
        // Skip if broken path
        if (syncErrors.some(err => err.id === local.id)) return false;

        const remote = remoteShortcuts.find(r => r.id === local.id);
        if (!remote) return true; // Not in cloud
        return !areShortcutsEqual(local, remote); // Edited
    });

    // Pending deletions = shortcuts deleted locally that still exist in
    // cloud. Filtering against live remote means stale entries (already
    // deleted elsewhere, or never actually synced) are silently ignored.
    const pendingDeletionItems = remoteShortcuts === null ? [] : pendingDeletions.filter(id =>
        remoteShortcuts.some(r => r.id === id)
    );

    // Remote-only shortcuts = in cloud but not in local library, and NOT
    // marked as pending deletions. These are "pull" candidates (like git pull).
    // Without this, the Sync Center says "Everything is Synced" even when
    // the Cloud Vault shows shortcuts as "Not in Library".
    const remoteOnlyShortcuts = remoteShortcuts === null ? [] : remoteShortcuts.filter(r =>
        !localShortcuts.some(l => l.id === r.id) &&
        !pendingDeletions.includes(r.id)
    );

    const hasErrors = syncErrors.length > 0;
    const hasPending = pendingShortcuts.length > 0;
    const hasDeletions = pendingDeletionItems.length > 0;
    const hasRemoteOnly = remoteOnlyShortcuts.length > 0;
    const totalIssues = syncErrors.length + pendingShortcuts.length + pendingDeletionItems.length + remoteOnlyShortcuts.length;
    const isEverythingClear = !hasErrors && !hasPending && !hasDeletions && !hasRemoteOnly && !isLoading;

    const openModal = (e: React.MouseEvent, filter: 'all' | 'error' | 'ready' | 'deleted' | 'remote') => {
        e.stopPropagation();
        setSyncFilter(filter);
        setFocusedCard('sync');
    };

    const openInfo = (e: React.MouseEvent, card: string) => {
        e.stopPropagation();
        setInfoCard(card);
    };

    const handleAutoSyncToggle = () => {
        const next = !isSyncEnabled;
        setIsSyncEnabled(next);
        try {
            const settings = JSON.parse(localStorage.getItem('lazycow_settings') || '{}');
            settings.autoSyncEnabled = next;
            const serialized = JSON.stringify(settings);
            localStorage.setItem('lazycow_settings', serialized);
            // Mirror to disk so a hard kill doesn't lose the preference.
            window.electronAPI?.saveSettingSync('lazycow_settings', serialized);
        } catch { /* ignore */ }
        setHistory(prev => [{
            id: Date.now().toString(),
            action: next ? 'Auto-sync enabled' : 'Auto-sync disabled',
            target: next ? 'New shortcuts only' : 'Manual sync required',
            time: 'Just now',
            icon: 'sync',
        }, ...prev]);
    };

    const syncRef = useRef<() => Promise<void>>(async () => { });

    /**
     * MANUAL bulk sync — wired to the "Sync Now" button.
     * Pushes every pending shortcut (new AND edited). The user explicitly
     * asked for this by clicking the button, so overwriting the cloud copy
     * of an edited shortcut is intentional.
     */
    const executeGlobalSync = useCallback(async () => {
        if (syncingIds.has('__global__') || (pendingShortcuts.length === 0 && pendingDeletionItems.length === 0)) return;

        setSyncingIds(prev => {
            const next = new Set(prev);
            next.add('__global__');
            return next;
        });

        let failures = 0;
        let uploadedCount = 0;

        try {
            // 1) Push pending deletions first so a shortcut that was deleted
            //    locally and re-created with the same ID isn't overwritten
            //    by an upload in the same batch.
            if (pendingDeletionItems.length > 0) {
                const pushed: string[] = [];
                for (const id of pendingDeletionItems) {
                    try {
                        await deleteShortcutFromCloud(id);
                        pushed.push(id);
                    } catch (err) {
                        console.error(`[sync] failed to delete ${id} from cloud:`, err);
                        failures++;
                    }
                }
                if (pushed.length > 0) {
                    removePendingDeletions(pushed);
                    setPendingDeletions(readPendingDeletions());
                    setHistory(prev => [{
                        id: Date.now().toString(),
                        action: 'Deleted from cloud',
                        target: `${pushed.length} shortcut${pushed.length !== 1 ? 's' : ''}`,
                        time: 'Just now',
                        icon: 'delete',
                    }, ...prev]);
                }
            }

            // 2) Push uploads (new + edited).
            if (pendingShortcuts.length > 0) {
                const updatedLocal = [...localShortcuts];
                for (const sc of pendingShortcuts) {
                    try {
                        const uploaded = await uploadShortcutToCloud(sc);
                        if (uploaded.id !== sc.id) {
                            const idx = updatedLocal.findIndex(s => s.id === sc.id);
                            if (idx !== -1) updatedLocal[idx] = uploaded;
                        }
                        uploadedCount++;
                    } catch (err) {
                        console.error(`Failed to upload ${sc.name}:`, err);
                        failures++;
                    }
                }
                if (uploadedCount > 0) {
                    persistShortcuts(updatedLocal);
                    setLocalShortcuts(updatedLocal);
                    setHistory(prev => [{
                        id: Date.now().toString(),
                        action: 'Uploaded',
                        target: `All ${uploadedCount} Shortcuts`,
                        time: 'Just now',
                        icon: 'cloud_upload'
                    }, ...prev]);
                }
            }

            // Always refresh to see what actually made it to the cloud
            await refreshRemote();

            if (failures > 0) {
                alert(`Sync finished with ${failures} error(s). Check the DevTools console for details.`);
            }
        } catch (err) {
            console.error("Sync failed completely:", err);
            alert(`Sync failed: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setSyncingIds(prev => {
                const next = new Set(prev);
                next.delete('__global__');
                return next;
            });
        }
    }, [pendingShortcuts, pendingDeletionItems, syncingIds, refreshRemote, localShortcuts]);

    /**
     * AUTO sync — pushes ONLY shortcuts that have never been synced
     * (i.e. not present in remoteShortcuts at all).
     *
     * Edits to already-synced shortcuts are NEVER auto-pushed. The user
     * may be mid-edit, may have made an accidental change, or may want to
     * review the diff before it lands in the cloud. This is the GitHub
     * "commit before push" model — a save isn't a push, you push when ready.
     */
    const executeNewOnlySync = useCallback(async () => {
        if (syncingIds.has('__global__')) return;

        const remote = remoteShortcuts ?? [];
        // Candidates: (a) new to cloud, or (b) edited AND opted-in per-shortcut
        // via lazycow-auto-sync-edits. Edits to non-opted-in shortcuts stay
        // manual — the user explicitly asked to review those before pushing.
        const newShortcuts = pendingShortcuts.filter(local => {
            const isNew = !remote.some(r => r.id === local.id);
            if (isNew) return true;
            return autoSyncEdits.includes(local.id);
        });
        if (newShortcuts.length === 0) return;

        setSyncingIds(prev => {
            const next = new Set(prev);
            next.add('__global__');
            return next;
        });
        let successCount = 0;
        try {
            const updatedLocal = [...localShortcuts];
            for (const sc of newShortcuts) {
                try {
                    const uploaded = await uploadShortcutToCloud(sc);
                    if (uploaded.id !== sc.id) {
                        const idx = updatedLocal.findIndex(s => s.id === sc.id);
                        if (idx !== -1) updatedLocal[idx] = uploaded;
                    }
                    successCount++;
                } catch (err) {
                    console.error(`[auto-sync] Failed to upload ${sc.name}:`, err);
                }
            }
            if (successCount > 0) {
                persistShortcuts(updatedLocal);
                setLocalShortcuts(updatedLocal);
                setHistory(prev => [{
                    id: Date.now().toString(),
                    action: 'Auto-synced',
                    target: `${successCount} new shortcut${successCount !== 1 ? 's' : ''}`,
                    time: 'Just now',
                    icon: 'cloud_upload',
                }, ...prev]);
            }
            await refreshRemote();
        } catch (err) {
            console.error('[auto-sync] failed:', err);
        } finally {
            setSyncingIds(prev => {
                const next = new Set(prev);
                next.delete('__global__');
                return next;
            });
        }
    }, [pendingShortcuts, remoteShortcuts, syncingIds, refreshRemote, autoSyncEdits, localShortcuts]);

    // Keep the ref fresh so the timer never goes stale.
    useEffect(() => {
        syncRef.current = executeNewOnlySync;
    }, [executeNewOnlySync]);

    // Auto-sync timer — only fires when auto-sync is enabled, and only pushes
    // new shortcuts. The deps include pending/remote lengths so the timer
    // kicks immediately when a fresh shortcut appears.
    useEffect(() => {
        if (!isSyncEnabled || isLoading) return;

        void syncRef.current();
        const interval = setInterval(() => { void syncRef.current(); }, 120000);
        return () => clearInterval(interval);
    }, [isSyncEnabled, isLoading, pendingShortcuts.length, remoteShortcuts?.length ?? 0]);

    const handleSyncClick = async (e: React.MouseEvent, targetId: string) => {
        e.stopPropagation();
        if (syncingIds.has(targetId)) return;

        setSyncingIds(prev => new Set(prev).add(targetId));

        try {
            if (targetId === '__global__') {
                const updatedLocal = [...localShortcuts];
                for (const sc of pendingShortcuts) {
                    const uploaded = await uploadShortcutToCloud(sc);
                    if (uploaded.id !== sc.id) {
                        const idx = updatedLocal.findIndex(s => s.id === sc.id);
                        if (idx !== -1) updatedLocal[idx] = uploaded;
                    }
                }
                persistShortcuts(updatedLocal);
                setLocalShortcuts(updatedLocal);
                setHistory(prev => [{ id: Date.now().toString(), action: 'Uploaded', target: `All ${pendingShortcuts.length} Shortcuts`, time: 'Just now', icon: 'cloud_upload' }, ...prev]);
            } else {
                const targetShortcut = localShortcuts.find(s => s.id === targetId);
                if (targetShortcut) {
                    const uploaded = await uploadShortcutToCloud(targetShortcut);
                    if (uploaded.id !== targetShortcut.id) {
                        const updatedLocal = localShortcuts.map(s => s.id === targetShortcut.id ? uploaded : s);
                        persistShortcuts(updatedLocal);
                        setLocalShortcuts(updatedLocal);
                    }
                    setHistory(prev => [{ id: Date.now().toString(), action: 'Uploaded', target: targetShortcut.name, time: 'Just now', icon: 'upload' }, ...prev]);
                }
            }

            // Refresh cached remote so the Diff Engine sees the new state.
            await refreshRemote();

        } catch (err: unknown) {
            console.error("Sync failed:", err);
            alert(`Sync failed: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setSyncingIds(prev => {
                const next = new Set(prev);
                next.delete(targetId);
                return next;
            });
        }
    };

    const openCloudVault = async () => {
        setShowVault(true);
        setIsVaultLoading(true);
        // Route through refreshRemote so `remoteError` is tracked on failure
        // and the diff engine keeps a consistent view of cloud state.
        await refreshRemote();
        setIsVaultLoading(false);
    };

    const handleRestore = async (sc: SavedShortcut) => {
        // Warn before overwriting when the local copy differs from the cloud
        // version we're about to restore. Uses areShortcutsEqual (not
        // pendingShortcuts) so broken-path edits and every other divergence
        // are caught — pendingShortcuts excludes broken-path shortcuts.
        const localCopy = localShortcuts.find(l => l.id === sc.id);
        const willOverwrite = localCopy ? !areShortcutsEqual(localCopy, sc) : false;
        if (willOverwrite) {
            const ok = confirm(
                `Restoring "${sc.name}" from the cloud will overwrite your local changes. Continue?`
            );
            if (!ok) return;
        }

        // Hydrate the shortcut first! This checks local paths and fills in hints.
        const hydrated = await hydrateDownloadedShortcut(sc);
        
        const updatedLocal = [...localShortcuts.filter(l => l.id !== sc.id), hydrated];
        setLocalShortcuts(updatedLocal);

        // Route through persistShortcuts: writes localStorage AND the disk
        // mirror (survives hard kills) AND dispatches lazycow-shortcuts-changed
        // so Library refreshes immediately. Direct localStorage.setItem
        // skipped all three side-effects and left the restored shortcut
        // half-broken until the next full app restart.
        persistShortcuts(updatedLocal);

        // Re-register global hotkeys with the OS. Without this, restoring a
        // shortcut that had a hotkey left the hotkey silently unregistered —
        // clicking the card worked, but the hotkey did nothing.
        window.electronAPI?.syncHotkeys({
            shortcuts: updatedLocal.map((s) => ({
                id: s.id,
                name: s.name,
                hotkey: s.hotkey,
                actions: s.actions,
                secured: s.secured,
                windowLayout: s.windowLayout,
            })),
            securedDoublePressSeconds: readSecuredDoublePressSeconds(),
        });

        // If this shortcut was previously marked as "deleted locally", the
        // restore cancels that deletion — otherwise the pending-deletions
        // tile would still show it, and the next "Push deletions" would
        // wipe the shortcut we just brought back.
        removePendingDeletions([sc.id]);
        setPendingDeletions(readPendingDeletions());

        setHistory(prev => [{
            id: Date.now().toString(),
            action: 'Reverted to Cloud',
            target: sc.name,
            time: 'Just now',
            icon: 'history',
        }, ...prev]);
    };

    // ── Deletion handlers ──
    const handlePushDeletion = async (id: string) => {
        try {
            await deleteShortcutFromCloud(id);
            removePendingDeletions([id]);
            setPendingDeletions(readPendingDeletions());
            setHistory(prev => [{
                id: Date.now().toString(),
                action: 'Deleted from cloud',
                target: remoteShortcuts?.find(r => r.id === id)?.name || id,
                time: 'Just now',
                icon: 'delete',
            }, ...prev]);
            await refreshRemote();
        } catch (err) {
            alert(`Failed to delete from cloud: ${err instanceof Error ? err.message : String(err)}`);
        }
    };

    const handlePushAllDeletions = async () => {
        const ids = pendingDeletionItems;
        if (ids.length === 0) return;
        const pushed: string[] = [];
        for (const id of ids) {
            try {
                await deleteShortcutFromCloud(id);
                pushed.push(id);
            } catch (err) {
                console.error(`[delete] ${id} failed:`, err);
            }
        }
        if (pushed.length > 0) {
            removePendingDeletions(pushed);
            setPendingDeletions(readPendingDeletions());
            setHistory(prev => [{
                id: Date.now().toString(),
                action: 'Deleted from cloud',
                target: `${pushed.length} shortcut${pushed.length !== 1 ? 's' : ''}`,
                time: 'Just now',
                icon: 'delete',
            }, ...prev]);
        }
        await refreshRemote();
    };

    const handleRestoreDeletion = async (id: string) => {
        const remote = remoteShortcuts?.find(r => r.id === id);
        if (!remote) return;

        // Warn if restoring would create a hotkey conflict.
        const conflict = localShortcuts.find(s =>
            s.id !== id && s.hotkey === remote.hotkey && remote.hotkey !== ''
        );
        if (conflict) {
            const ok = confirm(
                `Restoring "${remote.name}" will create a hotkey conflict with "${conflict.name}" (both use "${remote.hotkey}"). Continue?`
            );
            if (!ok) return;
        }

        // Hydrate the shortcut first! This checks local paths and fills in hints.
        const hydrated = await hydrateDownloadedShortcut(remote);
        
        const updated = [...localShortcuts, hydrated];
        setLocalShortcuts(updated);
        persistShortcuts(updated);
        removePendingDeletions([id]);
        setPendingDeletions(readPendingDeletions());
        window.electronAPI?.syncHotkeys({
            shortcuts: updated.map((s) => ({
                id: s.id,
                name: s.name,
                hotkey: s.hotkey,
                actions: s.actions,
                secured: s.secured,
                windowLayout: s.windowLayout,
            })),
            securedDoublePressSeconds: readSecuredDoublePressSeconds(),
        });
        setHistory(prev => [{
            id: Date.now().toString(),
            action: 'Restored from cloud',
            target: remote.name,
            time: 'Just now',
            icon: 'history',
        }, ...prev]);
    };

    // ── Auto-sync-edits per-shortcut opt-in ──
    const handleToggleAutoSyncEdit = (id: string) => {
        const next = autoSyncEdits.includes(id)
            ? autoSyncEdits.filter(x => x !== id)
            : [...autoSyncEdits, id];
        setAutoSyncEdits(next);
        writeAutoSyncEdits(next);
    };

    const handleDeleteCloud = async (id: string, name: string) => {
        if (!confirm(`Are you sure you want to permanently delete "${name}" from the cloud?`)) return;
        try {
            await deleteShortcutFromCloud(id);
            setRemoteShortcuts(prev => (prev ?? []).filter(c => c.id !== id));
            setHistory(prev => [{ id: Date.now().toString(), action: 'Deleted', target: name, time: 'Just now', icon: 'delete' }, ...prev]);
        } catch (err) {
            alert("Failed to delete from cloud.");
        }
    };

    // --- Info Content Dictionary ---
    const cardInfo = {
        sync: {
            title: 'Sync Center',
            desc: 'This card shows the status of your local shortcuts compared to your cloud account.',
            sections: [
                { title: 'Action Required (Errors)', text: 'These shortcuts have broken file paths or missing apps. Fix the paths to sync them.' },
                { title: 'Ready to Sync', text: 'These shortcuts are valid and waiting to be backed up to the cloud.' },
                { title: 'Everything is Synced', text: 'Your local shortcuts perfectly match your cloud profile.' }
            ]
        },
        activity: {
            title: 'Activity & Community',
            desc: 'Track your recent interactions with the LazyCow Cloud and Community.',
            sections: [
                { title: 'Recent History', text: 'A timeline of when you synced, downloaded, or uploaded shortcuts.' },
                { title: 'Community Stats', text: 'Shows how many times your published shortcuts have been downloaded by others, and your average star rating.' }
            ]
        },
        profile: { title: 'Your Profile', desc: 'Manage your identity.', sections: [] },
        devices: { title: 'Connected Devices', desc: 'Manage logged-in devices.', sections: [] },
        actions: { title: 'Quick Actions', desc: 'Common tasks.', sections: [] }
    };

    return (
        <main className={`flex-1 p-6 w-full max-w-[1400px] mx-auto flex flex-col h-full min-h-0 ${(focusedCard || infoCard || showVault) ? 'overflow-hidden' : 'overflow-y-auto'}`}>

            <header className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 shrink-0 gap-4">
                <div className="min-w-0">
                    <h1 className="text-2xl font-bold text-foreground tracking-tight truncate">Account Dashboard</h1>
                    <p className="text-sm text-muted-foreground mt-1 truncate">Welcome back, {user.name}.</p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <div onClick={handleAutoSyncToggle} className="flex items-center gap-3 bg-card border border-border rounded-lg px-3 py-1.5 shadow-sm cursor-pointer hover:bg-muted/50 transition-colors shrink-0">
                        <span className={`material-symbols-outlined text-[18px] text-muted-foreground shrink-0 ${isSyncEnabled ? 'animate-spin-slow' : ''}`} style={{ animationDuration: '3s' }}>sync</span>
                        <span className="text-xs font-semibold text-foreground whitespace-nowrap">Auto Sync</span>
                        <div className={`w-8 h-4 rounded-full relative ml-1 shrink-0 transition-colors ${isSyncEnabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                            <motion.span layout className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow-sm ${isSyncEnabled ? 'right-0.5' : 'left-0.5'}`} />
                        </div>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); executeGlobalSync(); }} disabled={syncingIds.has('__global__') || (!hasPending && !hasDeletions)} className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity shadow-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap shrink-0">
                        <span className={`material-symbols-outlined text-[18px] shrink-0 ${syncingIds.has('__global__') ? 'animate-spin' : ''}`}>
                            {syncingIds.has('__global__') ? 'progress_activity' : 'cloud_upload'}
                        </span>
                        <span className="whitespace-nowrap">{syncingIds.has('__global__') ? 'Syncing...' : 'Sync Now'}</span>
                    </button>
                </div>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-5 flex-1 min-h-0 pb-2">
                {/* HERO CARD: SYNC CENTER */}
                <div onClick={(e) => openModal(e, 'all')} className={`md:col-span-6 flex flex-col bg-card border rounded-2xl p-6 shadow-sm cursor-pointer hover:shadow-md transition-all relative overflow-hidden h-full min-h-[300px] ${hasErrors ? 'border-red-500/30' : 'border-border'}`}>
                    <div className="flex items-center justify-between mb-4 shrink-0">
                        <h2 className="text-lg font-bold text-foreground flex items-center gap-2 min-w-0">
                            <span className="material-symbols-outlined text-primary shrink-0">cloud_sync</span>
                            <span className="truncate">Sync Center</span>
                        </h2>
                        <div className="flex items-center gap-2 shrink-0">
                            {hasErrors && <span className="inline-flex items-center justify-center h-6 px-2.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20 text-[11px] font-semibold whitespace-nowrap">{syncErrors.length} Error{syncErrors.length !== 1 ? 's' : ''}</span>}
                            {hasDeletions && <span className="inline-flex items-center justify-center h-6 px-2.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 text-[11px] font-semibold whitespace-nowrap">{pendingDeletionItems.length} Deleted</span>}
                            {hasRemoteOnly && <span className="inline-flex items-center justify-center h-6 px-2.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 text-[11px] font-semibold whitespace-nowrap">{remoteOnlyShortcuts.length} Cloud</span>}
                            {hasPending && <span className="inline-flex items-center justify-center h-6 px-2.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[11px] font-semibold whitespace-nowrap">{pendingShortcuts.length} Ready</span>}
                            <button onClick={(e) => { e.stopPropagation(); void refreshRemote(); }} className="p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-colors" title="Refresh from cloud"><span className="material-symbols-outlined text-[18px]">refresh</span></button>
                            <InfoIcon onClick={(e) => openInfo(e, 'sync')} />
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar pr-2">
                        {remoteShortcuts === null && remoteError ? (
                            <div className="flex-1 flex flex-col items-center justify-center text-center">
                                <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mb-4"><span className="material-symbols-outlined text-[32px]">cloud_off</span></div>
                                <h3 className="text-lg font-bold text-foreground">Cloud Unreachable</h3>
                                <p className="text-sm text-muted-foreground mt-1 max-w-[250px]">Could not reach the cloud. Your local shortcuts are safe.</p>
                                <button onClick={(e) => { e.stopPropagation(); void refreshRemote(); }} className="mt-4 px-4 py-1.5 bg-amber-500 text-white rounded-lg text-sm font-semibold hover:bg-amber-600 transition-colors">Retry</button>
                            </div>
                        ) : (
                            <>
                                {remoteError && remoteShortcuts !== null && (
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-2.5 flex items-center gap-2 shrink-0">
                                        <span className="material-symbols-outlined text-amber-500 text-[18px] shrink-0">cloud_off</span>
                                        <p className="flex-1 text-[11px] text-amber-500 truncate">Cloud unreachable — showing last known state</p>
                                        <button onClick={(e) => { e.stopPropagation(); void refreshRemote(); }} className="text-[11px] font-semibold text-amber-500 hover:underline shrink-0">Retry</button>
                                    </div>
                                )}
                                {isLoading ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center"><span className="material-symbols-outlined text-[32px] text-primary animate-spin mb-4">progress_activity</span><p className="text-sm text-muted-foreground">Scanning local shortcuts...</p></div>
                                ) : isEverythingClear ? (
                                    <div className="flex-1 flex flex-col items-center justify-center text-center">
                                        <div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-4"><span className="material-symbols-outlined text-[32px]">check_circle</span></div>
                                        <h3 className="text-lg font-bold text-foreground">Everything is Synced</h3>
                                        <p className="text-sm text-muted-foreground mt-1 max-w-[250px]">Your local shortcuts perfectly match your cloud profile.</p>
                                    </div>
                                ) : (
                                    <>
                                        {hasErrors ? (
                                            <div onClick={(e) => openModal(e, 'error')} className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 hover:bg-red-500/15 transition-colors group cursor-pointer shrink-0">
                                                <div className="flex items-start gap-3"><span className="material-symbols-outlined text-red-500 text-[24px] shrink-0">warning</span><div className="min-w-0"><h3 className="text-sm font-bold text-red-500 truncate">{syncErrors.length} Shortcut{syncErrors.length !== 1 ? 's' : ''} Need Attention</h3><p className="text-xs text-red-500/80 mt-1 flex items-center gap-1 group-hover:underline truncate">Click to view and resolve <span className="material-symbols-outlined text-[14px] shrink-0">arrow_forward</span></p></div></div>
                                            </div>
                                        ) : (
                                            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 shrink-0">
                                                <div className="flex items-start gap-3"><span className="material-symbols-outlined text-emerald-500 text-[24px] shrink-0">check_circle</span><div className="min-w-0"><h3 className="text-sm font-bold text-emerald-500 truncate">All Systems Clear</h3><p className="text-xs text-emerald-500/80 mt-1 truncate">No errors found in your local shortcuts.</p></div></div>
                                            </div>
                                        )}
                                        {hasDeletions && (
                                            <div onClick={(e) => openModal(e, 'deleted')} className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-4 hover:bg-amber-500/15 transition-colors group cursor-pointer shrink-0">
                                                <div className="flex items-start gap-3">
                                                    <span className="material-symbols-outlined text-amber-500 text-[24px] shrink-0">delete_forever</span>
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="text-sm font-bold text-amber-500 truncate">{pendingDeletionItems.length} shortcut{pendingDeletionItems.length !== 1 ? 's' : ''} deleted locally</h3>
                                                        <p className="text-xs text-amber-500/80 mt-1 flex items-center gap-1 group-hover:underline truncate">Click to review <span className="material-symbols-outlined text-[14px] shrink-0">arrow_forward</span></p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {hasRemoteOnly && (
                                            <div onClick={(e) => openModal(e, 'remote')} className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 hover:bg-emerald-500/15 transition-colors group cursor-pointer shrink-0">
                                                <div className="flex items-start gap-3">
                                                    <span className="material-symbols-outlined text-emerald-500 text-[24px] shrink-0">cloud_download</span>
                                                    <div className="min-w-0 flex-1">
                                                        <h3 className="text-sm font-bold text-emerald-500 truncate">{remoteOnlyShortcuts.length} shortcut{remoteOnlyShortcuts.length !== 1 ? 's' : ''} available in cloud</h3>
                                                        <p className="text-xs text-emerald-500/80 mt-1 flex items-center gap-1 group-hover:underline truncate">Click to review <span className="material-symbols-outlined text-[14px] shrink-0">arrow_forward</span></p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                        {hasPending && (
                                            <div onClick={(e) => openModal(e, 'ready')} className="group cursor-pointer flex flex-col shrink-0">
                                                <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1 group-hover:text-primary transition-colors shrink-0">Ready to Sync <span className="material-symbols-outlined text-[14px] shrink-0">arrow_forward</span></h4>
                                                <div className="space-y-2 max-h-[140px] overflow-y-auto custom-scrollbar pr-1 pb-1">
                                                    {pendingShortcuts.map(sc => (
                                                        <div key={sc.id} className="flex items-center justify-between bg-background border border-border p-2.5 rounded-lg group-hover:border-primary/30 transition-colors">
                                                            <div className="flex items-center gap-2 min-w-0"><span className="material-symbols-outlined text-primary text-[18px] shrink-0">code</span><span className="text-sm font-semibold text-foreground truncate">{sc.name}</span></div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>

                {/* ACTIVITY CARD */}
                <div onClick={() => setFocusedCard('activity')} className="md:col-span-6 flex flex-col bg-card border border-border rounded-2xl p-6 shadow-sm cursor-pointer hover:shadow-md transition-all h-full min-h-[300px]">
                    <div className="flex items-start justify-between mb-4 gap-2 shrink-0">
                        <h2 className="text-lg font-bold text-foreground flex items-start gap-2 leading-tight min-w-0 flex-1">
                            <span className="material-symbols-outlined text-primary mt-0.5 shrink-0">history</span>
                            <span className="truncate">Activity & Community</span>
                        </h2>
                        <div className="flex items-center gap-2 shrink-0 mt-0.5">
                            <span className="inline-flex items-center justify-center h-6 px-2.5 rounded-full bg-muted text-muted-foreground text-[11px] font-semibold whitespace-nowrap">{history.length} Events</span>
                            <InfoIcon onClick={(e) => openInfo(e, 'activity')} />
                        </div>
                    </div>

                    <div className="flex-1 flex flex-col gap-4 overflow-hidden">
                        <div className="flex items-center justify-between bg-background border border-border p-3 rounded-xl shrink-0">
                            <div className="flex items-center gap-3 min-w-0">
                                <span className="material-symbols-outlined text-purple-500 shrink-0">groups</span>
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-foreground truncate">Community Downloads</p>
                                    <p className="text-[11px] text-muted-foreground truncate">0 total downloads</p>
                                </div>
                            </div>
                            <div className="text-amber-500 font-bold text-sm flex items-center gap-1 shrink-0"><span className="material-symbols-outlined fill-1 text-[16px]">star</span> 0.0</div>
                        </div>

                        <div className="flex-1 flex flex-col min-h-0">
                            <h4 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 shrink-0">Recent History</h4>
                            {history.length === 0 ? (
                                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50"><span className="material-symbols-outlined text-[32px] mb-2">history_toggle_off</span><p className="text-sm text-muted-foreground">No recent activity.</p></div>
                            ) : (
                                <div className="relative border-l-2 border-border ml-2.5 space-y-4 pb-2 overflow-y-auto custom-scrollbar pr-2 flex-1">
                                    {history.map((item) => (
                                        <div key={item.id} className="relative pl-6">
                                            <div className="absolute -left-[13px] top-0 w-6 h-6 rounded-full bg-card border-2 border-primary flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-[12px] text-primary">{item.icon}</span></div>
                                            <div className="flex flex-col gap-0.5 min-w-0">
                                                <p className="text-[13px] font-semibold text-foreground leading-tight truncate">{item.target}</p>
                                                <div className="flex items-center justify-between gap-2 mt-0.5"><p className="text-[11px] text-muted-foreground truncate">{item.action}</p><span className="text-[10px] text-muted-foreground whitespace-nowrap">{item.time}</span></div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* PROFILE CARD */}
                <div className="md:col-span-4 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col min-w-0">
                    <div className="flex items-center justify-between mb-4 shrink-0">
                        <div className="flex items-center gap-4 min-w-0">
                            <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold shrink-0">{user.initials}</div>
                            <div className="min-w-0"><h3 className="text-base font-bold text-foreground truncate">{user.name}</h3><p className="text-xs text-muted-foreground truncate">{user.email}</p></div>
                        </div>
                        <InfoIcon onClick={(e) => openInfo(e, 'profile')} />
                    </div>
                    <div className="flex-1 flex flex-col justify-center space-y-2">
                        <button className="w-full text-left px-3 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors flex items-center justify-between"><span className="truncate">Account Settings</span><span className="material-symbols-outlined text-muted-foreground text-[16px] shrink-0">chevron_right</span></button>
                        <button className="w-full text-left px-3 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors flex items-center justify-between"><span className="truncate">Manage Subscription</span><span className="material-symbols-outlined text-muted-foreground text-[16px] shrink-0">chevron_right</span></button>
                    </div>
                </div>

                {/* DEVICES CARD */}
                <div className="md:col-span-4 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col min-w-0">
                    <div className="flex items-start justify-between mb-4 gap-2 shrink-0"><h3 className="text-base font-bold text-foreground leading-tight min-w-0 flex-1 truncate">Connected Devices</h3><div className="shrink-0 mt-0.5"><InfoIcon onClick={(e) => openInfo(e, 'devices')} /></div></div>
                    <div className="flex-1 flex flex-col gap-3 overflow-y-auto custom-scrollbar">
                        <div className="flex items-center justify-between bg-background border border-border p-3 rounded-lg gap-3">
                            <div className="flex items-center gap-2 min-w-0"><span className="material-symbols-outlined text-muted-foreground shrink-0">desktop_windows</span><span className="text-[13px] font-semibold text-foreground leading-tight truncate">This PC (Current Session)</span></div>
                            <span className={`text-[10px] font-bold px-2 py-1 rounded-md shrink-0 bg-emerald-500/10 text-emerald-500`}>Active</span>
                        </div>
                    </div>
                </div>

                {/* QUICK ACTIONS CARD */}
                <div className="md:col-span-4 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col min-w-0">
                    <div className="flex items-start justify-between mb-4 gap-2 shrink-0"><h3 className="text-base font-bold text-foreground leading-tight min-w-0 flex-1 truncate">Quick Actions</h3><div className="shrink-0 mt-0.5"><InfoIcon onClick={(e) => openInfo(e, 'actions')} /></div></div>
                    <div className="flex-1 grid grid-cols-2 gap-3">
                        <button onClick={openCloudVault} className="flex flex-col items-center justify-center p-3 border border-border rounded-xl hover:bg-muted transition-colors"><span className="material-symbols-outlined text-primary mb-2">cloud_download</span><span className="text-xs font-semibold truncate w-full text-center">Cloud Vault</span></button>
                        <button className="flex flex-col items-center justify-center p-3 border border-border rounded-xl hover:bg-muted transition-colors"><span className="material-symbols-outlined text-primary mb-2">upload</span><span className="text-xs font-semibold truncate w-full text-center">Export</span></button>
                        <button className="flex flex-col items-center justify-center p-3 border border-border rounded-xl hover:bg-muted transition-colors"><span className="material-symbols-outlined text-primary mb-2">group_add</span><span className="text-xs font-semibold truncate w-full text-center">Invite</span></button>
                        <button onClick={async () => { await supabase.auth.signOut(); }} className="flex flex-col items-center justify-center p-3 border border-border rounded-xl hover:bg-muted transition-colors text-red-500"><span className="material-symbols-outlined mb-2">logout</span><span className="text-xs font-semibold truncate w-full text-center">Sign Out</span></button>
                    </div>
                </div>
            </div>

            {/* --- SYNC & ACTIVITY MODAL --- */}
            {createPortal(
                <AnimatePresence>
                    {focusedCard && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-8">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/90" onClick={() => setFocusedCard(null)} />
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ type: 'spring', bounce: 0, duration: 0.3 }} className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-[800px] max-h-[85vh] flex flex-col overflow-hidden">
                                <div className="flex items-center justify-between p-6 border-b border-border shrink-0 bg-card z-10">
                                    <h2 className="text-xl font-bold text-foreground">{focusedCard === 'sync' ? 'Sync Details' : 'Activity Log'}</h2>
                                    <button onClick={() => setFocusedCard(null)} className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"><span className="material-symbols-outlined">close</span></button>
                                </div>

                                {focusedCard === 'sync' && (
                                    <div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-muted/10 shrink-0 overflow-x-auto">
                                        <button onClick={() => setSyncFilter('all')} className={`inline-flex items-center justify-center h-8 px-3.5 rounded-lg text-xs font-semibold border transition-colors whitespace-nowrap ${syncFilter === 'all' ? 'bg-primary/10 text-primary border-primary/30' : 'bg-transparent text-muted-foreground border-transparent hover:bg-muted'}`}>All ({totalIssues})</button>
                                        <button onClick={() => setSyncFilter('error')} className={`inline-flex items-center justify-center h-8 px-3.5 rounded-lg text-xs font-semibold border transition-colors gap-1.5 whitespace-nowrap ${syncFilter === 'error' ? 'bg-red-500/10 text-red-500 border-red-500/30' : 'bg-transparent text-muted-foreground border-transparent hover:bg-muted'}`}>Errors ({syncErrors.length})</button>
                                        <button onClick={() => setSyncFilter('ready')} className={`inline-flex items-center justify-center h-8 px-3.5 rounded-lg text-xs font-semibold border transition-colors gap-1.5 whitespace-nowrap ${syncFilter === 'ready' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-transparent text-muted-foreground border-transparent hover:bg-muted'}`}>Ready ({pendingShortcuts.length})</button>
                                        <button onClick={() => setSyncFilter('deleted')} className={`inline-flex items-center justify-center h-8 px-3.5 rounded-lg text-xs font-semibold border transition-colors gap-1.5 whitespace-nowrap ${syncFilter === 'deleted' ? 'bg-amber-500/10 text-amber-500 border-amber-500/30' : 'bg-transparent text-muted-foreground border-transparent hover:bg-muted'}`}>Deleted ({pendingDeletionItems.length})</button>
                                        <button onClick={() => setSyncFilter('remote')} className={`inline-flex items-center justify-center h-8 px-3.5 rounded-lg text-xs font-semibold border transition-colors gap-1.5 whitespace-nowrap ${syncFilter === 'remote' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30' : 'bg-transparent text-muted-foreground border-transparent hover:bg-muted'}`}>Cloud ({remoteOnlyShortcuts.length})</button>
                                    </div>
                                )}

                                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar bg-background/50">
                                    {focusedCard === 'sync' ? (
                                        <div className="space-y-6">
                                            {isEverythingClear && <div className="flex flex-col items-center justify-center py-12 text-center"><div className="w-16 h-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-4"><span className="material-symbols-outlined text-[32px]">check_circle</span></div><h3 className="text-lg font-bold text-foreground">Everything is synced!</h3><p className="text-sm text-muted-foreground mt-1">Your local workspace perfectly matches the cloud.</p></div>}

                                            {(syncFilter === 'all' || syncFilter === 'error') && hasErrors && (
                                                <div className="space-y-3">
                                                    {syncErrors.map((err) => (
                                                        <div key={err.id} className="bg-red-500/10 border border-red-500/30 rounded-xl p-5 shadow-sm"><h3 className="text-base font-bold text-red-500 flex items-center gap-2"><span className="material-symbols-outlined text-[20px]">warning</span>Action Required</h3><p className="text-sm text-red-500/80 mt-2">The shortcut "{err.name}" cannot be synced because the required executable <code className="bg-red-500/20 px-1 py-0.5 rounded text-[11px] font-bold">{err.missing}</code> was not found on this device.</p><button
                                                            onClick={() => {
                                                                const sc = localShortcuts.find(s => s.id === err.id);
                                                                if (!sc) return;
                                                                setFocusedCard(null);
                                                                onEditShortcut(sc, err.actionId);
                                                            }}
                                                            className="mt-3 px-4 py-1.5 bg-red-500 text-white text-xs font-semibold rounded-lg hover:bg-red-600 transition-colors"
                                                        >
                                                            Locate File
                                                        </button></div>
                                                    ))}
                                                </div>
                                            )}

                                            {(syncFilter === 'all' || syncFilter === 'ready') && hasPending && (
                                                <div>
                                                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Ready to Sync ({pendingShortcuts.length})</h3>
                                                    <div className="space-y-2">
                                                        {pendingShortcuts.map(sc => (
                                                            <div key={sc.id} className="flex items-center justify-between bg-card border border-border p-3 rounded-xl shadow-sm gap-2">
                                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                                    <div className="w-8 h-8 rounded-lg bg-muted border border-border flex items-center justify-center text-primary shrink-0">
                                                                        <span className="material-symbols-outlined text-[16px]">code</span>
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-sm font-semibold text-foreground truncate">{sc.name}</p>
                                                                        <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer select-none mt-0.5">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={autoSyncEdits.includes(sc.id)}
                                                                                onChange={(e) => { e.stopPropagation(); handleToggleAutoSyncEdit(sc.id); }}
                                                                                className="w-3 h-3 rounded accent-primary cursor-pointer"
                                                                            />
                                                                            Auto-sync edits to this shortcut
                                                                        </label>
                                                                    </div>
                                                                </div>
                                                                <button onClick={(e) => handleSyncClick(e, sc.id)} disabled={syncingIds.has(sc.id)} className="px-3 py-1.5 bg-primary text-primary-foreground text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity flex items-center gap-1 shrink-0">{syncingIds.has(sc.id) ? <span className="material-symbols-outlined text-[14px] animate-spin">progress_activity</span> : null}Sync Now</button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {(syncFilter === 'all' || syncFilter === 'remote') && hasRemoteOnly && (
                                                <div>
                                                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Available in Cloud ({remoteOnlyShortcuts.length})</h3>
                                                    <div className="space-y-2">
                                                        {remoteOnlyShortcuts.map(sc => (
                                                            <div key={sc.id} className="flex items-center justify-between bg-card border border-border p-3 rounded-xl shadow-sm gap-2">
                                                                <div className="flex items-center gap-3 min-w-0 flex-1">
                                                                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shrink-0">
                                                                        <span className="material-symbols-outlined text-[16px]">cloud</span>
                                                                    </div>
                                                                    <div className="min-w-0 flex-1">
                                                                        <p className="text-sm font-semibold text-foreground truncate">{sc.name}</p>
                                                                        <p className="text-[10px] text-muted-foreground truncate">Not in your local library</p>
                                                                    </div>
                                                                </div>
                                                                <button onClick={() => { void handleRestoreDeletion(sc.id); }} className="px-3 py-1.5 bg-emerald-500 text-white text-xs font-semibold rounded-lg hover:bg-emerald-600 transition-colors shrink-0">Restore</button>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {(syncFilter === 'all' || syncFilter === 'deleted') && hasDeletions && (
                                                <div>
                                                    <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" />Deleted locally ({pendingDeletionItems.length})</h3>
                                                    <div className="space-y-2">
                                                        {pendingDeletionItems.map(id => {
                                                            const remote = remoteShortcuts?.find(r => r.id === id);
                                                            if (!remote) return null;
                                                            return (
                                                                <div key={id} className="flex items-center justify-between bg-card border border-border p-3 rounded-xl shadow-sm gap-2">
                                                                    <div className="flex items-center gap-3 min-w-0 flex-1">
                                                                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
                                                                            <span className="material-symbols-outlined text-[16px]">delete</span>
                                                                        </div>
                                                                        <div className="min-w-0 flex-1">
                                                                            <p className="text-sm font-semibold text-foreground truncate">{remote.name}</p>
                                                                            <p className="text-[10px] text-muted-foreground truncate">Deleted locally · still in cloud</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className="flex items-center gap-2 shrink-0">
                                                                        <button onClick={() => { void handleRestoreDeletion(id); }} className="px-3 py-1.5 bg-muted text-foreground text-xs font-semibold rounded-lg hover:bg-muted/70 transition-colors">Restore</button>
                                                                        <button onClick={() => { void handlePushDeletion(id); }} className="px-3 py-1.5 bg-amber-500 text-white text-xs font-semibold rounded-lg hover:bg-amber-600 transition-colors">Delete from cloud</button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                    <button onClick={() => { void handlePushAllDeletions(); }} className="mt-3 w-full px-3 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-semibold rounded-lg hover:bg-amber-500/20 transition-colors">Push all deletions</button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="space-y-6">
                                            {history.length === 0 ? (
                                                <div className="flex flex-col items-center justify-center py-12 text-center opacity-50"><span className="material-symbols-outlined text-[48px] mb-4">history_toggle_off</span><h3 className="text-lg font-bold text-foreground">No activity yet</h3><p className="text-sm text-muted-foreground mt-1">Sync a shortcut to see your history here.</p></div>
                                            ) : (
                                                <div className="relative border-l-2 border-border ml-4 space-y-6 pb-4">
                                                    {history.map((item, i) => (
                                                        <div key={i} className="relative pl-8">
                                                            <div className="absolute -left-[17px] top-0 w-8 h-8 rounded-full bg-card border-2 border-primary flex items-center justify-center shrink-0"><span className="material-symbols-outlined text-[16px] text-primary">{item.icon}</span></div>
                                                            <div className="bg-card border border-border p-4 rounded-xl shadow-sm">
                                                                <div className="flex items-center justify-between mb-1"><p className="text-sm font-bold text-foreground truncate">{item.action}</p><span className="text-xs text-muted-foreground whitespace-nowrap">{item.time}</span></div>
                                                                <p className="text-sm text-muted-foreground truncate">{item.target}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* --- INFO MODAL --- */}
            {createPortal(
                <AnimatePresence>
                    {infoCard && (
                        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 sm:p-6">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/90" onClick={() => setInfoCard(null)} />
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ type: 'spring', bounce: 0, duration: 0.3 }} className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-[500px] flex flex-col overflow-hidden">
                                {(() => {
                                    const activeInfo = cardInfo[infoCard as keyof typeof cardInfo];
                                    if (!activeInfo) return null;
                                    return (
                                        <>
                                            <div className="flex items-center justify-between p-5 border-b border-border bg-muted/10">
                                                <div className="flex items-center gap-2"><span className="material-symbols-outlined text-primary text-[20px]">info</span><h2 className="text-lg font-bold text-foreground">{activeInfo.title}</h2></div>
                                                <button onClick={() => setInfoCard(null)} className="p-1.5 rounded-full hover:bg-muted text-muted-foreground transition-colors"><span className="material-symbols-outlined text-[20px]">close</span></button>
                                            </div>
                                            <div className="p-6 overflow-y-auto flex flex-col gap-4 text-body-sm leading-relaxed">
                                                <p className="text-muted-foreground font-medium text-sm">{activeInfo.desc}</p>
                                                <div className="flex flex-col gap-3">
                                                    {activeInfo.sections.map((sec, idx) => (
                                                        <div key={idx} className="bg-background border border-border rounded-xl p-3">
                                                            <h4 className="font-bold text-foreground text-xs uppercase tracking-wider mb-1">{sec.title}</h4>
                                                            <p className="text-muted-foreground text-[12px]">{sec.text}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </>
                                    );
                                })()}
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}

            {/* --- CLOUD VAULT MODAL --- */}
            {createPortal(
                <AnimatePresence>
                    {showVault && (
                        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-8">
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-background/90" onClick={() => setShowVault(false)} />
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} transition={{ type: 'spring', bounce: 0, duration: 0.3 }} className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-[700px] max-h-[85vh] flex flex-col overflow-hidden">
                                <div className="flex items-center justify-between p-6 border-b border-border shrink-0 bg-card z-10">
                                    <div><h2 className="text-xl font-bold text-foreground flex items-center gap-2"><span className="material-symbols-outlined text-primary">cloud</span>Cloud Vault</h2><p className="text-xs text-muted-foreground mt-1">Restore deleted shortcuts or manage your cloud backups.</p></div>
                                    <button onClick={() => setShowVault(false)} className="p-2 rounded-full hover:bg-muted text-muted-foreground transition-colors"><span className="material-symbols-outlined">close</span></button>
                                </div>
                                <div className="p-6 overflow-y-auto flex-1 custom-scrollbar bg-background/50">
                                    {isVaultLoading || remoteShortcuts === null ? (
                                        <div className="flex flex-col items-center justify-center py-12"><span className="material-symbols-outlined text-[32px] text-primary animate-spin mb-4">progress_activity</span><p className="text-sm text-muted-foreground">Fetching cloud backups...</p></div>
                                    ) : remoteShortcuts.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center py-12 text-center opacity-50"><span className="material-symbols-outlined text-[48px] mb-4">cloud_off</span><h3 className="text-lg font-bold text-foreground">No cloud backups</h3><p className="text-sm text-muted-foreground mt-1">Shortcuts you sync will appear here.</p></div>
                                    ) : (
                                        <div className="space-y-3">
                                            {remoteShortcuts.map(sc => {
                                                const localVersion = localShortcuts.find(l => l.id === sc.id);
                                                const isMissing = !localVersion;
                                                const isEdited = localVersion && !areShortcutsEqual(localVersion, sc);
                                                const isBroken = !!localVersion && syncErrors.some(err => err.id === sc.id);
                                                const isPendingDeletion = pendingDeletions.includes(sc.id);

                                                let statusText = 'Already in Library';
                                                let statusClass = 'text-muted-foreground';
                                                if (isMissing && isPendingDeletion) {
                                                    statusText = 'Deleted locally';
                                                    statusClass = 'text-amber-500 font-semibold';
                                                } else if (isMissing) {
                                                    statusText = 'Not in Library';
                                                } else if (isEdited) {
                                                    statusText = 'Edited locally';
                                                    statusClass = 'text-amber-500 font-semibold';
                                                } else if (isBroken) {
                                                    statusText = 'In Library — broken path';
                                                    statusClass = 'text-amber-500 font-semibold';
                                                }

                                                return (
                                                    <div key={sc.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-card border border-border p-4 rounded-xl shadow-sm gap-3">
                                                        <div className="flex items-center gap-3 min-w-0">
                                                            <div className="w-10 h-10 rounded-lg bg-muted border border-border flex items-center justify-center text-primary shrink-0"><span className="material-symbols-outlined text-[20px]">code</span></div>
                                                            <div className="min-w-0">
                                                                <p className="text-sm font-semibold text-foreground truncate">{sc.name}</p>
                                                                <p className={`text-[10px] truncate ${statusClass}`}>{statusText}</p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0 sm:ml-4 self-end sm:self-auto">
                                                            <button onClick={() => { void handleRestore(sc); }} disabled={!isMissing && !isEdited} className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors flex items-center gap-1 ${(!isMissing && !isEdited) ? 'bg-muted text-muted-foreground cursor-not-allowed' : isEdited ? 'bg-amber-500 text-white hover:bg-amber-600' : 'bg-primary text-primary-foreground hover:opacity-90'}`}>
                                                                <span className="material-symbols-outlined text-[14px]">{isEdited ? 'history' : 'download'}</span>
                                                                {(!isMissing && !isEdited) ? 'Restored' : isEdited ? 'Revert Edit' : 'Restore'}
                                                            </button>
                                                            <button onClick={() => handleDeleteCloud(sc.id, sc.name)} className="px-3 py-1.5 bg-red-500/10 text-red-500 text-xs font-semibold rounded-lg hover:bg-red-500/20 transition-colors flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">delete</span>Delete</button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        </div>
                    )}
                </AnimatePresence>,
                document.body
            )}
        </main>
    );
};