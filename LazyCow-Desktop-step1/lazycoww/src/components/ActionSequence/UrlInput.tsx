import React from 'react';
import { ActionItem } from '../../types/actions';

interface UrlInputProps {
  card: ActionItem;
  hasError: boolean;
  onUpdateValue: (id: string, value: string) => void;
}

/** Strips orphan scheme fragments, then prefixes http:// for local ranges, https:// otherwise. */
function normalizeUrl(raw: string): string {
  let v = raw.trim();
  if (!v) return v;
  // Strip leading ":" or "/" fragments left over from editing
  v = v.replace(/^[:/]+/, '');
  if (!v) return v;
  // Already has a scheme — leave it alone
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return v;
  // Private / loopback → http://
  const isLocal =
    /^localhost(\.|:|\/|$)/i.test(v) ||
    /^127\./i.test(v) ||
    /^10\./i.test(v) ||
    /^169\.254\./i.test(v) ||
    /^192\.168\./i.test(v) ||
    /^172\.(1[6-9]|2\d|3[01])\./i.test(v);
  return isLocal ? `http://${v}` : `https://${v}`;
}

export const UrlInput: React.FC<UrlInputProps> = ({ card, hasError, onUpdateValue }) => {
  const showTest = !hasError && card.value.trim() !== '';

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={card.value}
        onChange={(e) => onUpdateValue(card.id, e.target.value)}
        onBlur={() => {
          const next = normalizeUrl(card.value);
          if (next !== card.value) onUpdateValue(card.id, next);
        }}
        className={`flex-1 bg-background/50 border text-foreground rounded-md px-3 py-2 font-body-sm focus:outline-none shadow-inner ${
          hasError ? 'border-red-500/50 focus:ring-red-500' : 'border-border/50 focus:ring-primary'
        }`}
      />
      {showTest && (
        <button
          type="button"
          onClick={() => window.electronAPI?.testUrl(card.value)}
          className="px-3 py-2 bg-card hover:bg-card-light border border-border text-foreground rounded-md font-body-sm flex items-center gap-1.5 transition-colors shrink-0 cursor-pointer shadow-sm hover:border-primary/50"
          title="Open this URL in your default browser to test it"
        >
          <span className="material-symbols-outlined text-[18px]">open_in_new</span>
          <span>Test</span>
        </button>
      )}
    </div>
  );
};