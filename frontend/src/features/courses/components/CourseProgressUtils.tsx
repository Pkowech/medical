'use client';

import React from 'react';
import { ProgressBar } from '@/shared/components/ui/ProgressBar';
import type { CourseUnit } from '@/shared/types/courseInterface';

interface CourseProgressData {
  totalUnits: number;
  completedUnits: number;
  progressPercentage: number;
}

/**
 * Calculate course progress from units
 */
export const calculateCourseProgress = (units: CourseUnit[]): CourseProgressData => {
  const totalUnits = units.length;
  const completedUnits = units.filter(u => u.isCompleted).length;
  const progressPercentage = totalUnits > 0 ? (completedUnits / totalUnits) * 100 : 0;

  return {
    totalUnits,
    completedUnits,
    progressPercentage,
  };
};

interface CourseProgressOverviewProps {
  totalUnits: number;
  completedUnits: number;
  progressPercentage: number;
  courseName?: string;
}

/**
 * Reusable course progress summary card
 */
export const CourseProgressOverview = ({
  totalUnits,
  completedUnits,
  progressPercentage,
  courseName = 'Course',
}: CourseProgressOverviewProps) => {
  return (
    <div className="bg-card/80 dark:bg-card/50 backdrop-blur-sm rounded-2xl p-6 shadow-sm border border-border dark:border-border/50 animate-in fade-in slide-in-from-top-2 duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground dark:text-foreground">
            {courseName} Progress
          </h2>
          <p className="text-sm text-muted-foreground dark:text-muted-foreground mt-1">
            {completedUnits} of {totalUnits} units completed
          </p>
        </div>
        <span className="text-3xl font-bold text-blue-600 dark:text-blue-400 text-center sm:text-right">
          {completedUnits}/{totalUnits}
        </span>
      </div>
      <ProgressBar value={progressPercentage} className="h-2" />
    </div>
  );
};
