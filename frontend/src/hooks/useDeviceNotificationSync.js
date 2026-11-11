import { useEffect, useCallback } from 'react';
import { deviceNotificationService } from '@/services/deviceNotificationService';
import { dashboardAPI } from '@/services/api/dashboardAPI';

/**
 * Hook to automatically synchronize incoming SETU notifications with hardware device push notifications.
 * Periodically checks for new unread system alerts & listens to global alert dispatch events.
 */
export const useDeviceNotificationSync = () => {
  const syncNotifications = useCallback(async () => {
    try {
      // 1. Fetch backend API alerts
      let apiAlerts = [];
      try {
        const response = await dashboardAPI.getAlerts();
        const rawAlerts = response.data?.data?.alerts || response.data?.alerts || (Array.isArray(response.data) ? response.data : []);
        apiAlerts = Array.isArray(rawAlerts) ? rawAlerts : [];
      } catch (err) {
        // Backend API silent fallback
      }

      // Format backend alerts
      const formattedApiAlerts = apiAlerts.map((alert, index) => ({
        id: alert.id || `api_alert_${index + 1}`,
        title: alert.title || alert.message || 'System Alert',
        message: alert.message || alert.description || '',
        severity: alert.severity || 'medium',
        type: alert.severity === 'critical' ? 'error' : alert.severity === 'high' ? 'warning' : 'info',
        read: alert.read || false,
        timestamp: alert.timestamp || new Date().toISOString(),
      }));

      // 2. Fetch custom local notifications (OCR scans, bright connection events, manual alerts)
      const customAlerts = JSON.parse(localStorage.getItem('setu_custom_notifications') || '[]');

      // 3. Combine and push any unpushed unread notifications directly to device screen
      const allAlerts = [...customAlerts, ...formattedApiAlerts];
      deviceNotificationService.syncAndPushNewNotifications(allAlerts);
    } catch (error) {
      console.warn('Error syncing device push notifications:', error);
    }
  }, []);

  useEffect(() => {
    // Initial sync on component mount
    syncNotifications();

    // Listen for custom alerts updated event
    const handleUpdate = () => {
      syncNotifications();
    };
    window.addEventListener('setu_alerts_updated', handleUpdate);

    // Auto-poll every 25 seconds for new background notifications
    const interval = setInterval(() => {
      syncNotifications();
    }, 25000);

    return () => {
      window.removeEventListener('setu_alerts_updated', handleUpdate);
      clearInterval(interval);
    };
  }, [syncNotifications]);

  return { syncNotifications };
};

export default useDeviceNotificationSync;
