'use client';

import React, { useEffect } from 'react';
import {
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useLayoutStore } from '@/core/stores/useLayoutStore';
import { usePageHeader } from '@/core/providers/HeaderContext';
import { applyPageMetadata, getPageMetadata } from '@/core/metadata/pageMetadata';

export const AppHeader: React.FC = () => {
  const {
    sidebarOpen,
    setSidebarOpen,
    sidebarCollapsed,
    setSidebarCollapsed,
  } = useLayoutStore();
  const { header } = usePageHeader();
  const pathname = usePathname();
  const route = getPageMetadata(pathname ?? '/');
  const title = header?.title || route.title;
  const description = header?.description || route.description;
  const isMetadataHeader = header?.presentation === 'metadata';

  useEffect(() => {
    applyPageMetadata({ title, description });
  }, [description, title]);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 pt-[env(safe-area-inset-top)] shadow-sm backdrop-blur-md dark:bg-card/95">
      <div
        className={`px-3 transition-all duration-300 sm:px-4 md:px-6 lg:px-8 ${
          isMetadataHeader ? 'py-2' : 'py-3 sm:py-4'
        }`}
      >
        <div className="flex min-h-10 items-center gap-3">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="mr-1 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted dark:hover:bg-secondary lg:hidden"
            aria-label="Open navigation sidebar"
            aria-expanded={sidebarOpen}
            aria-controls="app-sidebar"
          >
            <Menu aria-hidden="true" className="h-6 w-6" />
          </button>
          <button
            type="button"
            onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
            className="hidden rounded-lg p-2 text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 dark:hover:bg-secondary lg:inline-flex"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!sidebarCollapsed}
            aria-controls="app-sidebar"
          >
            {sidebarCollapsed ? (
              <PanelLeftOpen aria-hidden="true" className="h-5 w-5" />
            ) : (
              <PanelLeftClose aria-hidden="true" className="h-5 w-5" />
            )}
          </button>

          {!isMetadataHeader && header?.icon && (
            <div aria-hidden="true" className="shrink-0 text-xl sm:text-2xl">
              {header.icon}
            </div>
          )}
          {!isMetadataHeader && (
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-lg font-bold text-foreground sm:text-xl md:text-2xl">
                {title}
              </h1>
              {description && (
                <p className="hidden max-w-2xl truncate text-xs text-muted-foreground md:block sm:text-sm">
                  {description}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
