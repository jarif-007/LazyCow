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
            // Electron's getAccentColor() returns hex RRGGBBAA or RRGGBB
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
// This is the trust boundary of the whole app: everything the renderer can
// ask us to do arrives here as plain data (a shortcut's action list), never
// as code. We only accept the specific fields we read below (action.type,
// action.value) — nothing else on the object is trusted or evaluated.

const ActionSchema = z.object({
  id: z.string().min(1).max(100),
  type: z.string().min(1).max(50),
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

// System-control actions (volume/DND/night light) don't have a reliable,
// officially-documented Windows CLI/API. Rather than ship a hacky
// registry/SendKeys workaround and call it "done", these are left as clear
// not-yet-implemented stubs — see the LazyCow remaining-work notes.
const runningShortcuts = new Set<string>()

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
      } catch (err: any) {
        if (err.code === 'ENOENT' || String(err).includes('not recognized')) {
          throw new Error('VS Code CLI "code" is not available in Windows PATH')
        }
        throw new Error(`Failed to open in VS Code: ${err.message || String(err)}`)
      }
      return
    }
    case 'set_volume': {
      const volume = Number(action.value)
      if (!Number.isInteger(volume) || volume < 0 || volume > 100) {
        throw new Error('Volume must be an integer between 0 and 100')
      }
      const scalar = (volume / 100).toFixed(2)
      const script = `
      Add-Type -TypeDefinition @'
      using System.Runtime.InteropServices;
      [Guid("5CDF2C82-841E-4546-9722-0CF74078229A"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
      interface IAudioEndpointVolume {
          int f1(); int f2(); int f3(); int f4(); int f5(); int f6(); int f7();
          int SetMasterVolumeLevelScalar(float fLevel, System.Guid pguidEventContext);
          int f9();
          int GetMasterVolumeLevelScalar(out float pfLevel);
      }
      [Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
      interface IMMDevice {
          int Activate(ref System.Guid id, int clsCtx, System.IntPtr pActivationParams, [MarshalAs(UnmanagedType.IUnknown)] out object ppInterface);
      }
      [Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
      interface IMMDeviceEnumerator {
          int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice ppDevice);
      }
      [ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")] class MMDeviceEnumeratorComObject { }
      public class AudioHelper {
          public static void SetVolume(float vol) {
              var enumerator = new MMDeviceEnumeratorComObject() as IMMDeviceEnumerator;
              IMMDevice dev;
              enumerator.GetDefaultAudioEndpoint(0, 1, out dev);
              var epvGuid = typeof(IAudioEndpointVolume).GUID;
              object epvObj;
              dev.Activate(ref epvGuid, 23, System.IntPtr.Zero, out epvObj);
              var epv = epvObj as IAudioEndpointVolume;
              epv.SetMasterVolumeLevelScalar(vol, System.Guid.Empty);
          }
      }
      '@ -ErrorAction SilentlyContinue
      [AudioHelper]::SetVolume(${scalar})
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
      try {
          $monitors = Get-CimInstance -Namespace root/wmi -ClassName WmiMonitorBrightnessMethods -ErrorAction Stop
          if ($monitors) {
              $monitors | ForEach-Object { $_.WmiSetBrightness(1, ${brightness}) }
          } else {
              Write-Error "No internal monitor found (laptop screen required)."
          }
      } catch {
          Write-Error "Display brightness control requires a built-in laptop screen."
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

      // Validate layout and orientation
      const VALID_LAYOUTS = new Set(['snap_left', 'snap_right', 'maximize', 'split_specific', 'tri', 'quad'])
      const VALID_ORIENTATIONS = new Set(['vertical', 'horizontal', 'main_left', 'main_right', 'main_top', 'main_bottom'])
      if (!VALID_LAYOUTS.has(layout)) layout = 'snap_left'
      if (!VALID_ORIENTATIONS.has(orientation)) orientation = 'vertical'

      // Sanitize process names to prevent script/command injection
      const SAFE_NAME_REGEX = /^[a-zA-Z0-9_\-\.\s]*$/
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
      using System; using System.Runtime.InteropServices;
      public class W {
        [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
        [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int h, bool r);
        [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int nCmdShow);
      }
      "@
      Add-Type -TypeDefinition $code -ErrorAction SilentlyContinue
      $area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
      $halfW = [math]::Floor($area.Width / 2)
      $halfH = [math]::Floor($area.Height / 2)
      $layout = "${layout}"
      $ori = "${orientation}"

      function MoveApp($n, $x, $y, $w, $h) {
          if (-not $n) { return }
          $escaped = [regex]::Escape($n)
          $p = Get-Process | Where-Object { $_.MainWindowTitle -match $escaped -or $_.Name -match $escaped } | Select-Object -First 1
          if ($p -and $p.MainWindowHandle) {
              [W]::ShowWindow($p.MainWindowHandle, 9)
              [W]::MoveWindow($p.MainWindowHandle, $x, $y, $w, $h, $true)
          }
      }

      if ($layout -eq "quad") {
          MoveApp "${apps.tl}" $area.Left $area.Top $halfW $halfH
          MoveApp "${apps.tr}" ($area.Left + $halfW) $area.Top $halfW $halfH
          MoveApp "${apps.bl}" $area.Left ($area.Top + $halfH) $halfW $halfH
          MoveApp "${apps.br}" ($area.Left + $halfW) ($area.Top + $halfH) $halfW $halfH
      } elseif ($layout -eq "split_specific") {
          if ($ori -eq "horizontal") {
              MoveApp "${apps.tl}" $area.Left $area.Top $area.Width $halfH
              MoveApp "${apps.tr}" $area.Left ($area.Top + $halfH) $area.Width $halfH
          } else {
              MoveApp "${apps.tl}" $area.Left $area.Top $halfW $area.Height
              MoveApp "${apps.tr}" ($area.Left + $halfW) $area.Top $halfW $area.Height
          }
      } elseif ($layout -eq "tri") {
          if ($ori -eq "main_right") {
              MoveApp "${apps.tl}" $area.Left $area.Top $halfW $halfH
              MoveApp "${apps.bl}" $area.Left ($area.Top + $halfH) $halfW $halfH
              MoveApp "${apps.tr}" ($area.Left + $halfW) $area.Top $halfW $area.Height
          } elseif ($ori -eq "main_top") {
              MoveApp "${apps.tl}" $area.Left $area.Top $area.Width $halfH
              MoveApp "${apps.bl}" $area.Left ($area.Top + $halfH) $halfW $halfH
              MoveApp "${apps.br}" ($area.Left + $halfW) ($area.Top + $halfH) $halfW $halfH
          } elseif ($ori -eq "main_bottom") {
              MoveApp "${apps.tl}" $area.Left $area.Top $halfW $halfH
              MoveApp "${apps.tr}" ($area.Left + $halfW) $area.Top $halfW $halfH
              MoveApp "${apps.bl}" $area.Left ($area.Top + $halfH) $area.Width $halfH
          } else {
              MoveApp "${apps.tl}" $area.Left $area.Top $halfW $area.Height
              MoveApp "${apps.tr}" ($area.Left + $halfW) $area.Top $halfW $halfH
              MoveApp "${apps.br}" ($area.Left + $halfW) ($area.Top + $halfH) $halfW $halfH
          }
      } else {
          $hwnd = [W]::GetForegroundWindow()
          if ($hwnd) {
              [W]::ShowWindow($hwnd, 9)
              if ($layout -eq "snap_left") { [W]::MoveWindow($hwnd, $area.Left, $area.Top, $halfW, $area.Height, $true) }
              if ($layout -eq "snap_right") { [W]::MoveWindow($hwnd, $area.Left + $halfW, $area.Top, $halfW, $area.Height, $true) }
              if ($layout -eq "maximize") { [W]::MoveWindow($hwnd, $area.Left, $area.Top, $area.Width, $area.Height, $true) }
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
        
        await new Promise((resolve, reject) => {
          child.on('exit', (code) => {
            if (code === 0) resolve(undefined)
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
    default:
      throw new Error(`Unknown action type: ${action.type}`)
  }
}

async function runShortcutActions(shortcut: ShortcutData): Promise<ActionResult[]> {
  const results: ActionResult[] = []
  
  if (runningShortcuts.has(shortcut.id)) {
    return [{ actionId: 'system', success: false, error: 'Shortcut is already running.' }]
  }
  runningShortcuts.add(shortcut.id)
  
  try {
    for (let i = 0; i < shortcut.actions.length; i++) {
      win?.webContents.send('shortcut-progress', { shortcutId: shortcut.id, stepIndex: i })
      const action = shortcut.actions[i]
      try {
        await runAction(action)
        results.push({ actionId: action.id, success: true })
      } catch (e) {
        results.push({ actionId: action.id, success: false, error: e instanceof Error ? e.message : String(e) })
      }
    }
  } finally {
    runningShortcuts.delete(shortcut.id)
  }
  
  win?.webContents.send('shortcut-complete', { shortcutId: shortcut.id, results })

  // Dispatch native Windows notification if enabled
  const failed = results.filter((r) => !r.success)
  const allSucceeded = failed.length === 0
  if (executionNotifications && Notification.isSupported()) {
    try {
      const notif = new Notification({
        title: allSucceeded ? `LazyCow: ${shortcut.name}` : `LazyCow: ${shortcut.name} (Failed)`,
        body: allSucceeded
          ? `All ${shortcut.actions.length} action(s) completed successfully.`
          : `Failed on ${failed.length} action(s): ${failed.map((f) => f.error).filter(Boolean).join('; ')}`,
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
  } catch (err: any) {
    return [{ actionId: 'system', success: false, error: err.message || 'Invalid shortcut data' }]
  }
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

// Converts a recorded combo like "Ctrl + Alt + L" into an Electron
// accelerator like "CommandOrControl+Alt+L". Returns null if there's no
// non-modifier key to bind to.
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
          // Don't run it — a run_script action is an arbitrary shell
          // command, so it always needs the user to see and confirm the
          // exact command first. Hand off to the renderer's confirm modal;
          // the renderer will call execute-shortcut itself if confirmed.
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
  } catch (err: any) {
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