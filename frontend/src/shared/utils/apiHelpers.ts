/**
 * Shared API and Data Normalization Helpers
 * Provides safe unwrapping and parsing for nested API payloads.
 */

export function unwrapApiPayload<T = unknown>(response: unknown): T {
  if (response && typeof response === 'object') {
    const obj = response as Record<string, unknown>;
    if ('data' in obj) {
      const nested = obj.data;
      if (nested && typeof nested === 'object' && 'data' in (nested as Record<string, unknown>)) {
        return (nested as Record<string, unknown>).data as T;
      }
      return nested as T;
    }
  }
  return response as T;
}

export function toDisplayString(val: unknown, fallback: string = ''): string {
  if (val === null || val === undefined) return fallback;
  if (typeof val === 'string') return val;
  if (typeof val === 'number' || typeof val === 'boolean') return String(val);
  return fallback;
}

export function normalizeJsonArray<T = unknown>(val: unknown): T[] {
  if (Array.isArray(val)) return val as T[];
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}
