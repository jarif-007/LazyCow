import React from 'react';
import { createPortal } from 'react-dom';
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
  /** Called when the user clicks "Test Layout". Filtering is the caller's job. */
  onTestLayout?: () => void;
  /** Called when the user clicks the button while a test is in flight. */
  onCancelTestLayout?: () => void;
  /** True while the Test Layout run is in flight. */
  testRunning?: boolean;
}

export const WindowLayoutPanel: React.FC<WindowLayoutPanelProps> = ({
  value,
  onChange,
  sequence,
  onTestLayout,
  onCancelTestLayout,
  testRunning = false,
}) => {
  const [showTestInfo, setShowTestInfo] = React.useState(false);
  const [testInfoPosition, setTestInfoPosition] = React.useState<React.CSSProperties | null>(null);
  const testInfoBtnRef = React.useRef<HTMLButtonElement>(null);
  // Delayed-close timer — lets the cursor travel from the button to the
  // popover without the tooltip flickering shut on the way.
  const testInfoCloseTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const POPOVER_WIDTH = 320;        // w-80
  const POPOVER_HEIGHT_ESTIMATE = 260;
  const EDGE = 8;

  /** Compute a clamped popover position that always stays inside the viewport. */
  const computePopoverPosition = (): React.CSSProperties => {
    const btn = testInfoBtnRef.current;
    if (!btn) return {};
    const r = btn.getBoundingClientRect();

    // Horizontal: prefer aligning the popover's left with the button's left,
    // but shift left if it would run off the right edge.
    let left = r.left;
    if (left + POPOVER_WIDTH > window.innerWidth - EDGE) {
      left = window.innerWidth - POPOVER_WIDTH - EDGE;
    }
    if (left < EDGE) left = EDGE;

    // Vertical: prefer below the button. Flip above if not enough room.
    const spaceBelow = window.innerHeight - r.bottom - EDGE;
    const spaceAbove = r.top - EDGE;

    if (spaceBelow >= POPOVER_HEIGHT_ESTIMATE || spaceBelow >= spaceAbove) {
      const top = Math.min(r.bottom + EDGE, window.innerHeight - EDGE - POPOVER_HEIGHT_ESTIMATE);
      return { top, left, width: POPOVER_WIDTH };
    }
    // Flip above
    const top = Math.max(EDGE, r.top - POPOVER_HEIGHT_ESTIMATE - EDGE);
    return { top, left, width: POPOVER_WIDTH };
  };

  const openTestInfo = () => {
    if (testInfoCloseTimerRef.current) {
      clearTimeout(testInfoCloseTimerRef.current);
      testInfoCloseTimerRef.current = null;
    }
    setTestInfoPosition(computePopoverPosition());
    setShowTestInfo(true);
  };

  const scheduleCloseTestInfo = () => {
    if (testInfoCloseTimerRef.current) clearTimeout(testInfoCloseTimerRef.current);
    testInfoCloseTimerRef.current = setTimeout(() => {
      setShowTestInfo(false);
      testInfoCloseTimerRef.current = null;
    }, 140);
  };

  // Clear any pending timer on unmount
  React.useEffect(() => () => {
    if (testInfoCloseTimerRef.current) clearTimeout(testInfoCloseTimerRef.current);
  }, []);

  // Keep the popover anchored while the user scrolls or resizes.
  // If the anchor button moves out of view, close the popover entirely —
  // matches native <select> behaviour.
  React.useEffect(() => {
    if (!showTestInfo) return;
    const reposition = () => setTestInfoPosition(computePopoverPosition());
    const onScroll = () => {
      const btn = testInfoBtnRef.current;
      if (!btn) return;
      const r = btn.getBoundingClientRect();
      if (r.bottom < 0 || r.top > window.innerHeight) {
        setShowTestInfo(false);
      } else {
        reposition();
      }
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', reposition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showTestInfo]);
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

  // Count assigned actions that are open_url. With 2+, most browsers will
  // open the second URL as a tab in the same window — no distinct window
  // exists for the layout engine to place, so the second URL looks
  // "unarranged" even though nothing is broken.
  const urlAssignedCount = Object.entries(value.assignments).filter(
    ([, actionId]) => sequence.find((a) => a.id === actionId)?.type === 'open_url'
  ).length;

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

          {/* URL-in-same-browser notice — most browsers open a new URL as a
              tab in the existing window, so a second open_url assigned to a
              different zone won't have its own window to place. */}
          {urlAssignedCount >= 2 && (
            <div className="mt-3 flex items-start gap-2 bg-primary/10 border border-primary/30 rounded-lg p-3">
              <span className="material-symbols-outlined text-primary text-[18px] shrink-0 mt-0.5">
                info
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-body-sm text-primary font-medium">
                  Two or more Open URL actions assigned
                </p>
                <p className="text-[11px] text-primary/80 mt-0.5">
                  Most browsers open a new URL as a tab in the existing window. If both URLs target the same browser, only the first window will be placed — the second reuses it. To place both, set the browser to always open new windows (Firefox: <em>Settings → Tabs → turn off "Open new windows in a new tab instead"</em>).
                </p>
              </div>
            </div>
          )}

          {/* Test Layout — launches launch-type actions and previews the layout. */}
          {onTestLayout && (
            <div className="mt-4 pt-4 border-t border-border flex items-center gap-3">
              {testRunning ? (
                <button
                  type="button"
                  onClick={onCancelTestLayout}
                  className="px-4 py-2 rounded-full font-title-sm text-body-sm flex items-center gap-2 transition-colors bg-red-500 text-white hover:bg-red-600"
                >
                  <span className="material-symbols-outlined text-[18px]">stop_circle</span>
                  Cancel Test
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onTestLayout}
                  disabled={eligibleCount === 0}
                  className={`px-4 py-2 rounded-full font-title-sm text-body-sm flex items-center gap-2 transition-colors ${
                    eligibleCount === 0
                      ? 'bg-muted text-muted-foreground cursor-not-allowed'
                      : 'bg-primary text-primary-foreground hover:opacity-90'
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]">play_arrow</span>
                  Test Layout
                </button>
              )}

              <button
                type="button"
                ref={testInfoBtnRef}
                onMouseEnter={openTestInfo}
                onMouseLeave={scheduleCloseTestInfo}
                onClick={() => {
                  if (showTestInfo) {
                    setShowTestInfo(false);
                  } else {
                    openTestInfo();
                  }
                }}
                className="w-6 h-6 rounded-full text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors"
                aria-label="When should I use Test Layout?"
              >
                <span className="material-symbols-outlined text-[18px]">info</span>
              </button>

              {showTestInfo && createPortal(
                <div
                  className="fixed z-[500] p-4 bg-foreground text-background text-[12px] leading-relaxed rounded-xl shadow-2xl"
                  style={testInfoPosition ?? { top: 0, left: 0, width: POPOVER_WIDTH }}
                  onMouseEnter={openTestInfo}
                  onMouseLeave={scheduleCloseTestInfo}
                >
                  <p className="font-semibold mb-2">Test Layout</p>
                  <p className="opacity-90">
                    Launches the launchable actions in this shortcut and applies the layout, so you can see how the arrangement looks before saving.
                  </p>
                  <p className="font-semibold mt-3 mb-1">Use it when</p>
                  <p className="opacity-90">
                    You've assigned apps to positions and want to confirm the result — especially before saving.
                  </p>
                  <p className="font-semibold mt-3 mb-1">If an app looks wrong</p>
                  <p className="opacity-90">
                    Some apps (Calculator, Settings, Photos) don't fill zones nicely. Remove their <strong>Position</strong> assignment — they'll still launch, just not force-arranged.
                  </p>
                </div>,
                document.body
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
};