import React from 'react';
import { Card, CardContent } from '@/shared/components/ui/card';
import { Badge } from '@/shared/components/ui/badge';
import { CheckCircle } from 'lucide-react';
import ProgressBar from '@/shared/components/ui/ProgressBar';
import SyncBadge from './SyncBadge';
import type { CourseProgress } from '@/shared/types/progressInterface';
import { formatLastUpdatedSafe } from './displayUtils';

type CourseWithSync = CourseProgress & { syncStatus?: 'pending' | 'synced' | 'error' };

const CourseProgressList = ({ courses }: { courses?: CourseProgress[] }) => {
  if (!courses || courses.length === 0) return null;
  return (
    <div>
      <h2 className="text-xl font-bold mb-4">Course Progress</h2>
      <div className="space-y-4">
        {courses.map((course) => (
          <Card key={course.id}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center">
                  <h3 className="font-medium">{course.title}</h3>
                  {course.completed && (
                    <Badge variant="secondary" className="ml-2 bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
                      <CheckCircle className="h-3 w-3 mr-1" aria-hidden="true" />
                      Completed
                    </Badge>
                  )}
                </div>
                <span className="text-sm font-medium">{course.progressPercentage}%</span>
              </div>

              <div className="w-full">
                <ProgressBar
                  value={course.progressPercentage}
                  className="h-2 rounded-full"
                  colorClass={course.completed ? 'bg-emerald-500' : 'bg-indigo-600'}
                />
              </div>

              <div className="mt-2 flex items-center justify-between">
                <p className="text-xs text-gray-400">Last synced: {formatLastUpdatedSafe((course as CourseWithSync).lastUpdated)}</p>
                <div>{(course as CourseWithSync).syncStatus && <SyncBadge status={(course as CourseWithSync).syncStatus} />}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default CourseProgressList;
