import { useState, useEffect } from 'react';
import { SettingsGeneral } from '../components/SettingsGeneral';
import { SettingsAppearance } from '../components/SettingsAppearance';
import { SettingsBlockedTriggers } from '../components/SettingsBlockedTriggers';
import { SettingsDangerZone } from '../components/SettingsDangerZone';
import { SettingsFooter } from '../components/SettingsFooter';
import { persistSetting } from '../utils/settingsStorage';

type Shade = 'light' | 'medium' | 'dark';
type ThemeName = 'coffee' | 'ocean' | 'forest';
type ThemeMode = 'system' | 'light' | 'dark';

interface LocalSettings {
  startAtLogin: boolean;
  keepInTray: boolean;
  executionNotifications: boolean;
  /** When true, newly created shortcuts with dangerous actions start secured. */
  securedShortcutsEnabled: boolean;
  /** How long the double-press window lasts, in seconds. Min 5, max 30. */
  securedDoublePressSeconds: number;
  generalShade: Shade;
  dataShade: Shade;
  /** Auto-scroll acceleration during card drag and drag-select. 2 (slow) – 20 (fast). */
  autoScrollSpeed: number;
  /** Page zoom factor. 0.5 = 50%, 1.0 = 100% (default), 2.0 = 200%. */
  zoomFactor: number;
  /** Backdrop style for the App Drawer modal. */
  appDrawerBackdrop: 'blur' | 'solid';
  /** Where the sidebar logo redirects to. */
  sidebarLogoLink: string;
}

const DEFAULT_SETTINGS: LocalSettings = {
  startAtLogin: true,
  keepInTray: true,
  executionNotifications: true,
  securedShortcutsEnabled: true,
  securedDoublePressSeconds: 5,
  generalShade: 'light',
  dataShade: 'light',
  autoScrollSpeed: 6,
  zoomFactor: 1,
  appDrawerBackdrop: 'solid',
  sidebarLogoLink: 'library',
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
  // Hardware acceleration lives in main-process preferences.json, not in
  // lazycow_settings — see electron/preferences.ts. `boot` is what was
  // applied at launch; `current` is what's on disk now. They differ →
  // the toggle shows a "Restart required" banner.
  const [hwAccel, setHwAccel] = useState<{ current: boolean; boot: boolean } | null>(null);
  const [hwAccelSaving, setHwAccelSaving] = useState(false);

  useEffect(() => {
    window.electronAPI?.getHardwareAcceleration().then(setHwAccel).catch(() => {});
  }, []);

  const handleHwAccelChange = async (enabled: boolean) => {
    setHwAccelSaving(true);
    try {
      await window.electronAPI?.setHardwareAcceleration(enabled);
      const fresh = await window.electronAPI?.getHardwareAcceleration();
      if (fresh) setHwAccel(fresh);
    } finally {
      setHwAccelSaving(false);
    }
  };

  const handleRestartApp = () => {
    window.electronAPI?.relaunchApp();
  };

  useEffect(() => {
    const stored = localStorage.getItem('lazycow_settings');
    let initialSettings = DEFAULT_SETTINGS;
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        initialSettings = { ...DEFAULT_SETTINGS, ...parsed };
        // Silent migration: the old `showDangerWarnings` key becomes
        // `securedShortcutsEnabled`. Preserve the user's intent — if they
        // had turned warnings off, they still want the runtime muted.
        if (typeof parsed.showDangerWarnings === 'boolean'
            && typeof parsed.securedShortcutsEnabled !== 'boolean') {
          initialSettings.securedShortcutsEnabled = parsed.showDangerWarnings;
          // Persist the migrated shape immediately so the next read is clean.
          const next: Record<string, unknown> = { ...parsed, securedShortcutsEnabled: initialSettings.securedShortcutsEnabled };
          delete next.showDangerWarnings;
          localStorage.setItem('lazycow_settings', JSON.stringify(next));
        }
      } catch { /* ignore */ }
    }
    setSettings(initialSettings);
    // Apply saved zoom immediately on mount.
    window.electronAPI?.setZoomFactor(initialSettings.zoomFactor);
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
  persistSetting('lazycow_settings', JSON.stringify(updated));
  // Notify sibling components (Builder, Library) that a setting changed,
  // so they can re-read localStorage without a page reload. Standard
  // pattern for cross-component state without a store.
  window.dispatchEvent(new CustomEvent('lazycow-settings-changed', { detail: { key, value } }));
  if (key === 'startAtLogin' || key === 'keepInTray' || key === 'executionNotifications') {
    if (window.electronAPI?.updateGeneralSettings) {
      window.electronAPI.updateGeneralSettings({ [key]: value as boolean });
    }
  }
  // Zoom is main-process-driven. Push it when the user picks a new value.
  if (key === 'zoomFactor') {
    window.electronAPI?.setZoomFactor(value as number);
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
          zoomFactor={settings.zoomFactor}
          onZoomChange={(factor) => updateSetting('zoomFactor', factor)}
          appDrawerBackdrop={settings.appDrawerBackdrop}
          onAppDrawerBackdropChange={(v) => updateSetting('appDrawerBackdrop', v)}
        />
        <SettingsGeneral
          settings={settings}
          onUpdate={updateSetting}
          customColorMode={customColorMode}
          hardwareAcceleration={hwAccel?.current ?? false}
          hardwareAccelerationBoot={hwAccel?.boot ?? false}
          hardwareAccelerationSaving={hwAccelSaving}
          onHardwareAccelerationChange={handleHwAccelChange}
          onRestartApp={handleRestartApp}
        />
        <SettingsBlockedTriggers customColorMode={customColorMode} />
        <SettingsDangerZone />
        <SettingsFooter />
      </div>
    </main>
  );
}