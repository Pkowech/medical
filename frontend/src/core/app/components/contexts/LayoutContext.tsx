'use client';

// Re-export the canonical LayoutProvider and useLayout hook from the
// consolidated provider to ensure a single source of truth across the app.
export { LayoutProvider, useLayout } from '@/core/providers/LayoutContext';
