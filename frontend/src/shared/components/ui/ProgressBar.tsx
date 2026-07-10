'use client';

import React from 'react';

interface ProgressBarProps {
  value: number; // 0-100
  colorClass?: string;
  className?: string;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  value,
  colorClass = 'bg-blue-600',
  className = '',
}) => {
  const safe = Math.max(0, Math.min(100, Math.round(value || 0)));
  // centralized inline style usage; keep eslint suppression local to this file

  const style = { width: `${safe}%` };

  return (
    <div className={`w-full bg-gray-200 dark:bg-slate-700 rounded-full ${className}`}>
      <div className={`${colorClass} h-full rounded-full transition-all duration-300`} style={style} />
    </div>
  );
};

export default ProgressBar;
