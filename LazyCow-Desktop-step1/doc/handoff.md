# LazyCow — Handoff

Last updated: 2026-10-15
Last commit: d87af72
Working tree: ready to commit Surface 2 motion work.

## §1 Current Focus
Session 14 covered three areas: a **data-loss fix** (storage durability
under hard-kill), **Design polish Phase 1, Surface 2** (Library grid
entrance stagger), and a **StrictMode removal** needed to make motion
work at all in dev.

Status: storage fix committed at `1e38363`. Surface 2 motion work is
about to land in the next commit.

What landed:
- **Data-loss fix** — Chromium's async `localStorage` writes could be
  lost on a hard kill (Ctrl+C in dev, `taskkill /f`, power loss within
  the ~1–5s flush window). Reproduced twice: create + Ctrl+C immediately
  → lost; create + wait 3s + Ctrl+C → survived. Fix: mirror every
  shortcut write to `userData/shortcuts.json` via a synchronous IPC call
  (`fs.writeFileSync`). On Library mount, if `localStorage` is empty but
  the disk file has data, we restore. Files: `electron/main.ts` (2 IPC
  handlers), `electron/preload.ts` (2 bridges), `electron/electron-env.d.ts`
  (2 declarations), `src/utils/shortcutStorage.ts` (new),
  `src/pages/Library.tsx`, `src/pages/Builder.tsx`.
- **Design polish Phase 1, Surface 2** — Library grid entrance stagger.
  Each card fades (0→1) + slides (y: 8→0) on mount. Values:
  `duration: 0.5, delay: (Math.min(index, 8)) * 0.15` per card. Reduced
  motion drops the delay and swaps to a 120ms fade. Files:
  `src/pages/Library.tsx`, `src/components/ShortcutCard.tsx`. Verified:
  cards appear one after another on Library mount; delete does not
  re-trigger; search does not re-trigger; reduced-motion cross-fade
  works under DevTools emulation.
- **React.StrictMode removed** — `src/main.tsx`. React 18's dev-mode
  double-mount eats motion's entrance animations: the first mount starts
  the animation, the synthetic remount sees the element at final state
  and doesn't replay. Removing StrictMode makes dev behave like prod.

Also confirmed earlier this session:
- `will-quit` handler reverted to its pre-incident simple form. The
  earlier `event.preventDefault() + flushStorageData() + app.exit(0)`
  version was an anti-pattern that skipped Chromium's own flush. Never
  reintroduce it.
- `relaunch-app` uses `app.quit()`, not `app.exit(0)` — the latter is a
  hard kill that skips the flush.
- Hard-kill shutdown handlers can't be relied on in dev at all —
  `vite-plugin-electron` force-kills the Electron child on Ctrl+C. The
  disk mirror is the only mechanism that closes this class of bug.

**Pitfall recorded (motion):** `motion`'s parent-driven `staggerChildren`
is bypassed when a child declares its own `animate` prop. The delay must
live inside the child's variant `transition`, not on the grid container.
The pilot's initial Surface 2 patch had this wrong and the stagger
silently did nothing.

Next arc options:
1. **Surface 3** — App Drawer cell stagger (generalizes Surface 2's
   pattern to the drawer's app grid).
2. **Progress ring spring settle** — when a shortcut completes, the
   progress ring arrives at 100% with a spring. No bounce (informational
   surface).
3. **Modal exits** — currently only AppDrawerModal has an exit animation.
   DeleteModal / ConfirmDeleteModal / ConfirmSecuredModal appear and
   disappear instantly.
4. **Small-popover trigger-origin anchoring** — deferred from the pilot.
   PositionDropdown, HiddenAppsModal from the eye icon, Confirm Delete
   from the trash. Only worth it for small surfaces.
5. Storage polish / cleanups listed in `missions.md`.

Other open candidates in `missions.md`:
1. Manual runtime verification of Sessions 8, 10, 11 (still not done).
2. Canonical key module refactor.
3. README accuracy pass.
4. Dependency cleanup.

## §2 Sub-task State

### Done & verified (tsc clean, runtime-checked)
- Session 1–11 work: cancellation, responsive layout, validation hook,
  URL helpers, GPU workaround, context menu, rAF resize, backdrop-blur
  removal, window layout engine, broken-path pre-flight, Test Layout /
  Test Flow, richer toasts, secured shortcuts, per-action safety override,
  mandatory Test Hotkey, ComboBuilder rewrite, orphan pruning, cancellable
  tests, sync payload fix, pre-snapshot + URL title matching, recorder
  rewrite, Test Hotkey redesign, blocked triggers polish, Page Zoom.
- **Session 12 backend**: OS app discovery combining Get-StartApps +
  Start Menu `.lnk` + App Paths registry + Uninstall registry + six
  virtual shell entries. Icon extraction with disk cache. UWP icon
  extraction via `IShellItemImageFactory`. `test-launch-app` IPC. UWP
  and `shell:` launch branches in `runAction`. Zoom IPC re-added. Name
  dedup. `isLikelySystemComponent` heuristic auto-hides redistributables.
  Runtime-verified: 80 apps discovered, 47 from Start Menu, 11 Get-StartApps,
  16 Uninstall reg, 6 shell, 10 UWP, 9 system.
- **Session 12 frontend**: `AppDrawerModal` with grid + icons + alphabet
  strip + live search + "Frequently used" row + Add app popover
  (Add to drawer / Use once). `HiddenAppsModal` with unhide + remove
  permanently + right-click menu. State-driven visibility + custom apps
  in `AppDrawerModal` (localStorage is persistence only). Backdrop setting
  in Settings → Appearance. UWP skip in `useActionValidation` and
  `Library` pre-flight. `scrollbar-thin-alpha` utility.

### Done & verified (Session 13)
- **Design polish Phase 1 pilot** — `motion` installed (v14). AppDrawerModal
  entrance animation: backdrop fade + 8px upward slide (`translateY`, not
  `scale` — scale resamples the layer every frame and looked choppy under
  software rendering). Spring bounce 0, 300ms enter / 200ms exit. Reduced-
  motion cross-fade via `usePrefersReducedMotion`. `AnimatePresence` in
  `ActionValueInput.tsx` owns the mount/unmount so exit plays. Verified
  end-to-end with HW accel off.
- **Hardware acceleration toggle** — `preferences.json` in `userData`, read
  synchronously at module load (before `app.whenReady()`). Default OFF,
  matching the app's historical behaviour and the affected GPU class. IPC
  trio: `get-hardware-acceleration` (returns `{ current, boot }`),
  `set-hardware-acceleration`, `relaunch-app`. UI in Settings → General with
  a "Restart required" banner + Restart Now link.
- **Dev-mode relaunch fix** — `app.relaunch()` alone killed the Vite dev
  server and left a blank Electron window. Dev path now spawns a detached
  `npm run dev` after a 2s delay and exits the current process. Production
  path keeps `app.relaunch()`.

### Done & verified (Session 14)
- **Data-loss fix (disk mirror)** — `src/utils/shortcutStorage.ts` (new)
  with `persistShortcuts` / `readShortcuts` / `recoverShortcutsFromDiskIfEmpty`.
  Two new IPC handlers in `main.ts` (`read-shortcuts-from-disk`,
  `write-shortcuts-to-disk`) with `fs.writeFileSync`. Preload + type
  declarations added. All six shortcut-write call sites swapped from
  `localStorage.setItem` to `persistShortcuts`. Library mount runs
  `recoverShortcutsFromDiskIfEmpty` before `refreshShortcuts`.
  **Verified:** create shortcut → Ctrl+C immediately → restart → shortcut
  present. Reproduced the failure twice before the fix, confirmed fixed
  after.
- **`will-quit` reverted** — back to `globalShortcut.unregisterAll()`
  only. The prior version (with `event.preventDefault()` +
  `flushStorageData()` + `app.exit(0)`) broke Chromium's own flush and
  caused a data-loss incident. Do not reintroduce.
- **`relaunch-app` uses `app.quit()`** — `app.exit(0)` was a hard kill
  that skipped the graceful shutdown path.
- **Surface 2 (Library grid entrance stagger)** — cards fade + slide in
  on mount. Values: `duration: 0.5`, `delay: min(index, 8) * 0.15`.
  Reduced motion swaps to a 120ms fade with no delay.
  **Verified manually:** visible stagger, delete does not re-trigger,
  search does not re-trigger, reduced-motion cross-fade confirmed.
- **`React.StrictMode` removed** from `src/main.tsx`. Required for motion
  to fire entrance animations in dev.

### Done in code — manual runtime verification pending
- Full hotkey flow (Session 11).
- Blocked Triggers polish (Session 11).
- Page Zoom (Session 11).
- Session 8 secured-shortcut flow — full test matrix.
- Session 12 app drawer — most flows verified during development, but
  no formal end-to-end test matrix captured yet.

### Not started
- Design polish Phase 1, surfaces 3+ — drawer cell stagger, progress
  ring settle, modal exits, small-popover trigger-origin anchoring.
- Design polish Phases 2–6 — visual reset, typography, hero theme,
  micro-interactions, copy pass.
- Canonical key module refactor.
- Batch 3 — overlay animation.
- Dependency cleanup (4 unused deps).
- README accuracy pass.
- Library & Settings responsive audit at 800–900px.
- NFR Phases 4–6.
- Performance profile — deferred.
- Workspace Closer — deferred.
- Text expansion — deferred (v2).

### Bugs / blockers
- (none blocking)
- **`preload.ts` exposes `arrangeWindowsShortcut`; `main.ts` has no
  matching `ipcMain.handle`.** Dead bridge. Clean up in a dedicated
  `chore` commit — not bundled with the app drawer work.
- **Vestigial `showDangerWarnings` prop in `Builder.tsx`.** Dead.
- **`onShortcutStarted` dead channel.** Same category.
- **`Builder.handleSave` reimplements `hasDangerousActions()` inline.**
- **WhatsApp / Telegram multi-window ambiguity.** No fix planned.
- **Four copies of the key vocabulary.** See mission "Canonical key
  module refactor".
- Compiled `dist-electron/main.js` has mangled registry paths in the
  windowLayout C# block. Source is correct; built artifact is not.

## §3 Last Verified Test
Session 14 — `npx tsc --noEmit` clean. Surface 2 verified manually:
cards appear one after another with a visible stagger on Library mount;
reduced-motion emulation (DevTools → Rendering → prefers-reduced-motion)
collapses to a shared 120ms fade with no slide; delete removes a card
instantly without re-triggering the stagger on remaining cards; search
filters without replaying; tab switch back to Library replays the reveal.
Storage fix re-verified: create → Ctrl+C immediately → restart → shortcut
present.

Previously verified (still hold):
- Engine + claim-the-zone on 1920×1080 @ 125% — 4-app quad grid ✅
- Not-Arranged App Visibility — Calculator centered on top of Notepad ✅
- Broken Path Fix UX — Fix Paths lands on the broken action ✅
- Chromium multi-URL layout — pre-snapshot + title matching ✅
- Cold-start diagnostic closed — not reproduced on warm restart ✅
- HW accel toggle round-trips through Settings → General; motion feels
  smooth with HW accel off (software rendering + translateY primitive) ✅

## §4 Open Questions
- **`Builder.handleSave` classification.** Should it use the shared
  `hasDangerousActions()` helper instead of its inline compute?
- **WhatsApp / Telegram chat-vs-call window.** Best heuristic is probably
  "prefer the largest window for the process".
- **Canonical key module.** Where should it live? `src/utils/keys.ts`
  feels right — shared by renderer + electron. But electron cannot import
  from `src/` due to the bundle split. Might need a mirrored file in
  `electron/`. To be decided when the mission starts.
- **Design polish — hero theme.** Confirm Windows Fluent (system accent)
  as the identity; Coffee / Ocean / Forest become user options, not
  co-equal designs. Needs a decision before Phase 2.
- **Migration to `electron-store`?** Considered and rejected for now —
  our hand-rolled `shortcutStorage.ts` + IPC is ~60 lines total (not the
  ~40 I initially estimated), and electron-store wouldn't eliminate the
  IPC layer or the recovery logic. The library's atomic-write protection
  is real but not needed for our failure mode. Revisit only if the
  hand-rolled version grows. Do **not** do this in a dedicated commit
  unless the hand-rolled version becomes painful.

## §5 Uncommitted (mirrors git status)

Working tree: **dirty** — ready to commit Surface 2.

Modified:
- `src/pages/Library.tsx`
- `src/components/ShortcutCard.tsx`
- `src/main.tsx`
- `doc/handoff.md`

Recent commits (most recent first):
- `1e38363` fix(storage): mirror shortcuts to disk — survives hard kills
- `feb8473` fix(electron): flush localStorage on relaunch; reconcile handoff
- `2568539` docs: fill journal stub for Session 13 pilot; reconcile handoff
- `df96317` feat(motion): Phase 1 pilot + hardware acceleration toggle
- `2cc36ba` docs: reconcile handoff with post-onboarding-checkpoint state
- `bf5bcbb` docs(onboarding): add handoff reconciliation sign-off rule + stale-handoff false-positive note
- `ee94f9a` docs: reconcile handoff §1 and §5 with post-Session-12 state
- `fa993de` docs: fill journal stubs for Session 12 commits (e30c497, bdce23d)
- `e2675e9` docs: update handoff header to post-Session-12 state
- `9f196fe` docs: checkpoint — Session 12 app drawer + design direction
- `bdce23d` feat(builder): app drawer — modal, hide/custom management, backdrop setting
- `e30c497` feat(electron): app drawer backend — discovery, UWP, shell folders, test-launch

### §5-PENDING (in flight — cleared on confirmation)
- Design polish Phase 1, Surface 2 — Library grid entrance stagger.
  Verified end-to-end. About to commit. Files: `src/pages/Library.tsx`,
  `src/components/ShortcutCard.tsx`, `src/main.tsx`.
- UI bugfix batch — modal containment (DeleteModal + Library rename + App
unsaved modal), ShortcutCard menu outside-click/Escape, remove Sidebar
"New Project", sync-hotkeys resets failure set, crypto.randomUUID() ids,
empty-sequence Save guard. Files: DeleteModal.tsx, Library.tsx, App.tsx,
ShortcutCard.tsx, Sidebar.tsx, Builder.tsx.
- Library multi-select + drag-select. Long-press or Select button enters
  selection mode; drag across cards to toggle continuously; Select All /
  Clear / Delete / Done; Escape exits. New files: src/hooks/useDragSelect.ts,
  src/utils/autoScroll.ts, src/components/ConfirmDeleteShortcutsModal.tsx.
  Modified: src/pages/Library.tsx, src/components/ShortcutCard.tsx.

## §6 Bootstrap order
1. electron/main.ts, electron/preload.ts, electron/electron-env.d.ts, electron/windowLayout.ts
2. src/types/actions.ts, src/pages/Library.tsx, src/pages/Builder.tsx
3. src/utils/security.ts, src/utils/danger.ts, src/components/ConfirmSecuredModal.tsx
4. src/components/ActionSequence.tsx, src/components/ActionSequence/SortableActionCard.tsx
5. src/components/WindowLayout/WindowLayoutPanel.tsx, src/components/WindowLayout/PositionDropdown.tsx
6. src/components/SettingsBlockedTriggers.tsx, src/components/BlockedTriggerList.tsx, src/components/ComboBuilder.tsx, src/hooks/useHotkeyRecorder.ts
7. src/components/AppDrawerModal.tsx, src/components/HiddenAppsModal.tsx, src/utils/appVisibility.ts, src/utils/appUsage.ts, src/utils/shortcutStorage.ts (Session 12/14 additions)
8. package.json, tsconfig.json, vite.config.ts (only if needed)

## §7 Update rules
Update when: "checkpoint" / "sync" / "commit" | bug found/fixed/abandoned | decision made/reversed | sub-task verified.
Delete entries once committed AND documented in context.md.