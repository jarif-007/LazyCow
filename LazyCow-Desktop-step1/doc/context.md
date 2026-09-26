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
│           │   ├── ActionSequence.tsx # Task chain visual builder, sliders, pickers, DnD reorder
│           │   ├── ActionSidebar.tsx  # Collapsible catalog sidebar with drag-to-add
│           │   ├── BlockedTriggerList.tsx # Searchable blocked triggers list
│           │   ├── CollapsedSearchPopover.tsx # Command-palette search popover for collapsed ActionSidebar
│           │   ├── ComboBuilder.tsx   # Dropdown modifier-first hotkey constructor
│           │   ├── DeleteModal.tsx    # Confirmation modal for shortcut deletion
│           │   ├── RenameModal.tsx    # Modal for renaming shortcuts with duplicate check
│           │   ├── OSCriticalWarningModal.tsx # Safety warning modal for critical hotkey deletes
│           │   ├── SettingsAppearance.tsx # Theme, mode, and accent color settings
│           │   ├── SettingsBlockedTriggers.tsx # Blocked triggers and OS-critical hotkey config
│           │   ├── SettingsDangerZone.tsx # 3-step factory reset with confirmation
│           │   ├── SettingsFooter.tsx # Version & metadata footer
│           │   ├── SettingsGeneral.tsx # Startup, tray, and notification options
│           │   ├── ShortcutCard.tsx   # Dashboard shortcut card with menu and execution status
│           │   └── Sidebar.tsx        # Collapsible primary navigation sidebar
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
- **Window Management:** Creates 1200x800 `BrowserWindow` with `autoHideMenuBar: true`, custom icon, and hidden titlebar. Minimizes/closes to system tray if `keepInTray` is enabled.
- **System Theme & Accent Synchronization:** Reads the Windows accent via Electron's `systemPreferences.getAccentColor()`; streams updates to the renderer on window focus.
- **Window Minimum Size:** BrowserWindow is clamped to `minWidth: 800`, `minHeight: 600` (Windows Fluent Design standard). Users cannot shrink the window below this.
- **Execution Engine (`execute-shortcut`):**
  - **`launch_app`**: Validates extension (`.exe` only — other executable types were removed for safety and clarity) and launches the executable via Electron's `shell.openPath`. Includes an 800ms settle delay so the progress UI matches the app actually appearing on screen.
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
  - **`arrange_windows`**: Comprehensive Win32 window positioning engine via `WinManager`:
    - Uses `user32.dll` `EnumWindows` and `GetWindowText` to enumerate actual visible top-level windows on the desktop (avoiding `Get-Process` worker process pitfalls).
    - Window handle tracking (`$usedHandles`) to tile multiple windows from the same application (e.g. separate Chrome/browser windows).
    - 2.4-second polling retry loop for newly launched apps to render before positioning.
    - Automatic `ShowWindow(hwnd, SW_RESTORE)` to un-maximize or un-minimize windows before resizing.
    - Active window fallback skipping LazyCow, with optional target app name input in the UI.
  - **`delay`**: Pauses sequence execution for a configurable duration (`ms`) via `await new Promise(r => setTimeout(r, ms))` so launched applications or scripts have time to initialize before subsequent steps.
  - **`run_script`**: Spawns commands in `cmd.exe` with 120s timeout and process tree kill capability (`taskkill /pid /t /f`).
- **Shortcut Cancellation (`cancel-shortcut`):**
  - Cancellation is **always graceful** — the currently running action finishes normally, then remaining actions are skipped. This prevents killing unrelated windows of the same app.
  - IPC handler sets a flag in `cancelRequests: Set<string>`. The execution loop checks between actions and stops if the shortcut's ID is present.
  - No mode parameter (previously had Graceful/Immediate; Immediate was removed).
- **OS Notifications:** Emits native Windows desktop toast notifications (`new Notification(...)`) upon shortcut success or failure with elapsed execution duration (e.g. `Completed in 1.4s`).
- **Path Dialogs (`select-path`):** Invokes `dialog.showOpenDialog` for native application (`.exe`), directory, or file selection.
- **Path Checking (`check-path-exists`):** Verifies file/directory existence using `fs.existsSync`.
- **URL Test (`test-url`):** Opens a URL in the default browser for a quick preview without executing a shortcut. Used by the **Test** button on `open_url` action cards. Rejects malformed URLs on the main side.
- **Global Hotkey Registration:** Listens for registered shortcut keys, checks for dangerous actions, emits `hotkey-needs-confirm` or runs shortcut, and notifies on registration failures via `onHotkeyRegisterFailed`.

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

- **11 Supported Action Types (All Active):**
  1. `launch_app` — Application Path (`.exe` only)
  2. `open_url` — Website URL
  3. `open_folder` — Folder Path
  4. `open_file` — File Path
  5. `arrange_windows` — Window Layout (Snap Left/Right, Maximize, Split, Tri-Grid, Quad-Grid)
  6. `set_volume` — Volume Level (0–100% Slider)
  7. `toggle_dnd` — DND Configuration (Toggle, Enable, Disable)
  8. `toggle_nightlight` — Night Light Mode (Toggle, Enable, Disable)
  9. `set_brightness` — Brightness Level (0–100% Slider)
  10. `delay` — Wait / Delay Duration (100ms–60,000ms, with 0.25s–10.0s interactive step slider)
  11. `run_script` — Terminal Command
- **Blocked System Triggers:** 17 protected default Windows shortcuts (`Alt+F4`, `Ctrl+Alt+Del`, `Win+L`, `Win+D`, `Win+R`, `Win+E`, etc.).

---

### C. UI & Components

- **`ActionSidebar.tsx`:** Collapsible action catalog. Expanded mode shows full action cards with search. Collapsed mode shows icon strip with hover tooltips and a search icon that opens the `CollapsedSearchPopover`. Auto-collapses below 1100px window width (forced; user cannot re-expand until window grows).
- **`CollapsedSearchPopover.tsx`:** Command-palette style centered popover opened from the collapsed ActionSidebar's search icon. Contains auto-focused input, live filtering by action name OR category, grouped results, Escape/Enter keyboard support. Uses React `createPortal` to escape parent `transform` stacking context. Clicking a result adds the action and closes the popover.
- **`ActionSequence.tsx`:** Drag-and-drop action cards with visual flow preview, direct slider controls for Volume, Brightness, and Delay duration, dropdown controls for DND and Night Light, visual window layout configuration, and native **"Browse"** file pickers. For `open_url` actions, includes a **Test** button (opens the URL in the default browser via `testUrl` IPC), an **info tooltip** explaining the auto-https behavior, and automatic `https://` prefixing when the user blurs a schemeless URL.
- **`Builder.tsx`:** Shortcut builder with real-time name uniqueness checking, hotkey conflict detection, modifier-first validation, unsaved changes safety modal, and full responsive layout (see Section 2's Responsive Layout subsection). Uses the shared `useActionValidation` hook to **disable Save** when any action is invalid or unsupported, showing *"Fix N invalid action(s) before saving."* Restores the shortcut's hotkey when opening for edit.
- **`ShortcutCard.tsx`:** Dashboard shortcut card with 3-dot dropdown menu (Edit Flow, Duplicate, Rename, Delete), hotkey conflict warning badge, elapsed duration analytics (`Sequence Complete • 1.4s`), live step execution log, amber **"Cancelling..."** button state with spinner when cancel is requested, and **"Cancelled after: <action title>"** state display. Menu is disabled while the shortcut is running.
- **`Library.tsx`:** Shortcut card dashboard with live step progress ring, execution log, search filter, duplicate workflow generator (`(Copy)` naming & hotkey decoupling), inline rename modal, dropdown management, and cancel handler that forwards to `cancelShortcut`.
- **`Settings.tsx` & Subcomponents:** Manages appearance, theme switching, startup launch, system tray minimization, execution notifications, blocked triggers, and factory reset.

### D. Hooks (`src/hooks/`)

- **`useHotkeyRecorder.ts`:** Captures global key combinations for the trigger field. Uses capture-phase `keydown` so all keystrokes are swallowed during recording. Returns `{ recording, recordedCombo, startRecording, stopRecording, clearCombo, setRecordedCombo }`.
- **`useActionValidation.ts`:** Single source of truth for action-sequence validation. Runs synchronous checks (empty values, format, numeric range) immediately and debounced path-existence checks (400ms) via `checkPathExists`. Also flags actions whose `type` is not in the current `actionCatalog` as **unsupported**. Returns `{ errors, unsupportedIds, isValid }`. Consumed by both `ActionSequence.tsx` (inline errors) and `Builder.tsx` (Save gating).

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
11. **Auto-Prefix URLs on Blur:** URL fields auto-prepend `https://` when the user blurs without a scheme. The prefixer strips any orphan `://`, `//`, or `:` first. Users who explicitly type `http://` or `https://` keep control.

---

## 7. CURRENT PROJECT STATUS & FEATURE ROADMAP

### A. Fully Implemented & Verified Features
* **11 Action Types:** Launch App (`.exe` only), Open URL, Open Folder, Open File, Arrange Windows (5 Win32 layout presets), Set Volume (WASAPI COM), Toggle DND (Focus Assist), Toggle Night Light, Set Brightness (WMI/CIM/DDC-CI), Wait / Delay (0.25s–10s slider), Run Terminal Script.
* **Shortcut Builder:** Visual drag-and-drop sequencing, live name uniqueness validation, hotkey collision checking, ComboBuilder modifier constructor, native OS Browse pickers. **Save is disabled when any action is invalid or unsupported**, with a red inline message under the Save button.
* **Action Validation:** Shared `useActionValidation` hook validates every action synchronously (format, range, empty) and asynchronously (path existence). Checks run debounced at 400ms and produce per-action error messages.
* **URL Helpers:** Automatic `https://` prefixing on blur (with orphan-scheme cleanup), a **Test** button to preview the URL in the default browser without executing the shortcut, and an info tooltip explaining the auto-prefix behavior.
* **Shortcut Library:** Grid layout switcher (2/3/4 cols), search bar, inline rename modal, delete modal, duplicate/clone shortcut with auto `(Copy)` naming.
* **Execution & Diagnostics:** Real-time step progress ring, step execution log with elapsed runtime display (`Sequence Complete • 1.4s`), toast notifications with duration, and hotkey conflict warning badge (`Conflict`).
* **Settings & Themes:** Windows 11 Fluent Theme (native DWM accent sync) + Custom color themes (Coffee, Ocean, Forest) with shade selectors; system tray support and Windows startup integration; blocked triggers management.
* **Graceful Cancellation:** Cancel button replaces Run button while a shortcut is executing. Clicking it immediately shows an amber **"Cancelling..."** spinner, then the current action finishes and remaining steps are skipped. Result shown as **"Cancelled after: <last action title>"**.
* **Responsive Layout:** Window has a hard minimum of 800×600. Main sidebar auto-collapses below 900px; ActionSidebar auto-collapses below 1100px. Manual collapse choice persists; auto-collapse is forced only while the window is narrow.
* **Collapsed Search Popover:** When ActionSidebar is collapsed, clicking the search icon opens a centered command-palette-style popover (`CollapsedSearchPopover.tsx`) rendered via React `createPortal`. Live filtering by name or category, grouped results, keyboard support (`Esc` to close, `Enter` to add first result).

### B. Remaining Desktop Roadmap (Excluding Cloud / Auth)
1. **Shortcut Export / Import (.json):** Allow users to export shortcuts as `.lazycow` or `.json` files to back up or share offline, with an Import button to restore them.
2. **Mini Floating HUD / Quick Trigger Bar:** Compact floating pill or tray popover (like Raycast or Spotlight) summoned via a global hotkey to trigger any shortcut by typing without opening the main window.
3. **Application Arguments & Working Directory:** Advanced settings for `launch_app` to pass CLI flags and specify custom working directories.
4. **Error Recovery & Conditional Steps:** Option on actions to "Continue on error" vs "Halt sequence", or "Skip if already running".
5. **Scheduled / Automatic Triggers:** Time-based shortcut execution (e.g., Run "Work Setup" every weekday at 9:00 AM) using node-cron or Windows Task Scheduler.

### C. Recently Completed

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

**Pending decisions:**
- Test button for `launch_app` / `open_folder` / `open_file` (same pattern as URL Test) — not yet confirmed.
- Auto-delete vs flag for orphaned actions from older shortcuts — current decision is *flag, do not delete*.

### E. Known Issues / Pending Polish

- Library and Settings pages have not been fully tested at narrow window widths (800–900px) — potential responsive layout issues.
- ESLint emits a harmless TypeScript-version warning (`@typescript-eslint` supports `>=4.7.4 <5.6.0`; project runs `5.9.3`). Not blocking.
- Running `npx tsc` or `npm run dev` from the repo root (instead of `lazycoww/`) triggers a phantom `tsc@2.0.4` install prompt — always `cd` into `lazycoww/` first.
