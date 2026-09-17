import React, { useState, useEffect, useCallback } from 'react';
import { STORAGE_KEY_BLOCKED_TRIGGERS, STORAGE_KEY_SHORTCUTS, DEFAULT_BLOCKED_TRIGGERS, SavedShortcut } from '../types/actions';
import { BlockedTriggerList } from './BlockedTriggerList';
import { ComboBuilder } from './ComboBuilder';
import { OSCriticalWarningModal } from './OSCriticalWarningModal';
import { useHotkeyRecorder } from '../hooks/useHotkeyRecorder';

type Shade = 'light' | 'medium' | 'dark';

const OS_CRITICAL_TRIGGERS = [
  'Ctrl + C', 'Ctrl + V', 'Ctrl + X', 'Ctrl + Z', 'Ctrl + Y',
  'Alt + Tab', 'Win + D', 'Win + E', 'Win + R', 'Win + L',
  'Ctrl + Alt + Del', 'Ctrl + Shift + Esc', 'Alt + F4',
  'Win + Tab', 'Win + I', 'Win + S', 'Win + X',
];

interface SettingsBlockedTriggersProps {
  customColorMode: boolean;
}

export const SettingsBlockedTriggers: React.FC<SettingsBlockedTriggersProps> = ({ customColorMode }) => {
  const [blocked, setBlocked] = useState<string[]>([]);
  const [osCritical, setOsCritical] = useState<string[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [shade, setShade] = useState<Shade>('light');
  const [menuOpen, setMenuOpen] = useState(false);
  const [error, setError] = useState('');
  const [markAsCritical, setMarkAsCritical] = useState(false);
  const [warningTrigger, setWarningTrigger] = useState<string | null>(null);

  const { recording, recordedCombo, startRecording, stopRecording, clearCombo, setRecordedCombo } = useHotkeyRecorder();

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY_BLOCKED_TRIGGERS);
    const storedCritical = localStorage.getItem('lazycow-os-critical-triggers');
    
    if (stored) {
      try { setBlocked(JSON.parse(stored)); } catch { setBlocked(DEFAULT_BLOCKED_TRIGGERS); }
    } else {
      setBlocked(DEFAULT_BLOCKED_TRIGGERS);
      localStorage.setItem(STORAGE_KEY_BLOCKED_TRIGGERS, JSON.stringify(DEFAULT_BLOCKED_TRIGGERS));
    }

    if (storedCritical) {
      try { setOsCritical(JSON.parse(storedCritical)); } catch { setOsCritical([...OS_CRITICAL_TRIGGERS]); }
    } else {
      setOsCritical([...OS_CRITICAL_TRIGGERS]);
      localStorage.setItem('lazycow-os-critical-triggers', JSON.stringify(OS_CRITICAL_TRIGGERS));
    }
  }, []);

  const saveBlocked = (list: string[]) => {
    setBlocked(list);
    localStorage.setItem(STORAGE_KEY_BLOCKED_TRIGGERS, JSON.stringify(list));
  };

  const saveOsCritical = (list: string[]) => {
    setOsCritical(list);
    localStorage.setItem('lazycow-os-critical-triggers', JSON.stringify(list));
  };

  const handleAdd = useCallback(() => {
    const combo = recordedCombo.trim();
    if (!combo || combo === 'Listening...') return;
    setError('');

    if (blocked.some((t) => t.toLowerCase() === combo.toLowerCase())) {
      setError('Already in the blocked list.');
      return;
    }

    const shortcuts: SavedShortcut[] = JSON.parse(localStorage.getItem(STORAGE_KEY_SHORTCUTS) || '[]');
    const conflict = shortcuts.find((s) => s.hotkey.toLowerCase() === combo.toLowerCase());
    if (conflict) {
      setError(`Cannot block — assigned to "${conflict.name}".`);
      return;
    }

    const newBlocked = [...blocked, combo];
    saveBlocked(newBlocked);

    if (markAsCritical) {
      saveOsCritical([...osCritical, combo]);
    }

    clearCombo();
    setMarkAsCritical(false);
  }, [recordedCombo, blocked, osCritical, markAsCritical, clearCombo]);

  const handleRemoveRequest = (trigger: string) => {
    const isCritical = osCritical.includes(trigger);
    if (isCritical) {
      setWarningTrigger(trigger);
      return;
    }
    saveBlocked(blocked.filter((t) => t !== trigger));
    setError('');
  };

  const handleConfirmDelete = () => {
    if (warningTrigger) {
      saveBlocked(blocked.filter((t) => t !== warningTrigger));
      if (osCritical.includes(warningTrigger)) {
        saveOsCritical(osCritical.filter((t) => t !== warningTrigger));
      }
      setWarningTrigger(null);
      setError('');
    }
  };

  const handleCancelDelete = () => {
    setWarningTrigger(null);
  };

  const hasCombo = recordedCombo && recordedCombo !== 'Listening...' && !recording;

  const shadeClasses: Record<Shade, string> = {
    light: 'from-card-light to-card-medium text-card-light-fg',
    medium: 'from-card-medium to-card-dark text-card-medium-fg',
    dark: 'from-card-dark to-primary text-card-dark-fg',
  };

  return (
    <div className="shade-container collapsible-container mt-6">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setExpanded((p) => !p)} className="flex items-center gap-2 group">
          <h2 className="font-title-sm text-title-sm text-foreground">Blocked Triggers</h2>
          <span className="text-body-sm text-muted-foreground">({blocked.length})</span>
          <span className={`material-symbols-outlined text-muted-foreground transition-transform duration-200 text-[18px] collapse-icon ${expanded ? 'rotate-180' : ''}`}>
            expand_more
          </span>
        </button>

        {/* Shade picker — only in custom color mode */}
        {customColorMode && (
          <div className="flex items-center gap-2 relative">
            <div className={`shade-menu flex items-center gap-1 bg-card border border-border rounded-full px-2 py-1 shadow-sm transition-all duration-200 ${
              menuOpen ? 'opacity-100 translate-x-0 visible' : 'opacity-0 translate-x-2.5 invisible absolute right-8'
            }`}>
              {(['light', 'medium', 'dark'] as const).map((s, i) => (
                <React.Fragment key={s}>
                  {i > 0 && <div className="w-px h-3 bg-border" />}
                  <button className={`shade-btn text-xs px-1 transition-colors ${shade === s ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-primary'}`}
                    onClick={() => { setShade(s); setMenuOpen(false); }}>{s.charAt(0).toUpperCase() + s.slice(1)}</button>
                </React.Fragment>
              ))}
            </div>
            <button className={`p-1 rounded-full transition-colors ${menuOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              onClick={() => setMenuOpen((p) => !p)}><span className="material-symbols-outlined text-[18px]">tune</span></button>
          </div>
        )}
      </div>

      <div className={`card-themeable bg-gradient-to-br ${customColorMode ? shadeClasses[shade] : shadeClasses['light']} border border-border rounded-xl shadow-sm overflow-hidden transition-all duration-300 ${expanded ? '' : 'hidden'}`}>
        <BlockedTriggerList
          triggers={blocked}
          osCritical={osCritical}
          onRemove={handleRemoveRequest}
        />
        {error && (
          <div className="px-4 py-2.5 bg-red-500/10 border-t border-red-500/30 text-red-500 font-body-sm">{error}</div>
        )}
        <div className="p-4 bg-black/5 border-t border-border/50 flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex flex-col sm:flex-row gap-3 items-center">
              <button onClick={() => recording ? stopRecording() : startRecording()}
                className={`flex-1 border-2 border-dashed rounded-lg py-2.5 px-4 text-center transition-all font-body-sm flex items-center justify-center gap-2 w-full ${
                  recording ? 'border-red-400 bg-red-400/5 text-red-400' : recordedCombo ? 'border-primary/50 bg-primary/5 text-foreground' : 'border-border text-current/50 hover:border-primary/50 hover:text-foreground'
                }`}>
                <span className="material-symbols-outlined text-[18px]">{recording ? 'stop_circle' : 'keyboard'}</span>
                {recording ? (recordedCombo || 'Listening...') : recordedCombo || 'Click to record hotkey...'}
                {recording && <span className="text-[10px] uppercase opacity-70 ml-1">(click to stop)</span>}
              </button>
              {hasCombo && <button onClick={clearCombo} className="p-2 text-current/50 hover:text-red-500 transition-colors rounded-full hover:bg-red-500/10 shrink-0"><span className="material-symbols-outlined text-[20px]">close</span></button>}
              <button onClick={handleAdd} disabled={!hasCombo} className={`px-6 py-2 rounded-lg font-label-caps text-label-caps transition-all shrink-0 ${hasCombo ? 'bg-primary text-primary-foreground hover:opacity-90' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}>Add</button>
            </div>
          </div>

          {hasCombo && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={markAsCritical} onChange={(e) => setMarkAsCritical(e.target.checked)}
                className="w-4 h-4 rounded border-border accent-yellow-500" />
              <span className="text-[11px] text-current/60 font-label-caps uppercase">
                Mark as system-critical <span className="text-current/40">(warning on delete)</span>
              </span>
            </label>
          )}

          <ComboBuilder onApply={(combo) => setRecordedCombo(combo)} onError={setError} />
        </div>
      </div>

      {/* Danger Modal */}
      {warningTrigger && (
        <OSCriticalWarningModal
          trigger={warningTrigger}
          onConfirm={handleConfirmDelete}
          onCancel={handleCancelDelete}
        />
      )}
    </div>
  );
};