import React from 'react';
import { ProgressData } from '@/shared/types/progressInterface';
import { getNumberField, getStringField } from '@/features/learning-management/utils/progressUtils';

const ProgressMetadata = ({ progressData }: { progressData?: ProgressData | null }) => {
  if (!progressData) return null;

  const lastUpdated = getNumberField(progressData, 'lastUpdated');
  const lastActivity = getStringField(progressData, 'lastActivity');

  return (
    <div className="mb-4 p-3 border rounded-md bg-white">
      <h2 className="text-lg font-medium">Progress Metadata</h2>
      <div className="mt-2 text-sm text-gray-700">
        <div>Overall progress: {progressData.overallProgress}%</div>
        <div>Courses completed: {progressData.coursesCompleted} / {progressData.totalCourses}</div>
        <div>Last activity: {lastActivity ?? '—'}</div>
        <div>Last updated (epoch ms): {lastUpdated ?? '—'}</div>
      </div>
    </div>
  );
};

export default ProgressMetadata;
