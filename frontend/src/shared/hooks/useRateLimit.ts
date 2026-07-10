import { useState, useCallback } from 'react';
import { rateLimiter } from '@/features/auth/services/rateLimiter';

interface UseRateLimitResult {
  isLimited: boolean;
  remainingRequests: number;
  resetTime: number;
  checkLimit: (endpoint: string) => Promise<boolean>;
  getRemainingTime: (endpoint: string) => number;
}

export const useRateLimit = (): UseRateLimitResult => {
  const [isLimited, setIsLimited] = useState(false);
  const [remainingRequests, setRemainingRequests] = useState(Infinity);
  const [resetTime, setResetTime] = useState(Date.now());

  const checkLimit = useCallback(async (endpoint: string): Promise<boolean> => {
    const isAllowed = await rateLimiter.checkLimit(endpoint);
    setIsLimited(!isAllowed);
    setRemainingRequests(rateLimiter.getRemainingRequests(endpoint));
    setResetTime(rateLimiter.getResetTime(endpoint));
    return isAllowed;
  }, []);

  const getRemainingTime = useCallback((endpoint: string): number => {
    const reset = rateLimiter.getResetTime(endpoint);
    return Math.max(0, Math.ceil((reset - Date.now()) / 1000));
  }, []);

  return {
    isLimited,
    remainingRequests,
    resetTime,
    checkLimit,
    getRemainingTime,
  };
};
