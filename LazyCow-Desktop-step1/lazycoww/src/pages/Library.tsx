import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { SavedShortcut, isUwpPath } from '../types/actions';
import { ShortcutCard } from '../components/ShortcutCard';
import { DeleteModal } from '../components/DeleteModal';
import { ConfirmSecuredModal } from '../components/ConfirmSecuredModal';
import { migrateShortcutsSecured, readSecuredDoublePressSeconds } from '../utils/security';
import { usePrefersReducedMotion } from '../hooks/usePrefersReducedMotion';
import { useDragSelect } from '../hooks/useDragSelect';
import { persistShortcuts, recoverShortcutsFromDiskIfEmpty } from '../utils/shortcutStorage';
import { readAutoScrollSpeed } from '../utils/autoScroll';
import { ConfirmDeleteShortcutsModal } from '../components/ConfirmDeleteShortcutsModal';

interface LibraryProps {
  setActiveTab: (tab: string) => void;
  onEditShortcut: (shortcut: SavedShortcut, focusActionId?: string) => void;
  customColorMode: boolean;
}

export const Library: React.FC<LibraryProps> = ({ setActiveTab, onEditShortcut, customColorMode }) => {
  const [gridCols, setGridCols] = useState<2 | 3 | 4>(2);
  const [searchQuery, setSearchQuery] = useState('');

  // ── Multi-select state ──
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfirmMultiDelete, setShowConfirmMultiDelete] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // Auto-scroll speed mirror — same reader as ActionSequence uses.
  const [autoScrollSpeed, setAutoScrollSpeed] = useState<number>(() => readAutoScrollSpeed());
  const autoScrollSpeedRef = useRef(autoScrollSpeed);
  useEffect(() => { autoScrollSpeedRef.current = autoScrollSpeed; }, [autoScrollSpeed]);
  useEffect(() => {
    const onRefresh = () => setAutoScrollSpeed(readAutoScrollSpeed());
    window.addEventListener('storage', onRefresh);
    window.addEventListener('focus', onRefresh);
    window.addEventListener('lazycow-settings-changed', onRefresh);
    return () => {
      window.removeEventListener('storage', onRefresh);
      window.removeEventListener('focus', onRefresh);
      window.removeEventListener('lazycow-settings-changed', onRefresh);
    };
  }, []);

  const [shortcuts, setShortcuts] = useState<SavedShortcut[]>(() =>
    JSON.parse(localStorage.getItem('lazycow-shortcuts') || '[]')
  );

  // On mount: if localStorage is empty but the disk mirror has data,
  // restore from disk. Covers the dev-mode hard-kill data-loss case.
  useEffect(() => {
    void recoverShortcutsFromDiskIfEmpty().then((recovered) => {
      if (recovered) {
        setShortcuts(recovered);
        syncHotkeysAndTrackFailures(recovered);
      }
    });
  }, []);

  const [failedHotkeys, setFailedHotkeys] = useState<Set<string>>(new Set());
  // Map of shortcut ID → first broken action's ID.
  // Populated after Library mounts and on refresh; used to gate the Run
  // button, show the amber "Broken Path" badge, and (via onEditShortcut)
  // auto-scroll the Builder to the broken action when "Fix Paths" is clicked.
  const [brokenShortcuts, setBrokenShortcuts] = useState<Map<string, string>>(new Map());

  // Reduced-motion detection for the grid entrance stagger. Same hook
  // the App Drawer uses — single source of truth for the accessibility
  // preference across every animated surface.
  const reducedMotion = usePrefersReducedMotion();

  // Sync hotkeys AND reset the conflict-failure set first. The main process
  // synchronously re-emits `hotkey-register-failed` for every combo it
  // can't register, so the set repopulates with only the *current*
  // failures. Without this clear, a shortcut that previously conflicted
  // but no longer does would keep its stale "Conflict" badge forever —
  // the main process never emits a success event, so the renderer has no
  // other signal that the conflict resolved.
  // ── Selection helpers ──
  const toggleSelectedId = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  const handleSelectAllToggle = useCallback(() => {
    setSelectedIds((prev) => {
      // Compare against the currently filtered list, not the full set —
      // the user sees the filtered cards, so "Select All" must mean
      // "all of THOSE". filtered is derived from search + shortcuts below.
      const visibleIds = shortcuts
        .filter((s) =>
          s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          s.description.toLowerCase().includes(searchQuery.toLowerCase())
        )
        .map((s) => s.id);
      const allSelected = visibleIds.length > 0 && visibleIds.every((id) => prev.has(id));
      return allSelected ? new Set() : new Set(visibleIds);
    });
  }, [shortcuts, searchQuery]);

  // Escape exits selection mode. Suppressed while the confirm modal is
  // open — the modal owns Escape during that window.
  useEffect(() => {
    if (!selectionMode || showConfirmMultiDelete) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        exitSelectionMode();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [selectionMode, showConfirmMultiDelete, exitSelectionMode]);

  // Long-press + drag-select engine. See useDragSelect for mechanics.
  useDragSelect({
    containerRef: gridRef,
    enabled: selectionMode,
    onToggle: toggleSelectedId,
    onEnterSelectionMode: () => setSelectionMode(true),
    getAutoScrollSpeed: () => autoScrollSpeedRef.current,
  });

  const syncHotkeysAndTrackFailures = useCallback((list: SavedShortcut[]) => {
    setFailedHotkeys(new Set());
    window.electronAPI?.syncHotkeys({
      shortcuts: list.map((s) => ({ id: s.id, name: s.name, hotkey: s.hotkey, actions: s.actions, secured: s.secured, windowLayout: s.windowLayout })),
      securedDoublePressSeconds: readSecuredDoublePressSeconds(),
    });
  }, []);

  const refreshShortcuts = useCallback(() => {
    const raw: SavedShortcut[] = JSON.parse(localStorage.getItem('lazycow-shortcuts') || '[]');
    // One-time migration: compute `secured` for any shortcut that doesn't
    // have it yet. Idempotent — running again is a no-op.
    const { shortcuts: loaded, changed } = migrateShortcutsSecured(raw);
    if (changed) {
      persistShortcuts(loaded);
    }
    setShortcuts(loaded);
    syncHotkeysAndTrackFailures(loaded);
  }, [syncHotkeysAndTrackFailures]);

  useEffect(() => { refreshShortcuts(); }, [refreshShortcuts]);

  // ── Pre-flight path validation ──
  // Runs a debounced check on every path-based action in every shortcut.
  // Any shortcut with a broken path goes into `brokenShortcuts`, which:
  //   - greys out the Run button on the card
  //   - shows an amber "Broken Path" badge
  //   - prevents the hotkey from firing it (handled in main.ts)
  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (!window.electronAPI?.checkPathExists) return;

      const broken = new Map<string, string>(); // shortcutId → first broken actionId

      for (const sc of shortcuts) {
        for (const a of sc.actions) {
          // Only check path-based action types
          if (
            a.type !== 'launch_app' &&
            a.type !== 'open_file' &&
            a.type !== 'open_folder'
          ) continue;

          // UWP apps launch via shell:AppsFolder, not a real file path.
          if (a.type === 'launch_app' && isUwpPath(a.value)) continue;

          const val = (a.value || '').trim();
          if (!val) {
            // Empty value = broken (it was never set)
            broken.set(sc.id, a.id);
            break;
          }

          try {
            const exists = await window.electronAPI.checkPathExists(val);
            if (!exists) {
              broken.set(sc.id, a.id);
              break; // one broken path is enough to flag the whole shortcut
            }
          } catch {
            // If the IPC itself errors, don't flag the shortcut
          }
        }
      }

      if (!cancelled) setBrokenShortcuts(broken);
    };

    // Small debounce so it doesn't hammer IPC on rapid state changes
    const t = setTimeout(run, 250);

    // Re-run validation whenever the window regains focus. If the user
    // went to Explorer to fix a file and came back, this refreshes the
    // badge without needing a page reload.
    const onFocus = () => { void run(); };
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      clearTimeout(t);
      window.removeEventListener('focus', onFocus);
    };
  }, [shortcuts]);

  const [executions, setExecutions] = useState<Record<string, {
    status: 'idle' | 'running' | 'success' | 'error' | 'cancelled';
    currentStepIndex: number;
    errors?: string[];
    durationMs?: number;
    cancelledAfter?: string;
    layoutResults?: Array<{
      zoneId: string;
      actionTitle: string;
      status: 'placed' | 'fallback_centered' | 'not_found' | 'skipped';
      reason?: string;
    }>;
  }>>({});
  // Tracks which shortcuts have a cancel request in flight (button shows "Cancelling...")
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());
  const resetTimers = useRef<Record<string, NodeJS.Timeout>>({});
  useEffect(() => () => { Object.values(resetTimers.current).forEach(clearTimeout); }, []);

  const [confirmRun, setConfirmRun] = useState<SavedShortcut | null>(null);

  const executeShortcut = useCallback((card: SavedShortcut) => {
    if (resetTimers.current[card.id]) clearTimeout(resetTimers.current[card.id]);
    setExecutions((p) => ({ ...p, [card.id]: { status: 'running', currentStepIndex: 0 } }));

    window.electronAPI?.runShortcut({
      id: card.id,
      name: card.name,
      hotkey: card.hotkey,
      actions: card.actions,
      windowLayout: card.windowLayout,
    }).catch(() => { /* completion / errors also arrive via the shortcut-complete event */ });
  }, []);

  const runShortcut = (id: string) => {
    const card = shortcuts.find((s) => s.id === id);
    if (!card) return;

    // Show the secured modal only if this specific shortcut is secured.
    // (The global toggle affects new-shortcut defaults, not existing ones.)
    if (card.secured) {
      setConfirmRun(card);
      return;
    }
    executeShortcut(card);
  };

  const handleCancelShortcut = useCallback(async (shortcutId: string) => {
    // Mark as cancelling immediately so the button reflects the click,
    // even though the actual stop happens at the next step boundary.
    setCancellingIds((p) => new Set(p).add(shortcutId));
    try {
      await window.electronAPI?.cancelShortcut(shortcutId);
    } catch {
      // If the cancel request itself failed, drop the cancelling state
      setCancellingIds((p) => { const n = new Set(p); n.delete(shortcutId); return n; });
    }
  }, []);

  // ── Live progress / completion / hotkey events from the main process ──
  useEffect(() => {
    const offProgress = window.electronAPI?.onShortcutProgress(({ shortcutId, stepIndex }) => {
      setExecutions((p) => ({ ...p, [shortcutId]: { ...(p[shortcutId] || { status: 'running' }), status: 'running', currentStepIndex: stepIndex } }));
    });

    const offComplete = window.electronAPI?.onShortcutComplete(({ shortcutId, results, durationMs, cancelled, lastActionTitle, layoutResults }) => {
      const failed = results.filter((r) => !r.success);
      const status: 'success' | 'error' | 'cancelled' = cancelled
        ? 'cancelled'
        : failed.length
          ? 'error'
          : 'success';
      setExecutions((p) => ({
        ...p,
        [shortcutId]: {
          status,
          currentStepIndex: results.length,
          errors: failed.map((f) => f.error || 'Unknown error'),
          durationMs,
          cancelledAfter: cancelled ? (lastActionTitle || undefined) : undefined,
          layoutResults: layoutResults || undefined,
        },
      }));
      // The shortcut finished running — if we had a confirmation modal
      // open for it, close it. The user already ran the shortcut through
      // some other path (hotkey, double-press, etc.), so the modal's job
      // is done.
      setConfirmRun((current) => (current?.id === shortcutId ? null : current));
      // Drop the "cancelling" flag now that execution has stopped
      setCancellingIds((p) => { const n = new Set(p); n.delete(shortcutId); return n; });
      resetTimers.current[shortcutId] = setTimeout(() => {
        setExecutions((p) => ({ ...p, [shortcutId]: { status: 'idle', currentStepIndex: -1 } }));
      }, 10000);
    });

    const offFailed = window.electronAPI?.onHotkeyRegisterFailed(({ shortcutId }) => {
      setFailedHotkeys((p) => new Set(p).add(shortcutId));
    });

    const offHotkey = window.electronAPI?.onHotkeyTriggered((shortcutId) => {
      setExecutions((p) => ({ ...p, [shortcutId]: { status: 'running', currentStepIndex: 0 } }));
      // The shortcut is starting now — if we happen to have a
      // confirmation modal for it open, close it. This defends against
      // the race where a stale `hotkey-needs-confirm` arrives after
      // `shortcut-complete` already fired.
      setConfirmRun((current) => (current?.id === shortcutId ? null : current));
    });

    const offHotkeyNeedsConfirm = window.electronAPI?.onHotkeyNeedsConfirm((shortcutId) => {
      setShortcuts((current) => {
        const card = current.find((s) => s.id === shortcutId);
        if (card) setConfirmRun(card);
        return current;
      });
    });

    // The main process tells us a shortcut started (via any path — hotkey,
    // double-press, Library Run, etc.). Close any pending confirmation
    // modal for that shortcut so we don't leave a stale dialog on screen.
    const offStarted = window.electronAPI?.onShortcutStarted(({ shortcutId }) => {
      setConfirmRun((current) => (current?.id === shortcutId ? null : current));
    });

    // If the window is minimized or hidden while a modal is open, close
    // the modal. The user deferred the decision — when they come back
    // and re-trigger, they get a fresh confirmation cycle instead of a
    // stale dialog from a previous attempt.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        setConfirmRun(null);
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      offProgress?.();
      offComplete?.();
      offFailed?.();
      offHotkey?.();
      offHotkeyNeedsConfirm?.();
      offStarted?.();
    };
  }, []);

  const [cardShades, setCardShades] = useState<Record<string, 'light' | 'medium' | 'dark'>>({});

  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [renameError, setRenameError] = useState('');

  const handleRename = (id: string) => {
    const s = shortcuts.find((sc) => sc.id === id);
    if (s) { setRenameValue(s.name); setRenameId(id); setRenameError(''); }
  };

  const handleRenameSave = () => {
    if (!renameId || !renameValue.trim()) return;
    const duplicate = shortcuts.find(
      (s) => s.name.toLowerCase() === renameValue.trim().toLowerCase() && s.id !== renameId
    );
    if (duplicate) {
      setRenameError(`A shortcut named "${duplicate.name}" already exists. Choose a different name.`);
      return;
    }
    const updated = shortcuts.map((s) => s.id === renameId ? { ...s, name: renameValue.trim() } : s);
    setShortcuts(updated);
    persistShortcuts(updated);
    setRenameId(null);
    setRenameError('');
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const confirmDelete = () => {
    if (deleteId) {
      const updated = shortcuts.filter((s) => s.id !== deleteId);
      setShortcuts(updated);
      persistShortcuts(updated);
      syncHotkeysAndTrackFailures(updated);
    }
    setDeleteId(null);
  };

  const handleConfirmMultiDelete = () => {
    const updated = shortcuts.filter((s) => !selectedIds.has(s.id));
    setShortcuts(updated);
    persistShortcuts(updated);
    syncHotkeysAndTrackFailures(updated);
    setShowConfirmMultiDelete(false);
    exitSelectionMode();
  };

  const handleDuplicate = (card: SavedShortcut) => {
    let copyIndex = 1;
    let candidateName = `${card.name} (Copy)`;
    while (shortcuts.some((s) => s.name.toLowerCase() === candidateName.toLowerCase())) {
      copyIndex++;
      candidateName = `${card.name} (Copy ${copyIndex})`;
    }
    const duplicated: SavedShortcut = {
      ...card,
      id: crypto.randomUUID(),
      name: candidateName,
      hotkey: '',
      createdAt: new Date().toISOString(),
      actions: card.actions.map((a) => ({ ...a, id: crypto.randomUUID() })),
    };
    const updated = [duplicated, ...shortcuts];
    setShortcuts(updated);
    persistShortcuts(updated);
    syncHotkeysAndTrackFailures(updated);
  };

  // Toggle the per-shortcut "Secured" flag. Persists to localStorage and
  // re-syncs the main process so the runtime reads the new value on the
  // next hotkey fire. Available in the ShortcutCard's 3-dot menu.
  const handleToggleSecured = (id: string) => {
    const updated = shortcuts.map((s) =>
      s.id === id ? { ...s, secured: !s.secured } : s
    );
    setShortcuts(updated);
    persistShortcuts(updated);
    syncHotkeysAndTrackFailures(updated);
  };

  const filtered = shortcuts.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className={`flex-1 p-margin-page w-full max-w-container-max mx-auto overflow-y-auto pb-32 ${selectionMode ? 'select-none' : ''}`}>
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex items-center gap-3">
          {!selectionMode ? (
            <div className="flex items-center gap-2 bg-card-light p-1 rounded-lg border border-border">
              {([2, 3, 4] as const).map((n) => (
                <button key={n} onClick={() => setGridCols(n)}
                  className={`p-1.5 rounded transition-colors ${gridCols === n ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                  title={`${n} Columns`}>
                  <span className="material-symbols-outlined text-[20px]">{n === 2 ? 'splitscreen' : n === 3 ? 'view_column' : 'grid_view'}</span>
                </button>
              ))}
            </div>
          ) : (
            <span className="text-body-sm text-primary font-medium">
              {selectedIds.size} selected
            </span>
          )}
        </div>

        {!selectionMode ? (
          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative w-full md:w-64">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[18px]">search</span>
              <input type="text" placeholder="Search shortcuts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-card-light border border-border rounded-full py-2 pl-9 pr-4 text-body-sm focus:outline-none focus:border-primary transition-colors text-foreground" />
            </div>
            {shortcuts.length > 0 && (
              <button onClick={() => setSelectionMode(true)}
                className="shrink-0 px-4 py-2 border border-border rounded-full font-body-sm text-foreground hover:bg-muted transition-colors flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">checklist</span>
                Select
              </button>
            )}
            <button onClick={() => { setActiveTab('builder'); }}
              className="shrink-0 bg-primary text-primary-foreground px-4 py-2 rounded-full font-label-caps text-label-caps flex items-center gap-2 hover:opacity-90 transition-opacity">
              <span className="material-symbols-outlined text-[16px]">add</span> New Shortcut
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 w-full md:w-auto flex-wrap">
            <button
              onClick={handleSelectAllToggle}
              className="px-3 py-1.5 rounded-full border border-border text-body-sm text-foreground hover:bg-muted transition-colors"
            >
              {(() => {
                const visibleIds = shortcuts
                  .filter((s) =>
                    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    s.description.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .map((s) => s.id);
                const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
                return allSelected ? 'Deselect All' : 'Select All';
              })()}
            </button>
            {selectedIds.size > 0 && (
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-1.5 rounded-full border border-border text-body-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              >
                Clear
              </button>
            )}
            <button
              onClick={() => setShowConfirmMultiDelete(true)}
              disabled={selectedIds.size === 0}
              className={`px-3 py-1.5 rounded-full text-body-sm flex items-center gap-1.5 transition-colors ${
                selectedIds.size === 0
                  ? 'bg-muted text-muted-foreground cursor-not-allowed'
                  : 'bg-red-500 text-white hover:bg-red-600'
              }`}
            >
              <span className="material-symbols-outlined text-[16px]">delete</span>
              Delete
            </button>
            <button
              onClick={exitSelectionMode}
              className="px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-body-sm hover:opacity-90 transition-opacity"
              title="Exit selection mode (Esc)"
            >
              Done
            </button>
          </div>
        )}
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="material-symbols-outlined text-6xl text-muted-foreground/50 mb-4">auto_awesome</span>
          <h2 className="font-title-sm text-foreground text-xl mb-2">No shortcuts yet</h2>
          <p className="text-muted-foreground font-body-md mb-6">Create your first shortcut in the Builder to see it here.</p>
          <button onClick={() => setActiveTab('builder')} className="bg-primary text-primary-foreground px-6 py-2.5 rounded-full font-title-sm hover:opacity-90 transition-opacity">Go to Builder</button>
        </div>
      )}

      {/* Cards animate themselves on mount (see ShortcutCard's entrance
          variants). The parent is a plain div — motion's `staggerChildren`
          can't cap the delay and would give card 30 a 900ms wait; each
          card owns its own delay, capped at index 8. */}
      <div ref={gridRef} className={`grid grid-cols-1 gap-gutter ${gridCols === 2 ? 'md:grid-cols-2' : gridCols === 3 ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        }`}>
        {filtered.map((card, index) => (
          <ShortcutCard
            key={card.id}
            shortcut={card}
            shade={cardShades[card.id] || 'medium'}
            onShadeChange={(s) => setCardShades((p) => ({ ...p, [card.id]: s }))}
            onEditFlow={onEditShortcut}
            onRename={handleRename}
            onDelete={setDeleteId}
            onRun={runShortcut}
            onCancel={handleCancelShortcut}
            onDuplicate={handleDuplicate}
            hasHotkeyConflict={failedHotkeys.has(card.id)}
            hasBrokenPath={brokenShortcuts.has(card.id)}
            brokenActionId={brokenShortcuts.get(card.id)}
            isCancelling={cancellingIds.has(card.id)}
            execution={executions[card.id]}
            customColorMode={customColorMode}
            onToggleSecured={handleToggleSecured}
            staggerIndex={index}
            reducedMotion={reducedMotion}
            selectionMode={selectionMode}
            isSelected={selectedIds.has(card.id)}
          />
        ))}
      </div>

      {renameId && createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-background/90" onClick={() => { setRenameId(null); setRenameError(''); }} />
          <div className="relative bg-card border border-border rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4">
            <h2 className="font-title-sm text-foreground mb-4">Rename Shortcut</h2>
            <input type="text" value={renameValue}
              onChange={(e) => { setRenameValue(e.target.value); setRenameError(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') handleRenameSave(); if (e.key === 'Escape') { setRenameId(null); setRenameError(''); } }}
              className="w-full bg-background/80 border border-border rounded-lg px-4 py-2.5 font-body-md text-foreground focus:ring-primary focus:border-primary focus:outline-none mb-2"
              autoFocus />
            {renameError && <p className="text-red-500 font-body-sm mb-3">{renameError}</p>}
            <div className="flex gap-3">
              <button onClick={() => { setRenameId(null); setRenameError(''); }} className="flex-1 px-4 py-2 border border-border rounded-full font-body-sm hover:bg-muted transition-colors text-foreground">Cancel</button>
              <button onClick={handleRenameSave} className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-full font-body-sm hover:opacity-90 transition-opacity">Save</button>
            </div>
          </div>
        </div>,
        document.body
      )}
      {deleteId && <DeleteModal onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />}

      {showConfirmMultiDelete && (
        <ConfirmDeleteShortcutsModal
          count={selectedIds.size}
          onConfirm={handleConfirmMultiDelete}
          onCancel={() => setShowConfirmMultiDelete(false)}
        />
      )}

      {confirmRun && (
        <ConfirmSecuredModal
          shortcut={confirmRun}
          onCancel={() => setConfirmRun(null)}
          onConfirm={(updated: SavedShortcut) => {
            // Persist any staged safety-override edits + (optionally) the
            // secured=false flip from the all-safe prompt.
            const persisted = shortcuts.map((s) => s.id === updated.id ? updated : s);
            setShortcuts(persisted);
            persistShortcuts(persisted);
            syncHotkeysAndTrackFailures(persisted);
            setConfirmRun(null);
            executeShortcut(updated);
          }}
        />
      )}
    </main>
  );
};