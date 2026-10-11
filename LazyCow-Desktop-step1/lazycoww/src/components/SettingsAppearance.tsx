import React from 'react';

type ThemeName = 'coffee' | 'ocean' | 'forest';
type ThemeMode = 'system' | 'light' | 'dark';

interface SettingsAppearanceProps {
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  customColorMode: boolean;
  onCustomColorModeChange: (enabled: boolean) => void;
  customTheme: ThemeName;
  onCustomThemeChange: (theme: ThemeName) => void;
  /** Current zoom factor. 1 = 100%. */
  zoomFactor: number;
  onZoomChange: (factor: number) => void;
}

const customThemes: { name: ThemeName; label: string; icon: string; colorClass: string }[] = [
  { name: 'coffee', label: 'Coffee', icon: 'coffee', colorClass: 'bg-amber-700' },
  { name: 'ocean', label: 'Ocean', icon: 'water_drop', colorClass: 'bg-cyan-600' },
  { name: 'forest', label: 'Forest', icon: 'forest', colorClass: 'bg-emerald-600' },
];

export const SettingsAppearance: React.FC<SettingsAppearanceProps> = ({
  themeMode, onThemeModeChange, customColorMode, onCustomColorModeChange, customTheme, onCustomThemeChange,
  zoomFactor, onZoomChange,
}) => {
  return (
    <div>
      <h2 className="font-title-sm text-title-sm text-foreground mb-3">Appearance</h2>

      <div className="card-themeable bg-gradient-to-br from-card-light to-card-medium text-card-light-fg border border-border rounded-xl shadow-sm overflow-hidden divide-y divide-border/50 transition-all duration-300">
        {/* Theme Mode */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <h3 className="font-body-md font-medium">Theme Mode</h3>
            <p className="text-body-sm opacity-80">Choose between system default, light, or dark mode.</p>
          </div>
          <select
            value={themeMode}
            onChange={(e) => onThemeModeChange(e.target.value as ThemeMode)}
            className="bg-background/50 border border-border rounded-lg px-3 py-2 font-body-sm text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
          >
            <option value="system">System Default</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </div>

        {/* Page Zoom — like browsers. Ctrl + +/-/0 keyboard shortcuts also work. */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <h3 className="font-body-md font-medium">Page Zoom</h3>
            <p className="text-body-sm opacity-80">Scale the entire app. Shortcuts: Ctrl + + / − / 0.</p>
          </div>
          <select
            value={String(zoomFactor)}
            onChange={(e) => onZoomChange(Number(e.target.value))}
            className="bg-background/50 border border-border rounded-lg px-3 py-2 font-body-sm text-foreground focus:ring-1 focus:ring-primary focus:outline-none"
          >
            {[0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2].map((z) => (
              <option key={z} value={z}>{Math.round(z * 100)}%</option>
            ))}
          </select>
        </div>

        {/* Custom Color Mode Toggle */}
        <div className="p-4 flex items-center justify-between">
          <div>
            <h3 className="font-body-md font-medium">Custom Color Mode</h3>
            <p className="text-body-sm opacity-80">Enable custom accent themes (Coffee, Ocean, Forest).</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={customColorMode}
              onChange={(e) => onCustomColorModeChange(e.target.checked)}
            />
            <div className="w-11 h-6 bg-muted rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-primary after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all" />
          </label>
        </div>

        {/* Accent Theme Picker (only when custom mode is ON) */}
        {customColorMode && (
          <div className="p-4">
            <h3 className="font-body-md font-medium mb-3">Accent Theme</h3>
            <div className="flex gap-3">
              {customThemes.map((t) => (
                <button
                  key={t.name}
                  onClick={() => onCustomThemeChange(t.name)}
                  className={`flex-1 flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
                    customTheme === t.name
                      ? 'border-primary bg-primary/10'
                      : 'border-border hover:border-primary/50 bg-card/50'
                  }`}
                >
                  <span className={`material-symbols-outlined text-2xl ${customTheme === t.name ? 'text-primary' : 'text-muted-foreground'}`}>
                    {t.icon}
                  </span>
                  <span className={`font-body-sm font-semibold ${customTheme === t.name ? 'text-primary' : 'text-foreground'}`}>
                    {t.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};