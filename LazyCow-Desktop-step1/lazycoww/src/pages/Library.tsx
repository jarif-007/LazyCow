import React, { useState, useEffect, useRef, useCallback } from 'react';
import { SavedShortcut } from '../types/actions';
import { ShortcutCard } from '../components/ShortcutCard';
import { DeleteModal } from '../components/DeleteModal';

interface LibraryProps {
  setActiveTab: (tab: string) => void;
  onEditShortcut: (shortcut: SavedShortcut) => void;
  customColorMode: boolean;
}

export const Library: React.FC<LibraryProps> = ({ setActiveTab, onEditShortcut, customColorMode }) => {
  const [gridCols, setGridCols] = useState<2 | 3 | 4>(2);
  const [searchQuery, setSearchQuery] = useState('');

  const [shortcuts, setShortcuts] = useState<SavedShortcut[]>(() =>
    JSON.parse(localStorage.getItem('lazycow-shortcuts') || '[]')
  );

  const [failedHotkeys, setFailedHotkeys] = useState<Set<string>>(new Set());

  const refreshShortcuts = useCallback(() => {
    const loaded: SavedShortcut[] = JSON.parse(localStorage.getItem('lazycow-shortcuts') || '[]');
    setShortcuts(loaded);
    setFailedHotkeys(new Set());
    // Keep the main process's global-hotkey registrations in sync with
    // whatever's currently saved (renaming/deleting/saving all land here).
    window.electronAPI?.syncHotkeys(loaded.map((s) => ({ id: s.id, name: s.name, hotkey: s.hotkey, actions: s.actions })));
  }, []);

  useEffect(() => { refreshShortcuts(); }, [refreshShortcuts]);

  const [executions, setExecutions] = useState<Record<string, { status: 'idle' | 'running' | 'success' | 'error'; currentStepIndex: number; errors?: string[]; durationMs?: number }>>({});
  const resetTimers = useRef<Record<string, NodeJS.Timeout>>({});
  useEffect(() => () => { Object.values(resetTimers.current).forEach(clearTimeout); }, []);

  // A shortcut containing a run_script action executes an arbitrary shell
  // command. That's fine for something the user built themselves in the
  // Builder — but it always needs an explicit, visible confirmation step
  // before it actually runs, so nothing runs silently.
  const [confirmRun, setConfirmRun] = useState<SavedShortcut | null>(null);

  const executeShortcut = useCallback((card: SavedShortcut) => {
    if (resetTimers.current[card.id]) clearTimeout(resetTimers.current[card.id]);
    setExecutions((p) => ({ ...p, [card.id]: { status: 'running', currentStepIndex: 0 } }));

    window.electronAPI?.runShortcut({ id: card.id, name: card.name, hotkey: card.hotkey, actions: card.actions })
      .catch(() => { /* completion / errors also arrive via the shortcut-complete event */ });
  }, []);

  const runShortcut = (id: string) => {
    const card = shortcuts.find((s) => s.id === id);
    if (!card) return;
    const DANGEROUS_EXTENSIONS = ['.exe', '.cmd', '.bat', '.ps1', '.vbs', '.js', '.wsf', '.msi'];
    const hasScript = card.actions.some((a) => {
      if (a.type === 'run_script' || a.type === 'launch_app') return true;
      if (a.type === 'open_file') {
        const val = (a.value || '').toLowerCase();
        const dotIdx = val.lastIndexOf('.');
        if (dotIdx !== -1 && DANGEROUS_EXTENSIONS.includes(val.slice(dotIdx))) return true;
      }
      return false;
    });
    if (hasScript) {
      setConfirmRun(card);
      return;
    }
    executeShortcut(card);
  };

  // ── Live progress / completion / hotkey events from the main process ──
  useEffect(() => {
    const offProgress = window.electronAPI?.onShortcutProgress(({ shortcutId, stepIndex }) => {
      setExecutions((p) => ({ ...p, [shortcutId]: { status: 'running', currentStepIndex: stepIndex } }));
    });

    const offComplete = window.electronAPI?.onShortcutComplete(({ shortcutId, results, durationMs }) => {
      const failed = results.filter((r) => !r.success);
      setExecutions((p) => ({
        ...p,
        [shortcutId]: {
          status: failed.length ? 'error' : 'success',
          currentStepIndex: results.length,
          errors: failed.map((f) => f.error || 'Unknown error'),
          durationMs,
        },
      }));
      resetTimers.current[shortcutId] = setTimeout(() => {
        setExecutions((p) => ({ ...p, [shortcutId]: { status: 'idle', currentStepIndex: -1 } }));
      }, 10000);
    });

    const offFailed = window.electronAPI?.onHotkeyRegisterFailed(({ shortcutId }) => {
      setFailedHotkeys((p) => new Set(p).add(shortcutId));
    });

    // Non-script shortcuts triggered by their global hotkey are already
    // executed by main by this point — this just starts the UI animation.
    const offHotkey = window.electronAPI?.onHotkeyTriggered((shortcutId) => {
      setExecutions((p) => ({ ...p, [shortcutId]: { status: 'running', currentStepIndex: 0 } }));
    });

    // Script-containing shortcuts triggered by hotkey: main hasn't run
    // anything yet, it's waiting on us to confirm.
    const offHotkeyNeedsConfirm = window.electronAPI?.onHotkeyNeedsConfirm((shortcutId) => {
      setShortcuts((current) => {
        const card = current.find((s) => s.id === shortcutId);
        if (card) setConfirmRun(card);
        return current;
      });
    });

    return () => { offProgress?.(); offComplete?.(); offFailed?.(); offHotkey?.(); offHotkeyNeedsConfirm?.(); };
  }, []);

  const [cardShades, setCardShades] = useState<Record<string, 'light' | 'medium' | 'dark'>>({});

  // ── Rename with inline modal ──
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
      window.electronAPI?.syncHotkeys(updated.map((s) => ({ id: s.id, name: s.name, hotkey: s.hotkey, actions: s.actions })));
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
      hotkey: '', // Unassigned so it does not conflict immediately
      createdAt: new Date().toISOString(),
      actions: card.actions.map((a) => ({
        ...a,
        id: crypto.randomUUID(),
      })),
    };
    const updated = [duplicated, ...shortcuts];
    setShortcuts(updated);
    localStorage.setItem('lazycow-shortcuts', JSON.stringify(updated));
    window.electronAPI?.syncHotkeys(updated.map((s) => ({ id: s.id, name: s.name, hotkey: s.hotkey, actions: s.actions })));
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

      <div className={`grid grid-cols-1 gap-gutter transition-all duration-300 ${
        gridCols === 2 ? 'md:grid-cols-2' : gridCols === 3 ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
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
            onDuplicate={handleDuplicate}
            hasHotkeyConflict={failedHotkeys.has(card.id)}
            execution={executions[card.id]}
            customColorMode={customColorMode}
          />
        ))}
      </div>

      {/* Inline Rename Modal */}
      {renameId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => { setRenameId(null); setRenameError(''); }} />
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

      {/* Confirm before running any shortcut that executes a shell command */}
      {confirmRun && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={() => setConfirmRun(null)} />
          <div className="relative bg-card border border-border rounded-2xl p-6 shadow-2xl max-w-md w-full mx-4">
            <h2 className="font-title-sm text-foreground mb-2 flex items-center gap-2">
              <span className="material-symbols-outlined text-red-500">warning</span>
              Security Warning
            </h2>
            <p className="text-body-sm text-muted-foreground mb-4">
              "{confirmRun.name}" contains potentially dangerous actions (scripts or executables) that will run on your system:
            </p>
            <div className="bg-card-dark text-card-dark-fg font-code-sm p-3 rounded-lg flex flex-col gap-1 mb-4 max-h-40 overflow-y-auto">
              {confirmRun.actions.filter((a) => a.type === 'run_script' || a.type === 'launch_app').map((a) => (
                <span key={a.id}>{a.type === 'launch_app' ? 'Launch: ' : ''}{a.value}</span>
              ))}
            </div>
            <div className="flex gap-3">
              <button onClick={() => setConfirmRun(null)} className="flex-1 px-4 py-2 border border-border rounded-full font-body-sm hover:bg-muted transition-colors text-foreground">Cancel</button>
              <button
                onClick={() => { const card = confirmRun; setConfirmRun(null); if (card) executeShortcut(card); }}
                className="flex-1 px-4 py-2 bg-red-500 text-white rounded-full font-body-sm hover:opacity-90 transition-opacity"
              >
                Run Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
};