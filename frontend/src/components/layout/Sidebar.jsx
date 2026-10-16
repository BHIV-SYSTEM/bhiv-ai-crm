import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard, Package, Users, Building2, ShoppingCart, Bot, MapPinned,
  Workflow, Brain, GraduationCap, Bell, Mail, BarChart3, Settings,
  UsersRound, Menu, X, ChevronLeft, ChevronRight, TrendingUp, Zap,
  Store, Activity, Sparkles, LogOut, Truck, ShieldCheck
} from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import { cn } from '@/utils/helpers';
import { ROUTES } from '@/utils/constants';
import Button from '../common/ui/Button';
import { useAuth } from '@/context/MongoAuthContext';
import notificationAPI from '@/services/api/notificationAPI';
import financialAPI from '@/services/api/financialAPI';

export const Sidebar = ({ isOpen, onToggle, isCollapsed, onCollapseToggle }) => {
  const { logout, isCustomer, user } = useAuth();
  const isFieldAgent = user?.role === 'field_agent';
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  // Live unread badge for the customer notification centre (SETU + ARTHA).
  useEffect(() => {
    if (!isCustomer) {
      setUnread(0);
      return undefined;
    }
    let alive = true;
    const load = async () => {
      const [setu, artha] = await Promise.allSettled([
        notificationAPI.unreadCount(),
        financialAPI.unreadCount(),
      ]);
      if (!alive) return;
      const a = setu.status === 'fulfilled' ? Number(setu.value.data?.data?.count || 0) : 0;
      const b = artha.status === 'fulfilled' ? Number(artha.value.data?.data?.count || 0) : 0;
      setUnread(a + b);
    };
    load().catch(() => {});
    const timer = setInterval(load, 45000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [isCustomer]);

  // Role-based navigation
  const navigation = isCustomer
    ? [
      { name: 'Shop', icon: ShoppingCart, path: ROUTES.CUSTOMER_PORTAL },
      { name: 'My Orders', icon: Package, path: ROUTES.CUSTOMER_ORDERS },
      { name: 'Account', icon: Users, path: ROUTES.CUSTOMER_ACCOUNT },
      { name: 'Notifications', icon: Bell, path: ROUTES.CUSTOMER_NOTIFICATIONS, badge: unread || undefined },
    ]
    : isFieldAgent
    ? [
      { name: 'Field Agent Portal', icon: MapPinned, path: ROUTES.FIELD_AGENT },
    ]
    : [
      { name: 'Overview', icon: LayoutDashboard, path: ROUTES.DASHBOARD },
      {
        name: 'CRM & Logistics',
        items: [
          { name: 'Proof Approvals', icon: ShieldCheck, path: ROUTES.FIELD_REVIEWS },
          { name: 'Bright Connection Demo', icon: Zap, path: ROUTES.BRIGHT_CONNECTION },
          { name: 'CRM Management', icon: Users, path: ROUTES.CRM },
          { name: 'Logistics & Inventory', icon: Package, path: ROUTES.LOGISTICS },
          { name: 'Infiverse Monitoring', icon: UsersRound, path: ROUTES.INFIVERSE },
          { name: 'Sampada Dashboard', icon: Activity, path: ROUTES.SAMPADA },
          { name: 'AI Artha', icon: Sparkles, path: ROUTES.AI_ARTHA },
          { name: 'Supplier Management', icon: Building2, path: ROUTES.SUPPLIERS },
          { name: 'Product Catalog', icon: ShoppingCart, path: ROUTES.PRODUCTS },
          { name: 'Supplier Showcase', icon: Store, path: '/showcase' },
          {
            name: 'Sellers & Dispatch',
            icon: Truck,
            path: ROUTES.SELLER_PORTAL,
          },
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
          'fixed left-0 top-0 z-50 h-screen bg-card border-r border-border shadow-xl backdrop-blur-sm transition-all duration-300 flex flex-col',
          isCollapsed ? 'w-16' : 'w-64',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-border">
          {!isCollapsed && (
            <div className="gradient-primary rounded-lg px-3 py-2 shadow-glow-primary animate-scale-in">
              <h1 className="text-lg font-heading font-bold text-primary-foreground">
                SETU
              </h1>
            </div>
          )}

          {/* Desktop collapse toggle */}
          <button
            onClick={onCollapseToggle}
            className="hidden lg:flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted hover:scale-110 transition-all duration-200"
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>

          {/* Mobile close button */}
          <button
            onClick={onToggle}
            className="lg:hidden flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted hover:scale-110 transition-all duration-200"
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>

          {/* Collapsed state logo */}
          {isCollapsed && (
            <div className="hidden lg:flex w-10 h-10 rounded-lg gradient-primary shadow-glow-primary items-center justify-center animate-scale-in">
              <Bot className="h-5 w-5 text-primary-foreground" />
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent p-2 sm:p-4 space-y-4 sm:space-y-6 h-[calc(100vh-4rem)]">
          {navigation.map((section, idx) => (
            <div key={idx}>
              {section.items ? (
                // Section with items
                <div>
                  {!isCollapsed && (
                    <h3 className="px-3 mb-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {section.name}
                    </h3>
                  )}
                  {isCollapsed && (
                    <div className="w-full h-px bg-border my-2" />
                  )}
                  <div className="space-y-1">
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
        <div className="border-t border-border px-3 py-3">
          <Button
            variant="outline"
            className={cn(
              'w-full flex items-center justify-center text-destructive border-destructive/40 hover:bg-destructive hover:text-destructive-foreground',
              isCollapsed && 'px-0'
            )}
            onClick={handleLogout}
          >
            <LogOut className={cn('h-4 w-4', !isCollapsed && 'mr-2')} />
            {!isCollapsed && <span className="font-semibold text-sm">Sign Out</span>}
          </Button>
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
          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group relative',
          'text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-105',
          isCollapsed && 'justify-center'
        )}
        title={isCollapsed ? item.name : undefined}
      >
        <Icon className={cn(
          'h-5 w-5 flex-shrink-0 transition-transform duration-200',
          !isCollapsed && 'group-hover:scale-110'
        )} />
        {!isCollapsed && (
          <span className="font-medium text-sm whitespace-nowrap overflow-hidden text-ellipsis">
            {item.name}
          </span>
        )}

        {/* Tooltip for collapsed state */}
        {isCollapsed && (
          <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-sm rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
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
          'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-300 group relative',
          isActive
            ? 'gradient-primary text-primary-foreground shadow-glow-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground hover:scale-105',
          isCollapsed && 'justify-center'
        )
      }
      title={isCollapsed ? item.name : undefined}
    >
      <Icon className={cn(
        "h-5 w-5 flex-shrink-0 transition-transform duration-200",
        !isCollapsed && "group-hover:scale-110"
      )} />
      {!isCollapsed && (
        <span className="font-medium text-sm whitespace-nowrap overflow-hidden text-ellipsis">
          {item.name}
        </span>
      )}

      {item.badge && (
        <span
          className={cn(
            'ml-auto min-w-[1.25rem] px-1.5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center h-5',
            isCollapsed && 'absolute top-1 right-1 ml-0 min-w-0 h-4 w-4 px-0'
          )}
        >
          {isCollapsed ? '' : item.badge}
        </span>
      )}

      {/* Tooltip for collapsed state */}
      {isCollapsed && (
        <div className="absolute left-full ml-2 px-2 py-1 bg-popover text-popover-foreground text-sm rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
          {item.name}
        </div>
      )}
    </NavLink>
  );
};

export default Sidebar;



