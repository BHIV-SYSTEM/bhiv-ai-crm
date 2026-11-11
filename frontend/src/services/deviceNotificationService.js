import React from 'react';
import toast from 'react-hot-toast';

// Branded high-resolution SETU AI icon for native device notifications
const SETU_DEFAULT_ICON = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="%230f172a"/><rect x="4" y="4" width="120" height="120" rx="24" fill="none" stroke="%2310b981" stroke-width="4"/><path d="M38 78 L58 48 L70 66 L90 38" fill="none" stroke="%2310b981" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/><circle cx="90" cy="38" r="8" fill="%2334d399"/></svg>`;

class DeviceNotificationService {
  constructor() {
    this.isSupported = typeof window !== 'undefined' && 'Notification' in window;
  }

  /**
   * Get current browser notification permission status
   */
  getPermissionState() {
    if (!this.isSupported) return 'unsupported';
    return Notification.permission;
  }

  /**
   * Request permission for device push notifications
   */
  async requestPermission() {
    if (!this.isSupported) {
      toast.error('Device push notifications are not supported in this browser.');
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        toast.success('Device push notifications enabled successfully!');
        this.sendNotification('SETU Notifications Active', {
          body: 'You will now receive device push notifications for critical store & inventory alerts.',
          icon: '/favicon.ico',
        });
        return true;
      } else {
        toast.error('Notification permission was denied.');
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      toast.error('Failed to enable device notifications.');
      return false;
    }
  }

  /**
   * Dispatch a device notification to the hardware/browser
   */
  sendNotification(title, options = {}) {
    const targetUrl = options.url || options.targetUrl || '/notifications';
    const severity = options.severity || options.type || 'info';
    
    // Standardize notification payload for OS/Browser hardware push
    const notificationOptions = {
      icon: options.icon || SETU_DEFAULT_ICON,
      badge: options.badge || SETU_DEFAULT_ICON,
      body: options.body || '',
      tag: options.tag || 'setu-alert-' + Date.now(),
      renotify: options.renotify !== undefined ? options.renotify : true,
      timestamp: Date.now(),
      ...options,
    };

    // 1. Try native browser notification if granted
    if (this.isSupported && Notification.permission === 'granted') {
      try {
        const notification = new Notification(title, notificationOptions);
        notification.onclick = (event) => {
          event.preventDefault();
          window.focus();
          if (targetUrl && typeof window !== 'undefined') {
            window.location.href = targetUrl;
          }
          notification.close();
        };
        return notification;
      } catch (err) {
        console.warn('Native notification failed, falling back to rich toast card', err);
      }
    }

    // 2. Fallback / supplementary in-app rich glassmorphic toast notification
    const getThemeStyles = () => {
      if (severity === 'critical' || severity === 'error') {
        return {
          border: 'border-rose-500/40 hover:border-rose-400',
          glow: 'shadow-[0_10px_35px_rgba(244,63,94,0.25)]',
          badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          iconBg: 'bg-rose-500/20 text-rose-400 border-rose-500/40',
          badgeText: 'CRITICAL ALERT',
          accentText: 'text-rose-400',
        };
      }
      if (severity === 'warning' || severity === 'high') {
        return {
          border: 'border-amber-500/40 hover:border-amber-400',
          glow: 'shadow-[0_10px_35px_rgba(245,158,11,0.25)]',
          badgeBg: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          iconBg: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
          badgeText: 'ATTENTION',
          accentText: 'text-amber-400',
        };
      }
      if (severity === 'success') {
        return {
          border: 'border-emerald-500/40 hover:border-emerald-400',
          glow: 'shadow-[0_10px_35px_rgba(16,185,129,0.25)]',
          badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          iconBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
          badgeText: 'SETU VERIFIED',
          accentText: 'text-emerald-400',
        };
      }
      return {
        border: 'border-blue-500/40 hover:border-blue-400',
        glow: 'shadow-[0_10px_35px_rgba(59,130,246,0.25)]',
        badgeBg: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
        iconBg: 'bg-blue-500/20 text-blue-400 border-blue-500/40',
        badgeText: 'SYSTEM NOTICE',
        accentText: 'text-blue-400',
      };
    };

    const theme = getThemeStyles();

    toast.custom((t) => React.createElement(
      'div',
      {
        className: `${
          t.visible ? 'animate-enter' : 'animate-leave'
        } max-w-md w-full bg-slate-900/95 backdrop-blur-xl border ${theme.border} ${theme.glow} rounded-2xl pointer-events-auto flex flex-col p-4 cursor-pointer transition-all text-left z-50 overflow-hidden relative group shadow-2xl`,
        onClick: () => {
          toast.dismiss(t.id);
          if (typeof window !== 'undefined') {
            window.location.href = targetUrl;
          }
        }
      },
      React.createElement(
        'div',
        { className: 'flex items-start gap-3.5 relative z-10' },
        React.createElement(
          'div',
          { className: `w-11 h-11 rounded-xl ${theme.iconBg} flex items-center justify-center flex-shrink-0 border shadow-inner mt-0.5 font-bold text-lg` },
          '🔔'
        ),
        React.createElement(
          'div',
          { className: 'flex-1 min-w-0' },
          React.createElement(
            'div',
            { className: 'flex items-center justify-between gap-2' },
            React.createElement(
              'span',
              { className: `text-[10px] uppercase font-black tracking-widest px-2 py-0.5 rounded-full border ${theme.badgeBg}` },
              theme.badgeText
            ),
            React.createElement('span', { className: 'text-[10px] text-slate-400 font-mono' }, 'Just Now')
          ),
          React.createElement(
            'p',
            { className: 'font-extrabold text-sm text-white mt-1.5 tracking-tight' },
            title
          ),
          notificationOptions.body && React.createElement(
            'p',
            { className: 'text-xs text-slate-300 mt-1 leading-relaxed' },
            notificationOptions.body
          ),
          React.createElement(
            'div',
            { className: 'mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between' },
            React.createElement(
              'span',
              { className: `text-[11px] ${theme.accentText} font-bold hover:underline flex items-center gap-1` },
              'Click to open details →'
            ),
            React.createElement('span', { className: 'text-[10px] text-slate-500' }, 'Tap to dismiss')
          )
        )
      )
    ), { duration: 6500, position: 'top-right' });

    return null;
  }

  /**
   * Get set of notification IDs that have already been pushed to device
   */
  getPushedIds() {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem('setu_pushed_notification_ids');
      return new Set(stored ? JSON.parse(stored) : []);
    } catch (e) {
      return new Set();
    }
  }

  /**
   * Mark a notification ID as pushed to device
   */
  markPushed(id) {
    if (typeof window === 'undefined' || !id) return;
    try {
      const pushed = this.getPushedIds();
      pushed.add(String(id));
      localStorage.setItem('setu_pushed_notification_ids', JSON.stringify(Array.from(pushed)));
    } catch (e) {
      console.warn('Failed to persist pushed notification id:', e);
    }
  }

  /**
   * Dispatch a notification to the local SETU notification center AND push to device screen
   */
  dispatchAndPushNotification(notification) {
    const id = notification.id || `notif_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    const fullNotification = {
      id,
      title: notification.title || 'SETU Notification',
      message: notification.message || notification.body || '',
      type: notification.type || 'info',
      severity: notification.severity || 'medium',
      timestamp: notification.timestamp || new Date().toISOString(),
      read: false,
      targetUrl: notification.targetUrl || notification.url || '/notifications',
    };

    // 1. Save to custom notifications store in localStorage
    try {
      const existing = JSON.parse(localStorage.getItem('setu_custom_notifications') || '[]');
      const updated = [fullNotification, ...existing];
      localStorage.setItem('setu_custom_notifications', JSON.stringify(updated));

      const unreadCount = updated.filter(a => !a.read).length;
      localStorage.setItem('setu_unread_alerts', String(unreadCount));

      // 2. Dispatch global event so UI components refresh instantly
      window.dispatchEvent(new Event('setu_alerts_updated'));
    } catch (err) {
      console.warn('Failed to save custom notification:', err);
    }

    // 3. Send hardware/browser device notification
    this.sendNotification(fullNotification.title, {
      body: fullNotification.message,
      url: fullNotification.targetUrl,
      tag: id,
    });

    this.markPushed(id);
    return fullNotification;
  }

  /**
   * Sync a list of notifications (e.g. from backend API or local state) and push any unpushed unread alerts to device
   */
  syncAndPushNewNotifications(notifications = []) {
    if (!Array.isArray(notifications) || notifications.length === 0) return;
    const pushedIds = this.getPushedIds();
    const readIds = new Set(JSON.parse(localStorage.getItem('setu_read_alert_ids') || '[]'));

    // Filter unread alerts that haven't been pushed to device yet
    const newUnreadAlerts = notifications.filter(n => {
      const id = String(n.id);
      const isRead = n.read || readIds.has(id);
      return !isRead && !pushedIds.has(id);
    });

    if (newUnreadAlerts.length === 0) return;

    // Send device push for each new unread notification (up to 3 at once to avoid flooding)
    newUnreadAlerts.slice(0, 3).forEach(n => {
      const title = n.title || n.message || 'New SETU Alert';
      const body = n.message && n.title !== n.message ? n.message : (n.description || 'System notification received');
      const url = n.targetUrl || (n.severity === 'critical' ? '/notifications' : '/bright-connection');

      this.sendNotification(title, {
        body,
        url,
        tag: String(n.id),
      });

      this.markPushed(n.id);
    });
  }

  /**
   * Helper to trigger a sample test notification on user demand
   */
  sendTestNotification() {
    return this.dispatchAndPushNotification({
      title: '🔔 SETU Device Notification Test',
      message: 'Verified! Hardware device push notifications are active for all SETU alerts.',
      type: 'info',
      severity: 'medium',
      targetUrl: '/notifications',
    });
  }
}

export const deviceNotificationService = new DeviceNotificationService();
export default deviceNotificationService;

