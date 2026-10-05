# LazyCow — Handoff

Last updated: 2026-10-06
Last commit: 79289b0
Working tree: CLEAN (journal.md may show a fresh stub — see §5)

## §1 Current Focus
Shortcut-level Window Layout **runtime engine** (Batch 2).
Engine is VERIFIED end-to-end on 1920×1080 @ 125%: DPI fix working, claim-the-zone
behavior working, 4-app quad grid verified. Next: Batch 2c — wire engine into
runShortcutActions so it fires automatically when a shortcut runs.

## §2 Sub-task State
### Done & verified
- Batch 1 UI: WindowLayoutPanel, LayoutThumbnail, PositionDropdown, per-card Position dropdowns, Library badge.
- Right-click context menu, rAF resize, backdrop-blur removal, RenameModal + ArrangeWindowsInput removal.
- **Batch 2b — DPI fix verified end-to-end.** Notepad snaps to left half on 1920×1080 @ 125%.
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

### Done in code, NOT verified
- (none — engine is verified)

### Not started
- Batch 2c: call engine from runShortcutActions after action loop.
- Batch 2c.2: pass windowLayout from Library.tsx → runShortcut payload.
- Batch 3: overlay animation (deferred).
- Cleanup: remove SCREEN_DEBUG / PLACE_DEBUG / PLACE_RESULT diagnostics once 2c is stable (keep OCCUPIED_BY).

### Bugs / blockers
- (none blocking — DPI bug resolved)
- Compiled dist-electron/main.js has mangled registry paths in the windowLayout C# block (backslashes dropped by the build step). Source is correct; the built artifact is not. Low priority.

## §3 Last Verified Test
DevTools `window.electronAPI.arrangeWindowsShortcut({...})` for Notepad on 1920×1080 @ 125%:
- Result: `[{"zoneId":"left","actionTitle":"Notepad","status":"placed"}]` ✅
- Terminal: `SCREEN_DEBUG: area=0,30 1920x1050  BoundsW=1920x1080` ✅ (physical pixels confirmed)
- Terminal: `PLACE_DEBUG: hwnd=... target=0,30 960x1050` ✅ (correct rect)
- Terminal: `PLACE_RESULT: MoveWindow returned True` ✅
- Visual: Notepad fills left half top-to-bottom, edge-to-edge ✅

4-app quad grid on 1920×1080 @ 125%:
- Result: `[{tl: placed},{tr: placed},{bl: placed},{br: placed}]` ✅
- Visual: four Notepads in four quadrants, all visible at once ✅

## §4 Open Questions
- When to remove SCREEN_DEBUG / PLACE_DEBUG / PLACE_RESULT from windowLayout.ts?
  Decision: after Batch 2c is stable. Keep OCCUPIED_BY permanently.

## §5 Uncommitted (mirrors git status)
- M doc/journal.md (stub from commit 79289b0, to be filled at next checkpoint)

### §5-PENDING (in flight — cleared on confirmation)
- Batch 2c — wire Window Layout engine into shortcut execution:
  - Extend ShortcutSchema in main.ts with windowLayout field
  - Add buildPlacementsFromShortcut() helper in main.ts
  - Call arrangeWindows() after action loop in runShortcutActions
  - Pass windowLayout from Library.tsx in the runShortcut payload
- Awaiting: user applies edits, restarts, tests by creating a real shortcut
  with 2 launch_app actions + Window Layout enabled.

## §6 Bootstrap order
1. electron/main.ts, electron/preload.ts, electron/electron-env.d.ts, electron/windowLayout.ts
2. src/types/actions.ts, src/pages/Library.tsx, src/pages/Builder.tsx
3. package.json, tsconfig.json, vite.config.ts (only if needed)

## §7 Update rules
Update when: "checkpoint" / "sync" / "commit" | bug found/fixed/abandoned | decision made/reversed | sub-task verified.
Delete entries once committed AND documented in context.md.