import { apiService } from '@/features/auth/services/apiClient';
import type { Material } from '@/shared/types/materialInterface';
import {
  computeOfflineContentRevision,
  isOfflineContentStale,
} from './contentRevision';
import { offlineService } from './offlineService';
import type { OfflineTopicBundle } from './db';

function isPdfMaterial(material: Material): boolean {
  const driveMimeType = material.metadata?.driveMimeType?.toLowerCase();
  const fileMimeType = material.file?.mimetype?.toLowerCase();
  const previewMimeType = material.previewFile?.mimetype?.toLowerCase();
  return (
    material.type?.toLowerCase() === 'pdf' ||
    material.contentType?.toLowerCase() === 'application/pdf' ||
    driveMimeType === 'application/pdf' ||
    fileMimeType === 'application/pdf' ||
    previewMimeType === 'application/pdf'
  );
}

export function revisionFromTopicContent(
  topicId: string,
  materials: Material[],
  questions: Array<{ id: string; updatedAt?: string | number | Date | null }>,
): string {
  return computeOfflineContentRevision(
    topicId,
    materials.filter(isPdfMaterial).map(material => ({
      id: material.id,
      updatedAt: material.updatedAt ?? material.lastUpdated,
    })),
    questions.map(question => ({ id: question.id, updatedAt: question.updatedAt })),
  );
}

export async function fetchServerContentRevision(
  topicId: string,
  materials: Material[],
): Promise<string | undefined> {
  try {
    const quiz = await apiService.get<Array<{ id: string; updatedAt?: string }>>(
      `/quizzes/topic/${encodeURIComponent(topicId)}`,
    );
    return revisionFromTopicContent(topicId, materials, quiz.data || []);
  } catch {
    return undefined;
  }
}

export async function markBundleStaleIfOutdated(
  userId: string,
  bundle: OfflineTopicBundle,
  materials: Material[],
): Promise<OfflineTopicBundle> {
  if (bundle.cacheMode === 'session') return bundle;
  const serverRevision = await fetchServerContentRevision(bundle.topicId, materials);
  if (!serverRevision || !isOfflineContentStale(bundle.contentRevision, serverRevision)) {
    return bundle;
  }
  await offlineService.markOfflineTopicStale(userId, bundle.topicId);
  return { ...bundle, stale: true };
}
