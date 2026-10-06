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
- [ ] 2e — remove SCREEN_DEBUG / PLACE_DEBUG / PLACE_RESULT diagnostics (keep OCCUPIED_BY)

**Blocker:** (none)

## Mission: Broken Path Fix UX (Q2b)
Status: NOT STARTED
- [ ] "Fix Paths" button in ShortcutCard should route to Builder AND auto-scroll to + highlight the first broken action
- [ ] Add a `focusActionId` prop to Builder, plumbed from Library's `onEditShortcut` call
- [ ] Flash the action card after scrolling (ring-primary + ring-offset for ~900ms, matches the Flow Preview's click-to-jump flash)

## Mission: Window Layout Overlay Animation (Batch 3)
Status: NOT STARTED (deferred)
- [ ] Transparent frameless BrowserWindow overlay appears for ~600ms during arrangement
- [ ] Fades in zone outlines, animates each app's icon flying to its zone, fades out as real windows are placed
- [ ] Uses the user's chosen theme color

## Mission: Not-Arranged App Visibility (bug)
Status: COMPLETE
- [x] **Symptom:** Shortcut launches Notepad (assigned to Left) + Calculator (Not Arranged). Notepad snaps to Left and comes to front. Calculator launches but appears **behind** Notepad instead of on top.
- [x] **Cause:** The engine only called `ForceForeground` on windows it *placed*. Unassigned windows were never touched, so Windows decided their z-order — and it often left them behind.
- [x] **Fix:** After the placement pass, every arrangeable action the user didn't assign is brought to front and centered on the primary monitor at its native size. No resize.
- [x] **Touches:** `main.ts` (`buildPlacementsFromShortcut` emits `isUnassigned: true` for unassigned actions, Zod schema accepts the flag); `windowLayout.ts` (`Placement.isUnassigned`, `ScriptPlacement.isUnassigned`, new `Bring-Unassigned-Window` PowerShell helper, loop branches on the flag).
- [x] **Verified:** manual test — Calculator (Not Arranged) appears centered on top of Notepad (assigned Left).

## Mission: NFR Phases 4–6
Status: NOT STARTED
- [ ] Phase 4 — Keyboard shortcuts (Ctrl+N, Ctrl+,, Esc, Ctrl+S, Ctrl+1/2/3)
- [ ] Phase 5 — Motion polish (Framer Motion)
- [ ] Phase 6 — Perceived performance (startup audit, loading states, optimistic UI, focus traps)

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

## Mission: Dependency cleanup (deferred)
Status: NOT STARTED
- [ ] Remove unused deps from `package.json`: `electron-store`, `react-router-dom`, `lucide-react`, `uuid`
- [ ] None are imported anywhere in the current code
- [ ] Defer until after Session 6's docs commit lands

## Mission: Doc hygiene (recurring)
Status: ONGOING
- [ ] Archive journal.md when it exceeds ~500 lines → journal-archive.md
- [ ] Archive decisions.md when it exceeds ~200 entries → decisions-archive.md
- [ ] Check SESSION_BOOT.md token count monthly
- [ ] Move completed work from context.md §7.C to §7.A when it's a month old