# LAZYCOW PROJECT BLUEPRINT & AI CONTINUATION CONTEXT

Save this entire document as `LAZYCOW_CONTEXT.md` in your project root. When starting any new AI chat session, copy and paste this entire file as your first message to immediately synchronize the assistant with the project state, coding standards, and operational guidelines.

---

## 1. PROJECT INTRODUCTION & GOALS

**LazyCow** is a local desktop productivity utility designed to automate developer workflows, manage deep-work focus environments, and run sequential trigger commands.

The application is structured to support:
1. **Workspaces (Tabs):** A dashboard/library tab for quick execution, a builder tab for designing custom task chains, and a settings tab for native desktop preferences. Also features placeholder views for future Community and Account modules.
2. **User Experience Focus:** A unified thematic design with high-performance scrolling stabilizers on Windows systems, layout column customizability, collapsible sidebar, and splash screen loading.
3. **Local Execution:** Running as a native desktop application with local data persistence via localStorage.

---

## 2. TECHNICAL STACK & CORE SPECIFICATIONS

* **Runtime Framework:** Electron (Main process in `main.ts` compiled to `dist-electron/main.js` via Vite)
* **Frontend Library:** React (Vite) + TypeScript (TSX)
* **Styling Engine:** Tailwind CSS v3
* **Theme Architecture:** 
    * **Windows Default Mode:** Follows Windows 11 Fluent Design — neutral white/dark grey palette. System accent color read from `AccentPalette` registry key via hidden PowerShell (index 3 for main accent). Applied to `--primary` CSS variable as HSL.
    * **Custom Color Mode:** User-toggleable in Settings. Enables Coffee, Ocean, Forest themes. Each theme has its own HSL variables for light and dark variants. Dark mode uses `.dark .theme-name` descendant selector.
    * Shade pickers (Light/Medium/Dark) only visible when custom color mode is ON.
* **Typography:** Segoe UI Variable Text as primary font. `font-display: swap` for smooth loading. Fonts preloaded in `index.html`.
* **Design System Spacing & Typography Mappings:**
    * `font-title-sm` / `text-title-sm` (18px, Medium/SemiBold) — used for all section titles
    * `font-headline-md` / `text-headline-md` (24px, SemiBold)
    * `font-body-md` / `text-body-md` (15px, Regular)
    * `font-body-sm` / `text-body-sm` (13px, Regular)
    * `font-label-caps` / `text-label-caps` (11px, JetBrains Mono, uppercase, tracked)
    * `font-code-sm` (13px, JetBrains Mono)
* **Windows ClearType Scroll Stabilizer:**
    * `-webkit-font-smoothing: subpixel-antialiased` and `text-rendering: optimizeLegibility` applied to `:root` and all theme classes.
    * Scroll containers use `transform: translateZ(0)` and `backface-visibility: hidden`.
    * Text tags stripped of `will-change: transform`.
    * `scroll-behavior: smooth` globally.
* **Hotkey Recording:** Shared hook `useHotkeyRecorder` captures key combos. System-level shortcuts (Win+D, Alt+Z) cannot be intercepted; dropdown-based `ComboBuilder` provides manual fallback. Modifier-first validation enforced.
* **Data Persistence:** All data stored in localStorage.
    * `lazycow-shortcuts` — saved shortcut objects
    * `lazycow-blocked-triggers` — blocked hotkey strings
    * `lazycow-os-critical-triggers` — user-marked system-critical triggers
    * `lazycow_settings` — app preferences (startup, tray, notifications, shades)
    * `lazycow-theme-mode` — 'system' | 'light' | 'dark'
    * `lazycow-custom-color-mode` — boolean
    * `lazycow-custom-theme` — 'coffee' | 'ocean' | 'forest'
    * `lazycow-dark` — legacy dark mode flag
    * `lazycow-accent` — (unused, system accent read live)

---

## 3. PROJECT DIRECTORY LAYOUT

```text
lazycoww/
├── package.json
├── index.html                   # HTML Entry with splash screen + font preloading
├── main.ts                      # Electron Main process source (TypeScript)
├── preload.ts                   # Preload script source (TypeScript)
├── electron-env.d.ts            # Type declarations for window.electronAPI
├── src/
│   ├── index.css                # Tailwind + HSL themes (Win default + 3 custom) + scroll + transitions
│   ├── App.css                  # Kept empty
│   ├── App.tsx                  # Root: tabs, theme orchestrator, splash, sidebar, modal
│   ├── types/
│   │   └── actions.ts           # Shared types, actionCatalog, constants, blocked triggers
│   ├── hooks/
│   │   └── useHotkeyRecorder.ts # Reusable hotkey recording hook
│   ├── components/
│   │   ├── Sidebar.tsx          # Collapsible nav (64px/260px)
│   │   ├── ActionSidebar.tsx    # Collapsible action library (Builder)
│   │   ├── ActionSequence.tsx   # Drag-reorder cards, flow preview, drop zone
│   │   ├── ShortcutCard.tsx     # Library card with shade, menu, execution log
│   │   ├── ComboBuilder.tsx     # Dropdown hotkey builder (modifier + key)
│   │   ├── BlockedTriggerList.tsx # Searchable trigger list with OS badges
│   │   ├── OSCriticalWarningModal.tsx # Danger modal for system-critical deletes
│   │   ├── RenameModal.tsx      # Reusable rename modal
│   │   ├── DeleteModal.tsx      # Reusable delete confirmation modal
│   │   ├── SettingsAppearance.tsx # Appearance: theme mode, custom color toggle, accent picker
│   │   ├── SettingsGeneral.tsx  # General settings (startup, tray, notifications)
│   │   ├── SettingsData.tsx     # Data & Backup (export/import)
│   │   ├── SettingsBlockedTriggers.tsx # Blocked triggers with OS-critical support
│   │   ├── SettingsDangerZone.tsx     # Factory reset (3-step with DELETE confirmation)
│   │   └── SettingsFooter.tsx   # Version info footer
│   └── pages/
│       ├── Library.tsx          # Saved shortcuts grid, search, rename, delete, execution
│       ├── Builder.tsx          # Shortcut builder with live name/hotkey validation
│       └── Settings.tsx         # Orchestrates all Settings sub-components
4. ACTIVE CODEBASE REGISTRY (FILE-BY-FILE DETAILS)
A. Core Entry & Main Process
1. main.ts

File Path: /main.ts

Current Logic: Electron main process. Creates BrowserWindow (1200x800). Loads preload.mjs. Uses nativeTheme for system light/dark detection, sends system-theme to renderer. Reads Windows accent color from AccentPalette registry key (index 3) via hidden PowerShell, sends system-accent to renderer. Re-checks accent on window focus. Exposes get-system-accent IPC handler.

2. preload.ts

File Path: /preload.ts

Current Logic: Exposes ipcRenderer (on, off, send, invoke) and electronAPI (getSystemAccent, onSystemTheme, onSystemAccent) to renderer via contextBridge.exposeInMainWorld.

3. electron-env.d.ts

File Path: /electron-env.d.ts

Current Logic: TypeScript declarations for window.ipcRenderer and window.electronAPI with getSystemAccent, onSystemTheme, onSystemAccent methods.

4. index.html

File Path: /index.html

Current Logic: Vite root shell. Preconnects to Google Fonts. Preloads Hanken Grotesk, Inter, JetBrains Mono, Material Symbols. Splash screen (#splash-screen) with animated loader hides after fonts load.

5. src/index.css

File Path: /src/index.css

Current Logic: Tailwind directives. Windows 11 default theme (neutral white/dark grey) as :root and .dark. Custom themes (Coffee, Ocean, Forest) as .theme-* classes with .dark .theme-* descendant selectors for dark variants. ClearType font smoothing on all theme classes. GPU-accelerated scroll containers. Page transitions (.page-container.active). Themed scrollbar (6px).

B. Layout Shells
6. src/App.tsx

File Path: /src/App.tsx

Current Logic: Root orchestrator. States: activeTab, customColorMode, customTheme, themeMode, systemIsDark, systemAccent, appReady, sidebarCollapsed, libraryRefreshKey, builderKey. Waits for fonts via document.fonts.ready. Listens to electronAPI.onSystemTheme and electronAPI.onSystemAccent. Computes darkMode from DOM class. Applies theme classes and accent color to DOM via useEffect. Sun/moon toggle cycles system→light→dark→system. Custom mode toggle preserves dark state. Confirmation modal for unsaved Builder changes. Pages kept mounted via CSS show/hide. hexToHSL utility converts system accent hex to HSL for CSS variable --primary.

7. src/components/Sidebar.tsx

File Path: /src/components/Sidebar.tsx

Props: activeTab, onTabClick, collapsed, onToggleCollapse

Current Logic: Collapsible nav (64px/260px). Icons only when collapsed with tooltips. "New Project" button navigates to Builder. 5 tabs.

C. Shared Types & Hooks
8. src/types/actions.ts

File Path: /src/types/actions.ts

Current Logic: Exports ActionItem, CatalogItem, SavedShortcut. actionCatalog (10 actions: Apps & Web = Launch App, Open URL, Open Folder, Open File; System Control = Set Volume, Toggle DND, Night Light, Set Brightness-greyed; Developer Tools = Run Script, Open in VS Code). categoryOrder, getFieldLabel. STORAGE_KEY_SHORTCUTS, STORAGE_KEY_BLOCKED_TRIGGERS. DEFAULT_BLOCKED_TRIGGERS (17 system shortcuts).

9. src/hooks/useHotkeyRecorder.ts

File Path: /src/hooks/useHotkeyRecorder.ts

Current Logic: Reusable hook. Returns { recording, recordedCombo, startRecording, stopRecording, clearCombo, setRecordedCombo }. Listens on window capture phase. Blocks default behavior during recording. Escape clears combo. Used by Builder and SettingsBlockedTriggers.

D. Components
10. src/components/ActionSidebar.tsx

Collapsible action catalog (64px/expanded). Inline search when collapsed. Hover tooltips. Drag-to-add.

11. src/components/ActionSequence.tsx

Sequence cards with HTML5 DnD reorder + arrow buttons + flow preview + drop zone.

12. src/components/ShortcutCard.tsx

Library card with shade dots (only in custom color mode), action icons, hotkey, execution log, dropdown menu (Edit Flow / Rename / Delete).

13. src/components/ComboBuilder.tsx

Dropdown hotkey builder. 1 modifier + 1 key default. Add/remove slots. Modifiers always first. Validates before apply.

14. src/components/BlockedTriggerList.tsx

Searchable trigger list. Intercepts modifier combos in search. OS-critical triggers show yellow OS badge. Delete button triggers parent handler.

15. src/components/OSCriticalWarningModal.tsx

Danger modal. Red exclamation icon. Shows trigger name. Cancel / Delete Anyway buttons.

16. src/components/SettingsAppearance.tsx

Appearance section. Theme Mode dropdown (System Default / Light / Dark). Custom Color Mode toggle. When ON: Coffee/Ocean/Forest accent picker with icons.

17. src/components/SettingsGeneral.tsx

General settings. "Start LazyCow at startup", "Keep in System Tray", "Execution Notifications". Shade picker only visible when customColorMode is true.

18. src/components/SettingsBlockedTriggers.tsx

Blocked Triggers with expand/collapse. Record button + ComboBuilder + Add. "Mark as system-critical" checkbox. Delete with OSCriticalWarningModal for critical triggers. OS-critical list in lazycow-os-critical-triggers. Shade picker only in custom mode.

19. src/components/SettingsDangerZone.tsx

Factory Reset with 3 steps: "Wipe All Data" → "Yes, I'm sure" → Type "DELETE" (case-insensitive). Clears localStorage, reloads.

20. src/components/SettingsFooter.tsx

Version, team info.

E. Workspace Pages
21. src/pages/Library.tsx

Props: setActiveTab, onEditShortcut, customColorMode

Loads shortcuts from localStorage on remount. Grid 2/3/4 columns. Search. Empty state. Inline rename modal with duplicate name check (case-insensitive). Delete confirmation. Execution simulator. "Edit Flow" sends to Builder.

22. src/pages/Builder.tsx

Props: editData, onUnsavedChanges, onSaveSuccess

Empty initial state. Real-time name validation (case-insensitive duplicate check, inline error). Real-time hotkey validation (modifier-first, blocked, duplicate). Save validates name/desc/actions/hotkey. Discard clears all. ComboBuilder for OS shortcuts. Collapsible ActionSidebar.

23. src/pages/Settings.tsx

Orchestrates: SettingsAppearance, SettingsGeneral, SettingsBlockedTriggers, SettingsDangerZone, SettingsFooter. Manages LocalSettings in lazycow_settings.

5. OPERATIONAL GUIDELINES FOR THE AI ASSISTANT
TypeScript & Tailwind: Always output strongly-typed .tsx. Use semantic Tailwind CSS variables. No inline styles.

Mockup Translation: Convert HTML mockups to React hooks. No direct DOM manipulation.

Antialiasing: No will-change on text containers.

Named Exports: export const ComponentName: React.FC = ...

State Clearances: Cleanup timers/listeners in useEffect returns.

Page Mounting: Pages use CSS show/hide (.page-container.active). Use key props for remounts.

Hotkey Recording: Use useHotkeyRecorder hook. No duplication.

Dropdown Builder: Use ComboBuilder. Modifiers first.

Data Flow: Builder → localStorage → onSaveSuccess → App increments keys → remounts.

Theme Shades: Standard map for light/medium/dark gradients.

OS-Critical Triggers: Use OSCriticalWarningModal for deletes. Store in lazycow-os-critical-triggers.

Section Titles: All use font-title-sm text-title-sm (18px).

Source Files: Changes go in .ts source files (main.ts, preload.ts), not compiled .js/.mjs.

6. MANDATORY CONTEXT UPDATE PROTOCOL
Whenever code creates/modifies a file, append a Context Update Alert with:

Instruction to update LAZYCOW_CONTEXT.md

Exact Markdown block for the changed registry entry

