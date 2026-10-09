import React, { useMemo } from 'react';

// Modifier order matters — combo string is always built in this order.
const MODIFIERS = ['Ctrl', 'Alt', 'Shift', 'Win'];

interface KeyOption {
  value: string;   // the physical key we save (e.g. "5", "B", "F12", "Left")
  label: string;   // what the user sees in the dropdown
}

interface KeyGroup {
  label: string;
  keys: KeyOption[];
}

// Physical keys only. Shifted characters (%, !, ?, etc.) are not separate
// entries — the user ticks Shift and picks the base key. This matches how
// the OS thinks about keys and how the recorder saves them, so a combo
// built here always round-trips through the recorder correctly.
const KEY_GROUPS: KeyGroup[] = [
  {
    label: 'Letters',
    keys: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((c) => ({ value: c, label: c })),
  },
  {
    label: 'Number keys',
    keys: [
      { value: '1', label: '1 / !' },
      { value: '2', label: '2 / @' },
      { value: '3', label: '3 / #' },
      { value: '4', label: '4 / $' },
      { value: '5', label: '5 / %' },
      { value: '6', label: '6 / ^' },
      { value: '7', label: '7 / &' },
      { value: '8', label: '8 / *' },
      { value: '9', label: '9 / (' },
      { value: '0', label: '0 / )' },
    ],
  },
  {
    label: 'Function keys',
    keys: Array.from({ length: 24 }, (_, i) => ({
      value: `F${i + 1}`,
      label: `F${i + 1}`,
    })),
  },
  {
    label: 'Symbols',
    keys: [
      { value: '`', label: '` / ~' },
      { value: '-', label: '- / _' },
      { value: '=', label: '= / +' },
      { value: '[', label: '[ / {' },
      { value: ']', label: '] / }' },
      { value: '\\', label: '\\ / |' },
      { value: ';', label: '; / :' },
      { value: '\'', label: "' / \"" },
      { value: ',', label: ', / <' },
      { value: '.', label: '. / >' },
      { value: '/', label: '/ / ?' },
    ],
  },
  {
    label: 'Navigation',
    keys: [
      { value: 'Up', label: 'Up' },
      { value: 'Down', label: 'Down' },
      { value: 'Left', label: 'Left' },
      { value: 'Right', label: 'Right' },
      { value: 'Home', label: 'Home' },
      { value: 'End', label: 'End' },
      { value: 'PageUp', label: 'Page Up' },
      { value: 'PageDown', label: 'Page Down' },
      { value: 'Insert', label: 'Insert' },
    ],
  },
  {
    label: 'Special',
    keys: [
      { value: 'Space', label: 'Space' },
      { value: 'Return', label: 'Enter' },
      { value: 'Esc', label: 'Escape' },
      { value: 'Backspace', label: 'Backspace' },
      { value: 'Delete', label: 'Delete' },
      { value: 'Tab', label: 'Tab' },
    ],
  },
];

const ALL_KEY_VALUES = new Set(KEY_GROUPS.flatMap((g) => g.keys.map((k) => k.value)));

/** Split "Ctrl + Shift + B" into { mods: ['Ctrl','Shift'], key: 'B' }. */
function parseCombo(combo: string): { mods: string[]; key: string | null } {
  if (!combo || combo === 'Listening...') return { mods: [], key: null };
  const parts = combo.split(' + ').map((p) => p.trim()).filter(Boolean);
  const mods: string[] = [];
  let key: string | null = null;
  for (const p of parts) {
    if (MODIFIERS.includes(p)) mods.push(p);
    else key = p;
  }
  if (key && key.length === 1) key = key.toUpperCase();
  return { mods, key };
}

/** Build "Ctrl + Shift + B" from mods + key, ordered consistently. */
function buildCombo(mods: string[], key: string | null): string {
  if (!key) return '';
  const ordered = MODIFIERS.filter((m) => mods.includes(m));
  return [...ordered, key].join(' + ');
}

interface ComboBuilderProps {
  /** The current combo string. Source of truth lives in the parent. */
  value: string;
  /** Called on every change. Parent is expected to persist and re-render. */
  onChange: (combo: string) => void;
}

export const ComboBuilder: React.FC<ComboBuilderProps> = ({ value, onChange }) => {
  const { mods, key } = useMemo(() => parseCombo(value), [value]);
  const keyIsKnown = key ? ALL_KEY_VALUES.has(key) : false;
  const preview = buildCombo(mods, key);

  const toggleMod = (mod: string) => {
    const next = mods.includes(mod) ? mods.filter((m) => m !== mod) : [...mods, mod];
    onChange(buildCombo(next, key));
  };

  const setKey = (newKey: string) => {
    onChange(buildCombo(mods, newKey || null));
  };

  return (
    <div className="pt-4 mt-4 border-t border-border/30">
      <p className="text-[11px] text-muted-foreground/60 font-label-caps uppercase mb-3">
        Or build manually
      </p>

      {/* Modifiers — toggle chips, no duplicates possible */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[11px] uppercase text-muted-foreground font-label-caps w-20 shrink-0">
          Modifiers
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {MODIFIERS.map((mod) => {
            const on = mods.includes(mod);
            return (
              <button
                key={mod}
                type="button"
                onClick={() => toggleMod(mod)}
                className={`px-3 py-1.5 rounded-lg text-body-sm font-medium border transition-colors ${on
                    ? 'bg-primary/15 text-primary border-primary/40'
                    : 'bg-background/50 text-foreground border-border hover:border-primary/40'
                  }`}
              >
                {mod}
              </button>
            );
          })}
        </div>
      </div>

      {/* Key — grouped dropdown, physical keys only */}
      <div className="flex items-center gap-3 mb-3">
        <span className="text-[11px] uppercase text-muted-foreground font-label-caps w-20 shrink-0">
          Key
        </span>
        <select
          value={keyIsKnown ? key! : ''}
          onChange={(e) => setKey(e.target.value)}
          className="flex-1 bg-background/50 border border-border rounded-lg px-3 py-2 font-body-sm text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
        >
          <option value="">
            {key && !keyIsKnown ? `Unknown key: ${key}` : '— Pick a key —'}
          </option>
          {KEY_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.keys.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Live preview */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] uppercase text-muted-foreground font-label-caps w-20 shrink-0">
          Preview
        </span>
        <span className="font-code-sm text-foreground bg-background/60 border border-border rounded-md px-3 py-1.5 min-w-[120px]">
          {preview || <span className="text-muted-foreground/60 italic">— no combo —</span>}
        </span>
      </div>
    </div>
  );
};