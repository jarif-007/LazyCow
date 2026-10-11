# LazyCow — Handoff

Last updated: 2026-10-12
Last commit: 9e0cf2a
Working tree: (see git status)

## §1 Current Focus
Session 11 overhauled the hotkey recording + verification UX, and gave the
Blocked Triggers panel a proper edit surface plus a page-zoom setting.

Three commits on top of Session 10's `5da4193`/`fd63388`:
- `ab8fdba` — recorder rewrite + canonical key vocabulary. Chips and
  recorder now share one source of truth; shifted symbols store the
  physical key; single-main-key enforcement.
- `ba8e6cd` — Test Hotkey is now a user-paced 3-step flow (Test → Verify →
  Verified) with no timer. Windows-rejected combos auto-add to Blocked
  Triggers.
- `9e0cf2a` — Blocked Triggers polish (expanded defaults, token-filter,
  fixed height, pencil loads the trigger into the recorder) + Page Zoom
  (50%–200%, Ctrl+ +/-/0, persisted).

No sub-task is currently in flight. Next pick from `missions.md`. Candidates
in rough priority order:
1. **Manual runtime verification of Sessions 8, 10, and 11.** The full test
   matrix from the last three sessions — secured double-press, ConfirmSecuredModal,
   Chromium multi-URL, stall exit, hotkey test outcomes, zoom persistence,
   blocked-trigger filter, pencil-loads-trigger.
2. **Canonical key module refactor** — see new mission. `canonicalKeyFromEvent`,
   `KEY_GROUPS`, `KEY_ALIASES`, and the aliases-in-`SettingsBlockedTriggers`
   migration table are four copies of the same vocabulary. Extract to
   `src/utils/keys.ts`.
3. **WhatsApp / Telegram multi-window limitation** — documented, no fix
   planned until a real user hits it.
4. README accuracy pass (still markets non-existent features).
5. Window Layout Overlay Animation (Batch 3).
6. Library & Settings responsive audit at 800–900px.
7. Dependency cleanup (4 unused deps).
8. NFR Phases 4–6.

## §2 Sub-task State

### Done & verified (tsc clean)
- Session 1–6 work: cancellation semantics, responsive layout, validation
  hook, URL helpers, GPU workaround, context menu, rAF resize, backdrop-blur
  removal, window layout engine (DPI, claim-the-zone, per-placement polling,
  parallel fire, unassigned-window centering), broken-path pre-flight,
  Test Layout / Test Flow, richer toasts.
- Session 7: `showDangerWarnings` toggle + `open_file` filter fix
  (`7ed280c`) — superseded by Session 8.
- Session 8: secured shortcuts, per-action safety override, mandatory
  Test Hotkey, ComboBuilder rewrite, `useHotkeyRecorder` `e.code` fix
  (`cfec1a6`, `dc34b3c`).
- Session 9: orphan-assignment pruning (`eedfb0e`) and cancellable test
  runs + multi-URL notice (`f6be183`).
- Session 10: sync-hotkeys payload fix (`7a2d54e`), pre-snapshot + URL
  title matching (`a06b193`), docs checkpoint (`5da4193`).
- Session 10 cleanup: cold-start diagnostic closed as not-reproduced (`fd63388`).
- Session 11: recorder rewrite (`ab8fdba`), Test Hotkey redesign (`ba8e6cd`),
  blocked triggers polish + page zoom (`9e0cf2a`).

### Done in code — manual runtime verification pending
- **Full hotkey flow** — chip-then-record, record-then-chip, modifier-only
  picking, multi-modifier combos, single-main-key replacement, wrong-combo
  error text, no-timer Verify, Cancel, verification invalidation on recorder
  click or combo change.
- **Blocked Triggers** — `Win + <letter>` in defaults with OS badge,
  token-based live filter, "Already blocked" state on Add button,
  pencil-loads-trigger, delete confirmation modal for OS entries.
- **Page Zoom** — Ctrl + +/-/0 shortcuts (layout-agnostic via physical
  key codes), persisted across restarts, unaffected by window resize.
- **Session 8 secured-shortcut flow** — still pending the full runtime test
  matrix (double-press, ConfirmSecuredModal filter, migration).

### Not started
- Canonical key module refactor (new — see `missions.md`)
- Batch 3 — overlay animation
- Dependency cleanup (4 unused deps)
- README accuracy pass
- Library & Settings responsive audit at 800–900px
- NFR Phases 4–6
- Performance profile (hardware-adaptive timings) — deferred
- Workspace Closer — deferred
- Text expansion — deferred (v2)

### Bugs / blockers
- (none blocking)
- **Vestigial `showDangerWarnings` prop in `Builder.tsx`.** Reads a key
  that `Settings.tsx` now deletes on first load. Dead.
- **`onShortcutStarted` dead channel.** Subscribed in `Library.tsx`, exposed
  in `preload.ts`, declared in `electron-env.d.ts`, but no
  `webContents.send('shortcut-started', ...)` exists in `main.ts`.
- **`Builder.handleSave` reimplements `hasDangerousActions()` inline.**
  Misses dangerous-extension `open_file`.
- **WhatsApp / Telegram multi-window ambiguity.** No fix planned until a
  real user hits it.
- **Four copies of the key vocabulary.** `canonicalKeyFromEvent` in the
  hook, `KEY_GROUPS` in ComboBuilder, `LEGACY_KEY_ALIASES` in
  SettingsBlockedTriggers, and `SPECIAL_KEY_MAP` in main. All must agree.
  See new mission "Canonical key module refactor".
- Compiled `dist-electron/main.js` has mangled registry paths in the
  windowLayout C# block. Source is correct; the built artifact is not.

## §3 Last Verified Test
Session 11 — `npx tsc --noEmit` clean across the whole tree. Manual runtime
verification of the hotkey flow, blocked trigger filter, page zoom, and the
delete confirmation modal is pending (see §2).

Previously verified (still hold):
- Engine + claim-the-zone on 1920×1080 @ 125% — 4-app quad grid ✅
- Not-Arranged App Visibility — Calculator centered on top of Notepad ✅
- Broken Path Fix UX — Fix Paths lands on the broken action ✅
- Chromium multi-URL layout — pre-snapshot + title matching ✅
- Cold-start diagnostic closed — not reproduced on warm restart ✅

## §4 Open Questions
- **`Builder.handleSave` classification.** Should it use the shared
  `hasDangerousActions()` helper instead of its inline compute?
- **WhatsApp / Telegram chat-vs-call window.** Best heuristic is probably
  "prefer the largest window for the process".
- **Canonical key module.** Where should it live? `src/utils/keys.ts`
  feels right — shared by renderer + electron. But electron cannot import
  from `src/` due to the bundle split. Might need a mirrored file in
  `electron/`. To be decided when the mission starts.

## §5 Uncommitted (mirrors git status)

Working tree: docs updates in flight (this checkpoint).

Recent commits (most recent first):
- `9e0cf2a` feat(settings): blocked triggers polish + page zoom
- `ba8e6cd` feat(hotkeys): Test Hotkey redesign — user-paced Verify flow
- `ab8fdba` feat(hotkeys): recorder rewrite + canonical key vocabulary
- `5af414d` perf(renderer): cap splash-screen wait at 1.5s to survive slow/offline font loads
- `fd63388` docs: close cold-start diagnostic — not reproduced on warm restart
- `390f6b6` docs: fix double-dash typo in context.md; log cold-start layout failure
- `5da4193` docs: checkpoint — Session 10 open_url layout fixes
- `a06b193` fix(electron): pre-snapshot + URL title matching for window layout
- `7a2d54e` fix(renderer): include windowLayout in syncHotkeys payload

### §5-PENDING (in flight — cleared on confirmation)
- (nothing pending)

## §6 Bootstrap order
1. electron/main.ts, electron/preload.ts, electron/electron-env.d.ts, electron/windowLayout.ts
2. src/types/actions.ts, src/pages/Library.tsx, src/pages/Builder.tsx
3. src/utils/security.ts, src/utils/danger.ts, src/components/ConfirmSecuredModal.tsx
4. src/components/ActionSequence.tsx, src/components/ActionSequence/SortableActionCard.tsx
5. src/components/WindowLayout/WindowLayoutPanel.tsx, src/components/WindowLayout/PositionDropdown.tsx
6. src/components/SettingsBlockedTriggers.tsx, src/components/BlockedTriggerList.tsx, src/components/ComboBuilder.tsx, src/hooks/useHotkeyRecorder.ts
7. package.json, tsconfig.json, vite.config.ts (only if needed)

## §7 Update rules
Update when: "checkpoint" / "sync" / "commit" | bug found/fixed/abandoned | decision made/reversed | sub-task verified.
Delete entries once committed AND documented in context.md.