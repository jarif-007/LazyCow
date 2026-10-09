# LazyCow — Active Missions

## Mission: Window Layout (Batch 2)
Status: COMPLETE (Session 6)
- [x] 2a — IPC plumbing (committed d67bce4)
- [x] 2b.1 — electron/windowLayout.ts created
- [x] 2b.2 — rewire IPC handler in main.ts to call arrangeWindows
- [x] 2b.DPI — DPI fix verified end-to-end (Notepad snaps to left half on 1920×1080 @ 125%)
- [x] 2b.Multi — 4-app quad grid verified end-to-end (all placed, all visible)
- [x] 2d — claim-the-zone behavior verified end-to-end
- [x] 2c — engine fires from runShortcutActions, in parallel with the action loop
- [x] 2c.2 — windowLayout passed from Library.tsx → runShortcut payload
- [x] 2c.budget — per-shortcut time budget via estimateShortcutBudgetMs
- [x] 2c.poll — per-placement polling (15ms warmup → 200ms max)
- [x] User-judge — Position dropdown's "Not arranged" option is the primary control
- [x] Test Layout button + info (i) popover in WindowLayoutPanel
- [x] Test Flow button in Builder footer
- [x] 2e — remove SCREEN_DEBUG / PLACE_DEBUG / PLACE_RESULT diagnostics (kept OCCUPIED_BY, PLACE_SKIP, UNASSIGNED_CENTER)

**Blocker:** (none)

## Mission: Broken Path Fix UX (Q2b)
Status: COMPLETE
- [x] "Fix Paths" button in ShortcutCard routes to Builder AND auto-scrolls to + flashes the first broken action
- [x] `brokenShortcuts` in Library is now a `Map<shortcutId, actionId>` — the first broken action's id threads through `ShortcutCard.onEditFlow` → `App.handleEditShortcut` → `Builder.focusActionId`
- [x] Builder's effect retries up to 30× at 50ms intervals (handles the pre-commit render gap), then `scrollIntoView` + flashes the card for ~900ms
- [x] **Verified:** manual test — clicking Fix Paths lands the user on the broken action with the primary ring

## Mission: Not-Arranged App Visibility (bug)
Status: COMPLETE
- [x] **Symptom:** Shortcut launches Notepad (assigned to Left) + Calculator (Not Arranged). Notepad snaps to Left and comes to front. Calculator launches but appears **behind** Notepad instead of on top.
- [x] **Cause:** The engine only called `ForceForeground` on windows it *placed*. Unassigned windows were never touched, so Windows decided their z-order — and it often left them behind.
- [x] **Fix:** After the placement pass, every arrangeable action the user didn't assign is brought to front and centered on the primary monitor at its native size. No resize.
- [x] **Touches:** `main.ts` (`buildPlacementsFromShortcut` emits `isUnassigned: true` for unassigned actions, Zod schema accepts the flag); `windowLayout.ts` (`Placement.isUnassigned`, `ScriptPlacement.isUnassigned`, new `Bring-Unassigned-Window` PowerShell helper, loop branches on the flag).
- [x] **Verified:** manual test — Calculator (Not Arranged) appears centered on top of Notepad (assigned Left).

## Mission: Safety warnings toggle
Status: COMPLETE — ⚠️ SUPERSEDED by "Secured Shortcuts + Safety Override + Test Hotkey" (2026-10-09)
- [x] New `showDangerWarnings` setting (default ON) in Settings → General.
- [x] When OFF: hide the "Dangerous" badge on `run_script` / `launch_app` action cards; skip the pre-run confirmation modal in Library; skip the hotkey confirm round-trip in `main.ts`.
- [x] Builder and ActionSequence re-read the setting live via a `lazycow-settings-changed` custom event — no page reload needed.
- [x] `syncHotkeys` payload extended to `{ shortcuts, showDangerWarnings }`; main process caches the value in `cachedShowDangerWarnings`.
- [x] **Verified:** manual — toggle OFF → badge hides instantly in Builder; toggle OFF → Library Run skips modal; toggle OFF → hotkey fires directly. Toggle ON → all three revert.
- ⚠️ **Superseded 2026-10-09.** The `showDangerWarnings` key is silently migrated to `securedShortcutsEnabled` in `Settings.tsx` on first load; the main process no longer reads it. Per-shortcut `secured` is the runtime gate; per-action `safetyOverride` is the label control. See `decisions.md` (2026-10-09 entries).

## Mission: Secured Shortcuts + Safety Override + Test Hotkey
Status: COMPLETE (Session 8 — commits `cfec1a6` + `dc34b3c`)
- [x] **Per-shortcut `secured` flag** replaces the global gate. Runtime branches three ways: focused → confirm modal; minimized → toast + double-press; second press within window → run directly.
- [x] **`securedPendingFires` map** in `main.ts` tracks pending timestamps. `cachedSecuredDoublePressMs` reads the user's window (5–30s).
- [x] **`securedDoublePressSeconds` setting** (default 5) — number input in Settings → General.
- [x] **`securedShortcutsEnabled` setting** (default ON) — controls *new* shortcut defaults only; does not retroactively change existing shortcuts.
- [x] **Silent migration** `showDangerWarnings` → `securedShortcutsEnabled` in `Settings.tsx` on load; legacy key deleted.
- [x] **`migrateShortcutsSecured`** in `src/utils/security.ts` (new) — runs on Library mount; computes `secured` for any shortcut missing it; idempotent.
- [x] **Per-action `safetyOverride`** (`'dangerous' | 'safe'`) on `ActionItem` — user-locked label that survives value changes.
- [x] **`getActionLabel` / `hasDangerousActions`** in `src/utils/danger.ts` — override-aware, single source of truth for both the badge and the pre-run gate.
- [x] **`SafetyChip`** on each `SortableActionCard` — inline Dangerous/Safe dropdown.
- [x] **`ConfirmSecuredModal`** (new) — filter (All / Dangerous / Safe), per-row label editor, "all-safe → offer to turn off Secured" prompt. Staged edits persist on "Run Anyway."
- [x] **`ShortcutCard` menu** gets a Secured toggle row; card shows a "Secured" badge when on.
- [x] **`test-hotkey` IPC** in main — snapshot all, unregisterAll, register candidate, 4s race, restore. Returns `{ fired, reason }`.
- [x] **Mandatory Test Hotkey gate** — Save disabled until `hotkeyIsVerified`. Renderer keydown listener distinguishes 4 outcomes (correct+fired / wrong combo / correct-but-OS-swallowed / nothing pressed).
- [x] **`set-hotkey-recording` IPC** — suppresses global hotkey callbacks while the recorder is active.
- [x] **`useHotkeyRecorder` `e.code` fix** — records physical key (`KeyB` → `B`, `Digit5` → `5`), not `e.key`. Fixes UK/Bengali silently-dead digit combos.
- [x] **ComboBuilder rewrite** — controlled (`value` / `onChange`), modifier toggle chips, grouped key dropdown (Letters / Numbers / F1–F24 / Symbols / Navigation / Special), live preview pill. Both call sites updated.
- [x] **`npx tsc --noEmit` clean.**
- [ ] **Manual runtime verification pending** — Test Hotkey flow (four outcomes), secured double-press on minimized window, ConfirmSecuredModal filter + override persistence, `securedShortcutsEnabled` migration on a profile that had `showDangerWarnings: false`. See `handoff.md` §2.

## Mission: Security Warning modal `open_file` filter bug
Status: COMPLETE
- [x] `Library.tsx`'s `runShortcut()` correctly flags `open_file` with a dangerous extension as dangerous and shows the confirmation modal, but the modal's `<span>` list only filtered `run_script` and `launch_app`. Result: a shortcut whose only dangerous action is an `open_file` showed the modal with an empty list.
- [x] Fix: hoisted `DANGEROUS_EXTENSIONS` to module scope, added a `hasDangerousExtension()` helper, extended both the pre-run gate and the modal's item list to include `open_file` with a dangerous extension, showing *"Open: `<path>`"*.
- [x] Shipped together with the safety-warnings toggle — see `handoff.md` §2 "Done & verified" and the journal entry for commit `7ed280c`.

## Mission: Code hygiene — remove vestigial `showDangerWarnings` prop
Status: NOT STARTED
- [ ] `Builder.tsx`'s `readShowDangerWarnings()` reads `lazycow_settings.showDangerWarnings`, but `Settings.tsx` migrates that key to `securedShortcutsEnabled` and **deletes** it on first load.
- [ ] After the migration runs once, `Builder` always reads `true` — the "hide the SafetyChip" behavior is effectively dead.
- [ ] The SafetyChip is now the interactive per-action safety override picker, not a static badge. Hiding it would hide the whole feature, which contradicts the design.
- [ ] **Recommended action:** delete the read entirely. Remove `readShowDangerWarnings`, the `showDangerWarnings` state + effect listeners from `Builder.tsx`; the prop from `ActionSequence`'s interface + pass-through; the prop + gate from `SortableActionCard`. Always render `SafetyChip`.
- [ ] **Not a bug** — no UI writes `showDangerWarnings: false` anymore, so a user can't observe the setting doing nothing. It's cleanup.
- [ ] Touches: `src/pages/Builder.tsx`, `src/components/ActionSequence.tsx`, `src/components/ActionSequence/SortableActionCard.tsx`. ~15 lines deleted.

## Mission: Code hygiene — resolve `onShortcutStarted` dead channel
Status: NOT STARTED
- [ ] `onShortcutStarted` is subscribed in `Library.tsx`, exposed in `preload.ts`, declared in `electron-env.d.ts` — but no `win.webContents.send('shortcut-started', ...)` exists anywhere in `main.ts`.
- [ ] The subscription's job was defensive: close a pending confirmation modal when its shortcut starts running through another path. Never fires because the emit is missing.
- [ ] **Two valid resolutions:** (a) wire the `webContents.send` at the correct runtime entry points in `runShortcutActions`; or (b) delete the channel entirely — the modal already has three other close paths (`visibilitychange`, `shortcut-complete`, `hotkey-triggered`).
- [ ] **Recommended action:** (b) delete. The defensive close is nice-to-have; three paths already cover it.
- [ ] Touches: `electron/preload.ts` (remove bridge), `electron/electron-env.d.ts` (remove declaration), `src/pages/Library.tsx` (remove subscription + cleanup). Optionally `electron/main.ts` if wiring instead of deleting.

## Mission: NFR Phases 4–6
Status: NOT STARTED
- [ ] Phase 4 — Keyboard shortcuts (Ctrl+N, Ctrl+,, Esc, Ctrl+S, Ctrl+1/2/3)
- [ ] Phase 5 — Motion polish (Framer Motion)
- [ ] Phase 6 — Perceived performance (startup audit, loading states, optimistic UI, focus traps)

## Mission: Window Layout Overlay Animation (Batch 3)
Status: NOT STARTED (deferred)
- [ ] Transparent frameless BrowserWindow overlay appears for ~600ms during arrangement.
- [ ] Fades in zone outlines, animates each app's icon flying to its zone, fades out as real windows are placed.
- [ ] Uses the user's chosen theme color.
- [ ] Deferred — Window Layout engine itself is complete; this is purely a visual polish layer.

## Mission: Library & Settings responsive audit
Status: NOT STARTED
- [ ] Test at 800–900px width (context.md §7.E flags this as untested)

## Mission: README accuracy pass
Status: NOT STARTED
- [ ] README markets an `open_vscode` action that doesn't exist
- [ ] README lists `.lnk/.bat/.cmd` as valid `launch_app` formats (only `.exe` is)
- [ ] README describes an "Arrange Windows" action (moved to shortcut-level)
- [ ] README states `sandbox: false` in the security section (it's `true`)
- [ ] Needs a rewrite before any public sharing

## Mission: Dependency cleanup
Status: NOT STARTED
- [ ] Remove unused deps from `package.json`: `electron-store`, `react-router-dom`, `lucide-react`, `uuid`
- [ ] None are imported anywhere in the current code — verified by grep across `src/` and `electron/`.
- [ ] Touches `package.json` + `package-lock.json`. Low risk, dedicated commit.

## Mission: Boot system — fix stale-handoff false positive
Status: NOT STARTED
- [ ] `boot.mjs` compares `handoff.md`'s `Last commit:` line against `git rev-parse HEAD` with exact string equality. Any commit that touches `handoff.md` moves HEAD past the value in the file, so the warning fires on a clean tree.
- [ ] Proposed fix: compare against `git log --format=%h -1 -- <non-doc paths>` — the last commit that touched code, not docs. Or allow a small delta before warning.
- [ ] Alternative: accept the header as informational only, remove the check entirely.
- [ ] Decision needed before implementing — **preferred approach:** compare against the last non-doc commit hash. Cheap, no behavior change, ends the false-positive warnings.

## Mission: Performance profile (hardware-adaptive timings)
Status: NOT STARTED
- [ ] Add `lazycow_settings.performanceProfile: 'fast' | 'balanced' | 'slow'` — user-facing dropdown in Settings → General.
- [ ] Auto-detect on first run via PowerShell (`Get-PhysicalDisk` for SSD/HDD, `Win32_ComputerSystem` for RAM) — preselect a profile, user can override.
- [ ] Extract every timing constant into a single `getTimings(profile)` module shared by main + renderer. No more scattered magic numbers.
- [ ] Affects: Window Layout poll warmup + taper, layout budget base, launch_app waits, broken-path debounce, hotkey re-trigger guard, auto-scroll default, boot watchdog.
- [ ] Test all three tiers (fast / balanced / slow).
- [ ] **Rationale:** any feature that's unusable on low-end hardware is a failure of the app. The app must adapt to the user's machine, not the other way around.

## Mission: Workspace Closer (v1 — window-handle tracking)
Status: NOT STARTED (deferred)
- [ ] Per-shortcut toggle in a new `WorkspaceCloserPanel.tsx` in Builder. Default OFF.
- [ ] Open-phase watcher records HWNDs for windows appearing after each shortcut's `openedAt` (persistent enum, backoff interval, 60s cap).
- [ ] Hotkey double-press within 4s triggers close mode. Single press runs open as usual and clears any stale state.
- [ ] Close phase: `WM_CLOSE` to each tracked HWND. Decaying recheck at 1/3/6/12/20s. Never force-kill.
- [ ] Toast with progress + "Undo" (10s). Library card shows "Reopen Workspace" while state exists.
- [ ] Panel note explains that system-state actions (volume, brightness, DND, Night Light) don't participate — only windows get closed.
- [ ] In-memory state; lost on restart. Documented limitation.
- [ ] **Covers all window-producing actions:** `launch_app`, `open_folder`, `open_file`, `open_url`, and `run_script` if it opens a GUI window.
- [ ] **Rationale:** the app must feel safe. Never close what it didn't open. Never force-close. Always provide Undo.
- [ ] Slow-hardware hardening is part of v1, not v2 — see Performance profile mission.

## Mission: Text expansion / snippet manager (deferred)
Status: NOT STARTED (v2 roadmap — own session, own risk budget)
- [ ] **Decision logged 2026-10-06:** deferred. The idea is high-value (60–80% less typing on repeated content) but requires a global low-level keyboard hook (`uiohook-napi`) — a native binary, ~5MB, with real AV/corporate-policy risk. Not compatible with the current "pure TS/JS + Electron" architecture without accepting that dependency permanently.
- [ ] If revisited: ship the toggle first (pause/resume control), test in one app, one trigger type, one session. Expand only if v1 holds.
- [ ] **Interim alternative:** hotkey-triggered snippet paste (uses only `globalShortcut` + clipboard + synthetic paste — no native hook). Gets ~70% of the value at ~5% of the risk. Not committed; just a note.

## Mission: Doc hygiene (recurring)
Status: ONGOING
- [ ] Archive journal.md when it exceeds ~500 lines → journal-archive.md
- [ ] Archive decisions.md when it exceeds ~200 entries → decisions-archive.md
- [ ] Check SESSION_BOOT.md token count monthly
- [ ] Move completed work from context.md §7.C to §7.A when it's a month old