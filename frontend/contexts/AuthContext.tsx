'use client';

import { usePathname, useRouter } from 'next/navigation';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import api from '../lib/api';
import { User } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<User>;
  logout: () => void;
  markPasswordUpdated: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem('ged_token');
    const storedUser = localStorage.getItem('ged_user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (isLoading || !user) return;

    const mustChangePassword = Boolean(user.mustChangePassword || user.must_change_password);
    const allowedPaths = ['/parametres', '/login', '/acces-refuse', '/mot-de-passe-oublie', '/reinitialiser-mot-de-passe'];
    const isAllowedPath = allowedPaths.some((p) => pathname === p || pathname.startsWith(`${p}/`));

    if (mustChangePassword && !isAllowedPath) {
      router.replace('/parametres?forcePasswordChange=1');
    }
  }, [isLoading, pathname, router, user]);

  const login = async (email: string, password: string): Promise<User> => {
    const response = await api.post('/auth/login', { email, password });
    const { token: newToken, user: newUser } = response.data;
    localStorage.setItem('ged_token', newToken);
    localStorage.setItem('ged_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    return newUser as User;
  };

  const markPasswordUpdated = () => {
    setUser((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        must_change_password: false,
        mustChangePassword: false,
      };
      localStorage.setItem('ged_user', JSON.stringify(updated));
      return updated;
    });
  };

  const logout = () => {
    localStorage.removeItem('ged_token');
    localStorage.removeItem('ged_user');
    setToken(null);
    setUser(null);
    window.location.href = '/login';
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, markPasswordUpdated, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
};
