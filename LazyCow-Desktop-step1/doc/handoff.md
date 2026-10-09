# LazyCow — Handoff

Last updated: 2026-10-09
Last commit: dc34b3c
Working tree: CLEAN

## §1 Current Focus
Session 8 shipped the **Secured Shortcuts** system, the **per-action
safety override**, the **mandatory Test Hotkey gate**, and a **ComboBuilder
rewrite**. This supersedes the Session 7 `showDangerWarnings` global toggle
— that key is now silently migrated to `securedShortcutsEnabled` on first
load, and per-shortcut `secured` is the real runtime gate.

Two commits, both pushed to `origin/Tamjid's-work`:
- `cfec1a6` feat(electron): test-hotkey IPC + secured-shortcut double-press runtime
- `dc34b3c` feat(renderer): secured shortcuts + per-action safety override + mandatory Test Hotkey

No sub-task is currently in flight. Next pick from `missions.md`. Candidates
in rough priority order:
1. **Manual runtime verification of Session 8** — Test Hotkey flow, secured
   double-press on minimized window, ConfirmSecuredModal filter + override,
   `securedShortcutsEnabled` migration on a profile that previously had
   `showDangerWarnings` toggled.
2. README accuracy pass (still markets non-existent features)
3. Window Layout Overlay Animation (Batch 3)
4. Library & Settings responsive audit at 800–900px
5. Dependency cleanup (4 unused deps)
6. NFR Phases 4–6 (keyboard shortcuts, motion polish, perceived performance)

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
- **Broken Path Fix UX (Q2b).** Clicking "Fix Paths" on a Library card opens the Builder and auto-scrolls to + flashes the first broken action. `brokenShortcuts` is a `Map<shortcutId, actionId>`; the action id threads through `ShortcutCard.onEditFlow` → `App.handleEditShortcut` → `Builder.focusActionId`. Verified manually.
- **Unsaved-changes baseline fix.** Editing a saved shortcut no longer fires the "Unsaved Changes" modal on navigate-away unless the form actually differs from the loaded snapshot.
- **`open_file` DANGEROUS badge.** Extracted `src/utils/danger.ts` with `DANGEROUS_EXTENSIONS` + `hasDangerousExtension` + `isDangerousAction` as a single source of truth shared by the Builder badge, the Library pre-run gate, and the confirmation modal.
- **Hotkey suppression while recording.** `set-hotkey-recording` IPC + `isRecordingHotkey` flag — pressing an already-assigned combo while recording no longer fires the existing shortcut.
- **Builder edit-state clearing on navigate-away.** `clearBuilderEditState()` in `App.tsx` resets `editShortcut`, `focusActionId`, and bumps `builderKey` — leaving Builder and returning always yields a fresh form.
- **`useHotkeyRecorder` `e.code` fix.** Records the physical key (`KeyB` → `B`, `Digit5` → `5`) instead of `e.key` so UK/Bengali shifted characters don't produce silently-unregisterable combos.

### Done in code — tsc-clean, manual runtime verification pending
Everything from Session 8. Both commits are pushed. `npx tsc --noEmit` is clean across the whole tree. What still needs a human at the keyboard:

- **Test Hotkey flow.** Click Test Hotkey, press the combo → "Verified" state appears; Save becomes enabled. Then: press the *wrong* combo → "Wrong key combo" message; press a shifted combo that Windows swallows (e.g. `Ctrl+Shift+5` on UK layout) → "This combo won't work as a hotkey on your keyboard" message.
- **Secured double-press on minimized window.** Secure a shortcut, minimize LazyCow, press its hotkey → native toast appears. Press again within the double-press window → shortcut runs. Click the toast → LazyCow restores + shows the confirm modal.
- **Secured confirm modal (focused window).** Press a secured hotkey while LazyCow is focused → modal appears. Filter All / Dangerous / Safe. Change a row's label to Safe. Click Run Anyway → staged overrides persist to the shortcut + sync to main.
- **All-safe prompt.** Mark every action safe in the modal → "Turn off Secured for this shortcut?" prompt appears. Confirm → shortcut's `secured` becomes false and future runs skip the modal.
- **`securedShortcutsEnabled` migration.** On a profile that previously had `showDangerWarnings: false`, opening Settings should set `securedShortcutsEnabled: false` and delete the legacy key. Verify the toggle reflects the migrated value.
- **`migrateShortcutsSecured`.** Existing shortcuts with no `secured` field get one computed from their actions on Library mount. Re-running Library doesn't re-migrate (idempotent).
- **`onShortcutStarted`** — subscribed in `Library.tsx`, exposed in `preload.ts`, declared in `electron-env.d.ts`, but **no `webContents.send('shortcut-started', ...)` exists in `main.ts`**. This is dead wiring; the defensive modal-close in Library never fires. Decide: either wire the send or remove the channel.

### Not started
- Batch 3 — overlay animation (deferred)
- Dependency cleanup (4 unused deps: `electron-store`, `react-router-dom`, `lucide-react`, `uuid`)
- README accuracy pass
- Library & Settings responsive audit at 800–900px
- NFR Phases 4–6
- Performance profile (hardware-adaptive timings) — deferred
- Workspace Closer — deferred
- Text expansion — deferred (v2)

### Bugs / blockers
- (none blocking)
- Compiled `dist-electron/main.js` has mangled registry paths in the windowLayout C# block (backslashes dropped by the build step). Source is correct; the built artifact is not. Low priority.
- `showDangerWarnings` key drift: `Settings.tsx` migrates the key away and deletes it, but `Builder.readShowDangerWarnings()` still reads the old name. After migration, Builder always reads `true` — the "hide Dangerous chip" behavior is effectively dead. Session 8's per-action `safetyOverride` partially compensates but the drift is real. Decide: remove the Builder read, or point it at `securedShortcutsEnabled`.

## §3 Last Verified Test
Session 8 — `npx tsc --noEmit` clean across the whole tree. Runtime verification pending (see §2).

Previously verified (still holds):
- Engine + claim-the-zone (Batch 2d) on 1920×1080 @ 125%
  - `SCREEN_DEBUG: area=0,30 1920x1050 BoundsW=1920x1080` ✅ (physical pixels)
  - `PLACE_RESULT: MoveWindow returned True` ✅
  - 4-app quad: `[{tl: placed},{tr: placed},{bl: placed},{br: placed}]` ✅
- Not-Arranged App Visibility — Calculator (Not Arranged) centered on top of Notepad (assigned Left) ✅
- Broken Path Fix UX (Q2b) — Fix Paths lands on the broken action with primary ring ✅
- Hotkey suppression while recording — recorder captures `Ctrl+B` without firing the existing shortcut ✅
- Unsaved-changes baseline — Edit Flow → leave without touching → no modal ✅
- Edit-state clearing — Edit Flow → Library → back to Builder → fresh blank form ✅

## §4 Open Questions
- `onShortcutStarted` channel: wire it or remove it? (Library subscribes for a defensive modal-close that never fires.)
- `showDangerWarnings` key drift in `Builder.tsx`: fix or remove? (See §2 Bugs.)
- `Builder.handleSave` reimplements `hasDangerousActions()` inline instead of using the shared helper — the inline version misses dangerous-extension `open_file`, so create-time and run-time classification can disagree. Fold into the shared helper?

## §5 Uncommitted (mirrors git status)

Working tree: CLEAN. Both Session 8 commits pushed to `origin/Tamjid's-work`.

Recent commits (most recent first):
- `dc34b3c` feat(renderer): secured shortcuts + per-action safety override + mandatory Test Hotkey
- `cfec1a6` feat(electron): test-hotkey IPC + secured-shortcut double-press runtime
- `576fe11` docs: fill journal entries for 4 bug fixes (unsaved changes, open_file badge, hotkey suppression, edit state)
- `49c1802` fix: clear Builder edit session when navigating away
- `5120ca5` fix: suppress global hotkeys while recording a new hotkey
- `8716ee7` fix: show DANGEROUS badge on open_file with dangerous extension
- `902fcfd` fix: only flag unsaved changes when Builder state differs from loaded shortcut

### §5-PENDING (in flight — cleared on confirmation)
- (nothing pending)

## §6 Bootstrap order
1. electron/main.ts, electron/preload.ts, electron/electron-env.d.ts, electron/windowLayout.ts
2. src/types/actions.ts, src/pages/Library.tsx, src/pages/Builder.tsx
3. src/utils/security.ts, src/utils/danger.ts, src/components/ConfirmSecuredModal.tsx
4. package.json, tsconfig.json, vite.config.ts (only if needed)

## §7 Update rules
Update when: "checkpoint" / "sync" / "commit" | bug found/fixed/abandoned | decision made/reversed | sub-task verified.
Delete entries once committed AND documented in context.md.