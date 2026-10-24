// ──────────────────────────────────────────────
// SHARED TYPES FOR BUILDER & LIBRARY
// ──────────────────────────────────────────────

export interface ActionItem {
  id: string;
  type: 'launch_app' | 'open_url' | 'open_folder' | 'open_file' | 'set_volume' | 'toggle_dnd' | 'toggle_nightlight' | 'run_script' | 'set_brightness' | 'delay';
  title: string;
  icon: string;
  colorClass: string;
  value: string;
  /**
   * Per-action override for the Dangerous/Safe classification. When absent,
   * the label is computed from the action type + value (see
   * `getActionLabel` in utils/danger.ts). When present, it's locked to the
   * user's choice regardless of value changes.
   *
   * There is intentionally no "reset to auto" UI — once the user sets an
   * override, picking the other label is the only way to change it.
   */
  safetyOverride?: 'dangerous' | 'safe';
}

export interface CatalogItem {
  type: ActionItem['type'];
  title: string;
  icon: string;
  category: string;
  colorClass: string;
  defaultValue: string;
  disabled?: boolean;
  disabledLabel?: string;
}

export interface SavedShortcut {
  id: string;
  name: string;
  description: string;
  hotkey: string;
  actions: ActionItem[];
  createdAt: string;
  /** Shortcut-level window arrangement config. Optional for backward compat. */
  windowLayout?: WindowLayoutConfig;
  /**
   * When true, running this shortcut (button or hotkey) requires confirmation
   * first — a modal when the app is focused, a toast when it's minimized.
   * Absent = default based on `securedShortcutsEnabled` at creation time.
   */
  secured?: boolean;
  /** True if the user has manually toggled the secured status for this shortcut. */
  isSecuredCustom?: boolean;
}

// ──────────────────────────────────────────────
// WINDOW LAYOUT (Arrange Windows v2)
// ──────────────────────────────────────────────

export type LayoutId =
  | 'split_50'
  | 'split_67_33'
  | 'split_33_67'
  | 'thirds'
  | 'main_left'
  | 'main_right'
  | 'quad';

export interface LayoutZone {
  /** Stable zone ID (e.g. 'left', 'top_right'). */
  id: string;
  /** Human-readable label shown in the assignment UI. */
  label: string;
  /** Fraction of working area (0–1). */
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface LayoutDefinition {
  id: LayoutId;
  label: string;
  zoneCount: number;
  zones: LayoutZone[];
}

export interface WindowLayoutConfig {
  enabled: boolean;
  layoutId: LayoutId | null;
  /** Map of zoneId → ActionItem.id (the action assigned to that zone). */
  assignments: Record<string, string>;
}

/** Runtime payload sent from the renderer to the main process. */
export interface WindowLayoutRequest {
  shortcutName: string;
  layoutId: LayoutId;
  /** Ordered by zone position — the runtime processes them in this order. */
  placements: Array<{
    zoneId: string;
    zoneLabel: string;
    zone: { x: number; y: number; w: number; h: number };
    actionType: string;
    actionValue: string;
    actionTitle: string;
  }>;
}

/** Runtime result — one entry per attempted placement. */
export interface WindowLayoutResult {
  zoneId: string;
  actionTitle: string;
  status: 'placed' | 'fallback_centered' | 'not_found' | 'skipped';
  reason?: string;
}

export const LAYOUTS: LayoutDefinition[] = [
  {
    id: 'split_50',
    label: '50 / 50',
    zoneCount: 2,
    zones: [
      { id: 'left',  label: 'Left',  x: 0,   y: 0, w: 0.5, h: 1 },
      { id: 'right', label: 'Right', x: 0.5, y: 0, w: 0.5, h: 1 },
    ],
  },
  {
    id: 'split_67_33',
    label: '67 / 33',
    zoneCount: 2,
    zones: [
      { id: 'main_left', label: 'Main Left', x: 0,    y: 0, w: 0.67, h: 1 },
      { id: 'right',     label: 'Right',     x: 0.67, y: 0, w: 0.33, h: 1 },
    ],
  },
  {
    id: 'split_33_67',
    label: '33 / 67',
    zoneCount: 2,
    zones: [
      { id: 'left',       label: 'Left',       x: 0,    y: 0, w: 0.33, h: 1 },
      { id: 'main_right', label: 'Main Right', x: 0.33, y: 0, w: 0.67, h: 1 },
    ],
  },
  {
    id: 'thirds',
    label: 'Three Columns',
    zoneCount: 3,
    zones: [
      { id: 'left',   label: 'Left',   x: 0,     y: 0, w: 0.333, h: 1 },
      { id: 'center', label: 'Center', x: 0.333, y: 0, w: 0.334, h: 1 },
      { id: 'right',  label: 'Right',  x: 0.667, y: 0, w: 0.333, h: 1 },
    ],
  },
  {
    id: 'main_left',
    label: 'Main Left + Stack',
    zoneCount: 3,
    zones: [
      { id: 'main_left',    label: 'Main Left',    x: 0,   y: 0,   w: 0.5, h: 1 },
      { id: 'top_right',    label: 'Top Right',    x: 0.5, y: 0,   w: 0.5, h: 0.5 },
      { id: 'bottom_right', label: 'Bottom Right', x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
  {
    id: 'main_right',
    label: 'Stack + Main Right',
    zoneCount: 3,
    zones: [
      { id: 'top_left',    label: 'Top Left',    x: 0,   y: 0,   w: 0.5, h: 0.5 },
      { id: 'bottom_left', label: 'Bottom Left', x: 0,   y: 0.5, w: 0.5, h: 0.5 },
      { id: 'main_right',  label: 'Main Right',  x: 0.5, y: 0,   w: 0.5, h: 1 },
    ],
  },
  {
    id: 'quad',
    label: 'Quad Grid',
    zoneCount: 4,
    zones: [
      { id: 'tl', label: 'Top Left',     x: 0,   y: 0,   w: 0.5, h: 0.5 },
      { id: 'tr', label: 'Top Right',    x: 0.5, y: 0,   w: 0.5, h: 0.5 },
      { id: 'bl', label: 'Bottom Left',  x: 0,   y: 0.5, w: 0.5, h: 0.5 },
      { id: 'br', label: 'Bottom Right', x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ],
  },
];

/** Action types whose runtime produces a visible window we can arrange. */
export const ARRANGEABLE_ACTION_TYPES = new Set([
  'launch_app',
  'open_url',
  'open_folder',
  'open_file',
]);

export function isArrangeable(action: ActionItem): boolean {
  return ARRANGEABLE_ACTION_TYPES.has(action.type)
}

/**
 * True when the value is a Windows shell URI — a UWP app
 * (`shell:AppsFolder\Microsoft.WindowsCalculator_8wekyb3d8bbwe!App`) or a
 * shell folder (`shell:MyComputerFolder`, `shell:RecycleBinFolder`, etc.).
 * These launch via `shell.openExternal` or `explorer.exe`, never via a
 * file path — so the `.exe` extension check and the path-existence check
 * do not apply. Single source of truth for "is this a shell action value".
 */
export function isUwpPath(value: string): boolean {
  return typeof value === 'string' && value.startsWith('shell:')
}

// ──────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────

export const actionCatalog: CatalogItem[] = [
  // ── Apps & Web ──
  { type: 'launch_app', title: 'Launch App', icon: 'terminal', category: 'Apps & Web', colorClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', defaultValue: '' },
  { type: 'open_url', title: 'Open URL', icon: 'language', category: 'Apps & Web', colorClass: 'bg-green-500/10 text-green-600 dark:text-green-400', defaultValue: '' },
  { type: 'open_folder', title: 'Open Folder', icon: 'folder_open', category: 'Apps & Web', colorClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400', defaultValue: '' },
  { type: 'open_file', title: 'Open File', icon: 'description', category: 'Apps & Web', colorClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-400', defaultValue: '' },

  // ── System Control ──
  { type: 'set_volume', title: 'Set Volume', icon: 'volume_up', category: 'System Control', colorClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400', defaultValue: '50' },
  { type: 'toggle_dnd', title: 'Turn DND On/Off', icon: 'do_not_disturb_on', category: 'System Control', colorClass: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400', defaultValue: 'enable' },
  { type: 'toggle_nightlight', title: 'Turn Night Light On/Off', icon: 'nights_stay', category: 'System Control', colorClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400', defaultValue: 'enable' },
  { type: 'set_brightness', title: 'Set Brightness', icon: 'brightness_medium', category: 'System Control', colorClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', defaultValue: '50' },
  { type: 'delay', title: 'Wait / Delay', icon: 'schedule', category: 'System Control', colorClass: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400', defaultValue: '1000' },

  // ── Developer Tools ──
  { type: 'run_script', title: 'Run Script', icon: 'code', category: 'Developer Tools', colorClass: 'bg-gray-500/10 text-gray-600 dark:text-gray-400', defaultValue: 'npm run start' },
];

export const categoryOrder = ['Apps & Web', 'System Control', 'Developer Tools'];

export const getFieldLabel = (type: ActionItem['type']): string => {
  switch (type) {
    case 'launch_app': return 'Application Path';
    case 'open_url': return 'Website URL';
    case 'open_folder': return 'Folder Path';
    case 'open_file': return 'File Path';
    case 'set_volume': return 'Volume Level';
    case 'toggle_dnd': return 'DND Configuration';
    case 'toggle_nightlight': return 'Night Light Mode';
    case 'run_script': return 'Terminal Command';
    case 'set_brightness': return 'Brightness Level';
    case 'delay': return 'Delay Duration (ms)';
    default: return 'Value';
  }
};
// ──────────────────────────────────────────────
// BLOCKED TRIGGERS
// ──────────────────────────────────────────────

export const STORAGE_KEY_SHORTCUTS = 'lazycow-shortcuts';
export const STORAGE_KEY_BLOCKED_TRIGGERS = 'lazycow-blocked-triggers';

export const DEFAULT_BLOCKED_TRIGGERS: string[] = [
  // ── System-critical ──
  'Alt + F4',
  'Ctrl + Alt + Delete',
  'Ctrl + Shift + Esc',
  'Alt + Tab',
  'Win + Tab',

  // ── Windows clipboard / undo-redo ──
  'Ctrl + C', 'Ctrl + V', 'Ctrl + X', 'Ctrl + Z', 'Ctrl + Y',

  // ── Win + letter ──
  // Windows reserves the full Win+<letter> space for shell features.
  // globalShortcut.register() returns false for these — no app can claim
  // them. Included by default so the user sees WHY in Settings; they can
  // remove any entry if they've remapped the key with a tool like AHK.
  'Win + A', 'Win + B', 'Win + C', 'Win + D', 'Win + E', 'Win + F',
  'Win + G', 'Win + H', 'Win + I', 'Win + J', 'Win + K', 'Win + L',
  'Win + M', 'Win + N', 'Win + O', 'Win + P', 'Win + Q', 'Win + R',
  'Win + S', 'Win + T', 'Win + U', 'Win + V', 'Win + W', 'Win + X',
  'Win + Y', 'Win + Z',

  // ── Win + symbol ──
  'Win + .', 'Win + ;', 'Win + ,',
];