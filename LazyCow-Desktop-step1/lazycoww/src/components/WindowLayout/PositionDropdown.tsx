import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface ZoneOption {
  id: string;
  label: string;
  takenBy?: { title: string; isMine: boolean };
}

interface PositionDropdownProps {
  value: string;
  options: ZoneOption[];
  disabled?: boolean;
  onChange: (zoneId: string) => void;
}

interface Rect {
  top: number;
  left: number;
  width: number;
  bottom: number;
}

/** Approximate height of the popover for flip calculation. */
const MENU_HEIGHT_ESTIMATE = 220;
/** Minimum distance to keep from the viewport edge. */
const EDGE_MARGIN = 8;

export const PositionDropdown: React.FC<PositionDropdownProps> = ({
  value,
  options,
  disabled,
  onChange,
}) => {
  const [open, setOpen] = useState(false);
  const [menuRect, setMenuRect] = useState<Rect | null>(null);
  const [flipUp, setFlipUp] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const current = options.find((o) => o.id === value);
  const currentLabel = current ? current.label : 'Not arranged';
  const assigned = !!current;

  useLayoutEffect(() => {
    if (!open) return;
    const el = buttonRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setMenuRect({ top: r.top, left: r.left, width: r.width, bottom: r.bottom });

    const spaceBelow = window.innerHeight - r.bottom - EDGE_MARGIN;
    const spaceAbove = r.top - EDGE_MARGIN;
    // Flip up only if there's not enough room below AND more room above.
    setFlipUp(spaceBelow < MENU_HEIGHT_ESTIMATE && spaceAbove > spaceBelow);
  }, [open]);

  useEffect(() => {
    if (!open) return;

    // Close on scroll — the trigger may scroll out of view, and following it
    // leaves an orphaned popover. This matches native <select> behaviour.
    const onScroll = () => setOpen(false);
    const onResize = () => setOpen(false);
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (buttonRef.current?.contains(target)) return;
      const menuEl = document.getElementById('position-dropdown-portal');
      if (menuEl?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onResize);
    window.addEventListener('mousedown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousedown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  // Compute popover styles, clamped to the viewport.
  const popoverStyle: React.CSSProperties = (() => {
    if (!menuRect) return {};
    const width = Math.max(menuRect.width, 240);
    const left = Math.min(
      Math.max(menuRect.left, EDGE_MARGIN),
      window.innerWidth - width - EDGE_MARGIN
    );
    if (flipUp) {
      const bottom = Math.min(
        window.innerHeight - menuRect.top + 4,
        window.innerHeight - EDGE_MARGIN
      );
      return { bottom, left, width };
    }
    const top = Math.min(menuRect.bottom + 4, window.innerHeight - EDGE_MARGIN);
    return { top, left, width };
  })();

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((p) => !p)}
        className={`w-full flex items-center justify-between gap-2 bg-background/70 border rounded-md px-2.5 py-1.5 text-[12px] font-body-sm transition-colors ${
          disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-primary/50 cursor-pointer'
        } ${
          assigned
            ? 'border-primary/50 text-primary'
            : 'border-border/60 text-muted-foreground'
        }`}
        title={assigned ? `Assigned to ${currentLabel}` : 'Choose a position'}
      >
        <span className="truncate">{currentLabel}</span>
        <span className="material-symbols-outlined text-[16px] shrink-0">
          {open ? 'expand_less' : 'expand_more'}
        </span>
      </button>

      {open &&
        menuRect &&
        createPortal(
          <div
            id="position-dropdown-portal"
            className="fixed z-[300] bg-card border border-border rounded-lg shadow-2xl overflow-hidden py-1"
            style={popoverStyle}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
              className={`w-full text-left px-3 py-2 text-[12px] font-body-sm transition-colors ${
                !assigned
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              Not arranged
            </button>

            <div className="h-px bg-border my-1" />

            {options.map((opt) => {
              const isMine = opt.takenBy?.isMine === true;
              const takenByOther = !!opt.takenBy && !isMine;

              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={takenByOther}
                  onClick={() => {
                    if (takenByOther) return;
                    onChange(opt.id);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-2 text-[12px] font-body-sm flex items-center justify-between gap-2 transition-colors ${
                    takenByOther
                      ? 'cursor-not-allowed'
                      : isMine
                      ? 'bg-primary/10 text-primary hover:bg-primary/15'
                      : 'text-foreground hover:bg-muted/50'
                  }`}
                >
                  <span
                    className={`truncate ${takenByOther ? 'text-muted-foreground/70' : ''}`}
                  >
                    {opt.label}
                  </span>
                  {takenByOther && opt.takenBy && (
                    <span className="text-[10px] text-muted-foreground/80 truncate ml-2 italic">
                      taken by {opt.takenBy.title}
                    </span>
                  )}
                  {isMine && (
                    <span className="material-symbols-outlined text-[14px] shrink-0">
                      check
                    </span>
                  )}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
};