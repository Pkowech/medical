'use client';

import React from 'react';
import { Material } from '@/shared/types/materialInterface';
import { Download, Eye, File, FileText, Film, Image as ImageIcon, MoreHorizontal, Share2 } from 'lucide-react';
import { Button } from '@/shared/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/shared/components/ui/dropdown-menu';

interface MaterialListItemProps {
  material: Material;
  onView: (material: Material) => void;
  canManageSharing?: boolean;
  onToggleCourseSharing?: (material: Material) => void;
}

const getFileIcon = (type?: string) => {
  const normalizedType = type?.toLowerCase() ?? '';
  if (normalizedType.includes('pdf')) return <FileText className="h-5 w-5 text-rose-600 dark:text-rose-400" />;
  if (normalizedType.includes('word') || normalizedType.includes('doc')) {
    return <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />;
  }
  if (normalizedType.includes('image') || /\.(jpe?g|png|webp)/.test(normalizedType)) {
    return <ImageIcon className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />;
  }
  if (normalizedType.includes('video') || normalizedType.includes('mp4')) {
    return <Film className="h-5 w-5 text-violet-600 dark:text-violet-400" />;
  }
  return <File className="h-5 w-5 text-muted-foreground dark:text-muted-foreground" />;
};

const formatSize = (size?: string | number) => {
  if (!size) return '—';
  if (typeof size === 'string') return size;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
};

const formatDate = (dateString?: string) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
};

export const MaterialListItem: React.FC<MaterialListItemProps> = React.memo(({
  material,
  onView,
  canManageSharing = false,
  onToggleCourseSharing,
}) => {
  const ownerName = material.user
    ? [material.user.firstName, material.user.lastName].filter(Boolean).join(' ')
    : material.author;
  const isSharedWithCourse = material.metadata?.shareWithCourse !== false;
  const fileUrl = material.fileUrl || material.url;

  return (
    <article className="group flex min-w-0 items-center gap-3 rounded-lg px-3 py-3 transition-colors hover:bg-background dark:hover:bg-card/60 sm:gap-4">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 dark:bg-blue-950/50">
        {getFileIcon(material.type || material.contentType)}
      </span>

      <button
        type="button"
        onClick={() => onView(material)}
        className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <span className="block truncate text-sm font-medium text-foreground transition-colors group-hover:text-blue-700 dark:text-muted-foreground dark:group-hover:text-blue-300">
          {material.title}
        </span>
        <span className="mt-0.5 block truncate text-xs text-muted-foreground dark:text-muted-foreground">
          {[material.type || material.contentType, formatSize(material.size), ownerName || 'Unknown author']
            .filter(Boolean)
            .join(' · ')}
        </span>
      </button>

      <span className="hidden w-28 shrink-0 text-right text-xs text-muted-foreground dark:text-muted-foreground md:block">
        {formatDate(material.uploadDate || material.createdAt)}
      </span>

      <div className="flex shrink-0 items-center gap-1">
        {fileUrl && (
          <Button
            variant="ghost"
            size="icon"
            asChild
            className="h-9 w-9 text-muted-foreground hover:bg-blue-50 hover:text-blue-700 dark:text-muted-foreground dark:hover:bg-blue-950/50 dark:hover:text-blue-300"
          >
            <a href={fileUrl.startsWith('/') ? `${window.location.origin}${fileUrl}` : fileUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open file for ${material.title}`}>
              <Download className="h-4 w-4" />
            </a>
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={() => onView(material)}
          aria-label={`View ${material.title}`}
          className="h-9 w-9 text-muted-foreground hover:bg-blue-50 hover:text-blue-700 dark:text-muted-foreground dark:hover:bg-blue-950/50 dark:hover:text-blue-300"
        >
          <Eye className="h-4 w-4" />
        </Button>
        {canManageSharing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`More options for ${material.title}`}
                className="h-9 w-9 text-muted-foreground dark:text-muted-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  onToggleCourseSharing?.(material);
                }}
              >
                <Share2 className="mr-2 h-4 w-4" />
                {isSharedWithCourse ? 'Stop sharing with class' : 'Share with class'}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </article>
  );
});
