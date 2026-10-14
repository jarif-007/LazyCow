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