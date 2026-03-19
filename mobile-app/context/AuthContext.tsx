import React, { createContext, useContext, useEffect, useState } from 'react';
import { authService, Dealer } from '../lib/supabase';

interface AuthContextType {
  isLoading: boolean;
  isSignedIn: boolean;
  isSuperAdmin: boolean;
  dealer: Dealer | null;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshDealer: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  isLoading: true,
  isSignedIn: false,
  isSuperAdmin: false,
  dealer: null,
  signIn: async () => {},
  signOut: async () => {},
  refreshDealer: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [dealer, setDealer] = useState<Dealer | null>(null);

  useEffect(() => {
    checkSession();
    const { data: listener } = authService.onAuthStateChange(async (session) => {
      if (session) {
        await loadUserData();
      } else {
        setIsSignedIn(false);
        setIsSuperAdmin(false);
        setDealer(null);
      }
    });
    return () => listener?.subscription?.unsubscribe();
  }, []);

  const checkSession = async () => {
    try {
      const session = await authService.getSession();
      if (session) await loadUserData();
    } catch (e) {
      console.log('No active session');
    } finally {
      setIsLoading(false);
    }
  };

  const loadUserData = async () => {
    try {
      const [superAdmin, dealerData] = await Promise.all([
        authService.isSuperAdmin(),
        authService.getCurrentDealer(),
      ]);
      setIsSignedIn(true);
      setIsSuperAdmin(superAdmin);
      setDealer(dealerData);
    } catch (e) {
      console.error('Failed to load user data:', e);
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const result = await authService.signIn(email, password);
      console.log('Sign in result:', JSON.stringify(result));
      await loadUserData();
    } catch (e: any) {
      console.error('Sign in error:', e.message);
      throw e;
    }
  };

  const signOut = async () => {
    await authService.signOut();
    setIsSignedIn(false);
    setIsSuperAdmin(false);
    setDealer(null);
  };

  const refreshDealer = async () => {
    const dealerData = await authService.getCurrentDealer();
    setDealer(dealerData);
  };

  return (
    <AuthContext.Provider value={{
      isLoading,
      isSignedIn,
      isSuperAdmin,
      dealer,
      signIn,
      signOut,
      refreshDealer,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);