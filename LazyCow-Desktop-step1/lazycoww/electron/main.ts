import { app, BrowserWindow, ipcMain, nativeTheme, shell, globalShortcut, Tray, Menu, nativeImage, systemPreferences, dialog, Notification } from 'electron'

// ── Hardware acceleration (user-configurable) ──
// Historically we always called app.disableHardwareAcceleration() to fix
// Chromium's Direct3D rendering on a class of laptops with incompatible
// integrated GPUs. The cost: software rendering makes animations (the
// Design polish Phase 1 motion layer) visibly choppy on capable machines.
//
// Now it's a user-facing toggle (context.md rule 12). Default true. Read
// SYNCHRONOUSLY here — this is the only point in the process lifecycle
// where hardware acceleration can still be disabled. Requires restart.
const bootPreferences = readPreferencesSync()
const hardwareAccelerationEnabled = bootPreferences.hardwareAcceleration ?? false
if (!hardwareAccelerationEnabled) {
    app.disableHardwareAcceleration()
}
import { exec, execFile, spawn } from 'child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import crypto from 'node:crypto'
import { z } from 'zod'
import contextMenu from 'electron-context-menu'
import { arrangeWindows, snapshotHandles, type Placement, type PlacementResult } from './windowLayout'
import { readPreferencesSync, writePreferences } from './preferences'

// ── Native right-click context menu (copy / paste / cut / select all) ──
// Without this, Electron shows nothing on right-click — which breaks a
// basic expectation for every text field, input, and contentEditable.
contextMenu({
  showInspectElement: !!process.env.VITE_DEV_SERVER_URL,
  showCopyImage: true,
  showSaveImageAs: true,
  showLookUpSelection: true,
  showSearchWithGoogle: false,
})

// ── Single Instance Lock ──
// LazyCow is a tray-resident app — only one process may run at a time.
// If a second launch is attempted (double-click the icon, run `npm run dev`
// while the app is already in the tray, etc.), the second process quits
// immediately and hands control back to the running instance, which then
// restores + focuses its window. This is the standard desktop-app model
// (VS Code, Slack, Discord).
const gotSingleInstanceLock = app.requestSingleInstanceLock()
if (!gotSingleInstanceLock) {
  app.quit()
}

// Tell Windows this is a standalone app, not the generic Electron shell.
// This forces the taskbar to use our icon and name instead of "Electron".
if (process.platform === 'win32') {
  app.setAppUserModelId('com.lazycow.app')
}

// ── OS Lock: LazyCow is exclusively designed for Microsoft Windows ──
if (process.platform !== 'win32') {
  app.whenReady().then(() => {
    dialog.showErrorBox(
      'Unsupported Operating System',
      'LazyCow is designed exclusively for Microsoft Windows and cannot run on this operating system.'
    )
    app.quit()
  })
}

const execAsync = promisify(exec)

// ── Zoom limits ──
// Used by the before-input-event handler in createWindow to clamp
// Ctrl +/- zoom between 50% and 200%.
const ZOOM_MIN = 0.5
const ZOOM_MAX = 2.0

// Format-only URL check — scheme http/https + host present.
function isValidUrlFormat(value: string): boolean {
  try {
    const u = new URL(value)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return false
    if (!u.hostname) return false
    return true
  } catch {
    return false
  }
}

// Opens a URL in the default browser for a quick preview — does NOT run a shortcut.
ipcMain.handle('test-url', async (_event, url: string) => {
  if (typeof url !== 'string' || !isValidUrlFormat(url)) {
    return { ok: false, error: 'Invalid URL' }
  }
  try {
    await shell.openExternal(url)
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
})

const __dirname = path.dirname(fileURLToPath(import.meta.url))

process.env.APP_ROOT = path.join(__dirname, '..')

export const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron')
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist')

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, 'public') : RENDERER_DIST

let win: BrowserWindow | null = null
let tray: Tray | null = null
let keepInTray = true
let isQuitting = false
let lastAccentColor = '#0078D4'
let executionNotifications = true

// ── Zoom IPC ──
// Settings.tsx calls setZoomFactor on mount to restore the user's saved
// zoom. get-zoom-factor lets the renderer read the current value. The
// before-input-event handler (see createWindow) broadcasts 'zoom-changed'
// whenever Ctrl +/-/0 fires.
ipcMain.handle('get-zoom-factor', () => {
  return win?.webContents.getZoomFactor() ?? 1
})

ipcMain.handle('set-zoom-factor', (_event, factor: unknown) => {
  const n = typeof factor === 'number' && Number.isFinite(factor) ? factor : 1
  const clamped = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, n))
  win?.webContents.setZoomFactor(clamped)
  return clamped
})

// ── Hardware acceleration IPC ──
// `boot` is what was actually applied this session (read at module load,
// above). `current` is what's on disk right now. The renderer compares
// them to decide whether to show "Restart required".
ipcMain.handle('get-hardware-acceleration', () => {
  const current = readPreferencesSync().hardwareAcceleration ?? false
  return { current, boot: hardwareAccelerationEnabled }
})

ipcMain.handle('set-hardware-acceleration', (_event, enabled: unknown) => {
  if (typeof enabled !== 'boolean') return { ok: false }
  writePreferences({ hardwareAcceleration: enabled })
  return { ok: true }
})

ipcMain.handle('relaunch-app', () => {
  // Two rules for not losing localStorage on restart:
  //   1. app.relaunch() schedules the new process — but ONLY in production,
  //      because in dev the fresh electron would try to load a Vite server
  //      we're about to kill.
  //   2. app.quit() — NOT app.exit(0). app.exit is a hard kill that skips
  //      will-quit AND Chromium's own storage flush, discarding any
  //      localStorage writes that hadn't landed yet. app.quit() runs the
  //      normal shutdown path, which flushes storage. This was the root
  //      cause of the 2026-10-15 data-loss incident.
  if (process.env.VITE_DEV_SERVER_URL) {
    // Dev mode: spawn a fresh dev pipeline that survives our exit.
    const cwd = process.env.APP_ROOT || process.cwd()
    setTimeout(() => {
      try {
        const child = spawn('npm', ['run', 'dev'], {
          cwd,
          detached: true,
          stdio: 'ignore',
          shell: true,
          windowsHide: true,
        })
        child.unref()
      } catch (err) {
        console.warn('[relaunch] dev restart failed:', err)
      }
    }, 2000)
  } else {
    app.relaunch()
  }
  app.quit()
})

app.on('before-quit', () => {
  isQuitting = true
})

// A second launch attempt was blocked by the single-instance lock.
// Bring the existing window to the foreground instead of opening a new one.
app.on('second-instance', () => {
  if (win) {
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }
})

ipcMain.on('update-general-settings', (_event, settings: { startAtLogin?: boolean; keepInTray?: boolean; executionNotifications?: boolean }) => {
  if (typeof settings.keepInTray === 'boolean') {
    keepInTray = settings.keepInTray
  }
  if (typeof settings.startAtLogin === 'boolean') {
    app.setLoginItemSettings({ openAtLogin: settings.startAtLogin })
  }
  if (typeof settings.executionNotifications === 'boolean') {
    executionNotifications = settings.executionNotifications
  }
})

function getAppIconPath(): string {
  const icoPath = path.join(process.env.VITE_PUBLIC, 'icon.ico')
  if (fs.existsSync(icoPath)) return icoPath
  const pngPath = path.join(process.env.VITE_PUBLIC, 'icon.png')
  if (fs.existsSync(pngPath)) return pngPath
  return path.join(process.env.VITE_PUBLIC, 'electron-vite.svg')
}

function getTrayIconPath(): string {
  const trayIcoPath = path.join(process.env.VITE_PUBLIC, 'icon.ico')
  if (fs.existsSync(trayIcoPath)) return trayIcoPath
  const trayPngPath = path.join(process.env.VITE_PUBLIC, 'icon-32.png')
  if (fs.existsSync(trayPngPath)) return trayPngPath
  return getAppIconPath()
}

function createTray() {
  const iconPath = getTrayIconPath()
  let icon = nativeImage.createFromPath(iconPath)

  if (icon.isEmpty()) {
    const fallbackBase64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAGFJREFUOE9jZKAQMFKon2HUAAaGGyA2N/8H4sFozEg3AKYIrzFIBgP5sBqMboBsM0hxiG4ATHHIAcMFGBmRzCBF3FAzSAEDAwOjgOERx8AoGoRygxgXY2REYvFIM4iSAQAA7X0/wT9P1JcAAAAASUVORK5CYII='
    icon = nativeImage.createFromDataURL(`data:image/png;base64,${fallbackBase64}`)
  }

  tray = new Tray(icon)
  const contextMenu = Menu.buildFromTemplate([
    { label: 'Show LazyCow', click: () => win?.show() },
    {
      label: 'Quit', click: () => {
        isQuitting = true
        app.quit()
      }
    }
  ])
  tray.setToolTip('LazyCow')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => win?.show())
}

function createWindow() {
  console.log('--- APP ICON PATH ---', getAppIconPath());
  console.log('--- TRAY ICON PATH ---', getTrayIconPath());
  win = new BrowserWindow({
    icon: getAppIconPath(),
    autoHideMenuBar: true,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
    },
  })

  win.on('close', (event) => {
    if (keepInTray && !isQuitting) {
      event.preventDefault()
      win?.hide()
    }
  })

  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date).toLocaleString())
    sendSystemTheme()
    setTimeout(() => sendAccentColor(), 500)
  })

  win.on('focus', () => {
    setTimeout(() => checkAndSendAccentIfChanged(), 300)
  })

  // Zoom keyboard shortcuts — handled here (not in the renderer) so they
  // work regardless of keyboard layout, and so they don't get eaten by
  // renderer key handlers. Skips when the hotkey recorder is active —
  // otherwise pressing Ctrl + + during recording would zoom instead of
  // capturing the combo.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return
    if (!input.control) return
    if (isRecordingHotkey) return

    const code = input.code
    const isPlus = code === 'Equal' || code === 'NumpadAdd'
    const isMinus = code === 'Minus' || code === 'NumpadSubtract'
    const isZero = code === 'Digit0' || code === 'Numpad0'

    if (isPlus || isMinus || isZero) {
      event.preventDefault()
      const current = win!.webContents.getZoomFactor()
      let next = current
      if (isPlus) next = Math.min(ZOOM_MAX, Math.round((current + 0.1) * 100) / 100)
      else if (isMinus) next = Math.max(ZOOM_MIN, Math.round((current - 0.1) * 100) / 100)
      else next = 1.0  // Ctrl + 0 resets
      win!.webContents.setZoomFactor(next)
      win!.webContents.send('zoom-changed', next)
    }
  })

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'))
  }
}

// ── System theme (light/dark) ──
function sendSystemTheme() {
  if (!win) return
  const isDark = nativeTheme.shouldUseDarkColors
  win.webContents.send('system-theme', isDark ? 'dark' : 'light')
}

nativeTheme.on('updated', () => {
  sendSystemTheme()
})

// ── System accent color ──
function getWindowsAccentColor(): Promise<string> {
  return new Promise((resolve) => {
    if (process.platform === 'win32') {
      try {
        if (typeof systemPreferences.getAccentColor === 'function') {
          const accent = systemPreferences.getAccentColor()
          if (accent && accent.length >= 6) {
            const hex = accent.slice(0, 6).toUpperCase()
            if (/^[0-9A-F]{6}$/.test(hex)) {
              resolve(`#${hex}`)
              return
            }
          }
        }
      } catch (err) {
        console.warn('systemPreferences.getAccentColor failed, falling back:', err)
      }
    }
    resolve(lastAccentColor)
  })
}

async function sendAccentColor() {
  if (!win) return
  const color = await getWindowsAccentColor()
  lastAccentColor = color
  win.webContents.send('system-accent', color)
}

async function checkAndSendAccentIfChanged() {
  if (!win) return
  const color = await getWindowsAccentColor()
  if (color !== lastAccentColor) {
    lastAccentColor = color
    win.webContents.send('system-accent', color)
  }
}

ipcMain.handle('get-system-accent', async () => {
  return await getWindowsAccentColor()
})

// ──────────────────────────────────────────────
// APP DRAWER — Installed apps discovery
// ──────────────────────────────────────────────
// Three sources combined, because no single one is complete:
//
//   1. Get-StartApps — everything Windows shows in the Start menu,
//      including UWP apps. Names come from here (cleaner than .lnk names).
//   2. Start Menu .lnk files — resolve a Start-Menu entry to its target .exe.
//   3. App Paths registry — resolve an exe name (e.g. "Code.exe") to its
//      absolute path. VS Code User install registers here but its Start Menu
//      shortcut sometimes fails shell.readShortcutLink, so this is the fix.
//
// UWP apps are stored with a "shell:AppsFolder\" prefix. At launch time,
// we branch on that prefix and use shell.openExternal instead of openPath.

interface InstalledApp {
  name: string
  path: string
  /**
   * 'exe'   — regular .exe, launched via shell.openPath
   * 'uwp'   — Windows Store app, path is `shell:AppsFolder\<AUMID>`
   * 'shell' — Windows shell folder (This PC, Recycle Bin, Control Panel,
   *           File Explorer, Settings, Network). path is `shell:<folder>`
   *           or `shell:AppsFolder\<AUMID>`. Launched via explorer.exe.
   */
  kind: 'exe' | 'uwp' | 'shell'
  iconDataUrl: string | null
  /**
   * True for system components — VC++ redistributables, .NET runtimes,
   * Windows SDKs, WebView2, Java runtimes, and similar packages that exist
   * for other apps to consume. The drawer auto-hides these on first run;
   * users can unhide via the manage-hidden modal.
   */
  system: boolean
}

const startMenuFolders = (): string[] => {
  const programData = process.env.ProgramData || 'C:\\ProgramData'
  return [
    path.join(programData, 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
    path.join(app.getPath('appData'), 'Microsoft', 'Windows', 'Start Menu', 'Programs'),
  ]
}

function findShortcutFiles(dir: string, acc: string[] = []): string[] {
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      const full = path.join(dir, e.name)
      if (e.isDirectory()) findShortcutFiles(full, acc)
      else if (e.isFile() && e.name.toLowerCase().endsWith('.lnk')) acc.push(full)
    }
  } catch { /* skip inaccessible */ }
  return acc
}

function looksLikeUninstaller(name: string): boolean {
  return /(uninstall|remove|updater|update\b|readme|read me|\bhelp\b)/i.test(name)
}

/**
 * True for system components that exist to support other apps — not for
 * users to launch. These auto-hide on first run. Every pattern here has
 * been chosen to avoid false positives on real user apps:
 *   - "Microsoft Visual Studio Code"   does NOT match (needs `c++`)
 *   - "Microsoft Visual Studio 2022"   does NOT match (needs `c++`)
 *   - "Microsoft Edge"                 does NOT match (needs WebView2)
 *   - "Microsoft Teams"                does NOT match
 *   - "Microsoft 365"                  does NOT match
 *   - "Magnifier", "Microsoft Outlook", "Notepad" — none match
 */
function isLikelySystemComponent(name: string): boolean {
  return (
    /microsoft visual c\+\+\s*\d{4}.*(redistributable|runtime)/i.test(name) ||
    /^microsoft \.net\b/i.test(name) ||
    /^microsoft asp\.net/i.test(name) ||
    /^microsoft windows (desktop )?runtime/i.test(name) ||
    /^microsoft windows sdk/i.test(name) ||
    /^microsoft windows desktop runtime/i.test(name) ||
    /^microsoft directx/i.test(name) ||
    /^microsoft xna/i.test(name) ||
    /^microsoft silverlight/i.test(name) ||
    /^microsoft edge webview2 runtime/i.test(name) ||
    /^java(se)?\s*(runtime|update)/i.test(name) ||
    /^oracle java/i.test(name) ||
    /\badditional runtime\b/i.test(name) ||
    /\bminimum runtime\b/i.test(name) ||
    /^windows sdk/i.test(name) ||
    /^microsoft update for/i.test(name) ||
    /^update for microsoft/i.test(name)
  )
}

/**
 * Windows shell folders the user expects to see in the drawer. These
 * aren't regular apps — they're shell namespaces launched via `explorer.exe
 * shell:<folder>`. We add them as virtual entries with kind: 'shell'.
 */
const VIRTUAL_SHELL_APPS: Array<{ name: string; uri: string }> = [
  { name: 'File Explorer', uri: 'shell:MyComputerFolder' },
  { name: 'This PC', uri: 'shell:MyComputerFolder' },
  { name: 'Recycle Bin', uri: 'shell:RecycleBinFolder' },
  { name: 'Control Panel', uri: 'shell:ControlPanelFolder' },
  { name: 'Settings', uri: 'shell:AppsFolder\\windows.immersivecontrolpanel_cw5n1h2txyewy!microsoft.windows.immersivecontrolpanel' },
  { name: 'Network', uri: 'shell:NetworkPlacesFolder' },
]

/**
 * Extract the real Windows shell folder icons via SHGetFileInfo (P/Invoke).
 * Shell folders have no `.exe`, so `app.getFileIcon` can't extract anything.
 * These are the exact icons Windows itself draws in the Start Menu and
 * taskbar. Cached for the process lifetime — they never change.
 *
 * Settings is deliberately not in the map — it's a UWP app, not a classic
 * CSIDL folder, and has no icon we can extract this way. The drawer keeps
 * its Material Symbols fallback for it.
 */
const shellFolderIconsCache = new Map<string, string | null>()
let shellFolderIconsLoaded = false

async function loadShellFolderIcons(): Promise<Map<string, string | null>> {
  if (shellFolderIconsLoaded) return shellFolderIconsCache

  const script = `
    Add-Type -AssemblyName System.Drawing
    $code = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

public class ShellIconExtractor {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct SHFILEINFO {
        public IntPtr hIcon;
        public int iIcon;
        public uint dwAttributes;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 260)]
        public string szDisplayName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 80)]
        public string szTypeName;
    }

    [DllImport("shell32.dll")]
    public static extern int SHGetFolderLocation(IntPtr hwndOwner, int nFolder, IntPtr hToken, uint dwReserved, out IntPtr ppidl);

    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    public static extern IntPtr SHGetFileInfo(IntPtr pidl, uint dwFileAttributes, ref SHFILEINFO psfi, uint cbFileInfo, uint uFlags);

    [DllImport("user32.dll")]
    public static extern bool DestroyIcon(IntPtr hIcon);

    public static string GetIconBase64(int csidl) {
        IntPtr pidl;
        int hr = SHGetFolderLocation(IntPtr.Zero, csidl, IntPtr.Zero, 0, out pidl);
        if (hr != 0 || pidl == IntPtr.Zero) return null;
        SHFILEINFO shfi = new SHFILEINFO();
        const uint SHGFI_ICON = 0x100;
        const uint SHGFI_PIDL = 0x008;
        IntPtr r = SHGetFileInfo(pidl, 0, ref shfi, (uint)Marshal.SizeOf(shfi), SHGFI_ICON | SHGFI_PIDL);
        if (r == IntPtr.Zero || shfi.hIcon == IntPtr.Zero) return null;
        try {
            using (Icon icon = Icon.FromHandle(shfi.hIcon)) {
                using (Bitmap srcBmp = icon.ToBitmap()) {
                    using (Bitmap bmp = new Bitmap(64, 64)) {
                        using (Graphics g = Graphics.FromImage(bmp)) {
                            g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic;
                            g.DrawImage(srcBmp, 0, 0, 64, 64);
                        }
                        using (MemoryStream ms = new MemoryStream()) {
                            bmp.Save(ms, ImageFormat.Png);
                            return Convert.ToBase64String(ms.ToArray());
                        }
                    }
                }
            }
        } finally {
            DestroyIcon(shfi.hIcon);
        }
    }
}
"@
    Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing
    $result = @{}
    $result['File Explorer'] = [ShellIconExtractor]::GetIconBase64(0x05)
    $result['This PC']       = [ShellIconExtractor]::GetIconBase64(0x11)
    $result['Recycle Bin']   = [ShellIconExtractor]::GetIconBase64(0x0a)
    $result['Control Panel'] = [ShellIconExtractor]::GetIconBase64(0x03)
    $result['Network']       = [ShellIconExtractor]::GetIconBase64(0x12)
    $result | ConvertTo-Json -Compress
  `
  const raw = await runPowerShellJson(script, 20000)
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      shellFolderIconsCache.set(k, typeof v === 'string' ? v : null)
    }
  }
  for (const vs of VIRTUAL_SHELL_APPS) {
    if (!shellFolderIconsCache.has(vs.name)) shellFolderIconsCache.set(vs.name, null)
  }
  const okCount = [...shellFolderIconsCache.values()].filter(Boolean).length
  console.log(`[app-drawer] shell folder icons: ${okCount}/${VIRTUAL_SHELL_APPS.length}`)
  shellFolderIconsLoaded = true
  return shellFolderIconsCache
}

/**
 * Extract UWP app icons via IShellItemImageFactory. UWP apps have no
 * `.exe` for `app.getFileIcon` to extract from — their icon lives behind
 * a shell namespace path (`shell:AppsFolder\<AUMID>`). This asks Windows
 * for the exact bitmap it draws in the Start Menu.
 *
 * Batched: one PowerShell process handles every AUMID and returns a JSON
 * map of AUMID → base64 PNG (or null on failure).
 */
const uwpIconCache = new Map<string, string | null>()

async function loadUwpIcons(aumids: string[]): Promise<Map<string, string | null>> {
  // Return cached entries; collect only the ones we haven't seen.
  const missing: string[] = []
  for (const id of aumids) {
    if (!uwpIconCache.has(id)) missing.push(id)
  }
  if (missing.length === 0) return uwpIconCache

  // AUMIDs are safe to pass in a -split string; escape single quotes just
  // in case (they don't appear in real AUMIDs, but defensive).
  const aumidList = missing.join('|').replace(/'/g, "''")

  const script = `
    Add-Type -AssemblyName System.Drawing
    $code = @"
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;

[StructLayout(LayoutKind.Sequential)]
public struct SIZE { public int cx; public int cy; }

[ComImport, Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IShellItemImageFactory {
    [PreserveSig]
    int GetImage(SIZE size, uint flags, out IntPtr phbm);
}

public class UwpIconExtractor {
    [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
    static extern void SHCreateItemFromParsingName(string pszPath, IntPtr pbc, ref Guid riid, [MarshalAs(UnmanagedType.Interface)] out object ppv);

    [DllImport("gdi32.dll")]
    static extern bool DeleteObject(IntPtr hObject);

    const uint SIIGBF_RESIZETOFIT   = 0x00;
    const uint SIIGBF_BIGGERSIZEOK  = 0x01;

    public static string GetIcon(string shellPath) {
        try {
            Guid iid = new Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b");
            object obj;
            SHCreateItemFromParsingName(shellPath, IntPtr.Zero, ref iid, out obj);
            IShellItemImageFactory factory = (IShellItemImageFactory)obj;
            SIZE size = new SIZE { cx = 64, cy = 64 };
            IntPtr hbmp;
            int hr = factory.GetImage(size, SIIGBF_RESIZETOFIT | SIIGBF_BIGGERSIZEOK, out hbmp);
            if (hr != 0 || hbmp == IntPtr.Zero) return null;
            try {
                using (Bitmap bmp = Image.FromHbitmap(hbmp)) {
                    using (MemoryStream ms = new MemoryStream()) {
                        bmp.Save(ms, ImageFormat.Png);
                        return Convert.ToBase64String(ms.ToArray());
                    }
                }
            } finally {
                DeleteObject(hbmp);
            }
        } catch {
            return null;
        }
    }
}
"@
    Add-Type -TypeDefinition $code -ReferencedAssemblies System.Drawing
    $aumids = '${aumidList}' -split '\\|'
    $result = @{}
    foreach ($aumid in $aumids) {
      if (-not $aumid) { continue }
      $result[$aumid] = [UwpIconExtractor]::GetIcon("shell:AppsFolder\\$aumid")
    }
    $result | ConvertTo-Json -Compress
  `

  const raw = await runPowerShellJson(script, 30000)
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      uwpIconCache.set(k, typeof v === 'string' ? v : null)
    }
  }
  for (const id of missing) {
    if (!uwpIconCache.has(id)) uwpIconCache.set(id, null)
  }
  const okCount = missing.filter((id) => uwpIconCache.get(id)).length
  console.log(`[app-drawer] UWP icons extracted: ${okCount}/${missing.length}`)
  return uwpIconCache
}

function iconCacheKeyFor(exePath: string): string {
  return crypto.createHash('md5').update(exePath.toLowerCase()).digest('hex').slice(0, 16)
}

async function getOrBuildIcon(exePath: string): Promise<string | null> {
  const cacheDir = path.join(app.getPath('userData'), 'app-icons')
  const cachePath = path.join(cacheDir, `${iconCacheKeyFor(exePath)}.png`)

  // Cache hit: PNG newer than exe
  try {
    const cacheStat = fs.statSync(cachePath)
    const exeStat = fs.statSync(exePath)
    if (cacheStat.mtimeMs >= exeStat.mtimeMs) {
      const buf = fs.readFileSync(cachePath)
      return `data:image/png;base64,${buf.toString('base64')}`
    }
  } catch { /* miss */ }

  // Cache miss: extract via Electron's file-icon API
  try {
    const img = await app.getFileIcon(exePath, { size: 'large' })
    if (img.isEmpty()) return null
    const resized = img.resize({ width: 64, height: 64, quality: 'good' })
    const png = resized.toPNG()
    fs.mkdirSync(cacheDir, { recursive: true })
    fs.writeFileSync(cachePath, png)
    return `data:image/png;base64,${png.toString('base64')}`
  } catch {
    return null
  }
}

/** Run a small PowerShell script and parse its JSON output. */
function runPowerShellJson(script: string, timeoutMs = 15000): Promise<unknown> {
  const encoded = Buffer.from(script, 'utf16le').toString('base64')
  return new Promise((resolve) => {
    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', encoded],
      { windowsHide: true, maxBuffer: 8 * 1024 * 1024, timeout: timeoutMs },
      (err, stdout) => {
        if (err || !stdout) { resolve(null); return }
        try {
          const trimmed = stdout.trim()
          if (!trimmed) { resolve(null); return }
          resolve(JSON.parse(trimmed))
        } catch { resolve(null) }
      }
    )
  })
}

/** Get the Windows Start menu app list (name + AppID). Includes UWP. */
async function runGetStartApps(): Promise<Array<{ Name: string; AppID: string }>> {
  const script = `
    $ErrorActionPreference = 'SilentlyContinue'
    Get-StartApps | Select-Object Name, AppID | ConvertTo-Json -Compress
  `
  const raw = await runPowerShellJson(script)
  if (!raw) return []
  const arr = Array.isArray(raw) ? raw : [raw]
  return arr.filter((item): item is { Name: string; AppID: string } =>
    item !== null &&
    typeof item === 'object' &&
    typeof (item as { Name?: unknown }).Name === 'string' &&
    typeof (item as { AppID?: unknown }).AppID === 'string'
  )
}

/** Cached App Paths lookup — populated lazily on first use. */
const appPathsCache = new Map<string, string>()
let appPathsLoaded = false

async function ensureAppPathsLoaded(): Promise<void> {
  if (appPathsLoaded) return
  const script = `
    $ErrorActionPreference = 'SilentlyContinue'
    $results = @{}
    $keys = @(
      'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths',
      'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths',
      'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths'
    )
    foreach ($key in $keys) {
      Get-ChildItem $key -ErrorAction SilentlyContinue | ForEach-Object {
        $exeName = $_.PSChildName
        $exePath = (Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue).'(default)'
        if ($exePath -and (Test-Path $exePath)) {
          $lower = $exeName.ToLower()
          if (-not $results.ContainsKey($lower)) {
            $results[$lower] = $exePath
          }
        }
      }
    }
    $results | ConvertTo-Json -Compress
  `
  const raw = await runPowerShellJson(script)
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw)) {
      if (typeof v === 'string') appPathsCache.set(k.toLowerCase(), v)
    }
  }
  appPathsLoaded = true
  console.log(`[app-drawer] loaded ${appPathsCache.size} App Paths entries`)
}

async function resolveAppPath(exeName: string): Promise<string | null> {
  await ensureAppPathsLoaded()
  return appPathsCache.get(exeName.toLowerCase()) || null
}

/**
 * Scan the Windows Uninstall registry (the same source Control Panel uses)
 * and return one entry per app whose `DisplayIcon` points at a real,
 * launchable .exe. This is the fix for VS Code User install — it registers
 * here but its Start Menu shortcut often resolves to an empty target via
 * shell.readShortcutLink.
 *
 * Filtering is strict: uninstallers, updaters, and entries with no valid
 * DisplayIcon are dropped. Redistributables (VC++ runtimes etc.) don't
 * have a launchable icon and are naturally excluded.
 */
interface UninstallRegistryEntry { Name: string; ExePath: string }

let uninstallRegistryCache: UninstallRegistryEntry[] | null = null

async function loadUninstallRegistry(): Promise<UninstallRegistryEntry[]> {
  if (uninstallRegistryCache) return uninstallRegistryCache
  const script = `
    $ErrorActionPreference = 'SilentlyContinue'
    $results = @()
    $keys = @(
      'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
      'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
      'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
    )
    foreach ($key in $keys) {
      Get-ChildItem $key -ErrorAction SilentlyContinue | ForEach-Object {
        $props = Get-ItemProperty $_.PSPath -ErrorAction SilentlyContinue
        if (-not $props) { return }
        $name = $props.DisplayName
        $icon = $props.DisplayIcon
        if (-not $name -or -not $icon) { return }
        # DisplayIcon is "path,index" or just "path" — strip trailing ,N and quotes
        $exePath = ($icon -replace ',\\d+$', '').Trim('"').Trim()
        if (-not $exePath) { return }
        if ($exePath -notmatch '\\.exe$') { return }
        if (-not (Test-Path $exePath)) { return }
        $base = [System.IO.Path]::GetFileNameWithoutExtension($exePath)
        if ($base -match '(?i)^unins|^uninstall|updater|^update') { return }
        $results += [PSCustomObject]@{ Name = $name; ExePath = $exePath }
      }
    }
    $results | ConvertTo-Json -Compress
  `
  const raw = await runPowerShellJson(script, 20000)
  const entries: UninstallRegistryEntry[] = []
  if (raw) {
    const arr = Array.isArray(raw) ? raw : [raw]
    for (const item of arr) {
      if (
        item !== null &&
        typeof item === 'object' &&
        typeof (item as { Name?: unknown }).Name === 'string' &&
        typeof (item as { ExePath?: unknown }).ExePath === 'string'
      ) {
        entries.push({ Name: (item as { Name: string }).Name, ExePath: (item as { ExePath: string }).ExePath })
      }
    }
  }
  uninstallRegistryCache = entries
  console.log(`[app-drawer] Uninstall registry: ${entries.length} launchable entries`)
  return entries
}

/** Find a .lnk file by basename within the Start Menu folders. */
function findShortcutByName(lnkName: string): string | null {
  const wanted = lnkName.toLowerCase()
  for (const dir of startMenuFolders()) {
    const lnks = findShortcutFiles(dir)
    const found = lnks.find((f) => path.basename(f).toLowerCase() === wanted)
    if (found) return found
  }
  return null
}

/** Resolve a Get-StartApps AppID to a launchable path + kind. */
async function resolveStartApp(appId: string): Promise<{ path: string; kind: 'exe' | 'uwp' } | null> {
  const id = appId.trim()
  if (!id) return null

  // UWP — AppID contains "!" (e.g. Microsoft.WindowsCalculator_8wekyb3d8bbwe!App)
  if (id.includes('!') && !id.includes('\\') && !id.includes('/')) {
    return { path: `shell:AppsFolder\\${id}`, kind: 'uwp' }
  }

  // Start Menu .lnk reference
  if (id.toLowerCase().endsWith('.lnk')) {
    const lnkPath = findShortcutByName(id)
    if (!lnkPath) return null
    try {
      const details = shell.readShortcutLink(lnkPath)
      let target = details.target || ''
      // Expand any %VAR% that wasn't resolved
      target = target.replace(/%([^%]+)%/g, (_, name) => process.env[name] || `%${name}%`)
      if (!target) return null
      if (!target.toLowerCase().endsWith('.exe')) return null
      if (!fs.existsSync(target)) return null
      return { path: target, kind: 'exe' }
    } catch { return null }
  }

  // App Paths reference — Get-StartApps returns these in three shapes:
  //   - Absolute path:          "D:\Protect\...\app.exe"
  //   - Bare exe name:          "Code.exe"
  //   - KNOWNFOLDERID-prefixed: "{GUID}\System32\cmd.exe"
  // Try in that order: on-disk check → App Paths cache → basename lookup
  // → manual KNOWNFOLDERID expansion.
  if (id.toLowerCase().endsWith('.exe')) {
    // Absolute path — check disk directly.
    if (/^[a-z]:\\/i.test(id) && fs.existsSync(id)) {
      return { path: id, kind: 'exe' }
    }

    const exact = await resolveAppPath(id)
    if (exact) return { path: exact, kind: 'exe' }

    const base = path.basename(id)
    if (base !== id) {
      const viaBase = await resolveAppPath(base)
      if (viaBase) return { path: viaBase, kind: 'exe' }
    }

    // Manual KNOWNFOLDERID expansion for the Windows folder GUIDs that
    // Get-StartApps emits. Expanding all KNOWNFOLDERIDs would need
    // SHGetKnownFolderPath; these five cover every case we've seen.
    //   {1AC14E77-...} = FOLDERID_System              → C:\Windows\System32
    //   {6D809377-...} = FOLDERID_ProgramFilesX64     → C:\Program Files
    //   {7C5A40EF-...} = FOLDERID_ProgramFilesX86     → C:\Program Files (x86)
    //   {905e63b6-...} = FOLDERID_ProgramFiles        → C:\Program Files
    //   {F38BF404-...} = FOLDERID_Windows             → C:\Windows
    const systemRoot = process.env.SystemRoot || 'C:\\Windows'
    const knownFolders: Record<string, string> = {
      '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}': path.join(systemRoot, 'System32'),
      '{6D809377-6AF0-444B-8957-A3773F02200E}': process.env.ProgramFiles || 'C:\\Program Files',
      '{7C5A40EF-A0FB-4BFC-874A-C0F2E0B9FA8E}': process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
      '{905e63b6-c1bf-494e-b29c-65b732d3d21a}': process.env.ProgramFiles || 'C:\\Program Files',
      '{F38BF404-1D43-42F2-9305-67DE0B28FC23}': systemRoot,
    }
    for (const [guid, folder] of Object.entries(knownFolders)) {
      if (id.startsWith(guid + '\\')) {
        const candidate = path.join(folder, id.slice(guid.length + 1))
        if (fs.existsSync(candidate)) return { path: candidate, kind: 'exe' }
      }
    }

    return null
  }

  return null
}

let installedAppsCache: InstalledApp[] | null = null
// Tracks an in-flight scan so a second caller (the drawer opening while
// the eager startup scan is still running) awaits the same promise
// instead of kicking off a duplicate scan.
let installedAppsInFlight: Promise<InstalledApp[]> | null = null

async function discoverInstalledApps(forceRefresh = false): Promise<InstalledApp[]> {
  if (installedAppsCache && !forceRefresh) return installedAppsCache
  if (installedAppsInFlight && !forceRefresh) return installedAppsInFlight
  installedAppsInFlight = runDiscovery()
  try {
    return await installedAppsInFlight
  } finally {
    installedAppsInFlight = null
  }
}

async function runDiscovery(): Promise<InstalledApp[]> {

  const results: InstalledApp[] = []
  const seenPaths = new Set<string>()

  // ── Source 1: Start Menu .lnk scan ──
  // Primary source. Proven on the test machine to find 46+ apps with icons.
  // Runs before Get-StartApps because Get-StartApps alone drops entries
  // whose AppID is a KNOWNFOLDERID path (see resolveStartApp).
  for (const folder of startMenuFolders()) {
    const lnks = findShortcutFiles(folder)
    for (const lnk of lnks) {
      const displayName = path.basename(lnk, '.lnk')
      if (looksLikeUninstaller(displayName)) continue

      let target = ''
      try {
        const details = shell.readShortcutLink(lnk)
        target = details.target || ''
      } catch { continue }

      // Expand %VAR% that shell.readShortcutLink left unresolved
      target = target.replace(/%([^%]+)%/g, (_, name) => process.env[name] || `%${name}%`)
      if (!target) continue
      if (!target.toLowerCase().endsWith('.exe')) continue
      if (!fs.existsSync(target)) continue

      const key = target.toLowerCase()
      if (seenPaths.has(key)) continue
      seenPaths.add(key)

      const iconDataUrl = await getOrBuildIcon(target)
      results.push({
        name: displayName,
        path: target,
        kind: 'exe',
        iconDataUrl,
        system: isLikelySystemComponent(displayName),
      })
    }
  }

  const fromStartMenu = results.length
  console.log(`[app-drawer] Start Menu scan: ${fromStartMenu} apps`)

  // ── Source 2: Get-StartApps ──
  // Supplementary — adds UWP apps and any Win32 apps whose Start Menu
  // shortcut the .lnk scan missed. Entries already in `seenPaths` are
  // skipped, so no duplicates.
  const startApps = await runGetStartApps()
  console.log(`[app-drawer] Get-StartApps returned ${startApps.length} entries`)

  const unresolvedAppIds: string[] = []
  for (const sa of startApps) {
    const name = (sa.Name || '').trim()
    const appId = (sa.AppID || '').trim()
    if (!name || !appId) continue
    if (looksLikeUninstaller(name)) continue

    const resolved = await resolveStartApp(appId)
    if (!resolved) {
      unresolvedAppIds.push(`${name} → ${appId}`)
      continue
    }

    const key = resolved.path.toLowerCase()
    if (seenPaths.has(key)) continue
    seenPaths.add(key)

    const iconDataUrl = resolved.kind === 'uwp' ? null : await getOrBuildIcon(resolved.path)
    results.push({
      name,
      path: resolved.path,
      kind: resolved.kind,
      iconDataUrl,
      system: isLikelySystemComponent(name),
    })
  }

  const fromStartApps = results.length - fromStartMenu

  // ── Source 3: Uninstall registry ──
  // Catches apps (like VS Code User) that are registered with Control
  // Panel but whose Start Menu shortcut doesn't resolve via
  // shell.readShortcutLink. The `system` flag then auto-hides
  // redistributables discovered here.
  const uninstallEntries = await loadUninstallRegistry()
  for (const entry of uninstallEntries) {
    const name = entry.Name.trim()
    if (looksLikeUninstaller(name)) continue

    const key = entry.ExePath.toLowerCase()
    if (seenPaths.has(key)) continue
    seenPaths.add(key)

    const iconDataUrl = await getOrBuildIcon(entry.ExePath)
    results.push({
      name,
      path: entry.ExePath,
      kind: 'exe',
      iconDataUrl,
      system: isLikelySystemComponent(name),
    })
  }

  // ── Source 3b: UWP icons ──
  // UWP apps got iconDataUrl: null above — extract real icons now, in one
  // batch. Runs after every other source so we know the full AUMID list.
  const uwpIds = results
    .filter((r) => r.kind === 'uwp')
    .map((r) => r.path.replace(/^shell:AppsFolder\\/i, ''))
  if (uwpIds.length > 0) {
    const uwpIcons = await loadUwpIcons(uwpIds)
    for (const r of results) {
      if (r.kind !== 'uwp') continue
      const aumid = r.path.replace(/^shell:AppsFolder\\/i, '')
      const base64 = uwpIcons.get(aumid)
      if (base64) r.iconDataUrl = `data:image/png;base64,${base64}`
    }
  }

  const fromUninstall = results.length - fromStartMenu - fromStartApps

  // ── Source 4: Virtual shell entries ──
  // Windows shell folders the user expects to see. Deduped by NAME, not
  // URI — "File Explorer" and "This PC" share the same `shell:MyComputerFolder`
  // URI but are distinct entries the user wants to see.
  const shellIcons = await loadShellFolderIcons()
  const beforeShell = results.length
  for (const vs of VIRTUAL_SHELL_APPS) {
    const key = `virtual:${vs.name.toLowerCase()}`
    if (seenPaths.has(key)) continue
    seenPaths.add(key)
    const base64 = shellIcons.get(vs.name)
    results.push({
      name: vs.name,
      path: vs.uri,
      kind: 'shell',
      iconDataUrl: base64 ? `data:image/png;base64,${base64}` : null,
      system: false,
    })
  }
  const fromShell = results.length - beforeShell

  // ── Dedup by name ──
  // Windows registers some apps (Settings, File Explorer, Control Panel)
  // in multiple sources under different paths — Start Menu shortcut,
  // Get-StartApps AUMID, virtual shell entry. The path-based dedup above
  // doesn't catch them. This pass keeps the first occurrence.
  // Order matters: Start Menu (real) beats Get-StartApps beats Uninstall
  // beats virtual, so the real entry always wins.
  const seenNames = new Set<string>()
  const deduped: InstalledApp[] = []
  for (const app of results) {
    const nameKey = app.name.trim().toLowerCase()
    if (seenNames.has(nameKey)) continue
    seenNames.add(nameKey)
    deduped.push(app)
  }

  const uwpCount = deduped.filter((r) => r.kind === 'uwp').length
  const systemCount = deduped.filter((r) => r.system).length
  const sorted = deduped.sort((a, b) => a.name.localeCompare(b.name))
  installedAppsCache = sorted

  console.log(
    `[app-drawer] discovered ${sorted.length} apps (${fromStartMenu} Start Menu, ${fromStartApps} Get-StartApps, ${fromUninstall} Uninstall reg, ${fromShell} shell, ${uwpCount} UWP, ${systemCount} system) [${results.length - deduped.length} dup names removed]`
  )
  if (unresolvedAppIds.length > 0) {
    console.log(`[app-drawer] ${unresolvedAppIds.length} Get-StartApps entries unresolved (first 10):`)
    unresolvedAppIds.slice(0, 10).forEach((s) => console.log(`  ${s}`))
  }
  return sorted
}

ipcMain.handle('list-installed-apps', async () => {
  // Cache-first, no-race. If the eager startup scan is still running,
  // await it — never kick off a second scan.
  try { return await discoverInstalledApps(false) }
  catch (err) { console.error('[app-drawer] list failed:', err); return [] }
})

ipcMain.handle('refresh-installed-apps', async () => {
  // Manual refresh forces a rescan even if a scan is already in flight.
  // Callers (the drawer's refresh button) want fresh data.
  try { return await discoverInstalledApps(true) }
  catch (err) { console.error('[app-drawer] refresh failed:', err); return [] }
})

// ──────────────────────────────────────────────
// TEST LAUNCH — used by the Test button on launch_app cards
// ──────────────────────────────────────────────
ipcMain.handle('test-launch-app', async (_event, target: unknown) => {
  if (typeof target !== 'string' || !target) return { ok: false, error: 'No path set' }

  // UWP apps
  if (target.startsWith('shell:AppsFolder\\')) {
    try {
      await shell.openExternal(target)
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  }

  // Shell folders (This PC, Recycle Bin, Control Panel, Network, etc.)
  // explorer.exe returns a non-zero exit code even on success, so we
  // fire-and-forget: spawn succeeding is the only signal we can trust.
  if (target.startsWith('shell:')) {
    const child = execFile('explorer.exe', [target])
    child.on('error', () => { /* explorer.exe is always present on Windows */ })
    return { ok: true }
  }

  // Regular exe
  try {
    const stat = fs.statSync(target)
    if (stat.isDirectory()) return { ok: false, error: 'Path is a directory, not an executable' }
    const ext = path.extname(target).toLowerCase()
    if (ext !== '.exe') return { ok: false, error: 'Only .exe files are supported' }
    const err = await shell.openPath(target)
    if (err) return { ok: false, error: err }
    return { ok: true }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  }
})

// ──────────────────────────────────────────────
// SHORTCUT EXECUTION ENGINE
// ──────────────────────────────────────────────

const ActionSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.string().min(1).max(50),
  title: z.string().max(200).optional(),
  value: z.string().max(8192),
  safetyOverride: z.enum(['dangerous', 'safe']).optional(),
}).passthrough()

// Shortcut-level Window Layout config (see src/types/actions.ts).
// Enabled shortcuts pass this through the runShortcut payload; the runtime
// engine fires arrangeWindows after the action loop completes.
const WindowLayoutConfigSchema = z.object({
  enabled: z.boolean(),
  layoutId: z.enum([
    'split_50',
    'split_67_33',
    'split_33_67',
    'thirds',
    'main_left',
    'main_right',
    'quad',
  ]).nullable(),
  assignments: z.record(z.string(), z.string()),
}).optional()

const ShortcutSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  hotkey: z.string().max(100).optional(),
  actions: z.array(ActionSchema).max(50),
  windowLayout: WindowLayoutConfigSchema,
  secured: z.boolean().optional(),
}).passthrough()

type ShortcutActionData = z.infer<typeof ActionSchema>
type ShortcutData = z.infer<typeof ShortcutSchema>

interface ActionResult {
  actionId: string
  success: boolean
  error?: string
}

// Layout zone definitions — mirrors src/types/actions.ts LAYOUTS.
// Kept in sync manually because the renderer and main process are
// separate bundles with no shared runtime import.
type LayoutId =
  | 'split_50' | 'split_67_33' | 'split_33_67'
  | 'thirds' | 'main_left' | 'main_right' | 'quad'

interface LayoutZone { id: string; label: string; x: number; y: number; w: number; h: number }

const LAYOUT_ZONES: Record<LayoutId, LayoutZone[]> = {
  split_50: [
    { id: 'left', label: 'Left', x: 0, y: 0, w: 0.5, h: 1 },
    { id: 'right', label: 'Right', x: 0.5, y: 0, w: 0.5, h: 1 },
  ],
  split_67_33: [
    { id: 'main_left', label: 'Main Left', x: 0, y: 0, w: 0.67, h: 1 },
    { id: 'right', label: 'Right', x: 0.67, y: 0, w: 0.33, h: 1 },
  ],
  split_33_67: [
    { id: 'left', label: 'Left', x: 0, y: 0, w: 0.33, h: 1 },
    { id: 'main_right', label: 'Main Right', x: 0.33, y: 0, w: 0.67, h: 1 },
  ],
  thirds: [
    { id: 'left', label: 'Left', x: 0, y: 0, w: 0.333, h: 1 },
    { id: 'center', label: 'Center', x: 0.333, y: 0, w: 0.334, h: 1 },
    { id: 'right', label: 'Right', x: 0.667, y: 0, w: 0.333, h: 1 },
  ],
  main_left: [
    { id: 'main_left', label: 'Main Left', x: 0, y: 0, w: 0.5, h: 1 },
    { id: 'top_right', label: 'Top Right', x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { id: 'bottom_right', label: 'Bottom Right', x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ],
  main_right: [
    { id: 'top_left', label: 'Top Left', x: 0, y: 0, w: 0.5, h: 0.5 },
    { id: 'bottom_left', label: 'Bottom Left', x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { id: 'main_right', label: 'Main Right', x: 0.5, y: 0, w: 0.5, h: 1 },
  ],
  quad: [
    { id: 'tl', label: 'Top Left', x: 0, y: 0, w: 0.5, h: 0.5 },
    { id: 'tr', label: 'Top Right', x: 0.5, y: 0, w: 0.5, h: 0.5 },
    { id: 'bl', label: 'Bottom Left', x: 0, y: 0.5, w: 0.5, h: 0.5 },
    { id: 'br', label: 'Bottom Right', x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ],
}

// Actions that produce a visible window the layout engine can place.
const ARRANGEABLE_TYPES = new Set([
  'launch_app', 'open_folder', 'open_file', 'open_url',
])

/**
 * Estimate how long a shortcut's actions will take to run, in ms.
 * Used to size the layout engine's polling window so shortcuts with
 * `delay` actions don't time out before their final app launches.
 * Base 5s + per-action estimates, capped at 60s.
 */
function estimateShortcutBudgetMs(shortcut: ShortcutData): number {
  let total = 5000
  for (const action of shortcut.actions) {
    switch (action.type) {
      case 'delay':
        total += Number(action.value) || 0
        break
      case 'launch_app':
      case 'open_folder':
      case 'open_file':
        total += 1500
        break
      case 'open_url':
        // Browsers (especially Firefox) can take several seconds to open a
        // window AND load the page. The title only becomes useful for
        // matching after the page starts loading, so give URLs more room.
        total += 5000
        break
      case 'run_script':
        total += 3000
        break
      default:
        total += 200
    }
  }
  return Math.min(total, 60000)
}

/**
 * Translate the shortcut's windowLayout config into a list of Placements
 * for arrangeWindows(). Returns [] if the layout is disabled, has no
 * layoutId, or has no eligible assignments.
 */
function buildPlacementsFromShortcut(shortcut: ShortcutData): Placement[] {
  const wl = shortcut.windowLayout
  if (!wl?.enabled || !wl.layoutId) return []

  const zones = LAYOUT_ZONES[wl.layoutId as LayoutId]
  if (!zones) return []

  const assignedActionIds = new Set(Object.values(wl.assignments))
  const placements: Placement[] = []

  // 1. Assigned placements — placed into their zone.
  for (const [zoneId, actionId] of Object.entries(wl.assignments)) {
    const zone = zones.find((z) => z.id === zoneId)
    if (!zone) continue
    const action = shortcut.actions.find((a) => a.id === actionId)
    if (!action) continue
    if (!ARRANGEABLE_TYPES.has(action.type)) continue
    placements.push({
      zoneId: zone.id,
      zoneLabel: zone.label,
      zone: { x: zone.x, y: zone.y, w: zone.w, h: zone.h },
      actionType: action.type,
      actionValue: action.value,
      actionTitle: action.title || action.type,
      isUnassigned: false,
    })
  }

  // 2. Unassigned placements — every arrangeable action the user did NOT
  //    assign. The engine brings these windows to front without resizing
  //    (centering only if they land fully off-screen). This is what makes
  //    an unassigned Calculator visible on top of an arranged Notepad,
  //    instead of hidden behind it.
  for (const action of shortcut.actions) {
    if (!ARRANGEABLE_TYPES.has(action.type)) continue
    if (assignedActionIds.has(action.id)) continue
    placements.push({
      zoneId: 'unassigned',
      zoneLabel: 'Not arranged',
      zone: { x: 0, y: 0, w: 0, h: 0 },
      actionType: action.type,
      actionValue: action.value,
      actionTitle: action.title || action.type,
      isUnassigned: true,
    })
  }

  return placements
}

const runningShortcuts = new Set<string>()
// Simple cancellation request set — when a shortcut's id is present,
// the execution loop will stop at the next step boundary (graceful cancel).
const cancelRequests = new Set<string>()
// Per-shortcut AbortControllers for the window-layout engine. When the
// user cancels a running shortcut (or a Test Layout run), we call
// .abort() here — this kills the child PowerShell process that's polling
// for windows, so the cancellation takes effect immediately instead of
// waiting for the poll deadline (up to 60s).
const layoutAbortControllers = new Map<string, AbortController>()
// Carries the window-layout results from the layout call to the
// shortcut-complete event so the renderer can surface them on the card.
let lastLayoutResults: PlacementResult[] | null = null

// ── Settle times (ms) ──
// Historically 800ms for launch_app so the progress UI matched the
// window actually appearing. Batch 2c-polish: we no longer need it —
// the window-layout engine polls for the actual window and snaps it
// the moment it appears. Kept as an empty object for future settle needs.
const SETTLE_TIME: Record<string, number> = {}

function isShortcutRunning(shortcutId: string): boolean {
  return runningShortcuts.has(shortcutId)
}

async function runAction(action: ShortcutActionData): Promise<void> {
  switch (action.type) {
    case 'launch_app': {
      // UWP apps (Calculator, Photos, Settings) launch via shell:AppsFolder,
      // not via a file path.
      if (action.value.startsWith('shell:AppsFolder\\')) {
        try {
          await shell.openExternal(action.value)
        } catch (err) {
          throw new Error(err instanceof Error ? err.message : 'Failed to launch UWP app')
        }
        return
      }

      // Shell folders (This PC, Recycle Bin, Control Panel, Network, etc.)
      // launch via explorer.exe with the shell: URI as its argument.
      // explorer.exe returns a non-zero exit code even on success, so we
      // fire-and-forget: spawn succeeding is the only signal we can trust.
      if (action.value.startsWith('shell:')) {
        const child = execFile('explorer.exe', [action.value])
        child.on('error', () => { /* explorer.exe is always present on Windows */ })
        return
      }

      let stat
      try { stat = fs.statSync(action.value) } catch { throw new Error('Path does not exist or is inaccessible') }
      if (stat.isDirectory()) {
        throw new Error('Path is a directory, not a Windows executable')
      }
      const ext = path.extname(action.value).toLowerCase()
      if (ext !== '.exe') {
        throw new Error('Only .exe files are supported for Launch App')
      }

      const err = await shell.openPath(action.value)
      if (err) throw new Error(err)
      // No settle wait — the window-layout engine polls for the actual
      // window and snaps it the moment it appears. Waiting here just
      // delayed the arrangement.
      const settle = SETTLE_TIME.launch_app
      if (settle) await new Promise((r) => setTimeout(r, settle))
      return
    }
    case 'open_folder':
    case 'open_file': {
      try { fs.statSync(action.value) } catch { throw new Error('Path does not exist or is inaccessible') }
      const err = await shell.openPath(action.value)
      if (err) throw new Error(err)
      return
    }
    case 'open_url': {
      if (!isValidUrlFormat(action.value)) {
        throw new Error('Invalid URL — must be a full web address')
      }
      // Race shell.openExternal against a timeout. Firefox (and occasionally
      // Explorer / a hung default browser) can leave the ShellExecute
      // promise unresolved indefinitely — which locks the action loop and
      // leaves the shortcut stuck in "running" state. 3s is more than
      // enough for a healthy OS handoff; if it hasn't acknowledged by then,
      // we move on and let the layout engine catch the window on its own poll.
      const openPromise = shell.openExternal(action.value)
      const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 3000))
      await Promise.race([openPromise, timeoutPromise])
      return
    }
    case 'set_volume': {
      const volume = Number(action.value)
      if (!Number.isInteger(volume) || volume < 0 || volume > 100) {
        throw new Error('Volume must be an integer between 0 and 100')
      }
      const scalar = (volume / 100).toFixed(4)
      const script = `
      Add-Type -TypeDefinition @'
      using System;
      using System.Runtime.InteropServices;

      [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
      interface IAudioEndpointVolume {
          int f(); int g(); int h(); int i();
          int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);
          int j();
          int GetMasterVolumeLevelScalar(out float pfLevel);
          int k(); int l(); int m(); int n();
          int SetMute([MarshalAs(UnmanagedType.Bool)] bool bMute, System.Guid pguidEventContext);
          int GetMute(out bool pbMute);
      }

      [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
      interface IMMDevice {
          int Activate(ref System.Guid id, int clsCtx, int activationParams, out IAudioEndpointVolume aev);
      }

      [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
      interface IMMDeviceEnumerator {
          int f();
          int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
      }

      [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
      class MMDeviceEnumeratorComObject { }

      public class AudioController {
          public static void SetVolume(double level) {
              var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
              IMMDevice dev = null;
              Marshal.ThrowExceptionForHR(enumerator.GetDefaultAudioEndpoint(0, 1, out dev));
              IAudioEndpointVolume epv = null;
              var epvid = typeof(IAudioEndpointVolume).GUID;
              Marshal.ThrowExceptionForHR(dev.Activate(ref epvid, 23, 0, out epv));
              float fLevel = (float)Math.Max(0.0, Math.Min(1.0, level));
              Marshal.ThrowExceptionForHR(epv.SetMasterVolumeLevelScalar(fLevel, Guid.Empty));
              if (fLevel > 0.0f) {
                  epv.SetMute(false, Guid.Empty);
              }
          }
      }
      '@ -ErrorAction SilentlyContinue

      [AudioController]::SetVolume(${scalar})
      `
      const encoded = Buffer.from(script, 'utf16le').toString('base64')
      await execAsync(`powershell.exe -NoProfile -NonInteractive -EncodedCommand ${encoded}`, { windowsHide: true })
      return
    }
    case 'set_brightness': {
      const brightness = Number(action.value)
      if (!Number.isInteger(brightness) || brightness < 0 || brightness > 100) {
        throw new Error('Brightness must be an integer between 0 and 100')
      }
      const script = `
      $target = [Math]::Max(0, [Math]::Min(100, ${brightness}))
      $success = $false

      try {
          $wmi = Get-WmiObject -Namespace root/wmi -Class WmiMonitorBrightnessMethods -ErrorAction Stop
          if ($wmi) {
              $wmi.WmiSetBrightness(0, $target)
              $success = $true
          }
      } catch { }

      if (-not $success) {
          try {
              $cim = Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorBrightnessMethods -ErrorAction Stop
              if ($cim) {
                  Invoke-CimMethod -InputObject $cim -MethodName WmiSetBrightness -Arguments @{ Brightness = [uint32]$target; Timeout = 0 } -ErrorAction Stop | Out-Null
                  $success = $true
              }
          } catch { }
      }

      if (-not $success) {
          try {
              $code = @'
              using System;
              using System.Runtime.InteropServices;
              public class DdcMonitorHelper {
                  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
                  public struct PHYSICAL_MONITOR {
                      public IntPtr hPhysicalMonitor;
                      [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 128)]
                      public string szPhysicalMonitorDescription;
                  }
                  public struct RECT { public int left, top, right, bottom; }
                  [DllImport("user32.dll")] public static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr lprcClip, MonitorEnumDelegate lpfnEnum, IntPtr dwData);
                  public delegate bool MonitorEnumDelegate(IntPtr hMonitor, IntPtr hdcMonitor, ref RECT lprcMonitor, IntPtr dwData);
                  [DllImport("dxva2.dll", SetLastError = true)] public static extern bool GetNumberOfPhysicalMonitorsFromHMONITOR(IntPtr hMonitor, out uint count);
                  [DllImport("dxva2.dll", SetLastError = true)] public static extern bool GetPhysicalMonitorsFromHMONITOR(IntPtr hMonitor, uint size, [Out] PHYSICAL_MONITOR[] monitors);
                  [DllImport("dxva2.dll", SetLastError = true)] public static extern bool SetPhysicalMonitorBrightness(IntPtr hMonitor, uint brightness);
                  [DllImport("dxva2.dll", SetLastError = true)] public static extern bool DestroyPhysicalMonitors(uint size, PHYSICAL_MONITOR[] monitors);

                  public static bool SetAll(uint brightness) {
                      bool any = false;
                      EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, delegate(IntPtr hMon, IntPtr hdc, ref RECT rc, IntPtr data) {
                          uint count = 0;
                          if (GetNumberOfPhysicalMonitorsFromHMONITOR(hMon, out count) && count > 0) {
                              var pms = new PHYSICAL_MONITOR[count];
                              if (GetPhysicalMonitorsFromHMONITOR(hMon, count, pms)) {
                                  foreach (var pm in pms) {
                                      if (SetPhysicalMonitorBrightness(pm.hPhysicalMonitor, brightness)) { any = true; }
                                  }
                                  DestroyPhysicalMonitors(count, pms);
                              }
                          }
                          return true;
                      }, IntPtr.Zero);
                      return any;
                  }
              }
'@
              Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
              $success = [DdcMonitorHelper]::SetAll([uint32]$target)
          } catch { }
      }

      if (-not $success) {
          Write-Warning "Brightness could not be adjusted (display does not support WMI or DDC/CI commands)."
      }
      `
      const encoded = Buffer.from(script, 'utf16le').toString('base64')
      await execAsync(`powershell.exe -NoProfile -NonInteractive -EncodedCommand ${encoded}`, { windowsHide: true })
      return
    }
    case 'toggle_dnd': {
      const mode = action.value || 'toggle'
      const script = `
      $path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Notifications\\Settings"
      if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
      $current = (Get-ItemProperty -Path $path -Name "NOC_GLOBAL_SETTING_ALLOW_TOASTS" -ErrorAction SilentlyContinue).NOC_GLOBAL_SETTING_ALLOW_TOASTS
      if ($null -eq $current) { $current = 1 }
      
      $target = 1
      if ("${mode}" -eq "enable") {
          $target = 0
      } elseif ("${mode}" -eq "disable") {
          $target = 1
      } else {
          if ($current -eq 0) { $target = 1 } else { $target = 0 }
      }
      Set-ItemProperty -Path $path -Name "NOC_GLOBAL_SETTING_ALLOW_TOASTS" -Value $target -Type DWord
      `
      const encoded = Buffer.from(script, 'utf16le').toString('base64')
      await execAsync(`powershell.exe -NoProfile -NonInteractive -EncodedCommand ${encoded}`, { windowsHide: true })
      return
    }
    case 'toggle_nightlight': {
      const mode = action.value || 'toggle'
      const script = `
      $path = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\CloudStore\\Store\\DefaultAccount\\Current\\default\`$windows.data.bluelightreduction.bluelightreductionstate\\windows.data.bluelightreduction.bluelightreductionstate"
      if (Test-Path $path) {
          $data = (Get-ItemProperty -Path $path -Name "Data" -ErrorAction SilentlyContinue).Data
          if ($data -and $data.Length -ge 19) {
              $isOn = $data[18] -eq 0x15
              $turnOn = if ("${mode}" -eq "enable") { $true } elseif ("${mode}" -eq "disable") { $false } else { -not $isOn }
              if ($turnOn -ne $isOn) {
                  if ($turnOn) {
                      $data[18] = 0x15
                  } else {
                      $data[18] = 0x13
                  }
                  Set-ItemProperty -Path $path -Name "Data" -Value $data
              }
          }
      }
      `
      const encoded = Buffer.from(script, 'utf16le').toString('base64')
      await execAsync(`powershell.exe -NoProfile -NonInteractive -EncodedCommand ${encoded}`, { windowsHide: true })
      return
    }

    case 'run_script': {
      const controller = new AbortController()
      const { signal } = controller
      const timeoutId = setTimeout(() => { controller.abort() }, 120000)

      try {
        const child = exec(action.value, { windowsHide: true })

        signal.addEventListener('abort', () => {
          if (child.pid) {
            exec(`taskkill /pid ${child.pid} /t /f`, { windowsHide: true })
          }
        })

        await new Promise<void>((resolve, reject) => {
          child.on('exit', (code) => {
            if (code === 0) resolve()
            else reject(new Error(`Command exited with code ${code}`))
          })
          child.on('error', reject)
        })
      } catch (e) {
        if (signal.aborted) throw new Error('Script execution timed out (120s) and was terminated.')
        throw e
      } finally {
        clearTimeout(timeoutId)
      }
      return
    }
    case 'delay': {
      const ms = Number(action.value)
      if (isNaN(ms) || ms < 50 || ms > 60000) {
        throw new Error('Delay must be between 50 and 60000 milliseconds')
      }
      await new Promise<void>((resolve) => setTimeout(resolve, ms))
      return
    }
    default:
      throw new Error(`Unknown action type: ${action.type}`)
  }
}

async function runShortcutActions(shortcut: ShortcutData): Promise<ActionResult[]> {
  const startTime = Date.now()
  const results: ActionResult[] = []
  let cancelled: 'graceful' | null = null
  let lastActionTitle: string | null = null

  if (runningShortcuts.has(shortcut.id)) {
    return [{ actionId: 'system', success: false, error: 'Shortcut is already running.' }]
  }
  runningShortcuts.add(shortcut.id)
  cancelRequests.delete(shortcut.id)
  // Any pending "awaiting double-press" entry for this shortcut is now
  // stale — the shortcut is running via some path (double-press, Library
  // Run, etc.), so the toast-click guard should reject it.
  securedPendingFires.delete(shortcut.id)

  // Take the pre-snapshot BEFORE any action fires. This is the only way
  // to correctly classify shortcut-opened windows as "new" — the layout
  // engine's own PowerShell startup is ~400ms behind the actions, so a
  // snapshot taken inside the script misses fast-appearing browser windows.
  // Only pays the ~300-500ms latency cost when layout is actually enabled.
  let preExistingHandles: Set<string> | undefined
  if (shortcut.windowLayout?.enabled) {
    preExistingHandles = await snapshotHandles()
    console.log(`[runShortcut] pre-snapshot (Node side): ${preExistingHandles.size} existing windows`)
  }

  // Fire the arrangement engine in parallel with the action loop.
  // It polls for windows as they appear, snapping each the moment it's
  // found — instead of waiting for the loop to finish and snapping in a batch.
  // Errors are caught here so a layout failure never fails the shortcut.
  let layoutPromise: Promise<PlacementResult[]> | null = null
  const layoutAbort = new AbortController()
  layoutAbortControllers.set(shortcut.id, layoutAbort)
  if (shortcut.windowLayout?.enabled) {
    const placements = buildPlacementsFromShortcut(shortcut)
    if (placements.length > 0) {
      const budgetMs = estimateShortcutBudgetMs(shortcut)
      console.log(`[runShortcut] layout budget: ${budgetMs}ms for ${placements.length} placements`)
      layoutPromise = arrangeWindows(placements, budgetMs, preExistingHandles, layoutAbort.signal).catch((err) => {
        if (!layoutAbort.signal.aborted) {
          console.error('[runShortcut] window layout failed:', err)
        }
        return [] as PlacementResult[]
      })
    }
  }

  try {
    for (let i = 0; i < shortcut.actions.length; i++) {
      // Between-action cancellation check — graceful path
      if (cancelRequests.has(shortcut.id)) {
        cancelled = 'graceful'
        break
      }

      win?.webContents.send('shortcut-progress', { shortcutId: shortcut.id, stepIndex: i })
      const action = shortcut.actions[i]
      lastActionTitle = action.title ?? null

      try {
        await runAction(action)
        results.push({ actionId: action.id, success: true })
      } catch (e) {
        const rawMsg = e instanceof Error ? e.message : String(e)
        // Include the action's title and (for path-based actions) the
        // target path so both the toast and the shortcut card can tell
        // the user exactly what failed.
        const label = action.title || action.type
        const detail = (action.type === 'launch_app' || action.type === 'open_file' || action.type === 'open_folder')
          ? `${label}: ${action.value}`
          : label
        results.push({ actionId: action.id, success: false, error: `${detail} — ${rawMsg}` })
      }
    }
  } catch (err) {
    // Defensive — the loop shouldn't throw, but if it does we still want
    // the cleanup below to run.
    console.error('[runShortcut] action loop threw:', err)
  }

  // Wait for the arrangement engine (already running in parallel).
  // If cancelled, abort the layout poll instead of awaiting the deadline.
  lastLayoutResults = null
  if (layoutPromise) {
    if (cancelled) {
      layoutAbort.abort()
      layoutPromise.then((r) =>
        console.log('[runShortcut] layout (post-cancel):', JSON.stringify(r, null, 2))
      )
    } else {
      lastLayoutResults = await layoutPromise
      console.log(
        '[runShortcut] window layout results:',
        JSON.stringify(lastLayoutResults, null, 2)
      )
    }
  }

  // NOW safe to clean up. runningShortcuts must stay populated during the
  // layout wait so that a cancel request arriving mid-wait is accepted by
  // the cancel-shortcut IPC handler (which checks runningShortcuts.has).
  runningShortcuts.delete(shortcut.id)
  cancelRequests.delete(shortcut.id)
  layoutAbortControllers.delete(shortcut.id)

  const durationMs = Date.now() - startTime
  win?.webContents.send('shortcut-complete', {
    shortcutId: shortcut.id,
    results,
    durationMs,
    cancelled,
    lastActionTitle,
    layoutResults: lastLayoutResults,
  })

  // Dispatch native Windows notification if enabled.
  // Test runs (synthetic ids `test-layout-*` / `test-flow-*`) are previews
  // launched from inside the Builder — the user is already looking at the
  // app, so an OS toast is noise. Suppress for test ids.
  const isTestRun = shortcut.id.startsWith('test-')
  const failed = results.filter((r) => !r.success)
  const allSucceeded = failed.length === 0 && !cancelled
  if (executionNotifications && !isTestRun && Notification.isSupported()) {
    try {
      let body: string
      if (cancelled) {
        body = `Cancelled after: ${lastActionTitle || 'unknown step'}`
      } else if (allSucceeded) {
        body = `All ${shortcut.actions.length} action(s) completed in ${(durationMs / 1000).toFixed(1)}s.`
      } else {
        const failedList = failed.map((f) => f.error).filter(Boolean).join('\n')
        body = `${failed.length} of ${results.length} step${results.length !== 1 ? 's' : ''} failed:\n${failedList}`
      }

      // Append the window layout result when applicable — this is the
      // only feedback the user sees if the apps cover the LazyCow window.
      if (lastLayoutResults && lastLayoutResults.length > 0) {
        const placed = lastLayoutResults.filter((r) => r.status === 'placed').length
        const total = lastLayoutResults.length
        const notPlaced = lastLayoutResults.filter((r) => r.status !== 'placed')
        let layoutLine = `Window layout: ${placed} of ${total} app${total !== 1 ? 's' : ''} placed.`
        if (notPlaced.length > 0) {
          const names = notPlaced.map((r) => r.actionTitle).filter(Boolean).join(', ')
          layoutLine += ` Couldn't arrange: ${names}.`
        }
        body += `\n${layoutLine}`
      }

      const notif = new Notification({
        title: cancelled
          ? `LazyCow: ${shortcut.name} (Cancelled)`
          : allSucceeded
            ? `LazyCow: ${shortcut.name}`
            : `LazyCow: ${shortcut.name} (Failed)`,
        body,
        icon: getAppIconPath(),
        silent: false,
      })
      notif.show()
    } catch (err) {
      console.warn('Failed to display OS notification:', err)
    }
  }

  return results
}

ipcMain.handle('execute-shortcut', async (_event, rawShortcut: unknown) => {
  try {
    const shortcut = ShortcutSchema.parse(rawShortcut)
    return runShortcutActions(shortcut)
  } catch (err: unknown) {
    const error = err as Error
    return [{ actionId: 'system', success: false, error: error.message || 'Invalid shortcut data' }]
  }
})

// Cancel a running shortcut. Cancellation is always graceful: the currently
// running action finishes normally, then the remaining steps are skipped.
ipcMain.handle('cancel-shortcut', async (_event, payload: { shortcutId: string; mode?: 'graceful' | 'immediate' }) => {
  const { shortcutId } = payload
  if (!isShortcutRunning(shortcutId)) {
    return { ok: false, error: 'Shortcut is not running.' }
  }
  cancelRequests.add(shortcutId)
  // Abort the layout engine immediately so its child PowerShell process is
  // killed instead of polling until the deadline. The action loop will see
  // cancelRequests on its next iteration and break gracefully.
  const layoutAbort = layoutAbortControllers.get(shortcutId)
  if (layoutAbort) layoutAbort.abort()
  return { ok: true }
})

ipcMain.handle('check-path-exists', async (_event, targetPath: string) => {
  try {
    fs.statSync(targetPath)
    return true
  } catch {
    return false
  }
})

ipcMain.handle('select-path', async (_event, type: 'app' | 'file' | 'folder') => {
  if (!win) return null
  let properties: ('openFile' | 'openDirectory')[] = ['openFile']
  let filters: { name: string; extensions: string[] }[] = []

  if (type === 'app') {
    properties = ['openFile']
    filters = [
      { name: 'Windows Applications (*.exe)', extensions: ['exe'] }
    ]
  } else if (type === 'folder') {
    properties = ['openDirectory']
  } else {
    properties = ['openFile']
    filters = [{ name: 'All Files (*.*)', extensions: ['*'] }]
  }

  const res = await dialog.showOpenDialog(win, {
    title: type === 'app' ? 'Select Application Executable' : type === 'folder' ? 'Select Folder' : 'Select File',
    properties,
    filters: filters.length ? filters : undefined,
  })

  if (!res.canceled && res.filePaths.length > 0) {
    return res.filePaths[0]
  }
  return null
})

// ──────────────────────────────────────────────
// SHORTCUT PERSISTENCE (disk mirror)
// ──────────────────────────────────────────────
// Chromium's localStorage writes are async and can be lost on a hard kill
// (Ctrl+C in dev mode hard-kills Electron via vite-plugin-electron). This
// caused a real data-loss incident on 2026-10-15. The renderer mirrors
// every shortcut write to a disk file synchronously via IPC; on startup,
// if localStorage is empty but the file has data, we restore from it.
const shortcutsFilePath = () => path.join(app.getPath('userData'), 'shortcuts.json')

ipcMain.handle('read-shortcuts-from-disk', () => {
  try {
    const raw = fs.readFileSync(shortcutsFilePath(), 'utf8')
    const parsed = JSON.parse(raw)
    return { ok: true, data: Array.isArray(parsed) ? parsed : [] }
  } catch {
    return { ok: true, data: [] }
  }
})

ipcMain.handle('write-shortcuts-to-disk', (_event, list: unknown) => {
  try {
    if (!Array.isArray(list)) return { ok: false }
    fs.writeFileSync(shortcutsFilePath(), JSON.stringify(list, null, 2), 'utf8')
    return { ok: true }
  } catch (err) {
    console.warn('[shortcuts-persistence] write failed:', err)
    return { ok: false }
  }
})

// ──────────────────────────────────────────────
// GLOBAL HOTKEYS
// ──────────────────────────────────────────────
const hotkeyToShortcutId = new Map<string, string>()
const shortcutById = new Map<string, ShortcutData>()

const SPECIAL_KEY_MAP: Record<string, string> = {
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  ' ': 'Space', Escape: 'Esc', Delete: 'Delete', Backspace: 'Backspace',
  Enter: 'Return', Tab: 'Tab', PrintScreen: 'PrintScreen',
}

function comboToAccelerator(combo: string): string | null {
  const parts = combo.split('+').map((p) => p.trim()).filter(Boolean)
  const accelParts: string[] = []
  let mainKey: string | null = null

  for (const part of parts) {
    if (part === 'Ctrl') accelParts.push('CommandOrControl')
    else if (part === 'Alt') accelParts.push('Alt')
    else if (part === 'Shift') accelParts.push('Shift')
    else if (part === 'Win') accelParts.push('Super')
    // First non-modifier wins. Windows RegisterHotKey only accepts one
    // main key anyway — if a legacy combo has two (e.g. "Ctrl + G + F"),
    // we want to register the same key the picker is showing (which is
    // also the first one), so both surfaces agree.
    else if (mainKey === null) mainKey = SPECIAL_KEY_MAP[part] ?? part
  }

  if (!mainKey) return null
  accelParts.push(mainKey)
  return accelParts.join('+')
}

// (Previously `cachedShowDangerWarnings` — removed. The per-shortcut
// `secured` flag is now the sole gate for whether a hotkey fires a
// confirmation round-trip. The renderer still sends `showDangerWarnings`
// in the sync payload for backward compatibility, but the main process
// no longer reads it.)

/**
 * Timestamps of recently-fired secured hotkeys awaiting a second press.
 * When a secured shortcut's hotkey fires and the window isn't focused, we
 * show a toast and record the time. If the same hotkey fires again within
 * `securedDoublePressWindowMs`, the shortcut runs directly.
 */
const securedPendingFires = new Map<string, number>()

/**
 * Read the user's double-press window from settings. Falls back to 5s.
 * Cached per sync — refreshed on each `sync-hotkeys` call.
 */
let cachedSecuredDoublePressMs = 5000

/**
 * True while the renderer is actively recording a new hotkey. Suppresses
 * all global hotkey callbacks so that pressing an already-assigned
 * combination while trying to record it doesn't fire that shortcut.
 */
let isRecordingHotkey = false

/**
 * Check every path-based action in the shortcut for existence. Returns
 * the first broken action's title + value, or null if all paths are valid.
 * Used at hotkey-fire time to refuse launching a broken shortcut.
 */
function findFirstBrokenPath(shortcut: ShortcutData): { title: string; value: string } | null {
  for (const a of shortcut.actions) {
    if (a.type !== 'launch_app' && a.type !== 'open_file' && a.type !== 'open_folder') continue
    const val = (a.value || '').trim()
    if (!val) return { title: a.title || a.type, value: '(empty)' }
    // UWP apps and shell folders use the `shell:` URI scheme — no real
    // file path, no existence check applies. (Mirrors isUwpPath in
    // src/types/actions.ts; main can't import from src/ due to the
    // bundle split.)
    if (a.type === 'launch_app' && val.startsWith('shell:')) continue
    try {
      fs.statSync(val)
    } catch {
      return { title: a.title || a.type, value: val }
    }
  }
  return null
}

ipcMain.on('set-hotkey-recording', (_event, value: unknown) => {
  isRecordingHotkey = value === true
})

/**
 * Test whether a hotkey actually fires on this system.
 *
 * Some keyboard layouts (UK, Bengali) don't deliver certain combinations
 * to the OS shortcut layer even though globalShortcut.register() accepts
 * them — notably Shift+digit and Ctrl+Alt+digit. The only reliable way
 * to know is to try. We temporarily unregister every shortcut, register
 * just the candidate, and wait up to 4 seconds for a fire. Then restore.
 */
// ── Test Hotkey (redesigned) ──
// The old implementation used a 4-second race — hostile to slow users who
// couldn't press the combo in time. Now the renderer controls the lifecycle:
//   - `test-hotkey-start` — snapshot shortcuts, register only the candidate
//   - `test-hotkey-check` — read the fired flag
//   - `test-hotkey-stop`  — restore the snapshot
// No timer. The user presses when ready, then clicks Verify.
interface TestHotkeyState {
  accelerator: string | null
  fired: boolean
  snapshot: ShortcutData[] | null
}
let testHotkeyState: TestHotkeyState = { accelerator: null, fired: false, snapshot: null }

ipcMain.handle('test-hotkey-start', async (_event, payload: { combo: string }) => {
  const combo = typeof payload?.combo === 'string' ? payload.combo : ''
  const accelerator = comboToAccelerator(combo)
  if (!accelerator) return { ok: false, reason: 'invalid' }

  // If a previous test is somehow still open, restore it first.
  if (testHotkeyState.accelerator !== null) {
    globalShortcut.unregister(testHotkeyState.accelerator)
    if (testHotkeyState.snapshot) registerHotkeys(testHotkeyState.snapshot)
  }

  // Snapshot existing shortcuts so we can restore after the test.
  const snapshot = [...shortcutById.values()]
  globalShortcut.unregisterAll()

  const ok = globalShortcut.register(accelerator, () => {
    testHotkeyState.fired = true
  })
  if (!ok) {
    registerHotkeys(snapshot)
    return { ok: false, reason: 'registration-rejected' }
  }

  testHotkeyState = { accelerator, fired: false, snapshot }
  return { ok: true }
})

ipcMain.handle('test-hotkey-check', async () => {
  return { fired: testHotkeyState.fired }
})

ipcMain.handle('test-hotkey-stop', async () => {
  if (testHotkeyState.accelerator !== null) {
    globalShortcut.unregister(testHotkeyState.accelerator)
    if (testHotkeyState.snapshot) registerHotkeys(testHotkeyState.snapshot)
    testHotkeyState = { accelerator: null, fired: false, snapshot: null }
  }
})

function registerHotkeys(shortcuts: ShortcutData[]) {
  globalShortcut.unregisterAll()
  hotkeyToShortcutId.clear()
  shortcutById.clear()

  for (const shortcut of shortcuts) {
    if (!shortcut.hotkey || shortcut.hotkey === 'Listening...') continue
    shortcutById.set(shortcut.id, shortcut)

    const accelerator = comboToAccelerator(shortcut.hotkey)
    if (!accelerator) continue

    try {
      const ok = globalShortcut.register(accelerator, () => {
        // While the user is recording a new hotkey, ignore hotkey fires —
        // otherwise pressing an already-assigned combination while trying
        // to record it would trigger that shortcut instead of being
        // captured by the recorder.
        if (isRecordingHotkey) return

        // Pre-flight: refuse the hotkey if any path action is broken.
        // Show a native Windows toast so the user sees it even when
        // they're focused on another app.
        const broken = findFirstBrokenPath(shortcut)
        if (broken) {
          if (executionNotifications && Notification.isSupported()) {
            try {
              const notif = new Notification({
                title: `LazyCow: "${shortcut.name}" can't run`,
                body: `${broken.title} points to a missing file:\n${broken.value}\n\nOpen LazyCow → Edit Flow to fix it.`,
                icon: getAppIconPath(),
                silent: false,
              })
              notif.show()
            } catch (err) {
              console.warn('Failed to show broken-path toast:', err)
            }
          }
          return
        }

        // Secured shortcut — decide between direct run, in-app modal, or
        // minimized toast + double-press confirmation.
        if (shortcut.secured) {
          // The user must have already confirmed via the double-press path.
          const pendingAt = securedPendingFires.get(shortcut.id)
          const now = Date.now()
          if (pendingAt !== undefined && now - pendingAt <= cachedSecuredDoublePressMs) {
            // Second press within the window → run directly.
            securedPendingFires.delete(shortcut.id)
            win?.webContents.send('hotkey-triggered', shortcut.id)
            void runShortcutActions(shortcut)
          } else if (win && win.isVisible() && win.isFocused()) {
            // Window focused → show the in-app confirmation modal.
            securedPendingFires.set(shortcut.id, now)
            win.webContents.send('hotkey-needs-confirm', shortcut.id)
          } else {
            // Window minimized or hidden → show a native toast. The user
            // can press the hotkey again within the window, or click the
            // toast to focus LazyCow and see the modal.
            securedPendingFires.set(shortcut.id, now)
            if (executionNotifications && Notification.isSupported()) {
              try {
                const notif = new Notification({
                  title: 'LazyCow — secured shortcut',
                  body: `Press ${shortcut.hotkey} again, or click to open LazyCow.`,
                  icon: getAppIconPath(),
                  silent: false,
                })
                notif.on('click', () => {
                  if (win) {
                    if (win.isMinimized()) win.restore()
                    win.show()
                    win.focus()
                    // Only send the confirm request if the pending-fire
                    // entry still holds *our* timestamp. If the user
                    // pressed the hotkey a second time while the toast
                    // was visible, the double-press path either ran the
                    // shortcut (deleting the entry) or re-armed it with
                    // a different timestamp — either way, this click
                    // must not re-open the modal.
                    if (securedPendingFires.get(shortcut.id) === now) {
                      win.webContents.send('hotkey-needs-confirm', shortcut.id)
                    }
                  }
                })
                notif.show()
              } catch (err) {
                console.warn('Failed to show secured-shortcut toast:', err)
              }
            }
          }
        } else {
          // Not secured → run directly.
          win?.webContents.send('hotkey-triggered', shortcut.id)
          void runShortcutActions(shortcut)
        }
      })
      if (!ok) {
        console.log(`[hotkey] FAILED to register "${accelerator}" for "${shortcut.name}"`)
        win?.webContents.send('hotkey-register-failed', { shortcutId: shortcut.id, hotkey: shortcut.hotkey })
      } else {
        console.log(`[hotkey] registered "${accelerator}" for "${shortcut.name}"`)
        hotkeyToShortcutId.set(accelerator, shortcut.id)
      }
    } catch {
      win?.webContents.send('hotkey-register-failed', { shortcutId: shortcut.id, hotkey: shortcut.hotkey })
    }
  }
}

ipcMain.on('sync-hotkeys', (_event, payload: unknown) => {
  try {
    // The renderer sends `{ shortcuts, securedDoublePressSeconds }`. We
    // also accept the legacy bare-array shape so a stale renderer build
    // can't silently break hotkey registration.
    let shortcutsInput: unknown
    if (Array.isArray(payload)) {
      shortcutsInput = payload
    } else if (payload && typeof payload === 'object' && 'shortcuts' in payload) {
      const p = payload as { shortcuts: unknown; securedDoublePressSeconds?: number }
      shortcutsInput = p.shortcuts
      if (typeof p.securedDoublePressSeconds === 'number') {
        const n = Math.max(5, Math.min(30, Math.round(p.securedDoublePressSeconds)))
        cachedSecuredDoublePressMs = n * 1000
      }
    } else {
      return
    }
    const shortcuts = z.array(ShortcutSchema).max(500).parse(shortcutsInput)
    registerHotkeys(shortcuts)
  } catch (err: unknown) {
    console.error('Failed to sync hotkeys due to invalid payload:', err)
  }
})

// Chromium flushes localStorage as part of its own graceful shutdown
// sequence — triggered by app.quit(). Do NOT preventDefault here, and do
// NOT hard-kill. The previous version of this handler did both, replacing
// Chromium's reliable shutdown with an async flush we couldn't guarantee,
// and it caused a real data-loss incident on 2026-10-15. Keep this simple.
app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  app.quit()
  win = null
})

app.whenReady().then(() => {
  // Kick off the app-drawer scan FIRST — before window and tray creation —
  // so the scan runs concurrently with Chromium's boot. On a slow machine
  // the scan takes 1–3s (Start Menu walk + Get-StartApps + App Paths +
  // Uninstall registry + icon extraction). By the time the user opens the
  // drawer, the cache is warm and no spinner shows.
  void discoverInstalledApps().catch((err) => {
    console.error('[app-drawer] background scan failed:', err)
  })
  createWindow()
  createTray()
})