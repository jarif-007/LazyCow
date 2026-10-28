"use strict";
const electron = require("electron");
electron.contextBridge.exposeInMainWorld("electronAPI", {
  getSystemAccent: () => electron.ipcRenderer.invoke("get-system-accent"),
  onSystemTheme: (callback) => {
    electron.ipcRenderer.on("system-theme", (_event, theme) => callback(theme));
  },
  onSystemAccent: (callback) => {
    electron.ipcRenderer.on("system-accent", (_event, color) => callback(color));
  },
  // ── Real execution engine ──
  runShortcut: (shortcut) => electron.ipcRenderer.invoke("execute-shortcut", shortcut),
  // ── URL test (opens in default browser, no shortcut executed) ──
  testUrl: (url) => electron.ipcRenderer.invoke("test-url", url),
  // ── Window Layout runtime (positions windows into a layout) ──
  arrangeWindowsShortcut: (request) => electron.ipcRenderer.invoke("arrange-windows-shortcut", request),
  // ── Cancellation ──
  cancelShortcut: (shortcutId) => electron.ipcRenderer.invoke("cancel-shortcut", { shortcutId }),
  // ── Global hotkeys ──
  syncHotkeys: (shortcuts) => electron.ipcRenderer.send("sync-hotkeys", shortcuts),
  // ── Hotkey recording suppress flag ──
  // True while the renderer is capturing a new hotkey. Main process
  // suppresses hotkey callbacks so pressing an already-assigned combo
  // doesn't fire that shortcut while the user records a new one.
  setHotkeyRecording: (value) => electron.ipcRenderer.send("set-hotkey-recording", value),
  // ── Test Hotkey (3-step lifecycle, no timer) ──
  // start: snapshot shortcuts, register only the candidate.
  // check: read whether the candidate fired.
  // stop:  restore the snapshot. MUST be called when the test ends.
  testHotkeyStart: (combo) => electron.ipcRenderer.invoke("test-hotkey-start", { combo }),
  testHotkeyCheck: () => electron.ipcRenderer.invoke("test-hotkey-check"),
  testHotkeyStop: () => electron.ipcRenderer.invoke("test-hotkey-stop"),
  // ── Auth & External Links ──
  openExternalUrl: (url) => electron.ipcRenderer.invoke("open-external-url", url),
  testAction: (action) => electron.ipcRenderer.invoke("test-action", action),
  // ── App Drawer ──
  listInstalledApps: () => electron.ipcRenderer.invoke("list-installed-apps"),
  refreshInstalledApps: () => electron.ipcRenderer.invoke("refresh-installed-apps"),
  testLaunchApp: (path) => electron.ipcRenderer.invoke("test-launch-app", path),
  // ── Zoom ──
  getZoomFactor: () => electron.ipcRenderer.invoke("get-zoom-factor"),
  setZoomFactor: (factor) => electron.ipcRenderer.invoke("set-zoom-factor", factor),
  onZoomChanged: (callback) => {
    const listener = (_event, factor) => callback(factor);
    electron.ipcRenderer.on("zoom-changed", listener);
    return () => electron.ipcRenderer.removeListener("zoom-changed", listener);
  },
  // ── Hardware acceleration ──
  getHardwareAcceleration: () => electron.ipcRenderer.invoke("get-hardware-acceleration"),
  setHardwareAcceleration: (enabled) => electron.ipcRenderer.invoke("set-hardware-acceleration", enabled),
  relaunchApp: () => electron.ipcRenderer.invoke("relaunch-app"),
  // ── General settings ──
  updateGeneralSettings: (settings) => {
    electron.ipcRenderer.send("update-general-settings", settings);
  },
  checkPathExists: (path) => electron.ipcRenderer.invoke("check-path-exists", path),
  selectPath: (type) => electron.ipcRenderer.invoke("select-path", type),
  // ── Shortcut persistence (disk mirror) ──
  readShortcutsFromDisk: () => electron.ipcRenderer.invoke("read-shortcuts-from-disk"),
  writeShortcutsToDisk: (list) => electron.ipcRenderer.invoke("write-shortcuts-to-disk", list),
  // ── Synchronous Settings Persistence ──
  saveSettingSync: (key, value) => electron.ipcRenderer.sendSync("save-setting-sync", { key, value }),
  readSettingsSync: () => electron.ipcRenderer.sendSync("read-settings-sync"),
  // Each `on*` returns an unsubscribe function — call it from a useEffect cleanup.
  onShortcutProgress: (callback) => {
    const listener = (_event, data) => callback(data);
    electron.ipcRenderer.on("shortcut-progress", listener);
    return () => electron.ipcRenderer.removeListener("shortcut-progress", listener);
  },
  onShortcutComplete: (callback) => {
    const listener = (_event, data) => callback(data);
    electron.ipcRenderer.on("shortcut-complete", listener);
    return () => electron.ipcRenderer.removeListener("shortcut-complete", listener);
  },
  onHotkeyTriggered: (callback) => {
    const listener = (_event, shortcutId) => callback(shortcutId);
    electron.ipcRenderer.on("hotkey-triggered", listener);
    return () => electron.ipcRenderer.removeListener("hotkey-triggered", listener);
  },
  onHotkeyNeedsConfirm: (callback) => {
    const listener = (_event, shortcutId) => callback(shortcutId);
    electron.ipcRenderer.on("hotkey-needs-confirm", listener);
    return () => electron.ipcRenderer.removeListener("hotkey-needs-confirm", listener);
  },
  onShortcutStarted: (callback) => {
    const listener = (_event, info) => callback(info);
    electron.ipcRenderer.on("shortcut-started", listener);
    return () => electron.ipcRenderer.removeListener("shortcut-started", listener);
  },
  onHotkeyRegisterFailed: (callback) => {
    const listener = (_event, info) => callback(info);
    electron.ipcRenderer.on("hotkey-register-failed", listener);
    return () => electron.ipcRenderer.removeListener("hotkey-register-failed", listener);
  },
  onAuthCallback: (callback) => {
    const listener = (_event, url) => {
      console.log("[Preload] Received auth-callback event from main process");
      callback(url);
    };
    electron.ipcRenderer.on("auth-callback", listener);
    return () => {
      console.log("[Preload] Removing auth-callback listener");
      electron.ipcRenderer.removeListener("auth-callback", listener);
    };
  }
});
