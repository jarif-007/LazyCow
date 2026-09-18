import { app, BrowserWindow, ipcMain, nativeTheme, shell, globalShortcut, Tray, Menu, nativeImage, systemPreferences, dialog, Notification } from 'electron'
import { exec, execFile } from 'child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { z } from 'zod'

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
const execFileAsync = promisify(execFile)

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

// ──────────────────────────────────────────────
// SHORTCUT EXECUTION ENGINE
// ──────────────────────────────────────────────

const ActionSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.string().min(1).max(50),
  title: z.string().max(200).optional(),
  value: z.string().max(8192)
}).passthrough()

const ShortcutSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  hotkey: z.string().max(100).optional(),
  actions: z.array(ActionSchema).max(50)
}).passthrough()

type ShortcutActionData = z.infer<typeof ActionSchema>
type ShortcutData = z.infer<typeof ShortcutSchema>

interface ActionResult {
  actionId: string
  success: boolean
  error?: string
}

const runningShortcuts = new Set<string>()
// Simple cancellation request set — when a shortcut's id is present,
// the execution loop will stop at the next step boundary (graceful cancel).
const cancelRequests = new Set<string>()

// ── Settle times (ms) so the progress UI matches app launching ──
const SETTLE_TIME: Record<string, number> = {
  launch_app: 800,
  open_vscode: 1000,
}

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
      if (!['.exe', '.cmd', '.bat', '.lnk'].includes(ext)) {
        throw new Error('Path is not a recognized Windows executable (.exe, .cmd, .bat, .lnk)')
      }
      
      const err = await shell.openPath(action.value)
      if (err) throw new Error(err)
      // Settle time so the app has time to appear before the next step
      await new Promise((r) => setTimeout(r, SETTLE_TIME.launch_app))
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
      const ok = /^https?:\/\//i.test(action.value)
      if (!ok) throw new Error('Only http:// and https:// URLs are allowed')
      await shell.openExternal(action.value)
      return
    }
    case 'open_vscode': {
      try { fs.statSync(action.value) } catch { throw new Error('Target folder or file does not exist') }

      try {
        await execFileAsync('code.cmd', [action.value], { windowsHide: true, timeout: 15000, shell: true })
      } catch (err: unknown) {
        const error = err as { code?: string; message?: string }
        if (error.code === 'ENOENT' || String(err).includes('not recognized')) {
          throw new Error('VS Code CLI "code" is not available in Windows PATH')
        }
        throw new Error(`Failed to open in VS Code: ${error.message || String(err)}`)
      }
      // Settle time for VS Code to actually appear
      await new Promise((r) => setTimeout(r, SETTLE_TIME.open_vscode))
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
    case 'arrange_windows': {
      let layout = 'snap_left'
      let orientation = 'vertical'
      let apps: Record<'tl' | 'tr' | 'bl' | 'br', string> = { tl: '', tr: '', bl: '', br: '' }
      try {
        if (action.value.startsWith('{')) {
          const parsed = JSON.parse(action.value)
          layout = parsed.layout || 'snap_left'
          orientation = parsed.orientation || 'vertical'
          apps = { ...apps, ...(parsed.apps || {}) }
        } else {
          layout = action.value
        }
      } catch { /* fallback to defaults */ }

      const VALID_LAYOUTS = new Set(['snap_left', 'snap_right', 'maximize', 'split_specific', 'tri', 'quad'])
      const VALID_ORIENTATIONS = new Set(['vertical', 'horizontal', 'main_left', 'main_right', 'main_top', 'main_bottom'])
      if (!VALID_LAYOUTS.has(layout)) layout = 'snap_left'
      if (!VALID_ORIENTATIONS.has(orientation)) orientation = 'vertical'

      const SAFE_NAME_REGEX = /^[a-zA-Z0-9_.\s-]*$/
      for (const slot of ['tl', 'tr', 'bl', 'br'] as const) {
        const val = (apps[slot] || '').trim()
        if (val && !SAFE_NAME_REGEX.test(val)) {
          throw new Error(`Invalid application process name "${val}". Only alphanumeric characters, spaces, dots, dashes, and underscores are allowed.`)
        }
        apps[slot] = val
      }

      const script = `
      Add-Type -AssemblyName System.Windows.Forms -ErrorAction SilentlyContinue
      $code = @"
      using System;
      using System.Text;
      using System.Collections.Generic;
      using System.Runtime.InteropServices;

      public class WinManager {
          public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

          [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
          [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
          [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder strText, int maxCount);
          [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
          [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
          [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
          [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
          [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
          [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();

          public class WinItem {
              public IntPtr Handle;
              public string Title;
              public string ProcessName;
          }

          public static List<WinItem> GetWindows() {
              var list = new List<WinItem>();
              EnumWindows((hWnd, lParam) => {
                  if (!IsWindowVisible(hWnd)) return true;
                  int len = GetWindowTextLength(hWnd);
                  if (len == 0) return true;

                  var sb = new StringBuilder(len + 1);
                  GetWindowText(hWnd, sb, sb.Capacity);
                  string title = sb.ToString();

                  uint pid = 0;
                  GetWindowThreadProcessId(hWnd, out pid);
                  string procName = "";
                  try {
                      var p = System.Diagnostics.Process.GetProcessById((int)pid);
                      procName = p.ProcessName;
                  } catch {}

                  if (procName.Equals("explorer", StringComparison.OrdinalIgnoreCase) && 
                     (title.Equals("Program Manager", StringComparison.OrdinalIgnoreCase) || title.Length == 0)) {
                      return true;
                  }

                  list.Add(new WinItem { Handle = hWnd, Title = title, ProcessName = procName });
                  return true;
              }, IntPtr.Zero);
              return list;
          }
      }
"@
      Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue

      $area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
      $halfW = [math]::Floor($area.Width / 2)
      $halfH = [math]::Floor($area.Height / 2)
      $layout = "${layout}"
      $ori = "${orientation}"

      $usedHandles = [System.Collections.Generic.HashSet[IntPtr]]::new()

      function PositionWindow($hwnd, $x, $y, $w, $h) {
          if ($hwnd -and $hwnd -ne [IntPtr]::Zero) {
              [WinManager]::ShowWindow($hwnd, 9)
              Start-Sleep -Milliseconds 60
              [WinManager]::MoveWindow($hwnd, $x, $y, $w, $h, $true)
              [WinManager]::SetForegroundWindow($hwnd)
          }
      }

      function FindAndMove($targetName, $x, $y, $w, $h) {
          if (-not $targetName -or $targetName.Trim() -eq "") { return }
          $clean = $targetName.Trim()

          for ($attempt = 0; $attempt -lt 6; $attempt++) {
              $windows = [WinManager]::GetWindows()
              $match = $null
              foreach ($w in $windows) {
                  if ($usedHandles.Contains($w.Handle)) { continue }
                  if ($w.ProcessName -match [regex]::Escape($clean) -or $w.Title -match [regex]::Escape($clean)) {
                      $match = $w
                      break
                  }
              }
              if ($match) {
                  $usedHandles.Add($match.Handle) | Out-Null
                  PositionWindow $match.Handle $x $y $w $h
                  return
              }
              Start-Sleep -Milliseconds 400
          }
      }

      if ($layout -eq "quad") {
          FindAndMove "${apps.tl}" $area.Left $area.Top $halfW $halfH
          FindAndMove "${apps.tr}" ($area.Left + $halfW) $area.Top $halfW $halfH
          FindAndMove "${apps.bl}" $area.Left ($area.Top + $halfH) $halfW $halfH
          FindAndMove "${apps.br}" ($area.Left + $halfW) ($area.Top + $halfH) $halfW $halfH
      } elseif ($layout -eq "split_specific") {
          if ($ori -eq "horizontal") {
              FindAndMove "${apps.tl}" $area.Left $area.Top $area.Width $halfH
              FindAndMove "${apps.tr}" $area.Left ($area.Top + $halfH) $area.Width $halfH
          } else {
              FindAndMove "${apps.tl}" $area.Left $area.Top $halfW $area.Height
              FindAndMove "${apps.tr}" ($area.Left + $halfW) $area.Top $halfW $area.Height
          }
      } elseif ($layout -eq "tri") {
          if ($ori -eq "main_right") {
              FindAndMove "${apps.tl}" $area.Left $area.Top $halfW $halfH
              FindAndMove "${apps.bl}" $area.Left ($area.Top + $halfH) $halfW $halfH
              FindAndMove "${apps.tr}" ($area.Left + $halfW) $area.Top $halfW $area.Height
          } elseif ($ori -eq "main_top") {
              FindAndMove "${apps.tl}" $area.Left $area.Top $area.Width $halfH
              FindAndMove "${apps.bl}" $area.Left ($area.Top + $halfH) $halfW $halfH
              FindAndMove "${apps.br}" ($area.Left + $halfW) ($area.Top + $halfH) $halfW $halfH
          } elseif ($ori -eq "main_bottom") {
              FindAndMove "${apps.tl}" $area.Left $area.Top $halfW $halfH
              FindAndMove "${apps.tr}" ($area.Left + $halfW) $area.Top $halfW $halfH
              FindAndMove "${apps.bl}" $area.Left ($area.Top + $halfH) $area.Width $halfH
          } else {
              FindAndMove "${apps.tl}" $area.Left $area.Top $halfW $area.Height
              FindAndMove "${apps.tr}" ($area.Left + $halfW) $area.Top $halfW $halfH
              FindAndMove "${apps.br}" ($area.Left + $halfW) ($area.Top + $halfH) $halfW $halfH
          }
      } else {
          if ("${apps.tl}" -and "${apps.tl}".Trim() -ne "") {
              if ($layout -eq "snap_left") { FindAndMove "${apps.tl}" $area.Left $area.Top $halfW $area.Height }
              elseif ($layout -eq "snap_right") { FindAndMove "${apps.tl}" ($area.Left + $halfW) $area.Top $halfW $area.Height }
              elseif ($layout -eq "maximize") { FindAndMove "${apps.tl}" $area.Left $area.Top $area.Width $area.Height }
          } else {
              $windows = [WinManager]::GetWindows()
              $targetHwnd = [IntPtr]::Zero
              foreach ($w in $windows) {
                  if ($w.ProcessName -match "lazycow|electron" -or $w.Title -match "LazyCow") { continue }
                  $targetHwnd = $w.Handle
                  break
              }
              if ($targetHwnd -ne [IntPtr]::Zero) {
                  if ($layout -eq "snap_left") { PositionWindow $targetHwnd $area.Left $area.Top $halfW $area.Height }
                  elseif ($layout -eq "snap_right") { PositionWindow $targetHwnd ($area.Left + $halfW) $area.Top $halfW $area.Height }
                  elseif ($layout -eq "maximize") { PositionWindow $targetHwnd $area.Left $area.Top $area.Width $area.Height }
              }
          }
      }
      `
      const encodedScript = Buffer.from(script, 'utf16le').toString('base64')
      await execAsync(`powershell.exe -NoProfile -NonInteractive -EncodedCommand ${encodedScript}`, { windowsHide: true })
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
        results.push({ actionId: action.id, success: false, error: e instanceof Error ? e.message : String(e) })
      }
    }
  } finally {
    runningShortcuts.delete(shortcut.id)
    cancelRequests.delete(shortcut.id)
  }
  
  const durationMs = Date.now() - startTime
  win?.webContents.send('shortcut-complete', {
    shortcutId: shortcut.id,
    results,
    durationMs,
    cancelled,
    lastActionTitle,
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
        body = `Failed on ${failed.length} action(s): ${failed.map((f) => f.error).filter(Boolean).join('; ')}`
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
      { name: 'Windows Applications & Executables (*.exe, *.lnk, *.bat, *.cmd)', extensions: ['exe', 'lnk', 'bat', 'cmd'] },
      { name: 'All Files (*.*)', extensions: ['*'] }
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

const DANGEROUS_EXTENSIONS = new Set(['.exe', '.cmd', '.bat', '.ps1', '.vbs', '.js', '.wsf', '.msi'])

function shortcutHasScript(shortcut: ShortcutData): boolean {
  return shortcut.actions.some((a) => {
    if (a.type === 'run_script' || a.type === 'launch_app') return true
    if (a.type === 'open_file') {
      const ext = path.extname(a.value).toLowerCase()
      if (DANGEROUS_EXTENSIONS.has(ext)) return true
    }
    return false
  })
}

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
        if (shortcutHasScript(shortcut)) {
          win?.webContents.send('hotkey-needs-confirm', shortcut.id)
        } else {
          win?.webContents.send('hotkey-triggered', shortcut.id)
          void runShortcutActions(shortcut)
        }
      })
      if (!ok) {
        win?.webContents.send('hotkey-register-failed', { shortcutId: shortcut.id, hotkey: shortcut.hotkey })
      } else {
        hotkeyToShortcutId.set(accelerator, shortcut.id)
      }
    } catch {
      win?.webContents.send('hotkey-register-failed', { shortcutId: shortcut.id, hotkey: shortcut.hotkey })
    }
  }
}

ipcMain.on('sync-hotkeys', (_event, rawShortcuts: unknown) => {
  try {
    const shortcuts = z.array(ShortcutSchema).max(500).parse(rawShortcuts)
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