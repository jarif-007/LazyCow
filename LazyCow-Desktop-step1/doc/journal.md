# LazyCow — Change Journal
Auto-stubbed by `.githooks/post-commit`. AI fills in Issue/Solution/Files/Verified during checkpoint.
Never delete entries. Never reorder.

Format:
## YYYY-MM-DD — <commit subject>
- **Issue:** what raised this
- **Solution:** what we did
- **Files:** path (function/component)
- **Verified:** yes / no / partial
- **Commit:** <short hash>

---

## 2026-09-30 — docs: sync context.md — Window Layout feature, selection mode, dnd-kit rebuild, single-instance lock
- **Issue:** context.md had drifted from the actual code after the dnd-kit rebuild and Window Layout UI work.
- **Solution:** Rewrote §3–§7 to reflect the current component tree, the shortcut-level windowLayout feature, and Session 5 notes.
- **Files:** doc/context.md; plus (rolled into same commit) src/components/ActionSequence/*, src/components/WindowLayout/*, src/pages/Builder.tsx, electron/main.ts, src/types/actions.ts
- **Verified:** yes (tsc + eslint clean)
- **Commit:** d67bce4
## 2026-10-06 — chore: add session boot system (docs + boot.mjs + boot.bat + git hook)
- **Issue:** Sessions get suspended mid-work, losing context. New AI chats had no deterministic way to resume without pasting raw conversation transcripts.
- **Solution:** Added a 7-file boot system — voice.md, decisions.md, missions.md, handoff.md, journal.md, onboarding.md, and auto-generated SESSION_BOOT.md. A boot.mjs script assembles everything + git state into one clipboard-ready file. boot.bat provides one-click launch. A post-commit git hook auto-stubs this journal on every commit.
- **Files:** doc/voice.md, doc/decisions.md, doc/missions.md, doc/handoff.md, doc/journal.md, doc/onboarding.md; lazycoww/scripts/boot.mjs; lazycoww/boot.bat; lazycoww/.githooks/post-commit; lazycoww/jsconfig.json
- **Verified:** yes — boot.mjs writes to LazyCow-Desktop-step1/doc/SESSION_BOOT.md (~15000 tokens, all 7 sections populated). Hook fires on commit (stub auto-appended).
- **Commit:** 83d99a7

## 2026-10-06 — docs: fill in journal stub for boot system commit
- **Issue:** The previous commit's stub (83d99a7, boot system) had `(fill in)` placeholders that needed real content before they could be trusted as history.
- **Solution:** Filled the stub with issue/solution/files/verified for the boot system work.
- **Files:** doc/journal.md
- **Verified:** yes (routine documentation)
- **Commit:** bd40686

## 2026-10-06 — docs: add boot system workflow reference for contributors
- **Issue:** Teammates pulling the repo had no explanation of what each .md file in doc/ was for, or how the boot workflow operates. Needed a discoverable entry point.
- **Solution:** Added doc_helper.txt as a contributor-facing reference: what each .md does, what keywords the AI responds to ("checkpoint", "commit"), batch-paste workflow for new sessions, and troubleshooting tips. Gitignored SESSION_BOOT.md and touchlog.txt (build artifacts). Polished boot.mjs with --lite flag and proactive-suggestion meta-prompt. Updated voice.md and missions.md accordingly.
- **Files:** doc/doc_helper.txt (new); doc/.gitignore (new); doc/voice.md; doc/missions.md; lazycoww/scripts/boot.mjs
- **Verified:** yes — boot.mjs generates the boot file successfully in both normal and --lite mode. Hook stubs on commit.
- **Commit:** 89e4626

## 2026-10-06 — feat: Window Layout runtime engine — DPI fix verified, system windows filtered
- **Issue:** Window Layout engine couldn't place windows correctly. Notepad moved but never filled the target zone on 1920×1080 @ 125% display scaling. Root cause: PowerShell was running DPI-unaware, so it computed zone rectangles in virtualized coordinates (1536×864) instead of physical (1920×1080).
- **Solution:** Applied `__COMPAT_LAYER=HIGHDPIAWARE` env var when spawning PowerShell (via `execFile` options) + `SetThreadDpiAwarenessContext(-4)` (PER_MONITOR_AWARE_V2) at script top. Also added `using System;` to the inline C# for `IntPtr`. Normalized single-object `ConvertTo-Json` output to an array. Added system-window blocklist (`TextInputHost`, `ShellExperienceHost`, `SearchHost`, `StartMenuExperienceHost`, etc.) to stop invisible overlays from triggering false occupancy. Added zero-size window filter.
- **Files:** electron/windowLayout.ts; electron/main.ts; electron/preload.ts; electron/electron-env.d.ts; src/types/actions.ts
- **Verified:** yes — `SCREEN_DEBUG: area=0,30 1920x1050 BoundsW=1920x1080` (physical pixels confirmed). Notepad fills left half. MoveWindow returned True.
- **Commit:** 0e6a10b

## 2026-10-06 — feat(window-layout): claim assigned zones + bring to front (Batch 2d)
- **Issue:** The old engine fell back to center-small when a zone was occupied, which broke the user's design (apps didn't land where assigned). Users expected Windows Snap behavior — apps overwrite whatever's in the target zone.
- **Solution:** Removed occupancy blocking entirely. Every placement now claims its zone unconditionally. `Place-Window` calls `ShowWindow(SW_RESTORE)` (un-minimize) + `MoveWindow` + `ForceForeground` (via AttachThreadInput + BringWindowToTop + SetForegroundWindow). `Is-Zone-Occupied` renamed to `Log-Zone-Occupancy` (diagnostic-only). `Place-Centered` removed. Simplified main placement loop to `placed` or `not_found`.
- **Files:** electron/windowLayout.ts
- **Verified:** yes — 4-app quad grid on 1920×1080 @ 125%: all four Notepads fill their quadrants, all visible at once.
- **Commit:** 2143330

## 2026-10-06 — docs: fill journal stub for DPI fix commit
- **Issue:** The post-commit hook stubbed commit 0e6a10b with `(fill in)` placeholders that needed real content.
- **Solution:** Filled the stub with the DPI fix issue/solution/files/verified details.
- **Files:** doc/journal.md
- **Verified:** yes (routine documentation)
- **Commit:** 4d2d8d9

## 2026-10-06 — docs: fill journal stubs for DPI fix + Batch 2d commits
- **Issue:** Two prior commits (0e6a10b DPI fix, 2143330 Batch 2d) had `(fill in)` stubs at the bottom of journal.md.
- **Solution:** Filled both stubs with real issue/solution/files/verified content.
- **Files:** doc/journal.md
- **Verified:** yes (routine documentation)
- **Commit:** 79289b0

## 2026-10-06 — docs: sync handoff to post-DPI/Batch-2d state; fill journal stub
- **Issue:** handoff.md was stale (header said 89e4626, §2 didn't record DPI + Batch 2d as verified). Also needed to fill the previous commit's journal stub.
- **Solution:** Full replacement of handoff.md with current state (verified DPI fix + claim-the-zone behavior + quad grid test). Filled the 79289b0 journal stub.
- **Files:** doc/handoff.md (full rewrite); doc/journal.md
- **Verified:** yes (routine documentation)
- **Commit:** babb9cc
  
## 2026-10-06 — feat(window-layout): parallel engine, per-shortcut budget, per-placement polling
- **Issue:** The Window Layout engine ran once the action loop finished — so a shortcut with delays or a slow launch left the user staring at a small, unarranged window for seconds. The 800ms settle delay in `launch_app` added to that. And a single global poll loop meant one slow launch delayed every placement.
- **Solution:** `runShortcutActions` now creates the `arrangeWindows` promise *before* iterating actions, so arrangement happens concurrently with the remaining launches. `estimateShortcutBudgetMs()` sizes the poll window per-shortcut (5s base + per-action estimates, capped at 60s). Per-placement polling — 15ms warmup for 800ms → taper to a 200ms maximum — snaps each window the moment it appears. `SETTLE_TIME` retired; `launch_app`'s 800ms wait removed. `windowLayout` field added to `ShortcutSchema` and threaded through `runShortcut` from the renderer.
- **Files:** electron/main.ts (runShortcutActions, estimateShortcutBudgetMs, buildPlacementsFromShortcut, ShortcutSchema, completion toast); electron/windowLayout.ts (per-placement polling loop, Find-Window, Place-Window); electron/preload.ts; electron/electron-env.d.ts (layoutResults on onShortcutComplete)
- **Verified:** tsc clean. Engine end-to-end (Batch 2d) previously verified on 1920×1080 @ 125% — 4-app quad grid all placed. The parallel-run + budget path still needs a full end-to-end test from a saved shortcut.
- **Commit:** 8d10cc4

## 2026-10-06 — feat: broken-path pre-flight, Test Layout/Flow, richer completion toasts
- **Issue:** Shortcuts with missing files or folders failed mid-sequence with a generic log line, and the user got no warning before triggering one via hotkey. Test Layout and Test Flow had no UI surface at all. Completion toasts told you "done" or "failed" but nothing about layout placement.
- **Solution:** Library.tsx now runs a debounced (250ms) broken-path check on mount, on shortcuts change, and on window focus, feeding a "Broken Path" badge and a "Fix Paths" redirect on `ShortcutCard`. `findFirstBrokenPath` in main.ts refuses hotkey-triggered runs with a native toast naming the first broken path. Test Layout button added to `WindowLayoutPanel` (launch-type actions only, applies layout, no side effects). Test Flow button added to Builder footer (full end-to-end with the same validation gate as Save). Info (i) popover added next to Test Layout with a three-section explanation including the user-judge advice. Completion toasts append a layout summary (`3 of 4 apps placed`) and per-action failure lists. `useActionValidation` re-runs on window focus so inline errors refresh after the user fixes a path in Explorer.
- **Files:** src/pages/Library.tsx (broken-path pre-flight, layoutResults state); src/pages/Builder.tsx (handleTestLayout, handleTestFlow); src/components/ShortcutCard.tsx (Broken Path badge, Fix Paths button, layout results line); src/components/WindowLayout/WindowLayoutPanel.tsx (Test Layout button, info (i) popover); src/hooks/useActionValidation.ts (focus refresh)
- **Verified:** tsc clean. The individual UI surfaces have not yet been formally tested by the user end-to-end.
- **Commit:** 490588b

## 2026-10-06 — docs: sync boot files with Session 6 (parallel engine, broken-path, Test Layout)
- **Issue:** The boot files had drifted from the code after Session 6's Window Layout work — the engine was wired up and verified, but the docs still described it as "planned" and listed the center-small fallback (superseded by claim-the-zone).
- **Solution:** Full reconciliation across the five boot files. `context.md` updated for the parallel engine, per-shortcut budget, per-placement polling, user-judge mechanism, broken-path pre-flight, Test Layout/Flow, info (i) button, and richer toasts — plus two new §6 rules (21: user-judge via unassignment, 22: UWP heuristic is fallback only). `decisions.md` appended six new entries. `handoff.md` rewritten with the current state. `missions.md` ticked Batch 2 to COMPLETE and added Q2b, Not-Arranged App Visibility, README accuracy, and dependency cleanup missions. `journal.md` — this entry.
- **Files:** doc/context.md, doc/handoff.md, doc/missions.md, doc/decisions.md, doc/journal.md
- **Verified:** routine documentation. tsc clean on the code tree at commit time.
- **Commit:** 03e4d4f
## 2026-10-06 — fix(window-layout): center unassigned windows at native size
- **Issue:** Shortcut launches Notepad (assigned to Left) + Calculator (Not Arranged). Notepad snapped to Left and came to front; Calculator launched but appeared *behind* Notepad instead of on top. The engine only called `ForceForeground` on windows it *placed* — unassigned windows were never touched, so Windows decided their z-order, and it usually left them behind.
- **Solution:** `buildPlacementsFromShortcut` now emits a placement for every arrangeable action, with `isUnassigned: true` for ones with no zone (previously it only emitted assigned ones). The Zod schema in `main.ts` accepts the flag. New PowerShell helper `Bring-Unassigned-Window` in `windowLayout.ts` computes the primary monitor's center and calls `MoveWindow` at the window's current size, then `ForceForeground`. The polling loop branches on `isUnassigned`: assigned placements call `Place-Window` (claim the zone), unassigned ones call `Bring-Unassigned-Window` (center + bring to front, no resize).
- **Files:** electron/main.ts (WindowLayoutRequestSchema, arrange-windows-shortcut mapping, buildPlacementsFromShortcut); electron/windowLayout.ts (Placement.isUnassigned, ScriptPlacement.isUnassigned, arrangeWindows mapping, Bring-Unassigned-Window PowerShell helper, placement polling loop)
- **Verified:** yes — manual test: Notepad (assigned Left) + Calculator (Not Arranged). Calculator now appears centered on the primary monitor at its native size, on top of Notepad. No resize applied. Terminal logs `UNASSIGNED_CENTER` when the helper fires.
- **Commit:** 9a813e2

## 2026-10-06 — feat: auto-scroll Builder to the broken action when Fix Paths is clicked
- **Issue:** Clicking "Fix Paths" on a Library card routed the user into the Builder, but landed them at the top of the page — they had to hunt for the broken action manually. For shortcuts with long sequences, this was slow.
- **Solution:** `Library.tsx`'s `brokenShortcuts` changed from `Set<string>` (shortcut IDs) to `Map<string, string>` (shortcut ID → first broken action ID). The pre-flight loop already broke on the first broken action, so it just records which one. `ShortcutCard` accepts a new `brokenActionId` prop and passes it through `onEditFlow(shortcut, brokenActionId)`. `App.tsx`'s `handleEditShortcut` accepts the second arg and stores it in a new `focusActionId` state, plumbed to `Builder` as a prop. Builder's new effect retries up to 30× at 50ms intervals (React might not have committed the action cards to the DOM at effect time), then `scrollIntoView({ behavior: 'smooth', block: 'center' })` + flashes the card with `ring-2 ring-primary ring-offset-2 ring-offset-background` for ~900ms — matching the Flow Preview's click-to-jump flash.
- **Files:** src/pages/Library.tsx (brokenShortcuts Map, pre-flight loop, ShortcutCard render, LibraryProps signature); src/components/ShortcutCard.tsx (ShortcutCardProps interface, destructure, brokenActionId prop, Fix Paths button call); src/App.tsx (focusActionId state, handleEditShortcut, handleSaveSuccess, Builder render); src/pages/Builder.tsx (BuilderProps interface, destructure, focusActionId useEffect with retry loop)
- **Verified:** yes — manual test: click Fix Paths on a shortcut with a broken action → Builder opens → auto-scrolls to the broken action → flashes it with the primary-colored ring.
- **Commit:** f795b32

## 2026-10-05 — chore: remove debug stdout dump from windowLayout
- **Issue:** `windowLayout.ts` still logged the raw PowerShell stdout on every run — a "Temporary debug" line left over from the DPI and claim-the-zone debugging. The PowerShell template already had `SCREEN_DEBUG`, `PLACE_DEBUG`, and `PLACE_RESULT` removed in an earlier pass, but this JS-side `console.log` was missed.
- **Solution:** Deleted the two-line `console.log('[windowLayout] raw stdout:', ...)` block in `arrangeWindows`. Kept `OCCUPIED_BY`, `PLACE_SKIP`, and `UNASSIGNED_CENTER` — they fire on specific events (not every placement) and remain useful for future debugging.
- **Files:** electron/windowLayout.ts (arrangeWindows)
- **Verified:** yes — tsc clean. A/B tested: with the log removed, an assigned action still snaps to its zone and an unassigned action still centers at native size, on top. Toast reports `2 of 2 apps placed`. Terminal no longer prints `[windowLayout] raw stdout:`.
- **Commit:** da558bb

## 2026-10-09 — feat: safety-warnings toggle + fix open_file filter in confirm modal
- **Issue:** Two things. (1) Users who run their own scripts found the "Dangerous" badge and the pre-run confirmation modal to be friction — the dialog fires on every run, and the badge clutters the card. There was no way to opt out. (2) A separate bug: the confirmation modal correctly triggered for `open_file` actions pointing at a dangerous extension (`.exe`, `.bat`, `.ps1`, etc.), but the modal's `<span>` list only filtered `run_script` and `launch_app` — so a shortcut whose only dangerous action was such an `open_file` showed an empty warning box.
- **Solution:** New `showDangerWarnings` setting (default `true`) in Settings → General. When OFF: the "Dangerous" badge on `run_script` / `launch_app` cards is hidden; `Library.tsx`'s `runShortcut()` skips the confirmation modal and runs directly; the hotkey handler in `main.ts` skips the `hotkey-needs-confirm` round-trip. The renderer sends the current value to the main process on every `sync-hotkeys` call (`{ shortcuts, showDangerWarnings }` payload); `main.ts` caches it in `cachedShowDangerWarnings`. Builder and ActionSequence re-read the setting live via a `lazycow-settings-changed` custom event, so toggling in Settings takes effect without a page reload. Separately: hoisted `DANGEROUS_EXTENSIONS` to module scope in `Library.tsx`, added a `hasDangerousExtension(value)` helper, extended both the pre-run gate and the modal's item list to include `open_file` with a dangerous extension, and rendered those as `Open: <path>` instead of `Launch: <path>`.
- **Files:** src/components/SettingsGeneral.tsx (new toggle row); src/pages/Settings.tsx (default value + `lazycow-settings-changed` dispatch); src/components/ActionSequence/SortableActionCard.tsx (badge gating); src/components/ActionSequence.tsx (prop pass-through + `lazycow-settings-changed` listener for `autoScrollSpeed`); src/pages/Builder.tsx (reads `showDangerWarnings`, subscribes to `lazycow-settings-changed`); src/pages/Library.tsx (module-scope `DANGEROUS_EXTENSIONS` + `hasDangerousExtension`, gates the modal, updates three `syncHotkeys` call sites to the new payload shape, fixes the modal filter); electron/main.ts (`cachedShowDangerWarnings`, hotkey gate, `sync-hotkeys` accepts `{ shortcuts, showDangerWarnings }` while remaining backward-compatible with the legacy array shape); electron/electron-env.d.ts (`syncHotkeys` union type)
- **Verified:** yes — tsc clean. Manual: toggle OFF → badge disappears from Builder without reload; toggle OFF → Library Run skips the modal; toggle OFF → hotkey fires directly; toggle ON → all three revert. `open_file` filter fix: single-action shortcut with `open_file → notepad.exe` shows `Open: C:\...\notepad.exe` in the modal.
- **Commit:** 7ed280c

## 2026-10-09 — fix: only flag unsaved changes when Builder state differs from loaded shortcut
- **Issue:** Clicking "Edit Flow" on a Library card loaded the shortcut's data into Builder. The `hasUnsavedChanges` flag was computed as `name !== '' || desc !== '' || sequence.length > 0` — which was immediately true the moment the loaded form rendered. Navigating away fired the "Unsaved Changes" confirmation modal even though the user hadn't touched anything.
- **Solution:** Added a `baselineRef` that snapshots the loaded shortcut's state (name, description, hotkey, actions, windowLayout) when `editData` changes. When editing an existing shortcut, `hasUnsavedChanges` now compares the current form JSON against the baseline — so reverting an edit brings the flag back to false, and doing nothing keeps it false. New-shortcut behavior is unchanged (any content = unsaved). `handleDiscard` also resets the baseline to the blank state so abandoning an edit doesn't trigger a spurious prompt.
- **Files:** src/pages/Builder.tsx (baselineRef, editData useEffect, hasUnsavedChanges computation, handleDiscard)
- **Verified:** yes — manual: Edit Flow → leave without touching → no modal. Edit name → leave → modal appears. Edit name → change back → leave → no modal.
- **Commit:** 902fcfd

## 2026-10-09 — fix: show DANGEROUS badge on open_file with dangerous extension
- **Issue:** `open_file` actions pointing at a dangerous extension (`.exe`, `.bat`, `.ps1`, etc.) correctly triggered the confirmation modal in Library, but the action card in Builder showed no DANGEROUS badge. Two separate code paths had drifted: the badge condition in `SortableActionCard` only checked `run_script || launch_app`; the modal filter in `Library` had been updated to include dangerous-extension `open_file` but the badge logic hadn't.
- **Solution:** Extracted a new module `src/utils/danger.ts` with three exports: `DANGEROUS_EXTENSIONS` (module-scope array), `hasDangerousExtension(value)` (checks a file path's extension), and `isDangerousAction({type, value})` (returns true for `run_script`, `launch_app`, or `open_file` with a dangerous extension). Both the badge and the Library's pre-run gate + modal filter now consume the same helper — single source of truth, no drift possible.
- **Files:** src/utils/danger.ts (new); src/components/ActionSequence/SortableActionCard.tsx (badge condition uses isDangerousAction); src/pages/Library.tsx (removed local helper, imports from shared util, runShortcut gate and modal filter use isDangerousAction)
- **Verified:** yes — manual: `open_file` → `notepad.exe` shows DANGEROUS badge in Builder and modal in Library. `open_file` → `notes.txt` shows neither.
- **Commit:** 8716ee7

## 2026-10-09 — fix: suppress global hotkeys while recording a new hotkey
- **Issue:** While recording a new hotkey in Builder, pressing a key combination that was already assigned to another shortcut fired that shortcut instead of being captured by the recorder. Example: shortcut A has `Ctrl+B`; opening Builder to create shortcut B, clicking the recorder, then pressing `Ctrl+B` triggers shortcut A instead of capturing it.
- **Solution:** Added `isRecordingHotkey` flag in the main process. New IPC channel `set-hotkey-recording` toggles it. The hotkey callback in `registerHotkeys` returns early when the flag is set. `useHotkeyRecorder` calls `window.electronAPI.setHotkeyRecording(true)` when recording starts, `false` on stop. The hook's unmount cleanup also sets it to false so a mid-recording navigation can't leave hotkeys muted forever. Covers both Builder's hotkey field and Settings → Blocked Triggers (both use the same hook).
- **Files:** electron/main.ts (isRecordingHotkey flag, set-hotkey-recording handler, early return in registerHotkeys callback); electron/preload.ts (setHotkeyRecording bridge); electron/electron-env.d.ts (type declaration); src/hooks/useHotkeyRecorder.ts (start/stop toggles flag, unmount cleanup)
- **Verified:** yes — manual: create shortcut A with `Ctrl+B`; open Builder, start recording, press `Ctrl+B` — the recorder captures it, shortcut A does not fire. Stop recording, press `Ctrl+B` outside the recorder — shortcut A fires normally.
- **Commit:** 5120ca5

## 2026-10-09 — fix: clear Builder edit session when navigating away
- **Issue:** Clicking "Edit Flow" on a Library card loaded the shortcut into Builder. Navigating to another tab did not clear the `editShortcut` state — the existing `if (activeTab === 'builder') setEditShortcut(null)` in `handleTabClick` ran after `setActiveTab(tab)`, so it read a stale `activeTab`, and only fired for the "leaving with no unsaved changes" path. Returning to Builder re-hydrated the form with the old edit data, making it look like an edit was still in progress.
- **Solution:** Added `clearBuilderEditState()` helper that resets `editShortcut`, `focusActionId`, and bumps `builderKey`. `handleTabClick` now calls it whenever leaving Builder without unsaved changes. `handleConfirmLeave` (the "Leave Anyway" path) also calls the same helper instead of manually clearing each field. Every path that leaves Builder now guarantees a fresh form on return.
- **Files:** src/App.tsx (clearBuilderEditState helper, handleTabClick, handleConfirmLeave)
- **Verified:** yes — manual: Edit Flow → Library → back to Builder → fresh blank form. Edit Flow → modify → leave → modal → Leave Anyway → fresh blank form. Edit Flow → modify → modal → Stay → still editing the shortcut.
- **Commit:** 49c1802
