import React from 'react';
import { Menu, Search, Bell, Moon, Sun, LogOut, Settings, ChevronDown, CheckCheck, CheckCircle2, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/MongoAuthContext';
import { cn } from '@/utils/helpers';
import { ROUTES } from '@/utils/constants';
import Button from '../common/ui/Button';
import { dashboardAPI } from '../../services/api/dashboardAPI';
import { financialAPI } from '../../services/api/financialAPI';
import { notificationAPI } from '../../services/api/notificationAPI';
import { formatRelativeTime } from '@/utils/dateUtils';

const STAFF_SEARCH_ITEMS = [
  { label: 'Executive Dashboard', category: 'Overview', path: ROUTES.DASHBOARD },
  { label: 'CRM Management', category: 'CRM & Logistics', path: ROUTES.CRM },
  { label: 'Logistics & Inventory', category: 'CRM & Logistics', path: ROUTES.LOGISTICS },
  { label: 'Product Catalog', category: 'CRM & Logistics', path: ROUTES.PRODUCTS },
  { label: 'Supplier Management', category: 'CRM & Logistics', path: ROUTES.SUPPLIERS },
  { label: 'Proof Approvals', category: 'Field Ops', path: ROUTES.FIELD_REVIEWS },
  { label: 'Bright Connection Demo', category: 'Field Ops', path: ROUTES.BRIGHT_CONNECTION },
  { label: 'Sellers & Dispatch', category: 'Fulfillment', path: ROUTES.SELLER_PORTAL },
  { label: 'Customer Portal', category: 'Storefront', path: ROUTES.CUSTOMER_PORTAL },
  { label: 'EMS Automation', category: 'AI & Automation', path: ROUTES.EMAILS },
  { label: 'RL Learning', category: 'AI & Automation', path: ROUTES.LEARNING },
  { label: 'AI Decisions', category: 'AI & Automation', path: ROUTES.DECISIONS },
  { label: 'AI Agents', category: 'AI & Automation', path: ROUTES.AGENTS },
  { label: 'Analytics & Reports', category: 'Reports', path: ROUTES.REPORTS },
  { label: 'Notifications', category: 'System', path: ROUTES.NOTIFICATIONS },
  { label: 'Settings', category: 'System', path: ROUTES.SETTINGS },
];

const CUSTOMER_SEARCH_ITEMS = [
  { label: 'Shop Catalog', category: 'Customer Portal', path: ROUTES.CUSTOMER_PORTAL },
  { label: 'My Orders', category: 'Customer Portal', path: ROUTES.CUSTOMER_ORDERS },
  { label: 'Account', category: 'Customer Portal', path: ROUTES.CUSTOMER_ACCOUNT },
  { label: 'Notifications', category: 'Customer Portal', path: ROUTES.CUSTOMER_NOTIFICATIONS },
];

const SELLER_SEARCH_ITEMS = [
  { label: 'Orders & Invoices', category: 'Seller Portal', path: `${ROUTES.SELLER_PORTAL}?tab=orders` },
  { label: 'Dealer / Shipping', category: 'Seller Portal', path: `${ROUTES.SELLER_PORTAL}?tab=shipping` },
  { label: 'Notifications', category: 'Seller Portal', path: `${ROUTES.SELLER_PORTAL}?tab=notifications` },
];

export const Header = ({ onMenuClick, isDark, onThemeToggle }) => {
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [recentAlerts, setRecentAlerts] = React.useState([]);
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const [showSearch, setShowSearch] = React.useState(false);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [activeSearchIdx, setActiveSearchIdx] = React.useState(0);
  const searchInputRef = React.useRef(null);
  const allAlertIdsRef = React.useRef([]);
  const { user, profile, logout, isCustomer } = useAuth();
  const navigate = useNavigate();

  const quickNavItems = React.useMemo(() => {
    const base = isCustomer
      ? CUSTOMER_SEARCH_ITEMS
      : user?.role === 'seller'
      ? SELLER_SEARCH_ITEMS
      : user?.role === 'field_agent'
      ? [{ label: 'Field Agent Portal', category: 'Field Ops', path: ROUTES.FIELD_AGENT }]
      : STAFF_SEARCH_ITEMS;
    const q = searchQuery.trim().toLowerCase();
    if (!q) return base.slice(0, 6);
    return base
      .filter((item) => item.label.toLowerCase().includes(q) || item.category.toLowerCase().includes(q))
      .slice(0, 6);
  }, [isCustomer, user?.role, searchQuery]);

  React.useEffect(() => {
    const onKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        setSearchOpen(true);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const fetchUnreadAlerts = React.useCallback(async () => {
    if (isCustomer) {
      const [arthaRes, personalRes] = await Promise.allSettled([
        financialAPI.unreadCount(),
        notificationAPI.unreadCount(),
      ]);
      const arthaUnread = arthaRes.status === 'fulfilled' ? Number(arthaRes.value.data?.data?.count) || 0 : 0;
      const personalUnread =
        personalRes.status === 'fulfilled'
          ? Number(personalRes.value.data?.data?.count ?? personalRes.value.data?.count) || 0
          : 0;
      setUnreadCount(arthaUnread + personalUnread);
      return;
    }

    const [alertsRes, personalRes] = await Promise.allSettled([
      dashboardAPI.getAlerts(),
      notificationAPI.unreadCount(),
    ]);

    let apiAlerts = [];
    if (alertsRes.status === 'fulfilled') {
      const res = alertsRes.value;
      const raw = res.data?.data?.alerts || res.data?.alerts || (Array.isArray(res.data) ? res.data : []);
      apiAlerts = Array.isArray(raw) ? raw : [];
    }

    const personalUnread =
      personalRes.status === 'fulfilled'
        ? Number(personalRes.value.data?.data?.count ?? personalRes.value.data?.count) || 0
        : 0;

    const readIds = new Set(JSON.parse(localStorage.getItem('setu_read_alert_ids') || '[]'));

    const formattedApiAlerts = apiAlerts.map((alert, idx) => {
      const id =
        alert.id ||
        (alert.productId ? `low_stock_${alert.productId}` : null) ||
        (alert.requestId ? `restock_${alert.requestId}` : null) ||
        (alert.type === 'pending_orders' ? `pending_orders_${alert.count ?? idx}` : null) ||
        `api_alert_${idx + 1}`;
      return {
        id,
        title: alert.title || alert.message || 'System Notification',
        message: alert.message || alert.description || '',
        severity: alert.severity || 'info',
        timestamp: alert.timestamp ? new Date(alert.timestamp) : new Date(),
        read: alert.read || readIds.has(id),
        taskId: alert.taskId || null,
        targetUrl: alert.targetUrl || (alert.taskId ? `/field-reviews?taskId=${encodeURIComponent(alert.taskId)}` : null),
      };
    });

    const customAlerts = JSON.parse(localStorage.getItem('setu_custom_notifications') || '[]');
    const formattedCustomAlerts = customAlerts.map((n) => ({
      ...n,
      read: n.read || readIds.has(n.id),
      timestamp: new Date(n.timestamp),
    }));

    // Deduplicate alerts by id
    const all = [...formattedCustomAlerts, ...formattedApiAlerts];
    const seen = new Set();
    const unique = [];
    for (const a of all) {
      if (!seen.has(a.id)) {
        seen.add(a.id);
        unique.push(a);
      }
    }

    // Sort: unread first, then newer timestamps first
    unique.sort((a, b) => {
      if (a.read !== b.read) return a.read ? 1 : -1;
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    allAlertIdsRef.current = unique.map((a) => a.id);
    setRecentAlerts(unique.slice(0, 8));
    const unread = unique.filter((a) => !a.read).length;
    setUnreadCount(unread + personalUnread);
  }, [isCustomer]);

  const handleAlertItemClick = (alert) => {
    const readIds = new Set(JSON.parse(localStorage.getItem('setu_read_alert_ids') || '[]'));
    readIds.add(alert.id);
    localStorage.setItem('setu_read_alert_ids', JSON.stringify(Array.from(readIds)));

    const customAlerts = JSON.parse(localStorage.getItem('setu_custom_notifications') || '[]');
    const updatedCustom = customAlerts.map(n => n.id === alert.id ? { ...n, read: true } : n);
    localStorage.setItem('setu_custom_notifications', JSON.stringify(updatedCustom));

    setRecentAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, read: true } : a));
    window.dispatchEvent(new Event('setu_alerts_updated'));
    setShowNotifications(false);

    if (alert.targetUrl) {
      navigate(alert.targetUrl);
    } else if (alert.taskId) {
      navigate(`/field-reviews?taskId=${encodeURIComponent(alert.taskId)}`);
    } else {
      navigate('/field-reviews');
    }
  };

  const handleMarkAllAlertsRead = async (e) => {
    e.stopPropagation();
    const allIds = allAlertIdsRef.current.length
      ? allAlertIdsRef.current
      : recentAlerts.map((a) => a.id);
    const existing = new Set(JSON.parse(localStorage.getItem('setu_read_alert_ids') || '[]'));
    allIds.forEach((id) => existing.add(id));
    localStorage.setItem('setu_read_alert_ids', JSON.stringify(Array.from(existing)));

    const customAlerts = JSON.parse(localStorage.getItem('setu_custom_notifications') || '[]');
    const updatedCustom = customAlerts.map((n) => ({ ...n, read: true }));
    localStorage.setItem('setu_custom_notifications', JSON.stringify(updatedCustom));
    localStorage.setItem('setu_unread_alerts', '0');

    setUnreadCount(0);
    setRecentAlerts((prev) => prev.map((a) => ({ ...a, read: true })));

    try {
      await notificationAPI.markAllRead();
    } catch {
      // Best-effort: backend personal notifications may be unavailable in standalone mode
    }

    window.dispatchEvent(new Event('setu_alerts_updated'));
  };

  React.useEffect(() => {
    fetchUnreadAlerts();
    const handleUpdate = () => fetchUnreadAlerts();
    window.addEventListener('setu_alerts_updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    const pollInterval = setInterval(fetchUnreadAlerts, 8000);

    return () => {
      window.removeEventListener('setu_alerts_updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
      clearInterval(pollInterval);
    };
  }, [fetchUnreadAlerts]);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/auth/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const getUserInitials = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    if (user?.email) {
      return user.email[0].toUpperCase();
    }
    return 'DV'; // Dev mode
  };

  const getUserDisplayName = () => {
    if (profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    if (user?.email) {
      return user.email.split('@')[0];
    }
    return 'Dev User'; // Dev mode
  };

  const getUserEmail = () => {
    return user?.email || 'dev@localhost';
  };

  return (
    <header className="h-14 bg-white dark:bg-[#0f172a] border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 select-none">
      <div className="h-full flex items-center justify-between px-4 sm:px-6">
        {/* Left section */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden h-8 w-8 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 hidden sm:inline tracking-tight">SETU Business Suite</span>
            <span className="text-[11px] bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2.5 py-0.5 rounded-full font-medium border border-blue-500/20 hidden md:inline-flex items-center gap-1.5 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              v2.4 Live
            </span>
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Search with ⌘K quick navigation */}
          <div className="relative hidden md:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setActiveSearchIdx(0);
                setSearchOpen(true);
              }}
              placeholder="Jump to page or module... (⌘K)"
              className="pl-8 pr-3 py-1.5 w-60 lg:w-72 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder:text-slate-400 shadow-xs"
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setActiveSearchIdx((prev) => (quickNavItems.length ? (prev + 1) % quickNavItems.length : 0));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setActiveSearchIdx((prev) => (quickNavItems.length ? (prev - 1 + quickNavItems.length) % quickNavItems.length : 0));
                } else if (e.key === 'Enter' && quickNavItems[activeSearchIdx]) {
                  e.preventDefault();
                  navigate(quickNavItems[activeSearchIdx].path);
                  setSearchQuery('');
                  setSearchOpen(false);
                  searchInputRef.current?.blur();
                } else if (e.key === 'Escape') {
                  setSearchOpen(false);
                  searchInputRef.current?.blur();
                }
              }}
            />
            {searchOpen && (
              <div className="absolute right-0 top-full mt-1.5 w-72 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 py-1.5 overflow-hidden">
                {quickNavItems.length > 0 ? (
                  quickNavItems.map((item, idx) => (
                    <button
                      key={item.path}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        navigate(item.path);
                        setSearchQuery('');
                        setSearchOpen(false);
                      }}
                      className={cn(
                        'w-full px-3 py-2 text-left flex items-center justify-between text-xs transition-colors',
                        idx === activeSearchIdx
                          ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 font-semibold'
                          : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70'
                      )}
                    >
                      <span>{item.label}</span>
                      <span className="text-[10px] text-slate-400 font-normal">{item.category}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-xs text-slate-400">No matching modules</p>
                )}
              </div>
            )}
          </div>

          {/* Mobile Search Button */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => {
              setShowSearch(!showSearch);
              if (!showSearch) {
                setTimeout(() => {
                  const searchInput = document.querySelector('.mobile-search-input');
                  if (searchInput) searchInput.focus();
                }, 100);
              }
            }}
            className="md:hidden h-8 w-8 text-slate-600 dark:text-slate-300"
            aria-label="Search"
          >
            <Search className="h-4 w-4" />
          </Button>
          
          {/* Mobile Search Input */}
          {showSearch && (
            <div className="absolute top-full left-0 right-0 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 p-3 md:hidden z-50 shadow-md">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search CRM..."
                  className="mobile-search-input pl-9 pr-3 py-1.5 w-full rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
                  onBlur={() => setTimeout(() => setShowSearch(false), 200)}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') {
                      setShowSearch(false);
                    }
                  }}
                />
              </div>
            </div>
          )}

          {/* Notifications Popover & Bell */}
          <div className="relative">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => {
                if (isCustomer) {
                  navigate('/customer-portal/notifications');
                } else {
                  setShowNotifications(!showNotifications);
                }
              }}
              className={cn(
                "h-8 w-8 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 relative",
                showNotifications && "bg-slate-100 dark:bg-slate-800"
              )}
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
            </Button>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9px] font-bold text-white shadow-sm pointer-events-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}

            {/* Notifications Dropdown Popover */}
            {showNotifications && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowNotifications(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-card rounded-2xl shadow-2xl border border-border z-50 overflow-hidden animate-scale-in">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-2">
                      <Bell className="w-4 h-4 text-primary" />
                      <h4 className="text-sm font-bold text-foreground">Notifications</h4>
                      {unreadCount > 0 && (
                        <span className="text-[10px] font-extrabold px-1.5 py-0.2 rounded-full bg-red-600 text-white">
                          {unreadCount} new
                        </span>
                      )}
                    </div>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllAlertsRead}
                        className="text-[11px] font-medium text-primary hover:underline flex items-center gap-1"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Mark all read
                      </button>
                    )}
                  </div>

                  {/* Dropdown Items */}
                  <div className="max-h-[380px] overflow-y-auto divide-y divide-border/60">
                    {recentAlerts.length > 0 ? (
                      recentAlerts.map((alert) => (
                        <div
                          key={alert.id}
                          onClick={() => handleAlertItemClick(alert)}
                          className={cn(
                            "p-3.5 hover:bg-muted/50 cursor-pointer transition-colors flex items-start gap-3 text-left",
                            !alert.read && "bg-primary/5"
                          )}
                        >
                          <div className={cn(
                            "w-2.5 h-2.5 rounded-full mt-1.5 shrink-0",
                            alert.severity === 'critical' ? "bg-red-500 shadow-sm shadow-red-500/50" :
                            alert.severity === 'warning' ? "bg-amber-500 shadow-sm shadow-amber-500/50" :
                            "bg-primary"
                          )} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1 mb-0.5">
                              <p className="text-xs font-bold text-foreground truncate">
                                {alert.title}
                              </p>
                              {!alert.read && (
                                <span className="w-2 h-2 rounded-full bg-primary shrink-0" />
                              )}
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                              {alert.message}
                            </p>
                            <div className="flex items-center justify-between mt-1.5 pt-1 text-[10px] text-muted-foreground/80">
                              <span>{formatRelativeTime(alert.timestamp)}</span>
                              <span className="text-primary font-bold hover:underline flex items-center gap-0.5">
                                Review & Accept →
                              </span>
                            </div>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        <CheckCircle2 className="w-8 h-8 mx-auto text-muted-foreground/40 mb-2" />
                        No active notifications
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="p-2.5 border-t border-border bg-muted/20 text-center">
                    <button
                      onClick={() => {
                        setShowNotifications(false);
                        navigate('/notifications');
                      }}
                      className="text-xs font-semibold text-primary hover:underline flex items-center justify-center gap-1.5 w-full py-1"
                    >
                      View All in Notifications Center
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Theme Toggle */}
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={onThemeToggle}
            className="h-8 w-8 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* User Profile */}
          <div className="relative flex items-center pl-2 border-l border-slate-200 dark:border-slate-800">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800/80 rounded-lg p-1.5 transition-colors"
            >
              <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs ring-2 ring-blue-500/20 shadow-xs">
                <span>
                  {getUserInitials()}
                </span>
              </div>
              <div className="hidden lg:block text-left pr-1">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">{getUserDisplayName()}</p>
                <p className="text-[10px] text-slate-400 leading-tight">{getUserEmail()}</p>
              </div>
              <ChevronDown className={cn(
                "h-3.5 w-3.5 text-slate-400 transition-transform hidden lg:block",
                showUserMenu && "rotate-180"
              )} />
            </button>

            {/* User Dropdown Menu */}
            {showUserMenu && (
              <>
                <div 
                  className="fixed inset-0 z-40" 
                  onClick={() => setShowUserMenu(false)}
                />
                <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-xl border border-slate-200 dark:border-slate-800 z-50 py-2 text-slate-900 dark:text-slate-100 backdrop-blur-md">
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{getUserDisplayName()}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{getUserEmail()}</p>
                    {profile?.company_name && (
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{profile.company_name}</p>
                    )}
                  </div>
                  
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      navigate('/settings');
                    }}
                    className="w-full px-4 py-2 text-left text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 text-slate-700 dark:text-slate-300"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      handleLogout();
                    }}
                    className="w-full px-4 py-2 text-left text-xs font-medium hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors flex items-center gap-2 text-rose-600 dark:text-rose-400"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
