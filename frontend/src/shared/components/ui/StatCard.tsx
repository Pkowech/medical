'use client';

import React from 'react';
import { type ElementType } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface StatCardProps {
  icon: LucideIcon | ElementType;
  title: string;
  value: string | number;
  subtitle?: string;
  colorClass: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({ icon: Icon, title, value, subtitle, colorClass, onClick }) => (
  <div
    onClick={onClick}
    className={`group min-w-0 rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-sm transition-all duration-300 sm:p-5 lg:p-6 ${
      onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98]' : ''
    }`}
  >
    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
      <div className={`shrink-0 rounded-xl bg-current/10 p-2.5 transition-colors group-hover:bg-current/15 sm:p-3 ${colorClass.replace('bg-', 'text-')}`}>
        <Icon aria-hidden="true" className="h-[18px] w-[18px] text-current sm:h-5 sm:w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground sm:text-sm sm:tracking-wider">{title}</p>
        <div className="min-w-0">
          <p className="break-words text-xl font-black leading-tight tracking-tight text-foreground sm:text-2xl">{value}</p>
          {subtitle && (
            <div className="mt-1 break-words text-[10px] font-medium text-muted-foreground sm:text-xs">
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);
