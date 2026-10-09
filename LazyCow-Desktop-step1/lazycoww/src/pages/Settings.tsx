import { useState, useEffect } from 'react';
import { SettingsGeneral } from '../components/SettingsGeneral';
import { SettingsAppearance } from '../components/SettingsAppearance';
import { SettingsBlockedTriggers } from '../components/SettingsBlockedTriggers';
import { SettingsDangerZone } from '../components/SettingsDangerZone';
import { SettingsFooter } from '../components/SettingsFooter';

type Shade = 'light' | 'medium' | 'dark';
type ThemeName = 'coffee' | 'ocean' | 'forest';
type ThemeMode = 'system' | 'light' | 'dark';

interface LocalSettings {
  startAtLogin: boolean;
  keepInTray: boolean;
  executionNotifications: boolean;
  /** When false, hide the "Dangerous" badge and skip the pre-run confirmation modal. */
  showDangerWarnings: boolean;
  generalShade: Shade;
  dataShade: Shade;
  /** Auto-scroll acceleration during card drag and drag-select. 2 (slow) – 20 (fast). */
  autoScrollSpeed: number;
}

const DEFAULT_SETTINGS: LocalSettings = {
  startAtLogin: true,
  keepInTray: true,
  executionNotifications: true,
  showDangerWarnings: true,
  generalShade: 'light',
  dataShade: 'light',
  autoScrollSpeed: 6,
};

interface SettingsProps {
  themeMode: ThemeMode;
  onThemeModeChange: (mode: ThemeMode) => void;
  customColorMode: boolean;
  onCustomColorModeChange: (enabled: boolean) => void;
  customTheme: ThemeName;
  onCustomThemeChange: (theme: ThemeName) => void;
}

export default function Settings({ themeMode, onThemeModeChange, customColorMode, onCustomColorModeChange, customTheme, onCustomThemeChange }: SettingsProps) {
  const [settings, setSettings] = useState<LocalSettings>(DEFAULT_SETTINGS);

  useEffect(() => {
    const stored = localStorage.getItem('lazycow_settings');
    let initialSettings = DEFAULT_SETTINGS;
    if (stored) {
      try { initialSettings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) }; } catch { /* ignore */ }
    }
    setSettings(initialSettings);
    if (window.electronAPI?.updateGeneralSettings) {
      window.electronAPI.updateGeneralSettings({
        startAtLogin: initialSettings.startAtLogin,
        keepInTray: initialSettings.keepInTray,
        executionNotifications: initialSettings.executionNotifications,
      });
    }
  }, []);

  const updateSetting = (key: string, value: boolean | string | number) => {
  const updated = { ...settings, [key]: value };
  setSettings(updated);
  localStorage.setItem('lazycow_settings', JSON.stringify(updated));
  // Notify sibling components (Builder, Library) that a setting changed,
  // so they can re-read localStorage without a page reload. Standard
  // pattern for cross-component state without a store.
  window.dispatchEvent(new CustomEvent('lazycow-settings-changed', { detail: { key, value } }));
  if (key === 'startAtLogin' || key === 'keepInTray' || key === 'executionNotifications') {
    if (window.electronAPI?.updateGeneralSettings) {
      window.electronAPI.updateGeneralSettings({ [key]: value as boolean });
    }
  }
};

  return (
    <main className="flex-1 p-margin-page w-full overflow-y-auto">
      <div className="flex flex-col gap-6 max-w-4xl mx-auto pb-32">
        <SettingsAppearance
          themeMode={themeMode}
          onThemeModeChange={onThemeModeChange}
          customColorMode={customColorMode}
          onCustomColorModeChange={onCustomColorModeChange}
          customTheme={customTheme}
          onCustomThemeChange={onCustomThemeChange}
        />
        <SettingsGeneral settings={settings} onUpdate={updateSetting} customColorMode={customColorMode} />
        <SettingsBlockedTriggers customColorMode={customColorMode} />
        <SettingsDangerZone />
        <SettingsFooter />
      </div>
    </main>
  );
}