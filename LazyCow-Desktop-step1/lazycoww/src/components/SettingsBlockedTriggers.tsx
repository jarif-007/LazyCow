import React, { useState, useEffect, useCallback } from 'react';
import { STORAGE_KEY_BLOCKED_TRIGGERS, STORAGE_KEY_SHORTCUTS, DEFAULT_BLOCKED_TRIGGERS, SavedShortcut } from '../types/actions';
import { BlockedTriggerList } from './BlockedTriggerList';
import { ComboBuilder } from './ComboBuilder';
import { OSCriticalWarningModal } from './OSCriticalWarningModal';

import { useHotkeyRecorder } from '../hooks/useHotkeyRecorder';

type Shade = 'light' | 'medium' | 'dark';

const OS_CRITICAL_TRIGGERS = [
  // System-critical
  'Alt + F4', 'Ctrl + Alt + Delete', 'Ctrl + Shift + Esc',
  'Alt + Tab', 'Win + Tab',
  // Clipboard / undo-redo
  'Ctrl + C', 'Ctrl + V', 'Ctrl + X', 'Ctrl + Z', 'Ctrl + Y',
  // Win + letter — all reserved by Windows shell
  'Win + A', 'Win + B', 'Win + C', 'Win + D', 'Win + E', 'Win + F',
  'Win + G', 'Win + H', 'Win + I', 'Win + J', 'Win + K', 'Win + L',
  'Win + M', 'Win + N', 'Win + O', 'Win + P', 'Win + Q', 'Win + R',
  'Win + S', 'Win + T', 'Win + U', 'Win + V', 'Win + W', 'Win + X',
  'Win + Y', 'Win + Z',
  // Win + symbol
  'Win + .', 'Win + ;', 'Win + ,',
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
  // True when the currently-recorded combo matches an entry that's already
  // in the blocked list. In that case the checkbox is REPURPOSED: it shows
  // that entry's critical status and toggling it edits the existing entry.
  // When the combo is new, the checkbox reverts to "should the next Add be
  // critical?" — its original meaning.
  const [editingExisting, setEditingExisting] = useState(false);
  const [warningTrigger, setWarningTrigger] = useState<string | null>(null);


  const { recording, recordedCombo, startRecording, stopRecording, clearCombo, setRecordedCombo } = useHotkeyRecorder();

  useEffect(() => {
    // Legacy key names → canonical. Ran on every read so shortcuts saved
    // before the vocabulary was standardised (e.g. "Ctrl + Alt + Del")
    // display as "Ctrl + Alt + Delete" — the same string the recorder
    // produces. Idempotent: normalizing an already-normalized string is
    // a no-op.
    const LEGACY_KEY_ALIASES: Record<string, string> = {
      'Del': 'Delete',
      'Escape': 'Esc',
      'Enter': 'Return',
      'PgUp': 'PageUp',
      'PgDn': 'PageDown',
      'Ins': 'Insert',
      'PrtSc': 'PrintScreen',
      'PrtScn': 'PrintScreen',
      'PrintScr': 'PrintScreen',
      'Spacebar': 'Space',
    };
    const normalizeTrigger = (s: string): string => {
      return s
        .split(' + ')
        .map((part) => {
          const t = part.trim();
          if (!t) return t;
          if (LEGACY_KEY_ALIASES[t]) return LEGACY_KEY_ALIASES[t];
          const lower = t.toLowerCase();
          const found = Object.entries(LEGACY_KEY_ALIASES).find(([k]) => k.toLowerCase() === lower);
          if (found) return found[1];
          if (t.length === 1) return t.toUpperCase();
          return t;
        })
        .join(' + ');
    };

    const readFromStorage = () => {
      const stored = localStorage.getItem(STORAGE_KEY_BLOCKED_TRIGGERS);
      const storedCritical = localStorage.getItem('lazycow-os-critical-triggers');

      if (stored) {
        try {
          const raw: string[] = JSON.parse(stored);
          const normalized = raw.map(normalizeTrigger);
          setBlocked(normalized);
          // Persist the normalized form so we don't re-do this every read.
          if (JSON.stringify(raw) !== JSON.stringify(normalized)) {
            localStorage.setItem(STORAGE_KEY_BLOCKED_TRIGGERS, JSON.stringify(normalized));
          }
        } catch { setBlocked(DEFAULT_BLOCKED_TRIGGERS); }
      } else {
        setBlocked(DEFAULT_BLOCKED_TRIGGERS);
        localStorage.setItem(STORAGE_KEY_BLOCKED_TRIGGERS, JSON.stringify(DEFAULT_BLOCKED_TRIGGERS));
      }

      if (storedCritical) {
        try {
          const raw: string[] = JSON.parse(storedCritical);
          const normalized = raw.map(normalizeTrigger);
          setOsCritical(normalized);
          if (JSON.stringify(raw) !== JSON.stringify(normalized)) {
            localStorage.setItem('lazycow-os-critical-triggers', JSON.stringify(normalized));
          }
        } catch { setOsCritical([...OS_CRITICAL_TRIGGERS]); }
      } else {
        setOsCritical([...OS_CRITICAL_TRIGGERS]);
        localStorage.setItem('lazycow-os-critical-triggers', JSON.stringify(OS_CRITICAL_TRIGGERS));
      }
    };

    readFromStorage();

    // Re-read when Builder auto-adds a combo to the blocked list (Windows
    // refused it during Test Hotkey). Without this, the entry sits in
    // localStorage but the UI doesn't show it until the user navigates away
    // and back.
    const onChanged = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.key === 'blockedTriggers') readFromStorage();
    };
    window.addEventListener('lazycow-settings-changed', onChanged);
    return () => window.removeEventListener('lazycow-settings-changed', onChanged);
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
    // Stop any in-flight recording — otherwise the recorder keeps
    // swallowing keystrokes while the user is looking at a modal.
    if (recording) stopRecording();

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

  // A combo is "complete" only when it has a modifier AND a main key.
  // Modifier-only strings like "Ctrl" or "Ctrl + Alt" are valid during
  // picking but not saveable.
  // Keep markAsCritical in sync with the current combo:
  //  - combo matches an existing entry → checkbox mirrors that entry
  //  - combo is new → checkbox resets to false (user must re-tick)
  useEffect(() => {
    const combo = recordedCombo?.trim();
    if (!combo || combo === 'Listening...') {
      setEditingExisting(false);
      return;
    }
    const matches = blocked.some((t) => t.toLowerCase() === combo.toLowerCase());
    if (matches) {
      setEditingExisting(true);
      setMarkAsCritical(osCritical.some((t) => t.toLowerCase() === combo.toLowerCase()));
    } else {
      setEditingExisting(false);
      // Don't reset markAsCritical when the user is still picking — that
      // would clear their intention as they type. Only reset when they
      // finish a new combo. But since we can't easily detect "finished",
      // we reset whenever the combo becomes a NEW one that isn't already
      // in the list. Acceptable trade-off.
      setMarkAsCritical(false);
    }
  }, [recordedCombo, blocked, osCritical]);

  const hasCompleteCombo = (() => {
    if (!recordedCombo || recordedCombo === 'Listening...' || recording) return false;
    const parts = recordedCombo.split(' + ').filter(Boolean);
    const modCount = parts.filter((p) => ['Ctrl', 'Alt', 'Shift', 'Win'].includes(p)).length;
    const keyCount = parts.length - modCount;
    return modCount >= 1 && keyCount >= 1;
  })();
  // The combo must also NOT already exist in the block list — otherwise
  // the Add button would create a duplicate entry.
  const comboAlreadyBlocked = hasCompleteCombo
    && blocked.some((t) => t.toLowerCase() === recordedCombo.toLowerCase());
  const canAdd = hasCompleteCombo && !comboAlreadyBlocked;

  const shadeClasses: Record<Shade, string> = {
    light: 'from-card-light to-card-medium text-card-light-fg',
    medium: 'from-card-medium to-card-dark text-card-medium-fg',
    dark: 'from-card-dark to-primary text-card-dark-fg',
  };

  return (
    <div className="shade-container collapsible-container mt-6">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => {
          // Collapsing the panel hides the recorder UI but doesn't stop
          // the listener — so keystrokes keep getting swallowed. Stop it.
          if (expanded && recording) stopRecording();
          setExpanded((p) => !p);
        }} className="flex items-center gap-2 group">
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
        {/* When the user is building/recording a combo, show a small
            filter banner and highlight matching entries below. Lets the
            user quickly check whether a combo is already blocked without
            leaving the panel. */}
        {(() => {
          const query = recordedCombo && recordedCombo !== 'Listening...'
            ? recordedCombo.toLowerCase().split(' + ').filter(Boolean)
            : [];
          if (query.length === 0) return null;
          const matchCount = blocked.filter((t) => {
            const triggerParts = t.toLowerCase().split(' + ').map((p) => p.trim());
            return query.every((part) => triggerParts.includes(part));
          }).length;
          return (
            <div className="px-4 py-2 border-b border-border/50 bg-primary/5 flex items-center justify-between gap-3 text-[12px]">
              <span className="text-muted-foreground">
                Filtering by <span className="font-code-sm text-foreground">{recordedCombo}</span>
              </span>
              <span className={matchCount > 0 ? 'text-amber-500 font-medium' : 'text-muted-foreground'}>
                {matchCount > 0
                  ? `${matchCount} existing match${matchCount === 1 ? '' : 'es'}`
                  : 'No matches'}
              </span>
            </div>
          );
        })()}
        <BlockedTriggerList
          triggers={blocked}
          osCritical={osCritical}
          onRemove={handleRemoveRequest}
          onEdit={(trigger) => {
            // Load the trigger into the recorder area. The existing
            // checkbox below (which changes to "System-critical (toggles
            // this entry)" when the combo matches an existing entry) is
            // the OS-critical toggle. No separate modal — that was a
            // parallel UI for the same state and both drifted out of sync.
            if (recording) stopRecording();
            setRecordedCombo(trigger);
            setError('');
            // Scroll the collapsed panel to the recorder so the user sees
            // the loaded combo without hunting for it.
            setTimeout(() => {
              document.getElementById('blocked-recorder-section')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }, 50);
          }}
          filterQuery={recordedCombo && recordedCombo !== 'Listening...' ? recordedCombo : undefined}
        />
        {error && (
          <div className="px-4 py-2.5 bg-red-500/10 border-t border-red-500/30 text-red-500 font-body-sm">{error}</div>
        )}
        <div id="blocked-recorder-section" className="p-4 bg-black/5 border-t border-border/50 flex flex-col gap-4">
          {recording && (
            <div className="w-full rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 flex items-start gap-2">
              <span className="material-symbols-outlined text-amber-500 text-[18px] shrink-0 mt-0.5">warning</span>
              <div className="flex-1 min-w-0 text-[11px] leading-snug">
                <p className="text-amber-500 font-semibold">Recording — press modifiers + one main key.</p>
                <p className="text-amber-500/80 mt-0.5">
                  The <strong>Win key</strong> opens the Start menu; Windows handles it before we can. To include Win, use the <strong>Win chip</strong> in the manual builder below.
                </p>
              </div>
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="flex-1 flex flex-col sm:flex-row gap-3 items-center">
              <button onClick={() => {
                if (recording) { stopRecording(); return; }
                // Pass any modifiers already selected via the ComboBuilder
                // chips below, so the user can pick "Win" from the chips
                // and then just press the main key during recording.
                const existingMods = recordedCombo && recordedCombo !== 'Listening...'
                  ? recordedCombo.split(' + ').filter((p) => ['Ctrl', 'Alt', 'Shift', 'Win'].includes(p))
                  : [];
                startRecording(existingMods);
              }}
                className={`flex-1 border-2 border-dashed rounded-lg py-2.5 px-4 text-center transition-all font-body-sm flex items-center justify-center gap-2 w-full ${
                  recording ? 'border-red-400 bg-red-400/5 text-red-400' : recordedCombo ? 'border-primary/50 bg-primary/5 text-foreground' : 'border-border text-current/50 hover:border-primary/50 hover:text-foreground'
                }`}>
                <span className="material-symbols-outlined text-[18px]">{recording ? 'stop_circle' : 'keyboard'}</span>
                {recording ? (recordedCombo || 'Listening...') : recordedCombo || 'Click to record hotkey...'}
                {recording && <span className="text-[10px] uppercase opacity-70 ml-1">(click to stop)</span>}
              </button>
              {hasCompleteCombo && <button onClick={clearCombo} className="p-2 text-current/50 hover:text-red-500 transition-colors rounded-full hover:bg-red-500/10 shrink-0"><span className="material-symbols-outlined text-[20px]">close</span></button>}
              <button
                onClick={handleAdd}
                disabled={!canAdd}
                title={comboAlreadyBlocked ? 'Already in the blocked list' : undefined}
                className={`px-6 py-2 rounded-lg font-label-caps text-label-caps transition-all shrink-0 ${canAdd ? 'bg-primary text-primary-foreground hover:opacity-90' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
              >
                {comboAlreadyBlocked ? 'Already blocked' : 'Add/Search'}
              </button>
            </div>
          </div>

          {hasCompleteCombo && (
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={markAsCritical}
                onChange={(e) => {
                  const next = e.target.checked;
                  setMarkAsCritical(next);
                  // If the combo matches an existing entry, this checkbox
                  // edits THAT entry immediately. Otherwise it stays as the
                  // "default for next Add" flag.
                  if (editingExisting) {
                    const combo = recordedCombo.trim();
                    if (next) {
                      if (!osCritical.some((t) => t.toLowerCase() === combo.toLowerCase())) {
                        saveOsCritical([...osCritical, combo]);
                      }
                    } else {
                      saveOsCritical(osCritical.filter((t) => t.toLowerCase() !== combo.toLowerCase()));
                    }
                  }
                }}
                className="w-4 h-4 rounded border-border accent-yellow-500" />
              <span className="text-[11px] text-current/60 font-label-caps uppercase">
                {editingExisting
                  ? <>System-critical <span className="text-current/40">(toggles this entry)</span></>
                  : <>Mark as system-critical <span className="text-current/40">(warning on delete)</span></>}
              </span>
            </label>
          )}



          <ComboBuilder value={recordedCombo} onChange={setRecordedCombo} />
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