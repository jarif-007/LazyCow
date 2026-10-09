# LazyCow — Handoff

Last updated: 2026-10-09
Last commit: 7ed280c
Working tree: CLEAN

## §1 Current Focus
Session 7 shipped the **safety-warnings toggle** and the **`open_file` filter
fix** for the confirmation modal (commit `7ed280c`). Users can now turn off
safety warnings entirely — both the "Dangerous" badge on action cards and
the pre-run confirmation modal disappear when the setting is off.

No sub-task is currently in flight. Next pick from `missions.md`. Candidates
in rough priority order:
1. README accuracy pass (currently markets non-existent features)
2. Window Layout Overlay Animation (Batch 3)
3. Library & Settings responsive audit at 800–900px
4. Dependency cleanup (4 unused deps)
5. NFR Phases 4–6 (keyboard shortcuts, motion polish, perceived performance)

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
- **Not-Arranged App Visibility.** Unassigned launch-type actions are brought to front and centered on the primary monitor at their native size — no resize. `buildPlacementsFromShortcut` emits a placement for every arrangeable action, with `isUnassigned: true` for ones with no zone. New `Bring-Unassigned-Window` PowerShell helper does the centering + `ForceForeground`. Verified manually — Calculator (Not Arranged) now appears centered on top of Notepad (assigned Left).
- **Broken Path Fix UX (Q2b).** Clicking "Fix Paths" on a Library card now opens the Builder and auto-scrolls to + flashes the first broken action. `Library.tsx`'s `brokenShortcuts` is now a `Map<shortcutId, actionId>` (was `Set<shortcutId>`); the action id threads through `ShortcutCard.onEditFlow` → `App.handleEditShortcut` → `Builder.focusActionId`. Builder's effect retries up to 30× at 50ms intervals to handle the pre-commit render gap. Verified manually — Fix Paths lands the user on the broken action with a primary-colored ring for ~900ms.
- **Safety-warnings toggle + `open_file` modal filter fix.** New `showDangerWarnings` setting (default ON) in Settings → General. When OFF: the "Dangerous" badge on `run_script` / `launch_app` cards is hidden; the pre-run confirmation modal in Library is skipped; and the hotkey handler fires directly without the confirm round-trip. Builder and ActionSequence re-read the setting live via a `lazycow-settings-changed` custom event — no page reload. Separately fixed the confirmation modal's filter: `open_file` actions pointing at a dangerous extension (`.exe`, `.bat`, `.ps1`, etc.) now appear in the modal's item list as `Open: <path>` — previously the modal triggered but showed an empty list.
- **Safety-warnings toggle + `open_file` modal filter fix.** New `showDangerWarnings` setting (default ON) in Settings → General. When OFF: the "Dangerous" badge on `run_script` / `launch_app` cards is hidden; the pre-run confirmation modal in Library is skipped; and the hotkey handler fires directly without the confirm round-trip. Builder and ActionSequence re-read the setting live via a `lazycow-settings-changed` custom event — no page reload. Separately fixed the confirmation modal's filter: `open_file` actions pointing at a dangerous extension (`.exe`, `.bat`, `.ps1`, etc.) now appear in the modal's item list as `Open: <path>` — previously the modal triggered but showed an empty list.

### Done in code, NOT verified by user
- Broken-path hotkey refusal toast (the badge + Fix Paths chain is verified via Q2b)
- Test Layout button
- Test Flow button
- Info (i) popover content and positioning

- **Broken Path Fix UX (Q2b).** Clicking "Fix Paths" on a Library card now opens the Builder and auto-scrolls to + flashes the first broken action. `Library.tsx`'s `brokenShortcuts` is now a `Map<shortcutId, actionId>` (was `Set<shortcutId>`); the action id threads through `ShortcutCard.onEditFlow` → `App.handleEditShortcut` → `Builder.focusActionId`. Builder's effect retries up to 30× at 50ms intervals to handle the pre-commit render gap. Verified manually — Fix Paths lands the user on the broken action with a primary-colored ring for ~900ms.### Not started
- Batch 3 — overlay animation (deferred)
- Dependency cleanup (4 unused deps)
- README accuracy pass
- **Safety-warnings toggle + `open_file` modal filter fix.** New `showDangerWarnings` setting (default ON) in Settings → General. When OFF: the "Dangerous" badge on `run_script` / `launch_app` cards is hidden; the pre-run confirmation modal in Library is skipped; and the hotkey handler fires directly without the confirm round-trip. Builder and ActionSequence re-read the setting live via a `lazycow-settings-changed` custom event — no page reload. Separately fixed the confirmation modal's filter: `open_file` actions pointing at a dangerous extension (`.exe`, `.bat`, `.ps1`, etc.) now appear in the modal's item list as `Open: <path>` — previously the modal triggered but showed an empty list.

### Bugs / blockers
- (none blocking)
- Compiled `dist-electron/main.js` has mangled registry paths in the windowLayout C# block (backslashes dropped by the build step). Source is correct; the built artifact is not. Low priority.

## §3 Last Verified Test
Engine + claim-the-zone (Batch 2d) verified on 1920×1080 @ 125%:
- DevTools `arrangeWindowsShortcut({...})` for Notepad: `[{"zoneId":"left","status":"placed"}]` ✅
- Terminal: `SCREEN_DEBUG: area=0,30 1920x1050 BoundsW=1920x1080` ✅ (physical pixels)
- Terminal: `PLACE_RESULT: MoveWindow returned True` ✅
- Visual: Notepad fills left half, edge-to-edge ✅
- 4-app quad: `[{tl: placed},{tr: placed},{bl: placed},{br: placed}]` ✅

Not-Arranged App Visibility verified manually on 2026-10-06:
- Notepad (assigned Left) + Calculator (Not Arranged) → Notepad snaps to Left, Calculator appears centered on top.
- No resize applied to the unassigned window. Terminal confirms `UNASSIGNED_CENTER` fires.

Safety toggle verified manually on 2026-10-09:
- Toggle OFF → "Dangerous" badge hides in Builder without a reload.
- Toggle OFF → Library Run skips the confirmation modal.
- Toggle OFF → registered hotkey fires the shortcut directly.
- Toggle ON → all three revert.

End-to-end parallel-path verification from a saved shortcut is still pending.

## §4 Open Questions
- (none — the diagnostics-removal question is closed. `2e` shipped on
  2026-10-05; `SCREEN_DEBUG`, `PLACE_DEBUG`, and `PLACE_RESULT` are gone.
  `OCCUPIED_BY`, `PLACE_SKIP`, and `UNASSIGNED_CENTER` are kept.)

## §5 Uncommitted (mirrors git status)

Working tree: CLEAN. All Session 7 work committed and pushed.

Recent commits (most recent first):
- `7ed280c` feat: safety-warnings toggle + fix open_file filter in confirm modal
- `9ce9553` docs: log v2 roadmap missions (performance profile, workspace closer, text expansion)
- `5abcb88` docs: sync handoff — 2e complete; log boot-check stale-handoff issue
- `24db73a` docs: mark 2e complete in missions
- `3440424` docs: fill journal entry for windowLayout debug cleanup
- `da558bb` chore: remove debug stdout dump from windowLayout

### §5-PENDING (in flight — cleared on confirmation)
- (nothing pending)

## §6 Bootstrap order
1. electron/main.ts, electron/preload.ts, electron/electron-env.d.ts, electron/windowLayout.ts
2. src/types/actions.ts, src/pages/Library.tsx, src/pages/Builder.tsx
3. package.json, tsconfig.json, vite.config.ts (only if needed)

## §7 Update rules
Update when: "checkpoint" / "sync" / "commit" | bug found/fixed/abandoned | decision made/reversed | sub-task verified.
Delete entries once committed AND documented in context.md.