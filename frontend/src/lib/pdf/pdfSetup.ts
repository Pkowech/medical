/**
 * PDF.js Worker Setup
 * This module handles the initialization of PDF.js worker to avoid
 * "Failed to fetch" errors during module evaluation in Next.js/Turbopack
 */

let isWorkerInitialized = false;

/**
 * Initialize PDF.js worker with proper error handling
 * Must be called before PDFViewer component is rendered
 */
export const initPDFWorker = async (): Promise<boolean> => {
  // Skip if already initialized or not in browser environment
  if (isWorkerInitialized || typeof window === 'undefined') {
    return isWorkerInitialized;
  }

  try {
    // Import react-pdf to get pdfjs reference
    const { pdfjs } = await import('react-pdf');
    
    if (!pdfjs?.GlobalWorkerOptions) {
      console.error('[PDF Setup] pdfjs.GlobalWorkerOptions not available');
      return false;
    }

    // Set worker source - use local path first, fallback to CDN
    const workerPath = '/pdfjs/pdf.worker.min.mjs';
    
    // Verify the worker file exists by checking if we can construct a URL to it
    try {
      const workerUrl = new URL(workerPath, window.location.href).href;
      pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
    } catch (error) {
      // Fallback to relative path
      pdfjs.GlobalWorkerOptions.workerSrc = workerPath;
    }

    isWorkerInitialized = true;
    console.warn('[PDF Setup] PDF worker initialized successfully');
    return true;
  } catch (error) {
    console.error('[PDF Setup] Failed to initialize PDF worker:', error);
    
    // Try CDN fallback
    try {
      const { pdfjs } = await import('react-pdf');
      if (pdfjs?.GlobalWorkerOptions) {
        // Use a reliable CDN source
        pdfjs.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.mjs`;
        isWorkerInitialized = true;
        console.warn('[PDF Setup] PDF worker initialized from CDN fallback');
        return true;
      }
    } catch (cdnError) {
      console.error('[PDF Setup] CDN fallback also failed:', cdnError);
    }
    
    return false;
  }
};

/**
 * Hook to initialize PDF worker in a React component
 * Must be called at the top level of the component that uses PDFViewer
 */
export const usePDFWorkerInit = () => {
  const [isReady, setIsReady] = React.useState(isWorkerInitialized);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (isWorkerInitialized) {
      setIsReady(true);
      return;
    }

    initPDFWorker()
      .then(success => {
        if (success) {
          setIsReady(true);
        } else {
          setError('Failed to initialize PDF worker');
          setIsReady(false);
        }
      })
      .catch(err => {
        console.error('[usePDFWorkerInit] Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setIsReady(false);
      });
  }, []);

  return { isReady, error };
};

// Add React import for the hook
import React from 'react';
