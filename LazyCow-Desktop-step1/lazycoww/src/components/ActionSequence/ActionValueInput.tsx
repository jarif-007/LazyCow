import React from 'react';
import { ActionItem } from '../../types/actions';
import { UrlInput } from './UrlInput';

interface ActionValueInputProps {
  card: ActionItem;
  hasError: boolean;
  onUpdateValue: (id: string, value: string) => void;
}

export const ActionValueInput: React.FC<ActionValueInputProps> = ({ card, hasError, onUpdateValue }) => {
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
      </div>
    );
  }

  // ── DND / Night Light dropdown ──
  if (card.type === 'toggle_dnd' || card.type === 'toggle_nightlight') {
    return (
      <select
        value={card.value}
        onChange={(e) => onUpdateValue(card.id, e.target.value)}
        className="w-full bg-background/50 border border-border/50 text-foreground rounded-md px-3 py-2 font-body-sm focus:ring-primary focus:outline-none"
      >
        <option value="toggle">Toggle State</option>
        <option value="enable">Always Turn On</option>
        <option value="disable">Always Turn Off</option>
      </select>
    );
  }

  // ── URL field ──
  if (card.type === 'open_url') {
    return <UrlInput card={card} hasError={hasError} onUpdateValue={onUpdateValue} />;
  }

  // ── Generic text input (launch_app, open_folder, open_file, run_script) ──
  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={card.value}
        onChange={(e) => onUpdateValue(card.id, e.target.value)}
        className={`flex-1 bg-background/50 border text-foreground rounded-md px-3 py-2 font-body-sm focus:outline-none shadow-inner ${
          hasError ? 'border-red-500/50 focus:ring-red-500' : 'border-border/50 focus:ring-primary'
        }`}
      />
      {['launch_app', 'open_folder', 'open_file'].includes(card.type) && (
        <button
          type="button"
          onClick={async () => {
            const pickerType = card.type === 'launch_app' ? 'app' : card.type === 'open_file' ? 'file' : 'folder';
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
    </div>
  );
};