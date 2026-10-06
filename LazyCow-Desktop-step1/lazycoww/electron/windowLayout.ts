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
  /**
   * True when the user left this action unassigned. The engine brings the
   * window to front without resizing it. See decisions.md — "User-judge
   * replaces UWP heuristic as the primary mechanism".
   */
  isUnassigned?: boolean
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
 * Behavior (Batch 2d + 2c-polish):
 *  1. For each placement, poll for its window (50ms warmup → 250ms taper,
 *     capped at 3s per placement).
 *  2. As soon as a window is found, claim its assigned zone unconditionally
 *     (matches Windows Snap — anything in the way goes behind).
 *  3. Bring the window to the front via ForceForeground (AttachThreadInput
 *     + BringWindowToTop + SetForegroundWindow).
 *  4. Window not found within its poll window → not_found.
 *
 * No occupancy fallback, no shifting, no scavenging — the earlier
 * center-small behavior was superseded by user feedback.
 */
export async function arrangeWindows(
  placements: Placement[],
  timeoutMs = 6000
): Promise<PlacementResult[]> {
  if (placements.length === 0) return []
  const engineTimeoutMs = Math.min(timeoutMs, 90000)

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
    isUnassigned: p.isUnassigned === true,
  }))

  const script = buildScript(placementsForScript, engineTimeoutMs)

  let stdout = ''
  try {
    // Subprocess timeout = engine poll budget + 5s headroom.
    const subprocessTimeout = engineTimeoutMs + 5000
    stdout = await runPowerShellScript(script, subprocessTimeout)
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
  isUnassigned: boolean
}

function buildScript(placements: ScriptPlacement[], engineTimeoutMs: number): string {
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
    [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool IsImmersiveProcess(IntPtr hProcess);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

    public class WinItem {
        public IntPtr Handle;
        public string Title;
        public string ProcessName;
        public DateTime ProcessStartTime;   // used to prefer newest windows
        public bool IsUwp;                  // hosted by ApplicationFrameHost — position-only
        public int X;
        public int Y;
        public int W;
        public int H;
    }

    // True if the given process is a UWP/modern-shell app.
    // Uses Windows' own IsImmersiveProcess — authoritative and stable across
    // Windows updates (unlike process-name allow-lists, which break every
    // time a package is renamed, e.g. calc → calc1).
    public static bool IsUwpWindow(uint pid) {
        try {
            using (var p = System.Diagnostics.Process.GetProcessById((int)pid)) {
                return IsImmersiveProcess(p.Handle);
            }
        } catch {
            // If we can't open the process (access denied, exited), assume
            // it's not UWP. Stretching is the safer default.
            return false;
        }
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
            DateTime procStart = DateTime.MinValue;
            try {
                var p = System.Diagnostics.Process.GetProcessById((int)pid);
                procName = p.ProcessName;
                try { procStart = p.StartTime; } catch { /* access denied on some system procs */ }
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

            // UWP detection via Windows' own IsImmersiveProcess — authoritative,
            // requires no elevation, and survives Windows updates that rename
            // process images (calc → calc1, etc.).
            bool isUwp = IsUwpWindow(pid);

            list.Add(new WinItem {
                Handle = hWnd,
                Title = title,
                ProcessName = procName,
                ProcessStartTime = procStart,
                IsUwp = isUwp,
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

# ── Poll + place each window as soon as it appears (Batch 2c-polish) ──
# Instead of waiting for ALL windows then placing them together, we now
# poll each placement individually with a fast interval, and place it
# the moment it's found. This cuts the "small window then snap" gap.
# We no longer use a single global poll loop.

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

    # Collect ALL unused candidate windows matching the process, then
    # pick the one whose process started most recently. This prefers
    # the window the shortcut JUST launched over a stale leftover.
    $candidates = @()
    if (-not $proc -or $proc -eq 'auto') {
        foreach ($w in $allWindows) {
            if (-not $usedHandles.Contains($w.Handle)) { $candidates += $w }
        }
    } else {
        foreach ($w in $allWindows) {
            if ($usedHandles.Contains($w.Handle)) { continue }
            if ($w.ProcessName -eq $proc) { $candidates += $w }
        }
        if ($candidates.Count -eq 0) {
            foreach ($w in $allWindows) {
                if ($usedHandles.Contains($w.Handle)) { continue }
                if ($w.ProcessName -like "*$proc*") { $candidates += $w }
            }
        }
    }

    if ($candidates.Count -eq 0) { return $null }

    # Prefer the newest process. Sort by ProcessStartTime descending.
    $sorted = $candidates | Sort-Object -Property ProcessStartTime -Descending
    return $sorted[0]
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

function Place-Window($hwnd, $zoneX, $zoneY, $zoneW, $zoneH, $isUwp) {
    $targetX = [int]($areaX + $zoneX * $areaW)
    $targetY = [int]($areaY + $zoneY * $areaH)
    $targetW = [int]($zoneW * $areaW)
    $targetH = [int]($zoneH * $areaH)
    $strategy = if ($isUwp) { 'native-centered' } else { 'stretched' }
    [Console]::Error.WriteLine("PLACE_DEBUG: hwnd=" + $hwnd + " target=" + $targetX + "," + $targetY + " " + $targetW + "x" + $targetH + " strategy=" + $strategy)

    # If the window is already at the target rect (within a small tolerance),
    # skip the whole hide→move→show cycle — the visible hide/re-show was
    # what the user perceived as a "flicker" when re-running a shortcut
    # whose apps were already correctly placed.
    $current = $null
    foreach ($wi in $allWindows) {
        if ($wi.Handle -eq $hwnd) { $current = $wi; break }
    }
    if ($current) {
        $dx = [Math]::Abs($current.X - $targetX)
        $dy = [Math]::Abs($current.Y - $targetY)
        $dw = [Math]::Abs($current.W - $targetW)
        $dh = [Math]::Abs($current.H - $targetH)
        if ($dx -le 8 -and $dy -le 8 -and $dw -le 8 -and $dh -le 8) {
            [Console]::Error.WriteLine("PLACE_SKIP: already at target rect (±8px)")
            [WinArranger]::ForceForeground($hwnd)
            return
        }
    }

    [WinArranger]::ShowWindow($hwnd, 0) | Out-Null   # SW_HIDE
    Start-Sleep -Milliseconds 20

    if ($isUwp) {
        # UWP apps (Calculator, Settings, Photos) declare a MaxWidth /
        # MaxHeight in their manifest. Windows refuses to grow them beyond
        # that. Move position-only via SetWindowPos with SWP_NOSIZE, but
        # CENTER the window within the zone so it doesn't sit pinned to
        # the top-left corner with dead space around it.
        #
        # We don't know the app's actual size here, so we use the current
        # rect (passed in by the caller as $w in the outer scope via
        # $allWindows). We look it up again here to stay self-contained.
        $cur = $null
        foreach ($wi in $allWindows) {
            if ($wi.Handle -eq $hwnd) { $cur = $wi; break }
        }
        $winW = if ($cur) { $cur.W } else { 0 }
        $winH = if ($cur) { $cur.H } else { 0 }
        $centerX = $targetX + [int](($targetW - $winW) / 2)
        $centerY = $targetY + [int](($targetH - $winH) / 2)
        # Clamp so we don't go above/left of the zone
        if ($centerX -lt $targetX) { $centerX = $targetX }
        if ($centerY -lt $targetY) { $centerY = $targetY }

        # SWP_NOZORDER = 0x0004, SWP_NOSIZE = 0x0001, SWP_NOACTIVATE = 0x0010
        $flags = 0x0004 -bor 0x0001 -bor 0x0010
        $ok = [WinArranger]::SetWindowPos($hwnd, [IntPtr]::Zero, $centerX, $centerY, 0, 0, $flags)
    } else {
        $ok = [WinArranger]::MoveWindow($hwnd, $targetX, $targetY, $targetW, $targetH, $true)
    }

    Start-Sleep -Milliseconds 20
    [WinArranger]::ShowWindow($hwnd, 4) | Out-Null   # SW_SHOWNOACTIVATE
    [Console]::Error.WriteLine("PLACE_RESULT: MoveWindow returned " + $ok)

    [WinArranger]::ForceForeground($hwnd)
}

# Place-Centered removed in Batch 2d — we claim the assigned zone instead.

# Bring an unassigned window to front, centered on the primary monitor
# at its current size. We never resize — some apps (UWP especially) refuse
# to be resized and Windows snaps them back, causing a visual glitch.
# Centering at native size is deterministic: whatever Windows remembers
# about the window's last position, it comes back to the middle of the
# screen where the user expects to see it.
function Bring-Unassigned-Window($hwnd) {
    $cur = $null
    foreach ($wi in $allWindows) {
        if ($wi.Handle -eq $hwnd) { $cur = $wi; break }
    }

    if ($cur) {
        $prim = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
        $cx = [int]($prim.Left + ($prim.Width - $cur.W) / 2)
        $cy = [int]($prim.Top + ($prim.Height - $cur.H) / 2)
        [Console]::Error.WriteLine("UNASSIGNED_CENTER: hwnd=" + $hwnd + " size=" + $cur.W + "x" + $cur.H + " — centering to " + $cx + "," + $cy)
        [WinArranger]::MoveWindow($hwnd, $cx, $cy, $cur.W, $cur.H, $true) | Out-Null
    }

    [WinArranger]::ForceForeground($hwnd)
}

# ── Place each window as soon as it appears (Batch 2c-polish v2) ──
# One global polling loop. Each iteration re-scans ALL not-yet-placed
# placements. A slow or failed launch never blocks the others — apps that
# are already on screen snap immediately, and a window that never appears
# just falls through to not_found at the deadline.
$placed = @{}                        # zoneId → $true
$deadline = [DateTime]::UtcNow.AddMilliseconds(${engineTimeoutMs})
# Fast warmup: poll every 15ms for the first 800ms (catches freshly-shown
# windows before the user's eye registers them), then taper to 100ms.
$warmupUntil = [DateTime]::UtcNow.AddMilliseconds(800)
$pollInterval = 15
$allWindows = @()

while ([DateTime]::UtcNow -lt $deadline -and $placed.Count -lt $placements.Count) {
    $allWindows = [WinArranger]::GetWindows()

    foreach ($p in $placements) {
        $key = if ($p.isUnassigned) { "unassigned-$($p.actionValue)" } else { $p.zoneId }
        if ($placed.ContainsKey($key)) { continue }
        $w = Find-Window $p
        if (-not $w) { continue }

        $usedHandles.Add($w.Handle) | Out-Null
        $placed[$key] = $true

        if ($p.isUnassigned) {
            Bring-Unassigned-Window $w.Handle
            $results += [PSCustomObject]@{
                zoneId = $p.zoneId
                actionTitle = $p.title
                status = 'placed'
                reason = 'unassigned — brought to front'
            }
        } else {
            Log-Zone-Occupancy $p.x $p.y $p.w $p.h $w.Handle  # diagnostic only
            Place-Window $w.Handle $p.x $p.y $p.w $p.h $w.IsUwp
            $results += [PSCustomObject]@{
                zoneId = $p.zoneId
                actionTitle = $p.title
                status = 'placed'
            }
        }
    }

    if ($placed.Count -eq $placements.Count) { break }
    Start-Sleep -Milliseconds $pollInterval
    # Stay fast during warmup, then taper.
    if ([DateTime]::UtcNow -lt $warmupUntil) {
        $pollInterval = 15
    } else {
        $pollInterval = [Math]::Min(200, $pollInterval + 25)
    }
}

# Anything never found becomes not_found
foreach ($p in $placements) {
    $key = if ($p.isUnassigned) { "unassigned-$($p.actionValue)" } else { $p.zoneId }
    if (-not $placed.ContainsKey($key)) {
        $results += [PSCustomObject]@{
            zoneId = $p.zoneId
            actionTitle = $p.title
            status = 'not_found'
            reason = "Window for process '$($p.process)' not found within the polling window"
        }
    }
}

# ── Output as JSON ──
$results | ConvertTo-Json -Compress -Depth 5
`
}