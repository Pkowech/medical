export type OfflineRevisionPart = {
  id: string;
  updatedAt?: string | number | Date | null;
};

function stamp(value: OfflineRevisionPart['updatedAt']): string {
  if (value instanceof Date) return String(value.getTime());
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (typeof value === 'string' && value.trim()) {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? String(parsed) : value.trim();
  }
  return '';
}

function encodeParts(parts: OfflineRevisionPart[]): string {
  return parts
    .map(part => `${part.id}:${stamp(part.updatedAt)}`)
    .sort()
    .join(',');
}

/** Stable fingerprint of a topic’s downloadable PDFs and practice questions. */
export function computeOfflineContentRevision(
  topicId: string,
  materials: OfflineRevisionPart[],
  questions: OfflineRevisionPart[],
): string {
  return `t:${topicId}|m:${encodeParts(materials)}|q:${encodeParts(questions)}`;
}

export function isOfflineContentStale(
  storedRevision: string | undefined,
  serverRevision: string,
): boolean {
  return !storedRevision || storedRevision !== serverRevision;
}
