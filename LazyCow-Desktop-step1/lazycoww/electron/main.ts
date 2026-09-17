import { app, BrowserWindow, ipcMain, nativeTheme, shell, globalShortcut, Tray, Menu, nativeImage } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'
import { z } from 'zod'

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

app.on('before-quit', () => {
  isQuitting = true
})

ipcMain.on('update-general-settings', (_event, settings: { startAtLogin?: boolean; keepInTray?: boolean }) => {
  if (typeof settings.keepInTray === 'boolean') {
    keepInTray = settings.keepInTray
  }
  if (typeof settings.startAtLogin === 'boolean') {
    app.setLoginItemSettings({ openAtLogin: settings.startAtLogin })
  }
})

function createTray() {
  const iconPath = path.join(process.env.VITE_PUBLIC, 'electron-vite.svg')
  let icon = nativeImage.createFromPath(iconPath)
  
  // macOS often fails to load SVGs directly into the Tray. 
  // We use a small generated fallback PNG if it's empty.
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
    icon: path.join(process.env.VITE_PUBLIC, 'electron-vite.svg'),
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
    // Read AccentPalette and extract the actual accent color (index 3 = the main accent)
    const cmd = `powershell.exe -Command "$bytes = (Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\Accent' -Name AccentPalette).AccentPalette; $r = $bytes[12]; $g = $bytes[13]; $b = $bytes[14]; '{0:X2}{1:X2}{2:X2}' -f $r, $g, $b"`
    exec(cmd, { windowsHide: true, timeout: 5000 }, (error, stdout) => {
      if (!error && stdout) {
        const hex = stdout.trim().toUpperCase()
        if (/^[0-9A-F]{6}$/.test(hex)) {
          console.log('AccentPalette index 3 color:', hex)
          resolve(`#${hex}`)
          return
        }
      }
      resolve(lastAccentColor)
    })
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
const UNIMPLEMENTED_TYPES = new Set(['toggle_dnd', 'toggle_nightlight', 'set_brightness'])

const runningShortcuts = new Set<string>()

async function runAction(action: ShortcutActionData): Promise<void> {
  if (UNIMPLEMENTED_TYPES.has(action.type)) {
    throw new Error(`"${action.type}" isn't implemented yet`)
  }

  switch (action.type) {
    case 'launch_app': {
      let stat
      try { stat = fs.statSync(action.value) } catch { throw new Error('Path does not exist or is inaccessible') }
      if (stat.isDirectory()) throw new Error('Path is a directory, not an application')
      
      const ext = path.extname(action.value).toLowerCase()
      if (!['.exe', '.cmd', '.bat', '.app'].includes(ext) && process.platform === 'win32') {
        throw new Error('Path is not a recognized executable extension')
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
      try {
        const checkCmd = process.platform === 'win32' ? 'where code' : 'which code'
        await execAsync(checkCmd, { windowsHide: true })
      } catch {
        throw new Error('VS Code CLI "code" is not available in PATH')
      }
      // execFile-style quoting: the path is passed as a single argument,
      // not concatenated into a shell string.
      await execAsync(`code "${action.value.replace(/"/g, '\\"')}"`, { windowsHide: true, timeout: 15000 })
      return
    }
    case 'set_volume': {
      const volume = Number(action.value)
      if (!Number.isInteger(volume) || volume < 0 || volume > 100) {
        throw new Error('Volume must be an integer between 0 and 100')
      }
      throw new Error(`"${action.type}" isn't implemented yet`)
    }
    case 'arrange_windows': {
      let layout = 'snap_left'
      let orientation = 'vertical'
      let apps = { tl: '', tr: '', bl: '', br: '' }
      try {
        if (action.value.startsWith('{')) {
          const parsed = JSON.parse(action.value)
          layout = parsed.layout || 'snap_left'
          orientation = parsed.orientation || 'vertical'
          apps = parsed.apps || apps
        } else {
          layout = action.value
        }
      } catch { /* fallback to defaults */ }

      if (process.platform === 'darwin') {
        const script = `
        tell application "Finder"
            set desktopBounds to bounds of window of desktop
            set screenW to item 3 of desktopBounds
            set screenH to item 4 of desktopBounds
        end tell
        set halfW to screenW / 2
        set halfH to screenH / 2
        tell application "System Events"
            if "${layout}" = "quad" then
                ${apps.tl ? `try \n set p to first application process whose name contains "${apps.tl}" \n set position of front window of p to {0, 25} \n set size of front window of p to {halfW, halfH - 12} \n end try` : ''}
                ${apps.tr ? `try \n set p to first application process whose name contains "${apps.tr}" \n set position of front window of p to {halfW, 25} \n set size of front window of p to {halfW, halfH - 12} \n end try` : ''}
                ${apps.bl ? `try \n set p to first application process whose name contains "${apps.bl}" \n set position of front window of p to {0, 25 + halfH - 12} \n set size of front window of p to {halfW, halfH - 12} \n end try` : ''}
                ${apps.br ? `try \n set p to first application process whose name contains "${apps.br}" \n set position of front window of p to {halfW, 25 + halfH - 12} \n set size of front window of p to {halfW, halfH - 12} \n end try` : ''}
            else if "${layout}" = "split_specific" then
                if "${orientation}" = "horizontal" then
                    ${apps.tl ? `try \n set p to first application process whose name contains "${apps.tl}" \n set position of front window of p to {0, 25} \n set size of front window of p to {screenW, halfH - 12} \n end try` : ''}
                    ${apps.tr ? `try \n set p to first application process whose name contains "${apps.tr}" \n set position of front window of p to {0, 25 + halfH - 12} \n set size of front window of p to {screenW, halfH - 12} \n end try` : ''}
                else
                    ${apps.tl ? `try \n set p to first application process whose name contains "${apps.tl}" \n set position of front window of p to {0, 25} \n set size of front window of p to {halfW, screenH - 25} \n end try` : ''}
                    ${apps.tr ? `try \n set p to first application process whose name contains "${apps.tr}" \n set position of front window of p to {halfW, 25} \n set size of front window of p to {halfW, screenH - 25} \n end try` : ''}
                end if
            else if "${layout}" = "tri" then
                if "${orientation}" = "main_right" then
                    ${apps.tl ? `try \n set p to first application process whose name contains "${apps.tl}" \n set position of front window of p to {0, 25} \n set size of front window of p to {halfW, halfH - 12} \n end try` : ''}
                    ${apps.bl ? `try \n set p to first application process whose name contains "${apps.bl}" \n set position of front window of p to {0, 25 + halfH - 12} \n set size of front window of p to {halfW, halfH - 12} \n end try` : ''}
                    ${apps.tr ? `try \n set p to first application process whose name contains "${apps.tr}" \n set position of front window of p to {halfW, 25} \n set size of front window of p to {halfW, screenH - 25} \n end try` : ''}
                else if "${orientation}" = "main_top" then
                    ${apps.tl ? `try \n set p to first application process whose name contains "${apps.tl}" \n set position of front window of p to {0, 25} \n set size of front window of p to {screenW, halfH - 12} \n end try` : ''}
                    ${apps.bl ? `try \n set p to first application process whose name contains "${apps.bl}" \n set position of front window of p to {0, 25 + halfH - 12} \n set size of front window of p to {halfW, halfH - 12} \n end try` : ''}
                    ${apps.br ? `try \n set p to first application process whose name contains "${apps.br}" \n set position of front window of p to {halfW, 25 + halfH - 12} \n set size of front window of p to {halfW, halfH - 12} \n end try` : ''}
                else if "${orientation}" = "main_bottom" then
                    ${apps.tl ? `try \n set p to first application process whose name contains "${apps.tl}" \n set position of front window of p to {0, 25} \n set size of front window of p to {halfW, halfH - 12} \n end try` : ''}
                    ${apps.tr ? `try \n set p to first application process whose name contains "${apps.tr}" \n set position of front window of p to {halfW, 25} \n set size of front window of p to {halfW, halfH - 12} \n end try` : ''}
                    ${apps.bl ? `try \n set p to first application process whose name contains "${apps.bl}" \n set position of front window of p to {0, 25 + halfH - 12} \n set size of front window of p to {screenW, halfH - 12} \n end try` : ''}
                else
                    ${apps.tl ? `try \n set p to first application process whose name contains "${apps.tl}" \n set position of front window of p to {0, 25} \n set size of front window of p to {halfW, screenH - 25} \n end try` : ''}
                    ${apps.tr ? `try \n set p to first application process whose name contains "${apps.tr}" \n set position of front window of p to {halfW, 25} \n set size of front window of p to {halfW, halfH - 12} \n end try` : ''}
                    ${apps.br ? `try \n set p to first application process whose name contains "${apps.br}" \n set position of front window of p to {halfW, 25 + halfH - 12} \n set size of front window of p to {halfW, halfH - 12} \n end try` : ''}
                end if
            else
                set frontApp to first application process whose frontmost is true
                set frontWin to front window of frontApp
                if "${layout}" = "snap_left" then
                    set position of frontWin to {0, 25}
                    set size of frontWin to {halfW, screenH - 25}
                else if "${layout}" = "snap_right" then
                    set position of frontWin to {halfW, 25}
                    set size of frontWin to {halfW, screenH - 25}
                else if "${layout}" = "maximize" then
                    set position of frontWin to {0, 25}
                    set size of frontWin to {screenW, screenH - 25}
                end if
            end if
        end tell
        `
        try {
          await execAsync(`osascript -e '${script.replace(/'/g, "'\\''")}'`)
        } catch (err: any) {
          throw new Error('Failed to arrange windows (requires Accessibility permissions on macOS)')
        }
      } else if (process.platform === 'win32') {
        const script = `
        Add-Type -AssemblyName System.Windows.Forms
        $code = @"
        using System; using System.Runtime.InteropServices;
        public class W {
          [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
          [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr h, int x, int y, int w, int h, bool r);
        }
        "@
        Add-Type -TypeDefinition $code
        $area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
        $halfW = [math]::Floor($area.Width / 2)
        $halfH = [math]::Floor($area.Height / 2)
        $layout = "${layout}"
        $ori = "${orientation}"

        function MoveApp($n, $x, $y, $w, $h) {
            if (-not $n) { return }
            $p = Get-Process | Where-Object { $_.MainWindowTitle -match $n -or $_.Name -match $n } | Select-Object -First 1
            if ($p -and $p.MainWindowHandle) { [W]::MoveWindow($p.MainWindowHandle, $x, $y, $w, $h, $true) }
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
            if ($layout -eq "snap_left") { [W]::MoveWindow($hwnd, $area.Left, $area.Top, $halfW, $area.Height, $true) }
            if ($layout -eq "snap_right") { [W]::MoveWindow($hwnd, $area.Left + $halfW, $area.Top, $halfW, $area.Height, $true) }
            if ($layout -eq "maximize") { [W]::MoveWindow($hwnd, $area.Left, $area.Top, $area.Width, $area.Height, $true) }
        }
        `
        await execAsync(`powershell -Command "${script.replace(/"/g, '\\"')}"`, { windowsHide: true })
      } else {
        throw new Error('Window arrangement is not supported on this OS.')
      }
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
            if (process.platform === 'win32') {
              exec(`taskkill /pid ${child.pid} /t /f`, { windowsHide: true })
            } else {
              process.kill(-child.pid, 'SIGKILL')
            }
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

function shortcutHasScript(shortcut: ShortcutData): boolean {
  return shortcut.actions.some((a) => a.type === 'run_script' || a.type === 'launch_app')
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
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

app.whenReady().then(() => {
  createWindow()
  createTray()
})