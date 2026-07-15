'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import Image from 'next/image';
import { useRouter, useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Button } from '@/shared/components/ui/button';
import { ArrowLeft, ExternalLink, File, Share, Trash, Maximize2, Minimize2, Eye, MessageSquare, Sparkles, Download } from 'lucide-react';
import materialService from '@/features/courses/services/materialService';
import useMaterialProgressTracker from '@/features/learning-management/hooks/useMaterialProgressTracker';
import PDFViewer from '@/shared/components/pdf/PDFViewer';
import offlineSync from '@/features/learning-management/services/offlineProgressSync';
import { apiService as api } from '@/features/auth/services/apiClient';
import { Material } from '@/shared/types/materialInterface';
import { useXapi } from '@/lib/xapi/useXapi';
import { useAuth } from '@/features/auth/hooks/useAuth';
import { hasPermission, Permission } from '@/lib/auth/roles';
import { motion, AnimatePresence } from 'framer-motion';

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
  const router = useRouter();
  const params = useParams();
  const materialId = (params?.id as string) || '';
  const { trackAction, XAPI_VERBS } = useXapi();
  
  const [material, setMaterial] = useState<Material | null>(null);
  const [isLoadingMaterial, setIsLoadingMaterial] = useState(true);
  const [error, setError] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pdfCurrentPage, setPdfCurrentPage] = useState<number>(1);
  const [pdfNumPages, setPdfNumPages] = useState<number | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [showAssistant, setShowAssistant] = useState(false);
  
  const [localFile, setLocalFile] = useState<File | null>(null);
  
  const lastTrackedPage = useRef<number>(0);
  const trackingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const canDelete = user && (user.role === 'admin' || hasPermission(user.role as never, 'EDIT_COURSES' as Permission));

  // 1. Fetch Material Data
  useEffect(() => {
    if (!materialId) return;

    const fetchMaterial = async () => {
      try {
        setIsLoadingMaterial(true);
        const data = await materialService.getMaterialWithFileUrl(materialId);
        setMaterial(data);
        
        trackAction(XAPI_VERBS.EXPERIENCED, {
          id: `https://medtrackhub.com/materials/${materialId}`,
          definition: {
            name: { 'en-US': data.title },
            type: 'http://adlnet.gov/expapi/activities/media',
          },
        });
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
    computePercent,
    intervalMs: 30000,
  });

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
          } catch (err) {
            console.warn('[MaterialView] Page tracking failed');
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
  const accessToken = (session as any)?.accessToken;
  const pdfHeaders = useMemo(() => {
    if (!accessToken) return undefined;
    return { Authorization: `Bearer ${accessToken}` };
  }, [accessToken]);

  const handleDelete = async () => {
    if (!materialId) return;
    try {
      await materialService.deleteMaterial(materialId);
      router.push('/study-planner/materials');
    } catch (err) {
      console.error('Error deleting material:', err);
      alert('Failed to delete material.');
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
        <div className="w-full h-full">
          <PDFViewer
            file={localFile || effectiveUrl}
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
    <div className={`flex flex-col h-full bg-gray-50 dark:bg-slate-900 transition-colors duration-300 overflow-hidden ${focusMode ? 'py-0' : 'p-4 md:p-6'}`}>
      <div className={`flex flex-col h-full mx-auto w-full transition-all duration-300 ${focusMode ? 'max-w-full' : 'max-w-7xl'}`}>
        <AnimatePresence>
          {!focusMode && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex justify-between items-center mb-4 shrink-0">
              <Button variant="ghost" onClick={() => router.push('/study-planner/materials')}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setShowAssistant(!showAssistant)}>
                  <MessageSquare className="mr-2 h-4 w-4" /> {showAssistant ? 'Hide Assistant' : 'Study Assistant'}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setFocusMode(true)}>
                  <Maximize2 className="mr-2 h-4 w-4" /> Focus
                </Button>
                {material?.fileUrl && (
                  <Button variant="outline" size="sm" onClick={() => window.open(material.fileUrl, '_blank')}>
                    <Download className="mr-2 h-4 w-4" /> Download Original
                  </Button>
                )}
                {canDelete && (
                  <Button variant="destructive" size="sm" onClick={() => setShowDeleteConfirm(true)}>
                    <Trash className="mr-2 h-4 w-4" /> Delete
                  </Button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex flex-1 gap-6 min-h-0 overflow-hidden">
          {/* Main Document Area */}
          <div className="flex-1 flex flex-col min-w-0">
            <Card className={`flex flex-col flex-1 overflow-hidden border-none shadow-xl dark:bg-slate-800/50 backdrop-blur-sm ${focusMode ? 'rounded-none' : ''}`}>
              {focusMode && (
                <div className="absolute top-4 right-4 z-50">
                  <Button variant="secondary" size="sm" onClick={() => setFocusMode(false)}>
                    <Minimize2 className="mr-2 h-4 w-4" /> Exit Focus
                  </Button>
                </div>
              )}
              
              {!focusMode && (
                <CardHeader className="border-b dark:border-slate-700 bg-white/50 dark:bg-slate-800/50 shrink-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1 text-blue-500 text-sm font-medium uppercase">
                        <File className="h-4 w-4" />
                        <span>{material.type || 'DOCUMENT'}</span>
                      </div>
                      <CardTitle className="text-2xl md:text-3xl font-bold dark:text-white line-clamp-2">{material.title}</CardTitle>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon"><Share className="h-4 w-4" /></Button>
                      {material.fileUrl && (
                        <Button variant="outline" size="icon" onClick={() => window.open(material.fileUrl, '_blank')}><ExternalLink className="h-4 w-4" /></Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
              )}
              
              <CardContent className="p-0 flex-1 min-h-0 overflow-hidden">
                <div className="h-full w-full overflow-y-auto">
                  {renderContent()}
                </div>
              </CardContent>
            </Card>

            {!focusMode && material.description && (
              <div className="mt-6 shrink-0">
                <h3 className="text-lg font-bold mb-3 dark:text-white flex items-center gap-2">
                  <Eye className="h-5 w-5 text-blue-500" /> Description
                </h3>
                <Card className="border-none shadow-sm bg-white/50 dark:bg-slate-800/50">
                  <CardContent className="py-4 text-sm text-gray-600 dark:text-slate-300 leading-relaxed">
                    {material.description}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>

          {/* AI Study Assistant Panel */}
          <AnimatePresence>
            {showAssistant && (
              <motion.div
                initial={{ opacity: 0, width: 0, x: 20 }}
                animate={{ opacity: 1, width: 380, x: 0 }}
                exit={{ opacity: 0, width: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                className="shrink-0 flex flex-col"
              >
                <Card className="flex flex-col flex-1 border-none shadow-xl bg-white dark:bg-slate-800 overflow-hidden">
                  <CardHeader className="border-b dark:border-slate-700 bg-blue-50 dark:bg-blue-900/20 py-4 shrink-0">
                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                      <Sparkles className="h-5 w-5" />
                      <CardTitle className="text-lg font-bold">Study Assistant</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-y-auto p-4 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col justify-end">
                    <div className="text-center text-slate-500 dark:text-slate-400 mb-6">
                      <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-full inline-flex mb-3">
                        <MessageSquare className="h-6 w-6 text-blue-500" />
                      </div>
                      <p className="text-sm">Hi Sarah! I'm your study assistant.</p>
                      <p className="text-xs mt-1">Ask me anything about this material.</p>
                    </div>
                    {/* Placeholder for chat messages */}
                  </CardContent>
                  <div className="p-4 border-t dark:border-slate-700 bg-white dark:bg-slate-800 shrink-0">
                    <input 
                      type="text" 
                      placeholder="Ask a question..." 
                      className="w-full bg-slate-100 dark:bg-slate-900 border-none rounded-full px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl p-8 max-w-md w-full shadow-2xl border dark:border-slate-800">
            <h3 className="text-2xl font-bold mb-4 dark:text-white text-center">Delete Material?</h3>
            <p className="text-gray-600 dark:text-slate-400 mb-8 text-center">Are you sure you want to delete "{material.title}"?</p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
              <Button variant="destructive" className="flex-1" onClick={handleDelete}>Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
