# LazyCow — Handoff

Last updated: 2026-10-10
Last commit: f6be183
Working tree: (see git status)

## §1 Current Focus
Session 9 shipped two Window Layout correctness fixes on top of Session 8's
secured-shortcuts work:
- `eedfb0e` — orphaned zone assignments are pruned on delete, on edit-load,
  and on read/write. Fixes the "zone shows as taken by another action after
  I deleted its owner" bug and the "second URL won't tile" symptom that had
  the same root cause.
- `f6be183` — Test Layout and Test Flow are now cancellable (via an
  AbortSignal that kills the child PowerShell process), they no longer fire
  OS toasts, and a new informational banner explains the browser-tab-reuse
  limitation when 2+ `open_url` actions are assigned.

No sub-task is currently in flight. Next pick from `missions.md`. Candidates
in rough priority order:
1. **Manual runtime verification of Session 8 + 9** — the full test matrix
   (secured double-press, ConfirmSecuredModal, migration, hotkey test outcomes,
   cancellable tests, orphan cleanup).
2. README accuracy pass (still markets non-existent features).
3. Window Layout Overlay Animation (Batch 3).
4. Library & Settings responsive audit at 800–900px.
5. Dependency cleanup (4 unused deps).
6. NFR Phases 4–6.

## §2 Sub-task State

### Done & verified (tsc clean)
- Session 1–6 work (see `journal.md` for details): cancellation semantics,
  responsive layout, validation hook, URL helpers, GPU workaround, context
  menu, rAF resize, backdrop-blur removal, window layout engine (DPI, claim-
  the-zone, per-placement polling, parallel fire, unassigned-window centering),
  broken-path pre-flight, Test Layout / Test Flow, richer toasts.
- Session 7: `showDangerWarnings` toggle + `open_file` filter fix
  (`7ed280c`) — **superseded by Session 8.**
- Session 8: secured shortcuts, per-action safety override, mandatory Test
  Hotkey, ComboBuilder rewrite, `useHotkeyRecorder` `e.code` fix
  (`cfec1a6`, `dc34b3c`).
- Session 9: orphan-assignment pruning (`eedfb0e`) and cancellable test runs
  + multi-URL notice (`f6be183`).

### Done in code — manual runtime verification pending
- **Secured double-press on minimized window.** Focused → modal; minimized
  → toast; second press within window → runs directly.
- **ConfirmSecuredModal filter + per-row label editor.** Staged edits persist
  on "Run Anyway."
- **`securedShortcutsEnabled` migration on a legacy profile.** A profile that
  had `showDangerWarnings: false` should see the toggle read as off after
  Settings loads, and the old key should be gone.
- **`migrateShortcutsSecured` idempotency.** A shortcut with no `secured` field
  gets one computed; re-running Library doesn't re-migrate.
- **Test Hotkey four outcomes.** Correct combo → "Verified"; wrong combo →
  "Wrong key combo"; correct-but-swallowed → "won't work as a hotkey";
  nothing → "No key detected."
- **Cancel Test Layout / Cancel Test Flow.** Both flip the button back
  immediately; the child PowerShell process is killed on cancel.
- **Multi-URL notice.** Appears when 2+ assigned actions are `open_url`;
  disappears when only one is assigned.
- **Orphan cleanup.** Delete an assigned action → the freed zone is
  available for a new assignment; the new action tiles correctly.

### Not started
- Batch 3 — overlay animation (deferred)
- Dependency cleanup (4 unused deps: `electron-store`, `react-router-dom`,
  `lucide-react`, `uuid`)
- README accuracy pass
- Library & Settings responsive audit at 800–900px
- NFR Phases 4–6
- Performance profile (hardware-adaptive timings) — deferred
- Workspace Closer — deferred
- Text expansion — deferred (v2)

### Bugs / blockers
- (none blocking)
- **Vestigial `showDangerWarnings` prop in `Builder.tsx`.** `Builder.readShowDangerWarnings()`
  reads a key that `Settings.tsx` now deletes on first load — after migration
  the Builder always reads `true`. Not user-observable (there's no UI to
  toggle the old key), but the prop is dead. Tracked in `missions.md` under
  "Code hygiene."
- **`onShortcutStarted` dead channel.** Subscribed in `Library.tsx`, exposed
  in `preload.ts`, declared in `electron-env.d.ts`, but no
  `webContents.send('shortcut-started', ...)` exists in `main.ts`. Tracked in
  `missions.md` under "Code hygiene."
- **`Builder.handleSave` reimplements `hasDangerousActions()` inline.** Misses
  dangerous-extension `open_file`, so create-time and run-time classification
  can disagree. Tracked in §4 below.
- Compiled `dist-electron/main.js` has mangled registry paths in the
  windowLayout C# block. Source is correct; the built artifact is not. Low
  priority.

## §3 Last Verified Test
Session 9 — `npx tsc --noEmit` clean across the whole tree. Runtime verification
of the two Session 9 fixes is pending (see §2).

Previously verified (still hold):
- Engine + claim-the-zone (Batch 2d) on 1920×1080 @ 125% — 4-app quad grid ✅
- Not-Arranged App Visibility — Calculator centered on top of Notepad ✅
- Broken Path Fix UX (Q2b) — Fix Paths lands on the broken action ✅
- Hotkey suppression while recording — recorder captures Ctrl+B, existing
  shortcut doesn't fire ✅
- Unsaved-changes baseline — Edit Flow → leave without touching → no modal ✅
- Edit-state clearing — Edit Flow → Library → back to Builder → fresh form ✅

## §4 Open Questions
- **`Builder.handleSave` classification.** Should it use the shared
  `hasDangerousActions()` helper instead of its inline compute? The inline
  version misses `open_file` with a dangerous extension. Fixing it means
  creating a shortcut with `open_file → notepad.exe` gets `secured: true` by
  default, matching what the run-time gate would do.
- **`open_url` same-browser limitation.** Documented in `WindowLayoutPanel`
  and `decisions.md`. No engine-side fix planned. Revisit only if the browser
  tab-reuse behavior becomes a common complaint.

## §5 Uncommitted (mirrors git status)

Working tree: (see `git status` at session start — only the docs changes for
this checkpoint are in flight).

Recent commits (most recent first):
- `f6be183` fix(window-layout): orphan cleanup, cancellable tests, no test toast, multi-URL notice
- `eedfb0e` fix(window-layout): prune orphaned zone assignments on delete and read
- `929eb76` docs: checkpoint — secured shortcuts + per-action override + Test Hotkey (Session 8)
- `dc34b3c` feat(renderer): secured shortcuts + per-action safety override + mandatory Test Hotkey
- `cfec1a6` feat(electron): test-hotkey IPC + secured-shortcut double-press runtime
- `576fe11` docs: fill journal entries for 4 bug fixes
- `49c1802` fix: clear Builder edit session when navigating away

### §5-PENDING (in flight — cleared on confirmation)
- (nothing pending — Session 9 fixes committed)

## §6 Bootstrap order
1. electron/main.ts, electron/preload.ts, electron/electron-env.d.ts, electron/windowLayout.ts
2. src/types/actions.ts, src/pages/Library.tsx, src/pages/Builder.tsx
3. src/utils/security.ts, src/utils/danger.ts, src/components/ConfirmSecuredModal.tsx
4. src/components/ActionSequence.tsx, src/components/ActionSequence/SortableActionCard.tsx
5. package.json, tsconfig.json, vite.config.ts (only if needed)

## §7 Update rules
Update when: "checkpoint" / "sync" / "commit" | bug found/fixed/abandoned | decision made/reversed | sub-task verified.
Delete entries once committed AND documented in context.md.