import { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Library } from './pages/Library';
import { Builder } from './pages/Builder';
import Settings from './pages/Settings';
import { SavedShortcut } from './types/actions';

type ThemeName = 'coffee' | 'ocean' | 'forest';
type ThemeMode = 'system' | 'light' | 'dark';


function hexToHSL(hex: string): string {
  hex = hex.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function App() {
  const [activeTab, setActiveTab] = useState<string>('library');
  const [customColorMode, setCustomColorMode] = useState<boolean>(false);
  const [customTheme, setCustomTheme] = useState<ThemeName>('coffee');
  const [themeMode, setThemeMode] = useState<ThemeMode>('system');
  const [systemIsDark, setSystemIsDark] = useState<boolean>(false);
  const [systemAccent, setSystemAccent] = useState<string>('#0078D4');
  const [appReady, setAppReady] = useState(false);
  // `sidebarCollapsed` = what the user sees.
  // `manualCollapse` = user's explicit choice (persists across resizes).
  // The visible state is: manualCollapse OR window-too-narrow.
  const [manualCollapse, setManualCollapse] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [libraryRefreshKey, setLibraryRefreshKey] = useState(0);
  const [builderKey, setBuilderKey] = useState(0);

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [pendingTab, setPendingTab] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
   const [editShortcut, setEditShortcut] = useState<SavedShortcut | null>(null);

  // ── Auto-collapse sidebars based on window width ──
  // Below 900px: main sidebar forces to collapsed icon mode.
  // Below 1100px: ActionSidebar (in Builder) forces to collapsed icon mode.
  const [isMainSidebarAutoCollapsed, setIsMainSidebarAutoCollapsed] = useState(false);
  const [isActionSidebarAutoCollapsed, setIsActionSidebarAutoCollapsed] = useState(false);

  useEffect(() => {
    const checkWidth = () => {
      const w = window.innerWidth;
      const mainAuto = w < 900;
      const actionAuto = w < 1100;
      setIsMainSidebarAutoCollapsed(mainAuto);
      setIsActionSidebarAutoCollapsed(actionAuto);
      // Visible state = (user's manual choice) OR (window too narrow to show text)
      setSidebarCollapsed((prev) => {
        const next = mainAuto || manualCollapse;
        return prev === next ? prev : next;
      });
    };
    checkWidth();
    window.addEventListener('resize', checkWidth);
    return () => window.removeEventListener('resize', checkWidth);
  }, [manualCollapse]);

  // ── Load saved preferences ──
  useEffect(() => {
    const savedCustomMode = localStorage.getItem('lazycow-custom-color-mode') === 'true';
    const savedCustomTheme = (localStorage.getItem('lazycow-custom-theme') as ThemeName) || 'coffee';
    const savedThemeMode = (localStorage.getItem('lazycow-theme-mode') as ThemeMode) || 'system';
    
    setCustomColorMode(savedCustomMode);
    setCustomTheme(savedCustomTheme);
    setThemeMode(savedThemeMode);
    
    // Apply dark mode immediately from saved state
    if (savedThemeMode === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (savedThemeMode === 'light') {
      document.documentElement.classList.remove('dark');
    }
    // For 'system', we'll let the electron listener handle it
  }, []);

  // ── Splash screen ──
  useEffect(() => {
    const init = async () => {
      try { await document.fonts.ready; } catch (err) { console.warn('Font loading check:', err); }
      await new Promise((r) => setTimeout(r, 400));
      const splash = document.getElementById('splash-screen');
      if (splash) splash.classList.add('hidden');
      setTimeout(() => { if (splash) splash.remove(); }, 500);
      setAppReady(true);
    };
    init();
  }, []);

  // ── Listen for system theme ──
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.onSystemTheme((theme) => {
        setSystemIsDark(theme === 'dark');
        // Only apply system theme if mode is 'system'
        const savedMode = localStorage.getItem('lazycow-theme-mode') as ThemeMode || 'system';
        if (savedMode === 'system') {
          if (theme === 'dark') {
            document.documentElement.classList.add('dark');
          } else {
            document.documentElement.classList.remove('dark');
          }
        }
      });
    }
  }, []);

  // ── Get system accent + listen for changes ──
  useEffect(() => {
    if (!window.electronAPI || customColorMode) return;

    // Get initial accent
    window.electronAPI.getSystemAccent().then((hex) => {
      setSystemAccent(hex);
      document.documentElement.style.setProperty('--primary', hexToHSL(hex));
    });

    // Listen for real-time changes
    window.electronAPI.onSystemAccent((hex) => {
      setSystemAccent(hex);
      if (!customColorMode) {
        document.documentElement.style.setProperty('--primary', hexToHSL(hex));
      }
    });
  }, [customColorMode]);
  // ── Compute dark mode for icon display ──
  const darkMode = document.documentElement.classList.contains('dark');

  // ── Apply custom theme classes ──
  useEffect(() => {
    const body = document.body;

    body.classList.remove('theme-coffee', 'theme-ocean', 'theme-forest');

    if (customColorMode) {
      body.classList.add(`theme-${customTheme}`);
      document.documentElement.style.removeProperty('--primary');
    } else {
      document.documentElement.style.setProperty('--primary', hexToHSL(systemAccent));
    }

    localStorage.setItem('lazycow-custom-color-mode', String(customColorMode));
    localStorage.setItem('lazycow-custom-theme', customTheme);
  }, [customColorMode, customTheme, systemAccent]);

  // ── Force re-render when dark class changes ──
  const [, setTick] = useState(0);
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTick((t) => t + 1);
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // ── Handlers ──
  const applyThemeMode = (mode: ThemeMode) => {
    setThemeMode(mode);
    localStorage.setItem('lazycow-theme-mode', mode);
    
    if (mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else if (mode === 'light') {
      document.documentElement.classList.remove('dark');
    } else {
      // System — follow what electron says
      if (systemIsDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    }
  };

  const setCustomColorModeHandler = (enabled: boolean) => {
    setCustomColorMode(enabled);
    // Preserve current dark state
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('lazycow-dark', String(isDark));
  };

  const setCustomThemeHandler = (theme: ThemeName) => {
    setCustomTheme(theme);
    localStorage.setItem('lazycow-custom-theme', theme);
  };

  const toggleDarkMode = () => {
    const isDark = document.documentElement.classList.contains('dark');
    if (isDark) {
      document.documentElement.classList.remove('dark');
      setThemeMode('light');
      localStorage.setItem('lazycow-theme-mode', 'light');
    } else {
      document.documentElement.classList.add('dark');
      setThemeMode('dark');
      localStorage.setItem('lazycow-theme-mode', 'dark');
    }
  };

  const handleTabClick = useCallback((tab: string) => {
    if (activeTab === 'builder' && hasUnsavedChanges && tab !== 'builder') {
      setPendingTab(tab);
      setShowConfirmModal(true);
      return;
    }
    setActiveTab(tab);
    if (activeTab === 'builder') setEditShortcut(null);
    if (tab === 'library') setLibraryRefreshKey((k) => k + 1);
  }, [activeTab, hasUnsavedChanges]);

  const handleConfirmLeave = () => {
    setShowConfirmModal(false);
    setHasUnsavedChanges(false);
    setEditShortcut(null);
    setBuilderKey((k) => k + 1);
    if (pendingTab) { setActiveTab(pendingTab); setPendingTab(null); }
    setLibraryRefreshKey((k) => k + 1);
  };

  const handleCancelLeave = () => { setShowConfirmModal(false); setPendingTab(null); };
  const handleEditShortcut = (shortcut: SavedShortcut) => { setEditShortcut(shortcut); setActiveTab('builder'); };
  const handleSaveSuccess = () => {
    setHasUnsavedChanges(false);
    setEditShortcut(null);
    setLibraryRefreshKey((k) => k + 1);
    setBuilderKey((k) => k + 1);
  };

  const sidebarWidth = sidebarCollapsed ? '64px' : '260px';

  return (
    <div className="flex w-full h-screen overflow-hidden">
        <Sidebar
          activeTab={activeTab}
          onTabClick={handleTabClick}
          collapsed={sidebarCollapsed}
          isAutoCollapsed={isMainSidebarAutoCollapsed}
          onToggleCollapse={() => setManualCollapse((p) => !p)}
        />

      <div className="flex-1 flex flex-col relative z-10 min-h-0 overflow-hidden" style={{ marginLeft: sidebarWidth, transition: 'margin-left 0.3s ease' }}>
        <header className="bg-background/95 w-full h-16 flex items-center justify-between px-margin-page z-10 sticky top-0 border-b border-border/30 shrink-0">
          <div className="flex items-center">
            <h1 className="font-title-sm text-title-sm text-foreground tracking-tight transition-colors duration-300 capitalize">
              {activeTab === 'builder' && editShortcut ? `Editing: ${editShortcut.name}` : `${activeTab} Overview`}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {customColorMode && (
              <>
                <button aria-label="Coffee Theme" className={`p-2 hover:text-primary hover:bg-muted rounded-full flex items-center justify-center scale-95 duration-150 transition-colors ${customTheme === 'coffee' ? 'text-primary' : 'text-muted-foreground'}`}
                  onClick={() => setCustomThemeHandler('coffee')}><span className="material-symbols-outlined">coffee</span></button>
                <button aria-label="Ocean Theme" className={`p-2 hover:text-primary hover:bg-muted rounded-full flex items-center justify-center scale-95 duration-150 transition-colors ${customTheme === 'ocean' ? 'text-primary' : 'text-muted-foreground'}`}
                  onClick={() => setCustomThemeHandler('ocean')}><span className="material-symbols-outlined">water_drop</span></button>
                <button aria-label="Forest Theme" className={`p-2 hover:text-primary hover:bg-muted rounded-full flex items-center justify-center scale-95 duration-150 transition-colors ${customTheme === 'forest' ? 'text-primary' : 'text-muted-foreground'}`}
                  onClick={() => setCustomThemeHandler('forest')}><span className="material-symbols-outlined">forest</span></button>
                <div className="w-px h-6 bg-border mx-2 transition-colors duration-300" />
              </>
            )}
            <button aria-label="Toggle Dark Mode" className="p-2 text-muted-foreground hover:text-primary transition-colors hover:bg-muted rounded-full flex items-center justify-center scale-95 duration-150"
              onClick={toggleDarkMode}>
              <span className="material-symbols-outlined">{darkMode ? 'light_mode' : 'dark_mode'}</span>
            </button>
          </div>
        </header>

       <div className={`page-container ${activeTab === 'library' ? 'active' : ''}`}>
  {appReady && <Library key={libraryRefreshKey} setActiveTab={handleTabClick} onEditShortcut={handleEditShortcut} customColorMode={customColorMode} />}
</div>

        <div className={`page-container ${activeTab === 'builder' ? 'active' : ''}`}>
          {appReady && (
            <Builder
              key={builderKey}
              editData={editShortcut}
              isActionSidebarAutoCollapsed={isActionSidebarAutoCollapsed}
              onUnsavedChanges={setHasUnsavedChanges}
              onSaveSuccess={handleSaveSuccess}
            />
          )}
        </div>

        <div className={`page-container ${activeTab === 'settings' ? 'active' : ''}`}>
          {appReady && (
            <Settings
              themeMode={themeMode}
              onThemeModeChange={applyThemeMode}
              customColorMode={customColorMode}
              onCustomColorModeChange={setCustomColorModeHandler}
              customTheme={customTheme}
              onCustomThemeChange={setCustomThemeHandler}
            />
          )}
        </div>

        <div className={`${activeTab === 'community' ? 'flex-1 flex items-center justify-center' : 'hidden'}`}>
          <div className="text-center max-w-md p-margin-page">
            <span className="material-symbols-outlined text-muted-foreground text-5xl mb-4">groups</span>
            <h2 className="text-xl font-bold font-headline-md text-foreground">Community Hub</h2>
            <p className="text-muted-foreground mt-2 font-body-md">Coming Soon!</p>
          </div>
        </div>

        <div className={`${activeTab === 'account' ? 'flex-1 flex items-center justify-center' : 'hidden'}`}>
          <div className="text-center max-w-md p-margin-page">
            <span className="material-symbols-outlined text-muted-foreground text-5xl mb-4">account_circle</span>
            <h2 className="text-xl font-bold font-headline-md text-foreground">My Profile</h2>
            <p className="text-muted-foreground mt-2 font-body-md">Coming Soon!</p>
          </div>
        </div>
      </div>

      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={handleCancelLeave} />
          <div className="relative bg-card border border-border rounded-2xl p-8 shadow-2xl max-w-md w-full mx-4">
            <div className="flex flex-col items-center text-center gap-4">
              <span className="material-symbols-outlined text-5xl text-yellow-500">warning</span>
              <h2 className="font-title-sm text-foreground text-xl">Unsaved Changes</h2>
              <p className="text-muted-foreground font-body-md">You have unsaved changes in the Builder.</p>
              <div className="flex gap-3 w-full mt-2">
                <button onClick={handleCancelLeave} className="flex-1 px-6 py-2.5 border border-border rounded-full font-title-sm hover:bg-muted transition-colors text-foreground">Stay</button>
                <button onClick={handleConfirmLeave} className="flex-1 px-6 py-2.5 bg-red-500 text-white rounded-full font-title-sm hover:bg-red-600 transition-colors shadow-md">Leave Anyway</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;