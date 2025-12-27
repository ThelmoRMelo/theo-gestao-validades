import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import * as db from '@/lib/db';
import { initSyncListeners, syncAll, subscribeToRealtime, getIsOnline } from '@/lib/sync';
import type { LocalUser } from '@/lib/db';
import { applyThemeClass, getTheme, isValidTheme, saveTheme } from '@/lib/theme';

interface AppContextType {
  user: LocalUser | null;
  setUser: (user: LocalUser) => Promise<void>;
  isLoading: boolean;
  isOnline: boolean;
  isSyncing: boolean;
  activeLotsCount: number;
  criticalLotsCount: number;
  theme: string;
  setTheme: (theme: string) => void;
  refreshCounts: () => Promise<void>;
  triggerSync: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);


export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<LocalUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(getIsOnline());
  const [isSyncing, setIsSyncing] = useState(false);
  const [activeLotsCount, setActiveLotsCount] = useState(0);
  const [criticalLotsCount, setCriticalLotsCount] = useState(0);
  const [theme, setThemeState] = useState('future');

  const refreshCounts = useCallback(async () => {
    const active = await db.getActiveProductsCount();
    const critical = await db.getCriticalProductsCount();
    setActiveLotsCount(active);
    setCriticalLotsCount(critical);
  }, []);

  const setUser = async (newUser: LocalUser) => {
    await db.saveLocalUser(newUser);
    setUserState(newUser);
  };

  /**
   * Define o tema ativo
   * - Atualiza estado
   * - Aplica classe CSS
   * - Persiste no IndexedDB (fonte principal) e localStorage (backup/fallback)
   */
  const setTheme = useCallback((newTheme: string) => {
    if (!isValidTheme(newTheme)) {
      console.warn('Tema inválido:', newTheme);
      return;
    }

    // Atualizar estado
    setThemeState(newTheme);

    // Aplicar classe CSS imediatamente
    applyThemeClass(newTheme);

    // Persistir (offline-first)
    void saveTheme(newTheme);
  }, []);

  const triggerSync = async () => {
    setIsSyncing(true);
    await syncAll();
    await refreshCounts();
    setIsSyncing(false);
  };

  useEffect(() => {
    const init = async () => {
      await db.initDB();
      const localUser = await db.getLocalUser();
      if (localUser) setUserState(localUser);

      // Carregar tema (IndexedDB como fonte principal; localStorage como fallback)
      const savedTheme = await getTheme();
      setThemeState(savedTheme);
      applyThemeClass(savedTheme);

      // Primeiro, carregar contadores do cache local
      await refreshCounts();
      setIsLoading(false);

      initSyncListeners();

      // Se online, sincronizar e DEPOIS atualizar contadores
      if (getIsOnline()) {
        await syncAll();
        await refreshCounts(); // Atualizar após sync do cloud
      }
    };

    init();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = subscribeToRealtime(() => refreshCounts());

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, [refreshCounts]);

  return (
    <AppContext.Provider value={{
      user, setUser, isLoading, isOnline, isSyncing,
      activeLotsCount, criticalLotsCount,
      theme, setTheme, refreshCounts, triggerSync,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
