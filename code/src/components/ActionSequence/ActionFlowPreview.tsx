import React, { Fragment } from 'react';
import { ActionItem } from '../../types/actions';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface ActionFlowPreviewProps {
  sequence: ActionItem[];
  validationErrors: Record<string, string>;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onDelete: (id: string) => void;
  onIconClick: (id: string) => void;
  selectionMode: boolean;
  selectedIds: Set<string>;
}

// (long-press selection was removed from the flow preview — Select button
// handles entry into selection mode; flow icons are purely drag/click.)

export const ActionFlowPreview: React.FC<ActionFlowPreviewProps> = ({
  sequence,
  validationErrors,
  onReorder,
  onDelete,
  onIconClick,
  selectionMode,
  selectedIds,
}) => {
  const sensors = useSensors(
    // Movement past 6px starts a reorder drag. Stillness past 400ms starts a long-press.
    // The two never collide.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } })
  );


  const handleDragEnd = (event: DragEndEvent) => {
    if (selectionMode) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const fromId = String(active.id).replace(/^flow-/, '');
    const toId = String(over.id).replace(/^flow-/, '');
    const fromIndex = sequence.findIndex((a) => a.id === fromId);
    const toIndex = sequence.findIndex((a) => a.id === toId);
    if (fromIndex !== -1 && toIndex !== -1 && fromIndex !== toIndex) {
      onReorder(fromIndex, toIndex);
    }
  };


  const errCount = Object.keys(validationErrors).length;

  return (
    <div className="bg-card-light border border-border rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="font-label-caps text-label-caps text-muted-foreground uppercase opacity-80">
          Flow Preview
        </span>
        <span className="text-[11px] text-muted-foreground opacity-70 select-none">
          {sequence.length === 0
            ? ''
            : `${sequence.length} action${sequence.length !== 1 ? 's' : ''}${
                errCount > 0 ? ` · ${errCount} incomplete` : ''
              }`}
        </span>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={sequence.map((a) => `flow-${a.id}`)}
          strategy={rectSortingStrategy}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            {sequence.length === 0 ? (
              <span className="text-body-sm text-muted-foreground italic">
                No actions added yet
              </span>
            ) : (
              sequence.map((act, i) => (
                <Fragment key={act.id}>
                  <FlowIcon
                    act={act}
                    hasError={!!validationErrors[act.id]}
                    onDelete={onDelete}
                    onIconClick={onIconClick}
                    selectionMode={selectionMode}
                    isSelected={selectedIds.has(act.id)}
                  />
                  {i < sequence.length - 1 && (
                    <span className="material-symbols-outlined text-muted-foreground/50 text-[14px] shrink-0 select-none">
                      arrow_forward
                    </span>
                  )}
                </Fragment>
              ))
            )}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

interface FlowIconProps {
  act: ActionItem;
  hasError: boolean;
  onDelete: (id: string) => void;
  onIconClick: (id: string) => void;
  selectionMode: boolean;
  isSelected: boolean;
}

const FlowIcon: React.FC<FlowIconProps> = ({
  act,
  hasError,
  onDelete,
  onIconClick,
  selectionMode,
  isSelected,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `flow-${act.id}`,
  });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  // In selection mode, disable @dnd-kit's drag — pointerDown does drag-select.
  // Extract dnd-kit's handlers so we can call them manually.
  // JSX props with the same name override each other — spreading `listeners`
  // and then declaring our own `onPointerDown` would silently kill dnd-kit's
  // reorder handler. We chain them instead.
  const dndPointerDown = listeners?.onPointerDown as
    | ((e: React.PointerEvent) => void)
    | undefined;
  const dndKeyDown = listeners?.onKeyDown as
    | ((e: React.KeyboardEvent) => void)
    | undefined;

  const handleClick = () => {
    if (selectionMode) return; // pointerDown already toggled
    onIconClick(act.id);
  };

  return (
    <div
      ref={setNodeRef}
      data-card-id={act.id}
      style={style}
      {...attributes}
      onKeyDown={selectionMode ? undefined : dndKeyDown}
      onPointerDown={selectionMode ? undefined : dndPointerDown}
      onClick={handleClick}
      className={`w-8 h-8 ${act.colorClass} border rounded-lg flex items-center justify-center shrink-0 relative touch-none select-none ${
        selectionMode ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing'
      } ${isSelected ? 'border-primary border-2 ring-2 ring-primary/40' : 'border-current/20'}`}
      title={`${act.title}${act.value ? `: ${act.value}` : ''}${selectionMode ? ' — click to toggle selection' : ' — drag to reorder, click to jump'}`}
    >
      <span className="material-symbols-outlined text-[18px]">{act.icon}</span>

      {hasError && (
        <div className="absolute -top-1 -left-1 w-3 h-3 bg-red-500 rounded-full border border-background" />
      )}

      {!selectionMode && !isDragging && (
        <button
          type="button"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onDelete(act.id);
          }}
          className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-muted-foreground/70 hover:bg-red-500 text-background hover:text-white flex items-center justify-center transition-colors shadow-sm"
          title="Remove action"
        >
          <span className="material-symbols-outlined text-[10px] leading-none">remove</span>
        </button>
      )}

      {selectionMode && isSelected && (
        <div className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
          <span className="material-symbols-outlined text-[10px] leading-none">check</span>
        </div>
      )}
    </div>
  );
};