import React from 'react';
import { useRateLimit } from '@/shared/hooks/useRateLimit';

interface RateLimitInfoProps {
  endpoint: string;
  className?: string;
}

export const RateLimitInfo: React.FC<RateLimitInfoProps> = ({ endpoint, className = '' }) => {
  const { isLimited, remainingRequests, getRemainingTime } = useRateLimit();
  const remainingTime = getRemainingTime(endpoint);

  if (remainingRequests === Infinity) {
    return null;
  }

  return (
    <div className={`text-sm text-gray-500 ${className}`}>
      {isLimited ? (
        <div className="text-red-500">
          Rate limit exceeded. Please try again in {remainingTime} seconds.
        </div>
      ) : (
        <div className="text-green-500">{remainingRequests} requests remaining</div>
      )}
    </div>
  );
};
