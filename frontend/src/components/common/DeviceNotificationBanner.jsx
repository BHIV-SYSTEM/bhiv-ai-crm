import React, { useState, useEffect } from 'react';
import { Bell, X, CheckCircle, Smartphone } from 'lucide-react';
import Button from './ui/Button';
import { deviceNotificationService } from '@/services/deviceNotificationService';

export const DeviceNotificationBanner = () => {
  const [permission, setPermission] = useState('granted');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  if (!deviceNotificationService.isSupported || permission === 'granted' || permission === 'denied' || dismissed) {
    return null;
  }

  const handleEnable = async () => {
    const granted = await deviceNotificationService.requestPermission();
    if (granted) {
      setPermission('granted');
    } else {
      setPermission(Notification.permission);
    }
  };

  return (
    <div className="bg-gradient-to-r from-primary/10 via-accent/10 to-primary/5 border-b border-primary/20 px-4 py-3 sm:px-6 transition-all duration-300 animate-fade-in">
      <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[280px]">
          <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center text-primary flex-shrink-0">
            <Bell className="h-5 w-5 animate-bounce" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span>Enable Device Push Notifications</span>
              <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                Recommended
              </span>
            </p>
            <p className="text-xs text-muted-foreground">
              Get instant desktop & hardware screen alerts for every SETU order, OCR scan, and inventory notification.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3 ml-auto">
          <Button
            size="sm"
            onClick={handleEnable}
            className="shadow-glow-primary flex items-center gap-1.5 text-xs font-bold"
          >
            <Smartphone className="h-3.5 w-3.5" />
            Enable Device Notifications
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setDismissed(true)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            aria-label="Dismiss banner"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DeviceNotificationBanner;
