import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface SidebarProps {
  activeTab: string;
  onTabClick: (tab: string) => void;
  collapsed: boolean;
  isAutoCollapsed?: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabClick, collapsed, isAutoCollapsed, onToggleCollapse }) => {
  const handleLogoClick = () => {
    let target = 'library';
    try {
      const settings = JSON.parse(localStorage.getItem('lazycow_settings') || '{}');
      if (settings.sidebarLogoLink) target = settings.sidebarLogoLink;
    } catch { /* ignore */ }
    onTabClick(target);
  };
  const navItems = [
    { id: 'library', label: 'Library', icon: 'auto_stories' },
    { id: 'builder', label: 'Builder', icon: 'construction' },
    { id: 'community', label: 'Community', icon: 'groups' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
    { id: 'account', label: 'Account', icon: 'account_circle' },
  ];

  return (
    <nav className={`bg-card fixed left-0 top-0 h-full border-r border-border flex flex-col py-margin-page px-stack-md justify-between z-20 transition-all duration-300 ${collapsed ? 'w-[64px] px-2' : 'w-[260px]'
      }`}>
      <div>
        {/* Header Brand */}
        <button 
          onClick={handleLogoClick}
          className={`mb-12 flex items-center transition-opacity hover:opacity-80 ${collapsed ? 'w-full justify-center' : 'pl-[16px]'}`}
        >
          <AnimatePresence mode="wait">
            {collapsed ? (
              <motion.div
                key="collapsed-logo"
                initial={{ opacity: 0, scale: 0.8, rotate: -5 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                exit={{ opacity: 0, scale: 0.8 }}
                transition={{ duration: 0.2 }}
                className="h-[48px] w-[48px] hover:scale-105 transition-transform shrink-0"
                style={{
                  WebkitMaskImage: 'url(/icon-monogram-3d.svg)',
                  WebkitMaskSize: '160%', // The exact size you loved
                  WebkitMaskRepeat: 'no-repeat',
                  WebkitMaskPosition: 'center',
                  maskImage: 'url(/icon-monogram-3d.svg)',
                  maskSize: '160%',
                  maskRepeat: 'no-repeat',
                  maskPosition: 'center',
                  // This gradient is the magic. It paints the 3D shine.
                  background: 'linear-gradient(135deg, #ffffff 0%, hsl(var(--primary)) 40%, hsl(var(--primary)) 60%, rgba(0,0,0,0.8) 100%)'
                } as React.CSSProperties}
              />
            ) : (
              <motion.svg
                key="expanded-logo"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.2 }}
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 9.75 240.10000610351562 46.20000076293945"
                className="h-[32px] w-auto fill-current text-primary"
              >
                <path d="M10.35 42.20Q11.75 42.20 13.03 41.95Q14.30 41.70 16.05 41.25Q18 40.70 19.53 40.42Q21.05 40.15 22.85 40.15L22.85 45.25L5.85 45.25Q4.55 45.25 2.85 45.08Q1.15 44.90 0 44.50L0 43.70Q1.50 43.70 2.13 40.75Q2.75 37.80 2.75 32.60L2.75 22.25L2.75 16.60Q2.75 14 2.60 12.98Q2.45 11.95 2.03 11.63Q1.60 11.30 0.50 11.30L0.50 10.50Q2.70 9.75 5.85 9.75Q9 9.75 11.20 10.50L11.20 11.30Q10.10 11.30 9.68 11.63Q9.25 11.95 9.10 12.98Q8.95 14 8.95 16.60L8.95 22.25L8.95 32.60Q8.95 39.75 10.05 42.20L10.35 42.20ZM52 39.15Q52 41.60 52.60 42.65Q53.20 43.70 54.75 43.70L54.75 44.50Q53.60 44.90 51.98 45.08Q50.35 45.25 49.40 45.25Q45.65 45.25 44.70 42.40Q41.70 45.25 37.15 45.25Q34.70 45.25 32.38 44.27Q30.05 43.30 28.45 40.88Q26.85 38.45 26.85 34.40Q26.85 30.20 28.90 26.85Q30.95 23.50 34.35 21.63Q37.75 19.75 41.65 19.75Q46.50 19.75 49.25 22.20Q52 24.65 52 29.70L52 39.15M38.40 41.45Q40.70 41.45 42.65 39.58Q44.60 37.70 45.60 33.75Q46.30 30.50 46.30 28.50Q46.30 25.75 45.18 24.47Q44.05 23.20 41.85 23.20Q39.10 23.20 37.10 24.85Q35.10 26.50 34.05 29.05Q33 31.60 33 34.25Q33 37.30 34.40 39.38Q35.80 41.45 38.40 41.45ZM85.30 39.10Q83.25 42.80 79.85 44.15Q76.45 45.50 72.85 45.50Q71.80 45.50 70.47 45.35Q69.15 45.20 68.65 45.15Q65.55 44.75 64.10 44.75Q62 44.75 60.60 45.25L58.75 43.55Q60.80 42.80 64.05 38.55L75.35 22.75Q74.35 22.75 72.25 22.65Q70.15 22.60 69.15 22.67Q68.15 22.75 67.53 23.17Q66.90 23.60 66.90 24.55Q66.90 25.80 65.97 26.52Q65.05 27.25 63.80 27.25Q62.50 27.25 61.50 26.47Q60.50 25.70 60.50 24.30Q60.50 22 62.63 20.88Q64.75 19.75 68.30 19.75Q70.10 19.75 72.50 20Q73 20.05 74.38 20.15Q75.75 20.25 76.95 20.25Q78.60 20.25 79.95 20.05L81.55 19.75L83.35 20.45L69.35 40.55Q68.50 41.75 67.45 42.55Q68.80 42.55 69.45 42.60L71.45 42.65Q74.30 42.65 76.40 41.05Q78.50 39.45 79.85 35.40L85.30 39.10ZM108.25 22.35Q108.25 20.85 108.90 20.30Q109.55 19.75 110.85 19.75Q111.40 19.75 113.20 19.95Q115.85 20.20 116.70 20.20L116.70 21.10Q115.45 21.10 114.95 22.38Q114.45 23.65 114.45 25.50L114.45 36.75Q114.40 46.30 111.22 51.13Q108.05 55.95 100.60 55.95Q99.10 55.95 98.15 55.17Q97.20 54.40 95.95 52.65Q95.55 52.05 95.05 51.45L95.05 50.70Q101.15 50.70 104.10 48.65Q107.05 46.60 107.85 41.95Q105.55 45.25 100.90 45.25Q97.15 45.25 94.63 43.23Q92.10 41.20 92.05 35.55L92.05 27Q92.05 22.60 89.30 22.60L89.30 21.70Q93.35 19.75 95.40 19.75Q96.80 19.75 97.53 20.72Q98.25 21.70 98.25 23.80L98.25 35.45Q98.25 41.45 102 41.45Q104.55 41.45 106.25 39.35Q107.95 37.25 108.25 33.10L108.25 22.35ZM152.80 40.30Q150.20 42.60 146.60 43.92Q143 45.25 139.15 45.25Q133.10 45.25 128.95 42.88Q124.80 40.50 122.75 36.45Q120.70 32.40 120.70 27.35Q120.70 22.85 122.67 18.82Q124.65 14.80 128.78 12.27Q132.90 9.75 139.10 9.75Q142.75 9.75 145.78 10.88Q148.80 12 150.53 13.95Q152.25 15.90 152.25 18.25Q152.25 19.70 151.25 20.52Q150.25 21.35 148.90 21.35Q147.65 21.35 146.75 20.57Q145.85 19.80 145.85 18.40Q145.85 17 145.05 15.72Q144.25 14.45 142.72 13.67Q141.20 12.90 139.10 12.90Q133.60 12.90 130.55 16.95Q127.50 21 127.50 27.70Q127.50 31.85 129.15 35.02Q130.80 38.20 133.47 39.90Q136.15 41.60 139.15 41.60Q141.30 41.60 142.97 40.88Q144.65 40.15 146.03 38.95Q147.40 37.75 149.65 35.40L152.80 40.30ZM170.30 19.75Q174.80 19.75 178.23 21.35Q181.65 22.95 183.53 25.82Q185.40 28.70 185.40 32.45Q185.40 36.20 183.53 39.02Q181.65 41.85 178.60 43.40Q175.55 44.95 172.10 45.20Q171.65 45.25 170.70 45.25Q167.15 45.20 163.95 43.70Q160.75 42.20 158.78 39.27Q156.80 36.35 156.80 32.35Q156.80 28.60 158.63 25.75Q160.45 22.90 163.55 21.32Q166.65 19.75 170.30 19.75M171.75 41.50Q175.15 41.50 177.23 39.25Q179.30 37 179.30 33.60Q179.30 31.80 178.70 29.95Q177.55 26.30 175.25 24.72Q172.95 23.15 170.50 23.15Q167.10 23.15 165.10 25.45Q163.10 27.75 163.10 31.20Q163.10 33.10 163.65 34.75Q164.70 38.25 167 39.88Q169.30 41.50 171.75 41.50ZM220.90 20.20Q221.80 20.20 224.40 19.95Q226.20 19.75 226.75 19.75Q228.05 19.75 228.70 20.30Q229.35 20.85 229.35 22.35L229.35 25.55Q229.35 36.05 225.88 40.65Q222.40 45.25 217.15 45.25Q212 45.25 209.60 41.60Q208.05 43.50 206 44.38Q203.95 45.25 201.65 45.25Q197.45 45.25 194.80 42.55Q192.15 39.85 192.15 33.35L192.15 27Q192.15 22.60 189.40 22.60L189.40 21.70Q193.45 19.75 195.50 19.75Q196.90 19.75 197.63 20.72Q198.35 21.70 198.35 23.80L198.35 33.35Q198.35 37.35 199.22 39.40Q200.10 41.45 202.10 41.45Q207.45 41.45 207.65 26.60Q207.55 22.60 204.90 22.60L204.90 21.70Q208.95 19.75 211 19.75Q212.40 19.75 213.13 20.72Q213.85 21.70 213.85 23.80L213.85 33.35Q213.85 37.35 214.73 39.40Q215.60 41.45 217.60 41.45Q223.15 41.45 223.15 25.55Q223.15 23.65 222.65 22.38Q222.15 21.10 220.90 21.10L220.90 20.20ZM236.75 45Q235.35 45 234.35 44Q233.35 43 233.35 41.60Q233.35 40.20 234.35 39.23Q235.35 38.25 236.75 38.25Q238.15 38.25 239.13 39.23Q240.10 40.20 240.10 41.60Q240.10 43 239.13 44Q238.15 45 236.75 45Z" />
              </motion.svg>
            )}
          </AnimatePresence>
        </button>

        {/* Main Navigation */}
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onTabClick(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-stack-md px-3 py-2 rounded-lg font-body-sm text-body-sm border-l-2 transition-all duration-200 ${collapsed ? 'justify-center px-2' : ''
                    } ${isActive
                      ? 'text-foreground font-semibold border-primary bg-primary/10 translate-x-1'
                      : 'text-muted-foreground border-transparent hover:text-foreground hover:bg-muted'
                    }`}
                >
                  <span
                    className="material-symbols-outlined"
                    style={{ fontVariationSettings: "'FILL' 0" }}
                  >
                    {item.icon}
                  </span>
                  {!collapsed && item.label}
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Footer */}
      <div className="flex flex-col gap-4">
        {/* "New Project" button intentionally removed — creating a shortcut
            is Library's job ("New Shortcut" button), and the old Sidebar
            button silently did nothing when the user was already on the
            Builder tab. One entry point, no dead clicks. */}

        {/* Collapse toggle — hidden when auto-collapsed by window size */}
        {!isAutoCollapsed && (
          <button
            onClick={onToggleCollapse}
            className="w-full py-2 border border-border rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <span className="material-symbols-outlined text-[18px] transition-transform duration-300">
              {collapsed ? 'chevron_right' : 'chevron_left'}
            </span>
          </button>
        )}
      </div>
    </nav>
  );
};