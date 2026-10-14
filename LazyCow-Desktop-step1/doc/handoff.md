# LazyCow — Handoff

Last updated: 2026-10-15
Last commit: 2568539
Working tree: clean.

## §1 Current Focus
Session 13 completed the **Design polish Phase 1 pilot** — the motion
layer's first surface — and, as a prerequisite, made **hardware
acceleration** user-configurable.

Status: **committed** at `df96317`. Working tree clean.

What landed:
- `motion` v14 installed. App Drawer entrance is a backdrop fade + 8px
  `translateY` slide (spring bounce 0, 300ms in / 200ms out). Chose
  `translateY` over `scale` — scale resamples the modal layer every
  frame under software rendering and looked choppy.
- Reduced-motion support via `usePrefersReducedMotion`. Springs swap to
  120ms opacity cross-fades when `prefers-reduced-motion: reduce`.
- Hardware acceleration is now a user toggle (Settings → General).
  Default OFF, matching the app's historical behaviour. `preferences.json`
  in `userData`, read synchronously before `app.whenReady()`.
- Dev-mode relaunch fixed — dev path spawns a detached `npm run dev`
  instead of `app.relaunch()` (which killed the Vite server and left a
  blank window).

Next arc: **Design polish Phase 1, Surface 2**. Recommended target —
Library grid entrance stagger (fade + slide-in with ~30ms per card).
Alternative candidates listed in the discussion below the pilot's
checkpoint. Decision pending.

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

### Done & verified this session (Session 13)
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

### Done in code — manual runtime verification pending
- Full hotkey flow (Session 11).
- Blocked Triggers polish (Session 11).
- Page Zoom (Session 11).
- Session 8 secured-shortcut flow — full test matrix.
- Session 12 app drawer — most flows verified during development, but
  no formal end-to-end test matrix captured yet.

### Not started
- **Design polish Phase 1** — motion layer (springs, anchored modal
  origins, interruptibility, reduced-motion). Next session's focus.
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
Session 12 — `npx tsc --noEmit` clean. App drawer verified interactively:
discovery returns 80 apps across all four sources; UWP apps (Calculator,
Command Palette) launch and show icons; shell folders (This PC, Recycle
Bin, Control Panel, File Explorer, Settings, Network) launch; hide /
unhide / add custom / remove custom all work; frequently-used row updates
on hide; backdrop setting switches to blur.

Previously verified (still hold):
- Engine + claim-the-zone on 1920×1080 @ 125% — 4-app quad grid ✅
- Not-Arranged App Visibility — Calculator centered on top of Notepad ✅
- Broken Path Fix UX — Fix Paths lands on the broken action ✅
- Chromium multi-URL layout — pre-snapshot + title matching ✅
- Cold-start diagnostic closed — not reproduced on warm restart ✅

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

## §5 Uncommitted (mirrors git status)

Working tree: clean. Nothing uncommitted.

Recent commits (most recent first):
- `bf5bcbb` docs(onboarding): add handoff reconciliation sign-off rule + stale-handoff false-positive note
- `ee94f9a` docs: reconcile handoff §1 and §5 with post-Session-12 state
- `fa993de` docs: fill journal stubs for Session 12 commits (e30c497, bdce23d)
- `e2675e9` docs: update handoff header to post-Session-12 state
- `9f196fe` docs: checkpoint — Session 12 app drawer + design direction
- `bdce23d` feat(builder): app drawer — modal, hide/custom management, backdrop setting
- `e30c497` feat(electron): app drawer backend — discovery, UWP, shell folders, test-launch
- `a3ece59` docs: checkpoint — Session 11 hotkey UX + blocked triggers + zoom
- `9e0cf2a` feat(settings): blocked triggers polish + page zoom
- `ba8e6cd` feat(hotkeys): Test Hotkey redesign — user-paced Verify flow
- `ab8fdba` feat(hotkeys): recorder rewrite + canonical key vocabulary
- `5af414d` perf(renderer): cap splash-screen wait at 1.5s to survive slow/offline font loads

### §5-PENDING (in flight — cleared on confirmation)
- **Data-loss fix** — Chromium's async localStorage writes were lost on
  hard-kill (Ctrl+C in dev, `app.exit(0)`, tray quit). Reproduced
  2026-10-15: duplicated shortcuts, killed dev server, all shortcuts gone.
  Fix: `session.flushStorageData()` before every exit path (`will-quit`,
  `SIGTERM`, `relaunch-app`); dev-mode `relaunch-app` now spawns a
  detached `npm run dev` and flushes before exiting. Files:
  `electron/main.ts`.
- Design polish Phase 1, Surface 2 — Library grid entrance stagger
  (paused until shortcuts are re-created after the 2026-10-15 incident).
  Files: `src/pages/Library.tsx`, `src/components/ShortcutCard.tsx`.

## §6 Bootstrap order
1. electron/main.ts, electron/preload.ts, electron/electron-env.d.ts, electron/windowLayout.ts
2. src/types/actions.ts, src/pages/Library.tsx, src/pages/Builder.tsx
3. src/utils/security.ts, src/utils/danger.ts, src/components/ConfirmSecuredModal.tsx
4. src/components/ActionSequence.tsx, src/components/ActionSequence/SortableActionCard.tsx
5. src/components/WindowLayout/WindowLayoutPanel.tsx, src/components/WindowLayout/PositionDropdown.tsx
6. src/components/SettingsBlockedTriggers.tsx, src/components/BlockedTriggerList.tsx, src/components/ComboBuilder.tsx, src/hooks/useHotkeyRecorder.ts
7. src/components/AppDrawerModal.tsx, src/components/HiddenAppsModal.tsx, src/utils/appVisibility.ts, src/utils/appUsage.ts (Session 12 additions)
8. package.json, tsconfig.json, vite.config.ts (only if needed)

## §7 Update rules
Update when: "checkpoint" / "sync" / "commit" | bug found/fixed/abandoned | decision made/reversed | sub-task verified.
Delete entries once committed AND documented in context.md.