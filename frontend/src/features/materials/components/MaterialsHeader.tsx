'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/shared/components/ui/button';
import { Upload } from 'lucide-react';

export const MaterialsHeader = () => {
  const router = useRouter();

  return (
    <div className="flex items-center justify-between">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Study Materials</h1>
      <div className="flex items-center gap-2">
        <Button variant="default" size="sm" onClick={() => router.push('/materials/upload')}>
          <Upload className="h-4 w-4 mr-2" />
          Upload Material
        </Button>
      </div>
    </div>
  );
};
