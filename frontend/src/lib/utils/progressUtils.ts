export function getNumberField<T>(obj: T | null | undefined, key: string): number | undefined {
  if (!obj) return undefined;
  const val = (obj as unknown as Record<string, unknown>)[key];
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = Number(val);
    return Number.isNaN(n) ? undefined : n;
  }
  return undefined;
}

export function getStringField<T>(obj: T | null | undefined, key: string): string | undefined {
  if (!obj) return undefined;
  const val = (obj as unknown as Record<string, unknown>)[key];
  return typeof val === 'string' ? val : undefined;
}

export function normalizeSyncStatus(val: unknown): 'error' | 'pending' | 'synced' | undefined {
  if (typeof val !== 'string') return undefined;
  const s = val.toLowerCase();
  if (s === 'error' || s === 'pending' || s === 'synced') return s as 'error' | 'pending' | 'synced';
  return undefined;
}

export function downloadJson(obj: unknown, filename = 'data.json') {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
