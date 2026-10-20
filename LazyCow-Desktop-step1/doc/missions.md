# LazyCow — Active Missions
## Mission: Session 17 — Splash Screen & Persistence Polish
Status: COMPLETE (Commit pending)
- [x] Add synchronous settings persistence (`settingsStorage.ts`, `settings.json`).
- [x] Fix theme data loss on hard kill (Ctrl+C right after theme change).
- [x] Implement `color-mix` to prevent theme intrusion in splash gradients.
- [x] Finalize Liquid Metal splash animation (`icon-monogram-outline.svg`).
- [x] Add looping animation for slow PCs (fills up, then drains/fills).
- [x] Make Sidebar logo clickable.
- [x] Add "Sidebar Logo Destination" setting to Settings → General.
- [x] Fix ShortcutCard badges (Secured, Window Layout) visibility in light mode.
- [x] Keep `public/test-splash.html` for color testing.
## Mission: Session 16 — Branding & Layout Engine Fixes
Status: COMPLETE (Commit pending)
- [x] Fix `open_folder` arrangement (`TrimEnd('\\', '/')` bug).
- [x] Map shell launchers (`control.exe`) to `explorer` in `windowLayout.ts`.
- [x] Change `SW_RESTORE` to `SW_SHOWNORMAL` for stubborn Explorer windows.
- [x] Add `setAppUserModelId` to `main.ts` to fix taskbar icon.
- [x] Add new branding assets (`icon.ico`, `wordmark.svg`, `icon-monogram.svg`).
- [x] Implement SF Pro / Segoe UI Variable typography.
- [x] Add Framer Motion `AnimatePresence` to Sidebar logo transitions.
- [x] Cache system accent color in localStorage for splash screen.
- [x] Standardize Library header button sizing.
- [x] Track manual secured overrides via `isSecuredCustom`.
## Mission: Session 15 — UI Bugfixes & Library Multi-Select
Status: COMPLETE (Commit `e01159a`)
- [x] Wrap `DeleteModal`, Library rename modal, and App unsaved modal in `createPortal` to fix windowed-mode positioning.
- [x] Add outside-click and Escape handlers to `ShortcutCard` 3-dot menu.
- [x] Remove dead "New Project" button from Sidebar.
- [x] Implement `useDragSelect` hook for shared long-press + drag-select logic.
- [x] Add multi-select (Select All / Clear / Delete / Done) to Library.
- [x] Fix Builder long-press double-toggle bug.
- [x] Replace `Date.now()` with `crypto.randomUUID()` for actions and shortcuts.

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
- ⚠️ **Superseded 2026-10-09.** The `showDangerWarnings` key is silently migrated to `securedShortcutsEnabled` in `Settings.tsx` on first load; the main process no longer reads it. Per-shortcut `secured` is the runtime gate; per-action `safetyOverride` is the label control.

## Mission: Secured Shortcuts + Safety Override + Test Hotkey
Status: COMPLETE (Session 8 — commits `cfec1a6` + `dc34b3c`)
- [x] **Per-shortcut `secured` flag** replaces the global gate. Runtime branches three ways: focused → confirm modal; minimized → toast + double-press; second press within window → run directly.
- [x] **`securedPendingFires` map** in `main.ts` tracks pending timestamps. `cachedSecuredDoublePressMs` reads the user's window (5–30s).
- [x] **`securedDoublePressSeconds` setting** (default 5) — number input in Settings → General.
- [x] **`securedShortcutsEnabled` setting** (default ON) — controls *new* shortcut defaults only; does not retroactively change existing shortcuts.
- [x] **Silent migration** `showDangerWarnings` → `securedShortcutsEnabled` in `Settings.tsx` on load; legacy key deleted.
- [x] **`migrateShortcutsSecured`** in `src/utils/security.ts` — runs on Library mount; computes `secured` for any shortcut missing it; idempotent.
- [x] **Per-action `safetyOverride`** (`'dangerous' | 'safe'`) on `ActionItem` — user-locked label.
- [x] **`getActionLabel` / `hasDangerousActions`** in `src/utils/danger.ts` — override-aware, single source of truth.
- [x] **`SafetyChip`** on each `SortableActionCard` — inline Dangerous/Safe dropdown.
- [x] **`ConfirmSecuredModal`** — filter (All / Dangerous / Safe), per-row label editor, "all-safe → offer to turn off Secured" prompt.
- [x] **`ShortcutCard` menu** gets a Secured toggle row; card shows a "Secured" badge when on.
- [x] **`test-hotkey` IPC** — snapshot all, unregisterAll, register candidate, 4s race, restore.
- [x] **Mandatory Test Hotkey gate** — Save disabled until `hotkeyIsVerified`.
- [x] **`set-hotkey-recording` IPC** — suppresses global hotkey callbacks while the recorder is active.
- [x] **`useHotkeyRecorder` `e.code` fix** — records physical key, not `e.key`.
- [x] **ComboBuilder rewrite** — controlled, modifier chips, grouped dropdown, live preview.
- [x] **`npx tsc --noEmit` clean.**
- [ ] **Manual runtime verification pending** — Test Hotkey flow (four outcomes), secured double-press on minimized window, ConfirmSecuredModal filter + override persistence, `securedShortcutsEnabled` migration on a legacy profile.

## Mission: Security Warning modal `open_file` filter bug
Status: COMPLETE
- [x] `Library.tsx`'s `runShortcut()` correctly flags `open_file` with a dangerous extension as dangerous and shows the confirmation modal, but the modal's `<span>` list only filtered `run_script` and `launch_app`.
- [x] Fix: hoisted `DANGEROUS_EXTENSIONS` to module scope, added `hasDangerousExtension()` helper, extended both the pre-run gate and the modal's item list.
- [x] Shipped with the safety-warnings toggle — see journal entry for `7ed280c`.

## Mission: Session 10 — open_url layout fixes
Status: COMPLETE (commits `7a2d54e` + `a06b193`)
- [x] **`syncHotkeys` payload carries `windowLayout`.** Added to all 5 call sites in `Library.tsx`. Hotkey-triggered runs now reach the layout engine. (`7a2d54e`)
- [x] **Node-side pre-snapshot.** `snapshotHandles()` in `windowLayout.ts` runs before the action loop in `main.ts`; the resulting handle set flows into `arrangeWindows` → `buildScript` → PowerShell CSV parse. (`a06b193`)
- [x] **`Find-Window` rewritten.** Partitions unused candidates into new vs old; `open_url` placements consider only new.
- [x] **URL title matching.** `Get-UrlKeyword` + `Test-TitleMatchesUrl` — disambiguates two URLs in the same browser.
- [x] **Fallback pass.** Unresolved placements get one more attempt with title matching relaxed.
- [x] **Stall detection.** Poll loop exits after 5s of no progress instead of burning the full budget.
- [x] **`shell.openExternal` 3s timeout.** A hung ShellExecute no longer locks the action loop.
- [x] **URL budget bump.** `estimateShortcutBudgetMs` gives each `open_url` 5000ms instead of 1500ms.
- [x] **Firefox notice updated.** `WindowLayoutPanel` says Firefox isn't supported for multi-URL layouts.
- [x] **Verified:** Chromium (Helium + "New Tab New Window") — both URLs placed in correct zones, pre-existing `meet.google.com` untouched. Firefox — stall exits at ~5s, notice accurate.

## Mission: WhatsApp / Telegram multi-window limitation
Status: NOT STARTED (documented, no fix planned)
- [ ] WhatsApp Desktop has one process hosting both the chat window and the call window. The engine can't distinguish them by process name.
- [ ] `ProcessStartTime` is identical for both — the "prefer newest" tiebreaker is a no-op.
- [ ] **Possible heuristic if a real user hits it:** prefer the largest window for the process (call windows are usually smaller dialogs).
- [ ] **Current decision:** wait for a real complaint. Documented rather than pre-emptively fixed.
- [ ] **Rationale:** speculative fixes for unobserved problems add code without proven value.

## Mission: Code hygiene — remove vestigial `showDangerWarnings` prop
Status: NOT STARTED
- [ ] `Builder.tsx`'s `readShowDangerWarnings()` reads `lazycow_settings.showDangerWarnings`, but `Settings.tsx` migrates that key and **deletes** it on first load.
- [ ] After migration, `Builder` always reads `true` — the "hide the SafetyChip" behavior is dead.
- [ ] **Recommended action:** delete the read entirely. Remove the prop from `ActionSequence` and `SortableActionCard`. Always render `SafetyChip`.
- [ ] **Not a bug** — no UI writes `showDangerWarnings: false` anymore.
- [ ] Touches: `src/pages/Builder.tsx`, `src/components/ActionSequence.tsx`, `src/components/ActionSequence/SortableActionCard.tsx`.

## Mission: `open_url` same-browser limitation — documented, no fix planned
Status: COMPLETE (documented behavior)
- [x] Two `open_url` actions targeting the same browser open as tabs in one window unless the browser is configured otherwise.
- [x] `WindowLayoutPanel` shows the multi-URL notice.
- [x] **Firefox is not supported** — Firefox always opens external URLs as tabs, regardless of `about:config`. UI notice updated in Session 10.
- [x] **Chromium browsers are supported** — install the "New Tab New Window" extension from the Chrome Web Store.
- [ ] No engine-side fix planned — this is browser behaviour, not a LazyCow bug.

## Mission: Code hygiene — resolve `onShortcutStarted` dead channel
Status: NOT STARTED
- [ ] `onShortcutStarted` is subscribed in `Library.tsx`, exposed in `preload.ts`, declared in `electron-env.d.ts` — but no `win.webContents.send('shortcut-started', ...)` exists anywhere in `main.ts`.
- [ ] **Recommended action:** delete the channel entirely — the modal already has three other close paths (`visibilitychange`, `shortcut-complete`, `hotkey-triggered`).
- [ ] Touches: `electron/preload.ts`, `electron/electron-env.d.ts`, `src/pages/Library.tsx`.

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
- [ ] **Preferred fix:** compare against `git log --format=%h -1 -- <non-doc paths>` — the last commit that touched code, not docs.
- [ ] Alternative: accept the header as informational only, remove the check entirely.
- [ ] Decision needed before implementing.

## Mission: Performance profile (hardware-adaptive timings)
Status: NOT STARTED
- [ ] Add `lazycow_settings.performanceProfile: 'fast' | 'balanced' | 'slow'` — user-facing dropdown in Settings → General.
- [ ] Auto-detect on first run via PowerShell (`Get-PhysicalDisk` for SSD/HDD, `Win32_ComputerSystem` for RAM) — preselect a profile, user can override.
- [ ] Extract every timing constant into a single `getTimings(profile)` module shared by main + renderer. No more scattered magic numbers.
- [ ] Affects: Window Layout poll warmup + taper, layout budget base, launch_app waits, broken-path debounce, hotkey re-trigger guard, auto-scroll default, boot watchdog, URL budget, stall threshold.
- [ ] Test all three tiers (fast / balanced / slow).
- [ ] **Rationale:** any feature that's unusable on low-end hardware is a failure of the app.

## Mission: Workspace Closer (v1 — window-handle tracking)
Status: NOT STARTED (deferred)
- [ ] Per-shortcut toggle in a new `WorkspaceCloserPanel.tsx` in Builder. Default OFF.
- [ ] Open-phase watcher records HWNDs for windows appearing after each shortcut's `openedAt`.
- [ ] Hotkey double-press within 4s triggers close mode.
- [ ] Close phase: `WM_CLOSE` to each tracked HWND. Never force-kill.
- [ ] Toast with progress + "Undo" (10s). Library card shows "Reopen Workspace" while state exists.
- [ ] **Covers all window-producing actions:** `launch_app`, `open_folder`, `open_file`, `open_url`, and `run_script` if it opens a GUI window.
- [ ] **Rationale:** the app must feel safe. Never close what it didn't open. Never force-close. Always provide Undo.

## Mission: Text expansion / snippet manager (deferred)
Status: NOT STARTED (v2 roadmap — own session, own risk budget)
- [ ] **Decision logged 2026-10-06:** deferred. Requires a global low-level keyboard hook (`uiohook-napi`) — a native binary with real AV/corporate-policy risk.
- [ ] If revisited: ship the toggle first, test in one app, one trigger type, one session.
- [ ] **Interim alternative:** hotkey-triggered snippet paste (uses only `globalShortcut` + clipboard + synthetic paste).

## Mission: Cold-start layout failure (Session 11)
Status: MONITORING — not reproduced since Session 10
- [ ] **Symptom:** On a freshly booted PC, the first `npm run dev` session does
  not place windows correctly. Restarting `npm run dev` (no OS reboot) works.
- [ ] **Suspected cause:** PowerShell's first `Add-Type -TypeDefinition <C#>` call
  on a cold system has to spin up `csc.exe` and compile the `WinArranger` class.
  On warm systems this is cached. Cold compile either (a) takes 2–4s and delays
  placement past the poll deadline, or (b) throws because `$ErrorActionPreference
  = 'Stop'` turns a slow-compile warning into a hard error.
- [ ] **Diagnostics to run on cold boot:** add temporary `[Console]::Error.WriteLine`
  timestamps before/after `Add-Type -TypeDefinition $code`, and log raw PowerShell
  stdout even when it's empty (in `runPowerShellScript`'s callback).
- [ ] **Candidate fix (if slow-compile):** warm up PowerShell during
  `app.whenReady()` — fire a no-op `Add-Type` compile so the first real shortcut
  run finds the compiler warm. ~500ms added to app startup.
- [ ] **Candidate fix (if compile-throw):** move the C# compilation out of the
  main layout script into a one-time setup at app startup; persist the compiled
  assembly so subsequent runs load it from the assembly cache.
- [x] **Diagnostic run 2026-10-11:** Added `BEFORE_ADD_TYPE` / `AFTER_ADD_TYPE`
  timestamps and raw stdout logging. Result: Add-Type compile was 286ms (warm,
  normal) — the cold-start-compile hypothesis is ruled out. Engine placed all
  4 zones correctly on warm restart. Session 10's Node-side pre-snapshot timing
  fix may have eliminated the race that caused the original symptom.
- [ ] **True cold-boot test pending** (full OS reboot, not just `npm run dev`).
  Revisit only if the bug reproduces after genuine cold boot.

## Mission: Session 11 — Hotkey UX overhaul
Status: COMPLETE (commits `ab8fdba` + `ba8e6cd` + `9e0cf2a`)
- [x] **Recorder rewrite** — canonical key vocabulary from `e.code`; shifted symbols store the physical key; single-main-key replacement with a 3-second notice.
- [x] **`initialMods` parameter** — ComboBuilder chips seed a live recording; pick Win then press K → `Win + K`.
- [x] **Mirror effect** — chip edits during recording survive subsequent keystrokes.
- [x] **Modifiers-only intermediate state** — chips visibly respond even before a key is picked.
- [x] **Numpad keys** added to the picker.
- [x] **Test Hotkey redesign** — 3-step flow (Test → Verify → Verified), no timer, user-paced.
- [x] **Wrong-combo error** — distinguishes wrong key / OS-swallowed / no key pressed.
- [x] **Auto-add to blocked** on Windows registration rejection.
- [x] **Blocked Triggers polish** — expanded `Win + <letter>` defaults; `Del` → `Delete`; alias normalization on read; token-based filter; fixed-height list.
- [x] **Pencil loads the trigger into the recorder.** `EditBlockedTriggerModal` deleted.
- [x] **`OSCriticalWarningModal` uses `createPortal`** + `z-[250]` — the "delete appears to do nothing" bug.
- [x] **Page Zoom** — 50%–200%, `Ctrl + +/-/0` shortcuts, persisted.
- [x] **Verified:** tsc clean; manual verification for full flow pending (see `handoff.md` §2).

## Mission: Canonical key module refactor
Status: NOT STARTED
- [ ] **Problem:** The key vocabulary exists in four places that must all agree: `canonicalKeyFromEvent` in `useHotkeyRecorder.ts`; `KEY_GROUPS` in `ComboBuilder.tsx`; `LEGACY_KEY_ALIASES` + `normalizeTrigger` in `SettingsBlockedTriggers.tsx`; `SPECIAL_KEY_MAP` in `electron/main.ts`. Any new key added to one but not the others creates a silent bug — e.g. the recorder emits `Numpad5` and the picker says "Unknown key".
- [ ] **Goal:** Extract `KEY_GROUPS`, `KEY_ALIASES`, `normalizeKeyName`, and `canonicalKeyFromEvent` into `src/utils/keys.ts`. Have ComboBuilder and useHotkeyRecorder import from it.
- [ ] **Challenge:** `electron/main.ts` can't import from `src/` (separate bundle). Two options:
  - (a) Mirror the vocabulary into `electron/keys.ts` — the same file duplicated. Fragile.
  - (b) Pre-build the vocabulary at commit time into a JSON file both sides import. More work.
  - (c) Keep the electron-side `SPECIAL_KEY_MAP` minimal and only for the OS-critical-trigger list — accept that the two vocabularies are separate but keep them in sync via a test.
- [ ] **Recommendation:** Start with (a) and a check-in-comment. If drift bites again, do (b).
- [ ] **Also update:** `DEFAULT_BLOCKED_TRIGGERS` in `types/actions.ts` — should be derived from the same vocabulary so it can't drift.
- [ ] **Test additions to verify:** recorder round-trips every key in `KEY_GROUPS`; every default trigger name is pickable in ComboBuilder.
- [ ] **Rationale:** We've now fixed the same class of bug three times in this session (`Del`, numpad, shifted symbols). Each fix was surgical and worked, but the root cause — no single source of truth — remains.

## Mission: Session 12 — App Drawer
Status: COMPLETE (uncommitted — two commits pending)
- [x] Backend: OS app discovery combining Get-StartApps + Start Menu `.lnk` + App Paths + Uninstall registry + six virtual shell entries.
- [x] Icon extraction with disk cache; UWP icons via `IShellItemImageFactory`; shell folder icons via `SHGetFileInfo` P/Invoke.
- [x] `list-installed-apps` / `refresh-installed-apps` / `test-launch-app` IPC. Name dedup. Non-racing cache. Eager background scan.
- [x] `isLikelySystemComponent` heuristic auto-hides redistributables (VC++ redists, .NET runtimes, SDKs, WebView2, Java).
- [x] `launch_app` UWP + `shell:` launch branches; `shell:` accepted in `findFirstBrokenPath`, `useActionValidation`, `Library` pre-flight.
- [x] Frontend: `AppDrawerModal` — grid, icons, alphabet strip, live search, frequently-used row, Add app popover.
- [x] `HiddenAppsModal` — hidden list, unhide, remove permanently, right-click menu.
- [x] `appUsage.ts` — localStorage usage counter for the frequently-used row.
- [x] `appVisibility.ts` — persistence helpers; state lives in `AppDrawerModal`.
- [x] Settings → Appearance → App Drawer backdrop (Solid / Blur).
- [x] `scrollbar-thin-alpha` utility for the alphabet strip.
- [x] **Verified:** `npx tsc --noEmit` clean; interactive runtime check passed (80 apps, all kinds, hide/unhide/custom/remove all work).

## Mission: Design polish Phase 1 — motion layer
Status: NOT STARTED (next session)
- [ ] Install `motion` (Framer Motion v11).
- [ ] Modal springs from trigger origin — App Drawer from Select App button; Hidden Apps from eye icon; Confirm Delete from trash; Settings panels from nav.
- [ ] ShortcutCard hover spring lift; drawer cell stagger on open.
- [ ] Progress ring spring settle; success state scale-pop.
- [ ] `prefers-reduced-motion` — springs become 120ms cross-fades, transforms disable.
- [ ] **Renderer-only.** No changes to `main.ts`, `windowLayout.ts`, or execution logic.
- [ ] **Rationale:** rigidity is the single biggest reason the app feels "dead". See `decisions.md` — Design direction.
## Mission: Design polish Phase 1 — motion layer
Status: IN PROGRESS (pilot complete; surfaces 2+ queued)
- [x] Install `motion` (v14).
- [x] `usePrefersReducedMotion` hook + `src/utils/motion.ts` constants.
- [x] AppDrawerModal entrance — backdrop fade + translateY slide,
      spring bounce 0 (300ms in / 200ms out), reduced-motion 120ms fade.
- [x] Hardware acceleration toggle — required to feel the motion at all
      (software rendering made scale-based animations choppy).
- [x] Surface 2 — Library grid entrance stagger (`Math.min(index, 8) * 0.15`).
- [ ] Surface 3 — drawer cell stagger.
- [ ] Progress ring spring settle.
- [ ] Modal exits for DeleteModal / ConfirmDeleteModal / ConfirmSecuredModal.
- [ ] Small-popover trigger-origin anchoring (PositionDropdown, HiddenApps
      from eye icon) — deferred from pilot; only worth it for small surfaces.
      
## Mission: Design polish Phases 2–6
Status: NOT STARTED (after Phase 1)
- [ ] Phase 2 — visual reset on the three main surfaces. Flat card backgrounds (no gradients), two-layer Windows 11 shadow, one Acrylic translucent overlay, radius rhythm (chip 6 / card 8 / modal 12 / button pill), icon scale (14/18/20/24).
- [ ] Phase 3 — typography pass. Kill 80% of `label-caps`; weight-driven hierarchy; Segoe UI Variable Display for display sizes; negative tracking on display.
- [ ] Phase 4 — hero theme. Windows Fluent (system accent) is the identity; Coffee/Ocean/Forest become user options, not co-equal designs.
- [ ] Phase 5 — micro-interactions. Delete with undo, warm empty-state copy with an SVG cow variant, spring entrance for splash mark.
- [ ] Phase 6 — copy pass. Transactional errors → explanatory errors. Specific modal titles. Warmer empty states.

## Mission: Doc hygiene (recurring)
Status: ONGOING
- [ ] Archive journal.md when it exceeds ~500 lines → journal-archive.md
- [ ] Archive decisions.md when it exceeds ~200 entries → decisions-archive.md
- [ ] Check SESSION_BOOT.md token count monthly
- [ ] Move completed work from context.md §7.C to §7.A when it's a month old