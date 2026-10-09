import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ActionItem, getFieldLabel } from '../../types/actions';
import { ActionValueInput } from './ActionValueInput';
import { PositionDropdown } from '../WindowLayout/PositionDropdown';

interface SortableActionCardProps {
  card: ActionItem;
  index: number;
  total: number;
  validationErrors: Record<string, string>;
  validationWarnings: Record<string, string>;
  onDelete: (id: string) => void;
  onUpdateValue: (id: string, value: string) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
  onSidebarDragOver: (e: React.DragEvent, index: number) => void;
  onSidebarDrop: (e: React.DragEvent, index: number) => void;
  isSidebarDropTarget: boolean;
  // Selection
  selectionMode: boolean;
  isSelected: boolean;
  // Window Layout (optional — undefined when layout is off)
  windowLayout?: {
    /** Zones available in the currently chosen layout. */
    zones: { id: string; label: string }[];
    /** zoneId → actionId */
    assignments: Record<string, string>;
    /** This card's assigned zone, if any. */
    assignedZoneId: string | null;
    /** Called when the user picks a new zone (or '' to unassign). */
    onAssign: (zoneId: string) => void;
    /** Look up a sibling action by id (for greyed-out "(taken by X)" hints). */
    findActionById: (id: string) => { title: string } | undefined;
  };
  /** When false, hide the "Dangerous" badge. Threaded from Settings via Builder. */
  showDangerWarnings: boolean;
}

export const SortableActionCard: React.FC<SortableActionCardProps> = ({
  card,
  index,
  total,
  validationErrors,
  validationWarnings,
  onDelete,
  onUpdateValue,
  onMoveUp,
  onMoveDown,
  onSidebarDragOver,
  onSidebarDrop,
  isSidebarDropTarget,
  selectionMode,
  isSelected,
  windowLayout,
  showDangerWarnings,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  // Suppress drag when in selection mode.
  const dragHandleProps = selectionMode ? {} : { ...attributes, ...listeners };

  return (
    <div
      ref={setNodeRef}
      id={`action-card-${card.id}`}
      data-card-id={card.id}
      style={style}
      onDragOver={(e) => onSidebarDragOver(e, index)}
      onDrop={(e) => onSidebarDrop(e, index)}
      className={`relative card-themeable bg-gradient-to-br from-card-medium to-card-dark border rounded-xl p-4 shadow-sm flex flex-col gap-4 transition-all ${
        isSelected
          ? 'border-primary border-2 ring-1 ring-primary/40 shadow-lg shadow-primary/10'
          : isSidebarDropTarget
            ? 'border-primary border-2 bg-primary/5 shadow-lg shadow-primary/10'
            : 'border-border/80'
      }`}
    >
      {/* Selection overlay — captures all pointer events so inputs/buttons are inert */}
      {selectionMode && (
        <div className="absolute inset-0 z-20 rounded-xl cursor-pointer" aria-hidden />
      )}

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Checkbox (selection mode only) */}
          {selectionMode && (
            <div
              className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                isSelected ? 'bg-primary border-primary' : 'bg-transparent border-border'
              }`}
            >
              {isSelected && (
                <span className="material-symbols-outlined text-[12px] text-primary-foreground font-bold">
                  check
                </span>
              )}
            </div>
          )}

          {/* Drag Handle */}
          <span
            {...dragHandleProps}
            data-drag-handle
            className={`material-symbols-outlined p-1 select-none touch-none ${
              selectionMode
                ? 'text-muted-foreground/30 cursor-not-allowed'
                : 'text-muted-foreground cursor-grab hover:text-primary active:cursor-grabbing'
            }`}
            title={selectionMode ? 'Reordering disabled while selecting' : 'Drag to reorder'}
          >
            drag_indicator
          </span>

          {/* Icon */}
          <div className={`${card.colorClass} p-1.5 rounded-md flex`}>
            <span className="material-symbols-outlined text-[20px]">{card.icon}</span>
          </div>

          {/* Title */}
          <span className="font-title-sm text-foreground">{card.title}</span>

          {showDangerWarnings && (card.type === 'run_script' || card.type === 'launch_app') && (
            <span className="bg-red-500/10 text-red-500 text-[10px] font-bold px-2 py-0.5 rounded border border-red-500/20 uppercase tracking-wider ml-2">
              Dangerous
            </span>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => onMoveUp(index)}
            disabled={index === 0 || selectionMode}
            className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-1"
            title="Move up"
          >
            <span className="material-symbols-outlined text-[20px]">keyboard_arrow_up</span>
          </button>
          <button
            onClick={() => onMoveDown(index)}
            disabled={index === total - 1 || selectionMode}
            className="text-muted-foreground hover:text-foreground disabled:opacity-30 p-1"
            title="Move down"
          >
            <span className="material-symbols-outlined text-[20px]">keyboard_arrow_down</span>
          </button>
          <button
            onClick={() => onDelete(card.id)}
            disabled={selectionMode}
            className="text-red-400 hover:text-red-500 disabled:opacity-30 p-1"
            title="Remove"
          >
            <span className="material-symbols-outlined text-[20px]">delete</span>
          </button>
        </div>
      </div>

      {/* Position dropdown — only for eligible actions when layout is on */}
      {windowLayout && (
        <div className="pl-12 pr-4">
          <div className="flex items-center gap-2">
            <span className="font-label-caps uppercase text-muted-foreground opacity-70 shrink-0 text-[11px]">
              Position
            </span>
            <PositionDropdown
              value={windowLayout.assignedZoneId ?? ''}
              disabled={selectionMode}
              options={windowLayout.zones.map((zone) => {
                const takenById = windowLayout.assignments[zone.id];
                const isMine = takenById === card.id;
                const takenByOther = !!takenById && !isMine;
                const takenByTitle = takenByOther
                  ? windowLayout.findActionById(takenById)?.title ?? 'another action'
                  : null;
                return {
                  id: zone.id,
                  label: zone.label,
                  takenBy: takenByOther && takenByTitle
                    ? { title: takenByTitle, isMine: false }
                    : undefined,
                };
              })}
              onChange={(zoneId) => windowLayout.onAssign(zoneId)}
            />
          </div>
        </div>
      )}

      {/* Label + error / warning row */}
      <div className="pl-12 pr-4 flex flex-col gap-2">
        <label className="font-label-caps text-label-caps uppercase opacity-70 block text-muted-foreground flex justify-between">
          <span className="flex items-center gap-1.5">
            {getFieldLabel(card.type)}
            {card.type === 'open_url' && (
              <span className="relative group/info inline-flex">
                <span className="material-symbols-outlined text-[14px] cursor-help normal-case opacity-70 group-hover/info:opacity-100 transition-opacity">
                  info
                </span>
                <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-foreground text-background text-[11px] leading-snug rounded-md whitespace-normal w-72 opacity-0 invisible group-hover/info:opacity-100 group-hover/info:visible transition-opacity pointer-events-none z-50 font-body-sm shadow-lg normal-case tracking-normal">
                  Type <span className="font-code-sm">google.com</span> or <span className="font-code-sm">www.google.com</span> — <span className="font-code-sm">https://</span> is added automatically. For local addresses like <span className="font-code-sm">192.168.1.1</span> or <span className="font-code-sm">localhost</span>, <span className="font-code-sm">http://</span> is used instead. Click <strong>Test</strong> to verify the URL loads.
                </span>
              </span>
            )}
          </span>
          {validationErrors[card.id] && (
            <span className="text-red-500 font-medium normal-case flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">warning</span>
              {validationErrors[card.id]}
            </span>
          )}
          {!validationErrors[card.id] && validationWarnings[card.id] && (
            <span className="text-amber-500 font-medium normal-case flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">cloud_off</span>
              {validationWarnings[card.id]}
            </span>
          )}
        </label>

        <div className={selectionMode ? 'pointer-events-none opacity-70' : ''}>
          <ActionValueInput
            card={card}
            hasError={!!validationErrors[card.id]}
            onUpdateValue={onUpdateValue}
          />
        </div>
      </div>
    </div>
  );
};