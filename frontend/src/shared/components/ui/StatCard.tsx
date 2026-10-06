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
    className={`min-w-0 bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/50 p-4 sm:p-5 lg:p-6 shadow-sm transition-all duration-300 group ${
      onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98]' : ''
    }`}
  >
    <div className="flex min-w-0 items-center gap-3 sm:gap-4">
      <div className={`shrink-0 rounded-xl p-2 sm:p-3 ${colorClass.replace('bg-', 'bg-')} bg-opacity-10 dark:bg-opacity-20 group-hover:bg-opacity-20 dark:group-hover:bg-opacity-30 transition-all`}>
        <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${colorClass.replace('bg-', 'text-')}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="mb-0.5 text-[11px] font-bold uppercase tracking-wide text-gray-500 dark:text-slate-400 sm:text-sm sm:tracking-wider">{title}</p>
        <div className="flex min-w-0 flex-wrap items-baseline gap-x-2">
          <p className="min-w-0 break-words text-xl font-black leading-tight text-gray-900 dark:text-white tracking-tight sm:text-2xl">{value}</p>
          {subtitle && (
            <div className="min-w-0 break-words text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-slate-400 sm:text-xs sm:tracking-wider">
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);
