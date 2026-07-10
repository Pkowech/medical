'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, Download } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';

import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Local worker configuration for maximum reliability and offline support
pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';

export type PDFViewerProps = {
  file: string | Uint8Array | Blob | File | null;
  onPageChange?: (currentPage: number, numPages: number) => void;
  initialPage?: number;
  headers?: Record<string, string>;
};

const PDFViewer = React.memo(({ file, onPageChange, initialPage = 1, headers }: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [page, setPage] = useState<number>(initialPage || 1);
  const [loading, setLoading] = useState(true);
  const [showLoadingUI, setShowLoadingUI] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>(800);

  useEffect(() => {
    const handleResize = () => {
      setContainerWidth(Math.min(window.innerWidth - 80, 800));
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading) {
      timer = setTimeout(() => setShowLoadingUI(true), 300);
    } else {
      setShowLoadingUI(false);
    }
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    setPage(initialPage || 1);
  }, [initialPage]);

  const fileSource = useMemo(() => {
    if (!file) return null;
    
    if (file instanceof Uint8Array) {
      return { data: file };
    }
    
    if (typeof file === 'string' && headers) {
      return { url: file, httpHeaders: headers };
    }
    
    return file;
  }, [file, headers]);

  // Use local assets for maximum reliability and offline support
  const documentOptions = useMemo(() => ({
    cMapUrl: '/pdfjs/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: '/pdfjs/standard_fonts/',
  }), []);

  const onDocumentLoadSuccess = (doc: { numPages: number }) => {
    setNumPages(doc.numPages);
    setLoading(false);
    onPageChange?.(page, doc.numPages);
  };

  const onDocumentLoadError = (err: Error) => {
    console.error('[PDFViewer] Document Load Error:', err);
    setError('Failed to load PDF file. The file might be corrupted or inaccessible.');
    setLoading(false);
  };

  const goPrev = () => setPage(p => Math.max(1, p - 1));
  const goNext = () => setPage(p => (numPages ? Math.min(numPages, p + 1) : p + 1));

  useEffect(() => {
    if (numPages && !loading && !error) onPageChange?.(page, numPages);
  }, [page, numPages, loading, error]);

  if (!file) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-gray-500 bg-gray-50 dark:bg-slate-800/50 rounded-lg border-2 border-dashed border-gray-200 dark:border-slate-700">
        <AlertCircle className="h-12 w-12 mb-4 opacity-20" />
        <p>No PDF file provided.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-red-50 dark:bg-red-500/5 rounded-lg border border-red-100 dark:border-red-500/20">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Error Loading PDF</h3>
        <p className="text-sm text-gray-600 dark:text-slate-400 max-w-xs mb-6">{error}</p>
        <Button variant="outline" onClick={() => window.open(typeof file === 'string' ? file : '', '_blank')}>
          <Download className="h-4 w-4 mr-2" />
          Download to View
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-gray-100/50 dark:bg-slate-900/50 rounded-xl border border-gray-200 dark:border-slate-800">
      <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 z-10">
        <div className="flex gap-2">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={goPrev} 
            disabled={page <= 1 || loading}
            className="h-8 w-8 p-0"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={goNext} 
            disabled={!!(numPages && page >= numPages) || loading}
            className="h-8 w-8 p-0"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-sm font-medium text-gray-700 dark:text-slate-300">
          {loading ? 'Loading...' : `Page ${page} of ${numPages || '?'}`}
        </div>
        <div className="w-16" />
      </div>

      <div className="flex-1 overflow-auto p-4 flex justify-center scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-slate-700">
        <div className="relative">
          {showLoadingUI && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 z-20 backdrop-blur-[2px] rounded-lg">
              <div className="flex flex-col items-center">
                <Loader2 className="h-10 w-10 text-blue-500 animate-spin mb-2" />
                <span className="text-sm font-medium">Processing Document...</span>
              </div>
            </div>
          )}
          <Document 
            file={fileSource}
            onLoadSuccess={onDocumentLoadSuccess} 
            onLoadError={onDocumentLoadError}
            loading={null}
            options={documentOptions}
          >
            <Page 
              pageNumber={page} 
              width={containerWidth} 
              renderTextLayer={true}
              renderAnnotationLayer={true}
              className="shadow-2xl border border-gray-200 dark:border-slate-700 rounded-lg overflow-hidden"
            />
          </Document>
        </div>
      </div>
    </div>
  );
});

PDFViewer.displayName = 'PDFViewer';

export default PDFViewer;
