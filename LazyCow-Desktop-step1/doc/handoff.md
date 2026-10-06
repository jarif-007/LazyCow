# LazyCow — Handoff

Last updated: 2026-10-06
Last commit: babb9cc
Working tree: DIRTY — 11 files modified (see §5)

## §1 Current Focus
Session 6 just wrapped up a batch of Window Layout work — all uncommitted.
The engine is complete: fires in parallel with the action loop, per-shortcut
time budget, per-placement polling, user-judge via "Not arranged". Broken-path
pre-flight, Test Layout, Test Flow, and the info (i) button are live.
Next: commit the batch — docs first, then code (see §5) — then move to Q2b
(auto-scroll + highlight the broken action in Builder when "Fix Paths" is clicked).

## §2 Sub-task State

### Done & verified
- Batch 1 UI: WindowLayoutPanel, LayoutThumbnail, PositionDropdown, per-card Position dropdowns, Library badge.
- Right-click context menu, rAF resize, backdrop-blur removal, RenameModal + ArrangeWindowsInput removal.
- **Batch 2b — DPI fix.** Notepad snaps to left half on 1920×1080 @ 125%.
  - `__COMPAT_LAYER=HIGHDPIAWARE` env var on execFile
  - `SetThreadDpiAwarenessContext(-4)` in PowerShell script
  - `using System;` in C# (fixes IntPtr)
  - `Array.isArray` normalization for single-object JSON
  - System window blocklist (TextInputHost, ShellExperienceHost, SearchHost, etc.)
  - Zero-size window filter
- **Batch 2d — claim-the-zone + bring-to-front.** 4-app quad grid verified end-to-end on 1920×1080 @ 125%.
  - `ForceForeground` via AttachThreadInput + BringWindowToTop + SetForegroundWindow
  - Occupancy check demoted to `Log-Zone-Occupancy` (diagnostic-only)
  - `Place-Centered` removed
  - C# `out _` discard replaced with named variable (PS 5.1 compiler compat)
- **Batch 2c — engine wired into `runShortcutActions`.**
  - `ShortcutSchema` extended with `windowLayout` field
  - `buildPlacementsFromShortcut()` helper in main.ts
  - `arrangeWindows()` called **in parallel** with the action loop (not after)
  - `estimateShortcutBudgetMs()` sizes the poll window per-shortcut
  - `windowLayout` passed from Library.tsx → `runShortcut` payload
- **Per-placement polling.** 15ms warmup for 800ms → taper to max 200ms. Each window snapped the moment it appears.
- **`SETTLE_TIME` retired.** `launch_app`'s 800ms settle delay removed.
- **User-judge mechanism.** Position dropdown's "Not arranged" is the primary control; UWP heuristic kept as graceful fallback.
- **Broken-path pre-flight** in `Library.tsx` — debounced (250ms), re-runs on window focus, feeds the amber badge on `ShortcutCard`.
- **`findFirstBrokenPath`** in `main.ts` — hotkey-triggered runs pre-flight and refuse with a native toast.
- **Test Layout** button in WindowLayoutPanel.
- **Test Flow** button in Builder footer.
- **Info (i) button** with portal popover next to Test Layout.
- **Richer completion toasts** — layout summary appended.
- **`useActionValidation` re-runs on window focus** so inline errors refresh after the user fixes a path in Explorer.

### Done in code, NOT verified by user
- Broken-path pre-flight (badge + Fix Paths + hotkey refusal)
- Test Layout button
- Test Flow button
- Info (i) popover content and positioning

### Not started
- Q2b — auto-scroll + highlight the broken action in Builder
- Batch 3 — overlay animation (deferred)
- Cleanup — remove SCREEN_DEBUG / PLACE_DEBUG / PLACE_RESULT diagnostics from windowLayout.ts (keep OCCUPIED_BY)
- Dependency cleanup (4 unused deps)
- README accuracy pass

### Bugs / blockers
- (none blocking)
- Security Warning modal in `Library.tsx` shows an empty list when the only dangerous action is `open_file` with a dangerous extension. Filter only covers `run_script` and `launch_app`.
- Compiled `dist-electron/main.js` has mangled registry paths in the windowLayout C# block (backslashes dropped by the build step). Source is correct; the built artifact is not. Low priority.

## §3 Last Verified Test
Engine + claim-the-zone (Batch 2d) verified on 1920×1080 @ 125%:
- DevTools `arrangeWindowsShortcut({...})` for Notepad: `[{"zoneId":"left","status":"placed"}]` ✅
- Terminal: `SCREEN_DEBUG: area=0,30 1920x1050 BoundsW=1920x1080` ✅ (physical pixels)
- Terminal: `PLACE_RESULT: MoveWindow returned True` ✅
- Visual: Notepad fills left half, edge-to-edge ✅
- 4-app quad: `[{tl: placed},{tr: placed},{bl: placed},{br: placed}]` ✅

End-to-end via the shortcut path (`runShortcutActions` → parallel layout) not yet formally verified by the user.

## §4 Open Questions
- When to remove SCREEN_DEBUG / PLACE_DEBUG / PLACE_RESULT from `windowLayout.ts`?
  Decision: after the next end-to-end verification. Keep OCCUPIED_BY permanently.

## §5 Uncommitted (mirrors git status)

11 files modified — code + docs together. Tree is dirty across multiple topics.

**Code (9 files):**
- `electron/main.ts` — parallel engine, budget, broken-path pre-flight, richer toasts
- `electron/preload.ts` — small type cleanups
- `electron/electron-env.d.ts` — `layoutResults` field on `onShortcutComplete`
- `electron/windowLayout.ts` — per-placement polling
- `src/components/ShortcutCard.tsx` — Broken Path badge, Fix Paths button, layout results line
- `src/components/WindowLayout/WindowLayoutPanel.tsx` — Test Layout button, info (i) popover
- `src/hooks/useActionValidation.ts` — re-runs on window focus
- `src/pages/Builder.tsx` — Test Layout + Test Flow handlers
- `src/pages/Library.tsx` — broken-path pre-flight loop, layoutResults state

**Docs (2 files, appended to in this checkpoint):**
- `doc/decisions.md` — six new entries appended
- `doc/journal.md` — pending (fills at next checkpoint)

### §5-PENDING (in flight — cleared on confirmation)
- (nothing pending; the doc reconciliation IS the current in-flight work)

## §6 Bootstrap order
1. electron/main.ts, electron/preload.ts, electron/electron-env.d.ts, electron/windowLayout.ts
2. src/types/actions.ts, src/pages/Library.tsx, src/pages/Builder.tsx
3. package.json, tsconfig.json, vite.config.ts (only if needed)

## §7 Update rules
Update when: "checkpoint" / "sync" / "commit" | bug found/fixed/abandoned | decision made/reversed | sub-task verified.
Delete entries once committed AND documented in context.md.