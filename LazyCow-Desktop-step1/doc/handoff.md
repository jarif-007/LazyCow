# LazyCow — Handoff

Last updated: 2026-10-27

## §1 Current Focus
Cloud Sync "Phase 3" (GitHub-like model) is complete. We implemented robust diffing, manual/auto sync controls, pending deletions, Google OAuth via deep linking, and the cross-device Path Sanitization Engine. 
Next: Community Page UI and final cloud polish.

## §2 Sub-task State

### Done & verified (Session 20)
- [x] Phase 1: Fixed `handleRestore`, added `is_secured_custom` to schema, auto-sync defaults OFF, wired `Locate File`.
- [x] Phase 2: Split `loadData` into `refreshLocal` / `refreshRemote` / `scanBrokenPaths` for instant UI feedback.
- [x] Phase 3: Pending deletions tracking, per-shortcut auto-sync opt-in, explicit network error states, Cloud Vault statuses.
- [x] Phase 3.1: Fixed UI squishing/scrollbars in Sync Center.
- [x] Library Badges: Added Synced/Not Synced/Edited Locally labels + Sync Now / Restore from Cloud in the 3-dot menu.
- [x] Password Recovery: Wired up "Forgot Password" flow with PKCE and Set New Password UI.
- [x] Google OAuth: Configured Google Cloud & Supabase. Implemented Deep Linking (`lazycow://`).
- [x] Path Sanitization Engine: `sanitizeShortcutForUpload` (adds hints) and `hydrateDownloadedShortcut` (auto-resolves paths/apps).
- [x] RLS ID Collision Fix: `uploadShortcutToCloud` catches RLS errors and generates new IDs (fixes Email vs Google login conflicts).

### In Progress
- [ ] Community Page UI.
- [ ] Wire Community Page to Cloud Vault.

### Bugs / blockers
- (none blocking)
- **`preload.ts` exposes `arrangeWindowsShortcut`; `main.ts` has no matching `ipcMain.handle`.** Dead bridge.
- **Vestigial `showDangerWarnings` prop in `Builder.tsx`.**
- **`onShortcutStarted` dead channel.**
- **`autoScrollSpeed` default drift.** `Settings.tsx` = 6, `autoScroll.ts` = 9, `ActionSequence.tsx` = 9.

## §3 Last Verified Test
`npx tsc --noEmit` clean.
Manual: Google Sign-In works via local server fallback. RLS collisions handled gracefully by generating new IDs. Path hints correctly applied during hydration.

## §4 Open Questions
- **Canonical key module.** Where should it live? `src/utils/keys.ts` feels right. Electron cannot import from `src/`.
- **`autoScrollSpeed` canonical default.** 6 (matches Settings presets: Slow 3 / Medium 6 / Fast 12) or 9 (matches `autoScroll.ts` and `ActionSequence.tsx`)? Recommend 6.

## §5 Uncommitted (mirrors git status)
Working tree: **Clean** (after you commit the current Cloud changes).

Recent commits:
(next commit will be the Cloud Sync overhaul)

### §5-PENDING (in flight — cleared on confirmation)
- [ ] Build the Community Page UI.
- [ ] Implement `run_script` Error Surfacing (Option C).

## §6 Bootstrap order
1. electron/main.ts, electron/preload.ts, electron/electron-env.d.ts, electron/windowLayout.ts
2. src/types/actions.ts, src/pages/Library.tsx, src/pages/Builder.tsx
3. src/pages/Auth.tsx, src/pages/Account.tsx, src/utils/supabase.ts, src/utils/cloudSync.ts
4. src/utils/security.ts, src/utils/danger.ts, src/utils/settingsStorage.ts, src/utils/shortcutStorage.ts
5. src/components/ShortcutCard.tsx, src/components/ConfirmSecuredModal.tsx
6. src/components/ActionSequence.tsx, src/components/ActionSequence/SortableActionCard.tsx
7. src/components/WindowLayout/WindowLayoutPanel.tsx, src/components/WindowLayout/PositionDropdown.tsx
8. src/components/SettingsBlockedTriggers.tsx, src/components/BlockedTriggerList.tsx, src/components/ComboBuilder.tsx, src/hooks/useHotkeyRecorder.ts
9. src/components/AppDrawerModal.tsx, src/components/HiddenAppsModal.tsx, src/utils/appVisibility.ts, src/utils/appUsage.ts
10. index.html, package.json, tsconfig.json, vite.config.ts (only if needed)

## §7 Update rules
Update when: "checkpoint" / "sync" / "commit" | bug found/fixed/abandoned | decision made/reversed | sub-task verified.