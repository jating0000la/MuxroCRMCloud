import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User } from '../types';
import { authService } from '../services/auth';

interface AuthContextType {
  user: User | null;
  login: (username: string, password: string, remember?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ✅ FIXED: Remove token storage (now using httpOnly cookies)
const clearStoredAuth = () => {
  localStorage.removeItem('user');
  sessionStorage.removeItem('user');
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    try {
      const savedUser = localStorage.getItem('user') || sessionStorage.getItem('user');
      if (savedUser) {
        setUser(JSON.parse(savedUser));
      }
    } catch {
      clearStoredAuth();
    }
    setIsLoading(false);
  }, []);

  const login = async (username: string, password: string, remember = false) => {
    const response = await authService.login(username, password);
    // ✅ FIXED: Only store user info, token is in httpOnly cookie
    const storage = remember ? localStorage : sessionStorage;
    clearStoredAuth();
    storage.setItem('user', JSON.stringify(response.user));
    setUser(response.user);
  };

  const logout = async () => {
    try {
      await authService.logout(); // Revoke token on backend + clear httpOnly cookie
    } catch {
      // Best-effort: clear local state regardless of network errors
    }
    clearStoredAuth();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
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
