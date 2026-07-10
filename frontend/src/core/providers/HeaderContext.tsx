'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface PageHeader {
  title: string;
  description: string;
  icon?: React.ReactNode;
}

interface HeaderContextType {
  header: PageHeader | null;
  setHeader: (header: PageHeader | null) => void;
}

const HeaderContext = createContext<HeaderContextType | undefined>(undefined);

export const HeaderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [header, setHeader] = useState<PageHeader | null>(null);

  return <HeaderContext.Provider value={{ header, setHeader }}>{children}</HeaderContext.Provider>;
};

export const usePageHeader = () => {
  const context = useContext(HeaderContext);
  if (!context) {
    throw new Error('usePageHeader must be used within HeaderProvider');
  }
  return context;
};
