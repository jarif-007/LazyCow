# LAZYCOW PROJECT BLUEPRINT & AI CONTINUATION CONTEXT

Save this entire document as `context.md` in your `doc/` directory and project root. When starting any new AI chat session, reference this file to immediately synchronize the assistant with the exact project state, system architectures, coding standards, and operational guidelines.

---

## 1. PROJECT INTRODUCTION & GOALS

**LazyCow** is an automated desktop productivity and workflow orchestrator engineered **exclusively for Microsoft Windows** (Windows 10 / Windows 11).

The application is structured to support:
1. **Workspaces (Tabs):**
   - **Library:** Quick execution dashboard with real-time step progress indicators, execution logs, card searching, column layout configuration, and shortcut editing.
   - **Builder:** Visual task chain designer supporting drag-and-drop sequencing, live name/hotkey validation, native file/folder/app pickers, and flow previews.
   - **Settings:** Native Windows desktop preferences (system startup, system tray behavior, execution toast notifications, Windows Fluent & custom theme configurations, blocked trigger management, and factory reset).
2. **Native Windows Experience:** Fluent Design system accent synchronization, ClearType subpixel rendering optimizations, smooth hardware-accelerated scrolling, and native OS toast notifications.
3. **Local & Secure Execution:** Full local execution with zero cloud telemetry; direct Windows API integrations via PowerShell `-EncodedCommand` (UTF-16LE Base64) with strict context isolation and process protection.

---

## 2. TECHNICAL STACK & ARCHITECTURAL SPECIFICATIONS

* **Operating System Target:** Exclusively **Microsoft Windows** (`process.platform === 'win32'`). All macOS and Linux code branches have been completely purged; non-Windows launches are intercepted at startup with an alert modal and clean exit.
* **Runtime Framework:** Electron (v30.x)
  - Main Process: `electron/main.ts` (compiled to `dist-electron/main.js` via Vite)
  - Preload Script: `electron/preload.ts` (compiled to `dist-electron/preload.mjs`)
  - Type Declarations: `electron/electron-env.d.ts`
* **Frontend Library:** React 18 + TypeScript (Strict Mode, 0 ESLint errors)
* **Build Engine:** Vite 5 + `vite-plugin-electron`
* **Styling Engine:** Tailwind CSS v3
* **Theme Architecture:**
  - **Windows Default Mode:** Follows Windows 11 Fluent Design (neutral white/dark grey palette). System accent color is read via Electron's `systemPreferences.getAccentColor()` in the main process and injected into `--primary` as HSL.
  - **Custom Color Mode:** User-toggleable in Settings (Coffee, Ocean, Forest themes with light/medium/dark shade gradients).
* **Typography:** Segoe UI Variable Text (primary UI font) and JetBrains Mono (monospace/codes). Fonts preloaded in `index.html`.
* **Windows ClearType & Hardware Scroll Stabilizer:**
  - `-webkit-font-smoothing: subpixel-antialiased` and `text-rendering: optimizeLegibility` applied globally.
  - Scroll containers use `transform: translateZ(0)` and `backface-visibility: hidden` to eliminate jitter.
* **Security & Execution Isolation:**
  - `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` (contextBridge works fine under sandbox — stricter security with no loss of functionality).
  - Preload script uses `contextBridge.exposeInMainWorld('electronAPI', ...)` to expose only safe, named functions.
  - Multi-line PowerShell scripts execute via `-EncodedCommand` (Base64 UTF-16LE) to eliminate CLI parameter injection.
  - Dangerous actions (scripts, executables) triggered via global hotkeys prompt for confirmation before executing.
  - The `index.html` CSP allows `script-src 'self' 'unsafe-inline'` — this is the intentional exception for the synchronous theme-bootstrap inline script (reads localStorage before the splash paints, preventing a flash of the wrong theme on cold start). Do not remove this exception without moving the bootstrap into a non-inline script first.
* **Data Persistence:**
  - `lazycow-shortcuts` — Array of saved `SavedShortcut` objects.
  - `lazycow-blocked-triggers` — Blocked hotkey trigger strings.
  - `lazycow-os-critical-triggers` — OS-critical protected triggers.
  - `lazycow_settings` — General desktop settings (`startAtLogin`, `keepInTray`, `executionNotifications`, `generalShade`, `dataShade`).
  - `lazycow-theme-mode` — `'system' | 'light' | 'dark'`.
  - `lazycow-custom-color-mode` — Boolean toggle for custom color themes.
  - `lazycow-custom-theme` — `'coffee' | 'ocean' | 'forest'`.
  - `lazycow-dark` — Legacy flag kept in sync with dark mode state.

---

## 3. PROJECT DIRECTORY LAYOUT

```text
LazyCow/
├── LazyCow-Desktop-step1/
│   ├── doc/
│   │   └── context.md                 # Master technical context & AI blueprint
│   ├── README.md                      # Project documentation & run guide
│   └── lazycoww/
│       ├── package.json
│       ├── vite.config.ts             # Vite configuration with electron plugin
│       ├── electron-builder.json5     # Windows-exclusive NSIS installer config
│       ├── index.html                 # HTML entry with splash screen & preloaded fonts
│       ├── .eslintrc.cjs              # ESLint configuration ignoring dist, dist-electron, release
│       ├── electron/
│       │   ├── main.ts                # Main process: execution engine, IPC handlers, hotkeys, tray
│       │   ├── preload.ts             # Context bridge: safe electronAPI exposure
│       │   └── electron-env.d.ts      # TypeScript interfaces for electronAPI
│       └── src/
│           ├── App.tsx                # App root: tab management, theme orchestrator, modal handlers
│           ├── index.css              # Fluent & custom themes, ClearType stabilizers, scroll styling
│           ├── types/
│           │   └── actions.ts         # Action catalogs, interfaces, blocked trigger defaults
│           ├── hooks/
│           │   ├── useHotkeyRecorder.ts # Reusable global keyboard capture hook
│           │   └── useActionValidation.ts # Shared validation for action sequences (sync + debounced path checks)
│           ├── components/
│           │   ├── ActionSequence.tsx # Orchestrator: DnD, selection mode, auto-scroll, drop zone
│           │   ├── ActionSequence/    # Sub-components for the action list
│           │   │   ├── SortableActionCard.tsx # Single card with useSortable + selection checkbox
│           │   │   ├── ActionValueInput.tsx   # Per-type value renderer dispatcher
│           │   │   ├── UrlInput.tsx           # URL field + Test button + auto-prefix
│           │   │   ├── ActionFlowPreview.tsx  # Wrap-aware icon strip with drag-reorder
│           │   │   ├── ConfirmDeleteModal.tsx # Multi-action delete confirmation
│           │   │   └── LayoutThumbnail.tsx    # (moved to WindowLayout/, see below)
│           │   ├── ActionSidebar.tsx  # Collapsible catalog sidebar with drag-to-add
│           │   ├── BlockedTriggerList.tsx # Searchable blocked triggers list
│           │   ├── CollapsedSearchPopover.tsx # Command-palette search popover for collapsed ActionSidebar
│           │   ├── ComboBuilder.tsx   # Dropdown modifier-first hotkey constructor
│           │   ├── DeleteModal.tsx    # Confirmation modal for shortcut deletion
│           │   ├── OSCriticalWarningModal.tsx # Safety warning modal for critical hotkey deletes
│           │   ├── SettingsAppearance.tsx # Theme, mode, and accent color settings
│           │   ├── SettingsBlockedTriggers.tsx # Blocked triggers and OS-critical hotkey config
│           │   ├── SettingsDangerZone.tsx # 3-step factory reset with confirmation
│           │   ├── SettingsFooter.tsx # Version & metadata footer
│           │   ├── SettingsGeneral.tsx # Startup, tray, notification + auto-scroll slider
│           │   ├── ShortcutCard.tsx   # Dashboard card with menu + Window Layout badge
│           │   ├── Sidebar.tsx        # Collapsible primary navigation sidebar
│           │   └── WindowLayout/      # Shortcut-level window arrangement feature
│           │       ├── WindowLayoutPanel.tsx  # Toggle + layout picker + progress
│           │       ├── LayoutThumbnail.tsx    # Visual preview of a layout with icons
│           │       └── PositionDropdown.tsx   # Per-card zone assignment dropdown
│           └── pages/
│               ├── Builder.tsx        # Shortcut creation/editing with live validation
│               ├── Library.tsx        # Saved shortcut catalog & execution dashboard
│               └── Settings.tsx       # Desktop preferences orchestrator
├── code/                              # Shared tools & auxiliary scripts
├── doc/                               # Academic presentations & SRS deliverables
└── README.md                          # Repository root README
```

---

## 4. ACTIVE CODEBASE REGISTRY (DETAILED LOGIC)

### A. Electron Main Process & Preload Bridge

#### 1. `electron/main.ts`
- **Platform Gate:** Validates `process.platform === 'win32'` at startup. If non-Windows, displays an error dialog and exits immediately.
- **Single Instance Lock:** Calls `app.requestSingleInstanceLock()` before `app.whenReady()`. If a second instance is launched, it immediately quits and hands control back to the running one via the `second-instance` event, which restores + focuses the existing window. This is the standard tray-app model (VS Code, Slack, Discord) — LazyCow is never meant to run twice.
- **GPU Workaround:** Calls `app.disableHardwareAcceleration()` immediately after imports (before `app.whenReady()`). Required for laptops whose integrated GPU driver causes visual glitches (frozen white regions, color tints, broken ClearType) with Chromium's default Direct3D backend. Do not remove without confirming on a machine with the affected GPU class.
- **Native Context Menu:** Wires up `electron-context-menu` at module load so right-clicking any input, textarea, or contentEditable shows the standard Cut/Copy/Paste/Select All menu. Electron does not do this by default — every text field would be unusable without it. `showInspectElement` is enabled only in dev (`VITE_DEV_SERVER_URL`).
- **Window Management:** Creates 1200x800 `BrowserWindow` with `autoHideMenuBar: true`, custom icon, and hidden titlebar. Minimizes/closes to system tray if `keepInTray` is enabled.
- **System Theme & Accent Synchronization:** Reads the Windows accent via Electron's `systemPreferences.getAccentColor()`; streams updates to the renderer on window focus.
- **Window Minimum Size:** BrowserWindow is clamped to `minWidth: 800`, `minHeight: 600` (Windows Fluent Design standard). Users cannot shrink the window below this.
- **Execution Engine (`execute-shortcut`):**
  - **`launch_app`**: Validates extension (`.exe` only — other executable types were removed for safety and clarity) and launches the executable via Electron's `shell.openPath`. No settle delay — the Window Layout engine polls for the newly-opened window directly (see the Window Layout bullet below), so waiting inside the action loop just adds latency.
  - **`open_url`**: Sanitizes HTTP/HTTPS URLs and opens via Electron's `shell.openExternal`.
  - **`open_folder` & `open_file`**: Verifies target path existence and opens with `shell.openPath`.
  - **`set_volume`**: Uses Windows CoreAudio (WASAPI) with exact COM vtable alignment:
    - `IMMDeviceEnumerator`: offset 1 (`GetDefaultAudioEndpoint`) after placeholder slot 0 (`EnumAudioEndpoints`).
    - `IAudioEndpointVolume`: offset 4 (`SetMasterVolumeLevelScalar`) after 4 placeholder slots (`f()`, `g()`, `h()`, `i()`).
    - Automatically unmutes device (`SetMute(false)`) if volume is increased above 0%.
  - **`set_brightness`**: 3-tier fallback architecture:
    1. Legacy WMI (`WmiMonitorBrightnessMethods.WmiSetBrightness`) for laptops.
    2. Modern CIM (`Get-CimInstance | Invoke-CimMethod`) for Windows 10/11 laptops.
    3. DDC/CI via `dxva2.dll` (`DdcMonitorHelper` P/Invoke calling `SetPhysicalMonitorBrightness`) for external desktop monitors.
  - **`toggle_dnd`**: Configures Windows Focus Assist registry (`NOC_GLOBAL_SETTING_ALLOW_TOASTS`).
  - **`toggle_nightlight`**: Toggles Windows BlueLightReduction state in CloudStore registry.
  - **`delay`**: Pauses sequence execution for a configurable duration (`ms`) via `await new Promise(r => setTimeout(r, ms))` so launched applications or scripts have time to initialize before subsequent steps.
  - **`run_script`**: Spawns commands in `cmd.exe` with 120s timeout and process tree kill capability (`taskkill /pid /t /f`).
- **Shortcut Cancellation (`cancel-shortcut`):**
  - Cancellation is **always graceful** — the currently running action finishes normally, then remaining actions are skipped. This prevents killing unrelated windows of the same app.
  - IPC handler sets a flag in `cancelRequests: Set<string>`. The execution loop checks between actions and stops if the shortcut's ID is present.
  - No mode parameter (previously had Graceful/Immediate; Immediate was removed).
- **OS Notifications:** Emits native Windows desktop toast notifications (`new Notification(...)`) on completion with:
  - Elapsed execution duration (e.g. `Completed in 1.4s`).
  - A **layout summary** appended when the shortcut has a Window Layout enabled — `Window layout: 3 of 4 apps placed. Couldn't arrange: VS Code.` This is the only feedback the user sees when the placed windows cover the LazyCow window itself.
  - On failure: a per-action failure list rather than a generic "some steps failed".
- **Broken-path pre-flight (`findFirstBrokenPath`):** Before a hotkey-triggered run, verifies every path-based action (`launch_app`, `open_file`, `open_folder`). If any path is missing, a native Windows toast names the first broken action and the shortcut refuses to run. The renderer never sees the trigger.
- **Path Dialogs (`select-path`):** Invokes `dialog.showOpenDialog` for native application (`.exe`), directory, or file selection.
- **Path Checking (`check-path-exists`):** Verifies file/directory existence using `fs.existsSync`.
- **URL Test (`test-url`):** Opens a URL in the default browser for a quick preview without executing a shortcut. Used by the **Test** button on `open_url` action cards. Format-checks the URL (scheme must be http/https, host must be present) before opening.
- **Global Hotkey Registration:** Listens for registered shortcut keys, checks for dangerous actions, emits `hotkey-needs-confirm` or runs shortcut, and notifies on registration failures via `onHotkeyRegisterFailed`.
- **Window Layout runtime:** Positions shortcut-launched windows into one of 7 predefined layouts (6 matching Windows Snap Layouts + quad grid). Shortcut-level config (`windowLayout` on `SavedShortcut`) drives it; the engine never runs as a standalone action.
  - **Fires in parallel with the action loop.** `runShortcutActions` creates the `arrangeWindows` promise *before* iterating actions, so arrangement happens concurrently with the remaining launches. `estimateShortcutBudgetMs()` sizes the poll window per-shortcut (5s base + per-action estimates, capped at 60s) so shortcuts with long `delay` actions don't time out.
  - **Per-placement polling.** Each assigned app is polled independently — 15ms warmup for 800ms, then taper to a 200ms maximum. A window is snapped the moment it appears.
  - **Claim-the-zone.** Every placement is `placed` or `not_found`. No fallback, no shifting, no occupancy check (see decisions.md 2026-10-06).
  - **User-judge via unassignment.** An action assigned to no zone still launches with the shortcut, but the layout engine skips it. This is the primary control for "this app shouldn't be auto-arranged" — implemented via the Position dropdown's "Not arranged" option.
  - **UWP fallback.** UWP windows detected via `IsImmersiveProcess` are centered at native size instead of stretched. This handles the "user assigned Calculator by mistake" case gracefully — the window stays usable instead of being visually stretched.

#### 2. `electron/preload.ts` & `electron/electron-env.d.ts`
- Securely exposes `window.electronAPI`:
  - `getSystemAccent(): Promise<string>`
  - `onSystemTheme(callback)` / `onSystemAccent(callback)`
  - `runShortcut(shortcut)`
  - `testUrl(url): Promise<{ ok: boolean; error?: string }>` — Opens URL externally for preview, does not execute a shortcut
  - `cancelShortcut(shortcutId)` — Graceful cancel of a running shortcut
  - `syncHotkeys(shortcuts)`
  - `updateGeneralSettings(settings: { startAtLogin?: boolean; keepInTray?: boolean; executionNotifications?: boolean })`
  - `checkPathExists(path): Promise<boolean>`
  - `selectPath(type: 'app' | 'file' | 'folder'): Promise<string | null>`
  - `onShortcutProgress(callback)` / `onShortcutComplete(callback)` (with `durationMs` and `cancelled` / `lastActionTitle` fields)
  - `onHotkeyTriggered(callback)` / `onHotkeyNeedsConfirm(callback)` / `onHotkeyRegisterFailed(callback)`

---

### B. Action Catalog & Types (`src/types/actions.ts`)

- **10 Supported Action Types (All Active):**
  1. `launch_app` — Application Path (`.exe` only)
  2. `open_url` — Website URL
  3. `open_folder` — Folder Path
  4. `open_file` — File Path
  5. `set_volume` — Volume Level (0–100% Slider)
  6. `toggle_dnd` — DND Configuration (Toggle, Enable, Disable)
  7. `toggle_nightlight` — Night Light Mode (Toggle, Enable, Disable)
  8. `set_brightness` — Brightness Level (0–100% Slider)
  9. `delay` — Wait / Delay Duration (100ms–60,000ms, with 0.25s–10.0s interactive step slider)
  10. `run_script` — Terminal Command
- **Window Layout moved to shortcut-level.** The old `arrange_windows` action was removed. Arrangement is now a property of the shortcut (`windowLayout` field), configured once in the Builder via the `WindowLayoutPanel` and applied after all eligible actions have fired.
- **Blocked System Triggers:** 17 protected default Windows shortcuts (`Alt+F4`, `Ctrl+Alt+Del`, `Win+L`, `Win+D`, `Win+R`, `Win+E`, etc.).

---

### C. UI & Components

- **`ActionSidebar.tsx`:** Collapsible action catalog. Expanded mode shows full action cards with search. Collapsed mode shows icon strip with hover tooltips and a search icon that opens the `CollapsedSearchPopover`. Auto-collapses below 1100px window width (forced; user cannot re-expand until window grows).
- **`CollapsedSearchPopover.tsx`:** Command-palette style centered popover opened from the collapsed ActionSidebar's search icon. Contains auto-focused input, live filtering by action name OR category, grouped results, Escape/Enter keyboard support. Uses React `createPortal` to escape parent `transform` stacking context. Clicking a result adds the action and closes the popover.
- **`ActionSequence.tsx`:** Orchestrator for the action list. Renders the header row (Select / Delete / Select All / Clear / Done), the Flow Preview, and the card list. Wraps the list in `DndContext` + `SortableContext` from `@dnd-kit` for smooth internal reorder. Manages selection mode (click toggle, continuous drag-select via a single global `pointermove` + rAF loop, edge auto-scroll using the user's speed preference). Integrates the `ConfirmDeleteModal` for multi-delete.
- **`ActionSequence/SortableActionCard.tsx`:** A single action card. Uses `useSortable` from `@dnd-kit/sortable`. Renders the drag handle (dnd-kit listeners), checkbox (selection mode), title + Dangerous badge, ↑/↓/trash controls, the `PositionDropdown` (when Window Layout is on), and delegates the value editor to `ActionValueInput`.
- **`ActionSequence/ActionValueInput.tsx`:** Dispatcher that picks the right editor for each action type. Renders sliders for Volume / Brightness / Delay, dropdowns for DND / Night Light, URL editor for `open_url`, and generic text + Browse for `launch_app` / `open_folder` / `open_file` / `run_script`.
- **`ActionSequence/UrlInput.tsx`:** URL-specific editor. Auto-prefixes on blur — private/loopback ranges (`10.`, `127.`, `169.254.`, `172.16–31.`, `192.168.`, `localhost`) get `http://`, everything else gets `https://`. Orphan `://`, `//`, `:` are stripped first. Users who type a scheme explicitly keep it. Includes a **Test** button (via `testUrl` IPC) when the URL is valid.
- **`ActionSequence/ActionFlowPreview.tsx`:** Compact wrap-aware icon strip summarising the sequence. Icons are draggable via `@dnd-kit`'s `rectSortingStrategy` for a fast reorder that doesn't require touching the cards. Clicking an icon scrolls to and flashes its card. Hovering shows a tooltip with the action's title + value (arrange-style values are humanized). Wrap layout means all actions stay visible — no horizontal scroll.
- **`ActionSequence/ConfirmDeleteModal.tsx`:** Rendered via `createPortal(..., document.body)` so parent `transform`s don't trap it. Summarises the actions being removed by title + count, has a ✗ close button (works without Esc), supports Esc to cancel and Enter to confirm, and includes a "don't show these hints again" checkbox persisted to `lazycow-hide-modal-hints`.
- **`WindowLayout/WindowLayoutPanel.tsx`:** Shortcut-level panel above the action sequence. Toggle enables arrangement; 7 layout thumbnails (Windows' 6 + quad) are filtered by the eligible action count. Live preview updates as users assign positions from the cards. Shows amber warnings when a layout becomes invalid (too few eligible apps) or when extra apps won't be arranged.
  - **Test Layout** button runs only the launch-type actions in the sequence + applies the layout, so the user can preview the arrangement before saving. Fully arrangeable-action-scoped; the `onTestLayout` handler lives in `Builder.tsx`.
  - **Info (i) button** with a portal-rendered hover/click popover. Contains three sections: (1) what Test Layout does, (2) *"Use it when"* — the user has assigned positions and wants to confirm before saving, (3) *"If an app looks wrong"* — *"Some apps (Calculator, Settings, Photos) don't fill zones nicely. Remove their Position assignment — they'll still launch, just not force-arranged."* Section 3 is the user-facing statement of the user-judge mechanism.
  - Popover uses a 140ms delayed-close timer so the cursor can travel from the button to the popover without flicker, repositions on scroll/resize, and hides itself if the anchor scrolls out of view.
- **`WindowLayout/LayoutThumbnail.tsx`:** Pure visual mockup of a layout with each zone drawn by percentage. Displays assigned action icons (colored), empty-zone labels, and an optional ✗ clear button. Supports drag-to-swap between zones.
- **`WindowLayout/PositionDropdown.tsx`:** Custom dropdown rendered via `createPortal` for escaping card overflow. Positioned with fixed coordinates computed from the trigger button. Auto-flips above/below based on viewport space and closes on scroll, outside click, or Escape. Disabled zones show "(taken by <Action Title>)". Top option is **"Not arranged"** — selecting it removes the action from its current zone (`onChange('')`), which is the user-judge mechanism for "this app shouldn't be auto-arranged."
- **`Builder.tsx`:** Shortcut builder with real-time name uniqueness checking, hotkey conflict detection, modifier-first validation, unsaved changes safety modal, and full responsive layout (see Section 2's Responsive Layout subsection). Uses the shared `useActionValidation` hook to **disable Save** when any action is invalid or unsupported, showing *"Fix N invalid action(s) before saving."* Restores the shortcut's hotkey when opening for edit.
  - **Test Flow** button in the footer next to Save. Runs the same validation gate as Save, then executes the entire sequence end-to-end (scripts, delays, system actions, layout) via the real `runShortcut` IPC with a synthetic `test-flow-<ts>` id. Purpose: verify the whole shortcut without saving it first.
  - **Test Layout** handler passed down to `WindowLayoutPanel` (see below). Filters the sequence to arrangeable actions only and runs them via `runShortcut` — no scripts, no delays, no side effects beyond launching apps.
- **`ShortcutCard.tsx`:** Dashboard shortcut card with 3-dot dropdown menu (Edit Flow, Duplicate, Rename, Delete), hotkey conflict warning badge, **Window Layout badge** (shows layout label + assigned zone count via tooltip when `windowLayout.enabled`), **Broken Path badge** (amber; shows when the shortcut references a missing file/folder), elapsed duration analytics (`Sequence Complete • 1.4s`), live step execution log, amber **"Cancelling..."** button state with spinner when cancel is requested, and **"Cancelled after: <action title>"** state display.
  - When `hasBrokenPath` is true, the Run button becomes a **"Fix Paths"** button that routes the user to the Builder (`onEditFlow(shortcut)`) instead of running.
  - Success log appends a **"Window layout: N of M apps placed"** line when the shortcut has a layout enabled.
  - Menu is disabled while the shortcut is running. Uses solid `bg-background/95` and `bg-background/70` for the shade picker and action-icon pills — **no `backdrop-blur`** (removed for performance).
- **`Library.tsx`:** Shortcut card dashboard with live step progress ring, execution log, search filter, duplicate workflow generator (`(Copy)` naming & hotkey decoupling), inline rename modal, dropdown management, and cancel handler that forwards to `cancelShortcut`.
  - **Broken-path pre-flight:** On mount and whenever `shortcuts` changes, a debounced (250ms) loop calls `checkPathExists` for every path-based action. Any shortcut with at least one missing file/folder or an empty path value goes into `brokenShortcuts`, which greys the Run button and shows the amber badge on the card.
  - **Re-runs on window focus:** Returning from Explorer after fixing a path refreshes the badge without a page reload.
- **`Settings.tsx` & Subcomponents:** Manages appearance, theme switching, startup launch, system tray minimization, execution notifications, blocked triggers, and factory reset.

### D. Hooks (`src/hooks/`)

- **`useHotkeyRecorder.ts`:** Captures global key combinations for the trigger field. Uses capture-phase `keydown` so all keystrokes are swallowed during recording. Returns `{ recording, recordedCombo, startRecording, stopRecording, clearCombo, setRecordedCombo }`.
- **`useActionValidation.ts`:** Single source of truth for action-sequence validation. Runs synchronous checks (empty values, format, numeric range) immediately and debounced path-existence checks (~600ms) via `checkPathExists`. Flags actions whose `type` is not in the current `actionCatalog` as **unsupported**. Returns `{ errors, warnings, unsupportedIds, isValid }` (`warnings` is reserved for future offline/soft-failure states but currently always empty). Consumed by both `ActionSequence.tsx` (inline errors) and `Builder.tsx` (Save gating). **Re-runs on window focus** so an inline error refreshes after the user fixes a path in Explorer. **URL validation rules (format-only, no TLD whitelist, no DNS):** empty → error; schemeless with dot + chars after → pending (blur will auto-prefix); IPv4-shaped → strict 4-segment range check; IPv6 requires brackets; malformed → generic error.
- **`lazycow_settings.autoScrollSpeed`** — New number field (2–20) controlling auto-scroll pacing during card drag and drag-select. Managed by a slider + Slow/Medium/Fast presets in Settings → General.
- **`lazycow-hide-modal-hints`** — Boolean. When true, the confirm-delete modal hides the small `Esc` / `Enter` keyboard badges on its buttons. Reset automatically by the Danger Zone's factory reset (which calls `localStorage.clear()`).
- **`lazycow-custom-tlds`** — **Removed.** The custom TLD manager was deleted; TLD validation is no longer used. Any stale value is silently ignored.

---

## 5. DEVELOPMENT & BUILD INSTRUCTIONS

### Running in Development
```bash
cd LazyCow-Desktop-step1/lazycoww
npm install
npm run dev
```

### Type Checking
```bash
cd LazyCow-Desktop-step1/lazycoww
npx tsc --noEmit
```

### Git Workflow
- **Development branch:** `Tamjid's-work`
- AI tooling artifacts (`.claude/`, `graphify-out/`, `CLAUDE.md`, `GRAPH_REPORT.md`) are gitignored at repo root and inside `lazycoww/`.

### Bundling Production Assets
```bash
npx vite build
```

### Packaging Windows Installer
```bash
npm run build
```

---

## 6. OPERATIONAL GUIDELINES FOR AI ASSISTANTS

1. **Windows Exclusivity:** Never introduce non-Windows (macOS/Linux) platform logic, commands, or APIs. All desktop operations must target Microsoft Windows (`win32`).
2. **Strict Process Isolation:** Never expose raw IPC methods (`ipcRenderer.send`/`on`) directly to the renderer. Always route through `electronAPI` in `preload.ts` and `electron-env.d.ts`.
3. **PowerShell Encoding:** When adding new Windows system automation scripts in `main.ts`, always execute multi-line commands using `-EncodedCommand` with base64 UTF-16LE encoding.
4. **Preserve Repository Structure:** The repository root contains `code/`, `doc/`, `README.md`, and `LazyCow-Desktop-step1/`. When pushing commits via git plumbing, always preserve the root tree and keep `doc/context.md` mirrored in both root `doc/` and `LazyCow-Desktop-step1/doc/`.
5. **Zero ESLint / TypeScript Errors:** Always verify with `npx tsc --noEmit` and `npx eslint .` before committing.
6. **Flex Chain Integrity:** The outer shell (`html` / `body` / `#root` / App shell / `.page-container` / `<main>`) forms a bounded flex chain. Every flex ancestor must have `min-height: 0` and `overflow: hidden`, and only the two innermost scroll panels (ActionSidebar's inner div, the Builder's right panel) may have `overflow-y: auto`. Breaking this chain causes the whole page to scroll as one unit.
7. **Responsive Breakpoints:** Main sidebar auto-collapses below 900px. ActionSidebar (Builder) auto-collapses below 1100px. Auto-collapse is forced — the manual toggle is hidden while auto-collapsed. Manual collapse choice persists across resizes; auto-collapse is triggered only when the window becomes narrower than the threshold.
8. **Cancellation is Graceful-Only:** Never reintroduce Immediate cancellation — killing apps via `taskkill` kills all instances and can close unrelated windows. The current implementation only interrupts between actions, never during one.
9. **Popovers Use Portals:** Any floating overlay (popover, modal, dropdown) that should appear centered over the viewport must use `createPortal(..., document.body)`, otherwise a parent `transform` will trap it and cause misalignment.
10. **Single Source of Validation Truth:** All action-sequence validation must go through `useActionValidation.ts`. Never re-implement validation logic in a component — if `Builder` needs to gate Save, it must consume the same hook that `ActionSequence` uses for inline errors. Adding a new action type means adding a `case` to the hook's switch.
11. **Auto-Prefix URLs on Blur:** URL fields auto-prepend `https://` when the user blurs without a scheme. The prefixer strips any orphan `://`, `//`, or `:` first. Users who explicitly type `http://` or `https://` keep control. Private and loopback IP ranges (`10.`, `127.`, `169.254.`, `172.16–31.`, `192.168.`) and `localhost` get `http://` instead.
12. **Never Remove `disableHardwareAcceleration()`:** The GPU workaround in `main.ts` fixes Chromium's Direct3D rendering on laptops with incompatible integrated GPUs. Removing it reintroduces visual glitches (frozen regions, color tints, broken ClearType). If you need to re-enable hardware acceleration for performance, do it behind a user-facing toggle, never as a blind deletion.
13. **URL Validation Stays Format-Only:** Never reintroduce a TLD whitelist or a DNS lookup for URL validation. Both create maintenance burden, offline-hostile behavior, and false negatives. Users verify reachability themselves via the **Test** button.
14. **No `backdrop-blur` in Modals or Overlays:** `backdrop-blur-*` forces Chromium to blur the entire backdrop on every frame the modal is open, and to recompute on open/close. Under software rendering (which the GPU workaround forces) this is measurably expensive. Use solid `bg-background/90` (or `/95` for tighter overlays) instead.
15. **rAF-Throttle Resize Listeners:** Any `window.addEventListener('resize', ...)` must be wrapped in a `requestAnimationFrame` throttle so the handler runs at most once per frame. Without it, the handler fires hundreds of times during a drag and causes visible lag.
16. **Native Context Menu is Mandatory:** `electron-context-menu` in `main.ts` enables right-click → copy/paste/cut/select-all across the app. Removing it breaks every text field. Chromium's default is no menu at all — this is not optional.
17. **Single Instance Lock:** The `app.requestSingleInstanceLock()` call in `main.ts` prevents multiple Electron processes. Without it, running `npm run dev` while the app is in the tray starts a second process — two writers to the same `localStorage`, causing settings to silently reset. Never remove the lock. The `second-instance` handler must always restore + focus the existing window.
18. **Window Layout Is Shortcut-Level, Not an Action:** Arrangement is a property of the shortcut (`windowLayout` field), applied after all eligible actions fire. Do not reintroduce a standalone `arrange_windows` action — it created ordering ambiguity (user must remember to place it last) and complicated the UI (assignments needed to see the full sequence, which an action card cannot do).
19. **Selection-Mode Auto-Scroll Uses a Single RAF Loop:** Drag-select toggling, auto-scroll pacing, and edge-zone detection all run in one requestAnimationFrame loop inside `ActionSequence.tsx`, keyed off the physical pointer button state (`e.buttons & 1`). Do not split these into separate listeners — the earlier split implementation raced with `pointermove` handlers and caused ghost selections after button release.
20. **Floating Dropdowns Use Portals:** Any custom dropdown or popover that must escape an overflow-clipped parent (like the Position dropdown inside a card) renders via `createPortal(..., document.body)` with fixed coordinates from `getBoundingClientRect()`. Same reasoning as rule 9 — a parent `transform` or `overflow: hidden` traps absolutely-positioned children.
21. **User-Judge via Unassignment:** An action not assigned to any zone still launches with the shortcut, but the layout engine skips it. This is the primary mechanism for "this app shouldn't be auto-arranged" — do not add a separate per-action `skipLayout` flag, and do not reintroduce a separate opt-out UI. `buildPlacementsFromShortcut` already filters on `assignments`; that's the whole control surface.
22. **UWP Heuristic is a Fallback Only:** `Place-Window` centers UWP windows (`IsImmersiveProcess`) at native size instead of stretching them. This runs *after* user assignment — if the user didn't assign a UWP app to a zone, the heuristic never fires (the app is skipped entirely). Do not remove the heuristic — it's the graceful default for users who assign UWP apps by mistake. But do not treat it as the primary arrangement strategy either; user-judge (rule 21) is.

---

## 7. CURRENT PROJECT STATUS & FEATURE ROADMAP

### A. Fully Implemented & Verified Features
* **10 Action Types:** Launch App (`.exe` only), Open URL, Open Folder, Open File, Set Volume (WASAPI COM), Toggle DND (Focus Assist), Toggle Night Light, Set Brightness (WMI/CIM/DDC-CI), Wait / Delay (0.25s–10s slider), Run Terminal Script.
* **Shortcut-Level Window Layout (complete):** A toggle in the Builder enables arrangement. Users pick from 7 layouts (Windows' 6 + quad), assign eligible actions to zones via per-card Position dropdowns, and see a live preview in the layout thumbnail. The engine fires in parallel with the action loop, uses a per-shortcut time budget, polls each placement independently, claims the assigned zone unconditionally, and reports layout results in the completion toast and on the card's success log. Unassigned actions still launch — they're just not arranged (user-judge mechanism). UWP apps assigned by mistake are centered at native size rather than stretched.
* **Broken Path Pre-flight:** `Library.tsx` scans all path-based actions on mount, on `shortcuts` change, and on window focus. Any shortcut with a missing file/folder gets a "Broken Path" badge and its Run button becomes "Fix Paths" (routes to Builder). Hotkey-triggered runs are refused with a native toast naming the first broken action.
* **Test Layout Button:** In the Window Layout panel. Runs only the launch-type actions (no scripts, no delays) and applies the layout — fast preview without side effects.
* **Test Flow Button:** In the Builder footer. Runs the entire sequence end-to-end with the same validation gate as Save.
* **Richer Completion Toasts:** OS notifications now append a layout summary (`3 of 4 apps placed`) and a per-action failure list when steps fail.
* **Selection Mode + Multi-Delete:** Toggle via header `Select` button, or long-press (~400ms) on any card. Continuous drag-select toggles cards under the cursor. `Select All` / `Clear` / `Done` in the header; a red `Delete` opens a count-summarising confirmation modal (Esc / Enter / ✗ / Cancel all supported). `lazycow-hide-modal-hints` can suppress the small keyboard-hint badges.
* **Flow Preview Reorder:** Wrap-aware icon strip above the cards. Icons are draggable (dnd-kit `rectSortingStrategy`), click-to-jump to the corresponding card, colored, with rich hover tooltips. Reordering works without touching the cards.
* **Auto-Scroll During Drag:** Card drag and drag-select auto-scroll at the container edges with a speed curve the user controls via Settings → General → "Auto-scroll speed" (Slow 3 / Medium 6 / Fast 12 presets + slider 2–20). Warmup ramps the speed over ~900ms so the first moment of scroll isn't jarring.
* **Shortcut Builder:** Visual drag-and-drop sequencing, live name uniqueness validation, hotkey collision checking, ComboBuilder modifier constructor, native OS Browse pickers. **Save is disabled when any action is invalid or unsupported**, with a red inline message under the Save button.
* **Action Validation:** Shared `useActionValidation` hook validates every action synchronously (format, range, empty) and asynchronously (path existence). Checks run debounced at 400ms and produce per-action error messages.
* **URL Helpers:** Automatic `https://` prefixing on blur (with orphan-scheme cleanup), a **Test** button to preview the URL in the default browser without executing the shortcut, and an info tooltip explaining the auto-prefix behavior.
* **Shortcut Library:** Grid layout switcher (2/3/4 cols), search bar, inline rename modal, delete modal, duplicate/clone shortcut with auto `(Copy)` naming.
* **Execution & Diagnostics:** Real-time step progress ring, step execution log with elapsed runtime display (`Sequence Complete • 1.4s`), toast notifications with duration, and hotkey conflict warning badge (`Conflict`).
* **Settings & Themes:** Windows 11 Fluent Theme (native DWM accent sync) + Custom color themes (Coffee, Ocean, Forest) with shade selectors; system tray support and Windows startup integration; blocked triggers management.
* **Graceful Cancellation:** Cancel button replaces Run button while a shortcut is executing. Clicking it immediately shows an amber **"Cancelling..."** spinner, then the current action finishes and remaining steps are skipped. Result shown as **"Cancelled after: <last action title>"**.
* **Responsive Layout:** Window has a hard minimum of 800×600. Main sidebar auto-collapses below 900px; ActionSidebar auto-collapses below 1100px. Manual collapse choice persists; auto-collapse is forced only while the window is narrow.
* **Native Context Menu:** Right-click any input, textarea, or contentEditable → Cut/Copy/Paste/Select All. Works in dev and production.
* **Collapsed Search Popover:** When ActionSidebar is collapsed, clicking the search icon opens a centered command-palette-style popover (`CollapsedSearchPopover.tsx`) rendered via React `createPortal`. Live filtering by name or category, grouped results, keyboard support (`Esc` to close, `Enter` to add first result).

### B. Remaining Desktop Roadmap (Excluding Cloud / Auth)
1. **Shortcut Export / Import (.json):** Allow users to export shortcuts as `.lazycow` or `.json` files to back up or share offline, with an Import button to restore them.
2. **Mini Floating HUD / Quick Trigger Bar:** Compact floating pill or tray popover (like Raycast or Spotlight) summoned via a global hotkey to trigger any shortcut by typing without opening the main window.
3. **Application Arguments & Working Directory:** Advanced settings for `launch_app` to pass CLI flags and specify custom working directories.
4. **Error Recovery & Conditional Steps:** Option on actions to "Continue on error" vs "Halt sequence", or "Skip if already running".
5. **Scheduled / Automatic Triggers:** Time-based shortcut execution (e.g., Run "Work Setup" every weekday at 9:00 AM) using node-cron or Windows Task Scheduler.

### C. Recently Completed

**Session 6 (Window Layout runtime, broken-path pre-flight, Test Layout/Flow, richer toasts):**
- Wired the Window Layout engine into `runShortcutActions` — fires **in parallel** with the action loop, not after.
- `estimateShortcutBudgetMs()` sizes the poll window per-shortcut (5s base + per-action estimates, capped at 60s).
- Per-placement polling: 15ms warmup for 800ms → taper to max 200ms. Windows snap the moment they appear.
- `SETTLE_TIME` retired — `launch_app`'s 800ms settle delay removed; the polling engine made it redundant.
- **User-judge via unassignment.** Position dropdown's "Not arranged" option removes the action from its current zone; the layout engine skips it. UWP heuristic kept as a graceful fallback for assigned UWP windows.
- Broken-path pre-flight in `Library.tsx` — debounced (250ms), re-runs on focus. Feeds the amber badge and the "Fix Paths" button on `ShortcutCard`.
- Hotkey-triggered runs pre-flight via `findFirstBrokenPath` in `main.ts` — a native toast refuses the run and names the missing path.
- Test Layout button in `WindowLayoutPanel` — launch-type actions only, applies the layout, no scripts/delays.
- Test Flow button in Builder footer — full end-to-end via the same validation gate as Save.
- Info (i) popover next to Test Layout — three-section explanation, including the user-judge advice ("Remove their Position assignment — they'll still launch, just not force-arranged.").
- Richer completion toasts — layout summary appended, per-action failure list on errors.
- `useActionValidation` re-runs on window focus so inline errors refresh after the user fixes a path in Explorer.

**Session 5 (Window Layout + selection mode + dnd-kit, uncommitted at time of writing):**
- Replaced HTML5 native drag in `ActionSequence.tsx` with `@dnd-kit` — internal reorder is now smooth. Split the file into `ActionSequence/` sub-components: `SortableActionCard`, `ActionValueInput`, `UrlInput`, `ActionFlowPreview`, `ConfirmDeleteModal`.
- Rebuilt selection mode: header toggle, long-press entry (400ms), continuous drag-select (click-toggle / hover-toggle-on-different-card), edge auto-scroll, Select All / Clear / Done.
- Multi-delete confirmation modal shows a count summary per action title. Esc / Enter / ✗ / Cancel all dismiss or confirm. "Don't show hints again" persists to `lazycow-hide-modal-hints`.
- Auto-scroll: single RAF loop keyed off physical pointer state; speed configurable via new `autoScrollSpeed` setting (2–20, default 6) with Slow/Medium/Fast presets + slider.
- Flow Preview: wrap-aware layout (no horizontal scroll), draggable icons, click-to-jump, colored badges, humanized tooltips.
- New shortcut-level `windowLayout` config: 7 layouts, `WindowLayoutPanel`, `LayoutThumbnail`, `PositionDropdown`. Live preview, zone assignment, drag-to-swap, amber warnings for invalid state. `ShortcutCard` shows a layout badge when enabled.
- Removed the deprecated `arrange_windows` action entirely (catalog, types, `getFieldLabel`, `ActionValueInput`, `ArrangeWindowsInput.tsx`, main process handler). Replaced by the shortcut-level feature above.
- Added `app.requestSingleInstanceLock()` in `main.ts` — resolves the "`npm run dev` while tray app running causes double-instance localStorage race" bug that made theme changes randomly reset.

**Session 1 (cancellation & responsive layout):**
- Removed Immediate cancel mode — cancellation is now always graceful.
- Added amber **"Cancelling..."** button state with spinner for immediate click feedback.
- Fixed the full-page double-scroll bug by completing the flex chain (`min-height: 0` + `overflow: hidden` on all flex ancestors).
- Added responsive auto-collapse for both sidebars with manual-choice persistence.
- Enforced minimum window size (800×600) via Electron `minWidth` / `minHeight`.
- Built the `CollapsedSearchPopover.tsx` component with portal-based rendering.
- Added gitignore rules for AI tooling artifacts.

**Session 2 (validation & URL helpers, commit `de393b8`):**
- Removed the `open_vscode` action entirely — 11 actions remain. VS Code via CLI is now a `run_script` use case.
- Restricted `launch_app` to `.exe` only (backend validation + picker filter). Removed `.lnk`, `.bat`, `.cmd` support for safety and clarity.
- Emptied the default values for `launch_app`, `open_url`, `open_folder`, `open_file` — no more placeholder junk getting saved.
- Created the shared `useActionValidation` hook (sync + debounced async checks + unsupported-action flagging).
- Save is now disabled when any action is invalid or unsupported, with a red inline message: *"Fix N invalid action(s) before saving."*
- Auto-prefix `https://` on URL blur, with orphan scheme cleanup (`://google.com` → `https://google.com`).
- New **Test** button for `open_url` actions — opens the URL externally without executing the shortcut (new `test-url` IPC).
- Info tooltip on the URL field label explaining the auto-prefix behavior.
- Bug fix: editing a saved shortcut now restores its hotkey (previously reset to the default `Win + Alt + D` on save, silently corrupting the shortcut).

**Session 3 (GPU fix & URL simplification, commits `2f2335a` + `2a589c7`):**
- Fixed a wide class of visual glitches on laptops with incompatible integrated GPUs (frozen white regions, color tints, broken ClearType) by calling `app.disableHardwareAcceleration()` in the main process. Root cause: Chromium's default Direct3D backend fighting the driver.
- Simplified URL validation: dropped the TLD whitelist, dropped the custom-TLD manager UI, dropped the planned DNS check. Format-only now, with the user verifying via the Test button.
- Added robust IPv4 validation (exactly 4 segments, each 0–255). 5-segment inputs, out-of-range parts, and partial addresses all produce specific error messages instead of the generic "Enter a URL like google.com".
- Added IPv6 bracket-literal support (via `new URL()` parsing).
- Expanded the auto-prefix rule: private/loopback ranges (`10.`, `127.`, `169.254.`, `172.16–31.`, `192.168.`) and `localhost` now get `http://`; everything else gets `https://`.
- Removed dead code: the abandoned `Custom URL TLDs` section in Settings → General.

**Session 4 (usability & performance polish, commits `ff8db07` → `c3854b7`):**
- Added `electron-context-menu` — right-click anywhere now shows Cut/Copy/Paste/Select All. Previously every text field was silent on right-click (Electron's default), which broke basic copy-paste workflows.
- rAF-throttled the resize listener in `App.tsx`. Previously fired hundreds of times per drag; now once per frame. Window resizing is visibly smoother.
- Removed `backdrop-blur-*` from all modals and floating overlays (`App`, `Builder`, `Library`, `DeleteModal`, `OSCriticalWarningModal`, `CollapsedSearchPopover`, `ShortcutCard`). Replaced with solid `bg-background/90` (or `/95` for tighter overlays). Eliminates the per-frame compositor cost of blurring the entire backdrop.
- Deleted `RenameModal.tsx` — verified dead code (no other file imports it; Library uses its own inline rename modal).

### D. In-Progress Work (Locked-in Plan, Not Yet Coded)

**Phase B.2 — Path Field UX:**
- Read-only path fields — typing disabled, Browse is the only way to set them.
- Clear (✗) button next to path fields to reset the value.
- URL live ✓ / ✗ format indicator next to the field.
- Unsupported-action visual: amber border, "Unsupported action" label, value input disabled, only Delete button works.

**Phase C — Library Badges & Run Guards:**
- Amber **"⚠ Invalid Action"** badge on Library cards containing unsupported or invalid actions.
- Run button disabled when the card has any invalid action — greyed out with a tooltip.

**Phase D — Broken Path Handling (Option X):**
- Amber **"⚠ Broken Path"** badge in Library when a path action references a file/folder that no longer exists.
- Run button disabled with tooltip: *"Fix broken paths in the Builder to run this shortcut."*
- **Fix** button on the broken-path action in Builder → opens native picker.
- Existing Delete (trash) button stays.

**Phase E — `run_script` Error Surfacing (Option C):**
- Surface actual `cmd.exe` stderr instead of generic "Command exited with code 1" (e.g. *"Command not found: gti"*).
- **"Fix & Retry"** button on the error state — jumps to Builder with the shortcut pre-loaded.

**Phase E (additional bug):**
- Security Warning modal in `Library.tsx` shows an empty list when the shortcut's only dangerous action is an `open_file` with a dangerous extension (`.exe`, `.ps1`, etc.). The trigger check in `runShortcut()` flags these, but the modal's `<span>` list only filters `run_script` and `launch_app`. Fix: hoist `DANGEROUS_EXTENSIONS` to module scope and extend the filter to include `open_file` with a dangerous extension, showing *"Open: <path>"*.

**Phase 3 — Drag-and-Drop Rebuild (`@dnd-kit`):** ✅ **Done** (Session 5). Internal card reorder uses dnd-kit; sidebar → sequence drop still uses HTML5 native drag as a temporary measure.

**Broken Path Fix UX (Q2b, next):**
- "Fix Paths" button on `ShortcutCard` currently routes to Builder without scrolling. Enhance: auto-scroll to and highlight the first broken action.
- Add a `focusActionId` prop to `Builder`, plumbed from Library's `onEditShortcut` call.
- Flash the target action card (ring-primary + ring-offset for ~900ms, matching the Flow Preview's click-to-jump flash).

**Not-Arranged App Visibility (bug):**
- Symptom: unassigned launch-type windows land wherever Windows puts them — often behind the placed apps instead of on top.
- Example: Notepad (assigned Left) + Calculator (Not Arranged) → Calculator appears *behind* Notepad instead of on top.
- Cause: the engine only calls `ForceForeground` on windows it *places*. Unassigned windows are never touched.
- Fix (proposed): after the placement pass, walk every launch-type action and bring-to-front any window that wasn't placed. No resize. Optional safety: center at native size if fully off-screen.
- Touches: `buildPlacementsFromShortcut` (main.ts), Zod schema, PowerShell loop (`windowLayout.ts`), new `Bring-Unassigned-Window` helper.
- Open question: should `open_folder` actions also be brought to front? A user might open a folder "just to have it available" without wanting their layout disturbed.

**Window Layout Overlay Animation (Batch 3):**
- Transparent frameless BrowserWindow overlay appears for ~600ms during arrangement. Fades in zone outlines, animates each app's icon flying to its zone, then fades out as the real windows are placed. Uses the user's chosen theme color.

**Phase 4 — Keyboard Shortcuts:**
- Ctrl+N (new shortcut), Ctrl+, (settings), Escape (close modal), Ctrl+S (save in Builder), Ctrl+1/2/3 (tab switch).

**Phase 5 — Motion Polish:**
- Install `motion` (Framer Motion v11). Modal open/close, page transitions, card appear stagger.
- Only uses `transform` + `opacity`.

**Phase 6 — Perceived Performance:**
- Startup timing audit, loading indicators for anything >200ms, optimistic UI for Run and Save, focus traps on modals.

**Pending decisions:**
- Test button for `launch_app` / `open_folder` / `open_file` (same pattern as URL Test) — not yet confirmed.
- Auto-delete vs flag for orphaned actions from older shortcuts — current decision is *flag, do not delete*.

### E. Known Issues / Pending Polish

- **Security Warning modal `open_file` filter bug:** `Library.tsx`'s `runShortcut()` correctly flags `open_file` with a dangerous extension as dangerous and shows the confirmation modal, but the modal's `<span>` list only filters `run_script` and `launch_app`. Result: a shortcut whose only dangerous action is an `open_file` shows the modal with an empty list. Fix: hoist `DANGEROUS_EXTENSIONS` to module scope and extend the filter to include `open_file` with a dangerous extension, showing *"Open: <path>"*.
- **README.md is stale:** markets an `open_vscode` action that doesn't exist, lists `.lnk/.bat/.cmd` as valid `launch_app` formats (only `.exe` is), describes an "Arrange Windows" action (moved to shortcut-level), and states `sandbox: false` (it's `true`). Needs a rewrite before public sharing.
- **Unused dependencies:** `electron-store`, `react-router-dom`, `lucide-react`, and `uuid` are listed in `package.json` but never imported. Safe to remove in a dedicated cleanup commit.
- Library and Settings pages have not been fully tested at narrow window widths (800–900px) — potential responsive layout issues.
- ESLint emits a harmless TypeScript-version warning (`@typescript-eslint` supports `>=4.7.4 <5.6.0`; project runs `5.9.3`). Not blocking.
- Running `npx tsc` or `npm run dev` from the repo root (instead of `lazycoww/`) triggers a phantom `tsc@2.0.4` install prompt — always `cd` into `lazycoww/` first.
