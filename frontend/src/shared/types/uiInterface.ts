import React from 'react';

/**
 * Statistics card properties used across dashboards and feature interfaces.
 * Consolidates various local definitions into a flexible, single source of truth.
 */
export interface StatCardProps {
  icon: React.ElementType;
  title: string;
  value: string | number;
  subtitle?: string;
  accent?: string;         // e.g. 'text-indigo-500'
  color?: string;          // hex or tailwind class
  change?: number;         // percentage change
  trend?: 'up' | 'down';
  className?: string;      // additional styling
}
