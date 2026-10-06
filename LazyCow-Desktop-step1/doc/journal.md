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
- **Issue:** The previous commit's stub (83d99a7, boot system) had `(fill in)` placeholders that needed real content before they could be trusted as history.
- **Solution:** Filled the stub with issue/solution/files/verified for the boot system work.
- **Files:** doc/journal.md
- **Verified:** yes (routine documentation)
- **Commit:** bd40686

## 2026-10-06 — docs: add boot system workflow reference for contributors
- **Issue:** Teammates pulling the repo had no explanation of what each .md file in doc/ was for, or how the boot workflow operates. Needed a discoverable entry point.
- **Solution:** Added doc_helper.txt as a contributor-facing reference: what each .md does, what keywords the AI responds to ("checkpoint", "commit"), batch-paste workflow for new sessions, and troubleshooting tips. Gitignored SESSION_BOOT.md and touchlog.txt (build artifacts). Polished boot.mjs with --lite flag and proactive-suggestion meta-prompt. Updated voice.md and missions.md accordingly.
- **Files:** doc/doc_helper.txt (new); doc/.gitignore (new); doc/voice.md; doc/missions.md; lazycoww/scripts/boot.mjs
- **Verified:** yes — boot.mjs generates the boot file successfully in both normal and --lite mode. Hook stubs on commit.
- **Commit:** 89e4626

## 2026-10-06 — feat: Window Layout runtime engine — DPI fix verified, system windows filtered
- **Issue:** Window Layout engine couldn't place windows correctly. Notepad moved but never filled the target zone on 1920×1080 @ 125% display scaling. Root cause: PowerShell was running DPI-unaware, so it computed zone rectangles in virtualized coordinates (1536×864) instead of physical (1920×1080).
- **Solution:** Applied `__COMPAT_LAYER=HIGHDPIAWARE` env var when spawning PowerShell (via `execFile` options) + `SetThreadDpiAwarenessContext(-4)` (PER_MONITOR_AWARE_V2) at script top. Also added `using System;` to the inline C# for `IntPtr`. Normalized single-object `ConvertTo-Json` output to an array. Added system-window blocklist (`TextInputHost`, `ShellExperienceHost`, `SearchHost`, `StartMenuExperienceHost`, etc.) to stop invisible overlays from triggering false occupancy. Added zero-size window filter.
- **Files:** electron/windowLayout.ts; electron/main.ts; electron/preload.ts; electron/electron-env.d.ts; src/types/actions.ts
- **Verified:** yes — `SCREEN_DEBUG: area=0,30 1920x1050 BoundsW=1920x1080` (physical pixels confirmed). Notepad fills left half. MoveWindow returned True.
- **Commit:** 0e6a10b

## 2026-10-06 — feat(window-layout): claim assigned zones + bring to front (Batch 2d)
- **Issue:** The old engine fell back to center-small when a zone was occupied, which broke the user's design (apps didn't land where assigned). Users expected Windows Snap behavior — apps overwrite whatever's in the target zone.
- **Solution:** Removed occupancy blocking entirely. Every placement now claims its zone unconditionally. `Place-Window` calls `ShowWindow(SW_RESTORE)` (un-minimize) + `MoveWindow` + `ForceForeground` (via AttachThreadInput + BringWindowToTop + SetForegroundWindow). `Is-Zone-Occupied` renamed to `Log-Zone-Occupancy` (diagnostic-only). `Place-Centered` removed. Simplified main placement loop to `placed` or `not_found`.
- **Files:** electron/windowLayout.ts
- **Verified:** yes — 4-app quad grid on 1920×1080 @ 125%: all four Notepads fill their quadrants, all visible at once.
- **Commit:** 2143330

## 2026-10-06 — docs: fill journal stub for DPI fix commit
- **Issue:** The post-commit hook stubbed commit 0e6a10b with `(fill in)` placeholders that needed real content.
- **Solution:** Filled the stub with the DPI fix issue/solution/files/verified details.
- **Files:** doc/journal.md
- **Verified:** yes (routine documentation)
- **Commit:** 4d2d8d9

## 2026-10-06 — docs: fill journal stubs for DPI fix + Batch 2d commits
- **Issue:** Two prior commits (0e6a10b DPI fix, 2143330 Batch 2d) had `(fill in)` stubs at the bottom of journal.md.
- **Solution:** Filled both stubs with real issue/solution/files/verified content.
- **Files:** doc/journal.md
- **Verified:** yes (routine documentation)
- **Commit:** 79289b0

## 2026-10-06 — docs: sync handoff to post-DPI/Batch-2d state; fill journal stub
- **Issue:** handoff.md was stale (header said 89e4626, §2 didn't record DPI + Batch 2d as verified). Also needed to fill the previous commit's journal stub.
- **Solution:** Full replacement of handoff.md with current state (verified DPI fix + claim-the-zone behavior + quad grid test). Filled the 79289b0 journal stub.
- **Files:** doc/handoff.md (full rewrite); doc/journal.md
- **Verified:** yes (routine documentation)
- **Commit:** babb9cc
  
## 2026-10-06 — docs: sync boot files with Session 6 (parallel engine, broken-path, Test Layout)
- **Issue:** The boot files had drifted from the code after Session 6's Window Layout work — the engine was wired up and verified, but the docs still described it as "planned" and listed the center-small fallback (superseded by claim-the-zone).
- **Solution:** Full reconciliation across the five boot files. context.md updated for the parallel engine, per-shortcut budget, per-placement polling, user-judge mechanism, broken-path pre-flight, Test Layout/Flow, info (i) button, and richer toasts. decisions.md appended six new entries. handoff.md rewritten. missions.md ticked Batch 2 to COMPLETE and added Q2b, Batch 3, README accuracy, and dependency cleanup missions.
- **Files:** doc/context.md, doc/handoff.md, doc/missions.md, doc/decisions.md, doc/journal.md
- **Verified:** routine documentation
- **Commit:** <pending — filled at next checkpoint>
## 2026-10-06 — feat(window-layout): parallel engine, per-shortcut budget, per-placement polling
- **Issue:** (fill in)
- **Solution:** (fill in)
- **Files:** (fill in)
- **Verified:** (fill in)
- **Commit:** 8d10cc4

## 2026-10-06 — feat: broken-path pre-flight, Test Layout/Flow, richer completion toasts
- **Issue:** (fill in)
- **Solution:** (fill in)
- **Files:** (fill in)
- **Verified:** (fill in)
- **Commit:** 490588b
