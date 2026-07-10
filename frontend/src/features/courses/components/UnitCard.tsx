'use client';

import React from 'react';
import { Clock, BookOpen, Lock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import type { CourseUnit } from '@/shared/types/courseInterface';

interface UnitCardProps {
  unit: CourseUnit;
  index: number;
  onClick: (unitId: string) => void;
}

const getUnitStatusBadge = (unit: CourseUnit) => {
  if (unit.isCompleted) {
    return <Badge className="bg-green-100 text-green-800">Completed</Badge>;
  }
  return <Badge className="bg-blue-100 text-blue-800">In Progress</Badge>;
};

export const UnitCard = ({ unit, index, onClick }: UnitCardProps) => {
  return (
    <Card 
      className="h-full hover:shadow-lg hover:border-blue-400 dark:hover:border-blue-500 transition-all duration-300 cursor-pointer overflow-hidden group bg-white/80 dark:bg-slate-800/50 backdrop-blur-sm border border-gray-200 dark:border-slate-700/50"
      onClick={() => onClick(unit.id)}
    >
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 sm:gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <span className="inline-flex items-center justify-center shrink-0 w-8 h-8 rounded-full bg-linear-to-br from-blue-100 to-blue-50 dark:from-blue-900 dark:to-blue-800 text-blue-600 dark:text-blue-300 text-sm font-bold group-hover:from-blue-200 group-hover:to-blue-100 dark:group-hover:from-blue-800 dark:group-hover:to-blue-700 transition-colors">
                {index + 1}
              </span>
              <CardTitle className="text-lg line-clamp-2">{unit.title || unit.name}</CardTitle>
            </div>
          </div>
          <div className="shrink-0">{getUnitStatusBadge(unit)}</div>
        </div>
        {unit.description && (
          <CardDescription className="line-clamp-2 mt-1">{unit.description}</CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Unit Stats */}
        <div className="space-y-2">
          {unit.estimatedMinutes && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
              <Clock className="w-4 h-4 shrink-0" />
              <span>{unit.estimatedMinutes} minutes</span>
            </div>
          )}
          {unit.topics && unit.topics.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>{unit.topics.length} topic{unit.topics.length !== 1 ? 's' : ''}</span>
            </div>
          )}
          {unit.materials && unit.materials.length > 0 && (
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-slate-400">
              <Lock className="w-4 h-4 shrink-0" />
              <span>{unit.materials.length} material{unit.materials.length !== 1 ? 's' : ''}</span>
            </div>
          )}
        </div>

        {/* Learning Objectives */}
        {Array.isArray(unit.learningObjectives) && unit.learningObjectives.length > 0 && (
          <div className="pt-3 border-t border-gray-200 dark:border-slate-700">
            <p className="text-xs font-semibold text-gray-700 dark:text-slate-300 mb-2">Learning Objectives:</p>
            <ul className="text-xs text-gray-600 dark:text-slate-400 space-y-1">
              {unit.learningObjectives.slice(0, 2).map((obj: string, i: number) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="text-blue-500 shrink-0 mt-0.5">✓</span>
                  <span className="line-clamp-1">{obj}</span>
                </li>
              ))}
              {unit.learningObjectives.length > 2 && (
                <li className="text-blue-600 dark:text-blue-400 font-medium">
                  +{unit.learningObjectives.length - 2} more
                </li>
              )}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
