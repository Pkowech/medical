'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import {
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  Youtube,
} from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';
import PDFViewer from '@/shared/components/pdf/PDFViewer';
import materialService from '@/features/courses/services/materialService';
import useMaterialProgressTracker from '@/features/learning-management/hooks/useMaterialProgressTracker';
import { Material, MaterialType } from '@/shared/types/materialInterface';
import URLS from '@/lib/urls';
import { offlineService } from '@/lib/core/offline/offlineService';
import { useXapi } from '@/lib/xapi/useXapi';

interface MaterialPreviewModalProps {
  materialId: string | null;
  isOpen: boolean;
  onClose: () => void;
  materials?: Array<{ id: string | number }>;
  onNavigate?: (id: string) => void;
  inline?: boolean;
  topicId?: string;
  userId?: string;
  studySessionId?: string;
  fallbackMaterial?: Material;
}

export const MaterialPreviewModal = ({
  materialId,
  isOpen,
  onClose,
  materials = [],
  onNavigate,
  inline = false,
  topicId,
  userId,
  studySessionId,
  fallbackMaterial,
}: MaterialPreviewModalProps) => {
  const [material, setMaterial] = useState<Material | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pdfCurrentPage, setPdfCurrentPage] = useState<number>(1);
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null);
  const [pdfContent, setPdfContent] = useState<Uint8Array | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [retryAttempt, setRetryAttempt] = useState(0);
  const trackedViewKeyRef = useRef<string | null>(null);
  const xapiContext = useMemo(() => ({
    extensions: {
      [URLS.XAPI_EXTENSIONS.COURSE_ID]: material?.courseId,
      [URLS.XAPI_EXTENSIONS.UNIT_ID]: material?.unitId,
      [URLS.XAPI_EXTENSIONS.TOPIC_ID]: material?.topicId,
      [URLS.XAPI_EXTENSIONS.STUDY_SESSION_ID]: studySessionId,
    },
  }), [material?.courseId, material?.topicId, material?.unitId, studySessionId]);
  const { trackAction, XAPI_VERBS } = useXapi(xapiContext);

  useEffect(() => {
    if (isOpen && materialId) {
      const fetchMaterial = async () => {
        setIsLoading(true);
        setMaterial(null);
        setPdfContent(null);
        setPreviewError(null);
        setPdfCurrentPage(1);
        setPdfNumPages(null);
        const loadCachedPdf = async () => {
          if (!userId || !topicId) return false;
          const cached = await offlineService.getOfflineMaterial(userId, topicId, materialId);
          if (!cached) return false;
          const data: Material = fallbackMaterial ?? {
            id: cached.materialId,
            materialId: cached.materialId,
            title: cached.title,
            description: cached.description || '',
            contentType: MaterialType.DOCUMENT,
            content: '',
            type: 'pdf',
            topicId,
            createdAt: new Date(cached.cachedAt).toISOString(),
            updatedAt: new Date(cached.cachedAt).toISOString(),
          };
          const buffer = await cached.content.arrayBuffer();
          setMaterial(data);
          setPdfContent(new Uint8Array(buffer));
          return true;
        };

        try {
          if (!navigator.onLine) {
            if (await loadCachedPdf()) return;
            setPreviewError('This PDF is not saved on this device for offline use.');
            return;
          }

          const data = await materialService.getMaterialWithFileUrl(materialId);
          setMaterial(data);
          const isPdf =
            data.type?.toLowerCase() === 'pdf' ||
            Boolean(data.previewFileUrl) ||
            data.fileUrl?.toLowerCase().split('?')[0].endsWith('.pdf');
          if (isPdf) {
            setPdfContent(await materialService.getMaterialPreviewContent(materialId));
          }
        } catch (error) {
          console.error('Error fetching material for preview:', error);
          const status = (error as { status?: number; rawResponse?: { statusCode?: number } })
            ?.status ?? (error as { rawResponse?: { statusCode?: number } })?.rawResponse?.statusCode;
          if (status === 403 || status === 404) {
            if (userId && topicId) {
              await offlineService.removeOfflineTopicMaterial(userId, topicId, materialId);
            }
            setPreviewError(
              status === 403
                ? 'Access to this material has been revoked.'
                : 'This material is no longer available.',
            );
          } else if (status === 401) {
            setPreviewError('Sign in again while online to access this material.');
          } else if (!(await loadCachedPdf())) {
            setPreviewError('Unable to load this material preview.');
          }
        } finally {
          setIsLoading(false);
        }
      };
      fetchMaterial();
    } else if (!isOpen) {
      setMaterial(null);
    }
  }, [isOpen, materialId, topicId, userId, fallbackMaterial, retryAttempt]);

  useEffect(() => {
    if (!isOpen) {
      trackedViewKeyRef.current = null;
      return;
    }
    if (!material || String(material.id) !== String(materialId)) return;

    const trackingKey = `${studySessionId ?? ''}:${material.id}`;
    if (trackedViewKeyRef.current === trackingKey) return;
    trackedViewKeyRef.current = trackingKey;
    void trackAction(XAPI_VERBS.EXPERIENCED, {
      id: `${URLS.BASE}/materials/${material.id}`,
      definition: {
        name: { 'en-US': material.title },
        type: 'http://adlnet.gov/expapi/activities/media',
      },
    }, undefined, xapiContext);
  }, [isOpen, material, materialId, studySessionId, trackAction, XAPI_VERBS, xapiContext]);

  const computePercent = useCallback(() => {
    if (material?.type === 'pdf' && pdfNumPages && pdfNumPages > 0) {
      return Math.round((pdfCurrentPage / pdfNumPages) * 100);
    }
    // For others, tracking might be simpler or handled by the component
    return 0;
  }, [material?.type, pdfNumPages, pdfCurrentPage]);

  const { startTracking, stopTracking } = useMaterialProgressTracker({
    materialId: material?.id,
    topicId: material?.topicId,
    unitId: material?.unitId ? String(material.unitId) : undefined,
    courseId: material?.courseId,
    studySessionId,
    materialTitle: material?.title,
    computePercent,
    intervalMs: 120000,
  });

  useEffect(() => {
    if (material) {
      startTracking();
    }
    return () => {
      stopTracking();
    };
  }, [material, startTracking, stopTracking]);

  const isVideo = material?.type?.toLowerCase().includes('video') || material?.contentType?.toLowerCase().includes('video') || material?.url?.includes('youtube.com') || material?.url?.includes('youtu.be');
  const materialIndex = materials.findIndex(item => String(item.id) === String(materialId));
  const navigateMaterial = (offset: number) => {
    const nextMaterial = materials[materialIndex + offset];
    if (nextMaterial) onNavigate?.(String(nextMaterial.id));
  };

  const trackDownload = () => {
    if (!material) return;
    void trackAction(XAPI_VERBS.DOWNLOADED, {
      id: `${URLS.BASE}/materials/${material.id}`,
      definition: {
        name: { 'en-US': material.title },
        type: 'http://adlnet.gov/expapi/activities/media',
      },
    }, undefined, xapiContext);
  };

  const downloadOriginal = () => {
    if (!material?.fileUrl) return;
    trackDownload();
    window.open(material.fileUrl, '_blank', 'noopener,noreferrer');
  };

  const retryPreview = () => {
    setPreviewError(null);
    setRetryAttempt(attempt => attempt + 1);
  };

  const renderPreviewError = () => (
    <div className="flex h-full min-h-[16rem] items-center justify-center p-6">
      <div role="alert" className="max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-sm">
        <AlertCircle className="mx-auto mb-3 h-10 w-10 text-destructive" />
        <h3 className="text-lg font-semibold text-foreground">Unable to open this material</h3>
        <p className="mt-2 text-sm text-muted-foreground">
          {previewError || 'Check your connection and try again.'}
        </p>
        <div className="mt-5 flex flex-col justify-center gap-2 sm:flex-row">
          <Button type="button" onClick={retryPreview}>Try again</Button>
          <Button type="button" variant="outline" onClick={onClose}>Back to topic</Button>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    if (isLoading) {
      return (
        <div role="status" aria-live="polite" className="flex h-full min-h-[16rem] flex-col items-center justify-center gap-3 p-6 text-center">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="font-medium text-foreground">Preparing your study material...</p>
          <p className="text-sm text-muted-foreground">Loading securely from storage.</p>
        </div>
      );
    }

    if (previewError && !material) return renderPreviewError();
    if (!material) return null;

    const effectiveUrl = material.previewFileUrl || material.fileUrl || material.url || material.content;
    const resolvedEffectiveUrl = effectiveUrl?.startsWith('/api/materials/')
      ? `${URLS.API_BASE}${effectiveUrl.replace(/^\/api/, '')}`
      : effectiveUrl;

    if (isVideo && resolvedEffectiveUrl) {
      return (
        <div className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden bg-[#0b0b0b] p-2 sm:p-6">
          <div
            className="aspect-video w-full max-w-full overflow-hidden rounded-md shadow-2xl"
            style={{ maxWidth: 'min(100%, calc((100dvh - 14rem) * 16 / 9))' }}
          >
            <VideoPlayer url={resolvedEffectiveUrl} title={material.title} lessonId={material.id} theaterMode />
          </div>
        </div>
      );
    }

    const isPdfRenderable =
      material.type?.toLowerCase() === 'pdf' ||
      Boolean(material.previewFileUrl) ||
      [material.fileUrl, material.url].some((url) =>
        url?.split('?')[0].toLowerCase().endsWith('.pdf')
      );

    if (isPdfRenderable && previewError) {
      return renderPreviewError();
    }

    if (isPdfRenderable && pdfContent) {
      return (
        <div className="h-full min-h-0 w-full overflow-hidden bg-muted dark:bg-card">
          <PDFViewer
            file={pdfContent}
            onPageChange={(current, total) => {
              setPdfCurrentPage(current);
              setPdfNumPages(total);
            }}
          />
        </div>
      );
    }

    return (
      <div className="flex h-full min-h-[16rem] items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-sm sm:p-8">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">{material.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            {material.description || 'This file opens outside the built-in PDF reader.'}
          </p>
          {resolvedEffectiveUrl && (
            <Button
              type="button"
              onClick={() => window.open(resolvedEffectiveUrl, '_blank', 'noopener,noreferrer')}
              className="mt-5 w-full"
            >
              <ExternalLink className="mr-2 h-4 w-4" /> Open file
            </Button>
          )}
        </div>
      </div>
    );
  };

  if (inline) {
    return (
      <section className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-card dark:bg-card">
        <header className="flex flex-col gap-3 border-b p-4 dark:border-border sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`rounded-lg p-2 ${isVideo ? 'bg-red-50 text-red-600 dark:bg-red-500/10' : 'bg-blue-50 text-blue-600 dark:bg-blue-500/10'}`}>
              {isVideo ? <Youtube className="h-5 w-5" /> : <FileText className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-foreground dark:text-foreground">{material?.title || 'Loading material...'}</h2>
              <p className="text-xs font-medium uppercase text-muted-foreground">
                {material?.type || 'Study material'}{material?.size ? ` • ${material.size}` : ''}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              title="Back to topic"
              aria-label="Back to topic"
              className="gap-2 border-border bg-card text-muted-foreground shadow-sm hover:bg-background dark:border-border dark:bg-card dark:text-muted-foreground dark:hover:bg-card"
            >
              <ChevronLeft className="h-4 w-4" />
              Back
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              title="Close preview"
              aria-label="Close preview"
              className="h-9 w-9 rounded-full border border-border bg-card text-muted-foreground hover:bg-muted dark:border-border dark:bg-card dark:text-muted-foreground dark:hover:bg-card"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </Button>
            {materials.length > 1 && (
              <>
                <Button type="button" variant="ghost" size="sm" onClick={() => navigateMaterial(-1)} disabled={materialIndex <= 0} aria-label="Open previous material" title="Previous material">
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {materialIndex >= 0 ? `${materialIndex + 1} / ${materials.length}` : ''}
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={() => navigateMaterial(1)} disabled={materialIndex < 0 || materialIndex >= materials.length - 1} aria-label="Open next material" title="Next material">
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
            {material?.fileUrl && (
              <Button type="button" variant="ghost" size="sm" onClick={downloadOriginal} title="Download">
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </header>
        <div className="min-h-0 flex-1 overflow-hidden">
          {renderContent()}
        </div>
        {!isLoading && material && (
          <footer className="flex items-center justify-between gap-3 border-t bg-background p-3 text-xs text-muted-foreground dark:border-border dark:bg-card/30">
            <span>{material.type?.toLowerCase() === 'pdf' && pdfNumPages ? `Page ${pdfCurrentPage} of ${pdfNumPages}` : material.description || 'Study activity is being tracked'}</span>
            <span className="shrink-0 font-medium text-blue-600 dark:text-blue-400">Activity is being tracked</span>
          </footer>
        )}
      </section>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="fixed inset-0 left-0 top-0 right-0 bottom-0 z-[70] grid h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-none border-none bg-card p-0 shadow-2xl dark:bg-card">
        <DialogHeader className="sticky top-0 z-10 flex flex-col items-stretch justify-between space-y-2 border-b bg-card p-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] dark:border-border dark:bg-card sm:flex-row sm:items-center sm:space-y-0 sm:p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`p-2 rounded-lg ${isVideo ? 'bg-red-50 dark:bg-red-500/10 text-red-600' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600'}`}>
              {isVideo ? <Youtube className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <DialogTitle className="max-w-[min(60vw,36rem)] truncate text-lg font-bold">
                {material?.title || (previewError ? 'Unable to open material' : 'Loading material...')}
              </DialogTitle>
              <DialogDescription className="sr-only">
                {material?.description || `${material?.type || 'Study'} resource`}
              </DialogDescription>
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                {material?.type || 'Material'} • {material?.size || 'Study Resource'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 pr-8">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              title="Back to study"
              aria-label="Back to study"
              className="gap-2 border-border bg-card text-muted-foreground shadow-sm hover:bg-background dark:border-border dark:bg-card dark:text-muted-foreground dark:hover:bg-card"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Back</span>
            </Button>
            {materials.length > 1 && (
              <>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateMaterial(-1)}
                  disabled={materialIndex <= 0}
                  aria-label="Open previous material"
                  title="Previous material"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="whitespace-nowrap text-xs text-muted-foreground">
                  {materialIndex >= 0 ? `${materialIndex + 1} / ${materials.length}` : ''}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => navigateMaterial(1)}
                  disabled={materialIndex < 0 || materialIndex >= materials.length - 1}
                  aria-label="Open next material"
                  title="Next material"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
            {material?.fileUrl && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={downloadOriginal}
                title="Download original file"
                aria-label="Download original file"
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">Download</span>
              </Button>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              title="Close preview"
              aria-label="Close preview"
              className="h-9 w-9 rounded-full border border-border bg-card text-muted-foreground hover:bg-muted dark:border-border dark:bg-card dark:text-muted-foreground dark:hover:bg-card"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </Button>
          </div>
        </DialogHeader>
        
        <div className="relative h-full min-h-0 min-w-0 overflow-hidden">
          {renderContent()}
        </div>
        
        {/* Footer with basic info */}
        {!isLoading && material && (
          <div className="flex items-center justify-between border-t bg-background p-2 pb-[calc(env(safe-area-inset-bottom)+0.5rem)] text-[10px] text-muted-foreground dark:border-border dark:bg-card/30 sm:p-4 sm:text-xs">
            <div className="flex items-center gap-4">
              <span>Added on {new Date(material.createdAt).toLocaleDateString()}</span>
              {material.difficulty && (
                <span className="bg-secondary dark:bg-secondary px-2 py-0.5 rounded capitalize">
                  {material.difficulty}
                </span>
              )}
            </div>
            <div className="font-medium text-blue-600 dark:text-blue-400">
               Activity is being tracked
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
