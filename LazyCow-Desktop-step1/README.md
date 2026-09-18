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
- **Apps & Web**:
  - 🚀 **Launch Application**: Launch executables (`.exe`, `.lnk`, `.bat`, `.cmd`) with arguments.
  - 🌐 **Open URL**: Open web applications and links in your default Windows browser.
  - 📁 **Open Folder**: Open specific directory paths directly in Windows Explorer.
  - 📄 **Open File**: Open documents, project files, or media in default handlers.
- **System Control (Native Windows Integrations)**:
  - 🪟 **Arrange Windows**: Snap active windows or automatically position up to 4 specific applications into **Snap Left/Right**, **Maximize**, **Split Screen** (Horizontal/Vertical), **Tri-Grid** (1 Main + 2 Sub), or **Quad-Grid** (4 corners) using native Win32 `user32.dll` APIs.
  - 🔊 **Set Volume**: Adjust Windows master output volume (0–100%) via Windows CoreAudio (WASAPI) COM interfaces.
  - ☀️ **Display Brightness**: Adjust monitor backlight levels (0–100%) via Windows WMI (`WmiMonitorBrightnessMethods`).
  - 🔕 **Toggle DND (Focus Assist)**: Toggle, enable, or disable Windows Focus Assist toast notifications via the Windows Registry.
  - 🌙 **Night Light**: Toggle, enable, or disable Windows Blue Light Reduction state directly via Windows CloudStore registry stores.
  - ⏳ **Wait / Delay**: Introduce configurable pauses (100ms–60,000ms with interactive 0.25s–10.0s step slider) to give heavy desktop applications time to initialize before subsequent actions run.
- **Developer Tools**:
  - 💻 **Run Terminal Script**: Execute arbitrary shell commands in `cmd.exe` with real-time process tree termination (`taskkill /pid /t /f`) on cancellation.
  - 📝 **Open in VS Code**: Open any directory or workspace directly in Visual Studio Code (`code.cmd`).

### 2. Global Hotkey Engine & Trigger Safety
- Register system-wide global hotkeys using a keyboard recorder hook or dropdown-based **ComboBuilder**.
- **Conflict Badging**: Visually flags shortcuts whose global keybindings conflict with existing registered system hotkeys.
- **Blocked System Triggers**: Built-in protection against overriding critical Windows shortcuts (e.g., `Alt+F4`, `Win+L`, `Ctrl+Alt+Del`, `Win+D`, `Win+Tab`, clipboard shortcuts).
- **Dangerous Action Protection**: Shortcuts containing arbitrary scripts or executables trigger a confirmation dialog before running when activated via global hotkeys.

### 3. Workflow Management & Analytics
- 📋 **Duplicate / Clone Flow**: 1-click duplication of any workflow via the card's 3-dot dropdown menu, auto-generating safe `(Copy)` naming and unassigning the hotkey to prevent collisions.
- ⏱️ **Execution Duration Analytics**: Displays precise elapsed runtime (e.g. `Sequence Complete • 1.4s`) on card logs and Windows native notifications.

### 4. Native Windows Experience & Fluent Design
- **System Accent Matching**: Automatically queries the Windows Registry (`AccentPalette`) to seamlessly blend LazyCow's UI with your Windows 11/10 system accent color.
- **Custom Color Themes**: Optional Coffee, Ocean, and Forest palettes with fine-grained light, medium, and dark shade gradients.
- **ClearType Optimization**: Configured with subpixel antialiasing and GPU-accelerated scrolling containers for crisp typography on Windows displays.
- **Tray & Startup Support**: Run on Windows startup (`app.setLoginItemSettings`) and minimize/hide to the Windows System Notification Tray.
- **Native File Pickers**: Integrated "Browse" buttons for executables, folders, and files using Windows native file dialogs.
- **Toast Notifications**: Native Windows notifications on shortcut completion or failure with execution elapsed time.

---

## 🛠️ Tech Stack

- **Platform**: Microsoft Windows (Windows 10 / Windows 11, x64)
- **Runtime**: [Electron](https://www.electronjs.org/) (v30)
- **Frontend**: [React](https://react.dev/) (v18) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/) (v5) + `vite-plugin-electron`
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) (v3) + Segoe UI Variable / JetBrains Mono
- **Packaging**: [electron-builder](https://www.electron.build/) (Windows NSIS Installer & Portable)

---

## 📁 Repository Structure

```text
LazyCow/
├── LazyCow-Desktop-step1/       # Main desktop application source tree
│   ├── doc/                     # Architecture & context specifications
│   │   └── context.md           # Master technical blueprint & AI context
│   └── lazycoww/                # Electron + React application workspace
│       ├── electron/
│       │   ├── main.ts          # Electron main process (Windows execution engine & APIs)
│       │   ├── preload.ts       # Secure IPC contextBridge exposure
│       │   └── electron-env.d.ts# TypeScript definitions for electronAPI
│       ├── src/
│       │   ├── components/      # React components (ActionSequence, Builder, Settings, etc.)
│       │   ├── hooks/           # Custom React hooks (useHotkeyRecorder)
│       │   ├── pages/           # Pages (Library, Builder, Settings)
│       │   ├── types/           # Action catalogs & TypeScript data models
│       │   ├── App.tsx          # Root shell & theme orchestrator
│       │   └── index.css        # Fluent & custom themes, ClearType optimizations
│       ├── package.json         # Scripts and dependencies
│       ├── vite.config.ts       # Vite + Electron build configuration
│       └── electron-builder.json5 # Windows packaging configuration
├── code/                        # Shared utility code & scripts
├── doc/                         # Project presentations & SRS documents
└── README.md                    # Project README
```

---

## 🚀 Getting Started

### Prerequisites

Ensure you have the following installed on your Windows machine:
- **Windows 10 (Build 19041+)** or **Windows 11**
- **Node.js**: `v18.x` or `v20.x` ([Download Node.js](https://nodejs.org/))
- **npm** (comes bundled with Node.js) or **yarn** / **pnpm**
- **PowerShell 5.1+** (default on Windows 10/11)

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/jarif-007/LazyCow.git
   cd LazyCow
   ```

2. **Navigate to the desktop application directory**:
   ```bash
   cd LazyCow-Desktop-step1/lazycoww
   ```

3. **Install dependencies**:
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

### Packaging Windows Installer (`.exe`)

To build the standalone Windows NSIS installer and portable executable:

```bash
npm run build
```
The output binaries (`.exe`) will be generated inside the `release/` directory.

---

## 🛡️ Security Architecture

LazyCow interacts directly with native Windows system interfaces and shell processes. To ensure strict security:
1. **IPC Context Isolation**: `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: false` with a narrow, strictly typed `contextBridge` API. Raw `ipcRenderer.send` or `ipcRenderer.on` are never exposed to the renderer.
2. **PowerShell UTF-16LE Base64 Encoding**: Multi-line PowerShell scripts (used for WASAPI volume, WMI brightness, and Window positioning) are executed using `-EncodedCommand` with base64 UTF-16LE encoding to completely prevent command-line injection and quoting vulnerabilities.
3. **Execution Guards**: Scripts and external executables require explicit user confirmation if triggered outside the active application window via global hotkeys.
4. **Reserved Trigger Protection**: Crucial operating system key combinations are blocked to prevent accidental system lockouts.

---

## 👥 Contributors & Acknowledgements

Developed as part of the **SPL-2 (Software Project Lab 2)** initiative by **Group 8**.
- Repository: [github.com/jarif-007/LazyCow](https://github.com/jarif-007/LazyCow)
- Branch: `Tamjid's-work`
