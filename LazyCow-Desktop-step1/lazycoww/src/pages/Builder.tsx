import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ActionItem, CatalogItem, actionCatalog, SavedShortcut, WindowLayoutConfig } from '../types/actions';
import { ActionSidebar } from '../components/ActionSidebar';
import { ActionSequence } from '../components/ActionSequence';
import { ComboBuilder } from '../components/ComboBuilder';
import { WindowLayoutPanel } from '../components/WindowLayout/WindowLayoutPanel';
import { useHotkeyRecorder } from '../hooks/useHotkeyRecorder';
import { useActionValidation } from '../hooks/useActionValidation';
import { readSecuredShortcutsDefault } from '../utils/security';

interface BuilderProps {
  editData?: SavedShortcut | null;
  /** When set, scroll to + flash the action with this id after mounting.
   *  Used by Library's "Fix Paths" button to land the user on the broken action. */
  focusActionId?: string;
  isActionSidebarAutoCollapsed?: boolean;
  onUnsavedChanges?: (hasChanges: boolean) => void;
  onSaveSuccess?: () => void;
}

const MODIFIERS = ['Ctrl', 'Alt', 'Shift', 'Win'];

export const Builder: React.FC<BuilderProps> = ({ editData, focusActionId, isActionSidebarAutoCollapsed, onUnsavedChanges, onSaveSuccess }) => {
     const [sidebarCollapsed, setSidebarCollapsed] = useState(false);


    // ActionSidebar visible state = (user's manual choice) OR (window too narrow).
  const [manualCollapse, setManualCollapse] = useState(false);
  useEffect(() => {
    const next = !!isActionSidebarAutoCollapsed || manualCollapse;
    setSidebarCollapsed((prev) => (prev === next ? prev : next));
  }, [isActionSidebarAutoCollapsed, manualCollapse]);


  const [searchQuery, setSearchQuery] = useState('');
  const [shortcutName, setShortcutName] = useState('');
  const [shortcutDesc, setShortcutDesc] = useState('');
  const [nameError, setNameError] = useState(false);
  const [nameErrorMessage, setNameErrorMessage] = useState('');
  const [descError, setDescError] = useState(false);
  const [sequence, setSequence] = useState<ActionItem[]>([]);
  const [windowLayout, setWindowLayout] = useState<WindowLayoutConfig>({
    enabled: false,
    layoutId: null,
    assignments: {},
  });
  // Read the "show danger warnings" setting. Re-reads on window focus and on
  // cross-tab storage events so toggling it in Settings takes effect without
  // a page reload. Same pattern as autoScrollSpeed in ActionSequence.tsx.
  const readShowDangerWarnings = () => {
    try {
      const raw = localStorage.getItem('lazycow_settings');
      if (!raw) return true;
      return JSON.parse(raw)?.showDangerWarnings !== false;
    } catch { return true; }
  };
  const [showDangerWarnings, setShowDangerWarnings] = useState<boolean>(readShowDangerWarnings);
  useEffect(() => {
    const onRefresh = () => setShowDangerWarnings(readShowDangerWarnings());
    // `lazycow-settings-changed` — fires from Settings.tsx when any general
    // setting is toggled. This is the one that actually matters: user goes
    // Settings → toggle → Builder, all within the same Electron window, so
    // no `storage` or `focus` event would fire.
    window.addEventListener('lazycow-settings-changed', onRefresh);
    // `storage` — cross-window fallback (dev with multiple windows open).
    window.addEventListener('storage', onRefresh);
    // `focus` — if the user alt-tabs away and comes back.
    window.addEventListener('focus', onRefresh);
    return () => {
      window.removeEventListener('lazycow-settings-changed', onRefresh);
      window.removeEventListener('storage', onRefresh);
      window.removeEventListener('focus', onRefresh);
    };
  }, []);
  const [hotkeyError, setHotkeyError] = useState('');
  // Test Layout and Test Flow run independently and can each be cancelled
  // separately. They must NOT share a running flag — otherwise clicking one
  // makes the other's button flip to Cancel, and the wrong cancel handler
  // fires (with a null id) and does nothing.
  const [testLayoutRunning, setTestLayoutRunning] = useState(false);
  const [testFlowRunning, setTestFlowRunning] = useState(false);
  // Synthetic ids of the in-flight test runs. Needed so each cancel handler
  // can call cancelShortcut with the exact id the main process registered.
  const [testLayoutId, setTestLayoutId] = useState<string | null>(null);
  const [testFlowId, setTestFlowId] = useState<string | null>(null);

  const { recording: hotkeyRecording, recordedCombo, startRecording, stopRecording, clearCombo, setRecordedCombo } = useHotkeyRecorder('Win + Alt + D');
  const hotkey = recordedCombo || 'Win + Alt + D';

  // Tracks the combo that has been successfully Test-fired this session.
  // Save is gated on `hotkey === verifiedHotkey`. When editing an existing
  // shortcut, the loaded hotkey counts as verified (it was working before)
  // so the user doesn't have to re-test an unchanged value.
  const [verifiedHotkey, setVerifiedHotkey] = useState<string | null>(null);
  const [testingHotkey, setTestingHotkey] = useState(false);
  const [testHotkeyError, setTestHotkeyError] = useState<string | null>(null);

  useEffect(() => {
    if (editData && editData.hotkey) {
      setVerifiedHotkey(editData.hotkey);
    } else {
      setVerifiedHotkey(null);
    }
    setTestHotkeyError(null);
  }, [editData]);

  // Any change to the recorded combo invalidates the previous test result
  // and clears the previous error message. The Save gate
  // (`hotkey === verifiedHotkey`) already handles the *disable* part —
  // this effect is purely so the UI doesn't display stale feedback.
  useEffect(() => {
    setTestHotkeyError(null);
  }, [hotkey]);

  const hotkeyIsVerified = !!hotkey && hotkey !== 'Listening...' && hotkey === verifiedHotkey;

  const handleTestHotkey = async () => {
    if (!hotkey || hotkey === 'Listening...' || testingHotkey) return;
    setTestingHotkey(true);
    setTestHotkeyError(null);

    // While the test runs, listen for whatever the user actually presses.
    // LazyCow has focus during the test (the button was just clicked), so
    // the renderer sees every keydown. This lets us distinguish:
    //   - user pressed a *different* combo → we know exactly which
    //   - user pressed the *correct* combo but Windows swallowed it
    //     (UK Shift+digit, etc.) → keydown fired, globalShortcut didn't
    //   - user pressed nothing → we fall through to a generic timeout
    let wrongCombo: string | null = null;
    let matchingKeydown = false;

    const comboFromEvent = (e: KeyboardEvent): string => {
      const parts: string[] = [];
      if (e.ctrlKey) parts.push('Ctrl');
      if (e.altKey) parts.push('Alt');
      if (e.shiftKey) parts.push('Shift');
      if (e.metaKey) parts.push('Win');
      // Normalize the key the same way the recorder does, so the strings
      // compare equal regardless of what e.key happens to be on this layout.
      let key = e.key;
      if (/^Key[A-Z]$/.test(e.code)) key = e.code.slice(3);
      else if (/^Digit[0-9]$/.test(e.code)) key = e.code.slice(5);
      else if (/^Numpad[0-9]$/.test(e.code)) key = e.code.slice(6);
      else if (/^F[0-9]{1,2}$/.test(e.code)) key = e.code;
      else if (e.code === 'Space') key = 'Space';
      else if (e.code === 'Enter' || e.code === 'NumpadEnter') key = 'Return';
      else if (e.code === 'Escape') key = 'Esc';
      else if (e.code === 'Backspace') key = 'Backspace';
      else if (e.code === 'Delete') key = 'Delete';
      else if (e.code === 'Tab') key = 'Tab';
      else if (e.code.startsWith('Arrow')) key = e.code.slice(5);
      parts.push(key.length === 1 ? key.toUpperCase() : key);
      return parts.join(' + ');
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (['Control', 'Alt', 'Shift', 'Meta', 'OS'].includes(e.key)) return;
      const pressed = comboFromEvent(e);
      if (pressed === hotkey) matchingKeydown = true;
      else wrongCombo = pressed;
    };
    window.addEventListener('keydown', onKeyDown, true);

    const startedAt = Date.now();
    try {
      const res = await window.electronAPI?.testHotkey(hotkey);
      // Keep the "Listening..." state visible for at least 400ms so the
      // UI doesn't flicker on instant results.
      const elapsed = Date.now() - startedAt;
      if (elapsed < 400) await new Promise((r) => setTimeout(r, 400 - elapsed));

      if (res?.fired) {
        setVerifiedHotkey(hotkey);
      } else if (wrongCombo) {
        setVerifiedHotkey(null);
        setTestHotkeyError(`Wrong key combo — press "${hotkey}" again.\n(You pressed "${wrongCombo}".)`);
      } else if (matchingKeydown) {
        setVerifiedHotkey(null);
        setTestHotkeyError(
          `This combo won't work as a hotkey on your keyboard. Try a letter like "Ctrl+Shift+B" or an F-key.`
        );
      } else if (res?.reason === 'registration-rejected') {
        setVerifiedHotkey(null);
        setTestHotkeyError('Windows won\'t allow this combo. Try a different one.');
      } else {
        setVerifiedHotkey(null);
        setTestHotkeyError(`No key detected. Try "${hotkey}" again.`);
      }
    } catch {
      setVerifiedHotkey(null);
      setTestHotkeyError('Test failed. Try again.');
    } finally {
      window.removeEventListener('keydown', onKeyDown, true);
      setTestingHotkey(false);
    }
  };

  const { errors: actionErrors, unsupportedIds } = useActionValidation(sequence);
  const hasUnsupported = unsupportedIds.size > 0;
  const invalidActionCount = Object.keys(actionErrors).length;
  const actionsValid = invalidActionCount === 0;

  useEffect(() => {
    if (hotkeyRecording) return;
    if (!recordedCombo || recordedCombo === 'Win + Alt + D') { setHotkeyError(''); return; }
    const parts = recordedCombo.split(' + ');
    if (!MODIFIERS.includes(parts[0])) {
      setHotkeyError('Shortcut must start with a modifier key (Ctrl, Alt, Shift, or Win).');
      return;
    }
    const blocked: string[] = JSON.parse(localStorage.getItem('lazycow-blocked-triggers') || '[]');
    if (blocked.some((t) => t.toLowerCase() === hotkey.toLowerCase())) {
      setHotkeyError(`"${hotkey}" is blocked and cannot be used.`);
      return;
    }
    const existing: SavedShortcut[] = JSON.parse(localStorage.getItem('lazycow-shortcuts') || '[]');
    const duplicate = existing.find((s) => s.hotkey.toLowerCase() === hotkey.toLowerCase() && s.id !== editData?.id);
    if (duplicate) { setHotkeyError(`"${hotkey}" is already assigned to "${duplicate.name}".`); return; }
    setHotkeyError('');
  }, [hotkey, recordedCombo, hotkeyRecording, editData]);

  // Baseline snapshot of the loaded shortcut. When editing an existing
  // shortcut, we compare against this to detect *real* changes — otherwise
  // simply loading the form would flag it as "unsaved" the moment the user
  // navigates away.
  const baselineRef = useRef<string | null>(null);

  useEffect(() => {
    if (editData) {
      setShortcutName(editData.name);
      setShortcutDesc(editData.description);
      setSequence(editData.actions);
      if (editData.hotkey) setRecordedCombo(editData.hotkey);
      const wl = editData.windowLayout ?? { enabled: false, layoutId: null, assignments: {} };
      // Self-heal legacy orphans: if any assignment points at an action
      // that no longer exists in the sequence (e.g. it was deleted before
      // the delete-cleanup fix shipped), drop it now. The zone becomes
      // free, and the engine will no longer silently skip it.
      const liveIds = new Set(editData.actions.map((a) => a.id));
      const cleanedAssignments: Record<string, string> = {};
      let hasOrphans = false;
      for (const [zoneId, actionId] of Object.entries(wl.assignments)) {
        if (liveIds.has(actionId)) cleanedAssignments[zoneId] = actionId;
        else hasOrphans = true;
      }
      const nextWl = hasOrphans ? { ...wl, assignments: cleanedAssignments } : wl;
      setWindowLayout(nextWl);
      // Snapshot for change detection. Uses the same defaults the form
      // computes with so the baseline matches the post-render state.
      baselineRef.current = JSON.stringify({
        name: editData.name,
        description: editData.description,
        hotkey: editData.hotkey || 'Win + Alt + D',
        actions: editData.actions,
        windowLayout: nextWl,
      });
    } else {
      baselineRef.current = null;
    }
  }, [editData, setRecordedCombo]);

  // Auto-scroll to + flash the action that Library's "Fix Paths" pointed us at.
  // Retries up to 30 times (50ms apart) because React may not have committed
  // the sequence's action cards to the DOM at the moment this effect runs.
  useEffect(() => {
    if (!focusActionId) return;

    let cancelled = false;
    let attempts = 0;
    const MAX_ATTEMPTS = 30;

    const tryScroll = () => {
      if (cancelled) return;
      const el = document.getElementById(`action-card-${focusActionId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background');
        setTimeout(() => {
          el.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background');
        }, 900);
        return;
      }
      attempts += 1;
      if (attempts < MAX_ATTEMPTS) {
        setTimeout(tryScroll, 50);
      }
    };

    tryScroll();
    return () => { cancelled = true; };
  }, [focusActionId]);

  // New shortcuts: any content counts as unsaved. Existing shortcuts: only
  // flag as unsaved when the current form differs from the loaded baseline.
  // Reverting an edit brings the flag back to false.
  const hasUnsavedChanges = (() => {
    if (!editData) {
      return shortcutName.trim() !== '' || shortcutDesc.trim() !== '' || sequence.length > 0;
    }
    if (!baselineRef.current) return false;
    const current = JSON.stringify({
      name: shortcutName,
      description: shortcutDesc,
      hotkey: recordedCombo || 'Win + Alt + D',
      actions: sequence,
      windowLayout,
    });
    return current !== baselineRef.current;
  })();
  useEffect(() => { onUnsavedChanges?.(hasUnsavedChanges); }, [hasUnsavedChanges, onUnsavedChanges]);

  const addAction = useCallback((item: CatalogItem) => {
    if (item.disabled) return;
    setSequence((p) => [...p, { id: `act-${Date.now()}`, type: item.type, title: item.title, icon: item.icon, colorClass: item.colorClass, value: item.defaultValue }]);
  }, []);

  const addActionAt = useCallback((item: CatalogItem, index: number) => {
    if (item.disabled) return;
    setSequence((p) => { const n = [...p]; n.splice(index, 0, { id: `act-${Date.now()}`, type: item.type, title: item.title, icon: item.icon, colorClass: item.colorClass, value: item.defaultValue }); return n; });
  }, []);

  const deleteAction = useCallback((id: string) => {
    setSequence((p) => p.filter((a) => a.id !== id));
    // Prune any zone assignment pointing at the deleted action. Without
    // this, the zone stays flagged as "taken by another action" in the
    // PositionDropdown, and the Window Layout engine silently skips the
    // orphan — the deleted action's zone just disappears from the layout
    // instead of becoming free for reassignment.
    setWindowLayout((wl) => {
      const next: Record<string, string> = {};
      let changed = false;
      for (const [zoneId, actionId] of Object.entries(wl.assignments)) {
        if (actionId === id) { changed = true; continue; }
        next[zoneId] = actionId;
      }
      return changed ? { ...wl, assignments: next } : wl;
    });
  }, []);
  const updateValue = useCallback((id: string, value: string) => setSequence((p) => p.map((a) => a.id === id ? { ...a, value } : a)), []);
  const updateSafetyOverride = useCallback((id: string, override: 'dangerous' | 'safe') => {
    setSequence((p) => p.map((a) => a.id === id ? { ...a, safetyOverride: override } : a));
  }, []);
  const moveUp = useCallback((i: number) => { if (i > 0) setSequence((p) => { const n = [...p]; [n[i-1], n[i]] = [n[i], n[i-1]]; return n; }); }, []);
  const moveDown = useCallback((i: number) => setSequence((p) => { if (i >= p.length - 1) return p; const n = [...p]; [n[i], n[i+1]] = [n[i+1], n[i]]; return n; }), []);
  const reorder = useCallback((from: number, to: number) => setSequence((p) => { const n = [...p]; const [m] = n.splice(from, 1); n.splice(to, 0, m); return n; }), []);

  const handleSidebarDrag = useCallback((e: React.DragEvent, item: CatalogItem) => {
    e.dataTransfer.setData('application/catalog-type', item.type);
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  const handleDropFromSidebar = useCallback((index: number, type: string) => {
    const item = actionCatalog.find((i) => i.type === type);
    if (item) addActionAt(item, index);
  }, [addActionAt]);

  const handleDropAtEnd = useCallback((type: string) => {
    const item = actionCatalog.find((i) => i.type === type);
    if (item) addAction(item);
  }, [addAction]);

  const isFormValid = shortcutName.trim() !== '' && shortcutDesc.trim() !== '' && !hotkeyError && !nameError && actionsValid && hotkeyIsVerified;

  const handleNameChange = (v: string) => {
    setShortcutName(v);
    if (v.trim() === '') {
      setNameError(true);
      setNameErrorMessage('');
      return;
    }
    const existing: SavedShortcut[] = JSON.parse(localStorage.getItem('lazycow-shortcuts') || '[]');
    const duplicate = existing.find(
      (s) => s.name.toLowerCase() === v.trim().toLowerCase() && s.id !== editData?.id
    );
    if (duplicate) {
      setNameError(true);
      setNameErrorMessage(`A shortcut named "${duplicate.name}" already exists.`);
    } else {
      setNameError(false);
      setNameErrorMessage('');
    }
  };

  const handleDescChange = (v: string) => { setShortcutDesc(v); setDescError(v.trim() === ''); };

  // ── Test Layout ──
  // Launches only the launch-type actions so the user can preview the
  // window layout. Skips scripts, delays, and system actions.
  const handleTestLayout = async () => {
    const previewActions = sequence.filter((a) =>
      a.type === 'launch_app' ||
      a.type === 'open_file' ||
      a.type === 'open_folder' ||
      a.type === 'open_url'
    );

    if (previewActions.length === 0) return;

    const testId = `test-layout-${Date.now()}`;
    const previewShortcut: SavedShortcut = {
      id: testId,
      name: shortcutName.trim() || 'Test Layout',
      description: shortcutDesc.trim() || 'Preview',
      hotkey: '',
      actions: previewActions,
      createdAt: new Date().toISOString(),
      windowLayout,
    };

    setTestLayoutId(testId);
    setTestLayoutRunning(true);
    try {
      await window.electronAPI?.runShortcut(previewShortcut);
    } catch (err) {
      console.error('[Test Layout] failed:', err);
    } finally {
      setTestLayoutId(null);
      setTestLayoutRunning(false);
    }
  };

  // Cancel a running Test Layout. Aborts the layout engine's PowerShell
  // process so the button flips back immediately instead of waiting for
  // the poll deadline (up to 60s when a window never appears).
  const handleCancelTestLayout = () => {
    if (testLayoutId) {
      window.electronAPI?.cancelShortcut(testLayoutId);
    }
  };

  // ── Test Flow ──
  // Full end-to-end test: runs every validation check that Save would run,
  // then executes the shortcut exactly like clicking "Run" in the Library.
  // Side effects happen — scripts run, delays wait, system actions fire.
  const handleTestFlow = async () => {
    // Run the same gate as Save.
    if (!isFormValid) {
      setNameError(shortcutName.trim() === '');
      setDescError(shortcutDesc.trim() === '');
      return;
    }
    if (sequence.length === 0) {
      window.alert('Please add at least one action to the sequence before testing.');
      return;
    }

    const existing: SavedShortcut[] = JSON.parse(localStorage.getItem('lazycow-shortcuts') || '[]');

    // Duplicate name check (same as Save)
    const duplicateName = existing.find(
      (s) => s.name.toLowerCase() === shortcutName.trim().toLowerCase() && s.id !== editData?.id
    );
    if (duplicateName) {
      setNameError(true);
      setNameErrorMessage(`A shortcut named "${duplicateName.name}" already exists.`);
      return;
    }

    // Duplicate hotkey check (same as Save)
    if (hotkey && hotkey !== 'Listening...') {
      const duplicateHotkey = existing.find(
        (s) => s.hotkey === hotkey && s.id !== editData?.id
      );
      if (duplicateHotkey) {
        setHotkeyError(`Hotkey "${hotkey}" is already used by "${duplicateHotkey.name}".`);
        return;
      }
    }

    const testId = `test-flow-${Date.now()}`;
    const testShortcut: SavedShortcut = {
      id: testId,
      name: shortcutName.trim(),
      description: shortcutDesc.trim(),
      hotkey,
      actions: sequence,
      createdAt: new Date().toISOString(),
      windowLayout,
    };

    setTestFlowId(testId);
    setTestFlowRunning(true);
    try {
      await window.electronAPI?.runShortcut(testShortcut);
    } catch (err) {
      console.error('[Test Flow] failed:', err);
    } finally {
      setTestFlowId(null);
      setTestFlowRunning(false);
    }
  };

  // Cancel a running Test Flow. Same mechanism as Test Layout — abort the
  // layout engine's child PowerShell process and let the action loop break
  // gracefully at the next step boundary.
  const handleCancelTestFlow = () => {
    if (testFlowId) {
      window.electronAPI?.cancelShortcut(testFlowId);
    }
  };

  const handleSave = () => {
    if (!isFormValid) { setNameError(shortcutName.trim() === ''); setDescError(shortcutDesc.trim() === ''); return; }
    if (sequence.length === 0) { alert('Please add at least one action to the sequence before saving.'); return; }

    const existing: SavedShortcut[] = JSON.parse(localStorage.getItem('lazycow-shortcuts') || '[]');
    
    // Check duplicate hotkey
    if (hotkey && hotkey !== 'Listening...') {
      const duplicateHotkey = existing.find(
        (s) => s.hotkey === hotkey && s.id !== editData?.id
      );
      if (duplicateHotkey) {
        setHotkeyError(`Hotkey "${hotkey}" is already used by "${duplicateHotkey.name}".`);
        return;
      }
    }

    // New shortcuts inherit `secured` from the global default + the
    // shortcut's own dangerous content. Existing shortcuts keep whatever
    // the user has already chosen (editData.secured).
    const secured = editData
      ? (editData.secured ?? sequence.some((a) => a.safetyOverride === 'dangerous' || (!a.safetyOverride && (a.type === 'run_script' || a.type === 'launch_app'))))
      : (readSecuredShortcutsDefault() && sequence.some((a) => a.safetyOverride === 'dangerous' || (!a.safetyOverride && (a.type === 'run_script' || a.type === 'launch_app'))));

    const shortcut: SavedShortcut = {
      id: editData?.id || `sc-${Date.now()}`,
      name: shortcutName, description: shortcutDesc, hotkey, actions: sequence,
      createdAt: editData?.createdAt || new Date().toISOString(),
      windowLayout,
      secured,
    };

    if (editData) {
      const index = existing.findIndex((s) => s.id === editData.id);
      if (index !== -1) existing[index] = shortcut;
    } else { existing.push(shortcut); }

    localStorage.setItem('lazycow-shortcuts', JSON.stringify(existing));
    setShortcutName(''); setShortcutDesc(''); setSequence([]); clearCombo();
    setWindowLayout({ enabled: false, layoutId: null, assignments: {} });
    setNameError(false); setDescError(false); setHotkeyError(''); setNameErrorMessage('');
    onSaveSuccess?.();
  };

  const handleDiscard = () => {
    const blankLayout = { enabled: false, layoutId: null, assignments: {} };
    setShortcutName('');
    setShortcutDesc('');
    setSequence([]);
    setWindowLayout(blankLayout);
    clearCombo();
    setNameError(false);
    setDescError(false);
    setHotkeyError('');
    setNameErrorMessage('');
    // Discard resets the form to a blank new-shortcut state. Snapshot that
    // blank state as the baseline so leaving doesn't fire a spurious
    // "unsaved changes" prompt right after the user chose to abandon edits.
    baselineRef.current = JSON.stringify({
      name: '',
      description: '',
      hotkey: 'Win + Alt + D',
      actions: [],
      windowLayout: blankLayout,
    });
  };

  return (
    <main className="flex-1 py-margin-page pr-margin-page pl-2 w-full max-w-container-max mx-auto overflow-hidden flex flex-col min-h-0">
      <div className="flex gap-4 flex-1 min-h-0 overflow-hidden">
        <div className="flex shrink-0 min-h-0 h-full overflow-hidden">
          <ActionSidebar
            collapsed={sidebarCollapsed}
            isAutoCollapsed={isActionSidebarAutoCollapsed}
            onToggle={() => setManualCollapse((p) => !p)}
            onAddAction={addAction}
            onDragStart={handleSidebarDrag}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
          />
        </div>
        <div className="flex-1 min-w-0 min-h-0 h-full flex flex-col gap-6 overflow-y-auto overflow-x-hidden pr-2 relative pb-20">
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <input type="text" placeholder="Name your shortcut..." value={shortcutName} onChange={(e) => handleNameChange(e.target.value)}
                  className={`bg-transparent border-none p-0 focus:ring-0 text-foreground font-display-lg text-display-lg placeholder:opacity-20 focus:outline-none flex-1 ${nameError ? 'text-red-500' : ''}`} />
                {(nameError && !nameErrorMessage) && <span className="text-red-500 text-sm font-semibold shrink-0">* Required</span>}
              </div>
              {nameErrorMessage && <p className="text-red-500 text-xs pl-1">{nameErrorMessage}</p>}
            </div>
            <div className="flex items-center gap-2">
              <textarea placeholder="What does this shortcut do?" rows={1} value={shortcutDesc} onChange={(e) => handleDescChange(e.target.value)}
                className={`bg-transparent border-none p-0 focus:ring-0 text-muted-foreground font-body-md resize-none h-8 focus:outline-none flex-1 ${descError ? 'text-red-500' : ''}`} />
              {descError && <span className="text-red-500 text-sm font-semibold shrink-0">* Required</span>}
            </div>
          </div>
          <section className="card-themeable bg-gradient-to-br from-card-light to-card-medium border border-border rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-label-caps text-label-caps uppercase opacity-70 text-muted-foreground">Trigger Hotkey</h2>
              <div className="relative shrink-0">
                <span className="material-symbols-outlined text-[16px] text-muted-foreground/40 cursor-pointer hover:text-primary transition-colors"
                  onClick={(e) => { e.stopPropagation(); const t = e.currentTarget.nextElementSibling as HTMLElement; if (t) t.classList.toggle('hidden'); }}
                  title="How recording works">info</span>
                <div className="hidden absolute right-0 top-full mt-2 w-72 p-3 bg-card border border-border rounded-xl shadow-2xl text-[12px] z-50 leading-relaxed">
                  <p className="font-semibold text-foreground mb-1.5">How to set a trigger:</p>
                  <ol className="list-decimal pl-3 space-y-1 text-muted-foreground">
                    <li><strong className="text-foreground">Record:</strong> Click the button, press your keys.</li>
                    <li><strong className="text-foreground">Build:</strong> For OS combos, use the dropdowns below.</li>
                    <li><strong className="text-foreground">Must start with</strong> a modifier.</li>
                  </ol>
                </div>
              </div>
            </div>
            <button id="hotkey-btn" onClick={() => hotkeyRecording ? stopRecording() : startRecording()}
              className={`w-full border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer group ${
                hotkeyRecording ? 'border-red-400 bg-red-400/5' : hotkeyError ? 'border-red-400/50 bg-red-400/5' :
                recordedCombo && recordedCombo !== 'Win + Alt + D' ? 'border-primary bg-primary/5' : 'border-primary/50 bg-primary/5 hover:bg-primary/10'
              }`}>
              <span className="material-symbols-outlined text-3xl">{hotkeyRecording ? 'stop_circle' : 'keyboard'}</span>
              <span className={`font-title-sm ${hotkeyError ? 'text-red-500' : 'text-foreground'}`}>
                {hotkeyRecording ? (recordedCombo === 'Listening...' ? 'Recording keys...' : recordedCombo) : hotkey}
              </span>
              <span className="text-body-sm opacity-60 text-foreground">
                {hotkeyRecording ? 'Press combination now (click to stop)' : 'Click to record shortcut keys'}
              </span>
            </button>
            {hotkeyError && <p className="text-red-500 font-body-sm mt-2 text-center">{hotkeyError}</p>}
            <ComboBuilder
              value={recordedCombo}
              onChange={(combo) => { setRecordedCombo(combo); setHotkeyError(''); }}
            />

            {/* Test Hotkey — mandatory before Save. Verifies that the
                OS actually fires this combination on this system. */}
            <div className="mt-4 pt-4 border-t border-border flex items-center gap-3 flex-wrap">
              <button
                type="button"
                onClick={handleTestHotkey}
                disabled={testingHotkey || !hotkey || hotkey === 'Listening...'}
                className={`px-4 py-2 rounded-full font-title-sm text-body-sm flex items-center gap-2 transition-colors ${
                  testingHotkey || !hotkey || hotkey === 'Listening...'
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : hotkeyIsVerified
                    ? 'bg-primary/10 text-primary border border-primary/40 hover:bg-primary/15'
                    : 'bg-primary text-primary-foreground hover:opacity-90'
                }`}
              >
                <span className={`material-symbols-outlined text-[18px] ${testingHotkey ? 'animate-pulse' : ''}`}>
                  {testingHotkey ? 'radio_button_checked' : hotkeyIsVerified ? 'check_circle' : 'bolt'}
                </span>
                {testingHotkey ? 'Listening...' : hotkeyIsVerified ? 'Verified' : 'Test Hotkey'}
              </button>

              {testingHotkey && (
                <span className="text-body-sm text-primary flex items-center gap-1">
                  Press <span className="font-code-sm font-semibold">{hotkey}</span> now…
                </span>
              )}

              {!testingHotkey && hotkeyIsVerified && (
                <span className="text-body-sm text-green-500 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px]">check_circle</span>
                  Works
                </span>
              )}

              {!testingHotkey && testHotkeyError && (
                <span className="text-body-sm text-amber-500 flex items-start gap-1">
                  <span className="material-symbols-outlined text-[16px] shrink-0">warning</span>
                  <span className="whitespace-pre-line leading-tight">
                    {testHotkeyError.split('\n')[0]}
                    {testHotkeyError.includes('\n') && (
                      <span className="block text-[11px] opacity-70 mt-0.5">
                        {testHotkeyError.split('\n').slice(1).join(' ')}
                      </span>
                    )}
                  </span>
                </span>
              )}
            </div>
          </section>
          <WindowLayoutPanel
            value={windowLayout}
            onChange={setWindowLayout}
            sequence={sequence}
            onTestLayout={handleTestLayout}
            onCancelTestLayout={handleCancelTestLayout}
            testRunning={testLayoutRunning}
          />
          <ActionSequence
            sequence={sequence}
            onDelete={deleteAction}
            onUpdateValue={updateValue}
            onMoveUp={moveUp}
            onMoveDown={moveDown}
            onReorder={reorder}
            onDropFromSidebar={handleDropFromSidebar}
            onDropAtEnd={handleDropAtEnd}
            windowLayout={windowLayout}
            onWindowLayoutChange={setWindowLayout}
            showDangerWarnings={showDangerWarnings}
            onUpdateSafetyOverride={updateSafetyOverride}
          />
          <footer className="mt-12 py-6 border-t border-border flex items-center justify-between gap-4 w-full">
            <button onClick={handleDiscard} className="px-6 py-2 border border-border rounded-full font-title-sm hover:bg-muted transition-colors flex items-center gap-2 text-muted-foreground">
              <span className="material-symbols-outlined text-[20px]">close</span> Discard
            </button>
            <div className="flex items-center gap-4">
              {testFlowRunning ? (
                <button
                  onClick={handleCancelTestFlow}
                  className="px-6 py-2 bg-red-500 text-white rounded-full font-title-sm transition-colors flex items-center gap-2 hover:bg-red-600"
                >
                  <span className="material-symbols-outlined text-[20px]">stop_circle</span>
                  Cancel Test
                </button>
              ) : (
                <button
                  onClick={handleTestFlow}
                  disabled={sequence.length === 0}
                  title={
                    sequence.length === 0
                      ? 'Add at least one action to test'
                      : "Runs the shortcut exactly like Library's Run button — all actions, all delays, all side effects."
                  }
                  className={`px-6 py-2 border border-border rounded-full font-title-sm transition-colors flex items-center gap-2 ${
                    sequence.length === 0
                      ? 'text-muted-foreground opacity-50 cursor-not-allowed'
                      : 'text-foreground hover:bg-muted'
                  }`}
                >
                  <span className="material-symbols-outlined text-[20px]">play_arrow</span>
                  Test Flow
                </button>
              )}
              <button onClick={handleSave} disabled={!isFormValid}
                className={`px-8 py-2.5 rounded-full font-title-sm shadow-md transition-all flex items-center gap-2 ${isFormValid ? 'bg-primary text-primary-foreground hover:opacity-90' : 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed grayscale'}`}>
                <span className="material-symbols-outlined text-[20px]">save</span> {editData ? 'Update Shortcut' : 'Save Shortcut'}
              </button>
            </div>
          </footer>
          {!actionsValid && (
            <p className="text-red-500 font-body-sm text-right mt-2">
              {hasUnsupported
                ? 'Remove unsupported actions before saving.'
                : `Fix ${invalidActionCount} invalid action${invalidActionCount === 1 ? '' : 's'} before saving.`}
            </p>
          )}
          {actionsValid && !hotkeyIsVerified && shortcutName.trim() !== '' && (
            <p className="text-red-500 font-body-sm text-right mt-2">
              Test the hotkey before saving.
            </p>
          )}
        </div>
      </div>
    </main>
  );
};