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
  - `contextIsolation: true`, `nodeIntegration: false`, `sandbox: false` (to permit controlled native Node/PowerShell IPC bridge).
  - Preload script uses `contextBridge.exposeInMainWorld('electronAPI', ...)` to expose only safe, named functions.
  - Multi-line PowerShell scripts execute via `-EncodedCommand` (Base64 UTF-16LE) to eliminate CLI parameter injection.
  - Dangerous actions (scripts, executables) triggered via global hotkeys prompt for confirmation before executing.
* **Data Persistence:**
  - `lazycow-shortcuts` — Array of saved `SavedShortcut` objects.
  - `lazycow-blocked-triggers` — Blocked hotkey trigger strings.
  - `lazycow-os-critical-triggers` — OS-critical protected triggers.
  - `lazycow_settings` — General desktop settings (`startAtLogin`, `keepInTray`, `executionNotifications`, `shades`).
  - `lazycow-theme-mode` — `'system' | 'light' | 'dark'`.
  - `lazycow-custom-color-mode` — Boolean toggle for custom color themes.
  - `lazycow-custom-theme` — `'coffee' | 'ocean' | 'forest'`.

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
│           │   └── useHotkeyRecorder.ts # Reusable global keyboard capture hook
│           ├── components/
│           │   ├── ActionSequence.tsx # Task chain visual builder, sliders, pickers, DnD reorder
│           │   ├── ActionSidebar.tsx  # Collapsible catalog sidebar with drag-to-add
│           │   ├── BlockedTriggerList.tsx # Searchable blocked triggers list
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
- **System Theme & Accent Synchronization:** Queries `AccentPalette` in the Windows registry via hidden PowerShell process; streams updates on window focus.
- **Execution Engine (`execute-shortcut`):**
  - **`launch_app`**: Validates extension (`.exe`, `.lnk`, `.bat`, `.cmd`) and launches executable via `execFileAsync`.
  - **`open_url`**: Sanitizes HTTP/HTTPS URLs and opens via Electron's `shell.openExternal`.
  - **`open_folder` & `open_file`**: Verifies target path existence and opens with `shell.openPath`.
  - **`open_vscode`**: Launches `code.cmd` pointing to the target folder path.
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
  - **`run_script`**: Spawns commands in `cmd.exe` with process tree kill capability (`taskkill /pid /t /f`).
- **OS Notifications:** Emits native Windows desktop toast notifications (`new Notification(...)`) upon shortcut success or failure with elapsed execution duration (e.g. `Completed in 1.4s`).
- **Path Dialogs (`select-path`):** Invokes `dialog.showOpenDialog` for native application (`.exe`), directory, or file selection.
- **Path Checking (`check-path-exists`):** Verifies file/directory existence using `fs.existsSync`.
- **Global Hotkey Registration:** Listens for registered shortcut keys, checks for dangerous actions, emits `hotkey-needs-confirm` or runs shortcut, and notifies on registration failures via `onHotkeyRegisterFailed`.

#### 2. `electron/preload.ts` & `electron/electron-env.d.ts`
- Securely exposes `window.electronAPI`:
  - `getSystemAccent(): Promise<string>`
  - `onSystemTheme(callback)` / `onSystemAccent(callback)`
  - `runShortcut(shortcut)`
  - `syncHotkeys(shortcuts)`
  - `updateGeneralSettings(settings: { startAtLogin?: boolean; keepInTray?: boolean; executionNotifications?: boolean })`
  - `checkPathExists(path): Promise<boolean>`
  - `selectPath(type: 'app' | 'file' | 'folder'): Promise<string | null>`
  - `onShortcutProgress(callback)` / `onShortcutComplete(callback)` (with `durationMs` analytics)
  - `onHotkeyTriggered(callback)` / `onHotkeyNeedsConfirm(callback)` / `onHotkeyRegisterFailed(callback)`

---

### B. Action Catalog & Types (`src/types/actions.ts`)

- **12 Supported Action Types (All Active):**
  1. `launch_app` — Application Path
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
  12. `open_vscode` — Folder Path (opens in VS Code)
- **Blocked System Triggers:** 17 protected default Windows shortcuts (`Alt+F4`, `Ctrl+Alt+Del`, `Win+L`, `Win+D`, `Win+R`, `Win+E`, etc.).

---

### C. UI & Components

- **`ActionSequence.tsx`:** Drag-and-drop action cards with visual flow preview, direct slider controls for Volume, Brightness, and Delay duration, dropdown controls for DND and Night Light, visual window layout configuration, debounced path validation, and native **"Browse"** file pickers.
- **`Builder.tsx`:** Shortcut builder with real-time name uniqueness checking, hotkey conflict detection, modifier-first validation, and unsaved changes safety modal.
- **`ShortcutCard.tsx`:** Dashboard shortcut card with 3-dot dropdown menu (Edit Flow, Duplicate, Rename, Delete), hotkey conflict warning badge (`onHotkeyRegisterFailed`), elapsed duration analytics (`Sequence Complete • 1.4s`), and live step execution log.
- **`Library.tsx`:** Shortcut card dashboard with live step progress ring, execution log, search filter, duplicate workflow generator (`(Copy)` naming & hotkey decoupling), and dropdown management.
- **`Settings.tsx` & Subcomponents:** Manages appearance, theme switching, startup launch, system tray minimization, execution notifications, blocked triggers, and factory reset.

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
npx tsc --noEmit
```

### Linting
```bash
npx eslint .
```

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

---

## 7. CURRENT PROJECT STATUS & FEATURE ROADMAP

### A. Fully Implemented & Verified Features
* **12 Action Types:** Launch App, Open URL, Open Folder, Open File, Arrange Windows (5 Win32 layout presets), Set Volume (WASAPI COM), Toggle DND (Focus Assist), Toggle Night Light, Set Brightness (WMI/CIM/DDC-CI), Wait / Delay (0.25s–10s slider), Run Terminal Script, Open in VS Code.
* **Shortcut Builder:** Visual drag-and-drop sequencing, live name uniqueness validation, hotkey collision checking, ComboBuilder modifier constructor, native OS Browse pickers.
* **Shortcut Library:** Grid layout switcher (2/3/4 cols), search bar, inline rename modal, delete modal, duplicate/clone shortcut with auto `(Copy)` naming.
* **Execution & Diagnostics:** Real-time step progress ring, step execution log with elapsed runtime display (`Sequence Complete • 1.4s`), toast notifications with duration, and hotkey conflict warning badge (`Conflict`).
* **Settings & Themes:** Windows 11 Fluent Theme (native DWM accent sync) + Custom color themes (Coffee, Ocean, Forest) with shade selectors; system tray support and Windows startup integration; blocked triggers management.

### B. Remaining Desktop Roadmap (Excluding Cloud / Auth)
1. **Shortcut Export / Import (.json):** Allow users to export shortcuts as `.lazycow` or `.json` files to back up or share offline, with an Import button to restore them.
2. **Mini Floating HUD / Quick Trigger Bar:** Compact floating pill or tray popover (like Raycast or Spotlight) summoned via a global hotkey to trigger any shortcut by typing without opening the main window.
3. **Application Arguments & Working Directory:** Advanced settings for `launch_app` to pass CLI flags and specify custom working directories.
4. **Error Recovery & Conditional Steps:** Option on actions to "Continue on error" vs "Halt sequence", or "Skip if already running".
5. **Scheduled / Automatic Triggers:** Time-based shortcut execution (e.g., Run "Work Setup" every weekday at 9:00 AM) using node-cron or Windows Task Scheduler.
