# LazyCow 🐮

> **A native Windows workspace automation & focus orchestrator.**  
> Effortlessly launch workspaces, arrange multi-window layouts, toggle system settings, and automate repetitive tasks with custom sequential triggers and global hotkeys.

[![Platform](https://img.shields.io/badge/Platform-Microsoft%20Windows%2010%20%7C%2011-blue?logo=windows)](https://microsoft.com/windows)
[![Electron](https://img.shields.io/badge/Electron-30.x-47848F?logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?logo=vite)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/TailwindCSS-3.x-38B2AC?logo=tailwindcss)](https://tailwindcss.com/)

---

## 📖 Overview

**LazyCow** is an open-source, desktop productivity utility engineered exclusively for **Microsoft Windows**. It allows developers, students, and power users to construct multi-step automation workflows (called **Shortcuts**) that execute sequentially with visual progress tracking, global keyboard shortcut triggers, and native Windows OS notifications.

Whether you're starting a deep-work coding session, preparing a study environment, or shutting down for the night, LazyCow transforms multi-step setup routines into a single hotkey press or dashboard click.

---

## ⚡ Key Features

### 1. Robust Sequential Execution Engine
Construct multi-step automated sequences with precise ordering, validation, and visual execution tracking:

* **Apps & Web**:  
  * 🚀 **Launch Application**: Launch `.exe` executables via a built-in App Drawer (scans Start Menu, Registry, and UWP apps) or native file picker.  
  * 🌐 **Open URL**: Open web applications and links in your default Windows browser.  
  * 📁 **Open Folder**: Open specific directory paths directly in Windows Explorer.  
  * 📄 **Open File**: Open documents, project files, or media in default handlers.  
* **System Control (Native Windows Integrations)**:  
  * 🔊 **Set Volume**: Adjust Windows master output volume (0–100%) via Windows CoreAudio (WASAPI) COM interfaces.  
  * ☀️ **Display Brightness**: Adjust monitor backlight levels (0–100%) via WMI and DDC/CI fallbacks.  
  * 🔕 **Toggle DND (Focus Assist)**: Toggle Windows Focus Assist toast notifications via Registry/UIA.  
  * 🌙 **Night Light**: Toggle Windows Blue Light Reduction state via Windows CloudStore registry.  
  * ⏱️ **Delay**: Pause execution between actions to allow heavy applications to load.  
* **Developer Tools**:  
  * 💻 **Run Terminal Script**: Execute arbitrary shell commands in `cmd.exe` with graceful cancellation.

### 2. Shortcut-Level Window Layout Engine
* **7 Predefined Layouts**: Snap active windows into Split 50/50, Split 67/33, Thirds, Main Left/Right, or Quad Grid.
* **Zone Assignment**: Assign specific applications to specific screen zones directly in the Builder.
* **Native Snapping**: Uses C# P/Invoke (`SetWindowPos`) to precisely position windows, mimicking Windows Snap Layouts.
* **User-Judge Mechanism**: Unassigned apps still launch but are skipped by the layout engine, giving users full control.

### 3. Global Hotkey Engine & Trigger Safety
* **Physical Key Recording**: Captures physical hardware key codes (`e.code`) rather than characters, ensuring hotkeys work across UK, Bengali, and international keyboard layouts.
* **Mandatory Test Gate**: Prevents saving dead hotkeys by forcing a 3-step OS test before saving.
* **Blocked System Triggers**: Built-in protection against overriding critical Windows shortcuts (e.g., `Alt+F4`, `Win+L`, `Ctrl+Alt+Del`).
* **Secured Shortcuts**: Protects dangerous actions (scripts/executables). If triggered while the app is minimized, a native Windows toast requires a double-press confirmation within a customizable window.

### 4. Cloud Sync & Native Experience
* **Supabase Integration**: Real Email/Password and Google OAuth (via Deep Linking). Cloud Vault to backup and restore shortcuts across devices.
* **Path Sanitization**: Uploaded shortcuts strip local absolute paths and store "hints". On download, it auto-resolves paths using the App Drawer or prompts a "Needs Setup" badge.
* **Fluent Design**: Automatically syncs with your Windows 11/10 system accent color, featuring ClearType typography and hardware-accelerated scrolling.
* **Data Durability**: Shortcuts are mirrored synchronously to a local `shortcuts.json` file to prevent data loss on hard kills.

---

## 🛠️ Tech Stack

* **Platform**: Microsoft Windows (Windows 10 / Windows 11, x64)
* **Runtime**: [Electron](https://www.electronjs.org/) (v30)
* **Frontend**: [React](https://react.dev/) (v18) + [TypeScript](https://www.typescriptlang.org/)
* **Build Tool**: [Vite](https://vitejs.dev/) (v5) + `vite-plugin-electron`
* **Styling**: [Tailwind CSS](https://tailwindcss.com/) (v3)
* **Backend / Database**: [Supabase](https://supabase.com/) (PostgreSQL)
* **OS Automation**: PowerShell, C# P/Invoke, Node.js `child_process`

---

## 📁 Repository Structure

```text
LazyCow/
├── code/                        # Main desktop application source tree
│   ├── electron/
│   │   ├── main.ts              # Electron main process (Windows execution engine & APIs)
│   │   ├── preload.ts           # Secure IPC contextBridge exposure
│   │   ├── windowLayout.ts      # C# P/Invoke window snapping engine
│   │   └── preferences.ts       # Hardware acceleration config
│   ├── src/
│   │   ├── components/          # React components (ActionSequence, WindowLayout, etc.)
│   │   ├── hooks/               # Custom React hooks (useHotkeyRecorder, useDragSelect)
│   │   ├── pages/               # Pages (Library, Builder, Settings, Account)
│   │   ├── types/               # Action catalogs & TypeScript data models
│   │   └── utils/               # Cloud sync, disk mirroring, safety classifiers
│   ├── public/                  # Static assets
│   ├── scripts/                 # Utility scripts
│   ├── .eslintrc.cjs            # ESLint configuration
│   ├── .gitignore               # Git ignore rules
│   ├── boot.bat                 # Boot script
│   ├── electron-builder.json5   # Installer configuration
│   ├── index.html               # Main HTML file
│   ├── jsconfig.json            # JS config
│   ├── package.json             # Scripts and dependencies
│   ├── postcss.config.js        # PostCSS config
│   ├── tailwind.config.js       # Tailwind config
│   ├── tsconfig.json            # TypeScript config
│   ├── tsconfig.node.json       # Node TypeScript config
│   └── vite.config.ts           # Vite + Electron build configuration
├── doc/                         # Project presentations & SRS documents
│   ├── Final Presentation.pdf
│   ├── Group 8 (SPL - SRS) Presentation.pdf
│   ├── Group 8 [109, 142, 147, 152].pdf
│   ├── Proposal Presentation.pdf
│   └── SRS User Story_ SPL Group 8.pdf
└── README.md                    # Project README
```

---

## 🚀 Getting Started

### Prerequisites
Ensure you have the following installed on your Windows machine:
* **Windows 10** (Build 19041+) or **Windows 11**
* **Node.js**: v18.x or v20.x
* **npm** (comes bundled with Node.js)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/jarif-007/LazyCow.git
   cd LazyCow
   ```

2. Navigate to the desktop application directory:
   ```bash
   cd code
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

---

## 💻 Running the App

### Development Mode
To start the application with Vite Hot Module Replacement (HMR) and Electron live-reloading:

```bash
npm run dev
```

> **Note**: LazyCow enforces Windows exclusivity. If executed on macOS or Linux, an error modal will appear and the application will gracefully exit.

### Production Build & Verification
To run TypeScript verification and bundle the frontend and Electron main processes:

```bash
# Type check without emitting files
npx tsc --noEmit

# Bundle production assets
npx vite build
```

### Packaging Windows Installer (.exe)
To build the standalone Windows NSIS installer and portable executable:

```bash
npm run build
```

The output binaries (`.exe`) will be generated inside the `release/` directory.

---

## 🛡️ Security Architecture

LazyCow interacts directly with native Windows system interfaces and shell processes. To ensure strict security:

1. **IPC Context Isolation**: `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`. Raw `ipcRenderer.send` is never exposed. The `contextBridge` only exposes explicitly whitelisted functions.
2. **PowerShell UTF-16LE Base64 Encoding**: Multi-line PowerShell scripts (used for WASAPI volume, WMI brightness, and Window positioning) are executed using `-EncodedCommand` to completely prevent command-line injection.
3. **Execution Guards**: Scripts and external executables require explicit user confirmation if triggered outside the active application window via global hotkeys (Double-press protection).
4. **Cloud Security**: Supabase Row-Level Security (RLS) ensures users can only access and modify their own shortcuts. RLS collision errors are gracefully handled by regenerating IDs.

---

## 👥 Contributors & Acknowledgements

Developed as part of the SPL-2 (Software Project Lab 2) initiative by Group 8:

* **Tamjidur Rahman** (230042109) — Cloud Sync, App Drawer, Hints
* **Shudipto Sarwar** (230042142) — Library, Settings, IPC Bridge
* **Irfan Sadik Chy** (230042147) — Builder, Action Sequence, Hotkey Recorder
* **Mohammad Faiaj Jarif** (230042152) — OS Execution Engine, Window Layout

* **Repository**: [github.com/jarif-007/LazyCow](https://github.com/jarif-007/LazyCow)
* **Branch**: `Tamjid's-work`
