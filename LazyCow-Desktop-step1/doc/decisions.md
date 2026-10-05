# LazyCow — Decision Log
Append-only. Never delete. Each entry: date, decision, alternatives, why, consequence, status.

## 2026-09-15 — Cancellation is graceful-only
- **Decision:** cancel-shortcut always finishes the current action, then stops.
- **Alternatives:** Immediate mode with taskkill (tried; killed unrelated windows).
- **Why:** taskkill /t /f kills the whole process tree, including unrelated Explorer windows.
- **Consequence:** cancel is slower but safe. UI shows "Cancelling..." spinner.
- **Status:** active

## 2026-09-28 — Window Layout is shortcut-level, not an action
- **Decision:** windowLayout is a property of SavedShortcut, not an arrange_windows action.
- **Alternatives:** Standalone action card in the sequence.
- **Why:** arrangement must run last; its UI needs global knowledge of eligible actions; users shouldn't have to remember ordering.
- **Consequence:** arrange_windows removed from catalog; old shortcuts fall back via unsupported-action flag.
- **Status:** active

## 2026-09-28 — No shift-to-nearest-zone on occupied slot
- **Decision:** if the assigned zone is occupied, the app goes to center-small (60%) — no shifting.
- **Alternatives:** Shift to nearest free zone.
- **Why:** shifting silently breaks the user's design. Center-small is predictable.
- **Consequence:** last-app-scavenge exception (only when an earlier app failed and left its zone free).
- **Status:** active

## 2026-09-28 — 7 layouts total (Windows 6 + quad)
- **Decision:** LAYOUTS includes split_50, split_67_33, split_33_67, thirds, main_left, main_right, quad.
- **Alternatives:** Windows' 6 only (no quad); or more layouts.
- **Why:** quad is standard Windows on 4K/ultrawide, and 4-app workflows need it. Cheap to add.
- **Status:** active

## 2026-10-01 — PowerShell via temp .ps1 file, not -EncodedCommand
- **Decision:** windowLayout.ts writes the script to os.tmpdir() and runs `powershell.exe -File`.
- **Alternatives:** -EncodedCommand (hit Windows CreateProcess length cap); `-Command -` via stdin (broke here-strings).
- **Why:** the script exceeds ~32 KB once the C# P/Invoke block is included. -File is the standard fallback.
- **Consequence:** context.md §6 rule about -EncodedCommand has an explicit exception for windowLayout.ts.
- **Status:** active

## 2026-10-06 — DPI awareness fix VERIFIED
- **Decision:** make PowerShell DPI-aware via `__COMPAT_LAYER=HIGHDPIAWARE` env var on execFile + `SetThreadDpiAwarenessContext(-4)` in script (PER_MONITOR_AWARE_V2). Plus `using System;` in the C# block for `IntPtr`.
- **Alternatives:** `SetProcessDPIAware()` alone (tried; no-op because PowerShell initialized GDI before the script runs).
- **Why:** the DPI-unaware PowerShell computed zone rectangles in virtualized coordinates (1536×864 on 1920×1080 @ 125%), causing partial placement.
- **Consequence:** VERIFIED — Notepad now snaps to the full left half. `SCREEN_DEBUG` reports `1920x1050` (physical) instead of `1536x864` (virtualized).
- **Status:** active

## 2026-10-06 — Block system helper windows from occupancy detection
- **Decision:** in `GetWindows`, blocklist known Windows system helper processes: `TextInputHost`, `ShellExperienceHost`, `SearchHost`, `StartMenuExperienceHost`, `LockApp`, `SystemSettings`, `SecurityHealthSystray`, `SystemSettingsBroker`, `Microsoft.YourPhone`. Also skip any window with `w <= 0 || h <= 0`.
- **Alternatives:** detect invisible overlays by transparency — unreliable, no public API.
- **Why:** `TextInputHost.exe` ("Windows Input Experience") covers the entire screen but is invisible to the user. The occupancy check flagged every zone as occupied, blocking placement.
- **Consequence:** Occupancy now reflects what the user actually sees. Extend the blocklist if more false positives surface.
- **Status:** active

## 2026-10-06 — Normalize single-object PowerShell JSON to array
- **Decision:** after `JSON.parse`, wrap bare objects in `[ ]` — `Array.isArray(parsed) ? parsed : [parsed]`.
- **Alternatives:** force PowerShell to always emit `@(...)` — brittle with `ConvertTo-Json`.
- **Why:** `ConvertTo-Json` collapses single-element arrays to a bare object, which broke `Array.isArray(parsed)` check.
- **Consequence:** single-placement tests now work.
- **Status:** active