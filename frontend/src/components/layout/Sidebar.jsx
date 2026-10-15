import React from 'react';
import {
  LayoutDashboard, Package, Users, Building2, ShoppingCart, Bot,
  Workflow, Brain, GraduationCap, Bell, Mail, BarChart3, Settings,
  UsersRound, Menu, X, ChevronLeft, ChevronRight, TrendingUp, Zap,
  FileText, Store, Activity, Database, Sparkles, LogOut, Cpu
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '@/utils/helpers';
import { ROUTES } from '@/utils/constants';
import Button from '../common/ui/Button';
import { useAuth } from '@/context/MongoAuthContext';

export const Sidebar = ({ isOpen, onToggle, isCollapsed, onCollapseToggle }) => {
  const { logout, isCustomer } = useAuth();
  const navigate = useNavigate();

  // Role-based navigation
  const navigation = isCustomer
    ? [
      { name: 'Customer Portal', icon: ShoppingCart, path: '/customer-portal' }
    ]
    : [
      { name: 'Overview', icon: LayoutDashboard, path: ROUTES.DASHBOARD },
      {
        name: 'CRM & Logistics',
        items: [
          { name: 'Bright Connection Demo', icon: Zap, path: ROUTES.BRIGHT_CONNECTION },
          { name: 'CRM Management', icon: Users, path: ROUTES.CRM },
          { name: 'Logistics & Inventory', icon: Package, path: ROUTES.LOGISTICS },
          { name: 'Infiverse Monitoring', icon: Cpu, path: ROUTES.INFIVERSE },
          { name: 'Sampada Dashboard', icon: Activity, path: ROUTES.SAMPADA },
          { name: 'AI Artha', icon: Sparkles, path: ROUTES.AI_ARTHA },
          { name: 'Supplier Management', icon: Building2, path: ROUTES.SUPPLIERS },
          { name: 'Product Catalog', icon: ShoppingCart, path: ROUTES.PRODUCTS },
          { name: 'Supplier Showcase', icon: Store, path: '/showcase' },
        ]
      },
      {
        name: 'AI & Automation',
        items: [
          { name: 'EMS Automation', icon: Mail, path: ROUTES.EMAILS },
          { name: 'RL Learning', icon: GraduationCap, path: ROUTES.LEARNING },
          { name: 'AI Decisions', icon: Brain, path: ROUTES.DECISIONS },
          { name: 'AI Agents', icon: Bot, path: ROUTES.AGENTS },
        ]
      },
      {
        name: 'Analytics & Reports',
        items: [
          { name: 'Analytics', icon: BarChart3, path: ROUTES.REPORTS },
        ]
      },
      {
        name: 'System',
        items: [
          { name: 'Notifications', icon: Bell, path: ROUTES.NOTIFICATIONS },
          { name: 'Settings', icon: Settings, path: ROUTES.SETTINGS },
        ]
      },
    ];

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/auth/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden animate-fade-in"
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed left-0 top-0 z-50 h-screen bg-[#0f172a] text-slate-300 border-r border-slate-800/90 shadow-lg transition-all duration-300 flex flex-col select-none',
          isCollapsed ? 'w-16' : 'w-64',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 bg-[#090d16]">
          {!isCollapsed ? (
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm tracking-wide shadow-md shadow-blue-500/25">
                S
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h1 className="text-sm font-bold tracking-tight text-white uppercase">
                    SETU
                  </h1>
                  <span className="text-[10px] bg-blue-500/15 text-blue-300 font-semibold px-1.5 py-0.5 rounded border border-blue-500/30">
                    CRM
                  </span>
                </div>
                <p className="text-[10px] text-slate-400 font-medium">Enterprise Suite</p>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 mx-auto rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md shadow-blue-500/25">
              S
            </div>
          )}

          {/* Desktop collapse toggle */}
          <button
            onClick={onCollapseToggle}
            className="hidden lg:flex items-center justify-center w-7 h-7 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>

          {/* Mobile close button */}
          <button
            onClick={onToggle}
            className="lg:hidden flex items-center justify-center w-7 h-7 rounded text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent p-2 space-y-4 h-[calc(100vh-4rem)]">
          {navigation.map((section, idx) => (
            <div key={idx}>
              {section.items ? (
                // Section with items
                <div>
                  {!isCollapsed && (
                    <h3 className="px-3 mb-1.5 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {section.name}
                    </h3>
                  )}
                  {isCollapsed && (
                    <div className="w-full h-px bg-slate-800 my-2" />
                  )}
                  <div className="space-y-0.5">
                    {section.items.map((item) => (
                      <NavItem
                        key={item.path}
                        item={item}
                        isCollapsed={isCollapsed}
                        onClick={onToggle}
                      />
                    ))}
                  </div>
                </div>
              ) : (
                // Single item
                <NavItem
                  item={section}
                  isCollapsed={isCollapsed}
                  onClick={onToggle}
                />
              )}
            </div>
          ))}
        </nav>

        {/* Sign Out button */}
        <div className="border-t border-slate-800/80 p-3 bg-[#090d16]/80">
          <button
            className={cn(
              'w-full flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/30 rounded-lg py-2 px-3 text-xs font-medium transition-all',
              isCollapsed && 'px-0'
            )}
            onClick={handleLogout}
          >
            <LogOut className={cn('h-4 w-4', !isCollapsed && 'mr-2')} />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>
    </>
  );
};

const StatusItem = ({ label, status }) => {
  const isOnline = status === 'online';

  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="flex items-center gap-1.5">
        <div className={cn(
          "w-2 h-2 rounded-full",
          isOnline ? "bg-success animate-pulse" : "bg-destructive"
        )} />
        <span className={cn(
          "font-medium",
          isOnline ? "text-success" : "text-destructive"
        )}>
          {isOnline ? 'Online' : 'Offline'}
        </span>
      </div>
    </div>
  );
};

const NavItem = ({ item, isCollapsed, onClick }) => {
  const Icon = item.icon;
  const isExternal = Boolean(item.external) || /^https?:\/\//.test(item.path);
  const openInPopup = Boolean(item.openInPopup);

  const handleItemClick = () => {
    // Close mobile sidebar when clicking a link
    if (window.innerWidth < 1024) {
      onClick?.();
    }
  };

  const handleExternalClick = (event) => {
    handleItemClick();

    if (!openInPopup) {
      return;
    }

    event.preventDefault();

    const popupWidth = 1200;
    const popupHeight = 760;
    const left = Math.max(Math.floor((window.screen.width - popupWidth) / 2), 0);
    const top = Math.max(Math.floor((window.screen.height - popupHeight) / 2), 0);
    const popupFeatures = [
      'popup=yes',
      `width=${popupWidth}`,
      `height=${popupHeight}`,
      `left=${left}`,
      `top=${top}`,
      'resizable=yes',
      'scrollbars=yes',
    ].join(',');

    const popup = window.open(item.path, 'infiverseDashboardWindow', popupFeatures);

    if (popup) {
      popup.focus();
      return;
    }

    // Fallback when popups are blocked by browser settings.
    window.open(item.path, '_blank', 'noopener,noreferrer');
  };

  if (isExternal) {
    return (
      <a
        href={item.path}
        onClick={handleExternalClick}
        className={cn(
          'flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-slate-300 hover:text-white hover:bg-slate-800/60 group relative text-xs font-medium',
          isCollapsed && 'justify-center px-2'
        )}
        title={isCollapsed ? item.name : undefined}
      >
        <Icon className="h-4 w-4 flex-shrink-0 text-slate-400 group-hover:text-slate-200 transition-colors" />
        {!isCollapsed && (
          <span className="whitespace-nowrap overflow-hidden text-ellipsis">
            {item.name}
          </span>
        )}

        {/* Tooltip for collapsed state */}
        {isCollapsed && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-slate-900 border border-slate-700 text-white text-xs rounded shadow-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
            {item.name}
          </div>
        )}
      </a>
    );
  }

  return (
    <NavLink
      to={item.path}
      onClick={handleItemClick}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 group relative text-xs font-medium',
          isActive
            ? 'bg-gradient-to-r from-blue-600/20 to-blue-500/5 text-blue-400 font-semibold border border-blue-500/30 shadow-xs'
            : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60',
          isCollapsed && 'justify-center px-2'
        )
      }
      title={isCollapsed ? item.name : undefined}
    >
      <Icon className={cn(
        "h-4 w-4 flex-shrink-0 transition-colors",
        "group-hover:text-slate-100"
      )} />
      {!isCollapsed && (
        <span className="whitespace-nowrap overflow-hidden text-ellipsis">
          {item.name}
        </span>
      )}

      {/* Tooltip for collapsed state */}
      {isCollapsed && (
        <div className="absolute left-full ml-2 px-2.5 py-1 bg-slate-900 border border-slate-700 text-white text-xs rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all whitespace-nowrap z-50">
          {item.name}
        </div>
      )}
    </NavLink>
  );
};

export default Sidebar;
