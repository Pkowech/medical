'use client';

import { useEffect } from 'react';
import { PageHeader, usePageHeader } from '@/core/providers/HeaderContext';

/**
 * Hook to set a page header for the current page
 * Automatically clears the header when the component unmounts
 * @param header The header configuration
 */
export const useSetPageHeader = (header: PageHeader | null) => {
  const { setHeader } = usePageHeader();

  useEffect(() => {
    if (header) {
      setHeader(header);
    }

    return () => {
      if (header) {
        setHeader(null);
      }
    };
  }, [header, setHeader]);
};
