interface RateLimitRule {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitStore {
  [key: string]: {
    requests: number;
    windowStart: number;
  };
}

export class RateLimiter {
  private store: RateLimitStore = {};

  private rules: { [key: string]: RateLimitRule } = {
    default: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
    },
    '/auth/login': {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 5,
    },
    '/auth/register': {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3,
    },
  };

  async checkRateLimit(clientIp: string, path: string): Promise<void> {
    const rule = this.rules[path] || this.rules.default;
    const key = `${clientIp}:${path}`;
    const now = Date.now();

    // Clean up expired entries
    this.cleanup();

    // Get or create rate limit entry
    let entry = this.store[key];
    if (!entry || now - entry.windowStart > rule.windowMs) {
      entry = {
        requests: 0,
        windowStart: now,
      };
    }

    // Check if limit exceeded
    if (entry.requests >= rule.maxRequests) {
      throw new Error('Rate limit exceeded');
    }

    // Increment request count
    entry.requests++;
    this.store[key] = entry;
  }

  private cleanup(): void {
    const now = Date.now();
    Object.entries(this.store).forEach(([key, entry]) => {
      const path = key.split(':')[1];
      const rule = this.rules[path] || this.rules.default;
      if (now - entry.windowStart > rule.windowMs) {
        delete this.store[key];
      }
    });
  }
}
