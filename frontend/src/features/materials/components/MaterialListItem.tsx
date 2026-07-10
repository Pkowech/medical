'use client';

import React from 'react';
import { Material } from '@/shared/types/materialInterface';
import { FileText, Download, Eye, MoreHorizontal, File, Image as ImageIcon, Film } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import { useRouter } from 'next/navigation';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';

interface MaterialListItemProps {
  material: Material;
  onView: (material: Material) => void;
}

export const MaterialListItem: React.FC<MaterialListItemProps> = React.memo(({ material, onView }) => {

  const getFileIcon = (type?: string) => {
    const t = type?.toLowerCase();
    if (t?.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
    if (t?.includes('word') || t?.includes('doc')) return <FileText className="h-5 w-5 text-blue-500" />;
    if (t?.includes('image') || t?.includes('jpg') || t?.includes('png')) return <ImageIcon className="h-5 w-5 text-green-500" />;
    if (t?.includes('video') || t?.includes('mp4')) return <Film className="h-5 w-5 text-purple-500" />;
    return <File className="h-5 w-5 text-gray-400" />;
  };

  const formatSize = (size?: string | number) => {
    if (!size) return '-';
    if (typeof size === 'string') return size;
    return `${(size / 1024 / 1024).toFixed(2)} MB`;
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div
      onClick={() => onView(material)}
      className="group flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-slate-800/50 rounded-lg transition-colors cursor-pointer border-b border-transparent hover:border-gray-100 dark:hover:border-slate-800"
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center bg-gray-50 dark:bg-slate-800 rounded-lg">
          {getFileIcon(material.type)}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="text-sm font-medium text-gray-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {material.title}
          </h4>
          <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500 dark:text-slate-400 sm:hidden">
            <span>{material.type}</span>
            <span>•</span>
            <span>{formatSize(material.size)}</span>
          </div>
        </div>
      </div>

      <div className="hidden sm:flex items-center gap-8 text-sm text-gray-500 dark:text-slate-400 flex-shrink-0">
        <span className="w-24 truncate">{material.type || 'File'}</span>
        <span className="w-20 text-right">{formatSize(material.size)}</span>
        <span className="w-28 text-right">{formatDate(material.uploadDate)}</span>
        <span className="w-32 truncate text-right">{material.author || 'Unknown'}</span>
      </div>

      <div className="ml-4 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          onClick={(e) => {
            e.stopPropagation();
            onView(material);
          }}
          title="View"
        >
          <Eye className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700"
          onClick={(e) => {
            e.stopPropagation();
            if (material.fileUrl) window.open(material.fileUrl, '_blank');
          }}
          title="Download"
        >
          <Download className="h-4 w-4" />
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onView(material)}>
              View Details
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {}}>
              Share
            </DropdownMenuItem>
            <DropdownMenuItem className="text-red-600 focus:text-red-600">
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  // Return true if props are equal (don't re-render)
  // Return false if props changed (re-render)
  return (
    prevProps.material.id === nextProps.material.id &&
    prevProps.material.title === nextProps.material.title &&
    prevProps.material.type === nextProps.material.type &&
    prevProps.material.size === nextProps.material.size &&
    prevProps.material.uploadDate === nextProps.material.uploadDate &&
    prevProps.material.author === nextProps.material.author
  );
});
