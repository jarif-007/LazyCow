# LazyCow — Handoff

Last updated: 2026-10-06
Last commit: 89e4626
Working tree: DIRTY (5 modified, 1 untracked — see §5)

## §1 Current Focus
Shortcut-level Window Layout **runtime engine** (Batch 2).
Engine is VERIFIED end-to-end: DPI fix working, Notepad snaps to left half
on 1920×1080 @ 125%. Next: Batch 2c — wire engine into runShortcutActions.

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

### Done in code, NOT verified
- (none — engine is verified)

### Not started
- Batch 2c: call engine from runShortcutActions after action loop.
- Pass windowLayout from Library.tsx → runShortcut payload.
- Batch 3: overlay animation (deferred).
- Cleanup: remove SCREEN_DEBUG / PLACE_DEBUG / PLACE_RESULT diagnostics once 2c is stable (keep OCCUPIED_BY).

### Bugs / blockers
- (none blocking — DPI bug resolved)
- Compiled dist-electron/main.js has mangled registry paths in the windowLayout C# block (backslashes dropped by the build step). Source is correct; the built artifact is not. This is a build-step bug, not a source bug. Low priority.

## §3 Last Verified Test
DevTools `window.electronAPI.arrangeWindowsShortcut({...})` for Notepad on 1920×1080 @ 125%:
- Result: `[{"zoneId":"left","actionTitle":"Notepad","status":"placed"}]` ✅
- Terminal: `SCREEN_DEBUG: area=0,30 1920x1050  BoundsW=1920x1080` ✅ (physical pixels confirmed)
- Terminal: `PLACE_DEBUG: hwnd=... target=0,30 960x1050` ✅ (correct rect)
- Terminal: `PLACE_RESULT: MoveWindow returned True` ✅
- Visual: Notepad fills left half top-to-bottom, edge-to-edge ✅

## §4 Open Questions
- When to remove SCREEN_DEBUG / PLACE_DEBUG / PLACE_RESULT from windowLayout.ts?
  Decision: after Batch 2c is stable. Keep OCCUPIED_BY permanently.
- Multi-placement test (2 Notepads left+right, 4 in quad) — not yet run.

## §5 Uncommitted (mirrors git status)
- M electron/electron-env.d.ts
- M electron/main.ts
- M electron/preload.ts
- M src/types/actions.ts
- U electron/windowLayout.ts
- M doc/journal.md (stub from last commit)

(`../../rccomponentsActionSequence` stray file deleted.)

### §5-PENDING (in flight — cleared on confirmation)
(none — DPI fix confirmed working)

## §6 Bootstrap order
1. electron/main.ts, electron/preload.ts, electron/electron-env.d.ts, electron/windowLayout.ts
2. src/types/actions.ts, src/pages/Library.tsx, src/pages/Builder.tsx
3. package.json, tsconfig.json, vite.config.ts (only if needed)

## §7 Update rules
Update when: "checkpoint" / "sync" / "commit" | bug found/fixed/abandoned | decision made/reversed | sub-task verified.
Delete entries once committed AND documented in context.md.