import { app, BrowserWindow, ipcMain, nativeTheme, shell, globalShortcut, Tray, Menu, nativeImage, systemPreferences, dialog, Notification } from 'electron'

// Workaround for GPU driver incompatibilities causing visual glitches on some laptops.
// Forces Chromium to use CPU rendering instead of the Direct3D backend.
app.disableHardwareAcceleration()
import { exec } from 'child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { z } from 'zod'
import contextMenu from 'electron-context-menu'
import { arrangeWindows, type Placement, type PlacementResult } from './windowLayout'

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
  const pngPath = path.join(process.env.VITE_PUBLIC, 'icon.png')
  if (fs.existsSync(pngPath)) return pngPath
  return path.join(process.env.VITE_PUBLIC, 'electron-vite.svg')
}

function getTrayIconPath(): string {
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
    { label: 'Quit', click: () => {
      isQuitting = true
      app.quit()
    }}
  ])
  tray.setToolTip('LazyCow')
  tray.setContextMenu(contextMenu)
  tray.on('click', () => win?.show())
}

function createWindow() {
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

// Format-only URL check — scheme http/https + host present.
// DNS verification is done separately in check-url-resolves.
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

// ──────────────────────────────────────────────
// WINDOW LAYOUT RUNTIME
// ──────────────────────────────────────────────
// Positions shortcut-launched windows into a fixed layout after the
// action sequence completes. Placement rules are documented in
// electron/windowLayout.ts.

const WindowLayoutRequestSchema = z.object({
  shortcutName: z.string().max(200),
  layoutId: z.enum([
    'split_50',
    'split_67_33',
    'split_33_67',
    'thirds',
    'main_left',
    'main_right',
    'quad',
  ]),
  placements: z
    .array(
      z.object({
        zoneId: z.string().max(50),
        zoneLabel: z.string().max(100),
        zone: z.object({
          x: z.number(),
          y: z.number(),
          w: z.number(),
          h: z.number(),
        }),
        actionType: z.string().max(50),
        actionValue: z.string().max(8192),
        actionTitle: z.string().max(200),
        isUnassigned: z.boolean().optional().default(false),
      })
    )
    .max(10),
})

ipcMain.handle('arrange-windows-shortcut', async (_event, rawRequest: unknown) => {
  try {
    const req = WindowLayoutRequestSchema.parse(rawRequest)
    const placements: Placement[] = req.placements.map((p) => ({
      zoneId: p.zoneId,
      zoneLabel: p.zoneLabel,
      zone: p.zone,
      actionType: p.actionType,
      actionValue: p.actionValue,
      actionTitle: p.actionTitle,
      isUnassigned: p.isUnassigned,
    }))

    const results = await arrangeWindows(placements)
    console.log('[arrange-windows-shortcut] results:', JSON.stringify(results, null, 2))
    return results
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[arrange-windows-shortcut] failed:', message)
    return []
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
    { id: 'left',  label: 'Left',  x: 0,    y: 0, w: 0.5, h: 1 },
    { id: 'right', label: 'Right', x: 0.5,  y: 0, w: 0.5, h: 1 },
  ],
  split_67_33: [
    { id: 'main_left', label: 'Main Left', x: 0,    y: 0, w: 0.67, h: 1 },
    { id: 'right',     label: 'Right',     x: 0.67, y: 0, w: 0.33, h: 1 },
  ],
  split_33_67: [
    { id: 'left',       label: 'Left',       x: 0,    y: 0, w: 0.33, h: 1 },
    { id: 'main_right', label: 'Main Right', x: 0.33, y: 0, w: 0.67, h: 1 },
  ],
  thirds: [
    { id: 'left',   label: 'Left',   x: 0,     y: 0, w: 0.333, h: 1 },
    { id: 'center', label: 'Center', x: 0.333, y: 0, w: 0.334, h: 1 },
    { id: 'right',  label: 'Right',  x: 0.667, y: 0, w: 0.333, h: 1 },
  ],
  main_left: [
    { id: 'main_left',    label: 'Main Left',    x: 0,   y: 0,   w: 0.5, h: 1 },
    { id: 'top_right',    label: 'Top Right',    x: 0.5, y: 0,   w: 0.5, h: 0.5 },
    { id: 'bottom_right', label: 'Bottom Right', x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
  ],
  main_right: [
    { id: 'top_left',    label: 'Top Left',    x: 0,   y: 0,   w: 0.5, h: 0.5 },
    { id: 'bottom_left', label: 'Bottom Left', x: 0,   y: 0.5, w: 0.5, h: 0.5 },
    { id: 'main_right',  label: 'Main Right',  x: 0.5, y: 0,   w: 0.5, h: 1 },
  ],
  quad: [
    { id: 'tl', label: 'Top Left',     x: 0,   y: 0,   w: 0.5, h: 0.5 },
    { id: 'tr', label: 'Top Right',    x: 0.5, y: 0,   w: 0.5, h: 0.5 },
    { id: 'bl', label: 'Bottom Left',  x: 0,   y: 0.5, w: 0.5, h: 0.5 },
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
      case 'open_url':
        total += 1500
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
      await shell.openExternal(action.value)
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

  // Fire the arrangement engine in parallel with the action loop.
  // It polls for windows as they appear, snapping each the moment it's
  // found — instead of waiting for the loop to finish and snapping in a batch.
  // Errors are caught here so a layout failure never fails the shortcut.
  let layoutPromise: Promise<PlacementResult[]> | null = null
  if (shortcut.windowLayout?.enabled) {
    const placements = buildPlacementsFromShortcut(shortcut)
    if (placements.length > 0) {
      const budgetMs = estimateShortcutBudgetMs(shortcut)
      console.log(`[runShortcut] layout budget: ${budgetMs}ms for ${placements.length} placements`)
      layoutPromise = arrangeWindows(placements, budgetMs).catch((err) => {
        console.error('[runShortcut] window layout failed:', err)
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
  } finally {
    runningShortcuts.delete(shortcut.id)
    cancelRequests.delete(shortcut.id)
  }
  
  // Wait for the arrangement engine (already running in parallel).
  // If cancelled, don't block the completion event — let it finish in the
  // background so the card flips to "Cancelled" promptly.
  lastLayoutResults = null
  if (layoutPromise) {
    if (cancelled) {
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

  const durationMs = Date.now() - startTime
  win?.webContents.send('shortcut-complete', {
    shortcutId: shortcut.id,
    results,
    durationMs,
    cancelled,
    lastActionTitle,
    layoutResults: lastLayoutResults,
  })

  // Dispatch native Windows notification if enabled
  const failed = results.filter((r) => !r.success)
  const allSucceeded = failed.length === 0 && !cancelled
  if (executionNotifications && Notification.isSupported()) {
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

// The old `shortcutHasScript` / `DANGEROUS_EXTENSIONS` helpers were replaced
// by the per-shortcut `secured` flag. The dangerous/extension logic now
// lives in the renderer (`src/utils/danger.ts`) and is not consulted by
// the main process at hotkey-fire time.

// ──────────────────────────────────────────────
// GLOBAL HOTKEYS
// ──────────────────────────────────────────────
const hotkeyToShortcutId = new Map<string, string>()
const shortcutById = new Map<string, ShortcutData>()

const SPECIAL_KEY_MAP: Record<string, string> = {
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  ' ': 'Space', Escape: 'Esc', Delete: 'Delete', Backspace: 'Backspace',
  Enter: 'Return', Tab: 'Tab',
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
    else mainKey = SPECIAL_KEY_MAP[part] ?? part
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
ipcMain.handle('test-hotkey', async (_event, payload: { combo: string }) => {
  const combo = typeof payload?.combo === 'string' ? payload.combo : ''
  const accelerator = comboToAccelerator(combo)
  if (!accelerator) return { fired: false, reason: 'invalid' }

  // Snapshot existing shortcuts so we can restore after the test.
  const snapshot = [...shortcutById.values()]

  // Clear the stage — the candidate must be the only registered hotkey
  // so we don't mistake another shortcut's fire for the candidate's.
  globalShortcut.unregisterAll()

  let resolveFire: (() => void) | null = null
  const firePromise = new Promise<void>((r) => { resolveFire = r })
  const timeoutMs = 4000
  const timeoutPromise = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), timeoutMs))

  const ok = globalShortcut.register(accelerator, () => resolveFire?.())
  if (!ok) {
    registerHotkeys(snapshot)
    return { fired: false, reason: 'registration-rejected' }
  }

  const result = await Promise.race([
    firePromise.then(() => 'fired' as const),
    timeoutPromise,
  ])

  globalShortcut.unregister(accelerator)
  registerHotkeys(snapshot)

  return { fired: result === 'fired', reason: result === 'fired' ? undefined : 'timeout' }
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

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

app.on('window-all-closed', () => {
  app.quit()
  win = null
})

app.whenReady().then(() => {
  createWindow()
  createTray()
})