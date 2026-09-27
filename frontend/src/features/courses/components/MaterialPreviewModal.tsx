'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { ChevronLeft, ChevronRight, ExternalLink, FileText, PlayCircle, Download } from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';
import PDFViewer from '@/shared/components/pdf/PDFViewer';
import materialService from '@/features/courses/services/materialService';
import useMaterialProgressTracker from '@/features/learning-management/hooks/useMaterialProgressTracker';
import { Material } from '@/shared/types/materialInterface';
import URLS from '@/lib/urls';

interface MaterialPreviewModalProps {
  materialId: string | null;
  isOpen: boolean;
  onClose: () => void;
  materials?: Array<{ id: string | number }>;
  onNavigate?: (id: string) => void;
}

export const MaterialPreviewModal = ({
  materialId,
  isOpen,
  onClose,
  materials = [],
  onNavigate,
}: MaterialPreviewModalProps) => {
  const [material, setMaterial] = useState<Material | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pdfCurrentPage, setPdfCurrentPage] = useState<number>(1);
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null);
  const [pdfContent, setPdfContent] = useState<Uint8Array | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && materialId) {
      const fetchMaterial = async () => {
        setIsLoading(true);
        setMaterial(null);
        setPdfContent(null);
        setPreviewError(null);
        setPdfCurrentPage(1);
        setPdfNumPages(null);
        try {
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
          setPreviewError('Unable to load this material preview.');
        } finally {
          setIsLoading(false);
        }
      };
      fetchMaterial();
    } else if (!isOpen) {
      setMaterial(null);
    }
  }, [isOpen, materialId]);

  const computePercent = useCallback(() => {
    if (material?.type === 'pdf' && pdfNumPages && pdfNumPages > 0) {
      return Math.round((pdfCurrentPage / pdfNumPages) * 100);
    }
    // For others, tracking might be simpler or handled by the component
    return 0;
  }, [material?.type, pdfNumPages, pdfCurrentPage]);

  const { startTracking, stopTracking } = useMaterialProgressTracker({
    materialId: material?.id,
    unitId: material?.unitId ? String(material.unitId) : undefined,
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

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      );
    }

    if (!material) return null;

    const effectiveUrl = material.previewFileUrl || material.fileUrl || material.url;
    const resolvedEffectiveUrl = effectiveUrl?.startsWith('/api/materials/')
      ? `${URLS.API_BASE}${effectiveUrl.replace(/^\/api/, '')}`
      : effectiveUrl;

    if (isVideo && resolvedEffectiveUrl) {
      return (
        <div className="aspect-video w-full">
          <VideoPlayer url={resolvedEffectiveUrl} title={material.title} lessonId={material.id} />
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
      return (
        <div className="flex h-[60vh] items-center justify-center p-6 text-center text-sm text-red-600">
          {previewError}
        </div>
      );
    }

    if (isPdfRenderable && pdfContent) {
      return (
        <div className="h-full min-h-0 w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
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
      <div className="p-6 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-800">
        <p className="text-slate-600 dark:text-slate-400 mb-4">{material.description || 'No description available.'}</p>
        {resolvedEffectiveUrl && (
          <Button onClick={() => window.open(resolvedEffectiveUrl, '_blank')} className="w-full">
            <ExternalLink className="mr-2 h-4 w-4" /> Open Resource
          </Button>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="grid h-dvh max-h-dvh w-screen max-w-none grid-rows-[auto_minmax(0,1fr)_auto] gap-0 overflow-hidden rounded-none border-none bg-white p-0 shadow-2xl dark:bg-slate-900">
        <DialogHeader className="sticky top-0 z-10 flex flex-col items-stretch justify-between space-y-2 border-b bg-white p-3 dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center sm:space-y-0 sm:p-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className={`p-2 rounded-lg ${isVideo ? 'bg-red-50 dark:bg-red-500/10 text-red-600' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600'}`}>
              {isVideo ? <PlayCircle className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <DialogTitle className="text-lg font-bold truncate max-w-[50vw]">{material?.title || 'Loading...'}</DialogTitle>
              <DialogDescription className="sr-only">
                {material?.description || `${material?.type || 'Study'} resource`}
              </DialogDescription>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                {material?.type || 'Material'} • {material?.size || 'Study Resource'}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1 pr-8">
            <Button type="button" variant="ghost" size="sm" onClick={onClose} title="Back to study">
              <ChevronLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back</span>
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
                <span className="whitespace-nowrap text-xs text-slate-500">
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
              <Button variant="ghost" size="sm" onClick={() => window.open(material.fileUrl, '_blank')} title="Download">
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogHeader>
        
        <div className="relative h-full min-h-0 min-w-0 overflow-hidden">
          {renderContent()}
        </div>
        
        {/* Footer with basic info */}
        {!isLoading && material && (
          <div className="flex items-center justify-between border-t bg-slate-50 p-2 text-[10px] text-slate-500 dark:border-slate-800 dark:bg-slate-800/30 sm:p-4 sm:text-xs">
            <div className="flex items-center gap-4">
              <span>Added on {new Date(material.createdAt).toLocaleDateString()}</span>
              {material.difficulty && (
                <span className="bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded capitalize">
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
