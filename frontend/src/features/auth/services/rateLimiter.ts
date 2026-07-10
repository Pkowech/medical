interface RateLimitRule {
  windowMs: number;
  maxRequests: number;
}

interface RateLimitEntry {
  requests: number;
  windowStart: number;
}

class FrontendRateLimiter {
  private store: Record<string, RateLimitEntry> = {};

  private rules: Record<string, RateLimitRule> = {
    default: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      maxRequests: 100,
    },
    '/auth/login': {
      windowMs: 15 * 60 * 1000,
      maxRequests: 5,
    },
    '/auth/register': {
      windowMs: 60 * 60 * 1000, // 1 hour
      maxRequests: 3,
    },
  };

  private cleanup(): void {
    const now = Date.now();
    Object.entries(this.store).forEach(([key, entry]) => {
      const path = key;
      const rule = this.rules[path] || this.rules.default;
      if (now - entry.windowStart > rule.windowMs) {
        delete this.store[key];
      }
    });
  }

  async checkLimit(endpoint: string): Promise<boolean> {
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const rule = this.rules[path] || this.rules.default;
    const now = Date.now();

    this.cleanup();

    let entry = this.store[path];
    if (!entry || now - entry.windowStart > rule.windowMs) {
      entry = { requests: 0, windowStart: now };
    }

    if (entry.requests >= rule.maxRequests) {
      // do not increment when limited
      this.store[path] = entry;
      return false;
    }

    entry.requests++;
    this.store[path] = entry;
    return true;
  }

  getResetTime(endpoint: string): number {
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const rule = this.rules[path] || this.rules.default;
    const entry = this.store[path];
    if (!entry) return Date.now() + rule.windowMs;
    return entry.windowStart + rule.windowMs;
  }

  getRemainingRequests(endpoint: string): number {
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const rule = this.rules[path] || this.rules.default;
    const entry = this.store[path];
    if (!entry) return rule.maxRequests;
    return Math.max(0, rule.maxRequests - entry.requests);
  }
}

export const rateLimiter = new FrontendRateLimiter();

export default rateLimiter;
