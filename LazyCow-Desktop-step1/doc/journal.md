# LazyCow — Change Journal
Auto-stubbed by `.githooks/post-commit`. AI fills in Issue/Solution/Files/Verified during checkpoint.
Never delete entries. Never reorder.

Format:
## YYYY-MM-DD — <commit subject>
- **Issue:** what raised this
- **Solution:** what we did
- **Files:** path (function/component)
- **Verified:** yes / no / partial
- **Commit:** <short hash>

---

## 2026-09-30 — docs: sync context.md — Window Layout feature, selection mode, dnd-kit rebuild, single-instance lock
- **Issue:** context.md had drifted from the actual code after the dnd-kit rebuild and Window Layout UI work.
- **Solution:** Rewrote §3–§7 to reflect the current component tree, the shortcut-level windowLayout feature, and Session 5 notes.
- **Files:** doc/context.md; plus (rolled into same commit) src/components/ActionSequence/*, src/components/WindowLayout/*, src/pages/Builder.tsx, electron/main.ts, src/types/actions.ts
- **Verified:** yes (tsc + eslint clean)
- **Commit:** d67bce4
## 2026-10-06 — chore: add session boot system (docs + boot.mjs + boot.bat + git hook)
- **Issue:** Sessions get suspended mid-work, losing context. New AI chats had no deterministic way to resume without pasting raw conversation transcripts.
- **Solution:** Added a 7-file boot system — voice.md, decisions.md, missions.md, handoff.md, journal.md, onboarding.md, and auto-generated SESSION_BOOT.md. A boot.mjs script assembles everything + git state into one clipboard-ready file. boot.bat provides one-click launch. A post-commit git hook auto-stubs this journal on every commit.
- **Files:** doc/voice.md, doc/decisions.md, doc/missions.md, doc/handoff.md, doc/journal.md, doc/onboarding.md; lazycoww/scripts/boot.mjs; lazycoww/boot.bat; lazycoww/.githooks/post-commit; lazycoww/jsconfig.json
- **Verified:** yes — boot.mjs writes to LazyCow-Desktop-step1/doc/SESSION_BOOT.md (~15000 tokens, all 7 sections populated). Hook fires on commit (stub auto-appended).
- **Commit:** 83d99a7

## 2026-10-06 — docs: fill in journal stub for boot system commit
- **Issue:** (fill in)
- **Solution:** (fill in)
- **Files:** (fill in)
- **Verified:** (fill in)
- **Commit:** bd40686
