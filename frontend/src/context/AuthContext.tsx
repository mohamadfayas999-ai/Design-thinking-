import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: {
    email: string;
    password: string;
    role: Role;
    hostelId?: string;
  }) => Promise<User>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('washwise_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const logout = () => {
    localStorage.removeItem('washwise_token');
    localStorage.removeItem('washwise_user');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    const savedToken = localStorage.getItem('washwise_token');
    if (!savedToken) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    try {
      const res = await api.getMe();
      if (res.user) {
        setUser(res.user);
        localStorage.setItem('washwise_user', JSON.stringify(res.user));
      } else {
        logout();
      }
    } catch (err) {
      console.warn('Session expired or invalid, logging out.');
      logout();
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (credentials: {
    email: string;
    password: string;
    role: Role;
    hostelId?: string;
  }): Promise<User> => {
    const res = await api.login(credentials);
    if (res.success && res.token && res.user) {
      localStorage.setItem('washwise_token', res.token);
      localStorage.setItem('washwise_user', JSON.stringify(res.user));
      setToken(res.token);
      setUser(res.user);
      return res.user;
    }
    throw new Error(res.message || 'Login failed');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
