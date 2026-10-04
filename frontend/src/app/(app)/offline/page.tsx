'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { ArrowDownToLine, RefreshCw, Trash2, WifiOff } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { offlineService } from '@/lib/core/offline/offlineService';
import { syncService } from '@/lib/core/offline/syncService';
import type { OfflinePracticeAttempt, OfflineTopicBundle } from '@/lib/core/offline/db';
import { topicService } from '@/features/courses/services/topicService';
import materialService from '@/features/courses/services/materialService';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let size = bytes / 1024;
  let unitIndex = 0;
  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex += 1;
  }
  return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function getErrorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const details = error as { status?: number; rawResponse?: { statusCode?: number } };
  return details.status ?? details.rawResponse?.statusCode;
}

export default function OfflineDownloadsPage() {
  const { data: session, status } = useSession();
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [bundles, setBundles] = useState<OfflineTopicBundle[]>([]);
  const [attempts, setAttempts] = useState<OfflinePracticeAttempt[]>([]);
  const [isOnline, setIsOnline] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | undefined>(undefined);
  const [busyId, setBusyId] = useState<string | undefined>(undefined);
  const reconciledUserRef = useRef<string | undefined>(undefined);

  const refresh = useCallback(async (activeUserId: string) => {
    const [cachedBundles, cachedAttempts] = await Promise.all([
      offlineService.listOfflineTopicBundles(activeUserId),
      offlineService.getOfflinePracticeAttempts(activeUserId),
    ]);
    setBundles(cachedBundles);
    setAttempts(cachedAttempts.sort((left, right) => right.lastUpdated - left.lastUpdated));
  }, []);

  useEffect(() => {
    const activeUserId = session?.user?.id || offlineService.getActiveOfflineUserId();
    setUserId(activeUserId);
    const updateConnection = () => setIsOnline(navigator.onLine);
    updateConnection();
    window.addEventListener('online', updateConnection);
    window.addEventListener('offline', updateConnection);
    return () => {
      window.removeEventListener('online', updateConnection);
      window.removeEventListener('offline', updateConnection);
    };
  }, [session?.user?.id]);

  useEffect(() => {
    if (!userId) {
      setIsLoading(false);
      return;
    }
    let active = true;
    const loadContent = async () => {
      try {
        setIsLoading(true);
        setError(undefined);
        await refresh(userId);
      } catch (loadError) {
        console.error('[OfflineCache] Failed to load offline downloads:', loadError);
        if (active) setError('Offline downloads could not be read from this device.');
      } finally {
        if (active) setIsLoading(false);
      }
    };
    void loadContent();
    return () => {
      active = false;
    };
  }, [userId, refresh]);

  useEffect(() => {
    if (isLoading || !userId || status !== 'authenticated' || !navigator.onLine) return;
    if (reconciledUserRef.current === userId) return;
    reconciledUserRef.current = userId;
    let active = true;
    const reconcileAccess = async () => {
      let changed = false;
      for (const bundle of bundles) {
        if (!active) return;
        try {
          await topicService.getTopicById(bundle.courseId, bundle.unitId, bundle.topicId);
        } catch (accessError) {
          const accessStatus = getErrorStatus(accessError);
          if (accessStatus === 403 || accessStatus === 404) {
            await offlineService.removeOfflineTopic(userId, bundle.topicId);
            changed = true;
            continue;
          }
          console.warn('[OfflineCache] Could not revalidate a saved topic:', accessError);
          continue;
        }

        for (const materialId of bundle.materialIds) {
          if (!active) return;
          try {
            await materialService.getMaterialById(materialId);
          } catch (accessError) {
            const accessStatus = getErrorStatus(accessError);
            if (accessStatus === 403 || accessStatus === 404) {
              await offlineService.removeOfflineTopicMaterial(userId, bundle.topicId, materialId);
              changed = true;
            } else {
              console.warn('[OfflineCache] Could not revalidate a saved PDF:', accessError);
            }
          }
        }
      }
      if (active && changed) await refresh(userId);
    };
    void reconcileAccess().catch(reconcileError => {
      console.error('[OfflineCache] Failed to revalidate offline access:', reconcileError);
    });
    return () => {
      active = false;
    };
  }, [bundles, isLoading, isOnline, refresh, status, userId]);

  useEffect(() => {
    if (!isOnline) reconciledUserRef.current = undefined;
  }, [isOnline]);

  const removeBundle = async (topicId: string) => {
    if (!userId) return;
    setBusyId(topicId);
    try {
      await offlineService.removeOfflineTopic(userId, topicId);
      await refresh(userId);
    } catch (removeError) {
      console.error('[OfflineCache] Could not remove an offline topic:', removeError);
      setError('This download could not be removed.');
    } finally {
      setBusyId(undefined);
    }
  };

  const retryAttempt = async (attemptId: string) => {
    setBusyId(attemptId);
    try {
      await syncService.retryQueueItem(attemptId);
      if (userId) await refresh(userId);
    } catch (retryError) {
      console.error('[OfflineQuiz] Could not retry an offline attempt:', retryError);
      setError('The practice attempt could not be retried.');
    } finally {
      setBusyId(undefined);
    }
  };

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">Offline downloads</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Topic PDFs and practice quizzes saved on this device. Downloads expire after 30 days and
          are rechecked when you reconnect.
        </p>
      </header>

      {!isOnline && (
        <div role="status" className="flex items-center gap-2 rounded-lg border p-3 text-sm">
          <WifiOff className="h-4 w-4" />
          You are offline. Saved topics remain available; queued practice attempts will sync later.
        </div>
      )}

      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {isLoading ? (
        <p>Loading downloads…</p>
      ) : !userId ? (
        <p className="rounded-lg border p-5 text-sm">
          Sign in on this device while online before downloading course content.
        </p>
      ) : bundles.length === 0 ? (
        <div className="rounded-lg border p-6 text-center">
          <ArrowDownToLine className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p>No topics are saved for offline use.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/courses">Browse courses</Link>
          </Button>
        </div>
      ) : (
        <section aria-labelledby="saved-topics-heading" className="space-y-3">
          <h2 id="saved-topics-heading" className="text-lg font-semibold">Saved topics</h2>
          {bundles.map(bundle => (
            <article
              key={bundle.id}
              className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <h3 className="font-medium">{bundle.title}</h3>
                <p className="text-sm text-muted-foreground">
                  {bundle.materialIds.length} PDF{bundle.materialIds.length === 1 ? '' : 's'} ·
                  {' '}{formatSize(bundle.totalBytes)} · Downloaded{' '}
                  {new Date(bundle.downloadedAt).toLocaleDateString()}
                </p>
                <p className="text-xs text-muted-foreground">
                  Expires {new Date(bundle.expiresAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <Button asChild variant="outline">
                  <Link href={`/courses/${bundle.courseId}/units/${bundle.unitId}/topics/${bundle.topicId}`}>
                    Open topic
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void removeBundle(bundle.topicId)}
                  disabled={busyId === bundle.topicId}
                  aria-label={`Remove ${bundle.title} from offline downloads`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </article>
          ))}
        </section>
      )}

      {userId && attempts.length > 0 && (
        <section aria-labelledby="practice-sync-heading" className="space-y-3">
          <h2 id="practice-sync-heading" className="text-lg font-semibold">Practice sync</h2>
          {attempts.map(attempt => {
            const topic = bundles.find(bundle => bundle.topicId === attempt.topicId);
            return (
              <article key={attempt.id} className="rounded-lg border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-medium">{topic?.title || 'Saved topic practice'}</h3>
                    <p className="text-sm text-muted-foreground">
                      {attempt.status === 'synced'
                        ? `Validated practice score: ${attempt.score ?? 0}%`
                        : attempt.status === 'failed'
                          ? 'Sync failed'
                          : attempt.status === 'draft'
                            ? 'Draft saved on this device'
                            : 'Provisional · waiting to sync'}
                    </p>
                  </div>
                  {attempt.status === 'failed' && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => void retryAttempt(attempt.id)}
                      disabled={!isOnline || busyId === attempt.id}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Retry sync
                    </Button>
                  )}
                </div>
                {attempt.lastError && (
                  <p role="alert" className="mt-2 text-sm text-red-600">{attempt.lastError}</p>
                )}
                {attempt.status !== 'synced' && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Offline answers are untrusted until validated by the server; they do not count
                    toward mastery or unlocks.
                  </p>
                )}
              </article>
            );
          })}
        </section>
      )}
    </main>
  );
}
