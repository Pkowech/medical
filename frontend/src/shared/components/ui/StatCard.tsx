'use client';

import React from 'react';
import { LucideIcon } from 'lucide-react';

export interface StatCardProps {
  icon: LucideIcon | React.ElementType;
  title: string;
  value: string | number;
  subtitle?: string;
  colorClass: string;
  onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({ icon: Icon, title, value, subtitle, colorClass, onClick }) => (
  <div 
    onClick={onClick}
    className={`bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700/50 p-6 shadow-sm transition-all duration-300 group ${
      onClick ? 'cursor-pointer hover:shadow-md hover:scale-[1.02] active:scale-[0.98]' : ''
    }`}
  >
    <div className="flex items-center gap-4">
      <div className={`p-3 rounded-xl ${colorClass.replace('bg-', 'bg-')} bg-opacity-10 dark:bg-opacity-20 group-hover:bg-opacity-20 dark:group-hover:bg-opacity-30 transition-all`}>
        <Icon className={`w-6 h-6 ${colorClass.replace('bg-', 'text-')}`} />
      </div>
      <div className="flex-1">
        <p className="text-xs font-bold text-gray-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">{title}</p>
        <div className="flex items-baseline gap-2">
          <p className="text-2xl font-black text-gray-900 dark:text-white tracking-tight">{value}</p>
          {subtitle && (
            <div className="text-[10px] text-gray-400 dark:text-slate-500 font-semibold uppercase tracking-wider">
              {subtitle}
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
);
