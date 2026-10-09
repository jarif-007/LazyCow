import React, { useState, useEffect, useRef } from 'react';
import { ActionItem, isArrangeable, LAYOUTS, WindowLayoutConfig } from '../types/actions';
import { useActionValidation } from '../hooks/useActionValidation';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { SortableActionCard } from './ActionSequence/SortableActionCard';
import { ActionFlowPreview } from './ActionSequence/ActionFlowPreview';
import { ConfirmDeleteModal } from './ActionSequence/ConfirmDeleteModal';

interface ActionSequenceProps {
  sequence: ActionItem[];
  onDelete: (id: string) => void;
  onUpdateValue: (id: string, value: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onDropFromSidebar: (index: number, catalogType: string) => void;
  onDropAtEnd: (catalogType: string) => void;
  /** Optional — when provided and enabled, each eligible card shows a position dropdown. */
  windowLayout?: WindowLayoutConfig;
  onWindowLayoutChange?: (next: WindowLayoutConfig) => void;
  /** When false, hide the "Dangerous" badge on action cards. Threaded from Settings. */
  showDangerWarnings: boolean;
}

const LONG_PRESS_MS = 400;
const LONG_PRESS_MOVE_TOLERANCE = 25; // squared, ~5px
const EDGE_ZONE_FRACTION = 0.18;
const EDGE_ZONE_MIN_PX = 60;
const AUTO_SCROLL_MAX_SPEED_DEFAULT = 9;
const AUTO_SCROLL_WARMUP_MS = 900;

function readAutoScrollSpeed(): number {
  try {
    const raw = localStorage.getItem('lazycow_settings');
    if (!raw) return AUTO_SCROLL_MAX_SPEED_DEFAULT;
    const parsed = JSON.parse(raw);
    const v = Number(parsed?.autoScrollSpeed);
    if (Number.isFinite(v) && v >= 2 && v <= 20) return v;
  } catch {
    /* ignore */
  }
  return AUTO_SCROLL_MAX_SPEED_DEFAULT;
}

function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const oy = window.getComputedStyle(node).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return null;
}

export const ActionSequence: React.FC<ActionSequenceProps> = ({
  sequence,
  onDelete,
  onUpdateValue,
  onMoveUp,
  onMoveDown,
  onReorder,
  onDropFromSidebar,
  onDropAtEnd,
  windowLayout,
  onWindowLayoutChange,
  showDangerWarnings,
}) => {
  const sectionRef = useRef<HTMLElement>(null);

  const [autoScrollSpeed, setAutoScrollSpeed] = useState<number>(() => readAutoScrollSpeed());
  const autoScrollSpeedRef = useRef(autoScrollSpeed);
  useEffect(() => {
    autoScrollSpeedRef.current = autoScrollSpeed;
  }, [autoScrollSpeed]);

  useEffect(() => {
    const onStorage = () => setAutoScrollSpeed(readAutoScrollSpeed());
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onStorage);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onStorage);
    };
  }, []);

  // ── Sidebar → sequence drop (HTML5) ──
  const [sidebarDragOverIndex, setSidebarDragOverIndex] = useState<number | null>(null);
  const [dragOverDropZone, setDragOverDropZone] = useState(false);

  // ── Selection mode ──
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // Mirror in a ref so the global pointer handlers don't need to re-bind
  const selectionModeRef = useRef(selectionMode);
  useEffect(() => {
    selectionModeRef.current = selectionMode;
  }, [selectionMode]);

  // ── Refs used by the global pointer/RAF engine ──
  const dragSelectActiveRef = useRef(false);
  const lastHoveredIdRef = useRef<string | null>(null);
  const pointerRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const autoScrollDirRef = useRef(0);
  const autoScrollDepthRef = useRef(0);
  const autoScrollStartRef = useRef(0);
  const autoScrollRafRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number; id: string } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    })
  );

  const handleSortEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromIndex = sequence.findIndex((a) => a.id === active.id);
    const toIndex = sequence.findIndex((a) => a.id === over.id);
    if (fromIndex !== -1 && toIndex !== -1) {
      onReorder(fromIndex, toIndex);
    }
  };

  // ── Selection helpers ──
  const toggleId = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exitSelectionMode = () => {
    dragSelectActiveRef.current = false;
    lastHoveredIdRef.current = null;
    autoScrollDirRef.current = 0;
    if (autoScrollRafRef.current !== null) {
      cancelAnimationFrame(autoScrollRafRef.current);
      autoScrollRafRef.current = null;
    }
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const handleSelectAllToggle = () => {
    if (selectedIds.size === sequence.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(sequence.map((a) => a.id)));
    }
  };

  const handleConfirmDelete = () => {
    selectedIds.forEach((id) => onDelete(id));
    setShowConfirmDelete(false);
    exitSelectionMode();
  };

  // ──────────────────────────────────────────────
  // GLOBAL POINTER + RAF ENGINE
  // ──────────────────────────────────────────────
  useEffect(() => {
    const stopRaf = () => {
      if (autoScrollRafRef.current !== null) {
        cancelAnimationFrame(autoScrollRafRef.current);
        autoScrollRafRef.current = null;
      }
    };

    const cancelLongPress = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    };

    const hitTest = () => {
      const { x, y } = pointerRef.current;
      const el = document.elementFromPoint(x, y) as HTMLElement | null;
      const cardEl = el?.closest('[data-card-id]') as HTMLElement | null;
      const id = cardEl?.dataset.cardId ?? null;
      if (id && id !== lastHoveredIdRef.current) {
        lastHoveredIdRef.current = id;
        toggleId(id);
      } else if (!id) {
        lastHoveredIdRef.current = null;
      }
    };

    const tick = () => {
      if (!dragSelectActiveRef.current) {
        autoScrollRafRef.current = null;
        return;
      }

      const parent = findScrollParent(sectionRef.current);
      if (parent) {
        const rect = parent.getBoundingClientRect();
        const { y } = pointerRef.current;
        const zone = Math.max(EDGE_ZONE_MIN_PX, rect.height * EDGE_ZONE_FRACTION);

        let dir = 0;
        let depth = 0;
        if (y < rect.top + zone) {
          dir = -1;
          depth = Math.min(1, (rect.top + zone - y) / zone);
        } else if (y > rect.bottom - zone) {
          dir = 1;
          depth = Math.min(1, (y - (rect.bottom - zone)) / zone);
        }

        if (dir !== 0) {
          if (autoScrollDirRef.current === 0) autoScrollStartRef.current = Date.now();
          autoScrollDirRef.current = dir;
          autoScrollDepthRef.current = depth;
          const elapsed = Date.now() - autoScrollStartRef.current;
          const warm = Math.min(1, 0.4 + (elapsed / AUTO_SCROLL_WARMUP_MS) * 0.6);
          const base = autoScrollSpeedRef.current * (0.3 + depth * 0.7);
          const speed = Math.max(0.4, base * warm);
          parent.scrollTop += dir * speed;
        } else {
          autoScrollDirRef.current = 0;
        }
      }

      // Hit-test every frame — catches cards scrolling under a stationary cursor.
      hitTest();

      autoScrollRafRef.current = requestAnimationFrame(tick);
    };

    const startRaf = () => {
      if (autoScrollRafRef.current === null) {
        autoScrollRafRef.current = requestAnimationFrame(tick);
      }
    };

    const beginDrag = (x: number, y: number, id: string) => {
      dragSelectActiveRef.current = true;
      lastHoveredIdRef.current = id;
      pointerRef.current.x = x;
      pointerRef.current.y = y;
      toggleId(id);
      startRaf();
    };

    const endDrag = () => {
      dragSelectActiveRef.current = false;
      lastHoveredIdRef.current = null;
      autoScrollDirRef.current = 0;
      stopRaf();
    };

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return; // primary button only
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Never intercept inputs / buttons / drag handles
      if (target.closest('input, textarea, select, button, [data-drag-handle]')) return;

      // Only react to presses inside our section
      if (!sectionRef.current?.contains(target)) return;

      // Find the card (card body OR flow-preview icon — both carry data-card-id)
      const cardEl = target.closest('[data-card-id]') as HTMLElement | null;
      const id = cardEl?.dataset.cardId;
      if (!id) return;

      // Case 1: already in selection mode → start drag-select immediately
      if (selectionModeRef.current) {
        e.preventDefault();
        beginDrag(e.clientX, e.clientY, id);
        return;
      }

      // Case 2: not in selection mode → arm long-press to enter it
      cancelLongPress();
      longPressStartRef.current = { x: e.clientX, y: e.clientY, id };
      longPressTimerRef.current = setTimeout(() => {
        longPressTimerRef.current = null;
        longPressStartRef.current = null;
        setSelectionMode(true);
        setSelectedIds(new Set([id]));
        // Start drag-select immediately so the user can drag without releasing
        beginDrag(pointerRef.current.x, pointerRef.current.y, id);
      }, LONG_PRESS_MS);
    };

    const onPointerMove = (e: PointerEvent) => {
      pointerRef.current.x = e.clientX;
      pointerRef.current.y = e.clientY;

      // Cancel long-press if pointer drifts too far before it fires
      if (longPressTimerRef.current && longPressStartRef.current) {
        const dx = e.clientX - longPressStartRef.current.x;
        const dy = e.clientY - longPressStartRef.current.y;
        if (dx * dx + dy * dy > LONG_PRESS_MOVE_TOLERANCE) {
          cancelLongPress();
          longPressStartRef.current = null;
        }
      }

      // Primary-button release missed? End cleanly.
      if (dragSelectActiveRef.current && (e.buttons & 1) === 0) {
        endDrag();
      }
    };

    const onPointerUp = () => {
      cancelLongPress();
      longPressStartRef.current = null;
      endDrag();
    };

    window.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointermove', onPointerMove, true);
    window.addEventListener('pointerup', onPointerUp, true);
    window.addEventListener('pointercancel', onPointerUp, true);
    window.addEventListener('blur', onPointerUp);

    return () => {
      window.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointermove', onPointerMove, true);
      window.removeEventListener('pointerup', onPointerUp, true);
      window.removeEventListener('pointercancel', onPointerUp, true);
      window.removeEventListener('blur', onPointerUp);
      stopRaf();
      cancelLongPress();
    };
  }, []);

  // ── Escape exits selection mode (suspended while modal is open) ──
  useEffect(() => {
    if (!selectionMode || showConfirmDelete) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        exitSelectionMode();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [selectionMode, showConfirmDelete]);

  // ── Sidebar → sequence drop (HTML5) ──
  const handleSidebarDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (!e.dataTransfer.types.includes('application/drag-type')) {
      e.dataTransfer.dropEffect = 'copy';
      setSidebarDragOverIndex(index);
      setDragOverDropZone(false);
    }
  };

  const handleSidebarDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    const catalogType = e.dataTransfer.getData('application/catalog-type');
    if (catalogType) onDropFromSidebar(index, catalogType);
    setSidebarDragOverIndex(null);
  };

  const handleZoneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!e.dataTransfer.types.includes('application/drag-type')) {
      e.dataTransfer.dropEffect = 'copy';
      setDragOverDropZone(true);
      setSidebarDragOverIndex(null);
    }
  };

  const handleZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const catalogType = e.dataTransfer.getData('application/catalog-type');
    if (catalogType) onDropAtEnd(catalogType);
    setDragOverDropZone(false);
  };

  const handleZoneDragLeave = () => setDragOverDropZone(false);

  const handleFlowIconClick = (id: string) => {
    if (selectionMode) return; // click handled by drag engine
    const el = document.getElementById(`action-card-${id}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.classList.add('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background');
    setTimeout(() => {
      el.classList.remove('ring-2', 'ring-primary', 'ring-offset-2', 'ring-offset-background');
    }, 900);
  };

  /** Compute the per-card window-layout view-model, or undefined when layout is off. */
  const windowLayoutForCard = (() => {
    if (!windowLayout?.enabled || !windowLayout.layoutId || !onWindowLayoutChange) return undefined;
    const layoutDef = LAYOUTS.find((l) => l.id === windowLayout.layoutId);
    if (!layoutDef) return undefined;

    // Don't hand out zone options when the active layout no longer fits
    // the current eligible action count (e.g. user removed an action after
    // picking Quad Grid). The panel shows a warning to re-pick a layout.
    const eligibleCount = sequence.filter(isArrangeable).length;
    if (layoutDef.zoneCount > eligibleCount) return undefined;

    const assignZone = (actionId: string, zoneId: string) => {
      const next = { ...windowLayout.assignments };
      // Remove this action from any zone it currently owns
      for (const key of Object.keys(next)) {
        if (next[key] === actionId) delete next[key];
      }
      // Also clear whatever was in the target zone
      if (zoneId) {
        next[zoneId] = actionId;
      }
      onWindowLayoutChange({ ...windowLayout, assignments: next });
    };

    return {
      zones: layoutDef.zones.map((z) => ({ id: z.id, label: z.label })),
      assignments: windowLayout.assignments,
      findActionById: (id: string) => sequence.find((a) => a.id === id),
      getAssignedZoneId: (actionId: string): string | null => {
        for (const [zoneId, aId] of Object.entries(windowLayout.assignments)) {
          if (aId === actionId) return zoneId;
        }
        return null;
      },
      assignZone,
    };
  })();

  const { errors: validationErrors, warnings: validationWarnings } = useActionValidation(sequence);

  return (
    <section
      ref={sectionRef}
      className={`flex flex-col gap-4 ${selectionMode ? 'select-none' : ''}`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between min-h-[32px]">
        <h2 className="font-label-caps text-label-caps uppercase opacity-70 text-muted-foreground">
          Action Sequence
        </h2>
        <div className="flex items-center gap-2">
          {!selectionMode ? (
            <>
              {sequence.length > 0 && (
                <button
                  onClick={() => setSelectionMode(true)}
                  className="px-3 py-1 rounded-full border border-border text-body-sm text-foreground hover:bg-muted transition-colors"
                >
                  Select
                </button>
              )}
            </>
          ) : (
            <>
              <span className="text-body-sm text-primary font-medium">
                {selectedIds.size} selected
              </span>
              <button
                onClick={handleSelectAllToggle}
                className="px-3 py-1 rounded-full border border-border text-body-sm text-foreground hover:bg-muted transition-colors"
              >
                {selectedIds.size === sequence.length ? 'Deselect All' : 'Select All'}
              </button>
              {selectedIds.size > 0 && selectedIds.size < sequence.length && (
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="px-3 py-1 rounded-full border border-border text-body-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                >
                  Clear
                </button>
              )}
              <button
                onClick={() => setShowConfirmDelete(true)}
                disabled={selectedIds.size === 0}
                className={`px-3 py-1 rounded-full text-body-sm flex items-center gap-1 transition-colors ${
                  selectedIds.size === 0
                    ? 'bg-muted text-muted-foreground cursor-not-allowed'
                    : 'bg-red-500 text-white hover:bg-red-600'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">delete</span>
                Delete
              </button>
              <button
                onClick={exitSelectionMode}
                className="px-3 py-1 rounded-full bg-primary text-primary-foreground text-body-sm hover:opacity-90 transition-opacity"
                title="Exit selection mode (Esc)"
              >
                Done
              </button>
            </>
          )}
        </div>
      </div>

      {/* Flow Preview */}
      <ActionFlowPreview
        sequence={sequence}
        validationErrors={validationErrors}
        onReorder={onReorder}
        onDelete={onDelete}
        onIconClick={handleFlowIconClick}
        selectionMode={selectionMode}
        selectedIds={selectedIds}
      />

      {/* Sequence Cards */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleSortEnd}
        autoScroll={{
          enabled: !selectionMode,
          threshold: { x: 0.2, y: 0.2 },
          acceleration: autoScrollSpeed * 0.8,
          interval: Math.max(6, 24 - autoScrollSpeed),
        }}
      >
        <SortableContext items={sequence.map((a) => a.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-4">
               {sequence.map((card, index) => (
              <SortableActionCard
                key={card.id}
                card={card}
                index={index}
                total={sequence.length}
                validationErrors={validationErrors}
                validationWarnings={validationWarnings}
                onDelete={onDelete}
                onUpdateValue={onUpdateValue}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
                onSidebarDragOver={handleSidebarDragOver}
                onSidebarDrop={handleSidebarDrop}
                isSidebarDropTarget={sidebarDragOverIndex === index}
                selectionMode={selectionMode}
                isSelected={selectedIds.has(card.id)}
                windowLayout={
                  windowLayoutForCard && isArrangeable(card)
                    ? {
                        zones: windowLayoutForCard.zones,
                        assignments: windowLayoutForCard.assignments,
                        assignedZoneId: windowLayoutForCard.getAssignedZoneId(card.id),
                        onAssign: (zoneId: string) =>
                          windowLayoutForCard.assignZone(card.id, zoneId),
                        findActionById: windowLayoutForCard.findActionById,
                      }
                    : undefined
                }
                showDangerWarnings={showDangerWarnings}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Drop Zone */}
      <div
        onDragOver={handleZoneDragOver}
        onDragLeave={handleZoneDragLeave}
        onDrop={handleZoneDrop}
        className={`w-full border-2 border-dashed rounded-xl py-8 flex flex-col items-center justify-center gap-2 transition-all cursor-pointer mt-2 ${
          dragOverDropZone
            ? 'border-primary bg-primary/10 shadow-lg shadow-primary/10'
            : 'border-border/40 bg-card/20 hover:bg-card/40'
        }`}
      >
        <span className={`material-symbols-outlined text-3xl ${dragOverDropZone ? 'text-primary' : ''}`}>
          {dragOverDropZone ? 'input_circle' : 'add_circle'}
        </span>
        <span className="font-body-md text-foreground">
          {dragOverDropZone ? 'Drop action here' : 'Drag actions here or click from sidebar'}
        </span>
      </div>

      {/* Confirm delete modal */}
      {showConfirmDelete && (
        <ConfirmDeleteModal
          actions={sequence.filter((a) => selectedIds.has(a.id))}
          onConfirm={handleConfirmDelete}
          onCancel={() => setShowConfirmDelete(false)}
        />
      )}
    </section>
  );
};