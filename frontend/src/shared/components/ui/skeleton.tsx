// /src/components/ui/skeleton.tsx
'use client';
import { cn } from '@/lib/utils/cn';

interface SkeletonProps {
  className?: string;
}

export const Skeleton = ({ className }: SkeletonProps) => {
  return (
    <div
      className={cn('animate-pulse bg-gray-200 rounded', className)}
      role="status"
      aria-label="Loading"
    />
  );
};
