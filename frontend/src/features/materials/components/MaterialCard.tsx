'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileText, Share2, UserRound } from 'lucide-react';
import { Material } from '@/shared/types/materialInterface';
import { Button } from '@/shared/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/shared/components/ui/card';

interface MaterialCardProps {
  material: Material;
  canManageSharing?: boolean;
  onToggleCourseSharing?: (material: Material) => void;
}

const formatDate = (dateString?: string) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(date);
};

export const MaterialCard: React.FC<MaterialCardProps> = React.memo(({
  material,
  canManageSharing = false,
  onToggleCourseSharing,
}) => {
  const router = useRouter();
  const ownerName = material.user
    ? [material.user.firstName, material.user.lastName].filter(Boolean).join(' ')
    : material.author;
  const isSharedWithCourse = material.metadata?.shareWithCourse !== false;
  const fileUrl = material.fileUrl || material.url;

  return (
    <Card className="flex h-full min-w-0 flex-col rounded-xl border-border bg-card py-0 shadow-sm transition-shadow hover:shadow-md dark:border-border dark:bg-card">
      <CardHeader className="px-4 pb-0 pt-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            <FileText className="h-3.5 w-3.5" />
            {(material.type || material.contentType || 'File').toString().replaceAll('_', ' ')}
          </span>
          {material.size && (
            <span className="truncate text-xs text-muted-foreground dark:text-muted-foreground">{material.size}</span>
          )}
        </div>
        <CardTitle className="line-clamp-2 min-h-10 text-base font-semibold leading-5 text-foreground dark:text-foreground">
          {material.title}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col px-4 pb-4 pt-2">
        <p className="mb-4 line-clamp-2 min-h-10 text-sm leading-relaxed text-muted-foreground dark:text-muted-foreground">
          {material.description || 'No description provided.'}
        </p>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3 text-xs text-muted-foreground dark:border-border dark:text-muted-foreground">
          <span className="flex min-w-0 items-center gap-1.5">
            <UserRound className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{ownerName || 'Unknown author'}</span>
          </span>
          <span className="shrink-0">{formatDate(material.uploadDate || material.createdAt)}</span>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/study-planner/materials/${material.id}`)}
            className="h-9 flex-1 rounded-lg"
          >
            View material
          </Button>
          {fileUrl && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              asChild
              className="h-9 w-9 shrink-0 text-muted-foreground dark:text-muted-foreground"
            >
              <a href={fileUrl} target="_blank" rel="noopener noreferrer" aria-label={`Open file for ${material.title}`}>
                <Download className="h-4 w-4" />
              </a>
            </Button>
          )}
          {canManageSharing && material.unitId && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onToggleCourseSharing?.(material)}
              title={isSharedWithCourse ? 'Stop sharing with class' : 'Share with class'}
              aria-label={isSharedWithCourse ? `Stop sharing ${material.title} with class` : `Share ${material.title} with class`}
              className="h-9 w-9 shrink-0 text-muted-foreground dark:text-muted-foreground"
            >
              <Share2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
});
