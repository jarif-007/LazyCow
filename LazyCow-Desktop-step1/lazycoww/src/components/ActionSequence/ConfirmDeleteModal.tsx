import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ActionItem } from '../../types/actions';

interface ConfirmDeleteModalProps {
  actions: ActionItem[];
  onConfirm: () => void;
  onCancel: () => void;
}

const HINTS_STORAGE_KEY = 'lazycow-hide-modal-hints';

/**
 * Confirmation dialog shown before removing multiple actions.
 * Rendered via createPortal so it escapes any parent transform.
 * A "don't show hints again" checkbox (Option A) hides the tiny Esc/Enter
 * keyboard badges on the buttons — persisted to localStorage and cleared
 * automatically by the Danger Zone factory reset (which calls localStorage.clear()).
 */
export const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({
  actions,
  onConfirm,
  onCancel,
}) => {
  const [hideHints, setHideHints] = useState<boolean>(() => {
    try {
      return localStorage.getItem(HINTS_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onCancel();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        onConfirm();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onCancel, onConfirm]);

  const handleConfirm = () => {
    if (hideHints) {
      try {
        localStorage.setItem(HINTS_STORAGE_KEY, 'true');
      } catch {
        /* ignore quota errors */
      }
    }
    onConfirm();
  };

  // Aggregate counts by human-readable title.
  const counts = actions.reduce<Record<string, number>>((acc, a) => {
    acc[a.title] = (acc[a.title] || 0) + 1;
    return acc;
  }, {});
  const summary = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  return createPortal(
    <div className="fixed inset-0 z-[250] flex items-center justify-center">
      <div className="absolute inset-0 bg-background/80" onClick={onCancel} />

      <div className="relative bg-card border border-border rounded-2xl p-6 shadow-2xl max-w-md w-full mx-4">
        <button
          onClick={onCancel}
          className="absolute top-3 right-3 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Close (Esc)"
          aria-label="Close"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>

        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-3 pr-8">
            <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-red-500 text-[22px]">delete</span>
            </div>
            <div>
              <h2 className="font-title-sm text-foreground">
                Remove {actions.length} action{actions.length !== 1 ? 's' : ''}?
              </h2>
              <p className="text-body-sm text-muted-foreground">
                This can't be undone.
              </p>
            </div>
          </div>

          <div className="bg-background/50 border border-border rounded-lg p-3 flex flex-col gap-1.5 max-h-52 overflow-y-auto">
            {summary.map(([label, count]) => (
              <div key={label} className="flex items-center justify-between text-body-sm">
                <span className="text-foreground">{label}</span>
                <span className="text-muted-foreground font-code-sm">× {count}</span>
              </div>
            ))}
          </div>

          <div className="flex gap-3">
            <button
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-border rounded-full font-body-sm hover:bg-muted transition-colors text-foreground flex items-center justify-center gap-2"
            >
              Cancel
              {!hideHints && (
                <kbd className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground select-none hidden md:inline">
                  Esc
                </kbd>
              )}
            </button>
            <button
              onClick={handleConfirm}
              className="flex-1 px-4 py-2 bg-red-500 text-white rounded-full font-body-sm hover:bg-red-600 transition-colors flex items-center justify-center gap-2"
            >
              Remove
              {!hideHints && (
                <kbd className="text-[10px] px-1.5 py-0.5 bg-black/20 rounded text-white/80 select-none hidden md:inline">
                  Enter
                </kbd>
              )}
            </button>
          </div>

          <label className="flex items-center gap-2 justify-center text-[11px] text-muted-foreground cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hideHints}
              onChange={(e) => setHideHints(e.target.checked)}
              className="w-3.5 h-3.5 rounded accent-primary cursor-pointer"
            />
            Don't show these hints again
          </label>
        </div>
      </div>
    </div>,
    document.body
  );
};