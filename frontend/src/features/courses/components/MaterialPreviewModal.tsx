'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/components/ui/dialog';
import { Button } from '@/shared/components/ui/button';
import { ExternalLink, Maximize2, X, FileText, PlayCircle, Download } from 'lucide-react';
import { VideoPlayer } from './VideoPlayer';
import PDFViewer from '@/shared/components/pdf/PDFViewer';
import materialService from '@/features/courses/services/materialService';
import useMaterialProgressTracker from '@/features/learning-management/hooks/useMaterialProgressTracker';
import { Material } from '@/shared/types/materialInterface';
import { useAuth } from '@/features/auth/hooks/useAuth';

interface MaterialPreviewModalProps {
  materialId: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export const MaterialPreviewModal = ({ materialId, isOpen, onClose }: MaterialPreviewModalProps) => {
  const { session } = useAuth();
  const [material, setMaterial] = useState<Material | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [pdfCurrentPage, setPdfCurrentPage] = useState<number>(1);
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null);

  useEffect(() => {
    if (isOpen && materialId) {
      const fetchMaterial = async () => {
        setIsLoading(true);
        try {
          const data = await materialService.getMaterialWithFileUrl(materialId);
          setMaterial(data);
        } catch (error) {
          console.error('Error fetching material for preview:', error);
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

  const accessToken = (session as any)?.accessToken;
  const pdfHeaders = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const isVideo = material?.type?.toLowerCase().includes('video') || material?.contentType?.toLowerCase().includes('video') || material?.url?.includes('youtube.com') || material?.url?.includes('youtu.be');

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      );
    }

    if (!material) return null;

    const effectiveUrl = material.fileUrl || material.url;

    if (isVideo && effectiveUrl) {
      return (
        <div className="aspect-video w-full">
          <VideoPlayer url={effectiveUrl} title={material.title} lessonId={material.id} />
        </div>
      );
    }

    if (material.type === 'pdf' && effectiveUrl) {
      return (
        <div className="h-[70vh] w-full border rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-900">
          <PDFViewer
            file={effectiveUrl}
            headers={pdfHeaders}
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
        {effectiveUrl && (
          <Button onClick={() => window.open(effectiveUrl, '_blank')} className="w-full">
            <ExternalLink className="mr-2 h-4 w-4" /> Open Resource
          </Button>
        )}
      </div>
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] p-0 overflow-hidden border-none shadow-2xl bg-white dark:bg-slate-900">
        <DialogHeader className="p-4 border-b dark:border-slate-800 flex flex-row items-center justify-between space-y-0 bg-white dark:bg-slate-900 sticky top-0 z-10">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${isVideo ? 'bg-red-50 dark:bg-red-500/10 text-red-600' : 'bg-blue-50 dark:bg-blue-500/10 text-blue-600'}`}>
              {isVideo ? <PlayCircle className="w-5 h-5" /> : <FileText className="w-5 h-5" />}
            </div>
            <div>
              <DialogTitle className="text-lg font-bold truncate max-w-[50vw]">{material?.title || 'Loading...'}</DialogTitle>
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">
                {material?.type || 'Material'} • {material?.size || 'Study Resource'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 pr-8">
            {material?.id && (
              <Button 
                variant="ghost" 
                size="sm" 
                onClick={() => window.open(`/study-planner/materials/${material.id}`, '_blank')}
                title="Open in full page"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            )}
            {material?.fileUrl && (
              <Button variant="ghost" size="sm" onClick={() => window.open(material.fileUrl, '_blank')} title="Download">
                <Download className="h-4 w-4" />
              </Button>
            )}
          </div>
        </DialogHeader>
        
        <div className="relative">
          {renderContent()}
        </div>
        
        {/* Footer with basic info */}
        {!isLoading && material && (
          <div className="p-4 bg-slate-50 dark:bg-slate-800/30 border-t dark:border-slate-800 flex justify-between items-center text-xs text-slate-500">
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
