import React, { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { ActionItem } from '../../types/actions';
import { UrlInput } from './UrlInput';
import { AppDrawerModal } from '../AppDrawerModal';

interface ActionValueInputProps {
  card: ActionItem;
  hasError: boolean;
  onUpdateValue: (id: string, value: string) => void;
}

export const ActionValueInput: React.FC<ActionValueInputProps> = ({ card, hasError, onUpdateValue }) => {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; error?: string } | null>(null);

  // ── Delay slider ──
  if (card.type === 'delay') {
    return (
      <div className="flex items-center gap-4">
        <input
          type="range"
          min="250"
          max="10000"
          step="250"
          value={card.value}
          onChange={(e) => onUpdateValue(card.id, e.target.value)}
          className="flex-1 accent-primary"
        />
        <span className="font-body-sm font-semibold w-16 text-right text-foreground font-code-sm">
          {(Number(card.value) / 1000).toFixed(1)}s
        </span>
      </div>
    );
  }

  // ── Volume / Brightness slider ──
  if (card.type === 'set_volume' || card.type === 'set_brightness') {
    return (
      <div className="flex items-center gap-4">
        <input
          type="range"
          min="0"
          max="100"
          value={card.value}
          onChange={(e) => onUpdateValue(card.id, e.target.value)}
          className="flex-1 accent-primary"
        />
        <span className="font-body-sm font-semibold w-8 text-right text-foreground">
          {card.value}%
        </span>
        <TestButton type={card.type} value={card.value} />
      </div>
    );
  }

  // ── DND / Night Light dropdown ──
  if (card.type === 'toggle_dnd' || card.type === 'toggle_nightlight') {
    return (
      <div className="flex items-center gap-2">
        <select
          value={card.value}
          onChange={(e) => onUpdateValue(card.id, e.target.value)}
          className="flex-1 bg-background/50 border border-border/50 text-foreground rounded-md px-3 py-2 font-body-sm focus:ring-primary focus:outline-none"
        >
          <option value="enable">Turn On</option>
          <option value="disable">Turn Off</option>
        </select>
        <TestButton type={card.type} value={card.value} />
      </div>
    );
  }

  // ── URL field ──
  if (card.type === 'open_url') {
    return <UrlInput card={card} hasError={hasError} onUpdateValue={onUpdateValue} />;
  }

  // ── launch_app: text input + Select App + Test ──
  if (card.type === 'launch_app') {
    return (
      <>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={card.value}
            onChange={(e) => onUpdateValue(card.id, e.target.value)}
            placeholder={card.hint ? `Missing app: ${card.hint} (Select again)` : "Choose an app or paste a path"}
            className={`flex-1 bg-background/50 border text-foreground rounded-md px-3 py-2 font-body-sm focus:outline-none shadow-inner ${hasError ? 'border-red-500/50 focus:ring-red-500' : 'border-border/50 focus:ring-primary'
              }`}
          />
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="px-3 py-2 bg-card hover:bg-card-light border border-border text-foreground rounded-md font-body-sm flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer shadow-sm hover:border-primary/50"
            title="Choose from installed apps"
          >
            <span className="material-symbols-outlined text-[18px]">apps</span>
            <span>Select App</span>
          </button>
          <button
            type="button"
            onClick={async () => {
              if (!card.value.trim()) return;
              setTesting(true);
              setTestResult(null);
              try {
                const res = await window.electronAPI?.testLaunchApp(card.value.trim());
                setTestResult(res ?? { ok: false, error: 'No response' });
              } catch (err) {
                setTestResult({ ok: false, error: err instanceof Error ? err.message : String(err) });
              } finally {
                setTesting(false);
              }
            }}
            disabled={testing || !card.value.trim()}
            className={`px-3 py-2 border rounded-md font-body-sm flex items-center gap-1.5 transition-colors shrink-0 shadow-sm ${testing || !card.value.trim()
                ? 'bg-muted text-muted-foreground border-border cursor-not-allowed'
                : 'bg-card hover:bg-card-light border-border text-foreground hover:border-primary/50 cursor-pointer'
              }`}
            title="Launch this app once to verify it works"
          >
            <span className={`material-symbols-outlined text-[18px] ${testing ? 'animate-spin' : ''}`}>
              {testing ? 'progress_activity' : 'play_arrow'}
            </span>
            <span>{testing ? 'Launching…' : 'Test'}</span>
          </button>
        </div>

        {testResult && (
          <div className={`mt-2 flex items-start gap-1.5 text-[11px] leading-snug ${testResult.ok ? 'text-green-500' : 'text-amber-500'
            }`}>
            <span className="material-symbols-outlined text-[14px] shrink-0 mt-0.5">
              {testResult.ok ? 'check_circle' : 'warning'}
            </span>
            <span>
              {testResult.ok
                ? 'App launched successfully.'
                : `Could not launch: ${testResult.error || 'Unknown error'}`}
            </span>
          </div>
        )}

        <AnimatePresence>
          {drawerOpen && (
            <AppDrawerModal
              currentPath={card.value}
              onSelect={(path) => {
                onUpdateValue(card.id, path);
                setDrawerOpen(false);
              }}
              onCancel={() => setDrawerOpen(false)}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  // ── open_folder / open_file / run_script: text input + Browse button ──
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={card.value}
        onChange={(e) => onUpdateValue(card.id, e.target.value)}
        placeholder={card.hint ? `Missing file/folder: ${card.hint}` : undefined}
        className={`flex-1 bg-background/50 border text-foreground rounded-md px-3 py-2 font-body-sm focus:outline-none shadow-inner ${hasError ? 'border-red-500/50 focus:ring-red-500' : 'border-border/50 focus:ring-primary'
          }`}
      />
      {(card.type === 'open_folder' || card.type === 'open_file') && (
        <button
          type="button"
          onClick={async () => {
            const pickerType = card.type === 'open_file' ? 'file' : 'folder';
            const selected = await window.electronAPI?.selectPath(pickerType);
            if (selected) {
              onUpdateValue(card.id, selected);
            }
          }}
          className="px-3 py-2 bg-card hover:bg-card-light border border-border text-foreground rounded-md font-body-sm flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer shadow-sm hover:border-primary/50"
          title="Browse..."
        >
          <span className="material-symbols-outlined text-[18px]">folder_open</span>
          <span>Browse</span>
        </button>
      )}
      <TestButton type={card.type} value={card.value} />
    </div>
  );
};

// ──────────────────────────────────────────────
// Generic Test Button for non-path-based actions
// ──────────────────────────────────────────────
const TestButton: React.FC<{ type: string, value: string }> = ({ type, value }) => {
  const [testing, setTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState<{ ok: boolean; error?: string } | null>(null);

  const handleTest = async () => {
    if (!value.trim()) return;
    setTesting(true);
    setTestResult(null);
    try {
      const res = await window.electronAPI?.testAction({ type, value });
      setTestResult(res ?? { ok: false, error: 'No response' });
    } catch (err) {
      setTestResult({ ok: false, error: err instanceof Error ? err.message : String(err) });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex flex-col gap-2 shrink-0">
      <button
        type="button"
        onClick={handleTest}
        disabled={testing || !value.trim()}
        className={`px-3 py-2 border rounded-md font-body-sm flex items-center gap-1.5 transition-colors shadow-sm ${
          testing || !value.trim()
            ? 'bg-muted text-muted-foreground border-border cursor-not-allowed'
            : 'bg-card hover:bg-card-light border-border text-foreground hover:border-primary/50 cursor-pointer'
        }`}
        title="Test this action"
      >
        <span className={`material-symbols-outlined text-[18px] ${testing ? 'animate-spin' : ''}`}>
          {testing ? 'progress_activity' : 'play_arrow'}
        </span>
        <span>{testing ? 'Testing…' : 'Test'}</span>
      </button>
      {testResult && (
        <div className={`flex items-start gap-1.5 text-[11px] leading-snug ${testResult.ok ? 'text-green-500' : 'text-amber-500'}`}>
          <span className="material-symbols-outlined text-[14px] shrink-0 mt-0.5">
            {testResult.ok ? 'check_circle' : 'warning'}
          </span>
          <span>{testResult.ok ? 'Success.' : `Failed: ${testResult.error}`}</span>
        </div>
      )}
    </div>
  );
};