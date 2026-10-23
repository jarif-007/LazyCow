# LazyCow — Handoff

Last updated: 2026-10-24
Last commit: a1f3105
Working tree: clean

## §1 Current Focus
Session 18 (Cloud plan + Auth/Account UI) is **committed** (`a1f3105`).
The Account sync-spinner bug fix is **committed** (`0557867`).
Journal stubs for both commits are filled, and the doc-sync follow-up
(journal + handoff) is committed. Nothing outstanding for this turn.

Ready for the next session. Logical next step: pick one from §2 "Not started"
or advance the Supabase backend per §5 Remaining backend.

## §2 Sub-task State

### Done & verified (Session 18 — committed)
- **Cloud Planning** — Sanitization logic defined (hints for `open_file`, `open_folder`, `launch_app`).
- **Auth UI** — Split screen, validation logic, focus mode. (`a1f3105`)
- **Account UI** — Bento grid, focus modal, Info modals, fluid resizing. (`a1f3105`)
- **Account sync bug fix** — `isSyncing` boolean → `syncingIds: Set<string>`; per-row and header buttons now spin independently. (`0557867`)

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
`npx tsc --noEmit` clean after the sync-spinner fix. Manual: clicking one row's "Sync Now" in the Sync Center modal spins only that row; the header button and other rows stay static. Clicking the header spins only the header. Auth page focus mode animates smoothly, Account focus modal expands without frame drops, info modals open/close cleanly.

## §4 Open Questions
- **Canonical key module.** Where should it live? `src/utils/keys.ts` feels right. Electron cannot import from `src/`.
- **Supabase vs Local Test.** Build Community page UI first with mock data, or wire Supabase Auth immediately?
- **`autoScrollSpeed` canonical default.** 6 (matches Settings presets: Slow 3 / Medium 6 / Fast 12) or 9 (matches `autoScroll.ts` and `ActionSequence.tsx`)? Recommend 6.

## §5 Uncommitted (mirrors git status)

Working tree: **clean.**
M — (none)

Recent commits:
a1f3105 feat: cloud architecture plan + Auth/Account UI (Session 18)
0557867 fix(account): per-item sync spinners are independent
740f194 docs: sync handoff hash
d921bf4 feat: durable settings persistence, dynamic splash theme, clickable logo routing

### §5-PENDING (in flight — cleared on confirmation)
- (none)

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