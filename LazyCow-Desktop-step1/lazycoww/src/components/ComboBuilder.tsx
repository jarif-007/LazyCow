import React, { useState } from 'react';

const MODIFIERS = ['Ctrl', 'Alt', 'Shift', 'Win'];
const KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').concat(
  'F1 F2 F3 F4 F5 F6 F7 F8 F9 F10 F11 F12'.split(' '),
  '0 1 2 3 4 5 6 7 8 9'.split(' '),
  'Space Enter Backspace Delete Escape Tab'.split(' ')
);

interface ComboBuilderProps {
  onApply: (combo: string) => void;
  onError: (msg: string) => void;
}

export const ComboBuilder: React.FC<ComboBuilderProps> = ({ onApply, onError }) => {
  const [modifiers, setModifiers] = useState<string[]>(['']);
  const [keys, setKeys] = useState<string[]>(['']);

  const addModifier = () => setModifiers((p) => [...p, '']);
  const addKey = () => setKeys((p) => [...p, '']);
  const removeModifier = (i: number) => { if (modifiers.length > 1) setModifiers((p) => p.filter((_, j) => j !== i)); };
  const removeKey = (i: number) => { if (keys.length > 1) setKeys((p) => p.filter((_, j) => j !== i)); };

  const handleApply = () => {
    const activeMods = modifiers.filter((m) => m !== '');
    const activeKeys = keys.filter((k) => k !== '');
    
    if (activeMods.length === 0) { onError('At least one modifier (Ctrl, Alt, Shift, or Win) is required.'); return; }
    if (activeKeys.length === 0) { onError('At least one key is required.'); return; }
    
    // Modifiers always come first
    const combo = [...activeMods, ...activeKeys].join(' + ');
    onApply(combo);
    setModifiers(['']); setKeys(['']);
  };

  return (
    <div className="pt-3 border-t border-border/30">
      <p className="text-[11px] text-muted-foreground/50 font-label-caps uppercase mb-2">Or build manually (for OS shortcuts):</p>
      <div className="flex items-center gap-2 flex-wrap">
        {/* Modifier slots */}
        {modifiers.map((m, i) => (
          <React.Fragment key={`m-${i}`}>
            <div className="flex items-center gap-1">
              <select value={m} onChange={(e) => setModifiers((p) => p.map((v, j) => (j === i ? e.target.value : v)))}
                className="bg-background/50 border border-border rounded-lg px-3 py-2 font-body-sm text-foreground focus:ring-1 focus:ring-primary focus:outline-none">
                <option value="">- Mod -</option>
                {MODIFIERS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              {modifiers.length > 1 && (
                <button onClick={() => removeModifier(i)} className="text-red-400 hover:text-red-500 p-0.5">
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              )}
            </div>
            <span className="text-muted-foreground font-semibold text-sm">+</span>
          </React.Fragment>
        ))}
        <button onClick={addModifier} className="p-1.5 rounded-lg border border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors" title="Add modifier">
          <span className="material-symbols-outlined text-[16px]">add</span>
        </button>

        {/* Key slots */}
        {keys.map((k, i) => (
          <React.Fragment key={`k-${i}`}>
            {i > 0 && <span className="text-muted-foreground font-semibold text-sm">+</span>}
            <div className="flex items-center gap-1">
              <select value={k} onChange={(e) => setKeys((p) => p.map((v, j) => (j === i ? e.target.value : v)))}
                className="bg-background/50 border border-border rounded-lg px-3 py-2 font-body-sm text-foreground focus:ring-1 focus:ring-primary focus:outline-none">
                <option value="">- Key -</option>
                {KEYS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
              </select>
              {keys.length > 1 && (
                <button onClick={() => removeKey(i)} className="text-red-400 hover:text-red-500 p-0.5">
                  <span className="material-symbols-outlined text-[14px]">close</span>
                </button>
              )}
            </div>
          </React.Fragment>
        ))}
        <button onClick={addKey} className="p-1.5 rounded-lg border border-dashed border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors" title="Add key">
          <span className="material-symbols-outlined text-[16px]">add</span>
        </button>

        <button onClick={handleApply} className="px-4 py-2 rounded-lg font-label-caps text-label-caps bg-primary text-primary-foreground hover:opacity-90 transition-all">Set</button>
      </div>
    </div>
  );
};