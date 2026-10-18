'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  ReactNode,
} from 'react';

export interface PageHeader {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  presentation?: 'header' | 'metadata';
}

interface HeaderContextType {
  header: PageHeader | null;
  setHeader: (header: PageHeader | null) => void;
  isImmersive: boolean;
  setImmersive: (owner: string, enabled: boolean) => void;
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export const HeaderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [header, setHeader] = useState<PageHeader | null>(null);
  const [immersiveOwners, setImmersiveOwners] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const setImmersive = useCallback((owner: string, enabled: boolean) => {
    setImmersiveOwners(current => {
      if (current.has(owner) === enabled) return current;
      const next = new Set(current);
      if (enabled) next.add(owner);
      else next.delete(owner);
      return next;
    });
  }, []);
  const contextValue = useMemo(
    () => ({
      header,
      setHeader,
      isImmersive: immersiveOwners.size > 0,
      setImmersive,
    }),
    [header, immersiveOwners, setImmersive],
  );

  return <HeaderContext.Provider value={contextValue}>{children}</HeaderContext.Provider>;
};

export const usePageHeader = () => {
  const context = useContext(HeaderContext);
  if (!context) {
    throw new Error('usePageHeader must be used within HeaderProvider');
  }
  return context;
};
