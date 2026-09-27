'use client';

import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Loader2, AlertCircle, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import URLS from '@/lib/urls';

import { Document, Page, pdfjs } from 'react-pdf';
import type { PDFPageProxy } from 'pdfjs-dist';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

// Local worker configuration for maximum reliability and offline support
pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';

const PDF_DOCUMENT_OPTIONS = {
  cMapUrl: '/pdfjs/cmaps/',
  cMapPacked: true,
  standardFontDataUrl: '/pdfjs/standard_fonts/',
};
const PDF_BYTE_SOURCES = new WeakMap<Uint8Array, { data: Uint8Array }>();
const MIN_PDF_ZOOM = 0.5;
const MAX_PDF_ZOOM = 3;

type ContinuousPDFPageProps = {
  pageNumber: number;
  width: number;
  scrollRoot: HTMLDivElement | null;
};

const ContinuousPDFPage = ({ pageNumber, width, scrollRoot }: ContinuousPDFPageProps) => {
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const [isNearViewport, setIsNearViewport] = useState(false);
  const [aspectRatio, setAspectRatio] = useState(0.707);

  useEffect(() => {
    const pageContainer = pageContainerRef.current;
    if (!pageContainer || !scrollRoot) return;

    if (!('IntersectionObserver' in window)) {
      setIsNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsNearViewport(entry.isIntersecting),
      { root: scrollRoot, rootMargin: '1200px 0px' },
    );
    observer.observe(pageContainer);
    return () => observer.disconnect();
  }, [scrollRoot]);

  const handlePageLoad = useCallback((pdfPage: PDFPageProxy) => {
    const [x1, y1, x2, y2] = pdfPage.view;
    const pageWidth = Math.abs(x2 - x1);
    const pageHeight = Math.abs(y2 - y1);
    if (pageWidth > 0 && pageHeight > 0) {
      setAspectRatio(pageWidth / pageHeight);
    }
  }, []);

  return (
    <div
      ref={pageContainerRef}
      id={`pdf-page-${pageNumber}`}
      data-pdf-page={pageNumber}
      style={{ width, aspectRatio }}
      className="shrink-0 bg-white shadow-xl"
    >
      {isNearViewport && (
        <Page
          pageNumber={pageNumber}
          width={width}
          devicePixelRatio={1}
          renderTextLayer={false}
          renderAnnotationLayer={false}
          onLoadSuccess={handlePageLoad}
          className="overflow-hidden border border-gray-200 dark:border-slate-700"
        />
      )}
    </div>
  );
};

export type PDFViewerProps = {
  file: string | Uint8Array | Blob | File | null;
  onPageChange?: (currentPage: number, numPages: number) => void;
  initialPage?: number;
  headers?: Record<string, string>;
};

const PDFViewer = React.memo(({ file, onPageChange, initialPage = 1, headers }: PDFViewerProps) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [page, setPage] = useState<number>(initialPage || 1);
  const [pageInput, setPageInput] = useState(String(initialPage || 1));
  const [loading, setLoading] = useState(true);
  const [showLoadingUI, setShowLoadingUI] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [containerWidth, setContainerWidth] = useState<number>(800);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [scrollRoot, setScrollRoot] = useState<HTMLDivElement | null>(null);
  const scrollFrameRef = useRef<number | null>(null);
  const zoomRef = useRef(zoom);
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  zoomRef.current = zoom;
  const pageWidth = Math.round(containerWidth * zoom);

  const setScrollContainer = useCallback((node: HTMLDivElement | null) => {
    scrollContainerRef.current = node;
    setScrollRoot(node);
  }, []);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const updateWidth = () => {
      const availableWidth = scrollContainer.clientWidth - 32;
      if (availableWidth > 0) setContainerWidth(Math.floor(availableWidth));
    };

    updateWidth();
    const observer = new ResizeObserver(updateWidth);
    observer.observe(scrollContainer);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    const getTouchDistance = (touches: TouchList) => {
      const deltaX = touches[0].clientX - touches[1].clientX;
      const deltaY = touches[0].clientY - touches[1].clientY;
      return Math.hypot(deltaX, deltaY);
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length === 2) {
        pinchRef.current = {
          distance: getTouchDistance(event.touches),
          zoom: zoomRef.current,
        };
      }
    };

    const handleTouchMove = (event: TouchEvent) => {
      const pinch = pinchRef.current;
      if (!pinch || event.touches.length !== 2) return;

      event.preventDefault();
      const nextZoom = pinch.zoom * (getTouchDistance(event.touches) / pinch.distance);
      setZoom(Math.min(MAX_PDF_ZOOM, Math.max(MIN_PDF_ZOOM, nextZoom)));
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (event.touches.length < 2) pinchRef.current = null;
    };

    const handleWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      setZoom(current => Math.min(
        MAX_PDF_ZOOM,
        Math.max(MIN_PDF_ZOOM, current * Math.exp(-event.deltaY * 0.002)),
      ));
    };

    scrollContainer.addEventListener('touchstart', handleTouchStart, { passive: true });
    scrollContainer.addEventListener('touchmove', handleTouchMove, { passive: false });
    scrollContainer.addEventListener('touchend', handleTouchEnd, { passive: true });
    scrollContainer.addEventListener('touchcancel', handleTouchEnd, { passive: true });
    scrollContainer.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      scrollContainer.removeEventListener('touchstart', handleTouchStart);
      scrollContainer.removeEventListener('touchmove', handleTouchMove);
      scrollContainer.removeEventListener('touchend', handleTouchEnd);
      scrollContainer.removeEventListener('touchcancel', handleTouchEnd);
      scrollContainer.removeEventListener('wheel', handleWheel);
    };
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
    setPageInput(String(initialPage || 1));
  }, [initialPage]);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  const fileSource = useMemo(() => {
    if (!file) return null;
    
    if (file instanceof Uint8Array) {
      let source = PDF_BYTE_SOURCES.get(file);
      if (!source) {
        source = { data: file };
        PDF_BYTE_SOURCES.set(file, source);
      }
      return source;
    }
    
    if (typeof file === 'string' && headers) {
      try {
        const apiOrigin = new URL(URLS.API_BASE).origin;
        const fileOrigin = new URL(file, `${URLS.API_BASE}/`).origin;
        if (fileOrigin === apiOrigin) {
          return { url: file, httpHeaders: headers };
        }
      } catch {
        return file;
      }
    }
    
    return file;
  }, [file, headers]);

  const onDocumentLoadSuccess = (doc: { numPages: number }) => {
    setNumPages(doc.numPages);
    setLoading(false);
    setError(null);
    onPageChange?.(page, doc.numPages);
  };

  const onDocumentLoadError = (err: Error) => {
    console.error('[PDFViewer] Document Load Error:', err);
    setError('Failed to load PDF file. The file might be corrupted or inaccessible.');
    setLoading(false);
  };

  const navigateToPage = useCallback((requestedPage: number) => {
    const nextPage = Math.max(1, Math.min(requestedPage, numPages ?? requestedPage));
    setPage(nextPage);
    setPageInput(String(nextPage));
    document.getElementById(`pdf-page-${nextPage}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  }, [numPages]);

  const goPrev = () => navigateToPage(page - 1);
  const goNext = () => navigateToPage(page + 1);
  const zoomBy = (factor: number) => {
    setZoom(current => Math.min(MAX_PDF_ZOOM, Math.max(MIN_PDF_ZOOM, current * factor)));
  };
  const goToEnteredPage = () => {
    const requestedPage = Number(pageInput);
    if (Number.isInteger(requestedPage) && requestedPage > 0) {
      navigateToPage(requestedPage);
    } else {
      setPageInput(String(page));
    }
  };

  const updateCurrentPageFromScroll = useCallback(() => {
    const scrollRoot = scrollContainerRef.current;
    if (!scrollRoot) return;

    const rootTop = scrollRoot.getBoundingClientRect().top;
    const pageElements = scrollRoot.querySelectorAll<HTMLElement>('[data-pdf-page]');
    for (const element of pageElements) {
      const rect = element.getBoundingClientRect();
      if (rect.bottom > rootTop + 8) {
        const visiblePage = Number(element.dataset.pdfPage);
        if (visiblePage > 0) setPage(visiblePage);
        return;
      }
    }
  }, []);

  const handleScroll = useCallback(() => {
    if (scrollFrameRef.current !== null) return;
    scrollFrameRef.current = window.requestAnimationFrame(() => {
      scrollFrameRef.current = null;
      updateCurrentPageFromScroll();
    });
  }, [updateCurrentPageFromScroll]);

  useEffect(() => () => {
    if (scrollFrameRef.current !== null) {
      window.cancelAnimationFrame(scrollFrameRef.current);
    }
  }, []);

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
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border border-gray-200 bg-gray-100/50 dark:border-slate-800 dark:bg-slate-900/50">
      <div className="flex justify-between items-center p-3 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 z-10">
        <div className="flex gap-2">
          <Button 
            type="button"
            variant="outline" 
            size="sm" 
            onClick={goPrev} 
            disabled={page <= 1 || loading}
            className="h-8 w-8 p-0"
            aria-label="Previous page"
            title="Previous page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button 
            type="button"
            variant="outline" 
            size="sm" 
            onClick={goNext} 
            disabled={!!(numPages && page >= numPages) || loading}
            className="h-8 w-8 p-0"
            aria-label="Next page"
            title="Next page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="text-sm font-medium text-gray-700 dark:text-slate-300">
          {loading ? 'Loading...' : (
            <label className="inline-flex items-center gap-1">
              <span>Page</span>
              <input
                type="number"
                min={1}
                max={numPages ?? undefined}
                value={pageInput}
                disabled={!numPages || loading}
                aria-label="Current page"
                onChange={event => setPageInput(event.currentTarget.value)}
                onBlur={goToEnteredPage}
                onKeyDown={event => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    goToEnteredPage();
                  }
                }}
                className="w-10 border-b border-gray-300 bg-transparent text-center outline-none focus:border-blue-500 dark:border-slate-600"
              />
              <span>of {numPages || '?'}</span>
            </label>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => zoomBy(1 / 1.2)}
            disabled={zoom <= MIN_PDF_ZOOM}
            aria-label="Zoom out"
            title="Zoom out"
            className="h-8 w-8 p-0"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <button
            type="button"
            onClick={() => setZoom(1)}
            className="min-w-12 px-1 text-xs text-gray-600 hover:text-blue-600 dark:text-slate-300"
            aria-label="Reset zoom"
            title="Reset zoom"
          >
            {Math.round(zoom * 100)}%
          </button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => zoomBy(1.2)}
            disabled={zoom >= MAX_PDF_ZOOM}
            aria-label="Zoom in"
            title="Zoom in"
            className="h-8 w-8 p-0"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          {zoom !== 1 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setZoom(1)}
              aria-label="Reset zoom"
              title="Reset zoom"
              className="h-8 w-8 p-0"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div ref={setScrollContainer} onScroll={handleScroll} className="flex min-h-0 min-w-0 flex-1 justify-center overflow-x-auto overflow-y-auto overscroll-contain p-4 touch-pan-y scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-slate-700">
        <div className="relative flex w-max min-w-full flex-col items-center gap-4">
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
            options={PDF_DOCUMENT_OPTIONS}
          >
            {numPages && Array.from({ length: numPages }, (_, index) => (
              <ContinuousPDFPage
                key={index + 1}
                pageNumber={index + 1}
                width={pageWidth}
                scrollRoot={scrollRoot}
              />
            ))}
          </Document>
        </div>
      </div>
    </div>
  );
});

PDFViewer.displayName = 'PDFViewer';

export default PDFViewer;
