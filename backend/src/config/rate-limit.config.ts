import { ThrottlerModuleOptions } from '@nestjs/throttler';

export const rateLimitConfig: ThrottlerModuleOptions = {
  throttlers: [
    {
      name: 'default',
      ttl: 60, // Time window in seconds
      limit: 10, // Default limit per time window
    },
    {
      name: 'auth',
      ttl: 300, // 5 minutes
      limit: 5, // 5 attempts per 5 minutes
    },
    {
      name: 'api',
      ttl: 60, // 1 minute
      limit: 60, // 60 requests per minute
    },
    {
      name: 'sensitive',
      ttl: 3600, // 1 hour
      limit: 10, // 10 attempts per hour
    },
  ],
};

export const getRateLimitKey = (req: any): string => {
  // Use IP address as the default key
  const key = req.ip;

  // Add user ID to the key if available
  if (req.user?.id) {
    return `${key}-${req.user.id}`;
  }

  return key;
};
