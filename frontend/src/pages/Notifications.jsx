import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bell, AlertTriangle, CheckCircle, Info, XCircle,
  Settings, Filter, CheckCheck, RefreshCw
} from 'lucide-react';
import Card, { CardHeader, CardTitle, CardContent } from '../components/common/ui/Card';
import MetricCard from '../components/common/charts/MetricCard';
import Button from '../components/common/ui/Button';
import Badge from '../components/common/ui/Badge';
import Alert from '../components/common/ui/Alert';
import { LoadingSpinner } from '../components/common/ui/Spinner';
import { formatRelativeTime } from '@/utils/dateUtils';
import { dashboardAPI } from '../services/api/dashboardAPI';

import { deviceNotificationService } from '@/services/deviceNotificationService';

export const Notifications = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [filter, setFilter] = useState('all'); // all, unread, read
  const [metrics, setMetrics] = useState({
    total: 0,
    unread: 0,
    today: 0,
    critical: 0,
  });

  // Fetch alerts from backend & local storage
  const fetchNotifications = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      let alerts = [];
      try {
        const response = await dashboardAPI.getAlerts();
        const rawAlerts = response.data?.data?.alerts || response.data?.alerts || (Array.isArray(response.data) ? response.data : []);
        alerts = Array.isArray(rawAlerts) ? rawAlerts : [];
      } catch (err) {
        console.warn('Backend API alerts unavailable, loading local alerts:', err);
      }

      const readIds = new Set(JSON.parse(localStorage.getItem('setu_read_alert_ids') || '[]'));

      // Transform backend alerts to notifications format
      const formattedApiAlerts = alerts.map((alert, index) => {
        const id = alert.id || `api_alert_${index + 1}`;
        const isRead = alert.read || readIds.has(id);
        return {
          id: id,
          type: alert.severity === 'critical' ? 'error' :
                alert.severity === 'high' ? 'warning' :
                alert.severity === 'medium' ? 'info' : 'success',
          title: alert.title || alert.message || 'Alert',
          message: alert.message || alert.description || '',
          timestamp: alert.timestamp ? new Date(alert.timestamp) : new Date(),
          read: isRead,
          severity: alert.severity || 'medium',
          taskId: alert.taskId || null,
          storeName: alert.storeName || null,
          targetUrl: alert.targetUrl || (alert.taskId ? `/field-reviews?taskId=${alert.taskId}` : null),
        };
      });

      // Load custom notifications from localStorage (e.g. OCR Storefront Verifications)
      const customAlerts = JSON.parse(localStorage.getItem('setu_custom_notifications') || '[]');
      const formattedCustomAlerts = customAlerts.map((n) => ({
        ...n,
        read: n.read || readIds.has(n.id),
        timestamp: new Date(n.timestamp),
      }));

      const allNotifications = [...formattedCustomAlerts, ...formattedApiAlerts];

      setNotifications(allNotifications);

      // Calculate metrics
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayAlerts = allNotifications.filter(n => n.timestamp >= today);
      const unreadAlerts = allNotifications.filter(n => !n.read);
      const criticalAlerts = allNotifications.filter(n => n.severity === 'critical');

      const unreadCount = unreadAlerts.length;
      localStorage.setItem('setu_unread_alerts', String(unreadCount));

      setMetrics({
        total: allNotifications.length,
        unread: unreadCount,
        today: todayAlerts.length,
        critical: criticalAlerts.length,
      });

      // Automatically sync unread alerts with hardware device push notification
      deviceNotificationService.syncAndPushNewNotifications(allNotifications);

    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err.response?.data?.detail || err.message || 'Failed to load notifications');
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotifications();
    const handleUpdate = () => fetchNotifications();
    window.addEventListener('setu_alerts_updated', handleUpdate);
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchNotifications();
    }, 30000);

    return () => {
      window.removeEventListener('setu_alerts_updated', handleUpdate);
      clearInterval(interval);
    };
  }, [fetchNotifications]);

  const getIcon = (type) => {
    const icons = {
      warning: AlertTriangle,
      success: CheckCircle,
      info: Info,
      error: XCircle,
    };
    return icons[type] || Info;
  };

  const getVariant = (type) => {
    const variants = {
      warning: 'warning',
      success: 'success',
      info: 'info',
      error: 'destructive',
    };
    return variants[type] || 'default';
  };

  const handleMarkAllRead = () => {
    const allIds = notifications.map(n => n.id);
    localStorage.setItem('setu_read_alert_ids', JSON.stringify(allIds));

    const updated = notifications.map(n => ({ ...n, read: true }));
    setNotifications(updated);
    setMetrics(prev => ({
      ...prev,
      unread: 0
    }));

    // Update custom notifications in localStorage
    const customAlerts = JSON.parse(localStorage.getItem('setu_custom_notifications') || '[]');
    const readCustom = customAlerts.map(n => ({ ...n, read: true }));
    localStorage.setItem('setu_custom_notifications', JSON.stringify(readCustom));
    localStorage.setItem('setu_unread_alerts', '0');

    window.dispatchEvent(new Event('setu_alerts_updated'));
  };

  const handleTestDeviceNotification = async () => {
    await deviceNotificationService.requestPermission();
    deviceNotificationService.sendTestNotification();
  };

  const handleNotificationClick = (notification) => {
    // 1. Persistently mark notification as read
    const readIds = new Set(JSON.parse(localStorage.getItem('setu_read_alert_ids') || '[]'));
    readIds.add(notification.id);
    localStorage.setItem('setu_read_alert_ids', JSON.stringify(Array.from(readIds)));

    const updated = notifications.map(n => n.id === notification.id ? { ...n, read: true } : n);
    setNotifications(updated);
    
    const unreadCount = updated.filter(n => !n.read).length;
    setMetrics(prev => ({
      ...prev,
      unread: unreadCount
    }));
    localStorage.setItem('setu_unread_alerts', String(unreadCount));

    window.dispatchEvent(new Event('setu_alerts_updated'));

    // 2. Intelligently route to corresponding feature page
    const titleLower = (notification.title || '').toLowerCase();
    const msgLower = (notification.message || '').toLowerCase();

    if (notification.targetUrl) {
      navigate(notification.targetUrl);
    } else if (notification.taskId) {
      navigate(`/field-reviews?taskId=${encodeURIComponent(notification.taskId)}`);
    } else if (
      titleLower.includes('proof') ||
      titleLower.includes('storefront') ||
      titleLower.includes('signboard') ||
      titleLower.includes('arrival') ||
      msgLower.includes('storefront') ||
      msgLower.includes('signboard') ||
      msgLower.includes('field agent')
    ) {
      navigate('/field-reviews');
    } else if (titleLower.includes('ocr') || msgLower.includes('ocr') || msgLower.includes('bright connection') || msgLower.includes('raj prajapati') || msgLower.includes('rajesh')) {
      navigate('/bright-connection');
    } else if (titleLower.includes('order') || msgLower.includes('order') || msgLower.includes('dispatched') || msgLower.includes('waiting')) {
      navigate('/logistics');
    } else if (titleLower.includes('stock') || titleLower.includes('product') || msgLower.includes('stock') || msgLower.includes('restock')) {
      navigate('/inventory');
    } else {
      navigate('/field-reviews');
    }
  };

  const filteredNotifications = filter === 'all' 
    ? notifications 
    : filter === 'unread' 
    ? notifications.filter(n => !n.read)
    : notifications.filter(n => n.read);

  if (loading) {
    return <LoadingSpinner text="Loading notifications..." />;
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-heading font-bold tracking-tight">Alert Management</h1>
          <p className="text-muted-foreground mt-1">
            View and manage system notifications and hardware device push alerts
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={handleTestDeviceNotification}>
            <Bell className="h-4 w-4 mr-2 text-primary animate-pulse" />
            Test Device Push
          </Button>
          <Button variant="outline" size="sm" onClick={fetchNotifications}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button variant="outline" onClick={handleMarkAllRead}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark All Read
          </Button>
          <Button onClick={() => navigate('/settings')}>
            <Settings className="h-4 w-4 mr-2" />
            Settings
          </Button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive" onClose={() => setError(null)}>
          <AlertTriangle className="h-4 w-4 mr-2" />
          {error}
        </Alert>
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Notifications"
          value={metrics.total.toLocaleString()}
          icon={Bell}
          variant="primary"
        />
        <MetricCard
          title="Unread"
          value={metrics.unread.toLocaleString()}
          icon={Bell}
          variant="warning"
        />
        <MetricCard
          title="Today"
          value={metrics.today.toLocaleString()}
          icon={Bell}
          variant="accent"
        />
        <MetricCard
          title="Critical"
          value={metrics.critical.toLocaleString()}
          icon={AlertTriangle}
          variant="destructive"
        />
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 font-medium transition-colors ${
            filter === 'all'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          All ({notifications.length})
        </button>
        <button
          onClick={() => setFilter('unread')}
          className={`px-4 py-2 font-medium transition-colors ${
            filter === 'unread'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Unread ({notifications.filter(n => !n.read).length})
        </button>
        <button
          onClick={() => setFilter('read')}
          className={`px-4 py-2 font-medium transition-colors ${
            filter === 'read'
              ? 'border-b-2 border-primary text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Read ({notifications.filter(n => n.read).length})
        </button>
      </div>

      {/* Notifications List */}
      <Card>
        <CardContent className="pt-6">
          <div className="space-y-3">
            {filteredNotifications.map((notification) => {
              const Icon = getIcon(notification.type);
              return (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`flex items-start gap-4 p-4 rounded-lg border transition-all cursor-pointer hover:border-primary/50 hover:shadow-md ${
                    notification.read
                      ? 'bg-muted/30 border-border opacity-75'
                      : 'bg-background border-primary/30 shadow-sm'
                  }`}
                >
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    notification.type === 'warning' ? 'bg-warning/10' :
                    notification.type === 'success' ? 'bg-success/10' :
                    notification.type === 'error' ? 'bg-destructive/10' :
                    'bg-primary/10'
                  }`}>
                    <Icon className={`h-5 w-5 ${
                      notification.type === 'warning' ? 'text-warning' :
                      notification.type === 'success' ? 'text-success' :
                      notification.type === 'error' ? 'text-destructive' :
                      'text-primary'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold">{notification.title}</h3>
                      {!notification.read && (
                        <Badge variant="primary" className="text-xs">New</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{notification.message}</p>
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/40 text-xs">
                      <span className="text-muted-foreground">
                        {formatRelativeTime(notification.timestamp)}
                      </span>
                      <span className="font-bold text-primary hover:underline flex items-center gap-1">
                        {notification.taskId || notification.targetUrl?.includes('/field-reviews')
                          ? 'Review Store Proof & Accept →'
                          : 'View Page Details →'}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
            {filteredNotifications.length === 0 && (
              <div className="text-center py-12">
                <Bell className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">No notifications found</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Notifications;
