import React, { useState } from 'react';

type Shade = 'light' | 'medium' | 'dark';

interface SettingsGeneralProps {
  settings: {
    startAtLogin: boolean;
    keepInTray: boolean;
    executionNotifications: boolean;
    generalShade: Shade;
  };
  onUpdate: (key: string, value: boolean | Shade) => void;
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