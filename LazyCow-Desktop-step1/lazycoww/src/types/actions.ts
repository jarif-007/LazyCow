// ──────────────────────────────────────────────
// SHARED TYPES FOR BUILDER & LIBRARY
// ──────────────────────────────────────────────

export interface ActionItem {
  id: string;
  type: 'launch_app' | 'open_url' | 'open_folder' | 'open_file' | 'set_volume' | 'toggle_dnd' | 'toggle_nightlight' | 'open_vscode' | 'run_script' | 'set_brightness' | 'arrange_windows';
  title: string;
  icon: string;
  colorClass: string;
  value: string;
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
}

// ──────────────────────────────────────────────
// CONSTANTS
// ──────────────────────────────────────────────

export const actionCatalog: CatalogItem[] = [
  // ── Apps & Web ──
  { type: 'launch_app', title: 'Launch App', icon: 'terminal', category: 'Apps & Web', colorClass: 'bg-blue-500/10 text-blue-600 dark:text-blue-400', defaultValue: 'C:\\Program Files\\' },
  { type: 'open_url', title: 'Open URL', icon: 'language', category: 'Apps & Web', colorClass: 'bg-green-500/10 text-green-600 dark:text-green-400', defaultValue: 'https://' },
  { type: 'open_folder', title: 'Open Folder', icon: 'folder_open', category: 'Apps & Web', colorClass: 'bg-orange-500/10 text-orange-600 dark:text-orange-400', defaultValue: 'C:\\Users\\' },
  { type: 'open_file', title: 'Open File', icon: 'description', category: 'Apps & Web', colorClass: 'bg-teal-500/10 text-teal-600 dark:text-teal-400', defaultValue: 'C:\\Users\\' },

  // ── System Control ──
  { type: 'arrange_windows', title: 'Arrange Windows', icon: 'grid_view', category: 'System Control', colorClass: 'bg-pink-500/10 text-pink-600 dark:text-pink-400', defaultValue: '{"layout":"snap_left","apps":{"tl":"","tr":"","bl":"","br":""}}' },
  { type: 'set_volume', title: 'Set Volume', icon: 'volume_up', category: 'System Control', colorClass: 'bg-purple-500/10 text-purple-600 dark:text-purple-400', defaultValue: '50' },
  { type: 'toggle_dnd', title: 'Toggle DND', icon: 'do_not_disturb_on', category: 'System Control', colorClass: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400', defaultValue: 'toggle' },
  { type: 'toggle_nightlight', title: 'Night Light', icon: 'nights_stay', category: 'System Control', colorClass: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400', defaultValue: 'toggle' },
  { type: 'set_brightness', title: 'Set Brightness', icon: 'brightness_medium', category: 'System Control', colorClass: 'bg-amber-500/10 text-amber-600 dark:text-amber-400', defaultValue: '50' },

  // ── Developer Tools ──
  { type: 'run_script', title: 'Run Script', icon: 'code', category: 'Developer Tools', colorClass: 'bg-gray-500/10 text-gray-600 dark:text-gray-400', defaultValue: 'npm run start' },
  { type: 'open_vscode', title: 'Open in VS Code', icon: 'integration_instructions', category: 'Developer Tools', colorClass: 'bg-blue-600/10 text-blue-700 dark:text-blue-300', defaultValue: 'C:\\Projects\\' },
];

export const categoryOrder = ['Apps & Web', 'System Control', 'Developer Tools'];

export const getFieldLabel = (type: ActionItem['type']): string => {
  switch (type) {
    case 'launch_app': return 'Application Path';
    case 'open_url': return 'Website URL';
    case 'open_folder': return 'Folder Path';
    case 'open_file': return 'File Path';
    case 'arrange_windows': return 'Window Layout';
    case 'set_volume': return 'Volume Level';
    case 'toggle_dnd': return 'DND Configuration';
    case 'toggle_nightlight': return 'Night Light Mode';
    case 'open_vscode': return 'Folder Path (opens in VS Code)';
    case 'run_script': return 'Terminal Command';
    case 'set_brightness': return 'Brightness Level';
    default: return 'Value';
  }
};
// ──────────────────────────────────────────────
// BLOCKED TRIGGERS
// ──────────────────────────────────────────────

export const STORAGE_KEY_SHORTCUTS = 'lazycow-shortcuts';
export const STORAGE_KEY_BLOCKED_TRIGGERS = 'lazycow-blocked-triggers';

export const DEFAULT_BLOCKED_TRIGGERS: string[] = [
  'Alt + F4',
  'Ctrl + Alt + Del',
  'Win + L',
  'Win + D',
  'Win + R',
  'Win + E',
  'Win + Tab',
  'Alt + Tab',
  'Ctrl + Shift + Esc',
  'Win + X',
  'Win + I',
  'Win + S',
  'Ctrl + C',
  'Ctrl + V',
  'Ctrl + X',
  'Ctrl + Z',
  'Ctrl + Y',
];