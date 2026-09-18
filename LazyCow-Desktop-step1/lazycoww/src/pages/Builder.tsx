import React, { useState, useCallback, useEffect } from 'react';
import { ActionItem, CatalogItem, actionCatalog, SavedShortcut } from '../types/actions';
import { ActionSidebar } from '../components/ActionSidebar';
import { ActionSequence } from '../components/ActionSequence';
import { ComboBuilder } from '../components/ComboBuilder';
import { useHotkeyRecorder } from '../hooks/useHotkeyRecorder';

interface BuilderProps {
  editData?: SavedShortcut | null;
  isActionSidebarAutoCollapsed?: boolean;
  onUnsavedChanges?: (hasChanges: boolean) => void;
  onSaveSuccess?: () => void;
}

const MODIFIERS = ['Ctrl', 'Alt', 'Shift', 'Win'];

export const Builder: React.FC<BuilderProps> = ({ editData, isActionSidebarAutoCollapsed, onUnsavedChanges, onSaveSuccess }) => {
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
  const [hotkeyError, setHotkeyError] = useState('');

  const { recording: hotkeyRecording, recordedCombo, startRecording, stopRecording, clearCombo, setRecordedCombo } = useHotkeyRecorder('Win + Alt + D');
  const hotkey = recordedCombo || 'Win + Alt + D';

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

  useEffect(() => {
    if (editData) {
      setShortcutName(editData.name);
      setShortcutDesc(editData.description);
      setSequence(editData.actions);
    }
  }, [editData]);

  const hasUnsavedChanges = shortcutName.trim() !== '' || shortcutDesc.trim() !== '' || sequence.length > 0;
  useEffect(() => { onUnsavedChanges?.(hasUnsavedChanges); }, [hasUnsavedChanges, onUnsavedChanges]);

  const addAction = useCallback((item: CatalogItem) => {
    if (item.disabled) return;
    setSequence((p) => [...p, { id: `act-${Date.now()}`, type: item.type, title: item.title, icon: item.icon, colorClass: item.colorClass, value: item.defaultValue }]);
  }, []);

  const addActionAt = useCallback((item: CatalogItem, index: number) => {
    if (item.disabled) return;
    setSequence((p) => { const n = [...p]; n.splice(index, 0, { id: `act-${Date.now()}`, type: item.type, title: item.title, icon: item.icon, colorClass: item.colorClass, value: item.defaultValue }); return n; });
  }, []);

  const deleteAction = useCallback((id: string) => setSequence((p) => p.filter((a) => a.id !== id)), []);
  const updateValue = useCallback((id: string, value: string) => setSequence((p) => p.map((a) => a.id === id ? { ...a, value } : a)), []);
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

  const isFormValid = shortcutName.trim() !== '' && shortcutDesc.trim() !== '' && !hotkeyError && !nameError;

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

    const shortcut: SavedShortcut = {
      id: editData?.id || `sc-${Date.now()}`,
      name: shortcutName, description: shortcutDesc, hotkey, actions: sequence,
      createdAt: editData?.createdAt || new Date().toISOString(),
    };

    if (editData) {
      const index = existing.findIndex((s) => s.id === editData.id);
      if (index !== -1) existing[index] = shortcut;
    } else { existing.push(shortcut); }

    localStorage.setItem('lazycow-shortcuts', JSON.stringify(existing));
    setShortcutName(''); setShortcutDesc(''); setSequence([]); clearCombo();
    setNameError(false); setDescError(false); setHotkeyError(''); setNameErrorMessage('');
    onSaveSuccess?.();
  };

  const handleDiscard = () => {
    setShortcutName('');
    setShortcutDesc('');
    setSequence([]);
    clearCombo();
    setNameError(false);
    setDescError(false);
    setHotkeyError('');
    setNameErrorMessage('');
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
            <ComboBuilder onApply={(combo) => { setRecordedCombo(combo); setHotkeyError(''); }} onError={setHotkeyError} />
          </section>
          <ActionSequence sequence={sequence} onDelete={deleteAction} onUpdateValue={updateValue} onMoveUp={moveUp} onMoveDown={moveDown} onReorder={reorder} onDropFromSidebar={handleDropFromSidebar} onDropAtEnd={handleDropAtEnd} />
          <footer className="mt-12 py-6 border-t border-border flex items-center justify-between gap-4 w-full">
            <button onClick={handleDiscard} className="px-6 py-2 border border-border rounded-full font-title-sm hover:bg-muted transition-colors flex items-center gap-2 text-muted-foreground">
              <span className="material-symbols-outlined text-[20px]">close</span> Discard
            </button>
            <div className="flex items-center gap-4">
              <button className="px-6 py-2 border border-border rounded-full font-title-sm hover:bg-muted transition-colors flex items-center gap-2 text-foreground">
                <span className="material-symbols-outlined text-[20px]">play_arrow</span> Test Flow
              </button>
              <button onClick={handleSave} disabled={!isFormValid}
                className={`px-8 py-2.5 rounded-full font-title-sm shadow-md transition-all flex items-center gap-2 ${isFormValid ? 'bg-primary text-primary-foreground hover:opacity-90' : 'bg-muted text-muted-foreground opacity-50 cursor-not-allowed grayscale'}`}>
                <span className="material-symbols-outlined text-[20px]">save</span> {editData ? 'Update Shortcut' : 'Save Shortcut'}
              </button>
            </div>
          </footer>
        </div>
      </div>
    </main>
  );
};