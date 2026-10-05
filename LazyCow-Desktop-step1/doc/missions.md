# LazyCow — Active Missions

## Mission: Window Layout Runtime (Batch 2)
Status: IN PROGRESS
- [x] 2a — IPC plumbing (committed d67bce4)
- [x] 2b.1 — electron/windowLayout.ts created (uncommitted)
- [x] 2b.2 — rewire IPC handler in main.ts to call arrangeWindows (uncommitted)
- [x] 2b.DPI — DPI fix verified end-to-end (Notepad snaps to left half on 1920×1080 @ 125%)
- [ ] 2b.Multi — test 2 placements (split 50/50) and 4 placements (quad)
- [ ] 2c — call engine from runShortcutActions after action loop
- [ ] 2c.2 — pass windowLayout from Library.tsx → runShortcut payload
- [ ] 2d — remove SCREEN_DEBUG / PLACE_DEBUG / PLACE_RESULT diagnostics (keep OCCUPIED_BY)
- [ ] 3 — overlay animation (Option C, deferred)

**Blocker:** (none — DPI bug resolved)

## Mission: NFR Phases 4–6
Status: NOT STARTED
- [ ] Phase 4 — Keyboard shortcuts (Ctrl+N, Ctrl+,, Esc, Ctrl+S, Ctrl+1/2/3)
- [ ] Phase 5 — Motion polish (Framer Motion)
- [ ] Phase 6 — Perceived performance (startup audit, loading states, optimistic UI, focus traps)

## Mission: Library & Settings responsive audit
Status: NOT STARTED
- [ ] Test at 800–900px width (context.md §7.E flags this as untested)

## Mission: Doc hygiene (recurring)
Status: ONGOING
- [ ] Archive journal.md when it exceeds ~500 lines → journal-archive.md
- [ ] Archive decisions.md when it exceeds ~200 entries → decisions-archive.md
- [ ] Check SESSION_BOOT.md token count monthly
- [ ] Move completed work from context.md §7.C to §7.A when it's a month old