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

interface InstalledAppForIPC {
  name: string
  path: string
  /**
   * 'exe'   — regular file path.
   * 'uwp'   — `shell:AppsFolder\<AUMID>`.
   * 'shell' — `shell:<folder>` or `shell:AppsFolder\<AUMID>` (shell folders).
   */
  kind: 'exe' | 'uwp' | 'shell'
  iconDataUrl: string | null
  /** True for system components (redistributables, runtimes, SDKs). Auto-hidden. */
  system: boolean
}

interface Window {
  electronAPI?: {
    getSystemAccent: () => Promise<string>
    onSystemTheme: (callback: (theme: 'light' | 'dark') => void) => void
    onSystemAccent: (callback: (color: string) => void) => void
    // ── Settings, Path, & Pickers ──
    updateGeneralSettings: (settings: { startAtLogin?: boolean; keepInTray?: boolean; executionNotifications?: boolean }) => void
    // ── Zoom ──
    getZoomFactor: () => Promise<number>
    setZoomFactor: (factor: number) => Promise<number>
    onZoomChanged: (callback: (factor: number) => void) => () => void
    // ── Hardware acceleration ──
    getHardwareAcceleration: () => Promise<{ current: boolean; boot: boolean }>
    setHardwareAcceleration: (enabled: boolean) => Promise<{ ok: boolean }>
    relaunchApp: () => Promise<void>
    // ── Auth & External Links ──
    openExternalUrl: (url: string) => Promise<{ ok: boolean; error?: string }>
    // ── Action Testing ──
    testAction: (action: { type: string; value: string }) => Promise<{ ok: boolean; error?: string }>

    // ── App Drawer ──
    listInstalledApps: () => Promise<InstalledAppForIPC[]>
    refreshInstalledApps: () => Promise<InstalledAppForIPC[]>
    testLaunchApp: (path: string) => Promise<{ ok: boolean; error?: string }>
    checkPathExists: (path: string) => Promise<boolean>
    selectPath: (type: 'app' | 'file' | 'folder') => Promise<string | null>
    // ── Shortcut persistence (disk mirror) ──
    readShortcutsFromDisk: () => Promise<{ ok: boolean; data: unknown[] }>
    writeShortcutsToDisk: (list: unknown[]) => Promise<{ ok: boolean }>

    // ── Synchronous Settings Persistence ──
    saveSettingSync: (key: string, value: string) => boolean
    readSettingsSync: () => Record<string, string>
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
    /** Begin a hotkey test — register only the candidate, snapshot the rest. */
    testHotkeyStart: (combo: string) => Promise<{ ok: boolean; reason?: string }>
    /** Read whether the candidate hotkey fired during an open test. */
    testHotkeyCheck: () => Promise<{ fired: boolean }>
    /** End a hotkey test — restore the previous registration state. */
    testHotkeyStop: () => Promise<void>
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
    onAuthCallback: (callback: (url: string) => void) => () => void
  }
}