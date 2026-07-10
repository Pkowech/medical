// src/contexts/ProgressContext.tsx
'use client';

import { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { apiService } from '@/features/auth/services/apiClient';

interface Progress {
  unitId: number;
  status: string;
  completionPercentage: number;
}

interface ProgressContextType {
  userProgress: Progress[];
  loading: boolean;
  error: string | null;
  updateProgress: (unitId: number, status: string, percentage: number) => Promise<void>;
  refreshProgress: () => Promise<void>;
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

export const ProgressProvider = ({ children }: { children: ReactNode }) => {
  const [userProgress, setUserProgress] = useState<Progress[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const refreshProgress = async () => {
    try {
      setLoading(true);
      const response = await apiService.get<Progress[]>('/progress');
      setUserProgress(response.data);
      setError(null);
    } catch (err) {
      setError('Failed to load progress data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const updateProgress = async (unitId: number, status: string, percentage: number) => {
    try {
      await apiService.post('/progress', { unitId, status, completionPercentage: percentage });
      await refreshProgress();
    } catch (err) {
      setError('Failed to update progress');
      console.error(err);
    }
  };

  useEffect(() => {
    refreshProgress();
  }, []);

  return (
    <ProgressContext.Provider
      value={{ userProgress, loading, error, updateProgress, refreshProgress }}
    >
      {children}
    </ProgressContext.Provider>
  );
};

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (context === undefined) {
    throw new Error('useProgress must be used within a ProgressProvider');
  }
  return context;
};
