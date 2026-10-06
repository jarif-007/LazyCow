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
Status: NOT STARTED
- [ ] **Symptom:** Shortcut launches Notepad (assigned to Left) + Calculator (Not Arranged). Notepad snaps to Left and comes to front. Calculator launches but appears **behind** Notepad instead of on top.
- [ ] **Cause:** The engine only calls `ForceForeground` on windows it *places*. Unassigned windows are never touched, so Windows decides their z-order — and it often leaves them behind.
- [ ] **Fix (proposed — Option A from the diagnostic):** After the placement pass, walk every launch-type action and bring-to-front any window that wasn't placed. No resize, no centering. Just make every launched window visible, newest on top.
- [ ] **Touches:**
  - `main.ts` — `buildPlacementsFromShortcut` returns a placement for every launch-type action, with `isUnassigned: true` for ones with no zone.
  - Zod schema — accepts the `isUnassigned` flag.
  - `windowLayout.ts` — second pass in the PowerShell loop; `Bring-Unassigned-Window` finds the window and calls `ForceForeground` only (skip `MoveWindow`).
  - Optional safety: if the window is fully off-screen, center it at native size.
- [ ] **Open question for the user:** Should `open_folder` actions also be brought to front? A user might open a folder "just to have it available" without wanting their layout disturbed. Lean: yes, but needs a decision before coding.
- [ ] **Source:** Diagnosed in a previous chat that hit its length limit (2026-10-06). Full reasoning preserved in the chat — key lines: "every app the shortcut launched should be visible", "the newest is on top because it was brought to front last".

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