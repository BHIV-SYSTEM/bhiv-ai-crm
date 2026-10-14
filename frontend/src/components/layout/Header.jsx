import React from 'react';
import { Menu, Search, Bell, Moon, Sun, User, LogOut, Settings, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/MongoAuthContext';
import { cn } from '@/utils/helpers';
import Button from '../common/ui/Button';
import Badge from '../common/ui/Badge';
import { dashboardAPI } from '../../services/api/dashboardAPI';
import { financialAPI } from '../../services/api/financialAPI';
import { notificationAPI } from '../../services/api/notificationAPI';

export const Header = ({ onMenuClick, isDark, onThemeToggle }) => {
  const [unreadCount, setUnreadCount] = React.useState(2);
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const [showSearch, setShowSearch] = React.useState(false);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const { user, profile, logout, isCustomer } = useAuth();
  const navigate = useNavigate();

  const fetchUnreadAlerts = React.useCallback(async () => {
    if (isCustomer) {
      // Customer portal: ARTHA financial inbox (bridge may be unconfigured)
      // PLUS the Mongo operational notifications where "order dispatched"
      // messages actually land — both are best-effort.
      let arthaUnread = 0;
      try {
        const res = await financialAPI.unreadCount();
        arthaUnread = Number(res.data?.data?.count) || 0;
      } catch {
        arthaUnread = 0;
      }
      let personalUnread = 0;
      try {
        const res = await notificationAPI.unreadCount();
        personalUnread = Number(res.data?.data?.count ?? res.data?.count) || 0;
      } catch {
        personalUnread = 0;
      }
      setUnreadCount(arthaUnread + personalUnread);
      return;
    }

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

    // Per-user operational notifications (order shipped, parcel assigned to a
    // seller, etc). SELLERS in particular only get these — dashboard alerts
    // are staff-only, so without this their bell would never update.
    let personalUnread = 0;
    try {
      const res = await notificationAPI.unreadCount();
      personalUnread = Number(res.data?.data?.count ?? res.data?.count) || 0;
    } catch {
      personalUnread = 0;
    }

    const readIds = new Set(JSON.parse(localStorage.getItem('setu_read_alert_ids') || '[]'));
    const unreadApi = apiAlerts.filter((a, idx) => !readIds.has(a.id || `api_alert_${idx + 1}`)).length;

    const customAlerts = JSON.parse(localStorage.getItem('setu_custom_notifications') || '[]');
    const unreadCustom = customAlerts.filter((a) => !a.read && !readIds.has(a.id)).length;

    const totalUnread = unreadApi + unreadCustom + personalUnread;
    setUnreadCount(totalUnread);
  }, [isCustomer]);

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
    <header className="h-16 bg-card shadow-sm backdrop-blur-sm border-b sticky top-0 z-30">
      <div className="h-full flex items-center justify-between px-4 sm:px-6">
        {/* Left section */}
        <div className="flex items-center gap-2 sm:gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuClick}
            className="lg:hidden hover:scale-110 transition-transform"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          
          <h2 className="text-lg sm:text-2xl font-heading font-bold tracking-tight truncate max-w-[150px] sm:max-w-none">
            <span className="hidden sm:inline">SETU</span>
            <span className="sm:hidden">AI System</span>
          </h2>
        </div>

        {/* Right section */}
        <div className="flex items-center gap-1 sm:gap-3">
          {/* Search */}
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search..."
              className="pl-10 pr-4 py-2 w-48 lg:w-64 rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const query = e.target.value.trim();
                  if (query) {
                    // Navigate to search results or perform search
                    console.log('Searching for:', query);
                    // You can add search functionality here
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
                // Focus search input after a brief delay
                setTimeout(() => {
                  const searchInput = document.querySelector('.mobile-search-input');
                  if (searchInput) searchInput.focus();
                }, 100);
              }
            }}
            className="md:hidden hover:scale-110 transition-transform"
            aria-label="Search"
          >
            <Search className="h-5 w-5" />
          </Button>
          
          {/* Mobile Search Input */}
          {showSearch && (
            <div className="absolute top-full left-0 right-0 bg-card border-b border-border p-4 md:hidden z-50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search..."
                  className="mobile-search-input pl-10 pr-4 py-2 w-full rounded-lg border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring transition-all"
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
                navigate(isCustomer ? '/customer-portal/notifications' : '/notifications');
              }}
              className="hover:scale-110 transition-transform"
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
            </Button>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-pulse-slow">
                {unreadCount}
              </span>
            )}
          </div>

          {/* Theme Toggle */}
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onThemeToggle}
            className="hover:scale-110 transition-transform"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </Button>

          {/* User Profile */}
          <div className="relative flex items-center gap-2 pl-2 sm:pl-3 border-l">
            <button
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="flex items-center gap-2 hover:bg-accent/50 rounded-lg p-1.5 transition-colors"
            >
              <div className="w-8 h-8 rounded-full gradient-primary flex items-center justify-center shadow-glow-primary">
                <span className="text-sm font-bold text-primary-foreground">
                  {getUserInitials()}
                </span>
              </div>
              <div className="hidden lg:block text-left">
                <p className="text-sm font-semibold">{getUserDisplayName()}</p>
                <p className="text-xs text-muted-foreground">{getUserEmail()}</p>
              </div>
              <ChevronDown className={cn(
                "h-4 w-4 text-muted-foreground transition-transform hidden lg:block",
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
                <div className="absolute right-0 top-full mt-2 w-56 bg-card rounded-lg shadow-lg border border-border z-50 py-2">
                  <div className="px-4 py-3 border-b border-border">
                    <p className="text-sm font-semibold">{getUserDisplayName()}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{getUserEmail()}</p>
                    {profile?.company_name && (
                      <p className="text-xs text-muted-foreground mt-1">{profile.company_name}</p>
                    )}
                  </div>
                  
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      navigate('/settings');
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-accent/50 transition-colors flex items-center gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    Settings
                  </button>
                  
                  <button
                    onClick={() => {
                      setShowUserMenu(false);
                      handleLogout();
                    }}
                    className="w-full px-4 py-2 text-left text-sm hover:bg-accent/50 transition-colors flex items-center gap-2 text-destructive"
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
