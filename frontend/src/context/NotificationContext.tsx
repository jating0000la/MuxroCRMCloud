import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { notificationService, type Notification } from '../services/notifications';
import toast from 'react-hot-toast';

interface NotificationContextType {
  notifications: Notification[];
  pendingCount: number;
  isLoading: boolean;
  soundEnabled: boolean;
  toggleSound: () => void;
  syncNotifications: () => Promise<void>;
  syncWithDelay: (delayMs?: number) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(
  undefined,
);

/** Singleton AudioContext — reused across all plays, resumed on user interaction */
let audioCtx: AudioContext | null = null;
let audioListenersAttached = false;

function getAudioContext(): AudioContext | null {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended' && !audioListenersAttached) {
      audioListenersAttached = true;
      const resume = () => {
        audioCtx?.resume();
        document.removeEventListener('click', resume);
        document.removeEventListener('keydown', resume);
        audioListenersAttached = false;
      };
      document.addEventListener('click', resume, { once: true });
      document.addEventListener('keydown', resume, { once: true });
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/** Play an alert beep using Web Audio API — no external file needed */
function playAlertSound(type: 'overdue' | 'today' | 'other' = 'other') {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const frequencies = type === 'overdue' ? [880, 660, 880, 1100] : type === 'today' ? [660, 880] : [550];
    const durations = type === 'overdue' ? [0.2, 0.2, 0.2, 0.3] : [0.3, 0.3];
    let time = ctx.currentTime;
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(type === 'overdue' ? 0.5 : 0.4, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + durations[i]);
      osc.start(time);
      osc.stop(time + durations[i]);
      time += durations[i] + 0.05;
    });
  } catch {
    // Audio not supported — fail silently
  }
}

/** Show a native browser notification */
function showBrowserNotification(title: string, body: string, icon = '/favicon.ico') {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    const n = new Notification(title, { body, icon, badge: icon });
    // Auto-close after 6 seconds
    setTimeout(() => n.close(), 6000);
  }
}

/** Request browser notification permission */
async function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    await Notification.requestPermission();
  }
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [pendingCount, setPendingCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('notificationSound') !== 'off';
  });
  // Keep track of known notification IDs to detect truly new ones
  const knownIdsRef = useRef<Set<string>>(new Set());

  const toggleSound = () => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('notificationSound', next ? 'on' : 'off');
      return next;
    });
  };

  const handleNewNotifications = (newNotifs: Notification[]) => {
    const newOnes = newNotifs.filter((n) => !knownIdsRef.current.has(n.id));

    if (newOnes.length > 0) {
      // Add new IDs to known set
      newOnes.forEach((n) => knownIdsRef.current.add(n.id));

      const overdueCount = newOnes.filter((n) => n.type === 'overdue').length;
      const todayCount = newOnes.filter((n) => n.type === 'today').length;

      // Play sound for overdue or today notifications
      if (soundEnabled && (overdueCount > 0 || todayCount > 0)) {
        playAlertSound(overdueCount > 0 ? 'overdue' : 'today');
      }

      // Show browser notification
      if (overdueCount > 0) {
        showBrowserNotification(
          `⚠️ ${overdueCount} Overdue Followup${overdueCount > 1 ? 's' : ''}!`,
          newOnes.filter((n) => n.type === 'overdue')
            .slice(0, 3)
            .map((n) => n.followup?.lead?.name || 'Lead')
            .join(', ')
        );
        const names = newOnes.filter((n) => n.type === 'overdue')
          .slice(0, 3)
          .map((n) => n.followup?.lead?.name || 'Lead')
          .join(', ');
        toast.error(
          `${overdueCount} Overdue Followup${overdueCount > 1 ? 's' : ''}!${names ? ' — ' + names : ''}`,
          { duration: 8000, icon: '🔴' }
        );
      } else if (todayCount > 0) {
        showBrowserNotification(
          `⏰ ${todayCount} Followup${todayCount > 1 ? 's' : ''} Due Today`,
          newOnes.filter((n) => n.type === 'today')
            .slice(0, 3)
            .map((n) => n.followup?.lead?.name || 'Lead')
            .join(', ')
        );
        const names = newOnes.filter((n) => n.type === 'today')
          .slice(0, 3)
          .map((n) => n.followup?.lead?.name || 'Lead')
          .join(', ');
        toast(
          `${todayCount} Followup${todayCount > 1 ? 's' : ''} Due Today${names ? ' — ' + names : ''}`,
          { duration: 6000, icon: '⏰' }
        );
      }
    }
  };

  const syncNotifications = async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const [notifs, count] = await Promise.all([
        notificationService.getPendingNotifications(),
        notificationService.getPendingCount(),
      ]);
      handleNewNotifications(notifs);
      setNotifications(notifs);
      setPendingCount(count);
    } catch (error) {
      // Silently fail on network errors
    } finally {
      setIsLoading(false);
    }
  };

  const syncWithDelay = async (delayMs: number = 1000) => {
    return new Promise<void>((resolve) => {
      setTimeout(async () => {
        await syncNotifications();
        resolve();
      }, delayMs);
    });
  };

  const markAsRead = async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setPendingCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setPendingCount(0);
    } catch (error) {
      console.error('Failed to mark all notifications as read:', error);
    }
  };

  // Initialize notifications when user logs in
  useEffect(() => {
    if (!user) {
      // Reset state on logout
      setNotifications([]);
      setPendingCount(0);
      setHasInitialized(false);
      knownIdsRef.current.clear();
      return;
    }

    if (hasInitialized) return;

    const initializeSync = async () => {
      try {
        // Request browser notification permission on first init
        await requestNotificationPermission();
        // Sync backend notifications first
        await notificationService.syncNotifications();
        // Fetch pending — seed knownIds so we don't alert for existing ones on first load
        const [notifs, count] = await Promise.all([
          notificationService.getPendingNotifications(),
          notificationService.getPendingCount(),
        ]);
        // Seed known IDs so existing notifications don't trigger sound on page load
        notifs.forEach((n) => knownIdsRef.current.add(n.id));
        setNotifications(notifs);
        setPendingCount(count);
        setHasInitialized(true);
      } catch (error) {
        console.error('Failed to initialize notifications:', error);
      }
    };

    initializeSync();
  }, [user]);

  // Poll every 10 seconds while logged in
  useEffect(() => {
    if (!user || !hasInitialized) return;

    const interval = setInterval(syncNotifications, 10 * 1000);
    return () => clearInterval(interval);
  }, [user, hasInitialized, soundEnabled]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        pendingCount,
        isLoading,
        soundEnabled,
        toggleSound,
        syncNotifications,
        syncWithDelay,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within NotificationProvider');
  }
  return context;
}
