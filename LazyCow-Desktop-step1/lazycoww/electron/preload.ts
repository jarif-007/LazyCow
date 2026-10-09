import { ipcRenderer, contextBridge } from 'electron'

// Only ever expose a narrow, named set of methods here — never the raw
// ipcRenderer.on/send/invoke primitives. A generic bridge would let any
// script running in the renderer (including one injected via a bug in a
// shared/imported shortcut's data, or a compromised dependency) call ANY
// IPC channel by name, not just the ones this app intends to allow.
contextBridge.exposeInMainWorld('electronAPI', {
  getSystemAccent: () => ipcRenderer.invoke('get-system-accent'),
  onSystemTheme: (callback: (theme: 'light' | 'dark') => void) => {
    ipcRenderer.on('system-theme', (_event, theme) => callback(theme as 'light' | 'dark'))
  },
  onSystemAccent: (callback: (color: string) => void) => {
    ipcRenderer.on('system-accent', (_event, color) => callback(color))
  },

  // ── Real execution engine ──
  runShortcut: (shortcut: unknown) => ipcRenderer.invoke('execute-shortcut', shortcut),

  // ── URL test (opens in default browser, no shortcut executed) ──
  testUrl: (url: string) => ipcRenderer.invoke('test-url', url),

  // ── Window Layout runtime (positions windows into a layout) ──
  arrangeWindowsShortcut: (request: unknown) =>
    ipcRenderer.invoke('arrange-windows-shortcut', request),

  // ── Cancellation ──
  cancelShortcut: (shortcutId: string) => ipcRenderer.invoke('cancel-shortcut', { shortcutId }),

  // ── Global hotkeys ──
  syncHotkeys: (shortcuts: unknown) => ipcRenderer.send('sync-hotkeys', shortcuts),

  // ── Hotkey recording suppress flag ──
  // True while the renderer is capturing a new hotkey. Main process
  // suppresses hotkey callbacks so pressing an already-assigned combo
  // doesn't fire that shortcut while the user records a new one.
  setHotkeyRecording: (value: boolean) => ipcRenderer.send('set-hotkey-recording', value),

  // ── General settings ──
  updateGeneralSettings: (settings: { startAtLogin?: boolean; keepInTray?: boolean }) => {
    ipcRenderer.send('update-general-settings', settings)
  },

  checkPathExists: (path: string) => ipcRenderer.invoke('check-path-exists', path),
  selectPath: (type: 'app' | 'file' | 'folder') => ipcRenderer.invoke('select-path', type),

  // Each `on*` returns an unsubscribe function — call it from a useEffect cleanup.
  onShortcutProgress: (callback: (e: { shortcutId: string; stepIndex: number }) => void) => {
    const listener = (_event: unknown, data: { shortcutId: string; stepIndex: number }) => callback(data)
    ipcRenderer.on('shortcut-progress', listener)
    return () => ipcRenderer.removeListener('shortcut-progress', listener)
  },

   onShortcutComplete: (callback: (e: { 
    shortcutId: string; 
    results: { actionId: string; success: boolean; error?: string }[]; 
    durationMs?: number;
    cancelled?: 'graceful' | 'immediate' | null;
    lastActionTitle?: string | null;
  }) => void) => {
    const listener = (_event: unknown, data: { 
      shortcutId: string; 
      results: { actionId: string; success: boolean; error?: string }[]; 
      durationMs?: number;
      cancelled?: 'graceful' | 'immediate' | null;
      lastActionTitle?: string | null;
    }) => callback(data)
    ipcRenderer.on('shortcut-complete', listener)
    return () => ipcRenderer.removeListener('shortcut-complete', listener)
  },

  onHotkeyTriggered: (callback: (shortcutId: string) => void) => {
    const listener = (_event: unknown, shortcutId: string) => callback(shortcutId)
    ipcRenderer.on('hotkey-triggered', listener)
    return () => ipcRenderer.removeListener('hotkey-triggered', listener)
  },

  onHotkeyNeedsConfirm: (callback: (shortcutId: string) => void) => {
    const listener = (_event: unknown, shortcutId: string) => callback(shortcutId)
    ipcRenderer.on('hotkey-needs-confirm', listener)
    return () => ipcRenderer.removeListener('hotkey-needs-confirm', listener)
  },



  onHotkeyRegisterFailed: (callback: (info: { shortcutId: string; hotkey: string }) => void) => {
    const listener = (_event: unknown, info: { shortcutId: string; hotkey: string }) => callback(info)
    ipcRenderer.on('hotkey-register-failed', listener)
    return () => ipcRenderer.removeListener('hotkey-register-failed', listener)
  },
})