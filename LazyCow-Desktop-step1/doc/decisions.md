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
## 2026-10-11 — Every runtime field must be in the sync-hotkeys payload
- **Decision:** Any field the runtime reads on a hotkey-triggered shortcut run must be present in the `sync-hotkeys` IPC payload. The `shortcutById` map in main is the sole source of hotkey-run data; it is populated only from that payload.
- **Alternatives:**
  - Have main re-read `lazycow-shortcuts` from localStorage directly — rejected. Main would have to duplicate the renderer's storage schema and migration logic, and would drift over time.
  - Have the hotkey handler round-trip to the renderer to fetch the current shortcut — rejected. Adds an IPC hop per hotkey fire and creates a race (the renderer might not be focused).
  - Send the entire `SavedShortcut` object through the sync payload — this is what we're doing now, we just forgot one field. Reinforces the rule: keep the payload shape in lockstep with `SavedShortcut`.
- **Why:** Hotkey runs and Library runs are two paths to the same runtime function. Any field that exists on one path but not the other creates silent divergence — the same shortcut behaves differently depending on how the user triggered it. That is the most user-confusing class of bug: "it worked when I clicked Run, why doesn't the hotkey work?"
- **Consequence:**
  - New rule in `context.md` §6 (rule 30).
  - When adding a new field to `SavedShortcut`, add it to the sync payload at the same time.
  - The 5 `syncHotkeys` call sites in `Library.tsx` are the canonical write points for this payload.
- **Status:** active

## 2026-10-11 — Pre-snapshot must run in Node, before the action loop
- **Decision:** The "which windows existed before this shortcut fired" snapshot is captured by the Node main process in `snapshotHandles()`, awaited by `runShortcutActions` **before** the action loop begins, and passed as a `Set<string>` through `arrangeWindows` into `buildScript`.
- **Alternatives:**
  - **In-script snapshot.** PowerShell's `SnapshotVisibleWindows()` called at the top of `arrangeWindows`'s script. Tried; failed. PowerShell startup (~400ms) loses the race with the action loop — browser windows opened by the shortcut's first two actions are already on screen by the time the script's snapshot runs. They get classified as "old" and refused for placement.
  - **Snapshot after the action loop finishes.** Rejected — by then the layout engine has already started (it fires in parallel). No help.
  - **Per-placement snapshot with a delay.** Rejected — arbitrary, unprincipled, and would still race slow browsers.
- **Why:** The snapshot's entire purpose is to say "these windows existed *before* the shortcut ran." Capturing it any time after the action loop starts defeats that purpose. Node can take the snapshot at t=0 (before the first `shell.openPath`) because `runShortcutActions` controls the sequence.
- **Consequence:**
  - New rule in `context.md` §6 (rule 31).
  - `snapshotHandles()` adds ~300–500ms to every layout-enabled shortcut run. Only paid when `shortcut.windowLayout?.enabled` is true.
  - The `existingHandlesCsv` string passed into the PowerShell script is sanitized to `[0-9,]` before interpolation.
  - `Find-Window` partitions candidates into `$new` (not in snapshot) and `$old` (in snapshot). `open_url` placements only consider `$new`.
- **Status:** active

## 2026-10-11 — `open_url` placements require a NEW window; Firefox is unsupported for multi-URL
- **Decision:** For `open_url` placements, the engine considers only windows that appeared **after** the pre-snapshot. Pre-existing browser windows are never touched, even if no new window appears. If the browser reused an existing window (URL opened as a tab), the placement becomes `not_found` and the browser is left alone. Title matching is used to disambiguate two URLs in the same browser. The UI notice in `WindowLayoutPanel` documents Firefox as unsupported for multi-URL layouts.
- **Alternatives:**
  - **Fall back to any matching window when no new one exists.** Tried; failed. This is the bug that grabbed the "Google Meet" window for the "google.com" placement.
  - **Match on process name only.** Tried; failed for the same reason — all Chrome windows share a process name.
  - **Match on process start time only.** Tried; no-op. Chrome (and modern browsers) reuse the parent process for new windows, so all windows have the same `ProcessStartTime`.
  - **Use `chrome.debugger` or Chrome DevTools Protocol to identify windows.** Rejected — requires elevated install or a companion extension, and Firefox has no equivalent.
  - **Fight Firefox's external-URL behaviour.** Rejected. No setting (`browser.link.open_newwindow`, `browser.link.open_newwindow.restriction`, or anything in `about:config`) reliably changes how Firefox handles URLs delivered via `ShellExecute`. This is Firefox's design choice, not a bug we can patch around.
- **Why:** The user's mental model is "I asked the shortcut to open google.com in the top-right zone — a window with google.com must appear there." Placing a pre-existing window (even a real google.com window from a previous session) violates the *this shortcut* contract. Not placing anything is more honest: the user sees "not placed" and understands the browser reused a window. Placing the wrong window feels like a bug even when it technically opens the URL the user requested.
- **Consequence:**
  - `Find-Window` for `open_url` placements returns `$null` if `$new.Count -eq 0` — even in the relaxed (fallback) pass.
  - A fallback pass after the main poll loop allows relaxed placement (title matching optional) but still requires a new window.
  - The UI notice in `WindowLayoutPanel` explicitly says Firefox is not supported and recommends a Chromium browser with the "New Tab New Window" extension.
  - Multi-URL layouts are verified only for Chromium-based browsers.
- **Status:** active
## 2026-10-12 — Test Hotkey is user-paced, no timer
- **Decision:** Test Hotkey is a three-step flow: click Test → button becomes Verify → user presses the combo at their own pace → click Verify to confirm. No timeout. Cancel link reverts to idle.
- **Supersedes:** The 4-second race in the original design.
- **Alternatives:**
  - 4-second timer (original) — rejected; hostile to slow users and puts the burden on typing speed rather than correctness.
  - 8-second timer — rejected; still arbitrary and still fails users on slower connections or unfamiliar combos.
  - Auto-verify when the combo fires — rejected; the user may want to press it multiple times to be sure, and auto-verify removes the explicit confirmation step.
- **Why:** The user's mental model is "I want to confirm this combo works on my machine". The 4-second window made the test feel like a reflex challenge. The button-flip-to-Verify model removes time pressure entirely and makes the user the authority on "did that fire?".
- **Consequence:**
  - New IPC lifecycle: `test-hotkey-start` / `test-hotkey-check` / `test-hotkey-stop` replace the single `test-hotkey` call.
  - The candidate combo stays registered until Verify or Cancel. Cancel and the unmount cleanup both call `test-hotkey-stop`.
  - Failure paths give specific errors: wrong combo pressed / OS swallowed it / nothing pressed.
- **Status:** active

## 2026-10-12 — Windows-rejected combos auto-add to Blocked Triggers
- **Decision:** When `globalShortcut.register()` returns false during a Test Hotkey run, the app adds the combo to `lazycow-blocked-triggers` (with a `lazycow-settings-changed` event so any open Settings panel refreshes), and explains: *"Windows won't let any app register 'X'. Added to Blocked Triggers — remove it from Settings if you've remapped this key at the OS level."*
- **Alternatives:**
  - Hardcode a list of Windows-reserved combos and reject at record time — rejected; we can't enumerate the OS's reservations reliably across versions and layouts. Better to discover empirically.
  - Show the error but don't persist — rejected; the user would hit the same wall next time they tried the combo.
  - Block the combo silently — rejected; the user would be confused about why their picker refused input.
- **Why:** Two design goals. (1) Discover what Windows will accept empirically, using the OS as the source of truth. (2) Surface the fact in a durable place the user can find later — Blocked Triggers. The user can also *unblock* the combo if they've remapped it at the OS level (e.g. Autohotkey), which wouldn't work if we hardcoded the reservation.
- **Consequence:**
  - `Builder.handleTestHotkey` writes to `lazycow-blocked-triggers` on `registration-rejected`.
  - `SettingsBlockedTriggers` listens for `lazycow-settings-changed` with key `blockedTriggers` and re-reads storage.
  - The migrated `Ctrl + Alt + Delete` naming and the alias table (`KEY_ALIASES`) prevent duplicate-looking entries where the same combo appears twice with different key names.
- **Status:** active

## 2026-10-12 — Page Zoom is a first-class setting
- **Decision:** `Settings → Appearance` gains a **Page Zoom** dropdown (50%–200%), and `Ctrl + +` / `Ctrl + -` / `Ctrl + 0` work globally. The zoom factor persists in `lazycow_settings.zoomFactor`. Shortcuts are handled in `main.ts` via `before-input-event` by physical key code, not in the renderer.
- **Alternatives:**
  - Chromium's built-in zoom handlers — rejected; they don't fire reliably across keyboard layouts (`+` is Shift+= on US, different on UK/Bengali).
  - Renderer-side keyboard handling — rejected; keystrokes get intercepted by the hotkey recorder and ComboBuilder before they reach the zoom handler.
  - Rely on window resize instead of zoom — rejected; users resize windows for layout reasons, not for reading comfort. Browsers separate these concerns and so should we.
- **Why:** Users who work on high-DPI displays or who sit further from the screen expect a zoom control. Every browser has one. Consistency with user expectations is worth the ~100 lines.
- **Consequence:**
  - New IPC: `get-zoom-factor` / `set-zoom-factor`, plus a `zoom-changed` event for the renderer.
  - Zoom is skipped while `isRecordingHotkey` is true, so pressing `Ctrl + +` during recording captures the combo instead of zooming.
  - Zoom factor is applied on app mount via `Settings.tsx`, read from `lazycow_settings.zoomFactor`.
  - Does not affect the window layout engine — that uses physical pixel coordinates from `windowLayout.ts`, independent of renderer zoom.
- **Status:** active

## 2026-10-14 — App Drawer uses OS discovery, not the file picker
- **Decision:** The `launch_app` action's "Select App" opens the App Drawer — a grid of every launchable app the OS exposes. Discovery merges five sources (Start Menu `.lnk`, Get-StartApps, App Paths registry, Uninstall registry, six virtual shell entries). File-picker fallback moves to "Add app → Add to drawer / Use once".
- **Alternatives:**
  - Keep the old Browse-to-.exe picker — rejected. Non-technical users don't know where their apps live; navigating Program Files is hostile. Every comparable tool (Raycast, PowerToys Run, Steam) shows installed apps, not a file browser.
  - Get-StartApps only — rejected. It misses ~93 of 103 entries on the test machine because AppIDs come in shapes we can't resolve without extra work. Start Menu `.lnk` scan is more reliable as the primary source.
  - Registry-only (Uninstall key) — rejected. It includes redistributables and MSI entries that aren't launchable.
  - File picker only, no drawer — rejected. It's what we had; it's the problem.
- **Why:** A user picking an app expects to see their apps. That's the mental model. Any discovery mechanism that ships fewer than "everything Windows shows in the Start menu" fails that expectation.
- **Consequence:**
  - Five source scan runs on app start in the background and caches for the session.
  - Icons extracted to `%APPDATA%\LazyCow\app-icons\`; extraction is the slow part (1–3s first run), caching makes it instant after.
  - `kind: 'exe' | 'uwp' | 'shell'` — three launch paths in `runAction`.
  - Three validators must skip `shell:`-prefixed values.
  - File picker still exists for portable apps, but only reachable via the "Add app" menu.
- **Status:** active

## 2026-10-14 — System components auto-hide by default
- **Decision:** `isLikelySystemComponent(name)` marks VC++ redistributables, .NET runtimes, Windows SDKs, DirectX, XNA, Silverlight, WebView2 runtime, Java runtimes, and "Additional/Minimum Runtime" entries with `system: true`. These are hidden by default on first run. The user can unhide any of them from the hidden-apps modal.
- **Alternatives:**
  - Show everything — rejected. The test machine exposes ten VC++ redistributables and multiple .NET runtimes. Shown alongside Chrome and VS Code, they dominate the grid. Non-technical users see a wall of noise and cannot find their browser.
  - Filter them out entirely — rejected. A power user debugging a runtime issue may genuinely want to launch `wmic` or a specific redistributable-installed tool. Hiding keeps the door open.
  - Ask the user on first launch — rejected. Adds a modal at the worst moment (first-run setup). The heuristic is safe enough to be quiet.
  - Let the user check a box during install — rejected. Same reason as above, and there's no installer step in dev.
- **Why:** A user picking an app to launch a shortcut is thinking about their tools, not their dependencies. A redistributable exists to support another app; it is not something a normal user opens. Hiding them by default respects the user's attention budget — Apple's "Purpose" principle, Windows Fluent's "show the common path first."
- **Consequence:**
  - Heuristic matching is name-based, deliberately narrow. "Microsoft Visual Studio" and "Microsoft Edge" must not match; the patterns are tested against the current Start Menu list before shipping.
  - `system: true` apps start in the hidden state unless the user explicitly unhides them (tracked in `visibleSet`).
  - The badge in the hidden modal labels them **System** so the user understands why they were hidden.
  - Adding a new pattern later is safe as long as it doesn't false-positive on a real user app. Rule of thumb: if you'd want to see the entry in a shortcut you're building, don't match it.
- **Status:** active

## 2026-10-14 — Design direction: Windows Fluent, with an Apple-grade motion layer
- **Decision:** The app's visual identity is Windows 11 Fluent, done well. Coffee / Ocean / Forest remain as user themes but are no longer designed as co-equal first-class options — the defaults are Fluent with the system accent. On top of this, we add a motion layer built on `motion` (Framer Motion v11), using springs, interruptible transitions, momentum projection, and anchored modal origins. Motion is renderer-only — no changes to `main.ts`, `windowLayout.ts`, or execution logic.
- **Alternatives:**
  - Keep the current look-and-feel — rejected. The app reads as "a competent tool with no personality." Cards with gradients, `label-caps` everywhere, dead hover feedback, zero motion. Useful but not loved.
  - Adopt Apple's visual vocabulary wholesale — rejected. The Apple Design skill file is a strong reference for behavior (springs, interruptibility, spatial consistency) and a poor fit for visuals on a Windows-only app. Translucent Mica-like materials and vibrancy-over-blur text tricks are Apple's answer to a problem Windows already solved differently (Fluent elevation, Acrylic for overlays). Using Apple's visuals on Windows reads as cosplay, not quality.
  - Four co-equal themes, each fully designed — rejected. Four equally-considered themes means none of them is the identity. Users can't build a mental model of "what LazyCow looks like."
  - Motion-lite (CSS transitions with better easing) — rejected. CSS transitions can't be interrupted mid-flight; springs can. The whole point of the motion layer is that the app feels alive, and that requires physics, not curves.
- **Why:** The Apple file's own diagnostic criteria apply: an interface is fluid when motion starts from the current on-screen value, inherits velocity, projects momentum, and can be grabbed mid-flight. LazyCow has none of these. The visual language is a separate question, and Windows Fluent is the right answer for a Windows app — it's what users already know, it matches the OS, and it's our target platform.
- **Consequence:**
  - Phase 1 (motion layer) is the next session's scope: modal springs from trigger origin, hover spring lift on ShortcutCard, staggered drawer cells, progress ring settle, `prefers-reduced-motion` respect.
  - Phase 2 (visual reset): flat card backgrounds, Windows 11 two-layer shadow, one Acrylic overlay, radius + icon scale rhythm.
  - Phases 3–6 (typography, hero theme, micro-interactions, copy) are queued as a single mission after Phase 1 verifies the motion approach.
  - The rule from the Apple file we're adopting: no bounce on dialogs, menus, or informational surfaces. Bounce only on (a) drag-release, (b) explicit success celebration, (c) the hover lift on ShortcutCard where momentum is the user's own cursor arriving.
  - We do NOT adopt Apple's material system, fonts, or vibrational text-over-blur practices. Windows Fluent has its own answers; use those.
- **Status:** active

## 2026-10-15 — Modal entrance uses translateY, not scale
- **Decision:** The motion layer's modal entrance is an 8px upward slide (`y: 8 → 0`) plus opacity fade. Not a scale-in from 0.96.
- **Alternatives:**
  - `scale: 0.96 → 1` (the original Phase 1 plan). Tried; produced visibly choppy animations when hardware acceleration was OFF. Scale forces Chromium to resample the entire modal layer every frame under software rendering; translate is a cheap blit.
  - `scale` only when HW accel is on, `translateY` when off. Rejected — branches the animation primitive on a runtime setting, doubles the testing surface, and forces `usePrefersReducedMotion` and `useHardwareAcceleration` to be read in every animated surface. Not worth the complexity when translateY works well in both.
  - Opacity-only (no transform). Rejected as the default — motion is one of Phase 1's goals and pure fade loses the "arrived" feel. Kept as the reduced-motion fallback.
- **Why:** The visual difference between a 4% scale and an 8px translate is imperceptible to users at modal size. The performance difference under software rendering is large — scale is the more expensive primitive and it showed. Picking the cheaper primitive that feels identical is the correct trade.
- **Consequence:**
  - `MODAL_SCALE_FROM = 0.96` in `src/utils/motion.ts` replaced by `MODAL_OFFSET_Y = 8`.
  - AppDrawerModal's `initial` / `animate` / `exit` use `y` instead of `scale`.
  - This is now the default modal entrance primitive for all Phase 1 surfaces. Small popovers (PositionDropdown, HiddenAppsModal) may still use scale where the origin effect matters — that's a follow-up decision, not decided here.
- **Status:** active

## 2026-10-15 — Hardware acceleration is a user toggle, default OFF
- **Decision:** `app.disableHardwareAcceleration()` is no longer called unconditionally. A `preferences.json` in `userData` carries `hardwareAcceleration` (default `false`). The renderer exposes the toggle in Settings → General. Changing it requires an app restart — the value is read synchronously at module load, before `app.whenReady()`, and applied via `app.disableHardwareAcceleration()` only when the preference is `false`.
- **Supersedes:** The 2026-10-06 unconditional `disableHardwareAcceleration()` call. That decision is not undone; it's been promoted from hardcoded policy to a user preference.
- **Alternatives:**
  - Keep it unconditional (per `context.md` rule 12's letter). Rejected — rule 12 explicitly allows a user-facing toggle. The affected GPU class (frozen regions, colour tints, broken ClearType) is real but not universal. Making everyone pay the software-rendering tax to help one GPU class is the wrong default.
  - Default ON, users opt out. Tried this session; choppy UI on the affected machine. The "get the smooth default" instinct is correct in the abstract, but on a Windows-only app targeting a real hardware class, the affected machines are the ones that benefit most from the safe default. Default OFF matches the app's historical behaviour and its user base.
  - Apply without restart. Rejected — `disableHardwareAcceleration()` must be called before `app.whenReady()`; Chromium has already initialised its compositor by the time the setting could reach the renderer. A restart is a genuine hard requirement, not a shortcut.
- **Why:** The design goal is "an app that doesn't frustrate the user." Software rendering makes lists, cards, and scrolling perfectly smooth (they're already CSS-transition-based, no per-frame resampling); it only hurts animations using the expensive scale primitive. Flipping the default OFF and switching modal entrances to translateY gives us the best of both — smooth everywhere, no toggle dance, GPU users can opt in.
- **Consequence:**
  - `electron/preferences.ts` (new) — synchronous read/write helpers for `userData/preferences.json`.
  - `electron/main.ts` — reads preferences at module load; calls `app.disableHardwareAcceleration()` only when the preference is `false`. IPC: `get-hardware-acceleration`, `set-hardware-acceleration`, `relaunch-app`.
  - `electron/preload.ts` + `electron/electron-env.d.ts` — three new bridges.
  - `src/pages/Settings.tsx` + `src/components/SettingsGeneral.tsx` — new toggle + "Restart required" banner when `current !== boot`.
  - Dev-mode relaunch was broken — `app.relaunch()` kills the Electron binary, `vite-plugin-electron` sees the child exit and shuts down the Vite server, and the new Electron process loads a dead URL. Fix: in dev, spawn a detached `npm run dev` after a 2s port-release delay and `app.exit(0)`. Production keeps `app.relaunch()`.
  - `context.md` rule 12 should be amended at the next doc-sync — the "user-facing toggle" it references now exists; the "never remove the GPU workaround" instruction is satisfied by keeping it as the default-off state.
- **Status:** active

## 2026-10-15 — Shortcuts mirror to disk; localStorage is not durable storage
- **Decision:** Every write to `lazycow-shortcuts` also writes the same list to `userData/shortcuts.json` via a synchronous IPC call (`fs.writeFileSync`). On Library mount, if `localStorage` is empty but the disk file has data, we restore from disk into `localStorage` and return the list. New module `src/utils/shortcutStorage.ts` owns this — `persistShortcuts` / `readShortcuts` / `recoverShortcutsFromDiskIfEmpty`. All six write call sites in `Library.tsx` and `Builder.tsx` route through `persistShortcuts`.
- **Supersedes:** The implicit "localStorage is the storage" model that predated Session 14.
- **Alternatives:**
  - **Flush localStorage before exit.** Tried twice this session (`will-quit` handler with `event.preventDefault() + flushStorageData() + app.exit(0)`; then `flushStorageData()` before `app.exit(0)` in the relaunch handler). Both failed because vite-plugin-electron hard-kills the Electron child on Ctrl+C — no shutdown hook runs, `flushStorageData()` never fires. Then the "safe" version — `app.quit()` instead of `app.exit(0)` — fixed Ctrl+C but not `taskkill /f`, power loss, or antivirus force-quarantine. The class of bug can't be closed by shutdown handlers.
  - **Migrate to `electron-store`.** Considered and rejected — the library wouldn't eliminate the IPC layer or the recovery logic (both are ours regardless), and it introduces a dependency on a package with a history of API changes across versions. The atomic-write protection it offers isn't the failure mode we hit.
  - **Do nothing, accept the risk.** Rejected — reproduced twice in one session with cold-cache timing. That's not a rare bug, that's a bug that hits any user who creates a shortcut and closes the app quickly.
- **Why:** `localStorage` is a browser cache, not a durable database. Chromium flushes it asynchronously (batched within a ~1–5s window). Any hard kill — Ctrl+C in dev, Task Manager force-quit, power loss, forced Windows Update — loses pending writes. User-authored data (shortcuts) can't sit on a mechanism that silently discards writes. `fs.writeFileSync` runs on the main process synchronously — the write either succeeds before the IPC reply goes back, or the process died before the call started. No middle ground.
- **Consequence:**
  - `electron/main.ts` — two new IPC handlers (`read-shortcuts-from-disk`, `write-shortcuts-to-disk`).
  - `electron/preload.ts` + `electron/electron-env.d.ts` — two new bridges.
  - `src/utils/shortcutStorage.ts` (new) — `persistShortcuts`, `readShortcuts`, `recoverShortcutsFromDiskIfEmpty`.
  - `src/pages/Library.tsx` — six `localStorage.setItem('lazycow-shortcuts', ...)` calls replaced with `persistShortcuts(...)`; new mount-time effect calls `recoverShortcutsFromDiskIfEmpty()` before `refreshShortcuts`.
  - `src/pages/Builder.tsx` — `handleSave` write replaced with `persistShortcuts(...)`.
  - Other localStorage keys (settings, blocked triggers, app visibility, etc.) are **not** mirrored. They're all low-stakes — losing a theme preference or a hidden-app flag is annoying, not data loss. Only user-authored content gets the disk treatment.
- **Status:** active

## 2026-10-15 — Exit paths use `app.quit()`, never `app.exit(0)`
- **Decision:** Every LazyCow-controlled shutdown path calls `app.quit()` and lets Chromium run its graceful shutdown sequence (which flushes `localStorage` on the way out). `app.exit(0)` is never called from any handler that could fire after user data might be pending.
- **Supersedes:** The `app.exit(0)` in the original `relaunch-app` handler (introduced in the HW-accel work). That handler killed the process before Chromium could flush, which caused the 2026-10-15 data-loss incident when the user clicked "Restart Now" within seconds of creating shortcuts.
- **Alternatives:**
  - `app.exit(0)` — Electron's hard-kill API. Skips `before-quit`, `will-quit`, and Chromium's own storage flush entirely. Rejected after the incident.
  - `app.exit(0)` with an explicit `flushStorageData()` first — tried; vite-plugin-electron can still yank the process mid-flush. Not reliable.
  - `process.exit(0)` — even worse; skips Electron's lifecycle entirely.
- **Why:** `app.quit()` is the graceful path. Chromium flushes pending writes, fires both quit events, and lets handlers clean up. `app.exit(0)` is the "I know what I'm doing" API — and we didn't. The disk mirror means `localStorage` flushing isn't load-bearing anymore, but the graceful path is still strictly better than the hard-kill path for anything else in the shutdown chain.
- **Consequence:**
  - `relaunch-app` in `electron/main.ts` — `app.quit()` at the end, not `app.exit(0)`. Dev path still spawns a detached `npm run dev` before quitting (so the Vite server is replaced cleanly), but the exit is graceful.
  - Any future handler that needs to terminate the app should call `app.quit()` and, if it needs a specific exit code, use `app.exit(code)` only after confirming nothing is pending. Default to `app.quit()`.
- **Status:** active

## 2026-10-15 — `will-quit` handler stays simple
- **Decision:** `app.on('will-quit', ...)` does exactly one thing: `globalShortcut.unregisterAll()`. No `event.preventDefault()`. No `flushStorageData()`. No `app.exit(0)`.
- **Supersedes:** The `will-quit` handler briefly added during Session 14's HW-accel work, which did `event.preventDefault() + await flushStorageData() + globalShortcut.unregisterAll() + app.exit(0)`. That handler **replaced Chromium's reliable flush with our async flush we couldn't guarantee**, and was a contributing factor to the data-loss incident.
- **Alternatives:**
  - `event.preventDefault()` + async flush + `app.exit(0)` — tried; the async flush has no timeout, so a hung flush hangs the quit. And the handler never runs at all in dev (vite-plugin-electron force-kills Electron first), so the whole structure was dead code that gave false confidence.
  - Full graceful `event.preventDefault()` + `await` + `app.quit()` on completion — arguably correct but adds a failure mode (hang on flush) for zero benefit given the disk mirror makes localStorage flushing non-load-bearing.
- **Why:** Chromium's own shutdown path handles the flush. Our job is to not interfere with it. The only thing we actually need to do at `will-quit` is unregister global shortcuts before the process exits — a synchronous cleanup that has no business being wrapped in `preventDefault()`.
- **Consequence:**
  - `app.on('will-quit', () => { globalShortcut.unregisterAll() })` — three lines, no async, no preventDefault.
  - Do not add to this handler without a specific reason. If a future feature needs a cleanup at shutdown that can't be done earlier, it belongs in `before-quit` with a matching `event.preventDefault()` + completion-check, not in `will-quit`.
- **Status:** active

## 2026-10-15 — `React.StrictMode` removed from main.tsx
- **Decision:** `src/main.tsx` renders `<App />` directly — no `<React.StrictMode>` wrapper.
- **Alternatives:**
  - Keep StrictMode on — rejected. React 18's dev-mode StrictMode deliberately double-mounts every component (mount → unmount → remount) to surface unsafe patterns. That double-mount is fine for most code, but it silently eats `motion`'s entrance animations: the first mount starts the animation, then the synthetic remount sees the element at its `animate` final state and does not replay it. Every surface in Design polish Phase 1 animates on mount; StrictMode would make all of them invisible in dev.
  - Keep StrictMode but work around the double-mount per animated surface — rejected as too invasive. Each surface would need its own `key` bump, its own `useEffect` to force `animate` on the second mount, or an `AnimatePresence` boundary. That's a lot of ceremony to preserve a dev-only check that's already served its purpose (catching unsafe patterns) over 13 prior sessions.
- **Why:** The tradeoff is: StrictMode's dev-only safety checks vs. the entire motion layer being invisible during development. Motion is now a first-class feature of the app — its dev experience matters more than StrictMode's warnings about code we've already vetted.
- **Consequence:**
  - `src/main.tsx` — `ReactDOM.createRoot(...).render(<App />)`.
  - Production was never affected by this — StrictMode's double-mount only happens in dev. Behaviour between dev and prod now matches, which is arguably a win in itself.
  - If a future session wants StrictMode back, the honest answer is "first prove the motion layer works with the workarounds, then re-add." Not yet warranted.
- **Status:** active

## 2026-10-15 — Motion `staggerChildren` pitfall: put the delay on the child
- **Decision:** When animating a grid or list where each child has its own entrance animation, the stagger **must** live on each child as `variants.{visible}.transition.delay`, computed per-index. Do not rely on the parent container's `transition.staggerChildren`.
- **Alternatives:**
  - Parent `staggerChildren` + `variants` on the parent, children with no `initial`/`animate` — works only if children are pure motion wrappers with no per-child animation logic. Not what our `ShortcutCard` is; it has its own dynamic classNames, hover behavior, and needs the reduced-motion decision at the child level.
  - Parent `staggerChildren` + children with only `variants` (no `initial`/`animate`) — motion propagates the parent's variant name to children if the children declare `variants` without their own animation props. This *should* work per the docs, but our first attempt gave every child `initial="hidden"` + `animate="visible"` (which are the props that opt the child out of parent orchestration) and the stagger silently did nothing. The failure mode is invisible — no console warning, no error, just every card appearing at once.
  - `useEffect` + `setTimeout` per index to fake the stagger — rejected; loses the spring physics of the sibling animation, and the timing is fragile.
- **Why:** Motion's parent-driven orchestration is convenient but has a specific opt-out rule that's easy to violate without noticing. The per-child `delay` approach is more code (one extra line per child) but is explicit, is debuggable, and can be capped (`Math.min(index, 8)`) so a long grid doesn't take seconds to reveal.
- **Consequence:**
  - `src/components/ShortcutCard.tsx` — `cappedStaggerIndex = Math.min(staggerIndex, 8)`; the `visible` variant carries `transition: { ...SPRING_ENTER, delay: cappedStaggerIndex * 0.15 }`. The parent Library grid is a plain `<div>` — no motion orchestration.
  - **For every future surface:** if a grid needs stagger, follow this pattern. Compute delay per child. Cap it. Reduce-motion reduces the delay to zero and swaps the spring for a fade. Do not put `staggerChildren` on the parent and hope it works.
  - The visible stagger for a 3-card grid lands as ~450ms of animation + 0.5s spring settle per card — feels intentional without holding the user up.
- **Status:** active
## 2026-10-19 — Typography switches to SF Pro / Segoe UI Variable
- **Decision:** Replaced all default UI fonts with `-apple-system`, `BlinkMacSystemFont`, `SF Pro Text`, and `Segoe UI Variable Text`. Monospace is now reserved *exclusively* for code (`font-code-sm`).
- **Alternatives:** Keep the old default system fonts. Rejected — the old `font-label-caps` was globally mapped to monospace, making buttons like "New Shortcut" look like terminal commands rather than native UI buttons.
- **Why:** Apple's SF Pro and Microsoft's Segoe UI Variable are the gold standards for native apps. They provide clear weight hierarchies and superior legibility at small sizes compared to the previous default stack. 
- **Consequence:** The app instantly feels more premium. Buttons and headers now use standard sans-serif weights instead of monospace.
- **Status:** active

## 2026-10-19 — SVG Inline Injection for Theme-Adaptive Branding
- **Decision:** The Sidebar and Splash screen logos are injected directly as inline `<svg>` elements in React, rather than loaded via `<img src="...">`.
- **Alternatives:** Use `<img>` tags with CSS filters (e.g., `dark:invert`). Rejected — CSS filters cannot accurately map to custom theme colors (like Ocean Cyan or Coffee Brown). 
- **Why:** Inline SVGs can use `fill="currentColor"` or `fill="var(--splash-bar)"`. This allows the logo to dynamically adapt to Windows Dark Mode and all three Custom Themes without needing multiple asset files.
- **Consequence:** The logo perfectly matches the theme accent. The `public/wordmark.svg` file is only used for marketing (README), not inside the app UI.
- **Status:** active
## 2026-10-20 — Synchronous settings storage for critical UI state
- **Decision:** Created `settings.json` in `userData` and a synchronous IPC bridge (`save-setting-sync`, `read-settings-sync`) to mirror theme, accent color, and app routing preferences. `index.html` reads from this disk store first before React hydrates.
- **Alternatives:** Rely on `localStorage` and flush on exit. Rejected — we already proved in the shortcut data-loss incident (2026-10-15) that dev-mode Ctrl+C and `taskkill /f` skip all shutdown hooks.
- **Why:** `localStorage` writes are async. Hard-killing the app right after changing a theme causes Chromium to lose the pending write. This is extremely frustrating for the user, as they have to set up their theme again. Synchronous disk writes guarantee the data survives any kill.
- **Consequence:**
  - New `src/utils/settingsStorage.ts` (`persistSetting`).
  - New IPC handlers in `main.ts` and bridges in `preload.ts`.
  - `index.html` splash screen script now queries `window.electronAPI.readSettingsSync()` before falling back to `localStorage`.
- **Status:** active

## 2026-10-20 — Splash screen uses `color-mix` for dynamic gradients
- **Decision:** The splash screen's Liquid Metal animation uses CSS `color-mix(in srgb, white X%, var(--splash-bar))` instead of hardcoded hex values for the gradient stops.
- **Alternatives:** Hardcoded gradients per theme. Rejected — caused severe theme intrusion bugs (e.g., the Coffee theme's liquid turning blue at the bottom, or the Windows accent bleeding into other themes).
- **Why:** The splash screen can be tinted by custom themes (Coffee, Ocean, Forest) or the Windows system accent color. `color-mix` allows the liquid to dynamically generate a metallic shine (light top, dark bottom) based purely on the active `--splash-bar` color, ensuring 100% cohesion with zero hardcoding.
- **Consequence:**
  - CSS variables `--splash-gradient` added to `index.html`.
  - Liquid always matches the theme (Brown for Coffee, Green for Forest, Blue for Windows).
- **Status:** active
  ## 2026-10-23 — Cloud Sanitization & Missing Path Hints
- **Decision:** When uploading a shortcut, local absolute paths (`open_file`, `open_folder`, `launch_app`) are stripped and replaced with an empty string. The uploader must provide a text `hint` for each of these actions (e.g., "Select your University folder"). 
- **Alternatives:** 
  - Upload raw paths (rejected: breaks instantly for other users).
  - Auto-discover paths on download (rejected: impossible to know what the user's local folder structure looks like).
- **Why:** A shortcut is useless if it points to `C:\Users\Tamjid\...` on someone else's machine. The `hint` bridges the gap between the uploader's intent and the downloader's file system, turning a broken shortcut into a "Needs Setup" state that the user can easily fix.
- **Consequence:** 
  - `ActionItem` interface gets a `hint?: string` field.
  - Downloading a shortcut with empty paths triggers the "Needs Setup" badge in the Library.
  - `Builder` needs a way to display the hint when editing a downloaded shortcut.
- **Status:** active (backend pending)

## 2026-10-23 — Auth Page uses Split-Screen & Focus Mode
- **Decision:** The Auth page uses a 45/55 split layout (Left: Value Prop, Right: Form). When the user clicks into an input, the left panel animates out of view (width 0%) and the form centers.
- **Alternatives:** 
  - Centered single-column form (rejected: boring, requires scrolling in windowed mode, doesn't show off the app's value).
  - Standard split-screen without focus mode (rejected: the left panel distracts from the task of logging in).
- **Why:** The split-screen shows the value of LazyCow Cloud while keeping the form compact. Focus mode removes all distractions and ensures the form is perfectly centered when the user is actually typing, which feels premium and native.
- **Consequence:** 
  - Auth layout uses Framer Motion `animate={{ width: ... }}` for fluid transitions.
  - Form container uses `my-auto` to prevent clipping in windowed mode (Create Account mode expands height without pushing the logo off-screen).
- **Status:** active

## 2026-10-23 — Account Dashboard uses Bento Grid + Modal Focus
- **Decision:** The Account page uses a Bento grid (different-sized cards) to establish visual hierarchy. Clicking a card opens it as a centered modal overlay with a dark backdrop (no blur, for performance).
- **Alternatives:** 
  - Standard grid of equal-sized cards (rejected: doesn't tell a story, everything feels equally important).
  - Navigating to a new page when clicking a card (rejected: loses context).
- **Why:** Bento grids are the modern standard for dashboards (Apple, Windows 11). The size of the box immediately tells the user what needs attention (e.g., "Action Required" is the largest). The modal focus expands the card, providing detailed context without leaving the dashboard.
- **Consequence:** 
  - `Account.tsx` uses Framer Motion `layoutId` or smooth `scale`/`opacity` for the modal. 
  - Backdrop blur is intentionally removed to prevent frame drops on low-end PCs.
  - Clicking outside the modal resets the dashboard to the equal-grid state.
- **Status:** active
## 2026-10-23 — Cloud Sanitization & Missing Path Hints
- **Decision:** When uploading a shortcut, local absolute paths (`open_file`, `open_folder`, `launch_app`) are stripped and replaced with an empty string. The uploader must provide a text `hint` for each of these actions (e.g., "Select your University folder"). 
- **Alternatives:** 
  - Upload raw paths (rejected: breaks instantly for other users).
  - Auto-discover paths on download (rejected: impossible to know what the user's local folder structure looks like).
- **Why:** A shortcut is useless if it points to `C:\Users\Tamjid\...` on someone else's machine. The `hint` bridges the gap between the uploader's intent and the downloader's file system, turning a broken shortcut into a "Needs Setup" state that the user can easily fix.
- **Consequence:** 
  - `ActionItem` interface gets a `hint?: string` field.
  - Downloading a shortcut with empty paths triggers the "Needs Setup" badge in the Library.
- **Status:** active (backend pending)

## 2026-10-23 — Auth Page uses Split-Screen & Focus Mode
- **Decision:** The Auth page uses a 45/55 split layout (Left: Value Prop, Right: Form). When the user clicks into an input, the left panel animates out of view (width 0%) and the form centers.
- **Alternatives:** 
  - Centered single-column form (rejected: boring, requires scrolling in windowed mode).
  - Standard split-screen without focus mode (rejected: the left panel distracts from the task of logging in).
- **Why:** The split-screen shows the value of LazyCow Cloud while keeping the form compact. Focus mode removes all distractions and ensures the form is perfectly centered when the user is actually typing, which feels premium and native.
- **Consequence:** 
  - Auth layout uses Framer Motion `animate={{ width: ... }}` for fluid transitions.
  - Form container uses `my-auto` to prevent clipping in windowed mode.
- **Status:** active

## 2026-10-23 — Account Dashboard uses Bento Grid + Portal Modals
- **Decision:** The Account page uses a Bento grid (different-sized cards) to establish visual hierarchy. Clicking a card opens it as a centered modal overlay rendered via `createPortal`.
- **Alternatives:** 
  - Standard grid of equal-sized cards (rejected: doesn't tell a story).
  - Standard modal without `createPortal` (rejected: caused background scroll leaks and clipping in windowed mode because it was bound to the `<main>` tag's overflow).
- **Why:** Bento grids are the modern standard for dashboards. `createPortal` is required to escape the `overflow-y-auto` of the main container and ensure the background locks properly without leaking.
- **Consequence:** 
  - `Account.tsx` uses `createPortal(..., document.body)` for all modals.
  - The background overlay uses solid `bg-background/90` instead of `backdrop-blur` to prevent rendering lag on low-end PCs.
  - Cards now feature an Info (i) button with hover tooltips and a click-to-open help modal to guide non-technical users.
- **Status:** active

## 2026-10-23 — Secured override tracking via `isSecuredCustom`
- **Decision:** `SavedShortcut` carries `isSecuredCustom?: boolean`. When `true`, `migrateShortcutsSecured` (Library mount) never overrides the stored `secured` value — the user's manual toggle is respected forever. When absent/false, migration recomputes `secured` from `hasDangerousActions(actions) && readSecuredShortcutsDefault()`.
- **Alternatives:**
  - Compute `secured` on every read (rejected: would silently flip the user's manual choice whenever a shortcut's actions changed — e.g. they turn secured OFF, edit an action, and it flips back ON because the default says so).
  - Store only `secured` and infer "was this manual?" from absence (rejected: absence also means "never set" for shortcuts that predate the field; can't distinguish "user explicitly turned it off" from "never touched").
- **Why:** The global `securedShortcutsEnabled` setting controls *defaults for new shortcuts*. It must not override an explicit user choice on an existing shortcut. Without `isSecuredCustom`, every Library mount would re-run migration and clobber the manual value if the shortcut's action set changed in a way that altered `hasDangerousActions`.
- **Consequence:**
  - `Library.handleToggleSecured` and `ConfirmSecuredModal.handleAllSafeConfirm` set `isSecuredCustom: true` on write.
  - `Builder.handleSave` reads `editData.isSecuredCustom` and only recomputes `secured` when it's false/absent.
  - `migrateShortcutsSecured` short-circuits any shortcut with `isSecuredCustom === true`.
- **Status:** active

## 2026-10-23 — Per-item sync spinners in Account Dashboard
- **Decision:** The Account page's "Sync Now" buttons (header + per-shortcut rows in the Sync Center modal) use a shared `syncingIds: Set<string>` state, keyed by `'__global__'` for the header and `String(item.id)` for each row.
- **Alternatives:**
  - A single `isSyncing` boolean (the pre-fix behavior, rejected: clicking one row spun the header button AND every other row's spinner simultaneously, because they all read the same flag).
  - A separate boolean per row via `Record<string, boolean>` (functionally similar; Set was simpler because we only ever ask "is this key spinning right now?").
- **Why:** The buttons represent independent actions, and users need to see which one they clicked start spinning and which ones haven't. A shared boolean made the whole sync panel look frozen on a single click.
- **Consequence:**
  - `handleSyncClick(e, targetId)` takes a per-target key.
  - Each button reads `syncingIds.has(myKey)` to decide its own spinner/text/disabled state.
  - When the mock `setTimeout` fires, only its own key is removed from the Set.
- **Status:** active
## 2026-10-25 — Cloud Sync Auth uses Supabase + Deep Linking
- **Decision:** Use Supabase for Auth and DB. Use custom protocol deep linking (`lazycow://auth/callback`) to handle Google OAuth in Electron.
- **Alternatives:** Local HTTP server (fragile, port conflicts), Auth0 (too expensive).
- **Consequence:** Need to handle `second-instance` and `open-url` in `main.ts` to catch the callback.

## 2026-10-25 — Path Sanitization saves filename as hint
- **Decision:** When uploading, strip absolute paths for `launch_app`, `open_file`, `open_folder` and save the filename (e.g., `chrome.exe`) as the `hint`. On download, if `value` is empty, search `discoverInstalledApps` for the `hint` and auto-resolve.
- **Why:** Users have different install paths. Auto-resolving saves them from manual setup 90% of the time.
## 2026-10-27 — Google OAuth uses Deep Linking with local fallback
- **Decision:** Auth redirects use `lazycow://auth/callback` for production, but fall back to `http://localhost:54321/auth/callback` for desktop flows where the browser needs a closure prompt.
- **Alternatives:** Using only the local server (fails if the app is closed) or only deep linking (leaves the browser spinning endlessly with no success message).
- **Why:** Deep linking ensures the OS routes the auth code to the app even if it's backgrounded, while the local server allows us to return an HTML success page that stops the browser spinner.
- **Consequence:** `main.ts` listens for both the protocol and the local server. Supabase requires both URLs in the Redirect URLs list.

## 2026-10-27 — Path Sanitization uses `hint` and existence checks
- **Decision:** Path-based actions carry a `hint` (filename). On upload, paths are preserved. On download, `hydrateDownloadedShortcut` checks if the path exists; if not, it clears the value and uses the `hint` to auto-resolve (for apps) or display a "Needs Setup" placeholder.
- **Alternatives:** Stripping paths on upload and forcing manual re-selection on every device.
- **Why:** Users restoring on the same device should get their exact paths back instantly. Users restoring on a new device should get a helping hand (auto-resolved app paths) or clear visual feedback.
- **Consequence:** `ActionItem` has `hint?: string`. `hydrateDownloadedShortcut` must be awaited before saving restored shortcuts.

## 2026-10-27 — Cloud Sync RLS Collision fallback
- **Decision:** If an upload fails with a Postgres RLS error (`42501`), the app assumes an ID conflict (e.g., logging in with Google vs Email) and generates a new `sc-<uuid>` ID, retrying the upload.
- **Alternatives:** Requiring users to manually delete and recreate shortcuts that collide.
- **Why:** Supabase's identity linking can sometimes assign a new user ID, leaving old shortcuts orphaned. Regenerating the ID is invisible to the user and fixes the collision instantly.
- **Consequence:** `uploadShortcutToCloud` returns a `SavedShortcut`. Callers must check if the ID changed and update `localStorage` if so.