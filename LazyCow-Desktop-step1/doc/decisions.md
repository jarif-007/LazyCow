# LazyCow — Decision Log
Append-only. Never delete. Each entry: date, decision, alternatives, why, consequence, status.

## 2026-09-15 — Cancellation is graceful-only
- **Decision:** cancel-shortcut always finishes the current action, then stops.
- **Alternatives:** Immediate mode with taskkill (tried; killed unrelated windows).
- **Why:** taskkill /t /f kills the whole process tree, including unrelated Explorer windows.
- **Consequence:** cancel is slower but safe. UI shows "Cancelling..." spinner.
- **Status:** active

## 2026-09-28 — Window Layout is shortcut-level, not an action
- **Decision:** windowLayout is a property of SavedShortcut, not an arrange_windows action.
- **Alternatives:** Standalone action card in the sequence.
- **Why:** arrangement must run last; its UI needs global knowledge of eligible actions; users shouldn't have to remember ordering.
- **Consequence:** arrange_windows removed from catalog; old shortcuts fall back via unsupported-action flag.
- **Status:** active

## 2026-09-28 — No shift-to-nearest-zone on occupied slot
- **Decision:** if the assigned zone is occupied, the app goes to center-small (60%) — no shifting.
- **Alternatives:** Shift to nearest free zone.
- **Why:** shifting silently breaks the user's design. Center-small is predictable.
- **Consequence:** last-app-scavenge exception (only when an earlier app failed and left its zone free).
- **Status:** active

## 2026-09-28 — 7 layouts total (Windows 6 + quad)
- **Decision:** LAYOUTS includes split_50, split_67_33, split_33_67, thirds, main_left, main_right, quad.
- **Alternatives:** Windows' 6 only (no quad); or more layouts.
- **Why:** quad is standard Windows on 4K/ultrawide, and 4-app workflows need it. Cheap to add.
- **Status:** active

## 2026-10-01 — PowerShell via temp .ps1 file, not -EncodedCommand
- **Decision:** windowLayout.ts writes the script to os.tmpdir() and runs `powershell.exe -File`.
- **Alternatives:** -EncodedCommand (hit Windows CreateProcess length cap); `-Command -` via stdin (broke here-strings).
- **Why:** the script exceeds ~32 KB once the C# P/Invoke block is included. -File is the standard fallback.
- **Consequence:** context.md §6 rule about -EncodedCommand has an explicit exception for windowLayout.ts.
- **Status:** active

## 2026-10-06 — DPI awareness fix VERIFIED
- **Decision:** make PowerShell DPI-aware via `__COMPAT_LAYER=HIGHDPIAWARE` env var on execFile + `SetThreadDpiAwarenessContext(-4)` in script (PER_MONITOR_AWARE_V2). Plus `using System;` in the C# block for `IntPtr`.
- **Alternatives:** `SetProcessDPIAware()` alone (tried; no-op because PowerShell initialized GDI before the script runs).
- **Why:** the DPI-unaware PowerShell computed zone rectangles in virtualized coordinates (1536×864 on 1920×1080 @ 125%), causing partial placement.
- **Consequence:** VERIFIED — Notepad now snaps to the full left half. `SCREEN_DEBUG` reports `1920x1050` (physical) instead of `1536x864` (virtualized).
- **Status:** active

## 2026-10-06 — Block system helper windows from occupancy detection
- **Decision:** in `GetWindows`, blocklist known Windows system helper processes: `TextInputHost`, `ShellExperienceHost`, `SearchHost`, `StartMenuExperienceHost`, `LockApp`, `SystemSettings`, `SecurityHealthSystray`, `SystemSettingsBroker`, `Microsoft.YourPhone`. Also skip any window with `w <= 0 || h <= 0`.
- **Alternatives:** detect invisible overlays by transparency — unreliable, no public API.
- **Why:** `TextInputHost.exe` ("Windows Input Experience") covers the entire screen but is invisible to the user. The occupancy check flagged every zone as occupied, blocking placement.
- **Consequence:** Occupancy now reflects what the user actually sees. Extend the blocklist if more false positives surface.
- **Status:** active

## 2026-10-06 — Normalize single-object PowerShell JSON to array
- **Decision:** after `JSON.parse`, wrap bare objects in `[ ]` — `Array.isArray(parsed) ? parsed : [parsed]`.
- **Alternatives:** force PowerShell to always emit `@(...)` — brittle with `ConvertTo-Json`.
- **Why:** `ConvertTo-Json` collapses single-element arrays to a bare object, which broke `Array.isArray(parsed)` check.
- **Consequence:** single-placement tests now work.
- **Status:** active
## 2026-10-06 — Claim the assigned zone (supersedes "No shift-to-nearest")
- **Decision:** When a shortcut's Window Layout runs, every assigned app claims its zone unconditionally. Occupied zones are still claimed — the occupying window goes behind. Each placed window is brought to the front (`ForceForeground` via `AttachThreadInput` + `SetForegroundWindow`).
- **Supersedes:** 2026-09-28 "No shift-to-nearest-zone on occupied slot" (the old center-small fallback).
- **Alternatives:**
  - Fallback to center-small (old decision) — rejected because it broke the user's mental model. Users expect the shortcut's apps to land where they assigned them, like Windows Snap does.
  - Shift to nearest free zone — still rejected; silently violates design.
  - Minimize other windows — rejected as too destructive for a hotkey. Users would lose track of windows they had open, and accidental hotkey presses would be jarring.
- **Why:** A hotkey trigger is an explicit "I want my workspace now" action. Windows Snap itself overwrites whatever's in the target zone. Users already understand this pattern. Covering a window is trivially reversible (Alt+Tab / taskbar click); minimizing 30 windows is not.
- **Consequence:**
  - `windowLayout.ts` no longer falls back on occupancy — every placement is `placed` or `not_found`.
  - `Is-Zone-Occupied` renamed to `Log-Zone-Occupancy` — diagnostic only, logged on stderr.
  - `Place-Centered` removed.
  - Each app is un-minimized (`SW_RESTORE`) and brought to front via `ForceForeground`.
- **Status:** active
## 2026-10-06 — No per-app "stretch" toggle; use a UWP heuristic instead
- **Decision:** When placing a window, auto-detect UWP apps (`ApplicationFrameHost` or a known Windows shell process, or exe path under `WindowsApps`). UWP apps are centered at their native size. All other apps are stretched to fill the zone, matching Windows Snap. No user-facing toggle exists.
- **Alternatives considered:**
  - Ask the user, per app, whether to stretch (`layoutBehavior: auto|stretch|native` on the action).
  - Always stretch (matches Windows Snap, breaks Calculator's appearance).
  - Always native (unusable for Chrome / VS Code / Slack).
- **Why auto-heuristic:** UWP apps are exactly the ones that misbehave when stretched — their content doesn't scale. Win32 apps are exactly the ones that want to fill a zone. This split matches how users actually use these apps: focus apps (editor, browser, chat) want space; utility apps (Calculator, Settings, Photos) don't.
- **Why no toggle:**
  - The user's mental model is "I want Calculator on the left," not "should Calculator stretch?" Asking them to configure a technical behavior they haven't thought about is asking them to do the app's job.
  - The heuristic covers 90%+ of real apps. Building UI for the remaining 10% adds density, state, migration concerns, and testing overhead for a scenario we haven't actually seen.
  - Wait for real user complaints before building. If three users say "I want Calculator stretched," we add it. If nobody does, we saved the work.
- **Consequence:** Users who disagree with the heuristic move the window manually after placement, or remove it from the assigned zones. Acceptable trade-off for a prototype.
- **Status:** active
  
## 2026-10-06 — Layout engine fires in parallel with the action loop
- **Decision:** `runShortcutActions` creates the `arrangeWindows` promise *before* the action loop starts, so window placement happens concurrently with the remaining actions. The loop still emits progress events; the layout engine polls for windows independently and snaps each as soon as it appears.
- **Supersedes:** Implicit "runs after all actions fire" — earlier designs called the layout engine once the loop finished.
- **Alternatives:**
  - Run layout after the loop (original plan) — rejected because `delay` actions and slow launches pushed total runtime well past when the first window actually appeared.
  - Run layout synchronously between every action — rejected as too chatty; would re-poll for every placement on every tick.
- **Why:** Waiting for the loop to finish meant the user stared at a small, unarranged window for seconds. Firing in parallel snaps each window the moment it opens, cutting the "small window then snap" gap to near-zero.
- **Consequence:**
  - `layoutPromise = arrangeWindows(placements, budgetMs)` is created right after `runningShortcuts.add(...)`.
  - Cancelled shortcuts don't block on layout — the promise resolves in the background.
  - `lastLayoutResults` carries the result through to the `shortcut-complete` event.
- **Status:** active

## 2026-10-06 — Layout engine polls each placement individually
- **Decision:** Instead of one global poll loop that scans all windows and places them in a batch, each placement is polled independently and placed the moment its window appears. Warmup interval is 15ms for the first 800ms, then tapers to a maximum of 200ms.
- **Supersedes:** The "6s decaying interval" plan documented in the Batch 2 outline.
- **Alternatives:**
  - Single batch placement after all windows found — rejected; one slow launch delayed every placement.
  - Uniform 100ms poll for the full window — rejected; misses fast launches (Notepad appears in ~50ms).
- **Why:** Fast warmup catches freshly-shown windows before the user's eye registers the delay. Tapering after 800ms avoids burning CPU on shortcuts with long `delay` actions. A slow or failed launch never blocks the others — its placement just falls through to `not_found` at the deadline.
- **Consequence:**
  - `Find-Window` uses a `$usedHandles` set so two placements can't grab the same handle.
  - `estimateShortcutBudgetMs` sizes the poll window per-shortcut (5s base + per-action estimates, capped at 60s).
- **Status:** active

## 2026-10-06 — Retire launch_app's 800ms settle delay
- **Decision:** `SETTLE_TIME` is now an empty object — `launch_app` no longer pauses after `shell.openPath`. The 800ms wait that used to run between launching an app and moving to the next action is gone.
- **Alternatives:**
  - Keep the 800ms wait — rejected; the progress UI would show "waiting" long after the app was on-screen.
  - Reduce to 200ms — rejected; still too slow, and still arbitrary.
- **Why:** The 800ms existed to make the progress ring match the app appearing. With per-placement polling, the engine snaps the window the moment it exists — the settle wait became pure latency.
- **Consequence:** Shortcut total runtime drops by ~800ms per `launch_app`. Progress UI now advances as soon as `openPath` returns.
- **Status:** active

## 2026-10-06 — User-judge replaces UWP heuristic as the primary mechanism
- **Decision:** The user-facing control for "this app shouldn't be auto-arranged" is the **"Not arranged"** option in the Position dropdown on each card. An action assigned to no zone still launches with the shortcut, but the layout engine skips it entirely.
- **Supersedes:** The 2026-10-06 "No per-app stretch toggle; use a UWP heuristic instead" entry (which treated the UWP heuristic as the only mechanism).
- **Alternatives:**
  - Add a separate per-action `skipLayout` flag — rejected; the empty assignment already conveys the same thing and requires no schema change.
  - Only the UWP heuristic, no user control — rejected; the heuristic misses some edge cases (Electron apps, custom Win32 tools) and users have no way to correct it.
  - Only user control, remove UWP heuristic — rejected; see #4's consequences below.
- **Why:** Users know their own apps. If Calculator looks wrong stretched, they shouldn't have to wait for us to expand a process-name allowlist — they unassign it and move on. The tooltip on the info button spells this out: *"Remove their Position assignment — they'll still launch, just not force-arranged."*
- **Consequence:**
  - `buildPlacementsFromShortcut` skips actions with no zone assignment.
  - `PositionDropdown` renders "Not arranged" as the top option (calls `onChange('')`).
  - `ActionSequence.assignZone` removes the action from any zone it currently owns when the new zone is `''`.
  - The UWP heuristic in `windowLayout.ts` **stays** as a graceful fallback for users who *do* assign UWP apps: those windows are centered at native size instead of stretched, so a mis-assignment is less visually jarring.
- **Status:** active

## 2026-10-06 — Broken-path pre-flight runs at Library load and on window focus
- **Decision:** `Library.tsx` runs a debounced (250ms) broken-path check across every shortcut's path-based actions whenever `shortcuts` changes, and again whenever the window regains focus. Any shortcut with at least one missing file or folder goes into `brokenShortcuts`, which greys the Run button and shows the "Broken Path" badge.
- **Alternatives:**
  - Check only on mount — rejected; a file deleted while LazyCow is running would be missed.
  - Check on every render — rejected; hammers IPC on rapid state changes.
  - Don't check at all, rely on the OS error at runtime — rejected; the user gets no warning, the shortcut fails mid-sequence, and the log message is generic.
- **Why:** Returning from Explorer after fixing a file should refresh the badge without a page reload. The window-focus hook covers exactly that case, and the debounce keeps the check cheap.
- **Consequence:**
  - Hotkey-triggered runs also pre-flight via `findFirstBrokenPath` in `main.ts` — a native toast shows the first missing path and refuses to run.
  - `ShortcutCard`'s "Fix Paths" button routes the user to the Builder instead of running the shortcut.
- **Status:** active

## 2026-10-06 — Test Layout and Test Flow are distinct previews with different scopes
- **Decision:** Two separate preview buttons in the Builder. **Test Layout** filters the sequence to arrangeable actions only (`launch_app`, `open_url`, `open_folder`, `open_file`), runs them through the real `runShortcut` IPC, and applies the configured layout. **Test Flow** runs the entire sequence end-to-end with the same validation gate as Save.
- **Alternatives:**
  - One button with a mode toggle — rejected; the toggle added friction and hid the intent.
  - Only Test Flow — rejected; layout previews would fire scripts and side-effecting actions on every iteration.
  - Only Test Layout — rejected; no way to verify the whole flow without saving it first.
- **Why:** The two use cases are genuinely different. "Will my windows land right?" should be fast and side-effect-free. "Does this whole thing work?" should exercise every action like a real run. Merging them makes layout iteration painful.
- **Consequence:**
  - Test Layout lives inside `WindowLayoutPanel` (context-scoped).
  - Test Flow lives in the Builder footer next to Save (shortcut-scoped).
  - Both generate synthetic shortcut IDs (`test-layout-<ts>` / `test-flow-<ts>`) so they never collide with saved shortcuts.
  - The info (i) button next to Test Layout documents the three-part story (what it does / when to use it / what to do if an app looks wrong).
- **Status:** active

## 2026-10-06 — Unassigned windows are centered at native size, never resized
- **Decision:** When a shortcut's Window Layout is enabled, every arrangeable action the user did **not** assign to a zone is brought to front and centered on the primary monitor at its current size. No resize. No "last position" memory.
- **Alternatives:**
  - Leave unassigned windows where Windows put them (initial behavior). Rejected — the user saw Calculator launch *behind* Notepad, which felt broken.
  - Bring to front only, no move (Option C from the diagnostic). Rejected — the user explicitly wanted centered, not last-position.
  - Center at 60% × 60% (the old center-small fallback). Rejected — resizing a window the user didn't ask to arrange violates "don't touch it" and can glitch on UWP apps that refuse resizes.
- **Why:** Users expect launched apps to be visible and predictable. "Centered at native size" is the least surprising behavior: it doesn't fight Windows' own positioning too much, doesn't resize, and lands every unassigned window in the same place.
- **Consequence:**
  - `buildPlacementsFromShortcut` emits a placement for every arrangeable action, with `isUnassigned: true` for unassigned ones.
  - `Bring-Unassigned-Window` in `windowLayout.ts` computes the primary monitor's center and calls `MoveWindow` unconditionally, then `ForceForeground`. No off-screen check.
  - Windows' "remember last position" behavior is intentionally overridden for unassigned apps in layout-enabled shortcuts. Apps that *are* assigned a zone still honor that assignment; only unassigned ones get centered.
  - UWP apps that refuse `MoveWindow` may ignore this and Windows may snap them to its own default — usually still centered, so the user sees what they asked for anyway.
- **Status:** active
## 2026-10-09 — Secured shortcuts are per-shortcut, not a global toggle
- **Decision:** Each shortcut carries its own `secured: boolean`. The runtime gate that decides whether to show a confirmation before running lives on the shortcut, not in a global setting. A global `securedShortcutsEnabled` still exists, but it only controls the *default* value for newly created shortcuts — it does not change existing ones.
- **Supersedes:** The 2026-10-09 `showDangerWarnings` global toggle introduced in `7ed280c`. That key is silently migrated to `securedShortcutsEnabled` on first load and deleted.
- **Alternatives:**
  - One global toggle for all shortcuts — rejected; users wanted per-shortcut control ("this one is fine to auto-run, that one needs confirming").
  - Per-shortcut toggle with no global default — rejected; new shortcuts would need manual enabling of `secured`, and users who want the safe default would have to set it every time.
- **Why:** The mental model is "this shortcut runs without asking, that one asks first" — a property of the shortcut, not of the app. The global setting is a *defaulting* concern, not a *runtime* concern. Conflating the two was what made the old toggle confusing.
- **Consequence:**
  - `SavedShortcut.secured?: boolean` added.
  - `syncHotkeys` payload carries `secured` per shortcut.
  - `Library` runs `migrateShortcutsSecured()` on mount — computes `secured` for any shortcut that predates the field, using `hasDangerousActions()`.
  - `ShortcutCard` menu gets a Secured toggle row + a "Secured" badge when on.
  - `Settings → General` has a "Secured Shortcuts" toggle that only affects *new* shortcut defaults.
- **Status:** active

## 2026-10-09 — Test Hotkey is mandatory before Save
- **Decision:** Save is gated on `hotkeyIsVerified`. The user must click Test Hotkey, press the combo, and see the "Verified" state before Save enables. The gate is per-combo — changing the combo invalidates the verification.
- **Alternatives:**
  - No gate — Save always allowed, trust the OS — rejected; Windows silently accepts `globalShortcut.register()` for combos it will never fire (see below).
  - Warn on save but allow — rejected; users clicked through the warning and shipped dead hotkeys.
  - Background-verify every combo — rejected; can't verify without the user physically pressing the keys.
- **Why:** On UK and Bengali keyboard layouts, certain combinations register successfully but never fire. `Ctrl + Alt + <digit>` and `Ctrl + Shift + <digit>` are the known cases — those layouts treat the digit row as a character composition layer, so the OS delivers the keystroke to the IME, not to `RegisterHotKey`. `globalShortcut.register()` returns true because it installed the hook; the OS just never routes to it. There is no API to detect this. The only reliable test is "make the user try it."
- **Consequence:**
  - New `test-hotkey` IPC in main: snapshots all registered shortcuts, `unregisterAll()`, registers only the candidate, races a 4s fire-promise against a timeout, restores the snapshot, returns `{ fired, reason }`.
  - Builder's Test Hotkey button also attaches a renderer `keydown` listener during the 4s window so it can distinguish four outcomes: correct combo fired / wrong combo pressed / correct combo but OS swallowed it / nothing pressed.
  - Each outcome shows a distinct error message so the user knows what to fix.
  - Editing an existing shortcut auto-verifies the loaded combo — the user doesn't have to re-test an unchanged value.
- **Status:** active

## 2026-10-09 — Per-action safety label is user-overridable
- **Decision:** `ActionItem.safetyOverride?: 'dangerous' | 'safe'` lets the user lock an action's safety label. When present, `getActionLabel(action)` returns it verbatim. When absent, the label is computed from `isDangerousAction(action)` (type + value based).
- **Alternatives:**
  - Computed-only classification — rejected; users couldn't tell the app "this specific `open_file` is fine" or "I know this script is dangerous, stop nagging."
  - Per-type override — rejected; too coarse. The whole point is per-*action*, not per-type.
  - A "reset to auto" button — rejected; once the user overrides, they've made a decision. Picking the other label is the only change. Adding a third state (auto / forced-dangerous / forced-safe) would triple the UI without adding value.
- **Why:** Classification of a specific action depends on context the app can't see — what the script does, who the user is, what they're comfortable with. "This `.exe` at this path is a tool I wrote" is a judgment call only the user can make. The override is the escape hatch for that judgment.
- **Consequence:**
  - `getActionLabel()` and `hasDangerousActions()` in `src/utils/danger.ts` are the only places that decide a label.
  - `SafetyChip` on each `SortableActionCard` is an inline dropdown: Dangerous / Safe. No "auto" option.
  - `ConfirmSecuredModal` shows the effective label per row and lets the user change it inline before confirming the run — staged edits persist on "Run Anyway."
  - `Builder.handleSave` uses `hasDangerousActions(sequence)` to decide the default `secured` for new shortcuts.
- **Status:** active

## 2026-10-09 — ComboBuilder is controlled; vocabulary matches the recorder
- **Decision:** `ComboBuilder` is a controlled component (`value` / `onChange`). It holds no internal state. `recordedCombo` in the parent (`Builder`) is the single source of truth. Recorder writes to it, ComboBuilder reads from it and writes back. No Set button. No Clear button. Changes apply on every click.
- **Supersedes:** The previous `onApply` / `onError` API where ComboBuilder held local state and pushed it on Set.
- **Alternatives:**
  - Keep `onApply` with explicit commit — rejected; the recorder and the picker had independent state, so the "which one wins?" question was ambiguous by design. Users couldn't tell what the actual combo was.
  - Auto-apply on change but keep an internal draft — rejected; same ambiguity, just hidden.
  - Add a Clear button — rejected; clearing means "no key", which is expressible by not picking one. The button was redundant.
  - Modifiers as a dropdown with `Ctrl`, `Ctrl+Alt`, etc. — rejected; can't express all 16 combinations and allows duplicates.
- **Why:** The previous design failed on three counts: (1) two surfaces could hold different values with no defined precedence, (2) the dropdown had a strict subset of the recorder's keys, so a user could record something they couldn't rebuild, (3) the Set button forced a "stage then commit" flow that doesn't match how the recorder works. Unifying to one value fixes all three at once.
- **Consequence:**
  - `ComboBuilder.tsx` is a full rewrite — modifier toggle chips (Ctrl/Alt/Shift/Win, no duplicates possible), grouped key dropdown (Letters / Number keys / Function keys / Symbols / Navigation / Special), live preview pill.
  - The key list covers everything the recorder can emit: A–Z, 0–9, F1–F24, all punctuation on the US layout, all navigation keys, all specials (Space / Return / Esc / Backspace / Delete / Tab).
  - Key labels show both forms where applicable (e.g. `5 / %`, `- / _`) so the user understands what Shift does — but the saved value is always the physical key.
  - Two call sites updated: `Builder.tsx` and `SettingsBlockedTriggers.tsx`.
  - Modifier chips allow all four simultaneously — no "at least one required" enforcement. F-keys and media keys can be hotkeys on their own.
- **Status:** active

## 2026-10-09 — useHotkeyRecorder records e.code, not e.key
- **Decision:** The recorder captures `e.code` (physical key) and normalizes it to a stable string (`KeyB` → `B`, `Digit5` → `5`). It never uses `e.key`.
- **Alternatives:**
  - Use `e.key` — tried; broke on UK and Bengali layouts, where `Shift + 5` produces the character `%` or the internal name `Clear`. `globalShortcut.register()` doesn't recognize `%` or `Clear` and silently refuses to fire the combo.
  - Use both and fall back — rejected; `e.key` is never the right answer, so there's nothing to fall back to.
- **Why:** `e.code` is layout-independent — it identifies the physical key. `e.key` is layout- and modifier-dependent — it identifies the character produced. The OS shortcut layer works in physical key terms, so the recorder must too.
- **Consequence:**
  - `useHotkeyRecorder.ts` normalizes before saving.
  - ComboBuilder's key vocabulary is defined in physical-key terms, so a combo captured by the recorder round-trips through the picker (and vice versa).
  - This fix is what makes the mandatory Test Hotkey gate meaningful — the recorder no longer produces combos that fail silently.
- **Status:** active
## 2026-10-10 — Test runs are cancellable and don't fire toasts
- **Decision:** Test Layout and Test Flow use synthetic ids (`test-layout-<ts>` / `test-flow-<ts>`) and are exempt from OS toast dispatch. Both are fully cancellable. Test Layout's cancel aborts the layout engine's child PowerShell process immediately; Test Flow's cancel is graceful-only (the current action finishes, then the loop breaks).
- **Alternatives:**
  - Let test runs show the normal completion toast — rejected; the user is already looking at the app, the toast says "LazyCow: test", and the frequency of layout iteration makes the noise disruptive.
  - Make Test Flow's cancel immediate — rejected; conflicts with the graceful-only rule (2026-09-15). Cancelling mid-`run_script` would require killing an arbitrary process tree, which is exactly what that decision was written to prevent.
  - No cancel at all — rejected; a poll that never finds a window (browser tab reuse) leaves the button in a running state for up to 60s.
- **Why:** Test runs are a preview from inside the app. The user's mental model is "I'm iterating on a layout" — they want fast feedback and a way to stop early if the preview isn't what they wanted. A native toast fights that; a cancel button supports it.
- **Consequence:**
  - `runShortcutActions` skips the notification dispatch when `shortcut.id.startsWith('test-')`.
  - Per-shortcut `AbortController`s in `layoutAbortControllers`; `cancel-shortcut` aborts the controller in addition to setting the graceful flag.
  - `runPowerShellScript` accepts an `AbortSignal` and passes it to `execFile` — child process is killed on abort.
  - `runningShortcuts.delete()` moved *after* the layout wait, so cancel requests arriving mid-wait are accepted by the cancel handler.
  - `Builder` splits `testRunning` into `testLayoutRunning` + `testFlowRunning` — each button tracks its own state.
- **Status:** active

## 2026-10-10 — Orphaned zone assignments are pruned at three layers
- **Decision:** A `windowLayout.assignments` entry is valid only if its `actionId` exists in the shortcut's current `actions`. Orphans are pruned at three points: when the user deletes an action (`Builder.deleteAction`); when a shortcut is loaded for edit (`Builder`'s `editData` useEffect self-heals legacy orphans); and when the assignment view-model is built or written (`ActionSequence.windowLayoutForCard`).
- **Alternatives:**
  - Prune only at delete — rejected; shortcuts saved before this fix still have orphans in localStorage, and they'd remain broken until the user happened to delete another action.
  - Prune only at load — rejected; doesn't help the current session (user deletes an action, immediately tries to assign a new one, still sees the stale lock).
  - Change the engine to *not* skip orphans — rejected; the engine can't do anything sensible with a zone that has no owner. The orphan has to be removed before the engine sees it.
  - Move assignment state out of the shortcut object into a separate store — rejected; too invasive for the problem.
- **Why:** The engine's silent `continue` on unknown zone ids was correct — an orphan is a data-integrity problem, not an engine problem. Pruning on the renderer side keeps the engine simple and puts the fix where the data actually lives. Three layers because any single layer leaves a hole (already-saved orphans, current-session orphans, and the write path).
- **Consequence:**
  - `Builder.deleteAction` prunes the deleted id from `windowLayout.assignments`.
  - `Builder`'s `editData` useEffect filters assignments against the loaded sequence; `baselineRef` uses the cleaned value so the form doesn't immediately look "dirty."
  - `ActionSequence.windowLayoutForCard` builds `liveAssignments` (filtered) for display and cleans orphans on `assignZone` write.
  - The layout engine's behavior is unchanged — orphans are simply never present when it runs.
- **Status:** active