import React from 'react';
import { Menu, Search, Bell, Moon, Sun, User, LogOut, Settings, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/MongoAuthContext';
import { cn } from '@/utils/helpers';
import Button from '../common/ui/Button';
import Badge from '../common/ui/Badge';
import { dashboardAPI } from '../../services/api/dashboardAPI';

export const Header = ({ onMenuClick, isDark, onThemeToggle }) => {
  const [unreadCount, setUnreadCount] = React.useState(2);
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const [showSearch, setShowSearch] = React.useState(false);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();

  const fetchUnreadAlerts = React.useCallback(async () => {
    const override = localStorage.getItem('setu_unread_alerts');
    if (override !== null && override !== undefined && override !== '') {
      setUnreadCount(Number(override));
      return;
    }

    let apiAlerts = [];
    try {
      const res = await dashboardAPI.getAlerts();
      apiAlerts = res.data?.data?.alerts || [];
    } catch (err) {
      apiAlerts = [];
    }

    const readIds = new Set(JSON.parse(localStorage.getItem('setu_read_alert_ids') || '[]'));
    const unreadApi = apiAlerts.filter((a, idx) => !readIds.has(a.id || `api_alert_${idx + 1}`)).length;

    const customAlerts = JSON.parse(localStorage.getItem('setu_custom_notifications') || '[]');
    const unreadCustom = customAlerts.filter((a) => !a.read && !readIds.has(a.id)).length;

    const totalUnread = unreadApi + unreadCustom;
    setUnreadCount(totalUnread);
  }, []);

  React.useEffect(() => {
    fetchUnreadAlerts();
    const handleUpdate = () => fetchUnreadAlerts();
    window.addEventListener('setu_alerts_updated', handleUpdate);
    return () => window.removeEventListener('setu_alerts_updated', handleUpdate);
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
            className="lg:hidden h-8 w-8 text-slate-600 hover:text-slate-900"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100 hidden sm:inline tracking-tight">SETU Business Suite</span>
            <span className="text-[11px] bg-blue-500/10 text-blue-400 px-2.5 py-0.5 rounded-full font-medium border border-blue-500/20 hidden md:inline-flex items-center gap-1.5 shadow-xs">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              v2.4 Live
            </span>
          </div>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search records, accounts, SKU... (⌘K)"
              className="pl-8 pr-3 py-1.5 w-60 lg:w-72 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/90 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all placeholder:text-slate-400 shadow-xs"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const query = e.target.value.trim();
                  if (query) {
                    console.log('Searching for:', query);
                  }
                }
              }}
            />
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
            className="md:hidden h-8 w-8 text-slate-600"
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

          {/* Notifications */}
          <div className="relative">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => {
                setShowNotifications(!showNotifications);
                navigate('/notifications');
              }}
              className="h-8 w-8 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              aria-label="Notifications"
            >
              <Bell className="h-4 w-4" />
            </Button>
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-rose-600 text-[9px] font-bold text-white shadow-sm">
                {unreadCount}
              </span>
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
