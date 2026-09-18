/// <reference types="vite-plugin-electron/electron-env" />

declare namespace NodeJS {
  interface ProcessEnv {
    APP_ROOT: string
    VITE_PUBLIC: string
  }
}

interface ShortcutActionForIPC {
  id: string
  type: string
  title: string
  value: string
}

interface ShortcutForIPC {
  id: string
  name: string
  hotkey: string
  actions: ShortcutActionForIPC[]
}

interface ActionResult {
  actionId: string
  success: boolean
  error?: string
}

interface ShortcutProgressEvent {
  shortcutId: string
  stepIndex: number
}

interface Window {
  electronAPI?: {
    getSystemAccent: () => Promise<string>
    onSystemTheme: (callback: (theme: 'light' | 'dark') => void) => void
    onSystemAccent: (callback: (color: string) => void) => void
    // ── Settings, Path, & Pickers ──
    updateGeneralSettings: (settings: { startAtLogin?: boolean; keepInTray?: boolean; executionNotifications?: boolean }) => void
    checkPathExists: (path: string) => Promise<boolean>
    selectPath: (type: 'app' | 'file' | 'folder') => Promise<string | null>
    // ── Real execution + global hotkeys. Each `on*` returns an unsubscribe function. ──
    runShortcut: (shortcut: ShortcutForIPC) => Promise<ActionResult[]>
       cancelShortcut: (shortcutId: string) => Promise<{ ok: boolean; error?: string }>
    syncHotkeys: (shortcuts: ShortcutForIPC[]) => void
    onShortcutProgress: (callback: (e: ShortcutProgressEvent) => void) => () => void
    onShortcutComplete: (callback: (e: { 
      shortcutId: string; 
      results: ActionResult[]; 
      durationMs?: number;
      cancelled?: 'graceful' | null;
      lastActionTitle?: string | null;
    }) => void) => () => void
    onHotkeyTriggered: (callback: (shortcutId: string) => void) => () => void
    onHotkeyNeedsConfirm: (callback: (shortcutId: string) => void) => () => void
    onHotkeyRegisterFailed: (callback: (info: { shortcutId: string; hotkey: string }) => void) => () => void
  }
}