export function normalizeProgressArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[];
  }

  if (value !== null && value !== undefined && typeof value === 'object') {
    return Object.values(value as Record<string, T>);
  }

  return [];
}

export function mapProgressByKey<T>(
  value: unknown,
  key: 'moduleId' | 'phaseId' | 'id',
): Record<string, T> {
  return normalizeProgressArray<T>(value).reduce(
    (acc, entry) => {
      const source = entry as Record<string, unknown> | undefined;
      const keyValue = source?.[key];

      if (keyValue !== undefined && keyValue !== null && keyValue !== '') {
        acc[String(keyValue)] = entry;
      }

      return acc;
    },
    {} as Record<string, T>,
  );
}
