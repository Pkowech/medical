'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Image from 'next/image';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { ArrowLeft, File, Share, Trash, Maximize2, Minimize2, Eye, Download } from 'lucide-react';
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
  const materialCourseId = material?.courseId || material?.course?.id || material?.unit?.course?.id;
  const materialsReturnUrl = materialCourseId
    ? `/study-planner/materials?courseId=${encodeURIComponent(materialCourseId)}&scope=enrolled`
    : '/study-planner/materials';

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
      router.push(materialsReturnUrl);
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
          <div className="flex flex-col items-center justify-center p-12 text-center h-[70vh] bg-background dark:bg-card/50 rounded-xl">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-4 rounded-full mb-4 flex items-center justify-center">
              <File className="h-10 w-10 text-blue-600 dark:text-blue-400" />
            </div>
            <h3 className="text-xl font-bold text-foreground dark:text-foreground mb-2">Personal Study Material</h3>
            <p className="text-muted-foreground dark:text-muted-foreground max-w-md mb-6 leading-relaxed">
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
      <div id="material-content" className="prose dark:prose-invert max-w-none h-full overflow-auto p-6 md:p-8 [&_table]:border-collapse [&_table]:w-full [&_table]:border-border [&_table]:rounded-lg [&_th]:border-border [&_th]:border [&_th]:py-3 [&_th]:px-4 [&_th]:bg-background [&_th]:dark:bg-card [&_td]:border-border [&_td]:border [&_td]:py-3 [&_td]:px-4">
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
    <div className={`flex min-h-0 min-w-0 flex-col overflow-hidden bg-background transition-colors duration-300 dark:bg-background ${
      focusMode
        ? 'fixed inset-0 z-50 h-[100dvh] w-screen max-w-none p-0'
        : 'h-full p-3 sm:p-4 md:p-6'
    }`}>
      <div className={`flex flex-col h-full mx-auto w-full transition-all duration-300 ${focusMode ? 'max-w-full' : 'max-w-7xl'}`}>
        <AnimatePresence>
          {!focusMode && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-1 flex shrink-0 flex-nowrap items-center justify-between gap-1 sm:mb-3 sm:gap-2">
              <Button variant="ghost" onClick={() => router.push(materialsReturnUrl)} className="h-8 shrink-0 rounded-lg px-2 sm:h-9 sm:px-3">
                <ArrowLeft className="mr-1 h-4 w-4 sm:mr-2" />
                <span className="sm:hidden">Back</span>
                <span className="hidden sm:inline">{materialCourseId ? 'Course materials' : 'Materials'}</span>
              </Button>
              <div className="flex min-w-0 shrink items-center justify-end gap-1 sm:gap-2">
                <Button variant="outline" size="sm" onClick={handleShare} aria-label="Share material" title="Share material" className="h-8 w-8 shrink-0 rounded-lg p-0 sm:h-9 sm:w-auto sm:px-3">
                  <Share className="h-4 w-4 sm:mr-2" />
                  <span className="sr-only sm:not-sr-only">Share</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => setFocusMode(true)} aria-label="Enter focus mode" title="Focus" className="h-8 w-8 shrink-0 rounded-lg p-0 sm:h-9 sm:w-auto sm:px-3">
                  <Maximize2 className="h-4 w-4 sm:mr-2" />
                  <span className="sr-only sm:not-sr-only">Focus</span>
                </Button>
                {(material.fileUrl || material.url) && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      trackMaterialDownload();
                      window.open(material.fileUrl || material.url, '_blank', 'noopener,noreferrer');
                    }}
                    aria-label="Download original"
                    title="Download original"
                    className="h-8 w-8 shrink-0 rounded-lg p-0 sm:h-9 sm:w-auto sm:px-3"
                  >
                    <Download className="h-4 w-4 sm:mr-2" />
                    <span className="sr-only sm:not-sr-only">Download Original</span>
                  </Button>
                )}
                {canDelete && (
                  <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)} aria-label="Delete material" title="Delete material" className="h-8 w-8 shrink-0 rounded-lg p-0 sm:h-9 sm:w-auto sm:px-3">
                    <Trash className="h-4 w-4 sm:mr-2" />
                    <span className="sr-only sm:not-sr-only">Delete</span>
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex min-h-0 min-w-0 flex-1 gap-4 overflow-hidden sm:gap-6">
          {/* Main Document Area */}
          <div className="flex-1 flex flex-col min-w-0">
            <Card className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border border-border bg-card shadow-sm dark:border-border dark:bg-card ${focusMode ? 'rounded-none' : 'rounded-xl'}`}>
              {focusMode && (
                <div className="absolute top-4 right-4 z-50">
                  <Button variant="secondary" size="sm" onClick={() => setFocusMode(false)}>
                    <Minimize2 className="mr-2 h-4 w-4" /> Exit Focus
                  </Button>
                </div>
              )}
              
              <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
                <div className="h-full min-h-0 w-full overflow-hidden">
                  {renderContent()}
                </div>
              </CardContent>
            </Card>

            {!focusMode && material.description && (
              <details className="mt-3 shrink-0">
                <summary className="flex cursor-pointer list-none items-center gap-2 py-2 text-sm font-semibold text-muted-foreground marker:hidden dark:text-muted-foreground">
                  <Eye className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  About this material
                </summary>
                <Card className="rounded-xl border-border bg-card py-0 shadow-sm dark:border-border dark:bg-card">
                  <CardContent className="py-3 text-sm leading-relaxed text-muted-foreground dark:text-muted-foreground">
                    {material.description}
                  </CardContent>
                </Card>
              </details>
            )}
          </div>
        </div>
      </div>

      <Dialog open={showDeleteConfirm} onOpenChange={open => !isDeleting && setShowDeleteConfirm(open)}>
        <DialogContent className="max-w-md rounded-xl border-border bg-card dark:border-border dark:bg-card">
          <DialogHeader className="text-left">
            <DialogTitle className="text-foreground dark:text-foreground">Delete this material?</DialogTitle>
            <DialogDescription className="pt-2 text-muted-foreground dark:text-muted-foreground">
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
