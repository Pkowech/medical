'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { Button } from '@/shared/components/ui/button';
import { Material } from '@/shared/types/materialInterface';
import { Download, FileText } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface MaterialCardProps {
  material: Material;
}

export const MaterialCard: React.FC<MaterialCardProps> = React.memo(({ material }) => {
  const router = useRouter();

  const getFileIcon = (type?: string) => {
    switch (type?.toLowerCase()) {
      case 'pdf':
        return <FileText className="h-6 w-6 text-red-500" />;
      case 'doc':
      case 'docx':
        return <FileText className="h-6 w-6 text-blue-500" />;
      case 'image':
      case 'jpg':
      case 'png':
        return <FileText className="h-6 w-6 text-green-500" />;
      default:
        return <FileText className="h-6 w-6 text-gray-500" />;
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const options: Intl.DateTimeFormatOptions = {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Badge variant="outline" className="uppercase dark:border-slate-700 dark:text-slate-300">
            {material.type || 'File'}
          </Badge>
          <span className="text-sm text-gray-500 dark:text-slate-400">{material.size || ''}</span>
        </div>
        <div className="flex items-center mt-2">
          {getFileIcon(material.type)}
          <CardTitle className="text-lg ml-2 dark:text-white">{material.title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-gray-500 dark:text-slate-400 mb-4 line-clamp-2">{material.description}</p>

        <div className="flex items-center justify-between text-sm mb-4">
          <span className="text-gray-500 dark:text-slate-500">By: {material.author || 'Unknown'}</span>
          <span className="text-gray-500 dark:text-slate-500">
            {material.uploadDate ? formatDate(material.uploadDate) : ''}
          </span>
        </div>

        <div className="flex justify-end">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push(`/materials/${material.id}`)}
            className="mr-2"
          >
            View
          </Button>
          <Button variant="default" size="sm">
            <Download className="h-4 w-4 mr-1" />
            Download
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});
