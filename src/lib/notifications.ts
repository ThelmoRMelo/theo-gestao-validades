// Push Notifications Service

export interface NotificationSettings {
  enabled: boolean;
  criticalAlerts: boolean;
  dailyDigest: boolean;
  alertDays: number;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  enabled: false,
  criticalAlerts: true,
  dailyDigest: false,
  alertDays: 7,
};

// Get notification settings from localStorage
export const getNotificationSettings = (): NotificationSettings => {
  try {
    const stored = localStorage.getItem('notification_settings');
    return stored ? { ...DEFAULT_SETTINGS, ...JSON.parse(stored) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
};

// Save notification settings
export const saveNotificationSettings = (settings: Partial<NotificationSettings>): void => {
  const current = getNotificationSettings();
  const updated = { ...current, ...settings };
  localStorage.setItem('notification_settings', JSON.stringify(updated));
};

// Request notification permission
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications');
    return false;
  }

  if (Notification.permission === 'granted') {
    return true;
  }

  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  return false;
};

// Check if notifications are supported and enabled
export const canSendNotifications = (): boolean => {
  return 'Notification' in window && Notification.permission === 'granted';
};

// Check if notifications are enabled in settings
export const areNotificationsEnabled = (): boolean => {
  return getNotificationSettings().enabled;
};

// Enable/disable notifications in settings
export const setNotificationsEnabled = (enabled: boolean): void => {
  saveNotificationSettings({ enabled });
};

// Send a local notification
export const sendNotification = (title: string, options?: NotificationOptions): void => {
  if (!canSendNotifications()) return;

  const settings = getNotificationSettings();
  if (!settings.enabled) return;

  try {
    const notificationOptions: NotificationOptions & { vibrate?: number[] } = {
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: 'validity-alert',
      ...options,
    };
    
    const notification = new Notification(title, notificationOptions);

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (err) {
    console.error('Error sending notification:', err);
  }
};

// Check critical validities and send notifications
export const checkAndNotifyCriticalValidities = async (
  criticalCount: number,
  expiredCount: number
): Promise<void> => {
  const settings = getNotificationSettings();
  if (!settings.enabled || !settings.criticalAlerts) return;
  if (!canSendNotifications()) return;

  if (expiredCount > 0) {
    sendNotification('⚠️ Produtos Vencidos!', {
      body: `Você tem ${expiredCount} lote(s) com validade expirada. Verifique imediatamente!`,
      requireInteraction: true,
    });
  } else if (criticalCount > 0) {
    sendNotification('📅 Validades Críticas', {
      body: `${criticalCount} lote(s) próximos do vencimento. Confira a lista de alertas.`,
    });
  }
};

// Schedule periodic check (runs every hour when app is open)
let checkInterval: ReturnType<typeof setInterval> | null = null;

export const startPeriodicCheck = (
  getCriticalCount: () => Promise<{ critical: number; expired: number }>
): void => {
  if (checkInterval) return;

  const check = async () => {
    const settings = getNotificationSettings();
    if (!settings.enabled) return;

    const { critical, expired } = await getCriticalCount();
    await checkAndNotifyCriticalValidities(critical, expired);
  };

  // Check immediately
  check();

  // Then check every hour
  checkInterval = setInterval(check, 60 * 60 * 1000);
};

export const stopPeriodicCheck = (): void => {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
  }
};

// Register service worker for background notifications
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js');
    console.log('Service Worker registered');
    return registration;
  } catch (err) {
    console.error('Service Worker registration failed:', err);
    return null;
  }
};
