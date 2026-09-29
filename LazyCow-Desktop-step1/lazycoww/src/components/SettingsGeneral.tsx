import React, { useState } from 'react';

type Shade = 'light' | 'medium' | 'dark';

interface SettingsGeneralProps {
  settings: {
    startAtLogin: boolean;
    keepInTray: boolean;
    executionNotifications: boolean;
    generalShade: Shade;
    autoScrollSpeed: number;
  };
  onUpdate: (key: string, value: boolean | Shade | number) => void;
  customColorMode: boolean;
}

export const SettingsGeneral: React.FC<SettingsGeneralProps> = ({ settings, onUpdate, customColorMode }) => {
  const [menuOpen, setMenuOpen] = useState(false);

  const shadeClasses: Record<Shade, string> = {
    light: 'from-card-light to-card-medium text-card-light-fg',
    medium: 'from-card-medium to-card-dark text-card-medium-fg',
    dark: 'from-card-dark to-primary text-card-dark-fg',
  };

  return (
    <div className="shade-container">
      <h2 className="font-title-sm text-title-sm text-foreground mb-3">General</h2>

      <div className={`card-themeable bg-gradient-to-br ${shadeClasses[settings.generalShade]} border border-border rounded-xl shadow-sm overflow-hidden divide-y divide-border/50 transition-all duration-300`}>
        <div className="p-4 flex items-center justify-between">
          <div>
            <h3 className="font-body-md font-medium">Start LazyCow at startup</h3>
            <p className="text-body-sm opacity-80">Run silently in the background when your computer starts.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={settings.startAtLogin} onChange={(e) => onUpdate('startAtLogin', e.target.checked)} />
            <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all" />
          </label>
        </div>

        <div className="p-4 flex items-center justify-between">
          <div>
            <h3 className="font-body-md font-medium">Keep in System Tray</h3>
            <p className="text-body-sm opacity-80">Closing the window minimizes LazyCow to the system tray instead of quitting.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={settings.keepInTray} onChange={(e) => onUpdate('keepInTray', e.target.checked)} />
            <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all" />
          </label>
        </div>

        <div className="p-4 flex items-center justify-between">
          <div>
            <h3 className="font-body-md font-medium">Execution Notifications</h3>
            <p className="text-body-sm opacity-80">Show an OS notification when a shortcut successfully finishes or fails.</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input type="checkbox" className="sr-only peer" checked={settings.executionNotifications} onChange={(e) => onUpdate('executionNotifications', e.target.checked)} />
            <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all" />
          </label>
        </div>

        {/* ── Auto-scroll speed ── */}
        <div className="p-4 flex flex-col gap-3">
          <div>
            <h3 className="font-body-md font-medium">Auto-scroll speed</h3>
            <p className="text-body-sm opacity-80">
              How fast the sequence scrolls when you drag a card or a selection toward the top or bottom edge.
            </p>
          </div>

          {/* Presets */}
          <div className="flex items-center gap-2">
            {[
              { label: 'Slow', value: 3 },
              { label: 'Medium', value: 6 },
              { label: 'Fast', value: 12 },
            ].map((p) => (
              <button
                key={p.label}
                onClick={() => onUpdate('autoScrollSpeed', p.value)}
                className={`px-3 py-1 rounded-full text-body-sm border transition-colors ${
                  settings.autoScrollSpeed === p.value
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'border-border text-foreground hover:bg-muted'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Fine-grained slider */}
          <div className="flex items-center gap-3">
            <span className="text-body-sm text-muted-foreground shrink-0">Slow</span>
            <input
              type="range"
              min="2"
              max="20"
              step="1"
              value={settings.autoScrollSpeed}
              onChange={(e) => onUpdate('autoScrollSpeed', Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <span className="text-body-sm text-muted-foreground shrink-0">Fast</span>
            <span className="font-code-sm font-semibold w-8 text-right text-foreground">
              {settings.autoScrollSpeed}
            </span>
          </div>
          <p className="text-[11px] text-muted-foreground opacity-70">
            Higher values scroll faster when the cursor is pushed deeper into the edge zone. Presets are a starting point — drag the slider for custom.
          </p>
        </div>


      </div>

      {customColorMode && (
        <div className="flex justify-end mt-2">
          <div className="flex items-center gap-2 relative">
            <div className={`shade-menu flex items-center gap-1 bg-card border border-border rounded-full px-2 py-1 shadow-sm transition-all duration-200 ${
              menuOpen ? 'opacity-100 translate-x-0 visible' : 'opacity-0 translate-x-2.5 invisible absolute right-8'
            }`}>
              {(['light', 'medium', 'dark'] as const).map((s, i) => (
                <React.Fragment key={s}>
                  {i > 0 && <div className="w-px h-3 bg-border" />}
                  <button
                    className={`shade-btn text-xs px-1 transition-colors ${settings.generalShade === s ? 'text-primary font-semibold' : 'text-muted-foreground hover:text-primary'}`}
                    onClick={() => { onUpdate('generalShade', s); setMenuOpen(false); }}
                  >
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                </React.Fragment>
              ))}
            </div>
            <button
              className={`p-1 rounded-full transition-colors ${menuOpen ? 'text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              onClick={() => setMenuOpen((p) => !p)}
            >
              <span className="material-symbols-outlined text-[18px]">tune</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};