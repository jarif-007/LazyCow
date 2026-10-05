/* eslint-disable no-useless-escape */
// The PowerShell + C# engine below contains C# verbatim strings like
//   @"\shell\open\command"
// and regex patterns like @"([\w-]+\.exe)". ESLint's no-useless-escape rule
// doesn't know it's scanning C# code inside a TS template literal, so it
// false-positives on every backslash. The escapes are correct C#.
import { execFile } from 'child_process'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'

/**
 * Run a multi-line PowerShell script by writing it to a temp .ps1 file and
 * invoking `powershell.exe -File`. This avoids both:
 *   - Windows' ~32 KB command-line cap that `-EncodedCommand` hits on large scripts
 *   - The `-Command -` stdin parser, which mangles nested here-strings
 * User data is JSON-escaped inside the script body — no CLI-injection surface.
 */
async function runPowerShellScript(script: string, timeoutMs: number): Promise<string> {
  const tmpPath = path.join(
    os.tmpdir(),
    `lazycow-arrange-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.ps1`
  )

  // Prepend UTF-8 BOM so Windows PowerShell 5.1 reads the file as UTF-8.
  // Without this, non-ASCII characters in user values can be garbled.
  const bom = '\uFEFF'
  await fs.promises.writeFile(tmpPath, bom + script, 'utf8')

  try {
    return await new Promise<string>((resolve, reject) => {
      execFile(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy', 'Bypass',
          '-File', tmpPath,
        ],
        {
          windowsHide: true,
          maxBuffer: 8 * 1024 * 1024,
          timeout: timeoutMs,
          // Force the spawned PowerShell to be DPI-aware from process creation.
          // This MUST happen via env var, not a runtime API call — PowerShell
          // has already initialised its GDI/window subsystem by the time our
          // script runs, so SetProcessDPIAware() is a silent no-op.
          env: { ...process.env, __COMPAT_LAYER: 'HIGHDPIAWARE' },
        },
        (err, stdout, stderr) => {
          // Always surface PowerShell's stderr — our diagnostic prints go there.
          if (stderr && stderr.trim().length > 0) {
            console.log('[windowLayout] powershell stderr:', stderr.trim())
          }
          if (err && !stdout) {
            const e = new Error(
              stderr ? `${err.message}\nSTDERR: ${stderr}` : err.message
            ) as Error & { stdout?: string }
            e.stdout = stdout
            reject(e)
            return
          }
          resolve(stdout)
        }
      )
    })
  } finally {
    // Best-effort cleanup — ignore errors so a failed delete doesn't mask
    // the real error thrown above.
    fs.promises.unlink(tmpPath).catch(() => { /* ignore */ })
  }
}

// ──────────────────────────────────────────────
// TYPES
// ──────────────────────────────────────────────

export interface ZoneRect {
  x: number
  y: number
  w: number
  h: number
}

export interface Placement {
  zoneId: string
  zoneLabel: string
  zone: ZoneRect
  actionType: string
  actionValue: string
  actionTitle: string
}

export interface PlacementResult {
  zoneId: string
  actionTitle: string
  status: 'placed' | 'fallback_centered' | 'not_found' | 'skipped'
  reason?: string
}

// ──────────────────────────────────────────────
// PROCESS-NAME RESOLUTION
// ──────────────────────────────────────────────

/**
 * Best-effort guess of the Windows process name for an action.
 * - launch_app  → basename of the .exe without extension
 * - open_folder → 'explorer'
 * - open_file   → resolved from assoc/ftype via PowerShell at runtime
 * - open_url    → resolved from the default browser's registry entry at runtime
 */
function getExpectedProcessName(placement: Placement): string | null {
  switch (placement.actionType) {
    case 'launch_app': {
      const base = path.basename(placement.actionValue)
      return base.replace(/\.exe$/i, '')
    }
    case 'open_folder':
      return 'explorer'
    case 'open_file':
    case 'open_url':
      // Resolved inside the PowerShell script via registry lookup
      return null
    default:
      return null
  }
}

// ──────────────────────────────────────────────
// POWERSHELL ENGINE
// ──────────────────────────────────────────────

/**
 * Position a batch of windows into their target zones.
 *
 * Rules (in order):
 *  1. Zone free → place window there.
 *  2. Zone occupied, app is NOT the last placement → fallback centered 60%.
 *  3. Zone occupied, app IS the last placement → move to nearest free zone.
 *  4. Zone occupied, no free zone at all → fallback centered 60%.
 *  5. Window not found after polling → not_found.
 */
export async function arrangeWindows(
  placements: Placement[],
  timeoutMs = 6000
): Promise<PlacementResult[]> {
  if (placements.length === 0) return []

  // Pre-resolve expected process names where possible, otherwise 'auto'.
  const placementsForScript = placements.map((p) => ({
    zoneId: p.zoneId,
    zoneLabel: p.zoneLabel,
    x: p.zone.x,
    y: p.zone.y,
    w: p.zone.w,
    h: p.zone.h,
    process: getExpectedProcessName(p) ?? 'auto',
    actionType: p.actionType,
    actionValue: p.actionValue,
    title: p.actionTitle,
  }))

  const script = buildScript(placementsForScript, timeoutMs)

  let stdout = ''
  try {
    // Piped via stdin to avoid the Windows command-line length limit that
    // -EncodedCommand hits on large scripts. User data is JSON-escaped
    // inside the script body — same security posture as EncodedCommand.
    stdout = await runPowerShellScript(script, timeoutMs + 5000)
  } catch (err) {
    const e = err as { stdout?: string; message?: string }
    stdout = e.stdout ?? ''
    if (!stdout) {
      return placements.map((p) => ({
        zoneId: p.zoneId,
        actionTitle: p.actionTitle,
        status: 'not_found' as const,
        reason: e.message ?? 'PowerShell engine failed',
      }))
    }
  }

  // Strip UTF-8 BOM and whitespace that PowerShell may prepend.
  const clean = stdout.replace(/^\uFEFF/, '').trim()

  // Temporary debug — remove once the engine is stable.
  console.log('[windowLayout] raw stdout:', JSON.stringify(clean.slice(0, 500)))

  try {
    const parsed = JSON.parse(clean) as PlacementResult | PlacementResult[]
    // PowerShell's ConvertTo-Json returns a bare object for single items,
    // and an array for multiple. Normalize both to an array.
    const normalized = Array.isArray(parsed) ? parsed : [parsed]
    return normalized
  } catch (parseErr) {
    console.error('[windowLayout] parse failed:', parseErr)
    return placements.map((p) => ({
      zoneId: p.zoneId,
      actionTitle: p.actionTitle,
      status: 'not_found' as const,
      reason: `Could not parse engine output: ${clean.slice(0, 200)}`,
    }))
  }
}

// ──────────────────────────────────────────────
// SCRIPT BUILDER
// ──────────────────────────────────────────────

interface ScriptPlacement {
  zoneId: string
  zoneLabel: string
  x: number
  y: number
  w: number
  h: number
  process: string
  actionType: string
  actionValue: string
  title: string
}

function buildScript(placements: ScriptPlacement[], timeoutMs: number): string {
  const json = JSON.stringify(placements)
  const escapedJson = json.replace(/'/g, "''") // single-quote escape for PS

  return `
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

# ── Make this PowerShell process DPI-aware so [Screen]::WorkingArea and
#    MoveWindow operate in real physical pixels, not Windows-virtualized
#    coordinates. Without this, 125%/150% display scaling causes windows
#    to be sized relative to a fictional smaller screen.
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class DpiHelper {
    [DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
    [DllImport("user32.dll")] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr dpiContext);
}
"@
# DPI_AWARENESS_CONTEXT_PER_MONITOR_AWARE_V2 = -4
# Thread-level: works even after the process has initialised GDI.
[DpiHelper]::SetThreadDpiAwarenessContext([IntPtr](-4)) | Out-Null
# Process-level: harmless fallback for older Windows builds.
[DpiHelper]::SetProcessDPIAware() | Out-Null

# ── Placement list from Node ──
$placements = ConvertFrom-Json @'
${escapedJson}
'@

# ── P/Invoke surface for EnumWindows + MoveWindow + ShowWindow ──
Add-Type -AssemblyName System.Windows.Forms
$code = @"
using System;
using System.Text;
using System.Collections.Generic;
using System.Runtime.InteropServices;

public class WinArranger {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder strText, int maxCount);
    [DllImport("user32.dll")] public static extern int GetWindowTextLength(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

    public class WinItem {
        public IntPtr Handle;
        public string Title;
        public string ProcessName;
        public int X;
        public int Y;
        public int W;
        public int H;
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

            // Skip the shell desktop
            if (procName.Equals("explorer", StringComparison.OrdinalIgnoreCase) &&
               (title.Equals("Program Manager", StringComparison.OrdinalIgnoreCase) || title.Length == 0)) {
                return true;
            }
            // Skip LazyCow itself
            if (procName.ToLower().Contains("lazycow") || title.IndexOf("LazyCow", StringComparison.OrdinalIgnoreCase) >= 0) {
                return true;
            }
            // Skip Windows system helper windows that are technically visible
            // but are effectively invisible overlays (they cover the full
            // screen and would trigger false occupancy in every zone).
            string[] sysIgnore = {
                "TextInputHost",           // Windows Input Experience / IME overlay
                "ShellExperienceHost",     // Start menu, Action Center
                "SearchHost",              // Windows Search
                "StartMenuExperienceHost", // Start menu host
                "LockApp",                 // Lock screen host
                "SystemSettings",          // Settings UWP host (usually hidden)
                "WindowsInternal.ComposableShell.Experiences.TextInput.InputApp",
                "SecurityHealthSystray",
                "SystemSettingsBroker",
                "Microsoft.YourPhone",
            };
            foreach (var ign in sysIgnore) {
                if (procName.Equals(ign, StringComparison.OrdinalIgnoreCase)) {
                    return true;
                }
            }

            RECT r;
            GetWindowRect(hWnd, out r);

            // Skip zero-size or fully-offscreen windows — some system windows
            // report visible but have no usable area.
            int ww = r.Right - r.Left;
            int wh = r.Bottom - r.Top;
            if (ww <= 0 || wh <= 0) return true;

            list.Add(new WinItem {
                Handle = hWnd,
                Title = title,
                ProcessName = procName,
                X = r.Left,
                Y = r.Top,
                W = r.Right - r.Left,
                H = r.Bottom - r.Top
            });
            return true;
        }, IntPtr.Zero);
        return list;
    }

    public static string ResolveDefaultBrowserProcess() {
        try {
            var key = Microsoft.Win32.Registry.CurrentUser.OpenSubKey(
                @"Software\Microsoft\Windows\Shell\Associations\UrlAssociations\http\UserChoice");
            if (key == null) return "chrome";
            var progId = key.GetValue("ProgId") as string ?? "";
            if (progId.Contains("Chrome")) return "chrome";
            if (progId.Contains("Firefox")) return "firefox";
            if (progId.Contains("Brave")) return "brave";
            if (progId.Contains("Opera")) return "opera";
            if (progId.Contains("Edge") || progId.Contains("MSEdge")) return "msedge";
            return "chrome";
        } catch { return "chrome"; }
    }

    public static string ResolveAssociationProcess(string ext) {
        try {
            if (!ext.StartsWith(".")) ext = "." + ext;
            var key = Microsoft.Win32.Registry.ClassesRoot.OpenSubKey(ext);
            if (key == null) return "auto";
            var progId = key.GetValue("") as string ?? "";
            if (string.IsNullOrEmpty(progId)) return "auto";
            var cmdKey = Microsoft.Win32.Registry.ClassesRoot.OpenSubKey(progId + @"\shell\open\command");
            if (cmdKey == null) return "auto";
            var cmd = cmdKey.GetValue("") as string ?? "";
            var match = System.Text.RegularExpressions.Regex.Match(cmd, @"([\w-]+\.exe)");
            if (match.Success) return System.IO.Path.GetFileNameWithoutExtension(match.Groups[1].Value);
            return "auto";
        } catch { return "auto"; }
    }

    // Reliably bring a window to the front, even when called from a
    // background process. AttachThreadInput temporarily merges our input
    // queue with the current foreground thread, which unlocks
    // SetForegroundWindow for the duration of the call.
    public static void ForceForeground(IntPtr hWnd) {
        IntPtr fore = GetForegroundWindow();
        uint forePid = 0;
        uint foreThread = GetWindowThreadProcessId(fore, out forePid);
        uint thisThread = GetCurrentThreadId();
        bool attached = false;
        try {
            if (foreThread != thisThread) {
                attached = AttachThreadInput(foreThread, thisThread, true);
            }
            ShowWindow(hWnd, 9);           // SW_RESTORE (un-minimize)
            BringWindowToTop(hWnd);
            SetForegroundWindow(hWnd);
        } finally {
            if (attached) AttachThreadInput(foreThread, thisThread, false);
        }
    }
}
"@
Add-Type -TypeDefinition $code

# ── Working area of primary monitor ──
$area = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
$areaX = $area.Left
$areaY = $area.Top
$areaW = $area.Width
$areaH = $area.Height

# Diagnostic: log what PowerShell sees
[Console]::Error.WriteLine("SCREEN_DEBUG: area=" + $areaX + "," + $areaY + " " + $areaW + "x" + $areaH + "  BoundsW=" + [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Width + "x" + [System.Windows.Forms.Screen]::PrimaryScreen.Bounds.Height)

# ── Poll for windows up to timeout ──
$deadline = [DateTime]::UtcNow.AddMilliseconds(${timeoutMs})
$allWindows = @()
$expectedProcs = $placements | ForEach-Object { $_.process } | Where-Object { $_ -ne 'auto' } | Select-Object -Unique

while ([DateTime]::UtcNow -lt $deadline) {
    $allWindows = [WinArranger]::GetWindows()
    if ($expectedProcs.Count -eq 0) { break }
    $foundProcs = $allWindows | ForEach-Object { $_.ProcessName } | Select-Object -Unique
    $missing = @($expectedProcs | Where-Object { $_ -notin $foundProcs })
    if ($missing.Count -eq 0) { break }
    Start-Sleep -Milliseconds 250
}

# ── Track which handles we've already placed ──
$usedHandles = [System.Collections.Generic.HashSet[IntPtr]]::new()
$results = @()

function Find-Window($placement) {
    $proc = $placement.process
    if ($proc -eq 'auto') {
        if ($placement.actionType -eq 'open_url') {
            $proc = [WinArranger]::ResolveDefaultBrowserProcess()
        } elseif ($placement.actionType -eq 'open_file') {
            $ext = [System.IO.Path]::GetExtension($placement.actionValue)
            $proc = [WinArranger]::ResolveAssociationProcess($ext)
        }
    }
    if (-not $proc -or $proc -eq 'auto') {
        # Last resort — any unused window with a title
        foreach ($w in $allWindows) {
            if (-not $usedHandles.Contains($w.Handle)) { return $w }
        }
        return $null
    }
    foreach ($w in $allWindows) {
        if ($usedHandles.Contains($w.Handle)) { continue }
        if ($w.ProcessName -eq $proc) { return $w }
    }
    foreach ($w in $allWindows) {
        if ($usedHandles.Contains($w.Handle)) { continue }
        if ($w.ProcessName -like "*$proc*") { return $w }
    }
    return $null
}

# Diagnostic-only: logs who was in the way, but does NOT affect placement.
# Batch 2d — we now claim the assigned zone unconditionally (Windows Snap behavior).
function Log-Zone-Occupancy($zoneX, $zoneY, $zoneW, $zoneH, $ourHandle) {
    $targetX = $areaX + $zoneX * $areaW
    $targetY = $areaY + $zoneY * $areaH
    $targetW = $zoneW * $areaW
    $targetH = $zoneH * $areaH
    $zoneArea = $targetW * $targetH

    foreach ($w in $allWindows) {
        if ($w.Handle -eq $ourHandle) { continue }
        $ox = [Math]::Max($targetX, $w.X)
        $oy = [Math]::Max($targetY, $w.Y)
        $ox2 = [Math]::Min($targetX + $targetW, $w.X + $w.W)
        $oy2 = [Math]::Min($targetY + $targetH, $w.Y + $w.H)
        if ($ox2 -le $ox -or $oy2 -le $oy) { continue }
        $overlapArea = ($ox2 - $ox) * ($oy2 - $oy)
        if ($overlapArea / $zoneArea -gt 0.3) {
            [Console]::Error.WriteLine("OCCUPIED_BY (claimed anyway): proc=$($w.ProcessName) title='$($w.Title)' overlap=$([Math]::Round($overlapArea / $zoneArea * 100, 1))%")
        }
    }
}

function Place-Window($hwnd, $zoneX, $zoneY, $zoneW, $zoneH) {
    $targetX = [int]($areaX + $zoneX * $areaW)
    $targetY = [int]($areaY + $zoneY * $areaH)
    $targetW = [int]($zoneW * $areaW)
    $targetH = [int]($zoneH * $areaH)
    [Console]::Error.WriteLine("PLACE_DEBUG: hwnd=" + $hwnd + " target=" + $targetX + "," + $targetY + " " + $targetW + "x" + $targetH)
    [WinArranger]::ShowWindow($hwnd, 9) | Out-Null   # SW_RESTORE — un-minimize
    Start-Sleep -Milliseconds 50
    $ok = [WinArranger]::MoveWindow($hwnd, $targetX, $targetY, $targetW, $targetH, $true)
    [Console]::Error.WriteLine("PLACE_RESULT: MoveWindow returned " + $ok)
    # Batch 2d — claim the space. Bring to front, matching Windows Snap.
    [WinArranger]::ForceForeground($hwnd)
}

# Place-Centered removed in Batch 2d — we claim the assigned zone instead.

# ── Process each placement ──
# Batch 2d — claim the assigned zone unconditionally (Windows Snap behavior).
# No occupancy fallback, no shifting, no scavenging.
for ($i = 0; $i -lt $placements.Count; $i++) {
    $p = $placements[$i]
    $w = Find-Window $p

    if (-not $w) {
        $results += [PSCustomObject]@{
            zoneId = $p.zoneId
            actionTitle = $p.title
            status = 'not_found'
            reason = "Window for process '$($p.process)' not found"
        }
        continue
    }

    $usedHandles.Add($w.Handle) | Out-Null
    Log-Zone-Occupancy $p.x $p.y $p.w $p.h $w.Handle  # diagnostic only
    Place-Window $w.Handle $p.x $p.y $p.w $p.h
    $results += [PSCustomObject]@{
        zoneId = $p.zoneId
        actionTitle = $p.title
        status = 'placed'
    }
}

# ── Output as JSON ──
$results | ConvertTo-Json -Compress -Depth 5
`
}