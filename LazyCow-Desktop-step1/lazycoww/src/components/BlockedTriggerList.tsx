import React, { useState } from 'react';

interface BlockedTriggerListProps {
  triggers: string[];
  osCritical: string[];
  onRemove: (trigger: string) => void;
}

export const BlockedTriggerList: React.FC<BlockedTriggerListProps> = ({ triggers, osCritical, onRemove }) => {
  const [searchQuery, setSearchQuery] = useState('');

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const hasModifier = e.ctrlKey || e.altKey || e.metaKey;
    if (!hasModifier) return;
    e.preventDefault(); e.stopPropagation();
    const parts: string[] = [];
    if (e.ctrlKey) parts.push('Ctrl');
    if (e.altKey) parts.push('Alt');
    if (e.shiftKey) parts.push('Shift');
    if (e.metaKey) parts.push('Win');
    if (!['Control','Alt','Shift','Meta','OS'].includes(e.key)) {
      parts.push(e.key.length === 1 ? e.key.toUpperCase() : e.key);
    }
    if (parts.length >= 2) setSearchQuery(parts.join(' + '));
  };

  const filtered = triggers.filter((t) => t.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <>
      <div className="p-4 border-b border-border/50 bg-black/5">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-current/50 text-[18px]">search</span>
          <input type="text" placeholder="Filter triggers... (Ctrl+V to search combos)" value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={handleSearchKeyDown}
            className="w-full bg-background/50 border border-border rounded-lg pl-10 pr-4 py-2 font-body-sm text-foreground placeholder:text-current/40 focus:outline-none focus:ring-1 focus:ring-primary" />
        </div>
      </div>
      <div className="divide-y divide-border/50 max-h-48 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="p-4 text-center text-current/60 font-body-sm">
            {searchQuery ? 'No matching triggers found.' : 'No blocked triggers defined.'}
          </div>
        ) : (
          filtered.map((trigger) => {
            const isCritical = osCritical.includes(trigger);
            return (
              <div key={trigger} className="p-3 px-4 flex items-center justify-between hover:bg-black/5 transition-colors">
                <div className="flex items-center gap-2">
                  <code className="font-code-sm bg-background/60 border border-border/50 px-3 py-1 rounded-md text-foreground shadow-sm">
                    {trigger}
                  </code>
                  {isCritical && (
                    <span className="text-[10px] font-label-caps text-yellow-600/70 bg-yellow-500/10 px-1.5 py-0.5 rounded" title="System-critical shortcut">
                      OS
                    </span>
                  )}
                </div>
                <button
                  onClick={() => onRemove(trigger)}
                  className="p-1 text-current/50 hover:text-red-500 hover:bg-red-500/10 transition-colors rounded-full"
                  title={isCritical ? 'System-critical — warning on delete' : 'Remove'}
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            );
          })
        )}
      </div>
    </>
  );
};