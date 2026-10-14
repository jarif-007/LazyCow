# LazyCow — Handoff

Last updated: 2026-10-14
Last commit: 9f196fe
Working tree: clean. Session 12 App Drawer committed in three commits (`e30c497` backend, `bdce23d` frontend, `9f196fe` docs).

## §1 Current Focus
Session 12 built the App Drawer — the "Select App" modal for `launch_app`
actions. This replaced the old Browse-to-.exe picker with an installed-apps
grid: icons, live search, alphabet strip, custom apps, hide/unhide,
backdrop setting.

Status: **uncommitted**. Three commits pending.
- Backend: `electron/main.ts`, `preload.ts`, `electron-env.d.ts`
- Frontend: `AppDrawerModal.tsx` (new), `HiddenAppsModal.tsx` (new),
  `appUsage.ts` (new), `appVisibility.ts` (new), `ActionValueInput.tsx`,
  `useActionValidation.ts`, `Library.tsx`, `types/actions.ts`,
  `Settings.tsx`, `SettingsAppearance.tsx`, `index.css`
- Docs: `context.md`, `handoff.md`, `decisions.md`, `missions.md`

After the two commits, the next arc is **Design polish Phase 1 (motion
layer)** — springs on modals, cards, and drawer cells; anchored modal
origins; reduced-motion respect. See `missions.md`.

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

Working tree before the three Session 12 commits (indented, not fenced):

    M ../doc/context.md
    M ../doc/decisions.md
    M ../doc/handoff.md
    M ../doc/missions.md
    M electron/electron-env.d.ts
    M electron/main.ts
    M electron/preload.ts
    M src/components/ActionSequence/ActionValueInput.tsx
    M src/components/SettingsAppearance.tsx
    M src/hooks/useActionValidation.ts
    M src/index.css
    M src/pages/Library.tsx
    M src/pages/Settings.tsx
    M src/types/actions.ts
    ?? src/components/AppDrawerModal.tsx
    ?? src/components/HiddenAppsModal.tsx
    ?? src/utils/appUsage.ts
    ?? src/utils/appVisibility.ts

Pending commits (three, in this order):
1. `feat(electron): app drawer backend` — main.ts, preload.ts, electron-env.d.ts
2. `feat(builder): app drawer — modal, hide/custom management, backdrop setting` — everything else
3. `docs: checkpoint — Session 12 app drawer + design direction` — the four docs

Recent commits (most recent first):
- `a3ece59` docs: checkpoint — Session 11 hotkey UX + blocked triggers + zoom
- `9e0cf2a` feat(settings): blocked triggers polish + page zoom
- `ba8e6cd` feat(hotkeys): Test Hotkey redesign — user-paced Verify flow
- `ab8fdba` feat(hotkeys): recorder rewrite + canonical key vocabulary
- `5af414d` perf(renderer): cap splash-screen wait at 1.5s to survive slow/offline font loads

### §5-PENDING (in flight — cleared on confirmation)
- (nothing pending — Session 12 work is being committed in this checkpoint. Design polish Phase 1 is the next session's scope, tracked in `missions.md`.)

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