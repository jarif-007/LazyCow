import React, { useState } from 'react';
import { ActionItem, LayoutDefinition, LayoutZone } from '../../types/actions';

interface LayoutThumbnailProps {
  layout: LayoutDefinition;
  size?: 'sm' | 'lg';
  /** zoneId → actionId */
  assignments?: Record<string, string>;
  /** All actions we could map actionId back to (to draw the icon). */
  actions?: ActionItem[];
  /** When provided, hovering the thumbnail shows an X on each assigned zone. */
  onClearZone?: (zoneId: string) => void;
  /** When provided, drag icons between zones to swap / move them. */
  onSwapZones?: (fromZoneId: string, toZoneId: string) => void;
}

function zoneStyle(zone: LayoutZone): React.CSSProperties {
  return {
    position: 'absolute',
    left: `${zone.x * 100}%`,
    top: `${zone.y * 100}%`,
    width: `${zone.w * 100}%`,
    height: `${zone.h * 100}%`,
  };
}

export const LayoutThumbnail: React.FC<LayoutThumbnailProps> = ({
  layout,
  size = 'sm',
  assignments = {},
  actions = [],
  onClearZone,
  onSwapZones,
}) => {
  const isSmall = size === 'sm';
  const [dragSourceZone, setDragSourceZone] = useState<string | null>(null);
  const [dragOverZone, setDragOverZone] = useState<string | null>(null);

  const iconWrapPadding = isSmall ? 'p-1' : 'p-1.5';
  const iconFontSize = isSmall ? 'text-[16px]' : 'text-[24px]';
  const emptyLabelSize = isSmall ? 'text-[9px]' : 'text-[11px]';
  const clearBtnSize = isSmall ? 'w-4 h-4' : 'w-5 h-5';
  const clearIconSize = isSmall ? 'text-[10px]' : 'text-[12px]';

  const handleDragStart = (e: React.DragEvent, zoneId: string) => {
    if (!onSwapZones) return;
    e.dataTransfer.setData('application/layout-zone', zoneId);
    e.dataTransfer.effectAllowed = 'move';
    setDragSourceZone(zoneId);
  };

  const handleDragOver = (e: React.DragEvent, zoneId: string) => {
    if (!onSwapZones) return;
    if (!e.dataTransfer.types.includes('application/layout-zone')) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverZone(zoneId);
  };

  const handleDrop = (e: React.DragEvent, targetZoneId: string) => {
    if (!onSwapZones) return;
    e.preventDefault();
    const from = e.dataTransfer.getData('application/layout-zone');
    setDragSourceZone(null);
    setDragOverZone(null);
    if (from && from !== targetZoneId) {
      onSwapZones(from, targetZoneId);
    }
  };

  const handleDragEnd = () => {
    setDragSourceZone(null);
    setDragOverZone(null);
  };

  return (
    <div className="group/thumb relative w-full bg-background/60 border border-border rounded-md overflow-hidden aspect-[16/10]">
      {layout.zones.map((zone) => {
        const assignedId = assignments[zone.id];
        const assignedAction = assignedId ? actions.find((a) => a.id === assignedId) : null;
        const isDragSource = dragSourceZone === zone.id;
        const isDragOver = dragOverZone === zone.id;
        const isDraggable = !!onSwapZones && !!assignedAction;

        return (
          <div
            key={zone.id}
            style={zoneStyle(zone)}
            draggable={isDraggable}
            onDragStart={(e) => isDraggable && handleDragStart(e, zone.id)}
            onDragOver={(e) => handleDragOver(e, zone.id)}
            onDrop={(e) => handleDrop(e, zone.id)}
            onDragEnd={handleDragEnd}
            onDragLeave={() => setDragOverZone((p) => (p === zone.id ? null : p))}
            className={`border flex items-center justify-center bg-card/40 relative transition-all ${
              isDragOver
                ? 'border-primary border-2 bg-primary/10'
                : isDragSource
                ? 'border-primary/60 bg-primary/5 opacity-50'
                : 'border-border/40'
            } ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
          >
            {assignedAction ? (
              <>
                <div
                  className={`${assignedAction.colorClass} ${iconWrapPadding} rounded-md flex items-center justify-center`}
                  title={`${assignedAction.title}${
                    assignedAction.value ? `: ${assignedAction.value}` : ''
                  }`}
                >
                  <span className={`material-symbols-outlined ${iconFontSize}`}>
                    {assignedAction.icon}
                  </span>
                </div>
                {onClearZone && !isDragSource && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      onClearZone(zone.id);
                    }}
                    className={`absolute top-0.5 right-0.5 ${clearBtnSize} rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center opacity-0 group-hover/thumb:opacity-100 transition-opacity shadow-sm`}
                    title={`Clear ${zone.label}`}
                  >
                    <span
                      className={`material-symbols-outlined ${clearIconSize} leading-none`}
                    >
                      close
                    </span>
                  </button>
                )}
              </>
            ) : (
              <span
                className={`${emptyLabelSize} text-muted-foreground/70 text-center leading-tight px-1 font-body-sm pointer-events-none`}
              >
                {zone.label}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
};