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

  // ── Global hotkeys ──
  syncHotkeys: (shortcuts: unknown) => ipcRenderer.send('sync-hotkeys', shortcuts),

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

  onShortcutComplete: (callback: (e: { shortcutId: string; results: { actionId: string; success: boolean; error?: string }[] }) => void) => {
    const listener = (_event: unknown, data: { shortcutId: string; results: { actionId: string; success: boolean; error?: string }[] }) => callback(data)
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