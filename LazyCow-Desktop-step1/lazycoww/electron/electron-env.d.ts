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

interface WindowLayoutConfigForIPC {
  enabled: boolean
  layoutId: string | null
  assignments: Record<string, string>
}

interface ShortcutForIPC {
  id: string
  name: string
  hotkey: string
  actions: ShortcutActionForIPC[]
  windowLayout?: WindowLayoutConfigForIPC
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
    testUrl: (url: string) => Promise<{ ok: boolean; error?: string }>
    arrangeWindowsShortcut: (request: unknown) => Promise<
      Array<{
        zoneId: string
        actionTitle: string
        status: 'placed' | 'fallback_centered' | 'not_found' | 'skipped'
        reason?: string
      }>
    >
    cancelShortcut: (shortcutId: string) => Promise<{ ok: boolean; error?: string }>
    syncHotkeys: (payload: ShortcutForIPC[] | { shortcuts: ShortcutForIPC[]; securedDoublePressSeconds: number }) => void
    /** Toggle whether the main process should suppress hotkey firing. */
    setHotkeyRecording: (value: boolean) => void
    /** Test whether a hotkey fires on this system. */
    testHotkey: (combo: string) => Promise<{ fired: boolean; reason?: string }>
    onShortcutProgress: (callback: (e: ShortcutProgressEvent) => void) => () => void
    onShortcutComplete: (callback: (e: { 
      shortcutId: string; 
      results: ActionResult[]; 
      durationMs?: number;
      cancelled?: 'graceful' | null;
      lastActionTitle?: string | null;
      layoutResults?: Array<{
        zoneId: string;
        actionTitle: string;
        status: 'placed' | 'fallback_centered' | 'not_found' | 'skipped';
        reason?: string;
      }> | null;
    }) => void) => () => void
    onHotkeyTriggered: (callback: (shortcutId: string) => void) => () => void
    onHotkeyNeedsConfirm: (callback: (shortcutId: string) => void) => () => void
    onShortcutStarted: (callback: (info: { shortcutId: string }) => void) => () => void
    onHotkeyRegisterFailed: (callback: (info: { shortcutId: string; hotkey: string }) => void) => () => void
  }
}