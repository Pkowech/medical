'use client';

import React from 'react';
import { usePageHeader } from '@/core/providers/HeaderContext';

export const PageHeaderDisplay: React.FC = () => {
  const { header } = usePageHeader();

  if (!header) {
    return null;
  }

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-2">
        {header.icon && <div className="text-3xl">{header.icon}</div>}
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{header.title}</h1>
      </div>
      <p className="text-gray-600 dark:text-gray-400">{header.description}</p>
    </div>
  );
};
