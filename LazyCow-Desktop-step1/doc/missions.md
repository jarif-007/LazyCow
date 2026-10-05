# LazyCow — Active Missions

## Mission: Window Layout Runtime (Batch 2)
Status: IN PROGRESS
- [x] 2a — IPC plumbing (committed d67bce4)
- [x] 2b.1 — electron/windowLayout.ts created (uncommitted)
- [x] 2b.2 — rewire IPC handler in main.ts to call arrangeWindows (uncommitted)
- [ ] 2b.3 — call engine from runShortcutActions after action loop
- [ ] 2c — pass windowLayout from Library.tsx → runShortcut payload
- [ ] 3 — overlay animation (Option C, deferred)
- [ ] Verify DPI fix actually works on 1920×1080 @ 125%

**Blocker:** Notepad moves but doesn't fill left half. Last observed result: `not_found → "Could not parse engine output"` before temp-file fix. Not retested after.

## Mission: NFR Phases 4–6
Status: NOT STARTED
- [ ] Phase 4 — Keyboard shortcuts (Ctrl+N, Ctrl+,, Esc, Ctrl+S, Ctrl+1/2/3)
- [ ] Phase 5 — Motion polish (Framer Motion)
- [ ] Phase 6 — Perceived performance (startup audit, loading states, optimistic UI, focus traps)

## Mission: Library & Settings responsive audit
Status: NOT STARTED
- [ ] Test at 800–900px width (context.md §7.E flags this as untested)