# LazyCow — Handoff

Last updated: 2026-10-01
Last commit: d67bce4
Working tree: DIRTY (4 modified, 2 untracked — see §5)

## §1 Current Focus
Shortcut-level Window Layout **runtime engine** (Batch 2).
Batch 1 UI is shipped in d67bce4.
Engine file exists but is NOT VERIFIED end-to-end. DPI bug unresolved.

## §2 Sub-task State
### Done & verified
- Batch 1 UI: WindowLayoutPanel, LayoutThumbnail, PositionDropdown, per-card Position dropdowns, Library badge.
- Right-click context menu, rAF resize, backdrop-blur removal, RenameModal + ArrangeWindowsInput removal.

### Done in code, NOT verified
- electron/windowLayout.ts (engine file, compiles).
- IPC `arrange-windows-shortcut` wired in main.ts + preload.ts + electron-env.d.ts.
- Types WindowLayoutConfig / WindowLayoutRequest / WindowLayoutResult in src/types/actions.ts.

### Not started
- Batch 2c: call engine from runShortcutActions after action loop.
- Pass windowLayout from Library.tsx → runShortcut payload.
- Batch 3: overlay animation (deferred).

### Bugs / blockers
- **DPI bug (open).**
  Notepad moves but doesn't fill left half (1920×1080 @ 125%).
  Tried: SetProcessDPIAware() — no-op (PowerShell initialized GDI first).
  Next attempt: __COMPAT_LAYER=HIGHDPIAWARE env var on execFile + SetThreadDpiAwarenessContext in script.
  **Verify the fix actually landed in electron/windowLayout.ts before proceeding.**
  Backup plan: query physical pixels via GetSystemMetrics, bypass Windows.Forms.
- Compiled dist-electron/main.js has mangled registry paths in the windowLayout C# block (backslashes dropped by the build step). Source is correct; the built artifact is not. This is a build-step bug, not a source bug.

## §3 Last Verified Test
DevTools `window.electronAPI.arrangeWindowsShortcut({...})` for Notepad:
- Before temp-file fix: `not_found: "Could not parse engine output"`
- After temp-file fix: not retested.
- DPI fix applied: status unknown.

## §4 Open Questions
- Is __COMPAT_LAYER fix actually in the file? (verify)
- After DPI fix, does Notepad snap to full left half?
- Keep the `[windowLayout] raw stdout:` debug log or remove?

## §5 Uncommitted (mirrors git status)
- M electron/electron-env.d.ts
- M electron/main.ts
- M electron/preload.ts
- M src/types/actions.ts
- U electron/windowLayout.ts
- U ../../rccomponentsActionSequence (stray folder — investigate)

### §5-PENDING (in flight — cleared on confirmation)
(none)

## §6 Bootstrap order
1. electron/main.ts, electron/preload.ts, electron/electron-env.d.ts, electron/windowLayout.ts
2. src/types/actions.ts, src/pages/Library.tsx, src/pages/Builder.tsx
3. package.json, tsconfig.json, vite.config.ts (only if needed)

## §7 Update rules
Update when: "checkpoint" / "sync" / "commit" | bug found/fixed/abandoned | decision made/reversed | sub-task verified.
Delete entries once committed AND documented in context.md.