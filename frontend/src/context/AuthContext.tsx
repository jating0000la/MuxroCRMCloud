import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { User } from '../types';
import { authService } from '../services/auth';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
  isSubmitting: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const clearStoredAuth = () => {
  localStorage.removeItem('user');
  sessionStorage.removeItem('user');
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate stored user on mount by fetching fresh profile
  useEffect(() => {
    let cancelled = false;
    const validateUser = async () => {
      try {
        const savedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
        if (savedUser) {
          const parsed = JSON.parse(savedUser);
          // Validate with server — if token is invalid/expired, this will 401
          const freshUser = await authService.getProfile();
          if (!cancelled) {
            setUser(freshUser);
            // Update stored user with fresh data
            const storage = localStorage.getItem('user') ? localStorage : sessionStorage;
            storage.setItem('user', JSON.stringify(freshUser));
          }
        }
      } catch {
        // Token invalid/expired or server unreachable — clear stale auth
        clearStoredAuth();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    validateUser();
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (username: string, password: string, remember = false) => {
    if (isSubmitting) return; // Prevent double-clicks
    setIsSubmitting(true);
    try {
      const response = await authService.login(username, password);
      const storage = remember ? localStorage : sessionStorage;
      clearStoredAuth();
      storage.setItem('user', JSON.stringify(response.user));
      setUser(response.user);
    } finally {
      setIsSubmitting(false);
    }
  }, [isSubmitting]);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } catch {
      // Best-effort: clear local state regardless of network errors
    }
    clearStoredAuth();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading, isSubmitting }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
