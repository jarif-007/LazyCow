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
 * Fast, minimal PowerShell snapshot: return every currently-visible
 * top-level window handle as a comma-separated string.
 *
 * Called by main.ts BEFORE the action loop fires, so windows the shortcut
 * opens can be classified as "new" by the layout engine. Without this,
 * the engine's own PowerShell startup (~400ms) loses the race — browser
 * windows opened by the shortcut are already on screen by the time the
 * snapshot would run, so they're marked "old" and never placed.
 *
 * Uses -EncodedCommand (small script, no 32 KB cap issue) so quoting in
 * the embedded C# here-string survives intact.
 */
export async function snapshotHandles(): Promise<Set<string>> {
    const script = `
$ErrorActionPreference = 'SilentlyContinue'
Add-Type @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
public class Snap {
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc enumProc, IntPtr lParam);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
    public static List<long> Get() {
        var list = new List<long>();
        EnumWindows((h, lp) => { if (IsWindowVisible(h)) list.Add(h.ToInt64()); return true; }, IntPtr.Zero);
        return list;
    }
}
"@
[Snap]::Get() -join ','
`
    const encoded = Buffer.from(script, 'utf16le').toString('base64')
    return new Promise((resolve) => {
        execFile(
            'powershell.exe',
            ['-NoProfile', '-NonInteractive', '-EncodedCommand', encoded],
            { windowsHide: true, maxBuffer: 1024 * 1024, timeout: 5000 },
            (err, stdout) => {
                if (err || !stdout) {
                    console.warn('[snapshotHandles] failed:', err)
                    resolve(new Set())
                    return
                }
                const handles = stdout.trim().split(',').filter(Boolean)
                resolve(new Set(handles))
            }
        )
    })
}

/**
 * Run a multi-line PowerShell script by writing it to a temp .ps1 file and
 * invoking `powershell.exe -File`. This avoids both:
 *   - Windows' ~32 KB command-line cap that `-EncodedCommand` hits on large scripts
 *   - The `-Command -` stdin parser, which mangles nested here-strings
 * User data is JSON-escaped inside the script body — no CLI-injection surface.
 */
async function runPowerShellScript(
    script: string,
    timeoutMs: number,
    signal?: AbortSignal
): Promise<string> {
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
                    // AbortSignal: killing the child process stops the internal
                    // PowerShell polling loop immediately. Without this, cancellation
                    // would have to wait for the poll deadline (up to 60s) before the
                    // process exits — the user would click Cancel and see nothing happen.
                    signal,
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
            const name = base.replace(/\.exe$/i, '').toLowerCase()
            // Shell launchers don't own their window — the window is owned
            // by explorer.exe (classic Control Panel, File Explorer) or
            // ApplicationFrameHost.exe (UWP). Map to the real owner so
            // process-name matching in Find-Window has something to hit.
            if (name === 'control' || name === 'rundll32' || name === 'explorer') {
                return 'explorer'
            }
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
    timeoutMs = 6000,
    preExistingHandles?: Set<string>,
    signal?: AbortSignal
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

    // Pre-sanitize the handle list: digits + commas only. Prevents any
    // possibility of injection via the CSV when it's interpolated into
    // the PowerShell script body.
    const existingHandlesCsv = preExistingHandles
        ? [...preExistingHandles].join(',').replace(/[^0-9,]/g, '')
        : ''
    const script = buildScript(placementsForScript, engineTimeoutMs, existingHandlesCsv)

    let stdout = ''
    try {
        // Subprocess timeout = engine poll budget + 5s headroom.
        const subprocessTimeout = engineTimeoutMs + 5000
        stdout = await runPowerShellScript(script, subprocessTimeout, signal)
    } catch (err) {
        // User aborted mid-poll. Return an empty result set — nothing was
        // placed, and the caller isn't waiting for a status.
        if (signal?.aborted) {
            return []
        }
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

function buildScript(
    placements: ScriptPlacement[],
    engineTimeoutMs: number,
    existingHandlesCsv: string
): string {
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
    [DllImport("user32.dll", CharSet = CharSet.Auto)] public static extern int GetClassName(IntPtr hWnd, StringBuilder lpClassName, int nMaxCount);
    [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);
    [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int nWidth, int nHeight, bool bRepaint);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr hWndInsertAfter, int X, int Y, int cx, int cy, uint uFlags);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr hWnd);
    [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] public static extern int GetWindowLong(IntPtr hWnd, int nIndex);
    [DllImport("user32.dll")] public static extern int SetWindowLong(IntPtr hWnd, int nIndex, int dwNewLong);
    [DllImport("kernel32.dll")] public static extern uint GetCurrentThreadId();
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
    [DllImport("user32.dll", SetLastError = true)] public static extern bool IsImmersiveProcess(IntPtr hProcess);

    [StructLayout(LayoutKind.Sequential)]
    public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }

    [StructLayout(LayoutKind.Sequential)]
    public struct POINT { public int X; public int Y; }

    [StructLayout(LayoutKind.Sequential)]
    public struct WINDOWPLACEMENT {
        public int length;
        public int flags;
        public int showCmd;
        public POINT ptMinPosition;
        public POINT ptMaxPosition;
        public RECT rcNormalPosition;
    }

    [DllImport("user32.dll")] public static extern bool GetWindowPlacement(IntPtr hWnd, ref WINDOWPLACEMENT lpwndpl);
    [DllImport("user32.dll")] public static extern bool SetWindowPlacement(IntPtr hWnd, [In] ref WINDOWPLACEMENT lpwndpl);

    public class WinItem {
        public IntPtr Handle;
        public string Title;
        public string ProcessName;
        public string ClassName;
        public DateTime ProcessStartTime;
        public bool IsUwp;
        public int X;
        public int Y;
        public int W;
        public int H;
    }

    public static bool IsUwpWindow(uint pid) {
        try {
            using (var p = System.Diagnostics.Process.GetProcessById((int)pid)) {
                return IsImmersiveProcess(p.Handle);
            }
        } catch { return false; }
    }

    public static List<WinItem> GetWindows() {
        var list = new List<WinItem>();
        EnumWindows((hWnd, lParam) => {
            if (!IsWindowVisible(hWnd)) return true;
            
            uint pid = 0;
            GetWindowThreadProcessId(hWnd, out pid);
            string procName = "";
            DateTime procStart = DateTime.MinValue;
            try {
                var p = System.Diagnostics.Process.GetProcessById((int)pid);
                procName = p.ProcessName;
                try { procStart = p.StartTime; } catch {}
            } catch {}

            int len = GetWindowTextLength(hWnd);
            var sb = new StringBuilder(len + 1);
            GetWindowText(hWnd, sb, sb.Capacity);
            string title = sb.ToString();

            var classSb = new StringBuilder(256);
            GetClassName(hWnd, classSb, classSb.Capacity);
            string className = classSb.ToString();

            if (procName.Equals("explorer", StringComparison.OrdinalIgnoreCase) && title.Equals("Program Manager", StringComparison.OrdinalIgnoreCase)) {
                return true;
            }
            if (procName.ToLower().Contains("lazycow") || title.IndexOf("LazyCow", StringComparison.OrdinalIgnoreCase) >= 0) {
                return true;
            }
            string[] sysIgnore = {
                "TextInputHost", "ShellExperienceHost", "SearchHost", "StartMenuExperienceHost",
                "LockApp", "SystemSettings", "WindowsInternal.ComposableShell.Experiences.TextInput.InputApp",
                "SecurityHealthSystray", "SystemSettingsBroker", "Microsoft.YourPhone",
            };
            foreach (var ign in sysIgnore) {
                if (procName.Equals(ign, StringComparison.OrdinalIgnoreCase)) return true;
            }

            RECT r;
            GetWindowRect(hWnd, out r);

            int ww = r.Right - r.Left;
            int wh = r.Bottom - r.Top;
            if (ww <= 0 || wh <= 0) return true;

            bool isUwp = IsUwpWindow(pid);
            
            // Force Explorer and Control Panel to be treated as Win32 apps.
            // If they take the UWP branch, Windows passes SWP_NOSIZE and refuses to resize them.
            if (procName.Equals("explorer", StringComparison.OrdinalIgnoreCase) || 
                procName.Equals("control", StringComparison.OrdinalIgnoreCase) ||
                procName.Equals("mmc", StringComparison.OrdinalIgnoreCase)) {
                isUwp = false;
            }

            list.Add(new WinItem {
                Handle = hWnd, Title = title, ProcessName = procName,
                ClassName = className,
                ProcessStartTime = procStart, IsUwp = isUwp,
                X = r.Left, Y = r.Top, W = r.Right - r.Left, H = r.Bottom - r.Top
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

    public static void ForceForeground(IntPtr hWnd) {
        IntPtr fore = GetForegroundWindow();
        uint forePid = 0;
        uint foreThread = GetWindowThreadProcessId(fore, out forePid);
        uint thisThread = GetCurrentThreadId();
        bool attached = false;
        try {
            if (foreThread != thisThread) attached = AttachThreadInput(foreThread, thisThread, true);
            ShowWindow(hWnd, 9);
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

# ── Track which handles we've already placed ──
$usedHandles = [System.Collections.Generic.HashSet[IntPtr]]::new()
$results = @()

# ── Pre-snapshot ──
$existingHandles = [System.Collections.Generic.HashSet[IntPtr]]::new()
$existingCsv = '${existingHandlesCsv}'
if ($existingCsv) {
    foreach ($s in $existingCsv.Split(',')) {
        if ($s) {
            try { $existingHandles.Add([IntPtr][long]$s) | Out-Null } catch { }
        }
    }
}
[Console]::Error.WriteLine("PRE_SNAPSHOT: " + $existingHandles.Count + " windows passed from Node")

# ── URL title helpers ──
function Get-UrlKeyword($url) {
    try {
        $uri = [System.Uri]$url
        if (-not $uri.Host) { return @() }
        $parts = $uri.Host.ToLower().Split('.') | Where-Object { $_ -and $_ -ne 'www' }
        return @($parts)
    } catch { return @() }
}

function Test-TitleMatchesUrl($title, $keywords) {
    if (-not $title) { return $false }
    $normalized = ($title -replace '[^a-zA-Z0-9]', '').ToLower()
    foreach ($kw in $keywords) {
        if ($kw -and $normalized.Contains($kw)) { return $true }
    }
    return $false
}

function Find-Window($placement, $relaxed = $false) {
    $proc = $placement.process
    if ($proc -eq 'auto') {
        if ($placement.actionType -eq 'open_url') {
            $proc = [WinArranger]::ResolveDefaultBrowserProcess()
        } elseif ($placement.actionType -eq 'open_file') {
            $ext = [System.IO.Path]::GetExtension($placement.actionValue)
            $proc = [WinArranger]::ResolveAssociationProcess($ext)
        }
    }

    # Shell launchers: control.exe / rundll32.exe / explorer.exe don't
    # own their window — the window belongs to explorer.exe (classic) or
    # ApplicationFrameHost.exe (UWP). Remember which launcher it was so
    # we can do title-hint matching below.
    $shellLauncher = $null
    if ($placement.actionType -eq 'launch_app') {
        $exeBase = [System.IO.Path]::GetFileNameWithoutExtension($placement.actionValue)
        if ($exeBase) {
            $exeBaseLower = $exeBase.ToLower()
            if ($exeBaseLower -eq 'control' -or $exeBaseLower -eq 'rundll32' -or $exeBaseLower -eq 'explorer') {
                $shellLauncher = $exeBaseLower
                $proc = 'explorer'
            }
        }
    }

    $new = @()
    $old = @()
    if (-not $proc -or $proc -eq 'auto') {
        foreach ($w in $allWindows) {
            if ($usedHandles.Contains($w.Handle)) { continue }
            if ($existingHandles.Contains($w.Handle)) { $old += $w } else { $new += $w }
        }
    } else {
        $strict = @()
        foreach ($w in $allWindows) {
            if ($usedHandles.Contains($w.Handle)) { continue }
            if ($w.ProcessName -eq $proc) { $strict += $w }
        }
        if ($strict.Count -eq 0) {
            foreach ($w in $allWindows) {
                if ($usedHandles.Contains($w.Handle)) { continue }
                if ($w.ProcessName -like "*$proc*") { $strict += $w }
            }
        }
        # Class fallback for shell windows — only known shell classes,
        # never arbitrary windows.
        if ($strict.Count -eq 0 -and $proc -eq 'explorer') {
            $shellClasses = @('CabinetWClass', 'ApplicationFrameWindow', 'ExploreWClass')
            foreach ($w in $allWindows) {
                if ($usedHandles.Contains($w.Handle)) { continue }
                if ($shellClasses -contains $w.ClassName) { $strict += $w }
            }
        }
        foreach ($w in $strict) {
            if ($existingHandles.Contains($w.Handle)) { $old += $w } else { $new += $w }
        }
    }

    # ── open_folder: match folder name in the title ──
    if ($placement.actionType -eq 'open_folder') {
        $cleanPath = $placement.actionValue.TrimEnd('\\', '/')
        $folderName = [System.IO.Path]::GetFileName($cleanPath)
        
        # 1. Try to find a NEW window with the exact folder name
        if ($folderName) {
            foreach ($w in $new) {
                if ($usedHandles.Contains($w.Handle)) { continue }
                if ($w.ProcessName.ToLower().Contains("lazycow")) { continue }
                if ($w.Title -like "*$folderName*") { return $w }
            }
        }
        
        # 2. Fallback: Grab ANY new window that isn't LazyCow. 
        # Explorer reuses the parent process, so ProcessStartTime doesn't change. 
        # We must rely on the pre-snapshot ($new) to find the fresh window.
        foreach ($w in $new) {
            if ($usedHandles.Contains($w.Handle)) { continue }
            if ($w.ProcessName.ToLower().Contains("lazycow")) { continue }
            return $w
        }
        
        # 3. Last resort: Grab an OLD window with the folder name.
        if ($folderName) {
            foreach ($w in $old) {
                if ($usedHandles.Contains($w.Handle)) { continue }
                if ($w.ProcessName.ToLower().Contains("lazycow")) { continue }
                if ($w.Title -like "*$folderName*") { return $w }
            }
        }

        return $null
    }

    # ── open_url: NEW windows only, never old ──
    if ($placement.actionType -eq 'open_url') {
        if ($new.Count -eq 0) { return $null }

        $keywords = Get-UrlKeyword $placement.actionValue
        if ($keywords -and $keywords.Count -gt 0) {
            $titleMatch = @()
            foreach ($w in $new) {
                if (Test-TitleMatchesUrl $w.Title $keywords) { $titleMatch += $w }
            }
            if ($titleMatch.Count -gt 0) {
                $picked = $titleMatch[0]
                [Console]::Error.WriteLine("URL_TITLE_MATCH: " + $placement.actionValue + " -> '" + $picked.Title + "'")
                return $picked
            }
        }

        if (-not $relaxed) { return $null }

        $picked = $new[0]
        [Console]::Error.WriteLine("URL_NEW_FALLBACK: " + $placement.actionValue + " -> '" + $picked.Title + "'")
        return $picked
    }

    # ── shell launchers: prefer by title hint before generic fallback ──
    # control.exe opens a window titled "Control Panel" (classic) or the
    # Settings app (UWP, process ApplicationFrameHost). If we're looking
    # for a control.exe launch, prefer a title match so we don't grab an
    # unrelated Explorer window (e.g. a folder from a sibling open_folder).
    if ($shellLauncher -eq 'control') {
        foreach ($w in $new) {
            if ($usedHandles.Contains($w.Handle)) { continue }
            if ($w.Title -like "*Control Panel*") { return $w }
        }
        foreach ($w in $old) {
            if ($usedHandles.Contains($w.Handle)) { continue }
            if ($w.Title -like "*Control Panel*") { return $w }
        }
    }
    if ($shellLauncher -eq 'explorer') {
        foreach ($w in $new) {
            if ($usedHandles.Contains($w.Handle)) { continue }
            if ($w.Title -like "*File Explorer*") { return $w }
        }
    }

    # ── launch_app / open_file: prefer new, fall back to old ──
    $preferred = if ($new.Count -gt 0) { $new } else { $old }
    if ($preferred.Count -eq 0) { return $null }

    $sorted = $preferred | Sort-Object -Property ProcessStartTime -Descending
    return $sorted[0]
}

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
    
    [Console]::Error.WriteLine("PLACE_DEBUG: hwnd=" + $hwnd + " target=" + $targetX + "," + $targetY + " " + $targetW + "x" + $targetH)

    # Strip WS_MAXIMIZE flag to force Explorer out of its stubborn state
    $style = [WinArranger]::GetWindowLong($hwnd, -16)
    if (($style -band 0x01000000) -ne 0) {
        [WinArranger]::SetWindowLong($hwnd, -16, ($style -band (-bnot 0x01000000))) | Out-Null
    }

    # Force restore (un-maximize) BEFORE moving. SW_SHOWNORMAL (1) is
    # the forceful version — SW_RESTORE (9) only animates the restore
    # and Windows 11 Explorer often ignores it, leaving the window
    # logically maximized while SetWindowPos silently no-ops.
    [WinArranger]::ShowWindow($hwnd, 1) | Out-Null   # SW_SHOWNORMAL
    Start-Sleep -Milliseconds 60

    # Use SetWindowPlacement to forcefully resize the window.
    $winPlacement = New-Object WinArranger+WINDOWPLACEMENT
    $winPlacement.length = [System.Runtime.InteropServices.Marshal]::SizeOf($winPlacement)
    [WinArranger]::GetWindowPlacement($hwnd, [ref]$winPlacement) | Out-Null
    
    $winPlacement.showCmd = 1 # SW_SHOWNORMAL (force restore)
    $winPlacement.rcNormalPosition.Left = $targetX
    $winPlacement.rcNormalPosition.Top = $targetY
    $winPlacement.rcNormalPosition.Right = $targetX + $targetW
    $winPlacement.rcNormalPosition.Bottom = $targetY + $targetH
    
    [WinArranger]::SetWindowPlacement($hwnd, [ref]$winPlacement) | Out-Null
    Start-Sleep -Milliseconds 20

    if ($isUwp) {
        $cur = $null
        foreach ($wi in $allWindows) {
            if ($wi.Handle -eq $hwnd) { $cur = $wi; break }
        }
        $winW = if ($cur) { $cur.W } else { 0 }
        $winH = if ($cur) { $cur.H } else { 0 }
        $centerX = $targetX + [int](($targetW - $winW) / 2)
        $centerY = $targetY + [int](($targetH - $winH) / 2)
        if ($centerX -lt $targetX) { $centerX = $targetX }
        if ($centerY -lt $targetY) { $centerY = $targetY }
        $flags = 0x0004 -bor 0x0001 -bor 0x0010
        [WinArranger]::SetWindowPos($hwnd, [IntPtr]::Zero, $centerX, $centerY, 0, 0, $flags) | Out-Null
    } else {
        # Use SWP_FRAMECHANGED to force Explorer to redraw its frame and accept the resize.
        $flags = 0x0004 -bor 0x0010 -bor 0x0020 # SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED
        $swpOk = [WinArranger]::SetWindowPos($hwnd, [IntPtr]::Zero, $targetX, $targetY, $targetW, $targetH, $flags)
        if (-not $swpOk) {
            $err = [System.Runtime.InteropServices.Marshal]::GetLastWin32Error()
            [Console]::Error.WriteLine("PLACE_FAILED: SetWindowPos returned false, Win32Error=" + $err)
        }
    }

    Start-Sleep -Milliseconds 20
    [WinArranger]::ShowWindow($hwnd, 4) | Out-Null   # SW_SHOWNOACTIVATE
    [Console]::Error.WriteLine("PLACE_RESULT: SetWindowPlacement applied")

    [WinArranger]::ForceForeground($hwnd)
}

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

$placed = @{}
$deadline = [DateTime]::UtcNow.AddMilliseconds(${engineTimeoutMs})
$warmupUntil = [DateTime]::UtcNow.AddMilliseconds(800)
$pollInterval = 15
$allWindows = @()

$lastProgressAt = [DateTime]::UtcNow
$stallThresholdMs = 5000

while ([DateTime]::UtcNow -lt $deadline -and $placed.Count -lt $placements.Count) {
    $allWindows = [WinArranger]::GetWindows()
    $progressThisIteration = $false

    foreach ($p in $placements) {
        $key = if ($p.isUnassigned) { "unassigned-$($p.actionValue)" } else { $p.zoneId }
        if ($placed.ContainsKey($key)) { continue }
        $w = Find-Window $p
        if (-not $w) { continue }

        $usedHandles.Add($w.Handle) | Out-Null
        $placed[$key] = $true
        $progressThisIteration = $true

        if ($p.isUnassigned) {
            Bring-Unassigned-Window $w.Handle
            $results += [PSCustomObject]@{
                zoneId = $p.zoneId
                actionTitle = $p.title
                status = 'placed'
                reason = 'unassigned — brought to front'
            }
        } else {
            Log-Zone-Occupancy $p.x $p.y $p.w $p.h $w.Handle
            Place-Window $w.Handle $p.x $p.y $p.w $p.h $w.IsUwp
            $results += [PSCustomObject]@{
                zoneId = $p.zoneId
                actionTitle = $p.title
                status = 'placed'
            }
        }
    }

    if ($progressThisIteration) {
        $lastProgressAt = [DateTime]::UtcNow
    } elseif (([DateTime]::UtcNow - $lastProgressAt).TotalMilliseconds -gt $stallThresholdMs) {
        [Console]::Error.WriteLine("STALL_EXIT: no placements in " + $stallThresholdMs + "ms — exiting poll loop early")
        break
    }

    if ($placed.Count -eq $placements.Count) { break }
    Start-Sleep -Milliseconds $pollInterval
    if ([DateTime]::UtcNow -lt $warmupUntil) {
        $pollInterval = 15
    } else {
        $pollInterval = [Math]::Min(200, $pollInterval + 25)
    }
}

$allWindows = [WinArranger]::GetWindows()
foreach ($p in $placements) {
    $key = if ($p.isUnassigned) { "unassigned-$($p.actionValue)" } else { $p.zoneId }
    if ($placed.ContainsKey($key)) { continue }

    $w = Find-Window $p $true
    if ($w) {
        $usedHandles.Add($w.Handle) | Out-Null
        $placed[$key] = $true
        [Console]::Error.WriteLine("FALLBACK_PLACED: " + $p.title + " — placed via relaxed match")
        if ($p.isUnassigned) {
            Bring-Unassigned-Window $w.Handle
            $results += [PSCustomObject]@{
                zoneId = $p.zoneId
                actionTitle = $p.title
                status = 'placed'
                reason = 'unassigned — brought to front (fallback)'
            }
        } else {
            Log-Zone-Occupancy $p.x $p.y $p.w $p.h $w.Handle
            Place-Window $w.Handle $p.x $p.y $p.w $p.h $w.IsUwp
            $results += [PSCustomObject]@{
                zoneId = $p.zoneId
                actionTitle = $p.title
                status = 'placed'
                reason = 'placed via fallback (no title match)'
            }
        }
    } else {
        $results += [PSCustomObject]@{
            zoneId = $p.zoneId
            actionTitle = $p.title
            status = 'not_found'
            reason = "Window for process '$($p.process)' not found within the polling window"
        }
    }
}

$results | ConvertTo-Json -Compress -Depth 5
`
}