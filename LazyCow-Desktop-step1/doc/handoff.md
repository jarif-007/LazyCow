# LazyCow — Handoff

Last updated: 2026-10-23
Last commit: 740f194
Working tree: dirty

## §1 Current Focus
Session 18 (Cloud plan + Auth/Account UI) is code-complete but **uncommitted**.
This turn: verified every source file, fixed the Account.tsx sync-spinner bug
(header button and per-row buttons shared one `isSyncing` boolean — now keyed
per-target via `syncingIds`), and reconciled the doc set (context, decisions,
handoff, missions, journal).

Status: ready to commit. Two commits to land:
1. `fix(account)` — per-item sync spinners are independent.
2. `feat` — Session 18 batch (Auth.tsx, Account.tsx, App.tsx, docs).

## §2 Sub-task State

### Done & verified (Session 18)
- **Cloud Planning** — Sanitization logic defined (hints for `open_file`, `open_folder`, `launch_app`).
- **Auth UI** — Split screen, validation logic, focus mode.
- **Account UI** — Bento grid, focus modal, Info modals, fluid resizing.
- **Account sync bug fix (this turn)** — `isSyncing` boolean → `syncingIds: Set<string>`; per-row and header buttons now spin independently. Clicking one row's Sync Now leaves the header and other rows unchanged.

### Done in code — manual runtime verification pending
- Supabase integration (Auth & DB schema).
- Community page UI.
- Cloud Engine (Upload/Download sanitization).

### Not started
- Design polish Phase 1, surfaces 3+ — drawer cell stagger, progress ring settle, small-popover anchoring.
- Design polish Phases 2–6 — visual reset, typography, hero theme, micro-interactions.
- Canonical key module refactor.
- Batch 3 — overlay animation.
- Dependency cleanup (4 unused deps + `@tailwindcss/postcss` v4).
- README accuracy pass.
- Library & Settings responsive audit at 800–900px.
- NFR Phases 4–6.
- `autoScrollSpeed` default drift (6 vs 9 across three files).

### Bugs / blockers
- (none blocking)
- **`preload.ts` exposes `arrangeWindowsShortcut`; `main.ts` has no matching `ipcMain.handle`.** Dead bridge.
- **Vestigial `showDangerWarnings` prop in `Builder.tsx`.** Dead — `Settings.tsx` deletes the key on first load, so Builder always reads `true`.
- **`onShortcutStarted` dead channel.** Subscribed in `Library.tsx`, exposed in `preload.ts`, declared in `electron-env.d.ts` — but no `webContents.send('shortcut-started', ...)` exists in `main.ts`.
- **WhatsApp / Telegram multi-window ambiguity.**
- **Four copies of the key vocabulary.** (Recorder, ComboBuilder, SettingsBlockedTriggers, main.ts SPECIAL_KEY_MAP.)
- **`autoScrollSpeed` default drift.** `Settings.tsx` = 6, `autoScroll.ts` = 9, `ActionSequence.tsx` = 9. First setting change silently drops the effective value.

## §3 Last Verified Test
`npx tsc --noEmit` clean before this turn. Manual: Auth page layout doesn't clip in windowed mode; Account page focus modal expands smoothly; info modals open/close. **This turn:** Account.tsx sync-spinner bug fixed — clicking one row's "Sync Now" no longer spins the header button or other rows.

## §4 Open Questions
- **Canonical key module.** Where should it live? `src/utils/keys.ts` feels right. Electron cannot import from `src/`.
- **Supabase vs Local Test.** Build Community page UI first with mock data, or wire Supabase Auth immediately?
- **`autoScrollSpeed` canonical default.** 6 (matches Settings presets: Slow 3 / Medium 6 / Fast 12) or 9 (matches `autoScroll.ts` and `ActionSequence.tsx`)? Recommend 6.

## §5 Uncommitted (mirrors git status)

Working tree: **dirty.**
M ../doc/context.md
M ../doc/decisions.md
M ../doc/handoff.md
M ../doc/journal.md
M ../doc/missions.md
M src/App.tsx
?? src/pages/Account.tsx
?? src/pages/Auth.tsx
(`src/pages/Account.tsx` includes the sync-spinner fix applied this turn.)

### §5-PENDING (in flight — cleared on confirmation)
- [ ] Land the sync-spinner fix (commit 1).
- [ ] Land Session 18 batch (commit 2).
- [ ] Fill journal stub for both commits after they land.
- [ ] Post-commit: update `handoff.md` header to new HEAD.

### Remaining backend (unchanged)
- [ ] Integrate Supabase Auth logic (replace `setTimeout` mocks).
- [ ] Build Community Page UI.
- [ ] Build the Sanitization Engine (`sanitizeShortcutForUpload`).

## §6 Bootstrap order
1. electron/main.ts, electron/preload.ts, electron/electron-env.d.ts, electron/windowLayout.ts
2. src/types/actions.ts, src/pages/Library.tsx, src/pages/Builder.tsx
3. src/pages/Auth.tsx, src/pages/Account.tsx
4. src/utils/security.ts, src/utils/danger.ts, src/utils/settingsStorage.ts, src/utils/shortcutStorage.ts
5. src/components/ShortcutCard.tsx, src/components/ConfirmSecuredModal.tsx
6. src/components/ActionSequence.tsx, src/components/ActionSequence/SortableActionCard.tsx
7. src/components/WindowLayout/WindowLayoutPanel.tsx, src/components/WindowLayout/PositionDropdown.tsx
8. src/components/SettingsBlockedTriggers.tsx, src/components/BlockedTriggerList.tsx, src/components/ComboBuilder.tsx, src/hooks/useHotkeyRecorder.ts
9. src/components/AppDrawerModal.tsx, src/components/HiddenAppsModal.tsx, src/utils/appVisibility.ts, src/utils/appUsage.ts
10. index.html, package.json, tsconfig.json, vite.config.ts (only if needed)

## §7 Update rules
Update when: "checkpoint" / "sync" / "commit" | bug found/fixed/abandoned | decision made/reversed | sub-task verified.
Delete entries once committed AND documented in context.md.