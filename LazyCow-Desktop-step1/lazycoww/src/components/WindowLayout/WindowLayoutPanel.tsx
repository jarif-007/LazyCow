import React from 'react';
import {
  ActionItem,
  isArrangeable,
  LAYOUTS,
  LayoutId,
  WindowLayoutConfig,
} from '../../types/actions';
import { LayoutThumbnail } from './LayoutThumbnail';

interface WindowLayoutPanelProps {
  value: WindowLayoutConfig;
  onChange: (next: WindowLayoutConfig) => void;
  sequence: ActionItem[];
}

export const WindowLayoutPanel: React.FC<WindowLayoutPanelProps> = ({
  value,
  onChange,
  sequence,
}) => {
  const eligibleActions = sequence.filter(isArrangeable);
  const eligibleCount = eligibleActions.length;
  const canEnable = eligibleCount >= 2;

  const activeLayout = value.layoutId
    ? LAYOUTS.find((l) => l.id === value.layoutId) ?? null
    : null;

  const handleToggle = () => {
    if (!value.enabled && canEnable) {
      let nextLayout: LayoutId | null = value.layoutId;
      if (!nextLayout) {
        if (eligibleCount >= 4) nextLayout = 'quad';
        else if (eligibleCount === 3) nextLayout = 'thirds';
        else nextLayout = 'split_50';
      }
      onChange({ ...value, enabled: true, layoutId: nextLayout });
    } else {
      onChange({ ...value, enabled: false });
    }
  };

  const handleLayoutChange = (id: LayoutId) => {
    // Clear assignments when layout changes — zone IDs differ between layouts.
    onChange({ ...value, layoutId: id, assignments: {} });
  };

  // Count how many zones are filled vs. total
  const assignedCount = Object.keys(value.assignments).length;
  const overflow = activeLayout ? Math.max(0, eligibleCount - activeLayout.zoneCount) : 0;

  // True when the selected layout has more zones than we have eligible apps.
  // Happens when the user removes an action after picking a larger layout.
  const layoutNowInvalid = !!activeLayout && activeLayout.zoneCount > eligibleCount;

  return (
    <section className="card-themeable bg-gradient-to-br from-card-light to-card-medium border border-border rounded-xl p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <h2 className="font-label-caps text-label-caps uppercase opacity-70 text-muted-foreground">
            Window Layout
          </h2>
          <p className="text-body-sm text-muted-foreground mt-1">
            Position launched apps into a fixed layout when this shortcut runs.
          </p>
        </div>
        <label
          className={`relative inline-flex items-center shrink-0 ${
            canEnable ? 'cursor-pointer' : 'cursor-not-allowed'
          }`}
        >
          <input
            type="checkbox"
            className="sr-only peer"
            checked={value.enabled}
            disabled={!canEnable}
            onChange={handleToggle}
          />
          <div
            className={`w-11 h-6 rounded-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-full ${
              canEnable ? 'bg-muted peer-checked:bg-primary' : 'bg-muted opacity-40'
            }`}
          />
        </label>
      </div>

      {!canEnable && (
        <p className="text-body-sm text-muted-foreground/70 italic mt-2">
          Add at least 2 apps, folders, files, or URLs to enable.
        </p>
      )}

      {canEnable && value.enabled && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-4">
            {LAYOUTS.map((layout) => {
              const tooManyZones = layout.zoneCount > eligibleCount;
              const selected = value.layoutId === layout.id;
              // Only mark selected when it's actually valid — a stale/invalid
              // selection shows as a red-tinted outline instead of primary.
              const selectedValid = selected && !tooManyZones;
              const selectedInvalid = selected && tooManyZones;
              return (
                <button
                  key={layout.id}
                  type="button"
                  disabled={tooManyZones}
                  onClick={() => handleLayoutChange(layout.id)}
                  className={`relative group/layout p-2 rounded-lg border-2 transition-all ${
                    selectedInvalid
                      ? 'border-amber-500/60 bg-amber-500/5'
                      : tooManyZones
                      ? 'border-border/40 opacity-35 cursor-not-allowed'
                      : selectedValid
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-muted/30'
                  }`}
                >
                  <LayoutThumbnail
                    layout={layout}
                    size="sm"
                    assignments={selectedValid ? value.assignments : undefined}
                    actions={eligibleActions}
                    onClearZone={
                      selectedValid
                        ? (zoneId) => {
                            const next = { ...value.assignments };
                            delete next[zoneId];
                            onChange({ ...value, assignments: next });
                          }
                        : undefined
                    }
                    onSwapZones={
                      selectedValid
                        ? (fromId, toId) => {
                            const next = { ...value.assignments };
                            const from = next[fromId];
                            const to = next[toId];
                            if (from === undefined) return;
                            if (to === undefined) {
                              delete next[fromId];
                              next[toId] = from;
                            } else {
                              next[fromId] = to;
                              next[toId] = from;
                            }
                            onChange({ ...value, assignments: next });
                          }
                        : undefined
                    }
                  />

                  {/* Custom tooltip — replaces the native title attribute */}
                  <div
                    className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 px-3 py-2 bg-foreground text-background text-[11px] leading-snug rounded-md whitespace-nowrap opacity-0 invisible group-hover/layout:opacity-100 group-hover/layout:visible transition-opacity pointer-events-none z-50 shadow-2xl border border-border"
                  >
                    <div className="font-semibold">{layout.label}</div>
                    <div className="opacity-70 text-[10px] mt-0.5">
                      {layout.zones.map((z) => z.label).join(' · ')}
                    </div>
                    {tooManyZones && (
                      <div className="text-amber-400 text-[10px] mt-1">
                        Needs {layout.zoneCount} apps — shortcut has {eligibleCount}
                      </div>
                    )}
                    {/* Tooltip arrow */}
                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-foreground" />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Layout became invalid warning — user removed an app after picking */}
          {layoutNowInvalid && activeLayout && (
            <div className="mt-3 flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <span className="material-symbols-outlined text-amber-500 text-[18px] shrink-0 mt-0.5">
                warning
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-body-sm text-amber-500 font-medium">
                  {activeLayout.label} needs {activeLayout.zoneCount} apps — this shortcut now has {eligibleCount}.
                </p>
                <p className="text-[11px] text-amber-500/80 mt-0.5">
                  Pick a layout with {eligibleCount} zones or fewer. Your existing assignments are kept until you change it.
                </p>
              </div>
            </div>
          )}

          {/* Progress + overflow note */}
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[11px] text-muted-foreground opacity-70">
              {activeLayout
                ? `${assignedCount} of ${activeLayout.zoneCount} zone${
                    activeLayout.zoneCount !== 1 ? 's' : ''
                  } assigned. Use the position dropdown on each card below.`
                : 'Pick a layout to enable position assignment.'}
            </p>
            {overflow > 0 && (
              <span className="inline-flex items-center gap-1 text-[11px] text-amber-500 bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded-full shrink-0">
                <span className="material-symbols-outlined text-[13px]">warning</span>
                {overflow} app{overflow !== 1 ? 's' : ''} won&apos;t be arranged
              </span>
            )}
          </div>
        </>
      )}
    </section>
  );
};