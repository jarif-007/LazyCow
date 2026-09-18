import React, { useState } from 'react';
import { SavedShortcut } from '../types/actions';

interface ShortcutCardProps {
  shortcut: SavedShortcut;
  shade: 'light' | 'medium' | 'dark';
  onShadeChange: (shade: 'light' | 'medium' | 'dark') => void;
  onEditFlow: (s: SavedShortcut) => void;
  onRename: (id: string) => void;
  onDelete: (id: string) => void;
  onRun: (id: string) => void;
  onDuplicate: (s: SavedShortcut) => void;
  hasHotkeyConflict?: boolean;
  execution?: { status: 'idle' | 'running' | 'success' | 'error'; currentStepIndex: number; errors?: string[]; durationMs?: number };
  customColorMode: boolean;
}

export const ShortcutCard: React.FC<ShortcutCardProps> = ({
  shortcut, shade, onShadeChange, onEditFlow, onRename, onDelete, onRun, onDuplicate, hasHotkeyConflict, execution, customColorMode,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const execState = execution || { status: 'idle' as const, currentStepIndex: -1, errors: [] as string[] };
  const stepLabels = shortcut.actions.map((a) => `> ${a.title}: ${a.value}`);

  const shadeClasses = {
    light: 'from-card-light to-card-medium text-card-light-fg',
    medium: 'from-card-medium to-card-dark text-card-medium-fg',
    dark: 'from-card-dark to-primary text-card-dark-fg',
  }[shade];

  return (
    <div className={`card-themeable bg-gradient-to-br ${shadeClasses} border border-border rounded-xl p-5 group shadow-sm hover:shadow-md hover:-translate-y-1 transition-all flex flex-col gap-4 relative`}>
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-title-sm">{shortcut.name}</h3>
          <p className="text-body-md text-current/70 mt-1">{shortcut.description}</p>
        </div>

        <div className="flex items-center gap-1 relative">
          {/* Shade dots — only in custom color mode */}
          {customColorMode && (
            <div className={`flex items-center gap-1 bg-background/80 backdrop-blur-md rounded-full px-2 py-1 border border-border transition-all duration-200 absolute right-8 ${menuOpen ? 'opacity-100 visible translate-x-0' : 'opacity-0 invisible translate-x-[10px]'}`}>
              {(['light', 'medium', 'dark'] as const).map((s) => (
                <button key={s}
                  className={`w-4 h-4 rounded-full border border-border hover:scale-110 transition-transform ${s === 'light' ? 'bg-card-light' : s === 'medium' ? 'bg-card-medium' : 'bg-card-dark'}`}
                  onClick={() => onShadeChange(s)}
                  title={`${s.charAt(0).toUpperCase() + s.slice(1)} Shade`}
                />
              ))}
            </div>
          )}
          <button
            className={`p-1 rounded-full transition-colors ${menuOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
            onClick={() => setMenuOpen((p) => !p)}
          >
            <span className="material-symbols-outlined">more_vert</span>
          </button>

          {/* Dropdown */}
          {menuOpen && (
            <div className="absolute right-0 top-10 bg-card border border-border rounded-xl shadow-xl z-30 py-1 min-w-[160px]">
              <button onClick={() => { setMenuOpen(false); onEditFlow(shortcut); }} className="w-full text-left px-4 py-2.5 text-body-sm text-foreground hover:bg-muted/50 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">edit</span> Edit Flow
              </button>
              <button onClick={() => { setMenuOpen(false); onDuplicate(shortcut); }} className="w-full text-left px-4 py-2.5 text-body-sm text-foreground hover:bg-muted/50 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">content_copy</span> Duplicate
              </button>
              <button onClick={() => { setMenuOpen(false); onRename(shortcut.id); }} className="w-full text-left px-4 py-2.5 text-body-sm text-foreground hover:bg-muted/50 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">drive_file_rename_outline</span> Rename
              </button>
              <hr className="border-border my-1" />
              <button onClick={() => { setMenuOpen(false); onDelete(shortcut.id); }} className="w-full text-left px-4 py-2.5 text-body-sm text-red-500 hover:bg-red-500/10 flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">delete</span> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Action Icons */}
      <div className="flex items-center gap-2">
        {shortcut.actions.slice(0, 4).map((act, idx) => (
          <div key={idx} className="bg-background/50 border border-border/50 rounded-lg p-2.5 backdrop-blur-sm" title={act.title}>
            <span className="material-symbols-outlined text-[20px]">{act.icon}</span>
          </div>
        ))}
        {shortcut.actions.length > 4 && (
          <span className="text-body-sm text-muted-foreground">+{shortcut.actions.length - 4}</span>
        )}
      </div>

      {/* Hotkey */}
      <div className="flex items-center gap-2">
        <span className="font-code-sm font-medium bg-background/50 border border-border/50 px-3 py-1.5 rounded-md shadow-sm">
          {shortcut.hotkey || 'No Hotkey'}
        </span>
        {hasHotkeyConflict && (
          <span className="inline-flex items-center gap-1 bg-amber-500/15 text-amber-500 border border-amber-500/30 text-[11px] font-medium px-2 py-0.5 rounded-md" title="Hotkey conflict: Failed to register global shortcut">
            <span className="material-symbols-outlined text-[13px]">warning</span> Conflict
          </span>
        )}
      </div>

      {/* Execution Log */}
      {(execState.status === 'running' || execState.status === 'success' || execState.status === 'error') && (
        <div className="w-full bg-card-dark text-card-dark-fg font-code-sm p-4 rounded-lg flex flex-col gap-1.5 shadow-inner transition-all duration-300 mt-auto">
          {stepLabels.map((step, idx) => {
            let cls = 'opacity-40';
            if (execState.status === 'running') {
              if (idx === execState.currentStepIndex) cls = 'opacity-100 font-bold';
              else if (idx < execState.currentStepIndex) cls = 'opacity-60';
            } else if (execState.status === 'success' || execState.status === 'error') cls = 'opacity-60';
            return <span key={idx} className={`transition-all duration-300 ${cls}`}>{step}</span>;
          })}
          {execState.status === 'success' && (
            <div className="mt-2 pt-2 border-t border-white/10 flex items-center justify-between text-green-400 font-semibold">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px]">check_circle</span>
                <span className="text-[12px] uppercase tracking-wider">Sequence Complete</span>
              </div>
              {execState.durationMs !== undefined && (
                <span className="text-[12px] font-normal opacity-80">
                  {(execState.durationMs / 1000).toFixed(1)}s
                </span>
              )}
            </div>
          )}
          {execState.status === 'error' && (
            <div className="mt-2 pt-2 border-t border-white/10 flex flex-col gap-1 text-red-400 font-semibold">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px]">error</span>
                  <span className="text-[12px] uppercase tracking-wider">One or more steps failed</span>
                </div>
                {execState.durationMs !== undefined && (
                  <span className="text-[12px] font-normal opacity-80">
                    {(execState.durationMs / 1000).toFixed(1)}s
                  </span>
                )}
              </div>
              {(execState.errors || []).map((err, i) => (
                <span key={i} className="text-[11px] font-normal opacity-80 normal-case">{err}</span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Run Button */}
      {execState.status !== 'running' && (
        <button onClick={() => onRun(shortcut.id)} className="w-full mt-auto bg-primary text-primary-foreground py-3 rounded-lg font-title-sm text-body-md opacity-90 group-hover:opacity-100 transition-opacity">
          {execState.status === 'success' ? 'Run Again' : 'Run Shortcut'}
        </button>
      )}
    </div>
  );
};