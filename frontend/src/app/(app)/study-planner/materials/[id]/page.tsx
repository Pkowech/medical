'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Image from 'next/image';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { ArrowLeft, ExternalLink, File, Share, Trash, Maximize2, Minimize2, Eye, Download } from 'lucide-react';
import materialService from '@/features/courses/services/materialService';
import useMaterialProgressTracker from '@/features/learning-management/hooks/useMaterialProgressTracker';
import PDFViewer from '@/shared/components/pdf/PDFViewer';
import offlineSync from '@/features/learning-management/services/offlineProgressSync';
import { apiService as api } from '@/features/auth/services/apiClient';
import { Material } from '@/shared/types/materialInterface';
import { useXapi } from '@/lib/xapi/useXapi';
import { URLS } from '@/lib/urls';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { usePageHeader } from '@/core/providers/HeaderContext';
import { hasPermission, Permission } from '@/lib/auth/roles';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';

const isUrl = (str: string) => {
  try {
    new URL(str);
    return str.startsWith('http') || str.startsWith('file');
  } catch {
    return false;
  }
};

export default function MaterialViewPage() {
  const { isLoading: isAuthLoading, user, session } = useAuth();
  const { setHeader } = usePageHeader();
  const router = useRouter();
  const params = useParams();
  const materialId = (params?.id as string) || '';
  const { trackAction, XAPI_VERBS } = useXapi();
  
  const [material, setMaterial] = useState<Material | null>(null);
  const [pdfContent, setPdfContent] = useState<Uint8Array | null>(null);
  const [isLoadingMaterial, setIsLoadingMaterial] = useState(true);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [pdfCurrentPage, setPdfCurrentPage] = useState<number>(1);
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  
  const [localFile, setLocalFile] = useState<File | null>(null);
  
  const lastTrackedPage = useRef<number>(0);
  const trackingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const canDelete = user && (user.role === 'admin' || hasPermission(user.role as never, 'EDIT_COURSES' as Permission));

  useEffect(() => {
    if (!material) return;

    setHeader({
      title: material.title,
      description: material.description || `${material.type || 'Study'} resource`,
      icon: '📄',
    });
    return () => setHeader(null);
  }, [material, setHeader]);

  // 1. Fetch Material Data
  useEffect(() => {
    if (!materialId) return;

    const fetchMaterial = async () => {
      try {
        setIsLoadingMaterial(true);
        setPdfContent(null);
        const data = await materialService.getMaterialWithFileUrl(materialId);
        const pdfUrl = data.previewFileUrl || data.fileUrl || data.url;
        const isPdf =
          data.type?.toLowerCase() === 'pdf' ||
          data.file?.mimetype?.toLowerCase() === 'application/pdf' ||
          Boolean(data.previewFileUrl) ||
          Boolean(pdfUrl?.split('?')[0].toLowerCase().endsWith('.pdf'));
        if (isPdf && !pdfUrl?.startsWith('file:')) {
          setPdfContent(await materialService.getMaterialPreviewContent(materialId));
        }
        setMaterial(data);
        
        trackAction(XAPI_VERBS.EXPERIENCED, {
          id: `${URLS.BASE}/materials/${materialId}`,
          definition: {
            name: { 'en-US': data.title },
            type: 'http://adlnet.gov/expapi/activities/media',
          },
        }, undefined, getMaterialXapiContext(data));
      } catch (err) {
        console.error('Error fetching material:', err);
        setError('Failed to load material. Please try again.');
      } finally {
        setIsLoadingMaterial(false);
      }
    };

    fetchMaterial();
  }, [materialId, trackAction, XAPI_VERBS]);

  // 2. Study Tracking Logic
  const computePercent = useCallback(() => {
    if ((material?.type === 'pdf' || material?.type === 'document') && pdfNumPages && pdfNumPages > 0) {
      const p = Math.round((pdfCurrentPage / pdfNumPages) * 100);
      return Math.max(0, Math.min(100, p));
    }
    try {
      const el = document.getElementById('material-content');
      if (!el) return 0;
      const scrollTop = el.scrollTop;
      const scrollHeight = el.scrollHeight - el.clientHeight;
      if (scrollHeight <= 0) return 100;
      return Math.round((scrollTop / scrollHeight) * 100);
    } catch {
      return 0;
    }
  }, [material?.type, pdfNumPages, pdfCurrentPage]);

  const { startTracking, stopTracking, isTracking } = useMaterialProgressTracker({
    materialId: material?.id,
    unitId: material?.unitId ? String(material.unitId) : undefined,
    topicId: material?.topicId,
    courseId: material?.courseId,
    materialTitle: material?.title,
    computePercent,
    intervalMs: 30000,
  });

  const getMaterialXapiContext = (currentMaterial: Material) => ({
    extensions: {
      [URLS.XAPI_EXTENSIONS.COURSE_ID]: currentMaterial.courseId,
      [URLS.XAPI_EXTENSIONS.UNIT_ID]: currentMaterial.unitId,
      [URLS.XAPI_EXTENSIONS.TOPIC_ID]: currentMaterial.topicId,
    },
  });

  const trackMaterialDownload = () => {
    if (!material) return;
    void trackAction(XAPI_VERBS.DOWNLOADED, {
      id: `${URLS.BASE}/materials/${material.id}`,
      definition: {
        name: { 'en-US': material.title },
        type: 'http://adlnet.gov/expapi/activities/media',
      },
    }, undefined, getMaterialXapiContext(material));
  };

  useEffect(() => {
    if (material && !isTracking) {
      startTracking();
    }
    return () => {
      if (isTracking) stopTracking();
    };
  }, [material, isTracking, startTracking, stopTracking]);

  // 3. PDF Page Tracking Logic (Debounced to protect servers)
  const handlePageChange = useCallback((current: number, total: number) => {
    setPdfCurrentPage(current);
    setPdfNumPages(total);
    
    if (material?.id && current !== lastTrackedPage.current) {
      lastTrackedPage.current = current;
      
      if (trackingTimeoutRef.current) {
        clearTimeout(trackingTimeoutRef.current);
      }
      
      // Debounce the tracking post by 1 second to prevent too many posts per second
      trackingTimeoutRef.current = setTimeout(() => {
        (async () => {
          try {
            await api.post(`/materials/${material.id}/track/view`, { page: current });
          } catch (trackingError) {
            console.warn('[MaterialView] Page tracking failed; queueing offline update.', trackingError);
            await offlineSync.addToQueue({
              materialId: material.id,
              page: current,
              createdAt: new Date().toISOString(),
            });
          }
        })();
      }, 1000);
    }
  }, [material?.id]);

  // 4. Stable PDF Headers
  const accessToken =
    typeof session === 'object' &&
    session !== null &&
    'accessToken' in session &&
    typeof session.accessToken === 'string'
      ? session.accessToken
      : undefined;
  const pdfHeaders = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const handleDelete = async () => {
    if (!materialId) return;
    setIsDeleting(true);
    try {
      await materialService.deleteMaterial(materialId);
      toast.success('Material deleted.');
      router.push('/study-planner/materials');
    } catch (err) {
      console.error('Error deleting material:', err);
      toast.error(err instanceof Error ? err.message : 'Failed to delete material.');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({ title: material?.title, url: window.location.href });
      } else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success('Material link copied.');
      }
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === 'AbortError') return;
      toast.error('Could not share this material.');
    }
  };

  const renderContent = () => {
    if (!material) return null;

    const contentIsUrl = typeof material.content === 'string' && isUrl(material.content);
    const effectiveUrl = material.previewFileUrl || material.fileUrl || material.url || (contentIsUrl ? (material.content as string) : null);

    const isLocalFileUrl = effectiveUrl?.startsWith('file:');

    // Office documents that have been converted to PDF will use previewFileUrl, so we include doc types in the check below (or rely on previewFileUrl being a PDF).
    const isPdfRenderable = material.type === 'pdf' || material.previewFileUrl || (contentIsUrl && (material.content as string).toLowerCase().endsWith('.pdf'));

    if (isPdfRenderable && effectiveUrl) {
      if (isLocalFileUrl && !localFile) {
        return (
          <div className="flex flex-col items-center justify-center p-12 text-center h-[70vh] bg-gray-50 dark:bg-slate-800/50 rounded-xl">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full mb-4 flex items-center justify-center">
              <File className="h-10 w-10 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Personal Study Material</h3>
            <p className="text-gray-600 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
              This material references a file on your local computer (<span className="text-xs break-all">{effectiveUrl}</span>).<br /><br />
              For security reasons, web browsers cannot open local files automatically. Please select the file manually to view it and track your progress.
            </p>
            <div className="relative">
              <input 
                type="file" 
                accept=".pdf"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setLocalFile(e.target.files[0]);
                  }
                }}
              />
              <Button type="button" className="pointer-events-none relative z-0">
                Select Local File
              </Button>
            </div>
          </div>
        );
      }

      return (
        <div className="h-full min-h-0 w-full">
          <PDFViewer
            file={localFile || pdfContent || effectiveUrl}
            headers={pdfHeaders}
            onPageChange={handlePageChange}
          />
        </div>
      );
    }

    if ((['jpg', 'jpeg', 'png', 'webp'].includes(material.type || '') || (contentIsUrl && /\.(jpg|jpeg|png|webp)/i.test(material.content as string))) && effectiveUrl) {
      return (
        <div className="flex justify-center">
          <Image
            src={effectiveUrl}
            alt={material.title}
            width={800}
            height={800}
            className="rounded-lg shadow-lg max-h-[70vh] object-contain"
          />
        </div>
      );
    }

    return (
      <div id="material-content" className="prose dark:prose-invert max-w-none h-full overflow-auto p-6 md:p-8 [&_table]:border-collapse [&_table]:w-full [&_table]:border-slate-200 [&_table]:rounded-lg [&_th]:border-slate-200 [&_th]:border [&_th]:py-3 [&_th]:px-4 [&_th]:bg-slate-50 [&_th]:dark:bg-slate-800 [&_td]:border-slate-200 [&_td]:border [&_td]:py-3 [&_td]:px-4">
        {material.content || 'No content available for this material.'}
      </div>
    );
  };

  if (isAuthLoading || isLoadingMaterial) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error || !material) {
    return (
      <div className="container mx-auto py-8 px-4 text-center">
        <p className="text-red-500 mb-4">{error || 'Material not found'}</p>
        <Button onClick={() => router.push('/study-planner/materials')}>Back to Materials</Button>
      </div>
    );
  }

  return (
    <div className={`flex h-full min-h-0 min-w-0 flex-col overflow-hidden bg-slate-50 transition-colors duration-300 dark:bg-slate-950 ${focusMode ? 'py-0' : 'p-3 sm:p-4 md:p-6'}`}>
      <div className={`flex flex-col h-full mx-auto w-full transition-all duration-300 ${focusMode ? 'max-w-full' : 'max-w-7xl'}`}>
        <AnimatePresence>
          {!focusMode && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-3 flex shrink-0 flex-wrap items-center justify-between gap-2">
              <Button variant="ghost" onClick={() => router.push('/study-planner/materials')} className="rounded-lg">
                <ArrowLeft className="mr-2 h-4 w-4" /> Materials
              </Button>
              <div className="flex flex-wrap items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={handleShare} aria-label="Share material" className="rounded-lg">
                  <Share className="mr-2 h-4 w-4" /> Share
                </Button>
                <Button variant="outline" size="sm" onClick={() => setFocusMode(true)} className="rounded-lg">
                  <Maximize2 className="mr-2 h-4 w-4" /> Focus
                </Button>
                {(material.fileUrl || material.url) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      trackMaterialDownload();
                      window.open(material.fileUrl || material.url, '_blank', 'noopener,noreferrer');
                    }}
                    className="rounded-lg"
                  >
                    <Download className="mr-2 h-4 w-4" /> Download Original
                  </Button>
                )}
                {canDelete && (
                  <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)} className="rounded-lg">
                    <Trash className="mr-2 h-4 w-4" /> Delete
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex min-h-0 min-w-0 flex-1 gap-4 overflow-hidden sm:gap-6">
          {/* Main Document Area */}
          <div className="flex-1 flex flex-col min-w-0">
            <Card className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${focusMode ? 'rounded-none' : 'rounded-xl'}`}>
              {focusMode && (
                <div className="absolute top-4 right-4 z-50">
                  <Button variant="secondary" size="sm" onClick={() => setFocusMode(false)}>
                    <Minimize2 className="mr-2 h-4 w-4" /> Exit Focus
                  </Button>
                </div>
              )}
              
              {!focusMode && (
                <CardHeader className="shrink-0 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:px-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
                        <File className="h-4 w-4" />
                        <span>{material.type || 'DOCUMENT'}</span>
                      </div>
                      <CardTitle className="line-clamp-2 text-base font-semibold leading-snug text-slate-900 dark:text-white">
                        {material.title}
                      </CardTitle>
                    </div>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="icon" onClick={handleShare} aria-label="Share material">
                        <Share className="h-4 w-4" />
                      </Button>
                      {(material.fileUrl || material.url) && (
                        <Button variant="outline" size="icon" asChild>
                          <a
                            href={material.fileUrl || material.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="Open original file"
                            onClick={trackMaterialDownload}
                          >
                            <ExternalLink className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
              )}
              
              <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
                <div className="h-full min-h-0 w-full overflow-hidden">
                  {renderContent()}
                </div>
              </CardContent>
            </Card>

            {!focusMode && material.description && (
              <section className="mt-4 shrink-0">
                <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                  <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" /> About this material
                </h2>
                <Card className="rounded-xl border-slate-200 bg-white py-0 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                  <CardContent className="py-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                    {material.description}
                  </CardContent>
                </Card>
              </section>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showDeleteConfirm} onOpenChange={open => !isDeleting && setShowDeleteConfirm(open)}>
        <DialogContent className="max-w-md rounded-xl border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <DialogHeader className="text-left">
            <DialogTitle className="text-slate-900 dark:text-white">Delete this material?</DialogTitle>
            <DialogDescription className="pt-2 text-slate-600 dark:text-slate-300">
              “{material.title}” will be permanently removed from the materials library.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-2 gap-2 sm:space-x-0">
            <Button
              type="button"
              variant="outline"
              disabled={isDeleting}
              onClick={() => setShowDeleteConfirm(false)}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={isDeleting}
              onClick={() => void handleDelete()}
              className="rounded-lg"
            >
              {isDeleting ? 'Deleting…' : 'Delete material'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
