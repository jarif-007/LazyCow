# LazyCow — Handoff

Last updated: 2026-10-11
Last commit: a06b193
Working tree: (see git status)

## §1 Current Focus
Session 10 fixed the open_url layout bugs end to end. Two code commits landed on
top of Session 9, and the docs checkpoint (`5da4193`) landed on top of those:

- `7a2d54e` — sync-hotkeys payload now carries `windowLayout`. Hotkey-triggered
  runs no longer skip the layout engine while Library runs worked. The two paths
  read the same data now.
- `a06b193` — Node-side pre-snapshot + URL title matching + fallback pass + stall
  exit + shell.openExternal timeout + URL budget bump. Chrome multi-URL layouts
  now place reliably. Firefox multi-URL is documented as unsupported.

No sub-task is currently in flight. Next pick from `missions.md`. Candidates
in rough priority order:
1. **Manual runtime verification of Session 8 + 10** — Session 8's secured-
   shortcut flow (double-press, ConfirmSecuredModal, migration) plus Session 10's
   Chromium multi-URL case, stall exit timing, hotkey-triggered runs, and the
   `shell.openExternal` timeout.
2. **WhatsApp / Telegram multi-window limitation** — the engine can't yet tell
   the chat window from the call window. Documented in `missions.md`.
3. README accuracy pass (still markets non-existent features).
4. Window Layout Overlay Animation (Batch 3).
5. Library & Settings responsive audit at 800–900px.
6. Dependency cleanup (4 unused deps).
7. NFR Phases 4–6.

## §2 Sub-task State

### Done & verified (tsc clean)
- Session 1–6 work (see `journal.md`): cancellation semantics, responsive layout,
  validation hook, URL helpers, GPU workaround, context menu, rAF resize,
  backdrop-blur removal, window layout engine (DPI, claim-the-zone, per-placement
  polling, parallel fire, unassigned-window centering), broken-path pre-flight,
  Test Layout / Test Flow, richer toasts.
- Session 7: `showDangerWarnings` toggle + `open_file` filter fix (`7ed280c`)
  — superseded by Session 8.
- Session 8: secured shortcuts, per-action safety override, mandatory Test Hotkey,
  ComboBuilder rewrite, `useHotkeyRecorder` `e.code` fix (`cfec1a6`, `dc34b3c`).
- Session 9: orphan-assignment pruning (`eedfb0e`) and cancellable test runs
  + multi-URL notice (`f6be183`).
- Session 10: sync-hotkeys payload fix (`7a2d54e`) and pre-snapshot + URL title
  matching + Firefox notice (`a06b193`).

### Done in code — manual runtime verification pending
- **Hotkey-triggered layout.** With the sync payload carrying `windowLayout`,
  a hotkey-triggered run should behave identically to a Library Run. Verified
  once during Session 10 debugging (Chromium), but not yet as a final pass.
- **Chromium multi-URL placement.** `google.com` and `youtube.com` in the same
  browser, assigned to different zones, now place reliably via title matching.
  Verified end-to-end in Session 10 (Helium with "New Tab New Window").
- **Firefox multi-URL** — documented as unsupported. Firefox opens external URLs
  as tabs, not windows, so only one window ever appears. UI notice updated.
- **Stall exit.** Poll loop now exits after 5s of no placement progress instead
  of burning the full budget. Verified in a Firefox test — shortcut finished at
  ~5s instead of 18s.
- **`shell.openExternal` 3s timeout.** Under a hung ShellExecute the action loop
  now moves on. Not yet verified against an actually-hung browser.
- **Session 8's secured-shortcut flow** — still pending the full runtime test
  matrix (double-press, ConfirmSecuredModal filter, migration).

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
- **Vestigial `showDangerWarnings` prop in `Builder.tsx`.** Reads a key that
  `Settings.tsx` now deletes on first load. After migration the Builder always
  reads `true` — the prop is dead. Tracked in `missions.md` under "Code hygiene."
- **`onShortcutStarted` dead channel.** Subscribed in `Library.tsx`, exposed
  in `preload.ts`, declared in `electron-env.d.ts`, but no
  `webContents.send('shortcut-started', ...)` exists in `main.ts`. Tracked in
  `missions.md` under "Code hygiene."
- **`Builder.handleSave` reimplements `hasDangerousActions()` inline.** Misses
  dangerous-extension `open_file`. Tracked in §4 below.
- **WhatsApp / Telegram multi-window ambiguity.** The engine can't yet tell
  the chat window from the call window. Tracked in `missions.md` — no fix
  planned until a real user hits it.
- **Cold-start layout failure (Session 11).** When the PC is freshly booted
  and `npm run dev` runs for the first time, the layout engine does not place
  windows correctly. Restarting `npm run dev` (no OS reboot) works. Suspected
  root cause: PowerShell's first `Add-Type -TypeDefinition <C#>` call on a
  cold system has to spin up `csc.exe` and compile the `WinArranger` class —
  either delaying placement past the poll deadline, or throwing because of
  `$ErrorActionPreference = 'Stop'`. Under investigation. Tracked in
  `missions.md`.
- Compiled `dist-electron/main.js` has mangled registry paths in the
  windowLayout C# block. Source is correct; the built artifact is not. Low
  priority.

## §3 Last Verified Test
Session 10 — `npx tsc --noEmit` clean across the whole tree.

- Chromium multi-URL test (Helium, "New Tab New Window" extension) — verified:
PRE_SNAPSHOT: 45 windows passed from Node
URL_TITLE_MATCH: https://google.com -> 'Google - Helium'
URL_TITLE_MATCH: https://youtube.com -> 'YouTube - Helium'
All 4 zones placed.
The pre-existing `meet.google.com` window was correctly excluded (never
grabbed for the google.com placement).
Previously verified (still hold):
- Engine + claim-the-zone on 1920×1080 @ 125% — 4-app quad grid ✅
- Not-Arranged App Visibility — Calculator centered on top of Notepad ✅
- Broken Path Fix UX — Fix Paths lands on the broken action ✅
- Hotkey suppression while recording ✅
- Unsaved-changes baseline ✅
- Edit-state clearing ✅

## §4 Open Questions
- **`Builder.handleSave` classification.** Should it use the shared
  `hasDangerousActions()` helper instead of its inline compute? The inline
  version misses `open_file` with a dangerous extension. Fixing it means
  creating a shortcut with `open_file → notepad.exe` gets `secured: true` by
  default, matching the run-time gate.
- **WhatsApp / Telegram chat-vs-call window.** Best heuristic is probably
  "prefer the largest window for the process". Not implemented until a real
  user hits the ambiguity.
- **Test Layout still uses synthetic `test-layout-<ts>` ids.** Empty results
  were observed in one Session 10 test run. Suspected race with a
  previous-in-flight Test Layout. Not reproducible after the fix — worth
  monitoring.

## §5 Uncommitted (mirrors git status)

Working tree: clean.

Recent commits (most recent first):
- `5da4193` docs: checkpoint — Session 10 open_url layout fixes
- `a06b193` fix(electron): pre-snapshot + URL title matching for window layout
- `7a2d54e` fix(renderer): include windowLayout in syncHotkeys payload
- `1d42950` docs: checkpoint — Session 9 window layout fixes
- `f6be183` fix(window-layout): orphan cleanup, cancellable tests, no test toast, multi-URL notice
- `eedfb0e` fix(window-layout): prune orphaned zone assignments on delete and read
- `929eb76` docs: checkpoint — secured shortcuts + per-action override + Test Hotkey (Session 8)
- `dc34b3c` feat(renderer): secured shortcuts + per-action safety override + mandatory Test Hotkey
- `cfec1a6` feat(electron): test-hotkey IPC + secured-shortcut double-press runtime

### §5-PENDING (in flight — cleared on confirmation)
- (nothing pending)

## §6 Bootstrap order
1. electron/main.ts, electron/preload.ts, electron/electron-env.d.ts, electron/windowLayout.ts
2. src/types/actions.ts, src/pages/Library.tsx, src/pages/Builder.tsx
3. src/utils/security.ts, src/utils/danger.ts, src/components/ConfirmSecuredModal.tsx
4. src/components/ActionSequence.tsx, src/components/ActionSequence/SortableActionCard.tsx
5. src/components/WindowLayout/WindowLayoutPanel.tsx, src/components/WindowLayout/PositionDropdown.tsx
6. package.json, tsconfig.json, vite.config.ts (only if needed)

## §7 Update rules
Update when: "checkpoint" / "sync" / "commit" | bug found/fixed/abandoned | decision made/reversed | sub-task verified.
Delete entries once committed AND documented in context.md.