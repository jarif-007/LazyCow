import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SavedShortcut } from '../types/actions';
import { ShortcutCard } from '../components/ShortcutCard';
import { DeleteModal } from '../components/DeleteModal';
import { ConfirmSecuredModal } from '../components/ConfirmSecuredModal';
import { migrateShortcutsSecured, readSecuredDoublePressSeconds } from '../utils/security';

interface LibraryProps {
  setActiveTab: (tab: string) => void;
  onEditShortcut: (shortcut: SavedShortcut, focusActionId?: string) => void;
  customColorMode: boolean;
}

export const Library: React.FC<LibraryProps> = ({ setActiveTab, onEditShortcut, customColorMode }) => {
  const [gridCols, setGridCols] = useState<2 | 3 | 4>(2);
  const [searchQuery, setSearchQuery] = useState('');

  const [shortcuts, setShortcuts] = useState<SavedShortcut[]>(() =>
    JSON.parse(localStorage.getItem('lazycow-shortcuts') || '[]')
  );

  const [failedHotkeys, setFailedHotkeys] = useState<Set<string>>(new Set());
  // Map of shortcut ID → first broken action's ID.
  // Populated after Library mounts and on refresh; used to gate the Run
  // button, show the amber "Broken Path" badge, and (via onEditShortcut)
  // auto-scroll the Builder to the broken action when "Fix Paths" is clicked.
  const [brokenShortcuts, setBrokenShortcuts] = useState<Map<string, string>>(new Map());

  const refreshShortcuts = useCallback(() => {
    const raw: SavedShortcut[] = JSON.parse(localStorage.getItem('lazycow-shortcuts') || '[]');
    // One-time migration: compute `secured` for any shortcut that doesn't
    // have it yet. Idempotent — running again is a no-op.
    const { shortcuts: loaded, changed } = migrateShortcutsSecured(raw);
    if (changed) {
      localStorage.setItem('lazycow-shortcuts', JSON.stringify(loaded));
    }
    setShortcuts(loaded);
    setFailedHotkeys(new Set());
    window.electronAPI?.syncHotkeys({
      shortcuts: loaded.map((s) => ({ id: s.id, name: s.name, hotkey: s.hotkey, actions: s.actions, secured: s.secured })),
      securedDoublePressSeconds: readSecuredDoublePressSeconds(),
    });
  }, []);

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
    localStorage.setItem('lazycow-shortcuts', JSON.stringify(updated));
    setRenameId(null);
    setRenameError('');
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const confirmDelete = () => {
    if (deleteId) {
      const updated = shortcuts.filter((s) => s.id !== deleteId);
      setShortcuts(updated);
      localStorage.setItem('lazycow-shortcuts', JSON.stringify(updated));
      window.electronAPI?.syncHotkeys({
        shortcuts: updated.map((s) => ({ id: s.id, name: s.name, hotkey: s.hotkey, actions: s.actions, secured: s.secured })),
        securedDoublePressSeconds: readSecuredDoublePressSeconds(),
      });
    }
    setDeleteId(null);
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
    localStorage.setItem('lazycow-shortcuts', JSON.stringify(updated));
    window.electronAPI?.syncHotkeys({
      shortcuts: updated.map((s) => ({ id: s.id, name: s.name, hotkey: s.hotkey, actions: s.actions, secured: s.secured })),
      securedDoublePressSeconds: readSecuredDoublePressSeconds(),
    });
  };

  // Toggle the per-shortcut "Secured" flag. Persists to localStorage and
  // re-syncs the main process so the runtime reads the new value on the
  // next hotkey fire. Available in the ShortcutCard's 3-dot menu.
  const handleToggleSecured = (id: string) => {
    const updated = shortcuts.map((s) =>
      s.id === id ? { ...s, secured: !s.secured } : s
    );
    setShortcuts(updated);
    localStorage.setItem('lazycow-shortcuts', JSON.stringify(updated));
    window.electronAPI?.syncHotkeys({
      shortcuts: updated.map((s) => ({ id: s.id, name: s.name, hotkey: s.hotkey, actions: s.actions, secured: s.secured })),
      securedDoublePressSeconds: readSecuredDoublePressSeconds(),
    });
  };

  const filtered = shortcuts.filter((s) =>
    s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    s.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <main className="flex-1 p-margin-page w-full max-w-container-max mx-auto overflow-y-auto pb-32">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div className="flex items-center gap-2 bg-card-light p-1 rounded-lg border border-border">
          {([2, 3, 4] as const).map((n) => (
            <button key={n} onClick={() => setGridCols(n)}
              className={`p-1.5 rounded transition-colors ${gridCols === n ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
              title={`${n} Columns`}>
              <span className="material-symbols-outlined text-[20px]">{n === 2 ? 'splitscreen' : n === 3 ? 'view_column' : 'grid_view'}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-64">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[18px]">search</span>
            <input type="text" placeholder="Search shortcuts..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-card-light border border-border rounded-full py-2 pl-9 pr-4 text-body-sm focus:outline-none focus:border-primary transition-colors text-foreground" />
          </div>
          <button onClick={() => { setActiveTab('builder'); }}
            className="shrink-0 bg-primary text-primary-foreground px-4 py-2 rounded-full font-label-caps text-label-caps flex items-center gap-2 hover:opacity-90 transition-opacity">
            <span className="material-symbols-outlined text-[16px]">add</span> New Shortcut
          </button>
        </div>
      </div>

      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="material-symbols-outlined text-6xl text-muted-foreground/50 mb-4">auto_awesome</span>
          <h2 className="font-title-sm text-foreground text-xl mb-2">No shortcuts yet</h2>
          <p className="text-muted-foreground font-body-md mb-6">Create your first shortcut in the Builder to see it here.</p>
          <button onClick={() => setActiveTab('builder')} className="bg-primary text-primary-foreground px-6 py-2.5 rounded-full font-title-sm hover:opacity-90 transition-opacity">Go to Builder</button>
        </div>
      )}

      <div className={`grid grid-cols-1 gap-gutter transition-all duration-300 ${gridCols === 2 ? 'md:grid-cols-2' : gridCols === 3 ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
        }`}>
        {filtered.map((card) => (
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
          />
        ))}
      </div>

      {renameId && (
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
        </div>
      )}
      {deleteId && <DeleteModal onConfirm={confirmDelete} onCancel={() => setDeleteId(null)} />}

      {confirmRun && (
        <ConfirmSecuredModal
          shortcut={confirmRun}
          onCancel={() => setConfirmRun(null)}
          onConfirm={(updated: SavedShortcut) => {
            // Persist any staged safety-override edits + (optionally) the
            // secured=false flip from the all-safe prompt.
            const persisted = shortcuts.map((s) => s.id === updated.id ? updated : s);
            setShortcuts(persisted);
            localStorage.setItem('lazycow-shortcuts', JSON.stringify(persisted));
            window.electronAPI?.syncHotkeys({
              shortcuts: persisted.map((s) => ({ id: s.id, name: s.name, hotkey: s.hotkey, actions: s.actions, secured: s.secured })),
              securedDoublePressSeconds: readSecuredDoublePressSeconds(),
            });
            setConfirmRun(null);
            executeShortcut(updated);
          }}
        />
      )}
    </main>
  );
};