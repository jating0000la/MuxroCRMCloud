import React, { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { notificationService, type Notification } from '../services/notifications';

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

// Max known IDs to keep in memory to prevent unbounded growth
const MAX_KNOWN_IDS = 500;

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
function playAlertSound(type: 'upcoming' | 'other' = 'other') {
  const ctx = getAudioContext();
  if (!ctx) return;
  try {
    const frequencies = type === 'upcoming' ? [880, 660, 880, 1100] : [550];
    const durations = type === 'upcoming' ? [0.2, 0.2, 0.2, 0.3] : [0.3, 0.3];
    let time = ctx.currentTime;
    frequencies.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, time);
      gain.gain.setValueAtTime(type === 'upcoming' ? 0.5 : 0.4, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + durations[i]);
      osc.start(time);
      osc.stop(time + durations[i]);
      time += durations[i] + 0.05;
    });
  } catch {
    // Audio not supported — fail silently
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
  const knownIdsRef = useRef<Set<string>>(new Set());
  const soundEnabledRef = useRef(soundEnabled);

  // Keep ref in sync with state
  useEffect(() => {
    soundEnabledRef.current = soundEnabled;
  }, [soundEnabled]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      localStorage.setItem('notificationSound', next ? 'on' : 'off');
      return next;
    });
  }, []);

  const handleNewNotifications = useCallback((newNotifs: Notification[]) => {
    const newOnes = newNotifs.filter((n) => !knownIdsRef.current.has(n.id));

    if (newOnes.length > 0) {
      // Add new IDs to known set, prune if too large
      newOnes.forEach((n) => knownIdsRef.current.add(n.id));
      if (knownIdsRef.current.size > MAX_KNOWN_IDS) {
        const idsArray = Array.from(knownIdsRef.current);
        knownIdsRef.current = new Set(idsArray.slice(idsArray.length - MAX_KNOWN_IDS));
      }

      const upcomingCount = newOnes.filter((n) => n.type === 'upcoming').length;

      if (soundEnabledRef.current && upcomingCount > 0) {
        playAlertSound('upcoming');
      }
    }
  }, []);

  const syncNotifications = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const { notifications: notifs, count } = await notificationService.getPendingWithCount();
      handleNewNotifications(notifs);
      setNotifications(notifs);
      setPendingCount(count);
    } catch {
      // Silently fail on network errors
    } finally {
      setIsLoading(false);
    }
  }, [user, handleNewNotifications]);

  const syncWithDelay = useCallback(async (delayMs: number = 1000) => {
    return new Promise<void>((resolve) => {
      const timer = setTimeout(async () => {
        await syncNotifications();
        resolve();
      }, delayMs);
      // Return cleanup function concept — caller can't cancel, but at least
      // the timer is managed. For a proper solution, use AbortController.
      return () => clearTimeout(timer);
    });
  }, [syncNotifications]);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setPendingCount((prev) => Math.max(0, prev - 1));
    } catch {
      // Silently fail
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setPendingCount(0);
    } catch {
      // Silently fail
    }
  }, []);

  // Initialize notifications when user logs in
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      setPendingCount(0);
      setHasInitialized(false);
      knownIdsRef.current.clear();
      return;
    }

    if (hasInitialized) return;
    let cancelled = false;

    const initializeSync = async () => {
      try {
        await notificationService.syncNotifications();
        const [notifs, count] = await Promise.all([
          notificationService.getPendingNotifications(),
          notificationService.getPendingCount(),
        ]);
        if (cancelled) return;
        notifs.forEach((n) => knownIdsRef.current.add(n.id));
        setNotifications(notifs);
        setPendingCount(count);
        setHasInitialized(true);
      } catch {
        if (!cancelled) setHasInitialized(true);
      }
    };

    initializeSync();
    return () => { cancelled = true; };
  }, [user, hasInitialized]);

  // Poll every 30 seconds while logged in
  useEffect(() => {
    if (!user || !hasInitialized) return;

    const interval = setInterval(syncNotifications, 30 * 1000);
    return () => clearInterval(interval);
  }, [user, hasInitialized, syncNotifications]);

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
