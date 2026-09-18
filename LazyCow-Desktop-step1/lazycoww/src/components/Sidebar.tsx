import React from 'react';

interface SidebarProps {
  activeTab: string;
  onTabClick: (tab: string) => void;
  collapsed: boolean;
  isAutoCollapsed?: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, onTabClick, collapsed, isAutoCollapsed, onToggleCollapse }) => {
  const navItems = [
    { id: 'library', label: 'Library', icon: 'auto_stories' },
    { id: 'builder', label: 'Builder', icon: 'construction' },
    { id: 'community', label: 'Community', icon: 'groups' },
    { id: 'settings', label: 'Settings', icon: 'settings' },
    { id: 'account', label: 'Account', icon: 'account_circle' },
  ];

  return (
    <nav className={`bg-card fixed left-0 top-0 h-full border-r border-border flex flex-col py-margin-page px-stack-md justify-between z-20 transition-all duration-300 ${
      collapsed ? 'w-[64px] px-2' : 'w-[260px]'
    }`}>
      <div>
        {/* Header Brand */}
        <div className={`mb-12 flex items-center gap-stack-sm ${collapsed ? 'justify-center' : 'px-stack-sm'}`}>
          {collapsed ? (
            <span className="font-display-lg text-headline-md text-primary tracking-tight text-[20px]">🐮</span>
          ) : (
            <span className="font-display-lg text-headline-md text-primary tracking-tight">🐮 LazyCow</span>
          )}
        </div>

        {/* Main Navigation */}
        <ul className="flex flex-col gap-1">
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <li key={item.id}>
                <button
                  onClick={() => onTabClick(item.id)}
                  title={collapsed ? item.label : undefined}
                  className={`w-full flex items-center gap-stack-md px-3 py-2 rounded-lg font-body-sm text-body-sm border-l-2 transition-all duration-200 ${
                    collapsed ? 'justify-center px-2' : ''
                  } ${
                    isActive
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
        {!collapsed && (
          <button 
            onClick={() => onTabClick('builder')}
            className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-full font-label-caps text-label-caps flex items-center justify-center gap-2 hover:opacity-90 transition-opacity shadow-sm"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
            New Project
          </button>
        )}
        {collapsed && (
          <button 
            onClick={() => onTabClick('builder')}
            className="w-full py-2 bg-primary text-primary-foreground rounded-full flex items-center justify-center hover:opacity-90 transition-opacity shadow-sm"
            title="New Project"
          >
            <span className="material-symbols-outlined text-[16px]">add</span>
          </button>
        )}
        
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