import React from 'react';
import { Menu, Search, Bell, Moon, Sun, User, LogOut, Settings, ChevronDown, CheckCheck, CheckCircle2, ArrowRight, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/MongoAuthContext';
import { cn } from '@/utils/helpers';
import Button from '../common/ui/Button';
import Badge from '../common/ui/Badge';
import { dashboardAPI } from '../../services/api/dashboardAPI';
import { formatRelativeTime } from '@/utils/dateUtils';

export const Header = ({ onMenuClick, isDark, onThemeToggle }) => {
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [recentAlerts, setRecentAlerts] = React.useState([]);
  const [showUserMenu, setShowUserMenu] = React.useState(false);
  const [showSearch, setShowSearch] = React.useState(false);
  const [showNotifications, setShowNotifications] = React.useState(false);
  const { user, profile, logout } = useAuth();
  const navigate = useNavigate();

  const fetchUnreadAlerts = React.useCallback(async () => {
    let apiAlerts = [];
    try {
      const res = await dashboardAPI.getAlerts();
      const raw = res.data?.data?.alerts || res.data?.alerts || (Array.isArray(res.data) ? res.data : []);
      apiAlerts = Array.isArray(raw) ? raw : [];
    } catch (err) {
      apiAlerts = [];
    }

    const readIds = new Set(JSON.parse(localStorage.getItem('setu_read_alert_ids') || '[]'));

    const formattedApiAlerts = apiAlerts.map((alert, idx) => {
      const id = alert.id || `api_alert_${idx + 1}`;
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

    setRecentAlerts(unique.slice(0, 8));
    const unread = unique.filter((a) => !a.read).length;
    setUnreadCount(unread);
  }, []);

  const handleAlertItemClick = (alert) => {
    const readIds = new Set(JSON.parse(localStorage.getItem('setu_read_alert_ids') || '[]'));
    readIds.add(alert.id);
    localStorage.setItem('setu_read_alert_ids', JSON.stringify(Array.from(readIds)));

    const customAlerts = JSON.parse(localStorage.getItem('setu_custom_notifications') || '[]');
    const updatedCustom = customAlerts.map(n => n.id === alert.id ? { ...n, read: true } : n);
    localStorage.setItem('setu_custom_notifications', JSON.stringify(updatedCustom));

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

  const handleMarkAllAlertsRead = (e) => {
    e.stopPropagation();
    const allIds = recentAlerts.map(a => a.id);
    const existing = new Set(JSON.parse(localStorage.getItem('setu_read_alert_ids') || '[]'));
    allIds.forEach(id => existing.add(id));
    localStorage.setItem('setu_read_alert_ids', JSON.stringify(Array.from(existing)));

    const customAlerts = JSON.parse(localStorage.getItem('setu_custom_notifications') || '[]');
    const updatedCustom = customAlerts.map(n => ({ ...n, read: true }));
    localStorage.setItem('setu_custom_notifications', JSON.stringify(updatedCustom));

    setUnreadCount(0);
    setRecentAlerts(prev => prev.map(a => ({ ...a, read: true })));
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

          {/* Notifications Popover & Bell */}
          <div className="relative">
            <Button 
              variant="ghost" 
              size="icon"
              onClick={() => setShowNotifications(!showNotifications)}
              className={cn(
                "hover:scale-110 transition-transform relative",
                showNotifications && "bg-accent text-accent-foreground"
              )}
              aria-label="Notifications"
            >
              <Bell className="h-5 w-5" />
            </Button>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[10px] font-bold text-white shadow-md animate-pulse-slow pointer-events-none">
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
