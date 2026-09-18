import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CatalogItem, actionCatalog, categoryOrder } from '../types/actions';

interface CollapsedSearchPopoverProps {
  open: boolean;
  onClose: () => void;
  onSelectAction: (item: CatalogItem) => void;
}

export const CollapsedSearchPopover: React.FC<CollapsedSearchPopoverProps> = ({
  open,
  onClose,
  onSelectAction,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input when popover opens, and reset query when it closes
  useEffect(() => {
    if (open) {
      setSearchQuery('');
      // Focus after render
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape, add first result on Enter
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Enter') {
        const q = searchQuery.toLowerCase();
        const firstResult = actionCatalog.find((item) => {
          if (item.disabled) return false;
          if (searchQuery === '') return true;
          return (
            item.title.toLowerCase().includes(q) ||
            item.category.toLowerCase().includes(q)
          );
        });
        if (firstResult) {
          onSelectAction(firstResult);
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onClose, searchQuery, onSelectAction]);

  if (!open) return null;

  // Filter by name OR category
  const filtered = actionCatalog.filter((item) => {
    if (searchQuery === '') return true;
    const q = searchQuery.toLowerCase();
    return (
      item.title.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    );
  });

  // Group filtered items by category for cleaner display
  const grouped = categoryOrder
    .map((cat) => ({
      category: cat,
      items: filtered.filter((item) => item.category === cat),
    }))
    .filter((group) => group.items.length > 0);

  const handleSelect = (item: CatalogItem) => {
    if (item.disabled) return;
    onSelectAction(item);
    onClose();
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-24"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/60 backdrop-blur-sm" />

      {/* Popover */}
      <div
        className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="relative border-b border-border">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-[20px]">
            search
          </span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search actions by name or category..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-transparent border-none pl-12 pr-12 py-4 font-body-md text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Clear"
            >
              <span className="material-symbols-outlined text-[18px]">close</span>
            </button>
          )}
        </div>

        {/* Results list */}
        <div className="max-h-[60vh] overflow-y-auto">
          {grouped.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground font-body-sm">
              No actions match "{searchQuery}"
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.category} className="py-2">
                <div className="px-4 py-1.5 font-label-caps text-label-caps uppercase opacity-60 text-muted-foreground">
                  {group.category}
                </div>
                {group.items.map((item) => (
                  <button
                    key={item.type}
                    onClick={() => handleSelect(item)}
                    disabled={item.disabled}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                      item.disabled
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-muted/60 cursor-pointer'
                    }`}
                  >
                    <div className={`${item.colorClass} p-2 rounded-md flex shrink-0`}>
                      <span className="material-symbols-outlined text-[20px]">{item.icon}</span>
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="font-body-sm font-semibold text-foreground truncate">
                        {item.title}
                      </span>
                      <span className="font-label-caps text-[10px] uppercase opacity-60 text-muted-foreground truncate">
                        {item.category}
                        {item.disabled && item.disabledLabel && ` • ${item.disabledLabel}`}
                      </span>
                    </div>
                    <span className="material-symbols-outlined text-muted-foreground/40 text-[18px]">
                      add
                    </span>
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Footer hint */}
        <div className="px-4 py-2.5 border-t border-border bg-card/50 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Esc</kbd>
              to close
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Enter</kbd>
              to add first result
            </span>
          </div>
          <span className="opacity-60">{filtered.length} action{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>
    </div>,
    document.body
  );
};