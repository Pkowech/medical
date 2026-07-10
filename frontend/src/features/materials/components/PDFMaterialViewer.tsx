'use client';

import React, { useState, useCallback } from 'react';
import { Document, Page } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download } from 'lucide-react';
import { useXapi } from '@/lib/xapi/useXapi';

interface PDFMaterialViewerProps {
  materialId: string;
  materialTitle: string;
  materialUrl: string;
  courseId: string;
  onViewingStateChange?: (viewed: boolean) => void;
}

export const PDFMaterialViewer: React.FC<PDFMaterialViewerProps> = ({
  materialId,
  materialTitle,
  materialUrl,
  courseId,
  onViewingStateChange,
}) => {
  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { trackViewed, trackCompleted } = useXapi();

  // Track PDF viewing with xAPI
  const handlePDFLoaded = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setIsLoading(false);

    // Track document opened
    trackViewed({
      objectName: materialTitle,
      objectId: materialId,
      activityType: 'Document',
      courseId,
    });

    onViewingStateChange?.(true);
  }, [materialId, materialTitle, courseId, trackViewed, onViewingStateChange]);

  const handlePageChange = useCallback(
    (page: number) => {
      setCurrentPage(page);

      // Track page viewed
      trackViewed({
        objectName: `${materialTitle} - Page ${page}`,
        objectId: `${materialId}_page_${page}`,
        activityType: 'Document',
        courseId,
      });
    },
    [materialId, materialTitle, courseId, trackViewed]
  );

  const handleDocumentComplete = useCallback(() => {
    // Track document completed when reached last page
    trackCompleted({
      objectName: materialTitle,
      objectId: materialId,
      activityType: 'Document',
      courseId,
    });
  }, [materialId, materialTitle, courseId, trackCompleted]);

  const handleNextPage = useCallback(() => {
    if (currentPage < numPages) {
      handlePageChange(currentPage + 1);
    }
  }, [currentPage, numPages, handlePageChange]);

  const handlePrevPage = useCallback(() => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1);
    }
  }, [currentPage, handlePageChange]);

  const handleZoomIn = useCallback(() => {
    setScale(prev => Math.min(prev + 0.1, 2));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale(prev => Math.max(prev - 0.1, 0.5));
  }, []);

  const handleDownload = useCallback(() => {
    const link = document.createElement('a');
    link.href = materialUrl;
    link.download = `${materialTitle}.pdf`;
    link.click();
  }, [materialUrl, materialTitle]);

  if (error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800 p-6">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400 font-semibold">Error loading PDF</p>
          <p className="text-red-500 dark:text-red-300 text-sm mt-2">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-100 dark:bg-slate-800 rounded-lg overflow-hidden">
      {/* Controls Bar */}
      <div className="bg-white dark:bg-slate-700 border-b border-gray-200 dark:border-slate-600 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {/* Navigation */}
          <button
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            aria-label="Previous page"
          >
            <ChevronLeft size={20} />
          </button>

          <span className="text-sm font-medium px-4 py-2 bg-gray-100 dark:bg-slate-600 rounded">
            {currentPage} / {numPages}
          </span>

          <button
            onClick={handleNextPage}
            disabled={currentPage >= numPages}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            aria-label="Next page"
          >
            <ChevronRight size={20} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Zoom Controls */}
          <button
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            aria-label="Zoom out"
          >
            <ZoomOut size={20} />
          </button>

          <span className="text-sm font-medium px-4 py-2 bg-gray-100 dark:bg-slate-600 rounded">
            {Math.round(scale * 100)}%
          </span>

          <button
            onClick={handleZoomIn}
            disabled={scale >= 2}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
            aria-label="Zoom in"
          >
            <ZoomIn size={20} />
          </button>

          {/* Download */}
          <button
            onClick={handleDownload}
            className="p-2 rounded hover:bg-gray-100 dark:hover:bg-slate-600 transition ml-2"
            aria-label="Download PDF"
          >
            <Download size={20} />
          </button>
        </div>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 overflow-auto flex items-center justify-center">
        {isLoading ? (
          <div className="text-gray-600 dark:text-slate-400">
            <p>Loading PDF...</p>
          </div>
        ) : (
          <Document
            file={materialUrl}
            onLoadSuccess={handlePDFLoaded}
            onLoadError={(error) => {
              setError(error.message || 'Failed to load PDF');
              setIsLoading(false);
            }}
            loading={<p className="text-gray-600 dark:text-slate-400">Loading document...</p>}
          >
            <Page
              pageNumber={currentPage}
              scale={scale}
              renderTextLayer={true}
              renderAnnotationLayer={true}
              onRenderSuccess={() => {
                if (currentPage === numPages) {
                  handleDocumentComplete();
                }
              }}
            />
          </Document>
        )}
      </div>

      {/* Status Bar */}
      <div className="bg-white dark:bg-slate-700 border-t border-gray-200 dark:border-slate-600 px-4 py-2 text-sm text-gray-600 dark:text-slate-400">
        <p>{materialTitle}</p>
      </div>
    </div>
  );
};
