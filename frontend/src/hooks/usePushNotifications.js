import { useEffect, useCallback, useRef } from 'react';

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const registrationRef = useRef(null);

  const registerServiceWorker = useCallback(async () => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push notifications not supported in this browser environment');
      return null;
    }
    try {
      const reg = await navigator.serviceWorker.register('/sw.js');
      registrationRef.current = reg;
      return reg;
    } catch (err) {
      console.warn('Service worker registration note:', err.message);
      return null;
    }
  }, []);

  const subscribeToPush = useCallback(async () => {
    if (!VAPID_PUBLIC_KEY) {
      return;
    }

    try {
      const reg = registrationRef.current || await navigator.serviceWorker.ready;
      if (!reg) return;

      const existingSub = await reg.pushManager.getSubscription();
      if (existingSub) {
        return;
      }

      await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      });
    } catch (err) {
      console.warn('Push subscription note:', err.message);
    }
  }, []);

  useEffect(() => {
    registerServiceWorker().then(() => {
      subscribeToPush();
    });
  }, [registerServiceWorker, subscribeToPush]);
}

export default usePushNotifications;
