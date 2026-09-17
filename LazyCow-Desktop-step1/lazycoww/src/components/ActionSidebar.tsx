import React, { useState, useRef } from 'react';
import { CatalogItem, actionCatalog, categoryOrder } from '../types/actions';

interface ActionSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  onAddAction: (item: CatalogItem) => void;
  onDragStart: (e: React.DragEvent, item: CatalogItem) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export const ActionSidebar: React.FC<ActionSidebarProps> = ({
  collapsed,
  onToggle,
  onAddAction,
  onDragStart,
  searchQuery,
  onSearchChange,
}) => {
  const [collapsedSearchOpen, setCollapsedSearchOpen] = useState(false);
  const collapsedSearchRef = useRef<HTMLInputElement>(null);

  const filteredCatalog = actionCatalog.filter((item) => {
    if (searchQuery === '') return true;
    const q = searchQuery.toLowerCase();
    return item.title.toLowerCase().includes(q) || item.category.toLowerCase().includes(q);
  });

  const handleCollapsedSearchToggle = () => {
    setCollapsedSearchOpen((prev) => {
      if (!prev) setTimeout(() => collapsedSearchRef.current?.focus(), 100);
      else onSearchChange('');
      return !prev;
    });
  };

  return (
    <aside
      className={`transition-all duration-300 ease-in-out flex flex-col gap-3 bg-card/60 border border-border rounded-xl shadow-sm backdrop-blur-sm overflow-hidden shrink-0 ${
        collapsed ? 'w-[64px] p-2' : 'w-full lg:w-72 p-4'
      }`}
    >
      {/* Toggle */}
      <button
        onClick={onToggle}
        className="self-end p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors shrink-0"
        title={collapsed ? 'Expand' : 'Collapse'}
      >
        <span className="material-symbols-outlined text-[20px]">
          {collapsed ? 'chevron_right' : 'chevron_left'}
        </span>
      </button>

      {collapsed ? (
        /* COLLAPSED: Icon strip */
        <div className="flex flex-col gap-2 items-center overflow-y-auto overflow-x-hidden pr-1">
          {collapsedSearchOpen ? (
            <div className="w-full flex items-center gap-1 shrink-0">
              <input
                ref={collapsedSearchRef}
                type="text"
                placeholder="Filter..."
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                onBlur={() => { if (searchQuery === '') setCollapsedSearchOpen(false); }}
                onKeyDown={(e) => { if (e.key === 'Escape') { onSearchChange(''); setCollapsedSearchOpen(false); } }}
                className="w-full bg-background/80 border border-border rounded-md px-2 py-1.5 text-[11px] text-foreground focus:ring-primary focus:outline-none"
              />
              <button onClick={() => { onSearchChange(''); setCollapsedSearchOpen(false); }} className="p-1 text-muted-foreground hover:text-foreground shrink-0">
                <span className="material-symbols-outlined text-[14px]">close</span>
              </button>
            </div>
          ) : (
            <button onClick={handleCollapsedSearchToggle} className="p-2 rounded-lg hover:bg-muted/30 text-muted-foreground hover:text-foreground shrink-0" title="Search">
              <span className="material-symbols-outlined text-[20px]">search</span>
            </button>
          )}

          {actionCatalog
            .filter((item) => !collapsedSearchOpen || searchQuery === '' || item.title.toLowerCase().includes(searchQuery.toLowerCase()) || item.category.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((item) => (
              <button
                key={item.type}
                onClick={() => onAddAction(item)}
                disabled={item.disabled}
                draggable={!item.disabled}
                onDragStart={(e) => onDragStart(e, item)}
                className={`p-2 rounded-lg transition-all relative group w-full flex justify-center ${
                  item.disabled ? 'opacity-40 grayscale cursor-not-allowed' : 'cursor-grab active:cursor-grabbing hover:bg-muted/30'
                }`}
                title={item.title}
              >
                <div className={`${item.colorClass} p-1.5 rounded-md flex`}>
                  <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                </div>
                <span className="absolute left-full ml-2.5 px-2.5 py-1.5 bg-foreground text-background text-[11px] rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[100] font-body-sm shadow-lg">
                  {item.title}{item.disabled && ` (${item.disabledLabel})`}
                  <span className="absolute right-full top-1/2 -translate-y-1/2 w-0 h-0 border-t-[5px] border-t-transparent border-b-[5px] border-b-transparent border-r-[5px] border-r-foreground"></span>
                </span>
              </button>
            ))}
        </div>
      ) : (
        /* EXPANDED: Full sidebar */
        <>
          <div className="relative shrink-0">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">search</span>
            <input
              type="text"
              placeholder="Search actions..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-background/80 border border-border rounded-lg pl-10 pr-4 py-2 font-body-sm text-foreground focus:ring-primary focus:border-primary transition-colors shadow-sm"
            />
          </div>

          <div className="flex flex-col gap-6 overflow-y-auto pr-1">
            {categoryOrder.map((cat) => {
              const items = filteredCatalog.filter((i) => i.category === cat);
              if (items.length === 0) return null;
              return (
                <div key={cat}>
                  <div className="font-label-caps text-label-caps uppercase opacity-70 mb-2 text-muted-foreground">{cat}</div>
                  <div className="flex flex-col gap-2">
                    {items.map((item) => (
                      <button
                        key={item.type}
                        onClick={() => onAddAction(item)}
                        disabled={item.disabled}
                        draggable={!item.disabled}
                        onDragStart={(e) => onDragStart(e, item)}
                        className={`w-full text-left bg-card border border-border/60 rounded-lg p-3 flex items-center gap-3 transition-all shadow-sm active:scale-95 ${
                          item.disabled ? 'opacity-50 grayscale cursor-not-allowed bg-muted/40' : 'cursor-grab hover:border-primary/50 hover:bg-muted/30'
                        }`}
                      >
                        <div className={`${item.colorClass} p-2 rounded-md flex shrink-0`}>
                          <span className="material-symbols-outlined text-[18px]">{item.icon}</span>
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-body-sm font-semibold text-foreground truncate">{item.title}</span>
                          {item.disabled && item.disabledLabel && (
                            <span className="text-[10px] uppercase font-label-caps opacity-70 text-muted-foreground">{item.disabledLabel}</span>
                          )}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </aside>
  );
};